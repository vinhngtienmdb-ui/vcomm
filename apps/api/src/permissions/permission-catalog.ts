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
  accessPermission("retail", "Bán lẻ", "Retail"),
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
  // CONG_VIEC_61: Open API cho đối tác (MODULE_16).
  { code: "platform.api_key.manage", appCode: "platform", nameVi: "Cấp, sửa, thu hồi khóa API đối tác", nameEn: "Manage partner API keys", isSensitive: true },
  { code: "platform.api_log.view", appCode: "platform", nameVi: "Xem nhật ký gọi API đối tác", nameEn: "View partner API call log", isSensitive: false },
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
  // QUYTAC_NGHIEPVU_283: chỉ cộng số đếm khi đợt đang đếm (CONG_VIEC_44).
  { code: "inventory.stocktake.count", appCode: "inventory", nameVi: "Đếm kiểm kê", nameEn: "Count stocktakes", isSensitive: false },
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
  // CONG_VIEC_51: điểm thưởng (xét tại công ty vận hành sàn).
  { code: "loyalty.view", appCode: "crm", nameVi: "Xem chương trình điểm, ví điểm, nghĩa vụ điểm", nameEn: "View loyalty program, point accounts and liability", isSensitive: false },
  {
    code: "loyalty.manage",
    appCode: "crm",
    nameVi: "Cài chương trình điểm, khóa ví điểm, lập phiếu điều chỉnh điểm",
    nameEn: "Manage loyalty program, lock point accounts, adjust points",
    isSensitive: true,
  },
  // CONG_VIEC_55: cửa hàng liên kết (xét tại công ty vận hành sàn).
  { code: "affiliate.view", appCode: "crm", nameVi: "Xem cửa hàng liên kết, giao dịch, voucher, đối soát", nameEn: "View affiliate stores, transactions, vouchers, settlements", isSensitive: false },
  {
    code: "affiliate.manage",
    appCode: "crm",
    nameVi: "Quản lý hợp đồng cửa hàng liên kết, voucher VComm, trả lời khiếu nại đối soát",
    nameEn: "Manage affiliate contracts, VComm vouchers and settlement disputes",
    isSensitive: true,
  },
  // CONG_VIEC_49: kiểm duyệt bảng tin cộng đồng, đăng bài VComm (QUYTAC_NGHIEPVU_335).
  { code: "marketplace.community.manage", appCode: "crm", nameVi: "Kiểm duyệt bảng tin cộng đồng, đăng bài VComm", nameEn: "Moderate the community feed, post as VComm", isSensitive: true },
  // CONG_VIEC_07: Mua hàng trong nước (MODULE_04, phần 1).
  { code: "purchasing.price.manage", appCode: "purchasing", nameVi: "Quản lý bảng giá mua", nameEn: "Manage supplier prices", isSensitive: false },
  { code: "purchasing.requisition.create", appCode: "purchasing", nameVi: "Lập đề nghị mua", nameEn: "Create purchase requisitions", isSensitive: false },
  { code: "purchasing.order.view", appCode: "purchasing", nameVi: "Xem đơn mua", nameEn: "View purchase orders", isSensitive: false },
  { code: "purchasing.order.manage", appCode: "purchasing", nameVi: "Lập, sửa, đóng đơn mua", nameEn: "Manage purchase orders", isSensitive: false },
  { code: "purchasing.settings.manage", appCode: "purchasing", nameVi: "Cài đặt mua hàng", nameEn: "Manage purchasing settings", isSensitive: false },
  // CONG_VIEC_45: tờ khai, chi phí nhập khẩu.
  { code: "purchasing.import.view", appCode: "purchasing", nameVi: "Xem tờ khai, chi phí nhập khẩu", nameEn: "View import declarations and landed costs", isSensitive: false },
  { code: "purchasing.import.manage", appCode: "purchasing", nameVi: "Lập, ghi sổ tờ khai, chi phí nhập khẩu", nameEn: "Manage import declarations and landed costs", isSensitive: false },
  // CONG_VIEC_58 (QUYTAC_NGHIEPVU_453).
  { code: "purchasing.budget.view", appCode: "purchasing", nameVi: "Xem ngân sách mua", nameEn: "View purchase budgets", isSensitive: false },
  { code: "purchasing.budget.manage", appCode: "purchasing", nameVi: "Lập, điều chỉnh ngân sách mua", nameEn: "Manage purchase budgets", isSensitive: false },
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
  // CONG_VIEC_53: mini app Bán lẻ (MODULE_14).
  { code: "retail.sale", appCode: "retail", nameVi: "Mở ca, bán hàng tại quầy, đóng ca của mình", nameEn: "Open shifts, sell at the counter, close own shifts", isSensitive: false },
  { code: "retail.return", appCode: "retail", nameVi: "Trả hàng theo hóa đơn bán lẻ", nameEn: "Process retail returns", isSensitive: false },
  { code: "retail.shift.manage", appCode: "retail", nameVi: "Xem mọi ca, đóng ca của người khác", nameEn: "View all shifts and close shifts of others", isSensitive: false },
  { code: "retail.setup", appCode: "retail", nameVi: "Cài đặt cửa hàng, quầy", nameEn: "Set up stores and registers", isSensitive: false },
  // CONG_VIEC_57: đơn trực tuyến tại trạm giao hàng O2O.
  { code: "retail.o2o", appCode: "retail", nameVi: "Xử lý đơn trực tuyến tại trạm", nameEn: "Handle online orders at stations", isSensitive: false },
  { code: "retail.o2o.deliver", appCode: "retail", nameVi: "Giao đơn trực tuyến tận nơi từ trạm", nameEn: "Deliver online orders from stations", isSensitive: false },
  // CONG_VIEC_46: Nhân sự phần 1 (MODULE_08). Dữ liệu cá nhân: mọi quyền là nhạy cảm.
  { code: "hr.employee.view", appCode: "hr", nameVi: "Xem hồ sơ nhân sự", nameEn: "View employee records", isSensitive: true },
  { code: "hr.employee.manage", appCode: "hr", nameVi: "Lập, sửa hồ sơ nhân sự, quá trình công tác, nghỉ việc", nameEn: "Manage employee records", isSensitive: true },
  { code: "hr.identity.view", appCode: "hr", nameVi: "Xem số giấy tờ, tài khoản ngân hàng, tải tệp giấy tờ", nameEn: "View identity numbers and documents", isSensitive: true },
  { code: "hr.contract.manage", appCode: "hr", nameVi: "Lập, gửi, ký, chấm dứt hợp đồng lao động; xem mức lương", nameEn: "Manage labour contracts", isSensitive: true },
  // CONG_VIEC_47: Nhân sự phần 2 – ca làm, chấm công, nghỉ phép, tăng ca, bảng công.
  { code: "hr.attendance.view", appCode: "hr", nameVi: "Xem chấm công, đơn nghỉ, tăng ca, bảng công", nameEn: "View attendance", isSensitive: false },
  { code: "hr.attendance.manage", appCode: "hr", nameVi: "Ca làm, lịch, xếp ca, ngày lễ, địa điểm chấm công, nhập và ghi công", nameEn: "Manage attendance", isSensitive: true },
  { code: "hr.leave.manage", appCode: "hr", nameVi: "Loại nghỉ, sổ phép, ghi nhận và hủy đơn nghỉ", nameEn: "Manage leave", isSensitive: true },
  { code: "hr.timesheet.manage", appCode: "hr", nameVi: "Mở xác nhận, chốt, mở lại bảng công tháng", nameEn: "Manage monthly timesheets", isSensitive: true },
  // CONG_VIEC_48: lương (MODULE_08 phần 3).
  { code: "hr.payroll.view", appCode: "hr", nameVi: "Xem bảng lương, phiếu lương", nameEn: "View payrolls and payslips", isSensitive: true },
  { code: "hr.payroll.manage", appCode: "hr", nameVi: "Lập, tính, gửi, ghi đã trả bảng lương; hồ sơ lương nhân viên", nameEn: "Manage payrolls", isSensitive: true },
  { code: "hr.payroll.setup", appCode: "hr", nameVi: "Thiết lập lương, loại phụ cấp; tham số pháp luật khi gán ở phạm vi tập đoàn", nameEn: "Set up payroll", isSensitive: true },
  // CONG_VIEC_50 (QUYTAC_NGHIEPVU_336): phạm vi tập đoàn xem mọi công ty của tập đoàn, phạm vi công ty xem công ty đó.
  accessPermission("analytics", "Báo cáo quản trị", "Management reports"),
  { code: "analytics.sales.view", appCode: "analytics", nameVi: "Xem báo cáo bán hàng", nameEn: "View sales reports", isSensitive: false },
  { code: "analytics.inventory.view", appCode: "analytics", nameVi: "Xem báo cáo tồn kho và luân chuyển", nameEn: "View inventory reports", isSensitive: false },
  { code: "analytics.debt.view", appCode: "analytics", nameVi: "Xem báo cáo công nợ", nameEn: "View debt reports", isSensitive: true },
  { code: "analytics.commission.view", appCode: "analytics", nameVi: "Xem báo cáo hoa hồng và ví", nameEn: "View commission and wallet reports", isSensitive: true },
  // CONG_VIEC_54: tuyển dụng, đánh giá hiệu suất (tài liệu 08).
  { code: "hr.recruitment.request", appCode: "hr", nameVi: "Lập, gửi nhu cầu tuyển dụng", nameEn: "Request recruitment", isSensitive: false },
  { code: "hr.recruitment.manage", appCode: "hr", nameVi: "Quản lý tin tuyển dụng, ứng viên, phỏng vấn, đề nghị nhận việc", nameEn: "Manage recruitment and candidates", isSensitive: true },
  { code: "hr.review.manage", appCode: "hr", nameVi: "Quản lý kỳ đánh giá hiệu suất, hiệu chỉnh, công bố kết quả", nameEn: "Manage performance reviews", isSensitive: true },
  // CONG_VIEC_52: mini app Văn phòng số (MODULE_13).
  accessPermission("office", "Văn phòng số", "Digital Office"),
  { code: "office.task.view_all", appCode: "office", nameVi: "Xem mọi công việc, quy trình của công ty", nameEn: "View all company tasks and workflows", isSensitive: false },
  { code: "office.workflow.manage", appCode: "office", nameVi: "Thiết kế, quản lý quy trình", nameEn: "Manage workflow templates and runs", isSensitive: false },
  { code: "office.document.clerk", appCode: "office", nameVi: "Văn thư: sổ, vào sổ, cấp số, phát hành công văn", nameEn: "Records clerk", isSensitive: true },
  { code: "office.document.direct", appCode: "office", nameVi: "Cho ý kiến, giao xử lý công văn đến", nameEn: "Direct incoming documents", isSensitive: false },
  { code: "office.document.draft", appCode: "office", nameVi: "Soạn, trình ký công văn đi", nameEn: "Draft outgoing documents", isSensitive: false },
  { code: "office.document.view_all", appCode: "office", nameVi: "Xem mọi công văn của công ty", nameEn: "View all company documents", isSensitive: true },
  { code: "office.bulletin.post", appCode: "office", nameVi: "Đăng tin bảng tin nội bộ", nameEn: "Post bulletin news", isSensitive: false },
  // CONG_VIEC_59: ký số (tài liệu cong_viec/CONG_VIEC_59.md mục 6).
  { code: "office.signing.use", appCode: "office", nameVi: "Trình ký tài liệu, kiểm tra chữ ký số", nameEn: "Request signatures and verify signed files", isSensitive: false },
  { code: "office.signing.company_seal", appCode: "office", nameVi: "Đóng chữ ký số của công ty", nameEn: "Apply the company digital seal", isSensitive: true },
  { code: "office.signing.manage", appCode: "office", nameVi: "Cài đặt nhà cung cấp ký số, chữ ký số công ty, chứng thư gốc tin cậy", nameEn: "Manage digital signing settings", isSensitive: true },
  { code: "office.contract.create", appCode: "office", nameVi: "Lập, nhập hợp đồng, phụ lục", nameEn: "Create and import contracts", isSensitive: false },
  { code: "office.contract.view_all", appCode: "office", nameVi: "Xem mọi hợp đồng không mật của công ty", nameEn: "View all non-confidential contracts", isSensitive: true },
  {
    code: "office.contract.manage",
    appCode: "office",
    nameVi: "Quản lý kho hợp đồng: loại hợp đồng, người phụ trách, thanh lý, chấm dứt",
    nameEn: "Manage the contract repository",
    isSensitive: true,
  },
];

