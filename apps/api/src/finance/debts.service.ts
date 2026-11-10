// Sổ công nợ (CONG_VIEC_13; CHUC_NANG_66; QUYTAC_NGHIEPVU_86, 87, 90, 91; API_85): công nợ tự phát sinh khi phiếu kho ghi sổ, trừ nợ, tuổi nợ, số dư đầu kỳ.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  DebtAgeing,
  DebtItemResponse,
  DebtPartnerResponse,
  DebtSide,
  DebtSourceType,
  DebtSummaryResponse,
  FinancePartnerOption,
  OpenDebtsResponse,
  PaymentKind,
  saveOpeningDebtSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { InternalReceiptsService } from "../inventory/internal-receipts.service";
import { StockDocumentsService } from "../inventory/stock-documents.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency } from "../purchasing/requisitions.service";
import { financeAudit, financePermissions, requireFinancePermission } from "./finance-context";

export type Executor = Pick<Database, "execute">;
type Direction = "debit" | "credit";

const inventoryTypes = ["sales_issue", "sales_return", "purchase_receipt", "purchase_return"] as const;
type InventoryType = (typeof inventoryTypes)[number];

// Tuổi nợ trên số còn lại của khoản tăng nợ theo hạn thanh toán (QUYTAC_NGHIEPVU_91).
const ageingColumns = (today: string) => sql`
  coalesce(sum(CASE WHEN i.direction = 'debit' AND i.due_date >= ${today}::date THEN i.open_amount END), 0)::text AS not_due,
  coalesce(sum(CASE WHEN i.direction = 'debit' AND ${today}::date - i.due_date BETWEEN 1 AND 30 THEN i.open_amount END), 0)::text AS overdue_1_30,
  coalesce(sum(CASE WHEN i.direction = 'debit' AND ${today}::date - i.due_date BETWEEN 31 AND 60 THEN i.open_amount END), 0)::text AS overdue_31_60,
  coalesce(sum(CASE WHEN i.direction = 'debit' AND ${today}::date - i.due_date BETWEEN 61 AND 90 THEN i.open_amount END), 0)::text AS overdue_61_90,
  coalesce(sum(CASE WHEN i.direction = 'debit' AND ${today}::date - i.due_date > 90 THEN i.open_amount END), 0)::text AS overdue_over_90,
  coalesce(sum(CASE WHEN i.direction = 'debit' THEN i.open_amount ELSE -i.open_amount END), 0)::text AS balance,
  coalesce(sum(CASE WHEN i.direction = 'credit' THEN i.open_amount END), 0)::text AS advance`;
type AgeingRow = { not_due: string; overdue_1_30: string; overdue_31_60: string; overdue_61_90: string; overdue_over_90: string; balance: string; advance: string };
const toAgeing = (row: AgeingRow): DebtAgeing => ({
  notDue: trimDecimal(row.not_due),
  overdue1To30: trimDecimal(row.overdue_1_30),
  overdue31To60: trimDecimal(row.overdue_31_60),
  overdue61To90: trimDecimal(row.overdue_61_90),
  overdueOver90: trimDecimal(row.overdue_over_90),
});

