// Hoàn tiền đơn VComm (CONG_VIEC_25; CHUC_NANG_122; QUYTAC_NGHIEPVU_168; API_133): tài khoản nhận hoàn tiền của người mua, việc chờ hoàn, kế toán ghi đã hoàn.
import { Inject, Injectable } from "@nestjs/common";
import type { BuyerBankAccount, PageResponse, RefundItem, RefundReason, RefundStatus } from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../../catalog/catalog-context";
import { LedgerService } from "../../accounting/ledger.service";
import { marketplaceRefundDraft } from "../../accounting/postings";
import { ApiError } from "../../common/api-error";
import { AuditService } from "../../common/audit.service";
import { notify } from "../../common/notifications";
import { DATABASE, type Database } from "../../database/database.module";
import { localPhone } from "../buyer-accounts.service";
import type { BuyerAdminActor } from "../buyer-admin.service";
import { MarketplaceOrdersService } from "../marketplace-orders.service";
import { vietnamToday } from "../shop.service";

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

type RefundRow = {
  id: string;
  order_id: string;
  document_no: string;
  buyer_name: string;
  buyer_phone: string | null;
  reason: RefundReason;
  amount: string;
  status: RefundStatus;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  bank_transaction_no: string | null;
  refunded_on: string | null;
  note: string | null;
  created_at: Date;
  completed_at: Date | null;
  version: number;
};

@Injectable()
export class RefundsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly orders: MarketplaceOrdersService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
  ) {}

  async bankAccount(userId: string): Promise<BuyerBankAccount | null> {
    const row = (
      await this.database.execute<{ bank_name: string; account_number: string; account_holder: string }>(
        sql`SELECT bank_name, account_number, account_holder FROM marketplace.buyer_bank_accounts WHERE buyer_user_id = ${userId}`,
      )
    ).rows[0];
    return row ? { bankName: row.bank_name, accountNumber: row.account_number, accountHolder: row.account_holder } : null;
  }

  async saveBankAccount(userId: string, input: BuyerBankAccount): Promise<BuyerBankAccount> {
    await this.database.execute(sql`
      INSERT INTO marketplace.buyer_bank_accounts (buyer_user_id, bank_name, account_number, account_holder) VALUES (${userId}, ${input.bankName}, ${input.accountNumber}, ${input.accountHolder})
      ON CONFLICT (buyer_user_id) DO UPDATE SET bank_name = excluded.bank_name, account_number = excluded.account_number, account_holder = excluded.account_holder, updated_at = now()`);
    return (await this.bankAccount(userId))!;
  }

  private readonly select = sql`
    SELECT f.id, f.order_id, so.document_no, u.full_name AS buyer_name, u.phone AS buyer_phone, f.reason, f.amount::text, f.status, b.bank_name, b.account_number, b.account_holder,
      f.bank_transaction_no, f.refunded_on::text, f.note, f.created_at, f.completed_at, f.version
    FROM marketplace.refunds f JOIN marketplace.orders m ON m.id = f.order_id JOIN sales.orders so ON so.id = m.sales_order_id JOIN core.users u ON u.id = m.buyer_user_id
    LEFT JOIN marketplace.buyer_bank_accounts b ON b.buyer_user_id = m.buyer_user_id`;

  private item(row: RefundRow): RefundItem {
    return {
      id: row.id,
      orderId: row.order_id,
      documentNo: row.document_no,
      buyerName: row.buyer_name,
      buyerPhone: localPhone(row.buyer_phone ?? ""),
      reason: row.reason,
      amount: trimDecimal(row.amount),
      status: row.status,
      bankAccount: row.bank_name ? { bankName: row.bank_name, accountNumber: row.account_number!, accountHolder: row.account_holder! } : null,
      bankTransactionNo: row.bank_transaction_no,
      refundedOn: row.refunded_on,
      note: row.note,
      createdAt: iso(row.created_at)!,
      completedAt: iso(row.completed_at),
      version: row.version,
    };
  }

  // MAN_HINH_98: việc chờ hoàn, việc đã hoàn của công ty vận hành sàn.
  async list(actor: BuyerAdminActor, query: { status: RefundStatus; page: number; pageSize: number }): Promise<PageResponse<RefundItem>> {
    const where = sql`m.company_id = ${actor.operatorCompanyId} AND f.status = ${query.status}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM marketplace.refunds f JOIN marketplace.orders m ON m.id = f.order_id WHERE ${where}`)).rows[0]!
      .total;
    const order = query.status === "pending" ? sql`f.created_at, f.id` : sql`f.completed_at DESC, f.id`;
    const rows = await this.database.execute<RefundRow>(sql`${this.select} WHERE ${where} ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.item(row)), page: query.page, pageSize: query.pageSize, total };
  }

  // Kế toán chuyển khoản rồi ghi đã hoàn kèm mã giao dịch ngân hàng, ngày (QUYTAC_NGHIEPVU_168).
  async complete(actor: BuyerAdminActor, refundId: string, input: { bankTransactionNo: string; refundedOn: string; note: string | null; version: number }): Promise<RefundItem> {
    await this.database.transaction(async (transaction) => {
      const refund = (
        await transaction.execute<{ order_id: string; status: RefundStatus; version: number; amount: string; company_id: string; buyer_user_id: string }>(sql`
        SELECT f.order_id, f.status, f.version, f.amount::text, m.company_id, m.buyer_user_id FROM marketplace.refunds f JOIN marketplace.orders m ON m.id = f.order_id
        WHERE f.id = ${refundId} FOR UPDATE OF f`)
      ).rows[0];
      if (!refund || refund.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
      if (refund.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (refund.status !== "pending") throw new ApiError("BUSINESS_RULE", "refundNotPending");
      if (input.refundedOn > (await vietnamToday(transaction))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { refundedOn: "invalidValue" } });
      await transaction.execute(sql`SELECT 1 FROM marketplace.orders WHERE id = ${refund.order_id} FOR UPDATE`);
      await transaction.execute(sql`
        UPDATE marketplace.refunds SET status = 'completed', bank_transaction_no = ${input.bankTransactionNo}, refunded_on = ${input.refundedOn}::date, note = ${input.note},
          completed_by = ${actor.userId}, completed_at = now(), version = version + 1 WHERE id = ${refundId}`);
      await transaction.execute(sql`UPDATE marketplace.orders SET refunded_amount = refunded_amount + ${refund.amount}::numeric, version = version + 1 WHERE id = ${refund.order_id}`);
      await this.ledger.record(transaction, await marketplaceRefundDraft(transaction, refundId));
      await this.orders.event(transaction, refund.order_id, "refunded", trimDecimal(refund.amount), actor.userId);
      await notify(transaction, [
        {
          userId: refund.buyer_user_id,
          companyId: actor.operatorCompanyId,
          kind: "marketplace_refund.completed",
          title: "VComm đã hoàn tiền cho đơn hàng của bạn",
          payload: { orderId: refund.order_id, refundId },
        },
      ]);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "marketplace",
          action: "marketplace.refund.complete",
          entityType: "marketplace.refunds",
          entityId: refundId,
          beforeData: null,
          afterData: input,
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    const row = (await this.database.execute<RefundRow>(sql`${this.select} WHERE f.id = ${refundId}`)).rows[0]!;
    return this.item(row);
  }
}