const attendancePermissions = ["hr.attendance.view", "hr.attendance.manage", "hr.leave.manage", "hr.timesheet.manage"];
export const hrPermissions = ["hr.employee.view", "hr.employee.manage", "hr.identity.view", "hr.contract.manage", ...attendancePermissions, "hr.payroll.view", "hr.payroll.manage", "hr.payroll.setup"];
const analyticsPermissions = permissionCatalog.filter((permission) => permission.appCode === "analytics").map((permission) => permission.code);

export const hrRecruitmentPermissions = ["hr.recruitment.request", "hr.recruitment.manage", "hr.review.manage"];
// Quyền Văn phòng số của nhân viên và quản trị (CONG_VIEC_52 mục 6).
const officeEmployeePermissions = ["office.access", "office.document.draft", "office.signing.use"];
const officePermissions = permissionCatalog.filter((permission) => permission.appCode === "office").map((permission) => permission.code);

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
  "platform.api_key.manage",
  "platform.api_log.view",
  ...analyticsPermissions.filter((code) => code !== "analytics.access"),
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
  "loyalty.view",
  "loyalty.manage",
  "affiliate.view",
  "affiliate.manage",
  "marketplace.community.manage",
  "purchasing.price.manage",
  "purchasing.requisition.create",
  "purchasing.order.view",
  "purchasing.order.manage",
  "purchasing.settings.manage",
  "purchasing.import.view",
  "purchasing.import.manage",
  "purchasing.budget.view",
  "purchasing.budget.manage",
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
  "retail.sale",
  "retail.return",
  "retail.shift.manage",
  "retail.setup",
  "retail.o2o",
  "retail.o2o.deliver",
  ...hrPermissions,
  ...hrRecruitmentPermissions,
];

