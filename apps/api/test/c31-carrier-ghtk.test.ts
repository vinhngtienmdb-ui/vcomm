// CONG_VIEC_31: Kết nối Giao Hàng Tiết Kiệm (KICHBAN_KIEMTHU_352 đến 354). Máy chủ GHTK giả lập theo tài liệu API công khai, không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { CarrierFailure } from "../src/marketplace/carriers/carrier";
import { carrierAdapter, carrierConfigured, ghtkConfiguration, webhookKeyOf } from "../src/marketplace/carriers/carrier-registry";
import { GhtkCarrier } from "../src/marketplace/carriers/ghtk-carrier";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let warehouseId: string;
let creamVariant: string;
// Máy chủ GHTK giả lập: ghi lại yêu cầu, trạng thái vận đơn do kiểm thử đặt.
let ghtk: Server;
let ghtkBaseUrl: string;
const ghtkRequests: { method: string; path: string; headers: Record<string, unknown>; body: Record<string, unknown> }[] = [];
const ghtkStatus = new Map<string, string>();
const ghtkByPartner = new Map<string, string>();
const ghtkCod = new Map<string, number>();
let ghtkReject = false;
let ghtkLoseResponse = false;
let ghtkCounter = 0;
const webhookKey = "khoa-webhook-ghtk-kiem-thu-0123456789";
const retail: string = testIds.retailCompany;
const password = "MatKhauNguoiMua@2026";
const environment = {
  GHTK_API_TOKEN: "token-ghtk-kiem-thu",
  GHTK_CLIENT_SOURCE: "S1234567",
  GHTK_WEBHOOK_KEY: webhookKey,
  GHTK_PICK_ADDRESS_ID: "88001",
  GHTK_PICK_NAME: "Kho VComm",
  GHTK_PICK_TEL: "0911000111",
  GHTK_PICK_ADDRESS: "5 Đường Số 1",
  GHTK_PICK_PROVINCE: "Thành phố Hồ Chí Minh",
  GHTK_PICK_WARD: "Phường Sài Gòn",
};
const http = () => request(application.getHttpServer());
const call = (method: "get" | "post" | "put", path: string, body?: object) => admin.call(method, path, { companyId: retail, ...(body ? { body } : {}) });
// GHTK gửi webhook dạng form.
const webhook = (key: string, payload: Record<string, string>) => http().post(`/api/v1/public/carriers/ghtk/webhook/${key}`).type("form").send(payload);

