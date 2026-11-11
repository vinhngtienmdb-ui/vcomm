// Hàm dùng chung cho kiểm thử API: đăng nhập, gửi yêu cầu kèm cookie phiên, CSRF và công ty đang chọn.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { Secret, TOTP } from "otpauth";
import { expect } from "vitest";
import { testPassword } from "../src/database/seed";

export function cookieValue(setCookie: string[] | string | undefined, name: string): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const found = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  if (!found) throw new Error(`Không nhận được cookie ${name}.`);
  return found.split(";")[0]!.slice(name.length + 1);
}

export type Method = "get" | "post" | "put" | "patch" | "delete";

export interface Session {
  call(method: Method, path: string, options?: { companyId?: string; body?: unknown }): request.Test;
}

// Bí mật TOTP của tài khoản thử đã đăng ký, để đăng nhập lại tự nhập mã.
export const totpSecrets = new Map<string, string>();

export const totpCode = (secret: string) => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate();

// Đăng nhập; tài khoản cần xác thực hai lớp thì tự đăng ký hoặc nhập mã TOTP.
export async function signIn(application: NestExpressApplication, email: string, password = testPassword): Promise<Session> {
  const response = await request(application.getHttpServer()).post("/api/v1/auth/login").send({ identifier: email, password });
  expect(response.status).toBe(200);
  const session = sessionFrom(application, response.headers["set-cookie"]);
  if (response.body.mfaRequired) {
    let secret = totpSecrets.get(email);
    if (!response.body.mfaEnrolled) {
      const enrolled = await session.call("post", "/auth/mfa/enroll");
      expect(enrolled.status).toBe(201);
      secret = enrolled.body.secretForManualEntry as string;
      totpSecrets.set(email, secret);
      expect((await session.call("post", "/auth/mfa/enroll/confirm", { body: { code: totpCode(secret) } })).status).toBe(201);
    } else {
      expect((await session.call("post", "/auth/mfa/verify", { body: { code: totpCode(secret!) } })).status).toBe(204);
    }
  }
  return session;
}

export function sessionFrom(application: NestExpressApplication, setCookie: string[] | string | undefined): Session {
  const access = cookieValue(setCookie, "vc_access");
  const csrf = cookieValue(setCookie, "vc_csrf");
  return {
    call(method, path, options = {}) {
      const call = request(application.getHttpServer())[method](`/api/v1${path}`).set("accept-language", "vi").set("cookie", `vc_access=${access}; vc_csrf=${csrf}`).set("x-csrf-token", csrf);
      if (options.companyId) call.set("x-company-id", options.companyId);
      if (options.body !== undefined) call.send(options.body as object);
      return call;
    },
  };
}

// Tạo nhân viên thử dùng chung mật khẩu thử; trả mã nhân viên.
export async function createTestUser(pool: Pool, email: string, fullName: string, memberships: { companyId: string; branchId?: string }[]): Promise<string> {
  const user = await pool.query<{ id: string }>(`INSERT INTO core.users (email, full_name, status) VALUES ($1, $2, 'active') RETURNING id`, [email, fullName]);
  const id = user.rows[0]!.id;
  await pool.query(
    `INSERT INTO core.user_identities (user_id, provider, provider_subject, password_hash)
     SELECT $1, 'password', $2, password_hash FROM core.user_identities WHERE provider = 'password' AND provider_subject = 'quantri.vcr@vcomm.test'`,
    [id, email],
  );
  for (const [index, membership] of memberships.entries()) {
    await pool.query(`INSERT INTO core.user_company_memberships (user_id, company_id, default_branch_id, is_default) VALUES ($1, $2, $3, $4)`, [
      id,
      membership.companyId,
      membership.branchId ?? null,
      index === 0,
    ]);
  }
  return id;
}

// CONG_VIEC_43 (QUYTAC_NGHIEPVU_276): Nhân viên bán hàng không còn quyền lập đơn bán. Kiểm thử viết trước dùng nhân viên bán hàng lập đơn
// được giao thêm vai trò thử của công ty có quyền lập đơn bán ở bước chuẩn bị (người dùng đồng ý 2026-11-11); quyền mới kiểm trong c43-scope-and-roles.
export async function grantSalesOrderManage(pool: Pool, email: string, companyId: string): Promise<void> {
  const existing = await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE company_id = $1 AND code = 'test_sales_order_manager'", [companyId]);
  let roleId = existing.rows[0]?.id;
  if (!roleId) {
    roleId = (
      await pool.query<{ id: string }>(
        "INSERT INTO core.roles (company_id, code, name_vi, name_en, status) VALUES ($1, 'test_sales_order_manager', 'Lập đơn bán (kiểm thử)', 'Sales order manager (test)', 'active') RETURNING id",
        [companyId],
      )
    ).rows[0]!.id;
    await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) SELECT $1, unnest(ARRAY['sales.access', 'sales.order.view', 'sales.order.manage'])", [roleId]);
  }
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $2, 'company', $3, '2026-01-01' FROM core.users WHERE email = $1", [
    email,
    roleId,
    companyId,
  ]);
}
