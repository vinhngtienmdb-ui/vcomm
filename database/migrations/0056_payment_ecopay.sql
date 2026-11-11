-- CONG_VIEC_38: phương thức thanh toán của cổng Ecopay (Finviet), mặc định tắt (QUYTAC_NGHIEPVU_250).
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES
  ('ecopay_wallet', 'ecopay', 60, false),
  ('ecopay_atm', 'ecopay', 61, false)
ON CONFLICT (code) DO NOTHING;
