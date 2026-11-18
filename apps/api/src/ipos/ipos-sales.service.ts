// Máy bán iPOS: ghi, tra hóa đơn bán lẻ, ghi lần in (CONG_VIEC_74; CHUC_NANG_256; QUYTAC_NGHIEPVU_611, 613, 615, 617 đến 620; API_340).
// Một giao dịch: hóa đơn (số theo điểm bán, ngày), dòng hàng (giá vốn tại thời điểm bán), dòng thanh toán, trừ tồn, gắn ca.
// Gửi lại cùng khóa yêu cầu (kể cả song song) trả hóa đơn đã ghi.
import { Inject, Injectable } from "@nestjs/common";
import { iposComputeTotals, type IposDiscountInput, type IposPricedLine, type IposSale, type IposSaleCreateInput, type IposSaleRow, type IposTotals, type IposVatRate } from "contracts";
import { sql } from "drizzle-orm";
import { maskName } from "../affiliate/transactions.service";
import { ApiError } from "../common/api-error";
import { CLOCK, vietnamDate, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "./ipos-catalog.service";
import type { IposPosActor } from "./ipos-device-context";
import { loadSettings } from "./ipos-settings.service";
import { consumeApproval, openShiftOf, requireSelling } from "./ipos-shifts.service";

// Tính tiền theo hàm dùng chung trong contracts; giảm vượt tiền hàng thì từ chối.
export function computeTotals(lines: IposPricedLine[], invoiceDiscount: IposDiscountInput | null): IposTotals {
  const totals = iposComputeTotals(lines, invoiceDiscount);
  if (totals.error) throw new ApiError("BUSINESS_RULE", "iposDiscountTooLarge");
  return totals;
}

// Thuế giá trị gia tăng tách từ tiền đã gồm thuế, theo suất (chỉ để in, báo cáo).
export function taxesOf(lines: { vatRate: IposVatRate; amount: number }[]): { vatRate: IposVatRate; amount: string; tax: string }[] {
  const groups = new Map<IposVatRate, number>();
  for (const line of lines) groups.set(line.vatRate, (groups.get(line.vatRate) ?? 0) + line.amount);
  return [...groups.entries()]
    .sort(([left], [right]) => (left === "exempt" ? 1 : right === "exempt" ? -1 : Number(left) - Number(right)))
    .map(([vatRate, amount]) => ({ vatRate, amount: String(amount), tax: String(vatRate === "exempt" ? 0 : Math.round((amount * Number(vatRate)) / (100 + Number(vatRate)))) }));
}

type LoyaltyRow = { id: string; buyer_user_id: string; paid_amount: string; redeemed_amount: string; voucher_discount: string; skip_reason: string | null };

// Giao dịch điểm do máy bán này lập trong ca đang mở, đã hoàn tất, đúng tiền hóa đơn, chưa gắn hóa đơn khác.
export async function linkableLoyalty(executor: Executor, actor: IposPosActor, id: string, total: number): Promise<LoyaltyRow> {
  const row = (
    await executor.execute<LoyaltyRow & { status: string; bill_amount: string; outlet_id: string; linked: boolean; shift_member: string | null }>(sql`
      SELECT t.id, t.buyer_user_id, t.paid_amount::text, t.redeemed_amount::text, t.voucher_discount::text, t.skip_reason, t.status, t.bill_amount::text, t.outlet_id,
        EXISTS (SELECT 1 FROM ipos.sale_payments p WHERE p.affiliate_transaction_id = t.id) AS linked,
        (SELECT sh.member_id FROM ipos.shift_links l JOIN ipos.shifts sh ON sh.id = l.shift_id WHERE l.affiliate_transaction_id = t.id) AS shift_member
      FROM affiliate.transactions t WHERE t.id = ${id} AND t.merchant_id = ${actor.device.merchantId} FOR UPDATE OF t`)
  ).rows[0];
  if (!row || row.outlet_id !== actor.device.outletId || row.shift_member !== actor.memberId) throw new ApiError("NOT_FOUND", "notFound");
  if (row.status !== "completed" || row.linked) throw new ApiError("BUSINESS_RULE", "iposLoyaltyNotUsable");
  if (Number(row.bill_amount) !== total) throw new ApiError("BUSINESS_RULE", "iposLoyaltyAmountMismatch");
  return row;
}

export type SaleVariant = { id: string; item_code: string; variant_code: string; name: string; unit: string; price: string; vat_rate: IposVatRate; track_stock: boolean; active: boolean };

// Biến thể của các dòng hóa đơn kèm giá tại điểm bán (giá riêng điểm bán, giá biến thể, giá mặt hàng).
export async function loadSaleVariants(executor: Executor, merchantId: string, outletId: string, variantIds: string[]): Promise<Map<string, SaleVariant>> {
  const variants = await executor.execute<SaleVariant>(sql`
    SELECT v.id, i.code AS item_code, v.code AS variant_code, i.unit, i.vat_rate, i.track_stock, (v.status = 'active' AND i.status = 'active') AS active,
      i.name || COALESCE(' – ' || v.attribute1_value, '') || COALESCE(' / ' || v.attribute2_value, '') AS name,
      COALESCE(op.price, v.price, i.price)::text AS price
    FROM ipos.item_variants v JOIN ipos.items i ON i.id = v.item_id
    LEFT JOIN ipos.outlet_prices op ON op.variant_id = v.id AND op.outlet_id = ${outletId}
    WHERE v.merchant_id = ${merchantId} AND v.id IN (${sql.join(variantIds.map((variantId) => sql`${variantId}`), sql`, `)})`);
  return new Map(variants.rows.map((row) => [row.id, row]));
}

export interface SaleWriteContext {
  device: { merchantId: string; outletId: string; registerId: string; deviceId: string };
  shiftId: string;
  memberId: string;
  userId: string;
  now: Date;
  idempotencyKey: string;
  lines: IposSaleCreateInput["lines"];
  byId: Map<string, SaleVariant>;
  totals: IposTotals;
  approvedBy: string | null;
  blockNegativeStock: boolean;
}

// Ghi hóa đơn, dòng hàng, trừ tồn (chưa ghi dòng thanh toán). Dùng khi máy bán ghi hóa đơn và khi đơn chờ ứng dụng VComm hoàn tất (móc của CONG_VIEC_73).
export async function writeSale(transaction: Executor, context: SaleWriteContext): Promise<{ saleId: string; documentNo: string }> {
  const today = vietnamDate(context.now);
  // Số hóa đơn `<mã điểm bán>-<YYMMDD>-<4 số>`; khóa dòng đếm theo (điểm bán, ngày) nên nhiều quầy cùng lúc không trùng (QUYTAC_NGHIEPVU_619).
  const outlet = (await transaction.execute<{ code: string | null }>(sql`SELECT code FROM affiliate.outlets WHERE id = ${context.device.outletId}`)).rows[0]!;
  if (!outlet.code) throw new ApiError("BUSINESS_RULE", "iposOutletCodeMissing");
  const sequence = await transaction.execute<{ last_number: number }>(sql`
    INSERT INTO ipos.document_sequences (outlet_id, day, kind, last_number) VALUES (${context.device.outletId}, ${today}, 'sale', 1)
    ON CONFLICT (outlet_id, day, kind) DO UPDATE SET last_number = ipos.document_sequences.last_number + 1
    RETURNING last_number`);
  const documentNo = `${outlet.code}-${today.slice(2).replaceAll("-", "")}-${String(sequence.rows[0]!.last_number).padStart(4, "0")}`;
  const sale = await transaction.execute<{ id: string }>(sql`
    INSERT INTO ipos.sales (merchant_id, outlet_id, register_id, device_id, shift_id, member_id, document_no, idempotency_key, subtotal, line_discount,
      invoice_discount, total, discount_approved_by, sold_at)
    VALUES (${context.device.merchantId}, ${context.device.outletId}, ${context.device.registerId}, ${context.device.deviceId}, ${context.shiftId}, ${context.memberId}, ${documentNo},
      ${context.idempotencyKey}, ${context.totals.subtotal}, ${context.totals.lineDiscount}, ${context.totals.invoiceDiscount}, ${context.totals.total}, ${context.approvedBy}, ${context.now})
    RETURNING id`);
  const saleId = sale.rows[0]!.id;

  // Trừ tồn mặt hàng theo dõi tồn kho; khóa dòng tồn theo thứ tự biến thể. Chặn tồn âm theo cài đặt (QUYTAC_NGHIEPVU_611 khoản 2).
  const tracked = [...new Set(context.lines.filter((line) => context.byId.get(line.variantId)!.track_stock).map((line) => line.variantId))].sort();
  const balances = new Map<string, { quantity: number; averageCost: string }>();
  if (tracked.length > 0) {
    await transaction.execute(sql`
      INSERT INTO ipos.stock_balances (outlet_id, variant_id, merchant_id)
      SELECT ${context.device.outletId}::uuid, id, ${context.device.merchantId}::uuid FROM unnest(ARRAY[${sql.join(tracked.map((variantId) => sql`${variantId}::uuid`), sql`, `)}]) AS id
      ON CONFLICT (outlet_id, variant_id) DO NOTHING`);
    const rows = await transaction.execute<{ variant_id: string; quantity: string; average_cost: string }>(sql`
      SELECT variant_id, quantity::text, average_cost::text FROM ipos.stock_balances
      WHERE outlet_id = ${context.device.outletId} AND variant_id IN (${sql.join(tracked.map((variantId) => sql`${variantId}`), sql`, `)})
      ORDER BY variant_id FOR UPDATE`);
    for (const row of rows.rows) balances.set(row.variant_id, { quantity: Number(row.quantity), averageCost: row.average_cost });
    if (context.blockNegativeStock) {
      const needed = new Map<string, number>();
      for (const line of context.lines) if (balances.has(line.variantId)) needed.set(line.variantId, (needed.get(line.variantId) ?? 0) + Number(line.quantity));
      for (const [variantId, quantity] of needed) if (balances.get(variantId)!.quantity < quantity - 1e-9) throw new ApiError("BUSINESS_RULE", "iposStockNegativeBlocked");
    }
  }
  for (const [index, line] of context.lines.entries()) {
    const variant = context.byId.get(line.variantId)!;
    const amounts = context.totals.lines[index]!;
    const balance = balances.get(line.variantId);
    await transaction.execute(sql`
      INSERT INTO ipos.sale_lines (sale_id, line_no, variant_id, item_code, variant_code, name, unit, quantity, unit_price, gross, discount, allocated_discount, amount, vat_rate, unit_cost)
      VALUES (${saleId}, ${index + 1}, ${line.variantId}, ${variant.item_code}, ${variant.variant_code}, ${variant.name}, ${variant.unit}, ${line.quantity}, ${line.unitPrice},
        ${amounts.gross}, ${amounts.discount}, ${amounts.allocated}, ${amounts.amount}, ${variant.vat_rate}, ${balance?.averageCost ?? null})`);
    if (!balance) continue;
    const updated = await transaction.execute<{ quantity: string }>(sql`
      UPDATE ipos.stock_balances SET quantity = quantity - ${line.quantity}::numeric, updated_at = now()
      WHERE outlet_id = ${context.device.outletId} AND variant_id = ${line.variantId} RETURNING quantity::text`);
    await transaction.execute(sql`
      INSERT INTO ipos.stock_moves (merchant_id, outlet_id, variant_id, quantity, unit_cost, balance_after, source_type, source_id, source_number, created_by, occurred_at)
      VALUES (${context.device.merchantId}, ${context.device.outletId}, ${line.variantId}, ${`-${line.quantity}`}, ${balance.averageCost}, ${updated.rows[0]!.quantity}, 'sale',
        ${saleId}, ${documentNo}, ${context.userId}, ${context.now})`);
  }
  return { saleId, documentNo };
}

@Injectable()
export class IposSalesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async existing(executor: Executor, deviceId: string, key: string): Promise<string | null> {
    return (await executor.execute<{ id: string }>(sql`SELECT id FROM ipos.sales WHERE device_id = ${deviceId} AND idempotency_key = ${key}`)).rows[0]?.id ?? null;
  }

  async create(actor: IposPosActor, input: IposSaleCreateInput): Promise<IposSale> {
    const now = this.clock.now();
    const today = vietnamDate(now);
    const id = await this.database.transaction(async (transaction) => {
      // Hai yêu cầu cùng khóa chờ nhau; yêu cầu sau thấy hóa đơn yêu cầu trước đã ghi.
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ipos-sale:${actor.device.deviceId}:${input.idempotencyKey}`}))`);
      const found = await this.existing(transaction, actor.device.deviceId, input.idempotencyKey);
      if (found) return found;
      await requireSelling(transaction, actor, today);
      const shift = await openShiftOf(transaction, actor, input.shiftId);
      const settings = await loadSettings(transaction, actor.device.merchantId);
      const byId = await loadSaleVariants(transaction, actor.device.merchantId, actor.device.outletId, input.lines.map((line) => line.variantId));
      // Giá khi thanh toán lấy theo máy chủ; khác giá trên máy thì báo để máy đồng bộ lại (QUYTAC_NGHIEPVU_609).
      for (const line of input.lines) {
        const variant = byId.get(line.variantId);
        if (!variant || !variant.active) throw new ApiError("BUSINESS_RULE", "iposItemUnavailable");
        if (variant.price !== line.unitPrice) throw new ApiError("BUSINESS_RULE", "iposPriceChanged");
      }
      const totals = computeTotals(
        input.lines.map((line) => ({ quantity: line.quantity, unitPrice: Number(line.unitPrice), discount: line.discount })),
        input.invoiceDiscount,
      );
      // Giảm vượt mức của thu ngân cần chủ cửa hàng duyệt bằng PIN (mã duyệt dùng một lần); chủ tự bán thì không cần.
      let approvedBy: string | null = null;
      if (actor.role !== "owner" && totals.discountPercent > Number(settings.cashierMaxDiscountPercent) + 1e-9) {
        if (!input.approvalCode) throw new ApiError("BUSINESS_RULE", "iposDiscountNeedsApproval");
        approvedBy = await consumeApproval(transaction, actor.device.deviceId, input.approvalCode, "discount", now);
      }
      // Điểm, voucher của khách VComm (giao dịch `LK…` đã hoàn tất cho đúng tiền hóa đơn); phần còn lại thu tiền mặt, VietQR.
      const loyalty = input.affiliateTransactionId ? await linkableLoyalty(transaction, actor, input.affiliateTransactionId, totals.total) : null;
      const due = loyalty ? Number(loyalty.paid_amount) : totals.total;
      const cash = input.payments.find((payment) => payment.method === "cash");
      const vietqr = input.payments.find((payment) => payment.method === "vietqr");
      const vietqrAmount = vietqr ? Number(vietqr.amount) : 0;
      if (vietqr && (vietqrAmount <= 0 || vietqrAmount > due)) throw new ApiError("BUSINESS_RULE", "iposVietqrAmountInvalid");
      if (vietqr && !settings.vietqrAccountNo) throw new ApiError("BUSINESS_RULE", "iposVietqrNotConfigured");
      const cashAmount = due - vietqrAmount;
      if (cashAmount > 0 && (!cash || Number(cash.tendered) < cashAmount)) throw new ApiError("BUSINESS_RULE", "iposTenderedTooLow");

      const { saleId } = await writeSale(transaction, {
        device: actor.device,
        shiftId: shift.id,
        memberId: actor.memberId,
        userId: actor.userId,
        now,
        idempotencyKey: input.idempotencyKey,
        lines: input.lines,
        byId,
        totals,
        approvedBy,
        blockNegativeStock: settings.blockNegativeStock,
      });
      if (cash || cashAmount > 0) {
        await transaction.execute(sql`INSERT INTO ipos.sale_payments (sale_id, method, amount, tendered) VALUES (${saleId}, 'cash', ${cashAmount}, ${cash?.tendered ?? String(cashAmount)})`);
      }
      if (vietqr) {
        // Thu ngân đã kiểm tài khoản ngân hàng của cửa hàng, bấm "Đã nhận tiền"; ghi người xác nhận (QUYTAC_NGHIEPVU_615 khoản 4).
        await transaction.execute(sql`
          INSERT INTO ipos.sale_payments (sale_id, method, amount, vietqr_reference, confirmed_by) VALUES (${saleId}, 'vietqr', ${vietqrAmount}, ${vietqr.reference}, ${actor.memberId})`);
      }
      if (loyalty) {
        if (Number(loyalty.redeemed_amount) > 0) {
          await transaction.execute(sql`
            INSERT INTO ipos.sale_payments (sale_id, method, amount, affiliate_transaction_id) VALUES (${saleId}, 'points', ${loyalty.redeemed_amount}, ${loyalty.id})`);
        }
        if (Number(loyalty.voucher_discount) > 0) {
          await transaction.execute(sql`
            INSERT INTO ipos.sale_payments (sale_id, method, amount, affiliate_transaction_id) VALUES (${saleId}, 'voucher', ${loyalty.voucher_discount}, ${loyalty.id})`);
        }
        // Chỉ tích điểm (không dùng điểm, voucher) vẫn gắn giao dịch vào hóa đơn qua dòng tiền mặt, VietQR.
        if (Number(loyalty.redeemed_amount) + Number(loyalty.voucher_discount) === 0) {
          await transaction.execute(sql`
            UPDATE ipos.sale_payments SET affiliate_transaction_id = ${loyalty.id} WHERE id = (SELECT id FROM ipos.sale_payments WHERE sale_id = ${saleId} ORDER BY created_at LIMIT 1)`);
        }
        await transaction.execute(sql`UPDATE ipos.sales SET buyer_user_id = ${loyalty.buyer_user_id}, loyalty_skip_reason = ${loyalty.skip_reason} WHERE id = ${saleId}`);
        await transaction.execute(sql`UPDATE ipos.shift_links SET sale_id = ${saleId} WHERE affiliate_transaction_id = ${loyalty.id}`);
      }
      return saleId;
    });
    return this.detail(actor, id);
  }

  async list(actor: IposPosActor, shiftId: string, search: string | undefined): Promise<IposSaleRow[]> {
    const rows = await this.database.execute<{ id: string; document_no: string; sold_at: Date; total: string; line_count: number; member_name: string; status: "completed" | "cancelled" }>(sql`
      SELECT s.id, s.document_no, s.sold_at, s.total::text, mb.full_name AS member_name, s.status,
        (SELECT count(*)::int FROM ipos.sale_lines l WHERE l.sale_id = s.id) AS line_count
      FROM ipos.sales s JOIN affiliate.members mb ON mb.id = s.member_id
      WHERE s.shift_id = ${shiftId} AND s.register_id = ${actor.device.registerId}
        ${search ? sql`AND s.document_no ILIKE ${`%${search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`}` : sql``}
      ORDER BY s.sold_at DESC LIMIT 500`);
    return rows.rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      soldAt: new Date(row.sold_at).toISOString(),
      total: row.total,
      lineCount: row.line_count,
      memberName: row.member_name,
      status: row.status,
    }));
  }

  // Chi tiết hóa đơn của điểm bán của thiết bị (để in, in lại).
  async detail(actor: IposPosActor, id: string): Promise<IposSale> {
    const found = await this.database.execute(sql`SELECT 1 FROM ipos.sales WHERE id = ${id} AND outlet_id = ${actor.device.outletId}`);
    if (found.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    return this.detailForMerchant(actor.device.merchantId, id);
  }

  // Chi tiết hóa đơn trong phạm vi cửa hàng (trả hàng ở điểm bán khác của cửa hàng, cổng cửa hàng).
  async detailForMerchant(merchantId: string, id: string): Promise<IposSale> {
    const row = (
      await this.database.execute<{
        id: string;
        document_no: string;
        sold_at: Date;
        merchant_name: string;
        outlet_name: string;
        address: string;
        register_name: string;
        member_name: string;
        subtotal: string;
        line_discount: string;
        invoice_discount: string;
        total: string;
        approved_by_name: string | null;
        print_count: number;
        status: "completed" | "cancelled";
        loyalty_skip_reason: string | null;
      }>(sql`
        SELECT s.id, s.document_no, s.sold_at, p.name AS merchant_name, o.name AS outlet_name, o.address, r.name AS register_name, mb.full_name AS member_name,
          s.subtotal::text, s.line_discount::text, s.invoice_discount::text, s.total::text, ap.full_name AS approved_by_name, s.print_count, s.status, s.loyalty_skip_reason
        FROM ipos.sales s JOIN affiliate.outlets o ON o.id = s.outlet_id JOIN affiliate.merchants m ON m.id = s.merchant_id JOIN crm.partners p ON p.id = m.partner_id
        JOIN ipos.registers r ON r.id = s.register_id JOIN affiliate.members mb ON mb.id = s.member_id LEFT JOIN affiliate.members ap ON ap.id = s.discount_approved_by
        WHERE s.id = ${id} AND s.merchant_id = ${merchantId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const lines = await this.database.execute<{
      line_no: number;
      variant_id: string;
      item_code: string;
      variant_code: string;
      name: string;
      unit: string;
      quantity: string;
      unit_price: string;
      gross: string;
      discount: string;
      allocated_discount: string;
      amount: string;
      vat_rate: IposVatRate;
    }>(sql`
      SELECT line_no, variant_id, item_code, variant_code, name, unit, trim_scale(quantity)::text AS quantity, unit_price::text, gross::text, discount::text,
        allocated_discount::text, amount::text, vat_rate
      FROM ipos.sale_lines WHERE sale_id = ${id} ORDER BY line_no`);
    const payments = await this.database.execute<{ method: IposSale["payments"][number]["method"]; amount: string; tendered: string | null; vietqr_reference: string | null; link_number: string | null }>(sql`
      SELECT p.method, p.amount::text, p.tendered::text, p.vietqr_reference, COALESCE(t.document_no, c.document_no) AS link_number
      FROM ipos.sale_payments p LEFT JOIN affiliate.transactions t ON t.id = p.affiliate_transaction_id LEFT JOIN instore.checkouts c ON c.id = p.instore_checkout_id
      WHERE p.sale_id = ${id} ORDER BY p.created_at, p.method`);
    const loyalty = (
      await this.database.execute<{ full_name: string | null; earned_points: number | null; redeemed_points: number | null }>(sql`
        SELECT u.full_name, t.earned_points, t.redeemed_points
        FROM ipos.sales s LEFT JOIN core.users u ON u.id = s.buyer_user_id
        LEFT JOIN affiliate.transactions t ON t.id = (SELECT affiliate_transaction_id FROM ipos.sale_payments WHERE sale_id = s.id AND affiliate_transaction_id IS NOT NULL LIMIT 1)
        WHERE s.id = ${id}`)
    ).rows[0];
    const settings = await loadSettings(this.database, merchantId);
    const change = payments.rows.reduce((sum, payment) => sum + (payment.tendered === null ? 0 : Number(payment.tendered) - Number(payment.amount)), 0);
    return {
      id: row.id,
      documentNo: row.document_no,
      soldAt: new Date(row.sold_at).toISOString(),
      merchantName: row.merchant_name,
      outletName: row.outlet_name,
      outletAddress: row.address,
      registerName: row.register_name,
      memberName: row.member_name,
      lines: lines.rows.map((line) => ({
        lineNo: line.line_no,
        variantId: line.variant_id,
        itemCode: line.item_code,
        variantCode: line.variant_code,
        name: line.name,
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        gross: line.gross,
        discount: line.discount,
        allocatedDiscount: line.allocated_discount,
        amount: line.amount,
        vatRate: line.vat_rate,
      })),
      subtotal: row.subtotal,
      lineDiscount: row.line_discount,
      invoiceDiscount: row.invoice_discount,
      total: row.total,
      taxes: taxesOf(lines.rows.map((line) => ({ vatRate: line.vat_rate, amount: Number(line.amount) }))),
      payments: payments.rows.map((payment) => ({ method: payment.method, amount: payment.amount, tendered: payment.tendered, vietqrReference: payment.vietqr_reference, linkNumber: payment.link_number })),
      change: String(change),
      discountApprovedByName: row.approved_by_name,
      printCount: row.print_count,
      status: row.status,
      receiptFooter: settings.receiptFooter,
      buyerName: maskName(loyalty?.full_name ?? null),
      earnedPoints: loyalty?.earned_points ?? 0,
      redeemedPoints: loyalty?.redeemed_points ?? 0,
      loyaltySkipReason: row.loyalty_skip_reason,
    };
  }

  // Ghi lần in: lần đầu tăng số lần in; in lại tăng số lần in và ghi nhật ký in lại (mẫu in hiện "In lại lần n").
  async logPrint(actor: IposPosActor, id: string, reprint: boolean): Promise<IposSale> {
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`UPDATE ipos.sales SET print_count = print_count + 1 WHERE id = ${id} AND outlet_id = ${actor.device.outletId}`);
      if (!updated.rowCount) throw new ApiError("NOT_FOUND", "notFound");
      if (reprint) {
        await transaction.execute(sql`
          INSERT INTO ipos.device_events (merchant_id, device_id, member_id, kind, sale_id) VALUES (${actor.device.merchantId}, ${actor.device.deviceId}, ${actor.memberId}, 'reprint', ${id})`);
      }
    });
    return this.detail(actor, id);
  }
}
