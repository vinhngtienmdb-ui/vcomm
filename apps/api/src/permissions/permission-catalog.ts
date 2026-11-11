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
  // CONG_VIEC_22: ứng dụng nhân viên kinh doanh (THAY_DOI_13).
  { code: "crm.visit.manage", appCode: "crm", nameVi: "Ghi lượt ghé thăm khách", nameEn: "Record customer visits", isSensitive: false },
  // CONG_VIEC_23: tài khoản người mua VComm (xét tại công ty vận hành sàn).
  { code: "marketplace.buyer.view", appCode: "crm", nameVi: "Xem tài khoản người mua", nameEn: "View buyer accounts", isSensitive: false },
  { code: "marketplace.buyer.manage", appCode: "crm", nameVi: "Đổi người giới thiệu, đánh dấu nhân viên kinh doanh", nameEn: "Change referrers, flag sales staff", isSensitive: true },
  { code: "marketplace.order.view", appCode: "crm", nameVi: "Xem đơn VComm, yêu cầu trả hàng", nameEn: "View VComm orders and return requests", isSensitive: false },
  {
    code: "marketplace.order.manage",
    appCode: "crm",
    nameVi: "Cài đặt bán hàng VComm, đăng bán, giao đơn, xử lý trả hàng",
    nameEn: "Manage VComm store, listings, shipments and returns",
    isSensitive: true,
  },
  // CONG_VIEC_25: ghi đã thu tiền thu hộ, đã hoàn tiền đơn VComm.
  { code: "marketplace.payment.manage", appCode: "crm", nameVi: "Ghi đã thu tiền thu hộ, đã hoàn tiền đơn VComm", nameEn: "Record VComm cash collected and refunds", isSensitive: true },
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
  { code: "sales.promotion.view", appCode: "sales", nameVi: "Xem chương trình khuyến mãi", nameEn: "View promotions", isSensitive: false },
  { code: "sales.promotion.manage", appCode: "sales", nameVi: "Lập, gửi duyệt, dừng chương trình khuyến mãi", nameEn: "Manage promotions", isSensitive: false },
  { code: "finance.debt.view", appCode: "finance", nameVi: "Xem quỹ, công nợ, phiếu thu chi", nameEn: "View funds, debts and payments", isSensitive: false },
  { code: "finance.fund.manage", appCode: "finance", nameVi: "Quản lý quỹ", nameEn: "Manage funds", isSensitive: false },
  { code: "finance.debt.manage", appCode: "finance", nameVi: "Nhập số dư đầu kỳ công nợ", nameEn: "Manage opening debt balances", isSensitive: false },
  { code: "finance.payment.manage", appCode: "finance", nameVi: "Lập, gửi phiếu thu, phiếu chi", nameEn: "Manage receipts and payments", isSensitive: false },
  { code: "finance.ledger.view", appCode: "finance", nameVi: "Xem tài khoản, bút toán, sổ cái", nameEn: "View accounts, journals and ledgers", isSensitive: false },
  { code: "finance.ledger.setup", appCode: "finance", nameVi: "Khởi tạo kế toán, sửa tài khoản, định khoản", nameEn: "Set up accounts and posting rules", isSensitive: false },
  { code: "finance.journal.manage", appCode: "finance", nameVi: "Lập, gửi phiếu kế toán", nameEn: "Manage manual journals", isSensitive: false },
  { code: "finance.period.close", appCode: "finance", nameVi: "Khóa sổ, mở lại sổ", nameEn: "Close and reopen periods", isSensitive: true },
  { code: "finance.einvoice.view", appCode: "finance", nameVi: "Xem hóa đơn điện tử", nameEn: "View e-invoices", isSensitive: false },
  { code: "finance.einvoice.manage", appCode: "finance", nameVi: "Gửi lại, điều chỉnh, thay thế hóa đơn điện tử", nameEn: "Manage e-invoices", isSensitive: false },
  { code: "finance.einvoice.setup", appCode: "finance", nameVi: "Cài đặt hóa đơn điện tử", nameEn: "Set up e-invoicing", isSensitive: true },
  { code: "finance.bank.view", appCode: "finance", nameVi: "Xem giao dịch ngân hàng, đối chiếu", nameEn: "View bank transactions and reconciliation", isSensitive: false },
  { code: "finance.bank.manage", appCode: "finance", nameVi: "Ghép, bỏ qua giao dịch ngân hàng, lập phiếu thu từ gợi ý", nameEn: "Reconcile bank transactions", isSensitive: false },
  { code: "finance.bank.setup", appCode: "finance", nameVi: "Cài đặt kết nối ngân hàng", nameEn: "Set up bank connections", isSensitive: true },
  { code: "finance.collection.view", appCode: "finance", nameVi: "Xem bảng đối soát thu hộ", nameEn: "View collection statements", isSensitive: false },
  { code: "finance.collection.manage", appCode: "finance", nameVi: "Nhập, gửi bảng đối soát thu hộ", nameEn: "Manage collection statements", isSensitive: false },
  { code: "finance.collection.setup", appCode: "finance", nameVi: "Khai đơn vị thu hộ", nameEn: "Set up collectors", isSensitive: true },
  { code: "finance.consolidation.view", appCode: "finance", nameVi: "Xem báo cáo hợp nhất (phạm vi tập đoàn)", nameEn: "View consolidated statements", isSensitive: false },
  { code: "finance.consolidation.manage", appCode: "finance", nameVi: "Lập, gửi bảng hợp nhất (phạm vi tập đoàn)", nameEn: "Manage consolidation", isSensitive: true },
  { code: "inventory.sales.issue", appCode: "inventory", nameVi: "Xuất giao hàng, nhận hàng trả lại", nameEn: "Issue sales deliveries and receive returns", isSensitive: false },
  { code: "inventory.purchase.receive", appCode: "inventory", nameVi: "Nhập mua, trả hàng nhà cung cấp", nameEn: "Receive purchases and return to suppliers", isSensitive: false },
  // CONG_VIEC_46: Nhân sự phần 1 (MODULE_08). Dữ liệu cá nhân: mọi quyền là nhạy cảm.
  { code: "hr.employee.view", appCode: "hr", nameVi: "Xem hồ sơ nhân sự", nameEn: "View employee records", isSensitive: true },
  { code: "hr.employee.manage", appCode: "hr", nameVi: "Lập, sửa hồ sơ nhân sự, quá trình công tác, nghỉ việc", nameEn: "Manage employee records", isSensitive: true },
  { code: "hr.identity.view", appCode: "hr", nameVi: "Xem số giấy tờ, tài khoản ngân hàng, tải tệp giấy tờ", nameEn: "View identity numbers and documents", isSensitive: true },
  { code: "hr.contract.manage", appCode: "hr", nameVi: "Lập, gửi, ký, chấm dứt hợp đồng lao động; xem mức lương", nameEn: "Manage labour contracts", isSensitive: true },
  // CONG_VIEC_48: lương (MODULE_08 phần 3).
  { code: "hr.payroll.view", appCode: "hr", nameVi: "Xem bảng lương, phiếu lương", nameEn: "View payrolls and payslips", isSensitive: true },
  { code: "hr.payroll.manage", appCode: "hr", nameVi: "Lập, tính, gửi, ghi đã trả bảng lương; hồ sơ lương nhân viên", nameEn: "Manage payrolls", isSensitive: true },
  { code: "hr.payroll.setup", appCode: "hr", nameVi: "Thiết lập lương, loại phụ cấp; tham số pháp luật khi gán ở phạm vi tập đoàn", nameEn: "Set up payroll", isSensitive: true },
];

