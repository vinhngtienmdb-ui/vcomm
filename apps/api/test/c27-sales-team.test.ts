// CONG_VIEC_27: Đội kinh doanh nhiều cấp (KICHBAN_KIEMTHU_302 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
const retail: string = testIds.retailCompany;
const password = "MatKhauNguoiMua@2026";
const ids = { division: "", south: "", teamOne: "", direct: "", plain: "", director: "", regional: "", head: "", staff: "", directStaff: "" };
const http = () => request(application.getHttpServer());
const post = (path: string, body: object) => http().post(`/api/v1${path}`).set("accept-language", "vi").send(body);
const call = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => admin.call(method, path, { companyId: retail, ...(body ? { body } : {}) });

async function register(phone: string, fullName: string, referralCode?: string): Promise<string> {
  expect((await post("/buyer/register/otp", { phone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
  const created = await post("/buyer/register", { phone, code: "246810", fullName, password, ...(referralCode ? { referralCode } : {}) });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  return created.body.user.id as string;
}
async function department(code: string, name: string, parent: string | null): Promise<string> {
  return (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name, parent_id) VALUES ($1, $2, $3, $4) RETURNING id", [retail, code, name, parent])).rows[0]!.id;
}
async function flag(userId: string, departmentId: string) {
  const detail = await call("get", `/marketplace/buyers/${userId}`);
  const result = await call("post", `/marketplace/buyers/${userId}/sales-flag`, { departmentId, version: detail.body.version });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  return result.body;
}
const titleOf = async (userId: string) => (await call("get", `/marketplace/buyers/${userId}`)).body.salesTitle as string | null;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  const group = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await group.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  ids.division = await department("KHOI-KD", "Khối Kinh doanh", null);
  ids.south = await department("VUNG-NAM", "Vùng Miền Nam", ids.division);
  ids.teamOne = await department("PKD-1", "Phòng Kinh doanh 1", ids.south);
  ids.direct = await department("PKD-TT", "Phòng Kinh doanh Trực tiếp", ids.division);
  ids.plain = await department("HCNS", "Hành chính", null);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_27 cây đơn vị kinh doanh", () => {
  it("KICHBAN_KIEMTHU_302: gắn loại đơn vị đúng thứ bậc Khối > Vùng > Phòng, được thiếu cấp giữa; sai thứ bậc bị từ chối; đánh dấu chỉ vào đơn vị kinh doanh", async () => {
    expect((await call("put", `/marketplace/sales-units/${ids.division}`, { type: "division" })).status).toBe(200);
    // Vùng dưới Khối đúng; Khối dưới Vùng sai.
    expect((await call("put", `/marketplace/sales-units/${ids.south}`, { type: "division" })).body.error.message).toBe("Sai thứ bậc đơn vị kinh doanh: Khối > Vùng > Phòng.");
    expect((await call("put", `/marketplace/sales-units/${ids.south}`, { type: "region" })).status).toBe(200);
    expect((await call("put", `/marketplace/sales-units/${ids.teamOne}`, { type: "team" })).status).toBe(200);
    // Phòng ngay dưới Khối (thiếu Vùng) được.
    const direct = await call("put", `/marketplace/sales-units/${ids.direct}`, { type: "team" });
    expect(direct.status).toBe(200);
    expect(direct.body.units.find((unit: { id: string }) => unit.id === ids.direct).type).toBe("team");
    // Đổi Vùng thành Phòng khi bên dưới đã có Phòng: sai thứ bậc.
    expect((await call("put", `/marketplace/sales-units/${ids.south}`, { type: "team" })).status).toBe(409);

    ids.director = await register("0922000001", "Giám Đốc Kinh Doanh");
    const detail = await call("get", `/marketplace/buyers/${ids.director}`);
    expect((await call("post", `/marketplace/buyers/${ids.director}/sales-flag`, { departmentId: ids.plain, version: detail.body.version })).status).toBe(400);
    await flag(ids.director, ids.division);
    // Đơn vị còn thành viên thì không bỏ loại được.
    expect((await call("put", `/marketplace/sales-units/${ids.division}`, { type: null })).body.error.message).toBe("Đơn vị còn thành viên đội kinh doanh. Chuyển thành viên sang đơn vị khác trước.");
    // Người mua thường không xem được đội kinh doanh.
    const buyer = await post("/buyer/login", { phone: "0922000001", password });
    expect((await http().get("/api/v1/marketplace/sales-team").set("authorization", `Bearer ${buyer.body.tokens.accessToken}`)).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_303: chức danh suy ra từ vị trí; chuỗi cấp trên đúng, kể cả khi thiếu chức danh", async () => {
    expect((await call("put", `/marketplace/sales-units/${ids.division}/manager`, { userId: ids.director })).status).toBe(200);
    ids.regional = await register("0922000002", "Giám Đốc Vùng");
    ids.head = await register("0922000003", "Trưởng Phòng Một");
    ids.staff = await register("0922000004", "Nhân Viên Một");
    ids.directStaff = await register("0922000005", "Nhân Viên Trực Tiếp");
    await flag(ids.regional, ids.south);
    await flag(ids.head, ids.teamOne);
    await flag(ids.staff, ids.teamOne);
    await flag(ids.directStaff, ids.direct);
    // Chưa bổ nhiệm: ai cũng là nhân viên.
    expect(await titleOf(ids.regional)).toBe("staff");
    // Người không thuộc đơn vị không làm quản lý được.
    expect((await call("put", `/marketplace/sales-units/${ids.south}/manager`, { userId: ids.head })).body.error.message).toBe(
      "Người quản lý phải là thành viên đội kinh doanh thuộc chính đơn vị này.",
    );
    expect((await call("put", `/marketplace/sales-units/${ids.south}/manager`, { userId: ids.regional })).status).toBe(200);
    expect((await call("put", `/marketplace/sales-units/${ids.teamOne}/manager`, { userId: ids.head })).status).toBe(200);

    expect(await titleOf(ids.director)).toBe("director");
    expect(await titleOf(ids.regional)).toBe("regional_director");
    expect(await titleOf(ids.head)).toBe("team_head");
    expect(await titleOf(ids.staff)).toBe("staff");
    const staff = await call("get", `/marketplace/buyers/${ids.staff}`);
    expect(staff.body.salesChain.map((item: { title: string }) => item.title)).toEqual(["team_head", "regional_director", "director"]);
    // Phòng trực tiếp dưới Khối, chưa có trưởng phòng: chuỗi chỉ có Giám đốc Kinh doanh.
    const direct = await call("get", `/marketplace/buyers/${ids.directStaff}`);
    expect(direct.body.salesChain).toEqual([{ userId: ids.director, fullName: "Giám Đốc Kinh Doanh", title: "director" }]);
    const team = await call("get", "/marketplace/sales-team");
    expect(team.body.members.find((member: { userId: string }) => member.userId === ids.head)).toMatchObject({ title: "team_head", departmentId: ids.teamOne });
  });

  it("KICHBAN_KIEMTHU_304: chuyển đơn vị bỏ quản lý đơn vị cũ; bỏ quản lý; bỏ đánh dấu người quản lý thì bỏ quản lý; lịch sử", async () => {
    const head = await call("get", `/marketplace/buyers/${ids.head}`);
    const moved = await call("post", `/marketplace/buyers/${ids.head}/sales-move`, { departmentId: ids.direct, version: head.body.version });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.salesTitle).toBe("staff");
    expect(moved.body.salesFlagHistory.slice(0, 2).map((item: { action: string }) => item.action)).toEqual(["move", "unappoint"]);
    expect((await pool.query("SELECT manager_user_id FROM core.departments WHERE id = $1", [ids.teamOne])).rows[0].manager_user_id).toBeNull();
    expect((await call("post", `/marketplace/buyers/${ids.head}/sales-move`, { departmentId: ids.plain, version: moved.body.version })).status).toBe(400);
    expect((await call("post", `/marketplace/buyers/${ids.head}/sales-move`, { departmentId: ids.teamOne, version: 1 })).status).toBe(409);
    // Nhân viên phòng 1 giờ thiếu trưởng phòng: chuỗi từ Giám đốc Vùng.
    expect((await call("get", `/marketplace/buyers/${ids.staff}`)).body.salesChain.map((item: { title: string }) => item.title)).toEqual(["regional_director", "director"]);
    // Bổ nhiệm rồi bỏ quản lý.
    expect((await call("put", `/marketplace/sales-units/${ids.direct}/manager`, { userId: ids.head })).status).toBe(200);
    expect(await titleOf(ids.head)).toBe("team_head");
    expect((await call("put", `/marketplace/sales-units/${ids.direct}/manager`, { userId: null })).status).toBe(200);
    expect(await titleOf(ids.head)).toBe("staff");
    // Bỏ đánh dấu Giám đốc Vùng: Vùng không còn quản lý.
    const regional = await call("get", `/marketplace/buyers/${ids.regional}`);
    expect((await call("delete", `/marketplace/buyers/${ids.regional}/sales-flag`, { version: regional.body.version })).status).toBe(200);
    expect((await pool.query("SELECT manager_user_id FROM core.departments WHERE id = $1", [ids.south])).rows[0].manager_user_id).toBeNull();
    expect((await call("get", `/marketplace/buyers/${ids.staff}`)).body.salesChain.map((item: { title: string }) => item.title)).toEqual(["director"]);
  });

  it("KICHBAN_KIEMTHU_305: người quản lý xem nhánh và khách của cấp dưới (thông tin đầy đủ); không xem ngoài nhánh; nhân viên không có cấp dưới; tài khoản của tôi có chức danh, đơn vị", async () => {
    const customer = await register("0922000010", "Khách Của Nhân Viên", "0922000004");
    const login = async (phone: string) => (await post("/buyer/login", { phone, password })).body.tokens.accessToken as string;
    const get = (path: string, token: string) => http().get(`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    const director = await login("0922000001");
    const me = await get("/buyer/me", director);
    expect(me.body).toMatchObject({ salesTitle: "director", salesUnitName: "Khối Kinh doanh" });
    const team = await get("/buyer/sales/team", director);
    expect(team.status).toBe(200);
    expect(team.body.title).toBe("director");
    expect(team.body.members.map((member: { userId: string }) => member.userId).sort()).toEqual([ids.head, ids.staff, ids.directStaff].sort());
    expect(team.body.members.find((member: { userId: string }) => member.userId === ids.staff)).toMatchObject({ title: "staff", unitName: "Phòng Kinh doanh 1", customerCount: 1 });
    const customers = await get(`/buyer/sales/members/${ids.staff}/customers`, director);
    expect(customers.body).toEqual([{ id: customer, fullName: "Khách Của Nhân Viên", phone: "0922000010", registeredAt: expect.any(String) }]);
    // Người không thuộc nhánh (Giám đốc Vùng đã rời đội) và chính mình: 404.
    expect((await get(`/buyer/sales/members/${ids.regional}/customers`, director)).status).toBe(404);
    expect((await get(`/buyer/sales/members/${ids.director}/customers`, director)).status).toBe(404);
    // Nhân viên: không có cấp dưới, không xem được khách người khác.
    const staff = await login("0922000004");
    expect((await get("/buyer/sales/team", staff)).body).toMatchObject({ title: "staff", members: [] });
    expect((await get(`/buyer/sales/members/${ids.directStaff}/customers`, staff)).status).toBe(404);
    // Người đã rời đội: 403.
    expect((await get("/buyer/sales/team", await login("0922000002"))).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_306: đề xuất đúng phạm vi nhánh; một đề xuất chờ mỗi người; nhân viên không lập được; rút đề xuất", async () => {
    const director = (await post("/buyer/login", { phone: "0922000001", password })).body.tokens.accessToken as string;
    const staffToken = (await post("/buyer/login", { phone: "0922000004", password })).body.tokens.accessToken as string;
    const send = (token: string, body: object) => http().post("/api/v1/buyer/sales/proposals").set("authorization", `Bearer ${token}`).set("accept-language", "vi").send(body);
    const options = await http().get("/api/v1/buyer/sales/proposal-options").set("authorization", `Bearer ${director}`);
    expect(options.body.units.map((unit: { id: string }) => unit.id).sort()).toEqual([ids.division, ids.south, ids.teamOne, ids.direct].sort());
    const add = await send(director, { kind: "add", targetPhone: "0922000002", departmentId: ids.south, reason: "Tuyển Giám đốc Vùng" });
    expect(add.status, JSON.stringify(add.body)).toBe(201);
    // Đề xuất thêm người chưa duyệt: người đề xuất chỉ thấy tên, số điện thoại đã che.
    expect(add.body).toMatchObject({ kind: "add", status: "pending", targetName: "G. Đ. V.", targetPhone: "0922***002", departmentName: "Vùng Miền Nam" });
    expect((await send(director, { kind: "add", targetPhone: "0922000002", departmentId: ids.south, reason: "Lặp" })).body.error.message).toBe("Người này đang có một đề xuất chờ duyệt.");
    expect((await send(director, { kind: "add", targetPhone: "0922000004", departmentId: ids.south, reason: "Đã là thành viên" })).body.error.fields.targetPhone).toBe(
      "Không thêm được người có số điện thoại này vào đội.",
    );
    expect((await send(director, { kind: "add", targetPhone: "0999999998", departmentId: ids.south, reason: "Không có tài khoản" })).body.error.fields.targetPhone).toBe(
      "Không thêm được người có số điện thoại này vào đội.",
    );
    expect((await send(director, { kind: "add", targetPhone: "0922000003", departmentId: ids.plain, reason: "Ngoài cây" })).status).toBe(400);
    expect((await send(staffToken, { kind: "remove", targetUserId: ids.directStaff, reason: "Không có quyền" })).status).toBe(403);
    expect((await send(director, { kind: "move", targetUserId: ids.staff, departmentId: ids.direct, reason: "Chuyển sang phòng trực tiếp" })).status).toBe(201);
    expect((await send(director, { kind: "appoint", targetUserId: ids.head, departmentId: ids.direct, reason: "Bổ nhiệm trưởng phòng" })).status).toBe(201);
    // Bổ nhiệm vào đơn vị không phải của người đó: sai.
    expect((await send(director, { kind: "appoint", targetUserId: ids.directStaff, departmentId: ids.teamOne, reason: "Sai đơn vị" })).status).toBe(400);
    const remove = await send(director, { kind: "remove", targetUserId: ids.directStaff, reason: "Nghỉ việc" });
    expect(remove.status).toBe(201);
    const withdrawn = await http().post(`/api/v1/buyer/sales/proposals/${remove.body.id}/withdraw`).set("authorization", `Bearer ${director}`);
    expect(withdrawn.body.status).toBe("withdrawn");
    const mine = await http().get("/api/v1/buyer/sales/proposals").set("authorization", `Bearer ${director}`);
    expect(mine.body).toHaveLength(4);
  });

  it("KICHBAN_KIEMTHU_307: quản trị duyệt áp dụng thay đổi, từ chối kèm ghi chú, có thông báo; duyệt kiểm lại điều kiện, không đúng thì đề xuất vẫn chờ", async () => {
    const pending = await call("get", "/marketplace/sales-proposals?status=pending");
    expect(pending.body).toHaveLength(3);
    const byKind = (kind: string) => pending.body.find((item: { kind: string }) => item.kind === kind);
    const approvedAdd = await call("post", `/marketplace/sales-proposals/${byKind("add").id}/approve`);
    expect(approvedAdd.status, JSON.stringify(approvedAdd.body)).toBe(200);
    expect(approvedAdd.body).toMatchObject({ status: "approved", decidedByName: "Trần Minh Quân" });
    expect((await call("get", `/marketplace/buyers/${ids.regional}`)).body).toMatchObject({ isSalesStaff: true, salesTitle: "staff" });
    expect((await call("post", `/marketplace/sales-proposals/${byKind("appoint").id}/approve`)).status).toBe(200);
    expect(await titleOf(ids.head)).toBe("team_head");
    const rejected = await call("post", `/marketplace/sales-proposals/${byKind("move").id}/reject`, { note: "Giữ nguyên phòng 1" });
    expect(rejected.body).toMatchObject({ status: "rejected", decisionNote: "Giữ nguyên phòng 1" });
    expect((await call("post", `/marketplace/sales-proposals/${byKind("move").id}/approve`)).status).toBe(409);
    const notices = await pool.query("SELECT kind FROM core.notifications WHERE user_id = $1 AND kind LIKE 'sales_proposal.%' ORDER BY created_at", [ids.director]);
    expect(notices.rows.map((row) => row.kind)).toEqual(["sales_proposal.approved", "sales_proposal.approved", "sales_proposal.rejected"]);

    // Trưởng phòng trực tiếp đề xuất đưa nhân viên ra khỏi đội; trước khi duyệt người đó bị bỏ quản lý: duyệt báo lỗi, đề xuất vẫn chờ.
    const head = (await post("/buyer/login", { phone: "0922000003", password })).body.tokens.accessToken as string;
    const remove = await http().post("/api/v1/buyer/sales/proposals").set("authorization", `Bearer ${head}`).send({ kind: "remove", targetUserId: ids.directStaff, reason: "Nghỉ việc" });
    expect(remove.status, JSON.stringify(remove.body)).toBe(201);
    expect((await call("put", `/marketplace/sales-units/${ids.direct}/manager`, { userId: null })).status).toBe(200);
    const stale = await call("post", `/marketplace/sales-proposals/${remove.body.id}/approve`);
    expect(stale.status).toBe(409);
    expect(stale.body.error.message).toContain("Đề xuất không còn đúng với đội hiện tại");
    expect((await call("get", "/marketplace/sales-proposals?status=pending")).body.map((item: { id: string }) => item.id)).toEqual([remove.body.id]);
    expect((await call("get", `/marketplace/buyers/${ids.directStaff}`)).body.isSalesStaff).toBe(true);
  });

  it("KICHBAN_KIEMTHU_304 (rà soát): đánh dấu lại thành viên bị từ chối; chuỗi bỏ người quản lý không thuộc đơn vị; phòng ban ngừng hoạt động không cắt chuỗi; cây phòng ban có vòng không treo máy chủ", async () => {
    const staff = await call("get", `/marketplace/buyers/${ids.staff}`);
    const again = await call("post", `/marketplace/buyers/${ids.staff}/sales-flag`, { departmentId: ids.direct, version: staff.body.version });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe("Tài khoản đã thuộc đội kinh doanh. Dùng Chuyển đơn vị để đổi đơn vị.");
    // Mini app Nền tảng đặt Nhân viên Trực tiếp (thuộc Phòng Trực tiếp) làm quản lý Vùng: không vào chuỗi cấp trên.
    await pool.query("UPDATE core.departments SET manager_user_id = $1 WHERE id = $2", [ids.directStaff, ids.south]);
    expect((await call("get", `/marketplace/buyers/${ids.staff}`)).body.salesChain.map((item: { userId: string }) => item.userId)).toEqual([ids.director]);
    // Vùng ngừng hoạt động: Phòng 1 vẫn thuộc Khối qua nút trung gian.
    await pool.query("UPDATE core.departments SET status = 'inactive', manager_user_id = NULL WHERE id = $1", [ids.south]);
    expect((await call("get", `/marketplace/buyers/${ids.staff}`)).body.salesChain.map((item: { userId: string }) => item.userId)).toEqual([ids.director]);
    const director = (await post("/buyer/login", { phone: "0922000001", password })).body.tokens.accessToken as string;
    const team = await http().get("/api/v1/buyer/sales/team").set("authorization", `Bearer ${director}`);
    expect(team.body.members.map((member: { userId: string }) => member.userId)).toContain(ids.staff);
    // Vòng cha – con giữa Khối và Phòng 1: các API vẫn trả lời.
    await pool.query("UPDATE core.departments SET parent_id = $1 WHERE id = $2", [ids.teamOne, ids.division]);
    try {
      expect((await call("get", "/marketplace/sales-team")).status).toBe(200);
      expect((await call("get", `/marketplace/buyers/${ids.staff}`)).status).toBe(200);
      expect((await http().get("/api/v1/buyer/sales/team").set("authorization", `Bearer ${director}`)).status).toBe(200);
    } finally {
      await pool.query("UPDATE core.departments SET parent_id = NULL WHERE id = $1", [ids.division]);
      await pool.query("UPDATE core.departments SET status = 'active' WHERE id = $1", [ids.south]);
    }
  });
});
