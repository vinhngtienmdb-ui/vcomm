// CONG_VIEC_72 lát L3: đăng nhập trên thiết bị mới, thiết bị tin cậy, quên mật khẩu bằng Smart OTP
// (KICHBAN_KIEMTHU_739 đến 741; TIEUCHI_NGHIEMTHU_538, 539; QUYTAC_NGHIEPVU_560, 564, 565, 568; API_117, API_318, API_321).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deviceHashOf } from "../src/common/device-hash";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
const password = "MatKhauNguoiMua@2026";
const phoneOf = (local: string) => `+84${local.slice(1)}`;
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const codeAt = (secret: string, timestamp: number) => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({ timestamp });
const http = () => request(application.getHttpServer());
const post = (path: string, body: object, device: string) => http().post(`/api/v1${path}`).set("accept-language", "vi").set("x-device-id", device).send(body);
const authed = (token: string, device: string) => ({
  get: (path: string) => http().get(`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi").set("x-device-id", device),
  post: (path: string, body?: object) => http().post(`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi").set("x-device-id", device).send(body ?? {}),
  delete: (path: string) => http().delete(`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi").set("x-device-id", device),
});

const homePhone = "may-nha-00000000000000001";
const strangerPhone = "may-la-000000000000000002";

async function setCode(local: string, purpose: string, code: string) {
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = $3 AND consumed_at IS NULL", [hash(code), phoneOf(local), purpose]);
}

// Đăng ký trên máy nhà; kèm Smart OTP thì trả khóa.
async function register(local: string, withSmartOtp: boolean) {
  expect((await post("/buyer/register/otp", { phone: local }, homePhone)).status).toBe(204);
  await setCode(local, "register", "112233");
  const created = await post(
    "/buyer/register",
    { phone: local, code: "112233", fullName: "Khách Thiết Bị", password, ...(withSmartOtp ? { smartOtp: { deviceName: "iPhone", platform: "ios" } } : {}) },
    homePhone,
  );
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  return { userId: created.body.user.id as string, token: created.body.tokens.accessToken as string, secret: (created.body.smartOtpActivation?.secret ?? null) as string | null };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_72 lát L3 thiết bị mới", () => {
  it("KICHBAN_KIEMTHU_739: máy lạ đăng nhập bằng mật khẩu chỉ được phiên chờ xác nhận; mã Smart OTP đúng thì tin cậy, có thông báo; mã dùng lại, mã sai bị từ chối; máy đã tin cậy không bị hỏi", async () => {
    testClock.fixed = new Date("2026-11-20T03:00:10Z");
    const now = testClock.fixed.getTime();
    const buyer = await register("0917500001", true);

    // Máy nhà (đã tin cậy khi đăng ký): không hỏi.
    const home = await post("/buyer/login", { phone: "0917500001", password }, homePhone);
    expect(home.body).toMatchObject({ deviceVerificationRequired: false, verificationMethod: null });

    const login = await post("/buyer/login", { phone: "0917500001", password }, strangerPhone);
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ deviceVerificationRequired: true, verificationMethod: "smart_otp" });
    const stranger = authed(login.body.tokens.accessToken, strangerPhone);
    const blocked = await stranger.get("/buyer/me");
    expect(blocked.status).toBe(401);
    expect(blocked.body.error).toMatchObject({ code: "DEVICE_VERIFICATION_REQUIRED", message: "Đây là thiết bị mới. Xác nhận bằng mã Smart OTP để tiếp tục." });
    // Phiên chờ không làm mới được.
    expect((await http().post("/api/v1/auth/app/refresh").set("x-device-id", strangerPhone).send({ refreshToken: login.body.tokens.refreshToken })).status).toBe(401);

    const wrong = await stranger.post("/buyer/login/device-verification", { smartOtp: codeAt(buyer.secret!, now) === "000000" ? "111111" : "000000" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.smartOtp).toBeDefined();
    // Không gửi SMS cho khách đã kích hoạt Smart OTP.
    const before = Number((await pool.query("SELECT count(*) FROM core.otp_codes WHERE phone = $1 AND purpose = 'login'", [phoneOf("0917500001")])).rows[0].count);
    expect((await stranger.post("/buyer/login/device-verification/sms")).status).toBe(204);
    expect(Number((await pool.query("SELECT count(*) FROM core.otp_codes WHERE phone = $1 AND purpose = 'login'", [phoneOf("0917500001")])).rows[0].count)).toBe(before);

    const verified = await stranger.post("/buyer/login/device-verification", { smartOtp: codeAt(buyer.secret!, now) });
    expect(verified.status, JSON.stringify(verified.body)).toBe(204);
    expect((await stranger.get("/buyer/me")).status).toBe(200);
    const notice = (await pool.query("SELECT title FROM core.notifications WHERE user_id = $1 AND kind = 'auth.new_device_login'", [buyer.userId])).rows;
    expect(notice).toHaveLength(1);
    expect(notice[0].title).toContain("Không phải bạn? Đổi mật khẩu và gỡ thiết bị.");

    // Mã đã dùng không xác nhận được phiên khác; lần sau máy lạ đã tin cậy.
    const again = await post("/buyer/login", { phone: "0917500001", password }, "may-thu-ba-0000000000003");
    const third = authed(again.body.tokens.accessToken, "may-thu-ba-0000000000003");
    expect((await third.post("/buyer/login/device-verification", { smartOtp: codeAt(buyer.secret!, now) })).status).toBe(400);
    expect((await post("/buyer/login", { phone: "0917500001", password }, strangerPhone)).body.deviceVerificationRequired).toBe(false);

    // Phiên chờ quá 10 phút thì hết hiệu lực.
    // Phiên ghi giờ thật: lùi giờ tạo phiên 11 phút.
    await pool.query("UPDATE core.sessions SET created_at = now() - interval '11 minutes' WHERE device_verified = false AND user_id = $1", [buyer.userId]);
    testClock.fixed = new Date(now + 60_000);
    const expired = await third.post("/buyer/login/device-verification", { smartOtp: codeAt(buyer.secret!, now + 60_000) });
    expect(expired.status).toBe(401);
    expect(expired.body.error.message).toBe("Phiên xác nhận thiết bị đã hết 10 phút. Đăng nhập lại.");
  });

  it("KICHBAN_KIEMTHU_739, KICHBAN_KIEMTHU_743 (phần đăng nhập): khách chưa kích hoạt trong thời hạn xác nhận bằng mã SMS; hết hạn phải kích hoạt Smart OTP; đăng nhập SMS không mật khẩu theo thời hạn", async () => {
    testClock.fixed = new Date("2026-11-20T03:00:10Z");
    await pool.query("UPDATE core.authentication_settings SET transition_starts_on = '2026-11-18', buyer_transition_days = 30");
    await register("0917500002", false);
    const login = await post("/buyer/login", { phone: "0917500002", password }, strangerPhone);
    expect(login.body).toMatchObject({ deviceVerificationRequired: true, verificationMethod: "sms" });
    const stranger = authed(login.body.tokens.accessToken, strangerPhone);
    expect((await stranger.post("/buyer/login/device-verification/sms")).status).toBe(204);
    await setCode("0917500002", "login", "778899");
    expect((await stranger.post("/buyer/login/device-verification", { smsCode: "778899" })).status).toBe(204);

    // Đăng nhập SMS không mật khẩu còn được trong thời hạn.
    expect((await post("/buyer/login/otp", { phone: "0917500002" }, "may-sms-00000000000000004")).status).toBe(204);
    await setCode("0917500002", "login", "121212");
    expect((await post("/buyer/login/otp/verify", { phone: "0917500002", code: "121212" }, "may-sms-00000000000000004")).status).toBe(200);

    // Hết thời hạn: không gửi, không nhận mã SMS đăng nhập; mật khẩu trên máy lạ phải kích hoạt Smart OTP.
    testClock.fixed = new Date("2026-12-18T03:00:00Z");
    expect((await post("/buyer/login/otp", { phone: "0917500002" }, "may-sms-00000000000000005")).status).toBe(204);
    await setCode("0917500002", "login", "343434");
    expect((await post("/buyer/login/otp/verify", { phone: "0917500002", code: "343434" }, "may-sms-00000000000000005")).status).toBe(401);
    const late = await post("/buyer/login", { phone: "0917500002", password }, "may-muon-0000000000000006");
    expect(late.body).toMatchObject({ deviceVerificationRequired: true, verificationMethod: "smart_otp_activation" });
    await pool.query("UPDATE core.authentication_settings SET transition_starts_on = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date");
  });

  it("KICHBAN_KIEMTHU_740: phiên có trước triển khai (chưa có băm thiết bị) làm mới thì thiết bị thành tin cậy; danh sách thiết bị; gỡ thiết bị thu hồi phiên của thiết bị đó", async () => {
    testClock.fixed = null;
    const buyer = await register("0917500003", true);
    // Giả lập phiên tạo trước CONG_VIEC_72 trên máy cũ: chưa có băm thiết bị, thiết bị chưa có trong danh sách tin cậy.
    const oldPhone = "may-truoc-trien-khai-0007";
    const login = await post("/buyer/login", { phone: "0917500003", password }, homePhone);
    await pool.query("UPDATE core.sessions SET device_hash = NULL WHERE user_id = $1", [buyer.userId]);
    const refreshed = await http().post("/api/v1/auth/app/refresh").set("x-device-id", oldPhone).send({ refreshToken: login.body.tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect((await post("/buyer/login", { phone: "0917500003", password }, oldPhone)).body.deviceVerificationRequired).toBe(false);

    const app = authed(refreshed.body.accessToken, oldPhone);
    const devices = await app.get("/buyer/devices");
    expect(devices.status).toBe(200);
    expect(devices.body).toHaveLength(2);
    expect(devices.body[0]).toMatchObject({ thisDevice: true, holdsSmartOtp: false });
    const home = devices.body.find((item: { thisDevice: boolean }) => !item.thisDevice);
    expect(home).toMatchObject({ holdsSmartOtp: true });
    expect(JSON.stringify(devices.body)).not.toContain(deviceHashOf(homePhone)!);

    // Gỡ máy nhà: mọi phiên của máy nhà bị thu hồi, lần sau phải xác nhận.
    const homeSession = await post("/buyer/login", { phone: "0917500003", password }, homePhone);
    const removed = await app.delete(`/buyer/devices/${home.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toHaveLength(1);
    expect((await authed(homeSession.body.tokens.accessToken, homePhone).get("/buyer/me")).status).toBe(401);
    expect((await post("/buyer/login", { phone: "0917500003", password }, homePhone)).body.deviceVerificationRequired).toBe(true);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE action = 'device.remove' AND actor_user_id = $1", [buyer.userId])).rows[0].total).toBe(1);
    expect((await app.delete(`/buyer/devices/${home.id}`)).status).toBe(404);
  });

  it("KICHBAN_KIEMTHU_741: quên mật khẩu bằng Smart OTP; khách đã kích hoạt không nhận mã SMS quên mật khẩu; thiết bị khác hết tin cậy", async () => {
    testClock.fixed = new Date("2026-11-21T03:00:10Z");
    const now = testClock.fixed.getTime();
    const buyer = await register("0917500004", true);
    const newPassword = "MatKhauMoi@2026";

    // Yêu cầu mã SMS vẫn 204 nhưng mã không dùng được.
    expect((await post("/buyer/password-reset/otp", { phone: "0917500004" }, strangerPhone)).status).toBe(204);
    await setCode("0917500004", "password_reset", "565656");
    const bySms = await post("/buyer/password-reset", { phone: "0917500004", code: "565656", password: newPassword }, strangerPhone);
    expect(bySms.status).toBe(400);
    expect(bySms.body.error.fields.code).toBe("Mã không đúng hoặc đã hết hạn.");
    // Phải có đúng một trong hai: mã SMS hoặc mã Smart OTP.
    expect((await post("/buyer/password-reset", { phone: "0917500004", password: newPassword }, strangerPhone)).status).toBe(400);
    // Số không có tài khoản: cùng thông báo.
    expect((await post("/buyer/password-reset", { phone: "0917500999", smartOtp: "123456", password: newPassword }, strangerPhone)).body.error.fields.code).toBe("Mã không đúng hoặc đã hết hạn.");

    const reset = await post("/buyer/password-reset", { phone: "0917500004", smartOtp: codeAt(buyer.secret!, now), password: newPassword }, strangerPhone);
    expect(reset.status, JSON.stringify(reset.body)).toBe(204);
    // Mọi phiên cũ bị thu hồi; máy nhà hết tin cậy, máy đang làm (máy lạ) không bị gỡ.
    expect((await authed(buyer.token, homePhone).get("/buyer/me")).status).toBe(401);
    expect((await post("/buyer/login", { phone: "0917500004", password: newPassword }, homePhone)).body.deviceVerificationRequired).toBe(true);
    const audit = (await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'password.reset' AND actor_user_id = $1", [buyer.userId])).rows;
    expect(audit).toEqual([{ after_data: { method: "smart_otp" } }]);
  });
});