beforeAll(async () => {
  ghtk = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const path = incoming.url ?? "";
      ghtkRequests.push({ method: incoming.method ?? "", path, headers: incoming.headers, body });
      const reply = (payload: unknown, status = 200) => {
        response.statusCode = status;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(payload));
      };
      // Sai token: GHTK trả 403 không có nội dung.
      if (incoming.headers.token !== environment.GHTK_API_TOKEN || incoming.headers["x-client-source"] !== environment.GHTK_CLIENT_SOURCE) {
        response.statusCode = 403;
        return response.end();
      }
      if (incoming.method === "POST" && path === "/services/shipment/order") {
        if (ghtkReject) return reply({ success: false, message: "Địa chỉ người nhận không hợp lệ" });
        const order = body.order as Record<string, unknown>;
        if (ghtkByPartner.has(order.id as string)) return reply({ success: false, message: "Mã đơn hàng đã tồn tại", error: { code: "ORDER_ID_EXIST" } });
        ghtkCounter += 1;
        const label = `S1.A1.${2001297580 + ghtkCounter}`;
        ghtkStatus.set(label, "2");
        ghtkByPartner.set(order.id as string, label);
        ghtkCod.set(label, order.pick_money as number);
        if (ghtkLoseResponse) return reply({ success: false, message: "Lỗi máy chủ" }, 502);
        return reply({ success: true, message: "", order: { partner_id: order.id, label, area: "1", fee: "30400", insurance_fee: "0", status_id: 2, products: [] } });
      }
      const detail = path.match(/^\/services\/shipment\/v2\/(.+)$/);
      if (incoming.method === "GET" && detail) {
        const code = decodeURIComponent(detail[1]!);
        const label = ghtkStatus.has(code) ? code : ghtkByPartner.get(code);
        if (!label) return reply({ success: false, message: "Không tìm thấy đơn hàng" });
        const partner = [...ghtkByPartner].find(([, value]) => value === label)![0];
        return reply({
          success: true,
          message: "",
          order: { label_id: label, partner_id: partner, status: ghtkStatus.get(label), status_text: "", ship_money: 30400, pick_money: ghtkCod.get(label), weight: 500 },
        });
      }
      const cancel = path.match(/^\/services\/shipment\/cancel\/(.+)$/);
      if (incoming.method === "POST" && cancel) {
        const label = decodeURIComponent(cancel[1]!);
        // Chỉ hủy được khi chưa tiếp nhận, đã tiếp nhận, đang lấy hàng (1, 2, 12).
        if (!["1", "2", "12"].includes(ghtkStatus.get(label) ?? "")) return reply({ success: false, message: "Đơn hàng đã lấy, không thể hủy" });
        ghtkStatus.set(label, "-1");
        return reply({ success: true, message: "", log_id: "1" });
      }
      reply({ success: false, message: "Không có" }, 404);
    });
  });
  await new Promise<void>((resolve) => ghtk.listen(0, "127.0.0.1", resolve));
  ghtkBaseUrl = `http://127.0.0.1:${(ghtk.address() as AddressInfo).port}`;
  Object.assign(process.env, { ...environment, GHTK_BASE_URL: ghtkBaseUrl });
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  const units: Record<string, string> = {};
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "HANGGT", nameVi: "Hàng GHTK", nameEn: "GHTK goods" } })).body.id;
  const product = await call("post", "/catalog/products", {
    categoryId,
    name: "Kem dưỡng da VComm",
    vatRate: "10",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: units.CAI,
    weightKg: "0.5",
    variants: [{ barcodes: [] }],
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  creamVariant = product.body.variants[0].id;
  warehouseId = (await call("post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "VCOMM", name: "Kho VComm", usesLocations: false })).body.id;
  const receipt = await call("post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu",
    lines: [{ variantId: creamVariant, unitId: units.CAI, quantity: "20", unitCost: "100000" }],
  });
  expect((await call("post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const channelId = (await call("post", "/catalog/sales-channels", { code: "VCOMM", name: "Ứng dụng VComm" })).body.id;
  const priceListId = (await call("post", "/catalog/price-lists", { code: "VCOMM", name: "VCOMM", includesVat: true, channelId })).body.id;
  const draft = await call("post", "/catalog/price-changes", { priceListId, effectiveFrom: today, lines: [{ variantId: creamVariant, unitId: units.CAI, price: "250000" }] });
  expect((await call("post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  const settings = { channelId, warehouseId, shippingFee: "30000", freeShippingThreshold: "500000", packageLengthCm: 20, packageWidthCm: 15, packageHeightCm: 10, minimumWeightGrams: 200, version: 0 };
  expect((await call("put", "/marketplace/store-settings", settings)).status).toBe(200);
  expect((await call("put", `/marketplace/listings/${product.body.id}`, { isPublished: true, description: null })).status).toBe(204);
  // Người mua thử có địa chỉ Hà Nội.
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone: "0933100001" })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), "+84933100001"]);
  const buyerId = (await http().post("/api/v1/buyer/register").send({ phone: "0933100001", code: "246810", fullName: "Người Mua GHTK", password })).body.user.id;
  expect((await call("put", `/marketplace/buyers/${buyerId}/test-buyer`, { isTestBuyer: true })).status).toBe(200);
  const buyer = await buyerSession();
  const hanoi = (await buyer("get", "/buyer/regions/provinces")).body.find((item: { name: string }) => item.name === "Thành phố Hà Nội");
  const ward = (await buyer("get", `/buyer/regions/provinces/${hanoi.code}/wards`)).body.find((item: { name: string }) => item.name === "Phường Ba Đình");
  const saved = await buyer("post", "/buyer/addresses", {
    recipientName: "Người Nhận GHTK",
    phone: "0911222555",
    provinceCode: hanoi.code,
    wardCode: ward.code,
    streetAddress: "12 Phố Điện Biên Phủ",
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(201);
});

afterAll(async () => {
  ghtk?.close();
  await application?.close();
  await pool?.end();
});

async function buyerSession() {
  const login = await http().post("/api/v1/buyer/login").set("accept-language", "vi").send({ phone: "0933100001", password });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const token = login.body.tokens.accessToken as string;
  return (method: "get" | "post" | "put", path: string, body?: object) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
}

// Đặt một đơn một kem 250.000 + phí 30.000 của người mua thử.
async function placeOrder(quantity = 1) {
  const buyer = await buyerSession();
  const addressId = (await buyer("get", "/buyer/addresses")).body[0].id;
  const lines = [{ variantId: creamVariant, quantity }];
  const total = (await buyer("post", "/buyer/orders/preview", { addressId, lines })).body.total;
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: total });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; version: number; documentNo: string };
}
const ship = (order: { id: string; version: number }) => call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghtk", version: order.version });
const orderOf = async (id: string) => (await call("get", `/marketplace/orders/${id}`)).body;
const stock = async () => Number((await pool.query("SELECT quantity::text FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [warehouseId, creamVariant])).rows[0]?.quantity ?? 0);

describe("CONG_VIEC_31 lớp kết nối GHTK", () => {
  it("KICHBAN_KIEMTHU_352: cấu hình từ biến môi trường; tạo vận đơn đúng thông tin; từ chối, sai token; chi tiết có tiền thu hộ; tìm theo số đơn; hủy; ánh xạ trạng thái; mã vận đơn từ webhook", async () => {
    // Thiếu biến hoặc khóa webhook ngắn: chưa cấu hình. Mã chưa có lớp kết nối: chưa cấu hình.
    process.env.GHTK_PICK_WARD = "";
    expect(ghtkConfiguration()).toBeNull();
    process.env.GHTK_PICK_WARD = environment.GHTK_PICK_WARD;
    process.env.GHTK_WEBHOOK_KEY = "ngan-qua";
    expect(carrierConfigured("ghtk")).toBe(false);
    expect(webhookKeyOf("ghtk")).toBeNull();
    process.env.GHTK_WEBHOOK_KEY = webhookKey;
    expect(carrierConfigured("ghtk")).toBe(true);
    for (const code of ["vnpost", "viettel_post", "jt"] as const) {
      expect(carrierAdapter(code)).toBeNull();
      expect(webhookKeyOf(code)).toBeNull();
    }
    // Không đặt GHTK_BASE_URL: môi trường thử nghiệm của GHTK.
    process.env.GHTK_BASE_URL = "";
    expect(ghtkConfiguration()?.baseUrl).toBe("https://services-staging.ghtklab.com");
    process.env.GHTK_BASE_URL = ghtkBaseUrl;
    expect(ghtkConfiguration()).toMatchObject({ baseUrl: ghtkBaseUrl, pickAddressId: "88001" });

    const adapter = carrierAdapter("ghtk") as GhtkCarrier;
    const request = {
      clientOrderCode: "DB-KIEMTHU-0001",
      recipientName: "Người Nhận",
      recipientPhone: "0911222333",
      streetAddress: "1 Tràng Tiền",
      wardName: "Phường Hoàn Kiếm",
      provinceName: "Thành phố Hà Nội",
      codAmount: 530000,
      weightGrams: 1000,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
      items: [{ name: "Kem", code: "KEM-01", quantity: 2, price: 250000, weightGrams: 500 }],
    };
    ghtkReject = true;
    await expect(adapter.createShipment(request)).rejects.toMatchObject({ kind: "rejected", message: "Địa chỉ người nhận không hợp lệ" });
    ghtkReject = false;
    const created = await adapter.createShipment(request);
    expect(created).toEqual({ trackingCode: "S1.A1.2001297581", fee: "30400", status: "2" });
    const sent = ghtkRequests.filter((item) => item.path === "/services/shipment/order").at(-1)!;
    expect(sent.headers).toMatchObject({ token: "token-ghtk-kiem-thu", "x-client-source": "S1234567" });
    expect(sent.body).toEqual({
      products: [{ name: "Kem", weight: 0.5, quantity: 2, price: 250000 }],
      order: {
        id: "DB-KIEMTHU-0001",
        pick_address_id: "88001",
        pick_name: "Kho VComm",
        pick_tel: "0911000111",
        pick_address: "5 Đường Số 1",
        pick_province: "Thành phố Hồ Chí Minh",
        pick_ward: "Phường Sài Gòn",
        name: "Người Nhận",
        tel: "0911222333",
        address: "1 Tràng Tiền, Phường Hoàn Kiếm, Thành phố Hà Nội",
        province: "Thành phố Hà Nội",
        ward: "Phường Hoàn Kiếm",
        hamlet: "Khác",
        is_freeship: 1,
        pick_money: 530000,
        value: 500000,
        total_weight: 1,
      },
    });
    // Không gửi quận, huyện (địa chỉ hai cấp).
    expect(sent.body.order).not.toHaveProperty("district");
    // Tạo trùng số đơn: GHTK từ chối.
    await expect(adapter.createShipment(request)).rejects.toBeInstanceOf(CarrierFailure);

    // Chi tiết: tiền thu hộ; chỉ ghi đã thu khi GHTK báo đã giao (5) hoặc đã đối soát (6).
    expect(await adapter.shipmentDetail(created.trackingCode)).toEqual({ trackingCode: created.trackingCode, status: "2", fee: "30400", codAmount: "530000", collectedCodAmount: null });
    ghtkStatus.set(created.trackingCode, "5");
    expect(await adapter.shipmentDetail(created.trackingCode)).toMatchObject({ status: "5", collectedCodAmount: "530000" });
    expect(await adapter.shipmentStatus(created.trackingCode)).toBe("5");
    // Tìm theo số đơn của bên gửi.
    expect(await adapter.findShipment("DB-KIEMTHU-0001")).toEqual({ trackingCode: created.trackingCode, fee: "30400", status: "5" });
    expect(await adapter.findShipment("DB-KHONG-CO")).toBeNull();
    // Đã giao: không hủy được. Đang chờ lấy: hủy được.
    await expect(adapter.cancelShipment(created.trackingCode)).rejects.toMatchObject({ kind: "rejected" });
    ghtkStatus.set(created.trackingCode, "12");
    await adapter.cancelShipment(created.trackingCode);
    expect(ghtkStatus.get(created.trackingCode)).toBe("-1");
    expect(ghtkRequests.at(-1)).toMatchObject({ method: "POST", path: `/services/shipment/cancel/${created.trackingCode}` });

    // Sai token: GHTK trả 403 không nội dung, coi như không dùng được (không phải từ chối nghiệp vụ).
    const wrongToken = new GhtkCarrier({ ...ghtkConfiguration()!, token: "token-sai" });
    await expect(wrongToken.shipmentStatus(created.trackingCode)).rejects.toMatchObject({ kind: "unavailable" });
    await expect(wrongToken.findShipment("DB-KIEMTHU-0001")).rejects.toMatchObject({ kind: "unavailable" });
    // Máy chủ không chạy: không dùng được.
    const offline = new GhtkCarrier({ ...ghtkConfiguration()!, baseUrl: "http://127.0.0.1:1" });
    await expect(offline.createShipment(request)).rejects.toMatchObject({ kind: "unavailable" });

    // Ánh xạ trạng thái (QUYTAC_NGHIEPVU_195).
    const phases = Object.fromEntries(
      ["1", "2", "12", "8", "123", "128", "3", "4", "10", "9", "20", "45", "49", "410", "5", "6", "11", "21", "-1", "7", "13", "127", "999"].map((status) => [status, adapter.phaseOf(status)]),
    );
    expect(phases).toEqual({
      "1": "waiting_pickup",
      "2": "waiting_pickup",
      "12": "waiting_pickup",
      "8": "waiting_pickup",
      "123": "waiting_pickup",
      "128": "waiting_pickup",
      "3": "picked",
      "4": "picked",
      "10": "picked",
      "9": "picked",
      "20": "picked",
      "45": "picked",
      "49": "picked",
      "410": "picked",
      "5": "delivered",
      "6": "delivered",
      "11": "returned",
      "21": "returned",
      "-1": "cancelled",
      "7": "attention",
      "13": "attention",
      "127": "attention",
      "999": "attention",
    });
    expect(adapter.trackingCodeOf({ label_id: "S1.A1.17373471", status_id: "5" })).toBe("S1.A1.17373471");
    expect(adapter.trackingCodeOf({ label_id: "'; DROP TABLE x" })).toBeNull();
    expect(adapter.trackingCodeOf(null)).toBeNull();
  });
});

describe("CONG_VIEC_31 giao đơn VComm qua GHTK", () => {
  it("KICHBAN_KIEMTHU_353: cài đặt hiện GHTK đã cấu hình; giao tạo vận đơn; webhook dạng form sai khóa bị từ chối, trạng thái tra lại từ GHTK; lấy hàng ghi sổ phiếu xuất; giao thành công; nhận trùng không đổi kết quả", async () => {
    const settings = (await call("get", "/marketplace/store-settings")).body;
    expect(settings.carriers).toEqual([
      { code: "ghn", name: "Giao Hàng Nhanh (GHN)", isEnabled: false, isConfigured: false },
      { code: "ghtk", name: "Giao Hàng Tiết Kiệm (GHTK)", isEnabled: false, isConfigured: true },
    ]);
    const order = await placeOrder();
    // Chưa bật GHTK: không giao được.
    expect((await ship(order)).body.error).toBeTruthy();
    expect((await call("put", "/marketplace/carriers/ghtk", { isEnabled: true })).body.carriers.find((item: { code: string }) => item.code === "ghtk").isEnabled).toBe(true);
    const before = await stock();
    const shipped = await ship(order);
    expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
    const trackingCode = shipped.body.trackingCode as string;
    expect(shipped.body).toMatchObject({ status: "awaiting_pickup", carrierName: "Giao Hàng Tiết Kiệm (GHTK)", canCancel: true });
    expect(shipped.body.shipments[0]).toMatchObject({ trackingCode, carrierStatus: "2", fee: "30400", isActive: true });
    const sent = ghtkRequests.filter((item) => item.path === "/services/shipment/order").at(-1)!.body;
    expect(sent.order).toMatchObject({
      id: order.documentNo,
      name: "Người Nhận GHTK",
      tel: "0911222555",
      province: "Thành phố Hà Nội",
      ward: "Phường Ba Đình",
      pick_money: 280000,
      value: 250000,
      total_weight: 0.5,
    });

    // Sai khóa: từ chối.
    expect((await webhook("khoa-sai-00000000000000000000000000", { label_id: trackingCode, status_id: "5" })).status).toBe(403);
    // Nội dung nói đã giao nhưng tra lại GHTK vẫn "2": không đổi.
    expect((await webhook(webhookKey, { label_id: trackingCode, partner_id: order.documentNo, status_id: "5" })).body).toEqual({ result: "applied" });
    expect((await orderOf(order.id)).status).toBe("awaiting_pickup");
    // Người lấy hàng báo đã lấy (123): chưa ghi sổ phiếu xuất.
    ghtkStatus.set(trackingCode, "123");
    await webhook(webhookKey, { label_id: trackingCode, status_id: "123" });
    expect((await orderOf(order.id)).status).toBe("awaiting_pickup");
    expect(await stock()).toBe(before);
    // Đã lấy hàng (3): ghi sổ phiếu xuất, nhận trùng không trừ tồn lần nữa.
    ghtkStatus.set(trackingCode, "3");
    await webhook(webhookKey, { label_id: trackingCode, status_id: "3" });
    await webhook(webhookKey, { label_id: trackingCode, status_id: "3" });
    expect(await stock()).toBe(before - 1);
    expect(await orderOf(order.id)).toMatchObject({ status: "shipping", canCancel: false });
    // Người giao báo đã giao (45): chưa chuyển Đã giao.
    ghtkStatus.set(trackingCode, "45");
    await webhook(webhookKey, { label_id: trackingCode, status_id: "45" });
    expect((await orderOf(order.id)).status).toBe("shipping");
    // Bồi hoàn (13): hiện cho nhân viên, đơn giữ trạng thái.
    ghtkStatus.set(trackingCode, "13");
    await webhook(webhookKey, { label_id: trackingCode, status_id: "13" });
    const attention = await orderOf(order.id);
    expect(attention.status).toBe("shipping");
    expect(attention.events.at(-1)).toMatchObject({ status: "shipping", note: "GHTK: 13" });
    ghtkStatus.set(trackingCode, "5");
    await webhook(webhookKey, { label_id: trackingCode, status_id: "5" });
    await webhook(webhookKey, { label_id: trackingCode, status_id: "5" });
    const delivered = await orderOf(order.id);
    expect(delivered.status).toBe("delivered");
    expect(delivered.events.map((event: { status: string }) => event.status)).toEqual(["awaiting_shipment", "awaiting_pickup", "shipping", "shipping", "delivered"]);
    // Đã đối soát (6): vẫn Đã giao.
    ghtkStatus.set(trackingCode, "6");
    await webhook(webhookKey, { label_id: trackingCode, status_id: "6" });
    expect((await orderOf(order.id)).status).toBe("delivered");
    // Mã vận đơn không có hoặc thiếu: bỏ qua, có ghi nhận.
    expect((await webhook(webhookKey, { label_id: "S1.A1.KHONGCO" })).body).toEqual({ result: "ignored" });
    expect((await webhook(webhookKey, {})).body).toEqual({ result: "ignored" });
    const events = (await pool.query("SELECT result FROM marketplace.carrier_webhook_events WHERE carrier_code = 'ghtk' ORDER BY received_at")).rows.map((row) => row.result);
    expect(events.filter((result) => result === "unknown_shipment")).toHaveLength(2);
  });

  it("KICHBAN_KIEMTHU_354: hủy đơn chờ lấy hàng hủy vận đơn GHTK; GHTK hủy thì đơn hủy; hoàn hàng nhập lại kho, đơn hủy; GHTK không trả lời sau khi tạo thì tra lại theo số đơn rồi ghi nhận", async () => {
    // Nhân viên hủy đơn chờ lấy hàng: hủy vận đơn trên GHTK, xóa phiếu xuất nháp.
    const first = await placeOrder();
    const firstShipped = (await ship(first)).body;
    const cancelled = await call("post", `/marketplace/orders/${first.id}/cancel`, { reason: "Khách gọi hủy", version: firstShipped.version });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");
    expect(ghtkStatus.get(firstShipped.trackingCode)).toBe("-1");

    // GHTK hủy vận đơn (-1) trước khi lấy hàng: đơn hủy.
    const second = await placeOrder();
    const secondShipped = (await ship(second)).body;
    ghtkStatus.set(secondShipped.trackingCode, "-1");
    await webhook(webhookKey, { label_id: secondShipped.trackingCode, status_id: "-1" });
    expect(await orderOf(second.id)).toMatchObject({ status: "cancelled", cancelReason: "Đơn vị vận chuyển hủy vận đơn" });

    // Đã lấy hàng, giao không được (9), đang trả (20), đã trả (21): nhập lại kho, đơn hủy.
    const third = await placeOrder(2);
    const before = await stock();
    const thirdShipped = (await ship(third)).body;
    for (const status of ["3", "9", "20"]) {
      ghtkStatus.set(thirdShipped.trackingCode, status);
      await webhook(webhookKey, { label_id: thirdShipped.trackingCode, status_id: status });
    }
    expect(await stock()).toBe(before - 2);
    expect((await orderOf(third.id)).status).toBe("shipping");
    ghtkStatus.set(thirdShipped.trackingCode, "21");
    await webhook(webhookKey, { label_id: thirdShipped.trackingCode, status_id: "21" });
    await webhook(webhookKey, { label_id: thirdShipped.trackingCode, status_id: "21" });
    expect(await orderOf(third.id)).toMatchObject({ status: "cancelled", cancelReason: "Giao không thành công, hàng đã hoàn về kho" });
    expect(await stock()).toBe(before);

    // GHTK tạo xong nhưng mất phản hồi: giữ chỗ vận đơn; tra lại tìm theo số đơn rồi ghi nhận.
    const fourth = await placeOrder();
    ghtkLoseResponse = true;
    const lost = await ship(fourth);
    ghtkLoseResponse = false;
    expect(lost.body.error.message).toBeTruthy();
    expect((await orderOf(fourth.id)).status).toBe("awaiting_shipment");
    const refreshed = await call("post", `/marketplace/orders/${fourth.id}/refresh-shipment`);
    expect(refreshed.status, JSON.stringify(refreshed.body)).toBe(200);
    expect(refreshed.body).toMatchObject({ status: "awaiting_pickup", trackingCode: ghtkByPartner.get(fourth.documentNo) });
  });
});
