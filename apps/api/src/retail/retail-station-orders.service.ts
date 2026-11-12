// Đơn trực tuyến tại trạm giao hàng O2O: danh sách, sẵn sàng nhận, mã nhận hàng, giao tại trạm, thu tiền trong ca, hủy
// (CONG_VIEC_57; CHUC_NANG_202; QUYTAC_NGHIEPVU_424, 425, 426, 431; API_223, API_224).
import { randomInt } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  DeliveryFailureReason,
  MarketplaceOrderStatus,
  MyDeliveriesResponse,
  PaymentMethodCode,
  stationHandoverSchema,
  StationOrderDetail,
  StationOrderListItem,
  stationOrderListQuerySchema,
  StationOrderListResponse,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { SalesDeliveriesService } from "../inventory/sales-deliveries.service";
import { notify } from "../common/notifications";
import { MarketplaceOrdersService } from "../marketplace/marketplace-orders.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency } from "../purchasing/requisitions.service";
import { retailAudit, retailPermissions, retailPermissionsAt, retailScope, scopeCondition } from "./retail-context";
import { RetailShiftsService } from "./retail-shifts.service";

type ListQuery = z.output<typeof stationOrderListQuerySchema>;
type HandoverInput = z.output<typeof stationHandoverSchema>;

type Row = {
  id: string;
  sales_order_id: string;
  document_no: string;
  created_at: Date;
  store_id: string;
  store_name: string;
  branch_id: string;
  cash_fund_id: string;
  bank_fund_id: string | null;
  buyer_name: string;
  buyer_phone: string | null;
  recipient_name: string;
  recipient_phone: string;
  street_address: string;
  ward_name: string;
  province_name: string;
  fulfillment_mode: "station_pickup" | "station_delivery";
  status: MarketplaceOrderStatus;
  goods_amount: string;
  shipping_fee: string;
  cod_amount: string;
  paid_amount: string;
  payment_method: PaymentMethodCode;
  version: number;
  hold_until: Date | null;
  ready_at: Date | null;
  code_locked_until: Date | null;
  delivery_attempts: number | null;
  courier_name: string | null;
  courier_user_id: string | null;
  expiring_soon: boolean;
};

const rowSelect = sql`
  SELECT m.id, m.sales_order_id, so.document_no, m.created_at, s.id AS store_id, s.display_name AS store_name, s.branch_id, s.cash_fund_id, s.bank_fund_id,
    u.full_name AS buyer_name, u.phone AS buyer_phone, m.recipient_name, m.recipient_phone, m.street_address, m.ward_name, m.province_name, m.fulfillment_mode, m.status,
    m.goods_amount::text, m.shipping_fee::text, m.cod_amount::text, m.paid_amount::text, m.payment_method, m.version,
    st.hold_until, st.ready_at, st.code_locked_until, st.delivery_attempts, cu.full_name AS courier_name, st.courier_user_id,
    (m.status = 'ready_for_pickup' AND st.hold_until < now() + interval '24 hours') AS expiring_soon
  FROM marketplace.orders m
  JOIN sales.orders so ON so.id = m.sales_order_id
  JOIN core.users u ON u.id = m.buyer_user_id
  JOIN retail.stores s ON s.id = m.station_id
  LEFT JOIN retail.station_orders st ON st.order_id = m.id
  LEFT JOIN core.users cu ON cu.id = st.courier_user_id`;

// Trạng thái đơn trạm thấy được: đã giữ hàng, đã thanh toán trực tuyến nếu trả trước (QUYTAC_NGHIEPVU_424).
const openStatuses = ["awaiting_shipment", "ready_for_pickup", "shipping"];
const maximumWrongCodes = 5;
const codeLockMinutes = 15;
const maximumDeliveryAttempts = 3;
const systemClient = { ip: null, userAgent: "system:station-hold", requestId: null };
type StationNotificationKind = "station_order.ready" | "station_order.reminder" | "station_order.shipping" | "station_order.cancelled";
const localPhone = (phone: string | null) => (phone ? phone.replace(/^\+84/, "0") : "");

