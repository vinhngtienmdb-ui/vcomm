// Quản trị chống gian lận nâng cao (CONG_VIEC_60; CHUC_NANG_215; QUYTAC_NGHIEPVU_474 đến 477; API_251, API_252, API_254).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  LoyaltyDeviceItem,
  LoyaltyFraudCaseDetail,
  LoyaltyFraudCaseItem,
  LoyaltyFraudCaseStatus,
  LoyaltyFraudRule,
  LoyaltyFraudRuleHistoryItem,
  LoyaltyFraudRuleInput,
  PageResponse,
} from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";
import { deviceHashOf, linkDevice, ruleNames, setFraudDatabase, type FraudRuleCode } from "./fraud";
import { maskName, maskPhone } from "./smart-otp.service";

const iso = (value: Date | string | null) => (value === null ? null : new Date(value).toISOString());
const shortHash = (hash: string | null) => (hash ? hash.slice(0, 8) : null);

type RuleRow = {
  code: FraudRuleCode;
  enabled: boolean;
  params: Record<string, number | null>;
  action: LoyaltyFraudRule["action"];
  updated_by_name: string | null;
  updated_at: Date | string;
  version: number;
};
type CaseRow = {
  id: string;
  document_no: string;
  rule_code: FraudRuleCode;
  action: LoyaltyFraudRule["action"];
  subject_kind: "user" | "device" | "staff";
  user_id: string | null;
  user_name: string | null;
  user_phone: string | null;
  device_hash: string | null;
  staff_name: string | null;
  company_name: string | null;
  metrics: Record<string, unknown>;
  hit_count: number;
  case_day: string;
  status: LoyaltyFraudCaseStatus;
  reviewer_name: string | null;
  conclusion_note: string | null;
  created_at: Date | string;
  version: number;
};
const caseColumns = sql`f.id, f.document_no, f.rule_code, f.action, f.subject_kind, f.user_id, u.full_name AS user_name, u.phone AS user_phone, f.device_hash,
  st.full_name AS staff_name, c.short_name AS company_name, f.metrics, f.hit_count, f.case_day::text, f.status, rv.full_name AS reviewer_name, f.conclusion_note, f.created_at, f.version`;
const caseFrom = sql`loyalty.fraud_cases f LEFT JOIN core.users u ON u.id = f.user_id LEFT JOIN core.users st ON st.id = f.staff_user_id
  LEFT JOIN core.companies c ON c.id = f.company_id LEFT JOIN core.users rv ON rv.id = f.reviewer_id`;
const caseOf = (row: CaseRow): LoyaltyFraudCaseItem => ({
  id: row.id,
  documentNo: row.document_no,
  ruleCode: row.rule_code,
  action: row.action,
  subjectKind: row.subject_kind,
  userId: row.user_id,
  userName: row.user_name ? maskName(row.user_name) : null,
  userPhone: row.user_phone ? maskPhone(row.user_phone) : null,
  device: shortHash(row.device_hash),
  staffName: row.staff_name,
  companyName: row.company_name,
  metrics: row.metrics,
  hitCount: row.hit_count,
  caseDay: row.case_day,
  status: row.status,
  reviewerName: row.reviewer_name,
  conclusionNote: row.conclusion_note,
  createdAt: iso(row.created_at)!,
  version: row.version,
});

