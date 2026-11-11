// CONG_VIEC_24: Đặt hàng trên VComm (KICHBAN_KIEMTHU_310 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
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
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: "khoa-webhook-kiem-thu-0123456789" });
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
