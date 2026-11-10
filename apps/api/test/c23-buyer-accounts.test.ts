// CONG_VIEC_23: Tài khoản người mua VComm (KICHBAN_KIEMTHU_295 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { signIn } from "./helpers";
import { startTestApplication, testClock, testRateLimit } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
const password = "MatKhauNguoiMua@2026";
const http = () => request(application.getHttpServer());
const post = (path: string, body: object) => http().post(`/api/v1${path}`).set("accept-language", "vi").send(body);
const bearer = (method: "get" | "post", path: string, token: string, body?: object) => {
  const call = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
  return body ? call.send(body) : call;
};
const hash = (code: string) => createHash("sha256").update(code).digest("hex");

// Gửi mã rồi đặt mã đang hiệu lực thành mã đã biết (môi trường kiểm thử không gửi SMS thật).
async function otp(path: string, phone: string, code = "246810") {
  const sent = await post(path, { phone });
  expect(sent.status, JSON.stringify(sent.body)).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [hash(code), `+84${phone.slice(1)}`]);
  return code;
}
async function register(phone: string, fullName: string, referralCode?: string) {
  const code = await otp("/buyer/register/otp", phone);
  return post("/buyer/register", { phone, code, fullName, password, ...(referralCode ? { referralCode } : {}) });
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_23 đăng ký người mua", () => {
  it("KICHBAN_KIEMTHU_295: đăng ký bằng số điện thoại và OTP, có phiên ứng dụng VComm 90 ngày; số đã có tài khoản bị từ chối; mã sai, mật khẩu ngắn bị từ chối; mã đăng ký không dùng để đăng nhập", async () => {
    const code = await otp("/buyer/register/otp", "0911000001");
    // Mã đăng ký không dùng được cho đăng nhập.
    expect((await post("/buyer/login/otp/verify", { phone: "0911000001", code })).status).toBe(401);
    const shortPassword = await post("/buyer/register", { phone: "0911000001", code, fullName: "Người Mua Một", password: "ngan" });
    expect(shortPassword.status).toBe(400);
    expect(shortPassword.body.error.fields.password).toBeDefined();
    const wrong = await post("/buyer/register", { phone: "0911000001", code: code === "000000" ? "111111" : "000000", fullName: "Người Mua Một", password });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.code).toBe("Mã không đúng hoặc đã hết hạn.");

    const created = await post("/buyer/register", { phone: "0911000001", code, fullName: "Người Mua Một", password });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body).toMatchObject({ mfaRequired: false, user: { fullName: "Người Mua Một" } });
    const days = (Date.parse(created.body.tokens.refreshExpiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    const session = (await pool.query("SELECT s.client_type FROM core.sessions s JOIN core.users u ON u.id = s.user_id WHERE u.phone = '+84911000001'")).rows[0];
    expect(session.client_type).toBe("vcomm_app");
    // Mã đã dùng không dùng lại được.
    expect((await post("/buyer/register", { phone: "0911000001", code, fullName: "Lần Hai", password })).status).toBe(400);

    const me = await bearer("get", "/buyer/me", created.body.tokens.accessToken);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ fullName: "Người Mua Một", phone: "0911000001", referralCode: "0911000001", referrer: null, canSetReferrer: true, isSalesStaff: false });
    // Người mua không thuộc công ty nào: không vào được mini app quản trị.
    expect((await bearer("get", "/crm/partners", created.body.tokens.accessToken)).status).toBe(403);

    // Số đã có tài khoản: không gửi mã đăng ký, báo để đăng nhập.
    const taken = await post("/buyer/register/otp", { phone: "0911000001" });
    expect(taken.status).toBe(400);
    expect(taken.body.error.fields.phone).toBe("Số điện thoại đã có tài khoản. Hãy đăng nhập.");
    // Số nước ngoài không đăng ký được.
    expect((await post("/buyer/register/otp", { phone: "+12025550123" })).status).toBe(400);
  });

  it("KICHBAN_KIEMTHU_296: mã giới thiệu là số điện thoại của tài khoản đang hoạt động; mã sai báo lỗi và giữ mã OTP; người giới thiệu xem người mình giới thiệu với số điện thoại đã che", async () => {
    const invalid = await register("0911000002", "Người Mua Hai", "0999999999");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.fields.referralCode).toBe("Mã giới thiệu không đúng.");
    // Mã OTP chưa bị dùng: sửa mã giới thiệu rồi đăng ký lại không cần mã mới.
    const ok = await post("/buyer/register", { phone: "0911000002", code: "246810", fullName: "Người Mua Hai", password, referralCode: "+84911000001" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const history = await pool.query("SELECT source, previous_referrer_id FROM marketplace.referrer_history h JOIN core.users u ON u.id = h.buyer_user_id WHERE u.phone = '+84911000002'");
    expect(history.rows).toEqual([{ source: "registration", previous_referrer_id: null }]);
    const me = await bearer("get", "/buyer/me", ok.body.tokens.accessToken);
    expect(me.body).toMatchObject({ referrer: { fullName: "Người Mua Một", maskedPhone: "0911***001" }, canSetReferrer: false });

    const referrer = await post("/buyer/login", { phone: "0911000001", password });
    expect(referrer.status).toBe(200);
    const referrals = await bearer("get", "/buyer/referrals", referrer.body.tokens.accessToken);
    expect(referrals.body).toEqual([{ fullName: "Người Mua Hai", maskedPhone: "0911***002", registeredAt: expect.any(String) }]);
    // Chưa được đánh dấu nhân viên kinh doanh thì không xem được khách phụ trách.
    expect((await bearer("get", "/buyer/sales/customers", referrer.body.tokens.accessToken)).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_298 (phần người mua): khách chưa có người giới thiệu tự nhập mã một lần; không tự giới thiệu mình, không chọn người mình đã giới thiệu", async () => {
    const first = await post("/buyer/login", { phone: "0911000001", password });
    const token = first.body.tokens.accessToken as string;
    const self = await bearer("post", "/buyer/referrer", token, { referralCode: "0911000001" });
    expect(self.status).toBe(400);
    expect(self.body.error.fields.referralCode).toBe("Không dùng được mã giới thiệu của chính mình.");
    const cycle = await bearer("post", "/buyer/referrer", token, { referralCode: "0911000002" });
    expect(cycle.body.error.fields.referralCode).toBe("Không chọn được người mà chính bạn đã giới thiệu.");
    const third = await register("0911000003", "Người Mua Ba");
    expect(third.status).toBe(200);
    const set = await bearer("post", "/buyer/referrer", token, { referralCode: "0911000003" });
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    expect(set.body).toMatchObject({ referrer: { fullName: "Người Mua Ba", maskedPhone: "0911***003" }, canSetReferrer: false });
    const again = await bearer("post", "/buyer/referrer", token, { referralCode: "0911000002" });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe("Tài khoản đã có người giới thiệu.");
  });
});