@Injectable()
export class LoyaltyFraudService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    setFraudDatabase(this.database);
  }

  // QUYTAC_NGHIEPVU_474: ghi liên kết thiết bị khi người mua đăng nhập, xem trước đơn.
  async link(userId: string, deviceId: string | null | undefined): Promise<void> {
    await linkDevice(this.database, userId, deviceHashOf(deviceId));
  }

  async rules(): Promise<LoyaltyFraudRule[]> {
    const rows = await this.database.execute<RuleRow>(sql`
      SELECT r.code, r.enabled, r.params, r.action, u.full_name AS updated_by_name, r.updated_at, r.version FROM loyalty.fraud_rules r LEFT JOIN core.users u ON u.id = r.updated_by
      ORDER BY array_position(ARRAY['shared_device', 'redeem_burst', 'earn_return', 'staff_anomaly'], r.code)`);
    return rows.rows.map((row) => ({
      code: row.code,
      name: ruleNames[row.code],
      enabled: row.enabled,
      params: row.params,
      action: row.action,
      updatedByName: row.updated_by_name,
      updatedAt: iso(row.updated_at)!,
      version: row.version,
    }));
  }

  // QUYTAC_NGHIEPVU_475: sửa bật tắt, ngưỡng, mức xử lý; lưu lịch sử.
  async updateRule(actor: BuyerAdminActor, code: FraudRuleCode, input: LoyaltyFraudRuleInput): Promise<LoyaltyFraudRule[]> {
    await this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<RuleRow>(sql`SELECT code, enabled, params, action, version FROM loyalty.fraud_rules WHERE code = ${code} FOR UPDATE`)).rows[0];
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const params = { ...before.params, ...input.params };
      for (const key of Object.keys(input.params)) if (!(key in before.params)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`params.${key}`]: "invalidValue" } });
      await transaction.execute(sql`
        UPDATE loyalty.fraud_rules SET enabled = ${input.enabled}, params = ${JSON.stringify(params)}::jsonb, action = ${input.action}, updated_by = ${actor.userId}, updated_at = now(),
          version = version + 1 WHERE code = ${code}`);
      const after = { enabled: input.enabled, params, action: input.action };
      await transaction.execute(sql`
        INSERT INTO loyalty.fraud_rule_history (code, before_data, after_data, actor_user_id)
        VALUES (${code}, ${JSON.stringify({ enabled: before.enabled, params: before.params, action: before.action })}::jsonb, ${JSON.stringify(after)}::jsonb, ${actor.userId})`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "loyalty_fraud_rule.update",
          entityType: "loyalty_fraud_rule",
          entityId: actor.operatorCompanyId,
          afterData: { code, ...after },
        },
        transaction,
      );
    });
    return this.rules();
  }

  async ruleHistory(): Promise<LoyaltyFraudRuleHistoryItem[]> {
    const rows = await this.database.execute<{ code: FraudRuleCode; before_data: Record<string, unknown>; after_data: Record<string, unknown>; actor_name: string; created_at: Date | string }>(sql`
      SELECT h.code, h.before_data, h.after_data, u.full_name AS actor_name, h.created_at FROM loyalty.fraud_rule_history h JOIN core.users u ON u.id = h.actor_user_id
      ORDER BY h.created_at DESC LIMIT 100`);
    return rows.rows.map((row) => ({ code: row.code, before: row.before_data, after: row.after_data, actorName: row.actor_name, createdAt: iso(row.created_at)! }));
  }

  // API_252: danh sách vụ việc (lọc quy tắc, trạng thái, mức; mặc định chưa kết luận).
  async cases(query: {
    ruleCode?: FraudRuleCode;
    status?: LoyaltyFraudCaseStatus | "open";
    action?: LoyaltyFraudRule["action"];
    userId?: string;
    page: number;
    pageSize: number;
  }): Promise<PageResponse<LoyaltyFraudCaseItem>> {
    const status = query.status ?? "open";
    const where = sql`TRUE ${query.ruleCode ? sql`AND f.rule_code = ${query.ruleCode}` : sql``}
      ${status === "open" ? sql`AND f.status IN ('new', 'reviewing')` : sql`AND f.status = ${status}`}
      ${query.action ? sql`AND f.action = ${query.action}` : sql``} ${
        // Vụ việc liên quan tài khoản: đối tượng là tài khoản hoặc có chứng từ của tài khoản (vụ việc theo thiết bị, theo nhân viên).
        query.userId ? sql`AND (f.user_id = ${query.userId} OR EXISTS (SELECT 1 FROM loyalty.fraud_case_documents d WHERE d.case_id = f.id AND d.user_id = ${query.userId}))` : sql``
      }`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM loyalty.fraud_cases f WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<CaseRow>(sql`
      SELECT ${caseColumns} FROM ${caseFrom} WHERE ${where} ORDER BY f.created_at DESC, f.document_no DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(caseOf), page: query.page, pageSize: query.pageSize, total };
  }

  async caseDetail(id: string): Promise<LoyaltyFraudCaseDetail> {
    const row = (await this.database.execute<CaseRow>(sql`SELECT ${caseColumns} FROM ${caseFrom} WHERE f.id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const documents = await this.database.execute<{ source_type: string; source_id: string; effect: string; user_name: string | null; created_at: Date | string; document_no: string | null }>(sql`
      SELECT d.source_type, d.source_id, d.effect, u.full_name AS user_name, d.created_at,
        CASE d.source_type WHEN 'marketplace_order' THEN (SELECT so.document_no FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = d.source_id)
          WHEN 'retail_sale' THEN (SELECT s.document_no FROM retail.sales s WHERE s.id = d.source_id) END AS document_no
      FROM loyalty.fraud_case_documents d LEFT JOIN core.users u ON u.id = d.user_id WHERE d.case_id = ${id} ORDER BY d.created_at, d.id`);
    const accounts = row.device_hash
      ? await this.database.execute<{ full_name: string; phone: string | null }>(sql`
          SELECT u.full_name, u.phone FROM loyalty.device_links dl JOIN core.users u ON u.id = dl.user_id WHERE dl.device_hash = ${row.device_hash} ORDER BY dl.first_seen_at`)
      : { rows: [] };
    return {
      ...caseOf(row),
      documents: documents.rows.map((document) => ({
        sourceType: document.source_type,
        sourceId: document.source_id,
        documentNo: document.document_no,
        effect: document.effect,
        userName: document.user_name ? maskName(document.user_name) : null,
        createdAt: iso(document.created_at)!,
      })),
      deviceAccounts: accounts.rows.map((account) => `${maskName(account.full_name)}${account.phone ? ` · ${maskPhone(account.phone)}` : ""}`),
    };
  }

  // QUYTAC_NGHIEPVU_477: nhận xem xét, kết luận (vi phạm, không vi phạm) kèm ghi chú; kết luận không đổi ví.
  async review(actor: BuyerAdminActor, id: string, version: number): Promise<LoyaltyFraudCaseDetail> {
    await this.transition(actor, id, version, ["new"], sql`status = 'reviewing', reviewer_id = ${actor.userId}`, "loyalty_fraud_case.review", {});
    return this.caseDetail(id);
  }

  async conclude(actor: BuyerAdminActor, id: string, input: { version: number; violation: boolean; note: string }): Promise<LoyaltyFraudCaseDetail> {
    await this.transition(
      actor,
      id,
      input.version,
      ["new", "reviewing"],
      sql`status = ${input.violation ? "violation" : "no_violation"}, reviewer_id = ${actor.userId}, conclusion_note = ${input.note}, concluded_at = now()`,
      "loyalty_fraud_case.conclude",
      input,
    );
    return this.caseDetail(id);
  }

  private async transition(actor: BuyerAdminActor, id: string, version: number, from: LoyaltyFraudCaseStatus[], set: ReturnType<typeof sql>, action: string, data: object): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const row = (await transaction.execute<{ status: LoyaltyFraudCaseStatus; version: number }>(sql`SELECT status, version FROM loyalty.fraud_cases WHERE id = ${id} FOR UPDATE`)).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!from.includes(row.status)) throw new ApiError("BUSINESS_RULE", "loyaltyFraudCaseClosed");
      await transaction.execute(sql`UPDATE loyalty.fraud_cases SET ${set}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.audit.record({ actorUserId: actor.userId, companyId: actor.operatorCompanyId, appCode: "crm", action, entityType: "loyalty_fraud_case", entityId: id, afterData: data }, transaction);
    });
  }

  // API_254: thiết bị của ví điểm và tài khoản khác cùng thiết bị (băm rút gọn 8 ký tự).
  async devices(userId: string): Promise<LoyaltyDeviceItem[]> {
    const rows = await this.database.execute<{ device_hash: string; first_seen_at: Date | string; last_seen_at: Date | string; seen_count: number; others: string[] | null }>(sql`
      SELECT dl.device_hash, dl.first_seen_at, dl.last_seen_at, dl.seen_count,
        (SELECT array_agg(u.full_name || coalesce(' · ' || u.phone, '') ORDER BY o.first_seen_at) FROM loyalty.device_links o JOIN core.users u ON u.id = o.user_id
          WHERE o.device_hash = dl.device_hash AND o.user_id <> dl.user_id) AS others
      FROM loyalty.device_links dl WHERE dl.user_id = ${userId} ORDER BY dl.last_seen_at DESC`);
    return rows.rows.map((row) => ({
      device: shortHash(row.device_hash)!,
      firstSeenAt: iso(row.first_seen_at)!,
      lastSeenAt: iso(row.last_seen_at)!,
      seenCount: row.seen_count,
      otherAccounts: (row.others ?? []).map((value) => {
        const [name, phone] = value.split(" · ");
        return `${maskName(name!)}${phone ? ` · ${maskPhone(phone)}` : ""}`;
      }),
    }));
  }

  // Dữ liệu thiết bị giữ 12 tháng kể từ lần cuối (QUYTAC_NGHIEPVU_474); chạy cùng việc nền điểm hằng ngày.
  async purgeDevices(): Promise<number> {
    return (await this.database.execute(sql`DELETE FROM loyalty.device_links WHERE last_seen_at < now() - interval '12 months' RETURNING device_hash`)).rows.length;
  }
}
