-- CONG_VIEC_40: cổng Google Pay (người mua trả bằng thẻ trong Google Pay trên trang thanh toán ZaloPay). Mặc định tắt; bật khi có thông tin kết nối.
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES ('google_pay_card', 'google_pay', 80, false) ON CONFLICT (code) DO NOTHING;
