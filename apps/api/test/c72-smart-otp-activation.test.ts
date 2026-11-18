// CONG_VIEC_72 lát L2: kích hoạt Smart OTP lần đầu, trong bước đăng ký, chặn bản web, chuyển máy bằng mã máy cũ, báo sai mã khóa
// (KICHBAN_KIEMTHU_734 đến 736; TIEUCHI_NGHIEMTHU_536, 537; QUYTAC_NGHIEPVU_562, 563; API_116, API_199, API_319).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
const oldPhoneDevice = "may-cu-0000000000000001";
const newPhoneDevice = "may-moi-000000000000002";
const http = () => request(application.getHttpServer());
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const codeAt = (secret: string, timestamp: number) => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({ timestamp });
const otpCount = async (phone: string) => Number((await pool.query("SELECT count(*) FROM core.otp_codes WHERE phone = $1", [phone])).rows[0].count);

function buyer(token: string, device: string) {
  const headers = (call: request.Test) => call.set("authorization", `Bearer ${token}`).set("accept-language", "vi").set("x-device-id", device);
  return {
    get: (path: string) => headers(http().get(`/api/v1${path}`)),
    post: (path: string, body?: object) => headers(http().post(`/api/v1${path}`)).send(body ?? {}),
  };
}

async function registerOtp(phone: string) {
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [hash("112233"), `+84${phone.slice(1)}`]);
}

