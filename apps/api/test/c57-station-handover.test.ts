// CONG_VIEC_57 lát L3: xử lý đơn tại trạm – sẵn sàng nhận, mã nhận hàng, giao, thu tiền trong ca, đóng ca, hủy
// (TIEUCHI_NGHIEMTHU_394, 395, 396, 401 phần phạm vi; KICHBAN_KIEMTHU_564 đến 566).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Session } from "./helpers";
import { assignRetailRole, retail } from "./retail-fixture";
import { startTestApplication } from "./setup-database";
import { prepareStations, type StationFixture } from "./station-fixture";

let application: NestExpressApplication;
let pool: Pool;
let fx: StationFixture;
let cashier: Session;
let otherCashier: Session;
let register: string;
let orderId: string;
let shiftId: string;

const call = (session: Session, method: "get" | "post" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const placePickup = async (quantity: number) => {
  const placed = await fx.buyer("post", "/buyer/orders", {
    addressId: fx.nearAddress,
    lines: [{ variantId: fx.market.variants.cream, quantity }],
    expectedTotal: String(250000 * quantity),
    paymentMethod: "pay_at_station",
    fulfillmentMode: "station_pickup",
    stationId: fx.thuDuc,
  });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body.id as string;
};
const detail = async (id: string) => (await call(cashier, "get", `/retail/station-orders/${id}`)).body;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fx = await prepareStations(application, pool);
  cashier = await assignRetailRole(application, pool, "thungan.o2o@vcomm.test", "Nguyễn Thị Trạm", "cashier", fx.shop.storeBranch);
  otherCashier = await assignRetailRole(application, pool, "thungan.o2o.q1@vcomm.test", "Phan Văn Một", "cashier", fx.shop.otherStoreBranch);
  const registers = await call(fx.shop.admin, "post", `/retail/stores/${fx.thuDuc}/registers`, { code: "Q01", name: "Quầy 1" });
  register = registers.body.registers[0].id;
  orderId = await placePickup(2);
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Danh sách, sẵn sàng nhận (KICHBAN_KIEMTHU_564)", () => {
  it("nhân viên trạm thấy đơn của trạm; trạm khác không thấy; sẵn sàng cấp mã, hạn giữ", async () => {
    const list = await call(cashier, "get", "/retail/station-orders");
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id: orderId, status: "awaiting_shipment", fulfillmentMode: "station_pickup", total: "500000", dueAmount: "500000", holdUntil: null });
    expect((await call(otherCashier, "get", "/retail/station-orders")).body.items).toEqual([]);
    expect((await call(otherCashier, "get", `/retail/station-orders/${orderId}`)).status).toBe(404);
    const before = await detail(orderId);
    expect(before).toMatchObject({ canPrepare: true, canHandOver: false, canCancel: true });
    expect((await call(cashier, "post", `/retail/station-orders/${orderId}/ready`, { version: before.version + 1 })).status).toBe(409);
    const ready = await call(cashier, "post", `/retail/station-orders/${orderId}/ready`, { version: before.version });
    expect(ready.status, JSON.stringify(ready.body)).toBe(200);
    expect(ready.body).toMatchObject({ status: "ready_for_pickup", canPrepare: false, canHandOver: true });
    const expected = new Date(`${fx.market.today}T23:59:59+07:00`);
    expected.setUTCDate(expected.getUTCDate() + 3);
    expect(ready.body.holdUntil).toBe(expected.toISOString());
    expect((await call(cashier, "post", `/retail/station-orders/${orderId}/ready`, { version: ready.body.version })).status).toBe(409);
    const buyerView = await fx.buyer("get", `/buyer/orders/${orderId}`);
    expect(buyerView.body.status).toBe("ready_for_pickup");
    expect(buyerView.body.pickup.code).toMatch(/^[0-9]{6}$/);
    expect(buyerView.body.pickup.qrText).toBe(`VCOMM-NHAN:${buyerView.body.documentNo}:${buyerView.body.pickup.code}`);
    // Mã không ghi vào nhật ký thao tác.
    const audit = await pool.query("SELECT after_data::text AS data FROM core.audit_events WHERE action = 'station_order.ready' AND entity_id = $1", [orderId]);
    expect(audit.rows[0].data).not.toContain(buyerView.body.pickup.code);
  });
});

