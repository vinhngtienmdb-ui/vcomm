// Tiền tệ và tỷ giá (CHUC_NANG_21; QUYTAC_NGHIEPVU_29; API_45, API_46). Tỷ giá dùng chung cho cả tập đoàn.
import { Inject, Injectable } from "@nestjs/common";
import type { CurrencyResponse, ExchangeRateListResponse, ExchangeRateResponse, createExchangeRateSchema, updateExchangeRateSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { auditBase } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { trimAmount } from "../approvals/approval-policies.service";

export const manageExchangeRate = "platform.exchange_rate.manage";
const baseCurrency = "VND";

type RateRow = { id: string; rate_date: string; from_currency: string; to_currency: string; rate_type: ExchangeRateResponse["rateType"]; source: string; rate: string };

const toResponse = (row: RateRow): ExchangeRateResponse => ({
  id: row.id,
  rateDate: row.rate_date,
  fromCurrency: row.from_currency,
  toCurrency: row.to_currency,
  rateType: row.rate_type,
  source: row.source,
  rate: trimAmount(row.rate),
});

const selectRate = sql`SELECT id, to_char(rate_date, 'YYYY-MM-DD') AS rate_date, from_currency, to_currency, rate_type, source, rate::text AS rate FROM core.exchange_rates`;

@Injectable()
export class ExchangeRatesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async currencies(): Promise<CurrencyResponse[]> {
    const rows = await this.database.execute<{ code: string; name_vi: string; name_en: string; minor_units: number }>(sql`
      SELECT code, name_vi, name_en, minor_units FROM core.currencies WHERE is_active ORDER BY code = ${baseCurrency} DESC, code`);
    return rows.rows.map((row) => ({ code: row.code, nameVi: row.name_vi, nameEn: row.name_en, minorUnits: row.minor_units }));
  }

  // API_45 GET: tỷ giá một ngày và các tiền tệ chưa có tỷ giá hạch toán sang VND (chứng từ bằng tiền tệ đó chưa gửi duyệt được).
  async list(actor: Actor, date: string | undefined): Promise<ExchangeRateListResponse> {
    const day = date ?? this.permissionService.today();
    const rows = await this.database.execute<RateRow>(sql`${selectRate} WHERE rate_date = ${day}::date ORDER BY from_currency, to_currency, rate_type, source`);
    const missing = await this.database.execute<{ code: string }>(sql`
      SELECT c.code FROM core.currencies c
      WHERE c.is_active AND c.code <> ${baseCurrency}
        AND NOT EXISTS (SELECT 1 FROM core.exchange_rates r WHERE r.rate_date = ${day}::date AND r.from_currency = c.code AND r.to_currency = ${baseCurrency} AND r.rate_type = 'accounting')
      ORDER BY c.code`);
    return { date: day, baseCurrency, data: rows.rows.map(toResponse), missingAccounting: missing.rows.map((row) => row.code), canManage: await this.canManage(actor) };
  }

  async create(actor: Actor, input: z.output<typeof createExchangeRateSchema>): Promise<ExchangeRateResponse> {
    await this.requireManage(actor);
    this.requirePositive(input.rate);
    if (input.fromCurrency === input.toCurrency) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { toCurrency: "sameCurrency" } });
    for (const field of ["fromCurrency", "toCurrency"] as const) {
      const exists = await this.database.execute(sql`SELECT 1 FROM core.currencies WHERE code = ${input[field]} AND is_active`);
      if (exists.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "invalidValue" } });
    }
    return this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<RateRow>(sql`
        INSERT INTO core.exchange_rates (rate_date, from_currency, to_currency, rate_type, source, rate, created_by)
        VALUES (${input.rateDate}::date, ${input.fromCurrency}, ${input.toCurrency}, ${input.rateType}, ${input.source}, ${input.rate}::numeric, ${actor.userId})
        ON CONFLICT (rate_date, from_currency, to_currency, rate_type, source) DO NOTHING
        RETURNING id, to_char(rate_date, 'YYYY-MM-DD') AS rate_date, from_currency, to_currency, rate_type, source, rate::text AS rate`);
      const row = inserted.rows[0];
      if (!row) throw new ApiError("BUSINESS_RULE", "exchangeRateDuplicate");
      await this.auditService.record({ ...auditBase(actor, "exchange_rate"), action: "exchange_rate.create", entityId: row.id, afterData: toResponse(row) }, transaction);
      return toResponse(row);
    });
  }

  async update(actor: Actor, id: string, input: z.output<typeof updateExchangeRateSchema>): Promise<ExchangeRateResponse> {
    await this.requireManage(actor);
    this.requirePositive(input.rate);
    return this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<RateRow>(sql`${selectRate} WHERE id = ${id} FOR UPDATE`)).rows[0];
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      const updated = (await transaction.execute<RateRow>(sql`
        UPDATE core.exchange_rates SET rate = ${input.rate}::numeric WHERE id = ${id}
        RETURNING id, to_char(rate_date, 'YYYY-MM-DD') AS rate_date, from_currency, to_currency, rate_type, source, rate::text AS rate`)).rows[0]!;
      await this.auditService.record({ ...auditBase(actor, "exchange_rate"), action: "exchange_rate.update", entityId: id, beforeData: toResponse(before), afterData: toResponse(updated) }, transaction);
      return toResponse(updated);
    });
  }

  private requirePositive(rate: string): void {
    if (!/[1-9]/.test(rate)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { rate: "ratePositive" } });
  }

  // Quyền sửa tỷ giá ở công ty đang chọn hoặc toàn tập đoàn (vai trò Quản lý tỷ giá, Quản trị tập đoàn).
  private async canManage(actor: Actor): Promise<boolean> {
    return (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(manageExchangeRate);
  }

  private async requireManage(actor: Actor): Promise<void> {
    if (!(await this.canManage(actor))) throw new ApiError("FORBIDDEN", "forbidden");
  }
}
