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
  // CONG_VIEC_03 (THAY_DOI_04, THAY_DOI_08).
  { code: "platform.integration.manage", appCode: "platform", nameVi: "Cài đặt tích hợp", nameEn: "Manage integrations", isSensitive: true },
  { code: "platform.proposal_template.manage", appCode: "platform", nameVi: "Quản lý mẫu đề xuất", nameEn: "Manage proposal templates", isSensitive: false },
  { code: "platform.proposal.create", appCode: "platform", nameVi: "Lập đề xuất", nameEn: "Create proposals", isSensitive: false },
  // CONG_VIEC_04: mini app Sản phẩm (MODULE_02).
  { code: "catalog.category.manage", appCode: "catalog", nameVi: "Quản lý ngành hàng, đơn vị tính (toàn tập đoàn)", nameEn: "Manage categories and units (group)", isSensitive: false },
  { code: "catalog.product.view", appCode: "catalog", nameVi: "Xem sản phẩm", nameEn: "View products", isSensitive: false },
  { code: "catalog.product.manage", appCode: "catalog", nameVi: "Quản lý sản phẩm", nameEn: "Manage products", isSensitive: false },
  { code: "catalog.price.view", appCode: "catalog", nameVi: "Xem bảng giá", nameEn: "View price lists", isSensitive: false },
  { code: "catalog.price.manage", appCode: "catalog", nameVi: "Quản lý bảng giá, điều chỉnh giá", nameEn: "Manage price lists and price changes", isSensitive: true },
  // CONG_VIEC_05: mini app Kho (MODULE_03).
  { code: "inventory.warehouse.manage", appCode: "inventory", nameVi: "Quản lý kho, vị trí", nameEn: "Manage warehouses and locations", isSensitive: false },
  { code: "inventory.stock.view", appCode: "inventory", nameVi: "Xem tồn kho", nameEn: "View stock", isSensitive: false },
  { code: "inventory.cost.view", appCode: "inventory", nameVi: "Xem giá vốn, giá trị tồn", nameEn: "View stock cost and value", isSensitive: true },
  { code: "inventory.document.manage", appCode: "inventory", nameVi: "Lập phiếu kho", nameEn: "Manage stock documents", isSensitive: false },
  { code: "inventory.stocktake.manage", appCode: "inventory", nameVi: "Kiểm kê", nameEn: "Manage stocktakes", isSensitive: false },
  { code: "inventory.reservation.manage", appCode: "inventory", nameVi: "Quản lý giữ hàng, tồn an toàn", nameEn: "Manage reservations and stock levels", isSensitive: false },
  // CONG_VIEC_06: danh mục đối tác (MODULE_07, phần tối thiểu).
  { code: "crm.partner.view", appCode: "crm", nameVi: "Xem đối tác", nameEn: "View partners", isSensitive: false },
  { code: "crm.partner.manage", appCode: "crm", nameVi: "Thêm, sửa đối tác dùng chung", nameEn: "Manage shared partners", isSensitive: false },
  { code: "crm.partner.identity.view", appCode: "crm", nameVi: "Xem số Căn cước công dân của đối tác", nameEn: "View partner citizen identity numbers", isSensitive: true },
  { code: "crm.profile.manage", appCode: "crm", nameVi: "Quản lý hồ sơ đối tác của công ty (hạn mức công nợ)", nameEn: "Manage company partner profiles (credit limits)", isSensitive: true },
  // CONG_VIEC_07: Mua hàng trong nước (MODULE_04, phần 1).
  { code: "purchasing.price.manage", appCode: "purchasing", nameVi: "Quản lý bảng giá mua", nameEn: "Manage supplier prices", isSensitive: false },
  { code: "purchasing.requisition.create", appCode: "purchasing", nameVi: "Lập đề nghị mua", nameEn: "Create purchase requisitions", isSensitive: false },
  { code: "purchasing.order.view", appCode: "purchasing", nameVi: "Xem đơn mua", nameEn: "View purchase orders", isSensitive: false },
  { code: "purchasing.order.manage", appCode: "purchasing", nameVi: "Lập, sửa, đóng đơn mua", nameEn: "Manage purchase orders", isSensitive: false },
  { code: "purchasing.settings.manage", appCode: "purchasing", nameVi: "Cài đặt mua hàng", nameEn: "Manage purchasing settings", isSensitive: false },
  // CONG_VIEC_08: Bán hàng (MODULE_05, phần 1).
  { code: "sales.order.view", appCode: "sales", nameVi: "Xem đơn bán", nameEn: "View sales orders", isSensitive: false },
  { code: "sales.order.manage", appCode: "sales", nameVi: "Lập, sửa, gửi, hủy, đóng đơn bán", nameEn: "Manage sales orders", isSensitive: false },
  { code: "sales.settings.manage", appCode: "sales", nameVi: "Cài đặt bán hàng", nameEn: "Manage sales settings", isSensitive: false },
  { code: "inventory.sales.issue", appCode: "inventory", nameVi: "Xuất giao hàng, nhận hàng trả lại", nameEn: "Issue sales deliveries and receive returns", isSensitive: false },
  { code: "inventory.purchase.receive", appCode: "inventory", nameVi: "Nhập mua, trả hàng nhà cung cấp", nameEn: "Receive purchases and return to suppliers", isSensitive: false },
];

const inventoryPermissions = permissionCatalog.filter((permission) => permission.appCode === "inventory").map((permission) => permission.code);

