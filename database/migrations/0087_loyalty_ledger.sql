-- CONG_VIEC_51 L0: sổ cái điểm ghi một chiều, lô điểm có hạn, lịch sử hạng, lịch sử khóa (QUYTAC_NGHIEPVU_344, 351, 352).

-- Ví điểm: số dư chỉ đổi qua bút toán điểm, khóa dòng ví khi ghi.
CREATE TABLE loyalty.accounts (
    user_id              uuid          PRIMARY KEY REFERENCES core.users(id),
    balance              integer       NOT NULL DEFAULT 0 CHECK (balance >= 0),
    tier_id              uuid          REFERENCES loyalty.tiers(id),
    spend_year           integer       NOT NULL,
    spend_current_year   numeric(18,4) NOT NULL DEFAULT 0 CHECK (spend_current_year >= 0),
    spend_previous_year  numeric(18,4) NOT NULL DEFAULT 0 CHECK (spend_previous_year >= 0),
    locked               boolean       NOT NULL DEFAULT false,
    lock_reason          text,
    updated_at           timestamptz   NOT NULL DEFAULT now(),
    CHECK (locked = (lock_reason IS NOT NULL))
);
CREATE INDEX loyalty_accounts_tier_idx ON loyalty.accounts (tier_id);

-- Lô điểm: mỗi lần cộng (tích theo chứng từ bán, điều chỉnh cộng); dùng, hết hạn, điều chỉnh trừ lấy lô hạn sớm nhất trước.
-- Nguồn chứng từ chung (CONG_VIEC_51, quyết định 10): đơn VComm, bán, trả hàng tại quầy (CONG_VIEC_53), phiếu điều chỉnh; không khóa ngoại vì thuộc schema khác.
CREATE TABLE loyalty.lots (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid          NOT NULL REFERENCES loyalty.accounts(user_id),
    source_type         text          NOT NULL CHECK (source_type IN ('marketplace_order', 'retail_sale', 'adjustment')),
    source_id           uuid          NOT NULL,
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    points              integer       NOT NULL CHECK (points > 0),
    remaining           integer       NOT NULL CHECK (remaining BETWEEN 0 AND points),
    point_value         numeric(18,4) NOT NULL CHECK (point_value > 0),
    earned_on           date          NOT NULL,
    expires_on          date          NOT NULL CHECK (expires_on > earned_on),
    expiry_notified_at  timestamptz,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (source_type, source_id)
);
CREATE INDEX loyalty_lots_open_idx ON loyalty.lots (user_id, expires_on, created_at) WHERE remaining > 0;
CREATE INDEX loyalty_lots_expiry_idx ON loyalty.lots (expires_on) WHERE remaining > 0;

-- Bút toán điểm: cộng dương, trừ âm theo loại; chỉ thêm.
CREATE TABLE loyalty.entries (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES loyalty.accounts(user_id),
    kind           text        NOT NULL CHECK (kind IN ('earn', 'redeem', 'redeem_refund', 'earn_reversal', 'expire', 'adjust_add', 'adjust_subtract')),
    -- Trừ lại điểm đã tích khi số dư bằng 0: bút toán 0 điểm chỉ mang phần thiếu quy tiền.
    points         integer     NOT NULL CHECK (points <> 0 OR (kind = 'earn_reversal' AND amount > 0)),
    balance_after  integer     NOT NULL CHECK (balance_after >= 0),
    -- Tiền tương ứng: tiền điểm khi dùng, hoàn; phần thiếu quy tiền khi trừ lại điểm đã tích (QUYTAC_NGHIEPVU_349, 355).
    amount         numeric(18,4) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    source_type    text        CHECK (source_type IN ('marketplace_order', 'retail_sale', 'retail_return', 'adjustment')),
    source_id      uuid,
    company_id     uuid        REFERENCES core.companies(id),
    created_at     timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind IN ('earn', 'redeem_refund', 'adjust_add')) = (points > 0)),
    CHECK ((kind = 'expire') = (source_type IS NULL)),
    CHECK ((source_type IS NULL) = (source_id IS NULL) AND (source_type IS NULL) = (company_id IS NULL))
);
CREATE INDEX loyalty_entries_user_idx ON loyalty.entries (user_id, created_at DESC);
CREATE INDEX loyalty_entries_source_idx ON loyalty.entries (source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX loyalty_entries_created_idx ON loyalty.entries (created_at);

-- Phân bổ bút toán vào lô: để hoàn điểm đúng lô và hạch toán theo giá trị lúc cộng.
CREATE TABLE loyalty.entry_lots (
    entry_id     uuid          NOT NULL REFERENCES loyalty.entries(id),
    lot_id       uuid          NOT NULL REFERENCES loyalty.lots(id),
    points       integer       NOT NULL CHECK (points <> 0),
    point_value  numeric(18,4) NOT NULL CHECK (point_value > 0),
    PRIMARY KEY (entry_id, lot_id)
);
CREATE INDEX loyalty_entry_lots_lot_idx ON loyalty.entry_lots (lot_id);

-- QUYTAC_NGHIEPVU_344: sổ cái không sửa, không xóa.
CREATE FUNCTION loyalty.reject_ledger_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Sổ cái điểm chỉ được thêm, không sửa, không xóa' USING ERRCODE = 'restrict_violation';
END;
$$;
CREATE TRIGGER loyalty_entries_append_only BEFORE UPDATE OR DELETE ON loyalty.entries FOR EACH ROW EXECUTE FUNCTION loyalty.reject_ledger_change();
CREATE TRIGGER loyalty_entry_lots_append_only BEFORE UPDATE OR DELETE ON loyalty.entry_lots FOR EACH ROW EXECUTE FUNCTION loyalty.reject_ledger_change();

CREATE TABLE loyalty.tier_history (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES loyalty.accounts(user_id),
    from_tier_id  uuid        REFERENCES loyalty.tiers(id),
    to_tier_id    uuid        NOT NULL REFERENCES loyalty.tiers(id),
    reason        text        NOT NULL CHECK (reason IN ('order_completed', 'year_start', 'tiers_changed')),
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_tier_history_user_idx ON loyalty.tier_history (user_id, created_at DESC);

CREATE TABLE loyalty.lock_history (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES loyalty.accounts(user_id),
    action         text        NOT NULL CHECK (action IN ('lock', 'unlock')),
    reason         text        NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
    actor_user_id  uuid        NOT NULL REFERENCES core.users(id),
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_lock_history_user_idx ON loyalty.lock_history (user_id, created_at DESC);
