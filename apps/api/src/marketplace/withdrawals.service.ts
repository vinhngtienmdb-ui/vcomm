// Rút tiền hoa hồng (CONG_VIEC_26; CHUC_NANG_137; API_136; QUYTAC_NGHIEPVU_204 đến 206): người dùng yêu cầu, kế toán duyệt (chốt thuế), từ chối, ghi đã chi.
import { Inject, Injectable } from "@nestjs/common";
import { type BuyerWithdrawalInfo, type CommissionSettings, type PageResponse, type WithdrawalItem, type WithdrawalStatus, type WithdrawalTaxReport, withdrawalFee } from "contracts";
import { sql } from "drizzle-orm";
import { LedgerService } from "../accounting/ledger.service";
import { marketplaceWithdrawalDraft } from "../accounting/postings";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import type { BuyerAdminActor } from "./buyer-admin.service";
import { localPhone } from "./local-phone";
import { vietnamToday } from "./shop.service";
import { commissionSettings } from "./store.service";

type Executor = Pick<Database, "execute">;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

type WithdrawalRow = {
  id: string;
  company_id: string;
  user_id: string;
  user_name: string;
  user_phone: string | null;
  amount: string;
  tax_amount: string | null;
  fee_amount: string | null;
  net_amount: string | null;
  // Thứ tự của yêu cầu trong tháng tạo (giờ Việt Nam), không tính yêu cầu bị từ chối, đã rút lại (THAY_DOI_17).
  sequence: number;
  bank_name: string;
  account_number: string;
  account_holder: string;
  status: WithdrawalStatus;
  reject_reason: string | null;
  bank_transaction_no: string | null;
  paid_on: string | null;
  created_at: Date;
  decided_at: Date | null;
  version: number;
};

// Thuế thu nhập cá nhân (QUYTAC_NGHIEPVU_205, THAY_DOI_19): tổng số tiền đã duyệt trong tháng (approvedThisMonth) cộng số tiền yêu cầu này
// vượt ngưỡng thì khấu trừ theo tỷ lệ trên toàn bộ số tiền yêu cầu này, làm tròn đến đồng.
export function withdrawalTax(amount: number, threshold: number, rate: number, approvedThisMonth = 0): number {
  return approvedThisMonth + amount > threshold ? Math.round((amount * rate) / 100) : 0;
}

