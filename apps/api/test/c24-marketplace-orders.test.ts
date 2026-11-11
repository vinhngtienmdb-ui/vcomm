// CONG_VIEC_24: Đặt hàng trên VComm (KICHBAN_KIEMTHU_310 trở đi).
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
let groupAdmin: Session;
let admin: Session;
let today: string;
let warehouseId: string;
let channelId: string;
// Máy chủ GHN giả lập: ghi lại yêu cầu, trả trạng thái do kiểm thử đặt.
let ghn: Server;
const ghnRequests: { path: string; headers: Record<string, unknown>; body: Record<string, unknown> }[] = [];
const ghnStatus = new Map<string, string>();
let ghnReject = false;
let ghnCounter = 0;
const webhookKey = "khoa-webhook-kiem-thu-0123456789";
const retail: string = testIds.retailCompany;
const password = "MatKhauNguoiMua@2026";
const units: Record<string, string> = {};
const products: Record<string, string> = {};
const variants: Record<string, string> = {};
const http = () => request(application.getHttpServer());
const call = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => admin.call(method, path, { companyId: retail, ...(body ? { body } : {}) });

async function register(phone: string, fullName: string): Promise<string> {
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
  const created = await http().post("/api/v1/buyer/register").send({ phone, code: "246810", fullName, password });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  return created.body.user.id as string;
}
// Phiên người mua trên ứng dụng: gọi API bằng token.
async function buyerSession(phone: string) {
  const login = await http().post("/api/v1/buyer/login").set("accept-language", "vi").send({ phone, password });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const token = login.body.tokens.accessToken as string;
  return (method: "get" | "post" | "put" | "delete", path: string, body?: object) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
}

