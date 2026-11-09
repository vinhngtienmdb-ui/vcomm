// KICHBAN_KIEMTHU cho TIEUCHI_NGHIEMTHU_19 đến 26 (tài liệu 21, lát L2).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;

const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;

async function createRole(session: Session, code: string, permissionCodes: string[], options: { shared?: boolean; companyId?: string } = {}): Promise<string> {
  const created = await session.call("post", "/roles", { companyId: options.companyId ?? retail, body: { code, nameVi: code, nameEn: code, shared: options.shared } });
  expect(created.status).toBe(201);
  if (permissionCodes.length > 0) {
    const updated = await session.call("put", `/roles/${created.body.id}/permissions`, { companyId: options.companyId ?? retail, body: { permissionCodes, version: created.body.version } });
    expect(updated.status).toBe(200);
  }
  return created.body.id;
}

async function assign(session: Session, userId: string, body: Record<string, unknown>, companyId = retail) {
  return session.call("post", `/users/${userId}/role-assignments`, { companyId, body: { validFrom: "2026-01-01", ...body } });
}

async function roleVersion(roleId: string): Promise<number> {
  return (await pool.query<{ version: number }>("SELECT version FROM core.roles WHERE id = $1", [roleId])).rows[0]!.version;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_19: chuyển công ty không phải đăng nhập lại", () => {
  it("KICHBAN_KIEMTHU_47: cùng phiên, đổi X-Company-Id thì quyền đổi theo công ty", async () => {
    const employee = await signIn(application, "phuc.le@vcomm.test");
    const atRetail = await employee.call("get", "/me", { companyId: retail });
    const atTrading = await employee.call("get", "/me", { companyId: trading });
    const backToRetail = await employee.call("get", "/me", { companyId: retail });
    expect([atRetail.status, atTrading.status, backToRetail.status]).toEqual([200, 200, 200]);
    expect(atRetail.body.permissions).toContain("purchasing.access");
    expect(atTrading.body.permissions).not.toContain("purchasing.access");
    expect(backToRetail.body.permissions).toEqual(atRetail.body.permissions);
  });

  it("KICHBAN_KIEMTHU_49: chuyển sang công ty không thuộc về bị từ chối", async () => {
    const employee = await signIn(application, "phuc.le@vcomm.test");
    const response = await employee.call("get", "/me", { companyId: testIds.groupCompany });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("Bạn không thuộc công ty này.");
  });
});

describe("TIEUCHI_NGHIEMTHU_20: quyền ở công ty này không có hiệu lực ở công ty khác", () => {
  it("KICHBAN_KIEMTHU_50, 51: có quyền ở VCR, không có ở VCT", async () => {
    const userId = await createTestUser(pool, "nhanvien.haicongty@vcomm.test", "Đỗ Thị Hai Công Ty", [{ companyId: retail, branchId: testIds.headOfficeBranch }, { companyId: trading }]);
    const viewerRole = await createRole(retailAdmin, "xem_nhan_vien_hai_cong_ty", ["platform.access", "platform.user.view"]);
    expect((await assign(retailAdmin, userId, { roleId: viewerRole, scopeType: "company" })).status).toBe(201);
    const employee = await signIn(application, "nhanvien.haicongty@vcomm.test");
    expect((await employee.call("get", "/users", { companyId: retail })).status).toBe(200);
    const atTrading = await employee.call("get", "/users", { companyId: trading });
    expect(atTrading.status).toBe(403);
    expect(atTrading.body.error.code).toBe("FORBIDDEN");
    expect((await employee.call("get", "/me", { companyId: trading })).body.permissions).not.toContain("platform.user.view");
  });
});

