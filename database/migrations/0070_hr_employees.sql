-- CONG_VIEC_46: Nhân sự phần 1 (MODULE_08) – hồ sơ nhân sự, giấy tờ, người phụ thuộc, quá trình công tác (tài liệu 16).
-- Cột *_encrypted mã hóa AES-256-GCM ở máy chủ (QUYTAC_NGHIEPVU_295); *_last4 dùng hiện dạng che; identity_hash là mã băm có khóa để kiểm trùng.
CREATE SCHEMA IF NOT EXISTS hr;

CREATE TABLE hr.employees (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  uuid        NOT NULL REFERENCES core.companies(id),
    user_id                     uuid        REFERENCES core.users(id),
    code                        text        NOT NULL CHECK (length(code) BETWEEN 1 AND 20),
    full_name                   text        NOT NULL CHECK (length(full_name) BETWEEN 1 AND 200),
    gender                      text        NOT NULL CHECK (gender IN ('male', 'female')),
    birth_date                  date        NOT NULL,
    nationality                 text        NOT NULL DEFAULT 'VN' CHECK (nationality ~ '^[A-Z]{2}$'),
    identity_kind               text        NOT NULL CHECK (identity_kind IN ('citizen_id', 'passport')),
    identity_encrypted          bytea       NOT NULL,
    identity_last4              text        NOT NULL,
    identity_hash               bytea       NOT NULL,
    residence                   text        NOT NULL,
    phone                       text,
    personal_email              text,
    contact_address             text,
    marital_status              text        CHECK (marital_status IN ('single', 'married', 'other')),
    education_level             text        CHECK (education_level IN ('none', 'elementary', 'intermediate', 'college', 'university', 'master', 'doctorate')),
    major                       text,
    tax_code_encrypted          bytea,
    tax_code_last4              text,
    social_insurance_encrypted  bytea,
    social_insurance_last4      text,
    bank_name                   text,
    bank_account_encrypted      bytea,
    bank_account_last4          text,
    bank_account_holder         text,
    work_permit_encrypted       bytea,
    work_permit_last4           text,
    work_permit_expiry          date,
    emergency_contact           text,
    hire_date                   date        NOT NULL,
    status                      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'terminated')),
    termination_date            date,
    termination_reason          text,
    termination_note            text,
    created_by                  uuid        NOT NULL REFERENCES core.users(id),
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    version                     integer     NOT NULL DEFAULT 1,
    CHECK ((nationality = 'VN') = (identity_kind = 'citizen_id'))
);
CREATE UNIQUE INDEX employees_code_idx ON hr.employees (company_id, lower(code));
CREATE UNIQUE INDEX employees_user_idx ON hr.employees (company_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX employees_identity_idx ON hr.employees (company_id, identity_hash) WHERE status = 'active';

-- Tệp giấy tờ (bản sao điện tử). Văn bản đồng ý xử lý dữ liệu có ngày đồng ý (QUYTAC_NGHIEPVU_295).
CREATE TABLE hr.employee_documents (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    employee_id     uuid        NOT NULL REFERENCES hr.employees(id),
    kind            text        NOT NULL CHECK (kind IN ('identity_image', 'qualification', 'health_certificate', 'resume', 'data_consent', 'guardian_consent', 'other')),
    file_name       text        NOT NULL,
    content_type    text        NOT NULL,
    size_bytes      integer     NOT NULL CHECK (size_bytes > 0),
    storage_key     text        NOT NULL UNIQUE,
    consent_date    date,
    uploaded_by     uuid        NOT NULL REFERENCES core.users(id),
    uploaded_at     timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind = 'data_consent') = (consent_date IS NOT NULL))
);
CREATE INDEX employee_documents_employee_idx ON hr.employee_documents (employee_id);

CREATE TABLE hr.dependents (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    employee_id         uuid        NOT NULL REFERENCES hr.employees(id),
    full_name           text        NOT NULL,
    relationship        text        NOT NULL CHECK (relationship IN ('child', 'spouse', 'parent', 'other')),
    birth_date          date        NOT NULL,
    identity_encrypted  bytea,
    identity_last4      text,
    deduction_from      date        NOT NULL CHECK (extract(day FROM deduction_from) = 1),
    deduction_to        date        CHECK (extract(day FROM deduction_to) = 1),
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    CHECK (deduction_to IS NULL OR deduction_to >= deduction_from)
);
CREATE INDEX dependents_employee_idx ON hr.dependents (employee_id);

-- Quá trình công tác (QUYTAC_NGHIEPVU_296). Trống ở phòng ban, chi nhánh, chức danh nghĩa là không đổi.
-- applied_at: lúc đã cập nhật thành viên công ty của tài khoản liên kết.
CREATE TABLE hr.work_events (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    employee_id     uuid        NOT NULL REFERENCES hr.employees(id),
    kind            text        NOT NULL CHECK (kind IN ('hire', 'transfer', 'title_change', 'contract', 'termination')),
    effective_date  date        NOT NULL,
    decision_no     text        CHECK (length(decision_no) <= 50),
    department_id   uuid        REFERENCES core.departments(id),
    branch_id       uuid        REFERENCES core.branches(id),
    job_title       text        CHECK (length(job_title) <= 100),
    note            text,
    source_type     text        NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'contract', 'appendix')),
    source_id       uuid,
    applied_at      timestamptz,
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    UNIQUE (employee_id, effective_date),
    CHECK (kind <> 'hire' OR (department_id IS NOT NULL AND branch_id IS NOT NULL AND job_title IS NOT NULL)),
    CHECK (kind = 'termination' OR department_id IS NOT NULL OR branch_id IS NOT NULL OR job_title IS NOT NULL)
);
CREATE INDEX work_events_pending_idx ON hr.work_events (effective_date) WHERE applied_at IS NULL;