beforeAll(async () => {
  ghn = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      ghnRequests.push({ path: request.url ?? "", headers: request.headers, body });
      const reply = (payload: unknown) => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(payload));
      };
      if (request.headers.token !== "token-kiem-thu" || request.headers.shopid !== "885") return reply({ code: 401, message: "Token sai" });
      if (request.url?.endsWith("/shipping-order/create")) {
        if (ghnReject) return reply({ code: 400, message: "Sai địa chỉ", code_message_value: "Phường không hợp lệ" });
        ghnCounter += 1;
        const code = `GHNTEST${ghnCounter}`;
        ghnStatus.set(code, "ready_to_pick");
        return reply({ code: 200, data: { order_code: code, total_fee: 22000 } });
      }
      if (request.url?.endsWith("/switch-status/cancel")) {
        const code = (body.order_codes as string[])[0]!;
        const ok = ghnStatus.get(code) === "ready_to_pick";
        if (ok) ghnStatus.set(code, "cancel");
        return reply({ code: 200, data: [{ order_code: code, result: ok, message: ok ? "OK" : "Đã lấy hàng" }] });
      }
      if (request.url?.endsWith("/shipping-order/detail")) return reply({ code: 200, data: { status: ghnStatus.get(body.order_code as string) ?? "unknown" } });
      reply({ code: 404, message: "Không có" });
    });
  });
  await new Promise<void>((resolve) => ghn.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, {
    GHN_API_TOKEN: "token-kiem-thu",
    GHN_SHOP_ID: "885",
    GHN_WEBHOOK_KEY: webhookKey,
    GHN_BASE_URL: `http://127.0.0.1:${(ghn.address() as AddressInfo).port}`,
  });
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = async (code: string, extra: Record<string, unknown> = {}) =>
    (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: code, nameEn: code, ...extra } })).body.id;
  const product = async (key: string, name: string, categoryId: string, extra: Record<string, unknown> = {}) => {
    const created = await call("post", "/catalog/products", {
      categoryId,
      name,
      vatRate: "10",
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: units.CAI,
      weightKg: "0.5",
      variants: [{ barcodes: [] }],
      ...extra,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    products[key] = created.body.id;
    variants[key] = created.body.variants[0].id;
  };
  const goods = await category("HANGVC");
  expect(goods, "ngành hàng").toBeTruthy();
  await product("cream", "Kem dưỡng da VComm", goods);
  await product("soap", "Xà phòng thảo dược", goods);
  await product("noPrice", "Sản phẩm chưa có giá", goods);
  const serial = await category("SERIVC", { tracksSerials: true });
  await product("phone", "Điện thoại có serial", serial, { tracksSerials: true });
  warehouseId = (await call("post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "VCOMM", name: "Kho VComm", usesLocations: false })).body.id;
  const receipt = await call("post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu",
    lines: [
      { variantId: variants.cream, unitId: units.CAI, quantity: "10", unitCost: "100000" },
      { variantId: variants.soap, unitId: units.CAI, quantity: "5", unitCost: "20000" },
    ],
  });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
  expect((await call("post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const channel = await call("post", "/catalog/sales-channels", { code: "VCOMM", name: "Ứng dụng VComm" });
  expect(channel.status, JSON.stringify(channel.body)).toBe(201);
  channelId = channel.body.id;
  // Bảng giá kênh VComm gồm thuế: kem 250.000; xà phòng chưa thuế ở bảng chung 40.000 (gồm thuế 44.000).
  const priceList = async (code: string, extra: Record<string, unknown>) => (await call("post", "/catalog/price-lists", { code, name: code, ...extra })).body.id as string;
  const price = async (priceListId: string, lines: Record<string, unknown>[]) => {
    const draft = await call("post", "/catalog/price-changes", { priceListId, effectiveFrom: today, lines });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    expect((await call("post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  };
  await price(await priceList("VCOMM", { includesVat: true, channelId }), [
    { variantId: variants.cream, unitId: units.CAI, price: "250000" },
    { variantId: variants.phone, unitId: units.CAI, price: "9000000" },
  ]);
  await price(await priceList("CHUNG", { includesVat: false }), [{ variantId: variants.soap, unitId: units.CAI, price: "40000" }]);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_24 cài đặt bán hàng, đăng bán", () => {
  it("KICHBAN_KIEMTHU_310: cài đặt kênh, kho, phí; đăng bán chỉ hiện sản phẩm đủ điều kiện, giá gồm thuế, còn hàng; người mua thử", async () => {
    // Chưa cài đặt: mọi sản phẩm báo cửa hàng chưa sẵn sàng.
    const empty = await call("get", "/marketplace/listings");
    expect(empty.status, JSON.stringify(empty.body)).toBe(200);
    expect(empty.body.data.every((item: { blockers: string[] }) => item.blockers.includes("storeNotReady"))).toBe(true);
    const settings = await call("get", "/marketplace/store-settings");
    expect(settings.body).toMatchObject({ version: 0, canManage: true, channelId: null });
    expect(settings.body.carriers).toEqual([{ code: "ghn", name: "Giao Hàng Nhanh (GHN)", isEnabled: false, isConfigured: true }]);
    const body = { channelId, warehouseId, shippingFee: "30000", freeShippingThreshold: "500000", packageLengthCm: 20, packageWidthCm: 15, packageHeightCm: 10, minimumWeightGrams: 200 };
    // Kho của công ty khác, phí âm bị từ chối.
    expect((await call("put", "/marketplace/store-settings", { ...body, warehouseId: testIds.binhDuongWarehouse, version: 0 })).status).toBe(400);
    expect((await call("put", "/marketplace/store-settings", { ...body, shippingFee: "-1", version: 0 })).status).toBe(400);
    const saved = await call("put", "/marketplace/store-settings", { ...body, version: 0 });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toMatchObject({ channelId, warehouseId, shippingFee: "30000", freeShippingThreshold: "500000", version: 1 });
    // Sửa trùng phiên bản cũ bị từ chối.
    expect((await call("put", "/marketplace/store-settings", { ...body, version: 0 })).status).toBe(409);

    const listed = await call("get", "/marketplace/listings?pageSize=50");
    const item = (key: string) => listed.body.data.find((row: { productId: string }) => row.productId === products[key]);
    expect(item("cream")).toMatchObject({ isPublished: false, priceFrom: "250000", available: "10", blockers: [] });
    // Bảng giá chung chưa thuế: giá gồm thuế 44.000.
    expect(item("soap")).toMatchObject({ priceFrom: "44000", available: "5", blockers: [] });
    expect(item("noPrice").blockers).toEqual(["noPrice"]);
    expect(item("phone").blockers).toEqual(["lotOrSerial"]);
    expect((await call("put", `/marketplace/listings/${products.cream}`, { isPublished: true, description: "Kem dưỡng ẩm cho da khô." })).status).toBe(204);
    expect((await call("put", `/marketplace/listings/${products.soap}`, { isPublished: true, description: null })).status).toBe(204);
    expect((await call("put", `/marketplace/listings/${products.noPrice}`, { isPublished: true, description: null })).status).toBe(204);
    const published = await call("get", "/marketplace/listings?published=published");
    expect(published.body.total).toBe(3);
    expect((await call("get", "/marketplace/listings?published=unpublished")).body.data.map((row: { productId: string }) => row.productId)).toEqual([products.phone]);
    expect((await call("get", "/marketplace/listings?search=xa phong")).body.data.map((row: { productId: string }) => row.productId)).toEqual([products.soap]);

    // Đơn vị vận chuyển: bật, tắt; mã không có bị từ chối.
    expect((await call("put", "/marketplace/carriers/ghn", { isEnabled: true })).body.carriers[0].isEnabled).toBe(true);
    expect((await call("put", "/marketplace/carriers/viettel", { isEnabled: true })).status).toBe(404);

    // Người mua thử; người mua không vào được màn hình quản trị.
    const buyerId = await register("0933000001", "Người Mua Thử");
    const flagged = await call("put", `/marketplace/buyers/${buyerId}/test-buyer`, { isTestBuyer: true });
    expect(flagged.status, JSON.stringify(flagged.body)).toBe(200);
    expect(flagged.body.isTestBuyer).toBe(true);
    const buyer = await buyerSession("0933000001");
    expect((await buyer("get", "/marketplace/store-settings")).status).toBe(403);
  });
});

describe("CONG_VIEC_24 cửa hàng, giỏ hàng, sổ địa chỉ", () => {
  it("KICHBAN_KIEMTHU_311: danh mục 34 tỉnh, xã thuộc tỉnh; sổ địa chỉ tối đa 10, một mặc định, xóa mặc định thì địa chỉ cũ nhất thành mặc định", async () => {
    await register("0933000002", "Người Mua Địa Chỉ");
    const buyer = await buyerSession("0933000002");
    const provinces = await buyer("get", "/buyer/regions/provinces");
    expect(provinces.body).toHaveLength(34);
    const hanoi = provinces.body.find((item: { name: string }) => item.name === "Thành phố Hà Nội");
    const wards = await buyer("get", `/buyer/regions/provinces/${hanoi.code}/wards`);
    expect(wards.body.length).toBeGreaterThan(100);
    const baDinh = wards.body.find((item: { name: string }) => item.name === "Phường Ba Đình");
    const otherProvince = provinces.body.find((item: { code: string }) => item.code !== hanoi.code);
    const otherWard = (await buyer("get", `/buyer/regions/provinces/${otherProvince.code}/wards`)).body[0];
    const address = { recipientName: "Nguyễn Văn Nhận", phone: "0911222333", provinceCode: hanoi.code, wardCode: baDinh.code, streetAddress: "12 Phố Điện Biên Phủ" };
    // Xã không thuộc tỉnh bị từ chối.
    const wrong = await buyer("post", "/buyer/addresses", { ...address, wardCode: otherWard.code });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.wardCode).toBeTruthy();
    const first = await buyer("post", "/buyer/addresses", address);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body[0]).toMatchObject({ isDefault: true, phone: "0911222333", wardName: "Phường Ba Đình", provinceName: "Thành phố Hà Nội" });
    for (let index = 2; index <= 10; index += 1) expect((await buyer("post", "/buyer/addresses", { ...address, streetAddress: `Số ${index}` })).status).toBe(201);
    const full = await buyer("post", "/buyer/addresses", { ...address, streetAddress: "Số 11" });
    expect(full.body.error.message).toBe("Sổ địa chỉ đã đủ 10 địa chỉ. Xóa bớt trước khi thêm.");
    const book = (await buyer("get", "/buyer/addresses")).body;
    const second = book.find((item: { streetAddress: string }) => item.streetAddress === "Số 2");
    const defaulted = await buyer("post", `/buyer/addresses/${second.id}/default`);
    expect(defaulted.body.filter((item: { isDefault: boolean }) => item.isDefault).map((item: { id: string }) => item.id)).toEqual([second.id]);
    const removed = await buyer("delete", `/buyer/addresses/${second.id}`);
    expect(removed.body).toHaveLength(9);
    expect(removed.body[0]).toMatchObject({ isDefault: true, streetAddress: "12 Phố Điện Biên Phủ" });
    // Người mua khác không sửa được địa chỉ của mình.
    await register("0933000003", "Người Mua Khác");
    const other = await buyerSession("0933000003");
    expect((await other("put", `/buyer/addresses/${removed.body[0].id}`, address)).status).toBe(404);
    expect((await other("get", "/buyer/addresses")).body).toEqual([]);
  });

  it("KICHBAN_KIEMTHU_312 (giỏ hàng): cửa hàng chỉ hiện sản phẩm đủ điều kiện; giỏ hàng thêm, sửa, xóa; sản phẩm ngừng bán hiện Ngừng bán", async () => {
    const buyer = await buyerSession("0933000002");
    const shop = await buyer("get", "/buyer/shop/products");
    expect(shop.status, JSON.stringify(shop.body)).toBe(200);
    // Sản phẩm chưa có giá đã đăng bán vẫn không hiện; serial chưa đăng bán.
    expect(shop.body.data.map((item: { name: string }) => item.name)).toEqual(["Kem dưỡng da VComm", "Xà phòng thảo dược"]);
    expect(shop.body.data[0]).toMatchObject({ priceFrom: "250000", inStock: true });
    expect((await buyer("get", "/buyer/shop/products?search=kem")).body.total).toBe(1);
    const detail = await buyer("get", `/buyer/shop/products/${products.soap}`);
    expect(detail.body).toMatchObject({ name: "Xà phòng thảo dược", unitName: "Cái", currency: "VND" });
    expect(detail.body.variants).toEqual([expect.objectContaining({ id: variants.soap, price: "44000", available: "5" })]);
    expect((await buyer("get", `/buyer/shop/products/${products.phone}`)).status).toBe(404);
    expect((await buyer("put", "/buyer/cart/lines", { variantId: variants.phone, quantity: 1 })).body.error.message).toBe("Sản phẩm này hiện không bán trên ứng dụng.");
    expect((await buyer("put", "/buyer/cart/lines", { variantId: variants.cream, quantity: 0 })).status).toBe(400);
    expect((await buyer("put", "/buyer/cart/lines", { variantId: variants.cream, quantity: 2 })).status).toBe(200);
    const cart = await buyer("put", "/buyer/cart/lines", { variantId: variants.soap, quantity: 3 });
    expect(cart.body.lines.map((line: { productName: string; quantity: number; price: string }) => [line.productName, line.quantity, line.price])).toEqual([
      ["Kem dưỡng da VComm", 2, "250000"],
      ["Xà phòng thảo dược", 3, "44000"],
    ]);
    expect((await buyer("put", "/buyer/cart/lines", { variantId: variants.cream, quantity: 4 })).body.lines[0].quantity).toBe(4);
    // Ngừng đăng bán: dòng giỏ còn nhưng không có giá.
    expect((await call("put", `/marketplace/listings/${products.soap}`, { isPublished: false, description: null })).status).toBe(204);
    const stopped = await buyer("get", "/buyer/cart");
    expect(stopped.body.lines[1]).toMatchObject({ productName: "Xà phòng thảo dược", price: null });
    expect((await call("put", `/marketplace/listings/${products.soap}`, { isPublished: true, description: null })).status).toBe(204);
    expect((await buyer("delete", `/buyer/cart/lines/${variants.soap}`)).body.lines).toHaveLength(1);
  });
});

// Địa chỉ đầu tiên trong sổ của người mua (tạo nếu chưa có).
async function addressOf(buyer: Awaited<ReturnType<typeof buyerSession>>): Promise<string> {
  const existing = (await buyer("get", "/buyer/addresses")).body;
  if (existing.length > 0) return existing[0].id as string;
  const hanoi = (await buyer("get", "/buyer/regions/provinces")).body.find((item: { name: string }) => item.name === "Thành phố Hà Nội");
  const ward = (await buyer("get", `/buyer/regions/provinces/${hanoi.code}/wards`)).body[0];
  const saved = await buyer("post", "/buyer/addresses", { recipientName: "Người Nhận Hàng", phone: "0911222444", provinceCode: hanoi.code, wardCode: ward.code, streetAddress: "1 Tràng Tiền" });
  return saved.body[0].id as string;
}

describe("CONG_VIEC_24 đặt hàng, hủy đơn", () => {
  it("KICHBAN_KIEMTHU_312: xem trước tính giá gồm thuế, phí giao hàng, miễn phí từ mức; đặt hàng tạo đơn bán kênh VComm, giữ hàng không thời hạn, xóa dòng giỏ đã đặt", async () => {
    const buyer = await buyerSession("0933000001");
    const addressId = await addressOf(buyer);
    // Một kem 250.000 + hai xà phòng 88.000 = 338.000 < 500.000: phí 30.000.
    const lines = [
      { variantId: variants.cream, quantity: 1 },
      { variantId: variants.soap, quantity: 2 },
    ];
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body).toMatchObject({ goodsAmount: "338000", shippingFee: "30000", total: "368000", currency: "VND", canOrder: true });
    expect(preview.body.lines.map((line: { productName: string; unitPrice: string; total: string }) => [line.productName, line.unitPrice, line.total])).toEqual([
      ["Kem dưỡng da VComm", "250000", "250000"],
      ["Xà phòng thảo dược", "44000", "88000"],
    ]);
    // Từ 500.000 miễn phí giao hàng.
    expect((await buyer("post", "/buyer/orders/preview", { addressId, lines: [{ variantId: variants.cream, quantity: 2 }] })).body).toMatchObject({
      goodsAmount: "500000",
      shippingFee: "0",
      total: "500000",
    });
    await buyer("put", "/buyer/cart/lines", { variantId: variants.cream, quantity: 1 });
    await buyer("put", "/buyer/cart/lines", { variantId: variants.soap, quantity: 2 });
    // Tổng người mua thấy khác tổng tính lại: báo giá đã thay đổi.
    expect((await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: "338000" })).body.error.message).toBe("Giá hoặc khuyến mãi đã thay đổi. Xem lại tổng tiền mới rồi đặt hàng.");
    const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: "368000" });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    expect(placed.body).toMatchObject({ status: "awaiting_shipment", total: "368000", goodsAmount: "338000", shippingFee: "30000", paymentMethod: "cod", canCancel: true, itemCount: 2 });
    expect(placed.body.documentNo).toMatch(/^DBH/);
    expect((await buyer("get", "/buyer/cart")).body.lines).toEqual([]);
    const sale = (
      await pool.query("SELECT o.status, o.customer_id, o.channel_id, o.buyer_name, o.total_amount::text FROM sales.orders o JOIN marketplace.orders m ON m.sales_order_id = o.id WHERE m.id = $1", [
        placed.body.id,
      ])
    ).rows[0];
    expect(sale).toMatchObject({ status: "confirmed", customer_id: null, channel_id: channelId, buyer_name: "Người Nhận Hàng", total_amount: "338000.0000" });
    const holds = (
      await pool.query(
        "SELECT quantity::int, expires_at FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.id = $1 AND r.status = 'active' ORDER BY quantity",
        [placed.body.id],
      )
    ).rows;
    expect(holds).toEqual([
      { quantity: 1, expires_at: null },
      { quantity: 2, expires_at: null },
    ]);
    const mine = await buyer("get", "/buyer/orders");
    expect(mine.body.data.map((order: { id: string }) => order.id)).toEqual([placed.body.id]);
    // Người mua khác không thấy đơn.
    const other = await buyerSession("0933000003");
    expect((await other("get", `/buyer/orders/${placed.body.id}`)).status).toBe(404);
    // Quản trị thấy đơn, tìm theo số đơn, số điện thoại.
    const list = await call("get", `/marketplace/orders?search=${placed.body.documentNo}`);
    expect(list.body.data.map((order: { id: string; buyerName: string }) => [order.id, order.buyerName])).toEqual([[placed.body.id, "Người Mua Thử"]]);
    expect((await call("get", "/marketplace/orders?search=0933000001")).body.total).toBe(1);
    const detail = await call("get", `/marketplace/orders/${placed.body.id}`);
    expect(detail.body).toMatchObject({ canShip: true, canCancel: true, buyerPhone: "0933000001", recipientName: "Người Nhận Hàng" });
  });

  it("KICHBAN_KIEMTHU_313: chưa là người mua thử, thiếu hàng, sản phẩm ngừng bán, địa chỉ của người khác bị từ chối; tối đa 20 lần đặt mỗi ngày", async () => {
    const plain = await buyerSession("0933000003");
    const plainAddress = await addressOf(plain);
    const lines = [{ variantId: variants.soap, quantity: 1 }];
    const preview = await plain("post", "/buyer/orders/preview", { addressId: plainAddress, lines });
    expect(preview.body.canOrder).toBe(false);
    expect((await plain("post", "/buyer/orders", { addressId: plainAddress, lines, expectedTotal: preview.body.total })).body.error.message).toBe("VComm chưa mở đặt hàng trên ứng dụng.");
    const buyer = await buyerSession("0933000001");
    const addressId = await addressOf(buyer);
    // Xà phòng còn 3 có thể bán.
    const many = await buyer("post", "/buyer/orders/preview", { addressId, lines: [{ variantId: variants.soap, quantity: 4 }] });
    expect((await buyer("post", "/buyer/orders", { addressId, lines: [{ variantId: variants.soap, quantity: 4 }], expectedTotal: many.body.total })).body.error.message).toBe(
      "Một số sản phẩm không còn đủ hàng. Giảm số lượng hoặc bỏ sản phẩm đó.",
    );
    expect((await buyer("post", "/buyer/orders/preview", { addressId, lines: [{ variantId: variants.phone, quantity: 1 }] })).body.error.message).toBe("Sản phẩm này hiện không bán trên ứng dụng.");
    expect((await buyer("post", "/buyer/orders", { addressId: plainAddress, lines, expectedTotal: preview.body.total })).status).toBe(400);
    const buyerId = (await pool.query("SELECT id FROM core.users WHERE phone = '+84933000001'")).rows[0].id;
    // Giả lập đã đặt 20 đơn hôm nay.
    const sample = (await pool.query("SELECT * FROM marketplace.orders WHERE buyer_user_id = $1 LIMIT 1", [buyerId])).rows[0];
    for (let index = 0; index < 19; index += 1) {
      const sale = (
        await pool.query("INSERT INTO sales.orders (company_id, buyer_name, channel_id, warehouse_id, order_date, currency, created_by) VALUES ($1, 'Thử', $2, $3, $4, 'VND', $5) RETURNING id", [
          retail,
          channelId,
          warehouseId,
          today,
          buyerId,
        ])
      ).rows[0].id;
      await pool.query(
        `INSERT INTO marketplace.orders (sales_order_id, company_id, buyer_user_id, recipient_name, recipient_phone, province_code, province_name, ward_code, ward_name, street_address,
          goods_amount, shipping_fee, cod_amount, status, cancelled_by_kind) SELECT $1, company_id, buyer_user_id, recipient_name, recipient_phone, province_code, province_name, ward_code, ward_name,
          street_address, 0, 0, 0, 'cancelled', 'staff' FROM marketplace.orders WHERE id = $2`,
        [sale, sample.id],
      );
    }
    expect((await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total })).body.error.message).toBe("Bạn đã đặt 20 đơn hôm nay. Vui lòng đặt tiếp vào ngày mai.");
    await pool.query("DELETE FROM marketplace.order_events WHERE order_id IN (SELECT id FROM marketplace.orders WHERE status = 'cancelled' AND cancelled_by_kind = 'staff' AND goods_amount = 0)");
    const dummies = (await pool.query("DELETE FROM marketplace.orders WHERE status = 'cancelled' AND cancelled_by_kind = 'staff' AND goods_amount = 0 RETURNING sales_order_id")).rows;
    await pool.query("DELETE FROM sales.orders WHERE id = ANY($1::uuid[])", [dummies.map((row) => row.sales_order_id)]);
  });

  it("KICHBAN_KIEMTHU_314: người mua hủy đơn chờ giao, nhả hàng giữ, hủy đơn bán; đơn đã hủy không hủy lại; nhân viên hủy kèm lý do; sai phiên bản bị từ chối", async () => {
    const buyer = await buyerSession("0933000001");
    const addressId = await addressOf(buyer);
    const lines = [{ variantId: variants.soap, quantity: 1 }];
    const total = (await buyer("post", "/buyer/orders/preview", { addressId, lines })).body.total;
    const first = (await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: total })).body;
    expect((await buyer("post", `/buyer/orders/${first.id}/cancel`, { reason: "Đặt nhầm", version: first.version + 1 })).status).toBe(409);
    const cancelled = await buyer("post", `/buyer/orders/${first.id}/cancel`, { reason: "Đặt nhầm", version: first.version });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body).toMatchObject({ status: "cancelled", cancelReason: "Đặt nhầm", canCancel: false });
    expect(cancelled.body.events.map((event: { status: string }) => event.status)).toEqual(["awaiting_shipment", "cancelled"]);
    const sale = (await pool.query("SELECT o.status FROM sales.orders o JOIN marketplace.orders m ON m.sales_order_id = o.id WHERE m.id = $1", [first.id])).rows[0];
    expect(sale.status).toBe("cancelled");
    expect(
      (await pool.query("SELECT count(*)::int AS count FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.id = $1 AND r.status = 'active'", [first.id]))
        .rows[0].count,
    ).toBe(0);
    expect((await buyer("post", `/buyer/orders/${first.id}/cancel`, { reason: "Lần nữa", version: cancelled.body.version })).body.error.message).toBe(
      "Đơn đã được đơn vị vận chuyển lấy hàng hoặc đã kết thúc, không hủy được.",
    );
    const second = (await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: total })).body;
    const other = await buyerSession("0933000003");
    expect((await other("post", `/buyer/orders/${second.id}/cancel`, { reason: "Không phải của tôi", version: second.version })).status).toBe(404);
    const staff = await call("post", `/marketplace/orders/${second.id}/cancel`, { reason: "Khách gọi điện hủy", version: second.version });
    expect(staff.status, JSON.stringify(staff.body)).toBe(200);
    expect(staff.body).toMatchObject({ status: "cancelled", cancelReason: "Khách gọi điện hủy" });
    expect((await call("get", "/marketplace/orders?status=cancelled")).body.total).toBe(2);
  });
});

