// CONG_VIEC_74 L1: quầy, ghép thiết bị, đăng nhập trên thiết bị (OTP, mã PIN), thu ngân tự đăng ký, giới hạn quầy, cô lập giữa cửa hàng
// (KICHBAN_KIEMTHU_768, 769, 774 đến 777; TIEUCHI_NGHIEMTHU_560, 565 đến 568).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import { createHash } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { encryptSecret } from "../src/common/secret-box";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: AffiliateFixture;
let planId: string;
let subscriptionA: { id: string; version: number };

const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const http = () => request(application.getHttpServer());
// Máy bán: gửi khóa thiết bị, sau khi đăng nhập gửi thêm token truy cập.
const device = (key: string, token?: string) => ({
  get: (path: string) => {
    const call = http().get(`/api/v1${path}`).set("x-ipos-device", key).set("accept-language", "vi");
    return token ? call.set("authorization", `Bearer ${token}`) : call;
  },
  post: (path: string, body: object = {}) => {
    const call = http().post(`/api/v1${path}`).set("x-ipos-device", key).set("accept-language", "vi");
    return (token ? call.set("authorization", `Bearer ${token}`) : call).send(body);
  },
});
const setOtp = async (phone: string, purpose: string) => {
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = $3 AND consumed_at IS NULL", [
    createHash("sha256").update("246810").digest("hex"),
    `+84${phone.slice(1)}`,
    purpose,
  ]);
};
const portal = (method: "get" | "post" | "put", path: string, body?: object) => store.owner.call(method, `/merchant-portal/ipos${path}`, body ? { body } : {});

// Bí mật dùng trong tệp này (mã OTP, mã PIN, mã ghép, khóa thiết bị) để KICHBAN_KIEMTHU_802 quét nhật ký sau cùng.
const secrets = new Set<string>(["246810", "246813", "000001"]);

async function pair(registerId: string): Promise<string> {
  const code = await portal("post", `/registers/${registerId}/pairing-codes`);
  expect(code.status, JSON.stringify(code.body)).toBe(201);
  secrets.add(code.body.code as string);
  const paired = await http().post("/api/v1/ipos/devices/pair").send({ code: code.body.code, model: "Sunmi T2", appVersion: "1.0.0" });
  expect(paired.status, JSON.stringify(paired.body)).toBe(201);
  secrets.add(paired.body.deviceKey as string);
  return paired.body.deviceKey as string;
}

async function otpLogin(key: string, phone: string) {
  expect((await device(key).post("/ipos/pos/auth/otp", { phone })).status).toBe(204);
  await setOtp(phone, "ipos_login");
  return device(key).post("/ipos/pos/auth/login", { phone, code: "246810", method: "sms" });
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareAffiliate(application, pool);
  const plan = await store.call("post", "/ipos/plans", { code: "CO-BAN", name: "Cơ bản", monthlyPrice: "199000", taxPercent: "10", maxRegisters: 2, maxItems: 500, trialDays: 0 });
  planId = plan.body.id as string;
  const created = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, {
    outletId: store.outletA,
    planId,
    periodMonths: 1,
    startsOn: store.today,
    trialDays: null,
    customMonthlyPrice: null,
    customMaxRegisters: null,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  subscriptionA = { id: created.body.id, version: created.body.version };
});