export const hrPermissions = ["hr.employee.view", "hr.employee.manage", "hr.identity.view", "hr.contract.manage", "hr.payroll.view", "hr.payroll.manage", "hr.payroll.setup"];

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
  "crm.visit.manage",
  "marketplace.buyer.view",
  "marketplace.buyer.manage",
  "marketplace.order.view",
  "marketplace.order.manage",
  "marketplace.payment.manage",
  "purchasing.price.manage",
  "purchasing.requisition.create",
  "purchasing.order.view",
  "purchasing.order.manage",
  "purchasing.settings.manage",
  "sales.order.view",
  "sales.order.manage",
  "sales.settings.manage",
  "sales.promotion.view",
  "sales.promotion.manage",
  "finance.debt.view",
  "finance.fund.manage",
  "finance.debt.manage",
  "finance.payment.manage",
  "finance.ledger.view",
  "finance.ledger.setup",
  "finance.journal.manage",
  "finance.period.close",
  "finance.einvoice.view",
  "finance.einvoice.manage",
  "finance.einvoice.setup",
  "finance.bank.view",
  "finance.bank.manage",
  "finance.bank.setup",
  "finance.collection.view",
  "finance.collection.manage",
  "finance.collection.setup",
  ...hrPermissions,
];

export const systemRoles: { code: string; nameVi: string; nameEn: string; permissionCodes: string[] }[] = [
  {
    code: "group_admin",
    nameVi: "Quản trị tập đoàn",
    nameEn: "Group administrator",
    // Quản trị tập đoàn: mọi quyền của Nền tảng, Sản phẩm (CONG_VIEC_04), Kho (CONG_VIEC_05), Đối tác (CONG_VIEC_06), Mua hàng (CONG_VIEC_07), Bán hàng (CONG_VIEC_08), Tài chính – Kế toán (CONG_VIEC_13), cộng quyền truy cập mọi mini app.
    permissionCodes: permissionCatalog
      .filter((permission) => ["platform", "catalog", "inventory", "crm", "purchasing", "sales", "finance", "hr"].includes(permission.appCode) || permission.code.endsWith(".access"))
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
  {
    code: "warehouse_keeper",
    nameVi: "Thủ kho",
    nameEn: "Warehouse keeper",
    permissionCodes: [
      "inventory.access",
      "inventory.stock.view",
      "inventory.document.manage",
      "inventory.purchase.receive",
      "inventory.sales.issue",
      "crm.partner.view",
      "purchasing.access",
      "purchasing.requisition.create",
      "purchasing.order.view",
      "sales.access",
      "sales.order.view",
    ],
  },
  { code: "warehouse_manager", nameVi: "Quản lý kho", nameEn: "Warehouse manager", permissionCodes: inventoryPermissions },
  {
    code: "purchaser",
    nameVi: "Nhân viên mua hàng",
    nameEn: "Purchaser",
    permissionCodes: [
      "purchasing.access",
      "purchasing.price.manage",
      "purchasing.requisition.create",
      "purchasing.order.view",
      "purchasing.order.manage",
      "crm.access",
      "crm.partner.view",
      "crm.partner.manage",
    ],
  },
  {
    code: "salesperson",
    nameVi: "Nhân viên bán hàng",
    nameEn: "Salesperson",
    permissionCodes: [
      // CONG_VIEC_43 (QUYTAC_NGHIEPVU_276): nhân viên bán hàng xem đơn bán, không lập đơn bán.
      "sales.access",
      "sales.order.view",
      "sales.promotion.view",
      "crm.access",
      "crm.partner.view",
      "crm.partner.manage",
      "catalog.access",
      "catalog.price.view",
      // CONG_VIEC_22: ghé thăm khách trên ứng dụng (THAY_DOI_13).
      "crm.visit.manage",
    ],
  },
  {
    code: "accountant",
    nameVi: "Kế toán",
    nameEn: "Accountant",
    permissionCodes: [
      "finance.access",
      "finance.debt.view",
      "finance.fund.manage",
      "finance.debt.manage",
      "finance.payment.manage",
      "finance.ledger.view",
      "finance.journal.manage",
      "finance.einvoice.view",
      "finance.einvoice.manage",
      "finance.bank.view",
      "finance.bank.manage",
      "finance.collection.view",
      "finance.collection.manage",
      "crm.access",
      "crm.partner.view",
      "marketplace.order.view",
      "marketplace.payment.manage",
      // CONG_VIEC_43 (QUYTAC_NGHIEPVU_276): kế toán lập đơn bán dịch vụ.
      "sales.access",
      "sales.order.view",
      "sales.order.manage",
    ],
  },
  {
    code: "chief_accountant",
    nameVi: "Kế toán trưởng",
    nameEn: "Chief accountant",
    permissionCodes: [
      "finance.access",
      "finance.debt.view",
      "finance.fund.manage",
      "finance.debt.manage",
      "finance.payment.manage",
      "finance.ledger.view",
      "finance.ledger.setup",
      "finance.journal.manage",
      "finance.period.close",
      "finance.einvoice.view",
      "finance.einvoice.manage",
      "finance.einvoice.setup",
      "finance.bank.view",
      "finance.bank.manage",
      "finance.bank.setup",
      "finance.collection.view",
      "finance.collection.manage",
      "finance.collection.setup",
      "finance.consolidation.view",
      "finance.consolidation.manage",
      "crm.access",
      "crm.partner.view",
      "marketplace.order.view",
      "marketplace.payment.manage",
      // CONG_VIEC_43 (QUYTAC_NGHIEPVU_276): kế toán lập đơn bán dịch vụ.
      "sales.access",
      "sales.order.view",
      "sales.order.manage",
      // CONG_VIEC_48: kế toán trưởng xem bảng lương để duyệt, đối chiếu bút toán.
      "hr.access",
      "hr.payroll.view",
    ],
  },
  { code: "partner_manager", nameVi: "Quản lý đối tác", nameEn: "Partner manager", permissionCodes: ["crm.access", "crm.partner.view", "crm.partner.manage"] },
  // CONG_VIEC_46 (tài liệu 08): gán ở phạm vi công ty.
  { code: "hr_manager", nameVi: "Quản lý nhân sự", nameEn: "HR manager", permissionCodes: ["hr.access", ...hrPermissions, "platform.proposal.create"] },
  {
    code: "hr_staff",
    nameVi: "Nhân viên nhân sự",
    nameEn: "HR staff",
    permissionCodes: ["hr.access", "hr.employee.view", "hr.employee.manage", "hr.contract.manage", "hr.payroll.view", "hr.payroll.manage"],
  },
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
  { code: "sales.promotion", appCode: "sales", nameVi: "Chương trình khuyến mãi", nameEn: "Promotion", requiresApproval: true },
  { code: "inventory.sales_issue", appCode: "inventory", nameVi: "Phiếu xuất giao hàng", nameEn: "Sales delivery", requiresApproval: false },
  { code: "inventory.sales_return", appCode: "inventory", nameVi: "Phiếu nhận hàng trả lại", nameEn: "Sales return", requiresApproval: false },
  { code: "finance.receipt", appCode: "finance", nameVi: "Phiếu thu", nameEn: "Cash receipt", requiresApproval: false },
  { code: "finance.payment", appCode: "finance", nameVi: "Phiếu chi", nameEn: "Cash payment", requiresApproval: true },
  { code: "accounting.journal", appCode: "finance", nameVi: "Phiếu kế toán", nameEn: "Manual journal", requiresApproval: true },
  { code: "finance.collection_statement", appCode: "finance", nameVi: "Bảng đối soát thu hộ", nameEn: "Collection statement", requiresApproval: true },
  { code: "finance.consolidation", appCode: "finance", nameVi: "Bảng hợp nhất", nameEn: "Consolidation", requiresApproval: true },
  // CONG_VIEC_46: mã nhân viên chỉ dùng dãy số; hợp đồng, phụ lục qua luồng duyệt.
  { code: "hr.employee", appCode: "hr", nameVi: "Mã nhân viên", nameEn: "Employee code", requiresApproval: false },
  { code: "hr.contract", appCode: "hr", nameVi: "Hợp đồng lao động", nameEn: "Labour contract", requiresApproval: true },
  { code: "hr.contract_appendix", appCode: "hr", nameVi: "Phụ lục hợp đồng lao động", nameEn: "Labour contract appendix", requiresApproval: true },
  // CONG_VIEC_48 (QUYTAC_NGHIEPVU_322).
  { code: "hr.payroll", appCode: "hr", nameVi: "Bảng lương", nameEn: "Payroll", requiresApproval: true },
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
      const existing = await transaction.execute<{ id: string }>(sql`SELECT id FROM core.roles WHERE company_id IS NULL AND code = ${role.code}`);
      let roleId = existing.rows[0]?.id;
      if (!roleId) {
        const inserted = await transaction.insert(roles).values({ code: role.code, nameVi: role.nameVi, nameEn: role.nameEn, isSystem: true, status: "active" }).returning({ id: roles.id });
        roleId = inserted[0]!.id;
      }
      await transaction.delete(rolePermissions).where(sql`${rolePermissions.roleId} = ${roleId}`);
      await transaction.insert(rolePermissions).values(role.permissionCodes.map((permissionCode) => ({ roleId: roleId!, permissionCode })));
    }
  });
}
