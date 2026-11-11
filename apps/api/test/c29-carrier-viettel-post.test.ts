// CONG_VIEC_29: kết nối Viettel Post vào khung đơn vị vận chuyển (KICHBAN_KIEMTHU_344 đến 347). Máy chủ Viettel Post giả lập theo tài liệu công khai.
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
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let warehouseId: string;
let creamVariantId = "";
let creamProductId = "";
// Máy chủ Viettel Post giả lập: ghi lại yêu cầu; trạng thái đơn do kiểm thử đặt qua webhook.
let viettelPost: Server;
const viettelPostRequests: { path: string; headers: Record<string, unknown>; body: Record<string, unknown> }[] = [];
const viettelPostStatus = new Map<string, number>();
const viettelPostByReference = new Map<string, string>();
let viettelPostCounter = 0;
let viettelPostReject = false;
// Giả lập Viettel Post tạo xong nhưng trả lỗi máy chủ (mất phản hồi).
let viettelPostLoseResponse = false;
const token = "token-viettel-post-kiem-thu";
const webhookKey = "khoa-webhook-viettel-post-0123456789";
const retail: string = testIds.retailCompany;
const password = "MatKhauNguoiMua@2026";
const buyerPhone = "0933000291";
const http = () => request(application.getHttpServer());
const call = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => admin.call(method, path, { companyId: retail, ...(body ? { body } : {}) });
const configuration = {
  VIETTEL_POST_TOKEN: token,
  VIETTEL_POST_SERVICE_CODE: "VCN",
  VIETTEL_POST_WEBHOOK_KEY: webhookKey,
  VIETTEL_POST_SENDER_NAME: "Kho VComm",
  VIETTEL_POST_SENDER_PHONE: "0911000111",
  VIETTEL_POST_SENDER_ADDRESS: "Số 1 Đại lộ Bình Dương, Phường Thủ Dầu Một, Thành phố Hồ Chí Minh",
};

async function buyerSession() {
  const login = await http().post("/api/v1/buyer/login").set("accept-language", "vi").send({ phone: buyerPhone, password });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const accessToken = login.body.tokens.accessToken as string;
  return (method: "get" | "post", path: string, body?: object) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${accessToken}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
}

