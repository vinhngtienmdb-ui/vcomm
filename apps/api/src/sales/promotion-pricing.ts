// Áp khuyến mãi vào dòng đơn bán khi lưu (CONG_VIEC_12; QUYTAC_NGHIEPVU_81 đến 84). Chỉ đọc chương trình; tiền tính lại trên dòng đã tra giá.
import type { VatRate } from "contracts";
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import { promotionGiftUsage, promotionUsage } from "./promotions.service";

type Reader = Pick<Database, "execute">;

// Dòng đơn bán sau tra giá; trường khuyến mãi điền ở đây.
export interface PricedLine {
  variantId: string;
  unitId: string;
  quantity: string;
  baseQuantity: string;
  priceListId: string | null;
  listPrice: string;
  includesVat: boolean;
  discountPercent: string;
  unitPrice: string;
  vatRate: VatRate;
  net: string;
  tax: string;
  total: string;
  promotionId: string | null;
  promotionPercent: string;
  orderPromotionId: string | null;
  orderDiscountAmount: string;
  promotionDiscountTotal: string;
  isGift: boolean;
  giftSets: number;
}

export type GiftShortage = { promotionName: string; missingSets: number };
type Candidate = {
  id: string;
  name: string;
  kind: "product_discount" | "order_discount" | "buy_get";
  min_order_amount: string | null;
  order_discount_percent: string | null;
  max_order_discount: string | null;
  buy_variant_id: string | null;
  buy_quantity: string | null;
  gift_variant_id: string | null;
  gift_quantity: string | null;
  budget_amount: string | null;
  max_gift_sets: number | null;
  used_amount: string;
  used_gift_sets: number;
};

const vatFraction = (rate: VatRate) => (["0", "5", "8", "10"].includes(rate) ? Number(rate) / 100 : 0);
const round = (value: number) => Number(value.toFixed(4));

// Tiền của dòng theo giá bảng giá, phần trăm khuyến mãi rồi chiết khấu tay (cùng cách tính thuế với bảng giá).
export function lineAmounts(listPrice: string, includesVat: boolean, vatRate: VatRate, quantity: string, promotionPercent: number, manualPercent: string) {
  const rate = vatFraction(vatRate);
  const unitPrice = Number(listPrice) * (1 - promotionPercent / 100) * (1 - Number(manualPercent) / 100);
  const amount = Number(quantity) * round(unitPrice);
  const net = includesVat ? amount / (1 + rate) : amount;
  const total = includesVat ? amount : net * (1 + rate);
  return { unitPrice: unitPrice.toFixed(4), net: round(net), tax: round(total) - round(net), total: round(total) };
}

export function withoutPromotion(
  line: Omit<PricedLine, "promotionId" | "promotionPercent" | "orderPromotionId" | "orderDiscountAmount" | "promotionDiscountTotal" | "isGift" | "giftSets">,
): PricedLine {
  return { ...line, promotionId: null, promotionPercent: "0", orderPromotionId: null, orderDiscountAmount: "0", promotionDiscountTotal: "0", isGift: false, giftSets: 0 };
}