@Injectable()
export class RetailStationOrdersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly orders: MarketplaceOrdersService,
    private readonly deliveries: SalesDeliveriesService,
    private readonly shifts: RetailShiftsService,
  ) {}

  // Phạm vi chi nhánh: người xử lý đơn trực tuyến hoặc nhân viên giao (QUYTAC_NGHIEPVU_431).
  private async visibility(actor: Actor): Promise<SQL> {
    const handle = await retailScope(this.permissionService, actor, retailPermissions.o2o);
    const deliver = await retailScope(this.permissionService, actor, retailPermissions.o2oDeliver);
    if (!handle && !deliver) throw new ApiError("FORBIDDEN", "forbidden");
    return sql`(${scopeCondition(handle, sql`s.branch_id`)} OR ${scopeCondition(deliver, sql`s.branch_id`)})`;
  }

  private dueAmount(row: Pick<Row, "payment_method" | "cod_amount" | "paid_amount">): number {
    return row.payment_method === "pay_at_station" ? Math.max(Number(row.cod_amount) - Number(row.paid_amount), 0) : 0;
  }

  private item(row: Row): StationOrderListItem {
    return {
      id: row.id,
      documentNo: row.document_no,
      createdAt: new Date(row.created_at).toISOString(),
      store: { id: row.store_id, name: row.store_name },
      buyerName: row.buyer_name,
      buyerPhone: localPhone(row.buyer_phone),
      fulfillmentMode: row.fulfillment_mode,
      status: row.status,
      total: trimDecimal((Number(row.goods_amount) + Number(row.shipping_fee)).toFixed(4)),
      dueAmount: trimDecimal(this.dueAmount(row).toFixed(4)),
      holdUntil: row.hold_until && ["ready_for_pickup", "shipping"].includes(row.status) ? new Date(row.hold_until).toISOString() : null,
      expiringSoon: row.expiring_soon,
      deliveryAttempts: row.delivery_attempts ?? 0,
      courierName: row.courier_name,
    };
  }

  async list(actor: Actor, query: ListQuery): Promise<StationOrderListResponse> {
    const conditions: SQL[] = [sql`m.company_id = ${actor.companyId}`, sql`m.station_id IS NOT NULL`, await this.visibility(actor)];
    if (query.status === "open")
      conditions.push(
        sql`m.status IN (${sql.join(
          openStatuses.map((status) => sql`${status}`),
          sql`, `,
        )})`,
      );
    else conditions.push(sql`m.status = ${query.status}`);
    if (query.storeId) conditions.push(sql`m.station_id = ${query.storeId}`);
    if (query.mode) conditions.push(sql`m.fulfillment_mode = ${query.mode}`);
    if (query.payment === "on_receipt") conditions.push(sql`m.payment_method = 'pay_at_station'`);
    if (query.payment === "prepaid") conditions.push(sql`m.payment_method <> 'pay_at_station'`);
    if (query.expiringSoon) conditions.push(sql`m.status = 'ready_for_pickup' AND st.hold_until < now() + interval '24 hours'`);
    const text = query.search?.trim() ?? "";
    if (text) {
      const digits = text.replace(/[^0-9]/g, "");
      const phone = digits.startsWith("0") ? `+84${digits.slice(1)}` : digits;
      conditions.push(sql`(upper(so.document_no) = upper(${text}) OR (${digits.length >= 6} AND (u.phone LIKE ${`%${phone}%`} OR m.recipient_phone LIKE ${`%${phone}%`})))`);
    }
    const where = sql.join(conditions, sql` AND `);
    const pageSize = 20;
    const [rows, total] = await Promise.all([
      this.database.execute<Row>(sql`${rowSelect} WHERE ${where} ORDER BY expiring_soon DESC, m.created_at LIMIT ${pageSize} OFFSET ${(query.page - 1) * pageSize}`),
      this.database.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN core.users u ON u.id = m.buyer_user_id
        JOIN retail.stores s ON s.id = m.station_id LEFT JOIN retail.station_orders st ON st.order_id = m.id WHERE ${where}`),
    ]);
    return { items: rows.rows.map((row) => this.item(row)), total: total.rows[0]!.total, page: query.page, currency: await companyCurrency(this.database, actor.companyId) };
  }

  private async visibleRow(executor: Pick<Database, "execute">, actor: Actor, id: string, lock = false): Promise<Row> {
    const row = (
      await executor.execute<Row>(sql`${rowSelect} WHERE m.id = ${id} AND m.company_id = ${actor.companyId} AND m.station_id IS NOT NULL AND ${await this.visibility(actor)}
        ${lock ? sql`FOR UPDATE OF m` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async detail(actor: Actor, id: string): Promise<StationOrderDetail> {
    const row = await this.visibleRow(this.database, actor, id);
    const granted = await retailPermissionsAt(this.permissionService, actor, row.branch_id);
    const handle = granted.has(retailPermissions.o2o);
    const deliver = granted.has(retailPermissions.o2oDeliver);
    const delivery = row.fulfillment_mode === "station_delivery";
    const canAssign = handle && delivery && row.status === "ready_for_pickup";
    const [collections, stock, events] = await Promise.all([
      this.database.execute<{ method: "cash" | "bank_transfer"; amount: string; change_amount: string; shift_id: string }>(sql`
        SELECT method, amount::text, change_amount::text, shift_id FROM retail.station_collections WHERE order_id = ${id} ORDER BY line_no`),
      this.database.execute<{ id: string; document_no: string | null; status: string }>(sql`
        SELECT id, document_no, status FROM inventory.documents WHERE type = 'sales_issue' AND source_id = ${row.sales_order_id} ORDER BY created_at DESC LIMIT 1`),
      this.database.execute<{ status: string; note: string | null; created_at: Date }>(sql`
        SELECT status, note, created_at FROM marketplace.order_events WHERE order_id = ${id} ORDER BY created_at, id`),
    ]);
    const document = stock.rows[0];
    return {
      ...this.item(row),
      currency: await companyCurrency(this.database, actor.companyId),
      recipientName: row.recipient_name,
      recipientPhone: localPhone(row.recipient_phone),
      address: `${row.street_address}, ${row.ward_name}, ${row.province_name}`,
      lines: await this.orders.lines(row.sales_order_id),
      goodsAmount: trimDecimal(row.goods_amount),
      shippingFee: trimDecimal(row.shipping_fee),
      paymentMethod: row.payment_method,
      paidAmount: trimDecimal(row.paid_amount),
      readyAt: row.ready_at ? new Date(row.ready_at).toISOString() : null,
      codeLockedUntil: row.code_locked_until && new Date(row.code_locked_until).getTime() > this.clock.now().getTime() ? new Date(row.code_locked_until).toISOString() : null,
      collections: collections.rows.map((line) => ({ method: line.method, amount: trimDecimal(line.amount), changeAmount: trimDecimal(line.change_amount), shiftId: line.shift_id })),
      stockDocument: document ? { id: document.id, documentNo: document.document_no ?? "", status: document.status } : null,
      events: events.rows.map((event) => ({ status: event.status, note: event.note, at: new Date(event.created_at).toISOString() })),
      canPrepare: handle && row.status === "awaiting_shipment",
      canHandOver: handle && row.status === "ready_for_pickup" && row.fulfillment_mode === "station_pickup",
      canCancel: handle && ["awaiting_shipment", "ready_for_pickup"].includes(row.status),
      courierUserId: row.courier_user_id,
      couriers: canAssign ? await this.couriers(row.branch_id, actor.companyId) : [],
      canAssign,
      canDispatch: deliver && delivery && row.status === "ready_for_pickup" && (row.courier_user_id === null || row.courier_user_id === actor.userId),
      canDeliver: deliver && row.status === "shipping" && row.courier_user_id === actor.userId,
      version: row.version,
    };
  }

  private async requireHandle(actor: Actor, row: Row): Promise<void> {
    const granted = await retailPermissionsAt(this.permissionService, actor, row.branch_id);
    if (!granted.has(retailPermissions.o2o)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  // Đã soạn xong (QUYTAC_NGHIEPVU_424, 425): cấp mã 6 số không trùng trong trạm, hạn giữ đến 23:59 giờ Việt Nam của ngày thứ N kể từ ngày sẵn sàng.
  async ready(actor: Actor, id: string, version: number): Promise<StationOrderDetail> {
    await this.database.transaction(async (transaction) => {
      const row = await this.visibleRow(transaction, actor, id, true);
      await this.requireHandle(actor, row);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "awaiting_shipment") throw new ApiError("BUSINESS_RULE", "stationOrderNotPreparable");
      const used = new Set(
        (await transaction.execute<{ pickup_code: string }>(sql`SELECT pickup_code FROM retail.station_orders WHERE store_id = ${row.store_id} AND is_active`)).rows.map((item) => item.pickup_code),
      );
      let code = "";
      do code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      while (used.has(code));
      await transaction.execute(sql`
        INSERT INTO retail.station_orders (order_id, company_id, store_id, pickup_code, ready_at, ready_by, hold_until)
        SELECT ${id}, ${actor.companyId}, ${row.store_id}, ${code}, now(), ${actor.userId},
          ((((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + s.hold_days) + time '23:59:59') AT TIME ZONE 'Asia/Ho_Chi_Minh')
        FROM retail.stores s WHERE s.id = ${row.store_id}`);
      await transaction.execute(sql`UPDATE marketplace.orders SET status = 'ready_for_pickup', version = version + 1 WHERE id = ${id}`);
      await this.orders.event(transaction, id, "ready_for_pickup", row.store_name, actor.userId);
      await this.notifyBuyer(transaction, id, "station_order.ready");
      // Mã nhận hàng không ghi vào nhật ký thao tác (QUYTAC_NGHIEPVU_425).
      await this.auditService.record({ ...retailAudit(actor, "station_order"), action: "station_order.ready", entityId: id, afterData: { storeId: row.store_id } }, transaction);
    });
    return this.detail(actor, id);
  }

  async cancel(actor: Actor, id: string, input: { reason: string; version: number }): Promise<StationOrderDetail> {
    const row = await this.visibleRow(this.database, actor, id);
    await this.requireHandle(actor, row);
    if (!["awaiting_shipment", "ready_for_pickup"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "orderNotCancellable");
    await this.orders.stationCancel(actor, id, input.version, input.reason);
    await this.auditService.record({ ...retailAudit(actor, "station_order"), action: "station_order.cancel", entityId: id, afterData: { reason: input.reason } });
    return this.detail(actor, id);
  }

  // Tìm đơn theo mã nhận hàng hoặc nội dung mã QR tại một trạm (API_224).
  async byCode(actor: Actor, storeId: string, text: string): Promise<StationOrderDetail> {
    const value = text.trim();
    const qr = /^VCOMM-NHAN:(.+):([0-9]{6})$/.exec(value);
    const code = qr ? qr[2]! : value;
    if (!/^[0-9]{6}$/.test(code)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "invalidValue" } });
    const found = (
      await this.database.execute<{ order_id: string }>(sql`
      SELECT st.order_id FROM retail.station_orders st JOIN marketplace.orders m ON m.id = st.order_id JOIN sales.orders so ON so.id = m.sales_order_id
      WHERE st.store_id = ${storeId} AND st.company_id = ${actor.companyId} AND st.is_active AND st.pickup_code = ${code} AND (${qr?.[1] ?? null}::text IS NULL OR so.document_no = ${qr?.[1] ?? null})`)
    ).rows[0];
    if (!found) throw new ApiError("NOT_FOUND", "stationCodeNotFound");
    return this.detail(actor, found.order_id);
  }

  // Kiểm mã trong giao dịch riêng để lần nhập sai được ghi lại; sai 5 lần thì khóa nhập mã của đơn 15 phút (QUYTAC_NGHIEPVU_425).
  private async verifyCode(id: string, code: string): Promise<void> {
    const result = await this.database.transaction(async (transaction) => {
      const station = (
        await transaction.execute<{ pickup_code: string; failed_code_count: number; locked: boolean }>(sql`
        SELECT pickup_code, failed_code_count, coalesce(code_locked_until > now(), false) AS locked FROM retail.station_orders WHERE order_id = ${id} AND is_active FOR UPDATE`)
      ).rows[0];
      if (!station) return "notReady" as const;
      if (station.locked) return "locked" as const;
      if (station.pickup_code === code) {
        await transaction.execute(sql`UPDATE retail.station_orders SET failed_code_count = 0 WHERE order_id = ${id}`);
        return "ok" as const;
      }
      const failed = station.failed_code_count + 1;
      if (failed >= maximumWrongCodes) {
        await transaction.execute(sql`UPDATE retail.station_orders SET failed_code_count = 0, code_locked_until = now() + make_interval(mins => ${codeLockMinutes}) WHERE order_id = ${id}`);
        return "locked" as const;
      }
      await transaction.execute(sql`UPDATE retail.station_orders SET failed_code_count = ${failed} WHERE order_id = ${id}`);
      return maximumWrongCodes - failed;
    });
    if (result === "ok") return;
    if (result === "notReady") throw new ApiError("BUSINESS_RULE", "stationOrderNotReady");
    if (result === "locked") throw new ApiError("BUSINESS_RULE", "stationCodeLocked");
    throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: result === 1 ? "stationCodeWrongLast" : "stationCodeWrong" } });
  }

  // Giao cho khách tại trạm (QUYTAC_NGHIEPVU_426): đúng mã; chưa thu đủ thì thu trong ca đang mở của chính người giao tại trạm; ghi sổ phiếu xuất, Đã giao.
  async handover(actor: Actor, id: string, input: HandoverInput): Promise<StationOrderDetail> {
    const before = await this.visibleRow(this.database, actor, id);
    await this.requireHandle(actor, before);
    if (before.status !== "ready_for_pickup" || before.fulfillment_mode !== "station_pickup") throw new ApiError("BUSINESS_RULE", "stationOrderNotReady");
    await this.verifyCode(id, input.code);
    await this.deliveries.ensureSequences(actor, actor.companyId);
    await this.database.transaction(async (transaction) => {
      const row = await this.visibleRow(transaction, actor, id, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "ready_for_pickup") throw new ApiError("BUSINESS_RULE", "stationOrderNotReady");
      await this.collect(transaction, actor, row, input);
      const today = this.permissionService.today();
      await this.deliveries.issueRetailWithin(transaction, actor, { orderId: row.sales_order_id, documentDate: today, serials: new Map(), reason: `Giao tại trạm đơn VComm ${row.document_no}` });
      await transaction.execute(sql`UPDATE marketplace.orders SET status = 'delivered', delivered_at = now(), version = version + 1 WHERE id = ${id}`);
      await transaction.execute(sql`UPDATE retail.station_orders SET is_active = false, handed_over_at = now(), handed_over_by = ${actor.userId} WHERE order_id = ${id}`);
      await this.orders.event(transaction, id, "delivered", row.store_name, actor.userId);
      await this.auditService.record(
        { ...retailAudit(actor, "station_order"), action: "station_order.handover", entityId: id, afterData: { payments: input.payments, shiftId: input.shiftId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Thu tiền khi nhận (QUYTAC_NGHIEPVU_426, theo QUYTAC_NGHIEPVU_373): không tiền mặt không vượt số phải thu; tổng đã đưa không nhỏ hơn số phải thu; tiền thừa trả bằng tiền mặt.
  private async collect(transaction: Parameters<Parameters<Database["transaction"]>[0]>[0], actor: Actor, row: Row, input: HandoverInput, permission: string = retailPermissions.o2o): Promise<void> {
    const due = this.dueAmount(row);
    if (due <= 0) {
      if (input.payments.length > 0) throw new ApiError("BUSINESS_RULE", "stationNothingToCollect");
      return;
    }
    if (!input.shiftId) throw new ApiError("BUSINESS_RULE", "stationShiftRequired");
    const shift = await this.shifts.requireOwnOpenShift(transaction, actor, input.shiftId, permission);
    if (shift.store_id !== row.store_id) throw new ApiError("BUSINESS_RULE", "stationShiftOtherStore");
    if (input.payments.length === 0) throw new ApiError("BUSINESS_RULE", "retailPaymentShort");
    if (input.payments.some((payment) => payment.method === "bank_transfer") && !row.bank_fund_id) throw new ApiError("BUSINESS_RULE", "retailNoBankFund");
    const nonCash = input.payments.filter((payment) => payment.method !== "cash").reduce((sum, payment) => sum + Number(payment.amount), 0);
    const tendered = input.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    if (nonCash > due + 0.00005) throw new ApiError("BUSINESS_RULE", "retailNonCashOverTotal");
    if (tendered < due - 0.00005) throw new ApiError("BUSINESS_RULE", "retailPaymentShort");
    let change = tendered - due;
    for (const [index, payment] of input.payments.entries()) {
      const lineChange = payment.method === "cash" ? Math.min(change, Number(payment.amount)) : 0;
      change -= lineChange;
      await transaction.execute(sql`
        INSERT INTO retail.station_collections (company_id, order_id, shift_id, line_no, method, amount, change_amount, fund_id, bank_reference, created_by)
        VALUES (${actor.companyId}, ${row.id}, ${shift.id}, ${index + 1}, ${payment.method}, ${payment.amount}::numeric, ${lineChange.toFixed(4)}::numeric,
          ${payment.method === "cash" ? row.cash_fund_id : row.bank_fund_id}, ${payment.method === "cash" ? null : payment.bankReference}, ${actor.userId})`);
    }
    await transaction.execute(sql`UPDATE marketplace.orders SET paid_amount = cod_amount, paid_at = now() WHERE id = ${row.id}`);
    await this.orders.event(transaction, row.id, "paid", row.store_name, actor.userId);
  }

  // Người có quyền giao đơn tại chi nhánh của trạm (gán ở chi nhánh đó hoặc cả công ty), đang hiệu lực.
  private async couriers(branchId: string, companyId: string): Promise<{ id: string; name: string }[]> {
    return (
      await this.database.execute<{ id: string; name: string }>(sql`
      SELECT DISTINCT u.id, u.full_name AS name FROM core.user_role_assignments a
      JOIN core.role_permissions rp ON rp.role_id = a.role_id AND rp.permission_code = ${retailPermissions.o2oDeliver}
      JOIN core.users u ON u.id = a.user_id AND u.status = 'active'
      WHERE a.company_id = ${companyId} AND (a.branch_id = ${branchId} OR a.scope_type = 'company')
        AND a.valid_from <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (a.valid_to IS NULL OR a.valid_to >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
      ORDER BY name`)
    ).rows;
  }

  private async requireDeliver(actor: Actor, row: Row): Promise<void> {
    const granted = await retailPermissionsAt(this.permissionService, actor, row.branch_id);
    if (!granted.has(retailPermissions.o2oDeliver)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  // Cửa hàng trưởng giao đơn Sẵn sàng nhận của trạm giao cho một nhân viên giao (QUYTAC_NGHIEPVU_427).
  async assign(actor: Actor, id: string, input: { courierUserId: string; version: number }): Promise<StationOrderDetail> {
    await this.database.transaction(async (transaction) => {
      const row = await this.visibleRow(transaction, actor, id, true);
      await this.requireHandle(actor, row);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.fulfillment_mode !== "station_delivery" || row.status !== "ready_for_pickup") throw new ApiError("BUSINESS_RULE", "stationOrderNotReady");
      if (!(await this.couriers(row.branch_id, actor.companyId)).some((courier) => courier.id === input.courierUserId)) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { courierUserId: "invalidValue" } });
      }
      await transaction.execute(sql`UPDATE retail.station_orders SET courier_user_id = ${input.courierUserId} WHERE order_id = ${id}`);
      await transaction.execute(sql`UPDATE marketplace.orders SET version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...retailAudit(actor, "station_order"), action: "station_order.assign", entityId: id, afterData: { courierUserId: input.courierUserId } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Nhân viên giao nhận đơn đi giao: đơn chưa thu tiền thì phải có ca đang mở của mình tại trạm (QUYTAC_NGHIEPVU_427).
  async dispatch(actor: Actor, id: string, input: { shiftId: string | null; version: number }): Promise<StationOrderDetail> {
    await this.database.transaction(async (transaction) => {
      const row = await this.visibleRow(transaction, actor, id, true);
      await this.requireDeliver(actor, row);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.fulfillment_mode !== "station_delivery" || row.status !== "ready_for_pickup") throw new ApiError("BUSINESS_RULE", "stationOrderNotReady");
      if (row.courier_user_id !== null && row.courier_user_id !== actor.userId) throw new ApiError("BUSINESS_RULE", "stationOrderOtherCourier");
      if (this.dueAmount(row) > 0) {
        if (!input.shiftId) throw new ApiError("BUSINESS_RULE", "stationShiftRequired");
        const shift = await this.shifts.requireOwnOpenShift(transaction, actor, input.shiftId, retailPermissions.o2oDeliver);
        if (shift.store_id !== row.store_id) throw new ApiError("BUSINESS_RULE", "stationShiftOtherStore");
      }
      await transaction.execute(sql`UPDATE retail.station_orders SET courier_user_id = ${actor.userId} WHERE order_id = ${id}`);
      await transaction.execute(sql`UPDATE marketplace.orders SET status = 'shipping', version = version + 1 WHERE id = ${id}`);
      await this.orders.event(transaction, id, "shipping", row.store_name, actor.userId);
      await this.notifyBuyer(transaction, id, "station_order.shipping");
      await this.auditService.record({ ...retailAudit(actor, "station_order"), action: "station_order.dispatch", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Giao thành công tận nơi: mã do khách đọc hoặc mã QR, thu tiền vào ca của nhân viên giao, ghi sổ phiếu xuất (QUYTAC_NGHIEPVU_427).
  async deliver(actor: Actor, id: string, input: HandoverInput): Promise<StationOrderDetail> {
    const before = await this.visibleRow(this.database, actor, id);
    await this.requireDeliver(actor, before);
    if (before.status !== "shipping" || before.courier_user_id !== actor.userId) throw new ApiError("BUSINESS_RULE", "stationOrderNotOut");
    await this.verifyCode(id, input.code);
    await this.deliveries.ensureSequences(actor, actor.companyId);
    await this.database.transaction(async (transaction) => {
      const row = await this.visibleRow(transaction, actor, id, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "shipping" || row.courier_user_id !== actor.userId) throw new ApiError("BUSINESS_RULE", "stationOrderNotOut");
      await this.collect(transaction, actor, row, input, retailPermissions.o2oDeliver);
      await this.deliveries.issueRetailWithin(transaction, actor, {
        orderId: row.sales_order_id,
        documentDate: this.permissionService.today(),
        serials: new Map(),
        reason: `Trạm giao đơn VComm ${row.document_no}`,
      });
      await transaction.execute(sql`UPDATE marketplace.orders SET status = 'delivered', delivered_at = now(), version = version + 1 WHERE id = ${id}`);
      await transaction.execute(sql`UPDATE retail.station_orders SET is_active = false, handed_over_at = now(), handed_over_by = ${actor.userId} WHERE order_id = ${id}`);
      await this.orders.event(transaction, id, "delivered", row.store_name, actor.userId);
      await this.auditService.record(
        { ...retailAudit(actor, "station_order"), action: "station_order.deliver", entityId: id, afterData: { payments: input.payments, shiftId: input.shiftId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Giao không thành công: đơn về Sẵn sàng nhận, cộng số lần giao; khách từ chối nhận hoặc đủ 3 lần thì hủy, hàng còn ở kho trạm (QUYTAC_NGHIEPVU_427).
  async attempt(actor: Actor, id: string, input: { reason: DeliveryFailureReason; note: string | null; version: number }): Promise<StationOrderDetail> {
    const reasonText = { absent: "Khách vắng", refused: "Khách từ chối nhận", wrong_address: "Sai địa chỉ", other: "Khác" }[input.reason];
    const note = input.note ? `${reasonText}: ${input.note}` : reasonText;
    const outcome = await this.database.transaction(async (transaction) => {
      const row = await this.visibleRow(transaction, actor, id, true);
      await this.requireDeliver(actor, row);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "shipping" || row.courier_user_id !== actor.userId) throw new ApiError("BUSINESS_RULE", "stationOrderNotOut");
      const attempts = (row.delivery_attempts ?? 0) + 1;
      await transaction.execute(sql`UPDATE retail.station_orders SET delivery_attempts = ${attempts}, courier_user_id = NULL WHERE order_id = ${id}`);
      const version = (await transaction.execute<{ version: number }>(sql`UPDATE marketplace.orders SET status = 'ready_for_pickup', version = version + 1 WHERE id = ${id} RETURNING version`))
        .rows[0]!.version;
      await this.orders.event(transaction, id, "delivery_failed", `${note} (${attempts}/${maximumDeliveryAttempts})`, actor.userId);
      await this.auditService.record(
        { ...retailAudit(actor, "station_order"), action: "station_order.attempt", entityId: id, afterData: { reason: input.reason, note: input.note, attempts } },
        transaction,
      );
      return { cancel: input.reason === "refused" || attempts >= maximumDeliveryAttempts, version };
    });
    if (outcome.cancel) {
      await this.orders.stationCancel(actor, id, outcome.version, `Giao không thành công: ${note}`);
      await this.notifyBuyer(this.database, id, "station_order.cancelled");
    }
    return this.detail(actor, id);
  }

  // Màn hình nhân viên giao (MAN_HINH_190): ca đang mở, quầy của trạm để mở ca, đơn chờ người giao, đơn mình đang giao.
  async myDeliveries(actor: Actor): Promise<MyDeliveriesResponse> {
    const deliver = await retailScope(this.permissionService, actor, retailPermissions.o2oDeliver);
    if (!deliver) throw new ApiError("FORBIDDEN", "forbidden");
    const scope = scopeCondition(deliver, sql`s.branch_id`);
    const [orders, registers] = await Promise.all([
      this.database.execute<{ id: string }>(sql`
        SELECT m.id FROM marketplace.orders m JOIN retail.stores s ON s.id = m.station_id LEFT JOIN retail.station_orders st ON st.order_id = m.id
        WHERE m.company_id = ${actor.companyId} AND m.fulfillment_mode = 'station_delivery' AND ${scope}
          AND ((m.status = 'ready_for_pickup' AND (st.courier_user_id IS NULL OR st.courier_user_id = ${actor.userId})) OR (m.status = 'shipping' AND st.courier_user_id = ${actor.userId}))
        ORDER BY st.hold_until, m.created_at LIMIT 100`),
      this.database.execute<{ id: string; code: string; name: string; store_id: string; store_name: string; busy: boolean }>(sql`
        SELECT r.id, r.code, r.name, s.id AS store_id, s.display_name AS store_name, EXISTS (SELECT 1 FROM retail.shifts o WHERE o.register_id = r.id AND o.status = 'open') AS busy
        FROM retail.registers r JOIN retail.stores s ON s.id = r.store_id
        WHERE s.company_id = ${actor.companyId} AND s.status = 'active' AND r.status = 'active' AND s.delivery_enabled AND ${scope} ORDER BY s.display_name, r.code`),
    ]);
    const details = [];
    for (const order of orders.rows) details.push(await this.detail(actor, order.id));
    const open = (await this.database.execute<{ id: string }>(sql`SELECT id FROM retail.shifts WHERE company_id = ${actor.companyId} AND cashier_id = ${actor.userId} AND status = 'open'`)).rows[0];
    return {
      currentShift: open ? await this.shifts.detail(actor, open.id) : null,
      registers: registers.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, storeId: row.store_id, storeName: row.store_name, busy: row.busy })),
      available: details.filter((order) => order.status === "ready_for_pickup"),
      mine: details.filter((order) => order.status === "shipping"),
    };
  }

  // Thông báo cho người mua trong ứng dụng; bộ gửi Zalo ZNS gửi theo loại thông báo. Không chứa mã nhận hàng (QUYTAC_NGHIEPVU_425, 429).
  private async notifyBuyer(executor: Pick<Database, "execute">, orderId: string, kind: StationNotificationKind): Promise<void> {
    const row = (
      await executor.execute<{
        buyer_user_id: string;
        company_id: string;
        document_no: string;
        store_name: string;
        address: string;
        opening_hours: string;
        hold_until: string | null;
        cancel_reason: string | null;
      }>(sql`
      SELECT m.buyer_user_id, m.company_id, so.document_no, s.display_name AS store_name, s.street_address || ', ' || w.name || ', ' || p.name AS address, s.opening_hours,
        to_char(st.hold_until AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY') AS hold_until, m.cancel_reason
      FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN retail.stores s ON s.id = m.station_id
      JOIN marketplace.wards w ON w.code = s.ward_code JOIN marketplace.provinces p ON p.code = s.province_code
      LEFT JOIN retail.station_orders st ON st.order_id = m.id WHERE m.id = ${orderId}`)
    ).rows[0];
    if (!row) return;
    const titles: Record<StationNotificationKind, string> = {
      "station_order.ready": `Đơn ${row.document_no} đã sẵn sàng tại ${row.store_name} (${row.address}, ${row.opening_hours}). Hạn giữ hàng đến ${row.hold_until ?? ""}.`,
      "station_order.reminder": `Đơn ${row.document_no} sẽ hết hạn giữ lúc ${row.hold_until ?? ""}. Mời bạn đến ${row.store_name} nhận hàng.`,
      "station_order.shipping": `Đơn ${row.document_no} đang được ${row.store_name} giao tới bạn.`,
      "station_order.cancelled": `Đơn ${row.document_no} đã hủy: ${row.cancel_reason ?? ""}.`,
    };
    await notify(executor, [{ userId: row.buyer_user_id, companyId: row.company_id, kind, title: titles[kind], payload: { orderId } }]);
  }

  // Việc nền mỗi giờ (QUYTAC_NGHIEPVU_428): nhắc một lần khi còn 24 giờ tới hạn giữ; quá hạn giữ thì hệ thống hủy đơn Sẵn sàng nhận. Đơn Đang giao không tự hủy.
  async expireDue(limit = 500): Promise<{ reminded: number; cancelled: number }> {
    const remind = await this.database.execute<{ order_id: string }>(sql`
      UPDATE retail.station_orders st SET reminded_at = now()
      FROM marketplace.orders m
      WHERE m.id = st.order_id AND m.status = 'ready_for_pickup' AND st.is_active AND st.reminded_at IS NULL
        AND st.hold_until > now() AND st.hold_until <= now() + interval '24 hours'
        AND st.order_id IN (SELECT order_id FROM retail.station_orders WHERE is_active AND reminded_at IS NULL ORDER BY hold_until LIMIT ${limit})
      RETURNING st.order_id`);
    for (const row of remind.rows) await this.notifyBuyer(this.database, row.order_id, "station_order.reminder");
    const due = await this.database.execute<{ order_id: string; company_id: string; ready_by: string; version: number }>(sql`
      SELECT st.order_id, st.company_id, st.ready_by, m.version FROM retail.station_orders st JOIN marketplace.orders m ON m.id = st.order_id
      WHERE st.is_active AND m.status = 'ready_for_pickup' AND st.hold_until < now() ORDER BY st.hold_until LIMIT ${limit}`);
    let cancelled = 0;
    for (const row of due.rows) {
      // Hệ thống hủy thay người đã báo sẵn sàng (như chứng từ hệ thống của đơn VComm).
      const system: Actor = { userId: row.ready_by, companyId: row.company_id, client: systemClient };
      try {
        await this.orders.stationCancel(system, row.order_id, row.version, "Quá hạn giữ hàng tại trạm", "system");
        await this.notifyBuyer(this.database, row.order_id, "station_order.cancelled");
        cancelled += 1;
      } catch {
        // Đơn vừa đổi trạng thái (khách đến nhận, nhân viên hủy): lần chạy sau xét lại.
      }
    }
    return { reminded: remind.rows.length, cancelled };
  }
}
