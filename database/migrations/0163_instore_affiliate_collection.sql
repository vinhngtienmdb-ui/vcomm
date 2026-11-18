-- CONG_VIEC_73 lát L4: thu hộ qua ứng dụng VComm tại cửa hàng liên kết (QUYTAC_NGHIEPVU_573, 581, 584 đến 586).

-- Cài đặt thu hộ của cửa hàng liên kết (MAN_HINH_279): mặc định tắt; bật khi có tài khoản nhận tiền và người bật đã xác nhận cảnh báo pháp lý.
ALTER TABLE affiliate.merchants
    ADD COLUMN collection_enabled          boolean       NOT NULL DEFAULT false,
    ADD COLUMN collection_fee_percent      numeric(6,4)  NOT NULL DEFAULT 0 CHECK (collection_fee_percent BETWEEN 0 AND 10),
    ADD COLUMN payout_bank_account_id      uuid          REFERENCES crm.partner_bank_accounts(id),
    ADD COLUMN collection_acknowledged_at  timestamptz,
    ADD COLUMN collection_acknowledged_by  uuid          REFERENCES core.users(id),
    ADD CONSTRAINT merchants_collection_check CHECK (NOT collection_enabled OR (payout_bank_account_id IS NOT NULL AND collection_acknowledged_at IS NOT NULL));

-- Biểu phí cổng tại cửa hàng (MAN_HINH_280): theo phương thức của cổng, có hiệu lực từ ngày; chốt vào đơn lúc thanh toán.
CREATE TABLE instore.gateway_fee_rates (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid          NOT NULL REFERENCES core.companies(id),              -- công ty vận hành sàn
    method          text          NOT NULL CHECK (method ~ '^[a-z][a-z0-9_]{1,39}$'),
    percent         numeric(6,4)  NOT NULL CHECK (percent BETWEEN 0 AND 10),
    fixed_amount    numeric(18,4) NOT NULL DEFAULT 0 CHECK (fixed_amount BETWEEN 0 AND 100000),
    effective_from  date          NOT NULL,
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (company_id, method, effective_from)
);

-- Bảng chuyển tiền thu hộ ngày (QUYTAC_NGHIEPVU_585; lập ở lát L5). Tạo ở đây để dư nợ cửa hàng liên kết trừ tiền thu hộ chờ chuyển.
-- G: thu hộ, H: phí sàn, I: thuế phí sàn, K: phí cổng, L: ghi ngược giao dịch đã hủy, M: số mang sang (≤ 0), N: khoản trừ khác.
CREATE SEQUENCE instore.payout_no_seq;
CREATE TABLE instore.payouts (
    id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no           text          NOT NULL UNIQUE DEFAULT 'CT' || lpad(nextval('instore.payout_no_seq')::text, 8, '0'),
    operator_company_id   uuid          NOT NULL REFERENCES core.companies(id),
    recipient_kind        text          NOT NULL CHECK (recipient_kind IN ('retail_company', 'merchant')),
    recipient_company_id  uuid          REFERENCES core.companies(id),
    merchant_id           uuid          REFERENCES affiliate.merchants(id),
    business_date         date          NOT NULL,
    collected_amount      numeric(18,4) NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
    platform_fee          numeric(18,4) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    platform_fee_tax      numeric(18,4) NOT NULL DEFAULT 0 CHECK (platform_fee_tax >= 0),
    gateway_fee           numeric(18,4) NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
    reversal_amount       numeric(18,4) NOT NULL DEFAULT 0 CHECK (reversal_amount >= 0),
    carried_amount        numeric(18,4) NOT NULL DEFAULT 0 CHECK (carried_amount <= 0),
    deduction_amount      numeric(18,4) NOT NULL DEFAULT 0 CHECK (deduction_amount >= 0),
    amount                numeric(18,4) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    status                text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'transferred')),
    transferred_on        date,
    bank_transaction_no   text          CHECK (bank_transaction_no IS NULL OR char_length(bank_transaction_no) BETWEEN 1 AND 100),
    created_at            timestamptz   NOT NULL DEFAULT now(),
    updated_at            timestamptz   NOT NULL DEFAULT now(),
    version               integer       NOT NULL DEFAULT 1,
    CHECK ((recipient_kind = 'retail_company') = (recipient_company_id IS NOT NULL) AND (recipient_kind = 'merchant') = (merchant_id IS NOT NULL)),
    CHECK ((status = 'transferred') = (transferred_on IS NOT NULL))
);
CREATE UNIQUE INDEX payouts_recipient_day_idx ON instore.payouts (recipient_kind, coalesce(recipient_company_id, merchant_id), business_date);
ALTER TABLE instore.checkouts ADD CONSTRAINT checkouts_payout_fk FOREIGN KEY (payout_id) REFERENCES instore.payouts(id);