describe("TIEUCHI_NGHIEMTHU_21: không cấp được quyền mình không có", () => {
  it("KICHBAN_KIEMTHU_52: quản trị VCR thêm platform.company.manage bị từ chối, vai trò không đổi", async () => {
    const permissions = await retailAdmin.call("get", "/permissions", { companyId: retail });
    const companyManage = permissions.body.flatMap((group: { permissions: { code: string; grantableByMe: boolean }[] }) => group.permissions).find((permission: { code: string }) => permission.code === "platform.company.manage");
    expect(companyManage.grantableByMe).toBe(false);

    const roleId = await createRole(retailAdmin, "ho_tro_thu", []);
    const version = await roleVersion(roleId);
    const response = await retailAdmin.call("put", `/roles/${roleId}/permissions`, { companyId: retail, body: { permissionCodes: ["platform.company.manage"], version } });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("Bạn không thể cấp quyền mình không có.");
    expect(await roleVersion(roleId)).toBe(version);
  });

  it("KICHBAN_KIEMTHU_53: thêm quyền trong phạm vi được cấp thì thành công, version tăng", async () => {
    const roleId = await createRole(retailAdmin, "ho_tro_thu_hai", []);
    const version = await roleVersion(roleId);
    const response = await retailAdmin.call("put", `/roles/${roleId}/permissions`, { companyId: retail, body: { permissionCodes: ["platform.user.view"], version } });
    expect(response.status).toBe(200);
    expect(response.body.version).toBe(version + 1);
    expect(response.body.permissionCodes).toEqual(["platform.user.view"]);

    const sharedRole = await createRole(groupAdmin, "dung_chung_thu", ["platform.company.manage"], { shared: true });
    expect((await pool.query("SELECT company_id FROM core.roles WHERE id = $1", [sharedRole])).rows[0].company_id).toBeNull();
  });

  it("quản trị công ty không tạo được vai trò dùng chung, không sửa được vai trò hệ thống", async () => {
    const shared = await retailAdmin.call("post", "/roles", { companyId: retail, body: { code: "dung_chung_cam", nameVi: "x", nameEn: "x", shared: true } });
    expect(shared.status).toBe(403);
    const systemRole = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!;
    const response = await groupAdmin.call("patch", `/roles/${systemRole.id}`, { companyId: retail, body: { nameVi: "Đổi tên", version: systemRole.version } });
    expect(response.status).toBe(409);
    expect(response.body.error.message).toBe("Không thể thay đổi vai trò hệ thống.");
  });

  it("mã vai trò trùng bị từ chối theo trường", async () => {
    const response = await retailAdmin.call("post", "/roles", { companyId: retail, body: { code: "warehouse_keeper", nameVi: "x", nameEn: "x" } });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.code).toBe("Mã vai trò đã tồn tại.");
  });

  it("sửa vai trò với version cũ bị từ chối", async () => {
    const roleId = await createRole(retailAdmin, "ho_tro_thu_ba", []);
    const response = await retailAdmin.call("patch", `/roles/${roleId}`, { companyId: retail, body: { nameVi: "Mới", version: 99 } });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("CONFLICT_VERSION");
  });
});

describe("TIEUCHI_NGHIEMTHU_22: bỏ quyền khỏi vai trò có hiệu lực ngay", () => {
  it("KICHBAN_KIEMTHU_55, 56: mất quyền ngay ở thao tác tiếp theo, trừ khi còn qua vai trò khác", async () => {
    const userId = await createTestUser(pool, "moi.nhanvien01@vcomm.test", "Ngô Văn Một", [{ companyId: retail, branchId: testIds.headOfficeBranch }]);
    const first = await createRole(retailAdmin, "xem_nhan_vien_thu", ["platform.access", "platform.user.view"]);
    const second = await createRole(retailAdmin, "xem_nhan_vien_thu_hai", ["platform.user.view"]);
    await assign(retailAdmin, userId, { roleId: first, scopeType: "company" });
    await assign(retailAdmin, userId, { roleId: second, scopeType: "company" });
    const employee = await signIn(application, "moi.nhanvien01@vcomm.test");
    expect((await employee.call("get", "/users", { companyId: retail })).status).toBe(200);

    await retailAdmin.call("put", `/roles/${first}/permissions`, { companyId: retail, body: { permissionCodes: ["platform.access"], version: await roleVersion(first) } });
    expect((await employee.call("get", "/users", { companyId: retail })).status).toBe(200);

    await retailAdmin.call("put", `/roles/${second}/permissions`, { companyId: retail, body: { permissionCodes: [], version: await roleVersion(second) } });
    expect((await employee.call("get", "/users", { companyId: retail })).status).toBe(403);
  });
});

