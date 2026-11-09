// CONG_VIEC_03 lát L6b, L6c: đăng nhập bằng số điện thoại, Google, Microsoft, Zalo
// (TIEUCHI_NGHIEMTHU_13, 14, 46, 47, 51; KICHBAN_KIEMTHU_31 đến 34, 112 đến 117, 124 đến 126).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds, testPassword } from "../src/database/seed";
import { tenantVerified } from "../src/auth/oauth-providers";
import { cookieValue, sessionFrom, signIn, type Session } from "./helpers";
import { sentMessages, startTestApplication, testGateway, testOauth } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
const phone = "+84901234567";
const server = () => request(application.getHttpServer());

async function configure(values: Record<string, string>) {
  expect((await groupAdmin.call("put", "/integration-settings", { body: { values } })).status).toBe(200);
}

// Đi hết vòng đăng nhập bằng nhà cung cấp: start → (nhà cung cấp) → callback.
async function oauthRound(provider: string, code: string, options: { mode?: "login" | "link" | "activate"; accessCookie?: string; token?: string } = {}) {
  const start = server().get(`/api/v1/auth/oauth/${provider}/start?mode=${options.mode ?? "login"}${options.token ? `&token=${options.token}` : ""}`);
  if (options.accessCookie) start.set("cookie", options.accessCookie);
  const started = await start;
  expect(started.status).toBe(302);
  const location = new URL(started.headers.location as string);
  const state = location.searchParams.get("state");
  if (!state) return { started, finished: null };
  const stateCookie = cookieValue(started.headers["set-cookie"], "vc_oauth");
  const finished = await server().get(`/api/v1/auth/oauth/${provider}/callback?code=${code}&state=${state}`).set("cookie", `vc_oauth=${stateCookie}`);
  return { started, finished };
}

const userIdOf = async (session: Session) => (await session.call("get", "/me")).body.user.id as string;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  await pool.query("UPDATE core.users SET phone = $1 WHERE id = $2", [phone, testIds.purchasingManager]);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("API_54: chỉ hiện cách đăng nhập đã cài đặt", () => {
  it("chưa cài gì thì chỉ có mật khẩu", async () => {
    expect((await server().get("/api/v1/auth/methods")).body).toEqual({ password: true, phone: false, google: false, microsoft: false, zalo: false });
  });
});