async function smsActivationCode(phone: string) {
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = 'smart_otp' AND consumed_at IS NULL", [hash("445566"), `+84${phone.slice(1)}`]);
  return "445566";
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_72 lát L2 kích hoạt Smart OTP", () => {
  it("KICHBAN_KIEMTHU_734: kích hoạt lần đầu bằng mã SMS trên điện thoại; bản web bị từ chối (cả ứng dụng cũ gửi tên máy Trình duyệt)", async () => {
    await registerOtp("0917300001");
    const created = await http().post("/api/v1/buyer/register").set("x-device-id", oldPhoneDevice).send({ phone: "0917300001", code: "112233", fullName: "Khách Một", password: "MatKhauNguoiMua@2026" });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body.smartOtpActivation).toBeNull();
    const app = buyer(created.body.tokens.accessToken, oldPhoneDevice);

    const before = await app.get("/buyer/loyalty/smart-otp");
    expect(before.body).toMatchObject({ active: false, platform: null, onThisDevice: null, redeemLockedUntil: null, transitionEndsOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });

    expect((await app.post("/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
    const code = await smsActivationCode("0917300001");
    const web = await app.post("/buyer/loyalty/smart-otp/activate", { code, deviceName: "Trình duyệt", platform: "web" });
    expect(web.status).toBe(409);
    expect(web.body.error.message).toBe("Smart OTP chỉ kích hoạt được trên ứng dụng VComm cho điện thoại (iOS, Android).");
    expect((await app.post("/buyer/loyalty/smart-otp/activate", { code, deviceName: "Trình duyệt" })).status).toBe(409);

    const activated = await app.post("/buyer/loyalty/smart-otp/activate", { code, deviceName: "Điện thoại Android", platform: "android" });
    expect(activated.status, JSON.stringify(activated.body)).toBe(201);
    expect(activated.body).toMatchObject({ active: true, platform: "android", onThisDevice: true, digits: 6, period: 30, secret: expect.any(String) });
    // Máy khác xem trạng thái: không phải máy giữ Smart OTP.
    expect((await buyer(created.body.tokens.accessToken, newPhoneDevice).get("/buyer/loyalty/smart-otp")).body.onThisDevice).toBe(false);
  });

  it("KICHBAN_KIEMTHU_735: đăng ký kèm kích hoạt Smart OTP chỉ dùng một mã SMS, trả khóa một lần; bản web không gửi được", async () => {
    await registerOtp("0917300002");
    const web = await http()
      .post("/api/v1/buyer/register")
      .send({ phone: "0917300002", code: "112233", fullName: "Khách Hai", password: "MatKhauNguoiMua@2026", smartOtp: { deviceName: "Trình duyệt", platform: "web" } });
    expect(web.status).toBe(400);

    const created = await http()
      .post("/api/v1/buyer/register")
      .set("x-device-id", oldPhoneDevice)
      .send({ phone: "0917300002", code: "112233", fullName: "Khách Hai", password: "MatKhauNguoiMua@2026", smartOtp: { deviceName: "iPhone", platform: "ios" } });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body.smartOtpActivation).toMatchObject({ active: true, platform: "ios", deviceName: "iPhone", onThisDevice: true, secret: expect.any(String) });
    expect(await otpCount("+84917300002")).toBe(1);
    const security = (await pool.query("SELECT smart_otp_first_activated_at IS NOT NULL AS first FROM core.account_security s JOIN core.users u ON u.id = s.user_id WHERE u.phone = '+84917300002'")).rows;
    expect(security).toEqual([{ first: true }]);
    // Khóa trả về dùng được ngay tại quầy và mọi nơi kiểm Smart OTP.
    const audit = (await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'smart_otp.activate' AND entity_id = $1", [created.body.user.id])).rows;
    expect(audit).toEqual([{ after_data: { deviceName: "iPhone", platform: "ios" } }]);
    expect(JSON.stringify(audit)).not.toContain(created.body.smartOtpActivation.secret);
  });

  it("KICHBAN_KIEMTHU_736: chuyển Smart OTP sang máy mới bằng mã máy cũ: không tạo mã SMS, không khóa dùng điểm; mã sai, mã dùng lại bị từ chối; máy cũ hết hiệu lực; sai mã khóa 5 lần thì hủy", async () => {
    testClock.fixed = new Date("2026-11-20T03:00:10Z");
    await registerOtp("0917300003");
    const created = await http()
      .post("/api/v1/buyer/register")
      .set("x-device-id", oldPhoneDevice)
      .send({ phone: "0917300003", code: "112233", fullName: "Khách Ba", password: "MatKhauNguoiMua@2026", smartOtp: { deviceName: "iPhone", platform: "ios" } });
    const oldSecret = created.body.smartOtpActivation.secret as string;
    const newPhone = buyer(created.body.tokens.accessToken, newPhoneDevice);
    const smsBefore = await otpCount("+84917300003");

    // Mã sai: lỗi theo trường, ghi một lần sai.
    const now = testClock.fixed.getTime();
    const wrongCode = codeAt(oldSecret, now) === "000000" ? "111111" : "000000";
    const wrong = await newPhone.post("/buyer/loyalty/smart-otp/transfer", { code: wrongCode, deviceName: "Điện thoại Android", platform: "android" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.code).toBe("Mã Smart OTP không đúng hoặc đã dùng. Mở Smart OTP trên máy cũ và nhập mã mới.");
    expect((await newPhone.post("/buyer/loyalty/smart-otp/transfer", { code: codeAt(oldSecret, now), deviceName: "Trình duyệt", platform: "web" })).status).toBe(409);

    const moved = await newPhone.post("/buyer/loyalty/smart-otp/transfer", { code: codeAt(oldSecret, now), deviceName: "Điện thoại Android", platform: "android" });
    expect(moved.status, JSON.stringify(moved.body)).toBe(201);
    expect(moved.body).toMatchObject({ active: true, platform: "android", onThisDevice: true, redeemLockedUntil: null });
    expect(moved.body.secret).not.toBe(oldSecret);
    expect(await otpCount("+84917300003")).toBe(smsBefore);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE action = 'smart_otp.transfer' AND entity_id = $1", [created.body.user.id])).rows[0].total).toBe(1);

    // Máy cũ hết hiệu lực: mã của khóa cũ không dùng được nữa (thử chuyển ngược bằng mã cũ).
    testClock.fixed = new Date(now + 60_000);
    const oldPhone = buyer(created.body.tokens.accessToken, oldPhoneDevice);
    const stale = await oldPhone.post("/buyer/loyalty/smart-otp/transfer", { code: codeAt(oldSecret, now + 60_000), deviceName: "iPhone", platform: "ios" });
    expect(stale.status).toBe(400);
    expect((await oldPhone.get("/buyer/loyalty/smart-otp")).body.onThisDevice).toBe(false);
    // Mã của khóa mới chỉ dùng một lần mỗi bước.
    const newCode = codeAt(moved.body.secret, now + 60_000);
    expect((await oldPhone.post("/buyer/loyalty/smart-otp/transfer", { code: newCode, deviceName: "iPhone", platform: "ios" })).status).toBe(201);
    expect((await newPhone.post("/buyer/loyalty/smart-otp/transfer", { code: newCode, deviceName: "Điện thoại Android", platform: "android" })).status).toBe(400);

    // Ứng dụng báo sai mã khóa 5 lần: hủy Smart OTP, ghi nhật ký lý do.
    const lockout = await oldPhone.post("/buyer/loyalty/smart-otp/lockout");
    expect(lockout.status).toBe(201);
    expect(lockout.body.active).toBe(false);
    const revoked = (await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'smart_otp.revoke' AND entity_id = $1", [created.body.user.id])).rows;
    expect(revoked).toEqual([{ after_data: { reason: "pin_lockout" } }]);
    // Chưa có Smart OTP thì không chuyển được.
    expect((await newPhone.post("/buyer/loyalty/smart-otp/transfer", { code: "123456", deviceName: "Điện thoại Android", platform: "android" })).body.error.message).toBe("Tài khoản chưa kích hoạt Smart OTP.");
  });
});
