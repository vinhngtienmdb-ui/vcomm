-- CONG_VIEC_47: tăng ca, dòng bảng công tháng (QUYTAC_NGHIEPVU_310, 311; tài liệu 16).

-- Phiếu tăng ca. consent_status: agreed (người lao động tự lập hoặc bấm Đồng ý), document (nhân sự ghi nhận kèm văn bản đồng ý), pending, declined.
-- day_kind: weekday (ngày thường), rest_day (nghỉ hằng tuần), holiday (lễ, tết, ngày nghỉ có hưởng lương) – Bộ luật Lao động Điều 98.
CREATE TABLE hr.overtime_requests (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    employee_id         uuid        NOT NULL REFERENCES hr.employees(id),
    request_no          text        NOT NULL,
    work_date           date        NOT NULL,
    start_at            timestamptz NOT NULL,
    end_at              timestamptz NOT NULL,
    hours               numeric(5,2) NOT NULL CHECK (hours > 0 AND hours <= 12),
    day_kind            text        NOT NULL CHECK (day_kind IN ('weekday', 'rest_day', 'holiday')),
    work_content        text        NOT NULL CHECK (length(work_content) BETWEEN 1 AND 500),
    work_location       text        NOT NULL CHECK (length(work_location) BETWEEN 1 AND 200),
    consent_status      text        NOT NULL CHECK (consent_status IN ('pending', 'agreed', 'declined', 'document')),
    consent_at          timestamptz,
    consent_file_key    text,
    consent_file_name   text,
    consent_file_type   text,
    status              text        NOT NULL CHECK (status IN ('awaiting_consent', 'declined', 'pending', 'approved', 'rejected', 'withdrawn', 'cancelled')),
    approval_request_id uuid        REFERENCES core.approval_requests(id),
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz,
    cancel_reason       text,
    cancelled_by        uuid        REFERENCES core.users(id),
    cancelled_at        timestamptz,
    CHECK (end_at > start_at AND end_at - start_at <= interval '12 hours'),
    CHECK ((consent_status = 'document') = (consent_file_key IS NOT NULL))
);
CREATE INDEX overtime_requests_employee_idx ON hr.overtime_requests (employee_id, work_date);

-- Giờ tăng ca được tính trong công ngày (phút): phần ban ngày, phần đêm, phần đêm sau khi đã tăng ca ban ngày cùng ngày (Nghị định 145 Điều 57).
ALTER TABLE hr.attendance_days
    ADD COLUMN overtime_kind                       text CHECK (overtime_kind IN ('weekday', 'rest_day', 'holiday')),
    ADD COLUMN overtime_day_minutes                integer NOT NULL DEFAULT 0,
    ADD COLUMN overtime_night_minutes              integer NOT NULL DEFAULT 0,
    ADD COLUMN overtime_night_after_day_minutes    integer NOT NULL DEFAULT 0;

-- Dòng bảng công tháng: mỗi hồ sơ có khoảng làm việc giao với tháng. Kỳ đã chốt thì dòng đóng băng; CONG_VIEC_48 chỉ đọc dòng của kỳ đã chốt.
-- Đơn vị "công" theo hệ số ca (ca đủ 1, ca nửa ngày 0,5); giờ là giờ thập phân.
CREATE TABLE hr.timesheet_lines (
    id                                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id                               uuid        NOT NULL REFERENCES hr.timesheet_periods(id),
    company_id                              uuid        NOT NULL REFERENCES core.companies(id),
    employee_id                             uuid        NOT NULL REFERENCES hr.employees(id),
    department_id                           uuid        REFERENCES core.departments(id),
    branch_id                               uuid        REFERENCES core.branches(id),
    employment_from                         date        NOT NULL,
    employment_to                           date        NOT NULL,
    month_standard_units                    numeric(6,2) NOT NULL DEFAULT 0,
    standard_units                          numeric(6,2) NOT NULL DEFAULT 0,
    standard_hours                          numeric(6,2) NOT NULL DEFAULT 0,
    worked_units                            numeric(6,2) NOT NULL DEFAULT 0,
    worked_hours                            numeric(6,2) NOT NULL DEFAULT 0,
    holiday_units                           numeric(6,2) NOT NULL DEFAULT 0,
    annual_leave_units                      numeric(6,2) NOT NULL DEFAULT 0,
    paid_personal_leave_units               numeric(6,2) NOT NULL DEFAULT 0,
    other_paid_leave_units                  numeric(6,2) NOT NULL DEFAULT 0,
    unpaid_leave_units                      numeric(6,2) NOT NULL DEFAULT 0,
    social_insurance_leave_units            numeric(6,2) NOT NULL DEFAULT 0,
    absent_units                            numeric(6,2) NOT NULL DEFAULT 0,
    paid_units                              numeric(6,2) NOT NULL DEFAULT 0,
    night_hours                             numeric(6,2) NOT NULL DEFAULT 0,
    overtime_weekday_hours                  numeric(6,2) NOT NULL DEFAULT 0,
    overtime_weekday_night_hours            numeric(6,2) NOT NULL DEFAULT 0,
    overtime_weekday_night_after_day_hours  numeric(6,2) NOT NULL DEFAULT 0,
    overtime_rest_day_hours                 numeric(6,2) NOT NULL DEFAULT 0,
    overtime_rest_day_night_hours           numeric(6,2) NOT NULL DEFAULT 0,
    overtime_holiday_hours                  numeric(6,2) NOT NULL DEFAULT 0,
    overtime_holiday_night_hours            numeric(6,2) NOT NULL DEFAULT 0,
    late_count                              integer     NOT NULL DEFAULT 0,
    late_minutes                            integer     NOT NULL DEFAULT 0,
    early_leave_count                       integer     NOT NULL DEFAULT 0,
    early_leave_minutes                     integer     NOT NULL DEFAULT 0,
    annual_leave_payout_units               numeric(6,2) NOT NULL DEFAULT 0,
    annual_leave_balance_end                numeric(6,2) NOT NULL DEFAULT 0,
    confirmation_status                     text        NOT NULL DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'disputed', 'auto_confirmed')),
    confirmed_at                            timestamptz,
    dispute_note                            text,
    dispute_reply                           text,
    updated_at                              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (period_id, employee_id)
);
CREATE INDEX timesheet_lines_employee_idx ON hr.timesheet_lines (employee_id);
