// Vận đơn đơn dropship của người bán: tạo qua đơn vị vận chuyển (dùng lại kết nối của sàn) hoặc nhập tay khi đơn vị vận chuyển chưa bật;
// phiếu xuất nháp lập khi tạo vận đơn, ghi sổ khi lấy hàng; hoàn hàng nhận trả; phiếu giao danh nghĩa người bán
// (CONG_VIEC_62 CHUC_NANG_225; QUYTAC_NGHIEPVU_507, 508; API_310, API_311, API_128; MAN_HINH_238, MAN_HINH_239).
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import {
  carrierCodes,
  type CarrierCode,
  type ResellerShipmentListResponse,
  type resellerShipmentListQuerySchema,
  type resellerShipmentManualSchema,
  type ResellerShipmentOrder,
  type ResellerShippingStatus,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { renderPdf } from "../common/pdf";
import { pgArray } from "../inventory/stock-ledger.service";
import { DATABASE, type Database } from "../database/database.module";
import { inventoryPermissions } from "../inventory/inventory-context";
import { SalesDeliveriesService } from "../inventory/sales-deliveries.service";
import { WarehousesService } from "../inventory/warehouses.service";
import { CarrierFailure, type CarrierPhase, type CreatedShipment, type ShipmentInfo, type WebhookReport } from "../marketplace/carriers/carrier";
import { carrierAdapter } from "../marketplace/carriers/carrier-registry";
import { ShipmentsService } from "../marketplace/shipments.service";
import { vietnamToday } from "../marketplace/shop.service";
import type { Actor } from "../permissions/roles.service";
import { SalesOrdersService } from "./sales-orders.service";

// Giao dịch (có execute, insert và điểm lưu transaction).
type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0];
const systemClient = { ip: null, userAgent: "carrier-webhook", requestId: null };
// Kích thước, khối lượng gói mặc định khi công ty không có cài đặt cửa hàng của sàn.
const defaultPackage = { lengthCm: 20, widthCm: 15, heightCm: 10, minimumWeightGrams: 200 };

type OrderRow = {
  id: string;
  company_id: string;
  document_no: string | null;
  partner_order_code: string | null;
  order_date: Date | string;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_street: string;
  delivery_address: string | null;
  ward_name: string | null;
  province_name: string | null;
  cod_amount: string;
  currency: string;
  warehouse_id: string;
  warehouse_name: string | null;
  uses_locations: boolean;
  reseller_name: string;
  reseller_phone: string | null;
  line_count: number;
};

type ShipmentRow = {
  id: string;
  order_id: string;
  company_id: string;
  carrier_code: CarrierCode | null;
  carrier_name: string | null;
  tracking_code: string | null;
  carrier_status: string | null;
  shipping_status: ResellerShippingStatus;
  fee: string | null;
  cod_amount: string;
  cod_collected_at: Date | null;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  synced_at: Date;
  version: number;
};

// Thứ tự trạng thái giao; hoàn hàng sau đang giao, hủy trước khi lấy hàng.
const rank: Record<ResellerShippingStatus, number> = { requesting: 0, awaiting_pickup: 1, shipping: 2, delivered: 3, returned: 3, cancelled: 3 };
const statusOfPhase: Record<Exclude<CarrierPhase, "attention">, ResellerShippingStatus> = {
  waiting_pickup: "awaiting_pickup",
  picked: "shipping",
  delivered: "delivered",
  returned: "returned",
  cancelled: "cancelled",
};

@Injectable()
export class ResellerShipmentsService implements OnModuleInit {
  private readonly logger = new Logger(ResellerShipmentsService.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly auditService: AuditService,
    private readonly deliveries: SalesDeliveriesService,
    private readonly warehouses: WarehousesService,
    private readonly salesOrders: SalesOrdersService,
    private readonly shipments: ShipmentsService,
  ) {}

  onModuleInit(): void {
    this.salesOrders.resellerShipment = (orderId) => this.orderView(orderId);
    this.shipments.otherShipments = (carrier, trackingCode, report) => this.webhook(carrier, trackingCode, report);
  }

