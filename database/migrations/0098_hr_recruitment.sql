-- CONG_VIEC_54: Nhân sự phần 4 (MODULE_08) – nhu cầu tuyển dụng, tin tuyển dụng, ứng viên, đồng ý, hồ sơ ứng tuyển (tài liệu 16).
-- Ứng viên bị xóa thì khử nhận dạng (QUYTAC_NGHIEPVU_388): các cột cá nhân về NULL hoặc giá trị thay thế, erased_at ghi thời điểm.

-- Cài đặt lưu giữ dữ liệu ứng viên theo công ty; không có dòng thì dùng mặc định 30 ngày, 12 tháng.
CREATE TABLE hr.recruitment_settings (
    company_id              uuid        PRIMARY KEY REFERENCES core.companies(id),
    rejected_retention_days integer     NOT NULL DEFAULT 30 CHECK (rejected_retention_days BETWEEN 0 AND 90),
    pool_retention_months   integer     NOT NULL DEFAULT 12 CHECK (pool_retention_months BETWEEN 1 AND 24),
    updated_by              uuid        NOT NULL REFERENCES core.users(id),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hr.recruitment_requests (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    document_no         text,
    department_id       uuid          NOT NULL REFERENCES core.departments(id),
    branch_id           uuid          NOT NULL REFERENCES core.branches(id),
    job_title           text          NOT NULL CHECK (length(job_title) BETWEEN 1 AND 100),
    headcount           integer       NOT NULL CHECK (headcount BETWEEN 1 AND 100),
    contract_kind       text          NOT NULL CHECK (contract_kind IN ('probation_then_official', 'fixed_term', 'indefinite')),
    salary_min          numeric(18,2) NOT NULL CHECK (salary_min > 0),
    salary_max          numeric(18,2) NOT NULL,
    needed_by           date          NOT NULL,
    reason              text          NOT NULL CHECK (reason IN ('replacement', 'expansion', 'new_position')),
    description         text          CHECK (length(description) <= 4000),
    status              text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'cancelled', 'completed', 'closed')),
    approval_request_id uuid,
    hired_count         integer       NOT NULL DEFAULT 0 CHECK (hired_count >= 0),
    cancel_reason       text,
    close_reason        text,
    closed_at           timestamptz,
    created_by          uuid          NOT NULL REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    CHECK (salary_max >= salary_min),
    CHECK (hired_count <= headcount)
);
CREATE UNIQUE INDEX recruitment_requests_document_idx ON hr.recruitment_requests (company_id, document_no) WHERE document_no IS NOT NULL;
CREATE INDEX recruitment_requests_company_idx ON hr.recruitment_requests (company_id, status);

CREATE TABLE hr.job_postings (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid          NOT NULL REFERENCES core.companies(id),
    request_id      uuid          NOT NULL REFERENCES hr.recruitment_requests(id),
    title           text          NOT NULL CHECK (length(title) BETWEEN 1 AND 150),
    location        text          NOT NULL CHECK (length(location) BETWEEN 1 AND 100),
    work_type       text          NOT NULL CHECK (work_type IN ('full_time', 'part_time')),
    description     text          NOT NULL CHECK (length(description) BETWEEN 1 AND 8000),
    requirements    text          CHECK (length(requirements) <= 8000),
    benefits        text          CHECK (length(benefits) <= 8000),
    salary_display  text          NOT NULL CHECK (salary_display IN ('request_range', 'custom_range', 'negotiable')),
    salary_min      numeric(18,2),
    salary_max      numeric(18,2),
    deadline        date          NOT NULL,
    contact_email   text          NOT NULL,
    is_public       boolean       NOT NULL DEFAULT true,
    status          text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
    published_at    timestamptz,
    closed_at       timestamptz,
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    version         integer       NOT NULL DEFAULT 1,
    CHECK ((salary_display = 'custom_range') = (salary_min IS NOT NULL AND salary_max IS NOT NULL)),
    CHECK (salary_max IS NULL OR salary_max >= salary_min)
);
CREATE INDEX job_postings_request_idx ON hr.job_postings (request_id);
CREATE INDEX job_postings_public_idx ON hr.job_postings (published_at DESC) WHERE status = 'open' AND is_public;

