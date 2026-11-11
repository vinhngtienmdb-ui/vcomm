// Bán hàng tại quầy (CONG_VIEC_53; CHUC_NANG_187; QUYTAC_NGHIEPVU_370 đến 374; API_194 đến API_196).
// Giá, khuyến mãi, đơn bán, phiếu xuất, giá vốn, bút toán, hóa đơn điện tử đi qua service của module Bán hàng, Kho (móc nối ghi sổ phiếu kho của Tài chính).
import { Inject, Injectable } from "@nestjs/common";
import type {
  createRetailSaleSchema,
  RetailItemOption,
  RetailPricedLine,
  RetailQuoteResponse,
  retailQuoteSchema,
  RetailSaleListResponse,
  retailSaleListQuerySchema,
  RetailSaleResponse,
  RetailPaymentMethod,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { searchVariantOptions } from "../catalog/variant-search";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "../finance/debts.service";
import { ReservationsService } from "../inventory/reservations.service";
import { SalesDeliveriesService } from "../inventory/sales-deliveries.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { goodsVariants } from "../sales/sales-context";
import { readSettings, SalesOrdersService } from "../sales/sales-orders.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { retailAudit, retailPermissions, retailScope, scopeCondition } from "./retail-context";
import { RetailShiftsService } from "./retail-shifts.service";
import { RetailStoresService, type RetailStore } from "./retail-stores.service";

type QuoteInput = z.output<typeof retailQuoteSchema>;
type SaleInput = z.output<typeof createRetailSaleSchema>;
type ListQuery = z.output<typeof retailSaleListQuerySchema>;
type CartLine = QuoteInput["lines"][number];

const saleTypeCode = "retail.sale";

type PricedRow = {
  variant_id: string;
  sku: string;
  product_name: string;
  unit_id: string;
  unit_name: string;
  quantity: string;
  list_price: string;
  includes_vat: boolean;
  vat_rate: string;
  discount_percent: string;
  promotion_discount_total: string;
  promotion_name: string | null;
  is_gift: boolean;
  tax: string;
  total: string;
};

// Thuế suất dạng chữ: "0", "5", "8", "10"; không chịu thuế, không kê khai coi như 0.
const vatFraction = (rate: string) => (/^\d+(\.\d+)?$/.test(rate) ? Number(rate) / 100 : 0);

@Injectable()
export class RetailSalesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly stores: RetailStoresService,
    private readonly shifts: RetailShiftsService,
    private readonly salesOrders: SalesOrdersService,
    private readonly deliveries: SalesDeliveriesService,
    private readonly reservations: ReservationsService,
  ) {}

  private async counter(executor: Executor, actor: Actor, shiftId: string): Promise<RetailStore> {
    const shift = await this.shifts.requireOwnOpenShift(executor, actor, shiftId);
    return this.stores.store(executor, actor.companyId, shift.store_id);
  }

  // Tìm, quét hàng (API_194): serial còn trong kho bán, mã vạch, mã hàng, tên; chỉ hàng hóa.
  async items(actor: Actor, shiftId: string, search: string): Promise<RetailItemOption[]> {
    return this.database.transaction(async (transaction) => {
      const store = await this.counter(transaction, actor, shiftId);
      const serial = (
        await transaction.execute<{ variant_id: string; serial_no: string }>(sql`
        SELECT variant_id, serial_no FROM inventory.serials
        WHERE company_id = ${actor.companyId} AND warehouse_id = ${store.warehouse_id} AND status = 'in_stock' AND serial_no = ${search}`)
      ).rows[0];
      // Quét trúng serial thì tìm mặt hàng của serial theo mã hàng.
      const sku = serial ? (await transaction.execute<{ sku: string }>(sql`SELECT sku FROM catalog.variants WHERE id = ${serial.variant_id}`)).rows[0]!.sku : null;
      const options = await searchVariantOptions(transaction, actor.companyId, sku ?? search, "goods");
      const found = serial ? options.filter((option) => option.variantId === serial.variant_id) : options;
      const result: RetailItemOption[] = [];
      for (const option of found) {
        result.push({
          variantId: option.variantId,
          sku: option.sku,
          productName: option.productName,
          optionValues: option.optionValues,
          unitId: option.matchedUnitId ?? option.baseUnitId,
          units: option.units,
          tracksLots: option.tracksLots,
          tracksSerials: option.tracksSerials,
          serial: serial?.serial_no ?? null,
          exact: Boolean(serial) || option.matchedUnitId !== null || option.sku === search.toUpperCase(),
          available: trimDecimal(await this.reservations.available(transaction, store.warehouse_id, actor.companyId, option.variantId)),
        });
      }
      return result;
    });
  }

  // Quầy chỉ bán hàng hóa; giảm tay trong mức (QUYTAC_NGHIEPVU_370, 371). Báo lỗi theo dòng để thu ngân sửa đúng chỗ.
  private async validateCart(executor: Executor, companyId: string, lines: CartLine[]): Promise<void> {
    const goods = await goodsVariants(
      executor,
      lines.map((line) => line.variantId),
    );
    const maximum = Number((await readSettings(executor, companyId)).maxManualDiscountPercent);
    const fields: Record<string, "retailGoodsOnly" | "retailDiscountOverLimit"> = {};
    lines.forEach((line, index) => {
      if (!goods.has(line.variantId)) fields[`lines.${index}.variantId`] = "retailGoodsOnly";
      if (Number(line.discountPercent) > maximum + 0.000001) fields[`lines.${index}.discountPercent`] = "retailDiscountOverLimit";
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  // Tiền hàng theo giá bảng giá gồm thuế, khuyến mãi, giảm tay; phải trả làm tròn theo đơn vị tiền tệ (giảm tay là phần còn lại để tổng khớp).
  private async totals(executor: Executor, companyId: string, rows: PricedRow[], payable: string | null) {
    const units = Number((await executor.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${companyId}) AS units`)).rows[0]!.units);
    const round = (value: number) => Number(value.toFixed(units));
    let goods = 0;
    let promotion = 0;
    let tax = 0;
    let total = 0;
    for (const row of rows) {
      const list = Number(row.list_price) * Number(row.quantity);
      goods += row.includes_vat ? list : list * (1 + vatFraction(row.vat_rate));
      promotion += Number(row.promotion_discount_total);
      tax += Number(row.tax);
      total += Number(row.total);
    }
    const totalAmount = payable === null ? round(total) : Number(payable);
    const goodsAmount = round(goods);
    const promotionAmount = round(promotion);
    return {
      goodsAmount: trimDecimal(goodsAmount.toFixed(4)),
      promotionAmount: trimDecimal(promotionAmount.toFixed(4)),
      manualDiscount: trimDecimal(Math.max(0, goodsAmount - promotionAmount - totalAmount).toFixed(4)),
      taxAmount: trimDecimal(round(tax).toFixed(4)),
      totalAmount: trimDecimal(totalAmount.toFixed(4)),
    };
  }

  private toLine(row: PricedRow): RetailPricedLine {
    return {
      variantId: row.variant_id,
      sku: row.sku,
      productName: row.product_name,
      unitId: row.unit_id,
      unitName: row.unit_name,
      quantity: trimDecimal(row.quantity),
      listPrice: trimDecimal(row.list_price),
      discountPercent: trimDecimal(row.discount_percent),
      promotionName: row.promotion_name,
      isGift: row.is_gift,
      total: trimDecimal(row.total),
    };
  }

  // Tính giỏ (API_195): giá kênh của cửa hàng, khuyến mãi, giảm tay; không ghi gì.
  async quote(actor: Actor, input: QuoteInput): Promise<RetailQuoteResponse> {
    return this.database.transaction(async (transaction) => {
      const store = await this.counter(transaction, actor, input.shiftId);
      await this.validateCart(transaction, actor.companyId, input.lines);
      const { lines, giftShortages } = await this.salesOrders.quoteMarketplace(transaction, actor.companyId, {
        channelId: store.channel_id,
        warehouseId: store.warehouse_id,
        orderDate: this.permissionService.today(),
        lines: input.lines,
      });
      const names = await this.describe(
        transaction,
        lines.map((line) => ({ variantId: line.variantId, unitId: line.unitId, promotionId: line.promotionId ?? line.orderPromotionId })),
      );
      const rows: PricedRow[] = lines.map((line, index) => ({
        ...names[index]!,
        variant_id: line.variantId,
        unit_id: line.unitId,
        quantity: line.quantity,
        list_price: line.listPrice,
        includes_vat: line.includesVat,
        vat_rate: line.vatRate,
        discount_percent: line.discountPercent,
        promotion_discount_total: line.promotionDiscountTotal,
        is_gift: line.isGift,
        tax: line.tax,
        total: line.total,
      }));
      return {
        lines: rows.map((row) => this.toLine(row)),
        ...(await this.totals(transaction, actor.companyId, rows, null)),
        giftShortages,
        maxManualDiscountPercent: (await readSettings(transaction, actor.companyId)).maxManualDiscountPercent,
        currency: await companyCurrency(transaction, actor.companyId),
      };
    });
  }

  private async describe(executor: Executor, lines: { variantId: string; unitId: string; promotionId: string | null }[]) {
    const result: Pick<PricedRow, "sku" | "product_name" | "unit_name" | "promotion_name">[] = [];
    for (const line of lines) {
      const row = (
        await executor.execute<{ sku: string; product_name: string; unit_name: string; promotion_name: string | null }>(sql`
        SELECT v.sku, p.name AS product_name, u.name_vi AS unit_name, (SELECT pr.name FROM sales.promotions pr WHERE pr.id = ${line.promotionId}::uuid) AS promotion_name
        FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id, catalog.units u WHERE v.id = ${line.variantId} AND u.id = ${line.unitId}`)
      ).rows[0]!;
      result.push(row);
    }
    return result;
  }

  // Thanh toán và ghi hóa đơn bán lẻ (API_196; QUYTAC_NGHIEPVU_373, 374): mọi bước trong một giao dịch; gửi lại cùng khóa trả hóa đơn đã ghi.
  async create(actor: Actor, input: SaleInput): Promise<RetailSaleResponse> {
    await ensureSequence(this.database, this.sequences, actor, saleTypeCode, "BL");
    await this.salesOrders.prepareNumbering(actor);
    await this.deliveries.ensureSequences(actor, actor.companyId);
    const id = await this.database.transaction(async (transaction) => {
      const shift = await this.shifts.requireOwnOpenShift(transaction, actor, input.shiftId);
      const existing = (await transaction.execute<{ id: string }>(sql`SELECT id FROM retail.sales WHERE register_id = ${shift.register_id} AND client_key = ${input.clientKey}`)).rows[0];
      if (existing) return existing.id;
      const store = await this.stores.store(transaction, actor.companyId, shift.store_id);
      await this.validateCart(transaction, actor.companyId, input.lines);
      if (input.payments.some((payment) => payment.method === "bank_transfer") && !store.bank_fund_id) throw new ApiError("BUSINESS_RULE", "retailNoBankFund");
      const today = this.permissionService.today();
      const buyer = input.buyer ?? { name: null, taxCode: null, address: null, identityNo: null };
      if (buyer.taxCode && (!buyer.name || !buyer.address)) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", {
          fields: buyer.name ? { "buyer.address": "required" } : { "buyer.name": "required", ...(buyer.address ? {} : { "buyer.address": "required" }) },
        });
      }
      const order = await this.salesOrders.placeRetailWithin(transaction, actor, {
        channelId: store.channel_id,
        warehouseId: store.warehouse_id,
        orderDate: today,
        buyerName: buyer.name,
        buyerTaxCode: buyer.taxCode,
        buyerAddress: buyer.address,
        buyerIdentityNo: buyer.identityNo,
        lines: input.lines,
      });
      const serials = await this.serialsByVariant(transaction, order.orderId, input.lines);
      const documentId = await this.deliveries.issueRetailWithin(transaction, actor, { orderId: order.orderId, documentDate: today, serials });
      const payable = (await transaction.execute<{ amount: string }>(sql`SELECT finance.inventory_debt_amount(${documentId})::text AS amount`)).rows[0]!.amount;
      if (Math.abs(Number(payable) - Number(input.expectedTotal)) > 0.00005) throw new ApiError("BUSINESS_RULE", "retailTotalChanged");
      const nonCash = input.payments.filter((payment) => payment.method !== "cash").reduce((sum, payment) => sum + Number(payment.amount), 0);
      const tendered = input.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (nonCash > Number(payable) + 0.00005) throw new ApiError("BUSINESS_RULE", "retailNonCashOverTotal");
      if (tendered < Number(payable) - 0.00005) throw new ApiError("BUSINESS_RULE", "retailPaymentShort");
      const rows = await this.orderRows(transaction, order.orderId);
      const amounts = await this.totals(transaction, actor.companyId, rows, payable);
      const documentNo = await this.sequences.next(actor.companyId, saleTypeCode, transaction);
      const saleId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO retail.sales (company_id, store_id, register_id, shift_id, document_no, sold_at, sale_date, cashier_id, buyer_name, sales_order_id, stock_document_id,
          goods_amount, promotion_amount, manual_discount, tax_amount, total_amount, tendered_amount, change_amount, client_key)
        VALUES (${actor.companyId}, ${store.id}, ${shift.register_id}, ${shift.id}, ${documentNo}, ${this.clock.now()}, ${today}::date, ${actor.userId}, ${buyer.name}, ${order.orderId},
          ${documentId}, ${amounts.goodsAmount}::numeric, ${amounts.promotionAmount}::numeric, ${amounts.manualDiscount}::numeric, ${amounts.taxAmount}::numeric, ${payable}::numeric,
          ${tendered.toFixed(4)}::numeric, ${(tendered - Number(payable)).toFixed(4)}::numeric, ${input.clientKey})
        RETURNING id`)
      ).rows[0]!.id;
      for (const [index, payment] of input.payments.entries()) {
        await transaction.execute(sql`
          INSERT INTO retail.sale_payments (sale_id, line_no, method, amount, fund_id, bank_reference)
          VALUES (${saleId}, ${index + 1}, ${payment.method}, ${payment.amount}::numeric, ${payment.method === "cash" ? store.cash_fund_id : store.bank_fund_id},
            ${payment.method === "cash" ? null : payment.bankReference})`);
      }
      await this.auditService.record(
        { ...retailAudit(actor, "retail_sale"), action: "retail_sale.create", entityId: saleId, afterData: { documentNo, total: payable, payments: input.payments, buyer } },
        transaction,
      );
      return saleId;
    });
    return this.detail(actor, id);
  }

  // Serial thu ngân quét gom theo mặt hàng; mặt hàng theo serial phải quét đủ số lượng (gồm hàng tặng).
  private async serialsByVariant(executor: Executor, orderId: string, lines: CartLine[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    for (const line of lines) result.set(line.variantId, [...(result.get(line.variantId) ?? []), ...line.serials]);
    const needed = await executor.execute<{ variant_id: string; quantity: string }>(sql`
      SELECT l.variant_id, sum(l.base_quantity)::text AS quantity FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE l.order_id = ${orderId} AND p.tracks_serials GROUP BY l.variant_id`);
    for (const row of needed.rows) {
      const serials = result.get(row.variant_id) ?? [];
      if (serials.length !== Number(row.quantity) || new Set(serials).size !== serials.length) throw new ApiError("BUSINESS_RULE", "retailSerialCount");
    }
    return result;
  }

  private async orderRows(executor: Executor, orderId: string): Promise<PricedRow[]> {
    return (
      await executor.execute<PricedRow>(sql`
      SELECT l.variant_id, v.sku, p.name AS product_name, l.unit_id, u.name_vi AS unit_name, l.quantity::text, l.list_price::text, l.price_includes_vat AS includes_vat, l.vat_rate,
        l.discount_percent::text, l.promotion_discount_total::text, pr.name AS promotion_name, l.is_gift, l.tax_amount::text AS tax, l.total_amount::text AS total
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      LEFT JOIN sales.promotions pr ON pr.id = coalesce(l.promotion_id, l.order_promotion_id)
      WHERE l.order_id = ${orderId} ORDER BY l.line_no`)
    ).rows;
  }

  // Xem hóa đơn bán lẻ: người bán, quản lý ca, trả hàng trong phạm vi chi nhánh của cửa hàng.
  private async visibility(actor: Actor): Promise<SQL> {
    const scopes = await Promise.all([retailPermissions.sale, retailPermissions.manageShifts, retailPermissions.return].map((permission) => retailScope(this.permissionService, actor, permission)));
    if (scopes.every((scope) => scope === null)) throw new ApiError("FORBIDDEN", "forbidden");
    return sql`(${sql.join(
      scopes.map((scope) => scopeCondition(scope, sql`st.branch_id`)),
      sql` OR `,
    )})`;
  }

  async detail(actor: Actor, id: string): Promise<RetailSaleResponse> {
    const row = (
      await this.database.execute<{
        id: string;
        document_no: string;
        sold_at: Date;
        sale_date: string;
        legal_name: string;
        tax_code: string | null;
        company_address: string | null;
        store_id: string;
        store_name: string;
        store_address: string | null;
        store_phone: string | null;
        receipt_footer: string | null;
        return_days: number;
        register_code: string;
        register_name: string;
        shift_id: string;
        cashier_name: string;
        buyer_name: string | null;
        buyer_tax_code: string | null;
        buyer_address: string | null;
        buyer_identity_no: string | null;
        goods_amount: string;
        promotion_amount: string;
        manual_discount: string;
        tax_amount: string;
        total_amount: string;
        tendered_amount: string;
        change_amount: string;
        sales_order_id: string;
        order_no: string;
        stock_document_id: string;
        stock_document_no: string;
      }>(sql`
      SELECT s.id, s.document_no, s.sold_at, s.sale_date::text, c.legal_name, c.tax_code, c.address AS company_address, st.id AS store_id, b.name AS store_name, b.address AS store_address,
        b.phone AS store_phone, st.receipt_footer, st.return_days, r.code AS register_code, r.name AS register_name, s.shift_id, u.full_name AS cashier_name, s.buyer_name,
        o.buyer_tax_code, o.buyer_address, o.buyer_identity_no, s.goods_amount::text, s.promotion_amount::text, s.manual_discount::text, s.tax_amount::text, s.total_amount::text,
        s.tendered_amount::text, s.change_amount::text, s.sales_order_id, o.document_no AS order_no, s.stock_document_id, d.document_no AS stock_document_no
      FROM retail.sales s JOIN retail.stores st ON st.id = s.store_id JOIN core.branches b ON b.id = st.branch_id JOIN core.companies c ON c.id = s.company_id
        JOIN retail.registers r ON r.id = s.register_id JOIN core.users u ON u.id = s.cashier_id JOIN sales.orders o ON o.id = s.sales_order_id
        JOIN inventory.documents d ON d.id = s.stock_document_id
      WHERE s.company_id = ${actor.companyId} AND s.id = ${id} AND ${await this.visibility(actor)}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const payments = await this.database.execute<{ method: RetailPaymentMethod; amount: string; bank_reference: string | null; points: string | null }>(sql`
      SELECT method, amount::text, bank_reference, points::text FROM retail.sale_payments WHERE sale_id = ${id} ORDER BY line_no`);
    return {
      id: row.id,
      documentNo: row.document_no,
      soldAt: new Date(row.sold_at).toISOString(),
      saleDate: row.sale_date,
      company: { legalName: row.legal_name, taxCode: row.tax_code, address: row.company_address },
      store: { id: row.store_id, name: row.store_name, address: row.store_address, phone: row.store_phone, receiptFooter: row.receipt_footer, returnDays: row.return_days },
      register: { code: row.register_code, name: row.register_name },
      shiftId: row.shift_id,
      cashierName: row.cashier_name,
      buyer: { name: row.buyer_name, taxCode: row.buyer_tax_code, address: row.buyer_address, identityNo: row.buyer_identity_no },
      lines: (await this.orderRows(this.database, row.sales_order_id)).map((line) => this.toLine(line)),
      goodsAmount: trimDecimal(row.goods_amount),
      promotionAmount: trimDecimal(row.promotion_amount),
      manualDiscount: trimDecimal(row.manual_discount),
      taxAmount: trimDecimal(row.tax_amount),
      totalAmount: trimDecimal(row.total_amount),
      tenderedAmount: trimDecimal(row.tendered_amount),
      changeAmount: trimDecimal(row.change_amount),
      payments: payments.rows.map((payment) => ({
        method: payment.method,
        amount: trimDecimal(payment.amount),
        bankReference: payment.bank_reference,
        points: payment.points === null ? null : trimDecimal(payment.points),
      })),
      salesOrder: { id: row.sales_order_id, documentNo: row.order_no },
      stockDocument: { id: row.stock_document_id, documentNo: row.stock_document_no },
      returns: (
        await this.database.execute<{ id: string; document_no: string; returned_at: Date; refund_amount: string }>(sql`
        SELECT id, document_no, returned_at, refund_amount::text FROM retail.returns WHERE sale_id = ${id} ORDER BY returned_at`)
      ).rows.map((item) => ({ id: item.id, documentNo: item.document_no, returnedAt: new Date(item.returned_at).toISOString(), refundAmount: trimDecimal(item.refund_amount) })),
      currency: await companyCurrency(this.database, actor.companyId),
    };
  }

  async list(actor: Actor, query: ListQuery): Promise<RetailSaleListResponse> {
    const conditions: SQL[] = [sql`s.company_id = ${actor.companyId}`, await this.visibility(actor)];
    if (query.storeId) conditions.push(sql`s.store_id = ${query.storeId}`);
    if (query.shiftId) conditions.push(sql`s.shift_id = ${query.shiftId}`);
    if (query.from) conditions.push(sql`s.sale_date >= ${query.from}::date`);
    if (query.to) conditions.push(sql`s.sale_date <= ${query.to}::date`);
    if (query.search) conditions.push(sql`(s.document_no ILIKE ${`%${query.search}%`} OR s.buyer_name ILIKE ${`%${query.search}%`})`);
    const where = sql.join(conditions, sql` AND `);
    const from = sql`FROM retail.sales s JOIN retail.stores st ON st.id = s.store_id JOIN core.branches b ON b.id = st.branch_id JOIN retail.registers r ON r.id = s.register_id
      JOIN core.users u ON u.id = s.cashier_id`;
    const [rows, total] = await Promise.all([
      this.database.execute<{
        id: string;
        document_no: string;
        sold_at: Date;
        store_name: string;
        register_code: string;
        cashier_name: string;
        buyer_name: string | null;
        total_amount: string;
        methods: RetailPaymentMethod[];
      }>(sql`
        SELECT s.id, s.document_no, s.sold_at, b.name AS store_name, r.code AS register_code, u.full_name AS cashier_name, s.buyer_name, s.total_amount::text,
          array(SELECT DISTINCT p.method FROM retail.sale_payments p WHERE p.sale_id = s.id) AS methods
        ${from} WHERE ${where} ORDER BY s.sold_at DESC LIMIT 20 OFFSET ${(query.page - 1) * 20}`),
      this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${from} WHERE ${where}`),
    ]);
    const currency = await companyCurrency(this.database, actor.companyId);
    return {
      items: rows.rows.map((row) => ({
        id: row.id,
        documentNo: row.document_no,
        soldAt: new Date(row.sold_at).toISOString(),
        storeName: row.store_name,
        registerCode: row.register_code,
        cashierName: row.cashier_name,
        buyerName: row.buyer_name,
        totalAmount: trimDecimal(row.total_amount),
        methods: row.methods,
        currency,
      })),
      total: total.rows[0]!.total,
      page: query.page,
    };
  }
}