export const systemRoles: { code: string; nameVi: string; nameEn: string; permissionCodes: string[] }[] = [
  {
    code: "group_admin",
    nameVi: "Quản trị tập đoàn",
    nameEn: "Group administrator",
    // Quản trị tập đoàn: mọi quyền của Nền tảng, Sản phẩm (CONG_VIEC_04), Kho (CONG_VIEC_05), Đối tác (CONG_VIEC_06), Mua hàng (CONG_VIEC_07), Bán hàng (CONG_VIEC_08), Tài chính – Kế toán (CONG_VIEC_13), Bán lẻ (CONG_VIEC_53), cộng quyền truy cập mọi mini app.
    permissionCodes: permissionCatalog
      .filter(
        (permission) =>
          ["platform", "catalog", "inventory", "crm", "purchasing", "sales", "finance", "hr", "analytics", "retail", "office"].includes(permission.appCode) || permission.code.endsWith(".access"),
      )
      .map((permission) => permission.code),
  },
  { code: "company_admin", nameVi: "Quản trị công ty", nameEn: "Company administrator", permissionCodes: [...new Set([...companyAdminPermissions, ...officePermissions])] },
  { code: "exchange_rate_manager", nameVi: "Quản lý tỷ giá", nameEn: "Exchange rate manager", permissionCodes: ["platform.access", "platform.exchange_rate.manage"] },
  { code: "employee", nameVi: "Nhân viên", nameEn: "Employee", permissionCodes: [...employeePermissions, ...officeEmployeePermissions] },
  {
    code: "office_contract_admin",
    nameVi: "Quản lý hợp đồng",
    nameEn: "Contract administrator",
    permissionCodes: [...employeePermissions, "office.access", "office.signing.use", "office.contract.create", "office.contract.view_all", "office.contract.manage"],
  },
  {
    code: "office_clerk",
    nameVi: "Văn thư",
    nameEn: "Records clerk",
    permissionCodes: [
      ...employeePermissions,
      "office.access",
      "office.document.clerk",
      "office.document.draft",
      "office.document.view_all",
      "office.bulletin.post",
      "office.signing.use",
      "office.signing.company_seal",
    ],
  },
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
      "inventory.stocktake.count",
      "crm.partner.view",
      "purchasing.access",
      "purchasing.requisition.create",
      "purchasing.order.view",
      "sales.access",
      "sales.order.view",
    ],
  },
  { code: "warehouse_manager", nameVi: "Quản lý kho", nameEn: "Warehouse manager", permissionCodes: [...inventoryPermissions, "analytics.access", "analytics.inventory.view"] },
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
      "purchasing.import.view",
      "purchasing.import.manage",
      "purchasing.budget.view",
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
      // CONG_VIEC_45: tờ khai, chi phí nhập khẩu ở mini app Mua hàng.
      "purchasing.access",
      "purchasing.import.view",
      "purchasing.import.manage",
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
      // CONG_VIEC_53: xem ca thu ngân, đối chiếu tiền.
      "retail.access",
      "retail.shift.manage",
      // CONG_VIEC_50: báo cáo công nợ, hoa hồng và ví.
      "analytics.access",
      "analytics.debt.view",
      "analytics.commission.view",
    ],
  },
  {
    code: "chief_accountant",
    nameVi: "Kế toán trưởng",
    nameEn: "Chief accountant",
    permissionCodes: [
      // CONG_VIEC_45: tờ khai, chi phí nhập khẩu ở mini app Mua hàng.
      "purchasing.access",
      "purchasing.import.view",
      "purchasing.import.manage",
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
      // CONG_VIEC_53: xem ca thu ngân, đối chiếu tiền.
      "retail.access",
      "retail.shift.manage",
      // CONG_VIEC_48: kế toán trưởng xem bảng lương để duyệt, đối chiếu bút toán.
      "hr.access",
      "hr.payroll.view",
      // CONG_VIEC_50: mọi báo cáo quản trị.
      ...analyticsPermissions,
    ],
  },
  // CONG_VIEC_53: vai trò tại cửa hàng bán lẻ, thường gán ở phạm vi chi nhánh của cửa hàng.
  { code: "cashier", nameVi: "Thu ngân", nameEn: "Cashier", permissionCodes: ["retail.access", "retail.sale", "retail.o2o"] },
  {
    code: "store_manager",
    nameVi: "Cửa hàng trưởng",
    nameEn: "Store manager",
    permissionCodes: ["retail.access", "retail.sale", "retail.return", "retail.shift.manage", "retail.o2o", "retail.o2o.deliver"],
  },
  // CONG_VIEC_57: chỉ giao đơn trực tuyến, mở ca giữ tiền thu khi giao, không bán tại quầy.
  { code: "station_courier", nameVi: "Nhân viên giao hàng trạm", nameEn: "Station courier", permissionCodes: ["retail.access", "retail.o2o.deliver"] },
  { code: "partner_manager", nameVi: "Quản lý đối tác", nameEn: "Partner manager", permissionCodes: ["crm.access", "crm.partner.view", "crm.partner.manage"] },
  // CONG_VIEC_46 (tài liệu 08): gán ở phạm vi công ty.
  { code: "hr_manager", nameVi: "Quản lý nhân sự", nameEn: "HR manager", permissionCodes: ["hr.access", ...hrPermissions, ...hrRecruitmentPermissions, "platform.proposal.create"] },
  {
    code: "hr_staff",
    nameVi: "Nhân viên nhân sự",
    nameEn: "HR staff",
    permissionCodes: [
      "hr.access",
      "hr.employee.view",
      "hr.employee.manage",
      "hr.contract.manage",
      ...attendancePermissions,
      "hr.payroll.view",
      "hr.payroll.manage",
      "hr.recruitment.request",
      "hr.recruitment.manage",
      "hr.review.manage",
    ],
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
  // CONG_VIEC_45: chứng từ chi phí nhập khẩu có hóa đơn gốc, không đi luồng duyệt; chỉ dùng dãy số.
  { code: "purchasing.landed_cost", appCode: "purchasing", nameVi: "Chứng từ chi phí nhập khẩu", nameEn: "Landed cost", requiresApproval: false },
  // CONG_VIEC_58 (QUYTAC_NGHIEPVU_445, 448, 452).
  { code: "purchasing.budget_plan", appCode: "purchasing", nameVi: "Kế hoạch ngân sách mua", nameEn: "Purchase budget plan", requiresApproval: true },
  { code: "purchasing.budget_adjustment", appCode: "purchasing", nameVi: "Điều chỉnh ngân sách mua", nameEn: "Purchase budget adjustment", requiresApproval: true },
  { code: "purchasing.order_over_budget", appCode: "purchasing", nameVi: "Đơn mua vượt ngân sách", nameEn: "Over-budget purchase order", requiresApproval: true },
  { code: "sales.order", appCode: "sales", nameVi: "Đơn bán", nameEn: "Sales order", requiresApproval: true },
  { code: "sales.promotion", appCode: "sales", nameVi: "Chương trình khuyến mãi", nameEn: "Promotion", requiresApproval: true },
  { code: "inventory.sales_issue", appCode: "inventory", nameVi: "Phiếu xuất giao hàng", nameEn: "Sales delivery", requiresApproval: false },
  { code: "inventory.sales_return", appCode: "inventory", nameVi: "Phiếu nhận hàng trả lại", nameEn: "Sales return", requiresApproval: false },
  { code: "finance.receipt", appCode: "finance", nameVi: "Phiếu thu", nameEn: "Cash receipt", requiresApproval: false },
  { code: "finance.payment", appCode: "finance", nameVi: "Phiếu chi", nameEn: "Cash payment", requiresApproval: true },
  // CONG_VIEC_56: dãy số phiếu mua ngoại tệ (tiền tố MNT); duyệt theo chính sách phiếu chi.
  { code: "finance.currency_purchase", appCode: "finance", nameVi: "Phiếu mua ngoại tệ", nameEn: "Currency purchase", requiresApproval: false },
  { code: "accounting.fx_revaluation", appCode: "finance", nameVi: "Chứng từ đánh giá lại ngoại tệ", nameEn: "Foreign currency revaluation", requiresApproval: false },
  { code: "accounting.journal", appCode: "finance", nameVi: "Phiếu kế toán", nameEn: "Manual journal", requiresApproval: true },
  { code: "finance.collection_statement", appCode: "finance", nameVi: "Bảng đối soát thu hộ", nameEn: "Collection statement", requiresApproval: true },
  { code: "finance.consolidation", appCode: "finance", nameVi: "Bảng hợp nhất", nameEn: "Consolidation", requiresApproval: true },
  // CONG_VIEC_51: phiếu điều chỉnh điểm thưởng (QUYTAC_NGHIEPVU_353).
  { code: "loyalty.adjustment", appCode: "crm", nameVi: "Phiếu điều chỉnh điểm thưởng", nameEn: "Loyalty points adjustment", requiresApproval: true },
  // CONG_VIEC_55: voucher liên kết (QUYTAC_NGHIEPVU_401).
  { code: "affiliate.voucher", appCode: "crm", nameVi: "Voucher cửa hàng liên kết", nameEn: "Affiliate voucher", requiresApproval: true },
  { code: "retail.sale", appCode: "retail", nameVi: "Hóa đơn bán lẻ", nameEn: "Retail sale", requiresApproval: false },
  { code: "retail.return", appCode: "retail", nameVi: "Phiếu trả hàng bán lẻ", nameEn: "Retail return", requiresApproval: false },
  // CONG_VIEC_46: mã nhân viên chỉ dùng dãy số; hợp đồng, phụ lục qua luồng duyệt.
  { code: "hr.employee", appCode: "hr", nameVi: "Mã nhân viên", nameEn: "Employee code", requiresApproval: false },
  { code: "hr.contract", appCode: "hr", nameVi: "Hợp đồng lao động", nameEn: "Labour contract", requiresApproval: true },
  { code: "hr.contract_appendix", appCode: "hr", nameVi: "Phụ lục hợp đồng lao động", nameEn: "Labour contract appendix", requiresApproval: true },
  // CONG_VIEC_47: giá trị duyệt là số ngày nghỉ, số giờ tăng ca, 1 với đơn giải trình.
  { code: "hr.leave_request", appCode: "hr", nameVi: "Đơn nghỉ", nameEn: "Leave request", requiresApproval: true },
  { code: "hr.overtime_request", appCode: "hr", nameVi: "Phiếu tăng ca", nameEn: "Overtime request", requiresApproval: true },
  { code: "hr.attendance_correction", appCode: "hr", nameVi: "Đơn giải trình công", nameEn: "Attendance correction", requiresApproval: true },
  // CONG_VIEC_48 (QUYTAC_NGHIEPVU_322).
  { code: "hr.payroll", appCode: "hr", nameVi: "Bảng lương", nameEn: "Payroll", requiresApproval: true },
  // CONG_VIEC_54: nhu cầu tuyển dụng, đề nghị nhận việc qua luồng duyệt.
  { code: "hr.recruitment_request", appCode: "hr", nameVi: "Nhu cầu tuyển dụng", nameEn: "Recruitment request", requiresApproval: true },
  { code: "hr.job_offer", appCode: "hr", nameVi: "Đề nghị nhận việc", nameEn: "Job offer", requiresApproval: true },
  { code: "office.outgoing_document", appCode: "office", nameVi: "Công văn đi", nameEn: "Outgoing document", requiresApproval: true },
  { code: "office.workflow_run", appCode: "office", nameVi: "Phiên quy trình", nameEn: "Workflow run", requiresApproval: false },
  { code: "office.signing_request", appCode: "office", nameVi: "Phiên ký", nameEn: "Signing request", requiresApproval: false },
  { code: "office.contract", appCode: "office", nameVi: "Hợp đồng", nameEn: "Contract", requiresApproval: true },
  { code: "office.contract_appendix", appCode: "office", nameVi: "Phụ lục hợp đồng", nameEn: "Contract appendix", requiresApproval: true },
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
