-- CONG_VIEC_49 L1: cộng tác viên, lượt bấm đường dẫn, hoa hồng cộng tác viên, thưởng giới thiệu bạn bè (CHUC_NANG_171; QUYTAC_NGHIEPVU_324 đến 327).

-- Hồ sơ cộng tác viên: mỗi người mua một hồ sơ; mã cấp khi duyệt lần đầu, không đổi (QUYTAC_NGHIEPVU_324).
CREATE TABLE marketplace.collaborators (
    user_id           uuid        PRIMARY KEY REFERENCES core.users(id),
    company_id        uuid        NOT NULL REFERENCES core.companies(id),
    code              text        UNIQUE CHECK (code IS NULL OR code ~ '^[A-HJ-NP-Z2-9]{8}$'),
    status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    label             text        CHECK (label IN ('kol', 'koc')),
    channel           text        CHECK (channel IS NULL OR char_length(channel) <= 200),
    terms_version     integer     NOT NULL CHECK (terms_version > 0),
    reason            text        CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500),
    submitted_at      timestamptz NOT NULL DEFAULT now(),
    decided_by        uuid        REFERENCES core.users(id),
    decided_at        timestamptz,
    updated_at        timestamptz NOT NULL DEFAULT now(),
    version           integer     NOT NULL DEFAULT 1,
    CHECK (status NOT IN ('approved', 'suspended') OR code IS NOT NULL),
    CHECK (label IS NULL OR status IN ('approved', 'suspended')),
    CHECK (status NOT IN ('rejected', 'suspended') OR reason IS NOT NULL)
);
CREATE INDEX collaborators_status_idx ON marketplace.collaborators (company_id, status, submitted_at DESC);

