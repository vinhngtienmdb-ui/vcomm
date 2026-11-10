-- CONG_VIEC_14: Kế toán tổng hợp (MODULE_06, phần 2; tài liệu 16).
CREATE SCHEMA IF NOT EXISTS accounting;

-- Ngày khóa sổ của công ty đã khởi tạo kế toán (QUYTAC_NGHIEPVU_93, 97); chế độ kế toán lấy từ core.companies.accounting_regime. Không có dòng: chưa khởi tạo.
CREATE TABLE accounting.settings (
    company_id              uuid        PRIMARY KEY REFERENCES core.companies(id),
    locked_through          date,                                                   -- đã khóa sổ đến hết ngày này
    initialized_by          uuid        NOT NULL REFERENCES core.users(id),
    initialized_at          timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1
);

-- Hệ thống tài khoản của công ty (QUYTAC_NGHIEPVU_93).
CREATE TABLE accounting.accounts (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    code                    text        NOT NULL CHECK (code ~ '^[0-9A-Za-z]{3,20}$'),
    name                    text        NOT NULL,
    parent_id               uuid        REFERENCES accounting.accounts(id),
    nature                  text        NOT NULL CHECK (nature IN ('debit', 'credit', 'both')),
    is_system               boolean     NOT NULL DEFAULT false,                     -- nạp từ chế độ kế toán
    status                  text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);
CREATE INDEX accounts_parent_idx ON accounting.accounts (parent_id);

-- Định khoản mặc định: vai trò tài khoản dùng khi sinh bút toán (QUYTAC_NGHIEPVU_94).
CREATE TABLE accounting.posting_rules (
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    role                    text        NOT NULL,
    account_id              uuid        NOT NULL REFERENCES accounting.accounts(id),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    updated_by              uuid        REFERENCES core.users(id),
    PRIMARY KEY (company_id, role)
);

-- Bút toán (chứng từ kế toán): tự sinh từ chứng từ nghiệp vụ, phiếu kế toán nhập tay, kết chuyển khóa sổ (QUYTAC_NGHIEPVU_95 đến 97).
CREATE TABLE accounting.journals (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    journal_no              text,                                                   -- phiếu kế toán: cấp khi gửi; tự sinh: số chứng từ gốc
    journal_date            date        NOT NULL,
    source_type             text        NOT NULL CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing')),
    source_id               uuid,                                                   -- phiếu kho, phiếu thu chi, biên bản; kết chuyển, nhập tay: trống
    description             text        NOT NULL,
    status                  text        NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'pending', 'posted', 'rejected', 'withdrawn')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    total_amount            numeric(20,4) NOT NULL DEFAULT 0,                       -- tổng Nợ
    created_by              uuid        REFERENCES core.users(id),
    posted_at               timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    CHECK (source_type = 'manual' OR status = 'posted')
);
CREATE UNIQUE INDEX journals_source_idx ON accounting.journals (source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX journals_company_idx ON accounting.journals (company_id, status, journal_date);
CREATE INDEX journals_approval_idx ON accounting.journals (approval_request_id);

CREATE TABLE accounting.journal_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id              uuid        NOT NULL REFERENCES accounting.journals(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    account_id              uuid        NOT NULL REFERENCES accounting.accounts(id),
    partner_id              uuid        REFERENCES crm.partners(id),
    debit                   numeric(20,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit                  numeric(20,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    description             text,
    UNIQUE (journal_id, line_no),
    CHECK ((debit > 0) <> (credit > 0))
);
CREATE INDEX journal_lines_account_idx ON accounting.journal_lines (account_id);
CREATE INDEX journal_lines_partner_idx ON accounting.journal_lines (partner_id);
