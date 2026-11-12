// Quỹ tiền mặt, tài khoản ngân hàng (CONG_VIEC_13; CHUC_NANG_65; QUYTAC_NGHIEPVU_85; API_84): thêm, sửa, ngừng dùng; số dư; sổ quỹ.
import { Inject, Injectable } from "@nestjs/common";
import type { AnyPaymentKind, FundKind, FundLedgerResponse, FundResponse, saveFundSchema } from "contracts";
import { paymentKindIsReceipt } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency } from "../purchasing/requisitions.service";
import type { Executor } from "./debts.service";
import { financeAudit, financePermissions, requireFinancePermission } from "./finance-context";

type Input = z.output<typeof saveFundSchema>;
type FundRow = {
  id: string;
  code: string;
  name: string;
  kind: FundKind;
  bank_name: string | null;
  account_no: string | null;
  account_holder: string | null;
  opening_balance: string;
  balance: string;
  status: "active" | "inactive";
  has_postings: boolean;
  version: number;
};

// Phiếu thu cộng, phiếu chi trừ vào quỹ (chỉ phiếu đã ghi sổ).
export const signedPaymentAmount = sql`CASE WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus', 'loyalty_intercompany_receipt') THEN p.amount ELSE -p.amount END`;
export const fundBalance = (fundId: SQL | string) => sql`
  (SELECT balance_fund.opening_balance + coalesce((SELECT sum(${signedPaymentAmount}) FROM finance.payments p WHERE p.fund_id = balance_fund.id AND p.status = 'posted'), 0)
   FROM finance.funds balance_fund WHERE balance_fund.id = ${fundId})`;