-- Khoản trừ khác N (phí thuê bao iPOS, THAY_DOI_39): dòng do CONG_VIEC_74 ghi; bảng chuyển tiền cộng vào khi lập.
CREATE TABLE instore.payout_deductions (
    id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id             uuid          REFERENCES instore.payouts(id),                -- trống khi chưa vào bảng
    recipient_kind        text          NOT NULL CHECK (recipient_kind IN ('retail_company', 'merchant')),
    recipient_company_id  uuid          REFERENCES core.companies(id),
    merchant_id           uuid          REFERENCES affiliate.merchants(id),
    business_date         date          NOT NULL,
    kind                  text          NOT NULL CHECK (kind IN ('ipos_subscription')),
    amount                numeric(18,4) NOT NULL CHECK (amount > 0),
    reference_id          uuid,
    note                  text          CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 500),
    created_at            timestamptz   NOT NULL DEFAULT now(),
    CHECK ((recipient_kind = 'retail_company') = (recipient_company_id IS NOT NULL) AND (recipient_kind = 'merchant') = (merchant_id IS NOT NULL))
);
CREATE INDEX payout_deductions_recipient_idx ON instore.payout_deductions (recipient_kind, coalesce(recipient_company_id, merchant_id), business_date);

-- Giao dịch LK… ghi từ đơn chờ thanh toán: tiền thu hộ, phí; nguồn iPOS (CONG_VIEC_74). Giao dịch từ đơn chờ không có mã QR riêng của cách 1.
ALTER TABLE affiliate.transactions
    ADD COLUMN collected_amount  numeric(18,4) NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
    ADD COLUMN platform_fee      numeric(18,4) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
    ADD COLUMN gateway_fee       numeric(18,4) NOT NULL DEFAULT 0 CHECK (gateway_fee >= 0),
    ADD COLUMN checkout_id       uuid          REFERENCES instore.checkouts(id);
CREATE UNIQUE INDEX transactions_checkout_idx ON affiliate.transactions (checkout_id) WHERE checkout_id IS NOT NULL;
ALTER TABLE affiliate.transactions DROP CONSTRAINT transactions_check3;
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_token_check CHECK ((method = 'merchant_qr' AND checkout_id IS NULL) = (token_hash IS NOT NULL));
ALTER TABLE affiliate.transactions DROP CONSTRAINT transactions_source_check;
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_source_check CHECK (source IN ('portal', 'open_api', 'ipos'));
ALTER TABLE affiliate.transactions DROP CONSTRAINT transactions_open_api_fields_check;
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_open_api_fields_check CHECK (
    (source IN ('portal', 'ipos') AND cashier_user_id IS NOT NULL AND api_key_id IS NULL AND partner_transaction_code IS NULL)
    OR (source = 'open_api' AND cashier_user_id IS NULL AND api_key_id IS NOT NULL AND (partner_transaction_code IS NOT NULL OR checkout_id IS NOT NULL)));
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_collected_check CHECK (collected_amount = 0 OR checkout_id IS NOT NULL);
