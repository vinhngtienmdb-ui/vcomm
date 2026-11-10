-- CONG_VIEC_20: Báo cáo tài chính hợp nhất (CHUC_NANG_92 đến 95; QUYTAC_NGHIEPVU_123 đến 128).

-- Bảng hợp nhất theo kỳ của tập đoàn (QUYTAC_NGHIEPVU_128).
CREATE TABLE finance.consolidations (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_company_id    uuid        NOT NULL REFERENCES core.companies(id),       -- công ty gốc
    from_date           date        NOT NULL,
    to_date             date        NOT NULL CHECK (to_date >= from_date),
    document_no         text,
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'rejected', 'withdrawn')),
    member_ids          uuid[]      NOT NULL DEFAULT '{}',                         -- thành viên lúc tính lại gần nhất
    warnings            jsonb       NOT NULL DEFAULT '[]'::jsonb,                  -- chênh lệch công nợ nội bộ
    report              jsonb,                                                     -- số báo cáo chốt khi duyệt
    calculated_at       timestamptz,
    approval_request_id uuid,
    post_error          text,
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    submitted_by        uuid        REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    submitted_at        timestamptz,
    posted_at           timestamptz,
    version             integer     NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX consolidations_period_idx ON finance.consolidations (group_company_id, from_date, to_date) WHERE status NOT IN ('rejected', 'withdrawn');
CREATE INDEX consolidations_approval_idx ON finance.consolidations (approval_request_id);

-- Bút toán loại trừ, điều chỉnh: các dòng cùng "entry_no" là một bút toán cân Nợ Có (QUYTAC_NGHIEPVU_125 đến 127).
CREATE TABLE finance.consolidation_entries (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    consolidation_id    uuid        NOT NULL REFERENCES finance.consolidations(id) ON DELETE CASCADE,
    entry_no            integer     NOT NULL,
    kind                text        NOT NULL CHECK (kind IN ('intercompany_balance', 'internal_sales', 'manual')),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    account_id          uuid        NOT NULL REFERENCES accounting.accounts(id),
    partner_id          uuid        REFERENCES crm.partners(id),
    debit               numeric(20,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit              numeric(20,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    description         text        NOT NULL,
    created_by          uuid        REFERENCES core.users(id),                    -- trống: tự động
    CHECK ((debit > 0) <> (credit > 0))
);
CREATE INDEX consolidation_entries_idx ON finance.consolidation_entries (consolidation_id, entry_no);

-- Lãi chưa thực hiện từng mặt hàng mua nội bộ (QUYTAC_NGHIEPVU_127).
CREATE TABLE finance.consolidation_profit_lines (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    consolidation_id    uuid        NOT NULL REFERENCES finance.consolidations(id) ON DELETE CASCADE,
    buyer_company_id    uuid        NOT NULL REFERENCES core.companies(id),
    seller_company_id   uuid        NOT NULL REFERENCES core.companies(id),
    variant_id          uuid        NOT NULL REFERENCES catalog.variants(id),      -- mặt hàng của bên mua
    internal_quantity   numeric(20,4) NOT NULL,
    ending_quantity     numeric(20,4) NOT NULL,
    unit_margin         numeric(20,4) NOT NULL,
    estimated_amount    numeric(20,4) NOT NULL,
    override_amount     numeric(20,4) CHECK (override_amount >= 0),
    override_reason     text,
    UNIQUE (consolidation_id, buyer_company_id, seller_company_id, variant_id)
);