  // Danh sách đơn người bán cần giao (MAN_HINH_238): đơn đã xác nhận trở đi, xuất từ kho người dùng giao hàng được.
  async list(actor: Actor, query: z.output<typeof resellerShipmentListQuerySchema>): Promise<ResellerShipmentListResponse> {
    const allowed = await this.allowedWarehouses(actor);
    const conditions: SQL[] = [
      sql`o.company_id = ${actor.companyId}`,
      sql`o.is_reseller_dropship`,
      sql`o.status IN ('confirmed', 'delivered', 'closed')`,
      sql`o.warehouse_id = ANY(${pgArray(allowed)}::uuid[])`,
    ];
    if (query.status === "none") conditions.push(sql`NOT EXISTS (SELECT 1 FROM sales.order_shipments s WHERE s.order_id = o.id AND s.is_active)`);
    else if (query.status) conditions.push(sql`EXISTS (SELECT 1 FROM sales.order_shipments s WHERE s.order_id = o.id AND s.is_active AND s.shipping_status = ${query.status})`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(o.document_no ILIKE ${pattern} OR o.partner_order_code ILIKE ${pattern} OR o.recipient_name ILIKE ${pattern} OR r.name ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM sales.order_shipments s WHERE s.order_id = o.id AND s.tracking_code ILIKE ${pattern}))`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${this.from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<OrderRow>(
      sql`${this.select()} ${this.from()} WHERE ${where} ORDER BY o.order_date DESC, o.document_no DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    const shipments = await this.activeShipments(rows.rows.map((row) => row.id));
    return {
      data: rows.rows.map((row) => this.toOrder(row, shipments.get(row.id) ?? null)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      carriers: await this.enabledCarriers(),
    };
  }

  // Khối vận đơn trong chi tiết đơn bán; null với đơn không phải đơn người bán.
  async orderView(orderId: string): Promise<ResellerShipmentOrder | null> {
    const row = (await this.database.execute<OrderRow>(sql`${this.select()} ${this.from()} WHERE o.id = ${orderId} AND o.is_reseller_dropship`)).rows[0];
    if (!row) return null;
    return this.toOrder(row, (await this.activeShipments([orderId])).get(orderId) ?? null);
  }

  async detail(actor: Actor, orderId: string): Promise<ResellerShipmentOrder> {
    await this.operableOrder(actor, orderId);
    return (await this.orderView(orderId))!;
  }

  // API_310: nhập tay khi đơn vị vận chuyển chưa bật; lần đầu lập vận đơn và phiếu xuất nháp, các lần sau chỉ chuyển trạng thái tiến lên.
  async saveManual(actor: Actor, orderId: string, input: z.output<typeof resellerShipmentManualSchema>): Promise<ResellerShipmentOrder> {
    const order = await this.operableOrder(actor, orderId);
    await this.deliveries.ensureSequences(actor, order.company_id);
    await this.database.transaction(async (transaction) => {
      const locked = (await transaction.execute<{ status: string }>(sql`SELECT status FROM sales.orders WHERE id = ${orderId} FOR UPDATE`)).rows[0]!;
      let shipment = await this.activeShipment(transaction, orderId, true);
      if (shipment?.carrier_code) throw new ApiError("BUSINESS_RULE", "resellerShipmentCarrierManaged");
      if ((shipment?.version ?? 0) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!shipment) {
        if (locked.status !== "confirmed") throw new ApiError("BUSINESS_RULE", "resellerOrderNotShippable");
        if (input.status === "returned" || input.status === "cancelled") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { status: "invalidValue" } });
        const id = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO sales.order_shipments (company_id, order_id, carrier_name, tracking_code, shipping_status, fee, cod_amount, created_by)
          VALUES (${order.company_id}, ${orderId}, ${input.carrierName}, ${input.trackingCode}, 'awaiting_pickup', ${input.fee}::numeric, ${order.cod_amount}::numeric, ${actor.userId})
          RETURNING id`)
        ).rows[0]!.id;
        await this.createDraft(transaction, actor, orderId);
        shipment = (await this.activeShipment(transaction, orderId, true))!;
        await this.audit(transaction, actor, orderId, "reseller_shipment.create", { ...input, id });
      } else {
        const current = shipment.shipping_status;
        // Chỉ tiến lên: chờ lấy hàng → đang giao → đã giao; hoàn hàng sau đang giao; hủy khi chờ lấy hàng. Giữ trạng thái thì chỉ sửa mã vận đơn, phí.
        const forward =
          input.status === "cancelled"
            ? current === "awaiting_pickup"
            : input.status === "returned"
              ? current === "shipping"
              : (current === "awaiting_pickup" || current === "shipping") && rank[input.status] > rank[current];
        if (input.status !== current && !forward) throw new ApiError("BUSINESS_RULE", "resellerShipmentStatusInvalid");
        await transaction.execute(sql`
          UPDATE sales.order_shipments SET carrier_name = ${input.carrierName}, tracking_code = ${input.trackingCode}, fee = ${input.fee}::numeric, synced_at = now(), version = version + 1
          WHERE id = ${shipment.id}`);
        await this.audit(transaction, actor, orderId, "reseller_shipment.update", input);
      }
      // Nhập tay: lỗi ghi sổ phiếu xuất báo ngay cho người nhập.
      await this.advance(transaction, shipment, input.status, actor, false);
    });
    return (await this.orderView(orderId))!;
  }

  // API_311: tạo vận đơn với đơn vị vận chuyển đang bật (cách của đơn sàn, CONG_VIEC_24): giữ chỗ "requesting", phiếu xuất nháp, gọi đơn vị vận chuyển, ghi kết quả.
  async createWithCarrier(actor: Actor, orderId: string, carrierCode: CarrierCode, version: number): Promise<ResellerShipmentOrder> {
    const enabled = (await this.database.execute<{ is_enabled: boolean }>(sql`SELECT is_enabled FROM marketplace.carriers WHERE code = ${carrierCode}`)).rows[0]?.is_enabled;
    if (!enabled) throw new ApiError("BUSINESS_RULE", "carrierDisabled");
    const adapter = this.adapterOf(carrierCode);
    const order = await this.operableOrder(actor, orderId);
    if (version !== 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.deliveries.ensureSequences(actor, order.company_id);
    await this.database.transaction(async (transaction) => {
      const locked = (await transaction.execute<{ status: string }>(sql`SELECT status FROM sales.orders WHERE id = ${orderId} FOR UPDATE`)).rows[0]!;
      if (locked.status !== "confirmed") throw new ApiError("BUSINESS_RULE", "resellerOrderNotShippable");
      const active = await this.activeShipment(transaction, orderId, true);
      if (active)
        throw new ApiError(active.shipping_status === "requesting" ? "BUSINESS_RULE" : "CONFLICT_VERSION", active.shipping_status === "requesting" ? "shipmentRequesting" : "conflictVersion");
      await transaction.execute(sql`
        INSERT INTO sales.order_shipments (company_id, order_id, carrier_code, shipping_status, cod_amount, created_by)
        VALUES (${order.company_id}, ${orderId}, ${carrierCode}, 'requesting', ${order.cod_amount}::numeric, ${actor.userId})`);
      await this.createDraft(transaction, actor, orderId);
      await this.audit(transaction, actor, orderId, "reseller_shipment.create", { carrierCode });
    });
    const lines = await this.database.execute<{ quantity: string; name: string; sku: string; weight_kg: string | null }>(sql`
      SELECT l.base_quantity::text AS quantity, p.name, v.sku, p.weight_kg::text
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE l.order_id = ${orderId} AND p.kind = 'goods' ORDER BY l.line_no`);
    const store = (
      await this.database.execute<{ package_length_cm: number; package_width_cm: number; package_height_cm: number; minimum_weight_grams: number }>(sql`
      SELECT package_length_cm, package_width_cm, package_height_cm, minimum_weight_grams FROM marketplace.store_settings WHERE company_id = ${order.company_id}`)
    ).rows[0];
    const weight = lines.rows.reduce((sum, line) => sum + Number(line.weight_kg ?? 0) * 1000 * Number(line.quantity), 0);
    let created: CreatedShipment;
    try {
      created = await adapter.createShipment({
        clientOrderCode: order.document_no!,
        recipientName: order.recipient_name,
        recipientPhone: order.recipient_phone.replace(/^\+84/, "0"),
        streetAddress: order.recipient_street,
        wardName: order.ward_name ?? "",
        provinceName: order.province_name ?? "",
        codAmount: Math.round(Number(order.cod_amount)),
        weightGrams: Math.max(Math.round(weight), store?.minimum_weight_grams ?? defaultPackage.minimumWeightGrams),
        lengthCm: store?.package_length_cm ?? defaultPackage.lengthCm,
        widthCm: store?.package_width_cm ?? defaultPackage.widthCm,
        heightCm: store?.package_height_cm ?? defaultPackage.heightCm,
        // Không gửi giá bán của công ty cho đơn vị vận chuyển (giao danh nghĩa người bán).
        items: lines.rows.map((line) => ({
          name: line.name,
          code: line.sku,
          quantity: Math.round(Number(line.quantity)),
          price: 0,
          weightGrams: Math.max(Math.round(Number(line.weight_kg ?? 0) * 1000), 1),
        })),
      });
    } catch (error) {
      // Bị từ chối rõ ràng: bỏ giữ chỗ để tạo lại. Không trả lời: giữ chỗ, thủ kho tra lại trước khi tạo lại.
      if (error instanceof CarrierFailure && error.kind === "rejected") {
        await this.releaseRequest(orderId);
        throw this.failure(error, "carrierRejected");
      }
      this.logger.warn(`Không rõ kết quả tạo vận đơn đơn người bán ${order.document_no}: ${(error as Error).message}`);
      throw new ApiError("BUSINESS_RULE", "carrierOutcomeUnknown");
    }
    await this.confirmRequest(orderId, created);
    return (await this.orderView(orderId))!;
  }

  // Tra lại vận đơn: lần tạo chưa rõ kết quả thì tra theo số đơn; có thì ghi nhận, không có thì bỏ chỗ giữ.
  async refresh(actor: Actor, orderId: string): Promise<ResellerShipmentOrder> {
    const order = await this.operableOrder(actor, orderId);
    const shipment = await this.activeShipment(this.database, orderId, false);
    if (!shipment?.carrier_code) throw new ApiError("BUSINESS_RULE", "resellerShipmentNotCarrier");
    if (shipment.tracking_code === null) {
      const found = await this.adapterOf(shipment.carrier_code)
        .findShipment(order.document_no!)
        .catch((error: unknown) => {
          throw this.failure(error, "carrierRejected");
        });
      if (found) await this.confirmRequest(orderId, found);
      else await this.releaseRequest(orderId);
      return (await this.orderView(orderId))!;
    }
    const info = await this.info(shipment.carrier_code, shipment.tracking_code).catch((error: unknown) => {
      throw this.failure(error, "carrierRejected");
    });
    await this.apply(shipment, info);
    return (await this.orderView(orderId))!;
  }

  // Hủy vận đơn trước khi lấy hàng: hủy với đơn vị vận chuyển, xóa phiếu xuất nháp; đơn bán giữ nguyên để tạo vận đơn khác.
  async cancel(actor: Actor, orderId: string, version: number): Promise<ResellerShipmentOrder> {
    const order = await this.operableOrder(actor, orderId);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM sales.orders WHERE id = ${orderId} FOR UPDATE`);
      const shipment = await this.activeShipment(transaction, orderId, true);
      if (!shipment?.carrier_code) throw new ApiError("BUSINESS_RULE", "resellerShipmentNotCarrier");
      if (shipment.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (shipment.tracking_code === null) throw new ApiError("BUSINESS_RULE", "shipmentRequesting");
      if (shipment.shipping_status !== "awaiting_pickup") throw new ApiError("BUSINESS_RULE", "resellerShipmentStatusInvalid");
      await this.adapterOf(shipment.carrier_code)
        .cancelShipment(shipment.tracking_code, order.document_no!)
        .catch((error: unknown) => {
          throw this.failure(error, "carrierCancelRejected");
        });
      await transaction.execute(sql`UPDATE sales.order_shipments SET carrier_status = 'cancel', synced_at = now() WHERE id = ${shipment.id}`);
      await this.advance(transaction, shipment, "cancelled", actor, false);
      await this.audit(transaction, actor, orderId, "reseller_shipment.cancel", { trackingCode: shipment.tracking_code });
    });
    return (await this.orderView(orderId))!;
  }

