-- CONG_VIEC_68 L2: tệp danh mục sản phẩm cho Facebook Commerce Manager (QUYTAC_NGHIEPVU_557 đến 559; API_316, API_317).
-- Mã bí mật 32 byte ngẫu nhiên dạng base64url (43 ký tự); trống khi chưa bật lần nào. Tạo lại mã thì mã cũ hết hiệu lực ngay.
ALTER TABLE marketplace.store_settings
    ADD COLUMN facebook_feed_enabled          boolean     NOT NULL DEFAULT false,
    ADD COLUMN facebook_feed_token            text        UNIQUE CHECK (facebook_feed_token IS NULL OR facebook_feed_token ~ '^[A-Za-z0-9_-]{43}$'),
    ADD COLUMN facebook_feed_token_created_at timestamptz,
    ADD COLUMN facebook_feed_fetched_at       timestamptz,
    ADD CONSTRAINT store_settings_facebook_feed_enabled_needs_token CHECK (NOT facebook_feed_enabled OR facebook_feed_token IS NOT NULL);
