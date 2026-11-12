// Phiếu nhập khác, xuất khác, điều chỉnh (CHUC_NANG_40; QUYTAC_NGHIEPVU_46, 47, 50, 51; API_65; TIEUCHI_NGHIEMTHU_66, 67, 68).
// Phiếu thuộc công ty chủ hàng; người lập có quyền kho ở chi nhánh sở hữu kho. Gửi: giữ hàng cho dòng giảm, cấp số, gửi duyệt;
// không có chính sách duyệt thì ghi sổ ngay. Duyệt xong (sự kiện core.approval.completed) thì ghi sổ.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  stockReasonCodes,
  type LotSuggestion,
  type lotSuggestionQuerySchema,
  type PageResponse,
  type saveStockDocumentSchema,
  type StockDocumentListItem,
  type stockDocumentListQuerySchema,
  type StockDocumentResponse,
  type StockDocumentStatus,
  type StockDocumentType,
  type StockItemOption,
  type stockItemSearchQuerySchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { searchVariantOptions } from "../catalog/variant-search";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { assertOpenPeriod } from "../accounting/period-guard";
import { NumberSequencesService, periodKey } from "../settings/number-sequences.service";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { inventoryAudit, inventoryPermissions } from "./inventory-context";
import { ReservationsService } from "./reservations.service";
import { pgArray, StockLedgerService, type Executor, type LedgerEntry } from "./stock-ledger.service";
import { WarehousesService, type Warehouse } from "./warehouses.service";

type Input = z.output<typeof saveStockDocumentSchema>;
type FieldErrors = Record<string, keyof Messages["errors"]>;
export const documentSource = "inventory.document";
export const documentTypeCodes: Record<StockDocumentType, string> = {
  receipt_other: "inventory.receipt_other",
  issue_other: "inventory.issue_other",
  adjustment: "inventory.adjustment",
  transfer: "inventory.transfer",
  purchase_receipt: "inventory.purchase_receipt",
  purchase_return: "inventory.purchase_return",
  sales_issue: "inventory.sales_issue",
  sales_return: "inventory.sales_return",
  cost_adjustment: "inventory.cost_adjustment",
};
export const prefixes: Record<StockDocumentType, string> = {
  receipt_other: "NK",
  issue_other: "XK",
  adjustment: "DCK",
  transfer: "CK",
  purchase_receipt: "NM",
  purchase_return: "TNCC",
  sales_issue: "XBH",
  sales_return: "NTL",
  // Phiếu điều chỉnh giá trị (CONG_VIEC_45): số phiếu theo số chứng từ nguồn, không dùng dãy số.
  cost_adjustment: "DCGT",
};
// Phiếu có chứng từ gốc của Mua hàng (CONG_VIEC_07), Bán hàng (CONG_VIEC_08): lập, gửi qua PurchaseReceiptsService, SalesDeliveriesService.
export const purchaseTypes: StockDocumentType[] = ["purchase_receipt", "purchase_return"];
export const salesTypes: StockDocumentType[] = ["sales_issue", "sales_return"];
export const sourcedTypes: StockDocumentType[] = ["purchase_receipt", "purchase_return", "sales_issue", "sales_return", "cost_adjustment"];

type VariantInfo = {
  id: string;
  company_id: string;
  status: string;
  sku: string;
  product_name: string;
  option_values: string[];
  kind: "goods" | "service";
  tracks_lots: boolean;
  tracks_serials: boolean;
  base_unit_id: string;
  base_unit_name: string;
  units: { unitId: string; factor: string }[];
};

type DocumentRow = {
  id: string;
  type: StockDocumentType;
  document_no: string | null;
  document_date: string;
  warehouse_id: string;
  warehouse_name: string;
  destination_warehouse_id: string | null;
  destination_warehouse_name: string | null;
  company_id: string;
  company_name: string;
  reason_code: string;
  reason: string;
  note: string | null;
  status: StockDocumentStatus;
  approval_request_id: string | null;
  stocktake_id: string | null;
  line_count: number;
  total_value: string | null;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  version: number;
  partner_id: string | null;
  partner_name: string | null;
  source_id: string | null;
  counterpart_document_id: string | null;
  source_no: string | null;
  is_service: boolean;
  currency: string | null;
  exchange_rate: string | null;
  foreign_amount: string | null;
};

export type LineRow = {
  id: string;
  line_no: number;
  variant_id: string;
  sku: string;
  product_name: string;
  option_values: string[];
  tracks_lots: boolean;
  tracks_serials: boolean;
  unit_id: string;
  unit_name: string;
  quantity: string;
  base_quantity: string;
  base_unit_id: string;
  base_unit_name: string;
  unit_cost: string | null;
  cost_value: string | null;
  lot_id: string | null;
  lot_no: string | null;
  manufactured_on: string | null;
  expires_on: string | null;
  lot_override_reason: string | null;
  location_id: string | null;
  location_code: string | null;
  destination_location_id: string | null;
  destination_location_code: string | null;
  serials: string[];
  received_base_quantity: string | null;
  responsible_user_id: string | null;
  responsible_user_name: string | null;
  compensation_amount: string | null;
  source_line_id: string | null;
  rejected_base_quantity: string | null;
  rejection_reason: string | null;
  requires_quality_check: boolean;
};

const day = (value: Date | string | null) =>
  value === null ? null : value instanceof Date ? new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : String(value).slice(0, 10);
const decimal = (value: string | null) => (value === null ? null : trimDecimal(value));
// Chiều của dòng: nhập tăng, xuất giảm, điều chỉnh theo dấu số lượng.
export const lineSign = (type: StockDocumentType, quantity: string) =>
  type === "receipt_other" || type === "purchase_receipt" || type === "sales_return"
    ? 1
    : type === "issue_other" || type === "transfer" || type === "purchase_return" || type === "sales_issue"
      ? -1
      : quantity.startsWith("-")
        ? -1
        : 1;

