// Quỹ tiền mặt, tài khoản ngân hàng (CONG_VIEC_13; CHUC_NANG_65; QUYTAC_NGHIEPVU_85; API_84): thêm, sửa, ngừng dùng; số dư; sổ quỹ.
import { Inject, Injectable } from "@nestjs/common";
import type { AnyPaymentKind, FundKind, FundLedgerResponse, FundResponse, saveFundSchema } from "contracts";
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
  currency: string | null;
  opening_foreign_balance: string | null;
  opening_exchange_rate: string | null;
  foreign_balance: string | null;
  status: "active" | "inactive";
  has_postings: boolean;
  version: number;
};

// Phiếu thu cộng, phiếu chi trừ vào quỹ (chỉ phiếu đã ghi sổ).
export const signedPaymentAmount = sql`CASE WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus') THEN p.amount ELSE -p.amount END`;
// Số dư theo tiền tệ công ty gồm phần nhận vào quỹ ngoại tệ của phiếu mua ngoại tệ (biến động quỹ, CONG_VIEC_56); quỹ ngoại tệ: giá trị ghi sổ.
export const fundBalance = (fundId: SQL | string) => sql`
  (SELECT balance_fund.opening_balance + coalesce((SELECT sum(m.amount) FROM finance.fund_movements m WHERE m.fund_id = balance_fund.id AND m.status = 'posted'), 0)
   FROM finance.funds balance_fund WHERE balance_fund.id = ${fundId})`;
// Số dư ngoại tệ của quỹ ngoại tệ (QUYTAC_NGHIEPVU_406); quỹ tiền tệ công ty: trống.
export const fundForeignBalance = (fundId: SQL | string) => sql`
  (SELECT balance_fund.opening_foreign_balance + coalesce((SELECT sum(m.foreign_amount) FROM finance.fund_movements m WHERE m.fund_id = balance_fund.id AND m.status = 'posted'), 0)
   FROM finance.funds balance_fund WHERE balance_fund.id = ${fundId})`;
