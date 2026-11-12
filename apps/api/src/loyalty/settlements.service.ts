// Đối soát nợ nội bộ điểm thưởng hằng tháng giữa công ty vận hành sàn (O) và từng công ty con (C) (CONG_VIEC_60; CHUC_NANG_214; QUYTAC_NGHIEPVU_470, 471; API_249, API_250).
// Bút toán điểm (CONG_VIEC_51) ghi nợ nội bộ thuần: O dùng tài khoản vai trò phải thu nội bộ điểm (1368), C dùng phải trả nội bộ điểm (3368), với đối tác nội bộ của bên kia.
// Bảng đối soát là biên bản đối chiếu: không sinh bút toán bù trừ (người dùng chọn giữ ghi thuần ngày 2026-11-12); số thuần còn lại thanh toán bằng phiếu thu chi nội bộ.
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  LoyaltySettlementEvent,
  LoyaltySettlementItem,
  LoyaltySettlementLine,
  LoyaltySettlementMismatch,
  LoyaltySettlementMovement,
  LoyaltySettlementMovementKind,
  LoyaltySettlementResponse,
  LoyaltySettlementsResponse,
  LoyaltySettlementStatus,
} from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { internalPartnerOf } from "../crm/partners.service";
import { DATABASE, type Database } from "../database/database.module";
import { usersWithPermission } from "../hr/attendance-access";
import { vietnamToday } from "../marketplace/shop.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { NumberSequencesService, periodKey } from "../settings/number-sequences.service";
import { maskName } from "./smart-otp.service";

type Executor = Pick<Database, "execute">;

export const settlementPermissions = { view: "loyalty.settlement.view", manage: "loyalty.settlement.manage" } as const;
const documentType = "loyalty.settlement";
// Bảng còn mở (chưa đủ hai bên xác nhận): lập lại được; chặn xác nhận bảng kỳ sau.
const openStatuses: LoyaltySettlementStatus[] = ["pending", "operator_confirmed", "company_confirmed", "disputed", "mismatched"];
const confirmableStatuses: LoyaltySettlementStatus[] = ["pending", "operator_confirmed", "company_confirmed"];
// Nguồn bút toán tính vào đối soát: bút toán điểm hai phía (thanh toán nội bộ thêm ở lát sau).
const sources = sql`('loyalty_entry', 'loyalty_seller_entry')`;
const roles = sql`('loyalty_intercompany_receivable', 'loyalty_intercompany_payable')`;
const receivableKinds: LoyaltySettlementMovementKind[] = ["earn", "earn_reversal"];
const payableKinds: LoyaltySettlementMovementKind[] = ["redeem", "redeem_refund"];

