-- CONG_VIEC_72 lát L1 (THAY_DOI_37): Smart OTP thành cách xác thực chung của tài khoản (đăng nhập thiết bị mới, quên mật khẩu, giao dịch điểm)
-- nên bảng chuyển từ schema `loyalty` sang `core`; phần xác thực không ghi vào schema của mini app khác (tài liệu 12 mục 2). Giữ nguyên dữ liệu.
ALTER TABLE loyalty.smart_otp_devices SET SCHEMA core;

-- Nền tảng của máy giữ Smart OTP (QUYTAC_NGHIEPVU_562): dữ liệu cũ suy theo tên máy ứng dụng đã gửi; bản web không kích hoạt mới được.
ALTER TABLE core.smart_otp_devices ADD COLUMN platform text;
UPDATE core.smart_otp_devices SET platform = CASE device_name WHEN 'iPhone' THEN 'ios' WHEN 'Điện thoại Android' THEN 'android' WHEN 'Trình duyệt' THEN 'web' ELSE 'android' END;
ALTER TABLE core.smart_otp_devices ALTER COLUMN platform SET NOT NULL;
ALTER TABLE core.smart_otp_devices ADD CONSTRAINT smart_otp_devices_platform_check CHECK (platform IN ('ios', 'android', 'web'));
-- Băm mã cài đặt ứng dụng của máy giữ Smart OTP (như CONG_VIEC_60); dữ liệu cũ chưa có.
ALTER TABLE core.smart_otp_devices ADD COLUMN device_hash text;

-- Trạng thái bảo mật của tài khoản, sống qua các lần hủy, kích hoạt lại Smart OTP (QUYTAC_NGHIEPVU_562, 566, 567).
CREATE TABLE core.account_security (
    user_id                         uuid        PRIMARY KEY REFERENCES core.users(id),
    smart_otp_first_activated_at    timestamptz,            -- tài khoản đã từng có Smart OTP: kích hoạt lại bằng SMS tính là khôi phục
    smart_otp_recovered_at          timestamptz,
    redeem_locked_until             timestamptz,            -- khóa mọi giao dịch dùng điểm sau khôi phục
    sms_password_reset_until        timestamptz,            -- ngoại lệ đặt lại mật khẩu bằng SMS một lần sau khi chăm sóc khách hàng hủy Smart OTP
    updated_at                      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO core.account_security (user_id, smart_otp_first_activated_at)
SELECT user_id, activated_at FROM core.smart_otp_devices;

-- Thiết bị tin cậy (QUYTAC_NGHIEPVU_564): chỉ lưu băm HMAC-SHA256 của mã cài đặt ứng dụng.
CREATE TABLE core.trusted_devices (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES core.users(id),
    device_hash     text        NOT NULL,
    device_name     text        CHECK (device_name IS NULL OR char_length(device_name) BETWEEN 1 AND 100),
    platform        text        CHECK (platform IS NULL OR platform IN ('ios', 'android', 'web')),
    first_seen_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    removed_at      timestamptz,
    UNIQUE (user_id, device_hash)
);
CREATE INDEX trusted_devices_user_idx ON core.trusted_devices (user_id, last_seen_at DESC) WHERE removed_at IS NULL;
-- Thiết bị khách đã dùng trong 12 tháng (ghi nhận của CONG_VIEC_60, cùng cách băm) coi là tin cậy khi triển khai.
INSERT INTO core.trusted_devices (user_id, device_hash, first_seen_at, last_seen_at)
SELECT user_id, device_hash, first_seen_at, last_seen_at FROM loyalty.device_links WHERE last_seen_at >= now() - interval '12 months'
ON CONFLICT (user_id, device_hash) DO NOTHING;

-- Phiên gắn thiết bị. Phiên có trước triển khai không có băm: thiết bị của phiên đó được coi là tin cậy ở lần làm mới đầu tiên (máy đang đăng nhập).
-- Phiên chờ xác nhận thiết bị mới chỉ gọi được API xác nhận (QUYTAC_NGHIEPVU_565).
ALTER TABLE core.sessions ADD COLUMN device_hash text;
ALTER TABLE core.sessions ADD COLUMN device_verified boolean NOT NULL DEFAULT true;
