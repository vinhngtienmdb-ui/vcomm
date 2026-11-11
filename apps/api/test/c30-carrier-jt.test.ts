// CONG_VIEC_30: kết nối J&T Express (KICHBAN_KIEMTHU_348 đến 351). Máy chủ J&T giả lập theo tài liệu J&T Open Platform; không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let warehouseId: string;
let variantId = "";
const retail: string = testIds.retailCompany;
const password = "MatKhauNguoiMua@2026";
const webhookKey = "khoa-webhook-jt-kiem-thu-0123456789";
const privateKey = "khoa-rieng-jt-kiem-thu";
// Mật khẩu nghiệp vụ J&T chờ nhận: MD5(mật khẩu gốc + jadada369t3) viết hoa.
const businessPassword = createHash("md5").update("MatKhauJT@1jadada369t3").digest("hex").toUpperCase();

// Máy chủ J&T giả lập: kiểm chữ ký, ghi lại yêu cầu, trả hành trình do kiểm thử đặt.
let jt: Server;
type JtRequest = { path: string; headers: Record<string, unknown>; business: Record<string, unknown> };
const jtRequests: JtRequest[] = [];
const scans = new Map<string, { scanTime: string; scanTypeCode: number; scanTypeName: string }[]>();
const byOrderCode = new Map<string, string>();
let createMode: "normal" | "reject" | "loseAfterCreate" | "loseBeforeCreate" = "normal";
let traceByOrderFails = false;
let billCounter = 0;
let clockSeconds = 0;
// Thêm một lần quét; J&T liệt kê mới nhất trước.
function scan(billCode: string, code: number) {
  clockSeconds += 1;
  const time = new Date(Date.UTC(2026, 10, 11, 1, 0, clockSeconds)).toISOString().slice(0, 19).replace("T", " ");
  scans.set(billCode, [{ scanTime: time, scanTypeCode: code, scanTypeName: `Mã ${code}` }, ...(scans.get(billCode) ?? [])]);
}

const http = () => request(application.getHttpServer());
const call = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => admin.call(method, path, { companyId: retail, ...(body ? { body } : {}) });
const lastRequest = (api: string) => jtRequests.filter((item) => item.path.endsWith(api)).at(-1)!;
// J&T đẩy hành trình dạng form bizContent=<JSON>.
const webhook = (key: string, content: object) =>
  http()
    .post(`/api/v1/public/carriers/jt/webhook/${key}`)
    .type("form")
    .send({ bizContent: JSON.stringify(content) });
const stockOf = async () => Number((await pool.query("SELECT quantity::text FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [warehouseId, variantId])).rows[0]?.quantity ?? 0);

let buyerToken = "";
let addressId = "";
async function placeOrder() {
  const buyer = (method: "post", path: string, body: object) => http()[method](`/api/v1${path}`).set("authorization", `Bearer ${buyerToken}`).set("accept-language", "vi").send(body);
  const lines = [{ variantId, quantity: 1 }];
  const total = (await buyer("post", "/buyer/orders/preview", { addressId, lines })).body.total;
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: total });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; version: number; documentNo: string };
}
const ship = (order: { id: string; version: number }) => call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "jt", version: order.version });
const detail = async (orderId: string) => (await call("get", `/marketplace/orders/${orderId}`)).body;

