-- CONG_VIEC_55 L2: voucher liên kết (QUYTAC_NGHIEPVU_401, 402; tài liệu 16).
-- Ba loại phát hành: cửa hàng đổi bằng điểm, cửa hàng tặng miễn phí, công ty vận hành sàn. Mọi voucher qua luồng duyệt (loại chứng từ affiliate.voucher).

CREATE SEQUENCE affiliate.voucher_code_seq;

CREATE TABLE affiliate.vouchers (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    code                text          NOT NULL UNIQUE DEFAULT 'VL' || lpad(nextval('affiliate.voucher_code_seq')::text, 6, '0'),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),       -- công ty vận hành sàn (duyệt, đối soát)
    issuer              text          NOT NULL CHECK (issuer IN ('merchant_points', 'merchant_free', 'company')),
    merchant_id         uuid          REFERENCES affiliate.merchants(id),
    title_vi            text          NOT NULL CHECK (length(title_vi) BETWEEN 1 AND 120),
    title_en            text          NOT NULL CHECK (length(title_en) BETWEEN 1 AND 120),
    discount_kind       text          NOT NULL CHECK (discount_kind IN ('amount', 'percent')),
    discount_value      numeric(18,4) NOT NULL CHECK (discount_value > 0),
    max_discount        numeric(18,4) NOT NULL CHECK (max_discount > 0),
    min_bill            numeric(18,4) NOT NULL DEFAULT 0 CHECK (min_bill >= 0),
    total_quantity      integer       NOT NULL CHECK (total_quantity BETWEEN 1 AND 1000000),
    per_buyer_limit     integer       NOT NULL DEFAULT 1 CHECK (per_buyer_limit BETWEEN 1 AND 100),
    points_price        integer       CHECK (points_price IS NULL OR points_price >= 1),
    claim_from          date          NOT NULL,
    claim_to            date          NOT NULL CHECK (claim_to >= claim_from),
    valid_days          integer       NOT NULL CHECK (valid_days BETWEEN 1 AND 90),
    status              text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'paused', 'rejected', 'withdrawn')),
    approval_request_id uuid,
    claimed_count       integer       NOT NULL DEFAULT 0 CHECK (claimed_count >= 0),
    used_count          integer       NOT NULL DEFAULT 0 CHECK (used_count >= 0),
    created_by          uuid          NOT NULL REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_by          uuid          NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    CHECK ((issuer = 'company') = (merchant_id IS NULL)),
    CHECK ((issuer = 'merchant_points') = (points_price IS NOT NULL)),
    CHECK (discount_kind = 'amount' OR discount_value <= 100),
    CHECK (discount_kind = 'percent' OR max_discount = discount_value),
    CHECK (claimed_count <= total_quantity AND used_count <= claimed_count)
);
CREATE INDEX vouchers_merchant_idx ON affiliate.vouchers (merchant_id, status);
CREATE INDEX vouchers_claimable_idx ON affiliate.vouchers (claim_from, claim_to) WHERE status = 'approved';

-- Voucher công ty dùng tại các cửa hàng được chọn; không có dòng nào: mọi cửa hàng liên kết.
CREATE TABLE affiliate.voucher_merchants (
    voucher_id  uuid NOT NULL REFERENCES affiliate.vouchers(id),
    merchant_id uuid NOT NULL REFERENCES affiliate.merchants(id),
    PRIMARY KEY (voucher_id, merchant_id)
);

-- Voucher của khách: nhận trên ứng dụng, dùng một lần tại quầy.
CREATE TABLE affiliate.voucher_codes (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id      uuid          NOT NULL REFERENCES affiliate.vouchers(id),
    buyer_user_id   uuid          NOT NULL REFERENCES core.users(id),
    points_paid     integer       NOT NULL DEFAULT 0 CHECK (points_paid >= 0),
    point_value     numeric(18,4),                                              -- giá trị một điểm lúc nhận (voucher đổi bằng điểm)
    claimed_at      timestamptz   NOT NULL DEFAULT now(),
    expires_at      timestamptz   NOT NULL,
    status          text          NOT NULL DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired')),
    transaction_id  uuid          REFERENCES affiliate.transactions(id),
    expiry_notified_at timestamptz,
    CHECK ((status = 'used') = (transaction_id IS NOT NULL)),
    CHECK ((points_paid > 0) = (point_value IS NOT NULL))
);
CREATE INDEX voucher_codes_buyer_idx ON affiliate.voucher_codes (buyer_user_id, status, expires_at);
CREATE INDEX voucher_codes_voucher_buyer_idx ON affiliate.voucher_codes (voucher_id, buyer_user_id);

-- Giao dịch dùng voucher: voucher đã dùng, tiền công ty phải trả cửa hàng do voucher (đổi bằng điểm, công ty phát hành).
ALTER TABLE affiliate.transactions ADD COLUMN voucher_code_id uuid REFERENCES affiliate.voucher_codes(id);
ALTER TABLE affiliate.transactions ADD COLUMN voucher_payable numeric(18,4) NOT NULL DEFAULT 0 CHECK (voucher_payable >= 0);
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_voucher_check CHECK (voucher_discount = 0 OR voucher_code_id IS NOT NULL);

-- Điểm đổi voucher ghi sổ cái điểm với nguồn `affiliate_voucher` (gồm mọi giá trị trên `main` mới nhất và 0103).
ALTER TABLE loyalty.entries DROP CONSTRAINT entries_source_type_check;
ALTER TABLE loyalty.entries ADD CONSTRAINT entries_source_type_check
    CHECK (source_type IN ('marketplace_order', 'retail_sale', 'retail_return', 'adjustment', 'affiliate_transaction', 'affiliate_voucher'));
