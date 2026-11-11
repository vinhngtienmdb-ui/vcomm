// Ca thu ngân: mở ca, đóng ca, đối chiếu tiền mặt (CONG_VIEC_53; CHUC_NANG_186; QUYTAC_NGHIEPVU_369, 375; API_193).
import { Inject, Injectable } from "@nestjs/common";
import type {
  closeRetailShiftSchema,
  openRetailShiftSchema,
  RetailCounterContext,
  RetailFundDocumentKind,
  RetailShiftListResponse,
  RetailShiftResponse,
  retailShiftListQuerySchema,
  RetailShiftSummaryLine,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "../finance/debts.service";
import { PaymentsService } from "../finance/payments.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency } from "../purchasing/requisitions.service";
import { companyRound, retailAudit, retailPermissions, retailPermissionsAt, retailScope, scopeCondition } from "./retail-context";

type OpenInput = z.output<typeof openRetailShiftSchema>;
type CloseInput = z.output<typeof closeRetailShiftSchema>;
type ListQuery = z.output<typeof retailShiftListQuerySchema>;

type ShiftRow = {
  id: string;
  company_id: string;
  store_id: string;
  store_name: string;
  branch_id: string;
  cash_fund_id: string;
  vietqr_bank_bin: string | null;
  vietqr_account_name: string | null;
  bank_account_no: string | null;
  register_id: string;
  register_code: string;
  register_name: string;
  cashier_id: string;
  cashier_name: string;
  opened_at: Date;
  opening_cash: string;
  opening_note: string | null;
  status: "open" | "closed";
  closed_at: Date | null;
  closed_by_name: string | null;
  expected_cash: string | null;
  counted_cash: string | null;
  difference: string | null;
  difference_reason: string | null;
  version: number;
};

export type RetailShift = ShiftRow;

const shiftSelect = sql`
  SELECT sh.id, sh.company_id, sh.store_id, b.name AS store_name, s.branch_id, s.cash_fund_id, s.vietqr_bank_bin, s.vietqr_account_name, bf.account_no AS bank_account_no, sh.register_id, r.code AS register_code, r.name AS register_name,
    sh.cashier_id, cu.full_name AS cashier_name, sh.opened_at, sh.opening_cash::text, sh.opening_note, sh.status, sh.closed_at, xu.full_name AS closed_by_name,
    sh.expected_cash::text, sh.counted_cash::text, sh.difference::text, sh.difference_reason, sh.version
  FROM retail.shifts sh
  JOIN retail.stores s ON s.id = sh.store_id
  JOIN core.branches b ON b.id = s.branch_id
  LEFT JOIN finance.funds bf ON bf.id = s.bank_fund_id
  JOIN retail.registers r ON r.id = sh.register_id
  JOIN core.users cu ON cu.id = sh.cashier_id
  LEFT JOIN core.users xu ON xu.id = sh.closed_by`;

const longShiftHours = 24;
const shiftSource = "retail.shift";

@Injectable()
export class RetailShiftsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly payments: PaymentsService,
  ) {}

  async shift(executor: Executor, companyId: string, id: string, lock = false): Promise<RetailShift> {
    const row = (await executor.execute<ShiftRow>(sql`${shiftSelect} WHERE sh.company_id = ${companyId} AND sh.id = ${id} ${lock ? sql`FOR UPDATE OF sh` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Tiền theo phương thức của ca: thu bán (tiền mặt đã trừ tiền thừa), hoàn trả hàng.
  async summary(executor: Executor, shiftId: string): Promise<RetailShiftSummaryLine[]> {
    const rows = await executor.execute<{ method: RetailShiftSummaryLine["method"]; sales: string; refunds: string }>(sql`
      SELECT method, sum(sales)::text AS sales, sum(refunds)::text AS refunds FROM (
        SELECT p.method, p.amount AS sales, 0 AS refunds FROM retail.sale_payments p JOIN retail.sales s ON s.id = p.sale_id WHERE s.shift_id = ${shiftId}
        UNION ALL SELECT 'cash', -s.change_amount, 0 FROM retail.sales s WHERE s.shift_id = ${shiftId}
        UNION ALL SELECT f.method, 0, f.amount FROM retail.return_refunds f JOIN retail.returns r ON r.id = f.return_id WHERE r.shift_id = ${shiftId}
      ) movements GROUP BY method`);
    const found = new Map(rows.rows.map((row) => [row.method, row]));
    return (["cash", "bank_transfer", "points"] as const).map((method) => {
      const sales = Number(found.get(method)?.sales ?? 0);
      const refunds = Number(found.get(method)?.refunds ?? 0);
      return { method, sales: trimDecimal(sales.toFixed(4)), refunds: trimDecimal(refunds.toFixed(4)), net: trimDecimal((sales - refunds).toFixed(4)) };
    });
  }

  // Tiền theo quỹ để lập chứng từ khi đóng ca: thu bán, hoàn trả hàng (không gồm điểm).
  private async byFund(executor: Executor, shiftId: string): Promise<{ fund_id: string; sales: string; refunds: string }[]> {
    return (
      await executor.execute<{ fund_id: string; sales: string; refunds: string }>(sql`
      SELECT fund_id, round(sum(sales), 4)::text AS sales, round(sum(refunds), 4)::text AS refunds FROM (
        SELECT p.fund_id, p.amount AS sales, 0 AS refunds
          FROM retail.sale_payments p JOIN retail.sales s ON s.id = p.sale_id WHERE s.shift_id = ${shiftId} AND p.fund_id IS NOT NULL
        UNION ALL SELECT st.cash_fund_id, -s.change_amount, 0 FROM retail.sales s JOIN retail.stores st ON st.id = s.store_id WHERE s.shift_id = ${shiftId}
        UNION ALL SELECT f.fund_id, 0, f.amount FROM retail.return_refunds f JOIN retail.returns r ON r.id = f.return_id WHERE r.shift_id = ${shiftId} AND f.fund_id IS NOT NULL
      ) movements GROUP BY fund_id ORDER BY fund_id`)
    ).rows;
  }

  // Tiền mặt hệ thống tính = tiền đầu ca + tiền mặt thu (đã trừ tiền thừa) − tiền mặt hoàn (QUYTAC_NGHIEPVU_375).
  async expectedCash(executor: Executor, row: ShiftRow): Promise<string> {
    if (row.status === "closed") return row.expected_cash!;
    const cash = (await this.summary(executor, row.id)).find((line) => line.method === "cash")!;
    return trimDecimal((Number(row.opening_cash) + Number(cash.net)).toFixed(4));
  }

  private async saleCount(executor: Executor, shiftId: string): Promise<number> {
    return (await executor.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM retail.sales WHERE shift_id = ${shiftId}`)).rows[0]!.total;
  }

  private async canClose(actor: Actor, row: ShiftRow): Promise<boolean> {
    if (row.status !== "open") return false;
    const granted = await retailPermissionsAt(this.permissionService, actor, row.branch_id);
    return granted.has(retailPermissions.manageShifts) || (row.cashier_id === actor.userId && granted.has(retailPermissions.sale));
  }

  private async toResponse(actor: Actor, row: ShiftRow): Promise<RetailShiftResponse> {
    return {
      id: row.id,
      store: {
        id: row.store_id,
        name: row.store_name,
        bankTransfer: row.vietqr_bank_bin && row.bank_account_no ? { bankBin: row.vietqr_bank_bin, accountNo: row.bank_account_no, accountName: row.vietqr_account_name! } : null,
      },
      register: { id: row.register_id, code: row.register_code, name: row.register_name },
      cashier: { id: row.cashier_id, name: row.cashier_name },
      openedAt: new Date(row.opened_at).toISOString(),
      openingCash: trimDecimal(row.opening_cash),
      openingNote: row.opening_note,
      status: row.status,
      closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
      closedBy: row.closed_by_name,
      expectedCash: trimDecimal(await this.expectedCash(this.database, row)),
      countedCash: row.counted_cash === null ? null : trimDecimal(row.counted_cash),
      difference: row.difference === null ? null : trimDecimal(row.difference),
      differenceReason: row.difference_reason,
      saleCount: await this.saleCount(this.database, row.id),
      summary: await this.summary(this.database, row.id),
      currency: await companyCurrency(this.database, actor.companyId),
      version: row.version,
      canClose: await this.canClose(actor, row),
      fundDocuments: (
        await this.database.execute<{ id: string; document_no: string; kind: RetailFundDocumentKind; fund_name: string; amount: string }>(sql`
        SELECT p.id, p.document_no, p.kind, f.name AS fund_name, p.amount::text FROM finance.payments p JOIN finance.funds f ON f.id = p.fund_id
        WHERE p.source_type = ${shiftSource} AND p.source_id = ${row.id} ORDER BY p.document_no`)
      ).rows.map((document) => ({ id: document.id, documentNo: document.document_no, kind: document.kind, fundName: document.fund_name, amount: trimDecimal(document.amount) })),
    };
  }

  // Xem ca: ca của mình (có quyền bán), hoặc ca trong phạm vi quản lý ca.
  private async visibility(actor: Actor): Promise<SQL> {
    const manage = await retailScope(this.permissionService, actor, retailPermissions.manageShifts);
    const sale = await retailScope(this.permissionService, actor, retailPermissions.sale);
    if (!manage && !sale) throw new ApiError("FORBIDDEN", "forbidden");
    return sql`(${scopeCondition(manage, sql`s.branch_id`)} OR (sh.cashier_id = ${actor.userId} AND ${scopeCondition(sale, sql`s.branch_id`)}))`;
  }

  async detail(actor: Actor, id: string): Promise<RetailShiftResponse> {
    const row = (await this.database.execute<ShiftRow>(sql`${shiftSelect} WHERE sh.company_id = ${actor.companyId} AND sh.id = ${id} AND ${await this.visibility(actor)}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return this.toResponse(actor, row);
  }

  async list(actor: Actor, query: ListQuery): Promise<RetailShiftListResponse> {
    const conditions: SQL[] = [sql`sh.company_id = ${actor.companyId}`, await this.visibility(actor)];
    if (query.storeId) conditions.push(sql`sh.store_id = ${query.storeId}`);
    if (query.status) conditions.push(sql`sh.status = ${query.status}`);
    if (query.from) conditions.push(sql`(sh.opened_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${query.from}::date`);
    if (query.to) conditions.push(sql`(sh.opened_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${query.to}::date`);
    if (query.differenceOnly) conditions.push(sql`sh.difference <> 0`);
    const where = sql.join(conditions, sql` AND `);
    const pageSize = 20;
    const [rows, total] = await Promise.all([
      this.database.execute<ShiftRow>(sql`${shiftSelect} WHERE ${where} ORDER BY sh.opened_at DESC LIMIT ${pageSize} OFFSET ${(query.page - 1) * pageSize}`),
      this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM retail.shifts sh JOIN retail.stores s ON s.id = sh.store_id WHERE ${where}`),
    ]);
    const currency = await companyCurrency(this.database, actor.companyId);
    const now = this.clock.now().getTime();
    const items = [];
    for (const row of rows.rows) {
      items.push({
        id: row.id,
        storeName: row.store_name,
        registerCode: row.register_code,
        cashierName: row.cashier_name,
        openedAt: new Date(row.opened_at).toISOString(),
        closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
        status: row.status,
        openingCash: trimDecimal(row.opening_cash),
        expectedCash: row.status === "closed" ? trimDecimal(row.expected_cash!) : trimDecimal(await this.expectedCash(this.database, row)),
        countedCash: row.counted_cash === null ? null : trimDecimal(row.counted_cash),
        difference: row.difference === null ? null : trimDecimal(row.difference),
        openedLong: row.status === "open" && now - new Date(row.opened_at).getTime() > longShiftHours * 3600 * 1000,
        currency,
      });
    }
    return { items, total: total.rows[0]!.total, page: query.page };
  }

  // Màn hình bán: cửa hàng, quầy được bán và ca đang mở của người đăng nhập.
  async counter(actor: Actor): Promise<RetailCounterContext> {
    const sale = await retailScope(this.permissionService, actor, retailPermissions.sale);
    if (!sale) throw new ApiError("FORBIDDEN", "forbidden");
    const rows = await this.database.execute<{ store_id: string; store_name: string; id: string; code: string; name: string; busy: boolean; last_closing: string | null }>(sql`
      SELECT s.id AS store_id, b.name AS store_name, r.id, r.code, r.name,
        EXISTS (SELECT 1 FROM retail.shifts o WHERE o.register_id = r.id AND o.status = 'open') AS busy,
        (SELECT c.counted_cash::text FROM retail.shifts c WHERE c.register_id = r.id AND c.status = 'closed' ORDER BY c.closed_at DESC LIMIT 1) AS last_closing
      FROM retail.stores s JOIN core.branches b ON b.id = s.branch_id JOIN retail.registers r ON r.store_id = s.id
      WHERE s.company_id = ${actor.companyId} AND s.status = 'active' AND r.status = 'active' AND ${scopeCondition(sale, sql`s.branch_id`)}
      ORDER BY b.name, r.code`);
    const stores = new Map<string, RetailCounterContext["stores"][number]>();
    for (const row of rows.rows) {
      const store = stores.get(row.store_id) ?? { id: row.store_id, name: row.store_name, registers: [] };
      store.registers.push({ id: row.id, code: row.code, name: row.name, busy: row.busy, lastClosingCash: row.last_closing === null ? null : trimDecimal(row.last_closing) });
      stores.set(row.store_id, store);
    }
    const open = (await this.database.execute<ShiftRow>(sql`${shiftSelect} WHERE sh.company_id = ${actor.companyId} AND sh.cashier_id = ${actor.userId} AND sh.status = 'open'`)).rows[0];
    return { stores: [...stores.values()], currentShift: open ? await this.toResponse(actor, open) : null, currency: await companyCurrency(this.database, actor.companyId) };
  }

  // Ca đang mở của người thao tác, kiểm lại quyền bán tại cửa hàng (QUYTAC_NGHIEPVU_370). Gọi trong giao dịch bán, trả hàng; khóa ca.
  async requireOwnOpenShift(executor: Executor, actor: Actor, shiftId: string, permission: string = retailPermissions.sale): Promise<RetailShift> {
    const row = await this.shift(executor, actor.companyId, shiftId, true);
    if (row.cashier_id !== actor.userId) throw new ApiError("NOT_FOUND", "notFound");
    if (row.status !== "open") throw new ApiError("BUSINESS_RULE", "retailShiftClosed");
    const granted = await retailPermissionsAt(this.permissionService, actor, row.branch_id);
    if (!granted.has(permission)) throw new ApiError("FORBIDDEN", "forbidden");
    const active = await executor.execute(sql`
      SELECT 1 FROM retail.stores s JOIN retail.registers r ON r.id = ${row.register_id} WHERE s.id = ${row.store_id} AND s.status = 'active' AND r.status = 'active'`);
    if (active.rows.length === 0) throw new ApiError("BUSINESS_RULE", "retailRegisterUnavailable");
    return row;
  }

  // Mở ca (QUYTAC_NGHIEPVU_369).
  async open(actor: Actor, input: OpenInput): Promise<RetailShiftResponse> {
    const id = await this.database.transaction(async (transaction) => {
      const register = (
        await transaction.execute<{ id: string; store_id: string; branch_id: string; available: boolean }>(sql`
        SELECT r.id, r.store_id, s.branch_id, (r.status = 'active' AND s.status = 'active') AS available
        FROM retail.registers r JOIN retail.stores s ON s.id = r.store_id
        WHERE r.id = ${input.registerId} AND r.company_id = ${actor.companyId} FOR UPDATE OF r`)
      ).rows[0];
      if (!register) throw new ApiError("NOT_FOUND", "notFound");
      const granted = await retailPermissionsAt(this.permissionService, actor, register.branch_id);
      if (!granted.has(retailPermissions.sale)) throw new ApiError("FORBIDDEN", "forbidden");
      if (!register.available) throw new ApiError("BUSINESS_RULE", "retailRegisterUnavailable");
      const own = await transaction.execute(sql`SELECT 1 FROM retail.shifts WHERE cashier_id = ${actor.userId} AND status = 'open'`);
      if (own.rows.length > 0) throw new ApiError("BUSINESS_RULE", "retailCashierHasShift");
      const busy = await transaction.execute(sql`SELECT 1 FROM retail.shifts WHERE register_id = ${register.id} AND status = 'open'`);
      if (busy.rows.length > 0) throw new ApiError("BUSINESS_RULE", "retailRegisterBusy");
      const opening = (await transaction.execute<{ amount: string }>(sql`SELECT ${companyRound(sql`${input.openingCash}::numeric`, actor.companyId)}::text AS amount`)).rows[0]!.amount;
      if (Number(opening) > 1_000_000_000) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { openingCash: "invalidValue" } });
      const last = (
        await transaction.execute<{ counted: string }>(sql`
        SELECT counted_cash::text AS counted FROM retail.shifts WHERE register_id = ${register.id} AND status = 'closed' ORDER BY closed_at DESC LIMIT 1`)
      ).rows[0];
      if (last && Number(last.counted) !== Number(opening) && !input.openingNote) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { openingNote: "retailOpeningNoteRequired" } });
      }
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO retail.shifts (company_id, store_id, register_id, cashier_id, opened_at, opening_cash, opening_note)
        VALUES (${actor.companyId}, ${register.store_id}, ${register.id}, ${actor.userId}, ${this.clock.now()}, ${opening}::numeric, ${input.openingNote})
        RETURNING id`)
      ).rows[0]!.id;
      await this.auditService.record({ ...retailAudit(actor, "retail_shift"), action: "retail_shift.open", entityId: created, afterData: { ...input, openingCash: opening } }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  // Chứng từ quỹ khi đóng ca (QUYTAC_NGHIEPVU_375; THAY_DOI_24): mỗi quỹ một phiếu thu bán lẻ, một phiếu chi hoàn tiền; lệch tiền mặt thì phiếu chi thiếu (thu ngân chịu)
  // hoặc phiếu thu thừa; số tiền 0 thì không lập.
  private async recordFundDocuments(transaction: Parameters<Parameters<Database["transaction"]>[0]>[0], actor: Actor, shift: RetailShift, difference: number): Promise<void> {
    const date = this.permissionService.today();
    const note = (text: string) => `${text} – ca quầy ${shift.register_code}, ${shift.cashier_name}`;
    const record = (kind: RetailFundDocumentKind, fundId: string, amount: number, text: string) =>
      this.payments.recordRetailWithin(transaction, actor, {
        kind,
        fundId,
        paymentDate: date,
        amount: amount.toFixed(4),
        note: note(text),
        sourceType: shiftSource,
        sourceId: shift.id,
        staffUserId: kind === "cash_shortage" ? shift.cashier_id : null,
      });
    for (const fund of await this.byFund(transaction, shift.id)) {
      if (Number(fund.sales) > 0) await record("retail_receipt", fund.fund_id, Number(fund.sales), "Thu tiền bán lẻ");
      if (Number(fund.refunds) > 0) await record("retail_refund", fund.fund_id, Number(fund.refunds), "Hoàn tiền trả hàng bán lẻ");
    }
    if (difference < 0) await record("cash_shortage", shift.cash_fund_id, -difference, "Thiếu tiền mặt khi đóng ca");
    if (difference > 0) await record("cash_surplus", shift.cash_fund_id, difference, "Thừa tiền mặt khi đóng ca");
  }

  // Đóng ca (QUYTAC_NGHIEPVU_375).
  async close(actor: Actor, id: string, input: CloseInput): Promise<RetailShiftResponse> {
    await this.payments.prepareRetailNumbering(actor);
    await this.database.transaction(async (transaction) => {
      const row = await this.shift(transaction, actor.companyId, id, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "open") throw new ApiError("BUSINESS_RULE", "retailShiftClosed");
      if (!(await this.canClose(actor, row))) {
        const visible = await retailPermissionsAt(this.permissionService, actor, row.branch_id);
        throw visible.has(retailPermissions.sale) || visible.has(retailPermissions.manageShifts) ? new ApiError("FORBIDDEN", "forbidden") : new ApiError("NOT_FOUND", "notFound");
      }
      const expected = (await transaction.execute<{ amount: string }>(sql`SELECT ${companyRound(sql`${await this.expectedCash(transaction, row)}::numeric`, actor.companyId)}::text AS amount`))
        .rows[0]!.amount;
      const counted = (await transaction.execute<{ amount: string }>(sql`SELECT ${companyRound(sql`${input.countedCash}::numeric`, actor.companyId)}::text AS amount`)).rows[0]!.amount;
      const difference = trimDecimal((Number(counted) - Number(expected)).toFixed(4));
      if (Number(difference) !== 0 && !input.differenceReason) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { differenceReason: "retailDifferenceReasonRequired" } });
      }
      const closing = { expectedCash: trimDecimal(expected), countedCash: trimDecimal(counted), difference };
      await transaction.execute(sql`
        UPDATE retail.shifts SET status = 'closed', closed_at = ${this.clock.now()}, closed_by = ${actor.userId}, expected_cash = ${expected}::numeric, counted_cash = ${counted}::numeric,
          difference = ${difference}::numeric, difference_reason = ${Number(difference) === 0 ? null : input.differenceReason}, version = version + 1
        WHERE id = ${id}`);
      await this.recordFundDocuments(transaction, actor, row, Number(difference));
      await this.auditService.record(
        { ...retailAudit(actor, "retail_shift"), action: "retail_shift.close", entityId: id, beforeData: { status: "open" }, afterData: { ...closing, reason: input.differenceReason } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }
}
