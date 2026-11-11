// Ghi nhận tiền chuyển khoản đơn VComm (CONG_VIEC_36; CHUC_NANG_150; QUYTAC_NGHIEPVU_241 đến 243): tự ghép giao dịch ngân hàng, kế toán xác nhận tay.
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { accountDigits } from "../../bank/bank-webhook";
import { BankReconciliationService, type IncomingBankTransaction } from "../../bank/bank-reconciliation.service";
import { ApiError } from "../../common/api-error";
import { AuditService } from "../../common/audit.service";
import { DATABASE, type Database } from "../../database/database.module";
import type { BuyerAdminActor } from "../buyer-admin.service";
import { bankTransferConfiguration, contentHasReference } from "./gateways/bank-transfer-gateway";
import { MarketplacePaymentsService } from "./payments.service";

const gatewayCode = "bank_transfer";
type Executor = Pick<Database, "execute">;

@Injectable()
export class BankTransferService implements OnModuleInit {
  private readonly logger = new Logger("BankTransfer");
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly payments: MarketplacePaymentsService,
    private readonly bank: BankReconciliationService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.bank.incomingHooks.push((executor, incoming) => this.matchIncoming(executor, incoming));
  }

  // QUYTAC_NGHIEPVU_241: tiền vào quỹ có số tài khoản nhận chuyển khoản của VComm, thuộc công ty vận hành sàn, nội dung chứa đúng số tham chiếu,
  // đúng số tiền của một lần thanh toán đang chờ. Không ra đúng một lần thanh toán thì để kế toán xử lý.
  async matchIncoming(executor: Executor, incoming: IncomingBankTransaction): Promise<string | null> {
    const configuration = bankTransferConfiguration();
    if (!configuration || accountDigits(incoming.fundAccountNo) !== accountDigits(configuration.accountNumber)) return null;
    const content = incoming.content.toUpperCase();
    const candidates = (
      await executor.execute<{ id: string; reference: string; amount: string }>(sql`
      SELECT p.id, p.reference, p.amount::text FROM marketplace.payments p JOIN marketplace.orders m ON m.id = p.order_id
      WHERE p.gateway_code = ${gatewayCode} AND p.status = 'pending' AND m.company_id = ${incoming.companyId} AND p.amount = ${incoming.amount}::numeric
        AND position(upper(p.reference) IN ${content}::text) > 0`)
    ).rows.filter((row) => contentHasReference(content, row.reference));
    if (candidates.length !== 1) return null;
    const payment = candidates[0]!;
    // Lỗi khi ghi nhận (kỳ kế toán đã khóa): vẫn lưu giao dịch ngân hàng, để chưa ghép cho kế toán xử lý.
    await executor.execute(sql`SAVEPOINT bank_transfer_match`);
    try {
      const outcome = await this.payments.record(executor, gatewayCode, {
        reference: payment.reference,
        amount: Number(payment.amount),
        success: true,
        responseCode: "bank_statement",
        transactionNo: incoming.transactionNo.slice(0, 100),
        bankCode: null,
      });
      await executor.execute(sql`RELEASE SAVEPOINT bank_transfer_match`);
      return outcome === "success" ? payment.id : null;
    } catch (error) {
      await executor.execute(sql`ROLLBACK TO SAVEPOINT bank_transfer_match`);
      this.logger.error(`Ghi nhận chuyển khoản ${payment.reference}: ${(error as Error).message}`);
      return null;
    }
  }

  // QUYTAC_NGHIEPVU_242: kế toán xác nhận tay lần thanh toán đang chờ khi không tự ghép được; số tiền là số tiền của lần thanh toán.
  async confirmManually(actor: BuyerAdminActor, orderId: string, input: { reference: string; bankTransactionNo: string }): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const payment = (
        await transaction.execute<{ amount: string; company_id: string }>(sql`
        SELECT p.amount::text, m.company_id FROM marketplace.payments p JOIN marketplace.orders m ON m.id = p.order_id
        WHERE p.order_id = ${orderId} AND p.reference = ${input.reference} AND p.gateway_code = ${gatewayCode}`)
      ).rows[0];
      if (!payment || payment.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
      const outcome = await this.payments.record(transaction, gatewayCode, {
        reference: input.reference,
        amount: Number(payment.amount),
        success: true,
        responseCode: "manual",
        transactionNo: input.bankTransactionNo,
        bankCode: null,
      });
      if (outcome !== "success") throw new ApiError("BUSINESS_RULE", "bankTransferNotPending");
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "marketplace",
          action: "marketplace.payment.transfer_confirmed",
          entityType: "marketplace.orders",
          entityId: orderId,
          beforeData: null,
          afterData: input,
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
  }
}
