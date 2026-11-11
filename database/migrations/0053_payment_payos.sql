-- CONG_VIEC_35: cổng PayOS. PayOS chỉ nhận mã đơn dạng số nguyên, lưu mã này cùng lần thanh toán để đối chiếu kết quả gửi về (QUYTAC_NGHIEPVU_235).
ALTER TABLE marketplace.payments ADD COLUMN gateway_order_code text;
CREATE UNIQUE INDEX payments_gateway_order_code_key ON marketplace.payments (gateway_code, gateway_order_code) WHERE gateway_order_code IS NOT NULL;
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES ('payos_vietqr', 'payos', 30, false) ON CONFLICT (code) DO NOTHING;
