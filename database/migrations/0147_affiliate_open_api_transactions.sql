-- CONG_VIEC_67 L1: giao dịch cửa hàng liên kết tạo qua Open API (bổ sung QUYTAC_NGHIEPVU_394, 396, 397, 400; tài liệu 16).
-- Giao dịch qua API không có thu ngân; ghi khóa, mã giao dịch của đối tác. Cách `otp` dùng ở lát L2.
ALTER TABLE affiliate.transactions ALTER COLUMN cashier_user_id DROP NOT NULL;
ALTER TABLE affiliate.transactions ADD COLUMN source text NOT NULL DEFAULT 'portal' CHECK (source IN ('portal', 'open_api'));
ALTER TABLE affiliate.transactions ADD COLUMN api_key_id uuid REFERENCES core.api_keys(id);
ALTER TABLE affiliate.transactions ADD COLUMN partner_transaction_code text CHECK (partner_transaction_code ~ '^[A-Za-z0-9._-]{1,50}$');
ALTER TABLE affiliate.transactions ADD COLUMN cancelled_api_key_id uuid REFERENCES core.api_keys(id);   -- hủy qua API
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_open_api_fields_check CHECK (
    (source = 'portal' AND cashier_user_id IS NOT NULL AND api_key_id IS NULL AND partner_transaction_code IS NULL)
    OR (source = 'open_api' AND cashier_user_id IS NULL AND api_key_id IS NOT NULL AND partner_transaction_code IS NOT NULL));
ALTER TABLE affiliate.transactions DROP CONSTRAINT transactions_method_check;
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_method_check CHECK (method IN ('merchant_qr', 'buyer_qr', 'phone', 'otp'));
-- Mã giao dịch của đối tác duy nhất theo cửa hàng (chống tạo trùng khi gửi lại).
CREATE UNIQUE INDEX transactions_partner_code_idx ON affiliate.transactions (merchant_id, partner_transaction_code) WHERE partner_transaction_code IS NOT NULL;
CREATE INDEX transactions_api_key_idx ON affiliate.transactions (api_key_id, created_at DESC) WHERE api_key_id IS NOT NULL;
