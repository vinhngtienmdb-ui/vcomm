// KICHBAN_KIEMTHU cho TIEUCHI_NGHIEMTHU_12, 15 đến 18 (tài liệu 21, lát L5).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds, testPassword } from "../src/database/seed";
import { createTestUser, sessionFrom, signIn, totpCode, totpSecrets, type Session } from "./helpers";
import { sentMessages, startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;

const retail: string = testIds.retailCompany;
const server = () => application.getHttpServer();
const rawLogin = (identifier: string, password = testPassword) => request(server()).post("/api/v1/auth/login").send({ identifier, password });

function linkToken(to: string, path: string): string {
  const message = [...sentMessages].reverse().find((item) => item.to === to && item.body.includes(path));
  if (!message) throw new Error(`Không có tin gửi tới ${to}.`);
  return decodeURIComponent(/token=([A-Za-z0-9_-]+)/.exec(message.body)![1]!);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_12: đặt lại mật khẩu thu hồi các phiên cũ", () => {
  it("hai trình duyệt đang đăng nhập; đặt lại ở một nơi thì cả hai phải đăng nhập lại", async () => {
    const first = await signIn(application, "phuc.le@vcomm.test");
    const second = await signIn(application, "phuc.le@vcomm.test");
    expect((await first.call("get", "/me")).status).toBe(200);
    const forgot = await request(server()).post("/api/v1/auth/password/forgot").send({ identifier: "phuc.le@vcomm.test" });
    expect(forgot.status).toBe(204);
    const token = linkToken("phuc.le@vcomm.test", "quen-mat-khau");
    expect((await request(server()).post("/api/v1/auth/password/reset").send({ token, password: "MatKhauMoi@2026" })).status).toBe(204);
    expect((await first.call("get", "/me")).status).toBe(401);
    expect((await second.call("get", "/me")).status).toBe(401);
    expect((await rawLogin("phuc.le@vcomm.test", "MatKhauMoi@2026")).status).toBe(200);
    expect((await rawLogin("phuc.le@vcomm.test")).status).toBe(401);
    const reused = await request(server()).post("/api/v1/auth/password/reset").send({ token, password: "MatKhauKhac@2026" });
    expect(reused.status).toBe(409);
  });

  it("email không tồn tại vẫn trả 204 và không gửi tin; đường dẫn quá 1 giờ bị từ chối", async () => {
    const before = sentMessages.length;
    expect((await request(server()).post("/api/v1/auth/password/forgot").send({ identifier: "khong.co@vcomm.test" })).status).toBe(204);
    expect(sentMessages.length).toBe(before);
    try {
      testClock.fixed = new Date("2026-11-09T08:00:00+07:00");
      await request(server()).post("/api/v1/auth/password/forgot").send({ identifier: "thukho.bd@vcomm.test" });
      const token = linkToken("thukho.bd@vcomm.test", "quen-mat-khau");
      testClock.fixed = new Date("2026-11-09T09:00:01+07:00");
      const expired = await request(server()).post("/api/v1/auth/password/reset").send({ token, password: "MatKhauMoi@2026" });
      expect(expired.status).toBe(409);
      expect(expired.body.error.code).toBe("BUSINESS_RULE");
    } finally {
      testClock.fixed = null;
    }
  });
});

describe("TIEUCHI_NGHIEMTHU_15: gán vai trò có quyền nhạy cảm thì lần đăng nhập sau bắt buộc mã", () => {
  it("gán vai trò kế toán, đăng nhập lại phải đăng ký và nhập mã; chưa nhập mã thì API khác trả MFA_REQUIRED", async () => {
    const userId = await createTestUser(pool, "ke.toan@vcomm.test", "Bùi Thị Kế Toán", [{ companyId: retail, branchId: testIds.headOfficeBranch }]);
    const created = await retailAdmin.call("post", "/roles", { companyId: retail, body: { code: "ke_toan_thu", nameVi: "Kế toán thử", nameEn: "Test accountant" } });
    await retailAdmin.call("put", `/roles/${created.body.id}/permissions`, { companyId: retail, body: { permissionCodes: ["finance.access"], version: created.body.version } });
    expect((await rawLogin("ke.toan@vcomm.test")).body.mfaRequired).toBe(false);
    await retailAdmin.call("post", `/users/${userId}/role-assignments`, { companyId: retail, body: { roleId: created.body.id, scopeType: "company", validFrom: "2026-01-01" } });
    const login = await rawLogin("ke.toan@vcomm.test");
    expect(login.body).toMatchObject({ mfaRequired: true, mfaEnrolled: false });
    const pending = sessionFrom(application, login.headers["set-cookie"]);
    const blocked = await pending.call("get", "/home");
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe("MFA_REQUIRED");
    const enrolled = await pending.call("post", "/auth/mfa/enroll");
    expect(enrolled.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/VComm/);
    const wrong = await pending.call("post", "/auth/mfa/enroll/confirm", { body: { code: "000000" } });
    expect(wrong.body.error.fields.code).toBe("Mã xác thực không đúng.");
    const confirmed = await pending.call("post", "/auth/mfa/enroll/confirm", { body: { code: totpCode(enrolled.body.secretForManualEntry) } });
    expect(confirmed.body.backupCodes).toHaveLength(10);
    expect((await pending.call("get", "/home")).status).toBe(200);
    totpSecrets.set("ke.toan@vcomm.test", enrolled.body.secretForManualEntry);
  });

  it("sai mã 5 lần trong một phiên thì phiên bị thu hồi", async () => {
    const login = await rawLogin("ke.toan@vcomm.test");
    const pending = sessionFrom(application, login.headers["set-cookie"]);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await pending.call("post", "/auth/mfa/verify", { body: { code: "000000" } })).status).toBe(400);
    }
    const sixth = await pending.call("post", "/auth/mfa/verify", { body: { code: totpCode(totpSecrets.get("ke.toan@vcomm.test")!) } });
    expect(sixth.status).toBe(401);
  });
});