beforeAll(async () => {
  viettelPost = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      viettelPostRequests.push({ path: incoming.url ?? "", headers: incoming.headers, body });
      const reply = (payload: unknown, statusCode = 200) => {
        response.statusCode = statusCode;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(payload));
      };
      if (incoming.headers.token !== token) return reply({ status: 202, error: true, message: "Token invalid" });
      if (incoming.url === "/v2/order/createOrderNlp") {
        if (viettelPostReject) return reply({ status: 204, error: true, message: "Invalid [RECEIVER_ADDRESS]" });
        const reference = body.ORDER_NUMBER as string;
        if (body.CHECK_UNIQUE === true && viettelPostByReference.has(reference)) return reply({ status: 206, error: true, message: "Mã đơn hàng đã tồn tại trên hệ thống" });
        viettelPostCounter += 1;
        const code = `1587818${String(viettelPostCounter).padStart(4, "0")}`;
        viettelPostStatus.set(code, 102);
        viettelPostByReference.set(reference, code);
        if (viettelPostLoseResponse) return reply({ status: 503, error: true, message: "Bận" }, 503);
        return reply({ status: 200, error: false, message: "OK", data: { ORDER_NUMBER: code, MONEY_COLLECTION: body.MONEY_COLLECTION, MONEY_TOTAL: 16500, MONEY_TOTAL_FEE: 15000, MONEY_VAT: 1500 } });
      }
      if (incoming.url === "/v2/order/UpdateOrder") {
        const code = body.ORDER_NUMBER as string;
        const status = viettelPostStatus.get(code);
        // Hủy chỉ áp dụng với đơn chưa nhận thành công (trạng thái nhỏ hơn 200).
        if (body.TYPE !== 4 || status === undefined || status >= 200) return reply({ status: 203, error: true, message: "Đơn hàng không tồn tại hoặc trạng thái đã bị thay đổi" });
        viettelPostStatus.set(code, 107);
        return reply({ status: 200, error: false, message: "Hủy đơn hàng thành công", data: null });
      }
      reply({ status: 404, error: true, message: "Không có" }, 404);
    });
  });
  await new Promise<void>((resolve) => viettelPost.listen(0, "127.0.0.1", resolve));
  for (const name of Object.keys(configuration)) delete process.env[name];
  process.env.VIETTEL_POST_BASE_URL = `http://127.0.0.1:${(viettelPost.address() as AddressInfo).port}`;
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  const unitId = (await pool.query("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0].id as string;
  const category = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "HANGVT", nameVi: "HANGVT", nameEn: "HANGVT" } });
  expect(category.status, JSON.stringify(category.body)).toBe(201);
  const categoryId = category.body.id;
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
  creamProductId = product.body.id;
  creamVariantId = product.body.variants[0].id;
  warehouseId = (await call("post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "VCOMM", name: "Kho VComm", usesLocations: false })).body.id;
  const receipt = await call("post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu",
    lines: [{ variantId: creamVariantId, unitId, quantity: "20", unitCost: "100000" }],
  });
  expect((await call("post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const channelId = (await call("post", "/catalog/sales-channels", { code: "VCOMM", name: "Ứng dụng VComm" })).body.id;
  const priceListId = (await call("post", "/catalog/price-lists", { code: "VCOMM", name: "VCOMM", includesVat: true, channelId })).body.id;
  const draft = await call("post", "/catalog/price-changes", { priceListId, effectiveFrom: today, lines: [{ variantId: creamVariantId, unitId, price: "250000" }] });
  expect((await call("post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  const settings = {
    channelId,
    warehouseId,
    shippingFee: "30000",
    freeShippingThreshold: null,
    packageLengthCm: 20,
    packageWidthCm: 15,
    packageHeightCm: 10,
    minimumWeightGrams: 200,
    version: 0,
  };
  expect((await call("put", "/marketplace/store-settings", settings)).status).toBe(200);
  expect((await call("put", `/marketplace/listings/${creamProductId}`, { isPublished: true, description: null })).status).toBe(204);
  // Người mua thử có một địa chỉ ở Hà Nội.
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone: buyerPhone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${buyerPhone.slice(1)}`]);
  const registered = await http().post("/api/v1/buyer/register").send({ phone: buyerPhone, code: "246810", fullName: "Người Mua Viettel", password });
  expect(registered.status, JSON.stringify(registered.body)).toBe(200);
  expect((await call("put", `/marketplace/buyers/${registered.body.user.id}/test-buyer`, { isTestBuyer: true })).status).toBe(200);
  const buyer = await buyerSession();
  const hanoi = (await buyer("get", "/buyer/regions/provinces")).body.find((item: { name: string }) => item.name === "Thành phố Hà Nội");
  const ward = (await buyer("get", `/buyer/regions/provinces/${hanoi.code}/wards`)).body[0];
  const saved = await buyer("post", "/buyer/addresses", { recipientName: "Người Nhận Hàng", phone: "0911222444", provinceCode: hanoi.code, wardCode: ward.code, streetAddress: "1 Tràng Tiền" });
  expect(saved.status, JSON.stringify(saved.body)).toBe(201);
});

afterAll(async () => {
  viettelPost?.close();
  await application?.close();
  await pool?.end();
});

// Đặt một đơn (một kem 250.000 + phí giao hàng 30.000), trả về chi tiết đơn.
async function placeOrder(quantity = 1) {
  const buyer = await buyerSession();
  const addressId = (await buyer("get", "/buyer/addresses")).body[0].id;
  const lines = [{ variantId: creamVariantId, quantity }];
  const total = (await buyer("post", "/buyer/orders/preview", { addressId, lines })).body.total;
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: total });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; version: number; documentNo: string };
}
const ship = (order: { id: string; version: number }) => call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "viettel_post", version: order.version });
const orderDetail = async (id: string) => (await call("get", `/marketplace/orders/${id}`)).body;
// Webhook theo mẫu của Viettel Post: dữ liệu trong DATA, khóa trong TOKEN.
const webhook = (status: number, trackingCode: string, options: { pathKey?: string; bodyToken?: string | null; reference?: string } = {}) =>
  http()
    .post(`/api/v1/public/carriers/viettel_post/webhook/${options.pathKey ?? webhookKey}`)
    .send({
      DATA: {
        ORDER_NUMBER: trackingCode,
        ORDER_REFERENCE: options.reference ?? null,
        ORDER_STATUSDATE: "11/11/2026 09:00:00",
        ORDER_STATUS: status,
        STATUS_NAME: "Trạng thái",
        MONEY_COLLECTION: 280000,
        MONEY_TOTAL: 16500,
        ORDER_PAYMENT: 3,
      },
      ...(options.bodyToken === null ? {} : { TOKEN: options.bodyToken ?? webhookKey }),
    });
const stock = async () => Number((await pool.query("SELECT quantity::text FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [warehouseId, creamVariantId])).rows[0]?.quantity ?? 0);
const documentsOf = async (orderId: string) =>
  (
    await pool.query(
      "SELECT d.type, d.status FROM inventory.documents d JOIN marketplace.orders m ON m.id = $1 WHERE d.source_id = m.sales_order_id OR d.source_id IN (SELECT id FROM inventory.documents WHERE source_id = m.sales_order_id) ORDER BY d.created_at",
      [orderId],
    )
  ).rows;

describe("CONG_VIEC_29 kết nối Viettel Post", () => {
  it("KICHBAN_KIEMTHU_344: chưa đủ biến môi trường thì chưa cấu hình, không bật được; đủ thì bật; giao tạo vận đơn đúng thông tin (địa chỉ hai cấp dạng văn bản, thu hộ tiền hàng không thu cước); bị từ chối thì đơn giữ Chờ giao", async () => {
    const before = (await call("get", "/marketplace/store-settings")).body.carriers;
    expect(before).toContainEqual({ code: "viettel_post", name: "Viettel Post", isEnabled: false, isConfigured: false });
    expect(before).toContainEqual({ code: "ghn", name: "Giao Hàng Nhanh (GHN)", isEnabled: false, isConfigured: false });
    expect((await call("put", "/marketplace/carriers/viettel_post", { isEnabled: true })).body.error.code).toBe("BUSINESS_RULE");
    // Khóa webhook ngắn hơn 24 ký tự: vẫn chưa cấu hình.
    Object.assign(process.env, configuration, { VIETTEL_POST_WEBHOOK_KEY: "ngan" });
    expect((await call("put", "/marketplace/carriers/viettel_post", { isEnabled: true })).body.error.code).toBe("BUSINESS_RULE");
    Object.assign(process.env, configuration);
    const enabled = await call("put", "/marketplace/carriers/viettel_post", { isEnabled: true });
    expect(enabled.status, JSON.stringify(enabled.body)).toBe(200);
    expect(enabled.body.carriers).toContainEqual({ code: "viettel_post", name: "Viettel Post", isEnabled: true, isConfigured: true });

    const order = await placeOrder();
    viettelPostReject = true;
    const rejected = await ship(order);
    viettelPostReject = false;
    expect(rejected.body.error.message).toBe("Đơn vị vận chuyển từ chối yêu cầu. Kiểm tra địa chỉ, số điện thoại người nhận rồi thử lại.");
    expect((await orderDetail(order.id)).status).toBe("awaiting_shipment");
    expect(await documentsOf(order.id)).toEqual([]);

    const shipped = await ship(order);
    expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
    expect(shipped.body).toMatchObject({ status: "awaiting_pickup", trackingCode: "15878180001", carrierName: "Viettel Post", canCancel: true });
    expect(shipped.body.shipments[0]).toMatchObject({ trackingCode: "15878180001", carrierStatus: "102", fee: "16500", isActive: true });
    const sent = viettelPostRequests.filter((item) => item.path === "/v2/order/createOrderNlp").at(-1)!;
    expect(sent.headers.token).toBe(token);
    const ward = (await pool.query("SELECT ward_name, province_name FROM marketplace.orders WHERE id = $1", [order.id])).rows[0];
    expect(sent.body).toMatchObject({
      ORDER_NUMBER: order.documentNo,
      SENDER_FULLNAME: "Kho VComm",
      SENDER_PHONE: "0911000111",
      SENDER_ADDRESS: configuration.VIETTEL_POST_SENDER_ADDRESS,
      RECEIVER_FULLNAME: "Người Nhận Hàng",
      RECEIVER_PHONE: "0911222444",
      RECEIVER_ADDRESS: `1 Tràng Tiền, ${ward.ward_name}, Thành phố Hà Nội`,
      ORDER_PAYMENT: 3,
      ORDER_SERVICE: "VCN",
      MONEY_COLLECTION: 280000,
      PRODUCT_WEIGHT: 500,
      PRODUCT_QUANTITY: 1,
      PRODUCT_PRICE: 250000,
      PRODUCT_LENGTH: 20,
      PRODUCT_WIDTH: 15,
      PRODUCT_HEIGHT: 10,
      CHECK_UNIQUE: true,
      PRODUCT_DETAIL: [{ PRODUCT_NAME: "Kem dưỡng da VComm", PRODUCT_QUANTITY: 1, PRODUCT_PRICE: 250000, PRODUCT_WEIGHT: 500 }],
    });
    expect(sent.body).not.toHaveProperty("RECEIVER_DISTRICT");
    expect(await documentsOf(order.id)).toEqual([{ type: "sales_issue", status: "draft" }]);
  });

  it("KICHBAN_KIEMTHU_345: webhook sai khóa đường dẫn hoặc sai, thiếu TOKEN bị từ chối; nhận hàng ghi sổ phiếu xuất; nhận trùng không đổi kết quả; phát thành công; tra lại báo không hỗ trợ; tiền thu hộ lưu trong nhật ký webhook; phát thành công đơn COD tự ghi đã thu một lần, ngày thu là lúc nhận webhook; đơn không COD không ghi (THAY_DOI_20)", async () => {
    const order = await placeOrder();
    const shipped = (await ship(order)).body;
    const code = shipped.trackingCode as string;
    const before = await stock();
    expect((await webhook(501, code, { pathKey: "khoa-sai-00000000000000000000000000" })).status).toBe(403);
    expect((await webhook(501, code, { bodyToken: "khoa-sai-00000000000000000000000000" })).status).toBe(403);
    expect((await webhook(501, code, { bodyToken: null })).status).toBe(403);
    expect((await orderDetail(order.id)).status).toBe("awaiting_pickup");
    // Trạng thái chờ lấy hàng: không đổi đơn.
    expect((await webhook(104, code)).body).toEqual({ result: "applied" });
    expect((await orderDetail(order.id)).status).toBe("awaiting_pickup");
    // Bưu tá đã nhận hàng: ghi sổ phiếu xuất, tồn giảm; nhận trùng không xuất thêm.
    await webhook(105, code);
    await webhook(105, code);
    await webhook(200, code);
    expect(await documentsOf(order.id)).toEqual([{ type: "sales_issue", status: "posted" }]);
    expect(await stock()).toBe(before - 1);
    const shipping = await orderDetail(order.id);
    expect(shipping).toMatchObject({ status: "shipping", canCancel: false });
    expect(shipping.shipments[0].carrierStatus).toBe("200");
    const refreshed = await call("post", `/marketplace/orders/${order.id}/refresh-shipment`);
    expect(refreshed.body.error.message).toBe(
      "Đơn vị vận chuyển này không có chức năng tra lại vận đơn; trạng thái tự cập nhật khi đơn vị vận chuyển gửi thông báo. Kiểm tra đơn trên trang của đơn vị vận chuyển nếu cần.",
    );
    // Phát thành công đơn COD: ghi đã thu, ngày thu là thời điểm nhận webhook; webhook lặp (giờ khác) không ghi lần hai, không đổi ngày thu.
    expect((await orderDetail(order.id)).paymentStatus).toBe("unpaid");
    testClock.fixed = new Date("2026-11-11T05:20:00.000Z");
    try {
      await webhook(501, code);
      testClock.fixed = new Date("2026-11-12T01:00:00.000Z");
      await webhook(501, code);
    } finally {
      testClock.fixed = null;
    }
    const delivered = await orderDetail(order.id);
    expect(delivered).toMatchObject({ status: "delivered", paymentStatus: "paid", paidAmount: "280000" });
    expect(delivered.events.map((event: { status: string }) => event.status)).toEqual(["awaiting_shipment", "awaiting_pickup", "shipping", "delivered", "paid"]);
    expect((await pool.query("SELECT paid_at FROM marketplace.orders WHERE id = $1", [order.id])).rows[0].paid_at.toISOString()).toBe("2026-11-11T05:20:00.000Z");
    // Webhook đến muộn sau khi giao: đơn giữ Đã giao.
    await webhook(500, code);
    expect((await orderDetail(order.id)).status).toBe("delivered");
    expect((await webhook(105, "99999999999")).body).toEqual({ result: "ignored" });
    // Nội dung webhook (gồm tiền thu hộ) được lưu để đối soát ở CONG_VIEC_25.
    const logged = (
      await pool.query(
        "SELECT payload, result FROM marketplace.carrier_webhook_events WHERE carrier_code = 'viettel_post' AND tracking_code = $1 AND result = 'applied' ORDER BY received_at DESC LIMIT 1",
        [code],
      )
    ).rows[0];
    expect(logged.payload.DATA).toMatchObject({ ORDER_STATUS: 500, MONEY_COLLECTION: 280000 });
    // Khóa webhook không được lưu.
    expect(JSON.stringify((await pool.query("SELECT payload FROM marketplace.carrier_webhook_events WHERE carrier_code = 'viettel_post'")).rows)).not.toContain(webhookKey);
    // Đơn không COD (đã thanh toán trực tuyến; đặt thẳng trong cơ sở dữ liệu vì kiểm thử này không giả lập VNPAY): phát thành công không ghi đã thu.
    const online = await placeOrder();
    const onlineCode = (await ship(online)).body.trackingCode as string;
    await pool.query("UPDATE marketplace.orders SET payment_method = 'vnpay_qr', cod_amount = 0, paid_amount = 280000, paid_at = '2026-11-10T02:00:00Z' WHERE id = $1", [online.id]);
    await webhook(200, onlineCode);
    await webhook(501, onlineCode);
    const onlineDelivered = await orderDetail(online.id);
    expect(onlineDelivered.status).toBe("delivered");
    expect(onlineDelivered.events.map((event: { status: string }) => event.status)).not.toContain("paid");
    expect((await pool.query("SELECT paid_at FROM marketplace.orders WHERE id = $1", [online.id])).rows[0].paid_at.toISOString()).toBe("2026-11-10T02:00:00.000Z");
  });

  it("KICHBAN_KIEMTHU_346: hủy đơn chờ lấy hàng hủy vận đơn (loại 4); Viettel Post hủy thì đơn hủy; đã nhận hàng thì không hủy được; hoàn hàng nhập lại kho; trạng thái 503 và mã lạ chỉ ghi lịch sử", async () => {
    const first = await placeOrder();
    const firstShipped = (await ship(first)).body;
    const buyer = await buyerSession();
    const cancelled = await buyer("post", `/buyer/orders/${first.id}/cancel`, { reason: "Đổi ý", version: firstShipped.version });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(viettelPostRequests.filter((item) => item.path === "/v2/order/UpdateOrder").at(-1)!.body).toMatchObject({ TYPE: 4, ORDER_NUMBER: firstShipped.trackingCode });
    expect(viettelPostStatus.get(firstShipped.trackingCode)).toBe(107);
    expect(await documentsOf(first.id)).toEqual([]);

    const second = await placeOrder();
    const secondShipped = (await ship(second)).body;
    await webhook(107, secondShipped.trackingCode);
    expect(await orderDetail(second.id)).toMatchObject({ status: "cancelled", cancelReason: "Đơn vị vận chuyển hủy vận đơn" });

    const third = await placeOrder(2);
    const before = await stock();
    const thirdShipped = (await ship(third)).body;
    viettelPostStatus.set(thirdShipped.trackingCode, 200);
    await webhook(200, thirdShipped.trackingCode);
    expect(await stock()).toBe(before - 2);
    // Viettel Post đã nhận hàng: không hủy được vận đơn nên không hủy đơn.
    const shipping = await orderDetail(third.id);
    const staffCancel = await call("post", `/marketplace/orders/${third.id}/cancel`, { reason: "Khách gọi hủy", version: shipping.version });
    expect(staffCancel.status).not.toBe(200);
    expect((await orderDetail(third.id)).status).toBe("shipping");
    await webhook(503, thirdShipped.trackingCode);
    await webhook(999, thirdShipped.trackingCode);
    const attention = await orderDetail(third.id);
    expect(attention.status).toBe("shipping");
    expect(attention.events.slice(-2).map((event: { status: string; note: string }) => [event.status, event.note])).toEqual([
      ["shipping", "VIETTEL_POST: 503"],
      ["shipping", "VIETTEL_POST: 999"],
    ]);
    await webhook(505, thirdShipped.trackingCode);
    await webhook(504, thirdShipped.trackingCode);
    await webhook(504, thirdShipped.trackingCode);
    expect(await orderDetail(third.id)).toMatchObject({ status: "cancelled", cancelReason: "Giao không thành công, hàng đã hoàn về kho" });
    expect(await stock()).toBe(before);
    expect(await documentsOf(third.id)).toEqual([
      { type: "sales_issue", status: "posted" },
      { type: "sales_return", status: "posted" },
    ]);
  });

  it("KICHBAN_KIEMTHU_347: tạo vận đơn không rõ kết quả hoặc Viettel Post báo trùng số đơn: giữ chỗ, không giao lại, tra lại không bỏ chỗ giữ; webhook mang số đơn VComm thì ghi nhận vận đơn và áp trạng thái", async () => {
    const order = await placeOrder();
    viettelPostLoseResponse = true;
    const lost = await ship(order);
    viettelPostLoseResponse = false;
    expect(lost.body.error.message).toBe('Chưa rõ đơn vị vận chuyển đã tạo vận đơn hay chưa. Bấm "Tra lại vận đơn" để kiểm tra trước khi giao lại.');
    const pending = await orderDetail(order.id);
    expect(pending).toMatchObject({ status: "awaiting_shipment", canShip: false });
    expect(pending.shipments[0]).toMatchObject({ trackingCode: null, carrierStatus: "requesting", isActive: true });
    expect((await ship(pending)).body.error.message).toBe('Đơn đang chờ xác nhận tạo vận đơn. Bấm "Tra lại vận đơn" trước.');
    expect((await call("post", `/marketplace/orders/${order.id}/refresh-shipment`)).body.error.code).toBe("BUSINESS_RULE");
    expect((await orderDetail(order.id)).shipments[0]).toMatchObject({ carrierStatus: "requesting", isActive: true });
    const code = viettelPostByReference.get(order.documentNo)!;
    // Webhook có mã vận đơn lạ nhưng số đơn VComm sai: bỏ qua.
    expect((await webhook(105, code, { reference: "SO-KHONG-CO" })).body).toEqual({ result: "ignored" });
    // Đúng số đơn VComm: ghi nhận vận đơn, áp trạng thái đã nhận hàng.
    expect((await webhook(105, code, { reference: order.documentNo })).body).toEqual({ result: "applied" });
    const confirmed = await orderDetail(order.id);
    expect(confirmed).toMatchObject({ status: "shipping", trackingCode: code });
    expect(confirmed.shipments[0]).toMatchObject({ trackingCode: code, carrierStatus: "105", fee: "16500", isActive: true });
    expect(await documentsOf(order.id)).toEqual([{ type: "sales_issue", status: "posted" }]);

    // Đơn đã có trên Viettel Post (báo trùng số đơn): coi như không rõ kết quả, không bỏ chỗ giữ.
    const second = await placeOrder();
    viettelPostByReference.set(second.documentNo, "15878189999");
    const duplicate = await ship(second);
    expect(duplicate.body.error.message).toBe('Chưa rõ đơn vị vận chuyển đã tạo vận đơn hay chưa. Bấm "Tra lại vận đơn" để kiểm tra trước khi giao lại.');
    expect((await orderDetail(second.id)).shipments[0]).toMatchObject({ trackingCode: null, carrierStatus: "requesting" });
    await webhook(102, "15878189999", { reference: second.documentNo });
    expect(await orderDetail(second.id)).toMatchObject({ status: "awaiting_pickup", trackingCode: "15878189999" });
  });
});
