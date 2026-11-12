// CONG_VIEC_57 lát L6: trả hàng đơn của trạm nhận về kho trạm; vận hành sàn lọc theo cách nhận, trạm và chỉ xem đơn của trạm
// (TIEUCHI_NGHIEMTHU_400, 401 phần phạm vi; KICHBAN_KIEMTHU_572).
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
let manager: Session;
let otherManager: Session;
let orderId: string;
let requestId: string;

const call = (session: Session, method: "get" | "post", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const stock = async () =>
  (await pool.query("SELECT quantity::text FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [fx.shop.warehouseId, fx.market.variants.cream])).rows[0].quantity as string;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fx = await prepareStations(application, pool);
  manager = await assignRetailRole(application, pool, "cuahangtruong.tra@vcomm.test", "Trần Thị Trả", "store_manager", fx.shop.storeBranch);
  otherManager = await assignRetailRole(application, pool, "cuahangtruong.q1tra@vcomm.test", "Lê Văn Một", "store_manager", fx.shop.otherStoreBranch);
  // Đơn nhận tại trạm Thủ Đức, trả khi nhận, đã giao tại trạm.
  const placed = await fx.buyer("post", "/buyer/orders", {
    addressId: fx.nearAddress,
    lines: [{ variantId: fx.market.variants.cream, quantity: 2 }],
    expectedTotal: "500000",
    paymentMethod: "pay_at_station",
    fulfillmentMode: "station_pickup",
    stationId: fx.thuDuc,
  });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  orderId = placed.body.id;
  const ready = await call(manager, "post", `/retail/station-orders/${orderId}/ready`, { version: (await call(manager, "get", `/retail/station-orders/${orderId}`)).body.version });
  expect(ready.status, JSON.stringify(ready.body)).toBe(200);
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Vận hành sàn chỉ xem đơn của trạm (MAN_HINH_195)", () => {
  it("lọc theo cách nhận, trạm; chi tiết có hạn giữ, không có mã nhận hàng; không hủy, không giao vận chuyển thay trạm", async () => {
    const stations = await fx.market.call("get", "/marketplace/order-stations");
    expect(stations.status, JSON.stringify(stations.body)).toBe(200);
    expect(stations.body.map((item: { name: string }) => item.name)).toEqual(["VComm Quận 1", "VComm Thủ Đức"]);
    const byStation = await fx.market.call("get", `/marketplace/orders?stationId=${fx.thuDuc}`);
    expect(byStation.body.data.map((item: { id: string }) => item.id)).toEqual([orderId]);
    expect(byStation.body.data[0]).toMatchObject({ fulfillmentMode: "station_pickup", stationName: "VComm Thủ Đức" });
    expect((await fx.market.call("get", `/marketplace/orders?stationId=${fx.quanMot}`)).body.data).toEqual([]);
    expect((await fx.market.call("get", "/marketplace/orders?fulfillmentMode=station_delivery")).body.data).toEqual([]);
    expect((await fx.market.call("get", "/marketplace/orders?fulfillmentMode=bad")).status).toBe(400);
    const detail = await fx.market.call("get", `/marketplace/orders/${orderId}`);
    expect(detail.body).toMatchObject({ status: "ready_for_pickup", pickup: null, canCancel: false, canShip: false, stationHold: { deliveryAttempts: 0, courierName: null } });
    expect(detail.body.stationHold.holdUntil).not.toBeNull();
    const code = (await fx.buyer("get", `/buyer/orders/${orderId}`)).body.pickup.code as string;
    expect(JSON.stringify(detail.body)).not.toContain(`"${code}"`);
    const cancel = await fx.market.call("post", `/marketplace/orders/${orderId}/cancel`, { reason: "Thử hủy", version: detail.body.version });
    expect(cancel.body.error.message).toBe("Đơn của trạm do trạm xử lý; nhân viên vận hành sàn chỉ xem.");
  });
});

describe("Trả hàng tại trạm (KICHBAN_KIEMTHU_572)", () => {
  it("giao tại trạm; khách gửi yêu cầu, vận hành duyệt: báo mang hàng đến trạm của đơn; vận hành không nhận thay trạm", async () => {
    const code = (await fx.buyer("get", `/buyer/orders/${orderId}`)).body.pickup.code as string;
    const registers = await call(fx.shop.admin, "post", `/retail/stores/${fx.thuDuc}/registers`, { code: "TRA", name: "Quầy trả hàng" });
    const shift = await call(manager, "post", "/retail/shifts", { registerId: registers.body.registers[0].id, openingCash: "0" });
    expect(shift.status, JSON.stringify(shift.body)).toBe(201);
    const version = (await call(manager, "get", `/retail/station-orders/${orderId}`)).body.version;
    const done = await call(manager, "post", `/retail/station-orders/${orderId}/handover`, { code, version, shiftId: shift.body.id, payments: [{ method: "cash", amount: "500000" }] });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(await stock()).toBe("3.0000");

    const buyerView = (await fx.buyer("get", `/buyer/orders/${orderId}`)).body;
    expect(buyerView.canRequestReturn).toBe(true);
    const created = await fx.buyer("post", `/buyer/orders/${orderId}/return-requests`, {
      reason: "defective",
      description: "Hộp kem bị móp",
      lines: [{ orderLineId: buyerView.lines[0].orderLineId, quantity: 1 }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    requestId = created.body[0].id;
    expect(created.body[0].returnStation).toMatchObject({ name: "VComm Thủ Đức", address: "45 Hoàng Diệu 2, Linh Xuân, Hồ Chí Minh" });
    // Chưa duyệt thì trạm chưa thấy.
    expect((await call(manager, "get", "/retail/station-returns")).body.items).toEqual([]);

    const approved = await fx.market.call("post", `/marketplace/return-requests/${requestId}/approve`, { note: null, version: created.body[0].version });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body).toMatchObject({ status: "approved", canClose: true, canReceive: false });
    const buyerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE phone = '+84912570001'")).rows[0]!.id;
    const notice = await pool.query("SELECT title FROM core.notifications WHERE user_id = $1 AND kind = 'return_request.approved'", [buyerId]);
    expect(notice.rows[0].title).toBe("Yêu cầu trả hàng đã được duyệt. Vui lòng mang hàng đến trạm VComm Thủ Đức: 45 Hoàng Diệu 2, Linh Xuân, Hồ Chí Minh (7:00 – 21:00).");
    const operatorReceive = await fx.market.call("post", `/marketplace/return-requests/${requestId}/receive`, { note: null, version: approved.body.version });
    expect(operatorReceive.body.error.message).toBe("Hàng trả của đơn tại trạm do trạm xác nhận đã nhận.");
  });

  it("chỉ trạm của đơn thấy và nhận; nhận: phiếu nhận hàng trả lại vào kho trạm, việc chờ hoàn tiền, báo khách", async () => {
    expect((await call(otherManager, "get", "/retail/station-returns")).body.items).toEqual([]);
    expect((await call(otherManager, "post", `/retail/station-returns/${requestId}/receive`, { version: 2 })).status).toBe(404);
    const list = await call(manager, "get", "/retail/station-returns");
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.items).toHaveLength(1);
    const item = list.body.items[0];
    expect(item).toMatchObject({ documentNo: expect.any(String), store: { name: "VComm Thủ Đức" }, buyerPhone: "0912570001", status: "approved", canReceive: true });
    expect(item.lines).toEqual([expect.objectContaining({ productName: "Kem dưỡng da VComm", quantity: "1" })]);
    expect((await call(manager, "post", `/retail/station-returns/${requestId}/receive`, { version: item.version + 1 })).status).toBe(409);

    const received = await call(manager, "post", `/retail/station-returns/${requestId}/receive`, { version: item.version });
    expect(received.status, JSON.stringify(received.body)).toBe(200);
    expect(received.body).toMatchObject({ status: "received", receivedByName: "Trần Thị Trả", canReceive: false });
    expect(received.body.stockDocument.documentNo).not.toBe("");
    expect(await stock()).toBe("4.0000");
    const document = await pool.query("SELECT type, status, warehouse_id FROM inventory.documents WHERE id = $1", [received.body.stockDocument.id]);
    expect(document.rows[0]).toEqual({ type: "sales_return", status: "posted", warehouse_id: fx.shop.warehouseId });
    const refund = await pool.query("SELECT amount::text, status FROM marketplace.refunds WHERE return_request_id = $1", [requestId]);
    expect(refund.rows).toEqual([{ amount: "250000.0000", status: "pending" }]);
    expect((await call(manager, "post", `/retail/station-returns/${requestId}/receive`, { version: received.body.version })).body.error.code).toBe("BUSINESS_RULE");
    expect((await call(manager, "get", "/retail/station-returns?status=received")).body.items.map((row: { id: string }) => row.id)).toEqual([requestId]);
    const buyerView = (await fx.buyer("get", `/buyer/orders/${orderId}`)).body;
    expect(buyerView.returnRequests[0]).toMatchObject({ status: "received", returnStation: { name: "VComm Thủ Đức" } });
  });
});
