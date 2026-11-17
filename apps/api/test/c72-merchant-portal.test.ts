// CONG_VIEC_72 lát L6: cổng cửa hàng liên kết đăng nhập bằng mật khẩu và ứng dụng xác thực
// (KICHBAN_KIEMTHU_745, 746, 747; TIEUCHI_NGHIEMTHU_543; QUYTAC_NGHIEPVU_570; API_324, API_325).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { sessionFrom, type Session } from "./helpers";
import { authenticatorCode, completePortalSetup, portalPassword } from "./portal-setup";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let affiliate: AffiliateFixture;
const http = () => request(application.getHttpServer());
const e164 = (phone: string) => `+84${phone.slice(1)}`;
const knownOtp = async (phone: string) => {
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), e164(phone)]);
};
const passwordLogin = async (phone: string, password = portalPassword) => {
  const response = await http().post("/api/v1/auth/login").send({ identifier: phone, password });
  return { response, session: response.status === 200 ? sessionFrom(application, response.headers["set-cookie"]) : (null as unknown as Session) };
};
// Kích hoạt bằng mã SMS (lời mời hoặc sau khi bị đặt lại xác thực); trả phiên kích hoạt chưa thiết lập.
const activateOnly = async (phone: string) => {
  expect((await http().post("/api/v1/merchant-portal/activation/otp").send({ phone })).status).toBe(204);
  await knownOtp(phone);
  const response = await http().post("/api/v1/merchant-portal/activation").send({ phone, code: "246810" });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return { response, session: sessionFrom(application, response.headers["set-cookie"]) };
};
const members = async (session: Session) => (await session.call("get", "/merchant-portal/store")).body.members as { id: string; phone: string; role: string; version: number; securitySetUp: boolean | null }[];
const portalWindow = (startsOn: string) => pool.query("UPDATE core.authentication_settings SET transition_starts_on = $1, portal_transition_days = 30", [startsOn]);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  affiliate = await prepareAffiliate(application, pool);
  await portalWindow(today());
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_72 lát L6 cổng cửa hàng liên kết", () => {
  it("KICHBAN_KIEMTHU_745: đăng nhập mật khẩu rồi mã ứng dụng xác thực hoặc mã dự phòng; người mua cùng người không bị hỏi mã trên ứng dụng VComm", async () => {
    // Chủ cửa hàng đã thiết lập khi kích hoạt: mật khẩu đúng vẫn phải nhập mã, chưa nhập thì không vào cổng.
    const { response, session } = await passwordLogin("0909111222");
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ mfaRequired: true, mfaEnrolled: true });
    expect((await session.call("get", "/merchant-portal/me")).status).toBe(401);
    expect((await session.call("get", "/merchant-portal/security")).body.status).toBe("mfa_pending");
    expect((await session.call("post", "/auth/mfa/verify", { body: { code: "000000" } })).status).toBe(400);
    expect((await session.call("post", "/auth/mfa/verify", { body: { code: affiliate.authenticator("0909111222") } })).status).toBe(204);
    expect((await session.call("get", "/merchant-portal/me")).status).toBe(200);
    expect((await session.call("get", "/merchant-portal/security")).body.status).toBe("set_up");

    // Người mua đã có tài khoản ứng dụng VComm được mời làm thu ngân: giữ mật khẩu sẵn có, chỉ đăng ký ứng dụng xác thực.
    const buyer = await affiliate.register("0938720101", "Thu Ngân Kiêm Người Mua");
    expect((await affiliate.owner.call("post", "/merchant-portal/members", { body: { fullName: "Thu Ngân Kiêm Người Mua", phone: "0938720101", outletIds: [affiliate.outletA] } })).status).toBe(201);
    const activated = await activateOnly("0938720101");
    expect(activated.response.body).toMatchObject({ mfaRequired: true, mfaEnrolled: false });
    expect((await activated.session.call("get", "/merchant-portal/security")).body).toMatchObject({ status: "required", needsPassword: false, needsAuthenticator: true });
    const setup = (await completePortalSetup(activated.session))!;
    expect(setup.backupCodes).toHaveLength(10);
    // Mã dự phòng dùng một lần.
    const first = await passwordLogin("0938720101", "MatKhauNguoiMua@2026");
    expect((await first.session.call("post", "/auth/mfa/verify", { body: { backupCode: setup.backupCodes[0] } })).status).toBe(204);
    expect((await first.session.call("get", "/merchant-portal/me")).status).toBe(200);
    const again = await passwordLogin("0938720101", "MatKhauNguoiMua@2026");
    expect((await again.session.call("post", "/auth/mfa/verify", { body: { backupCode: setup.backupCodes[0] } })).status).toBe(400);
    // Ứng dụng VComm: cùng tài khoản, không hỏi mã ứng dụng xác thực (máy đã tin cậy từ lúc đăng ký).
    const app = await http().post("/api/v1/buyer/login").send({ phone: "0938720101", password: "MatKhauNguoiMua@2026" });
    expect(app.status).toBe(200);
    expect(app.body).toMatchObject({ mfaRequired: false, deviceVerificationRequired: false });
    expect((await buyer.call("get", "/buyer/loyalty/smart-otp")).status).toBe(200);
  });

  it("KICHBAN_KIEMTHU_746: kích hoạt lời mời phải thiết lập; tài khoản có sẵn trong hạn được \"Để sau\"; hết hạn cổng từ chối mã SMS", async () => {
    // Lời mời mới: phiên kích hoạt chỉ dùng cho các bước thiết lập.
    expect((await affiliate.owner.call("post", "/merchant-portal/members", { body: { fullName: "Phạm Văn Tú", phone: "0933555777", outletIds: [affiliate.outletA] } })).status).toBe(201);
    const invited = await activateOnly("0933555777");
    expect(invited.response.body).toMatchObject({ mfaRequired: true, mfaEnrolled: false });
    expect((await invited.session.call("get", "/merchant-portal/me")).status).toBe(401);
    expect((await invited.session.call("get", "/merchant-portal/security")).body).toMatchObject({ status: "required", needsPassword: true, needsAuthenticator: true });
    expect((await invited.session.call("post", "/merchant-portal/security/password", { body: { password: "ngan" } })).status).toBe(400);
    await completePortalSetup(invited.session);
    expect((await invited.session.call("get", "/merchant-portal/me")).status).toBe(200);
    // Mật khẩu đã đặt thì không đặt lại bằng bước thiết lập.
    expect((await invited.session.call("post", "/merchant-portal/security/password", { body: { password: "MatKhauKhac@2026" } })).status).toBe(409);

    // Tài khoản có sẵn khi triển khai (chưa có mật khẩu, chưa có ứng dụng xác thực): trong hạn vẫn đăng nhập bằng mã SMS.
    const legacy = (await pool.query<{ user_id: string }>("SELECT user_id FROM affiliate.members WHERE phone = $1", [e164("0933555777")])).rows[0]!.user_id;
    await pool.query("DELETE FROM core.mfa_factors WHERE user_id = $1", [legacy]);
    await pool.query("DELETE FROM core.user_identities WHERE user_id = $1 AND provider = 'password'", [legacy]);
    const policy = await http().get("/api/v1/merchant-portal/authentication-policy");
    expect(policy.body.smsLoginOpen).toBe(true);
    expect((await http().post("/api/v1/auth/otp/send").send({ phone: "0933555777", app: "merchant" })).status).toBe(204);
    // Tin SMS đăng nhập cổng tính riêng trong thống kê (máy kiểm thử chưa cài eSMS: tin ghi "bỏ qua").
    expect((await pool.query("SELECT count(*)::int AS total FROM core.message_deliveries WHERE otp_purpose = 'merchant_portal'")).rows[0].total).toBe(1);
    await knownOtp("0933555777");
    const sms = await http().post("/api/v1/auth/otp/verify").send({ phone: "0933555777", code: "246810", app: "merchant" });
    expect(sms.status).toBe(200);
    expect(sms.body.mfaRequired).toBe(false);
    const legacySession = sessionFrom(application, sms.headers["set-cookie"]);
    const optional = (await legacySession.call("get", "/merchant-portal/security")).body;
    expect(optional).toMatchObject({ status: "optional", needsPassword: true, needsAuthenticator: true, daysLeft: 30 });
    expect((await legacySession.call("get", "/merchant-portal/me")).status).toBe(200);
    expect((await legacySession.call("get", "/merchant-portal/transactions")).status).toBe(200);

    // Hết hạn cổng: không gửi, không nhận mã SMS từ cổng; phiên chưa thiết lập không vào được cổng.
    await portalWindow("2026-01-01");
    expect((await http().get("/api/v1/merchant-portal/authentication-policy")).body).toEqual({ transitionEndsOn: "2026-01-30", smsLoginOpen: false });
    const refused = await http().post("/api/v1/auth/otp/send").set("accept-language", "vi").send({ phone: "0933555777", app: "merchant" });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe("Cổng cửa hàng không còn đăng nhập bằng mã SMS. Đăng nhập bằng mật khẩu và mã ứng dụng xác thực.");
    expect((await http().post("/api/v1/auth/otp/verify").send({ phone: "0933555777", code: "246810", app: "merchant" })).status).toBe(409);
    const blocked = await legacySession.call("get", "/merchant-portal/me");
    expect(blocked.status).toBe(409);
    expect((await legacySession.call("get", "/merchant-portal/security")).body.status).toBe("blocked");
    expect((await legacySession.call("post", "/merchant-portal/security/password", { body: { password: portalPassword } })).status).toBe(409);
    // Không tự đăng ký ứng dụng xác thực bằng phiên không qua mã SMS kích hoạt (rà soát bảo mật).
    expect((await legacySession.call("post", "/auth/mfa/enroll")).status).toBe(409);
    // Tài khoản đã thiết lập vẫn dùng cổng bình thường.
    expect((await affiliate.owner.call("get", "/merchant-portal/me")).status).toBe(200);
    await portalWindow(today());
  });

  it("KICHBAN_KIEMTHU_747: đặt lại xác thực (chủ cho thu ngân, công ty cho chủ, không cho cửa hàng khác); quên mật khẩu cổng", async () => {
    const list = await members(affiliate.owner);
    const cashier = list.find((member) => member.phone === e164("0912333444"))!;
    const owner = list.find((member) => member.role === "owner")!;
    expect(cashier.securitySetUp).toBe(true);
    // Chủ không đặt lại được chủ (kể cả chính mình).
    expect((await affiliate.owner.call("post", `/merchant-portal/members/${owner.id}/reset-authentication`, { body: { version: owner.version } })).status).toBe(403);
    // Chủ cửa hàng khác không đặt lại được thu ngân của cửa hàng này.
    const otherMerchant = await affiliate.createMerchant("Cửa hàng Khác", "0312345999", "HD-KHAC-01");
    await pool.query("UPDATE affiliate.merchants SET status = 'active' WHERE id = $1", [otherMerchant]);
    await affiliate.call("post", `/affiliate/merchants/${otherMerchant}/owner-invitations`, { fullName: "Chủ Khác", phone: "0909888777" });
    const otherOwner = await affiliate.activate("0909888777");
    expect((await otherOwner.call("post", `/merchant-portal/members/${cashier.id}/reset-authentication`, { body: { version: cashier.version } })).status).toBe(404);

    // Chủ đặt lại cho thu ngân: xóa ứng dụng xác thực, thu hồi phiên, ghi nhật ký.
    const reset = await affiliate.owner.call("post", `/merchant-portal/members/${cashier.id}/reset-authentication`, { body: { version: cashier.version } });
    expect(reset.status).toBe(201);
    expect(reset.body.find((member: { id: string }) => member.id === cashier.id).securitySetUp).toBe(false);
    expect((await affiliate.cashier.call("get", "/merchant-portal/me")).status).toBe(401);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE action = 'merchant_portal.authentication_reset' AND entity_id = $1", [cashier.id])).rows[0].total).toBe(1);
    // Mật khẩu cũ đúng nhưng chưa thiết lập lại: phiên không vào được cổng.
    const stale = await passwordLogin("0912333444");
    expect(stale.response.body.mfaRequired).toBe(false);
    expect((await stale.session.call("get", "/merchant-portal/me")).status).toBe(409);
    expect((await stale.session.call("post", "/auth/mfa/enroll")).status).toBe(409);
    // Lần vào tới: mã SMS một lần ở thẻ Kích hoạt, đặt mật khẩu mới, đăng ký ứng dụng xác thực mới.
    const reactivated = await activateOnly("0912333444");
    expect((await reactivated.session.call("get", "/merchant-portal/security")).body).toMatchObject({ status: "required", needsPassword: true, needsAuthenticator: true });
    const renewed = (await completePortalSetup(reactivated.session, "MatKhauMoi@2026"))!;
    expect((await reactivated.session.call("get", "/merchant-portal/me")).status).toBe(200);
    expect((await members(affiliate.owner)).find((member) => member.id === cashier.id)!.securitySetUp).toBe(true);

    // Công ty (affiliate.manage) đặt lại cho chủ; tài khoản nhân viên bắt buộc xác thực hai lớp thì không.
    const detail = await affiliate.call("get", `/affiliate/merchants/${affiliate.merchantId}`);
    const ownerRow = detail.body.members.find((member: { role: string }) => member.role === "owner");
    const ownerUser = (await pool.query<{ user_id: string }>("SELECT user_id FROM affiliate.members WHERE id = $1", [ownerRow.id])).rows[0]!.user_id;
    await pool.query("UPDATE core.users SET mfa_required = true WHERE id = $1", [ownerUser]);
    expect((await affiliate.call("post", `/affiliate/merchants/${affiliate.merchantId}/members/${ownerRow.id}/reset-authentication`, { version: ownerRow.version })).status).toBe(409);
    await pool.query("UPDATE core.users SET mfa_required = false WHERE id = $1", [ownerUser]);
    const byCompany = await affiliate.call("post", `/affiliate/merchants/${affiliate.merchantId}/members/${ownerRow.id}/reset-authentication`, { version: ownerRow.version });
    expect(byCompany.status).toBe(201);
    expect(byCompany.body.find((member: { id: string }) => member.id === ownerRow.id).securitySetUp).toBe(false);
    // Cửa hàng không thuộc công ty vận hành: không thấy thành viên.
    expect((await affiliate.call("post", `/affiliate/merchants/${otherMerchant}/members/${ownerRow.id}/reset-authentication`, { version: ownerRow.version + 1 })).status).toBe(404);

    // Quên mật khẩu cổng: mã ứng dụng xác thực sai, số không có tài khoản cổng cùng một lỗi; đúng thì đặt mật khẩu, thu hồi phiên.
    const forgot = (body: object) => http().post("/api/v1/merchant-portal/password-reset").set("accept-language", "vi").send(body);
    expect((await forgot({ phone: "0912333444", code: "000000", password: "MatKhauQuen@2026" })).body.error.fields).toEqual({ code: "Mã xác thực không đúng." });
    expect((await forgot({ phone: "0900000123", code: "123456", password: "MatKhauQuen@2026" })).status).toBe(400);
    expect((await forgot({ phone: "0912333444", code: authenticatorCode(renewed.secret), password: "ngan" })).status).toBe(400);
    expect((await forgot({ phone: "0912333444", code: authenticatorCode(renewed.secret), password: "MatKhauQuen@2026" })).status).toBe(204);
    expect((await reactivated.session.call("get", "/merchant-portal/me")).status).toBe(401);
    expect((await passwordLogin("0912333444", "MatKhauMoi@2026")).response.status).toBe(401);
    const fresh = await passwordLogin("0912333444", "MatKhauQuen@2026");
    expect(fresh.response.body.mfaRequired).toBe(true);
    // Mã dự phòng cũng dùng được; sai 5 lần trong 15 phút (tính cả lần sai ở trên) thì tạm khóa.
    expect((await forgot({ phone: "0912333444", backupCode: renewed.backupCodes[1], password: "MatKhauQuen2@2026" })).status).toBe(204);
    for (let attempt = 0; attempt < 4; attempt += 1) expect((await forgot({ phone: "0912333444", code: "000000", password: "MatKhauQuen3@2026" })).status).toBe(400);
    expect((await forgot({ phone: "0912333444", code: authenticatorCode(renewed.secret), password: "MatKhauQuen3@2026" })).status).toBe(423);
  });
});
