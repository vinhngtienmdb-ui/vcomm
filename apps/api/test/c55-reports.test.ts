// CONG_VIEC_55 L4: báo cáo cửa hàng, báo cáo công ty, cảnh báo bất thường, cảnh báo dư nợ 80 % (KICHBAN_KIEMTHU_546; TIEUCHI_NGHIEMTHU_378);
// đăng nhập cổng cửa hàng bằng Zalo sau khi liên kết (KICHBAN_KIEMTHU_534; TIEUCHI_NGHIEMTHU_369).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import request from "supertest";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AffiliateReportsService } from "../src/affiliate/reports.service";
import type { BuyerCall } from "./marketplace-fixture";
import { prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { cookieValue, signIn } from "./helpers";
import { startTestApplication, testOauth } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let first: { id: string; call: BuyerCall; phone: string };
let second: { id: string; call: BuyerCall; phone: string };

async function sale(buyer: { call: BuyerCall }, billAmount: string) {
  const created = await fixture.cashier.call("post", "/merchant-portal/transactions", { body: { outletId: fixture.outletA, billAmount, method: "merchant_qr" } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const confirmed = await buyer.call("post", `/buyer/affiliate/transactions/${created.body.transaction.id}/confirm`, { points: 0, code: created.body.qrCode });
  expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
  return created.body.transaction.id as string;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  // Hạn mức nợ 100.000 đồng để thử cảnh báo dư nợ; trần mỗi giao dịch 5.000.000 đồng.
  fixture = await prepareAffiliate(application, pool, { creditLimit: "100000" });
  first = await fixture.register("0938300001", "Đỗ Thị Lan");
  second = await fixture.register("0938300002", "Vũ Minh Tâm");
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("TIEUCHI_NGHIEMTHU_378: báo cáo và cảnh báo", () => {
  it("KICHBAN_KIEMTHU_546: báo cáo khớp giao dịch; bốn loại cảnh báo bất thường; dư nợ từ 80 % hạn mức", async () => {
    // Khách thứ nhất 3 giao dịch 4.500.000 (≥ 80 % trần): lần đầu tích 90 điểm (90.000), hai lần sau vượt hạn mức không tích.
    for (let index = 0; index < 3; index += 1) await sale(first, "4500000");
    // Khách thứ hai 7 giao dịch 10.000; chủ cửa hàng hủy 2.
    const small = [];
    for (let index = 0; index < 7; index += 1) small.push(await sale(second, "10000"));
    for (const id of small.slice(0, 2)) expect((await fixture.owner.call("post", `/merchant-portal/transactions/${id}/cancel`, { body: { reason: "Nhập nhầm" } })).status).toBe(201);
    // Thu ngân gửi 10 yêu cầu theo số điện thoại, khách đều từ chối.
    for (let index = 0; index < 10; index += 1) {
      const created = await fixture.cashier.call("post", "/merchant-portal/transactions", { body: { outletId: fixture.outletA, billAmount: "50000", method: "phone", phone: second.phone } });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      expect((await second.call("post", `/buyer/affiliate/transactions/${created.body.transaction.id}/decline`, {})).status).toBe(204);
    }

    const today = fixture.today;
    // Thu ngân không xem báo cáo; chủ cửa hàng xem theo ngày.
    expect((await fixture.cashier.call("get", `/merchant-portal/report?from=${today}&to=${today}`)).status).toBe(403);
    const report = await fixture.owner.call("get", `/merchant-portal/report?from=${today}&to=${today}&groupBy=day`);
    expect(report.status, JSON.stringify(report.body)).toBe(200);
    const totals = {
      transactions: 8,
      billAmount: "13550000",
      customers: 2,
      newCustomers: 2,
      earnedPoints: 90,
      earnedAmount: "90000",
      redeemedPoints: 0,
      redeemedAmount: "0",
      vouchersUsed: 0,
      cancelled: 2,
    };
    expect(report.body.totals).toEqual(totals);
    expect(report.body.rows).toEqual([{ period: today, ...totals }]);
    expect(report.body.exposure).toEqual({ amount: "90000", creditLimit: "100000", remaining: "10000", percent: "90.0" });
    // Lọc điểm bán khác: không có giao dịch.
    expect((await fixture.owner.call("get", `/merchant-portal/report?from=${today}&to=${today}&outletId=${fixture.outletB}`)).body.totals.transactions).toBe(0);
    expect((await fixture.owner.call("get", `/merchant-portal/report?from=${today}&to=2020-01-01`)).status).toBe(400);

    // Báo cáo công ty theo cửa hàng.
    const company = await fixture.call("get", `/affiliate/report?from=${today}&to=${today}`);
    expect(company.status, JSON.stringify(company.body)).toBe(200);
    expect(company.body.rows).toEqual([expect.objectContaining({ merchantId: fixture.merchantId, ...totals, feeAmount: "0", exposure: expect.objectContaining({ percent: "90.0" }) })]);

    // Cảnh báo bất thường.
    const alerts = (await fixture.call("get", "/affiliate/alerts")).body as { kind: string }[];
    expect(alerts.map((alert) => alert.kind).sort()).toEqual(["cancel_rate", "credit_usage", "near_cap", "phone_declines", "same_buyer_burst", "same_buyer_burst"]);
    // Cả hai khách đều từ 3 giao dịch hoàn tất trong ngày tại cùng cửa hàng (khách thứ hai 5 giao dịch).
    expect(alerts.filter((alert) => alert.kind === "same_buyer_burst")).toEqual([
      expect.objectContaining({ day: today, count: 5, buyerPhone: "0938 *** 002" }),
      expect.objectContaining({ day: today, count: 3, buyerPhone: "0938 *** 001" }),
    ]);
    expect(alerts.find((alert) => alert.kind === "near_cap")).toMatchObject({ count: 3, total: 8, percent: "37.5", limit: "5000000" });
    expect(alerts.find((alert) => alert.kind === "cancel_rate")).toMatchObject({ count: 2, total: 10, percent: "20.0" });
    expect(alerts.find((alert) => alert.kind === "phone_declines")).toMatchObject({ count: 10, cashierName: "Lê Thu Hà" });
    expect(alerts.find((alert) => alert.kind === "credit_usage")).toMatchObject({ amount: "90000", limit: "100000", percent: "90.0" });
    expect((await fixture.call("get", "/affiliate/alerts?kind=cancel_rate")).body).toHaveLength(1);

    // Giao dịch mọi cửa hàng trên web quản trị: lọc trạng thái, cách định danh; số điện thoại khách đã che; chủ cửa hàng không xem được.
    const cancelledList = await fixture.call("get", "/affiliate/transactions?status=cancelled");
    expect(cancelledList.body.total).toBe(2);
    expect(cancelledList.body.data[0]).toMatchObject({ merchantId: fixture.merchantId, status: "cancelled", buyerPhone: "0938 *** 002", canCancel: false });
    expect((await fixture.call("get", "/affiliate/transactions?method=phone")).body.total).toBe(10);
    expect((await fixture.owner.call("get", "/affiliate/transactions")).status).toBe(403);

    // Báo trong ứng dụng cho chủ cửa hàng một lần mỗi ngày.
    const service = application.get(AffiliateReportsService);
    expect(await service.notifyCreditUsage()).toBe(1);
    expect(await service.notifyCreditUsage()).toBe(0);
  });
});

describe("TIEUCHI_NGHIEMTHU_369: đăng nhập cổng cửa hàng bằng Zalo", () => {
  it("KICHBAN_KIEMTHU_534: chủ cửa hàng liên kết Zalo từ cổng cửa hàng rồi đăng nhập bằng Zalo, quay về cổng cửa hàng", async () => {
    const server = () => request(application.getHttpServer());
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    const configured = await groupAdmin.call("put", "/integration-settings", { body: { values: { "zalo.app_id": "zalo-app", "zalo.app_secret": "zalo-secret-5555" } } });
    expect(configured.status).toBe(200);
    testOauth.profiles.set("zalo-khoa", { subject: "zalo-2001", email: null, emailVerified: false, name: "Khoa Zalo" });
    const round = async (query: string, cookie?: string) => {
      const start = server().get(`/api/v1/auth/oauth/zalo/start?${query}`);
      if (cookie) start.set("cookie", cookie);
      const started = await start;
      const state = new URL(started.headers.location as string).searchParams.get("state");
      if (!state) return started;
      return server()
        .get(`/api/v1/auth/oauth/zalo/callback?code=zalo-khoa&state=${state}`)
        .set("cookie", `vc_oauth=${cookieValue(started.headers["set-cookie"], "vc_oauth")}`);
    };
    // Chưa liên kết: quay về trang đăng nhập cổng cửa hàng kèm lỗi.
    expect((await round("mode=login&app=merchant")).headers.location).toMatch(/\/merchant\/dang-nhap\?loi=zaloNotLinked$/);
    // Chủ cửa hàng đăng nhập bằng số điện thoại và OTP rồi liên kết Zalo.
    expect((await server().post("/api/v1/auth/otp/send").send({ phone: "0909111222" })).status).toBe(204);
    await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = '+84909111222' AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex")]);
    const login = await server().post("/api/v1/auth/otp/verify").send({ phone: "0909111222", code: "246810" });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    const linked = await round("mode=link&app=merchant", `vc_access=${cookieValue(login.headers["set-cookie"], "vc_access")}`);
    expect(linked.headers.location).toMatch(/\/merchant\/counter\?lienKet=zalo$/);
    const viaZalo = await round("mode=login&app=merchant");
    expect(viaZalo.headers.location).toMatch(/\/merchant$/);
    const access = cookieValue(viaZalo.headers["set-cookie"], "vc_access");
    const me = await server().get("/api/v1/merchant-portal/me").set("cookie", `vc_access=${access}`);
    expect(me.body.memberships[0]).toMatchObject({ merchantId: fixture.merchantId, role: "owner" });
  });
});
