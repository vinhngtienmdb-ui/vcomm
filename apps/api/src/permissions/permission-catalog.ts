// Danh mục quyền do mã khai báo, đồng bộ vào core.permissions khi khởi động (QUYTAC_NGHIEPVU_02).
// Vai trò hệ thống theo tài liệu 08 mục 2.
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import { permissions, rolePermissions, roles } from "../database/schema";

export interface PermissionDefinition {
  code: string;
  appCode: string;
  nameVi: string;
  nameEn: string;
  isSensitive: boolean;
}

const accessPermission = (appCode: string, nameVi: string, nameEn: string, isSensitive = false): PermissionDefinition => ({
  code: `${appCode}.access`,
  appCode,
  nameVi: `Truy cập ${nameVi}`,
  nameEn: `Access ${nameEn}`,
  isSensitive,
});

export const permissionCatalog: PermissionDefinition[] = [
  accessPermission("platform", "Quản trị hệ thống", "Administration"),
  accessPermission("catalog", "Sản phẩm và Nhà bán", "Products and Sellers"),
  accessPermission("inventory", "Kho", "Inventory"),
  accessPermission("purchasing", "Mua hàng", "Purchasing"),
  accessPermission("sales", "Bán hàng", "Sales"),
  accessPermission("finance", "Tài chính – Kế toán", "Finance and Accounting", true),
  accessPermission("crm", "Khách hàng và Đối tác", "Customers and Partners"),
  accessPermission("hr", "Nhân sự", "Human Resources", true),
  { code: "platform.profile.manage", appCode: "platform", nameVi: "Quản lý hồ sơ cá nhân", nameEn: "Manage own profile", isSensitive: false },
  { code: "platform.approval.decide", appCode: "platform", nameVi: "Quyết định duyệt chứng từ được giao", nameEn: "Decide assigned approvals", isSensitive: false },
  { code: "platform.company.manage", appCode: "platform", nameVi: "Quản lý công ty", nameEn: "Manage companies", isSensitive: true },
  { code: "platform.branch.manage", appCode: "platform", nameVi: "Quản lý chi nhánh", nameEn: "Manage branches", isSensitive: false },
  { code: "platform.department.manage", appCode: "platform", nameVi: "Quản lý phòng ban", nameEn: "Manage departments", isSensitive: false },
  { code: "platform.user.view", appCode: "platform", nameVi: "Xem nhân viên", nameEn: "View users", isSensitive: false },
  { code: "platform.user.invite", appCode: "platform", nameVi: "Mời nhân viên", nameEn: "Invite users", isSensitive: false },
  { code: "platform.user.manage", appCode: "platform", nameVi: "Khóa, vô hiệu hóa nhân viên", nameEn: "Lock and disable users", isSensitive: true },
  { code: "platform.user.reset_mfa", appCode: "platform", nameVi: "Đặt lại xác thực hai lớp", nameEn: "Reset two-factor authentication", isSensitive: true },
  { code: "platform.role.manage", appCode: "platform", nameVi: "Quản lý vai trò", nameEn: "Manage roles", isSensitive: true },
  { code: "platform.role.assign", appCode: "platform", nameVi: "Gán vai trò", nameEn: "Assign roles", isSensitive: true },
  { code: "platform.approval_policy.manage", appCode: "platform", nameVi: "Cấu hình chính sách duyệt", nameEn: "Manage approval policies", isSensitive: true },
  { code: "platform.number_sequence.manage", appCode: "platform", nameVi: "Cấu hình dãy số chứng từ", nameEn: "Manage number sequences", isSensitive: false },
  { code: "platform.exchange_rate.manage", appCode: "platform", nameVi: "Nhập, sửa tỷ giá", nameEn: "Manage exchange rates", isSensitive: true },
  { code: "platform.audit.view", appCode: "platform", nameVi: "Xem nhật ký thao tác", nameEn: "View audit log", isSensitive: true },
];

const employeePermissions = ["platform.access", "platform.profile.manage", "platform.approval.decide"];
// THAY_DOI_06: quản trị công ty có quyền truy cập mọi mini app để gán được vai trò nghiệp vụ.
const companyAdminPermissions = [
  ...employeePermissions,
  ...permissionCatalog.filter((permission) => permission.code.endsWith(".access") && permission.code !== "platform.access").map((permission) => permission.code),
  "platform.branch.manage",
  "platform.department.manage",
  "platform.user.view",
  "platform.user.invite",
  "platform.user.manage",
  "platform.user.reset_mfa",
  "platform.role.manage",
  "platform.role.assign",
  "platform.approval_policy.manage",
  "platform.number_sequence.manage",
  "platform.audit.view",
];

export const systemRoles: { code: string; nameVi: string; nameEn: string; permissionCodes: string[] }[] = [
  {
    code: "group_admin",
    nameVi: "Quản trị tập đoàn",
    nameEn: "Group administrator",
    permissionCodes: permissionCatalog.filter((permission) => permission.appCode === "platform").map((permission) => permission.code),
  },
  { code: "company_admin", nameVi: "Quản trị công ty", nameEn: "Company administrator", permissionCodes: companyAdminPermissions },
  { code: "exchange_rate_manager", nameVi: "Quản lý tỷ giá", nameEn: "Exchange rate manager", permissionCodes: ["platform.access", "platform.exchange_rate.manage"] },
  { code: "employee", nameVi: "Nhân viên", nameEn: "Employee", permissionCodes: employeePermissions },
];

// Loại chứng từ do mã khai báo. Chứng từ thử của Nền tảng dùng để thử luồng duyệt khi chưa có module khác (CONG_VIEC_02 lát L7).
export const documentTypeCatalog = [
  { code: "platform.test_document", appCode: "platform", nameVi: "Chứng từ thử", nameEn: "Test document", requiresApproval: true },
];

// Đồng bộ danh mục quyền và vai trò hệ thống; chạy được nhiều lần.
export async function syncPermissionCatalog(database: Database): Promise<void> {
  await database.transaction(async (transaction) => {
    for (const type of documentTypeCatalog) {
      await transaction.execute(sql`
        INSERT INTO core.document_types (code, app_code, name_vi, name_en, requires_approval)
        VALUES (${type.code}, ${type.appCode}, ${type.nameVi}, ${type.nameEn}, ${type.requiresApproval})
        ON CONFLICT (code) DO UPDATE SET app_code = EXCLUDED.app_code, name_vi = EXCLUDED.name_vi, name_en = EXCLUDED.name_en, requires_approval = EXCLUDED.requires_approval`);
    }
    for (const permission of permissionCatalog) {
      await transaction
        .insert(permissions)
        .values(permission)
        .onConflictDoUpdate({
          target: permissions.code,
          set: { appCode: permission.appCode, nameVi: permission.nameVi, nameEn: permission.nameEn, isSensitive: permission.isSensitive },
        });
    }
    for (const role of systemRoles) {
      const existing = await transaction.execute<{ id: string }>(
        sql`SELECT id FROM core.roles WHERE company_id IS NULL AND code = ${role.code}`,
      );
      let roleId = existing.rows[0]?.id;
      if (!roleId) {
        const inserted = await transaction
          .insert(roles)
          .values({ code: role.code, nameVi: role.nameVi, nameEn: role.nameEn, isSystem: true, status: "active" })
          .returning({ id: roles.id });
        roleId = inserted[0]!.id;
      }
      await transaction.delete(rolePermissions).where(sql`${rolePermissions.roleId} = ${roleId}`);
      await transaction.insert(rolePermissions).values(role.permissionCodes.map((permissionCode) => ({ roleId: roleId!, permissionCode })));
    }
  });
}
