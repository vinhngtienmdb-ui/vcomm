-- CONG_VIEC_43 lát L0 (THAY_DOI_18; QUYTAC_NGHIEPVU_278): xóa hẳn hoa hồng đội kinh doanh theo tiền thu của CONG_VIEC_17.
-- Hoa hồng theo đơn VComm (CONG_VIEC_26, schema marketplace, vai trò định khoản commission_expense, commission_payable) giữ nguyên.
-- Bút toán cũ nguồn 'commission' giữ nguyên trong sổ; ràng buộc journals_source_type_check vẫn nhận 'commission' để đọc sổ cũ.

-- Bảng dữ liệu hoa hồng cũ, theo thứ tự phụ thuộc (phát sinh và dòng bảng tham chiếu bảng hoa hồng tháng).
DROP TABLE finance.commission_events;
DROP TABLE finance.commission_statement_lines;
DROP TABLE finance.commission_statements;
DROP TABLE finance.commission_targets;
DROP TABLE finance.commission_channel_factors;
DROP TABLE finance.commission_rates;
DROP TABLE finance.commission_settings;

-- Nhân viên hưởng hoa hồng trên đơn bán.
ALTER TABLE sales.orders DROP COLUMN commission_user_id;

-- Định khoản phải trả người lao động chỉ bảng hoa hồng cũ dùng.
DELETE FROM accounting.posting_rules WHERE role = 'staff_payable';

-- Quyền hoa hồng cũ: gỡ khỏi mọi vai trò (kể cả vai trò công ty tự tạo) rồi xóa quyền.
DELETE FROM core.role_permissions WHERE permission_code LIKE 'finance.commission.%';
DELETE FROM core.permissions WHERE code LIKE 'finance.commission.%';

-- Loại chứng từ duyệt bảng hoa hồng: xóa yêu cầu duyệt (bước duyệt xóa theo), chính sách duyệt (cấp duyệt xóa theo), dãy số chứng từ rồi xóa loại chứng từ.
DELETE FROM core.approval_requests WHERE document_type_code = 'finance.commission';
DELETE FROM core.approval_policies WHERE document_type_code = 'finance.commission';
DELETE FROM core.number_sequences WHERE document_type_code = 'finance.commission';
DELETE FROM core.document_types WHERE code = 'finance.commission';
