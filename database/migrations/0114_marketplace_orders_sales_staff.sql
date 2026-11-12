-- CONG_VIEC_22 (THAY_DOI_26): nhân viên kinh doanh phụ trách khách lúc đặt đơn, căn cứ doanh số (QUYTAC_NGHIEPVU_439).
-- Chỉ thêm cột, chỉ mục; không định nghĩa lại ràng buộc kiểm tra của marketplace.orders (CONG_VIEC_57 định nghĩa lại orders_cod_amount_method_check).
ALTER TABLE marketplace.orders ADD COLUMN sales_staff_user_id uuid REFERENCES core.users(id);

-- Đơn đã có: lấy người hưởng phần nhân viên kinh doanh đã chốt lúc đặt (QUYTAC_NGHIEPVU_201); đơn không có hoa hồng thì để trống.
UPDATE marketplace.orders m SET sales_staff_user_id = c.beneficiary_user_id
FROM (SELECT DISTINCT ON (order_id) order_id, beneficiary_user_id FROM marketplace.order_commissions WHERE share = 'staff' ORDER BY order_id, created_at) c
WHERE c.order_id = m.id AND m.sales_staff_user_id IS NULL;
-- Đơn cũ không có dòng đó (sản phẩm chưa thiết lập hoặc mức bằng 0) để trống, không tính vào doanh số ai (quyết định của người dùng 2026-11-12).

CREATE INDEX marketplace_orders_sales_staff_completed_idx ON marketplace.orders (sales_staff_user_id, completed_at) WHERE status = 'completed';
CREATE INDEX marketplace_orders_sales_staff_open_idx ON marketplace.orders (sales_staff_user_id) WHERE status NOT IN ('completed', 'cancelled');
