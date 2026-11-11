-- CONG_VIEC_41: phương thức Apple Pay qua trang thanh toán ZaloPay (cổng apple_pay); mặc định tắt, quản trị bật khi đã có thông tin kết nối ZaloPay.
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES ('apple_pay_wallet', 'apple_pay', 90, false) ON CONFLICT (code) DO NOTHING;