afterEach(() => {
  testClock.fixed = null;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_74 L1 – quầy, thiết bị, đăng nhập, thu ngân tự đăng ký", () => {
  let registerOne: string;
  let registerTwo: string;
  let deviceKey: string;

  it("KICHBAN_KIEMTHU_774: quầy theo giới hạn của gói; đổi gói giảm quầy thì quầy vượt không ghép được", async () => {
    const access = await portal("get", "/access");
    expect(access.body).toMatchObject({ enabled: true, isOwner: true, pendingRegistrations: 0 });
    expect(access.body.outlets).toEqual([expect.objectContaining({ outletId: store.outletA, maxRegisters: 2, activeRegisters: 0 })]);
    // Điểm bán chưa có thuê bao không tạo được quầy.
    expect((await portal("post", "/registers", { outletId: store.outletB, name: "Quầy 1" })).body.error.message).toBe(message("iposNoSubscription"));
    registerOne = (await portal("post", "/registers", { outletId: store.outletA, name: "Quầy 1" })).body[0].id as string;
    const two = await portal("post", "/registers", { outletId: store.outletA, name: "Quầy 2" });
    registerTwo = two.body.find((item: { name: string }) => item.name === "Quầy 2").id as string;
    expect((await portal("post", "/registers", { outletId: store.outletA, name: "Quầy 3" })).body.error.message).toBe(message("iposRegisterLimit"));
    expect((await portal("post", "/registers", { outletId: store.outletA, name: "Quầy 1" })).body.error.message).toBe(message("iposRegisterLimit"));

    // Đổi về 1 quầy: không tự khóa, quầy tạo sau vượt giới hạn, không lấy được mã ghép.
    const updated = await store.call("put", `/ipos/subscriptions/${subscriptionA.id}`, { planId, periodMonths: 1, customMonthlyPrice: null, customMaxRegisters: 1, version: subscriptionA.version });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    const list = (await portal("get", "/registers")).body as { id: string; overLimit: boolean; status: string }[];
    expect(list.find((item) => item.id === registerTwo)).toMatchObject({ overLimit: true, status: "active" });
    expect((await portal("post", `/registers/${registerTwo}/pairing-codes`)).body.error.message).toBe(message("iposRegisterLimit"));
    await store.call("put", `/ipos/subscriptions/${subscriptionA.id}`, { planId, periodMonths: 1, customMonthlyPrice: null, customMaxRegisters: null, version: updated.body.version });
  });

  it("KICHBAN_KIEMTHU_776: mã ghép đúng, sai, hết hạn, dùng lại; ghép mới vô hiệu thiết bị cũ; thu hồi", async () => {
    expect((await http().post("/api/v1/ipos/devices/pair").send({ code: "ABCD2345" })).body.error.fields.code).toBe(message("iposPairingCodeInvalid"));
    const expired = await portal("post", `/registers/${registerOne}/pairing-codes`);
    secrets.add(expired.body.code as string);
    expect(expired.body.code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
    testClock.fixed = new Date(Date.now() + 11 * 60_000);
    expect((await http().post("/api/v1/ipos/devices/pair").send({ code: expired.body.code })).status).toBe(400);
    testClock.fixed = null;

    const code = await portal("post", `/registers/${registerOne}/pairing-codes`);
    secrets.add(code.body.code as string);
    const first = await http().post("/api/v1/ipos/devices/pair").send({ code: `${code.body.code.slice(0, 4)}-${code.body.code.slice(4)}`, model: "Sunmi T2" });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.device).toMatchObject({ registerName: "Quầy 1", outletId: store.outletA, subscriptionStatus: "active", members: [] });
    expect((await http().post("/api/v1/ipos/devices/pair").send({ code: code.body.code })).status).toBe(400);
    const oldKey = first.body.deviceKey as string;
    expect((await device(oldKey).get("/ipos/pos/device")).status).toBe(200);

    deviceKey = await pair(registerOne);
    expect((await device(oldKey).get("/ipos/pos/device")).body.error.message).toBe(message("iposDeviceUnknown"));
    const registers = (await portal("get", "/registers")).body as { id: string; device: { id: string; model: string } | null }[];
    expect(registers.find((item) => item.id === registerOne)!.device).toMatchObject({ model: "Sunmi T2" });

    // Thu hồi thiết bị ở quầy 2 sau khi ghép.
    const second = await pair(registerTwo);
    const deviceTwo = (await portal("get", "/registers")).body.find((item: { id: string }) => item.id === registerTwo).device.id as string;
    expect((await portal("post", `/devices/${deviceTwo}/revoke`)).status).toBe(201);
    expect((await device(second).get("/ipos/pos/device")).status).toBe(401);
    // Khóa thiết bị không nằm trong nhật ký thao tác.
    const audit = await pool.query<{ after_data: unknown }>("SELECT after_data FROM core.audit_events WHERE action LIKE 'ipos_%'");
    expect(JSON.stringify(audit.rows)).not.toContain(deviceKey);
    expect(JSON.stringify(audit.rows)).not.toContain(code.body.code);
  });

  it("KICHBAN_KIEMTHU_777: OTP lần đầu, đặt PIN yếu bị từ chối, PIN sai 5 lần khóa 15 phút, khóa thành viên giữa phiên", async () => {
    // Số không phải thành viên: vẫn trả 204, đăng nhập bị từ chối.
    expect((await device(deviceKey).post("/ipos/pos/auth/otp", { phone: "0988000111" })).status).toBe(204);
    expect((await device(deviceKey).post("/ipos/pos/auth/login", { phone: "0988000111", code: "246810", method: "sms" })).status).toBe(401);

    const login = await otpLogin(deviceKey, "0912333444");
    expect(login.status, JSON.stringify(login.body)).toBe(201);
    expect(login.body.member).toMatchObject({ fullName: "Lê Thu Hà", role: "cashier", hasPin: false });
    const cashier = device(deviceKey, login.body.tokens.accessToken as string);
    expect((await cashier.post("/ipos/pos/auth/pin", { pin: "111111" })).body.error.fields.pin).toBe(message("iposPinWeak"));
    expect((await cashier.post("/ipos/pos/auth/pin", { pin: "345678" })).body.error.fields.pin).toBe(message("iposPinWeak"));
    expect((await cashier.post("/ipos/pos/auth/pin", { pin: "246813" })).status).toBe(204);
    const me = await cashier.get("/ipos/pos/me");
    expect(me.body).toMatchObject({ member: { hasPin: true }, device: { registerName: "Quầy 1" } });
    expect(me.body.device.members).toEqual([expect.objectContaining({ fullName: "Lê Thu Hà", locked: false })]);
    // Token của máy này không dùng được trên máy khác.
    const other = await pair(registerTwo);
    expect((await device(other, login.body.tokens.accessToken as string).get("/ipos/pos/me")).status).toBe(401);

    const memberId = login.body.member.memberId as string;
    for (let attempt = 1; attempt <= 4; attempt += 1) expect((await device(deviceKey).post("/ipos/pos/auth/pin-login", { memberId, pin: "000001" })).body.error.message).toBe(message("iposPinWrong"));
    const locked = await device(deviceKey).post("/ipos/pos/auth/pin-login", { memberId, pin: "000001" });
    expect(locked.status).toBe(429);
    expect((await device(deviceKey).post("/ipos/pos/auth/pin-login", { memberId, pin: "246813" })).status).toBe(429);
    testClock.fixed = new Date(Date.now() + 16 * 60_000);
    const pinLogin = await device(deviceKey).post("/ipos/pos/auth/pin-login", { memberId, pin: "246813" });
    expect(pinLogin.status, JSON.stringify(pinLogin.body)).toBe(201);
    testClock.fixed = null;
    const session = device(deviceKey, pinLogin.body.tokens.accessToken as string);
    expect((await session.get("/ipos/pos/me")).status).toBe(200);

    // Phiên quá 12 giờ kể từ đăng nhập thì phải đăng nhập lại.
    testClock.fixed = new Date(Date.now() + 13 * 3_600_000);
    expect((await session.get("/ipos/pos/me")).status).toBe(401);
    testClock.fixed = null;

    // Chủ khóa thu ngân: phiên trên thiết bị hết hiệu lực ngay.
    const members = (await store.owner.call("get", "/merchant-portal/store")).body.members as { id: string; phone: string; version: number }[];
    const cashierMember = members.find((item) => item.phone === "+84912333444")!;
    expect((await store.owner.call("post", `/merchant-portal/members/${cashierMember.id}/lock`, { body: { version: cashierMember.version } })).status).toBe(201);
    expect((await session.get("/ipos/pos/me")).status).toBe(401);
    const afterLock = (await store.owner.call("get", "/merchant-portal/store")).body.members.find((item: { id: string }) => item.id === cashierMember.id);
    await store.owner.call("post", `/merchant-portal/members/${cashierMember.id}/unlock`, { body: { version: afterLock.version } });

    // Khóa màn hình thu hồi phiên.
    const ownerLogin = await otpLogin(deviceKey, "0909111222");
    const owner = device(deviceKey, ownerLogin.body.tokens.accessToken as string);
    expect((await owner.post("/ipos/pos/auth/lock")).status).toBe(204);
    expect((await owner.get("/ipos/pos/me")).status).toBe(401);
  });

  it("KICHBAN_KIEMTHU_777 (Smart OTP): đã kích hoạt Smart OTP thì đăng nhập bằng Smart OTP, không nhận SMS; hết thời hạn chuyển đổi thì SMS bị chặn", async () => {
    // Kích hoạt Smart OTP cho chủ cửa hàng bằng khóa biết trước (như thiết bị đã kích hoạt trên ứng dụng VComm).
    const secret = new Secret({ size: 20 }).base32;
    const ownerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE phone = '+84909111222'")).rows[0]!.id;
    await pool.query(
      "INSERT INTO core.smart_otp_devices (user_id, device_name, platform, secret_encrypted, activated_at) VALUES ($1, 'Điện thoại Android', 'android', $2, now()) ON CONFLICT (user_id) DO NOTHING",
      [ownerId, encryptSecret(secret)],
    );
    const code = () => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
    // Đã kích hoạt Smart OTP: mã SMS không còn dùng được để đăng nhập.
    expect((await device(deviceKey).post("/ipos/pos/auth/otp", { phone: "0909111222" })).status).toBe(204);
    await setOtp("0909111222", "ipos_login");
    expect((await device(deviceKey).post("/ipos/pos/auth/login", { phone: "0909111222", code: "246810", method: "sms" })).body.error.message).toBe(message("iposUseSmartOtp"));
    expect((await device(deviceKey).post("/ipos/pos/auth/login", { phone: "0909111222", code: "000000", method: "smart_otp" })).status).toBe(409);
    const login = await device(deviceKey).post("/ipos/pos/auth/login", { phone: "0909111222", code: code(), method: "smart_otp" });
    expect(login.status, JSON.stringify(login.body)).toBe(201);
    expect(login.body.member).toMatchObject({ role: "owner" });
    // Số chưa kích hoạt Smart OTP không đăng nhập được bằng Smart OTP.
    expect((await device(deviceKey).post("/ipos/pos/auth/login", { phone: "0912333444", code: code(), method: "smart_otp" })).status).toBe(401);

    // Hết thời hạn chuyển đổi của cổng cửa hàng: thu ngân chưa kích hoạt không đăng nhập được bằng SMS.
    const settings = await pool.query<{ transition_starts_on: string; portal_transition_days: number }>("SELECT transition_starts_on::text, portal_transition_days FROM core.authentication_settings");
    await pool.query("UPDATE core.authentication_settings SET transition_starts_on = '2026-01-01', portal_transition_days = 1");
    expect((await device(deviceKey).post("/ipos/pos/auth/otp", { phone: "0912333444" })).status).toBe(204);
    await setOtp("0912333444", "ipos_login");
    expect((await device(deviceKey).post("/ipos/pos/auth/login", { phone: "0912333444", code: "246810", method: "sms" })).body.error.message).toBe(message("iposSmartOtpRequired"));
    await pool.query("UPDATE core.authentication_settings SET transition_starts_on = $1, portal_transition_days = $2", [settings.rows[0]!.transition_starts_on, settings.rows[0]!.portal_transition_days]);
  });

  it("KICHBAN_KIEMTHU_775: thu ngân tự đăng ký luôn là thu ngân, chủ duyệt, từ chối, hết hạn; giới hạn mỗi số", async () => {
    expect((await http().get("/api/v1/ipos/cashier-registrations/outlets?merchantCode=CH999999")).status).toBe(404);
    const merchantCode = (await pool.query<{ code: string }>("SELECT code FROM affiliate.merchants WHERE id = $1", [store.merchantId])).rows[0]!.code;
    const outlets = await http().get(`/api/v1/ipos/cashier-registrations/outlets?merchantCode=${merchantCode.toLowerCase()}`);
    expect(outlets.body).toEqual([expect.objectContaining({ id: store.outletA, name: "Lê Lợi" })]);

    const register = async (phone: string, fullName: string, extra: object = {}) => {
      expect((await http().post("/api/v1/ipos/cashier-registrations/otp").send({ merchantCode, phone })).status).toBe(204);
      await setOtp(phone, "ipos_register");
      return http().post("/api/v1/ipos/cashier-registrations").send({ merchantCode, phone, code: "246810", fullName, outletIds: [store.outletA], ...extra });
    };
    // Gửi kèm vai trò bị từ chối (chống tự nâng quyền); không tạo yêu cầu.
    expect((await register("0977111222", "Nguyễn Văn An", { role: "owner" })).status).toBe(400);
    const created = await register("0977111222", "Nguyễn Văn An");
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.status).toBe("pending");
    expect((await register("0977111222", "Nguyễn Văn An")).body.error.message).toBe(message("iposRegistrationPending"));
    expect((await register("0912333444", "Lê Thu Hà")).body.error.message).toBe(message("iposAlreadyMember"));

    const pending = (await portal("get", "/cashier-registrations")).body as { id: string; phone: string; status: string }[];
    expect(pending[0]).toMatchObject({ status: "pending", phone: "0977 *** 222" });
    expect((await portal("get", "/access")).body.pendingRegistrations).toBe(1);
    // Thu ngân không xem, không duyệt được.
    expect((await store.cashier.call("get", "/merchant-portal/ipos/cashier-registrations")).status).toBe(403);
    const approved = await portal("post", `/cashier-registrations/${pending[0]!.id}/approve`, { outletIds: [store.outletA] });
    expect(approved.status, JSON.stringify(approved.body)).toBe(201);
    const members = (await store.owner.call("get", "/merchant-portal/store")).body.members as { phone: string; role: string; status: string; outletIds: string[] }[];
    expect(members.find((item) => item.phone === "+84977111222")).toMatchObject({ role: "cashier", status: "active", outletIds: [store.outletA] });
    // Thu ngân mới đăng nhập được trên thiết bị.
    expect((await otpLogin(deviceKey, "0977111222")).status).toBe(201);

    const second = await register("0977333444", "Trần Bích Ngọc");
    const rejectedId = second.body.id as string;
    expect((await portal("post", `/cashier-registrations/${rejectedId}/reject`, { reason: "Không làm ở cửa hàng" })).status).toBe(201);
    expect((await portal("post", `/cashier-registrations/${rejectedId}/approve`, { outletIds: [store.outletA] })).body.error.message).toBe(message("iposRegistrationClosed"));
    expect((await otpLogin(deviceKey, "0977333444")).status).toBe(401);

    const third = await register("0977555666", "Phạm Quốc Huy");
    testClock.fixed = new Date(Date.now() + 8 * 86_400_000);
    const list = (await portal("get", "/cashier-registrations")).body as { id: string; status: string }[];
    expect(list.find((item) => item.id === third.body.id)!.status).toBe("expired");
    testClock.fixed = null;

    // Mỗi số tối đa 3 yêu cầu mỗi ngày (tính cả yêu cầu bị từ chối).
    await register("0977333444", "Trần Bích Ngọc");
    await pool.query("UPDATE ipos.cashier_registrations SET status = 'rejected', decided_at = now() WHERE phone = '+84977333444' AND status = 'pending'");
    await register("0977333444", "Trần Bích Ngọc");
    await pool.query("UPDATE ipos.cashier_registrations SET status = 'rejected', decided_at = now() WHERE phone = '+84977333444' AND status = 'pending'");
    expect((await http().post("/api/v1/ipos/cashier-registrations/otp").send({ merchantCode, phone: "0977333444" })).status).toBe(429);
  });

  it("KICHBAN_KIEMTHU_769: cô lập: chủ cửa hàng khác không thấy, không sửa quầy, thiết bị, yêu cầu của cửa hàng này", async () => {
    const otherMerchant = await store.createMerchant("Tạp hóa Minh Anh", "0322222228", "HDLK-02");
    const otherOutlet = (await store.call("post", `/affiliate/merchants/${otherMerchant}/outlets`, { name: "Bình Dương 01", address: "12 Đại lộ Bình Dương" })).body.id as string;
    const detail = await store.call("get", `/affiliate/merchants/${otherMerchant}`);
    await store.call("post", `/affiliate/merchants/${otherMerchant}/activate`, { version: detail.body.version });
    await store.call("post", `/affiliate/merchants/${otherMerchant}/owner-invitations`, { fullName: "Võ Minh Anh", phone: "0933444555" });
    const otherOwner = await store.activate("0933444555");
    const other = (method: "get" | "post" | "put", path: string, body?: object) => otherOwner.call(method, `/merchant-portal/ipos${path}`, body ? { body } : {});
    expect((await other("get", "/access")).body).toMatchObject({ enabled: false, outlets: [] });
    expect((await other("get", "/registers")).body).toEqual([]);
    expect((await other("put", `/registers/${registerOne}`, { name: "Chiếm", status: "active", version: 1 })).status).toBe(404);
    expect((await other("post", `/registers/${registerOne}/pairing-codes`)).status).toBe(404);
    const deviceOne = (await portal("get", "/registers")).body.find((item: { id: string }) => item.id === registerOne).device.id as string;
    expect((await other("post", `/devices/${deviceOne}/revoke`)).status).toBe(404);
    expect((await other("get", "/cashier-registrations")).body).toEqual([]);
    expect((await other("post", "/registers", { outletId: store.outletA, name: "Quầy lạ" })).body.error.message).toBe(message("iposNoSubscription"));
    // Thành viên cửa hàng khác không đăng nhập được trên thiết bị của cửa hàng này.
    expect((await otpLogin(deviceKey, "0933444555")).status).toBe(401);
    expect(otherOutlet).toBeTruthy();
  });
});

