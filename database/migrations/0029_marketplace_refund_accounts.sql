-- CONG_VIEC_25 L3: tài khoản ngân hàng nhận hoàn tiền của người mua (QUYTAC_NGHIEPVU_168).
CREATE TABLE marketplace.buyer_bank_accounts (
    buyer_user_id   uuid        PRIMARY KEY REFERENCES core.users(id),
    bank_name       text        NOT NULL CHECK (char_length(bank_name) BETWEEN 2 AND 100),
    account_number  text        NOT NULL CHECK (account_number ~ '^[0-9]{6,20}$'),
    account_holder  text        NOT NULL CHECK (char_length(account_holder) BETWEEN 2 AND 100),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