@Injectable()
export class FundsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  private select(): SQL {
    return sql`
      SELECT f.id, f.code, f.name, f.kind, f.bank_name, f.account_no, f.account_holder, f.opening_balance::text, ${fundBalance(sql`f.id`)}::text AS balance, f.status,
        EXISTS (SELECT 1 FROM finance.payments p WHERE p.fund_id = f.id AND p.status = 'posted') AS has_postings, f.version
      FROM finance.funds f`;
  }

  private async toResponse(actor: Actor, row: FundRow, canManage: boolean): Promise<FundResponse> {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      kind: row.kind,
      bankName: row.bank_name,
      accountNo: row.account_no,
      accountHolder: row.account_holder,
      openingBalance: trimDecimal(row.opening_balance),
      balance: trimDecimal(row.balance),
      status: row.status,
      hasPostings: row.has_postings,
      currency: await companyCurrency(this.database, actor.companyId),
      version: row.version,
      canManage,
    };
  }

  async list(actor: Actor): Promise<FundResponse[]> {
    const granted = await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.manageFunds, financePermissions.managePayments);
    const rows = await this.database.execute<FundRow>(sql`${this.select()} WHERE f.company_id = ${actor.companyId} ORDER BY f.status, f.code`);
    return Promise.all(rows.rows.map((row) => this.toResponse(actor, row, granted.has(financePermissions.manageFunds))));
  }

  async detail(actor: Actor, id: string): Promise<FundResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.manageFunds);
    return this.toResponse(actor, await this.single(this.database, actor.companyId, id), granted.has(financePermissions.manageFunds));
  }

  private async single(executor: Executor, companyId: string, id: string): Promise<FundRow> {
    const row = (await executor.execute<FundRow>(sql`${this.select()} WHERE f.company_id = ${companyId} AND f.id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private validate(input: Input): void {
    if (input.kind === "bank") {
      const fields: Record<string, "required"> = {};
      if (!input.bankName) fields.bankName = "required";
      if (!input.accountNo) fields.accountNo = "required";
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    }
  }

  private async codeTaken(executor: Executor, companyId: string, code: string, exceptId: string | null): Promise<void> {
    const taken = await executor.execute(sql`SELECT 1 FROM finance.funds WHERE company_id = ${companyId} AND lower(code) = lower(${code}) AND id IS DISTINCT FROM ${exceptId}::uuid`);
    if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "fundCodeExists" } });
  }

  async create(actor: Actor, input: Input): Promise<FundResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.manageFunds);
    this.validate(input);
    const id = await this.database.transaction(async (transaction) => {
      await this.codeTaken(transaction, actor.companyId, input.code, null);
      const bank = input.kind === "bank";
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.funds (company_id, code, name, kind, bank_name, account_no, account_holder, opening_balance, status, created_by)
        VALUES (${actor.companyId}, ${input.code}, ${input.name}, ${input.kind}, ${bank ? input.bankName : null}, ${bank ? input.accountNo : null}, ${bank ? input.accountHolder : null},
          ${input.openingBalance}::numeric, ${input.status}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.auditService.record({ ...financeAudit(actor, "fund"), action: "fund.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  // Số dư đầu chỉ sửa khi quỹ chưa có phiếu ghi sổ (QUYTAC_NGHIEPVU_85).
  async update(actor: Actor, id: string, input: Input): Promise<FundResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.manageFunds);
    this.validate(input);
    await this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<FundRow>(sql`SELECT * FROM finance.funds WHERE company_id = ${actor.companyId} AND id = ${id} FOR UPDATE`)).rows[0] as
        | (FundRow & { opening_balance: string })
        | undefined;
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.codeTaken(transaction, actor.companyId, input.code, id);
      const posted = await transaction.execute(sql`SELECT 1 FROM finance.payments WHERE fund_id = ${id} AND status IN ('pending', 'posted') LIMIT 1`);
      if (posted.rows.length > 0 && Number(before.opening_balance) !== Number(input.openingBalance)) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { openingBalance: "fundHasPostings" } });
      }
      const bank = input.kind === "bank";
      await transaction.execute(sql`
        UPDATE finance.funds SET code = ${input.code}, name = ${input.name}, kind = ${input.kind}, bank_name = ${bank ? input.bankName : null}, account_no = ${bank ? input.accountNo : null},
          account_holder = ${bank ? input.accountHolder : null}, opening_balance = ${input.openingBalance}::numeric, status = ${input.status}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...financeAudit(actor, "fund"), action: "fund.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Sổ quỹ: số dư đầu khoảng, các phiếu đã ghi sổ theo ngày, số dư lũy kế.
  async ledger(actor: Actor, id: string, from: string, to: string): Promise<FundLedgerResponse> {
    const fund = await this.detail(actor, id);
    const opening = (
      await this.database.execute<{ value: string }>(sql`
      SELECT (f.opening_balance + coalesce((SELECT sum(${signedPaymentAmount}) FROM finance.payments p WHERE p.fund_id = f.id AND p.status = 'posted' AND p.payment_date < ${from}::date), 0))::text AS value
      FROM finance.funds f WHERE f.id = ${id}`)
    ).rows[0]!.value;
    const rows = await this.database.execute<{ id: string; payment_date: string; document_no: string; kind: AnyPaymentKind; partner_name: string | null; amount: string }>(sql`
      SELECT p.id, p.payment_date::text, p.document_no, p.kind, pr.name AS partner_name, p.amount::text
      FROM finance.payments p LEFT JOIN crm.partners pr ON pr.id = p.partner_id
      WHERE p.fund_id = ${id} AND p.status = 'posted' AND p.payment_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY p.payment_date, p.posted_at, p.id
      LIMIT 5000`);
    let balance = Number(opening);
    const entries = rows.rows.map((row) => {
      const receipt = paymentKindIsReceipt(row.kind);
      balance += receipt ? Number(row.amount) : -Number(row.amount);
      return {
        paymentId: row.id,
        date: day(row.payment_date),
        documentNo: row.document_no,
        kind: row.kind,
        partnerName: row.partner_name,
        receipt: receipt ? trimDecimal(row.amount) : "0",
        payment: receipt ? "0" : trimDecimal(row.amount),
        balance: trimDecimal(balance.toFixed(4)),
      };
    });
    return { fund, from, to, openingBalance: trimDecimal(opening), entries, closingBalance: trimDecimal(balance.toFixed(4)) };
  }
}