describe("CONG_VIEC_23 đăng nhập người mua", () => {
  it("KICHBAN_KIEMTHU_297: đăng nhập bằng mật khẩu, bằng OTP; quên mật khẩu bằng OTP thu hồi mọi phiên; làm mới đồng thời cùng một token chỉ một yêu cầu thành công và chuỗi phiên bị thu hồi", async () => {
    const wrong = await post("/buyer/login", { phone: "0911000003", password: "SaiMatKhau@2026" });
    expect(wrong.status).toBe(401);
    const byPassword = await post("/buyer/login", { phone: "0911000003", password });
    expect(byPassword.status).toBe(200);
    const code = await otp("/buyer/login/otp", "0911000003", "135790");
    const byOtp = await post("/buyer/login/otp/verify", { phone: "0911000003", code });
    expect(byOtp.status, JSON.stringify(byOtp.body)).toBe(200);
    expect(byOtp.body.tokens.refreshToken).toBeDefined();

    // Làm mới cùng một token hai lần cùng lúc: một lần thành công, lần kia bị coi là dùng lại và thu hồi cả chuỗi.
    const refreshToken = byOtp.body.tokens.refreshToken as string;
    const results = await Promise.all([1, 2].map(() => post("/auth/app/refresh", { refreshToken })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 401]);
    const winner = results.find((result) => result.status === 200)!;
    expect((await post("/auth/app/refresh", { refreshToken: winner.body.refreshToken })).status).toBe(401);

    // Quên mật khẩu: số không có tài khoản vẫn trả 204; đặt lại thu hồi mọi phiên.
    expect((await post("/buyer/password-reset/otp", { phone: "0911999999" })).status).toBe(204);
    const resetCode = await otp("/buyer/password-reset/otp", "0911000003", "975310");
    expect((await post("/buyer/password-reset", { phone: "0911000003", code: "000001", password: "MatKhauMoi@2026" })).status).toBe(400);
    const reset = await post("/buyer/password-reset", { phone: "0911000003", code: resetCode, password: "MatKhauMoi@2026" });
    expect(reset.status, JSON.stringify(reset.body)).toBe(204);
    expect((await bearer("get", "/buyer/me", byPassword.body.tokens.accessToken)).status).toBe(401);
    expect((await post("/buyer/login", { phone: "0911000003", password })).status).toBe(401);
    expect((await post("/buyer/login", { phone: "0911000003", password: "MatKhauMoi@2026" })).status).toBe(200);
  });

  it("KICHBAN_KIEMTHU_297 (giới hạn): các đường dẫn đăng nhập trên web và ứng dụng dùng chung một bộ đếm số lần gọi theo địa chỉ IP", async () => {
    const saved = testRateLimit.perMinute;
    testRateLimit.perMinute = 2;
    testClock.fixed = new Date("2026-11-09T04:10:05Z");
    try {
      expect((await post("/auth/login", { identifier: "khong.co@vcomm.test", password })).status).toBe(401);
      expect((await post("/buyer/login", { phone: "0911000003", password })).status).toBe(401);
      const blocked = await post("/auth/app/login", { identifier: "khong.co@vcomm.test", password });
      expect(blocked.status).toBe(429);
    } finally {
      testRateLimit.perMinute = saved;
      testClock.fixed = null;
    }
  });
});

