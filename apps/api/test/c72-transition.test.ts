// CONG_VIEC_72 lát L5: giao dịch điểm theo thời hạn chuyển đổi, nhắc kích hoạt, chính sách công khai
// (KICHBAN_KIEMTHU_743, 748; TIEUCHI_NGHIEMTHU_541, 544; QUYTAC_NGHIEPVU_560, 562, 569, 571; API_297, API_307, API_326).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SmartOtpRemindersService } from "../src/auth/smart-otp-reminders.service";
import { prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { signIn } from "./helpers";
import { startTestApplication, testClock, testGateway } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let affiliate: AffiliateFixture;
let apiKey: string;
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const open = (path: string, body: object) =>
  request(application.getHttpServer()).post(`/api/v1/open${path}`).set("accept-language", "vi").set("authorization", `Bearer ${apiKey}`).send(body);
const policy = () => request(application.getHttpServer()).get("/api/v1/buyer/authentication-policy");
// Thời hạn 18/11/2026 đến hết 17/12/2026.
const openWindow = () => pool.query("UPDATE core.authentication_settings SET transition_starts_on = '2026-11-18', buyer_transition_days = 30");
const at = (iso: string) => {
  testClock.fixed = new Date(iso);
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  affiliate = await prepareAffiliate(application, pool);
  apiKey = (await affiliate.call("post", `/affiliate/merchants/${affiliate.merchantId}/api-keys`, { name: "POS chính", outletIds: [affiliate.outletA] })).body.secret;
  await openWindow();
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_72 lát L5 thời hạn chuyển đổi", () => {
  it("KICHBAN_KIEMTHU_743: Open API: trong hạn gửi SMS cho khách chưa kích hoạt; hết hạn trả 409, không dùng được mã SMS; API_326 cho biết thời hạn", async () => {
    const buyer = await affiliate.register("0938720001", "Khách Chưa Kích Hoạt");
    await affiliate.grantPoints(buyer.id, 300);
    const outletId = affiliate.outletA;

    at("2026-11-20T03:00:00Z");
    expect((await policy()).body).toEqual({ transitionEndsOn: "2026-12-17", smsFallbackOpen: true });
    expect((await open("/affiliate/quote", { outletId, billAmount: "100000", phone: buyer.phone })).body).toMatchObject({ smartOtpActive: false, otpMethod: "sms", redeemLockedUntil: null });
    expect((await open("/affiliate/otp", { outletId, phone: buyer.phone })).status).toBe(204);

    // Ngày cuối vẫn trong hạn (hết 23:59:59 giờ Việt Nam).
    at("2026-12-17T16:59:00Z");
    expect((await policy()).body.smsFallbackOpen).toBe(true);
    at("2026-12-17T17:00:00Z");
    expect((await policy()).body).toEqual({ transitionEndsOn: "2026-12-17", smsFallbackOpen: false });
    expect((await open("/affiliate/quote", { outletId, billAmount: "100000", phone: buyer.phone })).body.otpMethod).toBe("unavailable");
    const refused = await open("/affiliate/otp", { outletId, phone: buyer.phone });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe("Đã hết thời hạn dùng mã SMS. Khách cần kích hoạt Smart OTP trên ứng dụng VComm, hoặc dùng mã thành viên, xác nhận trên ứng dụng.");
    // Mã SMS đã gửi trong hạn cũng không dùng được sau hạn.
    await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = 'affiliate_redeem' AND consumed_at IS NULL", [hash("246810"), "+84938720001"]);
    const late = await open("/affiliate/transactions", { partnerTransactionCode: "HET-HAN-1", outletId, billAmount: "100000", method: "otp", phone: buyer.phone, points: 20, otp: "246810" });
    expect(late.status).toBe(409);
    testClock.fixed = null;
  });

  it("KICHBAN_KIEMTHU_748: việc nền nhắc kích hoạt: mốc gần nhất, không gửi trùng, bỏ khách đã kích hoạt; ZNS 7 ngày trước hạn chỉ khi đã cài mẫu; hết hạn hủy Smart OTP trên bản web", async () => {
    const reminders = application.get(SmartOtpRemindersService);
    await pool.query("DELETE FROM core.smart_otp_reminders");
    await pool.query("DELETE FROM core.notifications WHERE kind = 'auth.smart_otp_reminder'");
    const waiting = await affiliate.register("0938720002", "Khách Cần Nhắc");
    const active = await affiliate.register("0938720003", "Khách Đã Kích Hoạt");
    const onWeb = await affiliate.register("0938720004", "Khách Bản Web");
    for (const [buyer, platform] of [
      [active, "ios"],
      [onWeb, "web"],
    ] as const) {
      await pool.query(
        "INSERT INTO core.smart_otp_devices (user_id, device_name, platform, secret_encrypted, activated_at) VALUES ($1, 'Máy thử', $2, '\\x00', now()) ON CONFLICT (user_id) DO NOTHING",
        [buyer.id, platform],
      );
    }
    const reminded = async (userId: string) =>
      (await pool.query("SELECT kind FROM core.smart_otp_reminders WHERE user_id = $1 ORDER BY sent_at, kind", [userId])).rows.map((row) => row.kind);

    // Trước ngày bắt đầu: không làm gì.
    at("2026-11-17T02:00:00Z");
    expect(await reminders.runDaily()).toEqual({ notified: 0, zns: 0, webExpired: 0 });
    // Ngày bắt đầu: thông báo "start" cho khách chưa kích hoạt và khách bản web.
    at("2026-11-18T02:00:00Z");
    const first = await reminders.runDaily();
    expect(first.notified).toBeGreaterThanOrEqual(2);
    expect(await reminded(waiting.id)).toEqual(["start"]);
    expect(await reminded(onWeb.id)).toEqual(["start"]);
    expect(await reminded(active.id)).toEqual([]);
    // Chạy lại cùng ngày: không gửi trùng.
    expect((await reminders.runDaily()).notified).toBe(0);
    // Bỏ lỡ nhiều ngày: chỉ gửi mốc gần nhất (14 ngày trước hạn), không gửi lại các mốc cũ.
    at("2026-12-05T02:00:00Z");
    await reminders.runDaily();
    expect(await reminded(waiting.id)).toEqual(["start", "day_14"]);
    const notice = (await pool.query("SELECT title FROM core.notifications WHERE user_id = $1 AND kind = 'auth.smart_otp_reminder' ORDER BY created_at DESC LIMIT 1", [waiting.id])).rows[0];
    expect(notice.title).toContain("Kích hoạt Smart OTP trước hết ngày 17/12/2026 (còn 13 ngày)");

    // 7 ngày trước hạn: chưa cài mẫu ZNS thì không gửi, không đánh dấu.
    at("2026-12-10T02:00:00Z");
    expect((await reminders.runDaily()).zns).toBe(0);
    expect(await reminded(waiting.id)).toEqual(["start", "day_14", "day_7"]);
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    const configured = await groupAdmin.call("put", "/integration-settings", {
      body: { values: { "esms.api_key": "API-KEY-0001", "esms.secret_key": "SECRET-0002", "esms.brandname": "VCOMM", "esms.oa_id": "4097311281936189049", "esms.template.smart_otp_reminder": "305112" } },
    });
    expect(configured.status).toBe(200);
    const sentBefore = testGateway.sent.length;
    at("2026-12-11T02:00:00Z");
    const withZns = await reminders.runDaily();
    expect(withZns.zns).toBeGreaterThanOrEqual(2);
    expect(await reminded(waiting.id)).toContain("zns_7");
    expect(testGateway.sent.slice(sentBefore).every((item) => item.kind === "zns" && item.input.templateId === "305112")).toBe(true);
    // Mỗi khách một tin ZNS.
    at("2026-12-12T02:00:00Z");
    expect((await reminders.runDaily()).zns).toBe(0);

    // Hết hạn: Smart OTP bản web hết hiệu lực, có nhật ký; khách iOS giữ nguyên.
    at("2026-12-18T02:00:00Z");
    expect((await reminders.runDaily()).webExpired).toBe(1);
    expect((await pool.query("SELECT user_id FROM core.smart_otp_devices WHERE user_id = ANY($1)", [[active.id, onWeb.id]])).rows.map((row) => row.user_id)).toEqual([active.id]);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE action = 'smart_otp.web_expired' AND entity_id = $1", [onWeb.id])).rows[0].total).toBe(1);
    testClock.fixed = null;
  });
});
