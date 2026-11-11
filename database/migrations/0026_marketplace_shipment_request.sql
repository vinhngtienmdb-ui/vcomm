-- CONG_VIEC_24 (sửa sau rà soát): ghi nhận yêu cầu tạo vận đơn trước khi gọi đơn vị vận chuyển.
-- Vận đơn "requesting" chưa có mã vận đơn; chỉ mục vận đơn hoạt động duy nhất mỗi đơn chặn giao trùng.
ALTER TABLE marketplace.shipments ALTER COLUMN tracking_code DROP NOT NULL;
ALTER TABLE marketplace.shipments ADD CONSTRAINT shipments_tracking_check CHECK (tracking_code IS NOT NULL OR carrier_status = 'requesting');