  // Webhook của đơn vị vận chuyển (API_128) với mã vận đơn không thuộc đơn sàn; true khi là vận đơn đơn người bán.
  async webhook(carrier: CarrierCode, trackingCode: string | null, report: WebhookReport | undefined): Promise<boolean> {
    const find = async () =>
      trackingCode
        ? (
            await this.database.execute<ShipmentRow>(sql`
            ${this.shipmentSelect()} WHERE s.carrier_code = ${carrier} AND s.tracking_code = ${trackingCode}`)
          ).rows[0]
        : undefined;
    let shipment = await find();
    if (!shipment && report?.clientOrderCode) {
      const requesting = (
        await this.database.execute<{ order_id: string }>(sql`
        SELECT s.order_id FROM sales.order_shipments s JOIN sales.orders o ON o.id = s.order_id
        WHERE s.carrier_code = ${carrier} AND s.is_active AND s.shipping_status = 'requesting' AND o.document_no = ${report.clientOrderCode}`)
      ).rows[0];
      if (requesting) {
        await this.confirmRequest(requesting.order_id, { trackingCode: report.trackingCode, fee: report.fee, status: report.status });
        shipment = await find();
      }
    }
    if (!shipment) return false;
    // Đơn vị vận chuyển không có API tra vận đơn: trạng thái theo webhook đã xác thực; còn lại luôn tra lại.
    const adapter = this.adapterOf(carrier);
    const info = report ? { status: report.status, codCollectedAt: adapter.phaseOf(report.status) === "delivered" ? new Date() : null } : await this.info(carrier, shipment.tracking_code!);
    await this.apply(shipment, info);
    return true;
  }

