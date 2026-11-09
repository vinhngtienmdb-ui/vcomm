// KICHBAN_KIEMTHU cho TIEUCHI_NGHIEMTHU_06 đến 09 (tài liệu 21, lát L4).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import readXlsxFile from "read-excel-file/node";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { userImportColumns } from "contracts";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { sentMessages, startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;

const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const server = () => application.getHttpServer();

function linkTokenFor(to: string): string {
  const message = [...sentMessages].reverse().find((item) => item.to === to);
  if (!message) throw new Error(`Không có tin gửi tới ${to}.`);
  const token = /token=([^\s&]+)/.exec(message.body)?.[1];
  if (!token) throw new Error("Tin không có đường dẫn kích hoạt.");
  return decodeURIComponent(token);
}

const invite = (session: Session, body: Record<string, unknown>, companyId = retail) => session.call("post", "/users/invitations", { companyId, body });
const activate = (token: string, password: string) => request(server()).post("/api/v1/auth/activation").set("accept-language", "vi").send({ token, password });
const login = (identifier: string, password: string) => request(server()).post("/api/v1/auth/login").send({ identifier, password });

async function spreadsheet(rows: string[][]): Promise<Buffer> {
  return writeXlsxFile([[...userImportColumns].map((value) => ({ value })), ...rows.map((row) => row.map((value) => ({ value })))]).toBuffer();
}

const upload = (session: Session, buffer: Buffer, name = "nhap.xlsx") => session.call("post", "/users/imports", { companyId: retail }).attach("file", buffer, name);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_06: mời, kích hoạt rồi đăng nhập", () => {
  it("KICHBAN_KIEMTHU_12: trạng thái Đã mời, có sự kiện, kích hoạt xong đăng nhập được", async () => {
    const invited = await invite(retailAdmin, { fullName: "Ngô Văn Mời", email: "Moi.NhanVien01@vcomm.test", defaultBranchId: testIds.headOfficeBranch });
    expect(invited.status).toBe(201);
    expect(invited.body).toMatchObject({ status: "invited", addedToExistingAccount: false });
    const events = await pool.query("SELECT 1 FROM core.outbox_events WHERE event_type = 'core.user.created' AND aggregate_id = $1", [invited.body.userId]);
    expect(events.rows.length).toBe(1);
    const token = linkTokenFor("moi.nhanvien01@vcomm.test");
    const info = await request(server()).get(`/api/v1/auth/activation/${encodeURIComponent(token)}`);
    expect(info.body).toMatchObject({ fullName: "Ngô Văn Mời", companyName: "VComm Bán lẻ Miền Nam" });
    expect((await activate(token, "MatKhauMoi@01")).status).toBe(204);
    expect((await pool.query("SELECT status FROM core.users WHERE id = $1", [invited.body.userId])).rows[0].status).toBe("active");
    const session = await login("moi.nhanvien01@vcomm.test", "MatKhauMoi@01");
    expect(session.status).toBe(200);
    expect(session.headers["set-cookie"]).toBeDefined();
  });

  it("KICHBAN_KIEMTHU_14: mật khẩu 9 ký tự bị từ chối, đường dẫn vẫn dùng được; 10 ký tự thành công", async () => {
    await invite(retailAdmin, { fullName: "Nhân viên Ba", phone: "0912 000 003" });
    const token = linkTokenFor("+84912000003");
    const short = await activate(token, "MatKhau@9");
    expect(short.status).toBe(400);
    expect(short.body.error.fields.password).toBe("Mật khẩu phải có ít nhất 10 ký tự.");
    expect((await activate(token, "MatKhau@10")).status).toBe(204);
    expect((await login("0912000003", "MatKhau@10")).status).toBe(200);
  });

  it("KICHBAN_KIEMTHU_15: thủ kho, hoặc quản trị VCR mời vào VCT, đều bị từ chối", async () => {
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    expect((await invite(keeper, { fullName: "X", email: "moi.nhanvien04@vcomm.test" })).status).toBe(403);
    expect((await invite(retailAdmin, { fullName: "X", email: "moi.nhanvien04@vcomm.test" }, trading)).status).toBe(403);
    expect((await pool.query("SELECT 1 FROM core.users WHERE email = 'moi.nhanvien04@vcomm.test'")).rows.length).toBe(0);
  });

  it("thiếu cả email, số điện thoại, tên đăng nhập bị từ chối; email trùng người khác bị từ chối", async () => {
    const missing = await invite(retailAdmin, { fullName: "Không định danh" });
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.email).toBe("Cần nhập email hoặc số điện thoại để gửi đường dẫn kích hoạt.");
    const usernameOnly = await invite(retailAdmin, { fullName: "Chỉ tên đăng nhập", username: "chi.ten.dang.nhap" });
    expect(usernameOnly.status).toBe(400);
    expect(usernameOnly.body.error.fields.email).toBe("Cần nhập email hoặc số điện thoại để gửi đường dẫn kích hoạt.");
    const conflict = await invite(retailAdmin, { fullName: "Trùng", email: "nguoi.moi@vcomm.test", phone: "0912000003" });
    expect(conflict.status).toBe(400);
    expect(conflict.body.error.fields.phone).toBe("Số điện thoại đã được dùng cho tài khoản khác.");
  });

  it("mời kèm vai trò ban đầu", async () => {
    const invited = await invite(retailAdmin, { fullName: "Có vai trò", email: "co.vai.tro@vcomm.test", roleAssignments: [{ roleId: testIds.warehouseKeeperRole, scopeType: "company", validFrom: "2026-01-01" }] });
    expect(invited.status).toBe(201);
    const roles = await pool.query("SELECT 1 FROM core.user_role_assignments WHERE user_id = $1 AND role_id = $2", [invited.body.userId, testIds.warehouseKeeperRole]);
    expect(roles.rows.length).toBe(1);
  });
});

