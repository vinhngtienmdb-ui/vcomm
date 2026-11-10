// CONG_VIEC_22: Ứng dụng nhân viên kinh doanh (KICHBAN_KIEMTHU_287 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, totpCode, totpSecrets } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
const retail: string = testIds.retailCompany;
const ids: Record<string, string> = {};

const http = () => request(application.getHttpServer());
const bearer = (method: "get" | "post", path: string, token: string, body?: object) => {
  const call = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("x-company-id", retail).set("accept-language", "vi");
  return body ? call.send(body) : call;
};
async function assign(key: string, email: string, name: string, role: string) {
  ids[key] = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [ids[key], roleId, retail]);
}
const appLogin = (identifier: string) => http().post("/api/v1/auth/app/login").send({ identifier, password: "MatKhauThu@2026" });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  await assign("seller", "banhang.app@vcomm.test", "Bán Hàng Ứng Dụng", "salesperson");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_22 đăng nhập ứng dụng", () => {
  it("KICHBAN_KIEMTHU_287: đăng nhập trả token trong thân phản hồi, phiên của ứng dụng 90 ngày; token làm mới đổi mới mỗi lần dùng, dùng lại token cũ thu hồi cả chuỗi; đăng xuất thu hồi phiên", async () => {
    const login = await appLogin("banhang.app@vcomm.test");
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    expect(login.body).toMatchObject({ mfaRequired: false, user: { fullName: "Bán Hàng Ứng Dụng" } });
    expect(login.headers["set-cookie"]).toBeUndefined();
    const tokens = login.body.tokens as { accessToken: string; refreshToken: string; refreshExpiresAt: string };
    const days = (Date.parse(tokens.refreshExpiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThanOrEqual(90);
    const session = (await pool.query("SELECT client_type FROM core.sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [ids.seller])).rows[0];
    expect(session.client_type).toBe("sales_app");
    const me = await bearer("get", "/me", tokens.accessToken);
    expect(me.status).toBe(200);
    expect(me.body.permissions).toContain("sales.access");
    // Ghi bằng header Authorization không cần CSRF.
    const created = await bearer("post", "/crm/partners", tokens.accessToken, { kind: "organization", name: "Khách ứng dụng", taxCode: "0322000001" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const refreshed = await http().post("/api/v1/auth/app/refresh").send({ refreshToken: tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(tokens.refreshToken);
    expect((await bearer("get", "/me", refreshed.body.accessToken)).status).toBe(200);
    // Dùng lại token làm mới cũ: thu hồi cả chuỗi, token mới cũng hết dùng được.
    expect((await http().post("/api/v1/auth/app/refresh").send({ refreshToken: tokens.refreshToken })).status).toBe(401);
    expect((await http().post("/api/v1/auth/app/refresh").send({ refreshToken: refreshed.body.refreshToken })).status).toBe(401);
    expect((await bearer("get", "/me", refreshed.body.accessToken)).status).toBe(401);

    const again = await appLogin("banhang.app@vcomm.test");
    expect((await bearer("post", "/auth/logout", again.body.tokens.accessToken)).status).toBe(204);
    expect((await bearer("get", "/me", again.body.tokens.accessToken)).status).toBe(401);
    expect((await http().post("/api/v1/auth/app/refresh").send({ refreshToken: again.body.tokens.refreshToken })).status).toBe(401);
  });

  it("KICHBAN_KIEMTHU_288: sai mật khẩu báo chung một lỗi; xác thực hai lớp qua header Authorization; token làm mới của phiên web không dùng được ở ứng dụng", async () => {
    const wrong = await http().post("/api/v1/auth/app/login").send({ identifier: "banhang.app@vcomm.test", password: "Sai@12345" });
    expect(wrong.status).toBe(401);
    expect((await http().post("/api/v1/auth/app/login").send({ identifier: "khongco@vcomm.test", password: "Sai@12345" })).body.error.message).toBe(wrong.body.error.message);
    // Quản trị công ty bắt buộc xác thực hai lớp: đăng ký qua web trước, ứng dụng nhập mã.
    await signIn(application, "quantri.vcr@vcomm.test");
    const login = await appLogin("quantri.vcr@vcomm.test");
    expect(login.body).toMatchObject({ mfaRequired: true, mfaEnrolled: true });
    const pending = login.body.tokens.accessToken as string;
    expect((await bearer("get", "/crm/partners", pending)).status).toBe(401);
    const verified = await bearer("post", "/auth/mfa/verify", pending, { code: totpCode(totpSecrets.get("quantri.vcr@vcomm.test")!) });
    expect(verified.status, JSON.stringify(verified.body)).toBe(204);
    expect((await bearer("get", "/crm/partners", pending)).status).toBe(200);
    // Token làm mới của phiên web gửi tới API của ứng dụng bị từ chối.
    const web = await http().post("/api/v1/auth/login").send({ identifier: "banhang.app@vcomm.test", password: "MatKhauThu@2026" });
    const webRefresh = (web.headers["set-cookie"] as unknown as string[])
      .find((cookie) => cookie.startsWith("vc_refresh="))!
      .split(";")[0]!
      .slice("vc_refresh=".length);
    expect(
      (
        await http()
          .post("/api/v1/auth/app/refresh")
          .send({ refreshToken: decodeURIComponent(webRefresh) })
      ).status,
    ).toBe(401);
  });
});
