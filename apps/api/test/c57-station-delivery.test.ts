// CONG_VIEC_57 lát L4: trạm giao tận nơi – giao cho nhân viên, nhận đi giao, giao thành công, không thành công (TIEUCHI_NGHIEMTHU_397, 401 phần quyền giao;
// KICHBAN_KIEMTHU_567, 568).
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
let courier: Session;
let otherCourier: Session;
let courierId: string;
let register: string;
let shiftId: string;

const call = (session: Session, method: "get" | "post" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const detail = async (session: Session, id: string) => (await call(session, "get", `/retail/station-orders/${id}`)).body;
const placeDelivery = async () => {
  const placed = await fx.buyer("post", "/buyer/orders", {
    addressId: fx.nearAddress,
    lines: [{ variantId: fx.market.variants.cream, quantity: 1 }],
    expectedTotal: "265000",
    paymentMethod: "pay_at_station",
    fulfillmentMode: "station_delivery",
    stationId: fx.thuDuc,
  });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const id = placed.body.id as string;
  const ready = await call(manager, "post", `/retail/station-orders/${id}/ready`, { version: (await detail(manager, id)).version });
  expect(ready.status, JSON.stringify(ready.body)).toBe(200);
  return id;
};
const dispatch = async (id: string) => {
  const result = await call(courier, "post", `/retail/station-orders/${id}/dispatch`, { shiftId, version: (await detail(courier, id)).version });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body;
};
const reserved = async (id: string) =>
  (await pool.query("SELECT count(*)::int AS total FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.id = $1 AND r.status = 'active'", [id])).rows[0]
    .total as number;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fx = await prepareStations(application, pool);
  manager = await assignRetailRole(application, pool, "cuahangtruong.giao@vcomm.test", "Võ Văn Trưởng", "store_manager", fx.shop.storeBranch);
  courier = await assignRetailRole(application, pool, "giaohang.td@vcomm.test", "Phạm Văn Tài", "station_courier", fx.shop.storeBranch);
  otherCourier = await assignRetailRole(application, pool, "giaohang.q1@vcomm.test", "Lý Văn Giao", "station_courier", fx.shop.storeBranch);
  courierId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'giaohang.td@vcomm.test'")).rows[0]!.id;
  const registers = await call(fx.shop.admin, "post", `/retail/stores/${fx.thuDuc}/registers`, { code: "GH1", name: "Quầy giao hàng" });
  register = registers.body.registers[0].id;
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Giao cho nhân viên, giao thành công (KICHBAN_KIEMTHU_567)", () => {
  let orderId: string;

  it("cửa hàng trưởng giao cho nhân viên giao; nhân viên khác không nhận được; nhân viên giao không bán tại quầy", async () => {
    orderId = await placeDelivery();
    const ready = await detail(manager, orderId);
    expect(ready).toMatchObject({ status: "ready_for_pickup", canAssign: true, canDispatch: true });
    expect(ready.couriers.map((item: { name: string }) => item.name)).toEqual(expect.arrayContaining(["Phạm Văn Tài", "Lý Văn Giao", "Võ Văn Trưởng"]));
    expect((await call(manager, "post", `/retail/station-orders/${orderId}/assign`, { courierUserId: fx.shop.storeBranch, version: ready.version })).status).toBe(400);
    const assigned = await call(manager, "post", `/retail/station-orders/${orderId}/assign`, { courierUserId: courierId, version: ready.version });
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);
    expect(assigned.body).toMatchObject({ courierUserId: courierId, courierName: "Phạm Văn Tài" });
    const other = await call(otherCourier, "post", `/retail/station-orders/${orderId}/dispatch`, { shiftId: null, version: assigned.body.version });
    expect(other.body.error.message).toBe("Đơn đã giao cho nhân viên khác.");
    expect((await call(otherCourier, "get", "/retail/station-orders/my-deliveries")).body.available).toEqual([]);
    const mine = await call(courier, "get", "/retail/station-orders/my-deliveries");
    expect(mine.status, JSON.stringify(mine.body)).toBe(200);
    expect(mine.body).toMatchObject({ currentShift: null, mine: [] });
    expect(mine.body.available.map((item: { id: string }) => item.id)).toEqual([orderId]);
    expect(mine.body.registers.map((item: { code: string }) => item.code)).toContain("GH1");
    expect((await call(courier, "get", "/retail/counter")).status).toBe(403);
  });

  it("chưa thu tiền: nhận đi giao cần ca; giao thành công thu tiền vào ca nhân viên giao", async () => {
    const before = await detail(courier, orderId);
    expect((await call(courier, "post", `/retail/station-orders/${orderId}/dispatch`, { shiftId: null, version: before.version })).body.error.message).toBe("Đơn chưa thu tiền: mở ca trước khi giao.");
    const shift = await call(courier, "post", "/retail/shifts", { registerId: register, openingCash: "0" });
    expect(shift.status, JSON.stringify(shift.body)).toBe(201);
    shiftId = shift.body.id;
    expect((await call(courier, "get", `/retail/items?shiftId=${shiftId}&search=kem`)).status).toBe(403);
    const out = await dispatch(orderId);
    expect(out).toMatchObject({ status: "shipping", canDeliver: true });
    expect((await fx.buyer("get", `/buyer/orders/${orderId}`)).body.pickup).not.toBeNull();
    const code = (await fx.buyer("get", `/buyer/orders/${orderId}`)).body.pickup.code as string;
    expect((await call(manager, "post", `/retail/station-orders/${orderId}/deliver`, { code, shiftId, payments: [], version: out.version })).status).toBe(409);
    const done = await call(courier, "post", `/retail/station-orders/${orderId}/deliver`, { code, shiftId, payments: [{ method: "cash", amount: "300000" }], version: out.version });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body).toMatchObject({ status: "delivered", paidAmount: "265000", stockDocument: { status: "posted" } });
    expect(done.body.collections).toEqual([{ method: "cash", amount: "300000", changeAmount: "35000", shiftId }]);
    expect((await call(courier, "get", `/retail/shifts/${shiftId}`)).body).toMatchObject({ onlineCollected: "265000", expectedCash: "265000", canClose: true });
  });
});

