// Đối soát ngân hàng (CONG_VIEC_18; CHUC_NANG_84 đến 87; QUYTAC_NGHIEPVU_113 đến 117; API_95 đến API_101).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { savePaymentSchema } from "contracts";
import type {
  BankConnectionItem,
  BankPaymentCandidate,
  BankReconciliationResponse,
  bankReconciliationQuerySchema,
  BankConnectionsResponse,
  BankTransactionItem,
  BankTransactionsResponse,
  bankTransactionListQuerySchema,
  saveBankConnectionSchema,
  SaveBankConnectionResponse,
  simulateBankTransactionSchema,
} from "contracts";
import { randomBytes, randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { decryptSecret, encryptSecret } from "../common/secret-box";
import { DATABASE, type Database } from "../database/database.module";
import { simulatorAllowed } from "../einvoice/einvoice-settings.service";
import { signedPaymentAmount } from "../finance/funds.service";
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { PaymentsService } from "../finance/payments.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency } from "../purchasing/requisitions.service";
import { accountDigits, authorized, parseWebhook, type ParsedTransaction } from "./bank-webhook";

export const bankPermissions = { view: "finance.bank.view", manage: "finance.bank.manage", setup: "finance.bank.setup" } as const;
type Executor = Pick<Database, "execute">;

// Chiều tiền và loại phiếu tương ứng (QUYTAC_NGHIEPVU_115).
const kindsOf = { in: sql`('customer_receipt', 'supplier_refund')`, out: sql`('supplier_payment', 'customer_refund')` } as const;
// Ngày phiếu cách ngày giao dịch tối đa 3 ngày (quyết định của người dùng ngày 2026-11-10).
const matchDays = 3;

type ConnectionRow = {
  id: string;
  company_id: string;
  fund_id: string;
  provider: "simulator" | "sepay";
  enabled: boolean;
  secret_value: Buffer;
  secret_hint: string;
  account_no: string | null;
  last_received_at: string | null;
  version: number;
};

@Injectable()
export class BankReconciliationService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    // Phiếu ghi sổ sau giao dịch: thử ghép lại.
    this.payments.postedHooks.push((transaction, paymentId) => this.matchPayment(transaction, paymentId));
  }

  // ---------- Kết nối (CHUC_NANG_84) ----------

  private toItem(
    row: { fund_id: string; code: string; name: string; bank_name: string | null; account_no: string | null } & Partial<ConnectionRow> & { connection_id: string | null },
  ): BankConnectionItem {
    return {
      fundId: row.fund_id,
      fundCode: row.code,
      fundName: row.name,
      bankName: row.bank_name,
      accountNo: row.account_no,
      connection: row.connection_id
        ? {
            id: row.connection_id,
            provider: row.provider!,
            enabled: row.enabled!,
            secretHint: row.secret_hint!,
            webhookPath: `/api/v1/public/bank-webhooks/${row.connection_id}`,
            lastReceivedAt: row.last_received_at ? new Date(row.last_received_at).toISOString() : null,
            version: row.version!,
          }
        : null,
    };
  }

  private async fundRows(executor: Executor, companyId: string, fundId?: string) {
    return (
      await executor.execute<
        { fund_id: string; code: string; name: string; fund_status: string; bank_name: string | null; account_no: string | null; connection_id: string | null } & Partial<ConnectionRow>
      >(sql`
      SELECT f.id AS fund_id, f.code, f.name, f.status AS fund_status, f.bank_name, f.account_no, c.id AS connection_id, c.provider, c.enabled, c.secret_hint, c.last_received_at::text, c.version
      FROM finance.funds f LEFT JOIN finance.bank_connections c ON c.fund_id = f.id
      WHERE f.company_id = ${companyId} AND f.kind = 'bank' ${fundId ? sql`AND f.id = ${fundId}` : sql`AND (f.status = 'active' OR c.id IS NOT NULL)`}
      ORDER BY f.code`)
    ).rows;
  }

  async connections(actor: Actor): Promise<BankConnectionsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, bankPermissions.view, bankPermissions.setup);
    const rows = await this.fundRows(this.database, actor.companyId);
    return { funds: rows.map((row) => this.toItem(row)), canSetup: granted.has(bankPermissions.setup), simulatorAllowed: simulatorAllowed() };
  }

  async saveConnection(actor: Actor, fundId: string, input: z.output<typeof saveBankConnectionSchema>): Promise<SaveBankConnectionResponse> {
    await requireFinancePermission(this.permissionService, actor, bankPermissions.setup);
    if (input.provider === "simulator" && !simulatorAllowed()) throw new ApiError("BUSINESS_RULE", "bankSimulatorNotAllowed");
    let secret: string | null = null;
    const item = await this.database.transaction(async (transaction) => {
      const fund = (await this.fundRows(transaction, actor.companyId, fundId))[0];
      if (!fund) throw new ApiError("NOT_FOUND", "notFound");
      if (fund.connection_id === null) {
        if (fund.fund_status !== "active") throw new ApiError("BUSINESS_RULE", "bankFundInactive");
        if (input.version !== null) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        secret = randomBytes(24).toString("base64url");
        await transaction.execute(sql`
          INSERT INTO finance.bank_connections (company_id, fund_id, provider, secret_value, secret_hint, enabled, updated_by)
          VALUES (${actor.companyId}, ${fundId}, ${input.provider}, ${encryptSecret(secret)}, ${secret.slice(-4)}, ${input.enabled}, ${actor.userId})`);
      } else {
        if (input.rotateSecret) secret = randomBytes(24).toString("base64url");
        const updated = await transaction.execute(sql`
          UPDATE finance.bank_connections SET provider = ${input.provider}, enabled = ${input.enabled}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
            ${secret ? sql`, secret_value = ${encryptSecret(secret)}, secret_hint = ${(secret as string).slice(-4)}` : sql``}
          WHERE id = ${fund.connection_id} AND version = ${input.version ?? -1}`);
        if (updated.rowCount === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      }
      const row = (await this.fundRows(transaction, actor.companyId, fundId))[0]!;
      await this.auditService.record(
        {
          ...financeAudit(actor, "bank_connection"),
          action: fund.connection_id ? "bank_connection.update" : "bank_connection.create",
          entityId: row.connection_id!,
          beforeData: fund.connection_id ? { provider: fund.provider, enabled: fund.enabled } : null,
          afterData: { provider: input.provider, enabled: input.enabled, secretChanged: secret !== null },
        },
        transaction,
      );
      return this.toItem(row);
    });
    return { item, secret };
  }

  // Bộ giả lập: gửi giao dịch thử như dịch vụ trung gian (chỉ ngoài môi trường thật).
  async simulate(actor: Actor, fundId: string, input: z.output<typeof simulateBankTransactionSchema>): Promise<BankTransactionItem> {
    await requireFinancePermission(this.permissionService, actor, bankPermissions.setup);
    if (!simulatorAllowed()) throw new ApiError("BUSINESS_RULE", "bankSimulatorNotAllowed");
    const connection = (await this.database.execute<ConnectionRow>(sql`${this.connectionSelect()} WHERE c.fund_id = ${fundId} AND c.company_id = ${actor.companyId}`)).rows[0];
    if (!connection || connection.provider !== "simulator") throw new ApiError("BUSINESS_RULE", "bankSimulatorNotConnected");
    const now = this.clock.now();
    const transactionAt = input.transactionDate ? new Date(`${input.transactionDate}T${new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(11, 19)}+07:00`) : now;
    const parsed: ParsedTransaction = {
      externalId: `SIM-${randomUUID()}`,
      transactionAt,
      direction: input.direction,
      amount: input.amount,
      content: input.content,
      referenceCode: `SIM${now.getTime()}`,
      balanceAfter: null,
      accountNumber: null,
    };
    const id = await this.store(connection, parsed, parsed);
    return (await this.items(sql`b.id = ${id}`, 1, 0))[0]!;
  }

  // ---------- Webhook (CHUC_NANG_85) ----------

  private connectionSelect(): SQL {
    return sql`
      SELECT c.id, c.company_id, c.fund_id, c.provider, c.enabled, c.secret_value, c.secret_hint, f.account_no, c.last_received_at::text, c.version
      FROM finance.bank_connections c JOIN finance.funds f ON f.id = c.fund_id`;
  }

  async receive(connectionId: string, authorization: string | undefined, body: unknown): Promise<{ success: true }> {
    const connection = (await this.database.execute<ConnectionRow>(sql`${this.connectionSelect()} WHERE c.id = ${connectionId}`)).rows[0];
    if (!connection || !connection.enabled || !authorized(authorization, decryptSecret(connection.secret_value))) throw new ApiError("UNAUTHENTICATED", "bankWebhookUnauthorized");
    const parsed = parseWebhook(body);
    if (!parsed) throw new ApiError("VALIDATION_FAILED", "bankWebhookInvalid");
    const fundAccount = accountDigits(connection.account_no);
    if (parsed.accountNumber && fundAccount && accountDigits(parsed.accountNumber) !== fundAccount) throw new ApiError("BUSINESS_RULE", "bankAccountMismatch");
    await this.store(connection, parsed, body);
    return { success: true };
  }

  // Lưu giao dịch (trùng mã thì bỏ qua) rồi thử tự ghép.
  // Lưu nội dung webhook gốc để đối chiếu khi có khiếu nại.
  private async store(connection: ConnectionRow, parsed: ParsedTransaction, raw: unknown): Promise<string> {
    return this.database.transaction(async (transaction) => {
      await this.lockFund(transaction, connection.fund_id);
      const inserted = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.bank_transactions (company_id, connection_id, fund_id, external_id, transaction_at, transaction_date, direction, amount, content, reference_code, balance_after, raw_payload)
        VALUES (${connection.company_id}, ${connection.id}, ${connection.fund_id}, ${parsed.externalId}, ${parsed.transactionAt.toISOString()}::timestamptz, ${vietnamDate(parsed.transactionAt)}::date,
          ${parsed.direction}, ${parsed.amount}::numeric, ${parsed.content}, ${parsed.referenceCode}, ${parsed.balanceAfter}::numeric, ${JSON.stringify(raw).replaceAll("\\u0000", "")}::jsonb)
        ON CONFLICT (connection_id, external_id) DO NOTHING RETURNING id`)
      ).rows[0];
      await transaction.execute(sql`UPDATE finance.bank_connections SET last_received_at = now() WHERE id = ${connection.id}`);
      if (inserted) {
        await this.matchTransaction(transaction, inserted.id);
        if (parsed.direction === "in") await this.suggest(transaction, inserted.id, connection.company_id, parsed.content);
        return inserted.id;
      }
      return (await transaction.execute<{ id: string }>(sql`SELECT id FROM finance.bank_transactions WHERE connection_id = ${connection.id} AND external_id = ${parsed.externalId}`)).rows[0]!.id;
    });
  }

  // ---------- Tự ghép (QUYTAC_NGHIEPVU_115) ----------

  // Khóa dòng quỹ: cùng thứ tự với ghi sổ phiếu (khóa quỹ trước, giao dịch ngân hàng sau) để tránh khóa chết.
  private async lockFund(executor: Executor, fundId: string): Promise<void> {
    await executor.execute(sql`SELECT id FROM finance.funds WHERE id = ${fundId} FOR UPDATE`);
  }

  private paymentCandidates(transactionId: SQL | string): SQL {
    return sql`
      SELECT p.id FROM finance.payments p JOIN finance.bank_transactions b ON b.id = ${transactionId}
      WHERE p.fund_id = b.fund_id AND p.status = 'posted' AND p.amount = b.amount AND abs(p.payment_date - b.transaction_date) <= ${matchDays}
        AND ((b.direction = 'in' AND p.kind IN ${kindsOf.in}) OR (b.direction = 'out' AND p.kind IN ${kindsOf.out}))
        AND NOT EXISTS (SELECT 1 FROM finance.bank_transactions other WHERE other.payment_id = p.id)`;
  }

  private transactionCandidates(paymentId: SQL | string): SQL {
    return sql`
      SELECT b.id FROM finance.bank_transactions b JOIN finance.payments p ON p.id = ${paymentId}
      WHERE b.fund_id = p.fund_id AND b.status = 'unmatched' AND b.amount = p.amount AND abs(p.payment_date - b.transaction_date) <= ${matchDays}
        AND ((b.direction = 'in' AND p.kind IN ${kindsOf.in}) OR (b.direction = 'out' AND p.kind IN ${kindsOf.out}))`;
  }

  private async setMatched(executor: Executor, transactionId: string, paymentId: string, userId: string | null): Promise<boolean> {
    const updated = await executor.execute(sql`
      UPDATE finance.bank_transactions SET status = 'matched', payment_id = ${paymentId}, matched_by = ${userId}, matched_at = now(), receipt_id = NULL, version = version + 1
      WHERE id = ${transactionId} AND status = 'unmatched'`);
    return (updated.rowCount ?? 0) > 0;
  }

  // Ghép khi giao dịch có đúng một phiếu và phiếu đó cũng chỉ hợp với giao dịch này.
  async matchTransaction(executor: Executor, transactionId: string): Promise<void> {
    const payments = (await executor.execute<{ id: string }>(sql`${this.paymentCandidates(transactionId)} LIMIT 2`)).rows;
    if (payments.length !== 1) return;
    const transactions = (await executor.execute<{ id: string }>(sql`${this.transactionCandidates(payments[0]!.id)} LIMIT 2`)).rows;
    if (transactions.length === 1 && transactions[0]!.id === transactionId) await this.setMatched(executor, transactionId, payments[0]!.id, null);
  }

  async matchPayment(executor: Executor, paymentId: string): Promise<void> {
    const fund = (await executor.execute<{ fund_id: string }>(sql`SELECT p.fund_id FROM finance.payments p JOIN finance.bank_connections c ON c.fund_id = p.fund_id WHERE p.id = ${paymentId}`))
      .rows[0];
    if (!fund) return;
    await this.lockFund(executor, fund.fund_id);
    // Phiếu thu lập từ gợi ý (QUYTAC_NGHIEPVU_116) ghép đúng giao dịch của nó khi phiếu vẫn khớp quỹ, số tiền, loại, ngày; người ghép là người lập phiếu.
    // Phiếu đã bị sửa không còn khớp thì bỏ liên kết, giao dịch xét như thường.
    const fromSuggestion = (
      await executor.execute<{ id: string; created_by: string; fits: boolean }>(sql`
      SELECT b.id, p.created_by, (p.fund_id = b.fund_id AND p.amount = b.amount AND p.kind = 'customer_receipt' AND abs(p.payment_date - b.transaction_date) <= ${matchDays}) AS fits
      FROM finance.bank_transactions b JOIN finance.payments p ON p.id = b.receipt_id WHERE b.receipt_id = ${paymentId}`)
    ).rows[0];
    if (fromSuggestion?.fits && (await this.setMatched(executor, fromSuggestion.id, paymentId, fromSuggestion.created_by))) return;
    if (fromSuggestion) await executor.execute(sql`UPDATE finance.bank_transactions SET receipt_id = NULL, version = version + 1 WHERE id = ${fromSuggestion.id}`);
    const transactions = (await executor.execute<{ id: string }>(sql`${this.transactionCandidates(paymentId)} AND b.receipt_id IS NULL LIMIT 2`)).rows;
    if (transactions.length === 1) await this.matchTransaction(executor, transactions[0]!.id);
  }

  // ---------- Danh sách (API_99) ----------

  private async items(where: SQL, limit: number, offset: number): Promise<BankTransactionItem[]> {
    const rows = (
      await this.database.execute<{
        id: string;
        fund_id: string;
        fund_name: string;
        transaction_at: Date | string;
        transaction_date: string;
        direction: "in" | "out";
        amount: string;
        content: string;
        reference_code: string | null;
        balance_after: string | null;
        status: BankTransactionItem["status"];
        payment_id: string | null;
        payment_no: string | null;
        payment_kind: BankTransactionItem["payment"] extends infer P ? (P extends { kind: infer K } ? K : never) : never;
        payment_partner: string | null;
        payment_date: string | null;
        matched_by: string | null;
        suggested_partner_id: string | null;
        suggested_partner_name: string | null;
        suggestion_reason: NonNullable<BankTransactionItem["suggestion"]>["reason"] | null;
        receipt_id: string | null;
        receipt_no: string | null;
        receipt_status: string | null;
        ignore_reason: string | null;
        version: number;
      }>(sql`
      SELECT b.id, b.fund_id, f.name AS fund_name, b.transaction_at, b.transaction_date::text, b.direction, b.amount::text, b.content, b.reference_code, b.balance_after::text,
        b.status, b.payment_id, p.document_no AS payment_no, p.kind AS payment_kind, pp.name AS payment_partner, p.payment_date::text, b.matched_by,
        b.suggested_partner_id, sp.name AS suggested_partner_name, b.suggestion_reason, b.receipt_id, r.document_no AS receipt_no, r.status AS receipt_status, b.ignore_reason, b.version
      FROM finance.bank_transactions b
      JOIN finance.funds f ON f.id = b.fund_id
      LEFT JOIN finance.payments p ON p.id = b.payment_id
      LEFT JOIN crm.partners pp ON pp.id = p.partner_id
      LEFT JOIN crm.partners sp ON sp.id = b.suggested_partner_id
      LEFT JOIN finance.payments r ON r.id = b.receipt_id
      WHERE ${where}
      ORDER BY b.transaction_at DESC, b.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`)
    ).rows;
    return rows.map((row) => ({
      id: row.id,
      fundId: row.fund_id,
      fundName: row.fund_name,
      transactionAt: new Date(row.transaction_at).toISOString(),
      transactionDate: row.transaction_date,
      direction: row.direction,
      amount: trimDecimal(row.amount),
      content: row.content,
      referenceCode: row.reference_code,
      balanceAfter: trimDecimal(row.balance_after),
      status: row.status,
      payment: row.payment_id ? { id: row.payment_id, documentNo: row.payment_no, kind: row.payment_kind, partnerName: row.payment_partner ?? "", paymentDate: row.payment_date! } : null,
      autoMatched: row.payment_id !== null && row.matched_by === null,
      suggestion: row.suggested_partner_id && row.suggestion_reason ? { partnerId: row.suggested_partner_id, partnerName: row.suggested_partner_name ?? "", reason: row.suggestion_reason } : null,
      receipt: row.receipt_id ? { id: row.receipt_id, documentNo: row.receipt_no, status: row.receipt_status ?? "" } : null,
      ignoreReason: row.ignore_reason,
      version: row.version,
    }));
  }

  async list(actor: Actor, query: z.output<typeof bankTransactionListQuerySchema>): Promise<BankTransactionsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, bankPermissions.view);
    const conditions: SQL[] = [sql`b.company_id = ${actor.companyId}`];
    if (query.fundId) conditions.push(sql`b.fund_id = ${query.fundId}`);
    if (query.status) conditions.push(sql`b.status = ${query.status}`);
    if (query.direction) conditions.push(sql`b.direction = ${query.direction}`);
    if (query.from) conditions.push(sql`b.transaction_date >= ${query.from}::date`);
    if (query.to) conditions.push(sql`b.transaction_date <= ${query.to}::date`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(b.content ILIKE ${pattern} OR b.reference_code ILIKE ${pattern} OR b.amount::text LIKE ${pattern})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = Number((await this.database.execute<{ total: string }>(sql`SELECT count(*)::text AS total FROM finance.bank_transactions b WHERE ${where}`)).rows[0]!.total);
    return {
      data: await this.items(where, query.pageSize, (query.page - 1) * query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total,
      canManage: granted.has(bankPermissions.manage),
      currency: await companyCurrency(this.database, actor.companyId),
    };
  }

  // ---------- Gợi ý khách cho tiền vào (QUYTAC_NGHIEPVU_116) ----------

  private async suggest(executor: Executor, transactionId: string, companyId: string, content: string): Promise<void> {
    const status = (await executor.execute<{ status: string }>(sql`SELECT status FROM finance.bank_transactions WHERE id = ${transactionId}`)).rows[0]!.status;
    if (status !== "unmatched" || !content) return;
    const upper = content.toUpperCase();
    const compact = upper.replace(/[^A-Z0-9]/g, "");
    const customers = sql`SELECT partner_id FROM crm.partner_profiles WHERE company_id = ${companyId} AND is_customer`;
    const single = async (query: SQL) => {
      const rows = (await executor.execute<{ id: string }>(sql`${query} LIMIT 2`)).rows;
      return rows.length === 1 ? rows[0]!.id : null;
    };
    const taxCodes = [...upper.matchAll(/(?<!\d)\d{10}(?:-\d{3})?(?!\d)/g)].map((match) => match[0]);
    const tiers: [NonNullable<BankTransactionItem["suggestion"]>["reason"], SQL | null][] = [
      [
        "sales_order",
        compact.length >= 6
          ? sql`SELECT DISTINCT o.customer_id AS id FROM sales.orders o
              WHERE o.company_id = ${companyId} AND o.customer_id IN (${customers}) AND o.document_no IS NOT NULL AND o.status <> 'cancelled'
                AND position(regexp_replace(upper(o.document_no), '[^A-Z0-9]', '', 'g') IN ${compact}::text) > 0`
          : null,
      ],
      ["partner_code", sql`SELECT p.id FROM crm.partners p WHERE p.id IN (${customers}) AND ${upper}::text ~ ('\\m' || p.code || '\\M')`],
      [
        "tax_code",
        taxCodes.length
          ? sql`SELECT p.id FROM crm.partners p WHERE p.id IN (${customers}) AND p.tax_code IN (${sql.join(
              taxCodes.map((code) => sql`${code}`),
              sql`, `,
            )})`
          : null,
      ],
    ];
    for (const [reason, query] of tiers) {
      const partnerId = query ? await single(query) : null;
      if (partnerId) {
        await executor.execute(sql`UPDATE finance.bank_transactions SET suggested_partner_id = ${partnerId}, suggestion_reason = ${reason} WHERE id = ${transactionId}`);
        return;
      }
    }
  }

  // ---------- Xử lý giao dịch chưa ghép (CHUC_NANG_86; API_100) ----------

  private async open(executor: Executor, actor: Actor, id: string, version: number) {
    const row = (
      await executor.execute<{
        id: string;
        fund_id: string;
        direction: "in" | "out";
        amount: string;
        transaction_date: string;
        content: string;
        status: string;
        payment_id: string | null;
        receipt_id: string | null;
        receipt_status: string | null;
        version: number;
      }>(sql`
      SELECT b.id, b.fund_id, b.direction, b.amount::text, b.transaction_date::text, b.content, b.status, b.payment_id, b.receipt_id, r.status AS receipt_status, b.version
      FROM finance.bank_transactions b LEFT JOIN finance.payments r ON r.id = b.receipt_id
      WHERE b.id = ${id} AND b.company_id = ${actor.companyId} FOR UPDATE OF b`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return row;
  }

  private async audit(executor: Pick<Database, "insert">, actor: Actor, action: string, id: string, afterData: Record<string, unknown>): Promise<void> {
    await this.auditService.record({ ...financeAudit(actor, "bank_transaction"), action: `bank_transaction.${action}`, entityId: id, beforeData: null, afterData }, executor);
  }

  private async item(id: string): Promise<BankTransactionItem> {
    return (await this.items(sql`b.id = ${id}`, 1, 0))[0]!;
  }

  // Kế toán xác nhận gợi ý: lập phiếu thu khách hàng của quỹ, ngày giao dịch, theo luồng duyệt phiếu thu.
  // Phiếu nháp còn lại từ lần xác nhận trước (gửi lỗi) được đặt lại theo giao dịch và khách vừa chọn rồi gửi lại.
  async confirmReceipt(actor: Actor, id: string, partnerId: string, version: number): Promise<BankTransactionItem> {
    await requireFinancePermission(this.permissionService, actor, bankPermissions.manage);
    const row = await this.database.transaction(async (transaction) => {
      const current = await this.open(transaction, actor, id, version);
      if (current.status !== "unmatched") throw new ApiError("BUSINESS_RULE", "bankTransactionNotOpen");
      if (current.direction !== "in") throw new ApiError("BUSINESS_RULE", "bankReceiptOnlyIncoming");
      if (current.receipt_status === "pending" || current.receipt_status === "posted") throw new ApiError("BUSINESS_RULE", "bankReceiptPending");
      return current;
    });
    const input = savePaymentSchema.parse({
      kind: "customer_receipt",
      partnerId,
      fundId: row.fund_id,
      paymentDate: row.transaction_date,
      amount: row.amount,
      note: row.content.slice(0, 500),
      lines: [],
    });
    let receiptId: string;
    if (row.receipt_status === "draft") {
      receiptId = row.receipt_id!;
      const draft = await this.payments.detail(actor, receiptId);
      await this.payments.update(actor, receiptId, { ...input, version: draft.version });
    } else {
      receiptId = (await this.payments.create(actor, input)).id;
      // Chỉ một lần xác nhận được gắn phiếu; lần song song thua thì xóa phiếu nháp vừa lập.
      const linked = await this.database.execute(sql`
        UPDATE finance.bank_transactions SET receipt_id = ${receiptId}, version = version + 1
        WHERE id = ${id} AND status = 'unmatched' AND version = ${row.version} AND receipt_id IS NOT DISTINCT FROM ${row.receipt_id}`);
      if ((linked.rowCount ?? 0) === 0) {
        await this.database.execute(sql`DELETE FROM finance.payments WHERE id = ${receiptId} AND status = 'draft'`);
        throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      }
    }
    const draft = await this.payments.detail(actor, receiptId);
    await this.payments.submit(actor, receiptId, draft.version);
    await this.audit(this.database, actor, "confirm_receipt", id, { receiptId, partnerId });
    return this.item(id);
  }

  private async paymentCandidateRows(executor: Executor, where: SQL, limit: number): Promise<BankPaymentCandidate[]> {
    const rows = (
      await executor.execute<{ id: string; document_no: string | null; kind: BankPaymentCandidate["kind"]; partner_name: string; payment_date: string; amount: string; note: string | null }>(sql`
      SELECT p.id, p.document_no, p.kind, pp.name AS partner_name, p.payment_date::text, p.amount::text, p.note
      FROM finance.payments p JOIN crm.partners pp ON pp.id = p.partner_id
      WHERE p.status = 'posted' AND NOT EXISTS (SELECT 1 FROM finance.bank_transactions other WHERE other.payment_id = p.id) AND ${where}
      LIMIT ${limit}`)
    ).rows;
    return rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      kind: row.kind,
      partnerName: row.partner_name,
      paymentDate: row.payment_date,
      amount: trimDecimal(row.amount),
      note: row.note,
    }));
  }

  // Phiếu ghép tay được: đã ghi sổ, cùng quỹ, cùng chiều, cùng số tiền, chưa ghép; ngày gần trước.
  async candidates(actor: Actor, id: string): Promise<BankPaymentCandidate[]> {
    await requireFinancePermission(this.permissionService, actor, bankPermissions.manage);
    const row = (await this.database.execute<{ id: string }>(sql`SELECT id FROM finance.bank_transactions WHERE id = ${id} AND company_id = ${actor.companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return this.paymentCandidateRows(
      this.database,
      sql`p.id IN (SELECT p.id FROM finance.payments p JOIN finance.bank_transactions b ON b.id = ${id}
          WHERE p.fund_id = b.fund_id AND p.amount = b.amount AND ((b.direction = 'in' AND p.kind IN ${kindsOf.in}) OR (b.direction = 'out' AND p.kind IN ${kindsOf.out})))
        ORDER BY abs(p.payment_date - (SELECT transaction_date FROM finance.bank_transactions WHERE id = ${id})), p.payment_date DESC`,
      20,
    );
  }

  async match(actor: Actor, id: string, paymentId: string, version: number): Promise<BankTransactionItem> {
    await requireFinancePermission(this.permissionService, actor, bankPermissions.manage);
    await this.database.transaction(async (transaction) => {
      const fundId = (await transaction.execute<{ fund_id: string }>(sql`SELECT fund_id FROM finance.bank_transactions WHERE id = ${id} AND company_id = ${actor.companyId}`)).rows[0]?.fund_id;
      if (!fundId) throw new ApiError("NOT_FOUND", "notFound");
      await this.lockFund(transaction, fundId);
      const current = await this.open(transaction, actor, id, version);
      if (current.status !== "unmatched") throw new ApiError("BUSINESS_RULE", "bankTransactionNotOpen");
      const allowed = (
        await transaction.execute<{ id: string }>(sql`
        SELECT p.id FROM finance.payments p JOIN finance.bank_transactions b ON b.id = ${id}
        WHERE p.id = ${paymentId} AND p.company_id = ${actor.companyId} AND p.status = 'posted' AND p.fund_id = b.fund_id AND p.amount = b.amount
          AND ((b.direction = 'in' AND p.kind IN ${kindsOf.in}) OR (b.direction = 'out' AND p.kind IN ${kindsOf.out}))
          AND NOT EXISTS (SELECT 1 FROM finance.bank_transactions other WHERE other.payment_id = p.id)`)
      ).rows[0];
      if (!allowed) throw new ApiError("BUSINESS_RULE", "bankPaymentNotMatchable");
      await this.setMatched(transaction, id, paymentId, actor.userId);
      await this.audit(transaction, actor, "match", id, { paymentId });
    });
    return this.item(id);
  }

  async ignore(actor: Actor, id: string, reason: string, version: number): Promise<BankTransactionItem> {
    await requireFinancePermission(this.permissionService, actor, bankPermissions.manage);
    await this.database.transaction(async (transaction) => {
      const current = await this.open(transaction, actor, id, version);
      if (current.status !== "unmatched") throw new ApiError("BUSINESS_RULE", "bankTransactionNotOpen");
      if (current.receipt_status === "pending") throw new ApiError("BUSINESS_RULE", "bankReceiptPending");
      await transaction.execute(
        sql`UPDATE finance.bank_transactions SET status = 'ignored', ignore_reason = ${reason}, matched_by = ${actor.userId}, matched_at = now(), version = version + 1 WHERE id = ${id}`,
      );
      await this.audit(transaction, actor, "ignore", id, { reason });
    });
    return this.item(id);
  }

  // Bỏ ghép, bỏ trạng thái bỏ qua: về chưa ghép, không đổi phiếu (QUYTAC_NGHIEPVU_117).
  async reopen(actor: Actor, id: string, version: number): Promise<BankTransactionItem> {
    await requireFinancePermission(this.permissionService, actor, bankPermissions.manage);
    await this.database.transaction(async (transaction) => {
      const current = await this.open(transaction, actor, id, version);
      if (current.status === "unmatched") throw new ApiError("BUSINESS_RULE", "bankTransactionAlreadyOpen");
      await transaction.execute(sql`
        UPDATE finance.bank_transactions SET status = 'unmatched', payment_id = NULL, ignore_reason = NULL, matched_by = NULL, matched_at = NULL, version = version + 1 WHERE id = ${id}`);
      await this.audit(transaction, actor, "reopen", id, { previousStatus: current.status, previousPaymentId: current.payment_id });
    });
    return this.item(id);
  }

  // ---------- Đối chiếu (CHUC_NANG_87; API_101) ----------

  async reconciliation(actor: Actor, query: z.output<typeof bankReconciliationQuerySchema>): Promise<BankReconciliationResponse> {
    await requireFinancePermission(this.permissionService, actor, bankPermissions.view);
    if (query.from > query.to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { from: "invalidValue" } });
    const fund = (await this.database.execute<{ id: string }>(sql`SELECT id FROM finance.funds WHERE id = ${query.fundId} AND company_id = ${actor.companyId} AND kind = 'bank'`)).rows[0];
    if (!fund) throw new ApiError("NOT_FOUND", "notFound");
    const book = (
      await this.database.execute<{ balance: string }>(sql`
      SELECT (f.opening_balance + coalesce((SELECT sum(${signedPaymentAmount}) FROM finance.payments p WHERE p.fund_id = f.id AND p.status = 'posted' AND p.payment_date <= ${query.to}::date), 0))::text AS balance
      FROM finance.funds f WHERE f.id = ${query.fundId}`)
    ).rows[0]!.balance;
    const bank = (
      await this.database.execute<{ balance_after: string; transaction_at: Date | string }>(sql`
      SELECT balance_after::text, transaction_at FROM finance.bank_transactions
      WHERE fund_id = ${query.fundId} AND transaction_date <= ${query.to}::date AND balance_after IS NOT NULL ORDER BY transaction_at DESC, created_at DESC LIMIT 1`)
    ).rows[0];
    const sums = (
      await this.database.execute<{ direction: "in" | "out"; status: string; count: number; amount: string }>(sql`
      SELECT direction, status, count(*)::int AS count, coalesce(sum(amount), 0)::text AS amount FROM finance.bank_transactions
      WHERE fund_id = ${query.fundId} AND transaction_date BETWEEN ${query.from}::date AND ${query.to}::date AND status <> 'matched'
      GROUP BY direction, status`)
    ).rows;
    const unmatched = (direction: "in" | "out") => {
      const found = sums.find((row) => row.direction === direction && row.status === "unmatched");
      return { count: found?.count ?? 0, amount: trimDecimal(found?.amount ?? "0") };
    };
    const paymentWhere = sql`p.fund_id = ${query.fundId} AND p.payment_date BETWEEN ${query.from}::date AND ${query.to}::date`;
    const unmatchedPaymentCount = Number(
      (
        await this.database.execute<{ count: string }>(sql`
        SELECT count(*)::text AS count FROM finance.payments p WHERE p.status = 'posted' AND ${paymentWhere} AND NOT EXISTS (SELECT 1 FROM finance.bank_transactions other WHERE other.payment_id = p.id)`)
      ).rows[0]!.count,
    );
    return {
      fundId: query.fundId,
      from: query.from,
      to: query.to,
      bookBalance: trimDecimal(book),
      bankBalance: bank ? trimDecimal(bank.balance_after) : null,
      bankBalanceAt: bank ? new Date(bank.transaction_at).toISOString() : null,
      difference: bank ? trimDecimal((await this.database.execute<{ value: string }>(sql`SELECT (${bank.balance_after}::numeric - ${book}::numeric)::text AS value`)).rows[0]!.value) : null,
      unmatchedIn: unmatched("in"),
      unmatchedOut: unmatched("out"),
      ignoredCount: sums.filter((row) => row.status === "ignored").reduce((total, row) => total + row.count, 0),
      unmatchedPayments: await this.paymentCandidateRows(this.database, sql`${paymentWhere} ORDER BY p.payment_date, p.document_no`, 100),
      unmatchedPaymentCount,
      currency: await companyCurrency(this.database, actor.companyId),
    };
  }
}
