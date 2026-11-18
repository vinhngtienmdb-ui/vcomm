// CONG_VIEC_72 lát L4: khôi phục Smart OTP khi mất máy, khóa dùng điểm, chăm sóc khách hàng hủy Smart OTP
// (KICHBAN_KIEMTHU_742, 744; TIEUCHI_NGHIEMTHU_540, 542; QUYTAC_NGHIEPVU_566, 567; API_199, API_322).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { LoyaltyLedgerService } from "../src/loyalty/ledger.service";
import { signIn } from "./helpers";
import { prepareMarketplace, retail, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication, testDeviceId } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let database: Database;
let ledger: LoyaltyLedgerService;
const password = "MatKhauNguoiMua@2026";
const newPhone = "may-moi-sau-khi-mat-00001";
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const codeNow = (secret: string) => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate();
const http = () => request(application.getHttpServer());
const post = (path: string, body: object, device: string) => http().post(`/api/v1${path}`).set("accept-language", "vi").set("x-device-id", device).send(body);
const authed = (token: string, device: string) => ({
  get: (path: string) => http().get(`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi").set("x-device-id", device),
  post: (path: string, body?: object) => http().post(`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi").set("x-device-id", device).send(body ?? {}),
});
const setCode = (phone: string, purpose: string, code: string) =>
  pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = $3 AND consumed_at IS NULL", [hash(code), `+84${phone.slice(1)}`, purpose]);

const earn = (userId: string, goodsAmount: number) =>
  database.transaction((transaction) => ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: randomUUID(), userId, companyId: retail, day: store.today, goodsAmount }));
const redeem = (userId: string, points: number) =>
  database.transaction((transaction) =>
    ledger.redeemWithin(transaction, { userId, companyId: retail, sourceType: "retail_sale", sourceId: randomUUID(), day: store.today, goodsAmount: 1000000, points }),
  );