describe("CONG_VIEC_23 quản trị người mua", () => {
  const retail: string = testIds.retailCompany;

  it("KICHBAN_KIEMTHU_298 (phần quản trị): chưa đặt công ty vận hành sàn thì chưa quản trị được; quản trị đổi người giới thiệu bắt buộc lý do, kiểm tra phiên bản, ghi lịch sử", async () => {
    const group = await signIn(application, "quantri.tapdoan@vcomm.test");
    const company = await signIn(application, "quantri.vcr@vcomm.test");
    expect((await company.call("get", "/marketplace/buyers", { companyId: retail })).status).toBe(409);
    // Quản trị công ty không đặt được công ty vận hành sàn; quản trị tập đoàn đặt được.
    expect((await company.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(403);
    const set = await group.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } });
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    expect(set.body.operatorCompany.id).toBe(retail);

    const list = await company.call("get", "/marketplace/buyers?search=0911000002", { companyId: retail });
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.data).toEqual([expect.objectContaining({ fullName: "Người Mua Hai", phone: "0911000002", referrerName: "Người Mua Một", referrerPhone: "0911000001", isSalesStaff: false })]);
    const id = list.body.data[0].id as string;
    const detail = await company.call("get", `/marketplace/buyers/${id}`, { companyId: retail });
    expect(detail.body.referrerHistory).toHaveLength(1);

    expect((await company.call("post", `/marketplace/buyers/${id}/referrer`, { companyId: retail, body: { referralCode: "0911000003", reason: "", version: detail.body.version } })).status).toBe(400);
    expect((await company.call("post", `/marketplace/buyers/${id}/referrer`, { companyId: retail, body: { referralCode: "0911000003", reason: "Khách xác nhận", version: 99 } })).status).toBe(409);
    const changed = await company.call("post", `/marketplace/buyers/${id}/referrer`, {
      companyId: retail,
      body: { referralCode: "0911000003", reason: "Khách xác nhận người giới thiệu", version: detail.body.version },
    });
    expect(changed.status, JSON.stringify(changed.body)).toBe(200);
    expect(changed.body).toMatchObject({ referrerName: "Người Mua Ba", version: detail.body.version + 1 });
    expect(changed.body.referrerHistory[0]).toMatchObject({
      previousReferrerName: "Người Mua Một",
      newReferrerName: "Người Mua Ba",
      source: "admin",
      reason: "Khách xác nhận người giới thiệu",
      changedByName: "Trần Minh Quân",
    });
    // Để trống người giới thiệu.
    const cleared = await company.call("post", `/marketplace/buyers/${id}/referrer`, { companyId: retail, body: { referralCode: null, reason: "Khách yêu cầu bỏ", version: changed.body.version } });
    expect(cleared.body.referrerName).toBeNull();
    // Người không có quyền quản trị người mua.
    const purchasing = await signIn(application, "phuc.le@vcomm.test");
    expect((await purchasing.call("get", "/marketplace/buyers", { companyId: retail })).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_299: đánh dấu nhân viên kinh doanh cấp vai trò Nhân viên bán hàng và phòng ban ở công ty vận hành sàn; khách tôi phụ trách theo người giới thiệu; bỏ đánh dấu gỡ vai trò; công ty vận hành sàn không đổi được khi còn nhân viên được đánh dấu", async () => {
    const company = await signIn(application, "quantri.vcr@vcomm.test");
    const department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KD-SAN', 'Kinh doanh sàn') RETURNING id", [retail])).rows[0]!.id;
    const buyerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE phone = '+84911000001'")).rows[0]!.id;
    const before = await company.call("get", `/marketplace/buyers/${buyerId}`, { companyId: retail });
    const otherCompanyDepartment = (
      await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KD-KHAC', 'Phòng công ty khác') RETURNING id", [testIds.tradingCompany])
    ).rows[0]!.id;
    expect((await company.call("post", `/marketplace/buyers/${buyerId}/sales-flag`, { companyId: retail, body: { departmentId: otherCompanyDepartment, version: before.body.version } })).status).toBe(
      400,
    );
    const flagged = await company.call("post", `/marketplace/buyers/${buyerId}/sales-flag`, { companyId: retail, body: { departmentId: department, version: before.body.version } });
    expect(flagged.status, JSON.stringify(flagged.body)).toBe(200);
    expect(flagged.body).toMatchObject({ isSalesStaff: true, salesDepartmentName: "Kinh doanh sàn" });
    const membership = (await pool.query("SELECT status, department_id, is_default FROM core.user_company_memberships WHERE user_id = $1 AND company_id = $2", [buyerId, retail])).rows[0];
    expect(membership).toEqual({ status: "active", department_id: department, is_default: true });
    const roles = await pool.query("SELECT r.code FROM core.user_role_assignments a JOIN core.roles r ON r.id = a.role_id WHERE a.user_id = $1 AND a.company_id = $2 AND a.valid_to IS NULL", [
      buyerId,
      retail,
    ]);
    expect(roles.rows).toEqual([{ code: "salesperson" }]);

    // Gắn lại 0911000001 làm người giới thiệu của 0911000002 (đã bỏ ở KICHBAN_KIEMTHU_298): đó là khách 0911000001 phụ trách.
    const customerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE phone = '+84911000002'")).rows[0]!.id;
    const customer = await company.call("get", `/marketplace/buyers/${customerId}`, { companyId: retail });
    expect((await company.call("post", `/marketplace/buyers/${customerId}/referrer`, { companyId: retail, body: { referralCode: "0911000001", reason: "Gắn lại", version: customer.body.version } })).status).toBe(200);
    const login = await post("/buyer/login", { phone: "0911000001", password });
    const token = login.body.tokens.accessToken as string;
    expect((await bearer("get", "/buyer/me", token)).body.isSalesStaff).toBe(true);
    const customers = await bearer("get", "/buyer/sales/customers", token);
    expect(customers.status).toBe(200);
    expect(customers.body).toEqual([expect.objectContaining({ fullName: "Người Mua Hai", phone: "0911000002" })]);

    const group = await signIn(application, "quantri.tapdoan@vcomm.test");
    const blocked = await group.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: testIds.tradingCompany } });
    expect(blocked.status).toBe(409);

    const unflagged = await company.call("delete", `/marketplace/buyers/${buyerId}/sales-flag`, { companyId: retail, body: { version: flagged.body.version } });
    expect(unflagged.status, JSON.stringify(unflagged.body)).toBe(200);
    expect(unflagged.body.isSalesStaff).toBe(false);
    expect(unflagged.body.salesFlagHistory.map((item: { action: string }) => item.action)).toEqual(["unflag", "flag"]);
    const left = await pool.query("SELECT 1 FROM core.user_role_assignments WHERE user_id = $1 AND company_id = $2 AND (valid_to IS NULL OR valid_to >= current_date)", [buyerId, retail]);
    expect(left.rows).toHaveLength(0);
    expect((await pool.query("SELECT status FROM core.user_company_memberships WHERE user_id = $1 AND company_id = $2", [buyerId, retail])).rows[0].status).toBe("inactive");
    expect((await bearer("get", "/buyer/sales/customers", token)).status).toBe(403);
  });
});
