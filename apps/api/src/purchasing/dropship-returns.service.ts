// Trả hàng dropship, đối soát nhà cung cấp dropship (CONG_VIEC_62 CHUC_NANG_223; QUYTAC_NGHIEPVU_503, 504; API_269, API_270).
import { Inject, Injectable } from "@nestjs/common";
import type { createDropshipReturnSchema, DropshipOrderResponse, dropshipReconciliationQuerySchema, DropshipReconciliationResponse, DropshipReconciliationRow } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PurchaseReceiptsService } from "../inventory/purchase-receipts.service";
import { SalesDeliveriesService } from "../inventory/sales-deliveries.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { DropshipOrdersService, dropshipIssueLines } from "./dropship-orders.service";
import { purchasingAudit, purchasingPermissions, requirePermission, type Executor } from "./purchasing-context";

type ReturnRow = {
  id: string;
  company_id: string;
  order_id: string;
  issue_id: string;
  destination: "supplier" | "warehouse";
  status: string;
  reason: string;
  version: number;
};

@Injectable()
export class DropshipReturnsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly orders: DropshipOrdersService,
    private readonly receipts: PurchaseReceiptsService,
    private readonly deliveries: SalesDeliveriesService,
  ) {}

  // Trả về kho công ty: ghi sổ phiếu trả hàng bán vào kho thường ngay. Trả về nhà cung cấp: chờ nhà cung cấp nhận (QUYTAC_NGHIEPVU_503).
  async create(actor: Actor, input: z.output<typeof createDropshipReturnSchema>): Promise<DropshipOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    const order = await this.orders.detail(actor, input.orderId);
    if (order.status !== "delivered" || !order.issue) throw new ApiError("BUSINESS_RULE", "dropshipStatusInvalid");
    if (input.destination === "warehouse") {
      const warehouse = await this.database.execute(sql`
        SELECT 1 FROM inventory.warehouses w JOIN inventory.warehouse_owners o ON o.warehouse_id = w.id
        WHERE w.id = ${input.warehouseId} AND w.status = 'active' AND w.kind = 'standard' AND o.company_id = ${actor.companyId}`);
      if (warehouse.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { warehouseId: "invalidValue" } });
      await this.deliveries.ensureSequences(actor, actor.companyId);
    } else if (input.warehouseId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { warehouseId: "invalidValue" } });
    const issueId = order.issue.id;
    const today = this.permissionService.today();
    const id = await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM purchasing.orders WHERE id = ${input.orderId} FOR UPDATE`);
      // Không trả quá số đã xuất trừ đã trả và đang chờ nhà cung cấp nhận.
      const available = new Map((await dropshipIssueLines(transaction, issueId)).map((line) => [line.id, line]));
      const totals = new Map<string, number>();
      const fields: Record<string, "invalidValue" | "salesReturnExceeded"> = {};
      input.lines.forEach((line, index) => {
        const source = available.get(line.issueLineId);
        if (!source) {
          fields[`lines.${index}.issueLineId`] = "invalidValue";
          return;
        }
        const total = (totals.get(line.issueLineId) ?? 0) + Number(line.quantity);
        totals.set(line.issueLineId, total);
        if (total > Number(source.issuedQuantity) - Number(source.returnedQuantity) - Number(source.pendingQuantity) + 0.00005) fields[`lines.${index}.quantity`] = "salesReturnExceeded";
      });
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      const returnId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO purchasing.dropship_returns (company_id, order_id, issue_id, reason, destination, warehouse_id, status, created_by)
        VALUES (${actor.companyId}, ${input.orderId}, ${issueId}, ${input.reason}, ${input.destination}, ${input.warehouseId}, ${input.destination === "warehouse" ? "received" : "awaiting_supplier"},
          ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      for (const line of input.lines) {
        await transaction.execute(sql`INSERT INTO purchasing.dropship_return_lines (return_id, issue_line_id, quantity) VALUES (${returnId}, ${line.issueLineId}, ${line.quantity}::numeric)`);
      }
      if (input.destination === "warehouse") {
        const salesReturnId = await this.deliveries.returnAsSystem(transaction, actor, {
          issueId,
          documentDate: today,
          reason: input.reason,
          warehouseId: input.warehouseId!,
          lines: input.lines.map((line) => ({ issueLineId: line.issueLineId, quantity: line.quantity })),
        });
        await transaction.execute(sql`UPDATE purchasing.dropship_returns SET sales_return_id = ${salesReturnId}, closed_at = now() WHERE id = ${returnId}`);
      }
      await this.auditService.record({ ...purchasingAudit(actor, "dropship_return"), action: "dropship_return.create", entityId: returnId, afterData: input }, transaction);
      return returnId;
    });
    void id;
    return this.orders.detail(actor, input.orderId);
  }

  // Nhà cung cấp xác nhận đã nhận: phiếu trả hàng bán vào kho Dropship và phiếu trả hàng mua cùng số lượng, giá theo phiếu gốc (QUYTAC_NGHIEPVU_503).
  async received(actor: Actor, id: string, version: number): Promise<DropshipOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    const row = await this.single(actor.companyId, id);
    if (row.status !== "awaiting_supplier") throw new ApiError("BUSINESS_RULE", "dropshipStatusInvalid");
    await this.deliveries.ensureSequences(actor, actor.companyId);
    await this.receipts.ensureReceiptSequence(actor, actor.companyId);
    const today = this.permissionService.today();
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        UPDATE purchasing.dropship_returns SET status = 'received', closed_at = now(), version = version + 1
        WHERE id = ${id} AND status = 'awaiting_supplier' AND version = ${version} RETURNING id`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const lines = await transaction.execute<{ issue_line_id: string; quantity: string; variant_id: string }>(sql`
        SELECT l.issue_line_id, l.quantity::text, dl.variant_id FROM purchasing.dropship_return_lines l JOIN inventory.document_lines dl ON dl.id = l.issue_line_id
        WHERE l.return_id = ${id}`);
      const salesReturnId = await this.deliveries.returnAsSystem(transaction, actor, {
        issueId: row.issue_id,
        documentDate: today,
        reason: row.reason,
        lines: lines.rows.map((line) => ({ issueLineId: line.issue_line_id, quantity: trimDecimal(line.quantity) })),
      });
      const receipt = (
        await transaction.execute<{ id: string }>(sql`
        SELECT id FROM inventory.documents WHERE type = 'purchase_receipt' AND status = 'posted' AND source_id = ${row.order_id} ORDER BY created_at LIMIT 1`)
      ).rows[0];
      if (!receipt) throw new ApiError("BUSINESS_RULE", "purchaseReceiptNotPosted");
      const receiptLines = new Map(
        (await transaction.execute<{ id: string; variant_id: string }>(sql`SELECT id, variant_id FROM inventory.document_lines WHERE document_id = ${receipt.id}`)).rows.map((line) => [
          line.variant_id,
          line.id,
        ]),
      );
      const purchaseReturnId = await this.receipts.returnAsSystem(transaction, actor, {
        receiptId: receipt.id,
        documentDate: today,
        reason: row.reason,
        lines: lines.rows.map((line) => ({ receiptLineId: receiptLines.get(line.variant_id)!, baseQuantity: trimDecimal(line.quantity) })),
      });
      await transaction.execute(sql`UPDATE purchasing.dropship_returns SET sales_return_id = ${salesReturnId}, purchase_return_id = ${purchaseReturnId} WHERE id = ${id}`);
      await this.auditService.record({ ...purchasingAudit(actor, "dropship_return"), action: "dropship_return.received", entityId: id }, transaction);
    });
    return this.orders.detail(actor, row.order_id);
  }

  async cancel(actor: Actor, id: string, version: number): Promise<DropshipOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    const row = await this.single(actor.companyId, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE purchasing.dropship_returns SET status = 'cancelled', closed_at = now(), version = version + 1
        WHERE id = ${id} AND status = 'awaiting_supplier' AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...purchasingAudit(actor, "dropship_return"), action: "dropship_return.cancel", entityId: id }, transaction);
    });
    return this.orders.detail(actor, row.order_id);
  }

  // Theo nhà cung cấp trong kỳ: số đơn đã giao, giá trị nhận có thuế, giá trị trả lại có thuế, đơn chưa có số hóa đơn, phải trả cuối kỳ (QUYTAC_NGHIEPVU_504).
  async reconciliation(actor: Actor, query: z.output<typeof dropshipReconciliationQuerySchema>): Promise<DropshipReconciliationResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewDropship, purchasingPermissions.manageDropship);
    const orders = await this.database.execute<{
      id: string;
      document_no: string;
      sales_order_no: string | null;
      supplier_id: string;
      supplier_name: string;
      delivered_on: Date | string;
      received: string;
      returned: string;
      supplier_invoice_no: string | null;
    }>(sql`
      SELECT po.id, po.document_no, so.document_no AS sales_order_no, po.supplier_id, s.name AS supplier_name, po.delivered_on, (po.total_amount + po.tax_amount)::text AS received,
        coalesce((SELECT sum(di.amount) FROM finance.debt_items di JOIN inventory.documents r ON r.id = di.source_id
          JOIN inventory.documents rc ON rc.id = r.source_id
          WHERE di.source_type = 'purchase_return' AND r.type = 'purchase_return' AND r.status = 'posted' AND rc.source_id = po.id
            AND r.document_date BETWEEN ${query.from}::date AND ${query.to}::date), 0)::text AS returned,
        po.supplier_invoice_no
      FROM purchasing.orders po JOIN crm.partners s ON s.id = po.supplier_id JOIN sales.orders so ON so.id = po.dropship_sales_order_id
      WHERE po.company_id = ${actor.companyId} AND po.dropship_status = 'delivered' AND po.delivered_on BETWEEN ${query.from}::date AND ${query.to}::date
        AND (${query.supplierId ?? null}::uuid IS NULL OR po.supplier_id = ${query.supplierId ?? null}::uuid)
      ORDER BY s.name, po.delivered_on, po.document_no`);
    const suppliers = [...new Map(orders.rows.map((row) => [row.supplier_id, row.supplier_name])).entries()];
    const rows: DropshipReconciliationRow[] = [];
    for (const [supplierId, supplierName] of suppliers) {
      const own = orders.rows.filter((row) => row.supplier_id === supplierId);
      const balance = (
        await this.database.execute<{ balance: string }>(sql`
        SELECT coalesce(sum(CASE WHEN direction = 'debit' THEN amount ELSE -amount END), 0)::text AS balance FROM finance.debt_items
        WHERE company_id = ${actor.companyId} AND partner_id = ${supplierId} AND side = 'payable' AND document_date <= ${query.to}::date`)
      ).rows[0]!.balance;
      rows.push({
        supplierId,
        supplierName,
        deliveredCount: own.length,
        receivedAmount: trimDecimal(own.reduce((sum, row) => sum + Number(row.received), 0).toFixed(4)),
        returnedAmount: trimDecimal(own.reduce((sum, row) => sum + Number(row.returned), 0).toFixed(4)),
        missingInvoiceCount: own.filter((row) => !row.supplier_invoice_no).length,
        payableBalance: trimDecimal(balance),
      });
    }
    const sum = (key: "receivedAmount" | "returnedAmount" | "payableBalance") => trimDecimal(rows.reduce((total, row) => total + Number(row[key]), 0).toFixed(4));
    const currency = (await this.database.execute<{ base_currency: string }>(sql`SELECT base_currency FROM core.companies WHERE id = ${actor.companyId}`)).rows[0]!.base_currency;
    return {
      from: query.from,
      to: query.to,
      currency,
      rows,
      totals: {
        deliveredCount: rows.reduce((total, row) => total + row.deliveredCount, 0),
        receivedAmount: sum("receivedAmount"),
        returnedAmount: sum("returnedAmount"),
        missingInvoiceCount: rows.reduce((total, row) => total + row.missingInvoiceCount, 0),
        payableBalance: sum("payableBalance"),
      },
      orders: query.supplierId
        ? orders.rows.map((row) => ({
            id: row.id,
            documentNo: row.document_no,
            salesOrderNo: row.sales_order_no,
            deliveredOn: day(row.delivered_on),
            receivedAmount: trimDecimal(row.received),
            returnedAmount: trimDecimal(row.returned),
            supplierInvoiceNo: row.supplier_invoice_no,
          }))
        : [],
    };
  }

  private async single(companyId: string, id: string): Promise<ReturnRow> {
    const row = (
      await (this.database as Executor).execute<ReturnRow>(sql`
      SELECT id, company_id, order_id, issue_id, destination, status, reason, version FROM purchasing.dropship_returns WHERE id = ${id} AND company_id = ${companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }
}
