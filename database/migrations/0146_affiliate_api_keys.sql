-- CONG_VIEC_67 L1: khóa API của cửa hàng liên kết (QUYTAC_NGHIEPVU_495; tài liệu 16).
-- Khóa chỉ có phạm vi `loyalty.member` không cần kênh bán; khóa khác vẫn bắt buộc kênh (CONG_VIEC_61).
ALTER TABLE core.api_keys ALTER COLUMN channel_id DROP NOT NULL;
ALTER TABLE core.api_keys ADD CONSTRAINT api_keys_channel_scope_check CHECK ((channel_id IS NULL) = (scopes = ARRAY['loyalty.member']::text[]));

-- Khóa gắn một cửa hàng liên kết; số tin OTP SMS tối đa mỗi ngày (dùng ở lát L2).
CREATE TABLE affiliate.api_keys (
    api_key_id          uuid        PRIMARY KEY REFERENCES core.api_keys(id),
    merchant_id         uuid        NOT NULL REFERENCES affiliate.merchants(id),
    sms_daily_limit     integer     NOT NULL DEFAULT 200 CHECK (sms_daily_limit BETWEEN 0 AND 5000)
);
CREATE INDEX api_keys_merchant_idx ON affiliate.api_keys (merchant_id);

-- Điểm bán được dùng của khóa (ít nhất một, kiểm ở tầng ứng dụng).
CREATE TABLE affiliate.api_key_outlets (
    api_key_id      uuid        NOT NULL REFERENCES affiliate.api_keys(api_key_id) ON DELETE CASCADE,
    outlet_id       uuid        NOT NULL REFERENCES affiliate.outlets(id),
    PRIMARY KEY (api_key_id, outlet_id)
);
