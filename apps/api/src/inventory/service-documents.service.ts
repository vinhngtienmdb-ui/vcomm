// Phiếu kho dịch vụ tự lập khi đơn xác nhận (CONG_VIEC_43; QUYTAC_NGHIEPVU_275 đến 277; quyết định người dùng 2026-11-11).
// Dòng dịch vụ của đơn bán coi là đã giao đủ, dòng dịch vụ của đơn mua đối ứng nội bộ coi là đã nhận đủ: một phiếu xuất giao hàng, phiếu nhập mua dịch vụ
// ghi sổ không qua thẻ kho để công nợ, hóa đơn điện tử, bút toán chạy như phiếu ghi sổ. Đơn VComm không qua đây (chỉ hàng hóa).
// Đơn mua dịch vụ của nhà cung cấp ngoài tập đoàn khi duyệt cũng coi là đã nhận đủ phần dịch vụ (lát L4).
import { Injectable, type OnModuleInit } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { internalCompanyOf } from "../crm/partners.service";
import { PermissionService } from "../permissions/permission.service";
import { PurchaseOrdersService, receivedOnOrderLine } from "../purchasing/orders.service";
import { deliveredOnOrderLine, SalesOrdersService, salesOrderSource } from "../sales/sales-orders.service";
import type { Database } from "../database/database.module";
import { StockDocumentsService } from "./stock-documents.service";

type Executor = Pick<Database, "execute" | "insert">;
type ServiceLine = { id: string; variant_id: string; unit_id: string; quantity: string; base_quantity: string; done: string; unit_price: string | null };

@Injectable()
export class ServiceDocumentsService implements OnModuleInit {
  constructor(
    private readonly documents: StockDocumentsService,
    private readonly salesOrders: SalesOrdersService,
    private readonly purchaseOrders: PurchaseOrdersService,
    private readonly permissionService: PermissionService,
  ) {}

  onModuleInit(): void {
    this.salesOrders.confirmedHooks.push((transaction, orderId) => this.salesConfirmed(transaction, orderId));
    this.purchaseOrders.approvedHooks.push((transaction, orderId) => this.purchaseApproved(transaction, orderId));
  }

  // Đơn bán xác nhận. Bán cho công ty trong tập đoàn: chỉ giao khi đơn mua bên kia đã duyệt (như luồng hàng hóa: chưa duyệt đơn mua đối ứng thì chưa giao),
  // giao và nhận cùng lúc; đơn mua đối ứng chưa duyệt thì chờ bên mua xác nhận (purchaseApproved).
  private async salesConfirmed(transaction: Executor, orderId: string): Promise<void> {
    const order = (
      await transaction.execute<{ customer_id: string | null; counterpart_order_id: string | null }>(sql`SELECT customer_id, counterpart_order_id FROM sales.orders WHERE id = ${orderId}`)
    ).rows[0];
    if (!order) return;
    if (order.customer_id && (await internalCompanyOf(transaction, order.customer_id))) {
      if (!order.counterpart_order_id) return;
      const purchase = (await transaction.execute<{ status: string }>(sql`SELECT status FROM purchasing.orders WHERE id = ${order.counterpart_order_id}`)).rows[0];
      if (purchase && ["approved", "received"].includes(purchase.status)) await this.settleInternal(transaction, orderId, order.counterpart_order_id);
      return;
    }
    await this.deliverSales(transaction, orderId);
  }

  // Đơn mua duyệt. Mua của nhà cung cấp ngoài tập đoàn: nhận ngay phần dịch vụ (quyết định người dùng 2026-11-11, lát L4).
  // Mua của công ty trong tập đoàn: giữ luồng giao dịch nội bộ, chỉ giao, nhận khi đơn bán bên kia đã xác nhận.
  private async purchaseApproved(transaction: Executor, orderId: string): Promise<void> {
    const purchase = (
      await transaction.execute<{ supplier_id: string; counterpart_order_id: string | null }>(sql`SELECT supplier_id, counterpart_order_id FROM purchasing.orders WHERE id = ${orderId}`)
    ).rows[0];
    if (!purchase) return;
    if (!(await internalCompanyOf(transaction, purchase.supplier_id))) {
      await this.receivePurchase(transaction, orderId);
      return;
    }
    if (!purchase.counterpart_order_id) return;
    const sale = (await transaction.execute<{ status: string }>(sql`SELECT status FROM sales.orders WHERE id = ${purchase.counterpart_order_id}`)).rows[0];
    if (sale?.status === "confirmed") await this.settleInternal(transaction, purchase.counterpart_order_id, orderId);
  }

