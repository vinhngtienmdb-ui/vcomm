-- CONG_VIEC_18: Đối soát ngân hàng (CHUC_NANG_84 đến 87; QUYTAC_NGHIEPVU_113 đến 117).

-- Kết nối dịch vụ trung gian của quỹ ngân hàng (QUYTAC_NGHIEPVU_113).
CREATE TABLE finance.bank_connections (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    fund_id             uuid        NOT NULL UNIQUE REFERENCES finance.funds(id),
    provider            text        NOT NULL CHECK (provider IN ('simulator', 'sepay')),
    secret_value        bytea       NOT NULL,                 -- khóa xác thực webhook, mã hóa
    secret_hint         text        NOT NULL,                 -- bốn ký tự cuối
    enabled             boolean     NOT NULL DEFAULT true,
    last_received_at    timestamptz,
    updated_by          uuid        REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 0
);

-- Giao dịch ngân hàng nhận qua webhook; không sửa nội dung, không xóa (QUYTAC_NGHIEPVU_114).
CREATE TABLE finance.bank_transactions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    connection_id       uuid        NOT NULL REFERENCES finance.bank_connections(id),
    fund_id             uuid        NOT NULL REFERENCES finance.funds(id),
    external_id         text        NOT NULL,
    transaction_at      timestamptz NOT NULL,
    transaction_date    date        NOT NULL,                 -- ngày theo giờ Việt Nam
    direction           text        NOT NULL CHECK (direction IN ('in', 'out')),
    amount              numeric(20,4) NOT NULL CHECK (amount > 0),
    content             text        NOT NULL DEFAULT '',
    reference_code      text,
    balance_after       numeric(20,4),
    status              text        NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'ignored')),
    payment_id          uuid        REFERENCES finance.payments(id),
    matched_by          uuid        REFERENCES core.users(id),   -- trống: tự ghép
    matched_at          timestamptz,
    suggested_partner_id uuid       REFERENCES crm.partners(id),
    suggestion_reason   text        CHECK (suggestion_reason IN ('sales_order', 'partner_code', 'tax_code')),
    receipt_id          uuid        REFERENCES finance.payments(id),   -- phiếu thu lập từ gợi ý, chờ ghi sổ
    ignore_reason       text,
    raw_payload         jsonb       NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 0,
    UNIQUE (connection_id, external_id),
    CHECK ((status = 'matched') = (payment_id IS NOT NULL)),
    CHECK ((status = 'ignored') = (ignore_reason IS NOT NULL))
);
-- Một phiếu ghép tối đa một giao dịch (QUYTAC_NGHIEPVU_117).
CREATE UNIQUE INDEX bank_transactions_payment_idx ON finance.bank_transactions (payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX bank_transactions_fund_idx ON finance.bank_transactions (fund_id, transaction_date);
CREATE INDEX bank_transactions_company_idx ON finance.bank_transactions (company_id, transaction_date);
CREATE INDEX bank_transactions_open_idx ON finance.bank_transactions (fund_id, direction, amount) WHERE status = 'unmatched';
