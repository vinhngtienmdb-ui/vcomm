// CONG_VIEC_72 lát L1: Smart OTP ở schema core, tham số chuyển đổi, thống kê (KICHBAN_KIEMTHU_749; TIEUCHI_NGHIEMTHU_545; API_323).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { type Session, signIn } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
const retail = testIds.retailCompany;
const http = () => request(application.getHttpServer());
const post = (path: string, body: object) => http().post(`/api/v1${path}`).set("accept-language", "vi").send(body);
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const settings = (session: Session) => session.call("get", "/marketplace/authentication-settings", { companyId: retail });
const save = (session: Session, body: object) => session.call("put", "/marketplace/authentication-settings", { companyId: retail, body });

async function registerBuyer(phone: string, fullName: string): Promise<string> {
  expect((await post("/buyer/register/otp", { phone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [hash("135790"), `+84${phone.slice(1)}`]);
  const created = await post("/buyer/register", { phone, code: "135790", fullName, password: "MatKhauNguoiMua@2026" });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  return created.body.tokens.accessToken as string;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  expect(
    (await groupAdmin.call("put", "/integration-settings", { body: { values: { "esms.api_key": "API-KEY-0001", "esms.secret_key": "SECRET-0002", "esms.brandname": "VCOMM" } } })).status,
  ).toBe(200);
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_72 lát L1", () => {
  it("database migration: Smart OTP ở schema core, thiết bị tin cậy, trạng thái bảo mật tài khoản, tham số mặc định", async () => {
    const tables = await pool.query(
      "SELECT table_schema || '.' || table_name AS name FROM information_schema.tables WHERE table_name IN ('smart_otp_devices', 'trusted_devices', 'account_security', 'authentication_settings', 'smart_otp_reminders')",
    );
    expect(tables.rows.map((row) => row.name).sort()).toEqual([
      "core.account_security",
      "core.authentication_settings",
      "core.smart_otp_devices",
      "core.smart_otp_reminders",
      "core.trusted_devices",
    ]);
    const row = (await pool.query("SELECT buyer_transition_days, portal_transition_days, recovery_redeem_lock_hours, support_hotline, version FROM core.authentication_settings")).rows;
    expect(row).toEqual([{ buyer_transition_days: 30, portal_transition_days: 30, recovery_redeem_lock_hours: 24, support_hotline: null, version: 1 }]);
    expect((await pool.query("SELECT is_sensitive FROM core.permissions WHERE code = 'marketplace.buyer.security'")).rows).toEqual([{ is_sensitive: true }]);
  });

  it("kích hoạt Smart OTP ghi bảng core, nền tảng và lần kích hoạt đầu tiên của tài khoản", async () => {
    const token = await registerBuyer("0917200001", "Khách Smart OTP");
    const bearer = (path: string, body?: object) =>
      (body ? http().post(`/api/v1${path}`).send(body) : http().post(`/api/v1${path}`)).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    expect((await bearer("/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
    await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = '+84917200001' AND purpose = 'smart_otp' AND consumed_at IS NULL", [hash("246802")]);
    const activated = await bearer("/buyer/loyalty/smart-otp/activate", { code: "246802", deviceName: "iPhone" });
    expect(activated.status, JSON.stringify(activated.body)).toBe(201);
    const device = (await pool.query("SELECT d.platform, s.smart_otp_first_activated_at IS NOT NULL AS first FROM core.smart_otp_devices d JOIN core.account_security s USING (user_id) JOIN core.users u ON u.id = d.user_id WHERE u.phone = '+84917200001'")).rows;
    expect(device).toEqual([{ platform: "ios", first: true }]);
    // Tin SMS ghi mục đích mã OTP để thống kê.
    const purposes = (await pool.query("SELECT otp_purpose, status FROM core.message_deliveries WHERE phone_masked = '+8491***0001' ORDER BY created_at")).rows;
    expect(purposes).toEqual([
      { otp_purpose: "register", status: "sent" },
      { otp_purpose: "smart_otp", status: "sent" },
    ]);
  });

  it("KICHBAN_KIEMTHU_749: xem, sửa tham số chuyển đổi đúng phạm vi giá trị, phiên bản, ngày bắt đầu không sau hôm nay, có nhật ký; thống kê đúng số; phân quyền", async () => {
    testClock.fixed = new Date("2026-11-18T03:00:00Z");
    await pool.query("UPDATE core.authentication_settings SET transition_starts_on = '2026-11-18'");
    const viewed = await settings(groupAdmin);
    expect(viewed.status, JSON.stringify(viewed.body)).toBe(200);
    expect(viewed.body).toMatchObject({
      transitionStartsOn: "2026-11-18",
      buyerTransitionDays: 30,
      buyerTransitionEndsOn: "2026-12-17",
      portalTransitionEndsOn: "2026-12-17",
      recoveryRedeemLockHours: 24,
      supportHotline: null,
      version: 1,
      canManage: true,
    });
    const statistics = viewed.body.statistics;
    expect(statistics.smartOtpActive).toBe(1);
    expect(statistics.smartOtpOnWeb).toBe(0);
    expect(statistics.activeBuyers).toBeGreaterThanOrEqual(1);
    expect(statistics.smsLast30Days).toEqual([
      { purpose: "register", count: 1 },
      { purpose: "smart_otp", count: 1 },
      { purpose: "login", count: 0 },
      { purpose: "password_reset", count: 0 },
      { purpose: "affiliate_redeem", count: 0 },
    ]);

    const body = { transitionStartsOn: "2026-11-18", buyerTransitionDays: 45, portalTransitionDays: 20, recoveryRedeemLockHours: 48, supportHotline: "1900 1234", version: 1 };
    // Phạm vi giá trị.
    expect((await save(groupAdmin, { ...body, buyerTransitionDays: 0 })).status).toBe(400);
    expect((await save(groupAdmin, { ...body, portalTransitionDays: 181 })).status).toBe(400);
    expect((await save(groupAdmin, { ...body, recoveryRedeemLockHours: 169 })).status).toBe(400);
    expect((await save(groupAdmin, { ...body, supportHotline: "12345" })).status).toBe(400);
    // Ngày bắt đầu sau hôm nay (giờ Việt Nam) bị từ chối.
    const future = await save(groupAdmin, { ...body, transitionStartsOn: "2026-11-19" });
    expect(future.status).toBe(400);
    expect(future.body.error.fields.transitionStartsOn).toBe("Ngày bắt đầu chuyển đổi không được sau hôm nay.");

    const saved = await save(groupAdmin, body);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toMatchObject({ buyerTransitionDays: 45, buyerTransitionEndsOn: "2027-01-01", portalTransitionEndsOn: "2026-12-07", recoveryRedeemLockHours: 48, supportHotline: "19001234", version: 2 });
    // Phiên bản cũ.
    expect((await save(groupAdmin, body)).status).toBe(409);
    // Để trống số tổng đài.
    expect((await save(groupAdmin, { ...body, supportHotline: "", version: 2 })).body.supportHotline).toBeNull();
    const audit = (await pool.query("SELECT before_data, after_data FROM core.audit_events WHERE action = 'authentication_settings.update' ORDER BY occurred_at")).rows;
    expect(audit).toHaveLength(2);
    expect(audit[0].before_data).toMatchObject({ buyerTransitionDays: 30, supportHotline: null });
    expect(audit[0].after_data).toMatchObject({ buyerTransitionDays: 45, supportHotline: "19001234" });

    // Người không có quyền người mua: không xem được. Quản trị công ty vận hành sàn có quyền xem, sửa.
    const staff = await signIn(application, "phuc.le@vcomm.test");
    expect((await settings(staff)).status).toBe(403);
    expect((await save(staff, { ...body, version: 3 })).status).toBe(403);
    const companyAdmin = await signIn(application, "quantri.vcr@vcomm.test");
    expect((await settings(companyAdmin)).body.canManage).toBe(true);
    // Chỉ có quyền xem: không sửa được.
    await pool.query(
      `DELETE FROM core.role_permissions WHERE permission_code = 'marketplace.buyer.manage' AND role_id IN (SELECT role_id FROM core.user_role_assignments a JOIN core.users u ON u.id = a.user_id WHERE u.email = 'quantri.vcr@vcomm.test')`,
    );
    const viewer = await signIn(application, "quantri.vcr@vcomm.test");
    expect((await settings(viewer)).body.canManage).toBe(false);
    expect((await save(viewer, { ...body, version: 3 })).status).toBe(403);
  });
});