const money = (value: number) => {
  const text = (Math.round(value * 10000) / 10000).toFixed(4).replace(/\.?0+$/, "");
  return text === "" || text === "-0" ? "0" : text;
};
// Thời điểm từ câu lệnh SQL thuần có thể là chuỗi hoặc Date.
const iso = (value: Date | string | null) => (value === null ? null : new Date(value).toISOString());
const lastDayOf = (period: string) => {
  const value = new Date(`${period}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  value.setUTCDate(0);
  return value.toISOString().slice(0, 10);
};
const dayBefore = (day: string) => {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
};
const previousMonth = (day: string) => {
  const value = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() - 1);
  return value.toISOString().slice(0, 10);
};

interface Figures {
  netOpening: number;
  receivableMovement: number;
  payableMovement: number;
  paymentMovement: number;
  offsetAmount: number;
  netClosing: number;
  movements: LoyaltySettlementMovement[];
  companyNetClosing: number;
  mismatches: LoyaltySettlementMismatch[];
}

type SettlementRow = {
  id: string;
  document_no: string;
  period: string;
  operator_company_id: string;
  operator_company_name: string;
  company_id: string;
  company_name: string;
  net_opening: string;
  receivable_movement: string;
  payable_movement: string;
  payment_movement: string;
  offset_amount: string;
  net_closing: string;
  company_net_closing: string;
  movements: LoyaltySettlementMovement[];
  mismatches: LoyaltySettlementMismatch[];
  status: LoyaltySettlementStatus;
  operator_confirmed_by: string | null;
  operator_confirmed_at: Date | string | null;
  company_confirmed_by: string | null;
  company_confirmed_at: Date | string | null;
  dispute_reason: string | null;
  version: number;
};

const settlementColumns = sql`s.id, s.document_no, s.period::text, s.operator_company_id, o.short_name AS operator_company_name, s.company_id, c.short_name AS company_name,
  s.net_opening::text, s.receivable_movement::text, s.payable_movement::text, s.payment_movement::text, s.offset_amount::text, s.net_closing::text,
  s.company_net_closing::text, s.movements, s.mismatches, s.status, ou.full_name AS operator_confirmed_by, s.operator_confirmed_at,
  cu.full_name AS company_confirmed_by, s.company_confirmed_at, s.dispute_reason, s.version`;
const settlementFrom = sql`loyalty.settlements s JOIN core.companies o ON o.id = s.operator_company_id JOIN core.companies c ON c.id = s.company_id
  LEFT JOIN core.users ou ON ou.id = s.operator_confirmed_by LEFT JOIN core.users cu ON cu.id = s.company_confirmed_by`;

const itemOf = (row: SettlementRow): LoyaltySettlementItem => ({
  id: row.id,
  documentNo: row.document_no,
  period: row.period.slice(0, 7),
  operatorCompanyId: row.operator_company_id,
  operatorCompanyName: row.operator_company_name,
  companyId: row.company_id,
  companyName: row.company_name,
  netOpening: money(Number(row.net_opening)),
  receivableMovement: money(Number(row.receivable_movement)),
  payableMovement: money(Number(row.payable_movement)),
  paymentMovement: money(Number(row.payment_movement)),
  offsetAmount: money(Number(row.offset_amount)),
  netClosing: money(Number(row.net_closing)),
  status: row.status,
  version: row.version,
});

async function operatorCompanyId(executor: Executor): Promise<string | null> {
  return (await executor.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator`)).rows[0]?.id ?? null;
}

// Số thuần (Nợ − Có) trên hai vai trò nợ nội bộ điểm của một công ty với một đối tác nội bộ, đến hết ngày `through`.
async function netBalance(executor: Executor, companyId: string, partnerId: string | null, through: string): Promise<number> {
  const row = (
    await executor.execute<{ amount: string | null }>(sql`
    SELECT sum(l.debit - l.credit)::text AS amount FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
    JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ${roles}
    WHERE j.company_id = ${companyId} AND l.partner_id = ${partnerId} AND j.source_type IN ${sources} AND j.status = 'posted' AND j.journal_date <= ${through}::date`)
  ).rows[0];
  return Number(row?.amount ?? 0);
}

