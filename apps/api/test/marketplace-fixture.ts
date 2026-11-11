// Dữ liệu dùng chung cho kiểm thử thanh toán đơn VComm (CONG_VIEC_25): cửa hàng đã cài đặt, hàng đăng bán, người mua trên ứng dụng.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { expect } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";

export const retail: string = testIds.retailCompany;
const password = "MatKhauNguoiMua@2026";

export type BuyerCall = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => request.Test;

export interface MarketplaceFixture {
  admin: Session;
  today: string;
  warehouseId: string;
  channelId: string;
  // Kem 250.000 gồm thuế (tồn 20), xà phòng 44.000 gồm thuế (tồn 10).
  variants: { cream: string; soap: string };
  products: { cream: string; soap: string };
  call: (method: "get" | "post" | "put" | "delete", path: string, body?: object) => request.Test;
  register: (phone: string, fullName: string, referralCode?: string) => Promise<string>;
  buyerSession: (phone: string) => Promise<BuyerCall>;
  addressOf: (buyer: BuyerCall) => Promise<string>;
}

export async function prepareMarketplace(application: NestExpressApplication, pool: Pool): Promise<MarketplaceFixture> {
  const http = () => request(application.getHttpServer());
  const today = application.get(PermissionService).today();
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  const admin = await signIn(application, "quantri.vcr@vcomm.test");
  const call = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => admin.call(method, path, { companyId: retail, ...(body ? { body } : {}) });
  const units: Record<string, string> = {};
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "HANGTT", nameVi: "HANGTT", nameEn: "HANGTT" } })).body.id as string;
  const product = async (name: string) => {
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
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return { productId: created.body.id as string, variantId: created.body.variants[0].id as string };
  };
  const cream = await product("Kem dưỡng da VComm");
  const soap = await product("Xà phòng thảo dược");
  const warehouseId = (await call("post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "VCOMM", name: "Kho VComm", usesLocations: false })).body.id as string;
  const receipt = await call("post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu",
    lines: [
      { variantId: cream.variantId, unitId: units.CAI, quantity: "20", unitCost: "100000" },
      { variantId: soap.variantId, unitId: units.CAI, quantity: "10", unitCost: "20000" },
    ],
  });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
  expect((await call("post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const channelId = (await call("post", "/catalog/sales-channels", { code: "VCOMM", name: "Ứng dụng VComm" })).body.id as string;
  const priceListId = (await call("post", "/catalog/price-lists", { code: "VCOMM", name: "VCOMM", includesVat: true, channelId })).body.id as string;
  const draft = await call("post", "/catalog/price-changes", {
    priceListId,
    effectiveFrom: today,
    lines: [
      { variantId: cream.variantId, unitId: units.CAI, price: "250000" },
      { variantId: soap.variantId, unitId: units.CAI, price: "44000" },
    ],
  });
  expect(draft.status, JSON.stringify(draft.body)).toBe(201);
  expect((await call("post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  const saved = await call("put", "/marketplace/store-settings", {
    channelId,
    warehouseId,
    shippingFee: "30000",
    freeShippingThreshold: "500000",
    packageLengthCm: 20,
    packageWidthCm: 15,
    packageHeightCm: 10,
    minimumWeightGrams: 200,
    version: 0,
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  for (const item of [cream, soap]) expect((await call("put", `/marketplace/listings/${item.productId}`, { isPublished: true, description: null })).status).toBe(204);

  const register = async (phone: string, fullName: string, referralCode?: string) => {
    expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
    await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
    const created = await http()
      .post("/api/v1/buyer/register")
      .send({ phone, code: "246810", fullName, password, ...(referralCode ? { referralCode } : {}) });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    return created.body.user.id as string;
  };
  const buyerSession = async (phone: string): Promise<BuyerCall> => {
    const login = await http().post("/api/v1/buyer/login").set("accept-language", "vi").send({ phone, password });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    const token = login.body.tokens.accessToken as string;
    return (method, path, body) => {
      const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
      return body ? pending.send(body) : pending;
    };
  };
  const addressOf = async (buyer: BuyerCall) => {
    const existing = (await buyer("get", "/buyer/addresses")).body;
    if (existing.length > 0) return existing[0].id as string;
    const hanoi = (await buyer("get", "/buyer/regions/provinces")).body.find((item: { name: string }) => item.name === "Thành phố Hà Nội");
    const ward = (await buyer("get", `/buyer/regions/provinces/${hanoi.code}/wards`)).body[0];
    const saved = await buyer("post", "/buyer/addresses", { recipientName: "Người Nhận Hàng", phone: "0911222444", provinceCode: hanoi.code, wardCode: ward.code, streetAddress: "1 Tràng Tiền" });
    return saved.body[0].id as string;
  };
  return {
    admin,
    today,
    warehouseId,
    channelId,
    variants: { cream: cream.variantId, soap: soap.variantId },
    products: { cream: cream.productId, soap: soap.productId },
    call,
    register,
    buyerSession,
    addressOf,
  };
}

// Máy chủ GHN giả lập: tạo vận đơn, chi tiết vận đơn; trạng thái và ngày thu tiền thu hộ do kiểm thử đặt.
export interface GhnMock {
  url: string;
  orders: Map<string, { status: string; codCollectDate: string | null }>;
  close: () => void;
}

export async function startGhnMock(): Promise<GhnMock> {
  const orders = new Map<string, { status: string; codCollectDate: string | null }>();
  let counter = 0;
  const server = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const reply = (payload: unknown) => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(payload));
      };
      if (incoming.url?.endsWith("/shipping-order/create")) {
        counter += 1;
        const code = `GHNTT${counter}`;
        orders.set(code, { status: "ready_to_pick", codCollectDate: null });
        return reply({ code: 200, data: { order_code: code, total_fee: 22000 } });
      }
      if (incoming.url?.endsWith("/shipping-order/detail")) {
        const order = orders.get(body.order_code as string);
        return reply({ code: 200, data: { status: order?.status ?? "unknown", cod_collect_date: order?.codCollectDate ?? null, cod_transfer_date: null } });
      }
      reply({ code: 404, message: "Không có" });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, orders, close: () => server.close() };
}
