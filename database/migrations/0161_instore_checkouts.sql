-- CONG_VIEC_73 lát L1 (THAY_DOI_38): mua hàng tại cửa hàng, thanh toán trong ứng dụng VComm.
-- Schema `instore`: đơn chờ thanh toán dùng chung cho quầy tập đoàn, cổng cửa hàng liên kết, Open API, iPOS (QUYTAC_NGHIEPVU_575 đến 577).
-- Mã thanh toán động của thiết bị giữ Smart OTP (QUYTAC_NGHIEPVU_574). Sổ thanh toán, việc chờ hoàn tiền nhận đơn chờ (QUYTAC_NGHIEPVU_579).

CREATE SCHEMA IF NOT EXISTS instore;

-- Mã thanh toán của thiết bị: 12 chữ số ngẫu nhiên, chỉ lưu băm HMAC-SHA256. Hiệu lực khi cấp cho đúng lần kích hoạt Smart OTP đang có:
-- kích hoạt lại, chuyển máy thì `activated_at` đổi nên mã cũ tự hết hiệu lực, ứng dụng xin mã mới.
ALTER TABLE core.smart_otp_devices
    ADD COLUMN pay_code_prefix_hash text,
    ADD COLUMN pay_code_issued_for  timestamptz;
CREATE UNIQUE INDEX smart_otp_devices_pay_code_idx ON core.smart_otp_devices (pay_code_prefix_hash) WHERE pay_code_prefix_hash IS NOT NULL;

CREATE SEQUENCE instore.checkout_no_seq;

-- Đơn chờ thanh toán (số TT…). Nội dung cố định khi tạo; hết hạn sau 10 phút.
CREATE TABLE instore.checkouts (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no             text          NOT NULL UNIQUE DEFAULT 'TT' || lpad(nextval('instore.checkout_no_seq')::text, 8, '0'),
    operator_company_id     uuid          NOT NULL REFERENCES core.companies(id),       -- công ty vận hành sàn, nơi thu tiền
    kind                    text          NOT NULL CHECK (kind IN ('retail', 'affiliate')),
    source                  text          NOT NULL CHECK (source IN ('retail_counter', 'merchant_portal', 'open_api', 'ipos')),
    company_id              uuid          REFERENCES core.companies(id),                 -- công ty sở hữu cửa hàng tập đoàn
    store_id                uuid          REFERENCES retail.stores(id),
    register_id             uuid          REFERENCES retail.registers(id),
    shift_id                uuid          REFERENCES retail.shifts(id),
    merchant_id             uuid          REFERENCES affiliate.merchants(id),
    outlet_id               uuid          REFERENCES affiliate.outlets(id),
    created_by_user_id      uuid          REFERENCES core.users(id),
    api_key_id              uuid          REFERENCES core.api_keys(id),
    partner_checkout_code   text          CHECK (partner_checkout_code ~ '^[A-Za-z0-9._-]{1,64}$'),
    ipos_invoice_id         uuid,                                                        -- khóa ngoại do CONG_VIEC_74 thêm
    idempotency_key         text          NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 100),
    bill_amount             numeric(18,4) NOT NULL CHECK (bill_amount > 0),
    lines                   jsonb         NOT NULL DEFAULT '[]'::jsonb,
    collect_in_app          boolean       NOT NULL,
    qr_token_hash           text          UNIQUE,
    buyer_user_id           uuid          REFERENCES core.users(id),
    buyer_attached_via      text          CHECK (buyer_attached_via IN ('pay_code', 'qr')),
    buyer_attached_at       timestamptz,
    points                  integer       NOT NULL DEFAULT 0 CHECK (points >= 0),
    points_amount           numeric(18,4) NOT NULL DEFAULT 0 CHECK (points_amount >= 0),
    voucher_code_id         uuid          REFERENCES affiliate.voucher_codes(id),
    voucher_amount          numeric(18,4) NOT NULL DEFAULT 0 CHECK (voucher_amount >= 0),
    amount_due              numeric(18,4) CHECK (amount_due >= 0),                      -- tiền còn lại khách trả qua cổng, chốt khi bấm thanh toán
    status                  text          NOT NULL DEFAULT 'awaiting_buyer'
        CHECK (status IN ('awaiting_buyer', 'awaiting_payment', 'completed', 'expired', 'cancelled', 'declined')),
    expires_at              timestamptz   NOT NULL,
    retail_sale_id          uuid          REFERENCES retail.sales(id),
    affiliate_transaction_id uuid         REFERENCES affiliate.transactions(id),
    platform_fee_percent    numeric(6,4),
    platform_fee            numeric(18,4) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    gateway_fee             numeric(18,4) NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
    payout_id               uuid,                                                        -- khóa ngoại thêm ở lát L5
    buyer_invoice_info      jsonb,
    cancel_reason           text          CHECK (cancel_reason IS NULL OR char_length(cancel_reason) BETWEEN 1 AND 500),
    cancelled_by_user_id    uuid          REFERENCES core.users(id),
    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_at              timestamptz   NOT NULL DEFAULT now(),
    completed_at            timestamptz,
    version                 integer       NOT NULL DEFAULT 1,
    -- Cửa hàng tập đoàn: quầy, ca của cửa hàng; người tạo là thu ngân.
    CHECK (kind <> 'retail' OR (source = 'retail_counter' AND company_id IS NOT NULL AND store_id IS NOT NULL AND register_id IS NOT NULL AND shift_id IS NOT NULL
        AND merchant_id IS NULL AND outlet_id IS NULL AND created_by_user_id IS NOT NULL)),
    -- Cửa hàng liên kết: điểm bán của cửa hàng; Open API khi và chỉ khi có khóa API, không người tạo.
    CHECK (kind <> 'affiliate' OR (source IN ('merchant_portal', 'open_api', 'ipos') AND merchant_id IS NOT NULL AND outlet_id IS NOT NULL AND store_id IS NULL)),
    CHECK ((source = 'open_api') = (api_key_id IS NOT NULL)),
    CHECK ((created_by_user_id IS NULL) = (api_key_id IS NOT NULL)),
    CHECK ((buyer_user_id IS NULL) = (buyer_attached_at IS NULL) AND (buyer_user_id IS NULL) = (buyer_attached_via IS NULL)),
    CHECK (status <> 'awaiting_payment' OR (buyer_user_id IS NOT NULL AND amount_due IS NOT NULL)),
    CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
    CHECK (jsonb_typeof(lines) = 'array')
);
CREATE UNIQUE INDEX checkouts_idempotency_idx ON instore.checkouts (coalesce(created_by_user_id, api_key_id), idempotency_key);
CREATE UNIQUE INDEX checkouts_partner_code_idx ON instore.checkouts (merchant_id, partner_checkout_code) WHERE partner_checkout_code IS NOT NULL;
-- Mỗi quầy tập đoàn một đơn chờ (QUYTAC_NGHIEPVU_575).
CREATE UNIQUE INDEX checkouts_register_open_idx ON instore.checkouts (register_id) WHERE register_id IS NOT NULL AND status IN ('awaiting_buyer', 'awaiting_payment');
CREATE INDEX checkouts_buyer_open_idx ON instore.checkouts (buyer_user_id, created_at DESC) WHERE status IN ('awaiting_buyer', 'awaiting_payment');
CREATE INDEX checkouts_expiry_idx ON instore.checkouts (expires_at) WHERE status IN ('awaiting_buyer', 'awaiting_payment');
CREATE INDEX checkouts_creator_open_idx ON instore.checkouts (created_by_user_id) WHERE status IN ('awaiting_buyer', 'awaiting_payment');