describe("TIEUCHI_NGHIEMTHU_07: đường dẫn hết hạn sau 72 giờ, dùng một lần", () => {
  it("KICHBAN_KIEMTHU_16, 17: quanh mốc 72 giờ; dùng lại bị từ chối; gửi lại thì dùng được", async () => {
    try {
      testClock.fixed = new Date("2026-11-09T08:00:00+07:00");
      const first = await invite(retailAdmin, { fullName: "Nhân viên Năm", email: "moi.nhanvien05@vcomm.test" });
      const second = await invite(retailAdmin, { fullName: "Nhân viên Sáu", email: "moi.nhanvien06@vcomm.test" });
      const tokenFive = linkTokenFor("moi.nhanvien05@vcomm.test");
      const tokenSix = linkTokenFor("moi.nhanvien06@vcomm.test");
      testClock.fixed = new Date("2026-11-12T07:59:00+07:00");
      expect((await activate(tokenFive, "MatKhauNam@05")).status).toBe(204);
      testClock.fixed = new Date("2026-11-12T08:01:00+07:00");
      const expired = await activate(tokenSix, "MatKhauSau@06");
      expect(expired.status).toBe(409);
      expect(expired.body.error.message).toBe("Đường dẫn kích hoạt đã hết hạn hoặc đã được dùng.");

      const reused = await activate(tokenFive, "MatKhauKhac@05");
      expect(reused.status).toBe(409);
      expect((await login("moi.nhanvien05@vcomm.test", "MatKhauNam@05")).status).toBe(200);

      expect((await retailAdmin.call("post", `/users/${second.body.userId}/invitations/resend`, { companyId: retail })).status).toBe(204);
      expect((await activate(linkTokenFor("moi.nhanvien06@vcomm.test"), "MatKhauSau@06")).status).toBe(204);
      const resendActive = await retailAdmin.call("post", `/users/${first.body.userId}/invitations/resend`, { companyId: retail });
      expect(resendActive.status).toBe(409);
    } finally {
      testClock.fixed = null;
    }
  });
});

describe("TIEUCHI_NGHIEMTHU_08: mời email đã có tài khoản thì thêm vào công ty, không tạo tài khoản mới", () => {
  it("KICHBAN_KIEMTHU_18: mời phuc.le vào VCT", async () => {
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    await pool.query("DELETE FROM core.user_role_assignments WHERE user_id = $1 AND company_id = $2", [testIds.purchasingManager, trading]);
    await pool.query("DELETE FROM core.user_company_memberships WHERE user_id = $1 AND company_id = $2", [testIds.purchasingManager, trading]);
    const before = Number((await pool.query("SELECT count(*) FROM core.users")).rows[0].count);
    const response = await invite(groupAdmin, { fullName: "Lê Văn Phúc", email: "phuc.le@vcomm.test" }, trading);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ addedToExistingAccount: true, status: "active" });
    expect(Number((await pool.query("SELECT count(*) FROM core.users")).rows[0].count)).toBe(before);
    const employee = await signIn(application, "phuc.le@vcomm.test");
    const me = await employee.call("get", "/me");
    expect(me.body.companies.map((company: { code: string }) => company.code)).toEqual(expect.arrayContaining(["VCR", "VCT"]));
    const again = await invite(groupAdmin, { fullName: "Lê Văn Phúc", email: "phuc.le@vcomm.test" }, trading);
    expect(again.body.error.fields.email).toBe("Nhân viên đã thuộc công ty này.");
  });
});

