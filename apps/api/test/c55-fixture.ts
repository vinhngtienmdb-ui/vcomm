// Dữ liệu dùng chung cho kiểm thử cửa hàng liên kết (CONG_VIEC_55): công ty vận hành sàn, giai đoạn điểm (1 điểm = 1.000 đồng, đổi tối đa 50 %, tối thiểu 10 điểm),
// cửa hàng đang hoạt động hai điểm bán, chủ cửa hàng, thu ngân (điểm bán A), người mua trên ứng dụng.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { expect } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { creditLot } from "../src/loyalty/ledger.service";
import { lockAccount } from "../src/loyalty/tiers";
import { PermissionService } from "../src/permissions/permission.service";
import { sessionFrom, signIn, type Session } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";

export const operator: string = testIds.retailCompany;

export interface AffiliateFixture {
  admin: Session;
  call: (method: "get" | "post" | "put", path: string, body?: object) => request.Test;
  owner: Session;
  cashier: Session;
  merchantId: string;
  outletA: string;
  outletB: string;
  today: string;
  activate: (phone: string) => Promise<Session>;
  register: (phone: string, name: string) => Promise<{ id: string; call: BuyerCall; phone: string }>;
  grantPoints: (userId: string, points: number) => Promise<void>;
  createMerchant: (name: string, taxCode: string, contractNo: string) => Promise<string>;
}

export async function prepareAffiliate(application: NestExpressApplication, pool: Pool, terms: { creditLimit: string } = { creditLimit: "50000000" }): Promise<AffiliateFixture> {
  const http = () => request(application.getHttpServer());
  const setOtp = async (phone: string) => {
    await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
  };
  const activate = async (phone: string): Promise<Session> => {
    expect((await http().post("/api/v1/merchant-portal/activation/otp").send({ phone })).status).toBe(204);
    await setOtp(phone);
    const response = await http().post("/api/v1/merchant-portal/activation").send({ phone, code: "246810" });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return sessionFrom(application, response.headers["set-cookie"]);
  };
  const register = async (phone: string, name: string) => {
    expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
    await setOtp(phone);
    const created = await http().post("/api/v1/buyer/register").send({ phone, code: "246810", fullName: name, password: "MatKhauNguoiMua@2026" });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    const login = await http().post("/api/v1/buyer/login").send({ phone, password: "MatKhauNguoiMua@2026" });
    const token = login.body.tokens.accessToken as string;
    const call: BuyerCall = (method, path, body) => {
      const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
      return body ? pending.send(body) : pending;
    };
    return { id: created.body.user.id as string, call, phone };
  };
  const today = application.get(PermissionService).today();
  // Cộng điểm khởi đầu bằng bút toán điều chỉnh cộng (giá trị lúc tích 1.000 đồng, hạn 12 tháng).
  const grantPoints = async (userId: string, points: number) => {
    await application.get<Database>(DATABASE).transaction(async (transaction) => {
      await lockAccount(transaction, userId);
      await creditLot(transaction, { userId, kind: "adjust_add", sourceType: "adjustment", sourceId: randomUUID(), companyId: operator, points, pointValue: 1000, day: today, validityMonths: 12 });
    });
  };

  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: operator, body: { companyId: operator } })).status).toBe(200);
  const admin = await signIn(application, "quantri.vcr@vcomm.test");
  const call = (method: "get" | "post" | "put", path: string, body?: object) => admin.call(method, path, { companyId: operator, ...(body ? { body } : {}) });
  const phase = { startsOn: today, endsOn: null, earnPercent: "1", pointValue: "1000", redeemMaxPercent: "50", redeemMinPoints: 10, validityMonths: 12, orderCapPoints: 500, monthlyCapPoints: null };
  expect((await call("post", "/loyalty/phases", phase)).status).toBe(201);
  const createMerchant = async (name: string, taxCode: string, contractNo: string) => {
    const partner = (await pool.query<{ id: string }>("INSERT INTO crm.partners (kind, name, tax_code, search_text) VALUES ('organization', $1, $2, lower($1)) RETURNING id", [name, taxCode])).rows[0]!
      .id;
    const merchant = await call("post", "/affiliate/merchants", {
      partnerId: partner,
      contractNo,
      startsOn: today,
      endsOn: null,
      earnPercent: "2",
      feePercent: "8",
      creditLimit: terms.creditLimit,
      transactionCap: "5000000",
      paymentTermDays: 7,
      autoConfirmDays: 3,
    });
    expect(merchant.status, JSON.stringify(merchant.body)).toBe(201);
    return merchant.body.id as string;
  };
  const merchantId = await createMerchant("Cà phê Hạt Nâu", "0311111119", "HDLK-01");
  const outletA = (await call("post", `/affiliate/merchants/${merchantId}/outlets`, { name: "Lê Lợi", address: "12 Lê Lợi" })).body.id as string;
  const outletB = (await call("post", `/affiliate/merchants/${merchantId}/outlets`, { name: "Nguyễn Huệ", address: "88 Nguyễn Huệ" })).body.id as string;
  const detail = await call("get", `/affiliate/merchants/${merchantId}`);
  expect((await call("post", `/affiliate/merchants/${merchantId}/activate`, { version: detail.body.version })).status).toBe(201);
  await call("post", `/affiliate/merchants/${merchantId}/owner-invitations`, { fullName: "Trần Minh Khoa", phone: "0909111222" });
  const owner = await activate("0909111222");
  await owner.call("post", "/merchant-portal/members", { body: { fullName: "Lê Thu Hà", phone: "0912333444", outletIds: [outletA] } });
  const cashier = await activate("0912333444");
  return { admin, call, owner, cashier, merchantId, outletA, outletB, today, activate, register, grantPoints, createMerchant };
}