describe("TIEUCHI_NGHIEMTHU_23: lọc dữ liệu theo phạm vi chi nhánh trong truy vấn", () => {
  // Đối tượng dữ liệu chốt ở lát L2: danh sách nhân viên (API_24, API_29) theo chi nhánh mặc định; chạy lại bằng API kho khi xây MODULE_03.
  let branchViewer: string;

  beforeAll(async () => {
    branchViewer = await createRole(retailAdmin, "xem_nhan_vien_chi_nhanh", ["platform.user.view"]);
    expect((await assign(retailAdmin, testIds.warehouseKeeper, { roleId: branchViewer, scopeType: "branch", branchId: testIds.binhDuongWarehouse })).status).toBe(201);
  });

  it("KICHBAN_KIEMTHU_57: thủ kho VCR-BD chỉ thấy nhân viên VCR-BD", async () => {
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    const all = await keeper.call("get", "/users", { companyId: retail });
    expect(all.status).toBe(200);
    expect(all.body.data.map((user: { branchName: string }) => user.branchName)).toEqual(["Kho tổng Bình Dương"]);
    const filtered = await keeper.call("get", `/users?branchId=${testIds.headOfficeBranch}`, { companyId: retail });
    expect(filtered.body.data).toEqual([]);
    expect(filtered.body.total).toBe(0);
  });

  it("KICHBAN_KIEMTHU_58: lấy nhân viên VCR-HCM theo mã trả 404 như không tồn tại", async () => {
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    const outside = await keeper.call("get", `/users/${testIds.purchasingManager}`, { companyId: retail });
    const missing = await keeper.call("get", "/users/00000000-0000-4000-8000-999999999999", { companyId: retail });
    expect(outside.status).toBe(404);
    expect(outside.body.error.message).toBe(missing.body.error.message);
  });

  it("KICHBAN_KIEMTHU_59: phạm vi công ty thấy mọi chi nhánh", async () => {
    const userId = await createTestUser(pool, "moi.nhanvien02@vcomm.test", "Lý Thị Hai", [{ companyId: retail, branchId: testIds.binhDuongWarehouse }]);
    await assign(retailAdmin, userId, { roleId: branchViewer, scopeType: "company" });
    const viewer = await signIn(application, "moi.nhanvien02@vcomm.test");
    const response = await viewer.call("get", "/users?pageSize=100", { companyId: retail });
    const branches = new Set(response.body.data.map((user: { branchName: string | null }) => user.branchName));
    expect(branches.has("Kho tổng Bình Dương")).toBe(true);
    expect(branches.has("Trụ sở Thành phố Hồ Chí Minh")).toBe(true);
  });
});

describe("TIEUCHI_NGHIEMTHU_24: lần gán hết hiệu lực từ ngày sau ngày kết thúc (giờ Việt Nam)", () => {
  it("KICHBAN_KIEMTHU_60: 23:59:59 ngày kết thúc còn quyền, 00:00:01 hôm sau mất quyền", async () => {
    const userId = await createTestUser(pool, "het.han@vcomm.test", "Võ Văn Hết Hạn", [{ companyId: retail, branchId: testIds.headOfficeBranch }]);
    const role = await createRole(retailAdmin, "xem_nhan_vien_co_han", ["platform.user.view"]);
    expect((await assign(retailAdmin, userId, { roleId: role, scopeType: "company", validFrom: "2026-11-01", validTo: "2026-11-09" })).status).toBe(201);
    const employee = await signIn(application, "het.han@vcomm.test");
    try {
      testClock.fixed = new Date("2026-11-09T23:59:59+07:00");
      expect((await employee.call("get", "/users", { companyId: retail })).status).toBe(200);
      testClock.fixed = new Date("2026-11-10T00:00:01+07:00");
      expect((await employee.call("get", "/users", { companyId: retail })).status).toBe(403);
    } finally {
      testClock.fixed = null;
    }
  });

  it("KICHBAN_KIEMTHU_61: ngày kết thúc trước ngày bắt đầu bị từ chối", async () => {
    const role = await createRole(retailAdmin, "vai_tro_ngay_sai", ["platform.access"]);
    const response = await assign(retailAdmin, testIds.purchasingManager, { roleId: role, scopeType: "company", validFrom: "2026-11-10", validTo: "2026-11-09" });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.validTo).toBe("Ngày kết thúc phải sau ngày bắt đầu.");
  });
});

