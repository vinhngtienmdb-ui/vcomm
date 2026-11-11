-- CONG_VIEC_54 lát L1: vòng phỏng vấn, phiếu đánh giá, email cho ứng viên, đề nghị nhận việc (tài liệu 16).

CREATE TABLE hr.interviews (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        uuid        NOT NULL REFERENCES core.companies(id),
    application_id    uuid        NOT NULL REFERENCES hr.applications(id),
    name              text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    starts_at         timestamptz NOT NULL,
    duration_minutes  integer     NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480),
    mode              text        NOT NULL CHECK (mode IN ('onsite', 'online')),
    location          text        CHECK (length(location) <= 300),
    meeting_url       text        CHECK (length(meeting_url) <= 500),
    status            text        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    -- Số thứ tự bản lịch (SEQUENCE của iCalendar): tăng mỗi lần đổi giờ, hủy.
    calendar_sequence integer     NOT NULL DEFAULT 0,
    created_by        uuid        NOT NULL REFERENCES core.users(id),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    version           integer     NOT NULL DEFAULT 1,
    CHECK ((mode = 'onsite') = (location IS NOT NULL)),
    CHECK ((mode = 'online') = (meeting_url IS NOT NULL))
);
CREATE INDEX interviews_application_idx ON hr.interviews (application_id);

CREATE TABLE hr.interview_interviewers (
    interview_id  uuid NOT NULL REFERENCES hr.interviews(id),
    user_id       uuid NOT NULL REFERENCES core.users(id),
    PRIMARY KEY (interview_id, user_id)
);
CREATE INDEX interview_interviewers_user_idx ON hr.interview_interviewers (user_id);

-- Mỗi người phỏng vấn một phiếu mỗi vòng (QUYTAC_NGHIEPVU_384). comment xóa khi xóa ứng viên.
CREATE TABLE hr.interview_evaluations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    interview_id    uuid        NOT NULL REFERENCES hr.interviews(id),
    interviewer_id  uuid        NOT NULL REFERENCES core.users(id),
    score           integer     NOT NULL CHECK (score BETWEEN 1 AND 5),
    recommendation  text        NOT NULL CHECK (recommendation IN ('pass', 'consider', 'fail')),
    comment         text        CHECK (length(comment) <= 4000),
    submitted_at    timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (interview_id, interviewer_id)
);

-- Lịch sử email gửi ứng viên (QUYTAC_NGHIEPVU_385); recipient, body NULL khi xóa ứng viên.
CREATE TABLE hr.candidate_emails (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    candidate_id    uuid        NOT NULL REFERENCES hr.candidates(id),
    application_id  uuid        REFERENCES hr.applications(id),
    kind            text        NOT NULL CHECK (kind IN ('interview_invitation', 'interview_update', 'interview_cancellation', 'rejection', 'offer')),
    recipient       text,
    subject         text        NOT NULL,
    body            text,
    sent_by         uuid        NOT NULL REFERENCES core.users(id),
    sent_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX candidate_emails_candidate_idx ON hr.candidate_emails (candidate_id);

-- Đề nghị nhận việc (QUYTAC_NGHIEPVU_386). Liên kết trả lời: chỉ lưu mã băm SHA-256.
CREATE TABLE hr.job_offers (
    id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                  uuid          NOT NULL REFERENCES core.companies(id),
    application_id              uuid          NOT NULL REFERENCES hr.applications(id),
    document_no                 text,
    job_title                   text          NOT NULL CHECK (length(job_title) BETWEEN 1 AND 100),
    department_id               uuid          NOT NULL REFERENCES core.departments(id),
    branch_id                   uuid          NOT NULL REFERENCES core.branches(id),
    contract_kind               text          NOT NULL CHECK (contract_kind IN ('probation_then_official', 'fixed_term', 'indefinite')),
    salary                      numeric(18,2) NOT NULL CHECK (salary > 0),
    start_date                  date          NOT NULL,
    response_deadline           date          NOT NULL,
    note                        text          CHECK (length(note) <= 2000),
    outside_range_reason        text          CHECK (length(outside_range_reason) <= 500),
    status                      text          NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
    approval_request_id         uuid,
    sent_at                     timestamptz,
    response_token_hash         bytea         UNIQUE,
    response_token_expires_at   timestamptz,
    responded_at                timestamptz,
    response_channel            text          CHECK (response_channel IN ('link', 'manual')),
    response_note               text          CHECK (length(response_note) <= 500),
    response_ip                 text,
    response_user_agent         text,
    cancel_reason               text,
    created_by                  uuid          NOT NULL REFERENCES core.users(id),
    created_at                  timestamptz   NOT NULL DEFAULT now(),
    updated_at                  timestamptz   NOT NULL DEFAULT now(),
    version                     integer       NOT NULL DEFAULT 1,
    CHECK (response_deadline < start_date)
);
CREATE UNIQUE INDEX job_offers_document_idx ON hr.job_offers (company_id, document_no) WHERE document_no IS NOT NULL;
-- Mỗi hồ sơ ứng tuyển tối đa một đề nghị chưa kết thúc.
CREATE UNIQUE INDEX job_offers_open_idx ON hr.job_offers (application_id) WHERE status NOT IN ('declined', 'expired', 'cancelled');
