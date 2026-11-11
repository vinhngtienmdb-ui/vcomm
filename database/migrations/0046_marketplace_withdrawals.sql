-- CONG_VIEC_26 L3: yêu cầu rút tiền hoa hồng, duyệt chi, khấu trừ thuế thu nhập cá nhân (QUYTAC_NGHIEPVU_204 đến 206).
-- Tạo yêu cầu thì trừ số dư ví ngay (giữ tiền); từ chối, người dùng rút lại thì cộng lại. Thuế, số thực nhận chốt khi duyệt.
CREATE TABLE marketplace.withdrawals (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid          NOT NULL REFERENCES core.companies(id),
    user_id         uuid          NOT NULL REFERENCES marketplace.wallets(user_id),
    amount          numeric(18,4) NOT NULL CHECK (amount > 0),
    -- Tài khoản nhận chụp lại lúc tạo yêu cầu.
    bank_name       text          NOT NULL,
    account_number  text          NOT NULL,
    account_holder  text          NOT NULL,
    status          text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'paid')),
    tax_amount      numeric(18,4) CHECK (tax_amount IS NULL OR tax_amount >= 0),
    net_amount      numeric(18,4) CHECK (net_amount IS NULL OR net_amount >= 0),
    reject_reason   text,
    bank_transaction_no text,
    paid_on         date,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    decided_by      uuid          REFERENCES core.users(id),
    decided_at      timestamptz,
    paid_by         uuid          REFERENCES core.users(id),
    paid_at         timestamptz,
    version         integer       NOT NULL DEFAULT 1,
    CHECK ((status IN ('approved', 'paid')) = (tax_amount IS NOT NULL AND net_amount IS NOT NULL)),
    CHECK (net_amount IS NULL OR net_amount + tax_amount = amount),
    CHECK ((status = 'rejected') = (reject_reason IS NOT NULL)),
    CHECK ((status = 'paid') = (bank_transaction_no IS NOT NULL AND paid_on IS NOT NULL))
);
-- Một yêu cầu đang chờ (chờ duyệt hoặc đã duyệt chưa chi) mỗi người.
CREATE UNIQUE INDEX withdrawals_open_idx ON marketplace.withdrawals (user_id) WHERE status IN ('pending', 'approved');
CREATE INDEX withdrawals_company_status_idx ON marketplace.withdrawals (company_id, status, created_at);

-- Giao dịch ví của yêu cầu rút: trừ khi tạo, cộng lại khi từ chối hoặc người dùng rút lại.
ALTER TABLE marketplace.wallet_transactions ADD COLUMN withdrawal_id uuid REFERENCES marketplace.withdrawals(id);
ALTER TABLE marketplace.wallet_transactions ADD CONSTRAINT wallet_transactions_withdrawal_check CHECK ((kind = 'commission') = (withdrawal_id IS NULL));
CREATE UNIQUE INDEX wallet_transactions_withdrawal_idx ON marketplace.wallet_transactions (withdrawal_id, kind) WHERE withdrawal_id IS NOT NULL;
