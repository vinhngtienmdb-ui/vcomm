// Kiểm thử CONG_VIEC_78: lệnh khởi tạo một lần tạo tập đoàn, quản trị tập đoàn "Đã mời", in một lần đường dẫn kích hoạt.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { describeError, runBootstrapCommand } from "../src/database/bootstrap";
import { signIn } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
const savedEnvironment = { NODE_ENV: process.env.NODE_ENV, WEB_ORIGIN: process.env.WEB_ORIGIN };

const adminEmail = "quantri@vcomm-khoi-tao.test";
const createArguments = [
  "--company-code=VCG",
  "--legal-name=Công ty Cổ phần Tập đoàn Khởi tạo",
  "--short-name=Tập đoàn Khởi tạo",
  "--tax-code=0300000009",
  `--admin-email=${adminEmail}`,
  "--admin-name=Nguyễn Văn Quản Trị",
];

async function run(argv: string[]): Promise<string[]> {
  const lines: string[] = [];
  await runBootstrapCommand(argv, pool, (line) => lines.push(line));
  return lines;
}

const linkToken = (lines: string[]) => {
  const links = lines.filter((line) => line.includes("/kich-hoat?token="));
  expect(links).toHaveLength(1);
  return decodeURIComponent(new URL(links[0]!).searchParams.get("token")!);
};

const counts = async () =>
  (await pool.query<{ companies: string; users: string }>("SELECT (SELECT count(*) FROM core.companies) AS companies, (SELECT count(*) FROM core.users) AS users")).rows[0]!;

const activate = (token: string, password: string) => request(application.getHttpServer()).post("/api/v1/auth/activation").set("accept-language", "vi").send({ token, password });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication({ seed: false }));
});

afterEach(() => {
  for (const [name, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_78 lệnh khởi tạo", () => {
  it("KICHBAN_KIEMTHU_837: tham số sai bị từ chối, lỗi chỉ nêu trường, không tạo dữ liệu", async () => {
    const wrong = createArguments.map((argument) => (argument.startsWith("--tax-code=") ? "--tax-code=12345" : argument.startsWith("--admin-email=") ? "--admin-email=khong-phai-email" : argument));
    const error = await run(wrong).catch((caught: unknown) => caught);
    const message = describeError(error);
    expect(message).toMatch(/^Tham số không hợp lệ: .*company\.taxCode/);
    expect(message).toContain("admin.email");
    expect(message).not.toContain("khong-phai-email");
    await expect(run(["--khong-co-co-nay"])).rejects.toThrow();
    expect(await counts()).toEqual({ companies: "0", users: "0" });
  });

  it("KICHBAN_KIEMTHU_837: môi trường thật thiếu WEB_ORIGIN thì báo lỗi và không để lại dữ liệu", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.WEB_ORIGIN;
    await expect(run(createArguments)).rejects.toThrow(/WEB_ORIGIN/);
    expect(await counts()).toEqual({ companies: "0", users: "0" });
  });

  it("KICHBAN_KIEMTHU_834, 835, 836, 838: cơ sở dữ liệu trống: tạo tập đoàn, quản trị Đã mời, in một lần đường dẫn; chạy lần hai bị từ chối; cấp lại vô hiệu đường dẫn cũ; kích hoạt rồi đăng nhập được", async () => {
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = "https://erp.vcomm-khoi-tao.test";
    const lines = await run(createArguments);
    const firstToken = linkToken(lines);
    expect(lines.join("\n")).toContain("https://erp.vcomm-khoi-tao.test/kich-hoat?token=");
    expect(lines.join("\n")).not.toMatch(/mật khẩu:/i);

    const company = (await pool.query("SELECT code, parent_id, legal_name, tax_code FROM core.companies")).rows;
    expect(company).toEqual([{ code: "VCG", parent_id: null, legal_name: "Công ty Cổ phần Tập đoàn Khởi tạo", tax_code: "0300000009" }]);
    const user = (await pool.query("SELECT id, email::text AS email, status, mfa_required FROM core.users")).rows[0];
    expect(user).toMatchObject({ email: adminEmail, status: "invited", mfa_required: true });
    const passwordIdentities = await pool.query("SELECT 1 FROM core.user_identities WHERE user_id = $1", [user.id]);
    expect(passwordIdentities.rows).toHaveLength(0);
    const role = await pool.query("SELECT r.code, a.scope_type FROM core.user_role_assignments a JOIN core.roles r ON r.id = a.role_id WHERE a.user_id = $1", [user.id]);
    expect(role.rows).toEqual([{ code: "group_admin", scope_type: "group" }]);

    // Chạy lần hai: từ chối, không thêm dữ liệu, không in đường dẫn.
    await expect(run(createArguments)).rejects.toThrow(/đã có công ty hoặc người dùng/);
    expect(await counts()).toEqual({ companies: "1", users: "1" });

    // Cấp lại khi còn Đã mời: đường dẫn cũ hết hiệu lực.
    const secondToken = linkToken(await run(["--reissue-link", `--admin-email=${adminEmail.toUpperCase()}`]));
    expect(secondToken).not.toBe(firstToken);
    expect((await activate(firstToken, "MatKhauQuanTri@2026")).status).toBe(409);

    // Nhật ký thao tác không chứa mã kích hoạt.
    const audit = await pool.query<{ action: string; text: string }>("SELECT action, coalesce(after_data::text, '') AS text FROM core.audit_events WHERE action IN ('system.bootstrap', 'user.invitation.resend')");
    expect(audit.rows.map((row) => row.action).sort()).toEqual(["system.bootstrap", "user.invitation.resend"]);
    for (const row of audit.rows) {
      expect(row.text).not.toContain(firstToken);
      expect(row.text).not.toContain(secondToken);
    }

    expect((await activate(secondToken, "MatKhauQuanTri@2026")).status).toBe(204);
    const session = await signIn(application, adminEmail, "MatKhauQuanTri@2026");
    const companyId = (await pool.query<{ id: string }>("SELECT id FROM core.companies")).rows[0]!.id;
    const companies = await session.call("get", "/companies", { companyId });
    expect(companies.status).toBe(200);

    // Đã kích hoạt: không cấp lại đường dẫn, không khởi tạo lại.
    await expect(run(["--reissue-link", `--admin-email=${adminEmail}`])).rejects.toThrow(/Đã mời/);
    await expect(run(createArguments)).rejects.toThrow(/đã có công ty hoặc người dùng/);
  });

  it("KICHBAN_KIEMTHU_836: cấp lại cho email không phải quản trị tập đoàn bị từ chối", async () => {
    await expect(run(["--reissue-link", "--admin-email=nguoi.khac@vcomm-khoi-tao.test"])).rejects.toThrow(/Đã mời/);
  });
});
