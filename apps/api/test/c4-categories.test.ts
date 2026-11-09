// CONG_VIEC_04 lát L1: ngành hàng, đơn vị tính dùng chung tập đoàn (TIEUCHI_NGHIEMTHU_56; KICHBAN_KIEMTHU_133 đến 135).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let employee: Session;
const retail: string = testIds.retailCompany;

const category = (code: string, parentId: string | null = null, extra: Record<string, unknown> = {}) => ({ parentId, code, nameVi: `Ngành ${code}`, nameEn: `Category ${code}`, ...extra });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  employee = await signIn(application, "thukho.bd@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_56: chỉ quản trị tập đoàn sửa ngành hàng, đơn vị tính", () => {
  it("KICHBAN_KIEMTHU_133: nhân viên không vào được mini app; quản trị công ty xem được nhưng không sửa được", async () => {
    expect((await employee.call("get", "/catalog/categories", { companyId: retail })).status).toBe(403);
    expect((await retailAdmin.call("get", "/catalog/categories", { companyId: retail })).status).toBe(200);
    expect((await retailAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("XX") })).status).toBe(403);
    expect((await retailAdmin.call("post", "/catalog/units", { companyId: retail, body: { code: "CUON", nameVi: "Cuộn", nameEn: "Roll" } })).status).toBe(403);
    const units = await retailAdmin.call("get", "/catalog/units", { companyId: retail });
    expect(units.body.map((unit: { code: string }) => unit.code)).toEqual(expect.arrayContaining(["CAI", "THUNG", "KG"]));
  });

  it("KICHBAN_KIEMTHU_134: tối đa 4 cấp; trùng mã, vòng, vừa lô vừa serial bị từ chối, chỉ ra đúng trường", async () => {
    const level1 = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("dt", null, { tracksSerials: true, warrantyMonths: 12 }) });
    expect(level1.status).toBe(201);
    expect(level1.body).toMatchObject({ code: "DT", level: 1, tracksSerials: true, warrantyMonths: 12 });
    const level2 = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("DTDD", level1.body.id) });
    const level3 = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("DTTM", level2.body.id) });
    const level4 = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("DTCC", level3.body.id) });
    expect(level4.body.level).toBe(4);
    const level5 = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("DTQ", level4.body.id) });
    expect(level5.status).toBe(400);
    expect(Object.keys(level5.body.error.fields)).toEqual(["parentId"]);
    expect(level5.body.error.fields.parentId).toBe("Ngành hàng tối đa 4 cấp.");
    const duplicate = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("DT") });
    expect(duplicate.body.error.fields).toEqual({ code: "Mã ngành hàng đã có." });
    const both = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("TP", null, { tracksLots: true, tracksSerials: true }) });
    expect(Object.keys(both.body.error.fields)).toEqual(["tracksSerials"]);
    // Đặt cha của cấp 1 là cấp 3 của chính nó: vòng.
    const cycle = await groupAdmin.call("patch", `/catalog/categories/${level1.body.id}`, {
      companyId: retail,
      body: { ...category("DT", level3.body.id), tracksLots: false, tracksSerials: true, warrantyMonths: 12, version: level1.body.version },
    });
    expect(cycle.body.error.fields).toEqual({ parentId: "Không chọn được ngành hàng con của chính nó làm ngành hàng cha." });
    // Chuyển nhánh 3 cấp (DTDD) xuống dưới ngành hàng cấp 2 khác thì vượt 4 cấp.
    const other1 = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("GD") });
    const other2 = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("GDBEP", other1.body.id) });
    const deep = await groupAdmin.call("patch", `/catalog/categories/${level2.body.id}`, {
      companyId: retail,
      body: { ...category("DTDD", other2.body.id), tracksLots: false, tracksSerials: false, warrantyMonths: 0, version: level2.body.version },
    });
    expect(deep.body.error.fields).toEqual({ parentId: "Ngành hàng tối đa 4 cấp." });
    // Chuyển nhánh 2 cấp (DTTM) xuống ngành hàng cấp 1 khác: cấp của cả nhánh được tính lại.
    const moved = await groupAdmin.call("patch", `/catalog/categories/${level3.body.id}`, {
      companyId: retail,
      body: { ...category("DTTM", other1.body.id), tracksLots: false, tracksSerials: false, warrantyMonths: 0, version: level3.body.version },
    });
    expect(moved.body.level).toBe(2);
    const listed = (await groupAdmin.call("get", "/catalog/categories", { companyId: retail })).body;
    expect(listed.find((item: { code: string }) => item.code === "DTCC").level).toBe(3);
  });

  it("KICHBAN_KIEMTHU_135: ngành hàng đã có sản phẩm không nhận ngành hàng con, không đổi mã; ngừng dùng và dùng lại; sai phiên bản bị từ chối", async () => {
    const leaf = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("MP") });
    const unitId = (await pool.query("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0].id;
    await pool.query("INSERT INTO catalog.products (company_id, category_id, code, name, search_text, base_unit_id) VALUES ($1, $2, 'MP-00001', 'Kem dưỡng', 'mp-00001 kem duong', $3)", [
      retail,
      leaf.body.id,
      unitId,
    ]);
    const child = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: category("MPKD", leaf.body.id) });
    expect(child.body.error.fields).toEqual({ parentId: "Ngành hàng này đã có sản phẩm nên không thêm được ngành hàng con." });
    const renamed = await groupAdmin.call("patch", `/catalog/categories/${leaf.body.id}`, {
      companyId: retail,
      body: { ...category("MPX"), tracksLots: false, tracksSerials: false, warrantyMonths: 0, version: leaf.body.version },
    });
    expect(renamed.body.error.fields).toEqual({ code: "Ngành hàng đã có sản phẩm, không đổi được mã." });
    const deactivated = await groupAdmin.call("post", `/catalog/categories/${leaf.body.id}/deactivate`, { companyId: retail, body: { version: leaf.body.version } });
    expect(deactivated.body).toMatchObject({ status: "inactive", productCount: 1 });
    expect((await groupAdmin.call("post", `/catalog/categories/${leaf.body.id}/activate`, { companyId: retail, body: { version: leaf.body.version } })).status).toBe(409);
    expect((await groupAdmin.call("post", `/catalog/categories/${leaf.body.id}/activate`, { companyId: retail, body: { version: deactivated.body.version } })).body.status).toBe("active");
    const audit = await pool.query("SELECT app_code, action FROM core.audit_events WHERE entity_id = $1 ORDER BY occurred_at", [leaf.body.id]);
    expect(audit.rows.map((row) => row.action)).toEqual(["category.create", "category.deactivate", "category.activate"]);
    expect(audit.rows[0].app_code).toBe("catalog");
  });

  it("đơn vị tính: trùng mã bị từ chối; thêm, sửa, ngừng dùng", async () => {
    expect((await groupAdmin.call("post", "/catalog/units", { companyId: retail, body: { code: "cai", nameVi: "Cái", nameEn: "Piece" } })).body.error.fields).toEqual({
      code: "Mã đơn vị tính đã có.",
    });
    const created = await groupAdmin.call("post", "/catalog/units", { companyId: retail, body: { code: "cuon", nameVi: "Cuộn", nameEn: "Roll" } });
    expect(created.body).toMatchObject({ code: "CUON", status: "active" });
    const updated = await groupAdmin.call("patch", `/catalog/units/${created.body.id}`, { companyId: retail, body: { nameVi: "Cuộn (cây)", nameEn: "Roll", version: created.body.version } });
    expect(updated.body.nameVi).toBe("Cuộn (cây)");
    expect((await groupAdmin.call("post", `/catalog/units/${created.body.id}/deactivate`, { companyId: retail, body: { version: updated.body.version } })).body.status).toBe("inactive");
  });
});
