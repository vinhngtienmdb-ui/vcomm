// Cài đặt hóa đơn điện tử theo công ty (CONG_VIEC_16; CHUC_NANG_76; QUYTAC_NGHIEPVU_103; API_92).
import { Inject, Injectable } from "@nestjs/common";
import type { EinvoiceProvider, EinvoiceSettingsResponse, EinvoiceSimulation, updateEinvoiceSettingsSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { decryptSecret, encryptSecret } from "../common/secret-box";
import { DATABASE, type Database } from "../database/database.module";
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import type { ProviderConfig } from "./providers/provider";

export const einvoicePermissions = { view: "finance.einvoice.view", manage: "finance.einvoice.manage", setup: "finance.einvoice.setup" } as const;
type Executor = Pick<Database, "execute">;

// Bộ giả lập chỉ dùng ngoài môi trường thật.
export const simulatorAllowed = () => process.env.NODE_ENV !== "production";

export type SettingsRow = {
  enabled: boolean;
  start_date: string | null;
  provider: EinvoiceProvider;
  environment: "test" | "production";
  with_tax_code: boolean;
  template_code: "1" | "2";
  connection: { appId?: string | null; taxCode?: string | null; username?: string | null };
  secret_value: Buffer | null;
  simulation: EinvoiceSimulation;
  version: number;
};

export async function settingsRow(executor: Executor, companyId: string): Promise<SettingsRow | null> {
  return (
    (
      await executor.execute<SettingsRow>(sql`
      SELECT enabled, start_date::text, provider, environment, with_tax_code, template_code, connection, secret_value, simulation, version
      FROM finance.einvoice_settings WHERE company_id = ${companyId}`)
    ).rows[0] ?? null
  );
}

export async function seriesFor(executor: Executor, companyId: string, year: number): Promise<string | null> {
  return (await executor.execute<{ series: string }>(sql`SELECT series FROM finance.einvoice_series WHERE company_id = ${companyId} AND year = ${year}`)).rows[0]?.series ?? null;
}

export function providerConfig(companyId: string, row: SettingsRow): ProviderConfig {
  return {
    companyId,
    environment: row.environment,
    withTaxCode: row.with_tax_code,
    appId: row.connection.appId ?? null,
    taxCode: row.connection.taxCode ?? null,
    username: row.connection.username ?? null,
    password: row.secret_value ? decryptSecret(row.secret_value) : null,
    simulation: row.simulation,
  };
}

@Injectable()
export class EinvoiceSettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async get(actor: Actor): Promise<EinvoiceSettingsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, einvoicePermissions.view, einvoicePermissions.setup);
    const row = await settingsRow(this.database, actor.companyId);
    const series = await this.database.execute<{ year: number; series: string }>(sql`SELECT year, series FROM finance.einvoice_series WHERE company_id = ${actor.companyId} ORDER BY year`);
    const password = row?.secret_value ? decryptSecret(row.secret_value) : null;
    return {
      enabled: row?.enabled ?? false,
      startDate: row?.start_date ?? null,
      provider: row?.provider ?? (simulatorAllowed() ? "simulator" : "misa"),
      environment: row?.environment ?? "test",
      withTaxCode: row?.with_tax_code ?? true,
      templateCode: row?.template_code ?? "1",
      appId: row?.connection.appId ?? null,
      taxCode: row?.connection.taxCode ?? null,
      username: row?.connection.username ?? null,
      passwordLastFour: password ? password.slice(-4) : null,
      simulation: row?.simulation ?? "normal",
      series: series.rows.map((item) => ({ year: Number(item.year), series: item.series })),
      simulatorAllowed: simulatorAllowed(),
      canSetup: granted.has(einvoicePermissions.setup),
      version: row?.version ?? 0,
    };
  }

  async update(actor: Actor, input: z.output<typeof updateEinvoiceSettingsSchema>): Promise<EinvoiceSettingsResponse> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.setup);
    const fields: NonNullable<NonNullable<ConstructorParameters<typeof ApiError>[2]>["fields"]> = {};
    if (input.provider === "simulator" && !simulatorAllowed()) fields.provider = "einvoiceSimulatorNotAllowed";
    if (input.enabled && !input.startDate) fields.startDate = "required";
    const years = new Set<number>();
    input.series.forEach((item, index) => {
      if (years.has(item.year)) fields[`series.${index}.year`] = "einvoiceSeriesDuplicate";
      years.add(item.year);
      if (item.series.slice(1, 3) !== String(item.year).slice(2)) fields[`series.${index}.series`] = "einvoiceSeriesYear";
      if ((item.series.charAt(0) === "C") !== input.withTaxCode) fields[`series.${index}.series`] = "einvoiceSeriesKind";
    });
    await this.database.transaction(async (transaction) => {
      const before = await settingsRow(transaction, actor.companyId);
      if ((before?.version ?? 0) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (input.provider === "misa") {
        if (!input.appId) fields.appId = "required";
        if (!input.taxCode) fields.taxCode = "required";
        if (!input.username) fields.username = "required";
        if (!input.password && !before?.secret_value) fields.password = "required";
      }
      if (input.enabled && input.startDate && !input.series.some((item) => item.year === Number(input.startDate!.slice(0, 4)))) fields.series = "einvoiceSeriesMissingStart";
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      const secret = input.password ? encryptSecret(input.password) : (before?.secret_value ?? null);
      const connection = { appId: input.appId, taxCode: input.taxCode, username: input.username };
      await transaction.execute(sql`
        INSERT INTO finance.einvoice_settings (company_id, enabled, start_date, provider, environment, with_tax_code, template_code, connection, secret_value, simulation, updated_by, version)
        VALUES (${actor.companyId}, ${input.enabled}, ${input.startDate}, ${input.provider}, ${input.environment}, ${input.withTaxCode}, ${input.templateCode}, ${JSON.stringify(connection)}::jsonb,
          ${secret}, ${input.simulation}, ${actor.userId}, 1)
        ON CONFLICT (company_id) DO UPDATE SET enabled = EXCLUDED.enabled, start_date = EXCLUDED.start_date, provider = EXCLUDED.provider, environment = EXCLUDED.environment,
          with_tax_code = EXCLUDED.with_tax_code, template_code = EXCLUDED.template_code, connection = EXCLUDED.connection, secret_value = EXCLUDED.secret_value,
          simulation = EXCLUDED.simulation, updated_at = now(), updated_by = EXCLUDED.updated_by, version = finance.einvoice_settings.version + 1`);
      await transaction.execute(sql`DELETE FROM finance.einvoice_series WHERE company_id = ${actor.companyId}`);
      for (const item of input.series) await transaction.execute(sql`INSERT INTO finance.einvoice_series (company_id, year, series) VALUES (${actor.companyId}, ${item.year}, ${item.series})`);
      // Hóa đơn dừng vì thiếu ký hiệu được gửi lại khi đã khai ký hiệu của năm.
      await transaction.execute(sql`
        UPDATE finance.einvoices e SET status = 'pending', series = s.series, last_error = NULL, next_attempt_at = now(), version = e.version + 1
        FROM finance.einvoice_series s WHERE e.company_id = ${actor.companyId} AND e.status = 'setup_error' AND e.series IS NULL
          AND s.company_id = e.company_id AND s.year = extract(year FROM e.invoice_date)::integer`);
      const { password: _password, ...safe } = input;
      await this.auditService.record(
        {
          ...financeAudit(actor, "einvoice_settings"),
          action: "einvoice_settings.update",
          entityId: actor.companyId,
          beforeData: before ? { ...before, secret_value: before.secret_value ? "••••" : null } : null,
          afterData: { ...safe, passwordChanged: Boolean(input.password) },
        },
        transaction,
      );
    });
    return this.get(actor);
  }
}
