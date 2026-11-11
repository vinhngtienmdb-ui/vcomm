// CONG_VIEC_28: kết nối VNPost (KICHBAN_KIEMTHU_340 đến 343). Máy chủ MyVNPost giả lập theo tài liệu công khai; không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { carrierAdapter } from "../src/marketplace/carriers/carrier-registry";
import { CarrierFailure } from "../src/marketplace/carriers/carrier";
import { resetVnpostCaches, VnpostCarrier, vnpostConfiguration } from "../src/marketplace/carriers/vnpost-carrier";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let variantId = "";
const retail: string = testIds.retailCompany;
const password = "MatKhauNguoiMua@2026";
const webhookKey = "khoa-webhook-vnpost-0123456789";
const http = () => request(application.getHttpServer());
const call = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => admin.call(method, path, { companyId: retail, ...(body ? { body } : {}) });

// Máy chủ MyVNPost giả lập: ghi lại yêu cầu; vận đơn lưu theo số hiệu bưu gửi.
let vnpost: Server;
type FakeOrder = { originalID: string; itemCode: string; saleOrderCode: string; status: number; totalFee: number; codAmount: number; paymentStatus: string };
const requests: { method: string; path: string; headers: Record<string, unknown>; body: Record<string, unknown> }[] = [];
const orders = new Map<string, FakeOrder>();
const fake = {
  tokenCounter: 0,
  // Token còn hiệu lực; token khác bị trả 401 (giả lập hết hạn).
  validToken: "",
  rejectLogin: false,
  rejectCreate: false,
  loseResponse: "none" as "none" | "afterCreate",
  createWithoutItemCode: false,
  cancelType: "00",
  counter: 0,
};
const provinces = [
  { provinceCode: "10", provinceName: "TP. Hà Nội" },
  { provinceCode: "70", provinceName: "TP. Hồ Chí Minh" },
  { provinceCode: "16", provinceName: "Tỉnh Bắc Ninh" },
];
const communes = [
  { provinceCode: "10", communeCode: "11001", communeName: "P. Ba Đình" },
  { provinceCode: "10", communeCode: "11528", communeName: "P. Láng" },
  { provinceCode: "70", communeCode: "70001", communeName: "P. Sài Gòn" },
  // Tên khác dấu thanh (Hòa, Hoà) và tên trùng giữa phường, xã để thử so khớp.
  { provinceCode: "16", communeCode: "16010", communeName: "X. Thuận Hoà" },
  { provinceCode: "16", communeCode: "16020", communeName: "P. Đông Ngàn" },
  { provinceCode: "16", communeCode: "16021", communeName: "X. Đông Ngàn" },
];