  private async settleInternal(transaction: Executor, salesOrderId: string, purchaseOrderId: string): Promise<void> {
    await this.deliverSales(transaction, salesOrderId);
    await this.receivePurchase(transaction, purchaseOrderId);
  }

  // Phiếu xuất dịch vụ cho phần dịch vụ chưa giao của đơn bán; đơn giao đủ thì chuyển "Đã giao đủ".
  private async deliverSales(transaction: Executor, orderId: string): Promise<void> {
    const order = (
      await transaction.execute<{ company_id: string; warehouse_id: string | null; customer_id: string | null; document_no: string | null; created_by: string }>(sql`
      SELECT company_id, warehouse_id, customer_id, document_no, created_by FROM sales.orders WHERE id = ${orderId} FOR UPDATE`)
    ).rows[0];
    if (!order?.warehouse_id) return;
    const lines = await transaction.execute<ServiceLine>(sql`
      SELECT l.id, l.variant_id, l.unit_id, l.quantity::text, l.base_quantity::text, ${deliveredOnOrderLine(sql`l.id`)}::text AS done, NULL AS unit_price
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE l.order_id = ${orderId} AND p.kind = 'service' ORDER BY l.line_no`);
    const remaining = this.remaining(lines.rows);
    if (remaining.length === 0) return;
    await this.documents.postServiceDocument(transaction, {
      type: "sales_issue",
      companyId: order.company_id,
      warehouseId: order.warehouse_id,
      documentDate: this.permissionService.today(),
      reason: `Cung cấp dịch vụ theo đơn bán ${order.document_no ?? ""}`.trim(),
      sourceType: salesOrderSource,
      sourceId: orderId,
      partnerId: order.customer_id,
      createdBy: order.created_by,
      lines: remaining,
    });
    await this.salesOrders.refreshDelivered(transaction, orderId);
  }

  // Phiếu nhập mua dịch vụ cho phần dịch vụ chưa nhận của đơn mua; không phiếu nhập chờ nhận, không biên bản chênh lệch (QUYTAC_NGHIEPVU_277).
  private async receivePurchase(transaction: Executor, orderId: string): Promise<void> {
    const order = (
      await transaction.execute<{ company_id: string; warehouse_id: string | null; supplier_id: string; document_no: string | null; created_by: string }>(sql`
      SELECT company_id, warehouse_id, supplier_id, document_no, created_by FROM purchasing.orders WHERE id = ${orderId} FOR UPDATE`)
    ).rows[0];
    if (!order?.warehouse_id) return;
    const lines = await transaction.execute<ServiceLine>(sql`
      SELECT l.id, l.variant_id, l.unit_id, l.quantity::text, l.base_quantity::text, ${receivedOnOrderLine(sql`l.id`)}::text AS done, l.unit_price::text
      FROM purchasing.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE l.order_id = ${orderId} AND p.kind = 'service' ORDER BY l.line_no`);
    const remaining = this.remaining(lines.rows);
    if (remaining.length === 0) return;
    await this.documents.postServiceDocument(transaction, {
      type: "purchase_receipt",
      companyId: order.company_id,
      warehouseId: order.warehouse_id,
      documentDate: this.permissionService.today(),
      reason: `Nhận dịch vụ theo đơn mua ${order.document_no ?? ""}`.trim(),
      sourceType: "purchasing.order",
      sourceId: orderId,
      partnerId: order.supplier_id,
      createdBy: order.created_by,
      lines: remaining,
    });
    await this.purchaseOrders.refreshReceived(transaction, orderId);
  }

  // Phần còn lại của từng dòng theo đơn vị của dòng; đơn giá (nhập mua) theo đơn vị của dòng.
  private remaining(lines: ServiceLine[]) {
    return lines.flatMap((line) => {
      const base = Number(line.base_quantity) - Number(line.done);
      if (base <= 0.00005) return [];
      const factor = Number(line.base_quantity) / Number(line.quantity);
      return [
        {
          variantId: line.variant_id,
          unitId: line.unit_id,
          quantity: (base / factor).toFixed(4),
          baseQuantity: base.toFixed(4),
          unitCost: line.unit_price,
          sourceLineId: line.id,
        },
      ];
    });
  }
}