-- Ứng viên thuộc công ty của tin (bên kiểm soát dữ liệu). reference là mã hồ sơ báo cho ứng viên khi nộp công khai.
-- email_key, phone_key: dạng chuẩn hóa để đánh dấu "Có thể trùng" (QUYTAC_NGHIEPVU_383).
CREATE TABLE hr.candidates (
    id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        uuid          NOT NULL REFERENCES core.companies(id),
    reference         text          NOT NULL UNIQUE,
    full_name         text          NOT NULL CHECK (length(full_name) BETWEEN 1 AND 200),
    email             text,
    phone             text,
    email_key         text,
    phone_key         text,
    province          text          CHECK (length(province) <= 100),
    education_level   text          CHECK (education_level IN ('none', 'elementary', 'intermediate', 'college', 'university', 'master', 'doctorate')),
    experience_years  integer       CHECK (experience_years BETWEEN 0 AND 50),
    expected_salary   numeric(18,2) CHECK (expected_salary > 0),
    cover_letter      text          CHECK (length(cover_letter) <= 2000),
    source            text          NOT NULL CHECK (source IN ('careers_page', 'referral', 'job_board', 'email', 'other')),
    source_note       text          CHECK (length(source_note) <= 200),
    locale            text          NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
    erase_due         date,
    erased_at         timestamptz,
    erasure_reason    text          CHECK (erasure_reason IN ('retention', 'request')),
    created_by        uuid          REFERENCES core.users(id),
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    version           integer       NOT NULL DEFAULT 1,
    CHECK (erased_at IS NOT NULL OR (email IS NOT NULL AND phone IS NOT NULL))
);
CREATE INDEX candidates_company_idx ON hr.candidates (company_id, created_at DESC);
CREATE INDEX candidates_email_idx ON hr.candidates (company_id, email_key) WHERE erased_at IS NULL;
CREATE INDEX candidates_phone_idx ON hr.candidates (company_id, phone_key) WHERE erased_at IS NULL;
CREATE INDEX candidates_erase_idx ON hr.candidates (erase_due) WHERE erased_at IS NULL AND erase_due IS NOT NULL;

-- Tệp của ứng viên: sơ yếu lý lịch, bằng chứng đồng ý, bằng chứng yêu cầu xóa. storage_key NULL khi đã xóa tệp.
CREATE TABLE hr.candidate_files (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    candidate_id    uuid        NOT NULL REFERENCES hr.candidates(id),
    kind            text        NOT NULL CHECK (kind IN ('resume', 'consent_evidence', 'erasure_evidence')),
    file_name       text        NOT NULL,
    content_type    text        NOT NULL,
    size_bytes      integer     NOT NULL CHECK (size_bytes > 0),
    storage_key     text        UNIQUE,
    uploaded_by     uuid        REFERENCES core.users(id),
    uploaded_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX candidate_files_candidate_idx ON hr.candidate_files (candidate_id);

-- Bằng chứng đồng ý (Nghị định 356/2025/NĐ-CP Điều 6): nguyên văn điều khoản, thời điểm, IP, trình duyệt hoặc tệp bằng chứng.
CREATE TABLE hr.candidate_consents (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        uuid        NOT NULL REFERENCES core.companies(id),
    candidate_id      uuid        NOT NULL REFERENCES hr.candidates(id),
    purpose           text        NOT NULL CHECK (purpose IN ('recruitment', 'talent_pool')),
    posting_id        uuid        REFERENCES hr.job_postings(id),
    channel           text        NOT NULL CHECK (channel IN ('careers_page', 'manual')),
    terms_version     text,
    terms_text        text,
    locale            text,
    consented_on      date        NOT NULL,
    consented_at      timestamptz NOT NULL DEFAULT now(),
    ip                text,
    user_agent        text,
    evidence_file_id  uuid        REFERENCES hr.candidate_files(id),
    withdrawn_at      timestamptz,
    recorded_by       uuid        REFERENCES core.users(id),
    CHECK (channel <> 'manual' OR evidence_file_id IS NOT NULL)
);
CREATE INDEX candidate_consents_candidate_idx ON hr.candidate_consents (candidate_id);

-- Hồ sơ ứng tuyển: ứng viên × tin. ended_at khác NULL là đã kết thúc (bị loại, ứng viên rút), không mở lại.
CREATE TABLE hr.applications (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    candidate_id    uuid        NOT NULL REFERENCES hr.candidates(id),
    posting_id      uuid        NOT NULL REFERENCES hr.job_postings(id),
    stage           text        NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'screening', 'interview', 'offer', 'hired')),
    outcome         text        CHECK (outcome IN ('rejected', 'withdrawn')),
    outcome_reason  text        CHECK (outcome_reason IN ('not_qualified', 'failed_interview', 'declined_offer', 'unreachable', 'posting_closed', 'other')),
    outcome_note    text        CHECK (length(outcome_note) <= 1000),
    ended_at        timestamptz,
    employee_id     uuid        REFERENCES hr.employees(id),
    created_by      uuid        REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    CHECK ((outcome IS NULL) = (ended_at IS NULL)),
    CHECK (outcome <> 'rejected' OR outcome_reason IS NOT NULL)
);
CREATE UNIQUE INDEX applications_open_idx ON hr.applications (candidate_id, posting_id) WHERE ended_at IS NULL;
CREATE INDEX applications_posting_idx ON hr.applications (posting_id);
CREATE INDEX applications_candidate_idx ON hr.applications (candidate_id);
