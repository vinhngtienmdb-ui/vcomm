-- CONG_VIEC_42: cổng ZaloPay (QUYTAC_NGHIEPVU_270). Phương thức mặc định tắt; quản trị bật sau khi có thông tin kết nối.
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES
  ('zalopay_wallet', 'zalopay', 100, false),
  ('zalopay_atm', 'zalopay', 101, false),
  ('zalopay_card', 'zalopay', 102, false)
ON CONFLICT (code) DO NOTHING;