describe("Đăng nhập bằng số điện thoại (CHUC_NANG_08)", () => {
  it("chưa cài eSMS: vẫn trả 204, ghi bỏ qua; số chưa gắn tài khoản không gửi", async () => {
    expect((await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" })).status).toBe(204);
    expect(testGateway.sent).toHaveLength(0);
    await configure({ "esms.api_key": "API-KEY-0001", "esms.secret_key": "SECRET-0002", "esms.brandname": "VCOMM" });
    expect((await server().get("/api/v1/auth/methods")).body.phone).toBe(true);
    expect((await server().post("/api/v1/auth/otp/send").send({ phone: "0999999999" })).status).toBe(204);
    expect(testGateway.sent).toHaveLength(0);
    expect((await server().post("/api/v1/auth/otp/send").send({ phone: "abc" })).status).toBe(400);
  });

  it("TIEUCHI_NGHIEMTHU_51: chưa cài mẫu ZNS thì gửi SMS; có mẫu thì gửi Zalo rồi SMS", async () => {
    await pool.query("DELETE FROM core.otp_codes");
    expect((await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" })).status).toBe(204);
    let last = testGateway.sent.at(-1)!;
    expect(last.kind).toBe("otp");
    expect(last.input).toMatchObject({ phone, oaId: null, templateId: null, brandname: "VCOMM" });
    await configure({ "esms.oa_id": "4097311281936189049", "esms.template.login_otp": "205644" });
    expect((await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" })).status).toBe(204);
    last = testGateway.sent.at(-1)!;
    expect(last.input).toMatchObject({ oaId: "4097311281936189049", templateId: "205644" });
    const deliveries = await pool.query("SELECT channel, status, phone_masked FROM core.message_deliveries WHERE purpose = 'login_otp' ORDER BY created_at");
    expect(deliveries.rows.map((row) => row.channel)).toEqual(["sms", "sms", "zns_sms"]);
    expect(deliveries.rows[2].phone_masked).toBe("+8490***4567");
    // Không lưu mã OTP ở nhật ký gửi tin.
    expect(JSON.stringify(deliveries.rows)).not.toContain(String(last.input.code));
  });

  it("mã sai bị từ chối; sai 5 lần thì mã hết hiệu lực; mã đúng thì đăng nhập", async () => {
    await pool.query("DELETE FROM core.otp_codes");
    await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" });
    const code = String(testGateway.sent.at(-1)!.input.code);
    const wrong = code === "000000" ? "111111" : "000000";
    const failed = await server().post("/api/v1/auth/otp/verify").send({ phone: "0901234567", code: wrong });
    expect(failed.status).toBe(401);
    expect(failed.body.error.message).toBe("Mã không đúng hoặc đã hết hạn.");
    const ok = await server().post("/api/v1/auth/otp/verify").send({ phone: "0901234567", code });
    expect(ok.status).toBe(200);
    expect(ok.body.user.id).toBe(testIds.purchasingManager);
    // Mã đã dùng không dùng lại được.
    expect((await server().post("/api/v1/auth/otp/verify").send({ phone: "0901234567", code })).status).toBe(401);
    await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" });
    const next = String(testGateway.sent.at(-1)!.input.code);
    const other = next === "000000" ? "111111" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) await server().post("/api/v1/auth/otp/verify").send({ phone: "0901234567", code: other });
    expect((await server().post("/api/v1/auth/otp/verify").send({ phone: "0901234567", code: next })).status).toBe(401);
  });

  it("hai lần xác minh đồng thời cùng một mã chỉ một lần đăng nhập được", async () => {
    await pool.query("DELETE FROM core.otp_codes");
    await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" });
    const code = String(testGateway.sent.at(-1)!.input.code);
    const results = await Promise.all([1, 2, 3].map(() => server().post("/api/v1/auth/otp/verify").send({ phone: "0901234567", code })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 401, 401]);
  });

  it("tối đa 5 lần gửi mỗi giờ cho một số", async () => {
    await pool.query("DELETE FROM core.otp_codes");
    for (let attempt = 0; attempt < 5; attempt += 1) expect((await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" })).status).toBe(204);
    const blocked = await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toBe("Bạn đã yêu cầu quá nhiều mã, thử lại sau.");
    await pool.query("DELETE FROM core.otp_codes");
  });
});

describe("Google, Microsoft (CHUC_NANG_07)", () => {
  it("chưa cài đặt thì quay về trang đăng nhập kèm lỗi", async () => {
    const started = await server().get("/api/v1/auth/oauth/google/start");
    expect(started.status).toBe(302);
    expect(started.headers.location).toMatch(/\/dang-nhap\?loi=oauthNotConfigured$/);
    expect((await server().get("/api/v1/auth/oauth/facebook/start")).headers.location).toMatch(/loi=notFound$/);
  });

  it("TIEUCHI_NGHIEMTHU_13: email chưa được mời bị từ chối, không tạo tài khoản", async () => {
    await configure({ "google.client_id": "google-client", "google.client_secret": "google-secret-1234" });
    testOauth.profiles.set("ma-la", { subject: "google-la", email: "nguoi.la@gmail.com", emailVerified: true, name: "Người lạ" });
    const before = (await pool.query("SELECT count(*)::int AS total FROM core.users")).rows[0].total;
    const { finished } = await oauthRound("google", "ma-la");
    expect(finished!.status).toBe(302);
    expect(finished!.headers.location).toMatch(/\/dang-nhap\?loi=emailNotInvited$/);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.users")).rows[0].total).toBe(before);
    expect((await pool.query("SELECT 1 FROM core.user_identities WHERE provider = 'google' AND provider_subject = 'google-la'")).rows).toHaveLength(0);
  });

  it("state sai hoặc nhà cung cấp lỗi thì từ chối", async () => {
    const started = await server().get("/api/v1/auth/oauth/google/start");
    const stateCookie = cookieValue(started.headers["set-cookie"], "vc_oauth");
    expect((await server().get("/api/v1/auth/oauth/google/callback?code=ma-la&state=sai").set("cookie", `vc_oauth=${stateCookie}`)).headers.location).toMatch(/loi=oauthFailed$/);
    const { finished } = await oauthRound("google", "ma-khong-co");
    expect(finished!.headers.location).toMatch(/loi=oauthFailed$/);
  });

  it("TIEUCHI_NGHIEMTHU_14: cùng một tài khoản đăng nhập được bằng mật khẩu, Google và số điện thoại", async () => {
    testOauth.profiles.set("ma-phuc", { subject: "google-phuc", email: "phuc.le@vcomm.test", emailVerified: true, name: "Lê Văn Phúc" });
    const { finished } = await oauthRound("google", "ma-phuc");
    expect(finished!.headers.location).toMatch(/:\d+\/$|\/$/);
    const viaGoogle = sessionFrom(application, finished!.headers["set-cookie"]);
    const viaPassword = await signIn(application, "phuc.le@vcomm.test", testPassword);
    await server().post("/api/v1/auth/otp/send").send({ phone: "0901234567" });
    const otp = await server()
      .post("/api/v1/auth/otp/verify")
      .send({ phone: "0901234567", code: String(testGateway.sent.at(-1)!.input.code) });
    const viaPhone = sessionFrom(application, otp.headers["set-cookie"]);
    const ids = await Promise.all([viaGoogle, viaPassword, viaPhone].map(userIdOf));
    expect(new Set(ids)).toEqual(new Set([testIds.purchasingManager]));
    // Lần sau tìm theo mã định danh Google dù email trả về khác.
    testOauth.profiles.set("ma-phuc-2", { subject: "google-phuc", email: "khac@gmail.com", emailVerified: true, name: null });
    expect((await oauthRound("google", "ma-phuc-2")).finished!.headers.location).not.toContain("loi=");
    const identities = await viaPassword.call("get", "/me/identities");
    expect(identities.body.map((identity: { provider: string }) => identity.provider).sort()).toEqual(["google", "password", "phone_otp"]);
  });

  it("Microsoft với tenant chung không tự gắn theo email; tenant của công ty thì gắn", async () => {
    await configure({ "microsoft.client_id": "ms-client", "microsoft.client_secret": "ms-secret-9999" });
    testOauth.profiles.set("ma-ms", { subject: "tenant-a:oid-1", email: "phuc.le@vcomm.test", emailVerified: false, name: null });
    expect((await oauthRound("microsoft", "ma-ms")).finished!.headers.location).toMatch(/loi=providerNotLinked$/);
    testOauth.profiles.set("ma-ms-2", { subject: "tenant-b:oid-2", email: "phuc.le@vcomm.test", emailVerified: true, name: null });
    expect((await oauthRound("microsoft", "ma-ms-2")).finished!.headers.location).not.toContain("loi=");
  });
});

describe("Microsoft: xác định email tin được theo tenant", () => {
  it("tenant GUID so với tid; tenant tên miền so với đuôi email; tenant chung không tin", () => {
    const tenant = "8f0e5c2a-1b2c-4d3e-9f40-123456789abc";
    expect(tenantVerified(tenant, tenant, "a@vcomm.test")).toBe(true);
    expect(tenantVerified(tenant, "khac", "a@vcomm.test")).toBe(false);
    expect(tenantVerified("vcomm.test", "bat-ky", "a@vcomm.test")).toBe(true);
    expect(tenantVerified("vcomm.test", "bat-ky", "a@khac.vn")).toBe(false);
    expect(tenantVerified("organizations", "bat-ky", "a@vcomm.test")).toBe(false);
  });
});

describe("Zalo (CHUC_NANG_24)", () => {
  it("TIEUCHI_NGHIEMTHU_46: chưa liên kết thì từ chối; liên kết từ hồ sơ rồi đăng nhập được", async () => {
    await configure({ "zalo.app_id": "zalo-app", "zalo.app_secret": "zalo-secret-5555" });
    testOauth.profiles.set("zalo-phuc", { subject: "zalo-1001", email: null, emailVerified: false, name: "Phúc Zalo" });
    expect((await oauthRound("zalo", "zalo-phuc")).finished!.headers.location).toMatch(/\/dang-nhap\?loi=zaloNotLinked$/);
    // Liên kết cần phiên đã đăng nhập.
    expect((await server().get("/api/v1/auth/oauth/zalo/start?mode=link")).headers.location).toMatch(/\/ho-so\?loi=unauthenticated$/);
    const login = await server().post("/api/v1/auth/login").send({ identifier: "phuc.le@vcomm.test", password: testPassword });
    const access = cookieValue(login.headers["set-cookie"], "vc_access");
    const linked = await oauthRound("zalo", "zalo-phuc", { mode: "link", accessCookie: `vc_access=${access}` });
    expect(linked.finished!.headers.location).toMatch(/\/ho-so\?lienKet=zalo$/);
    const viaZalo = await oauthRound("zalo", "zalo-phuc");
    expect(viaZalo.finished!.headers.location).not.toContain("loi=");
    expect(await userIdOf(sessionFrom(application, viaZalo.finished!.headers["set-cookie"]))).toBe(testIds.purchasingManager);
  });

  it("TIEUCHI_NGHIEMTHU_47: Zalo đã gắn với nhân viên khác thì từ chối; không hủy được cách đăng nhập cuối cùng", async () => {
    const other = await server().post("/api/v1/auth/login").send({ identifier: "thukho.bd@vcomm.test", password: testPassword });
    const access = cookieValue(other.headers["set-cookie"], "vc_access");
    const linked = await oauthRound("zalo", "zalo-phuc", { mode: "link", accessCookie: `vc_access=${access}` });
    expect(linked.finished!.headers.location).toMatch(/\/ho-so\?loi=zaloLinkedElsewhere$/);
    // Nhân viên chỉ còn Zalo: không hủy được.
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    testOauth.profiles.set("zalo-kho", { subject: "zalo-2002", email: null, emailVerified: false, name: null });
    await oauthRound("zalo", "zalo-kho", { mode: "link", accessCookie: `vc_access=${access}` });
    await pool.query("DELETE FROM core.user_identities WHERE user_id = $1 AND provider = 'password'", [testIds.warehouseKeeper]);
    const identities = (await keeper.call("get", "/me/identities")).body;
    expect(identities).toHaveLength(1);
    const removed = await keeper.call("delete", `/me/identities/${identities[0].id}`);
    expect(removed.status).toBe(409);
    expect(removed.body.error.message).toBe("Bạn cần giữ ít nhất một cách đăng nhập.");
  });
});

describe("MAN_HINH_03: kích hoạt bằng Google", () => {
  it("email Google phải trùng email được mời; kích hoạt xong đăng nhập được bằng Google", async () => {
    const retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
    const invited = await retailAdmin.call("post", "/users/invitations", { companyId: testIds.retailCompany, body: { fullName: "Đoàn Thị Kích Hoạt", email: "kichhoat.google@vcomm.test" } });
    expect(invited.status).toBe(201);
    const message = [...sentMessages].reverse().find((item) => item.to === "kichhoat.google@vcomm.test")!;
    const token = /token=([^\s&]+)/.exec(message.body)![1]!;
    testOauth.profiles.set("ma-khac", { subject: "google-khac", email: "nguoi.khac@vcomm.test", emailVerified: true, name: null });
    expect((await oauthRound("google", "ma-khac", { mode: "activate", token })).finished!.headers.location).toContain(`/kich-hoat?token=${token}&loi=activationEmailMismatch`);
    expect((await pool.query("SELECT status FROM core.users WHERE email = 'kichhoat.google@vcomm.test'")).rows[0].status).toBe("invited");
    testOauth.profiles.set("ma-kich-hoat", { subject: "google-kich-hoat", email: "kichhoat.google@vcomm.test", emailVerified: true, name: null });
    expect((await oauthRound("google", "ma-kich-hoat", { mode: "activate", token })).finished!.headers.location).toMatch(/\/dang-nhap\?kichHoat=google$/);
    expect((await pool.query("SELECT status FROM core.users WHERE email = 'kichhoat.google@vcomm.test'")).rows[0].status).toBe("active");
    // Đường dẫn đã dùng thì không kích hoạt lại được; đăng nhập bằng Google được.
    expect((await oauthRound("google", "ma-kich-hoat", { mode: "activate", token })).started.headers.location).toMatch(/loi=activationInvalid$/);
    expect((await oauthRound("google", "ma-kich-hoat")).finished!.headers.location).not.toContain("loi=");
  });
});