describe("Giao tại trạm, thu tiền trong ca (KICHBAN_KIEMTHU_565)", () => {
  it("tìm theo mã, mã QR; sai 5 lần khóa 15 phút", async () => {
    const code = (await fx.buyer("get", `/buyer/orders/${orderId}`)).body.pickup.code as string;
    const wrong = code === "000000" ? "000001" : "000000";
    expect((await call(cashier, "get", `/retail/station-orders/by-code?storeId=${fx.thuDuc}&code=${wrong}`)).status).toBe(404);
    const qr = (await fx.buyer("get", `/buyer/orders/${orderId}`)).body.pickup.qrText as string;
    expect((await call(cashier, "get", `/retail/station-orders/by-code?storeId=${fx.thuDuc}&code=${encodeURIComponent(qr)}`)).body.id).toBe(orderId);
    expect((await call(cashier, "get", `/retail/station-orders/by-code?storeId=${fx.thuDuc}&code=${code}`)).body.id).toBe(orderId);
    const version = (await detail(orderId)).version;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = await call(cashier, "post", `/retail/station-orders/${orderId}/handover`, { code: wrong, version });
      expect(result.status).toBe(400);
      expect(result.body.error.fields.code).toBe(attempt === 4 ? "Mã nhận hàng không đúng. Sai thêm một lần nữa sẽ khóa nhập mã 15 phút." : "Mã nhận hàng không đúng.");
    }
    const locked = await call(cashier, "post", `/retail/station-orders/${orderId}/handover`, { code: wrong, version });
    expect(locked.body.error.message).toBe("Đơn đã nhập sai mã nhận hàng 5 lần, thử lại sau 15 phút.");
    expect((await call(cashier, "post", `/retail/station-orders/${orderId}/handover`, { code, version })).status).toBe(409);
    expect((await detail(orderId)).codeLockedUntil).not.toBeNull();
    await pool.query("UPDATE retail.station_orders SET code_locked_until = now() - interval '1 minute' WHERE order_id = $1", [orderId]);
  });

  it("chưa thu tiền thì phải có ca của trạm; thu thiếu, không tiền mặt vượt thì chặn; giao: ghi sổ phiếu xuất, đã thu, Đã giao", async () => {
    const code = (await fx.buyer("get", `/buyer/orders/${orderId}`)).body.pickup.code as string;
    const version = (await detail(orderId)).version;
    const handover = (body: Record<string, unknown>) => call(cashier, "post", `/retail/station-orders/${orderId}/handover`, { code, version, ...body });
    expect((await handover({})).body.error.message).toBe("Đơn chưa thu tiền: mở ca trước khi giao.");
    const shift = await call(cashier, "post", "/retail/shifts", { registerId: register, openingCash: "0" });
    expect(shift.status, JSON.stringify(shift.body)).toBe(201);
    shiftId = shift.body.id;
    expect((await handover({ shiftId, payments: [{ method: "cash", amount: "300000" }] })).status).toBe(409);
    expect((await handover({ shiftId, payments: [{ method: "bank_transfer", amount: "600000", bankReference: "FT1" }] })).status).toBe(409);
    const done = await handover({
      shiftId,
      payments: [
        { method: "bank_transfer", amount: "100000", bankReference: "FT26111201" },
        { method: "cash", amount: "500000" },
      ],
    });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body).toMatchObject({ status: "delivered", paidAmount: "500000", dueAmount: "0", stockDocument: { status: "posted" } });
    expect(done.body.collections).toEqual([
      { method: "bank_transfer", amount: "100000", changeAmount: "0", shiftId },
      { method: "cash", amount: "500000", changeAmount: "100000", shiftId },
    ]);
    const stock = await pool.query("SELECT quantity::text FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [fx.shop.warehouseId, fx.market.variants.cream]);
    expect(stock.rows[0].quantity).toBe("3.0000");
    const reserved = await pool.query(
      "SELECT count(*)::int AS total FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.id = $1 AND r.status = 'active'",
      [orderId],
    );
    expect(reserved.rows[0].total).toBe(0);
    const buyerView = await fx.buyer("get", `/buyer/orders/${orderId}`);
    expect(buyerView.body).toMatchObject({ status: "delivered", paymentStatus: "paid", pickup: null });
    expect((await call(cashier, "post", `/retail/station-orders/${orderId}/handover`, { code, version: done.body.version, shiftId })).status).toBe(409);
  });

  it("đóng ca: tiền hệ thống tính gồm tiền thu đơn trực tuyến; phiếu thu theo quỹ", async () => {
    const shift = await call(cashier, "get", `/retail/shifts/${shiftId}`);
    expect(shift.body).toMatchObject({ onlineCollected: "500000", expectedCash: "400000" });
    const closed = await call(cashier, "post", `/retail/shifts/${shiftId}/close`, { countedCash: "400000", version: shift.body.version });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    const documents = closed.body.fundDocuments.map((document: { kind: string; amount: string }) => [document.kind, document.amount]).sort();
    expect(documents).toEqual([
      ["retail_receipt", "100000"],
      ["retail_receipt", "400000"],
    ]);
  });
});

describe("Hủy đơn tại trạm (KICHBAN_KIEMTHU_566)", () => {
  it("nhân viên trạm hủy đơn sẵn sàng: nhả giữ hàng, mã hết hiệu lực", async () => {
    const id = await placePickup(1);
    const ready = await call(cashier, "post", `/retail/station-orders/${id}/ready`, { version: (await detail(id)).version });
    expect((await call(otherCashier, "post", `/retail/station-orders/${id}/cancel`, { reason: "Khách báo không lấy", version: ready.body.version })).status).toBe(404);
    const cancelled = await call(cashier, "post", `/retail/station-orders/${id}/cancel`, { reason: "Khách báo không lấy", version: ready.body.version });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");
    const reserved = await pool.query(
      "SELECT count(*)::int AS total FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.id = $1 AND r.status = 'active'",
      [id],
    );
    expect(reserved.rows[0].total).toBe(0);
    expect((await pool.query("SELECT is_active FROM retail.station_orders WHERE order_id = $1", [id])).rows[0].is_active).toBe(false);
    expect((await fx.buyer("get", `/buyer/orders/${id}`)).body).toMatchObject({ status: "cancelled", pickup: null });
  });
});