describe("TIEUCHI_NGHIEMTHU_16: mã dự phòng dùng một lần", () => {
  it("dùng mã dự phòng lần hai bị từ chối", async () => {
    const owner = await signIn(application, "tygia@vcomm.test");
    const regenerated = await owner.call("post", "/me/mfa/backup-codes", { body: { code: totpCode(totpSecrets.get("tygia@vcomm.test")!) } });
    const backupCode = regenerated.body.backupCodes[0] as string;
    const first = sessionFrom(application, (await rawLogin("tygia@vcomm.test")).headers["set-cookie"]);
    expect((await first.call("post", "/auth/mfa/verify", { body: { backupCode } })).status).toBe(204);
    const second = sessionFrom(application, (await rawLogin("tygia@vcomm.test")).headers["set-cookie"]);
    const reused = await second.call("post", "/auth/mfa/verify", { body: { backupCode } });
    expect(reused.status).toBe(400);
    expect(reused.body.error.fields.backupCode).toBe("Mã xác thực không đúng.");
  });
});

describe("TIEUCHI_NGHIEMTHU_17: không tắt được xác thực hai lớp khi đang bắt buộc", () => {
  it("quản trị VCR (bắt buộc) không tắt được; nhân viên tự bật thì tắt được", async () => {
    const response = await retailAdmin.call("post", "/me/mfa/disable", { body: { code: totpCode(totpSecrets.get("quantri.vcr@vcomm.test")!) } });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Tài khoản của bạn bắt buộc xác thực hai lớp.");

    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    const enrolled = await keeper.call("post", "/auth/mfa/enroll");
    await keeper.call("post", "/auth/mfa/enroll/confirm", { body: { code: totpCode(enrolled.body.secretForManualEntry) } });
    expect((await rawLogin("thukho.bd@vcomm.test")).body.mfaRequired).toBe(true);
    const disabled = await keeper.call("post", "/me/mfa/disable", { body: { code: totpCode(enrolled.body.secretForManualEntry) } });
    expect(disabled.status).toBe(204);
    expect((await rawLogin("thukho.bd@vcomm.test")).body.mfaRequired).toBe(false);
  });
});

describe("TIEUCHI_NGHIEMTHU_18: thu hồi một phiên thì thiết bị đó phải đăng nhập lại", () => {
  it("thu hồi phiên khác trong danh sách", async () => {
    const laptop = await signIn(application, "thukho.bd@vcomm.test");
    const phone = await signIn(application, "thukho.bd@vcomm.test");
    const list = await laptop.call("get", "/me/sessions");
    const other = list.body.find((item: { current: boolean }) => !item.current);
    expect(list.body.some((item: { current: boolean }) => item.current)).toBe(true);
    expect((await laptop.call("delete", `/me/sessions/${other.id}`)).status).toBe(204);
    const statuses = [(await laptop.call("get", "/me")).status, (await phone.call("get", "/me")).status];
    expect(statuses.sort()).toEqual([200, 401]);
  });

  it("không thu hồi được phiên của người khác", async () => {
    const other = (await pool.query<{ id: string }>("SELECT id FROM core.sessions WHERE user_id = $1 AND revoked_at IS NULL LIMIT 1", [testIds.retailAdmin])).rows[0]!;
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    expect((await keeper.call("delete", `/me/sessions/${other.id}`)).status).toBe(404);
  });
});

describe("CHUC_NANG_10: hồ sơ cá nhân", () => {
  it("đổi mật khẩu cần mật khẩu hiện tại, thu hồi các phiên khác", async () => {
    const current = await signIn(application, "thukho.bd@vcomm.test");
    const other = await signIn(application, "thukho.bd@vcomm.test");
    const wrong = await current.call("post", "/me/password", { body: { currentPassword: "Sai@123456", newPassword: "MatKhauMoi@99" } });
    expect(wrong.body.error.fields.currentPassword).toBe("Mật khẩu hiện tại không đúng.");
    const short = await current.call("post", "/me/password", { body: { currentPassword: testPassword, newPassword: "Ngan@1" } });
    expect(short.body.error.fields.newPassword).toBe("Mật khẩu phải có ít nhất 10 ký tự.");
    expect((await current.call("post", "/me/password", { body: { currentPassword: testPassword, newPassword: "MatKhauMoi@99" } })).status).toBe(204);
    expect((await current.call("get", "/me")).status).toBe(200);
    expect((await other.call("get", "/me")).status).toBe(401);
  });

  it("đổi ngôn ngữ, họ tên; công ty mặc định phải là công ty mình thuộc về", async () => {
    const me = await retailAdmin.call("get", "/me");
    const updated = await retailAdmin.call("patch", "/me", { body: { locale: "en", fullName: "Tran Minh Quan", version: me.body.user.version } });
    expect(updated.body.user).toMatchObject({ locale: "en", fullName: "Tran Minh Quan" });
    const foreign = await retailAdmin.call("patch", "/me", { body: { defaultCompanyId: testIds.tradingCompany, version: updated.body.user.version } });
    expect(foreign.status).toBe(403);
  });
});