// Khách đăng ký trên máy kiểm thử mặc định rồi kích hoạt Smart OTP lần đầu bằng SMS (máy tin cậy: không khóa).
async function buyerWithSmartOtp(phone: string, name: string) {
  const userId = await store.register(phone, name);
  const login = await post("/buyer/login", { phone, password }, testDeviceId);
  const home = authed(login.body.tokens.accessToken, testDeviceId);
  expect((await home.post("/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
  await setCode(phone, "smart_otp", "445566");
  const activated = await home.post("/buyer/loyalty/smart-otp/activate", { code: "445566", deviceName: "iPhone", platform: "ios" });
  expect(activated.status, JSON.stringify(activated.body)).toBe(201);
  expect(activated.body.redeemLockedUntil).toBeNull();
  return { userId, home, secret: activated.body.secret as string, token: login.body.tokens.accessToken as string };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  database = application.get(DATABASE);
  ledger = application.get(LoyaltyLedgerService);
  const phase = { startsOn: store.today, endsOn: null, earnPercent: "2", pointValue: "1", redeemMaxPercent: "50", redeemMinPoints: 1000, validityMonths: 12, orderCapPoints: null, monthlyCapPoints: null };
  expect((await store.call("post", "/loyalty/phases", phase)).status).toBe(201);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_72 lát L4 khôi phục và chăm sóc khách hàng", () => {
  it("KICHBAN_KIEMTHU_742: mất máy: mật khẩu trên máy mới, mã SMS, kích hoạt; máy cũ hết hiệu lực; khóa mọi cách dùng điểm 24 giờ, tích điểm vẫn được; hết giờ dùng lại được", async () => {
    const buyer = await buyerWithSmartOtp("0939720001", "Khách Mất Máy");
    await earn(buyer.userId, 1_000_000);
    expect((await ledger.quoteRedemption(database, { userId: buyer.userId, sourceType: "retail_sale", day: store.today, goodsAmount: 1_000_000 })).blockedReason).toBeNull();

    // Máy mới: mật khẩu đúng nhưng không còn máy giữ Smart OTP → khôi phục bằng mã SMS trong phiên chờ.
    const login = await post("/buyer/login", { phone: "0939720001", password }, newPhone);
    expect(login.body).toMatchObject({ deviceVerificationRequired: true, verificationMethod: "smart_otp" });
    const pending = authed(login.body.tokens.accessToken, newPhone);
    expect((await pending.get("/buyer/loyalty/smart-otp")).status).toBe(200);
    expect((await pending.post("/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
    await setCode("0939720001", "smart_otp", "908070");
    const wrong = await pending.post("/buyer/loyalty/smart-otp/activate", { code: "111111", deviceName: "Điện thoại Android", platform: "android" });
    expect(wrong.status).toBe(409);
    const recovered = await pending.post("/buyer/loyalty/smart-otp/activate", { code: "908070", deviceName: "Điện thoại Android", platform: "android" });
    expect(recovered.status, JSON.stringify(recovered.body)).toBe(201);
    const hours = (Date.parse(recovered.body.redeemLockedUntil) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
    // Phiên được xác nhận, máy mới tin cậy.
    expect((await pending.get("/buyer/me")).status).toBe(200);
    expect((await post("/buyer/login", { phone: "0939720001", password }, newPhone)).body.deviceVerificationRequired).toBe(false);
    // Máy cũ hết hiệu lực: mã của khóa cũ không dùng được.
    expect((await pending.post("/buyer/loyalty/smart-otp/transfer", { code: codeNow(buyer.secret), deviceName: "Điện thoại Android", platform: "android" })).status).toBe(400);
    // Thông báo, nhật ký.
    const notice = (await pool.query("SELECT title FROM core.notifications WHERE user_id = $1 AND kind = 'auth.smart_otp_recovered'", [buyer.userId])).rows;
    expect(notice).toHaveLength(1);
    expect(notice[0].title).toContain("Dùng điểm tạm khóa đến");
    expect((await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE action = 'smart_otp.recover' AND entity_id = $1", [buyer.userId])).rows[0].total).toBe(1);

    // Khóa dùng điểm: báo giá chặn, ghi dùng điểm bị từ chối; tích điểm vẫn được.
    const quote = await ledger.quoteRedemption(database, { userId: buyer.userId, sourceType: "retail_sale", day: store.today, goodsAmount: 1_000_000 });
    expect(quote).toMatchObject({ redeemable: false, blockedReason: "redeem_locked", maxPoints: 0 });
    await expect(redeem(buyer.userId, 1000)).rejects.toMatchObject({ message: "loyaltyRedeemLocked" });
    await earn(buyer.userId, 500_000);
    // Trạng thái trên ứng dụng hiện thời điểm hết khóa.
    expect((await pending.get("/buyer/loyalty/smart-otp")).body.redeemLockedUntil).toBe(recovered.body.redeemLockedUntil);

    // Hết giờ khóa: dùng điểm lại được.
    await pool.query("UPDATE core.account_security SET redeem_locked_until = now() - interval '1 second' WHERE user_id = $1", [buyer.userId]);
    expect((await redeem(buyer.userId, 1000)).points).toBe(1000);
  });

  it("KICHBAN_KIEMTHU_742: kích hoạt lại bằng SMS trên máy tin cậy khi tài khoản đã từng có Smart OTP cũng tính là khôi phục; tham số 0 giờ thì không khóa", async () => {
    const buyer = await buyerWithSmartOtp("0939720002", "Khách Kích Hoạt Lại");
    expect((await buyer.home.post("/buyer/loyalty/smart-otp/lockout")).body.active).toBe(false);
    expect((await buyer.home.post("/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
    await setCode("0939720002", "smart_otp", "135135");
    const again = await buyer.home.post("/buyer/loyalty/smart-otp/activate", { code: "135135", deviceName: "iPhone", platform: "ios" });
    expect(again.body.redeemLockedUntil).not.toBeNull();

    await pool.query("UPDATE core.authentication_settings SET recovery_redeem_lock_hours = 0");
    await pool.query("UPDATE core.account_security SET redeem_locked_until = NULL WHERE user_id = $1", [buyer.userId]);
    expect((await buyer.home.post("/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
    await setCode("0939720002", "smart_otp", "246246");
    const noLock = await buyer.home.post("/buyer/loyalty/smart-otp/activate", { code: "246246", deviceName: "iPhone", platform: "ios" });
    expect(noLock.body.redeemLockedUntil).toBeNull();
    await pool.query("UPDATE core.authentication_settings SET recovery_redeem_lock_hours = 24");
  });

  it("KICHBAN_KIEMTHU_744: chăm sóc khách hàng xem, hủy Smart OTP: cần quyền riêng, lý do, đúng phiên bản; thu hồi phiên, thiết bị; ghi nhật ký; đặt lại mật khẩu bằng SMS một lần", async () => {
    const buyer = await buyerWithSmartOtp("0939720003", "Khách Mất Số");
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    const path = `/marketplace/buyers/${buyer.userId}`;
    const viewed = await groupAdmin.call("get", `${path}/security`, { companyId: retail });
    expect(viewed.status, JSON.stringify(viewed.body)).toBe(200);
    expect(viewed.body).toMatchObject({ smartOtp: { active: true, platform: "ios", deviceName: "iPhone", version: expect.any(Number) }, redeemLockedUntil: null, canRevoke: true });
    expect(viewed.body.trustedDevices).toBeGreaterThanOrEqual(1);

    // Không có quyền người mua: không xem, không hủy.
    const staff = await signIn(application, "phuc.le@vcomm.test");
    expect((await staff.call("get", `${path}/security`, { companyId: retail })).status).toBe(403);
    expect((await staff.call("post", `${path}/smart-otp/revoke`, { companyId: retail, body: { reason: "Khách báo mất máy và SIM", version: viewed.body.smartOtp.version } })).status).toBe(403);
    // Lý do quá ngắn, phiên bản cũ.
    expect((await groupAdmin.call("post", `${path}/smart-otp/revoke`, { companyId: retail, body: { reason: "mất", version: viewed.body.smartOtp.version } })).status).toBe(400);
    expect((await groupAdmin.call("post", `${path}/smart-otp/revoke`, { companyId: retail, body: { reason: "Khách báo mất máy và SIM", version: 999 } })).status).toBe(409);

    // Hết thời hạn chuyển đổi để chứng minh ngoại lệ SMS là do chăm sóc khách hàng hủy.
    await pool.query("UPDATE core.authentication_settings SET transition_starts_on = '2026-01-01', buyer_transition_days = 1");
    const revoked = await groupAdmin.call("post", `${path}/smart-otp/revoke`, {
      companyId: retail,
      body: { reason: "Khách gọi tổng đài báo mất máy và SIM, đã xác minh giấy tờ", version: viewed.body.smartOtp.version },
    });
    expect(revoked.status, JSON.stringify(revoked.body)).toBe(200);
    expect(revoked.body).toMatchObject({ smartOtp: { active: false }, trustedDevices: 0 });
    expect((await buyer.home.get("/buyer/me")).status).toBe(401);
    const audit = (await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'smart_otp.revoke' AND entity_id = $1", [buyer.userId])).rows;
    expect(audit).toEqual([{ after_data: { reason: "customer_care", note: "Khách gọi tổng đài báo mất máy và SIM, đã xác minh giấy tờ" } }]);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE user_id = $1 AND kind = 'auth.smart_otp_revoked'", [buyer.userId])).rows[0].total).toBe(1);

    // Đặt lại mật khẩu bằng SMS được một lần.
    expect((await post("/buyer/password-reset/otp", { phone: "0939720003" }, newPhone)).status).toBe(204);
    await setCode("0939720003", "password_reset", "321321");
    expect((await post("/buyer/password-reset", { phone: "0939720003", code: "321321", password: "MatKhauMoiSau@2026" }, newPhone)).status).toBe(204);
    expect((await post("/buyer/password-reset/otp", { phone: "0939720003" }, newPhone)).status).toBe(204);
    await setCode("0939720003", "password_reset", "654654");
    expect((await post("/buyer/password-reset", { phone: "0939720003", code: "654654", password: "MatKhauLanHai@2026" }, newPhone)).status).toBe(400);
    await pool.query("UPDATE core.authentication_settings SET transition_starts_on = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, buyer_transition_days = 30");
  });
});