describe("TIEUCHI_NGHIEMTHU_09: nhập Excel", () => {
  it("KICHBAN_KIEMTHU_19: 10 dòng có 2 dòng trùng email trong tệp → 8 mời, tệp lỗi đúng 2 dòng", async () => {
    const rows = Array.from({ length: 8 }, (_, index) => [`Nhập ${index + 1}`, `nhap.nv0${index + 1}@vcomm.test`, "", "", "VCR-HCM", "", "Nhân viên", ""]);
    rows.push(["Trùng 2", "nhap.nv02@vcomm.test", "", "", "", "", "", ""]);
    rows.push(["Trùng 5", "NHAP.NV05@vcomm.test", "", "", "", "", "", ""]);
    const response = await upload(retailAdmin, await spreadsheet(rows));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ invited: 8, failed: 2 });
    expect(response.body.errors.map((error: { row: number }) => error.row)).toEqual([10, 11]);
    expect(response.body.errors[0].message).toBe("Trùng với dòng 3 trong tệp.");
    const errorFile = Buffer.from(response.body.errorFileUrl.split(",")[1], "base64");
    const sheet = await readXlsxFile(errorFile);
    expect(sheet[0]!.data.length).toBe(3);
    const invited = await pool.query("SELECT count(*) FROM core.users WHERE email LIKE 'nhap.nv0%' AND status = 'invited'");
    expect(Number(invited.rows[0].count)).toBe(8);
  });

  it("KICHBAN_KIEMTHU_20: 1.000 dòng được mời; 1.001 dòng bị từ chối cả tệp", async () => {
    const make = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => [`Lớn ${index}`, `${prefix}${String(index).padStart(4, "0")}@vcomm.test`, "", "", "", "", "", ""]);
    const tooMany = await upload(retailAdmin, await spreadsheet(make(1001, "nhap.qua")));
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.fields.file).toBe("Tệp vượt quá 1.000 dòng.");
    expect(Number((await pool.query("SELECT count(*) FROM core.users WHERE email LIKE 'nhap.qua%'")).rows[0].count)).toBe(0);
    const full = await upload(retailAdmin, await spreadsheet(make(1000, "nhap.lon")));
    expect(full.body).toMatchObject({ invited: 1000, failed: 0, errorFileUrl: null });
  }, 120000);

  it("KICHBAN_KIEMTHU_21: tệp sai loại, sai mẫu, quá lớn bị từ chối; thủ kho bị 403", async () => {
    const csv = await upload(retailAdmin, Buffer.from("Họ tên,Email\nA,a@vcomm.test"), "nhap.csv");
    expect(csv.body.error.fields.file).toBe("Tệp không đúng mẫu.");
    const missingColumn = await upload(retailAdmin, await writeXlsxFile([[{ value: "Họ tên" }, { value: "Số điện thoại" }]]).toBuffer());
    expect(missingColumn.body.error.fields.file).toBe("Tệp không đúng mẫu.");
    const large = await upload(retailAdmin, Buffer.alloc(6 * 1024 * 1024, 1));
    expect(large.status).toBe(400);
    expect(large.body.error.fields.file).toBe("Tệp vượt quá 5 MB.");
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    expect((await upload(keeper, await spreadsheet([["A", "a.thukho@vcomm.test", "", "", "", "", "", ""]]))).status).toBe(403);
  });

  it("API_28: tệp mẫu có đúng dòng tiêu đề", async () => {
    const response = await retailAdmin.call("get", "/users/imports/template", { companyId: retail }).buffer(true).parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => callback(null, Buffer.concat(chunks)));
    });
    expect(response.status).toBe(200);
    const sheet = await readXlsxFile(response.body as Buffer);
    expect(sheet[0]!.data[0]).toEqual([...userImportColumns]);
  });
});

describe("CHUC_NANG_19 (lát L4): khóa, mở khóa, sửa nhân viên", () => {
  it("khóa thu hồi phiên ngay; không tự khóa chính mình; mở khóa đăng nhập lại được", async () => {
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    expect((await keeper.call("get", "/me")).status).toBe(200);
    const locked = await retailAdmin.call("post", `/users/${testIds.warehouseKeeper}/lock`, { companyId: retail, body: { reason: "Nghỉ phép dài" } });
    expect(locked.status).toBe(200);
    expect(locked.body.status).toBe("locked");
    expect((await keeper.call("get", "/me")).status).toBe(401);
    expect((await login("thukho.bd@vcomm.test", "MatKhauThu@2026")).status).toBe(401);
    const self = await retailAdmin.call("post", `/users/${testIds.retailAdmin}/lock`, { companyId: retail, body: { reason: "Thử" } });
    expect(self.status).toBe(403);
    expect(self.body.error.message).toBe("Bạn không thể khóa tài khoản của chính mình.");
    expect((await retailAdmin.call("post", `/users/${testIds.warehouseKeeper}/unlock`, { companyId: retail, body: { reason: "Đi làm lại" } })).status).toBe(200);
    expect((await login("thukho.bd@vcomm.test", "MatKhauThu@2026")).status).toBe(200);
  });

  it("sửa email thì đăng nhập bằng email mới", async () => {
    const detail = await retailAdmin.call("get", `/users/${testIds.warehouseKeeper}`, { companyId: retail });
    const updated = await retailAdmin.call("patch", `/users/${testIds.warehouseKeeper}`, { companyId: retail, body: { email: "thukho.binhduong@vcomm.test", jobTitle: "Thủ kho chính", version: detail.body.version } });
    expect(updated.status).toBe(200);
    expect(updated.body.currentMembership.jobTitle).toBe("Thủ kho chính");
    expect((await login("thukho.binhduong@vcomm.test", "MatKhauThu@2026")).status).toBe(200);
    expect((await login("thukho.bd@vcomm.test", "MatKhauThu@2026")).status).toBe(401);
  });
});
