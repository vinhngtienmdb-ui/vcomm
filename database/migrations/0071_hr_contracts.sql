-- CONG_VIEC_46 lát L1: hợp đồng lao động, phụ lục (QUYTAC_NGHIEPVU_297 đến 300; tài liệu 16). Tiền theo tiền tệ công ty, kiểu numeric.
CREATE TABLE hr.contracts (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    employee_id             uuid        NOT NULL REFERENCES hr.employees(id),
    kind                    text        NOT NULL CHECK (kind IN ('probation', 'fixed_term', 'indefinite')),
    document_no             text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'signed', 'rejected', 'withdrawn', 'cancelled', 'terminated')),
    effective_date          date        NOT NULL,
    end_date                date,
    job_title               text        NOT NULL CHECK (length(job_title) BETWEEN 1 AND 100),
    department_id           uuid        NOT NULL REFERENCES core.departments(id),
    branch_id               uuid        NOT NULL REFERENCES core.branches(id),
    salary                  numeric(20,4) NOT NULL CHECK (salary > 0),
    -- Thử việc: mức công việc (Bộ luật Lao động Điều 25) và mức lương chính thức để kiểm 85% (Điều 26).
    probation_level         text        CHECK (probation_level IN ('manager', 'college', 'intermediate', 'other')),
    official_salary         numeric(20,4) CHECK (official_salary > 0),
    payment_method          text        NOT NULL DEFAULT 'transfer' CHECK (payment_method IN ('transfer', 'cash')),
    signer_name             text        NOT NULL,
    signer_title            text        NOT NULL,
    other_terms             text,
    legal_exception_reason  text,
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    sign_date               date,
    signed_file_name        text,
    signed_content_type     text,
    signed_size_bytes       integer,
    signed_storage_key      text        UNIQUE,
    cancel_reason           text,
    termination_date        date,
    termination_reason      text        CHECK (termination_reason IN ('expired', 'completed', 'mutual', 'employee_unilateral', 'employer_unilateral', 'redundancy', 'disciplinary', 'probation_failed', 'death', 'other')),
    termination_note        text,
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    CHECK ((kind = 'indefinite') = (end_date IS NULL)),
    CHECK (end_date IS NULL OR end_date >= effective_date),
    CHECK ((kind = 'probation') = (probation_level IS NOT NULL AND official_salary IS NOT NULL)),
    CHECK ((status IN ('signed', 'terminated')) = (sign_date IS NOT NULL AND signed_storage_key IS NOT NULL)),
    CHECK ((status = 'terminated') = (termination_date IS NOT NULL AND termination_reason IS NOT NULL)),
    CHECK (termination_date IS NULL OR termination_date >= effective_date)
);
CREATE UNIQUE INDEX contracts_document_no_idx ON hr.contracts (company_id, document_no) WHERE document_no IS NOT NULL;
CREATE INDEX contracts_employee_idx ON hr.contracts (employee_id);

CREATE TABLE hr.contract_appendices (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    contract_id             uuid        NOT NULL REFERENCES hr.contracts(id),
    sequence_no             integer,
    document_no             text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'signed', 'rejected', 'withdrawn', 'cancelled')),
    effective_date          date        NOT NULL,
    -- Trống là không đổi so với giá trị trước đó. Không có trường thời hạn (Bộ luật Lao động Điều 22 khoản 2).
    job_title               text        CHECK (length(job_title) BETWEEN 1 AND 100),
    department_id           uuid        REFERENCES core.departments(id),
    branch_id               uuid        REFERENCES core.branches(id),
    salary                  numeric(20,4) CHECK (salary > 0),
    payment_method          text        CHECK (payment_method IN ('transfer', 'cash')),
    replaces_allowances     boolean     NOT NULL DEFAULT false,
    description             text        NOT NULL CHECK (length(description) BETWEEN 1 AND 4000),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    sign_date               date,
    signed_file_name        text,
    signed_content_type     text,
    signed_size_bytes       integer,
    signed_storage_key      text        UNIQUE,
    cancel_reason           text,
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (contract_id, sequence_no),
    CHECK ((status = 'signed') = (sign_date IS NOT NULL AND signed_storage_key IS NOT NULL))
);
CREATE INDEX contract_appendices_contract_idx ON hr.contract_appendices (contract_id);

-- Phụ cấp theo tháng của hợp đồng (appendix_id trống) hoặc danh sách thay thế của phụ lục.
CREATE TABLE hr.contract_allowances (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     uuid        NOT NULL REFERENCES hr.contracts(id),
    appendix_id     uuid        REFERENCES hr.contract_appendices(id),
    sort_order      integer     NOT NULL,
    name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    amount          numeric(20,4) NOT NULL CHECK (amount > 0)
);
CREATE INDEX contract_allowances_contract_idx ON hr.contract_allowances (contract_id, appendix_id);