  // MAN_HINH_239: phiếu giao A5 danh nghĩa người bán: không in tên công ty, giá bán, số đơn VComm (QUYTAC_NGHIEPVU_507).
  async deliveryNote(actor: Actor, orderId: string): Promise<{ fileName: string; content: Buffer }> {
    const { fileName, definition } = await this.deliveryNoteDefinition(actor, orderId);
    return { fileName, content: await renderPdf(definition) };
  }

  // Nội dung phiếu giao (tách riêng để kiểm thử kiểm văn bản có, không có).
  async deliveryNoteDefinition(actor: Actor, orderId: string): Promise<{ fileName: string; definition: Record<string, unknown> }> {
    const order = await this.operableOrder(actor, orderId);
    const shipment = (await this.activeShipments([orderId])).get(orderId) ?? null;
    const lines = await this.database.execute<{ product_name: string; sku: string; unit_code: string; quantity: string }>(sql`
      SELECT p.name AS product_name, v.sku, u.code AS unit_code, l.quantity::text
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      WHERE l.order_id = ${orderId} ORDER BY l.line_no`);
    const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} đ`;
    const code = order.partner_order_code ?? "";
    const definition = {
      pageSize: "A5",
      pageMargins: [28, 28, 28, 28],
      defaultStyle: { font: "Roboto", fontSize: 9 },
      content: [
        { text: "PHIẾU GIAO HÀNG", bold: true, fontSize: 14, alignment: "center" },
        { text: `Mã đơn: ${code}`, alignment: "center", margin: [0, 2, 0, 8] },
        {
          columns: [
            { width: "*", stack: [{ text: "Người gửi", bold: true }, order.reseller_name, order.reseller_phone ?? ""] },
            { width: "*", stack: [{ text: "Người nhận", bold: true }, order.recipient_name, order.recipient_phone, order.delivery_address ?? ""] },
          ],
          columnGap: 12,
        },
        shipment ? { text: `Vận chuyển: ${shipment.carrierName}${shipment.trackingCode ? ` · Mã vận đơn: ${shipment.trackingCode}` : ""}`, margin: [0, 8, 0, 0] } : { text: "" },
        {
          margin: [0, 8, 0, 0],
          table: {
            headerRows: 1,
            widths: [16, "*", 60, 34, 34],
            body: [
              [
                { text: "#", bold: true },
                { text: "Hàng hóa", bold: true },
                { text: "Mã", bold: true },
                { text: "ĐVT", bold: true },
                { text: "SL", bold: true, alignment: "right" },
              ],
              ...lines.rows.map((line, index) => [String(index + 1), line.product_name, line.sku, line.unit_code, { text: trimDecimal(line.quantity), alignment: "right" }]),
            ],
          },
          layout: "lightHorizontalLines",
        },
        { text: `Tiền thu hộ: ${money(order.cod_amount)}`, bold: true, fontSize: 12, margin: [0, 10, 0, 0] },
        { text: "Người nhận kiểm hàng trước khi ký nhận.", italics: true, margin: [0, 16, 0, 0] },
      ],
    };
    return { fileName: `phieu-giao-${code || orderId.slice(0, 8)}.pdf`, definition };
  }

  private async createDraft(transaction: Executor, actor: Actor, orderId: string): Promise<void> {
    // Dùng lại phiếu nháp còn sót (lần trước bị hủy giữa chừng).
    const existing = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE type = 'sales_issue' AND status = 'draft' AND source_id = ${orderId}`);
    if (existing.rows.length > 0) return;
    const lines = await transaction.execute<{ id: string; quantity: string }>(sql`
      SELECT l.id, l.quantity::text FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE l.order_id = ${orderId} AND p.kind = 'goods' ORDER BY l.line_no`);
    await this.deliveries.draftIssueAsSystem(transaction, actor, {
      orderId,
      documentDate: await vietnamToday(transaction),
      lines: lines.rows.map((line) => ({ orderLineId: line.id, quantity: line.quantity })),
    });
  }

  // Chuyển trạng thái giao và ghi chứng từ kho: lấy hàng ghi sổ phiếu nháp, hoàn hàng nhận trả toàn bộ, hủy xóa phiếu nháp.
  // fromCarrier: lỗi ghi sổ không chặn việc ghi trạng thái của đơn vị vận chuyển, giữ "Chờ lấy hàng" để tra lại.
  private async advance(transaction: Executor, shipment: ShipmentRow, target: ResellerShippingStatus, actor: Actor, fromCarrier: boolean): Promise<void> {
    let state = (await transaction.execute<{ shipping_status: ResellerShippingStatus }>(sql`SELECT shipping_status FROM sales.order_shipments WHERE id = ${shipment.id}`)).rows[0]!.shipping_status;
    const setState = async (next: ResellerShippingStatus, inactive = false) => {
      await transaction.execute(sql`
        UPDATE sales.order_shipments SET shipping_status = ${next}, is_active = ${!inactive}, synced_at = now(), version = version + 1,
          finished_at = CASE WHEN ${next} IN ('delivered', 'returned') THEN now() ELSE finished_at END
        WHERE id = ${shipment.id}`);
      state = next;
    };
    if (["shipping", "delivered", "returned"].includes(target) && (state === "awaiting_pickup" || state === "requesting")) {
      const post = async (executor: Executor) => {
        const draft = (
          await executor.execute<{ id: string }>(sql`
          SELECT id FROM inventory.documents WHERE type = 'sales_issue' AND status = 'draft' AND source_id = ${shipment.order_id} ORDER BY created_at LIMIT 1`)
        ).rows[0];
        if (!draft) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
        await this.deliveries.postDraftAsSystem(executor, draft.id, actor);
      };
      if (fromCarrier) {
        const posted = await transaction
          .transaction(async (savepoint) => {
            await post(savepoint);
            return true;
          })
          .catch((error: unknown) => {
            this.logger.warn(`Không ghi sổ được phiếu xuất của đơn người bán ${shipment.order_id}: ${(error as Error).message}`);
            return false;
          });
        if (!posted) return;
      } else await post(transaction);
      await setState("shipping");
    }
    if (target === "delivered" && state === "shipping") await setState("delivered");
    else if (target === "returned" && state === "shipping") {
      // Hàng hoàn về: nhận lại toàn bộ phần đã xuất; phiếu nhận trả ghi giảm công nợ người bán qua luồng hiện có (QUYTAC_NGHIEPVU_508).
      const issued = await transaction.execute<{ document_id: string; line_id: string; quantity: string }>(sql`
        SELECT d.id AS document_id, l.id AS line_id, abs(l.base_quantity)::text AS quantity FROM inventory.documents d JOIN inventory.document_lines l ON l.document_id = d.id
        WHERE d.type = 'sales_issue' AND d.status = 'posted' AND d.source_id = ${shipment.order_id} ORDER BY d.created_at, l.line_no`);
      const byDocument = new Map<string, { issueLineId: string; quantity: string }[]>();
      for (const row of issued.rows) byDocument.set(row.document_id, [...(byDocument.get(row.document_id) ?? []), { issueLineId: row.line_id, quantity: row.quantity }]);
      const today = await vietnamToday(transaction);
      for (const [issueId, lines] of byDocument) await this.deliveries.returnAsSystem(transaction, actor, { issueId, documentDate: today, reason: "Hàng hoàn về (dropship người bán)", lines });
      await setState("returned");
    } else if (target === "cancelled" && (state === "awaiting_pickup" || state === "requesting")) {
      await transaction.execute(sql`DELETE FROM inventory.documents WHERE type = 'sales_issue' AND status = 'draft' AND source_id = ${shipment.order_id}`);
      await setState("cancelled", true);
    }
  }

  private async confirmRequest(orderId: string, created: CreatedShipment): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM sales.orders WHERE id = ${orderId} FOR UPDATE`);
      await transaction.execute(sql`
        UPDATE sales.order_shipments SET tracking_code = ${created.trackingCode}, carrier_status = ${created.status}, fee = ${created.fee}::numeric, shipping_status = 'awaiting_pickup',
          synced_at = now(), version = version + 1
        WHERE order_id = ${orderId} AND is_active AND shipping_status = 'requesting'`);
    });
  }

  private async releaseRequest(orderId: string): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM sales.orders WHERE id = ${orderId} FOR UPDATE`);
      const deleted = await transaction.execute(sql`DELETE FROM sales.order_shipments WHERE order_id = ${orderId} AND is_active AND shipping_status = 'requesting' RETURNING id`);
      if (deleted.rows.length > 0) await transaction.execute(sql`DELETE FROM inventory.documents WHERE type = 'sales_issue' AND status = 'draft' AND source_id = ${orderId}`);
    });
  }

  // Áp trạng thái của đơn vị vận chuyển; nhận trùng không đổi kết quả.
  private async apply(shipment: ShipmentRow, info: ShipmentInfo): Promise<void> {
    const phase = this.adapterOf(shipment.carrier_code!).phaseOf(info.status);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM sales.orders WHERE id = ${shipment.order_id} FOR UPDATE`);
      const current = (await transaction.execute<ShipmentRow>(sql`${this.shipmentSelect()} WHERE s.id = ${shipment.id} FOR UPDATE OF s`)).rows[0]!;
      await transaction.execute(sql`UPDATE sales.order_shipments SET carrier_status = ${info.status}, synced_at = now() WHERE id = ${shipment.id}`);
      if (!current.is_active) return;
      // Hệ thống ghi chứng từ thay người đã tạo vận đơn.
      const system: Actor = { userId: current.created_by, companyId: current.company_id, client: systemClient };
      if (phase !== "attention") await this.advance(transaction, current, statusOfPhase[phase], system, true);
      // Đơn vị vận chuyển báo đã thu tiền thu hộ: ghi ngày thu một lần (đối soát ở lát L5).
      if (info.codCollectedAt) {
        await transaction.execute(sql`
          UPDATE sales.order_shipments SET cod_collected_at = ${info.codCollectedAt.toISOString()}::timestamptz WHERE id = ${shipment.id} AND cod_amount > 0 AND cod_collected_at IS NULL`);
      }
    });
  }

  private async info(code: CarrierCode, trackingCode: string): Promise<ShipmentInfo> {
    const adapter = this.adapterOf(code);
    return adapter.shipmentInfo ? adapter.shipmentInfo(trackingCode) : { status: await adapter.shipmentStatus(trackingCode), codCollectedAt: null };
  }

  private adapterOf(code: CarrierCode) {
    const adapter = carrierAdapter(code);
    if (!adapter) throw new ApiError("BUSINESS_RULE", "carrierNotConfigured");
    return adapter;
  }

  private failure(error: unknown, rejectedKey: "carrierRejected" | "carrierCancelRejected"): ApiError {
    if (error instanceof CarrierFailure) {
      this.logger.warn(`Đơn vị vận chuyển: ${error.message}`);
      if (error.kind === "unsupported") return new ApiError("BUSINESS_RULE", "carrierLookupUnsupported");
      return new ApiError("BUSINESS_RULE", error.kind === "rejected" ? rejectedKey : "carrierUnavailable");
    }
    return error instanceof ApiError ? error : new ApiError("BUSINESS_RULE", "carrierUnavailable");
  }

  private async enabledCarriers(): Promise<CarrierCode[]> {
    const rows = await this.database.execute<{ code: CarrierCode }>(sql`SELECT code FROM marketplace.carriers WHERE is_enabled ORDER BY code`);
    return rows.rows.map((row) => row.code).filter((code) => (carrierCodes as readonly string[]).includes(code) && carrierAdapter(code) !== null);
  }

  private async allowedWarehouses(actor: Actor): Promise<string[]> {
    const { operable } = await this.warehouses.stockScope(actor);
    const allowed: string[] = [];
    for (const warehouseId of operable) {
      if (await this.warehouses.operable(actor.userId, warehouseId, inventoryPermissions.issueSales).catch(() => null)) allowed.push(warehouseId);
    }
    return allowed;
  }

  // Đơn người bán của công ty, kho người dùng có quyền xuất giao hàng; kho có vị trí không dùng được (phiếu xuất hệ thống không chọn vị trí).
  private async operableOrder(actor: Actor, orderId: string): Promise<OrderRow> {
    const order = (await this.database.execute<OrderRow>(sql`${this.select()} ${this.from()} WHERE o.id = ${orderId} AND o.company_id = ${actor.companyId} AND o.is_reseller_dropship`)).rows[0];
    if (!order || !["confirmed", "delivered", "closed"].includes(order.status)) throw new ApiError("NOT_FOUND", "notFound");
    await this.warehouses.operable(actor.userId, order.warehouse_id, inventoryPermissions.issueSales);
    if (order.uses_locations) throw new ApiError("BUSINESS_RULE", "warehouseUsesLocations");
    return order;
  }

  private async activeShipment(executor: Pick<Database, "execute">, orderId: string, lock: boolean): Promise<ShipmentRow | null> {
    const rows = await executor.execute<ShipmentRow>(
      lock ? sql`${this.shipmentSelect()} WHERE s.order_id = ${orderId} AND s.is_active FOR UPDATE OF s` : sql`${this.shipmentSelect()} WHERE s.order_id = ${orderId} AND s.is_active`,
    );
    return rows.rows[0] ?? null;
  }

  private async activeShipments(orderIds: string[]): Promise<Map<string, ResellerShipmentOrder["shipment"]>> {
    const result = new Map<string, ResellerShipmentOrder["shipment"]>();
    if (orderIds.length === 0) return result;
    const rows = await this.database.execute<ShipmentRow>(sql`${this.shipmentSelect()} WHERE s.order_id = ANY(${pgArray(orderIds)}::uuid[]) AND s.is_active`);
    for (const row of rows.rows) {
      result.set(row.order_id, {
        id: row.id,
        carrierCode: row.carrier_code,
        carrierName: row.carrier_name ?? row.carrier_code!.toUpperCase(),
        trackingCode: row.tracking_code,
        carrierStatus: row.carrier_status,
        status: row.shipping_status,
        fee: row.fee === null ? null : trimDecimal(row.fee),
        codAmount: trimDecimal(row.cod_amount),
        codCollectedAt: row.cod_collected_at ? new Date(row.cod_collected_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
        syncedAt: new Date(row.synced_at).toISOString(),
        version: row.version,
      });
    }
    return result;
  }

  private toOrder(row: OrderRow, shipment: ResellerShipmentOrder["shipment"]): ResellerShipmentOrder {
    return {
      orderId: row.id,
      documentNo: row.document_no,
      partnerOrderCode: row.partner_order_code,
      orderDate: day(row.order_date),
      orderStatus: row.status,
      resellerName: row.reseller_name,
      resellerPhone: row.reseller_phone,
      recipientName: row.recipient_name,
      recipientPhone: row.recipient_phone,
      deliveryAddress: row.delivery_address ?? "",
      warehouseName: row.warehouse_name,
      codAmount: trimDecimal(row.cod_amount),
      currency: row.currency,
      lineCount: row.line_count,
      shipment,
    };
  }

  private async audit(transaction: Executor, actor: Actor, orderId: string, action: string, data: unknown): Promise<void> {
    await this.auditService.record(
      {
        actorUserId: actor.userId,
        companyId: actor.companyId,
        appCode: "inventory",
        entityType: "sales_order",
        entityId: orderId,
        action,
        afterData: data,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      transaction,
    );
  }

  private select(): SQL {
    return sql`SELECT o.id, o.company_id, o.document_no, o.partner_order_code, o.order_date, o.status, o.recipient_name, o.recipient_phone, o.recipient_street, o.delivery_address,
      wd.full_name AS ward_name, pv.full_name AS province_name, o.cod_amount::text, o.currency, o.warehouse_id, w.name AS warehouse_name, w.uses_locations,
      r.name AS reseller_name, r.phone AS reseller_phone, (SELECT count(*)::int FROM sales.order_lines l WHERE l.order_id = o.id) AS line_count`;
  }

  private from(): SQL {
    return sql`FROM sales.orders o JOIN crm.partners r ON r.id = o.customer_id LEFT JOIN inventory.warehouses w ON w.id = o.warehouse_id
      LEFT JOIN marketplace.wards wd ON wd.code = o.recipient_ward_code LEFT JOIN marketplace.provinces pv ON pv.code = wd.province_code`;
  }

  private shipmentSelect(): SQL {
    return sql`SELECT s.id, s.order_id, s.company_id, s.carrier_code, s.carrier_name, s.tracking_code, s.carrier_status, s.shipping_status, s.fee::text, s.cod_amount::text,
      s.cod_collected_at, s.is_active, s.created_by, s.created_at, s.synced_at, s.version FROM sales.order_shipments s`;
  }
}
