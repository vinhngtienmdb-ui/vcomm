-- CONG_VIEC_55 L1: giao dịch tích, dùng điểm tại quầy cửa hàng liên kết (QUYTAC_NGHIEPVU_394 đến 400; tài liệu 16).
-- Thêm nguồn chứng từ `affiliate_transaction` vào sổ cái điểm (CONG_VIEC_51); ràng buộc gồm mọi giá trị trên `main` mới nhất.

CREATE SEQUENCE affiliate.transaction_no_seq;

CREATE TABLE affiliate.transactions (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no         text          NOT NULL UNIQUE DEFAULT 'LK' || lpad(nextval('affiliate.transaction_no_seq')::text, 8, '0'),
    merchant_id         uuid          NOT NULL REFERENCES affiliate.merchants(id),
    outlet_id           uuid          NOT NULL REFERENCES affiliate.outlets(id),
    cashier_user_id     uuid          NOT NULL REFERENCES core.users(id),
    buyer_user_id       uuid          REFERENCES core.users(id),                -- cách 1: trống tới khi khách xác nhận
    method              text          NOT NULL CHECK (method IN ('merchant_qr', 'buyer_qr', 'phone')),
    status              text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'declined', 'expired', 'cancelled')),
    token_hash          text          UNIQUE,                                   -- cách 1: băm SHA-256 của mã QR, dùng một lần
    expires_at          timestamptz,
    bill_amount         numeric(18,4) NOT NULL CHECK (bill_amount > 0),
    voucher_discount    numeric(18,4) NOT NULL DEFAULT 0 CHECK (voucher_discount >= 0),
    redeemed_points     integer       NOT NULL DEFAULT 0 CHECK (redeemed_points >= 0),
    redeemed_amount     numeric(18,4) NOT NULL DEFAULT 0 CHECK (redeemed_amount >= 0),
    paid_amount         numeric(18,4) CHECK (paid_amount >= 0),
    earned_points       integer       NOT NULL DEFAULT 0 CHECK (earned_points >= 0),
    earned_amount       numeric(18,4) NOT NULL DEFAULT 0 CHECK (earned_amount >= 0),     -- tiền điểm tích cửa hàng phải trả
    skip_reason         text          CHECK (skip_reason IN ('test_buyer', 'locked', 'inactive', 'no_phase', 'zero', 'credit_limit', 'overdue')),
    earn_percent        numeric(6,4)  NOT NULL,                                 -- tỷ lệ tích của cửa hàng lúc lập
    point_value         numeric(18,4),                                          -- giá trị một điểm của giai đoạn lúc hoàn tất
    shortfall_amount    numeric(18,4) NOT NULL DEFAULT 0 CHECK (shortfall_amount >= 0),  -- hủy: điểm tích không trừ lại được, cửa hàng vẫn trả
    settlement_id       uuid,                                                   -- bảng đối soát tuần (lát L3)
    cancel_reason       text          CHECK (cancel_reason IS NULL OR length(cancel_reason) BETWEEN 1 AND 500),
    cancelled_by        uuid          REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    completed_at        timestamptz,
    cancelled_at        timestamptz,
    CHECK (redeemed_amount + voucher_discount <= bill_amount),
    CHECK ((status IN ('completed', 'cancelled')) = (completed_at IS NOT NULL)),
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
    CHECK ((method = 'merchant_qr') = (token_hash IS NOT NULL)),
    CHECK (status NOT IN ('completed', 'cancelled') OR buyer_user_id IS NOT NULL)
);
CREATE INDEX transactions_merchant_created_idx ON affiliate.transactions (merchant_id, created_at DESC);
CREATE INDEX transactions_buyer_idx ON affiliate.transactions (buyer_user_id, created_at DESC) WHERE buyer_user_id IS NOT NULL;
CREATE INDEX transactions_unsettled_idx ON affiliate.transactions (merchant_id) WHERE settlement_id IS NULL AND status IN ('completed', 'cancelled');
-- Một số điện thoại tối đa một yêu cầu chờ xác nhận (QUYTAC_NGHIEPVU_397).
CREATE UNIQUE INDEX transactions_pending_phone_idx ON affiliate.transactions (buyer_user_id) WHERE status = 'pending' AND method = 'phone';

-- Mã thành viên đã dùng (QUYTAC_NGHIEPVU_396): lưu băm, mỗi mã dùng một lần.
CREATE TABLE affiliate.used_member_codes (
    code_hash       text        PRIMARY KEY,
    transaction_id  uuid        NOT NULL REFERENCES affiliate.transactions(id),
    expires_at      timestamptz NOT NULL
);

ALTER TABLE loyalty.lots DROP CONSTRAINT lots_source_type_check;
ALTER TABLE loyalty.lots ADD CONSTRAINT lots_source_type_check CHECK (source_type IN ('marketplace_order', 'retail_sale', 'adjustment', 'affiliate_transaction'));
ALTER TABLE loyalty.entries DROP CONSTRAINT entries_source_type_check;
ALTER TABLE loyalty.entries ADD CONSTRAINT entries_source_type_check CHECK (source_type IN ('marketplace_order', 'retail_sale', 'retail_return', 'adjustment', 'affiliate_transaction'));
ALTER TABLE loyalty.document_points DROP CONSTRAINT document_points_source_type_check;
ALTER TABLE loyalty.document_points ADD CONSTRAINT document_points_source_type_check CHECK (source_type IN ('marketplace_order', 'retail_sale', 'affiliate_transaction'));
ALTER TABLE loyalty.refund_links DROP CONSTRAINT refund_links_sale_source_type_check;
ALTER TABLE loyalty.refund_links ADD CONSTRAINT refund_links_sale_source_type_check CHECK (sale_source_type IN ('marketplace_order', 'retail_sale', 'affiliate_transaction'));
