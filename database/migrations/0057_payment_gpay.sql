-- CONG_VIEC_39: phương thức của cổng G-Pay (QUYTAC_NGHIEPVU_255), mặc định tắt; chủ cửa hàng bật khi đã có thông tin kết nối.
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES
  ('gpay_atm', 'gpay', 70, false),
  ('gpay_international', 'gpay', 71, false),
  ('gpay_va', 'gpay', 72, false)
ON CONFLICT (code) DO NOTHING;