CREATE TABLE marketplace.collaborator_history (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES marketplace.collaborators(user_id),
    action      text        NOT NULL CHECK (action IN ('submit', 'approve', 'reject', 'suspend', 'restore', 'label')),
    label       text        CHECK (label IN ('kol', 'koc')),
    reason      text,
    changed_by  uuid        NOT NULL REFERENCES core.users(id),
    changed_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collaborator_history_user_idx ON marketplace.collaborator_history (user_id, changed_at DESC);

-- Lượt bấm đường dẫn: một dòng mỗi người mua, cộng tác viên, sản phẩm; bấm lại cập nhật thời điểm (QUYTAC_NGHIEPVU_325).
CREATE TABLE marketplace.collaborator_clicks (
    buyer_user_id         uuid        NOT NULL REFERENCES core.users(id),
    collaborator_user_id  uuid        NOT NULL REFERENCES marketplace.collaborators(user_id),
    product_id            uuid        NOT NULL REFERENCES catalog.products(id),
    first_clicked_at      timestamptz NOT NULL DEFAULT now(),
    last_clicked_at       timestamptz NOT NULL DEFAULT now(),
    click_count           integer     NOT NULL DEFAULT 1 CHECK (click_count > 0),
    PRIMARY KEY (buyer_user_id, collaborator_user_id, product_id),
    CHECK (buyer_user_id <> collaborator_user_id)
);
CREATE INDEX collaborator_clicks_attribution_idx ON marketplace.collaborator_clicks (buyer_user_id, product_id, last_clicked_at DESC);
CREATE INDEX collaborator_clicks_collaborator_idx ON marketplace.collaborator_clicks (collaborator_user_id, last_clicked_at DESC);
-- Nhật ký từng lượt ghi: giới hạn 200 lượt mỗi ngày mỗi người mua, thống kê lượt bấm của cộng tác viên.
CREATE TABLE marketplace.collaborator_click_log (
    id                    bigserial   PRIMARY KEY,
    buyer_user_id         uuid        NOT NULL REFERENCES core.users(id),
    collaborator_user_id  uuid        NOT NULL REFERENCES marketplace.collaborators(user_id),
    product_id            uuid        NOT NULL REFERENCES catalog.products(id),
    clicked_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collaborator_click_log_buyer_idx ON marketplace.collaborator_click_log (buyer_user_id, clicked_at DESC);
CREATE INDEX collaborator_click_log_collaborator_idx ON marketplace.collaborator_click_log (collaborator_user_id, clicked_at DESC);

-- Mức hoa hồng thứ sáu (QUYTAC_NGHIEPVU_326); tổng phần trăm sáu mức không quá 100%.
ALTER TABLE marketplace.product_commissions ADD COLUMN collaborator numeric(18,4) NOT NULL DEFAULT 0 CHECK (collaborator >= 0);
ALTER TABLE marketplace.product_commissions DROP CONSTRAINT product_commissions_check;
ALTER TABLE marketplace.product_commissions ADD CONSTRAINT product_commissions_percent_total_check
    CHECK (calculation = 'fixed' OR referral + staff + team_head + regional_director + director + collaborator <= 100);
ALTER TABLE marketplace.order_commissions DROP CONSTRAINT order_commissions_share_check;
ALTER TABLE marketplace.order_commissions ADD CONSTRAINT order_commissions_share_check
    CHECK (share IN ('referral', 'staff', 'team_head', 'regional_director', 'director', 'collaborator'));

-- Người giới thiệu chụp lúc đặt đơn, căn cứ thưởng giới thiệu (QUYTAC_NGHIEPVU_327). Đơn đặt trước nâng cấp để trống.
ALTER TABLE marketplace.orders ADD COLUMN referrer_user_id uuid REFERENCES core.users(id);

CREATE TABLE marketplace.referral_bonus_settings (
    company_id        uuid          PRIMARY KEY REFERENCES core.companies(id),
    is_enabled        boolean       NOT NULL DEFAULT false,
    bonus_amount      numeric(18,4) NOT NULL CHECK (bonus_amount BETWEEN 1 AND 10000000),
    minimum_order     numeric(18,4) NOT NULL DEFAULT 0 CHECK (minimum_order >= 0),
    updated_by        uuid          NOT NULL REFERENCES core.users(id),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    version           integer       NOT NULL DEFAULT 1
);

-- Mỗi người được giới thiệu phát sinh tối đa một lần thưởng.
CREATE TABLE marketplace.referral_bonuses (
    referred_user_id     uuid          PRIMARY KEY REFERENCES core.users(id),
    beneficiary_user_id  uuid          NOT NULL REFERENCES core.users(id),
    order_id             uuid          NOT NULL UNIQUE REFERENCES marketplace.orders(id),
    amount               numeric(18,4) NOT NULL CHECK (amount > 0),
    credited_at          timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX referral_bonuses_beneficiary_idx ON marketplace.referral_bonuses (beneficiary_user_id, credited_at DESC);

ALTER TABLE marketplace.wallet_transactions DROP CONSTRAINT wallet_transactions_kind_check;
ALTER TABLE marketplace.wallet_transactions ADD CONSTRAINT wallet_transactions_kind_check CHECK (kind IN ('commission', 'withdrawal', 'withdrawal_reversal', 'referral_bonus'));
ALTER TABLE marketplace.wallet_transactions DROP CONSTRAINT wallet_transactions_check;
ALTER TABLE marketplace.wallet_transactions ADD CONSTRAINT wallet_transactions_order_check CHECK ((kind IN ('commission', 'referral_bonus')) = (order_id IS NOT NULL));
ALTER TABLE marketplace.wallet_transactions DROP CONSTRAINT wallet_transactions_withdrawal_check;
ALTER TABLE marketplace.wallet_transactions ADD CONSTRAINT wallet_transactions_withdrawal_check CHECK ((kind IN ('commission', 'referral_bonus')) = (withdrawal_id IS NULL));
CREATE UNIQUE INDEX wallet_transactions_referral_bonus_idx ON marketplace.wallet_transactions (user_id, order_id) WHERE kind = 'referral_bonus';

-- Bút toán thưởng giới thiệu: Nợ chi phí hoa hồng / Có phải trả hoa hồng (QUYTAC_NGHIEPVU_327).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'marketplace_referral_bonus'));
