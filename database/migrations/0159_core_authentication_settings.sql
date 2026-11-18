-- CONG_VIEC_72 lát L1 (THAY_DOI_37): tham số thời hạn chuyển đổi sang Smart OTP (QUYTAC_NGHIEPVU_561), nhắc kích hoạt (QUYTAC_NGHIEPVU_571).
-- Một dòng duy nhất; ngày bắt đầu mặc định là ngày chạy database migration (ngày triển khai), giờ Việt Nam.
CREATE TABLE core.authentication_settings (
    id                          smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    transition_starts_on        date        NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
    buyer_transition_days       integer     NOT NULL DEFAULT 30 CHECK (buyer_transition_days BETWEEN 1 AND 180),
    portal_transition_days      integer     NOT NULL DEFAULT 30 CHECK (portal_transition_days BETWEEN 1 AND 180),
    recovery_redeem_lock_hours  integer     NOT NULL DEFAULT 24 CHECK (recovery_redeem_lock_hours BETWEEN 0 AND 168),
    support_hotline             text        CHECK (support_hotline IS NULL OR support_hotline ~ '^[0-9]{8,15}$'),
    version                     integer     NOT NULL DEFAULT 1,
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    updated_by                  uuid        REFERENCES core.users(id)
);
INSERT INTO core.authentication_settings (id) VALUES (1);

-- Nhắc kích hoạt đã gửi: mỗi khách mỗi loại một lần, không gửi trùng.
CREATE TABLE core.smart_otp_reminders (
    user_id     uuid        NOT NULL REFERENCES core.users(id),
    kind        text        NOT NULL CHECK (kind IN ('start', 'day_14', 'day_7', 'day_1', 'zns_7')),
    sent_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kind)
);


-- Thống kê số tin SMS mã OTP theo mục đích 30 ngày (QUYTAC_NGHIEPVU_572): nhật ký gửi tin ghi mục đích mã OTP; tin cũ để trống.
ALTER TABLE core.message_deliveries ADD COLUMN otp_purpose text;
CREATE INDEX message_deliveries_otp_purpose_idx ON core.message_deliveries (created_at, otp_purpose) WHERE otp_purpose IS NOT NULL;