describe("Giao không thành công (KICHBAN_KIEMTHU_568)", () => {
  it("khách vắng: về Sẵn sàng nhận, cộng lần giao; lần thứ 3 không thành công thì hủy", async () => {
    const id = await placeDelivery();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const out = await dispatch(id);
      const failed = await call(courier, "post", `/retail/station-orders/${id}/attempts`, { reason: "absent", note: null, version: out.version });
      expect(failed.status, JSON.stringify(failed.body)).toBe(200);
      if (attempt < 3) expect(failed.body).toMatchObject({ status: "ready_for_pickup", deliveryAttempts: attempt, courierUserId: null });
      else expect(failed.body).toMatchObject({ status: "cancelled", deliveryAttempts: 3 });
    }
    expect(await reserved(id)).toBe(0);
    const events = (await detail(manager, id)).events.map((event: { status: string; note: string | null }) => [event.status, event.note]);
    expect(events).toContainEqual(["delivery_failed", "Khách vắng (1/3)"]);
  });

  it("khách từ chối nhận thì hủy ngay; lý do khác phải có ghi chú", async () => {
    const id = await placeDelivery();
    const out = await dispatch(id);
    expect((await call(courier, "post", `/retail/station-orders/${id}/attempts`, { reason: "other", note: "", version: out.version })).status).toBe(400);
    const refused = await call(courier, "post", `/retail/station-orders/${id}/attempts`, { reason: "refused", note: "Đổi ý", version: out.version });
    expect(refused.status, JSON.stringify(refused.body)).toBe(200);
    expect(refused.body.status).toBe("cancelled");
    expect(await reserved(id)).toBe(0);
    expect((await fx.buyer("get", `/buyer/orders/${id}`)).body.cancelReason).toBe("Giao không thành công: Khách từ chối nhận: Đổi ý");
  });
});