@Injectable()
export class DebtsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly documents: StockDocumentsService,
    private readonly internalReceipts: InternalReceiptsService,
  ) {}

  onModuleInit(): void {
    this.documents.postedHooks.push((transaction, documentId) => this.recordInventoryDocument(transaction, documentId));
    this.internalReceipts.writtenOffHooks.push((transaction, discrepancyId) => this.recordInternalWriteOff(transaction, discrepancyId));
  }

  // Mọi thay đổi công nợ của một đối tác ở một phía chạy tuần tự (khóa đến hết giao dịch).
  async lockPartner(executor: Executor, companyId: string, side: DebtSide, partnerId: string): Promise<void> {
    await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`finance.debt:${companyId}:${side}:${partnerId}`}, 0))`);
  }

  // Phiếu kho ghi sổ sinh khoản công nợ trong cùng giao dịch (QUYTAC_NGHIEPVU_86).
  async recordInventoryDocument(executor: Executor, documentId: string): Promise<void> {
    const document = (
      await executor.execute<{ type: string; company_id: string; partner_id: string | null; document_no: string | null; document_date: string; source_id: string | null; amount: string }>(sql`
      SELECT type, company_id, partner_id, document_no, document_date::text, source_id, finance.inventory_debt_amount(id)::text AS amount
      FROM inventory.documents WHERE id = ${documentId}`)
    ).rows[0];
    if (!document || !inventoryTypes.includes(document.type as InventoryType) || !document.partner_id || Number(document.amount) <= 0) return;
    const type = document.type as InventoryType;
    const side: DebtSide = type.startsWith("sales") ? "receivable" : "payable";
    await this.lockPartner(executor, document.company_id, side, document.partner_id);
    if (type === "sales_issue" || type === "purchase_receipt") {
      const id = (
        await executor.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, due_date, amount, open_amount)
        VALUES (${document.company_id}, ${document.partner_id}, ${side}, 'debit', ${type}, ${documentId}, ${document.document_no ?? ""}, ${document.document_date}::date,
          ${document.document_date}::date + coalesce((SELECT payment_term_days FROM crm.partner_profiles WHERE company_id = ${document.company_id} AND partner_id = ${document.partner_id}), 0),
          ${document.amount}::numeric, ${document.amount}::numeric)
        RETURNING id`)
      ).rows[0]!.id;
      await this.matchDebit(executor, id);
    } else {
      const original = (await executor.execute<{ id: string }>(sql`SELECT id FROM finance.debt_items WHERE source_id = ${document.source_id} AND direction = 'debit'`)).rows[0]?.id;
      const id = (
        await executor.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, original_item_id, document_no, document_date, amount, open_amount)
        VALUES (${document.company_id}, ${document.partner_id}, ${side}, 'credit', ${type}, ${documentId}, ${original ?? null}, ${document.document_no ?? ""}, ${document.document_date}::date,
          ${document.amount}::numeric, ${document.amount}::numeric)
        RETURNING id`)
      ).rows[0]!.id;
      await this.matchCredit(executor, id, original ? [{ debitItemId: original, amount: null }] : [], true);
    }
  }

  // Giao nội bộ thiếu, bên bán ghi tổn thất: giảm phải thu của công ty mua theo giá đơn bán của phần thiếu, trừ trước vào phiếu xuất gốc (quyết định người dùng 2026-11-10).
  async recordInternalWriteOff(executor: Executor, discrepancyId: string): Promise<void> {
    const row = (
      await executor.execute<{ company_id: string; partner_id: string | null; issue_document_id: string; document_no: string | null; amount: string }>(sql`
      SELECT x.company_id, d.partner_id, x.issue_document_id, d.document_no,
        round(sl.total_amount * x.shortage_base_quantity / sl.base_quantity, 4)::text AS amount
      FROM inventory.internal_discrepancies x JOIN inventory.documents d ON d.id = x.issue_document_id
      JOIN inventory.document_lines dl ON dl.id = x.issue_line_id JOIN sales.order_lines sl ON sl.id = dl.source_line_id
      WHERE x.id = ${discrepancyId}`)
    ).rows[0];
    if (!row || !row.partner_id || Number(row.amount) <= 0) return;
    await this.lockPartner(executor, row.company_id, "receivable", row.partner_id);
    const original = (await executor.execute<{ id: string }>(sql`SELECT id FROM finance.debt_items WHERE source_id = ${row.issue_document_id} AND direction = 'debit'`)).rows[0]?.id;
    const id = (
      await executor.execute<{ id: string }>(sql`
      INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, original_item_id, document_no, document_date, amount, open_amount, note)
      VALUES (${row.company_id}, ${row.partner_id}, 'receivable', 'credit', 'internal_write_off', ${discrepancyId}, ${original ?? null}, ${row.document_no ?? ""}, ${this.permissionService.today()}::date,
        ${row.amount}::numeric, ${row.amount}::numeric, 'Ghi tổn thất hàng thiếu giao nội bộ')
      RETURNING id`)
    ).rows[0]!.id;
    await this.matchCredit(executor, id, original ? [{ debitItemId: original, amount: null }] : [], true);
  }

  // Trừ một khoản giảm vào một khoản tăng, không vượt số còn lại của cả hai và mức chỉ định; trả về số còn lại của hai khoản.
  private async allocate(executor: Executor, debitId: string, creditId: string, cap: string | null): Promise<{ debit: number; credit: number }> {
    const rows = await executor.execute<{ id: string; open_amount: string }>(sql`
      WITH value AS (
        SELECT c.company_id, least(c.open_amount, d.open_amount, coalesce(${cap}::numeric, c.open_amount)) AS amount
        FROM finance.debt_items c, finance.debt_items d
        WHERE c.id = ${creditId} AND d.id = ${debitId} AND c.direction = 'credit' AND d.direction = 'debit'
          AND c.company_id = d.company_id AND c.side = d.side AND c.partner_id = d.partner_id),
      inserted AS (
        INSERT INTO finance.debt_allocations (company_id, debit_item_id, credit_item_id, amount)
        SELECT company_id, ${debitId}, ${creditId}, amount FROM value WHERE amount > 0 RETURNING amount)
      UPDATE finance.debt_items SET open_amount = open_amount - coalesce((SELECT amount FROM inserted), 0)
      WHERE id IN (${debitId}, ${creditId})
      RETURNING id, open_amount::text`);
    const open = (id: string) => Number(rows.rows.find((row) => row.id === id)?.open_amount ?? 0);
    return { debit: open(debitId), credit: open(creditId) };
  }

  // Khoản giảm: trừ trước các khoản tăng chỉ định (phiếu gốc, chứng từ người lập chọn), rồi tùy chọn trừ các khoản tăng cũ nhất (QUYTAC_NGHIEPVU_87).
  async matchCredit(executor: Executor, creditId: string, preferred: { debitItemId: string; amount: string | null }[], oldestFirst: boolean): Promise<void> {
    let remaining = Number((await executor.execute<{ open_amount: string }>(sql`SELECT open_amount::text FROM finance.debt_items WHERE id = ${creditId}`)).rows[0]!.open_amount);
    for (const item of preferred) {
      if (remaining <= 0) return;
      remaining = (await this.allocate(executor, item.debitItemId, creditId, item.amount)).credit;
    }
    if (!oldestFirst) return;
    const debits = await executor.execute<{ id: string }>(sql`
      SELECT d.id FROM finance.debt_items d JOIN finance.debt_items c ON c.id = ${creditId}
      WHERE d.company_id = c.company_id AND d.side = c.side AND d.partner_id = c.partner_id AND d.direction = 'debit' AND d.open_amount > 0
      ORDER BY d.due_date, d.document_date, d.created_at, d.id`);
    for (const debit of debits.rows) {
      if (remaining <= 0) return;
      remaining = (await this.allocate(executor, debit.id, creditId, null)).credit;
    }
  }

  // Khoản tăng mới tự trừ các khoản giảm còn lại cũ nhất (trả trước).
  async matchDebit(executor: Executor, debitId: string): Promise<void> {
    const credits = await executor.execute<{ id: string }>(sql`
      SELECT c.id FROM finance.debt_items c JOIN finance.debt_items d ON d.id = ${debitId}
      WHERE c.company_id = d.company_id AND c.side = d.side AND c.partner_id = d.partner_id AND c.direction = 'credit' AND c.open_amount > 0
      ORDER BY c.document_date, c.created_at, c.id`);
    for (const credit of credits.rows) {
      if ((await this.allocate(executor, debitId, credit.id, null)).debit <= 0) return;
    }
  }

  async summary(actor: Actor, side: DebtSide, search: string | undefined, overdueOnly: boolean): Promise<DebtSummaryResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view);
    const today = this.permissionService.today();
    const rows = await this.database.execute<AgeingRow & { partner_id: string; partner_code: string; partner_name: string }>(sql`
      SELECT p.id AS partner_id, p.code AS partner_code, p.name AS partner_name, ${ageingColumns(today)}
      FROM finance.debt_items i JOIN crm.partners p ON p.id = i.partner_id
      WHERE i.company_id = ${actor.companyId} AND i.side = ${side} AND i.open_amount > 0
        ${search ? sql`AND (p.search_text LIKE ${`%${searchText(search)}%`} OR p.code = ${search.toUpperCase()})` : sql``}
      GROUP BY p.id, p.code, p.name
      ${overdueOnly ? sql`HAVING sum(CASE WHEN i.direction = 'debit' AND i.due_date < ${today}::date THEN i.open_amount ELSE 0 END) > 0` : sql``}
      ORDER BY sum(CASE WHEN i.direction = 'debit' THEN i.open_amount ELSE -i.open_amount END) DESC, p.name
      LIMIT 1000`);
    const totals = (
      await this.database.execute<AgeingRow>(sql`
      SELECT ${ageingColumns(today)} FROM finance.debt_items i WHERE i.company_id = ${actor.companyId} AND i.side = ${side} AND i.open_amount > 0`)
    ).rows[0]!;
    return {
      side,
      currency: await companyCurrency(this.database, actor.companyId),
      partners: rows.rows.map((row) => ({
        partnerId: row.partner_id,
        partnerCode: row.partner_code,
        partnerName: row.partner_name,
        balance: trimDecimal(row.balance),
        advance: trimDecimal(row.advance),
        ...toAgeing(row),
      })),
      totals: { ...toAgeing(totals), balance: trimDecimal(totals.balance), advance: trimDecimal(totals.advance) },
    };
  }

  async partnerDetail(actor: Actor, partnerId: string, side: DebtSide): Promise<DebtPartnerResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, financePermissions.view);
    // Chỉ đối tác có hồ sơ hoặc có công nợ với công ty đang chọn.
    const partner = (
      await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT p.id, p.code, p.name FROM crm.partners p WHERE p.id = ${partnerId}
        AND (EXISTS (SELECT 1 FROM crm.partner_profiles pp WHERE pp.partner_id = p.id AND pp.company_id = ${actor.companyId})
          OR EXISTS (SELECT 1 FROM finance.debt_items i WHERE i.partner_id = p.id AND i.company_id = ${actor.companyId}))`)
    ).rows[0];
    if (!partner) throw new ApiError("NOT_FOUND", "notFound");
    const today = this.permissionService.today();
    const totals = (
      await this.database.execute<AgeingRow>(sql`
      SELECT ${ageingColumns(today)} FROM finance.debt_items i WHERE i.company_id = ${actor.companyId} AND i.side = ${side} AND i.partner_id = ${partnerId} AND i.open_amount > 0`)
    ).rows[0]!;
    const items = await this.database.execute<{
      id: string;
      direction: Direction;
      source_type: DebtSourceType;
      source_id: string | null;
      payment_kind: PaymentKind | null;
      document_no: string;
      document_date: string;
      due_date: string | null;
      amount: string;
      open_amount: string;
      note: string | null;
      allocated: boolean;
    }>(sql`
      SELECT i.id, i.direction, i.source_type, i.source_id, pay.kind AS payment_kind, i.document_no, i.document_date::text, i.due_date::text, i.amount::text, i.open_amount::text, i.note,
        (EXISTS (SELECT 1 FROM finance.debt_allocations a WHERE a.debit_item_id = i.id OR a.credit_item_id = i.id) OR EXISTS (SELECT 1 FROM finance.payment_lines l WHERE l.debit_item_id = i.id)) AS allocated
      FROM finance.debt_items i LEFT JOIN finance.payments pay ON i.source_type = 'payment' AND pay.id = i.source_id
      WHERE i.company_id = ${actor.companyId} AND i.side = ${side} AND i.partner_id = ${partnerId}
      ORDER BY i.document_date DESC, i.created_at DESC
      LIMIT 1000`);
    const allocations = await this.database.execute<{
      debit_item_id: string;
      credit_item_id: string;
      amount: string;
      created_at: Date;
      debit_no: string;
      debit_type: DebtSourceType;
      credit_no: string;
      credit_type: DebtSourceType;
    }>(sql`
      SELECT a.debit_item_id, a.credit_item_id, a.amount::text, a.created_at, d.document_no AS debit_no, d.source_type AS debit_type, c.document_no AS credit_no, c.source_type AS credit_type
      FROM finance.debt_allocations a JOIN finance.debt_items d ON d.id = a.debit_item_id JOIN finance.debt_items c ON c.id = a.credit_item_id
      WHERE d.company_id = ${actor.companyId} AND d.side = ${side} AND d.partner_id = ${partnerId}
      ORDER BY a.created_at`);
    const canManageOpening = granted.has(financePermissions.manageDebts);
    return {
      partner,
      side,
      currency: await companyCurrency(this.database, actor.companyId),
      balance: trimDecimal(totals.balance),
      advance: trimDecimal(totals.advance),
      ageing: toAgeing(totals),
      canManageOpening,
      canManagePayments: granted.has(financePermissions.managePayments),
      items: items.rows.map(
        (row): DebtItemResponse => ({
          id: row.id,
          direction: row.direction,
          sourceType: row.source_type,
          sourceId: row.source_id,
          paymentKind: row.payment_kind,
          documentNo: row.document_no,
          documentDate: day(row.document_date),
          dueDate: row.due_date ? day(row.due_date) : null,
          amount: trimDecimal(row.amount),
          openAmount: trimDecimal(row.open_amount),
          overdueDays: row.due_date && Number(row.open_amount) > 0 ? Math.max(0, daysBetween(row.due_date, today)) : 0,
          note: row.note,
          canDelete: canManageOpening && row.source_type === "opening" && !row.allocated,
          allocations: allocations.rows
            .filter((allocation) => allocation.debit_item_id === row.id || allocation.credit_item_id === row.id)
            .map((allocation) => {
              const otherIsCredit = allocation.debit_item_id === row.id;
              return {
                itemId: otherIsCredit ? allocation.credit_item_id : allocation.debit_item_id,
                documentNo: otherIsCredit ? allocation.credit_no : allocation.debit_no,
                sourceType: otherIsCredit ? allocation.credit_type : allocation.debit_type,
                amount: trimDecimal(allocation.amount),
                date: day(allocation.created_at),
              };
            }),
        }),
      ),
    };
  }

  // Khoản tăng nợ còn lại của đối tác (chọn trừ trên phiếu thu chi), cũ nhất trước; kèm tiền trả trước đang còn.
  async openDebts(actor: Actor, side: DebtSide, partnerId: string): Promise<OpenDebtsResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.managePayments);
    return this.openDebtsOf(this.database, actor.companyId, side, partnerId);
  }

  async openDebtsOf(executor: Executor, companyId: string, side: DebtSide, partnerId: string): Promise<OpenDebtsResponse> {
    const today = this.permissionService.today();
    const rows = await executor.execute<{ id: string; document_no: string; source_type: DebtSourceType; document_date: string; due_date: string; amount: string; open_amount: string }>(sql`
      SELECT id, document_no, source_type, document_date::text, due_date::text, amount::text, open_amount::text FROM finance.debt_items
      WHERE company_id = ${companyId} AND side = ${side} AND partner_id = ${partnerId} AND direction = 'debit' AND open_amount > 0
      ORDER BY due_date, document_date, created_at, id`);
    const advance = (
      await executor.execute<{ value: string }>(sql`
      SELECT coalesce(sum(open_amount), 0)::text AS value FROM finance.debt_items
      WHERE company_id = ${companyId} AND side = ${side} AND partner_id = ${partnerId} AND direction = 'credit' AND open_amount > 0`)
    ).rows[0]!.value;
    return {
      advance: trimDecimal(advance),
      items: rows.rows.map((row) => ({
        id: row.id,
        documentNo: row.document_no,
        sourceType: row.source_type,
        documentDate: day(row.document_date),
        dueDate: day(row.due_date),
        amount: trimDecimal(row.amount),
        openAmount: trimDecimal(row.open_amount),
        overdueDays: Math.max(0, daysBetween(row.due_date, today)),
      })),
    };
  }

  // Đối tác là khách hàng (phải thu) hoặc nhà cung cấp (phải trả) của công ty.
  async partners(actor: Actor, side: DebtSide, search: string | undefined): Promise<FinancePartnerOption[]> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.managePayments, financePermissions.manageDebts);
    const rows = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT p.id, p.code, p.name FROM crm.partner_profiles pp JOIN crm.partners p ON p.id = pp.partner_id
      WHERE pp.company_id = ${actor.companyId} AND ${side === "receivable" ? sql`pp.is_customer` : sql`pp.is_supplier`}
        ${search ? sql`AND (p.search_text LIKE ${`%${searchText(search)}%`} OR p.code = ${search.toUpperCase()})` : sql``}
      ORDER BY p.name LIMIT 20`);
    return rows.rows;
  }

  // Đối tác phải là khách hàng (phải thu) hoặc nhà cung cấp (phải trả) đang giao dịch của công ty.
  async requirePartnerOnSide(executor: Executor, companyId: string, side: DebtSide, partnerId: string, field: string): Promise<void> {
    const profile = (
      await executor.execute<{ ok: boolean; active: boolean }>(sql`
      SELECT ${side === "receivable" ? sql`pp.is_customer` : sql`pp.is_supplier`} AS ok, (pp.status = 'active' AND p.status = 'active') AS active
      FROM crm.partner_profiles pp JOIN crm.partners p ON p.id = pp.partner_id WHERE pp.company_id = ${companyId} AND pp.partner_id = ${partnerId}`)
    ).rows[0];
    if (!profile?.ok) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: side === "receivable" ? "partnerNotCustomer" : "partnerNotSupplier" } });
    if (!profile.active) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: side === "receivable" ? "customerNotActive" : "supplierNotActive" } });
  }

  // Số dư đầu kỳ theo chứng từ cũ (QUYTAC_NGHIEPVU_90).
  async createOpening(actor: Actor, input: z.output<typeof saveOpeningDebtSchema>): Promise<DebtPartnerResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.manageDebts);
    await this.database.transaction(async (transaction) => {
      await this.requirePartnerOnSide(transaction, actor.companyId, input.side, input.partnerId, "partnerId");
      await this.lockPartner(transaction, actor.companyId, input.side, input.partnerId);
      const id = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, document_no, document_date, due_date, amount, open_amount, note, created_by)
        VALUES (${actor.companyId}, ${input.partnerId}, ${input.side}, ${input.direction}, 'opening', ${input.documentNo}, ${input.documentDate}::date,
          ${input.direction === "debit" ? input.dueDate! : null}::date, ${input.amount}::numeric, ${input.amount}::numeric, ${input.note}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      if (input.direction === "debit") await this.matchDebit(transaction, id);
      else await this.matchCredit(transaction, id, [], true);
      await this.auditService.record({ ...financeAudit(actor, "debt_item"), action: "debt.opening.create", entityId: id, afterData: input }, transaction);
    });
    return this.partnerDetail(actor, input.partnerId, input.side);
  }

  async deleteOpening(actor: Actor, id: string): Promise<DebtPartnerResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.manageDebts);
    const row = (
      await this.database.execute<{ partner_id: string; side: DebtSide; source_type: DebtSourceType }>(sql`
      SELECT partner_id, side, source_type FROM finance.debt_items WHERE id = ${id} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row || row.source_type !== "opening") throw new ApiError("NOT_FOUND", "notFound");
    await this.database.transaction(async (transaction) => {
      await this.lockPartner(transaction, actor.companyId, row.side, row.partner_id);
      const deleted = await transaction.execute<{ id: string; document_no: string; amount: string }>(sql`
        DELETE FROM finance.debt_items i WHERE i.id = ${id}
          AND NOT EXISTS (SELECT 1 FROM finance.debt_allocations a WHERE a.debit_item_id = i.id OR a.credit_item_id = i.id)
          AND NOT EXISTS (SELECT 1 FROM finance.payment_lines l WHERE l.debit_item_id = i.id)
        RETURNING i.id, i.document_no, i.amount::text`);
      if (deleted.rows.length === 0) throw new ApiError("BUSINESS_RULE", "openingDebtAllocated");
      await this.auditService.record({ ...financeAudit(actor, "debt_item"), action: "debt.opening.delete", entityId: id, beforeData: deleted.rows[0] }, transaction);
    });
    return this.partnerDetail(actor, row.partner_id, row.side);
  }
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(day(to)) - Date.parse(day(from))) / 86_400_000);
}