@Injectable()
export class StockDocumentsService implements OnModuleInit {
  // Module khác đăng ký lúc khởi động để chạy trong cùng giao dịch ghi sổ (công nợ, CONG_VIEC_13).
  readonly postedHooks: ((transaction: Executor, documentId: string) => Promise<void>)[] = [];

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly warehouses: WarehousesService,
    private readonly ledger: StockLedgerService,
    private readonly reservations: ReservationsService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
  ) {}

  // Duyệt xong thì ghi sổ; ghi sổ lỗi (ví dụ đang kiểm kê) thì sự kiện được đẩy lại lần sau. Từ chối, rút thì nhả hàng đang giữ.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      const typeCode = String(event.payload.documentTypeCode);
      if (!Object.values(documentTypeCodes).includes(typeCode)) return;
      const status = String(event.payload.status);
      const requestId = String(event.payload.requestId);
      try {
        await this.applyDecision(requestId, status);
      } catch (error) {
        // Duyệt xong nhưng ngày phiếu đã thuộc kỳ khóa sổ: phiếu bị từ chối, nhả hàng giữ (lỗi khác, ví dụ đang kiểm kê, thì đẩy lại lần sau).
        if (!(error instanceof ApiError && error.messageKey === "periodLocked")) throw error;
        await this.database.transaction(async (transaction) => {
          const updated = await transaction.execute<{ id: string }>(sql`
            UPDATE inventory.documents SET status = 'rejected', note = concat_ws(' ', note, ${"(Không ghi sổ được: kỳ kế toán đã khóa sổ.)"}), updated_at = now()
            WHERE approval_request_id = ${requestId} AND status = 'pending' RETURNING id`);
          for (const document of updated.rows) await this.reservations.closeBySource(transaction, documentSource, document.id, "released");
        });
      }
    });
  }

  private async applyDecision(requestId: string, status: string): Promise<void> {
    {
      await this.database.transaction(async (transaction) => {
        const document = (
          await transaction.execute<{ id: string; type: StockDocumentType }>(sql`
          SELECT id, type FROM inventory.documents WHERE approval_request_id = ${requestId} AND status = 'pending' FOR UPDATE`)
        ).rows[0];
        if (!document) return;
        if (status === "approved") {
          if (document.type === "transfer") {
            await transaction.execute(sql`UPDATE inventory.documents SET status = 'posted', posted_at = now(), updated_at = now() WHERE id = ${document.id}`);
          } else {
            await this.postDocument(transaction, document.id);
          }
        } else if (status === "rejected" || status === "withdrawn") {
          await transaction.execute(sql`UPDATE inventory.documents SET status = ${status}, updated_at = now() WHERE id = ${document.id}`);
          await this.reservations.closeBySource(transaction, documentSource, document.id, "released");
        }
      });
    }
  }

  async list(actor: Actor, query: z.output<typeof stockDocumentListQuerySchema>): Promise<PageResponse<StockDocumentListItem>> {
    const visible = await this.visibility(actor);
    const conditions: SQL[] = [visible];
    if (query.type) conditions.push(sql`d.type = ${query.type}`);
    if (query.status) conditions.push(sql`d.status = ${query.status}`);
    if (query.warehouseId) conditions.push(sql`(d.warehouse_id = ${query.warehouseId} OR d.destination_warehouse_id = ${query.warehouseId})`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM inventory.documents d WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<DocumentRow>(sql`${this.select()} WHERE ${where} ORDER BY d.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const costVisible = await this.warehouses.costVisibility(actor);
    return { data: rows.rows.map((row) => this.toItem(row, costVisible(row))), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<StockDocumentResponse> {
    const row = await this.visibleRow(actor, id);
    const lines = await this.lines(id);
    const costVisible = (await this.warehouses.costVisibility(actor))(row);
    const discrepancies = await this.database.execute<{
      line_id: string;
      sku: string;
      shipped_quantity: string;
      received_quantity: string;
      difference: string;
      value: string;
      note: string | null;
      responsible_user_name: string | null;
      compensation_amount: string | null;
    }>(sql`
      SELECT t.line_id, v.sku, t.shipped_quantity::text, t.received_quantity::text, t.difference::text, t.value::text, t.note, ru.full_name AS responsible_user_name,
        t.compensation_amount::text
      FROM inventory.transfer_discrepancies t JOIN inventory.document_lines l ON l.id = t.line_id JOIN catalog.variants v ON v.id = l.variant_id
      LEFT JOIN core.users ru ON ru.id = t.responsible_user_id
      WHERE t.document_id = ${id} ORDER BY l.line_no`);
    const own = row.created_by === actor.userId;
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    const sourceWarehouse = await this.warehouses.find(row.warehouse_id);
    const destinationWarehouse = row.destination_warehouse_id ? await this.warehouses.find(row.destination_warehouse_id) : null;
    const canManageAt = async (warehouse: Warehouse | null) =>
      warehouse !== null &&
      (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "branch", companyId: warehouse.companyId, branchId: warehouse.branchId })).has(inventoryPermissions.manageDocuments);
    const canIssueSales = async (warehouse: Warehouse | null) =>
      warehouse !== null &&
      (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "branch", companyId: warehouse.companyId, branchId: warehouse.branchId })).has(inventoryPermissions.issueSales);
    const canReceivePurchases = async (warehouse: Warehouse | null) =>
      warehouse !== null &&
      (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "branch", companyId: warehouse.companyId, branchId: warehouse.branchId })).has(
        inventoryPermissions.receivePurchases,
      );
    // Phiếu nhập mua nội bộ (CONG_VIEC_09): số phiếu xuất gốc, công ty bán; khi chờ nhận thì số xuất, serial xuất từng dòng.
    const internalReceipt = row.counterpart_document_id
      ? {
          ...(
            await this.database.execute<{ issue_document_no: string | null; seller_company_name: string }>(sql`
            SELECT d.document_no AS issue_document_no, c.short_name AS seller_company_name FROM inventory.documents d JOIN core.companies c ON c.id = d.company_id
            WHERE d.id = ${row.counterpart_document_id}`)
          ).rows.map((item) => ({ issueDocumentNo: item.issue_document_no, sellerCompanyName: item.seller_company_name }))[0]!,
          lines:
            row.status === "in_transit"
              ? await Promise.all(
                  lines.map(async (line) => ({
                    lineId: line.id,
                    shippedBaseQuantity: trimDecimal(line.base_quantity),
                    shippedSerials: (
                      await this.database.execute<{ serial_no: string }>(sql`
                      SELECT s.serial_no FROM inventory.document_line_serials s JOIN inventory.document_lines l ON l.counterpart_line_id = s.line_id
                      WHERE l.id = ${line.id} ORDER BY s.serial_no`)
                    ).rows.map((serial) => serial.serial_no),
                  })),
                )
              : [],
        }
      : null;
    // CONG_VIEC_66: phiếu xuất giao hàng của đơn có người nhận giao thẳng (QUYTAC_NGHIEPVU_494 khoản 7).
    const recipient =
      row.type === "sales_issue" && row.source_id
        ? ((
            await this.database.execute<{ name: string; phone: string; address: string }>(sql`
            SELECT recipient_name AS name, recipient_phone AS phone, delivery_address AS address FROM sales.orders WHERE id = ${row.source_id} AND recipient_name IS NOT NULL`)
          ).rows[0] ?? null)
        : null;
    return {
      ...this.toItem(row, costVisible),
      internalReceipt,
      canReceiveInternal: internalReceipt !== null && row.status === "in_transit" && (await canReceivePurchases(sourceWarehouse)),
      destinationWarehouseId: row.destination_warehouse_id,
      note: row.note,
      approvalRequestId: row.approval_request_id,
      stocktakeId: row.stocktake_id,
      lines: lines.map((line) => ({
        id: line.id,
        variantId: line.variant_id,
        sku: line.sku,
        productName: line.product_name,
        optionValues: line.option_values,
        tracksLots: line.tracks_lots,
        tracksSerials: line.tracks_serials,
        unitId: line.unit_id,
        unitName: line.unit_name,
        quantity: trimDecimal(line.quantity),
        baseQuantity: trimDecimal(line.base_quantity),
        baseUnitName: line.base_unit_name,
        unitCost: costVisible ? decimal(line.unit_cost) : null,
        costValue: costVisible ? decimal(line.cost_value) : null,
        lotId: line.lot_id,
        lotNo: line.lot_no,
        manufacturedOn: day(line.manufactured_on),
        expiresOn: day(line.expires_on),
        lotOverrideReason: line.lot_override_reason,
        locationId: line.location_id,
        locationCode: line.location_code,
        destinationLocationId: line.destination_location_id,
        destinationLocationCode: line.destination_location_code,
        serials: line.serials,
        receivedBaseQuantity: decimal(line.received_base_quantity),
        responsibleUserId: line.responsible_user_id,
        responsibleUserName: line.responsible_user_name,
        compensationAmount: costVisible ? decimal(line.compensation_amount) : null,
        sourceLineId: line.source_line_id,
        rejectedBaseQuantity: decimal(line.rejected_base_quantity),
        rejectionReason: line.rejection_reason,
        requiresQualityCheck: line.requires_quality_check,
      })),
      discrepancies: discrepancies.rows.map((item) => ({
        lineId: item.line_id,
        sku: item.sku,
        shippedQuantity: trimDecimal(item.shipped_quantity),
        receivedQuantity: trimDecimal(item.received_quantity),
        difference: trimDecimal(item.difference),
        value: costVisible ? trimDecimal(item.value) : null,
        note: item.note,
        responsibleUserName: item.responsible_user_name,
        compensationAmount: costVisible ? decimal(item.compensation_amount) : null,
      })),
      version: row.version,
      canEdit: own && row.status === "draft" && !row.stocktake_id && !sourcedTypes.includes(row.type),
      canWithdraw: own && row.status === "pending" && !firstStepDecided,
      canShip: row.type === "transfer" && row.status === "posted" && (await canManageAt(sourceWarehouse)),
      canReceive: row.type === "transfer" && row.status === "in_transit" && (await canManageAt(destinationWarehouse)),
      partnerId: row.partner_id,
      partnerName: row.partner_name,
      recipient,
      sourceId: row.source_id,
      sourceNo: row.source_no,
      currency: row.currency,
      exchangeRate: row.exchange_rate === null ? null : trimDecimal(row.exchange_rate),
      foreignAmount: row.foreign_amount === null ? null : trimDecimal(row.foreign_amount),
      canQualityCheck: row.type === "purchase_receipt" && row.status === "quality_check" && (await canReceivePurchases(sourceWarehouse)),
      canReturn:
        (row.type === "purchase_receipt" && row.status === "posted" && (await canReceivePurchases(sourceWarehouse))) ||
        (row.type === "sales_issue" && row.status === "posted" && (await canIssueSales(sourceWarehouse))),
    };
  }

  async create(actor: Actor, input: Input): Promise<StockDocumentResponse> {
    if (sourcedTypes.includes(input.type)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { type: "invalidValue" } });
    const prepared = await this.prepare(actor, input);
    const id = await this.database.transaction(async (transaction) => {
      const documentId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.documents (company_id, warehouse_id, destination_warehouse_id, type, document_date, reason_code, reason, note, created_by)
        VALUES (${input.companyId}, ${input.warehouseId}, ${input.destinationWarehouseId ?? null}, ${input.type}, ${input.documentDate}::date, ${input.reasonCode}, ${input.reason},
          ${input.note ?? null}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, documentId, input, prepared);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: input.companyId, action: "stock_document.create", entityId: documentId, afterData: input }, transaction);
      return documentId;
    });
    return this.detail(actor, id);
  }

  // Dùng cho phiếu điều chỉnh sinh từ kiểm kê: lập trong giao dịch của kiểm kê.
  async createWithin(transaction: Executor, actor: Actor, input: Input, stocktakeId: string): Promise<string> {
    const prepared = await this.prepare(actor, input);
    const documentId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, note, stocktake_id, created_by)
      VALUES (${input.companyId}, ${input.warehouseId}, ${input.type}, ${input.documentDate}::date, ${input.reasonCode}, ${input.reason}, ${input.note ?? null}, ${stocktakeId}, ${actor.userId})
      RETURNING id`)
    ).rows[0]!.id;
    await this.writeLines(transaction, documentId, input, prepared);
    return documentId;
  }

  async update(actor: Actor, id: string, input: Input): Promise<StockDocumentResponse> {
    const row = await this.requireOwnDraft(actor, id);
    if (sourcedTypes.includes(row.type) || input.type !== row.type || input.companyId !== row.company_id || input.warehouseId !== row.warehouse_id) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { type: "documentHeaderLocked" } });
    }
    const prepared = await this.prepare(actor, input);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.documents SET destination_warehouse_id = ${input.destinationWarehouseId ?? null}, document_date = ${input.documentDate}::date, reason_code = ${input.reasonCode},
          reason = ${input.reason}, note = ${input.note ?? null}, version = version + 1, updated_at = now()
        WHERE id = ${id} AND status = 'draft' AND version = ${input.version ?? row.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM inventory.document_lines WHERE document_id = ${id}`);
      await this.writeLines(transaction, id, input, prepared);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.update", entityId: id, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const row = await this.requireOwnDraft(actor, id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM inventory.documents WHERE id = ${id} AND status = 'draft'`);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.delete", entityId: id }, transaction);
    });
  }

  async submit(actor: Actor, id: string): Promise<StockDocumentResponse> {
    const row = await this.requireOwnDraft(actor, id);
    await this.submitDocument(actor, row);
    return this.detail(actor, id);
  }

  // Gửi phiếu: kiểm đầy đủ, giữ hàng cho dòng giảm, cấp số, gửi duyệt; chưa có chính sách duyệt thì ghi sổ ngay (QUYTAC_NGHIEPVU_50).
  async submitDocument(
    actor: Actor,
    row: { id: string; type: StockDocumentType; company_id: string; warehouse_id: string; reason_code: string; stocktake_id: string | null; version: number },
  ): Promise<void> {
    const lines = await this.lines(row.id);
    const fields = await this.checkForSubmit(row, lines);
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const typeCode = documentTypeCodes[row.type];
    const ownerActor: Actor = { ...actor, companyId: row.company_id };
    const configured = await this.database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${row.company_id} AND document_type_code = ${typeCode} LIMIT 1`);
    if (configured.rows.length === 0) await this.sequences.update(ownerActor, typeCode, { prefix: prefixes[row.type], resetPeriod: "year", padding: 6 });
    const today = this.permissionService.today();
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute<{ document_date: string }>(sql`
        SELECT document_date::text FROM inventory.documents WHERE id = ${row.id} AND status = 'draft' AND version = ${row.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Ngày phiếu thuộc kỳ kế toán đã khóa thì không gửi được (QUYTAC_NGHIEPVU_97).
      await assertOpenPeriod(transaction, row.company_id, locked.rows[0]!.document_date);
      const documentNo = await this.sequences.next(row.company_id, typeCode, transaction);
      // Giữ hàng cho tổng số giảm của từng mặt hàng.
      const decreases = new Map<string, number>();
      for (const line of lines) {
        if (lineSign(row.type, line.quantity) > 0) continue;
        decreases.set(line.variant_id, (decreases.get(line.variant_id) ?? 0) + Math.abs(Number(line.base_quantity)));
      }
      for (const [variantId, quantity] of decreases) {
        await this.reservations
          .reserve(transaction, {
            warehouseId: row.warehouse_id,
            companyId: row.company_id,
            variantId,
            quantity: quantity.toFixed(4),
            sourceType: documentSource,
            sourceId: row.id,
            sourceNo: documentNo,
            expiresAt: null,
            userId: actor.userId,
          })
          .catch((error: unknown) => {
            // Phiếu khác vừa giữ hết hàng sau bước kiểm tra: báo cùng lỗi gắn vào dòng hàng như bước kiểm tra (LOI_03).
            if (!(error instanceof ApiError) || error.messageKey !== "insufficientAvailableStock") throw error;
            const index = lines.findIndex((line) => line.variant_id === variantId);
            throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`lines.${index}.quantity`]: "insufficientAvailableStock" } });
          });
      }
      const amount = await this.estimateValue(transaction, row);
      let requestId: string | null = null;
      try {
        requestId = await this.approvals.submitWithin(transaction, row.company_id, actor.userId, {
          documentTypeCode: typeCode,
          documentId: row.id,
          documentNo,
          amount,
          currency: "VND",
          documentDate: today,
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
      await transaction.execute(sql`
        UPDATE inventory.documents SET status = 'pending', document_no = ${documentNo}, approval_request_id = ${requestId}, submitted_at = now(), updated_at = now(), version = version + 1
        WHERE id = ${row.id}`);
      if (!requestId) {
        if (row.type === "transfer") await transaction.execute(sql`UPDATE inventory.documents SET status = 'posted', posted_at = now() WHERE id = ${row.id}`);
        else await this.postDocument(transaction, row.id);
      }
      await this.auditService.record(
        { ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.submit", entityId: row.id, afterData: { documentNo, amount, approvalRequestId: requestId } },
        transaction,
      );
    });
  }

  async withdraw(actor: Actor, id: string): Promise<StockDocumentResponse> {
    const row = await this.visibleRow(actor, id);
    if (row.created_by !== actor.userId || !row.approval_request_id) throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`UPDATE inventory.documents SET status = 'withdrawn', updated_at = now() WHERE id = ${id} AND status = 'pending' RETURNING id`);
      if (updated.rows.length > 0) await this.reservations.closeBySource(transaction, documentSource, id, "released");
    });
    return this.detail(actor, id);
  }

  // Ghi sổ phiếu đã duyệt: tạo lô của dòng nhập, ghi từng dòng qua sổ kho, đánh dấu hàng giữ đã dùng.
  async postDocument(transaction: Executor, documentId: string): Promise<void> {
    const document = (
      await transaction.execute<{ type: StockDocumentType; company_id: string; warehouse_id: string; stocktake_id: string | null }>(sql`
      SELECT type, company_id, warehouse_id, stocktake_id FROM inventory.documents WHERE id = ${documentId}`)
    ).rows[0]!;
    const lines = await this.lines(documentId, transaction);
    const entries: LedgerEntry[] = [];
    const posted: LineRow[] = [];
    for (const line of lines) {
      const sign = lineSign(document.type, line.quantity);
      // Phiếu nhập mua: chỉ ghi sổ phần đạt kiểm tra chất lượng (QUYTAC_NGHIEPVU_65).
      const rejected = Number(line.rejected_base_quantity ?? 0);
      const accepted = Math.abs(Number(line.base_quantity)) - rejected;
      if (accepted <= 0) continue;
      posted.push(line);
      let lotId = line.lot_id;
      if (sign > 0 && line.tracks_lots && line.lot_no) {
        lotId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO inventory.lots (company_id, variant_id, lot_no, manufactured_on, expires_on)
          VALUES (${document.company_id}, ${line.variant_id}, ${line.lot_no}, ${line.manufactured_on}::date, ${line.expires_on}::date)
          ON CONFLICT (company_id, variant_id, lot_no) DO UPDATE SET lot_no = EXCLUDED.lot_no RETURNING id`)
        ).rows[0]!.id;
        await transaction.execute(sql`UPDATE inventory.document_lines SET lot_id = ${lotId} WHERE id = ${line.id}`);
      }
      const amount = rejected > 0 ? accepted.toFixed(4) : line.base_quantity.replace(/^-/, "");
      // Có đơn giá: nhập theo đơn giá; trả hàng nhà cung cấp xuất theo giá phiếu nhập gốc đã lưu ở đơn giá (QUYTAC_NGHIEPVU_66).
      // Nhận hàng trả lại: nhập theo giá vốn phiếu xuất gốc đã lưu ở đơn giá (QUYTAC_NGHIEPVU_72).
      const fullValue = line.unit_cost !== null && (sign > 0 || document.type === "purchase_return") ? await this.lineValue(transaction, line) : null;
      const value = fullValue !== null && rejected > 0 ? ((Number(fullValue) * accepted) / Math.abs(Number(line.base_quantity))).toFixed(4) : fullValue;
      entries.push({
        warehouseId: document.warehouse_id,
        companyId: document.company_id,
        variantId: line.variant_id,
        lotId,
        locationId: line.location_id,
        quantity: sign > 0 ? amount : `-${amount}`,
        totalValue: value,
        serials: line.tracks_serials ? line.serials : undefined,
        documentId,
        lineId: line.id,
        ignoreStocktakeLock: document.stocktake_id !== null,
      });
    }
    const results = await this.ledger.postAll(transaction, entries);
    for (const [index, result] of results.entries()) {
      const line = posted[index]!;
      await transaction.execute(sql`UPDATE inventory.document_lines SET cost_value = ${result.value.replace(/^-/, "")}::numeric WHERE id = ${line.id}`);
      if (result.serialIds.length > 0) {
        await transaction.execute(sql`
          UPDATE inventory.document_line_serials ls SET serial_id = sr.id FROM inventory.serials sr
          WHERE ls.line_id = ${line.id} AND sr.company_id = ${document.company_id} AND sr.serial_no = ls.serial_no`);
      }
    }
    await transaction.execute(sql`UPDATE inventory.documents SET status = 'posted', posted_at = now(), updated_at = now() WHERE id = ${documentId}`);
    await this.reservations.closeBySource(transaction, documentSource, documentId, "consumed");
    for (const hook of this.postedHooks) await hook(transaction, documentId);
  }

  // Phiếu dịch vụ do hệ thống tự lập khi đơn xác nhận (CONG_VIEC_43; QUYTAC_NGHIEPVU_275 đến 277): cấp số, ghi sổ ngay, không ghi thẻ kho, tồn, giữ hàng,
  // giá vốn bằng 0; chạy các hook hạ nguồn (công nợ, hóa đơn điện tử, bút toán) như phiếu ghi sổ. Người dùng không lập tay được phiếu này.
  async postServiceDocument(
    transaction: Executor,
    input: {
      type: "sales_issue" | "purchase_receipt";
      companyId: string;
      warehouseId: string;
      documentDate: string;
      reason: string;
      sourceType: string;
      sourceId: string;
      partnerId: string | null;
      createdBy: string;
      lines: { variantId: string; unitId: string; quantity: string; baseQuantity: string; unitCost: string | null; sourceLineId: string }[];
    },
  ): Promise<string> {
    await assertOpenPeriod(transaction, input.companyId, input.documentDate);
    const typeCode = documentTypeCodes[input.type];
    // Công ty chưa cấu hình dãy số loại phiếu này: tạo mặc định trong cùng giao dịch (giống cấu hình khi gửi phiếu đầu tiên).
    await transaction.execute(sql`
      INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
      SELECT ${input.companyId}, ${typeCode}, ${periodKey("year", this.permissionService.today())}, ${prefixes[input.type]}, 'year', 6, 1
      WHERE NOT EXISTS (SELECT 1 FROM core.number_sequences WHERE company_id = ${input.companyId} AND document_type_code = ${typeCode})
      ON CONFLICT DO NOTHING`);
    const documentNo = await this.sequences.next(input.companyId, typeCode, transaction);
    const documentId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO inventory.documents (company_id, warehouse_id, type, document_no, document_date, reason_code, reason, source_type, source_id, partner_id, status, is_service,
        created_by, submitted_at, posted_at)
      VALUES (${input.companyId}, ${input.warehouseId}, ${input.type}, ${documentNo}, ${input.documentDate}::date, ${input.type === "sales_issue" ? "sale" : "purchase"}, ${input.reason},
        ${input.sourceType}, ${input.sourceId}, ${input.partnerId}, 'posted', true, ${input.createdBy}, now(), now())
      RETURNING id`)
    ).rows[0]!.id;
    for (const [index, line] of input.lines.entries())
      await transaction.execute(sql`
        INSERT INTO inventory.document_lines (document_id, line_no, variant_id, unit_id, quantity, base_quantity, unit_cost, cost_value, source_line_id)
        VALUES (${documentId}, ${index + 1}, ${line.variantId}, ${line.unitId}, ${line.quantity}::numeric, ${line.baseQuantity}::numeric, ${line.unitCost}::numeric, 0, ${line.sourceLineId})`);
    for (const hook of this.postedHooks) await hook(transaction, documentId);
    return documentId;
  }

  // Lô gợi ý xuất: hết hạn trước, không có hạn dùng thì nhập trước xuất trước (QUYTAC_NGHIEPVU_51).
  async lotSuggestions(actor: Actor, query: z.output<typeof lotSuggestionQuerySchema>): Promise<LotSuggestion[]> {
    await this.warehouses.operable(actor.userId, query.warehouseId, inventoryPermissions.manageDocuments);
    return this.suggestLots(this.database, query.warehouseId, query.companyId, query.variantId, query.locationId ?? null, query.includeExpired === "true");
  }

  async suggestLots(executor: Executor, warehouseId: string, companyId: string, variantId: string, locationId: string | null, includeExpired: boolean): Promise<LotSuggestion[]> {
    const today = this.permissionService.today();
    const rows = await executor.execute<{
      lot_id: string;
      lot_no: string;
      expires_on: string | null;
      manufactured_on: string | null;
      location_id: string | null;
      location_code: string | null;
      quantity: string;
      expired: boolean;
    }>(sql`
      SELECT l.id AS lot_id, l.lot_no, l.expires_on, l.manufactured_on, b.location_id, loc.code AS location_code, b.quantity::text AS quantity,
        coalesce(l.expires_on < ${today}::date, false) AS expired
      FROM inventory.balances b JOIN inventory.lots l ON l.id = b.lot_id LEFT JOIN inventory.locations loc ON loc.id = b.location_id
      WHERE b.warehouse_id = ${warehouseId} AND b.company_id = ${companyId} AND b.variant_id = ${variantId} AND b.quantity > 0
        AND (${locationId}::uuid IS NULL OR b.location_id = ${locationId}::uuid)
      ORDER BY l.expires_on ASC NULLS LAST, l.created_at, loc.code`);
    let suggested = false;
    return rows.rows.map((row) => {
      const usable = includeExpired || !row.expired;
      const isSuggested = usable && !suggested;
      if (isSuggested) suggested = true;
      return {
        lotId: row.lot_id,
        lotNo: row.lot_no,
        expiresOn: day(row.expires_on),
        manufacturedOn: day(row.manufactured_on),
        locationId: row.location_id,
        locationCode: row.location_code,
        quantity: trimDecimal(row.quantity),
        expired: row.expired,
        suggested: isSuggested,
      };
    });
  }

  // Tìm mặt hàng của công ty chủ hàng theo mã vạch (đúng), mã hàng (đúng) hoặc tên không dấu.
  async searchItems(actor: Actor, query: z.output<typeof stockItemSearchQuerySchema>): Promise<StockItemOption[]> {
    // Chỉ tìm hàng của công ty chủ hàng được gửi vào ít nhất một kho người dùng thao tác được.
    const { operable } = await this.warehouses.stockScope(actor);
    const accepted =
      operable.length === 0
        ? []
        : (await this.database.execute(sql`SELECT 1 FROM inventory.warehouse_owners WHERE company_id = ${query.companyId} AND warehouse_id = ANY(${pgArray(operable)}::uuid[]) LIMIT 1`)).rows;
    if (accepted.length === 0) throw new ApiError("FORBIDDEN", "forbidden");
    return searchVariantOptions(this.database, query.companyId, query.search);
  }

  // Kiểm phiếu khi lưu nháp: kho, chủ hàng, lý do, mặt hàng, đơn vị, vị trí, lô, serial.
  // actor null: chứng từ hệ thống tự lập (đơn VComm, CONG_VIEC_24), không xét quyền kho của người dùng.
  async prepare(actor: Actor | null, input: Input, permission: string = inventoryPermissions.manageDocuments): Promise<{ variants: Map<string, VariantInfo>; warehouse: Warehouse }> {
    const warehouse = actor ? await this.warehouses.operable(actor.userId, input.warehouseId, permission) : await this.warehouses.find(input.warehouseId);
    if (!warehouse) throw new ApiError("NOT_FOUND", "notFound");
    const fields: FieldErrors = {};
    if (warehouse.status !== "active") fields.warehouseId = "invalidValue";
    // Kho Dropship chỉ nhận chứng từ hệ thống lập (QUYTAC_NGHIEPVU_496).
    else if (actor && warehouse.kind === "dropship") fields.warehouseId = "dropshipWarehouseManual";
    if (!warehouse.ownerIds.includes(input.companyId)) fields.companyId = "warehouseOwnerNotAllowed";
    if (!(stockReasonCodes[input.type] as readonly string[]).includes(input.reasonCode)) fields.reasonCode = "invalidValue";
    if (input.type === "transfer") {
      const destination = input.destinationWarehouseId ? await this.warehouses.find(input.destinationWarehouseId) : null;
      if (!destination || destination.id === warehouse.id || destination.status !== "active") fields.destinationWarehouseId = "invalidValue";
      else if (destination.kind === "dropship") fields.destinationWarehouseId = "dropshipWarehouseManual";
      else if (!destination.ownerIds.includes(input.companyId)) fields.destinationWarehouseId = "warehouseOwnerNotAllowed";
    } else if (input.destinationWarehouseId) {
      fields.destinationWarehouseId = "invalidValue";
    }
    const variants = await this.variantInfo(input.lines.map((line) => line.variantId));
    const locations = new Set(
      (await this.database.execute<{ id: string }>(sql`SELECT id FROM inventory.locations WHERE warehouse_id = ${warehouse.id} AND status = 'active'`)).rows.map((row) => row.id),
    );
    input.lines.forEach((line, index) => {
      const at = (field: string) => `lines.${index}.${field}`;
      const variant = variants.get(line.variantId);
      if (!variant || variant.company_id !== input.companyId || variant.status !== "active") {
        fields[at("variantId")] = "stockItemNotOwned";
        return;
      }
      // Dịch vụ không vào phiếu kho: điểm chung của phiếu nhập khác, xuất khác, điều chỉnh, chuyển kho, nhập mua, xuất giao hàng, nhận trả (QUYTAC_NGHIEPVU_275).
      if (variant.kind === "service") {
        fields[at("variantId")] = "serviceNotStocked";
        return;
      }
      const factor = variant.units.find((unit) => unit.unitId === line.unitId)?.factor;
      if (!factor) fields[at("unitId")] = "invalidValue";
      const sign = lineSign(input.type, line.quantity);
      if (input.type !== "adjustment" && line.quantity.startsWith("-")) fields[at("quantity")] = "invalidValue";
      if (warehouse.usesLocations) {
        if (!line.locationId || !locations.has(line.locationId)) fields[at("locationId")] = line.locationId ? "invalidValue" : "required";
      } else if (line.locationId) {
        fields[at("locationId")] = "invalidValue";
      }
      if (input.type === "receipt_other" && line.unitCost === null) fields[at("unitCost")] = "required";
      if (variant.tracks_lots) {
        if (sign > 0) {
          if (!line.lotNo) fields[at("lotNo")] = "required";
          if (!line.expiresOn) fields[at("expiresOn")] = "required";
        } else if (!line.lotId) {
          fields[at("lotId")] = "required";
        }
      } else if (line.lotId || line.lotNo || line.expiresOn) {
        fields[at("lotNo")] = "lotNotTracked";
      }
      if (variant.tracks_serials && factor) {
        const base = Math.abs(Number(line.quantity) * Number(factor));
        if (!Number.isInteger(base) || line.serials.length !== base) fields[at("serials")] = "serialCountMismatch";
        else if (new Set(line.serials).size !== line.serials.length) fields[at("serials")] = "serialDuplicate";
      } else if (line.serials.length > 0) {
        fields[at("serials")] = "serialNotTracked";
      }
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return { variants, warehouse };
  }

  // Kiểm khi gửi: đủ hàng, lô còn hạn, chọn lô khác gợi ý có lý do, serial đúng trạng thái (QUYTAC_NGHIEPVU_47, 51).
  async checkForSubmit(
    row: { type: StockDocumentType; company_id: string; warehouse_id: string; reason_code: string; stocktake_id: string | null },
    lines: LineRow[],
    executor: Executor = this.database,
  ): Promise<FieldErrors> {
    const fields: FieldErrors = {};
    const today = this.permissionService.today();
    const neededByBalance = new Map<string, { quantity: number; index: number }>();
    const neededByVariant = new Map<string, { quantity: number; index: number }>();
    for (const [index, line] of lines.entries()) {
      const at = (field: string) => `lines.${index}.${field}`;
      const sign = lineSign(row.type, line.quantity);
      const amount = Math.abs(Number(line.base_quantity));
      if (sign < 0) {
        const balanceKey = `${line.variant_id}|${line.lot_id ?? ""}|${line.location_id ?? ""}`;
        neededByBalance.set(balanceKey, { quantity: (neededByBalance.get(balanceKey)?.quantity ?? 0) + amount, index });
        neededByVariant.set(line.variant_id, { quantity: (neededByVariant.get(line.variant_id)?.quantity ?? 0) + amount, index });
        if (line.tracks_lots && line.lot_id) {
          const lot = (
            await executor.execute<{ expires_on: string | null }>(
              sql`SELECT expires_on FROM inventory.lots WHERE id = ${line.lot_id} AND company_id = ${row.company_id} AND variant_id = ${line.variant_id}`,
            )
          ).rows[0];
          if (!lot) fields[at("lotId")] = "invalidValue";
          else {
            // Hủy hàng hết hạn, phiếu điều chỉnh do kiểm kê sinh ra được giảm lô đã hết hạn.
            const disposal = row.reason_code === "expired_disposal" || row.stocktake_id !== null;
            if (lot.expires_on !== null && day(lot.expires_on)! < today && !disposal) fields[at("lotId")] = "lotExpired";
            const suggestion = (await this.suggestLots(this.database, row.warehouse_id, row.company_id, line.variant_id, line.location_id, disposal)).find((item) => item.suggested);
            if (suggestion && suggestion.lotId !== line.lot_id && !line.lot_override_reason) fields[at("lotOverrideReason")] = "lotOverrideReasonRequired";
          }
        }
        if (line.tracks_serials) {
          const found = await executor.execute<{ total: number }>(sql`
            SELECT count(*)::int AS total FROM inventory.serials WHERE company_id = ${row.company_id} AND variant_id = ${line.variant_id} AND warehouse_id = ${row.warehouse_id}
              AND status = 'in_stock' AND location_id IS NOT DISTINCT FROM ${line.location_id} AND serial_no = ANY(${pgArray(line.serials)}::text[])`);
          if (found.rows[0]!.total !== line.serials.length) fields[at("serials")] = "serialNotInStock";
        }
      } else {
        if (line.tracks_lots && line.lot_no) {
          const lot = (
            await executor.execute<{ expires_on: string | null }>(
              sql`SELECT expires_on FROM inventory.lots WHERE company_id = ${row.company_id} AND variant_id = ${line.variant_id} AND lot_no = ${line.lot_no}`,
            )
          ).rows[0];
          if (lot && day(lot.expires_on) !== day(line.expires_on)) fields[at("expiresOn")] = "lotExpiryMismatch";
        }
        if (line.tracks_serials) {
          const taken = await executor.execute(sql`
            SELECT 1 FROM inventory.serials WHERE company_id = ${row.company_id} AND serial_no = ANY(${pgArray(line.serials)}::text[]) AND (status <> 'issued' OR variant_id <> ${line.variant_id}) LIMIT 1`);
          if (taken.rows.length > 0) fields[at("serials")] = "serialAlreadyInStock";
        }
      }
    }
    for (const [balanceKey, needed] of neededByBalance) {
      const [variantId, lotId, locationId] = balanceKey.split("|");
      const balance = (
        await executor.execute<{ quantity: string }>(sql`
        SELECT coalesce(sum(quantity), 0)::text AS quantity FROM inventory.balances
        WHERE warehouse_id = ${row.warehouse_id} AND company_id = ${row.company_id} AND variant_id = ${variantId}
          AND lot_id IS NOT DISTINCT FROM ${lotId || null}::uuid AND location_id IS NOT DISTINCT FROM ${locationId || null}::uuid`)
      ).rows[0]!;
      if (Number(balance.quantity) < needed.quantity) fields[`lines.${needed.index}.quantity`] = "insufficientStock";
    }
    for (const [variantId, needed] of neededByVariant) {
      if (fields[`lines.${needed.index}.quantity`]) continue;
      const available = await this.reservations.available(executor, row.warehouse_id, row.company_id, variantId);
      if (Number(available) < needed.quantity) fields[`lines.${needed.index}.quantity`] = "insufficientAvailableStock";
    }
    return fields;
  }

  async writeLines(transaction: Executor, documentId: string, input: Input, prepared: { variants: Map<string, VariantInfo> }): Promise<void> {
    for (const [index, line] of input.lines.entries()) {
      const variant = prepared.variants.get(line.variantId)!;
      const factor = variant.units.find((unit) => unit.unitId === line.unitId)!.factor;
      const lineId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.document_lines (document_id, line_no, variant_id, unit_id, quantity, base_quantity, unit_cost, lot_id, lot_no, manufactured_on, expires_on,
          lot_override_reason, location_id, destination_location_id, responsible_user_id, compensation_amount)
        VALUES (${documentId}, ${index + 1}, ${line.variantId}, ${line.unitId}, ${line.quantity}::numeric, round(${line.quantity}::numeric * ${factor}::numeric, 4), ${line.unitCost ?? null}::numeric,
          ${line.lotId ?? null}, ${line.lotNo ?? null}, ${line.manufacturedOn ?? null}::date, ${line.expiresOn ?? null}::date, ${line.lotOverrideReason ?? null},
          ${line.locationId ?? null}, ${line.destinationLocationId ?? null}, ${line.responsibleUserId ?? null}, ${line.compensationAmount ?? null}::numeric)
        RETURNING id`)
      ).rows[0]!.id;
      for (const serialNo of line.serials) await transaction.execute(sql`INSERT INTO inventory.document_line_serials (line_id, serial_no) VALUES (${lineId}, ${serialNo})`);
    }
  }

  private async lineValue(transaction: Executor, line: LineRow): Promise<string> {
    return (await transaction.execute<{ value: string }>(sql`SELECT round(abs(${line.quantity}::numeric) * ${line.unit_cost}::numeric, 4)::text AS value`)).rows[0]!.value;
  }

  // Giá trị duyệt: dòng có đơn giá theo đơn giá, còn lại theo giá vốn bình quân hiện hành.
  private async estimateValue(transaction: Executor, row: { id: string; company_id: string; warehouse_id: string }): Promise<string> {
    return (
      await transaction.execute<{ value: string }>(sql`
      SELECT coalesce(sum(CASE WHEN l.unit_cost IS NOT NULL THEN abs(l.quantity) * l.unit_cost ELSE abs(l.base_quantity) * coalesce(c.average_cost, 0) END), 0)::numeric(20,4)::text AS value
      FROM inventory.document_lines l LEFT JOIN inventory.costs c ON c.warehouse_id = ${row.warehouse_id} AND c.company_id = ${row.company_id} AND c.variant_id = l.variant_id
      WHERE l.document_id = ${row.id}`)
    ).rows[0]!.value;
  }

  private async variantInfo(ids: string[]): Promise<Map<string, VariantInfo>> {
    if (ids.length === 0) return new Map();
    const rows = await this.database.execute<VariantInfo>(sql`
      SELECT v.id, v.company_id, v.status, v.sku, p.name AS product_name, v.option_values, p.kind, p.tracks_lots, p.tracks_serials, p.base_unit_id, bu.name_vi AS base_unit_name,
        (SELECT json_agg(u) FROM (SELECT p.base_unit_id AS "unitId", '1' AS factor UNION ALL SELECT pu.unit_id, pu.factor::text FROM catalog.product_units pu WHERE pu.product_id = p.id) u) AS units
      FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units bu ON bu.id = p.base_unit_id
      WHERE v.id = ANY(${pgArray([...new Set(ids)])}::uuid[])`);
    return new Map(rows.rows.map((row) => [row.id, row]));
  }

  async lines(documentId: string, executor: Executor = this.database): Promise<LineRow[]> {
    return (
      await executor.execute<LineRow>(sql`
      SELECT l.id, l.line_no, l.variant_id, v.sku, p.name AS product_name, v.option_values, p.tracks_lots, p.tracks_serials, l.unit_id, u.name_vi AS unit_name,
        l.quantity::text, l.base_quantity::text, p.base_unit_id, bu.name_vi AS base_unit_name, l.unit_cost::text, l.cost_value::text, l.lot_id, coalesce(lot.lot_no, l.lot_no) AS lot_no,
        coalesce(lot.manufactured_on, l.manufactured_on)::text AS manufactured_on, coalesce(lot.expires_on, l.expires_on)::text AS expires_on, l.lot_override_reason,
        l.location_id, loc.code AS location_code, l.destination_location_id, dloc.code AS destination_location_code,
        coalesce((SELECT array_agg(s.serial_no ORDER BY s.serial_no) FROM inventory.document_line_serials s WHERE s.line_id = l.id), '{}') AS serials,
        l.received_base_quantity::text, l.responsible_user_id, ru.full_name AS responsible_user_name, l.compensation_amount::text,
        l.source_line_id, l.rejected_base_quantity::text, l.rejection_reason,
        coalesce((SELECT cat.requires_quality_check FROM catalog.categories cat WHERE cat.id = p.category_id), false) AS requires_quality_check
      FROM inventory.document_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      JOIN catalog.units u ON u.id = l.unit_id JOIN catalog.units bu ON bu.id = p.base_unit_id
      LEFT JOIN inventory.lots lot ON lot.id = l.lot_id LEFT JOIN inventory.locations loc ON loc.id = l.location_id LEFT JOIN inventory.locations dloc ON dloc.id = l.destination_location_id
      LEFT JOIN core.users ru ON ru.id = l.responsible_user_id
      WHERE l.document_id = ${documentId} ORDER BY l.line_no`)
    ).rows;
  }

  // Phiếu thấy được: kho thao tác được (mọi chủ hàng), hoặc phiếu của công ty đang chọn khi có quyền xem tồn ở công ty.
  private async visibility(actor: Actor): Promise<SQL> {
    const warehouses = await this.warehouses.list(actor);
    const operable = warehouses.filter((warehouse) => warehouse.canOperate).map((warehouse) => warehouse.id);
    const ownerView = warehouses.filter((warehouse) => !warehouse.canOperate).map((warehouse) => warehouse.id);
    const parts: SQL[] = [sql`FALSE`];
    if (operable.length > 0) parts.push(sql`d.warehouse_id = ANY(${pgArray(operable)}::uuid[]) OR d.destination_warehouse_id = ANY(${pgArray(operable)}::uuid[])`);
    if (ownerView.length > 0) parts.push(sql`(d.company_id = ${actor.companyId} AND d.warehouse_id = ANY(${pgArray(ownerView)}::uuid[]))`);
    return sql`(${sql.join(parts, sql` OR `)})`;
  }

  async visibleRow(actor: Actor, id: string): Promise<DocumentRow> {
    const row = (await this.database.execute<DocumentRow>(sql`${this.select()} WHERE d.id = ${id} AND ${await this.visibility(actor)}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async requireOwnDraft(actor: Actor, id: string): Promise<DocumentRow> {
    const row = await this.visibleRow(actor, id);
    await this.warehouses.operable(actor.userId, row.warehouse_id, inventoryPermissions.manageDocuments);
    if (row.created_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    if (row.status !== "draft" || row.stocktake_id) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    return row;
  }

  private toItem(row: DocumentRow, costVisible: boolean): StockDocumentListItem {
    return {
      id: row.id,
      type: row.type,
      documentNo: row.document_no,
      documentDate: day(row.document_date)!,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      destinationWarehouseName: row.destination_warehouse_name,
      companyId: row.company_id,
      companyName: row.company_name,
      reasonCode: row.reason_code,
      reason: row.reason,
      status: row.status,
      lineCount: row.line_count,
      totalValue: costVisible ? decimal(row.total_value) : null,
      createdByName: row.created_by_name,
      createdAt: new Date(row.created_at).toISOString(),
      isService: row.is_service,
    };
  }

  private select() {
    return sql`
      SELECT d.id, d.type, d.document_no, d.document_date::text, d.warehouse_id, w.name AS warehouse_name, d.destination_warehouse_id, dw.name AS destination_warehouse_name,
        d.company_id, c.short_name AS company_name, d.reason_code, d.reason, d.note, d.status, d.approval_request_id, d.stocktake_id,
        (SELECT count(*)::int FROM inventory.document_lines l WHERE l.document_id = d.id) AS line_count,
        (SELECT sum(l.cost_value)::text FROM inventory.document_lines l WHERE l.document_id = d.id) AS total_value,
        d.created_by, u.full_name AS created_by_name, d.created_at, d.version, d.partner_id, pt.name AS partner_name, d.source_id, d.counterpart_document_id, d.is_service,
        d.currency, d.exchange_rate::text, CASE WHEN d.status = 'posted' THEN finance.inventory_foreign_amount(d.id)::text END AS foreign_amount,
        CASE WHEN d.type = 'purchase_receipt' THEN (SELECT o.document_no FROM purchasing.orders o WHERE o.id = d.source_id)
             WHEN d.type = 'sales_issue' THEN (SELECT so.document_no FROM sales.orders so WHERE so.id = d.source_id)
             WHEN d.type IN ('purchase_return', 'sales_return') THEN (SELECT r.document_no FROM inventory.documents r WHERE r.id = d.source_id) END AS source_no
      FROM inventory.documents d LEFT JOIN crm.partners pt ON pt.id = d.partner_id JOIN inventory.warehouses w ON w.id = d.warehouse_id LEFT JOIN inventory.warehouses dw ON dw.id = d.destination_warehouse_id
      JOIN core.companies c ON c.id = d.company_id JOIN core.users u ON u.id = d.created_by`;
  }
}
