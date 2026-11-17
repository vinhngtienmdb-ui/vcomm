// Máy bán iPOS: khách VComm dùng điểm, voucher tại quầy (service giao dịch của CONG_VIEC_55, 67) và đơn chờ thanh toán qua ứng dụng VComm
// (InstoreCheckoutsService của CONG_VIEC_73) (CONG_VIEC_74; CHUC_NANG_256; QUYTAC_NGHIEPVU_614, 616, 617; API_341).
// Giao dịch điểm, đơn chờ ghi vào `ipos.shift_links` theo ca để chặn đóng ca khi còn dở.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { IposLoyaltyTransaction, IposSaleCreateInput, IposVcommCheckout, iposLoyaltyCreateSchema, iposVcommCheckoutCreateSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { AffiliateTransactionsService, maskName, type CounterActor } from "../affiliate/transactions.service";
import { ApiError } from "../common/api-error";
import { CLOCK, vietnamDate, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { InstoreCheckoutsService, type AffiliateCheckoutResult, type CheckoutRow, type DatabaseTransaction } from "../instore/checkouts.service";
import type { Executor } from "./ipos-catalog.service";
import type { IposPosActor } from "./ipos-device-context";
import { computeTotals, loadSaleVariants, writeSale } from "./ipos-sales.service";
import { loadSettings } from "./ipos-settings.service";
import { consumeApproval, openShiftOf, requireSelling } from "./ipos-shifts.service";

// Địa chỉ trang ứng dụng VComm cho mã QR thanh toán (như quầy bán lẻ của CONG_VIEC_73).
const appWebBase = () => (process.env.VCOMM_WEB_URL?.trim() || "http://localhost:8083").replace(/\/+$/, "");

// Giỏ lưu trong đơn chờ lúc tạo (`instore.checkouts.sale_input.ipos`).
type IposCheckoutSaleInput = {
  deviceId: string;
  shiftId: string;
  memberId: string;
  approvedBy?: string | null;
  lines: IposSaleCreateInput["lines"];
  invoiceDiscount: IposSaleCreateInput["invoiceDiscount"];
};

type LoyaltyRow = {
  id: string;
  document_no: string;
  status: IposLoyaltyTransaction["status"];
  expires_at: Date | null;
  bill_amount: string;
  buyer_name: string | null;
  redeemed_points: number;
  redeemed_amount: string;
  voucher_discount: string;
  paid_amount: string | null;
  earned_points: number;
  skip_reason: string | null;
};

@Injectable()
export class IposCheckoutsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly transactions: AffiliateTransactionsService,
    private readonly checkouts: InstoreCheckoutsService,
  ) {}

  onModuleInit(): void {
    this.checkouts.registerCompletionHook("ipos", (transaction, row, result) => this.complete(transaction, row, result));
  }

  // Móc hoàn tất của CONG_VIEC_73: đơn chờ do máy bán tạo đã được khách trả qua ứng dụng VComm (thu hộ). Chạy trong giao dịch hoàn tất, sau khi ghi `LK…`:
  // ghi hóa đơn iPOS theo giỏ lưu lúc tạo đơn (giá đã chốt lúc tạo), dòng thanh toán ứng dụng VComm, điểm, voucher; gắn hóa đơn vào ca.
  // Lỗi ở đây làm đơn thu hộ chuyển "paid_unposted" (CONG_VIEC_73 ghi lại, hủy hoàn tiền).
  private async complete(transaction: DatabaseTransaction, row: CheckoutRow, result: AffiliateCheckoutResult): Promise<string | null> {
    const input = (row.sale_input as { ipos?: IposCheckoutSaleInput } | null)?.ipos;
    if (!input) throw new ApiError("BUSINESS_RULE", "iposCheckoutInputMissing");
    // Đã ghi (gọi lại sau lỗi) thì trả hóa đơn cũ.
    const found = (await transaction.execute<{ id: string }>(sql`SELECT id FROM ipos.sales WHERE device_id = ${input.deviceId} AND idempotency_key = ${row.id}`)).rows[0];
    if (found) return found.id;
    const device = (
      await transaction.execute<{ merchant_id: string; outlet_id: string; register_id: string }>(sql`
        SELECT r.merchant_id, r.outlet_id, d.register_id FROM ipos.devices d JOIN ipos.registers r ON r.id = d.register_id WHERE d.id = ${input.deviceId}`)
    ).rows[0];
    if (!device || device.merchant_id !== row.merchant_id || device.outlet_id !== row.outlet_id || !row.created_by_user_id) {
      throw new ApiError("BUSINESS_RULE", "iposCheckoutInputMissing");
    }
    const totals = computeTotals(
      input.lines.map((line) => ({ quantity: line.quantity, unitPrice: Number(line.unitPrice), discount: line.discount })),
      input.invoiceDiscount,
    );
    // Tiền giỏ phải đúng tiền đơn; ứng dụng VComm + điểm + voucher + tiền thu tại quầy phải đủ tiền hóa đơn.
    const paid = Number(result.appAmount) + Number(result.pointsAmount) + Number(result.voucherAmount) + Number(result.dueAtCounter);
    if (totals.total !== Number(row.bill_amount) || paid !== totals.total) throw new ApiError("BUSINESS_RULE", "iposLoyaltyAmountMismatch");
    // iPOS chỉ tạo đơn thu hộ; đơn thu tại quầy dùng giao dịch điểm (API_341) nên không có tiền còn thu.
    if (Number(result.dueAtCounter) > 0) throw new ApiError("BUSINESS_RULE", "iposCheckoutInputMissing");
    const byId = await loadSaleVariants(transaction, device.merchant_id, device.outlet_id, input.lines.map((line) => line.variantId));
    if (byId.size !== new Set(input.lines.map((line) => line.variantId)).size) throw new ApiError("BUSINESS_RULE", "iposItemUnavailable");
    // Ca lúc tạo đơn đã đóng (đơn ghi lại muộn, ví dụ sau khi thu hộ lỗi ghi chứng từ): ghi vào ca đang mở của cùng quầy để không đổi biên bản ca đã đóng;
    // quầy không có ca mở thì báo lỗi, đơn giữ trạng thái chờ ghi lại.
    let shiftId = input.shiftId;
    const shift = (await transaction.execute<{ closed: boolean }>(sql`SELECT closed_at IS NOT NULL AS closed FROM ipos.shifts WHERE id = ${input.shiftId}`)).rows[0];
    if (!shift || shift.closed) {
      const open = (await transaction.execute<{ id: string }>(sql`SELECT id FROM ipos.shifts WHERE register_id = ${device.register_id} AND closed_at IS NULL FOR UPDATE`)).rows[0];
      if (!open) throw new ApiError("BUSINESS_RULE", "iposCheckoutShiftClosed");
      shiftId = open.id;
    }
    const now = this.clock.now();
    const { saleId } = await writeSale(transaction, {
      device: { merchantId: device.merchant_id, outletId: device.outlet_id, registerId: device.register_id, deviceId: input.deviceId },
      shiftId,
      memberId: input.memberId,
      userId: row.created_by_user_id,
      now,
      idempotencyKey: row.id,
      lines: input.lines,
      byId,
      totals,
      approvedBy: input.approvedBy ?? null,
      // Khách đã trả tiền: không chặn vì tồn âm.
      blockNegativeStock: false,
    });
    const payments: [string, string][] = [
      ["vcomm_app", result.appAmount],
      ["points", result.pointsAmount],
      ["voucher", result.voucherAmount],
    ];
    for (const [method, amount] of payments) {
      if (Number(amount) <= 0) continue;
      await transaction.execute(sql`
        INSERT INTO ipos.sale_payments (sale_id, method, amount, affiliate_transaction_id, instore_checkout_id)
        VALUES (${saleId}, ${method}, ${amount}, ${result.affiliateTransactionId}, ${row.id})`);
    }
    const skip = (await transaction.execute<{ skip_reason: string | null }>(sql`SELECT skip_reason FROM affiliate.transactions WHERE id = ${result.affiliateTransactionId}`)).rows[0];
    await transaction.execute(sql`UPDATE ipos.sales SET buyer_user_id = ${row.buyer_user_id}, loyalty_skip_reason = ${skip?.skip_reason ?? null} WHERE id = ${saleId}`);
    await transaction.execute(sql`UPDATE ipos.shift_links SET sale_id = ${saleId} WHERE instore_checkout_id = ${row.id}`);
    return saleId;
  }

  private async counter(executor: Executor, actor: IposPosActor, requestId: string | null): Promise<CounterActor> {
    const company = (await executor.execute<{ company_id: string }>(sql`SELECT company_id FROM affiliate.merchants WHERE id = ${actor.device.merchantId}`)).rows[0]!;
    return { merchantId: actor.device.merchantId, companyId: company.company_id, cashierUserId: actor.userId, apiKey: null, client: { ip: null, userAgent: "iPOS", requestId } };
  }

  // Khách VComm dùng điểm, voucher: khách quét mã QR cửa hàng trên máy bán (chờ khách xác nhận), hoặc thu ngân quét mã thành viên (hoàn tất ngay).
  async createLoyalty(actor: IposPosActor, input: z.infer<typeof iposLoyaltyCreateSchema>): Promise<IposLoyaltyTransaction> {
    await requireSelling(this.database, actor, vietnamDate(this.clock.now()));
    const shift = await openShiftOf(this.database, actor, input.shiftId);
    const created = await this.transactions.createFor(await this.counter(this.database, actor, null), {
      outletId: actor.device.outletId,
      billAmount: input.billAmount,
      method: input.method,
      memberCode: input.memberCode ?? undefined,
    });
    await this.database.execute(sql`INSERT INTO ipos.shift_links (shift_id, affiliate_transaction_id) VALUES (${shift.id}, ${created.id})`);
    return this.loyalty(actor, created.id, created.qrCode);
  }

  async loyalty(actor: IposPosActor, id: string, qrCode: string | null = null): Promise<IposLoyaltyTransaction> {
    const row = (
      await this.database.execute<LoyaltyRow>(sql`
        SELECT t.id, t.document_no, CASE WHEN t.status = 'pending' AND t.expires_at < now() THEN 'expired' ELSE t.status END AS status, t.expires_at,
          trim_scale(t.bill_amount)::text AS bill_amount, u.full_name AS buyer_name, t.redeemed_points, trim_scale(t.redeemed_amount)::text AS redeemed_amount,
          trim_scale(t.voucher_discount)::text AS voucher_discount, trim_scale(t.paid_amount)::text AS paid_amount, t.earned_points, t.skip_reason
        FROM affiliate.transactions t JOIN ipos.shift_links l ON l.affiliate_transaction_id = t.id JOIN ipos.shifts sh ON sh.id = l.shift_id
        LEFT JOIN core.users u ON u.id = t.buyer_user_id
        WHERE t.id = ${id} AND t.merchant_id = ${actor.device.merchantId} AND sh.register_id = ${actor.device.registerId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return {
      id: row.id,
      documentNo: row.document_no,
      status: row.status,
      qrCode,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      billAmount: row.bill_amount,
      buyerName: maskName(row.buyer_name),
      redeemedPoints: row.redeemed_points ?? 0,
      redeemedAmount: row.redeemed_amount ?? "0",
      voucherDiscount: row.voucher_discount ?? "0",
      paidAmount: row.paid_amount ?? row.bill_amount,
      earnedPoints: row.earned_points ?? 0,
      skipReason: row.skip_reason,
    };
  }

  // Bỏ giỏ, đổi giỏ sau khi khách đã dùng điểm: hủy giao dịch (hoàn điểm, nhả voucher) qua service của CONG_VIEC_55. Giao dịch đang chờ thì tự hết hạn sau 3 phút.
  async cancelLoyalty(actor: IposPosActor, id: string): Promise<IposLoyaltyTransaction> {
    const current = await this.loyalty(actor, id);
    const linked = (await this.database.execute(sql`SELECT 1 FROM ipos.sale_payments WHERE affiliate_transaction_id = ${id}`)).rows.length > 0;
    if (linked) throw new ApiError("BUSINESS_RULE", "iposLoyaltyNotUsable");
    if (current.status === "completed") await this.transactions.cancelFor(await this.counter(this.database, actor, null), id, "Hủy giỏ hàng trên máy bán iPOS");
    await this.database.execute(sql`DELETE FROM ipos.shift_links WHERE affiliate_transaction_id = ${id} AND sale_id IS NULL`);
    return { ...current, status: current.status === "completed" ? "cancelled" : current.status };
  }

  // API_341: đơn chờ thanh toán qua ứng dụng VComm, giá theo máy chủ; giảm vượt mức cần mã duyệt như khi ghi hóa đơn.
  async createCheckout(actor: IposPosActor, input: z.infer<typeof iposVcommCheckoutCreateSchema>): Promise<IposVcommCheckout> {
    const now = this.clock.now();
    const row = await this.database.transaction(async (transaction) => {
      await requireSelling(transaction, actor, vietnamDate(now));
      const shift = await openShiftOf(transaction, actor, input.shiftId);
      const settings = await loadSettings(transaction, actor.device.merchantId);
      const variants = await transaction.execute<{ id: string; name: string; unit: string; price: string; active: boolean }>(sql`
        SELECT v.id, i.unit, (v.status = 'active' AND i.status = 'active') AS active,
          i.name || COALESCE(' – ' || v.attribute1_value, '') || COALESCE(' / ' || v.attribute2_value, '') AS name,
          COALESCE(op.price, v.price, i.price)::text AS price
        FROM ipos.item_variants v JOIN ipos.items i ON i.id = v.item_id
        LEFT JOIN ipos.outlet_prices op ON op.variant_id = v.id AND op.outlet_id = ${actor.device.outletId}
        WHERE v.merchant_id = ${actor.device.merchantId} AND v.id IN (${sql.join(input.lines.map((line) => sql`${line.variantId}`), sql`, `)})`);
      const byId = new Map(variants.rows.map((variant) => [variant.id, variant]));
      for (const line of input.lines) {
        const variant = byId.get(line.variantId);
        if (!variant || !variant.active) throw new ApiError("BUSINESS_RULE", "iposItemUnavailable");
        if (variant.price !== line.unitPrice) throw new ApiError("BUSINESS_RULE", "iposPriceChanged");
      }
      const totals = computeTotals(
        input.lines.map((line) => ({ quantity: line.quantity, unitPrice: Number(line.unitPrice), discount: line.discount })),
        input.invoiceDiscount,
      );
      if (totals.total <= 0) throw new ApiError("BUSINESS_RULE", "iposCheckoutZero");
      let approvedBy: string | null = null;
      if (actor.role !== "owner" && totals.discountPercent > Number(settings.cashierMaxDiscountPercent) + 1e-9) {
        if (!input.approvalCode) throw new ApiError("BUSINESS_RULE", "iposDiscountNeedsApproval");
        approvedBy = await consumeApproval(transaction, actor.device.deviceId, input.approvalCode, "discount", now);
      }
      const company = (await transaction.execute<{ company_id: string }>(sql`SELECT company_id FROM affiliate.merchants WHERE id = ${actor.device.merchantId}`)).rows[0]!;
      const created = await this.checkouts.create(transaction, {
        operatorCompanyId: company.company_id,
        place: { kind: "affiliate", merchantId: actor.device.merchantId, outletId: actor.device.outletId },
        creator: { source: "ipos", userId: actor.userId },
        idempotencyKey: input.idempotencyKey,
        billAmount: String(totals.total),
        lines: input.lines.map((line, index) => ({
          name: byId.get(line.variantId)!.name,
          unit: byId.get(line.variantId)!.unit,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: String(totals.lines[index]!.amount),
          gift: false,
        })),
        collectInApp: true,
        // Dữ liệu để iPOS ghi hóa đơn khi đơn hoàn tất (móc hoàn tất của CONG_VIEC_73 lát L4).
        saleInput: { ipos: { deviceId: actor.device.deviceId, shiftId: shift.id, memberId: actor.memberId, approvedBy, lines: input.lines, invoiceDiscount: input.invoiceDiscount } },
      });
      if (created.created) await transaction.execute(sql`INSERT INTO ipos.shift_links (shift_id, instore_checkout_id) VALUES (${shift.id}, ${created.checkout.id})`);
      return { checkout: created.checkout, qrToken: created.created ? created.qrToken : null };
    });
    return this.view(row.checkout, row.qrToken);
  }

  private async ownCheckout(actor: IposPosActor, id: string): Promise<CheckoutRow> {
    const row = await this.checkouts.find(this.database, id);
    const link = (await this.database.execute<{ register_id: string }>(sql`
      SELECT sh.register_id FROM ipos.shift_links l JOIN ipos.shifts sh ON sh.id = l.shift_id WHERE l.instore_checkout_id = ${id}`)).rows[0];
    if (!row || !link || link.register_id !== actor.device.registerId) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async view(row: CheckoutRow, qrToken: string | null): Promise<IposVcommCheckout> {
    const buyer = row.buyer_user_id ? (await this.database.execute<{ full_name: string }>(sql`SELECT full_name FROM core.users WHERE id = ${row.buyer_user_id}`)).rows[0] : undefined;
    const sale = (await this.database.execute<{ ipos_invoice_id: string | null }>(sql`SELECT ipos_invoice_id FROM instore.checkouts WHERE id = ${row.id}`)).rows[0];
    return {
      id: row.id,
      documentNo: row.document_no,
      status: row.status,
      billAmount: String(Number(row.bill_amount)),
      qrUrl: qrToken ? `${appWebBase()}/tt/${qrToken}` : null,
      expiresAt: new Date(row.expires_at).toISOString(),
      buyerName: maskName(buyer?.full_name ?? null),
      saleId: sale?.ipos_invoice_id ?? null,
      // Máy chủ đã nối móc hoàn tất; màn hình chờ khách trả trên máy bán nối khi CONG_VIEC_73 xong giao diện lát L4.
      completionAvailable: true,
    };
  }

  async checkout(actor: IposPosActor, id: string): Promise<IposVcommCheckout> {
    return this.view(await this.ownCheckout(actor, id), null);
  }

  // Luồng 1: thu ngân quét mã thanh toán động 18 số của khách (QUYTAC_NGHIEPVU_576).
  async attachPayCode(actor: IposPosActor, id: string, code: string): Promise<IposVcommCheckout> {
    await this.ownCheckout(actor, id);
    const company = (await this.database.execute<{ company_id: string }>(sql`SELECT company_id FROM affiliate.merchants WHERE id = ${actor.device.merchantId}`)).rows[0]!;
    return this.view(await this.checkouts.attachPayCode(id, code, { subject: `scan:${actor.userId}`, companyId: company.company_id }), null);
  }

  async cancelCheckout(actor: IposPosActor, id: string): Promise<IposVcommCheckout> {
    await this.ownCheckout(actor, id);
    const row = await this.checkouts.cancel(id, actor.userId, "Thu ngân hủy trên máy bán iPOS");
    await this.database.execute(sql`DELETE FROM ipos.shift_links WHERE instore_checkout_id = ${id} AND sale_id IS NULL`);
    return this.view(row, null);
  }
}

// Ca còn giao dịch điểm đã hoàn tất chưa gắn hóa đơn, hoặc đơn chờ ứng dụng VComm chưa kết thúc thì chưa đóng được (QUYTAC_NGHIEPVU_623 khoản 1).
export async function openLinks(executor: Executor, shiftId: string): Promise<number> {
  const rows = await executor.execute<{ total: number }>(sql`
    SELECT count(*)::int AS total FROM ipos.shift_links l
    LEFT JOIN affiliate.transactions t ON t.id = l.affiliate_transaction_id
    LEFT JOIN instore.checkouts c ON c.id = l.instore_checkout_id
    WHERE l.shift_id = ${shiftId} AND l.sale_id IS NULL
      AND ((t.id IS NOT NULL AND t.status = 'completed') OR (t.id IS NOT NULL AND t.status = 'pending' AND t.expires_at > now())
        OR (c.id IS NOT NULL AND c.status IN ('awaiting_buyer', 'awaiting_payment', 'paid_unposted') AND c.expires_at > now()))`);
  return rows.rows[0]!.total;
}
