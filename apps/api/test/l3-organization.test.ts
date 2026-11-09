// KICHBAN_KIEMTHU cho TIEUCHI_NGHIEMTHU_01 đến 05 (tài liệu 21, lát L3).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let employee: Session;

const group: string = testIds.groupCompany;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;

const companyCount = async () => Number((await pool.query("SELECT count(*) FROM core.companies")).rows[0].count);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  employee = await signIn(application, "phuc.le@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_01: tạo công ty con dưới tập đoàn", () => {
  it("KICHBAN_KIEMTHU_01: tạo hai công ty, cây hiện đúng, có sự kiện core.company.created", async () => {
    const first = await groupAdmin.call("post", "/companies", { companyId: group, body: { parentId: group, code: "vcn", legalName: "Công ty TNHH VComm Miền Nam Hai", shortName: "VComm Nam Hai", taxCode: "0100000001" } });
    const second = await groupAdmin.call("post", "/companies", { companyId: group, body: { parentId: group, code: "VCB", legalName: "Công ty TNHH VComm Miền Bắc Hai", shortName: "VComm Bắc Hai", taxCode: "0100000002" } });
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.code).toBe("VCN");
    expect(first.body.accountingRegime).toBe("TT99_2025");
    expect(first.body.baseCurrency).toBe("VND");
    const tree = await groupAdmin.call("get", "/companies", { companyId: group });
    const roots = tree.body.filter((company: { parentId: string | null }) => company.parentId === null);
    expect(roots.map((company: { code: string }) => company.code)).toEqual(["VCG"]);
    const children = tree.body.filter((company: { parentId: string | null }) => company.parentId === group).map((company: { code: string }) => company.code);
    expect(children).toEqual(expect.arrayContaining(["VCR", "VCT", "VCN", "VCB"]));
    const events = await pool.query("SELECT count(*) FROM core.outbox_events WHERE event_type = 'core.company.created' AND aggregate_id = ANY($1)", [[first.body.id, second.body.id]]);
    expect(Number(events.rows[0].count)).toBe(2);
    // Người tạo chọn được công ty mới.
    expect((await groupAdmin.call("get", "/me", { companyId: first.body.id })).status).toBe(200);
  });

  it("đổi công ty mẹ thành công ty con bị từ chối (QUYTAC_NGHIEPVU_04)", async () => {
    const tree = await groupAdmin.call("get", "/companies", { companyId: group });
    const root = tree.body.find((company: { code: string }) => company.code === "VCG");
    const response = await groupAdmin.call("patch", `/companies/${group}`, { companyId: group, body: { parentId: retail, version: root.version } });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.parentId).toBe("Không thể chọn công ty con làm công ty mẹ.");
  });
});

describe("TIEUCHI_NGHIEMTHU_02: mã công ty và mã số thuế duy nhất", () => {
  it("KICHBAN_KIEMTHU_02: trùng mã số thuế hoặc trùng mã bị từ chối tại trường", async () => {
    const before = await companyCount();
    const sameTax = await groupAdmin.call("post", "/companies", { companyId: group, body: { parentId: group, code: "VCX", legalName: "X", shortName: "X", taxCode: "0100000001" } });
    const sameCode = await groupAdmin.call("post", "/companies", { companyId: group, body: { parentId: group, code: "VCR", legalName: "Y", shortName: "Y", taxCode: "0100000009" } });
    expect(sameTax.status).toBe(400);
    expect(sameTax.body.error.fields.taxCode).toBe("Mã số thuế đã được dùng cho công ty khác.");
    expect(sameCode.status).toBe(400);
    expect(sameCode.body.error.fields.code).toBe("Mã công ty đã tồn tại.");
    expect(await companyCount()).toBe(before);
  });

  it("KICHBAN_KIEMTHU_03: trùng mã số thuế của công ty đã ngừng hoạt động vẫn bị từ chối", async () => {
    const created = await groupAdmin.call("post", "/companies", { companyId: group, body: { parentId: group, code: "VCZ", legalName: "Z", shortName: "Z", taxCode: "0100000003" } });
    const deactivated = await groupAdmin.call("post", `/companies/${created.body.id}/deactivate`, { companyId: group, body: { version: created.body.version } });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.status).toBe("inactive");
    const response = await groupAdmin.call("post", "/companies", { companyId: group, body: { parentId: group, code: "VCY", legalName: "Y", shortName: "Y", taxCode: "0100000003" } });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.taxCode).toBeDefined();
  });

  it("ngừng hoạt động công ty còn chi nhánh hoạt động bị từ chối (QUYTAC_NGHIEPVU_03)", async () => {
    const version = (await pool.query("SELECT version FROM core.companies WHERE id = $1", [retail])).rows[0].version;
    const response = await groupAdmin.call("post", `/companies/${retail}/deactivate`, { companyId: group, body: { version } });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Công ty còn chi nhánh đang hoạt động.");
  });
});

