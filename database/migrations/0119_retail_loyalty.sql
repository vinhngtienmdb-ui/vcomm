-- CONG_VIEC_53 lát L6: điểm tại quầy với Smart OTP (QUYTAC_NGHIEPVU_379; API_198, API_199; quyết định người dùng 2026-11-11).

-- Khách VComm của hóa đơn bán lẻ: tích điểm, dùng điểm, hoàn điểm khi trả hàng theo sổ cái điểm của CONG_VIEC_51 (nguồn `retail_sale`, `retail_return`).
ALTER TABLE retail.sales ADD COLUMN loyalty_user_id uuid REFERENCES core.users(id);
CREATE INDEX sales_loyalty_user_idx ON retail.sales (loyalty_user_id) WHERE loyalty_user_id IS NOT NULL;

-- Smart OTP: mỗi tài khoản một thiết bị; khóa TOTP mã hóa AES-256-GCM như khóa xác thực hai lớp; mỗi bước 30 giây dùng một lần;
-- sai 5 lần liên tiếp thì khóa dùng điểm tại quầy 15 phút.
CREATE TABLE loyalty.smart_otp_devices (
    user_id             uuid        PRIMARY KEY REFERENCES core.users(id),
    device_name         text        NOT NULL CHECK (char_length(device_name) BETWEEN 1 AND 100),
    secret_encrypted    bytea       NOT NULL,
    activated_at        timestamptz NOT NULL DEFAULT now(),
    last_used_step      bigint      NOT NULL DEFAULT 0,
    failed_count        integer     NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
    locked_until        timestamptz,
    version             integer     NOT NULL DEFAULT 0
);

-- Mã SMS xác nhận kích hoạt Smart OTP.
ALTER TABLE core.otp_codes DROP CONSTRAINT otp_codes_purpose_check;
ALTER TABLE core.otp_codes ADD CONSTRAINT otp_codes_purpose_check CHECK (purpose IN ('login', 'register', 'password_reset', 'smart_otp'));