const employeePermissions = ["platform.access", "platform.profile.manage", "platform.approval.decide", "platform.proposal.create"];
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
  "platform.proposal_template.manage",
  "catalog.product.view",
  "catalog.product.manage",
  "catalog.price.view",
  "catalog.price.manage",
  ...inventoryPermissions.filter((code) => code !== "inventory.access"),
  "crm.partner.view",
  "crm.partner.manage",
  "crm.partner.identity.view",
  "crm.profile.manage",
  "purchasing.price.manage",
  "purchasing.requisition.create",
  "purchasing.order.view",
  "purchasing.order.manage",
  "purchasing.settings.manage",
  "sales.order.view",
  "sales.order.manage",
  "sales.settings.manage",
];

export const systemRoles: { code: string; nameVi: string; nameEn: string; permissionCodes: string[] }[] = [
  {
    code: "group_admin",
    nameVi: "Quản trị tập đoàn",
    nameEn: "Group administrator",
    // Quản trị tập đoàn: mọi quyền của Nền tảng, Sản phẩm (CONG_VIEC_04), Kho (CONG_VIEC_05), Đối tác (CONG_VIEC_06), Mua hàng (CONG_VIEC_07), Bán hàng (CONG_VIEC_08), cộng quyền truy cập mọi mini app.
    permissionCodes: permissionCatalog
      .filter((permission) => ["platform", "catalog", "inventory", "crm", "purchasing", "sales"].includes(permission.appCode) || permission.code.endsWith(".access"))
      .map((permission) => permission.code),
  },
  { code: "company_admin", nameVi: "Quản trị công ty", nameEn: "Company administrator", permissionCodes: companyAdminPermissions },
  { code: "exchange_rate_manager", nameVi: "Quản lý tỷ giá", nameEn: "Exchange rate manager", permissionCodes: ["platform.access", "platform.exchange_rate.manage"] },
  { code: "employee", nameVi: "Nhân viên", nameEn: "Employee", permissionCodes: employeePermissions },
  {
    code: "catalog_manager",
    nameVi: "Quản lý sản phẩm",
    nameEn: "Product manager",
    permissionCodes: ["catalog.access", "catalog.product.view", "catalog.product.manage", "catalog.price.view"],
  },
  { code: "warehouse_keeper", nameVi: "Thủ kho", nameEn: "Warehouse keeper", permissionCodes: ["inventory.access", "inventory.stock.view", "inventory.document.manage", "inventory.purchase.receive", "inventory.sales.issue", "crm.partner.view", "purchasing.access", "purchasing.requisition.create", "purchasing.order.view", "sales.access", "sales.order.view"] },
  { code: "warehouse_manager", nameVi: "Quản lý kho", nameEn: "Warehouse manager", permissionCodes: inventoryPermissions },
  {
    code: "purchaser",
    nameVi: "Nhân viên mua hàng",
    nameEn: "Purchaser",
    permissionCodes: ["purchasing.access", "purchasing.price.manage", "purchasing.requisition.create", "purchasing.order.view", "purchasing.order.manage", "crm.access", "crm.partner.view", "crm.partner.manage"],
  },
  {
    code: "salesperson",
    nameVi: "Nhân viên bán hàng",
    nameEn: "Salesperson",
    permissionCodes: ["sales.access", "sales.order.view", "sales.order.manage", "crm.access", "crm.partner.view", "crm.partner.manage", "catalog.access", "catalog.price.view"],
  },
  { code: "partner_manager", nameVi: "Quản lý đối tác", nameEn: "Partner manager", permissionCodes: ["crm.access", "crm.partner.view", "crm.partner.manage"] },
];

// Loại chứng từ do mã khai báo. Chứng từ thử của Nền tảng dùng để thử luồng duyệt khi chưa có module khác (CONG_VIEC_02 lát L7).
export const documentTypeCatalog = [
  { code: "platform.test_document", appCode: "platform", nameVi: "Chứng từ thử", nameEn: "Test document", requiresApproval: true },
  { code: "catalog.price_change", appCode: "catalog", nameVi: "Phiếu điều chỉnh giá", nameEn: "Price change", requiresApproval: true },
  { code: "inventory.receipt_other", appCode: "inventory", nameVi: "Phiếu nhập khác", nameEn: "Other goods receipt", requiresApproval: true },
  { code: "inventory.issue_other", appCode: "inventory", nameVi: "Phiếu xuất khác", nameEn: "Other goods issue", requiresApproval: true },
  { code: "inventory.adjustment", appCode: "inventory", nameVi: "Phiếu điều chỉnh kho", nameEn: "Stock adjustment", requiresApproval: true },
  { code: "inventory.transfer", appCode: "inventory", nameVi: "Phiếu chuyển kho", nameEn: "Stock transfer", requiresApproval: true },
  { code: "inventory.stocktake", appCode: "inventory", nameVi: "Phiếu kiểm kê", nameEn: "Stocktake", requiresApproval: false },
  { code: "inventory.purchase_receipt", appCode: "inventory", nameVi: "Phiếu nhập mua", nameEn: "Purchase receipt", requiresApproval: false },
  { code: "inventory.purchase_return", appCode: "inventory", nameVi: "Phiếu trả hàng nhà cung cấp", nameEn: "Purchase return", requiresApproval: false },
  { code: "purchasing.requisition", appCode: "purchasing", nameVi: "Đề nghị mua", nameEn: "Purchase requisition", requiresApproval: true },
  { code: "purchasing.order", appCode: "purchasing", nameVi: "Đơn mua", nameEn: "Purchase order", requiresApproval: true },
  { code: "sales.order", appCode: "sales", nameVi: "Đơn bán", nameEn: "Sales order", requiresApproval: true },
  { code: "inventory.sales_issue", appCode: "inventory", nameVi: "Phiếu xuất giao hàng", nameEn: "Sales delivery", requiresApproval: false },
  { code: "inventory.sales_return", appCode: "inventory", nameVi: "Phiếu nhận hàng trả lại", nameEn: "Sales return", requiresApproval: false },
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
