// KICHBAN_KIEMTHU cho TIEUCHI_NGHIEMTHU_10, 11, 27 (tài liệu 21).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds, testPassword } from "../src/database/seed";
import { cookieValue } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

const login = (identifier: string, password: string) =>
  request(application.getHttpServer()).post("/api/v1/auth/login").set("accept-language", "vi").send({ identifier, password });

describe("TIEUCHI_NGHIEMTHU_11: không tiết lộ tài khoản tồn tại", () => {
  it("sai mật khẩu và tài khoản không tồn tại trả cùng mã lỗi và thông báo", async () => {
    const wrongPassword = await login("quantri.vcr@vcomm.test", "SaiMatKhau@1");
    const unknownUser = await login("khong.ton.tai@vcomm.test", "SaiMatKhau@1");
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body.error.code).toBe(wrongPassword.body.error.code);
    expect(unknownUser.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it("thiếu trường trả lỗi theo từng trường", async () => {
    const response = await login("", "");
    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.fields)).toEqual(expect.arrayContaining(["identifier", "password"]));
  });
});

describe("TIEUCHI_NGHIEMTHU_10: khóa đăng nhập sau 5 lần sai liên tiếp", () => {
  const account = "thukho.bd@vcomm.test";

  it("4 lần sai rồi đúng thì vẫn đăng nhập được (giá trị biên)", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await login(account, "SaiMatKhau@1")).status).toBe(401);
    }
    expect((await login(account, testPassword)).status).toBe(200);
  });

  it("lần sai thứ 5 làm khóa 15 phút, kể cả khi nhập đúng mật khẩu", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(account, "SaiMatKhau@1")).status).toBe(401);
    }
    const locked = await login(account, testPassword);
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
    const retryAfter = Number(locked.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThan(14 * 60);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);
  });

  it("hết thời gian khóa thì đăng nhập lại được", async () => {
    await pool.query("UPDATE core.users SET login_locked_until = now() - interval '1 second' WHERE email = $1", [account]);
    expect((await login(account, testPassword)).status).toBe(200);
  });
});


describe("TIEUCHI_NGHIEMTHU_27: trang chủ chỉ hiện mini app có quyền", () => {
  async function homeApps(email: string, companyId?: string): Promise<{ status: number; codes: string[]; body: { error?: { code: string } } }> {
    const session = await login(email, testPassword);
    expect(session.status).toBe(200);
    const call = request(application.getHttpServer()).get("/api/v1/home").set("cookie", `vc_access=${cookieValue(session.headers["set-cookie"], "vc_access")}`);
    if (companyId) call.set("x-company-id", companyId);
    const response = await call;
    return { status: response.status, codes: (response.body.apps ?? []).map((app: { code: string }) => app.code).sort(), body: response.body };
  }

  it("trưởng phòng mua hàng tại VCR thấy mua hàng, kho, danh mục", async () => {
    const result = await homeApps("phuc.le@vcomm.test", testIds.retailCompany);
    // CONG_VIEC_52 (đặc tả mục 6, người dùng duyệt 2026-11-11): vai trò Nhân viên có office.access nên thấy thêm Văn phòng số.
    expect(result.codes).toEqual(["catalog", "inventory", "office", "platform", "purchasing"]);
  });

  it("cùng người dùng chuyển sang VCT chỉ thấy nền tảng, Văn phòng số", async () => {
    const result = await homeApps("phuc.le@vcomm.test", testIds.tradingCompany);
    // Vai trò Nhân viên ở VCT có office.access (CONG_VIEC_52), không có quyền mini app nghiệp vụ nào khác.
    expect(result.codes).toEqual(["office", "platform"]);
  });

  it("chọn công ty không phải thành viên bị từ chối", async () => {
    const result = await homeApps("phuc.le@vcomm.test", testIds.groupCompany);
    expect(result.status).toBe(403);
    expect(result.body.error?.code).toBe("FORBIDDEN");
  });

  it("chưa đăng nhập bị từ chối", async () => {
    const response = await request(application.getHttpServer()).get("/api/v1/home");
    expect(response.status).toBe(401);
  });
});
