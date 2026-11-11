-- CONG_VIEC_47: nghỉ phép – loại nghỉ, chế độ phép năm, sổ phép, đơn nghỉ (QUYTAC_NGHIEPVU_307 đến 309; tài liệu 16).

-- Loại nghỉ của công ty. system_code: loại tạo sẵn theo Bộ luật Lao động Điều 113, 115 và chế độ bảo hiểm xã hội (không xóa, chỉ đổi tên).
-- pay_group: annual (phép năm, trừ sổ phép), paid_personal (việc riêng có lương), paid_other (có lương do công ty thêm), unpaid, social_insurance.
CREATE TABLE hr.leave_types (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    system_code         text        CHECK (system_code IN ('annual', 'marriage', 'child_marriage', 'bereavement', 'unpaid_personal', 'unpaid_agreed', 'sick', 'maternity', 'work_accident')),
    name                text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    pay_group           text        NOT NULL CHECK (pay_group IN ('annual', 'paid_personal', 'paid_other', 'unpaid', 'social_insurance')),
    per_event_days      numeric(4,1) CHECK (per_event_days > 0),
    yearly_max_days     numeric(5,1) CHECK (yearly_max_days > 0),
    requires_attachment boolean     NOT NULL DEFAULT false,
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by          uuid        REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX leave_types_system_idx ON hr.leave_types (company_id, system_code) WHERE system_code IS NOT NULL;
CREATE UNIQUE INDEX leave_types_name_idx ON hr.leave_types (company_id, lower(name));

-- Chế độ phép năm của hồ sơ (QUYTAC_NGHIEPVU_308). Chưa có dòng: điều kiện bình thường, thâm niên tính từ ngày vào làm.
CREATE TABLE hr.employee_leave_policies (
    employee_id         uuid        PRIMARY KEY REFERENCES hr.employees(id),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    work_condition      text        NOT NULL DEFAULT 'normal' CHECK (work_condition IN ('normal', 'disabled', 'hazardous', 'very_hazardous')),
    seniority_start     date,
    updated_by          uuid        NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1
);

-- Đơn nghỉ. source: self (người lao động lập, qua luồng duyệt), hr (nhân sự ghi nhận, có hiệu lực ngay).
CREATE TABLE hr.leave_requests (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    employee_id         uuid        NOT NULL REFERENCES hr.employees(id),
    request_no          text        NOT NULL,
    leave_type_id       uuid        NOT NULL REFERENCES hr.leave_types(id),
    from_date           date        NOT NULL,
    from_half           text        NOT NULL CHECK (from_half IN ('full', 'morning', 'afternoon')),
    to_date             date        NOT NULL,
    to_half             text        NOT NULL CHECK (to_half IN ('full', 'morning')),
    days                numeric(5,2) NOT NULL CHECK (days > 0),
    reason              text        CHECK (length(reason) <= 1000),
    attachment_key      text,
    attachment_name     text,
    attachment_type     text,
    source              text        NOT NULL CHECK (source IN ('self', 'hr')),
    status              text        NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'cancelled')),
    approval_request_id uuid        REFERENCES core.approval_requests(id),
    requested_by        uuid        NOT NULL REFERENCES core.users(id),
    requested_at        timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz,
    cancel_reason       text,
    cancelled_by        uuid        REFERENCES core.users(id),
    cancelled_at        timestamptz,
    CHECK (to_date >= from_date),
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE INDEX leave_requests_employee_idx ON hr.leave_requests (employee_id, from_date);

-- Ngày nghỉ của đơn: phần ngày (1 hoặc 0,5) và số công tương ứng theo hệ số ca dự kiến lúc lập đơn.
CREATE TABLE hr.leave_request_days (
    leave_request_id    uuid        NOT NULL REFERENCES hr.leave_requests(id),
    employee_id         uuid        NOT NULL REFERENCES hr.employees(id),
    leave_date          date        NOT NULL,
    half                text        NOT NULL CHECK (half IN ('full', 'morning', 'afternoon')),
    units               numeric(4,2) NOT NULL CHECK (units > 0),
    PRIMARY KEY (leave_request_id, leave_date)
);
CREATE INDEX leave_request_days_employee_idx ON hr.leave_request_days (employee_id, leave_date);

-- Sổ phép năm theo năm phát sinh (QUYTAC_NGHIEPVU_308). Số dư một năm = tổng days của năm đó.
-- accrual: cộng đầu tháng; month_reversal: trừ lại tháng không đủ 50% khi chốt; usage: nghỉ (âm) hoặc hoàn khi hủy (dương);
-- adjustment: nhân sự điều chỉnh; expiry: hết hạn phép tồn; payout: thanh toán khi nghỉ việc.
CREATE TABLE hr.leave_ledger (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    employee_id         uuid        NOT NULL REFERENCES hr.employees(id),
    leave_year          integer     NOT NULL,
    kind                text        NOT NULL CHECK (kind IN ('accrual', 'month_reversal', 'usage', 'adjustment', 'expiry', 'payout')),
    days                numeric(6,2) NOT NULL,
    accrual_month       date        CHECK (accrual_month IS NULL OR extract(day FROM accrual_month) = 1),
    leave_request_id    uuid        REFERENCES hr.leave_requests(id),
    reason              text,
    created_by          uuid        REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind IN ('accrual', 'month_reversal')) = (accrual_month IS NOT NULL)),
    CHECK (kind <> 'adjustment' OR reason IS NOT NULL)
);
CREATE UNIQUE INDEX leave_ledger_accrual_idx ON hr.leave_ledger (employee_id, accrual_month, kind) WHERE kind IN ('accrual', 'month_reversal');
CREATE UNIQUE INDEX leave_ledger_expiry_idx ON hr.leave_ledger (employee_id, leave_year) WHERE kind = 'expiry';
CREATE INDEX leave_ledger_employee_idx ON hr.leave_ledger (employee_id, leave_year);

-- Công ngày ghi phần nghỉ theo đơn đã duyệt.
ALTER TABLE hr.attendance_days
    ADD COLUMN leave_units      numeric(4,2) NOT NULL DEFAULT 0,
    ADD COLUMN leave_pay_group  text CHECK (leave_pay_group IN ('annual', 'paid_personal', 'paid_other', 'unpaid', 'social_insurance')),
    ADD COLUMN leave_type_id    uuid REFERENCES hr.leave_types(id),
    DROP CONSTRAINT attendance_days_status_check,
    ADD CONSTRAINT attendance_days_status_check CHECK (status IN ('scheduled', 'present', 'missing_punch', 'absent', 'rest', 'holiday', 'leave'));