describe("TIEUCHI_NGHIEMTHU_03: chỉ quản trị tập đoàn tạo công ty", () => {
  it("KICHBAN_KIEMTHU_04: quản trị công ty, nhân viên bị từ chối; chưa đăng nhập nhận 401", async () => {
    const body = { parentId: group, code: "VCK", legalName: "K", shortName: "K", taxCode: "0100000004" };
    const rateManager = await signIn(application, "tygia@vcomm.test");
    for (const session of [retailAdmin, employee, rateManager]) {
      const response = await session.call("post", "/companies", { body });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("FORBIDDEN");
    }
    const anonymous = await request(application.getHttpServer()).post("/api/v1/companies").send(body);
    expect(anonymous.status).toBe(401);
    expect((await pool.query("SELECT 1 FROM core.companies WHERE code = 'VCK'")).rows.length).toBe(0);
  });
});

describe("TIEUCHI_NGHIEMTHU_04: quản trị công ty chỉ tạo chi nhánh cho công ty mình", () => {
  it("KICHBAN_KIEMTHU_05: tạo cho VCT bị từ chối, kể cả khi gửi companyId trong dữ liệu", async () => {
    const atTrading = await retailAdmin.call("post", "/branches", { companyId: trading, body: { code: "VCT-CT", name: "Cửa hàng Cần Thơ", branchType: "store" } });
    expect(atTrading.status).toBe(403);
    const smuggled = await retailAdmin.call("post", "/branches", { companyId: retail, body: { code: "VCT-CT", name: "Cửa hàng Cần Thơ", branchType: "store", companyId: trading } });
    expect([400, 403]).toContain(smuggled.status);
    expect((await pool.query("SELECT 1 FROM core.branches WHERE code = 'VCT-CT'")).rows.length).toBe(0);
  });

  it("KICHBAN_KIEMTHU_06: tạo cho VCR thành công, có sự kiện core.branch.created", async () => {
    const response = await retailAdmin.call("post", "/branches", { companyId: retail, body: { code: "vcr-hn", name: "Văn phòng Hà Nội", branchType: "office", provinceCode: "01" } });
    expect(response.status).toBe(201);
    expect(response.body.companyId).toBe(retail);
    expect(response.body.code).toBe("VCR-HN");
    const events = await pool.query("SELECT 1 FROM core.outbox_events WHERE event_type = 'core.branch.created' AND aggregate_id = $1", [response.body.id]);
    expect(events.rows.length).toBe(1);
  });

  it("KICHBAN_KIEMTHU_07: mã chi nhánh duy nhất trong một công ty", async () => {
    expect((await retailAdmin.call("post", "/branches", { companyId: retail, body: { code: "KHO-01", name: "Kho 1", branchType: "warehouse" } })).status).toBe(201);
    const duplicate = await retailAdmin.call("post", "/branches", { companyId: retail, body: { code: "KHO-01", name: "Kho 1 trùng", branchType: "warehouse" } });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.fields.code).toBe("Mã chi nhánh đã tồn tại trong công ty.");
    expect((await groupAdmin.call("post", "/branches", { companyId: trading, body: { code: "KHO-01", name: "Kho 1 VCT", branchType: "warehouse" } })).status).toBe(201);
  });

  it("KICHBAN_KIEMTHU_08: quản trị VCR chỉ thấy chi nhánh VCR", async () => {
    const response = await retailAdmin.call("get", "/branches?pageSize=100", { companyId: retail });
    expect(response.status).toBe(200);
    expect(response.body.data.every((branch: { companyId: string }) => branch.companyId === retail)).toBe(true);
    expect(response.body.data.map((branch: { code: string }) => branch.code)).toEqual(expect.arrayContaining(["VCR-HCM", "VCR-BD"]));
    const filtered = await retailAdmin.call("get", "/branches?branchType=warehouse", { companyId: retail });
    expect(filtered.body.data.every((branch: { branchType: string }) => branch.branchType === "warehouse")).toBe(true);
  });

  it("sửa, ngừng hoạt động chi nhánh của công ty khác trả 404", async () => {
    const tradingBranch = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM core.branches WHERE company_id = $1 LIMIT 1", [trading])).rows[0]!;
    const response = await retailAdmin.call("patch", `/branches/${tradingBranch.id}`, { companyId: retail, body: { name: "Đổi", version: tradingBranch.version } });
    expect(response.status).toBe(404);
  });
});

