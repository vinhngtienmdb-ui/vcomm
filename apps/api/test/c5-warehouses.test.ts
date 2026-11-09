// CONG_VIEC_05 lát L0: kho, vị trí, công ty chủ hàng, cài đặt kho (TIEUCHI_NGHIEMTHU_65 phần kho; KICHBAN_KIEMTHU_147).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;
let keeperBinhDuong: Session;
let keeperHeadOffice: Session;
let tradingManager: Session;
let employee: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;

async function assign(email: string, name: string, role: string, companyId: string, branchId: string | null) {
  const id = await createTestUser(pool, email, name, [{ companyId, branchId: branchId ?? undefined }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    companyId,
    branchId,
  ]);
  return signIn(application, email);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");

  keeperBinhDuong = await assign("thukho.kho.bd@vcomm.test", "Lê Văn Kho", "warehouse_keeper", retail, testIds.binhDuongWarehouse);
  keeperHeadOffice = await assign("thukho.hcm@vcomm.test", "Phạm Thị Kệ", "warehouse_keeper", retail, testIds.headOfficeBranch);
  tradingManager = await assign("quanly.kho.vct@vcomm.test", "Đỗ Văn Chủ", "warehouse_manager", trading, null);
  employee = await assign("nhanvien.vcr@vcomm.test", "Ngô Thị Văn", "employee", retail, null);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_65: kho thuộc chi nhánh, nhiều công ty chủ hàng", () => {
  it("KICHBAN_KIEMTHU_147: tạo kho có chủ hàng công ty khác; quyền chi nhánh khác không thấy kho; công ty chủ hàng chỉ xem; vị trí, cài đặt", async () => {
    const body = { branchId: testIds.binhDuongWarehouse, code: "kho-bd", name: "Kho Bình Dương", usesLocations: true, ownerCompanyIds: [trading] };
    expect((await keeperBinhDuong.call("post", "/inventory/warehouses", { companyId: retail, body })).status).toBe(403);
    const created = await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "KHO-BD", usesLocations: true, canOperate: true, canManage: true });
    expect(created.body.owners.map((owner: { companyId: string }) => owner.companyId).sort()).toEqual([retail, trading].sort());
    expect((await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body })).body.error.fields).toEqual({ code: "Mã kho đã có trong công ty." });
    const otherBranch = await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { ...body, code: "KHAC", branchId: testIds.groupCompany } });
    expect(Object.keys(otherBranch.body.error.fields)).toEqual(["branchId"]);
    const id = created.body.id;

    // Thủ kho chi nhánh Bình Dương thao tác được; thủ kho trụ sở không thấy kho.
    expect((await keeperBinhDuong.call("get", "/inventory/warehouses", { companyId: retail })).body.map((item: { id: string; canOperate: boolean }) => [item.id, item.canOperate])).toEqual([
      [id, true],
    ]);
    expect((await keeperHeadOffice.call("get", "/inventory/warehouses", { companyId: retail })).body).toEqual([]);
    expect((await keeperHeadOffice.call("get", `/inventory/warehouses/${id}`, { companyId: retail })).status).toBe(404);
    // Công ty chủ hàng thấy kho để xem tồn, không thao tác.
    expect((await tradingManager.call("get", "/inventory/warehouses", { companyId: trading })).body).toEqual([expect.objectContaining({ id, canOperate: false, canManage: false })]);
    expect((await tradingManager.call("post", `/inventory/warehouses/${id}/locations`, { companyId: trading, body: { locations: [{ code: "A-01" }] } })).status).toBe(403);
    expect((await employee.call("get", "/inventory/warehouses", { companyId: retail })).status).toBe(403);

    // Vị trí: thêm nhiều, mã trùng chỉ ra đúng dòng.
    const locations = await retailAdmin.call("post", `/inventory/warehouses/${id}/locations`, {
      companyId: retail,
      body: { locations: [{ code: "a-01-01" }, { code: "A-01-02", name: "Kệ A tầng 2" }] },
    });
    expect(locations.body.map((location: { code: string }) => location.code)).toEqual(["A-01-01", "A-01-02"]);
    const duplicate = await retailAdmin.call("post", `/inventory/warehouses/${id}/locations`, { companyId: retail, body: { locations: [{ code: "A-01-03" }, { code: "A-01-01" }] } });
    expect(duplicate.body.error.fields).toEqual({ "locations.1.code": "Mã vị trí đã có trong kho." });
    expect((await retailAdmin.call("get", `/inventory/warehouses/${id}`, { companyId: retail })).body.locationCount).toBe(2);

    // Sửa kho, ngừng dùng; phiên bản sai bị từ chối.
    const updated = await retailAdmin.call("patch", `/inventory/warehouses/${id}`, { companyId: retail, body: { name: "Kho tổng Bình Dương", usesLocations: true, ownerCompanyIds: [], version: 1 } });
    expect(updated.body.owners).toEqual([{ companyId: retail, companyName: "VComm Bán lẻ Miền Nam" }]);
    expect((await retailAdmin.call("patch", `/inventory/warehouses/${id}`, { companyId: retail, body: { name: "X", usesLocations: true, ownerCompanyIds: [], version: 1 } })).status).toBe(409);
    expect((await retailAdmin.call("post", `/inventory/warehouses/${id}/deactivate`, { companyId: retail, body: { version: 2 } })).body.status).toBe("inactive");

    // Cài đặt giữ hàng theo công ty, mặc định 72 giờ.
    expect((await retailAdmin.call("get", "/inventory/settings", { companyId: retail })).body).toEqual({ reservationHours: 72, version: 0 });
    expect((await retailAdmin.call("put", "/inventory/settings", { companyId: retail, body: { reservationHours: 48, version: 0 } })).body).toEqual({ reservationHours: 48, version: 1 });
    expect((await keeperBinhDuong.call("put", "/inventory/settings", { companyId: retail, body: { reservationHours: 24, version: 1 } })).status).toBe(403);
  });
});
