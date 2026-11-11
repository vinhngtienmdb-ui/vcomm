// Giao đơn VComm qua đơn vị vận chuyển, hủy vận đơn, nhận trạng thái qua webhook, tra lại (CONG_VIEC_24; CHUC_NANG_117; QUYTAC_NGHIEPVU_159, 160; API_127, API_128).
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { carrierCodes, type CarrierCode, type MarketplaceOrderDetail, type MarketplaceOrderStatus } from "contracts";
import { sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "../common/api-error";
import { RateLimiter } from "../common/rate-limiter";
import { DATABASE, type Database } from "../database/database.module";
import { SalesDeliveriesService } from "../inventory/sales-deliveries.service";
import type { Actor } from "../permissions/roles.service";
import { SalesOrdersService } from "../sales/sales-orders.service";
import type { BuyerAdminActor } from "./buyer-admin.service";
import { CarrierFailure, type CreatedShipment, type ShipmentInfo } from "./carriers/carrier";
import { carrierAdapter, webhookKeyOf } from "./carriers/carrier-registry";
import { MarketplaceOrdersService, refundRemainingPaid } from "./marketplace-orders.service";
import { vietnamToday } from "./shop.service";
import { loadStoreContext } from "./store.service";

type Executor = Pick<Database, "execute" | "insert">;
const systemClient = { ip: null, userAgent: "carrier-webhook", requestId: null };
const postingProblem = "Chưa ghi sổ được phiếu xuất (kiểm tra tồn kho, phiếu nháp) rồi bấm Tra lại vận đơn";

type ShipmentRow = { id: string; order_id: string; carrier_code: CarrierCode; tracking_code: string | null; carrier_status: string; is_active: boolean; created_by: string };

@Injectable()
export class ShipmentsService implements OnModuleInit {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly orders: MarketplaceOrdersService,
    private readonly salesOrders: SalesOrdersService,
    private readonly deliveries: SalesDeliveriesService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  onModuleInit(): void {
    this.orders.shipmentCanceller = this;
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

  // Giao cho đơn vị vận chuyển: lập phiếu xuất nháp toàn đơn (giữ hàng vẫn còn), tạo vận đơn; đơn chuyển "Chờ lấy hàng".
  async ship(actor: BuyerAdminActor, orderId: string, carrierCode: string, version: number): Promise<MarketplaceOrderDetail> {
    if (!(carrierCodes as readonly string[]).includes(carrierCode)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { carrierCode: "invalidValue" } });
    const code = carrierCode as CarrierCode;
    const enabled = (await this.database.execute<{ is_enabled: boolean }>(sql`SELECT is_enabled FROM marketplace.carriers WHERE code = ${code}`)).rows[0]?.is_enabled;
    if (!enabled) throw new ApiError("BUSINESS_RULE", "carrierDisabled");
    const adapter = this.adapterOf(code);
    const context = await loadStoreContext(this.database);
    if (!context) throw new ApiError("BUSINESS_RULE", "storeNotReady");
    const order = (
      await this.database.execute<{
        sales_order_id: string;
        company_id: string;
        status: MarketplaceOrderStatus;
        version: number;
        document_no: string;
        recipient_name: string;
        recipient_phone: string;
        street_address: string;
        ward_name: string;
        province_name: string;
        cod_amount: string;
        warehouse_uses_locations: boolean;
      }>(sql`
      SELECT m.sales_order_id, m.company_id, m.status, m.version, so.document_no, m.recipient_name, m.recipient_phone, m.street_address, m.ward_name, m.province_name, m.cod_amount::text,
        w.uses_locations AS warehouse_uses_locations
      FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN inventory.warehouses w ON w.id = so.warehouse_id WHERE m.id = ${orderId}`)
    ).rows[0];
    if (!order || order.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
    if (order.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (order.status !== "awaiting_shipment") throw new ApiError("BUSINESS_RULE", "orderNotShippable");
    if (order.warehouse_uses_locations) throw new ApiError("BUSINESS_RULE", "warehouseUsesLocations");
    const staff: Actor = { userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client };
    const lines = await this.database.execute<{ id: string; quantity: string; base_quantity: string; name: string; sku: string; total_amount: string; weight_kg: string | null }>(sql`
      SELECT l.id, l.quantity::text, l.base_quantity::text, p.name, v.sku, l.total_amount::text, p.weight_kg::text
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id WHERE l.order_id = ${order.sales_order_id} ORDER BY l.line_no`);
    await this.deliveries.ensureSequences(staff, actor.operatorCompanyId);
    // Bước 1: giữ chỗ vận đơn "requesting" trước khi gọi đơn vị vận chuyển; chỉ mục vận đơn hoạt động duy nhất chặn hai người giao cùng lúc.
    await this.database.transaction(async (transaction) => {
      const locked = (await transaction.execute<{ status: string; version: number }>(sql`SELECT status, version FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`)).rows[0]!;
      if (locked.version !== version || locked.status !== "awaiting_shipment") throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const active = await transaction.execute(sql`SELECT 1 FROM marketplace.shipments WHERE order_id = ${orderId} AND is_active`);
      if (active.rows.length > 0) throw new ApiError("BUSINESS_RULE", "shipmentRequesting");
      await transaction.execute(sql`
        INSERT INTO marketplace.shipments (order_id, carrier_code, tracking_code, carrier_status, created_by) VALUES (${orderId}, ${code}, NULL, 'requesting', ${actor.userId})`);
    });
    // Bước 2: phiếu xuất nháp toàn đơn (dùng lại phiếu nháp còn sót nếu có).
    try {
      const existing = await this.database.execute(sql`SELECT 1 FROM inventory.documents WHERE type = 'sales_issue' AND status = 'draft' AND source_id = ${order.sales_order_id}`);
      if (existing.rows.length === 0) {
        await this.deliveries.createIssue(
          staff,
          {
            orderId: order.sales_order_id,
            documentDate: await vietnamToday(this.database),
            note: null,
            lines: lines.rows.map((line) => ({ orderLineId: line.id, quantity: line.quantity, serials: [] })),
          },
          true,
        );
      }
    } catch (error) {
      await this.releaseRequest(orderId);
      throw error;
    }
    // Bước 3: gọi đơn vị vận chuyển ngoài giao dịch; kết quả ghi ở bước sau.
    const weight = lines.rows.reduce((sum, line) => sum + Number(line.weight_kg ?? 0) * 1000 * Number(line.base_quantity), 0);
    let created: CreatedShipment;
    try {
      created = await adapter.createShipment({
        clientOrderCode: order.document_no,
        recipientName: order.recipient_name,
        recipientPhone: order.recipient_phone.replace(/^\+84/, "0"),
        streetAddress: order.street_address,
        wardName: order.ward_name,
        provinceName: order.province_name,
        codAmount: Math.round(Number(order.cod_amount)),
        weightGrams: Math.max(Math.round(weight), context.minimumWeightGrams),
        lengthCm: context.packageLengthCm,
        widthCm: context.packageWidthCm,
        heightCm: context.packageHeightCm,
        items: lines.rows.map((line) => ({
          name: line.name,
          code: line.sku,
          quantity: Math.round(Number(line.base_quantity)),
          price: Math.round(Number(line.total_amount) / Number(line.base_quantity)),
          weightGrams: Math.max(Math.round(Number(line.weight_kg ?? 0) * 1000), 1),
        })),
      });
    } catch (error) {
      // Bị từ chối rõ ràng: bỏ giữ chỗ để giao lại. Không trả lời hoặc hết thời gian chờ: giữ chỗ, nhân viên tra lại vận đơn trước khi giao lại.
      if (error instanceof CarrierFailure && error.kind === "rejected") {
        await this.releaseRequest(orderId);
        throw this.failure(error, "carrierRejected");
      }
      this.logger.warn(`Không rõ kết quả tạo vận đơn ${order.document_no}: ${(error as Error).message}`);
      throw new ApiError("BUSINESS_RULE", "carrierOutcomeUnknown");
    }
    await this.confirmRequest(orderId, created, actor.userId);
    return this.orders.adminDetail(actor, orderId, true);
  }

  // Ghi kết quả tạo vận đơn vào chỗ đã giữ: đơn chuyển "Chờ lấy hàng".
  private async confirmRequest(orderId: string, created: CreatedShipment, actorUserId: string | null): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`);
      const updated = await transaction.execute(sql`
        UPDATE marketplace.shipments SET tracking_code = ${created.trackingCode}, carrier_status = ${created.status}, fee = ${created.fee}::numeric, synced_at = now()
        WHERE order_id = ${orderId} AND is_active AND carrier_status = 'requesting' RETURNING id`);
      if (updated.rows.length === 0) return;
      await transaction.execute(sql`UPDATE marketplace.orders SET status = 'awaiting_pickup', version = version + 1 WHERE id = ${orderId} AND status = 'awaiting_shipment'`);
      await this.orders.event(transaction, orderId, "awaiting_pickup", created.trackingCode, actorUserId);
    });
  }

  // Bỏ chỗ giữ khi chắc chắn đơn vị vận chuyển không tạo vận đơn: xóa vận đơn chờ, phiếu xuất nháp.
  private async releaseRequest(orderId: string): Promise<void> {
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`);
      await transaction.execute(sql`DELETE FROM marketplace.shipments WHERE order_id = ${orderId} AND is_active AND carrier_status = 'requesting'`);
      await this.removeDraftIssues(transaction, orderId);
    });
  }

  // Hủy vận đơn đang hoạt động khi hủy đơn chờ lấy hàng; xóa phiếu xuất nháp (QUYTAC_NGHIEPVU_159).
  async cancelActive(transaction: Executor, orderId: string): Promise<void> {
    const shipment = (await transaction.execute<ShipmentRow>(sql`SELECT id, carrier_code, tracking_code FROM marketplace.shipments WHERE order_id = ${orderId} AND is_active FOR UPDATE`)).rows[0];
    // Chưa rõ kết quả tạo vận đơn: phải tra lại trước khi hủy.
    if (shipment && shipment.tracking_code === null) throw new ApiError("BUSINESS_RULE", "shipmentRequesting");
    if (shipment) {
      await this.adapterOf(shipment.carrier_code)
        .cancelShipment(shipment.tracking_code!)
        .catch((error: unknown) => {
          throw this.failure(error, "carrierCancelRejected");
        });
      await transaction.execute(sql`UPDATE marketplace.shipments SET is_active = false, carrier_status = 'cancel', synced_at = now() WHERE id = ${shipment.id}`);
    }
    await this.removeDraftIssues(transaction, orderId);
  }

  private async removeDraftIssues(transaction: Executor, orderId: string): Promise<void> {
    await transaction.execute(sql`
      DELETE FROM inventory.documents WHERE type = 'sales_issue' AND status = 'draft' AND source_id = (SELECT sales_order_id FROM marketplace.orders WHERE id = ${orderId})`);
  }

  // Tra lại trạng thái vận đơn đang hoạt động (nhân viên bấm "Tra lại vận đơn").
  async refresh(actor: BuyerAdminActor, orderId: string): Promise<MarketplaceOrderDetail> {
    const shipment = (
      await this.database.execute<ShipmentRow & { company_id: string }>(sql`
      SELECT s.id, s.order_id, s.carrier_code, s.tracking_code, s.carrier_status, s.is_active, s.created_by, m.company_id
      FROM marketplace.shipments s JOIN marketplace.orders m ON m.id = s.order_id WHERE s.order_id = ${orderId} ORDER BY s.is_active DESC, s.created_at DESC LIMIT 1`)
    ).rows[0];
    if (!shipment || shipment.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
    if (shipment.tracking_code === null) {
      // Lần giao trước chưa rõ kết quả: tra theo số đơn; có thì ghi nhận, không có thì bỏ chỗ giữ để giao lại.
      const documentNo = (
        await this.database.execute<{ document_no: string }>(sql`SELECT so.document_no FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = ${orderId}`)
      ).rows[0]!.document_no;
      const found = await this.adapterOf(shipment.carrier_code)
        .findShipment(documentNo)
        .catch((error: unknown) => {
          throw this.failure(error, "carrierRejected");
        });
      if (found) await this.confirmRequest(orderId, found, actor.userId);
      else await this.releaseRequest(orderId);
      return this.orders.adminDetail(actor, orderId, true);
    }
    const info = await this.info(shipment.carrier_code, shipment.tracking_code).catch((error: unknown) => {
      throw this.failure(error, "carrierRejected");
    });
    await this.apply(shipment, info);
    return this.orders.adminDetail(actor, orderId, true);
  }

  // Webhook (API_128): chỉ nhận khi đúng khóa trên đường dẫn; trạng thái lấy theo kết quả tra lại vận đơn, không theo nội dung gửi tới,
  // trừ đơn vị vận chuyển không có API tra vận đơn (CONG_VIEC_29).
  // Không giới hạn yêu cầu đúng khóa; chỉ đếm lần sai khóa theo địa chỉ IP (như webhook ngân hàng của CONG_VIEC_18).
  async webhook(code: string, key: string, payload: unknown, ip: string): Promise<{ result: string }> {
    if (!(carrierCodes as readonly string[]).includes(code)) throw new ApiError("NOT_FOUND", "notFound");
    const carrier = code as CarrierCode;
    const expected = webhookKeyOf(carrier);
    const given = Buffer.from(key);
    const unauthorized = async () => {
      const retryAfterSeconds = await this.rateLimiter.hit("carrier-webhook-unauthorized", ip);
      if (retryAfterSeconds !== null) throw new ApiError("RATE_LIMITED", "rateLimited", { retryAfterSeconds });
      throw new ApiError("FORBIDDEN", "forbidden");
    };
    if (!expected || given.length !== Buffer.byteLength(expected) || !timingSafeEqual(given, Buffer.from(expected))) return unauthorized();
    const adapter = this.adapterOf(carrier);
    // Đơn vị vận chuyển không có API tra vận đơn: lớp kết nối xác thực thêm khóa trong nội dung rồi mới đọc trạng thái (QUYTAC_NGHIEPVU_185).
    const report = adapter.webhookReport ? adapter.webhookReport(payload) : undefined;
    if (report === null) return unauthorized();
    const trackingCode = adapter.trackingCodeOf(payload);
    const record = (result: string) =>
      this.database.execute(sql`
        INSERT INTO marketplace.carrier_webhook_events (carrier_code, tracking_code, payload, result) VALUES (${carrier}, ${trackingCode}, ${JSON.stringify((report ? report.storedPayload : payload) ?? null)}::jsonb, ${result})`);
    const findShipment = async () =>
      trackingCode
        ? (
            await this.database.execute<ShipmentRow>(sql`
          SELECT id, order_id, carrier_code, tracking_code, carrier_status, is_active, created_by FROM marketplace.shipments WHERE carrier_code = ${carrier} AND tracking_code = ${trackingCode}`)
          ).rows[0]
        : undefined;
    let shipment = await findShipment();
    if (!shipment && report?.clientOrderCode) {
      // Lần giao trước không rõ kết quả: webhook mang số đơn VComm của vận đơn đang chờ xác nhận thì ghi nhận vận đơn (QUYTAC_NGHIEPVU_188).
      const requesting = (
        await this.database.execute<{ order_id: string }>(sql`
        SELECT s.order_id FROM marketplace.shipments s JOIN marketplace.orders m ON m.id = s.order_id JOIN sales.orders so ON so.id = m.sales_order_id
        WHERE s.carrier_code = ${carrier} AND s.is_active AND s.carrier_status = 'requesting' AND so.document_no = ${report.clientOrderCode}`)
      ).rows[0];
      if (requesting) {
        await this.confirmRequest(requesting.order_id, { trackingCode: report.trackingCode, fee: report.fee, status: report.status }, null);
        shipment = await findShipment();
      }
    }
    if (!shipment) {
      await record("unknown_shipment");
      return { result: "ignored" };
    }
    try {
      // Đơn vị vận chuyển không có API tra vận đơn (Viettel Post): trạng thái theo webhook đã xác thực, chưa có ngày thu tiền thu hộ.
      await this.apply(shipment, report ? { status: report.status, codCollectedAt: null } : await this.info(carrier, shipment.tracking_code!));
      await record("applied");
      return { result: "applied" };
    } catch (error) {
      await record(`failed: ${(error as Error).message}`.slice(0, 500));
      throw error instanceof ApiError ? error : this.failure(error, "carrierRejected");
    }
  }

  private async info(code: CarrierCode, trackingCode: string): Promise<ShipmentInfo> {
    const adapter = this.adapterOf(code);
    return adapter.shipmentInfo ? adapter.shipmentInfo(trackingCode) : { status: await adapter.shipmentStatus(trackingCode), codCollectedAt: null };
  }

  // Áp trạng thái của đơn vị vận chuyển vào đơn VComm; chỉ chuyển khi trạng thái đơn còn phù hợp nên nhận trùng không đổi kết quả.
  private async apply(shipment: ShipmentRow, info: ShipmentInfo): Promise<void> {
    const status = info.status;
    const adapter = this.adapterOf(shipment.carrier_code);
    const phase = adapter.phaseOf(status);
    await this.database.transaction(async (transaction) => {
      const order = (
        await transaction.execute<{ status: MarketplaceOrderStatus; sales_order_id: string; company_id: string }>(sql`
        SELECT status, sales_order_id, company_id FROM marketplace.orders WHERE id = ${shipment.order_id} FOR UPDATE`)
      ).rows[0]!;
      const current = (await transaction.execute<{ carrier_status: string; is_active: boolean }>(sql`SELECT carrier_status, is_active FROM marketplace.shipments WHERE id = ${shipment.id} FOR UPDATE`))
        .rows[0]!;
      await transaction.execute(sql`UPDATE marketplace.shipments SET carrier_status = ${status}, synced_at = now() WHERE id = ${shipment.id}`);
      if (!current.is_active) return;
      // Hệ thống ghi chứng từ thay người đã giao đơn cho đơn vị vận chuyển.
      const system: Actor = { userId: shipment.created_by, companyId: order.company_id, client: systemClient };
      const note = `${shipment.carrier_code.toUpperCase()}: ${status}`;
      let state = order.status;
      if ((phase === "picked" || phase === "delivered" || phase === "returned") && state === "awaiting_pickup") {
        const draft = (
          await transaction.execute<{ id: string }>(sql`
          SELECT id FROM inventory.documents WHERE type = 'sales_issue' AND status = 'draft' AND source_id = ${order.sales_order_id} ORDER BY created_at LIMIT 1`)
        ).rows[0];
        // Ghi sổ trong điểm lưu: lỗi (thiếu tồn, phiếu nháp không còn) thì giữ "Chờ lấy hàng", ghi lịch sử cho nhân viên xử lý rồi tra lại vận đơn.
        const posted = await transaction
          .transaction(async (savepoint) => {
            if (!draft) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
            await this.deliveries.postDraftAsSystem(savepoint, draft.id, system);
            return true;
          })
          .catch(async (error: unknown) => {
            this.logger.warn(`Không ghi sổ được phiếu xuất của đơn ${shipment.order_id}: ${(error as Error).message}`);
            await this.orders.event(transaction, shipment.order_id, "awaiting_pickup", `${note} · ${postingProblem}`, null);
            return false;
          });
        if (!posted) return;
        await transaction.execute(sql`UPDATE marketplace.orders SET status = 'shipping', version = version + 1 WHERE id = ${shipment.order_id}`);
        await this.orders.event(transaction, shipment.order_id, "shipping", note, null);
        state = "shipping";
      }
      if (phase === "delivered" && state === "shipping") {
        await transaction.execute(sql`UPDATE marketplace.orders SET status = 'delivered', delivered_at = now(), version = version + 1 WHERE id = ${shipment.order_id}`);
        await this.orders.event(transaction, shipment.order_id, "delivered", note, null);
      } else if (phase === "returned" && state === "shipping") {
        // Hàng hoàn về: nhận lại toàn bộ phần đã xuất, đơn hủy (QUYTAC_NGHIEPVU_159).
        const issued = await transaction.execute<{ document_id: string; line_id: string; quantity: string }>(sql`
          SELECT d.id AS document_id, l.id AS line_id, abs(l.base_quantity)::text AS quantity FROM inventory.documents d JOIN inventory.document_lines l ON l.document_id = d.id
          WHERE d.type = 'sales_issue' AND d.status = 'posted' AND d.source_id = ${order.sales_order_id} ORDER BY d.created_at, l.line_no`);
        const byDocument = new Map<string, { issueLineId: string; quantity: string }[]>();
        for (const row of issued.rows) byDocument.set(row.document_id, [...(byDocument.get(row.document_id) ?? []), { issueLineId: row.line_id, quantity: row.quantity }]);
        const today = await vietnamToday(transaction);
        for (const [issueId, lines] of byDocument) await this.deliveries.returnAsSystem(transaction, system, { issueId, documentDate: today, reason: `Hàng hoàn về (${note})`, lines });
        // Chưa có phiếu xuất ghi sổ: không có hàng để nhận lại, nhả hàng giữ, hủy đơn bán.
        if (byDocument.size === 0) {
          await this.removeDraftIssues(transaction, shipment.order_id);
          await this.salesOrders.cancelMarketplaceWithin(transaction, system, order.sales_order_id);
        }
        const reason = "Giao không thành công, hàng đã hoàn về kho";
        await transaction.execute(sql`
          UPDATE marketplace.orders SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by_kind = 'carrier', version = version + 1 WHERE id = ${shipment.order_id}`);
        await transaction.execute(sql`UPDATE marketplace.shipments SET is_active = false WHERE id = ${shipment.id}`);
        await this.orders.event(transaction, shipment.order_id, "cancelled", reason, null);
        // Đơn đã thu tiền trực tuyến: lập việc chờ hoàn (CONG_VIEC_25; QUYTAC_NGHIEPVU_168).
        await refundRemainingPaid(transaction, shipment.order_id, "order_cancelled");
      } else if (phase === "cancelled" && state === "awaiting_pickup") {
        // Đơn vị vận chuyển hủy vận đơn trước khi lấy hàng: hủy đơn, nhả hàng giữ.
        await this.removeDraftIssues(transaction, shipment.order_id);
        await this.salesOrders.cancelMarketplaceWithin(transaction, system, order.sales_order_id);
        const reason = "Đơn vị vận chuyển hủy vận đơn";
        await transaction.execute(sql`
          UPDATE marketplace.orders SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by_kind = 'carrier', version = version + 1 WHERE id = ${shipment.order_id}`);
        await transaction.execute(sql`UPDATE marketplace.shipments SET is_active = false WHERE id = ${shipment.id}`);
        await this.orders.event(transaction, shipment.order_id, "cancelled", reason, null);
        // Đơn đã thu tiền trực tuyến: lập việc chờ hoàn (CONG_VIEC_25; QUYTAC_NGHIEPVU_168).
        await refundRemainingPaid(transaction, shipment.order_id, "order_cancelled");
      } else if (phase === "attention" && current.carrier_status !== status) {
        // Bất thường, mất hàng: hiện cho nhân viên, đơn giữ trạng thái.
        await this.orders.event(transaction, shipment.order_id, state, note, null);
      }
      // Đối soát COD (QUYTAC_NGHIEPVU_167): đơn vị vận chuyển báo đã thu tiền của người mua thì ghi đã thu một lần bằng tiền thu hộ của đơn.
      if (info.codCollectedAt) {
        const collected = await transaction.execute(sql`
          UPDATE marketplace.orders SET paid_amount = cod_amount, paid_at = ${info.codCollectedAt.toISOString()}::timestamptz, version = version + 1
          WHERE id = ${shipment.order_id} AND payment_method = 'cod' AND cod_amount > 0 AND paid_amount = 0 RETURNING id`);
        if (collected.rows.length > 0) await this.orders.event(transaction, shipment.order_id, "paid", `${shipment.carrier_code.toUpperCase()}: COD`, null);
      }
    });
  }
}
