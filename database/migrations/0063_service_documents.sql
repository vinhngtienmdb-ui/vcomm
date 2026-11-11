-- CONG_VIEC_43 lát L3 (QUYTAC_NGHIEPVU_275 đến 277; quyết định người dùng 2026-11-11): phiếu kho dịch vụ do hệ thống tự lập khi đơn xác nhận.
-- Phiếu dịch vụ (phiếu xuất giao hàng, phiếu nhập mua) không ghi thẻ kho, tồn, giá vốn; chạy công nợ, hóa đơn điện tử, bút toán như phiếu ghi sổ.
ALTER TABLE inventory.documents ADD COLUMN is_service boolean NOT NULL DEFAULT false;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_service_type_check CHECK (NOT is_service OR type IN ('sales_issue', 'purchase_receipt'));

-- Định khoản chi phí dịch vụ mua vào: chi phí quản lý doanh nghiệp (6427 theo TT99, 6422 theo TT133) cho công ty đã khởi tạo kế toán; kế toán đổi được.
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, 'service_expense', a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN '6422' ELSE '6427' END
ON CONFLICT DO NOTHING;