describe("TIEUCHI_NGHIEMTHU_05: cây phòng ban không tạo vòng", () => {
  const create = async (code: string, parentId: string | null) => {
    const response = await retailAdmin.call("post", "/departments", { companyId: retail, body: { code, name: code, parentId } });
    expect(response.status).toBe(201);
    return response.body as { id: string; version: number };
  };
  const version = async (id: string) => (await pool.query("SELECT version FROM core.departments WHERE id = $1", [id])).rows[0].version as number;

  it("KICHBAN_KIEMTHU_09: chọn phòng ban con làm cha bị từ chối", async () => {
    const a = await create("PB-A", null);
    const b = await create("PB-B", a.id);
    const response = await retailAdmin.call("patch", `/departments/${a.id}`, { companyId: retail, body: { parentId: b.id, version: await version(a.id) } });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.parentId).toBe("Không thể chọn phòng ban con làm phòng ban cha.");
    expect((await pool.query("SELECT parent_id FROM core.departments WHERE id = $1", [a.id])).rows[0].parent_id).toBeNull();
  });

  it("KICHBAN_KIEMTHU_10: vòng qua chính nó, qua nhiều cấp bị từ chối; đổi cấp hợp lệ thành công", async () => {
    const a = await create("PB-X", null);
    const b = await create("PB-Y", a.id);
    const c = await create("PB-Z", b.id);
    expect((await retailAdmin.call("patch", `/departments/${a.id}`, { companyId: retail, body: { parentId: a.id, version: await version(a.id) } })).status).toBe(400);
    expect((await retailAdmin.call("patch", `/departments/${a.id}`, { companyId: retail, body: { parentId: c.id, version: await version(a.id) } })).status).toBe(400);
    const valid = await retailAdmin.call("patch", `/departments/${c.id}`, { companyId: retail, body: { parentId: a.id, version: await version(c.id) } });
    expect(valid.status).toBe(200);
    expect(valid.body.parentId).toBe(a.id);
  });

  it("KICHBAN_KIEMTHU_11: sửa phòng ban của VCT trả 404; nhân viên tạo phòng ban bị 403", async () => {
    const tradingDepartment = await groupAdmin.call("post", "/departments", { companyId: trading, body: { code: "PB-T1", name: "Phòng thử VCT" } });
    expect(tradingDepartment.status).toBe(201);
    const response = await retailAdmin.call("patch", `/departments/${tradingDepartment.body.id}`, { companyId: retail, body: { name: "Đổi", version: tradingDepartment.body.version } });
    expect(response.status).toBe(404);
    const byEmployee = await employee.call("post", "/departments", { companyId: retail, body: { code: "PB-NV", name: "Nhân viên tạo" } });
    expect(byEmployee.status).toBe(403);
    expect((await pool.query("SELECT name FROM core.departments WHERE id = $1", [tradingDepartment.body.id])).rows[0].name).toBe("Phòng thử VCT");
  });

  it("trưởng phòng phải là nhân viên của công ty", async () => {
    const response = await retailAdmin.call("post", "/departments", { companyId: retail, body: { code: "PB-TP", name: "Có trưởng phòng", managerUserId: testIds.exchangeRateManager } });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.managerUserId).toBe("Trưởng phòng phải là nhân viên của công ty.");
    const valid = await retailAdmin.call("post", "/departments", { companyId: retail, body: { code: "PB-TP", name: "Có trưởng phòng", managerUserId: testIds.purchasingManager } });
    expect(valid.status).toBe(201);
    expect(valid.body.managerName).toBe("Lê Văn Phúc");
  });
});