-- Lần quét mã động sai, mở đường dẫn QR sai: đếm trong 60 phút để khóa (QUYTAC_NGHIEPVU_592).
CREATE TABLE instore.attempt_failures (
    subject     text        NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 100),   -- scan:<người dùng hoặc khóa API>, claim:<người mua>
    failed_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attempt_failures_subject_idx ON instore.attempt_failures (subject, failed_at DESC);

-- Sổ thanh toán nhận lần thanh toán của đơn chờ tại cửa hàng (đúng một trong hai: đơn VComm hoặc đơn chờ).
ALTER TABLE marketplace.payments ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE marketplace.payments ADD COLUMN checkout_id uuid REFERENCES instore.checkouts(id);
ALTER TABLE marketplace.payments ADD CONSTRAINT payments_one_target CHECK (num_nonnulls(order_id, checkout_id) = 1);
CREATE INDEX payments_checkout_idx ON marketplace.payments (checkout_id, created_at) WHERE checkout_id IS NOT NULL;

-- Việc chờ hoàn tiền của đơn chờ tại cửa hàng (thanh toán sau khi hủy, hủy giao dịch đã thu hộ).
ALTER TABLE marketplace.refunds ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE marketplace.refunds ADD COLUMN checkout_id uuid REFERENCES instore.checkouts(id);
ALTER TABLE marketplace.refunds ADD CONSTRAINT refunds_one_target CHECK (num_nonnulls(order_id, checkout_id) = 1);
ALTER TABLE marketplace.refunds DROP CONSTRAINT refunds_reason_check;
ALTER TABLE marketplace.refunds ADD CONSTRAINT refunds_reason_check
    CHECK (reason IN ('paid_after_cancel', 'duplicate_payment', 'order_cancelled', 'return_received', 'instore_cancelled'));
CREATE INDEX refunds_checkout_idx ON marketplace.refunds (checkout_id) WHERE checkout_id IS NOT NULL;