function startFakeVnpost(): Promise<void> {
  vnpost = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const url = new URL(incoming.url ?? "/", "http://localhost");
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      requests.push({ method: incoming.method ?? "", path: url.pathname, headers: incoming.headers, body });
      const reply = (status: number, payload: unknown) => {
        response.statusCode = status;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(payload));
      };
      if (url.pathname === "/GetAccessToken") {
        if (fake.rejectLogin || body.username !== "kiemthu" || body.password !== "MatKhauVnpost" || body.customerCode !== "C000123")
          return reply(200, { success: false, errorMessage: "Sai tài khoản", token: null });
        fake.tokenCounter += 1;
        fake.validToken = `token-${fake.tokenCounter}`;
        return reply(200, { success: true, errorMessage: null, token: fake.validToken });
      }
      if (incoming.headers.token !== fake.validToken) return reply(401, "Lỗi xác thực API Key");
      if (url.pathname === "/getNewProvinceAll") return reply(200, provinces);
      if (url.pathname === "/getNewCommuneAll") return reply(200, communes);
      if (url.pathname === "/CreateOrder") {
        if (fake.rejectCreate) return reply(400, "Invalid parameters request");
        const information = body.informationOrder as Record<string, unknown>;
        fake.counter += 1;
        const itemCode = `EM${String(fake.counter).padStart(9, "0")}VN`;
        const addon = (information.addonService as { code: string; propValue: string }[])[0];
        const codAmount = addon ? Number(/PROP0018:(\d+)/.exec(addon.propValue)![1]) : 0;
        const order: FakeOrder = { originalID: `goc-${fake.counter}`, itemCode, saleOrderCode: information.saleOrderCode as string, status: 1, totalFee: 32000, codAmount, paymentStatus: "0" };
        orders.set(itemCode, order);
        if (fake.loseResponse === "afterCreate") return reply(503, "Internal server error");
        return reply(200, fake.createWithoutItemCode ? { ...order, itemCode: null } : order);
      }
      if (url.pathname === "/getOrder") {
        const code = url.searchParams.get("code");
        const type = url.searchParams.get("type");
        const found = [...orders.values()].filter((order) => (type === "1" ? order.itemCode === code : type === "2" ? order.saleOrderCode === code : order.originalID === code));
        return reply(200, [{ results: found }]);
      }
      if (url.pathname === "/orderCancel") {
        const order = [...orders.values()].find((item) => item.originalID === body.OriginalId);
        if (!order) return reply(200, { Type: "03", Message: "Không tìm thấy đơn", Note: "", OriginalId: body.OriginalId, CaseId: "" });
        const allowed = order.status >= 1 && order.status <= 5;
        const type = allowed ? fake.cancelType : "01";
        if (type === "00") order.status = 9;
        return reply(200, { Type: type, Message: type === "00" ? "Thành công" : "Từ chối", Note: type === "01" ? "Đơn đã lấy hàng" : "", OriginalId: body.OriginalId, CaseId: "1" });
      }
      reply(404, "Không có");
    });
  });
  return new Promise<void>((resolve) => vnpost.listen(0, "127.0.0.1", resolve));
}

const environment = () => ({
  VNPOST_USERNAME: "kiemthu",
  VNPOST_PASSWORD: "MatKhauVnpost",
  VNPOST_CUSTOMER_CODE: "C000123",
  VNPOST_CONTRACT_CODE: "",
  VNPOST_SERVICE_CODE: "ETN011",
  VNPOST_WEBHOOK_KEY: webhookKey,
  VNPOST_SENDER_NAME: "Kho VComm",
  VNPOST_SENDER_PHONE: "0281234567",
  VNPOST_SENDER_ADDRESS: "1 Nguyễn Huệ",
  VNPOST_SENDER_PROVINCE: "Thành phố Hồ Chí Minh",
  VNPOST_SENDER_WARD: "Phường Sài Gòn",
  VNPOST_BASE_URL: `http://127.0.0.1:${(vnpost.address() as AddressInfo).port}`,
});

async function register(phone: string, fullName: string): Promise<string> {
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
  const created = await http().post("/api/v1/buyer/register").send({ phone, code: "246810", fullName, password });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  return created.body.user.id as string;
}
async function buyerSession(phone: string) {
  const login = await http().post("/api/v1/buyer/login").set("accept-language", "vi").send({ phone, password });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const token = login.body.tokens.accessToken as string;
  return (method: "get" | "post" | "put" | "delete", path: string, body?: object) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
}
let addressId = "";
// Đặt một đơn (một kem 250.000, phí 30.000) giao tới Phường Ba Đình, Hà Nội.
async function placeOrder() {
  const buyer = await buyerSession("0934000001");
  const lines = [{ variantId, quantity: 1 }];
  const total = (await buyer("post", "/buyer/orders/preview", { addressId, lines })).body.total;
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: total });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; version: number; documentNo: string };
}
const webhook = (key: string, itemCode: string, status = 0) =>
  http()
    .post(`/api/v1/public/carriers/vnpost/webhook/${key}`)
    .send({ data: [{ itemCode, status }], sendDate: "2026-11-11T09:00:00", signature: "chu-ky-khong-kiem" });
const orderOf = async (id: string) => (await call("get", `/marketplace/orders/${id}`)).body;

