// KICHBAN_KIEMTHU_118, 119 (tài liệu 21): dữ liệu đầu vào độc hại; phiên, đăng xuất, token làm mới dùng lại, chống giả mạo yêu cầu.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds, testPassword } from "../src/database/seed";
import { cookieValue, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
const retail: string = testIds.retailCompany;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  admin = await signIn(application, "quantri.vcr@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("KICHBAN_KIEMTHU_118: dữ liệu đầu vào độc hại", () => {
  const script = `<script>alert("x")</script><img src=x onerror=alert(1)>`;

  it("chuỗi chèn mã được lưu nguyên văn để giao diện hiển thị dạng chữ", async () => {
    const created = await admin.call("post", "/branches", { companyId: retail, body: { code: "VCR-XSS", name: script, branchType: "store", provinceCode: "79" } });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe(script);
  });

  it("chuỗi quá dài và trường thừa nhận 400", async () => {
    expect((await admin.call("post", "/branches", { companyId: retail, body: { code: "VCR-DAI", name: "A".repeat(5000), branchType: "store" } })).status).toBe(400);
    expect((await admin.call("post", "/branches", { companyId: retail, body: { code: "VCR-THUA", name: "Thừa", branchType: "store", isAdmin: true } })).status).toBe(400);
    expect((await admin.call("post", "/users/invitations", { companyId: retail, body: { fullName: "B".repeat(5000), email: "dai@vcomm.test" } })).status).toBe(400);
  });

  it("chuỗi chèn truy vấn không đổi kết quả lọc", async () => {
    for (const value of ["' OR 1=1 --", "%' OR '1'='1", "'; DROP TABLE core.users; --"]) {
      const users = await admin.call("get", `/users?q=${encodeURIComponent(value)}`, { companyId: retail });
      expect(users.status).toBe(200);
      expect(users.body.total).toBe(0);
      const audit = await admin.call("get", `/audit-events?action=${encodeURIComponent(value)}`, { companyId: retail });
      expect(audit.status).toBe(200);
      expect(audit.body.total).toBe(0);
    }
    expect((await pool.query("SELECT count(*)::int AS total FROM core.users")).rows[0].total).toBeGreaterThan(0);
  });
});

describe("KICHBAN_KIEMTHU_119: phiên, đăng xuất, token làm mới, chống giả mạo yêu cầu", () => {
  const server = () => request(application.getHttpServer());

  async function login(): Promise<{ cookies: string[]; access: string; refresh: string; csrf: string }> {
    const response = await server().post("/api/v1/auth/login").send({ identifier: "phuc.le@vcomm.test", password: testPassword });
    expect(response.status).toBe(200);
    const cookies = response.headers["set-cookie"] as unknown as string[];
    return { cookies, access: cookieValue(cookies, "vc_access"), refresh: cookieValue(cookies, "vc_refresh"), csrf: cookieValue(cookies, "vc_csrf") };
  }

  it("cookie phiên có HttpOnly, SameSite=Lax; cookie CSRF đọc được bằng JavaScript", async () => {
    const { cookies } = await login();
    for (const name of ["vc_access", "vc_refresh"]) {
      const cookie = cookies.find((item) => item.startsWith(`${name}=`))!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
    }
    expect(cookies.find((item) => item.startsWith("vc_csrf="))).not.toMatch(/HttpOnly/i);
  });

  it("dùng lại token làm mới cũ bị từ chối và cả chuỗi phiên bị thu hồi", async () => {
    const first = await login();
    const renewed = await server().post("/api/v1/auth/refresh").set("cookie", `vc_refresh=${first.refresh}; vc_csrf=${first.csrf}`).set("x-csrf-token", first.csrf);
    expect(renewed.status).toBe(204);
    const next = renewed.headers["set-cookie"] as unknown as string[];
    const nextAccess = cookieValue(next, "vc_access");
    const nextRefresh = cookieValue(next, "vc_refresh");
    const reuse = await server().post("/api/v1/auth/refresh").set("cookie", `vc_refresh=${first.refresh}; vc_csrf=${first.csrf}`).set("x-csrf-token", first.csrf);
    expect(reuse.status).toBe(401);
    expect((await server().post("/api/v1/auth/refresh").set("cookie", `vc_refresh=${nextRefresh}; vc_csrf=${first.csrf}`).set("x-csrf-token", first.csrf)).status).toBe(401);
    expect((await server().get("/api/v1/me").set("cookie", `vc_access=${nextAccess}`)).status).toBe(401);
  });

  it("thao tác ghi thiếu hoặc sai X-CSRF-Token bị từ chối", async () => {
    const { access, csrf } = await login();
    const cookie = `vc_access=${access}; vc_csrf=${csrf}`;
    expect((await server().patch("/api/v1/me").set("cookie", cookie).send({ locale: "en" })).status).toBe(403);
    expect((await server().patch("/api/v1/me").set("cookie", cookie).set("x-csrf-token", "gia-mao").send({ locale: "en" })).status).toBe(403);
    expect((await server().post("/api/v1/auth/refresh").set("cookie", cookie)).status).toBe(401);
  });

  it("sau đăng xuất, cookie cũ nhận 401", async () => {
    const { access, csrf } = await login();
    const cookie = `vc_access=${access}; vc_csrf=${csrf}`;
    expect((await server().get("/api/v1/me").set("cookie", cookie)).status).toBe(200);
    expect((await server().post("/api/v1/auth/logout").set("cookie", cookie).set("x-csrf-token", csrf)).status).toBe(204);
    expect((await server().get("/api/v1/me").set("cookie", cookie)).status).toBe(401);
  });
});
