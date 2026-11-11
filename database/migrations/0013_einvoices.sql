-- CONG_VIEC_16: Hóa đơn điện tử (CHUC_NANG_76 đến 79; QUYTAC_NGHIEPVU_103 đến 107; tài liệu 16).

-- Cài đặt hóa đơn điện tử theo công ty (CHUC_NANG_76; QUYTAC_NGHIEPVU_103).
CREATE TABLE finance.einvoice_settings (
    company_id          uuid        PRIMARY KEY REFERENCES core.companies(id),
    enabled             boolean     NOT NULL DEFAULT false,
    start_date          date,
    provider            text        NOT NULL DEFAULT 'simulator' CHECK (provider IN ('simulator', 'misa')),
    environment         text        NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'production')),
    with_tax_code       boolean     NOT NULL DEFAULT true,              -- có mã của cơ quan thuế
    template_code       text        NOT NULL DEFAULT '1' CHECK (template_code IN ('1', '2')),
    connection          jsonb       NOT NULL DEFAULT '{}'::jsonb,       -- thông tin kết nối thường (mã ứng dụng, mã số thuế, tên đăng nhập)
    secret_value        bytea,                                          -- mật khẩu mã hóa AES-256-GCM
    simulation          text        NOT NULL DEFAULT 'normal' CHECK (simulation IN ('normal', 'pending_code', 'temporary_error', 'data_error', 'timeout', 'rejected')),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid        REFERENCES core.users(id),
    version             integer     NOT NULL DEFAULT 0,
    CHECK (NOT enabled OR start_date IS NOT NULL)
);

-- Ký hiệu hóa đơn theo năm (6 ký tự: C hoặc K, 2 số năm, T, 2 chữ cái).
CREATE TABLE finance.einvoice_series (
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    year                integer     NOT NULL CHECK (year BETWEEN 2000 AND 2099),
    series              text        NOT NULL CHECK (series ~ '^[CK][0-9]{2}T[A-Z]{2}$'),
    PRIMARY KEY (company_id, year)
);

-- Hóa đơn điện tử (CHUC_NANG_77 đến 79). Nội dung cố định khi lập.
CREATE TABLE finance.einvoices (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    source_document_id  uuid        NOT NULL REFERENCES inventory.documents(id),
    kind                text        NOT NULL DEFAULT 'original' CHECK (kind IN ('original', 'adjustment', 'replacement')),
    related_invoice_id  uuid        REFERENCES finance.einvoices(id),   -- hóa đơn gốc của hóa đơn điều chỉnh, thay thế
    reference_id        uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),  -- mã tham chiếu gửi nhà cung cấp, chống lập trùng
    provider            text        NOT NULL,
    invoice_date        date        NOT NULL,
    template_code       text        NOT NULL,
    series              text,
    invoice_no          text,
    with_tax_code       boolean     NOT NULL,
    tax_authority_code  text,
    provider_transaction_id text,
    seller              jsonb       NOT NULL,                           -- {name, taxCode, address}
    buyer               jsonb       NOT NULL,                           -- {partnerId, name, taxCode, address, anonymous}
    currency            text        NOT NULL,
    net_amount          numeric(20,4) NOT NULL,
    tax_amount          numeric(20,4) NOT NULL,
    total_amount        numeric(20,4) NOT NULL,
    note                text,
    status              text        NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'retrying', 'awaiting_code', 'issued', 'failed', 'rejected', 'setup_error')),
    replaced_by_id      uuid        REFERENCES finance.einvoices(id),
    last_error          text,
    attempt_count       integer     NOT NULL DEFAULT 0,
    next_attempt_at     timestamptz NOT NULL DEFAULT now(),
    due_date            date        NOT NULL,                           -- ngày làm việc tiếp theo ngày hóa đơn
    overdue_notified_at timestamptz,
    issued_at           timestamptz,
    pdf_content         bytea,
    xml_content         bytea,
    created_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX einvoices_original_source_idx ON finance.einvoices (source_document_id) WHERE kind = 'original';
CREATE UNIQUE INDEX einvoices_number_idx ON finance.einvoices (company_id, series, invoice_no) WHERE invoice_no IS NOT NULL;
CREATE INDEX einvoices_company_idx ON finance.einvoices (company_id, invoice_date DESC);
CREATE INDEX einvoices_sending_idx ON finance.einvoices (next_attempt_at) WHERE status IN ('pending', 'retrying', 'awaiting_code');

CREATE TABLE finance.einvoice_lines (
    invoice_id          uuid        NOT NULL REFERENCES finance.einvoices(id) ON DELETE CASCADE,
    line_no             integer     NOT NULL,
    item_code           text,
    item_name           text        NOT NULL,
    unit_name           text,
    quantity            numeric(20,4) NOT NULL,
    unit_price          numeric(20,4) NOT NULL,                         -- chưa thuế
    vat_rate            text        NOT NULL CHECK (vat_rate IN ('0', '5', '8', '10', 'exempt', 'not_declared')),
    net_amount          numeric(20,4) NOT NULL,
    tax_amount          numeric(20,4) NOT NULL,
    total_amount        numeric(20,4) NOT NULL,
    is_promotion        boolean     NOT NULL DEFAULT false,
    PRIMARY KEY (invoice_id, line_no)
);

-- Mỗi lần gọi nhà cung cấp; ghi trước khi gọi. Không lưu mật khẩu, mã truy cập.
CREATE TABLE finance.einvoice_attempts (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id          uuid        NOT NULL REFERENCES finance.einvoices(id) ON DELETE CASCADE,
    operation           text        NOT NULL CHECK (operation IN ('publish', 'status')),
    started_at          timestamptz NOT NULL DEFAULT now(),
    finished_at         timestamptz,
    outcome             text        CHECK (outcome IN ('issued', 'awaiting_code', 'rejected', 'temporary_error', 'data_error', 'unknown', 'not_found')),
    error_code          text,
    message             text
);
CREATE INDEX einvoice_attempts_invoice_idx ON finance.einvoice_attempts (invoice_id, started_at DESC);