// Đặt một đơn của người mua thử, trả về chi tiết đơn.
async function placeOrder(lines: { variantId: string; quantity: number }[]) {
  const buyer = await buyerSession("0933000001");
  const addressId = await addressOf(buyer);
  const total = (await buyer("post", "/buyer/orders/preview", { addressId, lines })).body.total;
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: total });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; version: number; documentNo: string };
}
const webhook = (key: string, payload: object) => http().post(`/api/v1/public/carriers/ghn/webhook/${key}`).send(payload);
const stockOf = async (variantId: string) =>
  Number((await pool.query("SELECT quantity::text FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [warehouseId, variantId])).rows[0]?.quantity ?? 0);

describe("CONG_VIEC_24 giao hàng qua GHN", () => {
  it("KICHBAN_KIEMTHU_315: giao cho GHN tạo vận đơn đúng thông tin; lấy hàng ghi sổ phiếu xuất; giao thành công; webhook sai khóa bị từ chối; nhận trùng không đổi kết quả", async () => {
    const order = await placeOrder([{ variantId: variants.cream, quantity: 1 }]);
    const before = await stockOf(variants.cream);
    // GHN từ chối: đơn giữ Chờ giao, không còn phiếu xuất nháp.
    ghnReject = true;
    const rejected = await call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
    expect(rejected.body.error.message).toBe("Đơn vị vận chuyển từ chối yêu cầu. Kiểm tra địa chỉ, số điện thoại người nhận rồi thử lại.");
    ghnReject = false;
    const drafts = async () =>
      (await pool.query("SELECT d.status FROM inventory.documents d JOIN marketplace.orders m ON m.sales_order_id = d.source_id WHERE m.id = $1 AND d.type = 'sales_issue'", [order.id])).rows;
    expect(await drafts()).toEqual([]);
    const shipped = await call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
    expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
    expect(shipped.body).toMatchObject({ status: "awaiting_pickup", trackingCode: "GHNTEST1", carrierName: "Giao Hàng Nhanh (GHN)", canShip: false, canCancel: true });
    expect(shipped.body.shipments[0]).toMatchObject({ trackingCode: "GHNTEST1", carrierStatus: "ready_to_pick", fee: "22000", isActive: true });
    const sent = ghnRequests.filter((item) => item.path.endsWith("/shipping-order/create")).at(-1)!.body;
    expect(sent).toMatchObject({
      payment_type_id: 1,
      client_order_code: order.documentNo,
      to_name: "Người Nhận Hàng",
      to_phone: "0911222444",
      to_province_name: "Thành phố Hà Nội",
      is_new_to_address: true,
      cod_amount: 280000,
      weight: 500,
      length: 20,
      width: 15,
      height: 10,
    });
    expect(await drafts()).toEqual([{ status: "draft" }]);
    // Sai khóa: từ chối, không đổi trạng thái.
    expect((await webhook("khoa-sai-0000000000000000000000", { OrderCode: "GHNTEST1", Status: "delivered" })).status).toBe(403);
    // Nội dung webhook nói "delivered" nhưng tra lại GHN vẫn ready_to_pick: không đổi.
    expect((await webhook(webhookKey, { OrderCode: "GHNTEST1", Status: "delivered" })).body).toEqual({ result: "applied" });
    expect((await call("get", `/marketplace/orders/${order.id}`)).body.status).toBe("awaiting_pickup");
    // Lấy hàng: ghi sổ phiếu xuất, tồn giảm.
    ghnStatus.set("GHNTEST1", "picked");
    await webhook(webhookKey, { OrderCode: "GHNTEST1" });
    await webhook(webhookKey, { OrderCode: "GHNTEST1" });
    expect(await drafts()).toEqual([{ status: "posted" }]);
    expect(await stockOf(variants.cream)).toBe(before - 1);
    const buyer = await buyerSession("0933000001");
    const shipping = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(shipping).toMatchObject({ status: "shipping", canCancel: false, trackingCode: "GHNTEST1" });
    expect((await buyer("post", `/buyer/orders/${order.id}/cancel`, { reason: "Đổi ý", version: shipping.version })).status).toBe(409);
    ghnStatus.set("GHNTEST1", "delivered");
    expect((await call("post", `/marketplace/orders/${order.id}/refresh-shipment`)).body.status).toBe("delivered");
    await webhook(webhookKey, { OrderCode: "GHNTEST1" });
    const delivered = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(delivered.status).toBe("delivered");
    expect(delivered.events.map((event: { status: string }) => event.status)).toEqual(["awaiting_shipment", "awaiting_pickup", "shipping", "delivered"]);
    expect(new Date(delivered.returnDeadline).getTime() - new Date(delivered.deliveredAt).getTime()).toBe(168 * 3_600_000);
    // Mã vận đơn không có: bỏ qua.
    expect((await webhook(webhookKey, { OrderCode: "KHONGCO1" })).body).toEqual({ result: "ignored" });
  });

  it("KICHBAN_KIEMTHU_316: hủy đơn chờ lấy hàng hủy vận đơn, xóa phiếu xuất nháp; GHN hủy thì đơn hủy; giao thất bại hoàn hàng thì nhập lại kho, đơn hủy", async () => {
    const first = await placeOrder([{ variantId: variants.cream, quantity: 1 }]);
    const shipped = (await call("post", `/marketplace/orders/${first.id}/ship`, { carrierCode: "ghn", version: first.version })).body;
    const buyer = await buyerSession("0933000001");
    const cancelled = await buyer("post", `/buyer/orders/${first.id}/cancel`, { reason: "Đổi ý", version: shipped.version });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");
    expect(ghnStatus.get(shipped.trackingCode)).toBe("cancel");
    expect((await pool.query("SELECT count(*)::int AS count FROM inventory.documents d JOIN marketplace.orders m ON m.sales_order_id = d.source_id WHERE m.id = $1", [first.id])).rows[0].count).toBe(
      0,
    );

    const second = await placeOrder([{ variantId: variants.cream, quantity: 1 }]);
    const secondShipped = (await call("post", `/marketplace/orders/${second.id}/ship`, { carrierCode: "ghn", version: second.version })).body;
    ghnStatus.set(secondShipped.trackingCode, "cancel");
    await webhook(webhookKey, { OrderCode: secondShipped.trackingCode });
    const byCarrier = (await call("get", `/marketplace/orders/${second.id}`)).body;
    expect(byCarrier).toMatchObject({ status: "cancelled", cancelReason: "Đơn vị vận chuyển hủy vận đơn" });

    const third = await placeOrder([{ variantId: variants.cream, quantity: 2 }]);
    const before = await stockOf(variants.cream);
    const thirdShipped = (await call("post", `/marketplace/orders/${third.id}/ship`, { carrierCode: "ghn", version: third.version })).body;
    ghnStatus.set(thirdShipped.trackingCode, "delivering");
    await webhook(webhookKey, { OrderCode: thirdShipped.trackingCode });
    expect(await stockOf(variants.cream)).toBe(before - 2);
    // Đã lấy hàng: GHN không cho hủy; nhân viên không hủy được đơn.
    const detail = (await call("get", `/marketplace/orders/${third.id}`)).body;
    expect(detail).toMatchObject({ status: "shipping", canCancel: false });
    ghnStatus.set(thirdShipped.trackingCode, "lost");
    await webhook(webhookKey, { OrderCode: thirdShipped.trackingCode });
    const attention = (await call("get", `/marketplace/orders/${third.id}`)).body;
    expect(attention.status).toBe("shipping");
    expect(attention.events.at(-1)).toMatchObject({ status: "shipping", note: "GHN: lost" });
    ghnStatus.set(thirdShipped.trackingCode, "returned");
    await webhook(webhookKey, { OrderCode: thirdShipped.trackingCode });
    await webhook(webhookKey, { OrderCode: thirdShipped.trackingCode });
    const returned = (await call("get", `/marketplace/orders/${third.id}`)).body;
    expect(returned).toMatchObject({ status: "cancelled", cancelReason: "Giao không thành công, hàng đã hoàn về kho" });
    expect(await stockOf(variants.cream)).toBe(before);
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
  });
});
