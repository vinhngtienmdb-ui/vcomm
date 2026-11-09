// Dãy số chứng từ (CHUC_NANG_20; QUYTAC_NGHIEPVU_28; API_43, API_44).
// Mỗi kỳ một dòng đếm; cấu hình (tiền tố, kiểu đặt lại, số chữ số) giống nhau trên mọi dòng của cùng công ty và loại chứng từ.
import { Inject, Injectable } from "@nestjs/common";
import type { NumberSequenceResponse, updateNumberSequenceSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { auditBase } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

type ResetPeriod = "year" | "month" | "never";
type Executor = Pick<Database, "execute">;

// Khóa kỳ lưu trong bảng: '2026', '2026-11' hoặc 'all'.
export function periodKey(resetPeriod: ResetPeriod, day: string): string {
  if (resetPeriod === "year") return day.slice(0, 4);
  if (resetPeriod === "month") return day.slice(0, 7);
  return "all";
}

// PN-VCR-2026-000123; theo tháng: PN-VCR-202611-000123; không đặt lại: PN-VCR-000123.
export function formatDocumentNumber(prefix: string, companyCode: string, period: string, padding: number, value: number | string): string {
  const parts = [prefix, companyCode];
  if (period !== "all") parts.push(period.replace("-", ""));
  parts.push(String(value).padStart(padding, "0"));
  return parts.join("-");
}

@Injectable()
export class NumberSequencesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // API_43 GET: mọi loại chứng từ, kèm số kế tiếp sẽ cấp hôm nay.
  async list(actor: Actor): Promise<NumberSequenceResponse[]> {
    const today = this.permissionService.today();
    const companyCode = await this.companyCode(actor.companyId);
    const rows = await this.database.execute<{
      code: string;
      app_code: string;
      name_vi: string;
      name_en: string;
      prefix: string | null;
      reset_period: ResetPeriod | null;
      padding: number | null;
    }>(sql`
      SELECT t.code, t.app_code, t.name_vi, t.name_en, s.prefix, s.reset_period, s.padding
      FROM core.document_types t
      LEFT JOIN LATERAL (SELECT prefix, reset_period, padding FROM core.number_sequences WHERE company_id = ${actor.companyId} AND document_type_code = t.code LIMIT 1) s ON true
      ORDER BY t.app_code, t.code`);
    const counters = await this.database.execute<{
      document_type_code: string;
      period_key: string;
      next_value: string;
    }>(sql`
      SELECT document_type_code, period_key, next_value::text FROM core.number_sequences WHERE company_id = ${actor.companyId}`);
    return rows.rows.map((row) => {
      if (!row.prefix || !row.reset_period || row.padding === null) {
        return {
          documentTypeCode: row.code,
          appCode: row.app_code,
          documentTypeNameVi: row.name_vi,
          documentTypeNameEn: row.name_en,
          configured: false,
          prefix: null,
          resetPeriod: null,
          padding: null,
          nextNumber: null,
        };
      }
      const period = periodKey(row.reset_period, today);
      const counter = counters.rows.find((item) => item.document_type_code === row.code && item.period_key === period);
      return {
        documentTypeCode: row.code,
        appCode: row.app_code,
        documentTypeNameVi: row.name_vi,
        documentTypeNameEn: row.name_en,
        configured: true,
        prefix: row.prefix,
        resetPeriod: row.reset_period,
        padding: row.padding,
        nextNumber: formatDocumentNumber(row.prefix, companyCode, period, row.padding, counter?.next_value ?? "1"),
      };
    });
  }

  // API_43 PATCH: đổi cấu hình chỉ ảnh hưởng số cấp sau đó; số đã cấp nằm trên chứng từ.
  async update(actor: Actor, documentTypeCode: string, input: z.output<typeof updateNumberSequenceSchema>): Promise<NumberSequenceResponse> {
    if (!/^[A-Z0-9]+$/.test(input.prefix))
      throw new ApiError("VALIDATION_FAILED", "validationFailed", {
        fields: { prefix: "prefixInvalid" },
      });
    if ((await this.database.execute(sql`SELECT 1 FROM core.document_types WHERE code = ${documentTypeCode}`)).rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    const current = (await this.list(actor)).find((item) => item.documentTypeCode === documentTypeCode)!;
    const before = current.configured ? { documentTypeCode, prefix: current.prefix, resetPeriod: current.resetPeriod, padding: current.padding } : null;
    const period = periodKey(input.resetPeriod, this.permissionService.today());
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        UPDATE core.number_sequences SET prefix = ${input.prefix}, reset_period = ${input.resetPeriod}, padding = ${input.padding}
        WHERE company_id = ${actor.companyId} AND document_type_code = ${documentTypeCode}`);
      await transaction.execute(sql`
        INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
        VALUES (${actor.companyId}, ${documentTypeCode}, ${period}, ${input.prefix}, ${input.resetPeriod}, ${input.padding}, 1)
        ON CONFLICT (company_id, document_type_code, period_key) DO NOTHING`);
      await this.auditService.record(
        {
          ...auditBase(actor, "number_sequence"),
          action: "number_sequence.update",
          beforeData: before,
          afterData: { documentTypeCode, ...input },
        },
        transaction,
      );
    });
    return (await this.list(actor)).find((item) => item.documentTypeCode === documentTypeCode)!;
  }

  // API_44: gọi trong giao dịch lưu chứng từ. Dòng của kỳ bị khóa đến hết giao dịch nên hai người lưu cùng lúc nhận số liên tiếp;
  // giao dịch lỗi thì số không bị dùng (QUYTAC_NGHIEPVU_28).
  async next(companyId: string, documentTypeCode: string, transaction: Executor): Promise<string> {
    const config = (
      await transaction.execute<{
        prefix: string;
        reset_period: ResetPeriod;
        padding: number;
        code: string;
      }>(sql`
      SELECT s.prefix, s.reset_period, s.padding, c.code FROM core.number_sequences s JOIN core.companies c ON c.id = s.company_id
      WHERE s.company_id = ${companyId} AND s.document_type_code = ${documentTypeCode} LIMIT 1`)
    ).rows[0];
    if (!config) throw new ApiError("BUSINESS_RULE", "numberSequenceMissing");
    const period = periodKey(config.reset_period, this.permissionService.today());
    const issued = await transaction.execute<{ value: string }>(sql`
      INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
      VALUES (${companyId}, ${documentTypeCode}, ${period}, ${config.prefix}, ${config.reset_period}, ${config.padding}, 2)
      ON CONFLICT (company_id, document_type_code, period_key) DO UPDATE SET next_value = core.number_sequences.next_value + 1
      RETURNING (next_value - 1)::text AS value`);
    return formatDocumentNumber(config.prefix, config.code, period, config.padding, issued.rows[0]!.value);
  }

  private async companyCode(companyId: string): Promise<string> {
    return (await this.database.execute<{ code: string }>(sql`SELECT code FROM core.companies WHERE id = ${companyId}`)).rows[0]!.code;
  }
}
