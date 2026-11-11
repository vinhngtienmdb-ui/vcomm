-- CONG_VIEC_26 L1: hoa hồng của đơn VComm chốt lúc đặt, ví hoa hồng (QUYTAC_NGHIEPVU_201 đến 203).
-- Mỗi dòng: một dòng hàng (không phải quà tặng) × một phần (giới thiệu, chức danh) × người hưởng; mức chụp lại lúc đặt; số tiền tính khi đơn hoàn tất.
CREATE TABLE marketplace.order_commissions (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id            uuid          NOT NULL REFERENCES marketplace.orders(id),
    order_line_id       uuid          NOT NULL REFERENCES sales.order_lines(id),
    share               text          NOT NULL CHECK (share IN ('referral', 'staff', 'team_head', 'regional_director', 'director')),
    beneficiary_user_id uuid          NOT NULL REFERENCES core.users(id),
    calculation         text          NOT NULL CHECK (calculation IN ('percent', 'fixed')),
    rate                numeric(18,4) NOT NULL CHECK (rate > 0),
    amount              numeric(18,4) CHECK (amount IS NULL OR amount >= 0),
    status              text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'credited')),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    credited_at         timestamptz,
    UNIQUE (order_line_id, share),
    CHECK ((status = 'credited') = (amount IS NOT NULL AND credited_at IS NOT NULL))
);
CREATE INDEX order_commissions_order_idx ON marketplace.order_commissions (order_id);
CREATE INDEX order_commissions_beneficiary_idx ON marketplace.order_commissions (beneficiary_user_id, status);

-- Ví: số dư chỉ đổi qua giao dịch ví, khóa dòng ví khi ghi (QUYTAC_NGHIEPVU_203).
CREATE TABLE marketplace.wallets (
    user_id     uuid          PRIMARY KEY REFERENCES core.users(id),
    balance     numeric(18,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE marketplace.wallet_transactions (
    id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid          NOT NULL REFERENCES marketplace.wallets(user_id),
    kind          text          NOT NULL CHECK (kind IN ('commission', 'withdrawal', 'withdrawal_reversal')),
    amount        numeric(18,4) NOT NULL CHECK (amount <> 0),
    balance_after numeric(18,4) NOT NULL CHECK (balance_after >= 0),
    order_id      uuid          REFERENCES marketplace.orders(id),
    note          text,
    created_at    timestamptz   NOT NULL DEFAULT now(),
    CHECK ((kind = 'commission') = (order_id IS NOT NULL))
);
CREATE INDEX wallet_transactions_user_idx ON marketplace.wallet_transactions (user_id, created_at DESC);
CREATE UNIQUE INDEX wallet_transactions_commission_idx ON marketplace.wallet_transactions (user_id, order_id) WHERE kind = 'commission';