export async function applyPromotions(
  executor: Reader,
  context: { companyId: string; orderId: string | null; channelId: string; customerGroupId: string | null; orderDate: string; internal: boolean; warehouseId: string },
  priced: PricedLine[],
): Promise<{ lines: PricedLine[]; giftShortages: GiftShortage[] }> {
  const lines = priced.map((line) => ({ ...line }));
  const giftShortages: GiftShortage[] = [];
  if (context.internal) return { lines, giftShortages };
  const except = context.orderId ? sql`${context.orderId}::uuid` : sql`NULL::uuid`;
  // Chương trình đang chạy, trong thời gian, đúng kênh (trống: mọi kênh trừ Nội bộ), đúng nhóm khách (trống: mọi khách).
  const candidates = (
    await executor.execute<Candidate>(sql`
    SELECT p.id, p.name, p.kind, p.min_order_amount::text, p.order_discount_percent::text, p.max_order_discount::text, p.buy_variant_id, p.buy_quantity::text, p.gift_variant_id,
      p.gift_quantity::text, p.budget_amount::text, p.max_gift_sets, ${promotionUsage(sql`p.id`, except)}::text AS used_amount, ${promotionGiftUsage(sql`p.id`, except)} AS used_gift_sets
    FROM sales.promotions p
    WHERE p.company_id = ${context.companyId} AND p.status = 'active' AND ${context.orderDate}::date BETWEEN p.valid_from AND p.valid_to
      AND (EXISTS (SELECT 1 FROM sales.promotion_channels c WHERE c.promotion_id = p.id AND c.channel_id = ${context.channelId})
        OR (NOT EXISTS (SELECT 1 FROM sales.promotion_channels c WHERE c.promotion_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM catalog.sales_channels ch WHERE ch.id = ${context.channelId} AND ch.code = 'NOI_BO')))
      AND (NOT EXISTS (SELECT 1 FROM sales.promotion_customer_groups g WHERE g.promotion_id = p.id)
        OR EXISTS (SELECT 1 FROM sales.promotion_customer_groups g WHERE g.promotion_id = p.id AND g.customer_group_id = ${context.customerGroupId}))
    ORDER BY p.created_at, p.id`)
  ).rows;
  if (candidates.length === 0) return { lines, giftShortages };
  const remaining = (candidate: Candidate) => (candidate.budget_amount === null ? Infinity : Number(candidate.budget_amount) - Number(candidate.used_amount));

  // Giảm theo sản phẩm: mỗi dòng phần trăm cao nhất; chương trình không đủ ngân sách cho cả đơn thì bỏ, chọn lại.
  const productCandidates = candidates.filter((candidate) => candidate.kind === "product_discount");
  const percents = new Map<string, Map<string, number>>();
  if (productCandidates.length > 0) {
    const items = await executor.execute<{ promotion_id: string; variant_id: string; discount_percent: string }>(sql`
      SELECT promotion_id, variant_id, discount_percent::text FROM sales.promotion_items
      WHERE promotion_id IN (${sql.join(
        productCandidates.map((candidate) => sql`${candidate.id}::uuid`),
        sql`, `,
      )})`);
    for (const item of items.rows) {
      const byVariant = percents.get(item.promotion_id) ?? new Map<string, number>();
      byVariant.set(item.variant_id, Number(item.discount_percent));
      percents.set(item.promotion_id, byVariant);
    }
  }
  const excluded = new Set<string>();
  for (;;) {
    for (const line of lines) {
      let best: { id: string; percent: number } | null = null;
      for (const candidate of productCandidates) {
        if (excluded.has(candidate.id)) continue;
        const percent = percents.get(candidate.id)?.get(line.variantId);
        if (percent !== undefined && (!best || percent > best.percent)) best = { id: candidate.id, percent };
      }
      const base = lineAmounts(line.listPrice, line.includesVat, line.vatRate, line.quantity, 0, line.discountPercent);
      const amounts = lineAmounts(line.listPrice, line.includesVat, line.vatRate, line.quantity, best?.percent ?? 0, line.discountPercent);
      Object.assign(line, {
        unitPrice: amounts.unitPrice,
        net: amounts.net.toFixed(4),
        tax: amounts.tax.toFixed(4),
        total: amounts.total.toFixed(4),
        promotionId: best?.id ?? null,
        promotionPercent: String(best?.percent ?? 0),
        promotionDiscountTotal: round(base.total - amounts.total).toFixed(4),
      });
    }
    const overBudget = productCandidates.find(
      (candidate) =>
        !excluded.has(candidate.id) && lines.filter((line) => line.promotionId === candidate.id).reduce((sum, line) => sum + Number(line.promotionDiscountTotal), 0) > remaining(candidate) + 0.00005,
    );
    if (!overBudget) break;
    excluded.add(overBudget.id);
  }

  // Giảm theo đơn: tổng sau giảm theo sản phẩm đạt ngưỡng; chọn số tiền giảm lớn nhất còn đủ ngân sách; chia theo tỷ lệ thành tiền gồm thuế.
  const orderTotal = lines.reduce((sum, line) => sum + Number(line.total), 0);
  let orderBest: { id: string; amount: number } | null = null;
  for (const candidate of candidates.filter((item) => item.kind === "order_discount")) {
    if (orderTotal + 0.00005 < Number(candidate.min_order_amount)) continue;
    let amount = round((orderTotal * Number(candidate.order_discount_percent)) / 100);
    if (candidate.max_order_discount !== null) amount = Math.min(amount, Number(candidate.max_order_discount));
    if (amount <= 0 || amount > remaining(candidate) + 0.00005) continue;
    if (!orderBest || amount > orderBest.amount) orderBest = { id: candidate.id, amount };
  }
  const chosen = orderBest;
  if (chosen && orderTotal > 0) {
    let left = chosen.amount;
    // Phần dư làm tròn dồn vào dòng cuối có thành tiền; dòng thành tiền 0 không nhận phần giảm.
    const lastPaid = lines.reduce((found, line, index) => (Number(line.total) > 0 ? index : found), -1);
    lines.forEach((line, index) => {
      if (Number(line.total) <= 0) return;
      const share = index === lastPaid ? left : round((chosen.amount * Number(line.total)) / orderTotal);
      left = round(left - share);
      const total = round(Number(line.total) - share);
      const net = round(total / (1 + vatFraction(line.vatRate)));
      Object.assign(line, {
        total: total.toFixed(4),
        net: net.toFixed(4),
        tax: round(total - net).toFixed(4),
        orderPromotionId: chosen.id,
        orderDiscountAmount: share.toFixed(4),
        promotionDiscountTotal: round(Number(line.promotionDiscountTotal) + share).toFixed(4),
      });
    });
  }

  // Mua X tặng Y: số suất theo tổng số lượng cơ sở mặt hàng mua, không quá số suất còn lại; dòng tặng giá 0 theo đơn vị cơ sở.
  for (const candidate of candidates.filter((item) => item.kind === "buy_get")) {
    // Chỉ đếm hàng mua, không đếm dòng tặng của chương trình khác.
    const bought = lines.filter((line) => !line.isGift && line.variantId === candidate.buy_variant_id).reduce((sum, line) => sum + Number(line.baseQuantity), 0);
    let sets = Math.floor((bought + 0.00005) / Number(candidate.buy_quantity));
    if (candidate.max_gift_sets !== null) sets = Math.min(sets, candidate.max_gift_sets - Number(candidate.used_gift_sets));
    if (sets <= 0) continue;
    const gift = (
      await executor.execute<{ base_unit_id: string; vat_rate: VatRate }>(sql`
      SELECT p.base_unit_id, p.vat_rate FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
      WHERE v.id = ${candidate.gift_variant_id} AND v.company_id = ${context.companyId} AND v.status = 'active' AND p.status = 'active'`)
    ).rows[0];
    if (!gift) continue;
    // Tặng theo tồn còn lại của hàng tặng tại kho xuất (trừ phần đang giữ cho đơn khác và phần đơn này đã dùng); thiếu thì ghi số suất thiếu.
    const stock = (
      await executor.execute<{ available: string }>(sql`
      SELECT (coalesce((SELECT quantity FROM inventory.costs WHERE warehouse_id = ${context.warehouseId} AND company_id = ${context.companyId} AND variant_id = ${candidate.gift_variant_id}), 0)
        - coalesce((SELECT sum(quantity) FROM inventory.reservations WHERE warehouse_id = ${context.warehouseId} AND company_id = ${context.companyId}
            AND variant_id = ${candidate.gift_variant_id} AND status = 'active' AND NOT (source_type = 'sales.order' AND source_id IS NOT DISTINCT FROM ${except})), 0))::text AS available`)
    ).rows[0]!;
    const usedHere = lines.filter((line) => line.variantId === candidate.gift_variant_id).reduce((sum, line) => sum + Number(line.baseQuantity), 0);
    const affordable = Math.max(0, Math.floor((Number(stock.available) - usedHere + 0.00005) / Number(candidate.gift_quantity)));
    if (affordable < sets) {
      giftShortages.push({ promotionName: candidate.name, missingSets: sets - affordable });
      sets = affordable;
    }
    if (sets <= 0) continue;
    const quantity = (sets * Number(candidate.gift_quantity)).toFixed(4);
    lines.push({
      variantId: candidate.gift_variant_id!,
      unitId: gift.base_unit_id,
      quantity,
      baseQuantity: quantity,
      priceListId: null,
      listPrice: "0",
      includesVat: false,
      discountPercent: "0",
      unitPrice: "0",
      vatRate: gift.vat_rate,
      net: "0",
      tax: "0",
      total: "0",
      promotionId: candidate.id,
      promotionPercent: "0",
      orderPromotionId: null,
      orderDiscountAmount: "0",
      promotionDiscountTotal: "0",
      isGift: true,
      giftSets: sets,
    });
  }
  return { lines, giftShortages };
}