// Số liệu bảng kỳ `period` (ngày đầu tháng) giữa O và C; đối chiếu sổ C theo từng bút toán điểm (QUYTAC_NGHIEPVU_470).
export async function settlementFigures(executor: Executor, operator: string, company: string, period: string): Promise<Figures> {
  const end = lastDayOf(period);
  const companyPartner = await internalPartnerOf(executor, company);
  const operatorPartner = await internalPartnerOf(executor, operator);
  const netOpening = await netBalance(executor, operator, companyPartner, dayBefore(period));
  const netClosing = await netBalance(executor, operator, companyPartner, end);
  // Sổ C ghi ngược chiều: số C phải trả = Có − Nợ.
  const companyNetClosing = -(await netBalance(executor, company, operatorPartner, end));
  const movementRows = await executor.execute<{ kind: LoyaltySettlementMovementKind; amount: string }>(sql`
    SELECT e.kind, sum(l.debit - l.credit)::text AS amount
    FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
    JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ${roles}
    JOIN loyalty.entries e ON e.id = j.source_id
    WHERE j.company_id = ${operator} AND l.partner_id = ${companyPartner} AND j.source_type IN ${sources} AND j.status = 'posted'
      AND j.journal_date BETWEEN ${period}::date AND ${end}::date
    GROUP BY e.kind`);
  const amountOf = (kind: LoyaltySettlementMovementKind) => Number(movementRows.rows.find((row) => row.kind === kind)?.amount ?? 0);
  const kinds: LoyaltySettlementMovementKind[] = ["earn", "earn_reversal", "redeem", "redeem_refund", "payment"];
  const movements = kinds.filter((kind) => amountOf(kind) !== 0).map((kind) => ({ kind, amount: money(amountOf(kind)) }));
  const receivableMovement = receivableKinds.reduce((total, kind) => total + amountOf(kind), 0);
  const payableMovement = -payableKinds.reduce((total, kind) => total + amountOf(kind), 0);
  // Đối chiếu theo bút toán điểm: phía O (Nợ − Có) phải bằng phía C (Có − Nợ); hai phía cùng mã bút toán điểm.
  const mismatchRows = await executor.execute<{ source_id: string; label: string; day: string; operator_amount: string; company_amount: string }>(sql`
    WITH sides AS (
      SELECT j.source_id, j.company_id = ${operator} AS operator_side, min(j.journal_no) AS label, min(j.journal_date)::text AS day, sum(l.debit - l.credit) AS amount
      FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
      JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ${roles}
      WHERE j.source_type IN ${sources} AND j.status = 'posted' AND j.journal_date <= ${end}::date
        AND ((j.company_id = ${operator} AND l.partner_id = ${companyPartner}) OR (j.company_id = ${company} AND l.partner_id = ${operatorPartner}))
      GROUP BY j.source_id, 2
    )
    SELECT source_id, min(label) AS label, min(day) AS day,
      coalesce(sum(amount) FILTER (WHERE operator_side), 0)::text AS operator_amount, coalesce(-sum(amount) FILTER (WHERE NOT operator_side), 0)::text AS company_amount
    FROM sides GROUP BY source_id
    HAVING abs(coalesce(sum(amount) FILTER (WHERE operator_side), 0) + coalesce(sum(amount) FILTER (WHERE NOT operator_side), 0)) >= 0.5
    ORDER BY min(day), min(label) LIMIT 200`);
  return {
    netOpening,
    receivableMovement,
    payableMovement,
    paymentMovement: amountOf("payment"),
    offsetAmount: receivableMovement > 0 && payableMovement > 0 ? Math.min(receivableMovement, payableMovement) : 0,
    netClosing,
    movements,
    companyNetClosing,
    mismatches: mismatchRows.rows.map((row) => ({
      sourceType: "loyalty_entry",
      sourceId: row.source_id,
      label: row.label,
      day: row.day,
      operatorAmount: money(Number(row.operator_amount)),
      companyAmount: money(Number(row.company_amount)),
    })),
  };
}

// Hai sổ khớp khi không có bút toán lệch và số thuần hai bên bằng nhau.
const matches = (figures: Figures) => figures.mismatches.length === 0 && Math.abs(figures.netClosing - figures.companyNetClosing) < 0.5;

const sameFigures = (row: SettlementRow, figures: Figures) =>
  Math.abs(Number(row.net_opening) - figures.netOpening) < 0.00005 &&
  Math.abs(Number(row.net_closing) - figures.netClosing) < 0.00005 &&
  Math.abs(Number(row.company_net_closing) - figures.companyNetClosing) < 0.00005 &&
  row.mismatches.length === figures.mismatches.length;

@Injectable()
export class LoyaltySettlementsService {
  private readonly logger = new Logger(LoyaltySettlementsService.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly sequences: NumberSequencesService,
    private readonly audit: AuditService,
  ) {}

  private async granted(actor: Actor): Promise<Set<string>> {
    const granted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
    if (!granted.has(settlementPermissions.view) && !granted.has(settlementPermissions.manage)) throw new ApiError("FORBIDDEN", "forbidden");
    return granted;
  }

