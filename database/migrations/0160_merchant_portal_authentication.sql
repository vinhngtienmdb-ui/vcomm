-- CONG_VIEC_72 lát L1 (THAY_DOI_37): quyền chăm sóc khách hàng hủy Smart OTP (QUYTAC_NGHIEPVU_567); đặt lại xác thực cổng cửa hàng (QUYTAC_NGHIEPVU_570).
INSERT INTO core.permissions (code, app_code, name_vi, name_en, is_sensitive) VALUES
    ('marketplace.buyer.security', 'crm', 'Hủy Smart OTP của người mua', 'Revoke buyer Smart OTP', true)
ON CONFLICT (code) DO NOTHING;

-- Thành viên bị đặt lại xác thực: lần vào tới phải nhận mã SMS một lần, đặt mật khẩu mới, đăng ký ứng dụng xác thực mới.
ALTER TABLE affiliate.members ADD COLUMN authentication_reset_at timestamptz;