beforeAll(async () => {
  jt = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const reply = (payload: unknown, status = 200) => {
        response.statusCode = status;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(payload));
      };
      const bizContent = new URLSearchParams(raw).get("bizContent") ?? "";
      const business = bizContent ? (JSON.parse(bizContent) as Record<string, unknown>) : {};
      jtRequests.push({ path: incoming.url ?? "", headers: incoming.headers, business });
      const digest = createHash("md5")
        .update(bizContent + privateKey)
        .digest("base64");
      if (incoming.headers.apiaccount !== "178337126125932605" || incoming.headers.digest !== digest || !/^\d{13}$/.test(String(incoming.headers.timestamp))) {
        return reply({ code: "145003030", msg: "headers签名失败" });
      }
      if (business.customerCode !== "084LC00001" || business.password !== businessPassword) return reply({ code: "145003031", msg: "业务参数签名失败" });
      const path = incoming.url ?? "";
      if (path === "/webopenplatformapi/api/order/addOrder") {
        if (createMode === "reject") return reply({ code: "145003060", msg: "Khu vực không hợp lệ" });
        if (createMode === "loseBeforeCreate") return reply({ code: "500", msg: "Bận" }, 503);
        billCounter += 1;
        const billCode = `84000000000${billCounter}`;
        byOrderCode.set(business.txlogisticId as string, billCode);
        scans.set(billCode, []);
        if (createMode === "loseAfterCreate") return reply({ code: "500", msg: "Bận" }, 503);
        return reply({ code: "1", msg: "success", data: { txlogisticId: business.txlogisticId, billCode, sortLine: "800-028A04-", inquiryFee: 25000, codFee: 3000, insuranceFee: 0 } });
      }
      if (path === "/webopenplatformapi/api/order/cancelOrder") {
        const billCode = business.billCode as string;
        if (byOrderCode.get(business.txlogisticId as string) !== billCode) return reply({ code: "145003064", msg: "Không có dữ liệu" });
        if ((scans.get(billCode) ?? []).length > 0) return reply({ code: "145003201", msg: "Đã lấy hàng, không hủy được" });
        scan(billCode, 105);
        return reply({ code: "1", msg: "success", data: { txlogisticId: business.txlogisticId, billCode } });
      }
      if (path === "/webopenplatformapi/api/logistics/trace") {
        if (business.billCodes) {
          const billCode = business.billCodes as string;
          return scans.has(billCode) ? reply({ code: "1", msg: "success", data: [{ billCode, details: scans.get(billCode) }] }) : reply({ code: "145003100", msg: "运单号非法" });
        }
        if (traceByOrderFails) return reply({ code: "145003100", msg: "运单号非法" });
        const billCode = byOrderCode.get(business.txlogisticId as string);
        return reply({ code: "1", msg: "success", data: billCode ? [{ billCode, details: scans.get(billCode) }] : [] });
      }
      reply({ code: "404", msg: "Không có" }, 404);
    });
  });
  await new Promise<void>((resolve) => jt.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, {
    JT_API_ACCOUNT: "178337126125932605",
    JT_PRIVATE_KEY: privateKey,
    JT_CUSTOMER_CODE: "084LC00001",
    JT_CUSTOMER_PASSWORD: "MatKhauJT@1",
    JT_WEBHOOK_KEY: webhookKey,
    JT_BASE_URL: `http://127.0.0.1:${(jt.address() as AddressInfo).port}`,
    JT_SENDER_NAME: "Kho VComm",
    JT_SENDER_PHONE: "0909000111",
    JT_SENDER_PROVINCE: "Thành phố Hồ Chí Minh",
    JT_SENDER_WARD: "Phường Sài Gòn",
    JT_SENDER_ADDRESS: "1 Lê Duẩn",
  });
  delete process.env.GHN_API_TOKEN;
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  const unitId = (await pool.query("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0].id as string;
  const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "HANGJT", nameVi: "HANGJT", nameEn: "HANGJT" } })).body.id;
  const product = await call("post", "/catalog/products", {
    categoryId,
    name: "Kem dưỡng da VComm",
    vatRate: "10",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: unitId,
    weightKg: "0.5",
    variants: [{ barcodes: [] }],
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  variantId = product.body.variants[0].id;
  warehouseId = (await call("post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "VCOMMJT", name: "Kho VComm", usesLocations: false })).body.id;
  const receipt = await call("post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu",
    lines: [{ variantId, unitId, quantity: "20", unitCost: "100000" }],
  });
  expect((await call("post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const channelId = (await call("post", "/catalog/sales-channels", { code: "VCOMM", name: "Ứng dụng VComm" })).body.id;
  const priceListId = (await call("post", "/catalog/price-lists", { code: "VCOMM", name: "VCOMM", includesVat: true, channelId })).body.id;
  const draft = await call("post", "/catalog/price-changes", { priceListId, effectiveFrom: today, lines: [{ variantId, unitId, price: "250000" }] });
  expect((await call("post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  const settings = { channelId, warehouseId, shippingFee: "30000", freeShippingThreshold: null, packageLengthCm: 20, packageWidthCm: 15, packageHeightCm: 10, minimumWeightGrams: 200, version: 0 };
  expect((await call("put", "/marketplace/store-settings", settings)).status).toBe(200);
  expect((await call("put", `/marketplace/listings/${product.body.id}`, { isPublished: true, description: null })).status).toBe(204);

  // Người mua thử, một địa chỉ ở Hà Nội.
  const phone = "0933000301";
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
  const registered = await http().post("/api/v1/buyer/register").send({ phone, code: "246810", fullName: "Người Mua J&T", password });
  expect(registered.status, JSON.stringify(registered.body)).toBe(200);
  expect((await call("put", `/marketplace/buyers/${registered.body.user.id}/test-buyer`, { isTestBuyer: true })).status).toBe(200);
  buyerToken = (await http().post("/api/v1/buyer/login").send({ phone, password })).body.tokens.accessToken;
  const authorized = (method: "get" | "post", path: string) => http()[method](`/api/v1${path}`).set("authorization", `Bearer ${buyerToken}`);
  const hanoi = (await authorized("get", "/buyer/regions/provinces")).body.find((item: { name: string }) => item.name === "Thành phố Hà Nội");
  const ward = (await authorized("get", `/buyer/regions/provinces/${hanoi.code}/wards`)).body.find((item: { name: string }) => item.name === "Phường Ba Đình");
  const saved = await authorized("post", "/buyer/addresses").send({
    recipientName: "Nguyễn Văn Nhận",
    phone: "0911222333",
    provinceCode: hanoi.code,
    wardCode: ward.code,
    streetAddress: "12 Phố Điện Biên Phủ",
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(201);
  addressId = saved.body[0].id;
});

afterAll(async () => {
  jt?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_30 kết nối J&T Express", () => {
  it("KICHBAN_KIEMTHU_348: J&T có trong danh sách khi đủ biến môi trường; tạo vận đơn ký đúng, địa chỉ hai cấp, tiền thu hộ, điểm lấy hàng; J&T từ chối thì đơn giữ Chờ giao", async () => {
    const settings = (await call("get", "/marketplace/store-settings")).body;
    expect(settings.carriers).toContainEqual({ code: "jt", name: "J&T Express", isEnabled: false, isConfigured: true });
    // Mã chưa có lớp kết nối: chưa cấu hình, không lỗi.
    expect(settings.carriers.find((item: { code: string }) => item.code === "ghn")).toMatchObject({ isConfigured: false });
    const order = await placeOrder();
    // Chưa bật J&T: không giao được.
    expect((await ship(order)).status).toBe(409);
    expect((await call("put", "/marketplace/carriers/jt", { isEnabled: true })).status).toBe(200);
    // Thiếu một biến môi trường: chưa cấu hình.
    delete process.env.JT_SENDER_WARD;
    expect((await call("get", "/marketplace/store-settings")).body.carriers.find((item: { code: string }) => item.code === "jt").isConfigured).toBe(false);
    expect((await ship(order)).status).toBe(409);
    process.env.JT_SENDER_WARD = "Phường Sài Gòn";

    createMode = "reject";
    const rejected = await ship(order);
    createMode = "normal";
    expect(rejected.status).toBe(409);
    const kept = await detail(order.id);
    expect(kept).toMatchObject({ status: "awaiting_shipment", canShip: true, shipments: [] });

    const shipped = await ship({ id: order.id, version: kept.version });
    expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
    expect(shipped.body).toMatchObject({ status: "awaiting_pickup", carrierName: "J&T Express", trackingCode: byOrderCode.get(order.documentNo) });
    // Phí = cước + phí thu hộ; trạng thái ban đầu "Đã đặt" (103).
    expect(shipped.body.shipments[0]).toMatchObject({ carrierStatus: "103", fee: "28000", isActive: true });
    const sent = lastRequest("/order/addOrder").business;
    expect(sent).toMatchObject({
      txlogisticId: order.documentNo,
      selfAddress: 1,
      serviceType: 1,
      deliveryType: 1,
      payType: "PP_PM",
      isInsured: 0,
      goodsValue: 250000,
      // Tiền thu hộ = tiền hàng 250.000 + phí giao hàng 30.000.
      codMoney: "280000",
      sender: { name: "Kho VComm", mobile: "0909000111", prov: "Thành phố Hồ Chí Minh", area: "Phường Sài Gòn", address: "1 Lê Duẩn" },
      receiver: { name: "Nguyễn Văn Nhận", mobile: "0911222333", prov: "Thành phố Hà Nội", area: "Phường Ba Đình", address: "12 Phố Điện Biên Phủ" },
      packageInfo: { weight: "0.50", length: 20, width: 15, height: 10 },
      items: [{ itemName: "Kem dưỡng da VComm", number: "1", itemValue: "250000" }],
    });
    // Địa chỉ hai cấp: không gửi cấp huyện.
    expect(sent.receiver).not.toHaveProperty("city");
    expect(String(lastRequest("/order/addOrder").headers["content-type"])).toContain("application/x-www-form-urlencoded");
  });

  it("KICHBAN_KIEMTHU_349: webhook sai khóa bị từ chối; trạng thái theo tra lại hành trình, không theo nội dung; lấy hàng ghi sổ phiếu xuất; giao thành công; nhận trùng không đổi; trả lời code 1", async () => {
    const order = await placeOrder();
    const shipped = (await ship(order)).body;
    const billCode = shipped.trackingCode as string;
    const before = await stockOf();
    expect((await webhook("khoa-sai-000000000000000000000000", { billCode, details: [{ scanTypeCode: 100 }] })).status).toBe(403);
    // Nội dung nói đã giao nhưng tra lại J&T chưa có lần quét nào: không đổi.
    const ignoredContent = await webhook(webhookKey, { billCode, txlogisticId: order.documentNo, details: [{ scanTypeCode: 100 }] });
    expect(ignoredContent.status).toBe(200);
    expect(ignoredContent.body).toEqual({ code: "1", msg: "success", data: "applied" });
    expect((await detail(order.id)).status).toBe("awaiting_pickup");
    expect(lastRequest("/logistics/trace").business).toMatchObject({ billCodes: billCode });

    scan(billCode, 106);
    await webhook(webhookKey, { billCode });
    await webhook(webhookKey, { billCode });
    const shipping = await detail(order.id);
    expect(shipping).toMatchObject({ status: "shipping", canCancel: false });
    expect(shipping.shipments[0].carrierStatus).toBe("106");
    expect(shipping.events.filter((event: { status: string }) => event.status === "shipping")).toHaveLength(1);
    expect(await stockOf()).toBe(before - 1);

    // Đã ký nhận rồi "Hoàn tất" (121): bỏ qua 121, đơn Đã giao.
    scan(billCode, 112);
    scan(billCode, 100);
    scan(billCode, 121);
    await webhook(webhookKey, { billCode });
    await webhook(webhookKey, { billCode });
    const delivered = await detail(order.id);
    expect(delivered).toMatchObject({ status: "delivered" });
    expect(delivered.events.filter((event: { status: string }) => event.status === "delivered")).toHaveLength(1);
    expect(delivered.events.at(-1).note).toBe("JT: 100");
    // Vận đơn không có trong hệ thống: bỏ qua, vẫn trả code 1 để J&T không gửi lại.
    expect((await webhook(webhookKey, { billCode: "999999999999" })).body).toEqual({ code: "1", msg: "success", data: "ignored" });
  });

  it("KICHBAN_KIEMTHU_350: hủy đơn chờ lấy hàng gửi số đơn và vận đơn; J&T hủy thì đơn hủy; vấn đề, mã lạ chỉ ghi lịch sử; hoàn hàng thì nhập lại kho, đơn hủy", async () => {
    const first = await placeOrder();
    const firstShipped = (await ship(first)).body;
    const cancelled = await call("post", `/marketplace/orders/${first.id}/cancel`, { reason: "Khách đổi ý", version: firstShipped.version });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");
    expect(lastRequest("/order/cancelOrder").business).toMatchObject({ txlogisticId: first.documentNo, billCode: firstShipped.trackingCode });

    // J&T hủy vận đơn trước khi lấy hàng.
    const second = await placeOrder();
    const secondShipped = (await ship(second)).body;
    scan(secondShipped.trackingCode, 105);
    await webhook(webhookKey, { billCode: secondShipped.trackingCode });
    expect(await detail(second.id)).toMatchObject({ status: "cancelled", cancelReason: "Đơn vị vận chuyển hủy vận đơn" });

    // Mã lạ khi chờ lấy hàng: không ghi sổ phiếu xuất, ghi lịch sử cho nhân viên.
    const third = await placeOrder();
    const thirdShipped = (await ship(third)).body;
    const billCode = thirdShipped.trackingCode as string;
    const before = await stockOf();
    scan(billCode, 999);
    await webhook(webhookKey, { billCode });
    const unknown = await detail(third.id);
    expect(unknown.status).toBe("awaiting_pickup");
    expect(unknown.events.at(-1)).toMatchObject({ status: "awaiting_pickup", note: "JT: 999" });
    expect(await stockOf()).toBe(before);

    scan(billCode, 10);
    await webhook(webhookKey, { billCode });
    expect((await detail(third.id)).status).toBe("shipping");
    // Đã lấy hàng: J&T không cho hủy, nhân viên không hủy được.
    const shipping = await detail(third.id);
    expect((await call("post", `/marketplace/orders/${third.id}/cancel`, { reason: "Thử", version: shipping.version })).status).not.toBe(200);
    scan(billCode, 118);
    await webhook(webhookKey, { billCode });
    expect((await detail(third.id)).events.at(-1)).toMatchObject({ status: "shipping", note: "JT: 118" });
    expect(await stockOf()).toBe(before - 1);
    scan(billCode, 116);
    scan(billCode, 173);
    await webhook(webhookKey, { billCode });
    await webhook(webhookKey, { billCode });
    expect(await detail(third.id)).toMatchObject({ status: "cancelled", cancelReason: "Giao không thành công, hàng đã hoàn về kho" });
    expect(await stockOf()).toBe(before);
  });

  it("KICHBAN_KIEMTHU_351: J&T không trả lời khi tạo: giữ chỗ; tra lại theo số đơn tìm được thì ghi nhận, không có thì bỏ chỗ giữ, J&T lỗi thì giữ chỗ", async () => {
    const order = await placeOrder();
    createMode = "loseAfterCreate";
    expect((await ship(order)).status).toBe(409);
    createMode = "normal";
    expect((await detail(order.id)).shipments[0]).toMatchObject({ trackingCode: null, carrierStatus: "requesting" });
    // J&T lỗi khi tra theo số đơn: giữ chỗ, không giao lại được.
    traceByOrderFails = true;
    expect((await call("post", `/marketplace/orders/${order.id}/refresh-shipment`)).status).toBe(409);
    traceByOrderFails = false;
    expect((await detail(order.id)).shipments[0]).toMatchObject({ trackingCode: null, carrierStatus: "requesting" });
    const found = (await call("post", `/marketplace/orders/${order.id}/refresh-shipment`)).body;
    expect(found).toMatchObject({ status: "awaiting_pickup", trackingCode: byOrderCode.get(order.documentNo) });
    expect(lastRequest("/logistics/trace").business).toMatchObject({ txlogisticId: order.documentNo });
    expect(jtRequests.filter((item) => item.path.endsWith("/order/addOrder") && item.business.txlogisticId === order.documentNo)).toHaveLength(1);

    const second = await placeOrder();
    createMode = "loseBeforeCreate";
    expect((await ship(second)).status).toBe(409);
    createMode = "normal";
    const released = (await call("post", `/marketplace/orders/${second.id}/refresh-shipment`)).body;
    expect(released).toMatchObject({ status: "awaiting_shipment", canShip: true, shipments: [] });
    expect((await ship({ id: second.id, version: released.version })).body.status).toBe("awaiting_pickup");
  });
});
