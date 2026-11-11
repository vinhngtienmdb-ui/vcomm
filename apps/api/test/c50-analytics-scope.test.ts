// CONG_VIEC_50: phạm vi xem báo cáo quản trị (KICHBAN_KIEMTHU_476, 477).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
const group: string = testIds.groupCompany;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const branch: string = testIds.headOfficeBranch;

async function assign(email: string, role: string, scope: "group" | "company" | "branch") {
  const id = await createTestUser(pool, email, "Người xem báo cáo", [{ companyId: retail, branchId: scope === "branch" ? branch : undefined }, { companyId: trading }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    scope,
    scope === "group" ? null : retail,
    scope === "branch" ? branch : null,
  ]);
  return signIn(application, email);
}
const get = (session: Session, companyId: string, path: string) => session.call("get", path, { companyId });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
});

afterAll(async () => {
  await application?.close();
});

describe("CONG_VIEC_50 phạm vi xem", () => {
  it("KICHBAN_KIEMTHU_476: tập đoàn xem mọi công ty, công ty chỉ xem công ty mình, chi nhánh không xem được, công ty ngoài phạm vi bị từ chối", async () => {
    const groupManager = await assign("khotd.baocao@vcomm.test", "warehouse_manager", "group");
    const scope = await get(groupManager, retail, "/analytics/scope");
    expect(scope.status, JSON.stringify(scope.body)).toBe(200);
    expect(scope.body.group).toMatchObject({ id: group, currency: "VND" });
    expect(scope.body.reports.inventory.sort()).toEqual([group, retail, trading].sort());
    expect(scope.body.reports).toMatchObject({ sales: [], debt: [], commission: [] });
    expect(scope.body.companies.map((company: { id: string; inTotal: boolean }) => [company.id, company.inTotal])).toEqual([
      [group, true],
      [retail, true],
      [trading, true],
    ]);

    const companyManager = await assign("khocty.baocao@vcomm.test", "warehouse_manager", "company");
    const own = await get(companyManager, retail, "/analytics/scope");
    expect(own.body.reports.inventory).toEqual([retail]);
    expect(own.body.companies.map((company: { id: string }) => company.id)).toEqual([retail]);
    // Đang chọn công ty khác: vai trò gán ở công ty VCR không có hiệu lực.
    expect((await get(companyManager, trading, "/analytics/scope")).status).toBe(403);

    const branchManager = await assign("khocn.baocao@vcomm.test", "warehouse_manager", "branch");
    const branchScope = await get(branchManager, retail, "/analytics/scope");
    expect(branchScope.status).toBe(200);
    expect(branchScope.body.reports.inventory).toEqual([]);
    expect(branchScope.body.companies).toEqual([]);
  });

  it("KICHBAN_KIEMTHU_477: quyền xét riêng từng nhóm báo cáo", async () => {
    const accountant = await assign("ketoan.baocao@vcomm.test", "accountant", "company");
    const scope = await get(accountant, retail, "/analytics/scope");
    expect(scope.body.reports).toEqual({ sales: [], inventory: [], debt: [retail], commission: [retail] });
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    const all = await get(groupAdmin, retail, "/analytics/scope");
    for (const kind of ["sales", "inventory", "debt", "commission"]) expect(all.body.reports[kind]).toHaveLength(3);
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await get(employee, retail, "/analytics/scope")).status).toBe(403);
  });
});
