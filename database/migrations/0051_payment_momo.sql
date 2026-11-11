-- CONG_VIEC_33: phương thức của cổng MoMo (QUYTAC_NGHIEPVU_225): ví MoMo, thẻ ATM nội địa, thẻ quốc tế qua MoMo; mặc định tắt.
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES
    ('momo_wallet', 'momo', 10, false),
    ('momo_atm', 'momo', 11, false),
    ('momo_card', 'momo', 12, false)
ON CONFLICT (code) DO NOTHING;
