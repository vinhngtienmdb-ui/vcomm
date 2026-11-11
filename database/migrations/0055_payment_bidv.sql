-- CONG_VIEC_37: cổng BIDV, thu hộ qua tài khoản định danh (QUYTAC_NGHIEPVU_245, 246).
-- Mã cổng tự đặt cho lần thanh toán khi số tham chiếu chung quá dài với cổng (BIDV: mã khách hàng tối đa 13 ký tự); duy nhất trong mỗi cổng.
ALTER TABLE marketplace.payments ADD COLUMN gateway_reference text CHECK (gateway_reference ~ '^[A-Za-z0-9]{1,30}$');
CREATE UNIQUE INDEX payments_gateway_reference_idx ON marketplace.payments (gateway_code, gateway_reference) WHERE gateway_reference IS NOT NULL;

INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES ('bidv_va_qr', 'bidv', 50, false) ON CONFLICT (code) DO NOTHING;