  private async manageable(actor: Actor): Promise<void> {
    if (!(await this.granted(actor)).has(settlementPermissions.manage)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  // Người xem thuộc công ty vận hành sàn thấy mọi bảng; công ty con chỉ thấy bảng của mình.
  private async visible(actor: Actor, id: string, executor: Executor = this.database, lock = false): Promise<{ row: SettlementRow; side: "operator" | "company" }> {
    if (lock) await executor.execute(sql`SELECT 1 FROM loyalty.settlements WHERE id = ${id} FOR UPDATE`);
    const row = (await executor.execute<SettlementRow>(sql`SELECT ${settlementColumns} FROM ${settlementFrom} WHERE s.id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (actor.companyId === row.operator_company_id) return { row, side: "operator" };
    if (actor.companyId === row.company_id) return { row, side: "company" };
    throw new ApiError("NOT_FOUND", "notFound");
  }

  // API_249: danh sách.
  async list(actor: Actor, query: { period?: string; status?: LoyaltySettlementStatus }): Promise<LoyaltySettlementsResponse> {
    await this.granted(actor);
    const isOperator = (await operatorCompanyId(this.database)) === actor.companyId;
    const rows = await this.database.execute<SettlementRow>(sql`
      SELECT ${settlementColumns} FROM ${settlementFrom}
      WHERE ${isOperator ? sql`s.operator_company_id = ${actor.companyId}` : sql`s.company_id = ${actor.companyId}`}
        ${query.period ? sql`AND s.period = ${`${query.period}-01`}::date` : sql``} ${query.status ? sql`AND s.status = ${query.status}` : sql``}
      ORDER BY s.period DESC, c.short_name LIMIT 500`);
    return { items: rows.rows.map(itemOf), isOperator };
  }

  // API_249: chi tiết kèm bút toán điểm của kỳ, lịch sử.
  async detail(actor: Actor, id: string): Promise<LoyaltySettlementResponse> {
    const granted = await this.granted(actor);
    const { row, side } = await this.visible(actor, id);
    const companyPartner = await internalPartnerOf(this.database, row.company_id);
    const lines = await this.database.execute<{ day: string; kind: string; document_no: string; full_name: string | null; points: number; amount: string }>(sql`
      SELECT j.journal_date::text AS day, e.kind, j.journal_no AS document_no, u.full_name, abs(e.points) AS points, sum(l.debit - l.credit)::text AS amount
      FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
      JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ${roles}
      JOIN loyalty.entries e ON e.id = j.source_id JOIN core.users u ON u.id = e.user_id
      WHERE j.company_id = ${row.operator_company_id} AND l.partner_id = ${companyPartner} AND j.source_type IN ${sources} AND j.status = 'posted'
        AND j.journal_date BETWEEN ${row.period}::date AND ${lastDayOf(row.period)}::date
      GROUP BY j.id, j.journal_date, e.kind, j.journal_no, u.full_name, e.points, e.created_at, e.id ORDER BY j.journal_date, e.created_at, e.id LIMIT 500`);
    const events = await this.database.execute<{ kind: string; company_name: string | null; actor_name: string | null; note: string | null; created_at: Date | string }>(sql`
      SELECT ev.kind, c.short_name AS company_name, u.full_name AS actor_name, ev.note, ev.created_at FROM loyalty.settlement_events ev
      LEFT JOIN core.companies c ON c.id = ev.company_id LEFT JOIN core.users u ON u.id = ev.actor_id WHERE ev.settlement_id = ${id} ORDER BY ev.created_at, ev.id`);
    const canManage = granted.has(settlementPermissions.manage);
    const confirmedBySide = side === "operator" ? row.operator_confirmed_at !== null : row.company_confirmed_at !== null;
    return {
      ...itemOf(row),
      companyNetClosing: money(Number(row.company_net_closing)),
      movements: row.movements,
      mismatches: row.mismatches,
      lines: lines.rows.map(
        (line): LoyaltySettlementLine => ({
          day: line.day,
          kind: line.kind,
          documentNo: line.document_no,
          buyerName: line.full_name ? maskName(line.full_name) : "",
          points: line.points,
          amount: money(Number(line.amount)),
        }),
      ),
      events: events.rows.map(
        (event): LoyaltySettlementEvent => ({ kind: event.kind, companyName: event.company_name, actorName: event.actor_name, note: event.note, createdAt: iso(event.created_at)! }),
      ),
      operatorConfirmedBy: row.operator_confirmed_by,
      operatorConfirmedAt: iso(row.operator_confirmed_at),
      companyConfirmedBy: row.company_confirmed_by,
      companyConfirmedAt: iso(row.company_confirmed_at),
      disputeReason: row.dispute_reason,
      viewerSide: side,
      canConfirm: canManage && confirmableStatuses.includes(row.status) && !confirmedBySide,
      canRebuild: canManage && side === "operator" && openStatuses.includes(row.status),
    };
  }

  // Dãy số bảng đối soát của công ty vận hành sàn (tiền tố DN, đặt lại theo năm) khi chưa cấu hình.
  private async ensureSequence(executor: Executor, operator: string): Promise<void> {
    const today = await vietnamToday(executor);
    await executor.execute(sql`
      INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
      SELECT ${operator}, ${documentType}, ${periodKey("year", today)}, 'DN', 'year', 6, 1
      WHERE NOT EXISTS (SELECT 1 FROM core.number_sequences WHERE company_id = ${operator} AND document_type_code = ${documentType})`);
  }

  private async event(executor: Executor, settlementId: string, kind: string, companyId: string | null, actorId: string | null, note: string | null): Promise<void> {
    await executor.execute(sql`INSERT INTO loyalty.settlement_events (settlement_id, kind, company_id, actor_id, note) VALUES (${settlementId}, ${kind}, ${companyId}, ${actorId}, ${note})`);
  }

  // Lập hoặc lập lại bảng kỳ `period` cho công ty con. Bảng đã đủ hai bên xác nhận không lập lại.
  async buildWithin(executor: Executor, operator: string, company: string, period: string, actorId: string | null): Promise<string> {
    await this.ensureSequence(executor, operator);
    const existing = (
      await executor.execute<{ id: string; status: LoyaltySettlementStatus }>(sql`SELECT id, status FROM loyalty.settlements WHERE company_id = ${company} AND period = ${period}::date FOR UPDATE`)
    ).rows[0];
    if (existing && !openStatuses.includes(existing.status)) throw new ApiError("BUSINESS_RULE", "loyaltySettlementClosed");
    const figures = await settlementFigures(executor, operator, company, period);
    const status: LoyaltySettlementStatus = matches(figures) ? "pending" : "mismatched";
    const values = sql`net_opening = ${figures.netOpening}, receivable_movement = ${figures.receivableMovement}, payable_movement = ${figures.payableMovement},
      payment_movement = ${figures.paymentMovement}, movements = ${JSON.stringify(figures.movements)}::jsonb, offset_amount = ${figures.offsetAmount},
      net_closing = ${figures.netClosing}, company_net_closing = ${figures.companyNetClosing}, mismatches = ${JSON.stringify(figures.mismatches)}::jsonb, status = ${status},
      operator_confirmed_by = NULL, operator_confirmed_at = NULL, company_confirmed_by = NULL, company_confirmed_at = NULL, built_at = now(), reminded_at = NULL, updated_at = now()`;
    let id: string;
    if (existing) {
      await executor.execute(sql`UPDATE loyalty.settlements SET ${values}, version = version + 1 WHERE id = ${existing.id}`);
      id = existing.id;
    } else {
      const documentNo = await this.sequences.next(operator, documentType, executor);
      id = (
        await executor.execute<{ id: string }>(sql`
        INSERT INTO loyalty.settlements (document_no, operator_company_id, company_id, period, status) VALUES (${documentNo}, ${operator}, ${company}, ${period}::date, ${status}) RETURNING id`)
      ).rows[0]!.id;
      await executor.execute(sql`UPDATE loyalty.settlements SET ${values} WHERE id = ${id}`);
      // Bảng kỳ trước đã xác nhận còn phải thanh toán: số thuần còn lại nằm trong số đầu kỳ của bảng mới.
      const carried = await executor.execute<{ id: string }>(sql`
        UPDATE loyalty.settlements SET status = 'carried_forward', updated_at = now(), version = version + 1
        WHERE company_id = ${company} AND period < ${period}::date AND status IN ('confirmed', 'partially_paid') RETURNING id`);
      for (const previous of carried.rows) await this.event(executor, previous.id, "carried_forward", null, null, null);
    }
    await this.event(executor, id, existing ? "rebuilt" : "built", null, actorId, status === "mismatched" ? String(figures.mismatches.length) : null);
    return id;
  }

  // Việc nền 2 giờ ngày 1 hằng tháng: bảng tháng trước cho mỗi công ty con có phát sinh trong tháng hoặc còn số thuần.
  async buildMonthly(day?: string): Promise<number> {
    const today = day ?? (await vietnamToday(this.database));
    const period = previousMonth(today);
    const operator = await operatorCompanyId(this.database);
    if (!operator) return 0;
    const companies = await this.database.execute<{ company_id: string }>(sql`
      SELECT p.company_id FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
      JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ${roles}
      JOIN crm.partners p ON p.id = l.partner_id AND p.company_id IS NOT NULL AND p.company_id <> ${operator}
      WHERE j.company_id = ${operator} AND j.source_type IN ${sources} AND j.status = 'posted' AND j.journal_date <= ${lastDayOf(period)}::date
      GROUP BY p.company_id HAVING bool_or(j.journal_date >= ${period}::date) OR abs(sum(l.debit - l.credit)) >= 0.5`);
    let built = 0;
    for (const row of companies.rows) {
      try {
        await this.database.transaction((transaction) => this.buildWithin(transaction, operator, row.company_id, period, null));
        built += 1;
      } catch (error) {
        if (error instanceof ApiError && error.messageKey === "loyaltySettlementClosed") continue;
        this.logger.error(`Không lập được bảng đối soát điểm ${row.company_id} ${period}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return built;
  }

  // API_249: lập lại bằng tay tại công ty vận hành sàn.
  async rebuild(actor: Actor, id: string, version: number): Promise<LoyaltySettlementResponse> {
    await this.manageable(actor);
    await this.database.transaction(async (transaction) => {
      const { row, side } = await this.visible(actor, id, transaction, true);
      if (side !== "operator") throw new ApiError("FORBIDDEN", "forbidden");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.buildWithin(transaction, row.operator_company_id, row.company_id, row.period, actor.userId);
      await this.audit.record(
        { actorUserId: actor.userId, companyId: actor.companyId, appCode: "finance", action: "loyalty_settlement.rebuild", entityType: "loyalty_settlement", entityId: id },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // API_250: xác nhận một phía (QUYTAC_NGHIEPVU_471). Sổ đã đổi từ lúc lập thì lập lại, báo người xem xác nhận lại. Đủ hai phía: Đã xác nhận (số thuần 0: Đã tất toán).
  async confirm(actor: Actor, id: string, version: number): Promise<LoyaltySettlementResponse> {
    await this.manageable(actor);
    const changed = await this.database.transaction(async (transaction) => {
      const { row, side } = await this.visible(actor, id, transaction, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status === "mismatched") throw new ApiError("BUSINESS_RULE", "loyaltySettlementMismatched");
      if (!confirmableStatuses.includes(row.status) || (side === "operator" ? row.operator_confirmed_at : row.company_confirmed_at))
        throw new ApiError("BUSINESS_RULE", "loyaltySettlementNotConfirmable");
      const earlier = await transaction.execute(sql`
        SELECT 1 FROM loyalty.settlements WHERE company_id = ${row.company_id} AND period < ${row.period}::date
          AND status IN ('pending', 'operator_confirmed', 'company_confirmed', 'disputed', 'mismatched') LIMIT 1`);
      if (earlier.rows.length > 0) throw new ApiError("BUSINESS_RULE", "loyaltySettlementEarlierOpen");
      const figures = await settlementFigures(transaction, row.operator_company_id, row.company_id, row.period);
      if (!sameFigures(row, figures) || !matches(figures)) {
        await this.buildWithin(transaction, row.operator_company_id, row.company_id, row.period, null);
        return true;
      }
      const otherConfirmed = side === "operator" ? row.company_confirmed_at !== null : row.operator_confirmed_at !== null;
      const status: LoyaltySettlementStatus = !otherConfirmed ? (side === "operator" ? "operator_confirmed" : "company_confirmed") : Math.abs(Number(row.net_closing)) < 0.5 ? "settled" : "confirmed";
      await transaction.execute(sql`
        UPDATE loyalty.settlements SET ${side === "operator" ? sql`operator_confirmed_by = ${actor.userId}, operator_confirmed_at = now()` : sql`company_confirmed_by = ${actor.userId}, company_confirmed_at = now()`},
          status = ${status}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.event(transaction, id, "confirmed", actor.companyId, actor.userId, null);
      if (otherConfirmed) {
        await this.event(transaction, id, "agreed", null, actor.userId, money(Number(row.net_closing)));
        // Bảng kỳ sau còn mở: lập lại để nhận trạng thái mới của kỳ này.
        const later = await transaction.execute<{ period: string }>(sql`
          SELECT period::text FROM loyalty.settlements WHERE company_id = ${row.company_id} AND period > ${row.period}::date
            AND status IN ('pending', 'operator_confirmed', 'company_confirmed', 'disputed', 'mismatched') ORDER BY period`);
        for (const next of later.rows) await this.buildWithin(transaction, row.operator_company_id, row.company_id, next.period, null);
      }
      await this.audit.record(
        { actorUserId: actor.userId, companyId: actor.companyId, appCode: "finance", action: "loyalty_settlement.confirm", entityType: "loyalty_settlement", entityId: id },
        transaction,
      );
      return false;
    });
    if (changed) throw new ApiError("BUSINESS_RULE", "loyaltySettlementChanged");
    return this.detail(actor, id);
  }

  // API_250: khiếu nại (QUYTAC_NGHIEPVU_471): bỏ xác nhận đã có; công ty vận hành sàn xử lý rồi lập lại.
  async dispute(actor: Actor, id: string, input: { version: number; reason: string }): Promise<LoyaltySettlementResponse> {
    await this.manageable(actor);
    await this.database.transaction(async (transaction) => {
      const { row } = await this.visible(actor, id, transaction, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!confirmableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "loyaltySettlementNotConfirmable");
      await transaction.execute(sql`
        UPDATE loyalty.settlements SET status = 'disputed', dispute_reason = ${input.reason}, operator_confirmed_by = NULL, operator_confirmed_at = NULL,
          company_confirmed_by = NULL, company_confirmed_at = NULL, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.event(transaction, id, "disputed", actor.companyId, actor.userId, input.reason);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.companyId,
          appCode: "finance",
          action: "loyalty_settlement.dispute",
          entityType: "loyalty_settlement",
          entityId: id,
          afterData: { reason: input.reason },
        },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Nhắc một lần bảng chờ xác nhận quá 5 ngày cho người có quyền của bên chưa xác nhận.
  async remindPending(): Promise<number> {
    const today = await vietnamToday(this.database);
    return this.database.transaction(async (transaction) => {
      const rows = await transaction.execute<{
        id: string;
        document_no: string;
        operator_company_id: string;
        company_id: string;
        operator_confirmed_at: Date | null;
        company_confirmed_at: Date | null;
      }>(sql`
        UPDATE loyalty.settlements SET reminded_at = now()
        WHERE id IN (SELECT id FROM loyalty.settlements WHERE status IN ('pending', 'operator_confirmed', 'company_confirmed') AND reminded_at IS NULL
          AND built_at < now() - interval '5 days' FOR UPDATE SKIP LOCKED)
        RETURNING id, document_no, operator_company_id, company_id, operator_confirmed_at, company_confirmed_at`);
      for (const row of rows.rows) {
        const companies = [row.operator_confirmed_at ? null : row.operator_company_id, row.company_confirmed_at ? null : row.company_id].filter((value): value is string => value !== null);
        for (const companyId of companies) {
          const users = await usersWithPermission(transaction, companyId, settlementPermissions.manage, today);
          await notify(
            transaction,
            users.map((userId) => ({
              userId,
              companyId,
              kind: "loyalty.settlement.pending",
              title: `Bảng đối soát điểm nội bộ ${row.document_no} chờ xác nhận quá 5 ngày`,
              link: `/finance/loyalty-settlements/${row.id}`,
              payload: { settlementId: row.id },
            })),
          );
        }
        await this.event(transaction, row.id, "reminded", null, null, null);
      }
      return rows.rows.length;
    });
  }
}
