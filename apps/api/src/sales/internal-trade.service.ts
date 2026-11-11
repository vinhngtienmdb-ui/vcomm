// Giao dịch nội bộ giữa công ty con (CONG_VIEC_09; QUYTAC_NGHIEPVU_73 đến 78): sinh, đóng chứng từ đối ứng hai phía.
// Bán hàng ghi `sales`, Mua hàng ghi `purchasing` qua service của module sở hữu, trong cùng giao dịch với chứng từ khởi tạo.
import { Injectable, type OnModuleInit } from "@nestjs/common";
import type { VatRate } from "contracts";
import { sql } from "drizzle-orm";
import { day } from "../catalog/price-lists.service";
import { linkedVariant } from "../catalog/variant-links.service";
import { ApiError } from "../common/api-error";
import { internalCompanyOf, internalPartnerOf } from "../crm/partners.service";
import type { Database } from "../database/database.module";
import { PurchaseOrdersService } from "../purchasing/orders.service";
import { internalChannel } from "./internal-trade-rules";
import { SalesOrdersService } from "./sales-orders.service";

type Executor = Pick<Database, "execute" | "insert">;

@Injectable()
export class InternalTradeService implements OnModuleInit {
  constructor(
    private readonly salesOrders: SalesOrdersService,
    private readonly purchaseOrders: PurchaseOrdersService,
  ) {}

  onModuleInit(): void {
    this.salesOrders.internalHooks = {
      afterConfirmed: (transaction, orderId) => this.salesConfirmed(transaction, orderId),
      afterEnded: async (transaction, orderId, reason) => {
        const counterpart = await this.counterpartOf(transaction, sql`sales.orders`, orderId);
        if (counterpart) await this.purchaseOrders.endByCounterpart(transaction, counterpart, reason);
      },
    };
    this.purchaseOrders.internalHooks = {
      afterApproved: (transaction, orderId) => this.purchaseApproved(transaction, orderId),
      afterEnded: async (transaction, orderId, reason) => {
        const counterpart = await this.counterpartOf(transaction, sql`purchasing.orders`, orderId);
        if (counterpart) await this.salesOrders.endByCounterpart(transaction, counterpart, reason);
      },
    };
  }

  // Đơn bán nội bộ khởi tạo đã xác nhận: sinh đơn mua đối ứng ở công ty mua, giá chưa thuế theo dòng đơn bán, số lượng quy theo liên kết.
  private async salesConfirmed(transaction: Executor, orderId: string): Promise<void> {
    const order = (
      await transaction.execute<{ company_id: string; customer_id: string | null; order_date: Date | string; created_by: string; counterpart_order_id: string | null; is_counterpart: boolean }>(
        sql`SELECT company_id, customer_id, order_date, created_by, counterpart_order_id, is_counterpart FROM sales.orders WHERE id = ${orderId}`,
      )
    ).rows[0]!;
    if (order.is_counterpart || order.counterpart_order_id || !order.customer_id) return;
    const buyerCompanyId = await internalCompanyOf(transaction, order.customer_id);
    if (!buyerCompanyId) return;
    const supplierId = await internalPartnerOf(transaction, order.company_id);
    if (!supplierId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { customerId: "internalProfileMissing" } });
    const lines = await transaction.execute<{ variant_id: string; base_quantity: string; net_amount: string; vat_rate: VatRate }>(sql`
      SELECT variant_id, base_quantity::text, net_amount::text, vat_rate FROM sales.order_lines WHERE order_id = ${orderId} ORDER BY line_no`);
    const counterpartLines = [];
    for (const [index, line] of lines.rows.entries()) {
      const link = await linkedVariant(transaction, line.variant_id, buyerCompanyId);
      if (!link) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`lines.${index}.variantId`]: "internalVariantNotLinked" } });
      const quantity = (Number(line.base_quantity) * link.factor).toFixed(4);
      counterpartLines.push({ variantId: link.variantId, unitId: link.baseUnitId, quantity, unitPrice: (Number(line.net_amount) / Number(quantity)).toFixed(4), vatRate: line.vat_rate });
    }
    const purchaseOrderId = await this.purchaseOrders.createCounterpart(transaction, {
      companyId: buyerCompanyId,
      supplierId,
      orderDate: day(order.order_date),
      salesOrderId: orderId,
      createdBy: order.created_by,
      lines: counterpartLines,
    });
    await this.salesOrders.linkCounterpart(transaction, orderId, purchaseOrderId);
  }

  // Đơn mua nội bộ khởi tạo đã duyệt: sinh đơn bán đối ứng ở công ty bán, kênh Nội bộ, số lượng quy theo liên kết, giá chưa thuế, thuế suất theo đơn mua.
  private async purchaseApproved(transaction: Executor, orderId: string): Promise<void> {
    const order = (
      await transaction.execute<{ company_id: string; supplier_id: string; order_date: Date | string; created_by: string; counterpart_order_id: string | null; is_counterpart: boolean }>(
        sql`SELECT company_id, supplier_id, order_date, created_by, counterpart_order_id, is_counterpart FROM purchasing.orders WHERE id = ${orderId}`,
      )
    ).rows[0]!;
    if (order.is_counterpart || order.counterpart_order_id) return;
    const sellerCompanyId = await internalCompanyOf(transaction, order.supplier_id);
    if (!sellerCompanyId) return;
    const customerId = await internalPartnerOf(transaction, order.company_id);
    const channelId = await internalChannel(transaction, sellerCompanyId);
    if (!customerId || !channelId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { supplierId: "internalChannelMissing" } });
    const lines = await transaction.execute<{ variant_id: string; base_quantity: string; amount: string; vat_rate: VatRate }>(sql`
      SELECT variant_id, base_quantity::text, amount::text, vat_rate FROM purchasing.order_lines WHERE order_id = ${orderId} ORDER BY line_no`);
    const counterpartLines = [];
    for (const [index, line] of lines.rows.entries()) {
      const link = await linkedVariant(transaction, line.variant_id, sellerCompanyId);
      if (!link) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`lines.${index}.variantId`]: "internalVariantNotLinked" } });
      const quantity = (Number(line.base_quantity) * link.factor).toFixed(4);
      counterpartLines.push({ variantId: link.variantId, unitId: link.baseUnitId, quantity, netUnitPrice: (Number(line.amount) / Number(quantity)).toFixed(4), vatRate: line.vat_rate });
    }
    const salesOrderId = await this.salesOrders.createCounterpart(transaction, {
      companyId: sellerCompanyId,
      customerId,
      channelId,
      orderDate: day(order.order_date),
      purchaseOrderId: orderId,
      createdBy: order.created_by,
      lines: counterpartLines,
    });
    await this.purchaseOrders.linkCounterpart(transaction, orderId, salesOrderId);
  }

  private async counterpartOf(transaction: Executor, table: ReturnType<typeof sql>, orderId: string): Promise<string | null> {
    return (await transaction.execute<{ counterpart_order_id: string | null }>(sql`SELECT counterpart_order_id FROM ${table} WHERE id = ${orderId}`)).rows[0]?.counterpart_order_id ?? null;
  }
}