describe("CONG_VIEC_74 – nhật ký không chứa bí mật", () => {
  it("KICHBAN_KIEMTHU_802: sau các kịch bản trên, nhật ký thao tác, thông báo, sự kiện outbox, bảng thiết bị không chứa mã OTP, mã PIN, mã ghép, khóa thiết bị", async () => {
    const texts = await pool.query<{ source: string; text: string }>(`
      SELECT 'audit' AS source, coalesce(before_data::text, '') || ' ' || coalesce(after_data::text, '') || ' ' || action AS text FROM core.audit_events
      UNION ALL SELECT 'notification', title || ' ' || coalesce(link, '') || ' ' || payload::text FROM core.notifications
      UNION ALL SELECT 'outbox', payload::text FROM core.outbox_events
      UNION ALL SELECT 'device', key_hash || ' ' || coalesce(model, '') FROM ipos.devices
      UNION ALL SELECT 'pin', pin_hash FROM ipos.member_pins
      UNION ALL SELECT 'pairing', code_hash FROM ipos.pairing_codes`);
    expect(texts.rows.length).toBeGreaterThan(0);
    const leaks = texts.rows.flatMap((row) => [...secrets].filter((secret) => row.text.includes(secret)).map((secret) => `${row.source}: ${secret.slice(0, 2)}…`));
    expect(leaks).toEqual([]);
  });
});