describe("TIEUCHI_NGHIEMTHU_25: quản trị công ty không gán ngoài công ty mình", () => {
  it("không gán được phạm vi tập đoàn", async () => {
    const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
    const response = await assign(retailAdmin, testIds.purchasingManager, { roleId: role, scopeType: "group" });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("Bạn không thể gán vai trò ngoài công ty của mình.");
  });

  it("không gán được ở VCT", async () => {
    const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
    const response = await assign(retailAdmin, testIds.purchasingManager, { roleId: role, scopeType: "company" }, trading);
    expect(response.status).toBe(403);
  });

  it("không gán được vai trò có quyền mình không có", async () => {
    const shared = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'dung_chung_thu'")).rows[0]!.id;
    const response = await assign(retailAdmin, testIds.purchasingManager, { roleId: shared, scopeType: "company" });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("Bạn không thể cấp quyền mình không có.");
  });

  it("THAY_DOI_06: quản trị công ty gán được vai trò Thủ kho cho nhân viên công ty mình", async () => {
    const response = await assign(retailAdmin, testIds.purchasingManager, { roleId: testIds.warehouseKeeperRole, scopeType: "branch", branchId: testIds.binhDuongWarehouse });
    expect(response.status).toBe(201);
    const home = await retailAdmin.call("get", "/home", { companyId: retail });
    expect(home.body.apps.map((app: { code: string }) => app.code)).toEqual(expect.arrayContaining(["inventory", "finance", "hr"]));
  });

  it("gán vai trò có quyền nhạy cảm thì bật bắt buộc xác thực hai lớp (QUYTAC_NGHIEPVU_09)", async () => {
    const role = await createRole(retailAdmin, "quan_ly_khoa_thu", ["platform.user.manage"]);
    expect((await assign(retailAdmin, testIds.purchasingManager, { roleId: role, scopeType: "company" })).status).toBe(201);
    expect((await pool.query("SELECT mfa_required FROM core.users WHERE id = $1", [testIds.purchasingManager])).rows[0].mfa_required).toBe(true);
  });

  it("gỡ lần gán ghi nhật ký và sự kiện", async () => {
    const role = await createRole(retailAdmin, "vai_tro_go_thu", ["platform.access"]);
    const created = await assign(retailAdmin, testIds.purchasingManager, { roleId: role, scopeType: "company" });
    const removed = await retailAdmin.call("delete", `/users/${testIds.purchasingManager}/role-assignments/${created.body.id}`, { companyId: retail });
    expect(removed.status).toBe(204);
    const audit = await pool.query("SELECT 1 FROM core.audit_events WHERE action = 'role_assignment.delete' AND entity_id = $1", [created.body.id]);
    expect(audit.rows.length).toBe(1);
    const events = await pool.query("SELECT 1 FROM core.outbox_events WHERE event_type = 'core.role_assignment.changed' AND aggregate_id = $1", [created.body.id]);
    expect(events.rows.length).toBe(2);
  });
});

describe("TIEUCHI_NGHIEMTHU_26: không có API đăng nhập thay nhân viên khác", () => {
  it("danh sách đường dẫn API không có chức năng đăng nhập thay", () => {
    const router = application.getHttpAdapter().getInstance()._router ?? application.getHttpAdapter().getInstance().router;
    const paths: string[] = router.stack.filter((layer: { route?: { path: string } }) => layer.route).map((layer: { route: { path: string } }) => layer.route.path);
    expect(paths.length).toBeGreaterThan(5);
    expect(paths.filter((path) => /impersonat|login-as|login_as|switch-user|sudo/i.test(path))).toEqual([]);
  });
});
