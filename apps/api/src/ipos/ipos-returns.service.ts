// Máy bán iPOS: trả hàng, hủy hóa đơn (CONG_VIEC_74; CHUC_NANG_258; QUYTAC_NGHIEPVU_611, 619, 624; API_343).
// Hóa đơn chỉ tiền mặt, VietQR: trả một phần hoặc hết, tiền hoàn theo phần sau giảm (gồm giảm hóa đơn đã phân bổ), hoàn tiền mặt từ két của ca đang mở.
// Hóa đơn có điểm, voucher: chỉ hủy toàn bộ, hủy giao dịch `LK…` qua service CONG_VIEC_55 (tuần đối soát đã chốt thì chặn).
// Hóa đơn có thanh toán qua ứng dụng VComm: hủy cần hàm hoàn tiền của CONG_VIEC_73 (lát L7), chưa có.
import { Inject, Injectable } from "@nestjs/common";
import type { IposReturn, IposReturnLookup, IposReturnLookupLine, iposReturnCreateSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { AffiliateTransactionsService } from "../affiliate/transactions.service";
import { ApiError } from "../common/api-error";
import { CLOCK, vietnamDate, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "./ipos-catalog.service";
import type { IposPosActor } from "./ipos-device-context";
import { IposSalesService } from "./ipos-sales.service";
import { loadSettings } from "./ipos-settings.service";
import { consumeApproval, openShiftOf, requireSelling } from "./ipos-shifts.service";

type SaleHead = { id: string; merchant_id: string; document_no: string; sold_at: Date; status: "completed" | "cancelled"; total: string; methods: string[]; affiliate_transaction_id: string | null };
type LineRow = { id: string; line_no: number; variant_id: string; name: string; unit: string; quantity: string; amount: string; unit_cost: string | null; returned_quantity: string; returned_amount: string };

const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

@Injectable()
export class IposReturnsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly sales: IposSalesService,
    private readonly transactions: AffiliateTransactionsService,
  ) {}

  private async head(executor: Executor, merchantId: string, where: { id: string } | { documentNo: string }, lock = false): Promise<SaleHead | undefined> {
    return (
      await executor.execute<SaleHead>(sql`
        SELECT s.id, s.merchant_id, s.document_no, s.sold_at, s.status, s.total::text,
          ARRAY(SELECT DISTINCT p.method FROM ipos.sale_payments p WHERE p.sale_id = s.id) AS methods,
          (SELECT p.affiliate_transaction_id FROM ipos.sale_payments p WHERE p.sale_id = s.id AND p.affiliate_transaction_id IS NOT NULL LIMIT 1) AS affiliate_transaction_id
        FROM ipos.sales s
        WHERE s.merchant_id = ${merchantId} AND ${"id" in where ? sql`s.id = ${where.id}` : sql`upper(s.document_no) = ${where.documentNo.trim().toUpperCase()}`}
        ${lock ? sql`FOR UPDATE OF s` : sql``}`)
    ).rows[0];
  }

  private async lines(executor: Executor, saleId: string): Promise<LineRow[]> {
    return (
      await executor.execute<LineRow>(sql`
        SELECT l.id, l.line_no, l.variant_id, l.name, l.unit, trim_scale(l.quantity)::text AS quantity, l.amount::text, l.unit_cost::text,
          COALESCE(trim_scale(sum(r.quantity)), 0)::text AS returned_quantity, COALESCE(sum(r.amount), 0)::text AS returned_amount
        FROM ipos.sale_lines l LEFT JOIN ipos.return_lines r ON r.sale_line_id = l.id
        WHERE l.sale_id = ${saleId} GROUP BY l.id ORDER BY l.line_no`)
    ).rows;
  }

  // Hóa đơn có điểm, voucher, ứng dụng VComm chỉ hủy toàn bộ (QUYTAC_NGHIEPVU_624 khoản 3).
  private modeOf(head: SaleHead): "partial" | "full_cancel" {
    return head.methods.some((method) => ["points", "voucher", "vcomm_app"].includes(method)) || head.affiliate_transaction_id ? "full_cancel" : "partial";
  }

  private async blocked(executor: Executor, actor: IposPosActor, head: SaleHead, lines: LineRow[]): Promise<{ reason: string | null; deadline: string }> {
    const settings = await loadSettings(executor, actor.device.merchantId);
    const deadline = addDays(vietnamDate(new Date(head.sold_at)), settings.returnDays);
    if (head.status === "cancelled") return { reason: "iposReturnCancelled", deadline };
    if (vietnamDate(this.clock.now()) > deadline) return { reason: "iposReturnExpired", deadline };
    if (lines.every((line) => Number(line.returned_quantity) >= Number(line.quantity))) return { reason: "iposReturnNothingLeft", deadline };
    return { reason: null, deadline };
  }

  async lookup(actor: IposPosActor, documentNo: string): Promise<IposReturnLookup> {
    const head = await this.head(this.database, actor.device.merchantId, { documentNo });
    if (!head) throw new ApiError("NOT_FOUND", "iposReturnSaleNotFound");
    const lines = await this.lines(this.database, head.id);
    const { reason, deadline } = await this.blocked(this.database, actor, head, lines);
    const settings = await loadSettings(this.database, actor.device.merchantId);
    return {
      sale: await this.sales.detailForMerchant(actor.device.merchantId, head.id),
      lines: lines.map(
        (line): IposReturnLookupLine => ({
          saleLineId: line.id,
          lineNo: line.line_no,
          name: line.name,
          unit: line.unit,
          quantity: line.quantity,
          returnedQuantity: line.returned_quantity,
          amount: line.amount,
          returnedAmount: line.returned_amount,
        }),
      ),
      mode: this.modeOf(head),
      deadline,
      blockedReason: reason,
      needsApproval: actor.role !== "owner" && !settings.cashierCanReturn,
    };
  }

  async create(actor: IposPosActor, input: z.infer<typeof iposReturnCreateSchema>): Promise<IposReturn> {
    const now = this.clock.now();
    const today = vietnamDate(now);
    const id = await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ipos-return:${actor.device.deviceId}:${input.idempotencyKey}`}))`);
      const existing = (await transaction.execute<{ id: string }>(sql`SELECT id FROM ipos.returns WHERE device_id = ${actor.device.deviceId} AND idempotency_key = ${input.idempotencyKey}`)).rows[0];
      if (existing) return existing.id;
      await requireSelling(transaction, actor, today);
      const shift = await openShiftOf(transaction, actor, input.shiftId);
      const head = await this.head(transaction, actor.device.merchantId, { id: input.saleId }, true);
      if (!head) throw new ApiError("NOT_FOUND", "iposReturnSaleNotFound");
      const lines = await this.lines(transaction, head.id);
      const { reason } = await this.blocked(transaction, actor, head, lines);
      if (reason) throw new ApiError("BUSINESS_RULE", reason as "iposReturnExpired" | "iposReturnCancelled" | "iposReturnNothingLeft");
      const mode = this.modeOf(head);
      if (mode === "full_cancel" && input.kind !== "full_cancel") throw new ApiError("BUSINESS_RULE", "iposReturnFullOnly");
      // Thu ngân trả hàng cần chủ cửa hàng duyệt bằng PIN, trừ khi cài đặt cho thu ngân tự trả (QUYTAC_NGHIEPVU_624 khoản 4).
      const settings = await loadSettings(transaction, actor.device.merchantId);
      let approvedBy: string | null = null;
      if (actor.role !== "owner" && !settings.cashierCanReturn) {
        if (!input.approvalCode) throw new ApiError("BUSINESS_RULE", "iposReturnNeedsApproval");
        approvedBy = await consumeApproval(transaction, actor.device.deviceId, input.approvalCode, "return", now);
      }

      // Dòng trả và tiền hoàn: trả hết phần còn lại thì hoàn đúng phần tiền còn lại để không lệch do làm tròn.
      const byId = new Map(lines.map((line) => [line.id, line]));
      const requested =
        input.kind === "full_cancel"
          ? lines.filter((line) => Number(line.returned_quantity) < Number(line.quantity)).map((line) => ({ saleLineId: line.id, quantity: (Number(line.quantity) - Number(line.returned_quantity)).toFixed(3) }))
          : input.lines;
      if (new Set(requested.map((line) => line.saleLineId)).size !== requested.length) throw new ApiError("BUSINESS_RULE", "iposReturnQuantityInvalid");
      const priced = requested.map((line) => {
        const sold = byId.get(line.saleLineId);
        if (!sold) throw new ApiError("NOT_FOUND", "notFound");
        const remaining = Number(sold.quantity) - Number(sold.returned_quantity);
        const quantity = Number(line.quantity);
        if (quantity > remaining + 1e-9) throw new ApiError("BUSINESS_RULE", "iposReturnQuantityInvalid");
        const left = Number(sold.amount) - Number(sold.returned_amount);
        const amount = Math.abs(quantity - remaining) < 1e-9 ? left : Math.min(left, Math.round((Number(sold.amount) * quantity) / Number(sold.quantity)));
        return { sold, quantity: line.quantity, amount };
      });
      const amount = priced.reduce((sum, line) => sum + line.amount, 0);

      const outlet = (await transaction.execute<{ code: string | null }>(sql`SELECT code FROM affiliate.outlets WHERE id = ${actor.device.outletId}`)).rows[0]!;
      if (!outlet.code) throw new ApiError("BUSINESS_RULE", "iposOutletCodeMissing");

      // Hủy toàn bộ hóa đơn có điểm, voucher: hủy giao dịch LK… (hoàn điểm, nhả voucher; trừ lại điểm đã tích). Tiền mặt, VietQR khách đã trả hoàn bằng tiền mặt.
      let refundCash = amount;
      if (input.kind === "full_cancel") {
        const paid = (
          await transaction.execute<{ cash: string }>(sql`SELECT COALESCE(sum(amount), 0)::text AS cash FROM ipos.sale_payments WHERE sale_id = ${head.id} AND method IN ('cash', 'vietqr')`)
        ).rows[0]!;
        const previous = (await transaction.execute<{ refunded: string }>(sql`SELECT COALESCE(sum(refund_cash), 0)::text AS refunded FROM ipos.returns WHERE sale_id = ${head.id}`)).rows[0]!;
        refundCash = Math.max(0, Number(paid.cash) - Number(previous.refunded));
        // cancelFor chạy giao dịch riêng: lần gửi trước đã hủy LK… nhưng giao dịch này lỗi thì gửi lại bỏ qua bước hủy LK….
        const lkStatus = head.affiliate_transaction_id
          ? (await transaction.execute<{ status: string }>(sql`SELECT status FROM affiliate.transactions WHERE id = ${head.affiliate_transaction_id}`)).rows[0]?.status
          : undefined;
        if (head.affiliate_transaction_id && lkStatus !== "cancelled") {
          const company = (await transaction.execute<{ company_id: string }>(sql`SELECT company_id FROM affiliate.merchants WHERE id = ${actor.device.merchantId}`)).rows[0]!;
          try {
            await this.transactions.cancelFor(
              { merchantId: actor.device.merchantId, companyId: company.company_id, cashierUserId: actor.userId, apiKey: null, client: { ip: null, userAgent: "iPOS", requestId: null } },
              head.affiliate_transaction_id,
              `Hủy hóa đơn iPOS ${head.document_no}: ${input.reason}`,
            );
          } catch (error) {
            if (error instanceof ApiError && error.messageKey === "affiliateWeekSettled") throw new ApiError("BUSINESS_RULE", "iposReturnWeekSettled");
            throw error;
          }
        }
        await transaction.execute(sql`UPDATE ipos.sales SET status = 'cancelled', cancelled_at = ${now} WHERE id = ${head.id}`);
      }

      const sequence = await transaction.execute<{ last_number: number }>(sql`
        INSERT INTO ipos.document_sequences (outlet_id, day, kind, last_number) VALUES (${actor.device.outletId}, ${today}, 'return', 1)
        ON CONFLICT (outlet_id, day, kind) DO UPDATE SET last_number = ipos.document_sequences.last_number + 1
        RETURNING last_number`);
      const documentNo = `TR-${outlet.code}-${today.slice(2).replaceAll("-", "")}-${String(sequence.rows[0]!.last_number).padStart(4, "0")}`;
      const created = await transaction.execute<{ id: string }>(sql`
        INSERT INTO ipos.returns (merchant_id, outlet_id, register_id, device_id, shift_id, member_id, sale_id, document_no, idempotency_key, kind, amount, refund_cash, approved_by, reason)
        VALUES (${actor.device.merchantId}, ${actor.device.outletId}, ${actor.device.registerId}, ${actor.device.deviceId}, ${shift.id}, ${actor.memberId}, ${head.id}, ${documentNo},
          ${input.idempotencyKey}, ${input.kind}, ${amount}, ${refundCash}, ${approvedBy}, ${input.reason})
        RETURNING id`);
      const returnId = created.rows[0]!.id;

      // Cộng lại tồn tại điểm bán nhận trả; giá vốn bình quân tính lại với giá vốn lúc bán.
      for (const line of [...priced].sort((left, right) => left.sold.variant_id.localeCompare(right.sold.variant_id))) {
        await transaction.execute(sql`
          INSERT INTO ipos.return_lines (return_id, sale_line_id, quantity, amount, unit_cost) VALUES (${returnId}, ${line.sold.id}, ${line.quantity}, ${line.amount}, ${line.sold.unit_cost})`);
        if (line.sold.unit_cost === null) continue;
        await transaction.execute(sql`
          INSERT INTO ipos.stock_balances (outlet_id, variant_id, merchant_id) VALUES (${actor.device.outletId}, ${line.sold.variant_id}, ${actor.device.merchantId})
          ON CONFLICT (outlet_id, variant_id) DO NOTHING`);
        const updated = await transaction.execute<{ quantity: string }>(sql`
          UPDATE ipos.stock_balances SET
            average_cost = round((GREATEST(quantity, 0) * average_cost + ${line.quantity}::numeric * ${line.sold.unit_cost}::numeric) / (GREATEST(quantity, 0) + ${line.quantity}::numeric), 4),
            quantity = quantity + ${line.quantity}::numeric, updated_at = now()
          WHERE outlet_id = ${actor.device.outletId} AND variant_id = ${line.sold.variant_id} RETURNING quantity::text`);
        await transaction.execute(sql`
          INSERT INTO ipos.stock_moves (merchant_id, outlet_id, variant_id, quantity, unit_cost, balance_after, source_type, source_id, source_number, created_by, occurred_at)
          VALUES (${actor.device.merchantId}, ${actor.device.outletId}, ${line.sold.variant_id}, ${line.quantity}, ${line.sold.unit_cost}, ${updated.rows[0]!.quantity}, 'return',
            ${returnId}, ${documentNo}, ${actor.userId}, ${now})`);
      }
      return returnId;
    });
    return this.detail(actor.device.merchantId, id);
  }

  async detail(merchantId: string, id: string): Promise<IposReturn> {
    const row = (
      await this.database.execute<{
        id: string;
        document_no: string;
        kind: "partial" | "full_cancel";
        sale_id: string;
        sale_document_no: string;
        outlet_name: string;
        address: string;
        merchant_name: string;
        register_name: string;
        member_name: string;
        amount: string;
        refund_cash: string;
        reason: string;
        approved_by_name: string | null;
        created_at: Date;
      }>(sql`
        SELECT r.id, r.document_no, r.kind, r.sale_id, s.document_no AS sale_document_no, o.name AS outlet_name, o.address, p.name AS merchant_name,
          rg.name AS register_name, mb.full_name AS member_name, r.amount::text, r.refund_cash::text, r.reason, ap.full_name AS approved_by_name, r.created_at
        FROM ipos.returns r JOIN ipos.sales s ON s.id = r.sale_id JOIN affiliate.outlets o ON o.id = r.outlet_id
        JOIN affiliate.merchants m ON m.id = r.merchant_id JOIN crm.partners p ON p.id = m.partner_id JOIN ipos.registers rg ON rg.id = r.register_id
        JOIN affiliate.members mb ON mb.id = r.member_id LEFT JOIN affiliate.members ap ON ap.id = r.approved_by
        WHERE r.id = ${id} AND r.merchant_id = ${merchantId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const lines = await this.database.execute<{ name: string; unit: string; quantity: string; amount: string }>(sql`
      SELECT l.name, l.unit, trim_scale(r.quantity)::text AS quantity, r.amount::text FROM ipos.return_lines r JOIN ipos.sale_lines l ON l.id = r.sale_line_id
      WHERE r.return_id = ${id} ORDER BY l.line_no`);
    return {
      id: row.id,
      documentNo: row.document_no,
      kind: row.kind,
      saleId: row.sale_id,
      saleDocumentNo: row.sale_document_no,
      outletName: row.outlet_name,
      outletAddress: row.address,
      merchantName: row.merchant_name,
      registerName: row.register_name,
      memberName: row.member_name,
      amount: row.amount,
      refundCash: row.refund_cash,
      reason: row.reason,
      approvedByName: row.approved_by_name,
      createdAt: new Date(row.created_at).toISOString(),
      lines: lines.rows,
    };
  }
}