// Thuế, phí theo cài đặt hiện tại cho yêu cầu có số tiền amount, là lần rút thứ sequence trong tháng (QUYTAC_NGHIEPVU_205, 208).
function deductions(settings: CommissionSettings, amount: number, sequence: number, approvedThisMonth: number): { tax: number; fee: number } {
  return {
    tax: withdrawalTax(amount, Number(settings.taxThreshold), Number(settings.taxRate), approvedThisMonth),
    fee: withdrawalFee(amount, sequence, settings.withdrawalFees),
  };
}
const counted = sql`('pending', 'approved', 'paid')`;
const vietnamMonth = (column: ReturnType<typeof sql>) => sql`date_trunc('month', ${column} AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
// Ngày Việt Nam của một thời điểm.
const vietnamDate = (value: Date) => new Date(new Date(value).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

@Injectable()
export class WithdrawalsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  private readonly select = sql`
    SELECT w.id, w.company_id, w.user_id, u.full_name AS user_name, u.phone AS user_phone, w.amount::text, w.tax_amount::text, w.fee_amount::text, w.net_amount::text, w.bank_name,
      w.account_number, w.account_holder, w.status, w.reject_reason, w.bank_transaction_no, w.paid_on::text, w.created_at, w.decided_at, w.version,
      (SELECT count(*) FROM marketplace.withdrawals o WHERE o.user_id = w.user_id AND o.status IN ${counted}
        AND ${vietnamMonth(sql`o.created_at`)} = ${vietnamMonth(sql`w.created_at`)} AND (o.created_at, o.id) <= (w.created_at, w.id))::int AS sequence
    FROM marketplace.withdrawals w JOIN core.users u ON u.id = w.user_id`;

  private async item(executor: Executor, row: WithdrawalRow): Promise<WithdrawalItem> {
    let tax = row.tax_amount;
    let fee = row.fee_amount;
    let net = row.net_amount;
    if (tax === null || fee === null) {
      // Chưa duyệt: thuế, phí dự kiến theo cài đặt hiện tại.
      const projected = deductions(await commissionSettings(executor, row.company_id), Number(row.amount), Math.max(row.sequence, 1), await this.approvedThisMonth(executor, row.user_id));
      tax = String(projected.tax);
      fee = String(projected.fee);
      net = String(Number(row.amount) - projected.tax - projected.fee);
    }
    return {
      id: row.id,
      userName: row.user_name,
      userPhone: localPhone(row.user_phone ?? ""),
      amount: trimDecimal(row.amount),
      taxAmount: trimDecimal(tax),
      feeAmount: trimDecimal(fee),
      netAmount: trimDecimal(net!),
      bankAccount: { bankName: row.bank_name, accountNumber: row.account_number, accountHolder: row.account_holder },
      status: row.status,
      rejectReason: row.reject_reason,
      bankTransactionNo: row.bank_transaction_no,
      paidOn: row.paid_on,
      createdAt: iso(row.created_at)!,
      decidedAt: iso(row.decided_at),
      version: row.version,
    };
  }

  private async operatorCompanyOrNull(executor: Executor): Promise<string | null> {
    return (await executor.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator AND status = 'active'`)).rows[0]?.id ?? null;
  }

  private async operatorCompany(executor: Executor): Promise<string> {
    const id = await this.operatorCompanyOrNull(executor);
    if (!id) throw new ApiError("BUSINESS_RULE", "storeNotReady");
    return id;
  }

  // Số yêu cầu đã gửi trong tháng này (giờ Việt Nam), không tính bị từ chối, đã rút lại.
  private async countThisMonth(executor: Executor, userId: string): Promise<number> {
    return (
      await executor.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM marketplace.withdrawals WHERE user_id = ${userId} AND status IN ${counted} AND ${vietnamMonth(sql`created_at`)} = ${vietnamMonth(sql`now()`)}`)
    ).rows[0]!.total;
  }

  // Tổng số tiền các yêu cầu đã duyệt (kể cả đã chi) trong tháng hiện tại theo ngày duyệt, giờ Việt Nam (THAY_DOI_19).
  private async approvedThisMonth(executor: Executor, userId: string): Promise<number> {
    const row = (
      await executor.execute<{ total: string }>(sql`
      SELECT coalesce(sum(amount), 0)::text AS total FROM marketplace.withdrawals
      WHERE user_id = ${userId} AND status IN ('approved', 'paid') AND ${vietnamMonth(sql`decided_at`)} = ${vietnamMonth(sql`now()`)}`)
    ).rows[0]!;
    return Number(row.total);
  }

  // Phần rút tiền trên ví: cài đặt, tài khoản nhận, yêu cầu đang chờ.
  async info(executor: Executor, userId: string): Promise<BuyerWithdrawalInfo> {
    // Chưa có công ty vận hành sàn thì vẫn xem được ví, phần rút tiền theo cài đặt mặc định.
    const companyId = await this.operatorCompanyOrNull(executor);
    const settings = await commissionSettings(executor, companyId ?? "00000000-0000-0000-0000-000000000000");
    const bank = (
      await executor.execute<{ bank_name: string; account_number: string; account_holder: string }>(
        sql`SELECT bank_name, account_number, account_holder FROM marketplace.buyer_bank_accounts WHERE buyer_user_id = ${userId}`,
      )
    ).rows[0];
    const open = (await executor.execute<WithdrawalRow>(sql`${this.select} WHERE w.user_id = ${userId} AND w.status IN ('pending', 'approved')`)).rows[0];
    return {
      minimumWithdrawal: settings.minimumWithdrawal,
      taxThreshold: settings.taxThreshold,
      taxRate: settings.taxRate,
      withdrawalFees: settings.withdrawalFees,
      withdrawalsThisMonth: await this.countThisMonth(executor, userId),
      approvedThisMonth: String(await this.approvedThisMonth(executor, userId)),
      bankAccount: bank ? { bankName: bank.bank_name, accountNumber: bank.account_number, accountHolder: bank.account_holder } : null,
      open: open ? await this.item(executor, open) : null,
    };
  }

  // Đổi số dư ví có khóa dòng, ghi giao dịch ví (QUYTAC_NGHIEPVU_203, 204).
  private async move(executor: Executor, input: { userId: string; withdrawalId: string; amount: number; kind: "withdrawal" | "withdrawal_reversal"; note: string | null }): Promise<void> {
    const wallet = (
      await executor.execute<{ balance: string }>(sql`
      UPDATE marketplace.wallets SET balance = balance + ${input.amount}::numeric, updated_at = now() WHERE user_id = ${input.userId} RETURNING balance::text`)
    ).rows[0]!;
    await executor.execute(sql`
      INSERT INTO marketplace.wallet_transactions (user_id, kind, amount, balance_after, withdrawal_id, note)
      VALUES (${input.userId}, ${input.kind}, ${input.amount}::numeric, ${wallet.balance}::numeric, ${input.withdrawalId}, ${input.note})`);
  }

  // Người dùng tạo yêu cầu: từ mức tối thiểu đến số dư, có tài khoản ngân hàng đã lưu, một yêu cầu đang chờ; trừ số dư ngay.
  async create(userId: string, amount: number): Promise<WithdrawalItem> {
    const id = await this.database.transaction(async (transaction) => {
      const companyId = await this.operatorCompany(transaction);
      const settings = await commissionSettings(transaction, companyId);
      const wallet = (await transaction.execute<{ balance: string }>(sql`SELECT balance::text FROM marketplace.wallets WHERE user_id = ${userId} FOR UPDATE`)).rows[0];
      const open = await transaction.execute(sql`SELECT 1 FROM marketplace.withdrawals WHERE user_id = ${userId} AND status IN ('pending', 'approved')`);
      if (open.rows.length > 0) throw new ApiError("BUSINESS_RULE", "withdrawalAlreadyOpen");
      if (amount < Number(settings.minimumWithdrawal)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { amount: "withdrawalBelowMinimum" } });
      if (!wallet || amount > Number(wallet.balance)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { amount: "withdrawalOverBalance" } });
      const bank = (
        await transaction.execute<{ bank_name: string; account_number: string; account_holder: string }>(
          sql`SELECT bank_name, account_number, account_holder FROM marketplace.buyer_bank_accounts WHERE buyer_user_id = ${userId}`,
        )
      ).rows[0];
      if (!bank) throw new ApiError("BUSINESS_RULE", "withdrawalNeedsBankAccount");
      // Thuế, phí dự kiến không được hết số tiền rút (QUYTAC_NGHIEPVU_208).
      const projected = deductions(settings, amount, (await this.countThisMonth(transaction, userId)) + 1, await this.approvedThisMonth(transaction, userId));
      if (amount - projected.tax - projected.fee <= 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { amount: "withdrawalFeeOverAmount" } });
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO marketplace.withdrawals (company_id, user_id, amount, bank_name, account_number, account_holder)
        VALUES (${companyId}, ${userId}, ${amount}, ${bank.bank_name}, ${bank.account_number}, ${bank.account_holder}) RETURNING id`)
      ).rows[0]!;
      await this.move(transaction, { userId, withdrawalId: created.id, amount: -amount, kind: "withdrawal", note: null });
      return created.id;
    });
    return this.one(this.database, id);
  }

  // Người dùng rút lại yêu cầu chưa duyệt: cộng lại số dư.
  async cancel(userId: string, withdrawalId: string, version: number): Promise<WithdrawalItem> {
    await this.database.transaction(async (transaction) => {
      const row = await this.lock(transaction, withdrawalId);
      if (!row || row.user_id !== userId) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "pending") throw new ApiError("BUSINESS_RULE", "withdrawalNotPending");
      await transaction.execute(sql`SELECT 1 FROM marketplace.wallets WHERE user_id = ${userId} FOR UPDATE`);
      await transaction.execute(sql`UPDATE marketplace.withdrawals SET status = 'cancelled', version = version + 1 WHERE id = ${withdrawalId}`);
      await this.move(transaction, { userId, withdrawalId, amount: Number(row.amount), kind: "withdrawal_reversal", note: null });
    });
    return this.one(this.database, withdrawalId);
  }

  // MAN_HINH_102: danh sách theo trạng thái của công ty vận hành sàn.
  async list(actor: BuyerAdminActor, query: { status: WithdrawalStatus; page: number; pageSize: number }): Promise<PageResponse<WithdrawalItem>> {
    const where = sql`w.company_id = ${actor.operatorCompanyId} AND w.status = ${query.status}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM marketplace.withdrawals w WHERE ${where}`)).rows[0]!.total;
    const order = ["pending", "approved"].includes(query.status) ? sql`w.created_at, w.id` : sql`coalesce(w.paid_at, w.decided_at, w.created_at) DESC, w.id`;
    const rows = await this.database.execute<WithdrawalRow>(sql`${this.select} WHERE ${where} ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const data: WithdrawalItem[] = [];
    for (const row of rows.rows) data.push(await this.item(this.database, row));
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  // Duyệt: chốt thuế, số thực nhận theo cài đặt lúc duyệt (QUYTAC_NGHIEPVU_205, 206).
  async approve(actor: BuyerAdminActor, withdrawalId: string, version: number): Promise<WithdrawalItem> {
    await this.database.transaction(async (transaction) => {
      const row = await this.adminLock(transaction, actor, withdrawalId, version, "pending");
      const settings = await commissionSettings(transaction, actor.operatorCompanyId);
      const amount = Number(row.amount);
      // Chốt thuế, phí theo cài đặt lúc duyệt và thứ tự lần rút trong tháng (QUYTAC_NGHIEPVU_205, 208).
      const { tax, fee } = deductions(settings, amount, row.sequence, await this.approvedThisMonth(transaction, row.user_id));
      const net = amount - tax - fee;
      if (net <= 0) throw new ApiError("BUSINESS_RULE", "withdrawalFeeOverAmount");
      await transaction.execute(sql`
        UPDATE marketplace.withdrawals SET status = 'approved', tax_amount = ${tax}, fee_amount = ${fee}, net_amount = ${net}, decided_by = ${actor.userId}, decided_at = now(),
          version = version + 1 WHERE id = ${withdrawalId}`);
      await this.finish(transaction, actor, row, "approve", { taxAmount: String(tax), feeAmount: String(fee), netAmount: String(net) }, "Yêu cầu rút tiền hoa hồng đã được duyệt");
    });
    return this.one(this.database, withdrawalId);
  }

  // Từ chối có lý do: cộng lại số dư.
  async reject(actor: BuyerAdminActor, withdrawalId: string, input: { reason: string; version: number }): Promise<WithdrawalItem> {
    await this.database.transaction(async (transaction) => {
      const row = await this.adminLock(transaction, actor, withdrawalId, input.version, "pending");
      await transaction.execute(sql`SELECT 1 FROM marketplace.wallets WHERE user_id = ${row.user_id} FOR UPDATE`);
      await transaction.execute(sql`
        UPDATE marketplace.withdrawals SET status = 'rejected', reject_reason = ${input.reason}, decided_by = ${actor.userId}, decided_at = now(), version = version + 1 WHERE id = ${withdrawalId}`);
      await this.move(transaction, { userId: row.user_id, withdrawalId, amount: Number(row.amount), kind: "withdrawal_reversal", note: input.reason });
      await this.finish(transaction, actor, row, "reject", { reason: input.reason }, "Yêu cầu rút tiền hoa hồng bị từ chối, số tiền đã trả lại ví");
    });
    return this.one(this.database, withdrawalId);
  }

  // Sau khi chuyển khoản số thực nhận: ghi đã chi kèm mã giao dịch ngân hàng, ngày chi.
  async pay(actor: BuyerAdminActor, withdrawalId: string, input: { bankTransactionNo: string; paidOn: string; version: number }): Promise<WithdrawalItem> {
    await this.database.transaction(async (transaction) => {
      const row = await this.adminLock(transaction, actor, withdrawalId, input.version, "approved");
      // Ngày chi từ ngày duyệt đến hôm nay (giờ Việt Nam): không ghi lùi về kỳ trước khi duyệt.
      if (input.paidOn > (await vietnamToday(transaction)) || (row.decided_at && input.paidOn < vietnamDate(row.decided_at))) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { paidOn: "invalidValue" } });
      }
      await transaction.execute(sql`
        UPDATE marketplace.withdrawals SET status = 'paid', bank_transaction_no = ${input.bankTransactionNo}, paid_on = ${input.paidOn}::date, paid_by = ${actor.userId}, paid_at = now(),
          version = version + 1 WHERE id = ${withdrawalId}`);
      await this.ledger.record(transaction, await marketplaceWithdrawalDraft(transaction, withdrawalId));
      await this.finish(transaction, actor, row, "pay", input, "VComm đã chuyển tiền hoa hồng vào tài khoản của bạn");
    });
    return this.one(this.database, withdrawalId);
  }

  // Bảng kê thuế thu nhập cá nhân đã khấu trừ theo tháng chi (QUYTAC_NGHIEPVU_205).
  async taxReport(actor: BuyerAdminActor, month: string): Promise<WithdrawalTaxReport> {
    const rows = await this.database.execute<WithdrawalRow>(sql`
      ${this.select} WHERE w.company_id = ${actor.operatorCompanyId} AND w.status = 'paid' AND w.tax_amount > 0 AND to_char(w.paid_on, 'YYYY-MM') = ${month}
      ORDER BY w.paid_on, u.full_name, w.id`);
    let totalAmount = 0;
    let totalTax = 0;
    for (const row of rows.rows) {
      totalAmount += Number(row.amount);
      totalTax += Number(row.tax_amount);
    }
    return {
      month,
      rows: rows.rows.map((row) => ({
        userName: row.user_name,
        userPhone: localPhone(row.user_phone ?? ""),
        amount: trimDecimal(row.amount),
        taxAmount: trimDecimal(row.tax_amount!),
        feeAmount: trimDecimal(row.fee_amount!),
        netAmount: trimDecimal(row.net_amount!),
        paidOn: row.paid_on!,
        bankTransactionNo: row.bank_transaction_no!,
      })),
      totalAmount: String(totalAmount),
      totalTax: String(totalTax),
    };
  }

  private async one(executor: Executor, withdrawalId: string): Promise<WithdrawalItem> {
    return this.item(executor, (await executor.execute<WithdrawalRow>(sql`${this.select} WHERE w.id = ${withdrawalId}`)).rows[0]!);
  }

  private async lock(executor: Executor, withdrawalId: string): Promise<WithdrawalRow | undefined> {
    return (await executor.execute<WithdrawalRow>(sql`${this.select} WHERE w.id = ${withdrawalId} FOR UPDATE OF w`)).rows[0];
  }

  private async adminLock(executor: Executor, actor: BuyerAdminActor, withdrawalId: string, version: number, status: WithdrawalStatus): Promise<WithdrawalRow> {
    const row = await this.lock(executor, withdrawalId);
    if (!row || row.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
    // Người duyệt không tự xử lý yêu cầu của chính mình.
    if (row.user_id === actor.userId) throw new ApiError("BUSINESS_RULE", "withdrawalSelfDecision");
    if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (row.status !== status) throw new ApiError("BUSINESS_RULE", status === "pending" ? "withdrawalNotPending" : "withdrawalNotApproved");
    return row;
  }

  private async finish(executor: Transaction, actor: BuyerAdminActor, row: WithdrawalRow, action: string, afterData: Record<string, unknown>, title: string): Promise<void> {
    await notify(executor, [{ userId: row.user_id, companyId: actor.operatorCompanyId, kind: `marketplace_withdrawal.${action}`, title, payload: { withdrawalId: row.id } }]);
    await this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "marketplace",
        action: `marketplace.withdrawal.${action}`,
        entityType: "marketplace.withdrawals",
        entityId: row.id,
        beforeData: { status: row.status },
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }
}