// Tỷ giá bình quân gia quyền di động của quỹ ngoại tệ (QUYTAC_NGHIEPVU_407): giá trị ghi sổ chia số dư ngoại tệ.
export function averageRate(value: string, foreign: string): string | null {
  return Number(foreign) > 0 ? trimDecimal((Number(value) / Number(foreign)).toFixed(8)) : null;
}

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
        f.currency, f.opening_foreign_balance::text, f.opening_exchange_rate::text, ${fundForeignBalance(sql`f.id`)}::text AS foreign_balance,
        EXISTS (SELECT 1 FROM finance.fund_movements m WHERE m.fund_id = f.id AND m.status = 'posted') AS has_postings, f.version
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
      foreign: row.currency
        ? {
            currency: row.currency,
            openingBalance: trimDecimal(row.opening_foreign_balance!),
            openingExchangeRate: trimDecimal(row.opening_exchange_rate!),
            balance: trimDecimal(row.foreign_balance!),
            bookRate: averageRate(row.balance, row.foreign_balance!),
          }
        : null,
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

  // Quỹ ngoại tệ (QUYTAC_NGHIEPVU_406): tiền tệ đang dùng khác tiền tệ công ty; số dư đầu ngoại tệ không lẻ hơn đơn vị của tiền tệ, có tỷ giá;
  // giá trị đầu bằng ngoại tệ nhân tỷ giá, làm tròn theo tiền tệ công ty. Trả về tiền tệ quỹ (trống là tiền tệ công ty) và giá trị đầu.
  private async validate(executor: Executor, companyId: string, input: Input): Promise<{ currency: string | null; openingBalance: string }> {
    const fields: Record<string, "required" | "invalidValue"> = {};
    if (input.kind === "bank") {
      if (!input.bankName) fields.bankName = "required";
      if (!input.accountNo) fields.accountNo = "required";
    }
    const base = await companyCurrency(executor, companyId);
    const currency = input.currency && input.currency !== base ? input.currency : null;
    let openingBalance = input.openingBalance;
    if (currency) {
      const found = (await executor.execute<{ minor_units: number }>(sql`SELECT minor_units FROM core.currencies WHERE code = ${currency} AND is_active`)).rows[0];
      if (!found) fields.currency = "invalidValue";
      const foreign = input.openingForeignBalance ?? "0";
      if (found && (foreign.split(".")[1] ?? "").replace(/0+$/, "").length > Number(found.minor_units)) fields.openingForeignBalance = "invalidValue";
      if (!input.openingExchangeRate || Number(input.openingExchangeRate) <= 0) fields.openingExchangeRate = "required";
      else {
        openingBalance = (
          await executor.execute<{ value: string }>(sql`SELECT round(${foreign}::numeric * ${input.openingExchangeRate}::numeric, finance.company_minor_units(${companyId}))::text AS value`)
        ).rows[0]!.value;
      }
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return { currency, openingBalance };
  }

  private async codeTaken(executor: Executor, companyId: string, code: string, exceptId: string | null): Promise<void> {
    const taken = await executor.execute(sql`SELECT 1 FROM finance.funds WHERE company_id = ${companyId} AND lower(code) = lower(${code}) AND id IS DISTINCT FROM ${exceptId}::uuid`);
    if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "fundCodeExists" } });
  }

  async create(actor: Actor, input: Input): Promise<FundResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.manageFunds);
    const id = await this.database.transaction(async (transaction) => {
      const { currency, openingBalance } = await this.validate(transaction, actor.companyId, input);
      await this.codeTaken(transaction, actor.companyId, input.code, null);
      const bank = input.kind === "bank";
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.funds (company_id, code, name, kind, bank_name, account_no, account_holder, opening_balance, status, created_by,
          currency, opening_foreign_balance, opening_exchange_rate)
        VALUES (${actor.companyId}, ${input.code}, ${input.name}, ${input.kind}, ${bank ? input.bankName : null}, ${bank ? input.accountNo : null}, ${bank ? input.accountHolder : null},
          ${openingBalance}::numeric, ${input.status}, ${actor.userId},
          ${currency}, ${currency ? (input.openingForeignBalance ?? "0") : null}::numeric, ${currency ? input.openingExchangeRate : null}::numeric)
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
    await this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<FundRow>(sql`SELECT * FROM finance.funds WHERE company_id = ${actor.companyId} AND id = ${id} FOR UPDATE`)).rows[0] as
        | (FundRow & { opening_balance: string })
        | undefined;
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const { currency, openingBalance } = await this.validate(transaction, actor.companyId, input);
      await this.codeTaken(transaction, actor.companyId, input.code, id);
      // Quỹ đã có chứng từ (kể cả nhận vào từ phiếu mua ngoại tệ): không đổi số dư đầu, tiền tệ (QUYTAC_NGHIEPVU_85, 406).
      const posted = await transaction.execute(sql`SELECT 1 FROM finance.fund_movements WHERE fund_id = ${id} AND status IN ('pending', 'posted') LIMIT 1`);
      if (posted.rows.length > 0) {
        if (before.currency !== currency) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { currency: "fundHasPostings" } });
        const foreignChanged =
          currency !== null && (Number(before.opening_foreign_balance) !== Number(input.openingForeignBalance ?? 0) || Number(before.opening_exchange_rate) !== Number(input.openingExchangeRate));
        if (Number(before.opening_balance) !== Number(openingBalance) || foreignChanged) {
          throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [currency ? "openingForeignBalance" : "openingBalance"]: "fundHasPostings" } });
        }
      }
      const bank = input.kind === "bank";
      await transaction.execute(sql`
        UPDATE finance.funds SET code = ${input.code}, name = ${input.name}, kind = ${input.kind}, bank_name = ${bank ? input.bankName : null}, account_no = ${bank ? input.accountNo : null},
          account_holder = ${bank ? input.accountHolder : null}, opening_balance = ${openingBalance}::numeric, status = ${input.status},
          currency = ${currency}, opening_foreign_balance = ${currency ? (input.openingForeignBalance ?? "0") : null}::numeric,
          opening_exchange_rate = ${currency ? input.openingExchangeRate : null}::numeric, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...financeAudit(actor, "fund"), action: "fund.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Sổ quỹ: số dư đầu khoảng, các phiếu đã ghi sổ theo ngày, số dư lũy kế.
  async ledger(actor: Actor, id: string, from: string, to: string): Promise<FundLedgerResponse> {
    const fund = await this.detail(actor, id);
    const opening = (
      await this.database.execute<{ value: string; foreign: string | null }>(sql`
      SELECT (f.opening_balance + coalesce((SELECT sum(m.amount) FROM finance.fund_movements m WHERE m.fund_id = f.id AND m.status = 'posted' AND m.payment_date < ${from}::date), 0))::text AS value,
        (f.opening_foreign_balance + coalesce((SELECT sum(m.foreign_amount) FROM finance.fund_movements m WHERE m.fund_id = f.id AND m.status = 'posted' AND m.payment_date < ${from}::date), 0))::text AS foreign
      FROM finance.funds f WHERE f.id = ${id}`)
    ).rows[0]!;
    const rows = await this.database.execute<{
      id: string;
      payment_date: string;
      document_no: string;
      kind: AnyPaymentKind;
      partner_name: string | null;
      amount: string;
      foreign_amount: string | null;
    }>(sql`
      SELECT m.payment_id AS id, m.payment_date::text, coalesce(p.document_no, r.document_no) AS document_no, m.kind, pr.name AS partner_name, m.amount::text, m.foreign_amount::text
      FROM finance.fund_movements m LEFT JOIN finance.payments p ON p.id = m.payment_id LEFT JOIN crm.partners pr ON pr.id = p.partner_id
        LEFT JOIN finance.fx_revaluations r ON r.id = m.payment_id
      WHERE m.fund_id = ${id} AND m.status = 'posted' AND m.payment_date BETWEEN ${from}::date AND ${to}::date
      ORDER BY m.payment_date, m.posted_at, m.payment_id
      LIMIT 5000`);
    let balance = Number(opening.value);
    let foreignBalance = Number(opening.foreign ?? 0);
    const entries = rows.rows.map((row) => {
      const value = Number(row.amount);
      const foreign = Number(row.foreign_amount ?? 0);
      balance += value;
      foreignBalance += foreign;
      return {
        paymentId: row.id,
        date: day(row.payment_date),
        documentNo: row.document_no,
        kind: row.kind,
        partnerName: row.partner_name,
        receipt: value > 0 ? trimDecimal(row.amount) : "0",
        payment: value < 0 ? trimDecimal((-value).toFixed(4)) : "0",
        balance: trimDecimal(balance.toFixed(4)),
        foreign: fund.foreign
          ? { receipt: foreign > 0 ? trimDecimal(foreign.toFixed(4)) : "0", payment: foreign < 0 ? trimDecimal((-foreign).toFixed(4)) : "0", balance: trimDecimal(foreignBalance.toFixed(4)) }
          : null,
      };
    });
    return {
      fund,
      from,
      to,
      openingBalance: trimDecimal(opening.value),
      entries,
      closingBalance: trimDecimal(balance.toFixed(4)),
      foreign: fund.foreign ? { currency: fund.foreign.currency, openingBalance: trimDecimal(opening.foreign ?? "0"), closingBalance: trimDecimal(foreignBalance.toFixed(4)) } : null,
    };
  }
}
