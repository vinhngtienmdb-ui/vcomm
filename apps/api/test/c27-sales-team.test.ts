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

async function register(phone: string, fullName: string): Promise<string> {
  expect((await post("/buyer/register/otp", { phone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
  const created = await post("/buyer/register", { phone, code: "246810", fullName, password });
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
});
