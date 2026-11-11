-- CONG_VIEC_34: cổng SePay, người mua chuyển khoản theo mã VietQR; mặc định tắt, quản trị bật khi đã khai báo biến môi trường SEPAY_*.
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES ('sepay_bank_transfer', 'sepay', 20, false) ON CONFLICT (code) DO NOTHING;
