-- CONG_VIEC_54 lát L2: đánh giá hiệu suất (QUYTAC_NGHIEPVU_389; tài liệu 16).

CREATE TABLE hr.review_templates (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  uuid        NOT NULL REFERENCES core.companies(id),
    name        text        NOT NULL CHECK (length(name) BETWEEN 1 AND 150),
    created_by  uuid        NOT NULL REFERENCES core.users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    version     integer     NOT NULL DEFAULT 1
);
CREATE INDEX review_templates_company_idx ON hr.review_templates (company_id);

-- Tiêu chí năng lực; tổng trọng số của mẫu là 100 (kiểm ở dịch vụ).
CREATE TABLE hr.review_criteria (
    id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id  uuid    NOT NULL REFERENCES hr.review_templates(id),
    position     integer NOT NULL,
    name         text    NOT NULL CHECK (length(name) BETWEEN 1 AND 150),
    description  text    CHECK (length(description) <= 1000),
    weight       integer NOT NULL CHECK (weight BETWEEN 1 AND 100),
    UNIQUE (template_id, position)
);

CREATE TABLE hr.review_cycles (
    id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id         uuid         NOT NULL REFERENCES core.companies(id),
    name               text         NOT NULL CHECK (length(name) BETWEEN 1 AND 150),
    period_from        date         NOT NULL,
    period_to          date         NOT NULL,
    template_id        uuid         NOT NULL REFERENCES hr.review_templates(id),
    goal_weight        integer      NOT NULL CHECK (goal_weight BETWEEN 0 AND 100),
    competency_weight  integer      NOT NULL CHECK (competency_weight BETWEEN 0 AND 100),
    threshold_a        numeric(3,2) NOT NULL,
    threshold_b        numeric(3,2) NOT NULL,
    threshold_c        numeric(3,2) NOT NULL,
    goal_deadline      date         NOT NULL,
    self_deadline      date         NOT NULL,
    manager_deadline   date         NOT NULL,
    all_departments    boolean      NOT NULL DEFAULT true,
    status             text         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'published')),
    opened_at          timestamptz,
    closed_at          timestamptz,
    published_at       timestamptz,
    created_by         uuid         NOT NULL REFERENCES core.users(id),
    created_at         timestamptz  NOT NULL DEFAULT now(),
    updated_at         timestamptz  NOT NULL DEFAULT now(),
    version            integer      NOT NULL DEFAULT 1,
    CHECK (period_to >= period_from),
    CHECK (goal_weight + competency_weight = 100),
    CHECK (threshold_a <= 5 AND threshold_a > threshold_b AND threshold_b > threshold_c AND threshold_c >= 1),
    CHECK (goal_deadline <= self_deadline AND self_deadline <= manager_deadline)
);
CREATE INDEX review_cycles_company_idx ON hr.review_cycles (company_id, status);

CREATE TABLE hr.review_cycle_departments (
    cycle_id       uuid NOT NULL REFERENCES hr.review_cycles(id),
    department_id  uuid NOT NULL REFERENCES core.departments(id),
    PRIMARY KEY (cycle_id, department_id)
);

-- Phiếu đánh giá của một hồ sơ nhân sự trong kỳ. reviewer_id: người chấm (tài khoản).
CREATE TABLE hr.reviews (
    id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            uuid         NOT NULL REFERENCES core.companies(id),
    cycle_id              uuid         NOT NULL REFERENCES hr.review_cycles(id),
    employee_id           uuid         NOT NULL REFERENCES hr.employees(id),
    department_id         uuid         REFERENCES core.departments(id),
    reviewer_id           uuid         REFERENCES core.users(id),
    goals_confirmed_at    timestamptz,
    self_submitted_at     timestamptz,
    manager_submitted_at  timestamptz,
    goal_score            numeric(4,2),
    competency_score      numeric(4,2),
    total_score           numeric(4,2),
    adjusted_score        numeric(4,2) CHECK (adjusted_score BETWEEN 1 AND 5),
    adjustment_reason     text         CHECK (length(adjustment_reason) <= 1000),
    manager_comment       text         CHECK (length(manager_comment) <= 4000),
    self_comment          text         CHECK (length(self_comment) <= 4000),
    excluded_at           timestamptz,
    excluded_reason       text         CHECK (length(excluded_reason) <= 500),
    acknowledged_at       timestamptz,
    employee_comment      text         CHECK (length(employee_comment) <= 2000),
    created_at            timestamptz  NOT NULL DEFAULT now(),
    updated_at            timestamptz  NOT NULL DEFAULT now(),
    version               integer      NOT NULL DEFAULT 1,
    UNIQUE (cycle_id, employee_id),
    CHECK ((adjusted_score IS NULL) = (adjustment_reason IS NULL))
);
CREATE INDEX reviews_reviewer_idx ON hr.reviews (reviewer_id);
CREATE INDEX reviews_employee_idx ON hr.reviews (employee_id);

CREATE TABLE hr.review_goals (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       uuid    NOT NULL REFERENCES hr.reviews(id),
    position        integer NOT NULL,
    name            text    NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    target          text    CHECK (length(target) <= 1000),
    weight          integer NOT NULL CHECK (weight BETWEEN 1 AND 100),
    self_score      integer CHECK (self_score BETWEEN 1 AND 5),
    manager_score   integer CHECK (manager_score BETWEEN 1 AND 5),
    UNIQUE (review_id, position)
);

-- Điểm tiêu chí năng lực của phiếu; tiêu chí chép từ mẫu khi mở kỳ (mẫu đã dùng không sửa).
CREATE TABLE hr.review_criterion_scores (
    review_id      uuid    NOT NULL REFERENCES hr.reviews(id),
    criterion_id   uuid    NOT NULL REFERENCES hr.review_criteria(id),
    self_score     integer CHECK (self_score BETWEEN 1 AND 5),
    manager_score  integer CHECK (manager_score BETWEEN 1 AND 5),
    PRIMARY KEY (review_id, criterion_id)
);

-- Nhắc quá hạn: mỗi hạn mỗi phiếu một lần.
CREATE TABLE hr.review_reminders (
    review_id  uuid        NOT NULL REFERENCES hr.reviews(id),
    kind       text        NOT NULL CHECK (kind IN ('goal', 'manager')),
    sent_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (review_id, kind)
);
