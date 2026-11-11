-- CONG_VIEC_49 L2: ví mua sắm (CHUC_NANG_173; QUYTAC_NGHIEPVU_332); khóa ví mua sắm toàn hệ thống, chặn ví theo tài khoản (THAY_DOI_22).

-- Ví mua sắm: tách ví hoa hồng; không nạp, rút, chuyển; số dư chỉ đổi qua giao dịch ví có khóa dòng ví.
CREATE TABLE marketplace.shopping_wallets (
    user_id     uuid          PRIMARY KEY REFERENCES core.users(id),
    balance     numeric(18,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE marketplace.shopping_wallet_transactions (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid          NOT NULL REFERENCES marketplace.shopping_wallets(user_id),
    kind          text          NOT NULL CHECK (kind IN ('group_buy_refund', 'group_buy_difference', 'order_payment', 'order_refund', 'return_refund')),
    amount        numeric(18,4) NOT NULL CHECK (amount <> 0),
    balance_after numeric(18,4) NOT NULL CHECK (balance_after >= 0),
    order_id      uuid          NOT NULL REFERENCES marketplace.orders(id),
    note          text,
    created_at    timestamptz   NOT NULL DEFAULT now(),
    CHECK ((kind = 'order_payment') = (amount < 0))
);
CREATE INDEX shopping_wallet_transactions_user_idx ON marketplace.shopping_wallet_transactions (user_id, created_at DESC);
CREATE INDEX shopping_wallet_transactions_order_idx ON marketplace.shopping_wallet_transactions (order_id);

-- Phần trả bằng ví lúc đặt và phần đã hoàn về ví. paid_amount giữ nghĩa cũ: tiền thu qua cổng hoặc COD.
ALTER TABLE marketplace.orders
    ADD COLUMN wallet_amount          numeric(18,4) NOT NULL DEFAULT 0 CHECK (wallet_amount >= 0),
    ADD COLUMN wallet_refunded_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (wallet_refunded_amount >= 0);
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_wallet_refund_check CHECK (wallet_refunded_amount <= wallet_amount);

-- Khóa ví mua sắm toàn hệ thống: không ai dùng số dư trả đơn; tiền hoàn vẫn cộng vào ví (THAY_DOI_22).
CREATE TABLE marketplace.shopping_wallet_settings (
    company_id  uuid        PRIMARY KEY REFERENCES core.companies(id),
    is_locked   boolean     NOT NULL DEFAULT false,
    updated_by  uuid        NOT NULL REFERENCES core.users(id),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    version     integer     NOT NULL DEFAULT 1
);

-- Chặn từng ví theo tài khoản, hai ví độc lập (THAY_DOI_22).
CREATE TABLE marketplace.wallet_blocks (
    user_id     uuid        NOT NULL REFERENCES core.users(id),
    wallet      text        NOT NULL CHECK (wallet IN ('shopping', 'commission')),
    is_blocked  boolean     NOT NULL,
    reason      text        NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
    updated_by  uuid        NOT NULL REFERENCES core.users(id),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    version     integer     NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, wallet)
);
CREATE TABLE marketplace.wallet_block_history (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES core.users(id),
    wallet      text        NOT NULL CHECK (wallet IN ('shopping', 'commission')),
    action      text        NOT NULL CHECK (action IN ('block', 'unblock')),
    reason      text        NOT NULL,
    changed_by  uuid        NOT NULL REFERENCES core.users(id),
    changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wallet_block_history_user_idx ON marketplace.wallet_block_history (user_id, changed_at DESC);
