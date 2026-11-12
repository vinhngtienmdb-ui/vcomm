// Đánh giá lại số dư ngoại tệ (CONG_VIEC_56; CHUC_NANG_198; QUYTAC_NGHIEPVU_412, 413; API_216, API_217): quỹ ngoại tệ, khoản nợ phải trả ngoại tệ;
// tỷ giá chuyển khoản trung bình ngày đánh giá; ghi sổ đổi giá trị ghi sổ, tỷ giá đích danh, sinh bút toán qua 413 rồi kết chuyển 515, 635.
import { Inject, Injectable } from "@nestjs/common";
import type { createFxRevaluationSchema, FxRevaluationListItem, FxRevaluationResponse, FxRevaluationStatus, updateFxRevaluationSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { assertOpenPeriod, ledgerSettings } from "../accounting/period-guard";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { DebtsService, type Executor } from "./debts.service";
import { financeAudit, requireFinancePermission } from "./finance-context";
import { averageRate, fundBalance, fundForeignBalance } from "./funds.service";

export const revaluationPermissions = { view: "finance.ledger.view", manage: "finance.journal.manage" } as const;
const sequenceType = "accounting.fx_revaluation";

type LineRow = {
  id: string;
  kind: "fund" | "payable";
  fund_id: string | null;
  fund_code: string | null;
  fund_name: string | null;
  debt_item_id: string | null;
  debt_no: string | null;
  partner_name: string | null;
  currency: string;
  foreign_amount: string;
  book_value: string;
  new_value: string | null;
  difference: string | null;
};
type HeaderRow = {
  id: string;
  company_id: string;
  document_no: string | null;
  revaluation_date: string;
  status: FxRevaluationStatus;
  note: string | null;
  created_by_name: string;
  posted_at: string | null;
  version: number;
};

@Injectable()
export class FxRevaluationsService {
  // Kế toán đăng ký lúc khởi động để sinh bút toán trong cùng giao dịch ghi sổ.
  readonly postedHooks: ((transaction: Executor, revaluationId: string) => Promise<void>)[] = [];

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly debts: DebtsService,
  ) {}

  async list(actor: Actor): Promise<FxRevaluationListItem[]> {
    await requireFinancePermission(this.permissionService, actor, revaluationPermissions.view, revaluationPermissions.manage);
    const rows = await this.database.execute<{ id: string; document_no: string | null; revaluation_date: string; status: FxRevaluationStatus; line_count: number; gain: string; loss: string }>(sql`
      SELECT r.id, r.document_no, r.revaluation_date::text, r.status, count(l.id)::int AS line_count,
        coalesce(sum(${gainOf(sql`l`)}), 0)::text AS gain, coalesce(sum(${lossOf(sql`l`)}), 0)::text AS loss
      FROM finance.fx_revaluations r LEFT JOIN finance.fx_revaluation_lines l ON l.revaluation_id = r.id
      WHERE r.company_id = ${actor.companyId}
      GROUP BY r.id ORDER BY r.revaluation_date DESC, r.created_at DESC LIMIT 200`);
    return rows.rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      revaluationDate: day(row.revaluation_date),
      lineCount: row.line_count,
      gain: trimDecimal(row.gain),
      loss: trimDecimal(row.loss),
      net: trimDecimal((Number(row.gain) - Number(row.loss)).toFixed(4)),
      status: row.status,
    }));
  }

  async detail(actor: Actor, id: string): Promise<FxRevaluationResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, revaluationPermissions.view, revaluationPermissions.manage);
    const header = await this.header(this.database, actor.companyId, id);
    const rates = await this.database.execute<{ currency: string; rate: string | null; source_rate: string | null }>(sql`
      SELECT currency, rate::text, source_rate::text FROM finance.fx_revaluation_rates WHERE revaluation_id = ${id} ORDER BY currency`);
    const lines = await this.database.execute<LineRow>(sql`
      SELECT l.id, l.kind, l.fund_id, f.code AS fund_code, f.name AS fund_name, l.debt_item_id, d.document_no AS debt_no, p.name AS partner_name,
        l.currency, l.foreign_amount::text, l.book_value::text, l.new_value::text, l.difference::text
      FROM finance.fx_revaluation_lines l LEFT JOIN finance.funds f ON f.id = l.fund_id LEFT JOIN finance.debt_items d ON d.id = l.debt_item_id
        LEFT JOIN crm.partners p ON p.id = l.partner_id
      WHERE l.revaluation_id = ${id} ORDER BY l.line_no`);
    const gain = lines.rows.reduce((total, line) => total + gainValue(line), 0);
    const loss = lines.rows.reduce((total, line) => total + lossValue(line), 0);
    return {
      id: header.id,
      documentNo: header.document_no,
      revaluationDate: day(header.revaluation_date),
      status: header.status,
      note: header.note,
      currency: await companyCurrency(this.database, actor.companyId),
      rates: rates.rows.map((row) => ({
        currency: row.currency,
        rate: row.rate === null ? null : trimDecimal(row.rate),
        sourceRate: row.source_rate === null ? null : trimDecimal(row.source_rate),
      })),
      lines: lines.rows.map((line) => ({
        id: line.id,
        kind: line.kind,
        fund: line.fund_id ? { id: line.fund_id, code: line.fund_code!, name: line.fund_name! } : null,
        debt: line.debt_item_id ? { id: line.debt_item_id, documentNo: line.debt_no!, partnerName: line.partner_name! } : null,
        currency: line.currency,
        foreignAmount: trimDecimal(line.foreign_amount),
        bookValue: trimDecimal(line.book_value),
        bookRate: averageRate(line.book_value, line.foreign_amount),
        newValue: line.new_value === null ? null : trimDecimal(line.new_value),
        difference: line.difference === null ? null : trimDecimal(line.difference),
      })),
      gain: trimDecimal(gain.toFixed(4)),
      loss: trimDecimal(loss.toFixed(4)),
      net: trimDecimal((gain - loss).toFixed(4)),
      createdByName: header.created_by_name,
      postedAt: header.posted_at,
      version: header.version,
      canManage: granted.has(revaluationPermissions.manage) && header.status === "draft",
    };
  }

  private async header(executor: Executor, companyId: string, id: string, lock = false): Promise<HeaderRow> {
    const row = (
      await executor.execute<HeaderRow>(sql`
      SELECT r.id, r.company_id, r.document_no, r.revaluation_date::text, r.status, r.note, u.full_name AS created_by_name, r.posted_at::text, r.version
      FROM finance.fx_revaluations r JOIN core.users u ON u.id = r.created_by
      WHERE r.company_id = ${companyId} AND r.id = ${id} ${lock ? sql`FOR UPDATE OF r` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Ngày đánh giá (QUYTAC_NGHIEPVU_412, 413): kế toán đã khởi tạo, kỳ chưa khóa, sau chứng từ đánh giá lại đã ghi sổ gần nhất;
  // chưa có chứng từ ngoại tệ đã ghi sổ có ngày sau ngày đánh giá (quyết định người dùng 2026-11-12).
  private async checkDate(executor: Executor, companyId: string, date: string): Promise<void> {
    if (!(await ledgerSettings(executor, companyId))) throw new ApiError("BUSINESS_RULE", "ledgerNotInitialized");
    await assertOpenPeriod(executor, companyId, date);
    const last = (
      await executor.execute<{ value: string | null }>(sql`
      SELECT max(revaluation_date)::text AS value FROM finance.fx_revaluations WHERE company_id = ${companyId} AND status = 'posted'`)
    ).rows[0]!.value;
    if (last && date <= last) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { revaluationDate: "revaluationBeforeLast" } });
    const later = await executor.execute(sql`
      SELECT 1 FROM finance.payments WHERE company_id = ${companyId} AND status = 'posted' AND currency IS NOT NULL AND payment_date > ${date}::date
      UNION ALL
      SELECT 1 FROM finance.debt_items WHERE company_id = ${companyId} AND currency IS NOT NULL AND document_date > ${date}::date
      LIMIT 1`);
    if (later.rows.length > 0) throw new ApiError("BUSINESS_RULE", "revaluationHasLaterDocuments");
  }

  async create(actor: Actor, input: z.output<typeof createFxRevaluationSchema>): Promise<FxRevaluationResponse> {
    await requireFinancePermission(this.permissionService, actor, revaluationPermissions.manage);
    const date = input.revaluationDate;
    const end = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);
    if (date !== end) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { revaluationDate: "revaluationNotMonthEnd" } });
    const id = await this.database.transaction(async (transaction) => {
      await this.checkDate(transaction, actor.companyId, date);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.fx_revaluations (company_id, revaluation_date, note, created_by) VALUES (${actor.companyId}, ${date}::date, ${input.note}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.fillLines(transaction, actor.companyId, created, date, new Map());
      await this.auditService.record({ ...financeAudit(actor, "fx_revaluation"), action: "fx_revaluation.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  // Lấy số dư hiện tại (QUYTAC_NGHIEPVU_412): quỹ ngoại tệ có số dư ngoại tệ khác 0, khoản nợ phải trả còn ngoại tệ; tỷ giá theo tiền tệ:
  // tỷ giá đã sửa giữ nguyên, chưa có thì lấy tỷ giá chuyển khoản trung bình ngày đánh giá (ưu tiên nhập tay).
  private async fillLines(executor: Executor, companyId: string, id: string, date: string, keep: Map<string, string | null>): Promise<void> {
    const base = await companyCurrency(executor, companyId);
    await executor.execute(sql`DELETE FROM finance.fx_revaluation_lines WHERE revaluation_id = ${id}`);
    const funds = await executor.execute<{ id: string; currency: string; foreign_balance: string; balance: string }>(sql`
      SELECT f.id, f.currency, ${fundForeignBalance(sql`f.id`)}::text AS foreign_balance, ${fundBalance(sql`f.id`)}::text AS balance
      FROM finance.funds f WHERE f.company_id = ${companyId} AND f.currency IS NOT NULL ORDER BY f.code`);
    const debts = await executor.execute<{ id: string; partner_id: string; currency: string; open_foreign_amount: string; open_amount: string }>(sql`
      SELECT d.id, d.partner_id, d.currency, d.open_foreign_amount::text, d.open_amount::text FROM finance.debt_items d
      WHERE d.company_id = ${companyId} AND d.side = 'payable' AND d.direction = 'debit' AND d.open_foreign_amount > 0
      ORDER BY d.document_date, d.created_at, d.id`);
    const currencies = new Set<string>();
    let lineNo = 0;
    for (const fund of funds.rows.filter((row) => Number(row.foreign_balance) !== 0)) {
      currencies.add(fund.currency);
      await executor.execute(sql`
        INSERT INTO finance.fx_revaluation_lines (revaluation_id, line_no, kind, fund_id, currency, foreign_amount, book_value)
        VALUES (${id}, ${++lineNo}, 'fund', ${fund.id}, ${fund.currency}, ${fund.foreign_balance}::numeric, ${fund.balance}::numeric)`);
    }
    for (const debt of debts.rows) {
      currencies.add(debt.currency);
      await executor.execute(sql`
        INSERT INTO finance.fx_revaluation_lines (revaluation_id, line_no, kind, debt_item_id, partner_id, currency, foreign_amount, book_value)
        VALUES (${id}, ${++lineNo}, 'payable', ${debt.id}, ${debt.partner_id}, ${debt.currency}, ${debt.open_foreign_amount}::numeric, ${debt.open_amount}::numeric)`);
    }
    await executor.execute(sql`DELETE FROM finance.fx_revaluation_rates WHERE revaluation_id = ${id}`);
    for (const currency of [...currencies].sort()) {
      const source = (
        await executor.execute<{ rate: string }>(sql`
        SELECT rate::text FROM core.exchange_rates WHERE rate_date = ${date}::date AND from_currency = ${currency} AND to_currency = ${base} AND rate_type = 'transfer'
        ORDER BY (source = 'manual') DESC, created_at DESC LIMIT 1`)
      ).rows[0]?.rate;
      const rate = keep.has(currency) ? keep.get(currency)! : (source ?? null);
      await executor.execute(sql`
        INSERT INTO finance.fx_revaluation_rates (revaluation_id, currency, rate, source_rate) VALUES (${id}, ${currency}, ${rate}::numeric, ${source ?? null}::numeric)`);
    }
    await this.computeValues(executor, companyId, id);
  }

  // Giá trị mới = số ngoại tệ nhân tỷ giá, làm tròn theo tiền tệ công ty; chênh lệch = giá trị mới - giá trị ghi sổ.
  private async computeValues(executor: Executor, companyId: string, id: string): Promise<void> {
    await executor.execute(sql`
      UPDATE finance.fx_revaluation_lines l
      SET new_value = round(l.foreign_amount * r.rate, finance.company_minor_units(${companyId})),
        difference = round(l.foreign_amount * r.rate, finance.company_minor_units(${companyId})) - l.book_value
      FROM finance.fx_revaluation_rates r WHERE r.revaluation_id = l.revaluation_id AND r.currency = l.currency AND l.revaluation_id = ${id}`);
    await executor.execute(sql`
      UPDATE finance.fx_revaluation_lines l SET new_value = NULL, difference = NULL
      WHERE l.revaluation_id = ${id} AND EXISTS (SELECT 1 FROM finance.fx_revaluation_rates r WHERE r.revaluation_id = l.revaluation_id AND r.currency = l.currency AND r.rate IS NULL)`);
  }

  private async currentRates(executor: Executor, id: string): Promise<Map<string, string | null>> {
    const rows = await executor.execute<{ currency: string; rate: string | null }>(sql`SELECT currency, rate::text FROM finance.fx_revaluation_rates WHERE revaluation_id = ${id}`);
    return new Map(rows.rows.map((row) => [row.currency, row.rate]));
  }

  private async lockDraft(executor: Executor, companyId: string, id: string, version: number): Promise<HeaderRow> {
    const header = await this.header(executor, companyId, id, true);
    if (header.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    if (header.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return header;
  }

  // Sửa tỷ giá, nội dung chứng từ nháp.
  async update(actor: Actor, id: string, input: z.output<typeof updateFxRevaluationSchema>): Promise<FxRevaluationResponse> {
    await requireFinancePermission(this.permissionService, actor, revaluationPermissions.manage);
    await this.database.transaction(async (transaction) => {
      const header = await this.lockDraft(transaction, actor.companyId, id, input.version);
      const known = await this.currentRates(transaction, id);
      const fields: Record<string, "invalidValue"> = {};
      for (const [index, rate] of input.rates.entries()) if (!known.has(rate.currency)) fields[`rates.${index}.currency`] = "invalidValue";
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      for (const rate of input.rates) {
        await transaction.execute(sql`UPDATE finance.fx_revaluation_rates SET rate = ${rate.rate}::numeric WHERE revaluation_id = ${id} AND currency = ${rate.currency}`);
      }
      await this.computeValues(transaction, actor.companyId, id);
      await transaction.execute(sql`UPDATE finance.fx_revaluations SET note = ${input.note}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...financeAudit(actor, "fx_revaluation"), action: "fx_revaluation.update", entityId: id, beforeData: header, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Lấy lại số dư theo chứng từ đã ghi sổ hiện tại, giữ tỷ giá đã nhập.
  async refresh(actor: Actor, id: string, version: number): Promise<FxRevaluationResponse> {
    await requireFinancePermission(this.permissionService, actor, revaluationPermissions.manage);
    await this.database.transaction(async (transaction) => {
      const header = await this.lockDraft(transaction, actor.companyId, id, version);
      await this.fillLines(transaction, actor.companyId, id, header.revaluation_date, await this.currentRates(transaction, id));
      await transaction.execute(sql`UPDATE finance.fx_revaluations SET updated_at = now(), version = version + 1 WHERE id = ${id}`);
    });
    return this.detail(actor, id);
  }

  async cancel(actor: Actor, id: string, version: number): Promise<FxRevaluationResponse> {
    await requireFinancePermission(this.permissionService, actor, revaluationPermissions.manage);
    await this.database.transaction(async (transaction) => {
      await this.lockDraft(transaction, actor.companyId, id, version);
      await transaction.execute(sql`UPDATE finance.fx_revaluations SET status = 'cancelled', updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...financeAudit(actor, "fx_revaluation"), action: "fx_revaluation.cancel", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Ghi sổ (QUYTAC_NGHIEPVU_413): kiểm lại ngày, không còn phiếu ngoại tệ đang chờ có ngày không sau ngày đánh giá; lấy lại số dư lúc ghi sổ
  // (quỹ, công nợ đã khóa), đủ tỷ giá; cập nhật giá trị ghi sổ, tỷ giá đích danh của khoản nợ; cấp số; sinh bút toán.
  async post(actor: Actor, id: string, version: number): Promise<FxRevaluationResponse> {
    await requireFinancePermission(this.permissionService, actor, revaluationPermissions.manage);
    await ensureSequence(this.database, this.sequences, actor, sequenceType, "DGL");
    await this.database.transaction(async (transaction) => {
      const header = await this.lockDraft(transaction, actor.companyId, id, version);
      const date = header.revaluation_date;
      await this.checkDate(transaction, actor.companyId, date);
      const pending = await transaction.execute(sql`
        SELECT 1 FROM finance.payments WHERE company_id = ${actor.companyId} AND status = 'pending' AND currency IS NOT NULL AND payment_date <= ${date}::date LIMIT 1`);
      if (pending.rows.length > 0) throw new ApiError("BUSINESS_RULE", "revaluationHasPendingDocuments");
      await transaction.execute(sql`SELECT 1 FROM finance.funds WHERE company_id = ${actor.companyId} AND currency IS NOT NULL ORDER BY id FOR UPDATE`);
      const partners = await transaction.execute<{ partner_id: string }>(sql`
        SELECT DISTINCT partner_id FROM finance.debt_items WHERE company_id = ${actor.companyId} AND side = 'payable' AND open_foreign_amount > 0 ORDER BY partner_id`);
      for (const partner of partners.rows) await this.debts.lockPartner(transaction, actor.companyId, "payable", partner.partner_id);
      await this.fillLines(transaction, actor.companyId, id, date, await this.currentRates(transaction, id));
      const missing = await transaction.execute<{ currency: string }>(sql`SELECT currency FROM finance.fx_revaluation_rates WHERE revaluation_id = ${id} AND rate IS NULL`);
      if (missing.rows.length > 0) throw new ApiError("BUSINESS_RULE", "revaluationRateMissing");
      const count = (await transaction.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM finance.fx_revaluation_lines WHERE revaluation_id = ${id}`)).rows[0]!.count;
      if (count === 0) throw new ApiError("BUSINESS_RULE", "revaluationEmpty");
      await transaction.execute(sql`
        UPDATE finance.debt_items d SET amount = d.amount + l.difference, open_amount = l.new_value, book_rate = r.rate
        FROM finance.fx_revaluation_lines l JOIN finance.fx_revaluation_rates r ON r.revaluation_id = l.revaluation_id AND r.currency = l.currency
        WHERE l.revaluation_id = ${id} AND l.kind = 'payable' AND d.id = l.debt_item_id`);
      const documentNo = await this.sequences.next(actor.companyId, sequenceType, transaction);
      await transaction.execute(sql`
        UPDATE finance.fx_revaluations SET status = 'posted', document_no = ${documentNo}, posted_by = ${actor.userId}, posted_at = now(), updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      for (const hook of this.postedHooks) await hook(transaction, id);
      await this.auditService.record({ ...financeAudit(actor, "fx_revaluation"), action: "fx_revaluation.post", entityId: id, afterData: { documentNo } }, transaction);
    });
    return this.detail(actor, id);
  }
}

// Lãi: tài sản (quỹ) tăng hoặc nợ phải trả giảm; lỗ: ngược lại.
const gainOf = (alias: ReturnType<typeof sql>) => sql`CASE WHEN ${alias}.kind = 'fund' THEN greatest(${alias}.difference, 0) ELSE greatest(-${alias}.difference, 0) END`;
const lossOf = (alias: ReturnType<typeof sql>) => sql`CASE WHEN ${alias}.kind = 'fund' THEN greatest(-${alias}.difference, 0) ELSE greatest(${alias}.difference, 0) END`;
const gainValue = (line: { kind: string; difference: string | null }) => Math.max(0, (line.kind === "fund" ? 1 : -1) * Number(line.difference ?? 0));
const lossValue = (line: { kind: string; difference: string | null }) => Math.max(0, (line.kind === "fund" ? -1 : 1) * Number(line.difference ?? 0));
