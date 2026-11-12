-- CONG_VIEC_67 L2: mã OTP tích, đổi điểm qua Open API; phí tin nhắn OTP tính vào đối soát tuần (THAY_DOI_31; bổ sung QUYTAC_NGHIEPVU_392, 396, 403, 404; tài liệu 16).
-- Ràng buộc dùng chung core.otp_codes.purpose định nghĩa lại gồm mọi giá trị trên `main` mới nhất (0119).

-- Đơn giá mỗi tin OTP SMS theo hợp đồng; sửa áp cho tin gửi sau khi sửa.
ALTER TABLE affiliate.merchants ADD COLUMN sms_fee numeric(18,4) NOT NULL DEFAULT 0 CHECK (sms_fee BETWEEN 0 AND 10000);

-- Mỗi tin SMS gửi thành công qua Open API một dòng phí; gom vào bảng đối soát tuần của ngày gửi.
CREATE TABLE affiliate.sms_charges (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid          NOT NULL REFERENCES affiliate.merchants(id),
    api_key_id      uuid          NOT NULL REFERENCES core.api_keys(id),
    buyer_user_id   uuid          NOT NULL REFERENCES core.users(id),
    unit_price      numeric(18,4) NOT NULL CHECK (unit_price >= 0),
    sent_at         timestamptz   NOT NULL DEFAULT now(),
    settlement_id   uuid          REFERENCES affiliate.settlements(id)
);
CREATE INDEX sms_charges_merchant_idx ON affiliate.sms_charges (merchant_id, sent_at);
CREATE INDEX sms_charges_key_idx ON affiliate.sms_charges (api_key_id, sent_at);
CREATE INDEX sms_charges_unsettled_idx ON affiliate.sms_charges (merchant_id) WHERE settlement_id IS NULL;

-- Bảng đối soát: phí tin nhắn F; thuế E tính trên D + F; số còn lại = A + D + F + E − B − C (cộng phần thiếu, điều chỉnh).
ALTER TABLE affiliate.settlements ADD COLUMN sms_count integer NOT NULL DEFAULT 0 CHECK (sms_count >= 0);
ALTER TABLE affiliate.settlements ADD COLUMN sms_fee_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (sms_fee_amount >= 0);
-- Ràng buộc số còn lại của 0105 không đặt tên: tìm theo nội dung rồi thay.
DO $$
DECLARE
    old_name text;
BEGIN
    SELECT conname INTO old_name FROM pg_constraint
    WHERE conrelid = 'affiliate.settlements'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%net_amount =%';
    EXECUTE format('ALTER TABLE affiliate.settlements DROP CONSTRAINT %I', old_name);
END $$;
ALTER TABLE affiliate.settlements ADD CONSTRAINT settlements_net_amount_check
    CHECK (net_amount = earned_amount + shortfall_amount + fee_amount + sms_fee_amount + fee_tax_amount + adjustment_amount - redeemed_amount - company_voucher_amount);

-- Mã OTP SMS tích, đổi điểm qua Open API cho khách chưa kích hoạt Smart OTP.
ALTER TABLE core.otp_codes DROP CONSTRAINT otp_codes_purpose_check;
ALTER TABLE core.otp_codes ADD CONSTRAINT otp_codes_purpose_check CHECK (purpose IN ('login', 'register', 'password_reset', 'smart_otp', 'affiliate_redeem'));
