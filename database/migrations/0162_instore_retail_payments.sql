-- CONG_VIEC_73 lát L2: quầy cửa hàng tập đoàn nhận thanh toán qua ứng dụng VComm (QUYTAC_NGHIEPVU_573, 578 đến 580).

-- Công tắc nhận thanh toán qua ứng dụng và phí sàn của cửa hàng (MAN_HINH_166).
ALTER TABLE retail.stores
    ADD COLUMN app_payment_enabled  boolean      NOT NULL DEFAULT false,
    ADD COLUMN platform_fee_percent numeric(6,4) NOT NULL DEFAULT 0 CHECK (platform_fee_percent BETWEEN 0 AND 10);

-- Dòng thanh toán "Ứng dụng VComm": không vào quỹ của cửa hàng, không tính khi đóng ca.
ALTER TABLE retail.sale_payments DROP CONSTRAINT sale_payments_method_check;
ALTER TABLE retail.sale_payments ADD CONSTRAINT sale_payments_method_check CHECK (method IN ('cash', 'bank_transfer', 'points', 'vcomm_app'));
ALTER TABLE retail.sale_payments DROP CONSTRAINT sale_payments_check;
ALTER TABLE retail.sale_payments ADD CONSTRAINT sale_payments_check CHECK ((method IN ('points', 'vcomm_app')) = (fund_id IS NULL));
ALTER TABLE retail.sale_payments ADD COLUMN checkout_id uuid REFERENCES instore.checkouts(id);
ALTER TABLE retail.sale_payments ADD CONSTRAINT sale_payments_checkout_check CHECK ((method = 'vcomm_app') = (checkout_id IS NOT NULL));

-- Đơn chờ của quầy: dữ liệu để ghi hóa đơn bán lẻ khi cổng báo thành công; mã hóa đơn bán lẻ dành trước để trừ điểm ngay khi khách bấm thanh toán.
-- Đã thu tiền mà ghi sổ không được: trạng thái "Đã thu, lỗi ghi sổ" (QUYTAC_NGHIEPVU_580).
ALTER TABLE instore.checkouts
    ADD COLUMN sale_input       jsonb,
    ADD COLUMN reserved_sale_id uuid,
    ADD COLUMN paid_amount      numeric(18,4) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    ADD COLUMN paid_at          timestamptz,
    ADD COLUMN posting_error    text CHECK (posting_error IS NULL OR char_length(posting_error) <= 500);
ALTER TABLE instore.checkouts DROP CONSTRAINT checkouts_status_check;
ALTER TABLE instore.checkouts ADD CONSTRAINT checkouts_status_check
    CHECK (status IN ('awaiting_buyer', 'awaiting_payment', 'paid_unposted', 'completed', 'expired', 'cancelled', 'declined'));
ALTER TABLE instore.checkouts ADD CONSTRAINT checkouts_retail_sale_input CHECK (kind <> 'retail' OR sale_input IS NOT NULL);
CREATE UNIQUE INDEX checkouts_reserved_sale_idx ON instore.checkouts (reserved_sale_id) WHERE reserved_sale_id IS NOT NULL;
-- Đơn đã thu tiền nhưng chưa ghi sổ vẫn giữ quầy, chặn đóng ca.
DROP INDEX instore.checkouts_register_open_idx;
CREATE UNIQUE INDEX checkouts_register_open_idx ON instore.checkouts (register_id) WHERE register_id IS NOT NULL AND status IN ('awaiting_buyer', 'awaiting_payment', 'paid_unposted');
