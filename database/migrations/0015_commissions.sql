-- CONG_VIEC_17: Hoa hồng đội kinh doanh (CHUC_NANG_80 đến 83; QUYTAC_NGHIEPVU_108 đến 112; tài liệu 16).

-- Nhân viên hưởng hoa hồng gán khi gửi đơn lần đầu (QUYTAC_NGHIEPVU_109).
ALTER TABLE sales.orders ADD COLUMN commission_user_id uuid REFERENCES core.users(id);

-- Cài đặt hoa hồng theo công ty (QUYTAC_NGHIEPVU_108).
CREATE TABLE finance.commission_settings (
    company_id          uuid        PRIMARY KEY REFERENCES core.companies(id),
    enabled             boolean     NOT NULL DEFAULT false,
    start_date          date,
    assignment          text        NOT NULL DEFAULT 'customer_owner' CHECK (assignment IN ('customer_owner', 'order_creator')),
    combination         text        NOT NULL DEFAULT 'matrix' CHECK (combination IN ('matrix', 'channel_factor')),
    default_percent     numeric(7,4) NOT NULL DEFAULT 0 CHECK (default_percent BETWEEN 0 AND 100),
    tiers               jsonb       NOT NULL DEFAULT '[{"fromPercent": 0, "multiplier": 1}]'::jsonb,   -- [{fromPercent, multiplier}] tăng dần, bậc đầu từ 0
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid        REFERENCES core.users(id),
    version             integer     NOT NULL DEFAULT 0,
    CHECK (NOT enabled OR start_date IS NOT NULL)
);

-- Mức hoa hồng: theo ngành hàng (kênh trống: mọi kênh), theo ngành hàng và kênh (chỉ dùng khi kết hợp kiểu bảng).
CREATE TABLE finance.commission_rates (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    category_id         uuid        NOT NULL REFERENCES catalog.categories(id),
    channel_id          uuid        REFERENCES catalog.sales_channels(id),
    percent             numeric(7,4) NOT NULL CHECK (percent BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX commission_rates_key_idx ON finance.commission_rates (company_id, category_id, coalesce(channel_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Hệ số theo kênh (kết hợp kiểu kênh nhân hệ số; kênh không khai là 1).
CREATE TABLE finance.commission_channel_factors (
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    channel_id          uuid        NOT NULL REFERENCES catalog.sales_channels(id),
    factor              numeric(7,4) NOT NULL CHECK (factor BETWEEN 0 AND 10),
    PRIMARY KEY (company_id, channel_id)
);

-- Chỉ tiêu tiền thu (chưa thuế) theo tháng từng nhân viên.
CREATE TABLE finance.commission_targets (
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    user_id             uuid        NOT NULL REFERENCES core.users(id),
    month               text        NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    amount              numeric(20,4) NOT NULL CHECK (amount > 0),
    PRIMARY KEY (company_id, user_id, month)
);

-- Bảng hoa hồng tháng (CHUC_NANG_83; QUYTAC_NGHIEPVU_111, 112).
CREATE TABLE finance.commission_statements (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    month               text        NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    document_no         text,
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'rejected', 'withdrawn')),
    total_amount        numeric(20,4) NOT NULL DEFAULT 0,
    approval_request_id uuid,
    post_error          text,
    created_by          uuid        REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    submitted_at        timestamptz,
    posted_at           timestamptz,
    version             integer     NOT NULL DEFAULT 0
);
-- Mỗi tháng một bảng đang dùng (bị từ chối, đã rút thì lập lại).
CREATE UNIQUE INDEX commission_statements_month_idx ON finance.commission_statements (company_id, month) WHERE status NOT IN ('rejected', 'withdrawn');

CREATE TABLE finance.commission_statement_lines (
    statement_id        uuid        NOT NULL REFERENCES finance.commission_statements(id) ON DELETE CASCADE,
    user_id             uuid        NOT NULL REFERENCES core.users(id),
    base_amount         numeric(20,4) NOT NULL,          -- tiền chưa thuế đã thu (có dấu)
    commission_before   numeric(20,4) NOT NULL,          -- hoa hồng trước hệ số
    target_amount       numeric(20,4),
    achieved_percent    numeric(9,4),
    multiplier          numeric(7,4) NOT NULL,
    amount              numeric(20,4) NOT NULL,
    PRIMARY KEY (statement_id, user_id)
);

-- Phát sinh hoa hồng theo dòng hàng, có dấu (CHUC_NANG_82; QUYTAC_NGHIEPVU_110).
CREATE TABLE finance.commission_events (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    user_id             uuid        NOT NULL REFERENCES core.users(id),
    order_id            uuid        NOT NULL REFERENCES sales.orders(id),
    source_type         text        NOT NULL CHECK (source_type IN ('receipt', 'refund', 'retail_delivery', 'retail_return')),
    source_id           uuid        NOT NULL,                       -- phiếu thu chi hoặc phiếu kho
    document_id         uuid        NOT NULL REFERENCES inventory.documents(id),   -- phiếu xuất hoặc phiếu trả của dòng
    order_line_id       uuid        NOT NULL REFERENCES sales.order_lines(id),
    event_date          date        NOT NULL,
    base_amount         numeric(20,4) NOT NULL,                     -- tiền chưa thuế
    percent             numeric(9,4) NOT NULL,
    amount              numeric(20,4) NOT NULL,
    statement_id        uuid        REFERENCES finance.commission_statements(id) ON DELETE SET NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commission_events_open_idx ON finance.commission_events (company_id, event_date) WHERE statement_id IS NULL;
CREATE INDEX commission_events_user_idx ON finance.commission_events (company_id, user_id, event_date);
CREATE INDEX commission_events_statement_idx ON finance.commission_events (statement_id);
-- Mỗi lần trừ nợ (hoặc phiếu kho bán lẻ) ghi một lần cho mỗi dòng đơn.
CREATE UNIQUE INDEX commission_events_source_idx ON finance.commission_events (source_type, source_id, order_line_id);