beforeAll(async () => {
  await startFakeVnpost();
  Object.assign(process.env, environment());
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  const units = Object.fromEntries((await pool.query("SELECT id, code FROM catalog.units")).rows.map((row) => [row.code, row.id]));
  const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "HANGVN", nameVi: "HANGVN", nameEn: "HANGVN" } })).body.id;
  const product = await call("post", "/catalog/products", {
    categoryId,
    name: "Kem dưỡng da VNPost",
    vatRate: "10",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: units.CAI,
    weightKg: "0.5",
    variants: [{ barcodes: [] }],
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  variantId = product.body.variants[0].id;
  const warehouseId = (await call("post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "VCOMM", name: "Kho VComm", usesLocations: false })).body.id;
  const receipt = await call("post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu",
    lines: [{ variantId, unitId: units.CAI, quantity: "20", unitCost: "100000" }],
  });
  expect((await call("post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const channelId = (await call("post", "/catalog/sales-channels", { code: "VCOMM", name: "Ứng dụng VComm" })).body.id;
  const priceListId = (await call("post", "/catalog/price-lists", { code: "VCOMM", name: "VCOMM", includesVat: true, channelId })).body.id;
  const draft = await call("post", "/catalog/price-changes", { priceListId, effectiveFrom: today, lines: [{ variantId, unitId: units.CAI, price: "250000" }] });
  expect((await call("post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  const settings = { channelId, warehouseId, shippingFee: "30000", freeShippingThreshold: null, packageLengthCm: 20, packageWidthCm: 15, packageHeightCm: 10, minimumWeightGrams: 200 };
  expect((await call("put", "/marketplace/store-settings", { ...settings, version: 0 })).status).toBe(200);
  expect((await call("put", `/marketplace/listings/${product.body.id}`, { isPublished: true, description: null })).status).toBe(204);
  const buyerId = await register("0934000001", "Người Mua VNPost");
  expect((await call("put", `/marketplace/buyers/${buyerId}/test-buyer`, { isTestBuyer: true })).status).toBe(200);
  const buyer = await buyerSession("0934000001");
  const hanoi = (await buyer("get", "/buyer/regions/provinces")).body.find((item: { name: string }) => item.name === "Thành phố Hà Nội");
  const ward = (await buyer("get", `/buyer/regions/provinces/${hanoi.code}/wards`)).body.find((item: { name: string }) => item.name === "Phường Ba Đình");
  const saved = await buyer("post", "/buyer/addresses", { recipientName: "Người Nhận VNPost", phone: "0911222555", provinceCode: hanoi.code, wardCode: ward.code, streetAddress: "5 Điện Biên Phủ" });
  addressId = saved.body[0].id;
});

beforeEach(() => {
  resetVnpostCaches();
  Object.assign(fake, { rejectLogin: false, rejectCreate: false, loseResponse: "none", createWithoutItemCode: false, cancelType: "00" });
});

afterAll(async () => {
  vnpost?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_28 lớp kết nối VNPost", () => {
  it("KICHBAN_KIEMTHU_340: thiếu biến môi trường thì chưa cấu hình; lấy token, hết hạn thì lấy lại một lần; tra mã tỉnh, xã của VNPost theo tên; trùng tên, không có tên bị từ chối", async () => {
    // Thiếu một biến hoặc khóa webhook ngắn: chưa cấu hình.
    const saved = process.env.VNPOST_SENDER_WARD;
    process.env.VNPOST_SENDER_WARD = "";
    expect(vnpostConfiguration()).toBeNull();
    process.env.VNPOST_SENDER_WARD = saved;
    process.env.VNPOST_WEBHOOK_KEY = "ngan";
    expect(carrierAdapter("vnpost")).toBeNull();
    process.env.VNPOST_WEBHOOK_KEY = webhookKey;
    // Đơn vị chưa có lớp kết nối: chưa cấu hình.
    expect(carrierAdapter("viettel_post")).toBeNull();
    const adapter = carrierAdapter("vnpost") as VnpostCarrier;
    expect(adapter.code).toBe("vnpost");

    const base = {
      clientOrderCode: "DBH-THU-1",
      recipientName: "Người Nhận",
      recipientPhone: "0911222555",
      streetAddress: "Số 1",
      codAmount: 0,
      weightGrams: 300,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 10,
      items: [{ name: "Hàng", code: "SKU1", quantity: 1, price: 1000, weightGrams: 300 }],
    };
    // Tên khác dấu thanh ("Thuận Hòa" và "Thuận Hoà") vẫn khớp; không thu hộ thì không gửi dịch vụ cộng thêm.
    const created = await adapter.createShipment({ ...base, wardName: "Xã Thuận Hòa", provinceName: "Tỉnh Bắc Ninh" });
    const sent = requests.filter((item) => item.path === "/CreateOrder").at(-1)!.body;
    expect(sent).toMatchObject({ orderCreationStatus: 1, type: "GUI", customerCode: "C000123", contractCode: null });
    expect(sent.informationOrder).toMatchObject({
      senderProvinceCode: "70",
      senderDistrictCode: "VNPOST",
      senderCommuneCode: "70001",
      receiverProvinceCode: "16",
      receiverDistrictCode: "VNPOST",
      receiverCommuneCode: "16010",
      serviceCode: "ETN011",
      addonService: [],
      saleOrderCode: "DBH-THU-1",
      weight: 300,
    });
    expect(created).toEqual({ trackingCode: expect.stringMatching(/^EM\d{9}VN$/), fee: "32000", status: "1" });
    // Phường và xã cùng tên trong tỉnh: tên đầy đủ phân biệt được; tên trần thì không đoán.
    await adapter.createShipment({ ...base, wardName: "Phường Đông Ngàn", provinceName: "Tỉnh Bắc Ninh" });
    expect((requests.filter((item) => item.path === "/CreateOrder").at(-1)!.body.informationOrder as { receiverCommuneCode: string }).receiverCommuneCode).toBe("16020");
    await expect(adapter.createShipment({ ...base, wardName: "Đông Ngàn", provinceName: "Tỉnh Bắc Ninh" })).rejects.toMatchObject({
      kind: "rejected",
      message: 'VNPost có nhiều xã trùng tên "Đông Ngàn"',
    });
    // Xã không có trong danh mục của tỉnh: từ chối, không gọi tạo đơn.
    const before = requests.filter((item) => item.path === "/CreateOrder").length;
    await expect(adapter.createShipment({ ...base, wardName: "Phường Láng", provinceName: "Tỉnh Bắc Ninh" })).rejects.toMatchObject({
      kind: "rejected",
      message: 'Không tìm thấy xã "Phường Láng" trong danh mục của VNPost',
    });
    expect(requests.filter((item) => item.path === "/CreateOrder").length).toBe(before);
    // Danh mục, token được giữ: chỉ đăng nhập một lần, tải danh mục một lần.
    expect(requests.filter((item) => item.path === "/GetAccessToken")).toHaveLength(1);
    expect(requests.filter((item) => item.path === "/getNewCommuneAll")).toHaveLength(1);
    // Token hết hạn: lấy token mới, gọi lại một lần.
    fake.validToken = "token-da-doi";
    expect(await adapter.shipmentStatus(created.trackingCode)).toBe("1");
    expect(requests.filter((item) => item.path === "/GetAccessToken")).toHaveLength(2);
    // Sai tài khoản: từ chối.
    resetVnpostCaches();
    fake.rejectLogin = true;
    await expect(adapter.shipmentStatus(created.trackingCode)).rejects.toMatchObject({ kind: "rejected", message: "VNPost từ chối đăng nhập: Sai tài khoản" });
  });

  it("KICHBAN_KIEMTHU_341: ánh xạ trạng thái; mã vận đơn từ webhook; hủy thành công, chờ xử lý, từ chối; tìm theo số đơn; tiền thu hộ cho đối soát", async () => {
    const adapter = carrierAdapter("vnpost") as VnpostCarrier;
    const phases = Object.fromEntries(["1", "5", "6", "7", "12", "15", "18", "24", "14", "21", "19", "9", "22", "29", "8", "20", "23", "28", "99"].map((status) => [status, adapter.phaseOf(status)]));
    expect(phases).toEqual({
      "1": "waiting_pickup",
      "5": "waiting_pickup",
      "6": "picked",
      "7": "picked",
      "12": "picked",
      "15": "picked",
      "18": "picked",
      "24": "picked",
      "14": "delivered",
      "21": "delivered",
      "19": "returned",
      "9": "cancelled",
      "22": "cancelled",
      "29": "cancelled",
      "8": "attention",
      "20": "attention",
      "23": "attention",
      "28": "attention",
      "99": "attention",
    });
    expect(adapter.trackingCodeOf({ data: [{ itemCode: "EM000000001VN", status: 6 }], sendDate: "x", signature: "y" })).toBe("EM000000001VN");
    expect(adapter.trackingCodeOf({ data: JSON.stringify([{ itemCode: "EM000000002VN" }]) })).toBe("EM000000002VN");
    expect(adapter.trackingCodeOf({ data: [{ itemCode: "EM 1; DROP" }] })).toBeNull();
    expect(adapter.trackingCodeOf({ data: "khong-phai-json" })).toBeNull();
    expect(adapter.trackingCodeOf(null)).toBeNull();

    const base = {
      recipientName: "Người Nhận",
      recipientPhone: "0911222555",
      streetAddress: "Số 1",
      wardName: "Phường Láng",
      provinceName: "Thành phố Hà Nội",
      weightGrams: 300,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 10,
      items: [{ name: "Hàng", code: "SKU1", quantity: 1, price: 1000, weightGrams: 300 }],
    };
    const first = await adapter.createShipment({ ...base, clientOrderCode: "DBH-THU-2", codAmount: 280000 });
    const addon = (requests.filter((item) => item.path === "/CreateOrder").at(-1)!.body.informationOrder as { addonService: unknown }).addonService;
    expect(addon).toEqual([{ code: "GTG021", propValue: "PROP0018:280000;PROP0019:null;PROP0020:null" }]);
    expect(await adapter.findShipment("DBH-THU-2")).toEqual({ trackingCode: first.trackingCode, fee: "32000", status: "1" });
    expect(await adapter.findShipment("KHONG-CO")).toBeNull();
    // Tiền thu hộ: chưa trả, rồi VNPost báo đã trả tiền COD (21).
    expect(await adapter.cashOnDelivery(first.trackingCode)).toEqual({ status: "1", codAmount: "280000", codPaid: false, paymentStatus: "0", fee: "32000" });
    orders.get(first.trackingCode)!.status = 21;
    expect(await adapter.cashOnDelivery(first.trackingCode)).toMatchObject({ status: "21", codPaid: true });

    // Hủy: chờ xử lý (02) chưa phải đã hủy; thành công (00); đã lấy hàng thì từ chối (01).
    const second = await adapter.createShipment({ ...base, clientOrderCode: "DBH-THU-3", codAmount: 0 });
    fake.cancelType = "02";
    await expect(adapter.cancelShipment(second.trackingCode)).rejects.toMatchObject({ kind: "rejected", message: "VNPost đang xử lý yêu cầu hủy" });
    fake.cancelType = "00";
    await adapter.cancelShipment(second.trackingCode);
    expect(requests.filter((item) => item.path === "/orderCancel").at(-1)!.body).toEqual({ OriginalId: orders.get(second.trackingCode)!.originalID });
    orders.get(first.trackingCode)!.status = 6;
    await expect(adapter.cancelShipment(first.trackingCode)).rejects.toMatchObject({ kind: "rejected", message: "Từ chối: Đơn đã lấy hàng" });
    await expect(adapter.cancelShipment("EM999999999VN")).rejects.toBeInstanceOf(CarrierFailure);
    // VNPost không trả số hiệu bưu gửi: chưa rõ kết quả.
    fake.createWithoutItemCode = true;
    await expect(adapter.createShipment({ ...base, clientOrderCode: "DBH-THU-4", codAmount: 0 })).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("CONG_VIEC_28 giao đơn VComm qua VNPost", () => {
  it("KICHBAN_KIEMTHU_342: bật VNPost, giao đơn tạo vận đơn có tiền thu hộ; webhook sai khóa bị từ chối; trạng thái theo tra lại; lấy hàng, giao thành công; nhận trùng không đổi kết quả", async () => {
    const settings = await call("get", "/marketplace/store-settings");
    expect(settings.body.carriers).toContainEqual({ code: "vnpost", name: "Bưu điện Việt Nam (VNPost)", isEnabled: false, isConfigured: true });
    const order = await placeOrder();
    // Chưa bật: không giao được.
    expect((await call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "vnpost", version: order.version })).status).toBe(409);
    expect((await call("put", "/marketplace/carriers/vnpost", { isEnabled: true })).status).toBe(200);
    // Mã đơn vị chưa có lớp kết nối không bật được.
    expect((await call("put", "/marketplace/carriers/jt", { isEnabled: true })).status).toBe(409);
    // VNPost từ chối: đơn giữ Chờ giao.
    fake.rejectCreate = true;
    expect((await call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "vnpost", version: order.version })).body.error.message).toBe(
      "Đơn vị vận chuyển từ chối yêu cầu. Kiểm tra địa chỉ, số điện thoại người nhận rồi thử lại.",
    );
    fake.rejectCreate = false;
    const shipped = await call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "vnpost", version: order.version });
    expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
    const trackingCode = shipped.body.trackingCode as string;
    expect(shipped.body).toMatchObject({ status: "awaiting_pickup", carrierName: "Bưu điện Việt Nam (VNPost)" });
    expect(shipped.body.shipments[0]).toMatchObject({ trackingCode, carrierStatus: "1", fee: "32000", isActive: true });
    const information = requests.filter((item) => item.path === "/CreateOrder").at(-1)!.body.informationOrder as Record<string, unknown>;
    expect(information).toMatchObject({
      receiverName: "Người Nhận VNPost",
      receiverPhone: "0911222555",
      receiverAddress: "5 Điện Biên Phủ",
      receiverProvinceCode: "10",
      receiverCommuneCode: "11001",
      saleOrderCode: order.documentNo,
      weight: 500,
      addonService: [{ code: "GTG021", propValue: "PROP0018:280000;PROP0019:null;PROP0020:null" }],
    });
    // Sai khóa: từ chối. Nội dung webhook nói đã giao nhưng tra lại vẫn 1: không đổi.
    expect((await webhook("khoa-sai-000000000000000000000", trackingCode, 14)).status).toBe(403);
    expect((await webhook(webhookKey, trackingCode, 14)).body).toEqual({ result: "applied" });
    expect((await orderOf(order.id)).status).toBe("awaiting_pickup");
    // Đã lấy hàng (6): ghi sổ phiếu xuất; nhận trùng không đổi.
    orders.get(trackingCode)!.status = 6;
    await webhook(webhookKey, trackingCode);
    await webhook(webhookKey, trackingCode);
    expect((await orderOf(order.id)).status).toBe("shipping");
    // Lấy hàng thất bại một phần, mã lạ: hiện cho nhân viên, đơn giữ trạng thái.
    orders.get(trackingCode)!.status = 23;
    await webhook(webhookKey, trackingCode);
    const attention = await orderOf(order.id);
    expect(attention.status).toBe("shipping");
    expect(attention.events.at(-1)).toMatchObject({ status: "shipping", note: "VNPOST: 23" });
    // Đã giao (14) qua tra lại vận đơn.
    orders.get(trackingCode)!.status = 14;
    expect((await call("post", `/marketplace/orders/${order.id}/refresh-shipment`)).body.status).toBe("delivered");
    await webhook(webhookKey, trackingCode);
    const delivered = await orderOf(order.id);
    expect(delivered.events.map((event: { status: string }) => event.status)).toEqual(["awaiting_shipment", "awaiting_pickup", "shipping", "shipping", "delivered"]);
    // Không có vận đơn: bỏ qua.
    expect((await webhook(webhookKey, "EM123123123VN")).body).toEqual({ result: "ignored" });
  });

  it("KICHBAN_KIEMTHU_343: hủy đơn chờ lấy hàng hủy vận đơn; VNPost chờ xử lý hủy thì đơn giữ nguyên; VNPost hủy thì đơn hủy; hoàn hàng nhập lại kho; mất phản hồi khi tạo thì tra lại theo số đơn", async () => {
    // Nhân viên hủy, VNPost trả chờ xử lý: đơn không hủy; VNPost hủy xong (9) thì webhook hủy đơn.
    const first = await placeOrder();
    const firstShipped = (await call("post", `/marketplace/orders/${first.id}/ship`, { carrierCode: "vnpost", version: first.version })).body;
    fake.cancelType = "02";
    const pending = await call("post", `/marketplace/orders/${first.id}/cancel`, { reason: "Khách đổi ý", version: firstShipped.version });
    expect(pending.body.error.message).toBe("Đơn vị vận chuyển không hủy được vận đơn (có thể đã lấy hàng). Tra lại vận đơn rồi xử lý.");
    expect((await orderOf(first.id)).status).toBe("awaiting_pickup");
    orders.get(firstShipped.trackingCode)!.status = 9;
    await webhook(webhookKey, firstShipped.trackingCode);
    expect(await orderOf(first.id)).toMatchObject({ status: "cancelled", cancelReason: "Đơn vị vận chuyển hủy vận đơn" });

    // Hủy thành công từ ứng dụng của người mua.
    fake.cancelType = "00";
    const second = await placeOrder();
    const secondShipped = (await call("post", `/marketplace/orders/${second.id}/ship`, { carrierCode: "vnpost", version: second.version })).body;
    const buyer = await buyerSession("0934000001");
    expect((await buyer("post", `/buyer/orders/${second.id}/cancel`, { reason: "Đổi ý", version: secondShipped.version })).body.status).toBe("cancelled");
    expect(orders.get(secondShipped.trackingCode)!.status).toBe(9);

    // Giao không thành công, hoàn hàng (19): nhập lại kho, đơn hủy.
    const third = await placeOrder();
    const thirdShipped = (await call("post", `/marketplace/orders/${third.id}/ship`, { carrierCode: "vnpost", version: third.version })).body;
    orders.get(thirdShipped.trackingCode)!.status = 12;
    await webhook(webhookKey, thirdShipped.trackingCode);
    orders.get(thirdShipped.trackingCode)!.status = 19;
    await webhook(webhookKey, thirdShipped.trackingCode);
    await webhook(webhookKey, thirdShipped.trackingCode);
    expect(await orderOf(third.id)).toMatchObject({ status: "cancelled", cancelReason: "Giao không thành công, hàng đã hoàn về kho" });
    const documents = (
      await pool.query(
        "SELECT d.type, d.status FROM inventory.documents d JOIN marketplace.orders m ON m.id = $1 JOIN sales.orders s ON s.id = m.sales_order_id WHERE d.source_id = s.id OR d.source_id IN (SELECT id FROM inventory.documents WHERE source_id = s.id) ORDER BY d.created_at",
        [third.id],
      )
    ).rows;
    expect(documents).toEqual([
      { type: "sales_issue", status: "posted" },
      { type: "sales_return", status: "posted" },
    ]);

    // VNPost tạo xong nhưng mất phản hồi: giữ chỗ; tra lại tìm theo số đơn rồi ghi nhận.
    const fourth = await placeOrder();
    fake.loseResponse = "afterCreate";
    const lost = await call("post", `/marketplace/orders/${fourth.id}/ship`, { carrierCode: "vnpost", version: fourth.version });
    expect(lost.status).toBe(409);
    fake.loseResponse = "none";
    const refreshed = await call("post", `/marketplace/orders/${fourth.id}/refresh-shipment`);
    expect(refreshed.body).toMatchObject({ status: "awaiting_pickup" });
    expect(refreshed.body.trackingCode).toMatch(/^EM\d{9}VN$/);
    expect(requests.filter((item) => item.path === "/CreateOrder" && (item.body.informationOrder as { saleOrderCode: string }).saleOrderCode === fourth.documentNo)).toHaveLength(1);
  });
});
