// CONG_VIEC_57 lát L5: hết hạn giữ, nhắc, thông báo (TIEUCHI_NGHIEMTHU_398, 399; KICHBAN_KIEMTHU_569 đến 571).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { RetailStationOrdersService } from "../src/retail/retail-station-orders.service";
import { signIn, type Session } from "./helpers";
import { assignRetailRole, retail } from "./retail-fixture";
import { startTestApplication, testGateway } from "./setup-database";
import { prepareStations, type StationFixture } from "./station-fixture";

let application: NestExpressApplication;
let pool: Pool;
let fx: StationFixture;
let manager: Session;
let managerId: string;
let buyerId: string;

const call = (session: Session, method: "get" | "post", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const place = async (mode: "station_pickup" | "station_delivery") => {
  const placed = await fx.buyer("post", "/buyer/orders", {
    addressId: fx.nearAddress,
    lines: [{ variantId: fx.market.variants.cream, quantity: 1 }],
    expectedTotal: mode === "station_pickup" ? "250000" : "265000",
    paymentMethod: "pay_at_station",
    fulfillmentMode: mode,
    stationId: fx.thuDuc,
  });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const id = placed.body.id as string;
  const version = (await call(manager, "get", `/retail/station-orders/${id}`)).body.version;
  expect((await call(manager, "post", `/retail/station-orders/${id}/ready`, { version })).status).toBe(200);
  return id;
};
const notifications = async (userId: string, kind: string) =>
  (await pool.query<{ title: string; payload: { orderId: string } }>("SELECT title, payload FROM core.notifications WHERE user_id = $1 AND kind = $2 ORDER BY created_at", [userId, kind])).rows;
const expire = () => application.get(RetailStationOrdersService).expireDue();

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fx = await prepareStations(application, pool);
  manager = await assignRetailRole(application, pool, "cuahangtruong.han@vcomm.test", "Đỗ Thị Hạn", "store_manager", fx.shop.storeBranch);
  managerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'cuahangtruong.han@vcomm.test'")).rows[0]!.id;
  buyerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE phone = '+84912570001'")).rows[0]!.id;
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Thông báo (KICHBAN_KIEMTHU_569)", () => {
  it("báo nhân viên trạm khi có đơn mới; báo khách khi sẵn sàng, không có mã nhận hàng", async () => {
    const id = await place("station_pickup");
    const staff = await notifications(managerId, "station_order.new");
    expect(staff.some((item) => item.payload.orderId === id && item.title.startsWith("Đơn trực tuyến mới"))).toBe(true);
    const ready = (await notifications(buyerId, "station_order.ready")).find((item) => item.payload.orderId === id)!;
    expect(ready.title).toContain("VComm Thủ Đức (45 Hoàng Diệu 2, Linh Xuân, Hồ Chí Minh, 7:00 – 21:00)");
    const code = (await fx.buyer("get", `/buyer/orders/${id}`)).body.pickup.code as string;
    expect(ready.title).not.toContain(code);
    const outbox = await pool.query("SELECT 1 FROM core.outbox_events WHERE event_type = 'core.notification.created' AND payload ->> 'kind' = 'station_order.ready'");
    expect(outbox.rows.length).toBeGreaterThan(0);
  });
});

describe("Hết hạn giữ (KICHBAN_KIEMTHU_570)", () => {
  it("còn dưới 24 giờ thì nhắc một lần; quá hạn thì hệ thống hủy, nhả hàng; đơn đang giao không tự hủy", async () => {
    const id = await place("station_pickup");
    await pool.query("UPDATE retail.station_orders SET hold_until = now() + interval '30 hours' WHERE is_active");
    expect(await expire()).toMatchObject({ reminded: 0, cancelled: 0 });
    await pool.query("UPDATE retail.station_orders SET hold_until = now() + interval '10 hours' WHERE order_id = $1", [id]);
    expect((await expire()).reminded).toBe(1);
    expect((await expire()).reminded).toBe(0);
    expect((await notifications(buyerId, "station_order.reminder")).some((item) => item.payload.orderId === id)).toBe(true);

    const out = await place("station_delivery");
    const registers = await call(fx.shop.admin, "post", `/retail/stores/${fx.thuDuc}/registers`, { code: "HAN", name: "Quầy hạn giữ" });
    const shift = await call(manager, "post", "/retail/shifts", { registerId: registers.body.registers[0].id, openingCash: "0" });
    expect(shift.status, JSON.stringify(shift.body)).toBe(201);
    const dispatched = await call(manager, "post", `/retail/station-orders/${out}/dispatch`, {
      shiftId: shift.body.id,
      version: (await call(manager, "get", `/retail/station-orders/${out}`)).body.version,
    });
    expect(dispatched.status, JSON.stringify(dispatched.body)).toBe(200);
    expect((await notifications(buyerId, "station_order.shipping")).some((item) => item.payload.orderId === out)).toBe(true);

    await pool.query("UPDATE retail.station_orders SET hold_until = now() - interval '1 minute' WHERE order_id IN ($1, $2)", [id, out]);
    expect((await expire()).cancelled).toBe(1);
    const cancelled = await pool.query("SELECT status, cancelled_by_kind, cancel_reason FROM marketplace.orders WHERE id = $1", [id]);
    expect(cancelled.rows[0]).toEqual({ status: "cancelled", cancelled_by_kind: "system", cancel_reason: "Quá hạn giữ hàng tại trạm" });
    const reserved = await pool.query(
      "SELECT count(*)::int AS total FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.id = $1 AND r.status = 'active'",
      [id],
    );
    expect(reserved.rows[0].total).toBe(0);
    expect((await notifications(buyerId, "station_order.cancelled")).find((item) => item.payload.orderId === id)?.title).toContain("Quá hạn giữ hàng tại trạm");
    expect((await pool.query("SELECT status FROM marketplace.orders WHERE id = $1", [out])).rows[0].status).toBe("shipping");
  });
});

describe("Zalo ZNS (KICHBAN_KIEMTHU_571)", () => {
  it("đã cài mẫu thì gửi tin sẵn sàng nhận theo số điện thoại khách, không có mã nhận hàng; chưa cài mẫu thì không gửi", async () => {
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    await application.get(OutboxService).dispatchPending();
    const before = testGateway.sent.length;
    const first = await place("station_pickup");
    await application.get(OutboxService).dispatchPending();
    expect(testGateway.sent.length).toBe(before);
    const saved = await groupAdmin.call("put", "/integration-settings", {
      body: { values: { "esms.api_key": "API-5757", "esms.secret_key": "SECRET-5757", "esms.oa_id": "4097311281936189049", "esms.template.station_order_ready": "571" } },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const id = await place("station_pickup");
    await application.get(OutboxService).dispatchPending();
    const sent = testGateway.sent.filter((item) => item.kind === "zns" && item.input.templateId === "571");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.input).toMatchObject({ phone: "+84912570001", data: { station_name: "VComm Thủ Đức", opening_hours: "7:00 – 21:00" } });
    const code = (await fx.buyer("get", `/buyer/orders/${id}`)).body.pickup.code as string;
    expect(JSON.stringify(sent[0]!.input.data)).not.toContain(code);
    expect(first).not.toBe(id);
  });
});
