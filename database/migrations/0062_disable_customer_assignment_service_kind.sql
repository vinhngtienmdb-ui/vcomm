-- CONG_VIEC_43 (THAY_DOI_18). Một tệp cho lát L1 và L2.

-- Lát L1 (QUYTAC_NGHIEPVU_279): tắt giao khách, bỏ phạm vi xem theo nhân viên phụ trách.
-- Giữ bảng crm.customer_assignments, crm.customer_assignment_lines, crm.partner_owner_history và cột crm.partner_profiles.owner_user_id (dữ liệu cũ để tra cứu).

-- Quyền xem mọi khách, giao khách: gỡ khỏi mọi vai trò (kể cả vai trò công ty tự tạo, vì quyền không còn tồn tại) rồi xóa quyền.
DELETE FROM core.role_permissions WHERE permission_code IN ('crm.customer.view_all', 'crm.customer.assign');
DELETE FROM core.permissions WHERE code IN ('crm.customer.view_all', 'crm.customer.assign');

-- Loại chứng từ phiếu giao khách: xóa yêu cầu duyệt (bước duyệt xóa theo), chính sách duyệt (cấp duyệt xóa theo), dãy số chứng từ rồi xóa loại chứng từ.
-- Cột crm.customer_assignments.approval_request_id không có khóa ngoại: phiếu cũ giữ nguyên.
DELETE FROM core.approval_requests WHERE document_type_code = 'crm.customer_assignment';
DELETE FROM core.approval_policies WHERE document_type_code = 'crm.customer_assignment';
DELETE FROM core.number_sequences WHERE document_type_code = 'crm.customer_assignment';
DELETE FROM core.document_types WHERE code = 'crm.customer_assignment';

-- Quyền đơn bán của vai trò hệ thống (QUYTAC_NGHIEPVU_276). Chỉ vai trò hệ thống (company_id IS NULL); vai trò công ty tự tạo giữ nguyên.
-- Đồng bộ danh mục quyền lúc khởi động (syncPermissionCatalog) cũng ghi lại đúng các quyền này; đặt ở đây để cơ sở dữ liệu đúng ngay sau database migration.
DELETE FROM core.role_permissions
WHERE permission_code = 'sales.order.manage' AND role_id IN (SELECT id FROM core.roles WHERE company_id IS NULL AND code = 'salesperson');
INSERT INTO core.role_permissions (role_id, permission_code)
SELECT r.id, p.code FROM core.roles r CROSS JOIN core.permissions p
WHERE r.company_id IS NULL AND r.code IN ('accountant', 'chief_accountant') AND p.code IN ('sales.access', 'sales.order.view', 'sales.order.manage')
ON CONFLICT DO NOTHING;

-- Lát L2 (QUYTAC_NGHIEPVU_275, 276): loại sản phẩm; cài đặt cho phép lập đơn bán tay có hàng hóa.
-- Sản phẩm đã có giữ loại Hàng hóa (mặc định).
ALTER TABLE catalog.products ADD COLUMN kind text NOT NULL DEFAULT 'goods' CHECK (kind IN ('goods', 'service'));
-- Dịch vụ không theo dõi lô, số serial.
ALTER TABLE catalog.products ADD CONSTRAINT products_service_untracked_check CHECK (kind = 'goods' OR (NOT tracks_lots AND NOT tracks_serials));
-- Mặc định tắt: đơn bán lập tay chỉ gồm dịch vụ (quyết định người dùng 2026-11-11).
ALTER TABLE sales.settings ADD COLUMN allow_manual_goods_orders boolean NOT NULL DEFAULT false;
