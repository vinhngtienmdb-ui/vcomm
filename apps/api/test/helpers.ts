// Hàm dùng chung cho kiểm thử API: đăng nhập, gửi yêu cầu kèm cookie phiên, CSRF và công ty đang chọn.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
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

export async function signIn(application: NestExpressApplication, email: string): Promise<Session> {
  const response = await request(application.getHttpServer()).post("/api/v1/auth/login").send({ identifier: email, password: testPassword });
  expect(response.status).toBe(200);
  const access = cookieValue(response.headers["set-cookie"], "vc_access");
  const csrf = cookieValue(response.headers["set-cookie"], "vc_csrf");
  return {
    call(method, path, options = {}) {
      const call = request(application.getHttpServer())[method](`/api/v1${path}`)
        .set("accept-language", "vi")
        .set("cookie", `vc_access=${access}; vc_csrf=${csrf}`)
        .set("x-csrf-token", csrf);
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
