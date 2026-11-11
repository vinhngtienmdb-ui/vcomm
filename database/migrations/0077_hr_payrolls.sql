-- CONG_VIEC_48 lát L1: bảng lương tháng, dòng lương, khoản nhập tay (QUYTAC_NGHIEPVU_316 đến 322; tài liệu 16). Tiền numeric(20,4) theo đồng.

CREATE TABLE hr.payrolls (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    month               date          NOT NULL CHECK (extract(day FROM month) = 1),
    status              text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'rejected', 'withdrawn', 'approved', 'paid', 'cancelled')),
    document_no         text,
    parameter_id        uuid          NOT NULL REFERENCES hr.payroll_parameters(id),
    approval_request_id uuid,
    employee_count      integer       NOT NULL DEFAULT 0,
    gross_income        numeric(20,4) NOT NULL DEFAULT 0,
    employee_insurance  numeric(20,4) NOT NULL DEFAULT 0,
    personal_income_tax numeric(20,4) NOT NULL DEFAULT 0,
    deductions          numeric(20,4) NOT NULL DEFAULT 0,
    net_pay             numeric(20,4) NOT NULL DEFAULT 0,
    employer_insurance  numeric(20,4) NOT NULL DEFAULT 0,
    union_fee           numeric(20,4) NOT NULL DEFAULT 0,
    employer_cost       numeric(20,4) NOT NULL DEFAULT 0,
    standard_days       numeric(7,4),
    timesheet_closed    boolean       NOT NULL DEFAULT false,
    calculated_at       timestamptz   NOT NULL DEFAULT now(),
    calculated_by       uuid          NOT NULL REFERENCES core.users(id),
    approved_at         timestamptz,
    cancel_reason       text          CHECK (length(cancel_reason) <= 500),
    created_by          uuid          NOT NULL REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL))
);
-- Một bảng lương chưa hủy cho mỗi công ty, mỗi tháng.
CREATE UNIQUE INDEX payrolls_company_month_idx ON hr.payrolls (company_id, month) WHERE status <> 'cancelled';
CREATE UNIQUE INDEX payrolls_document_no_idx ON hr.payrolls (company_id, document_no) WHERE document_no IS NOT NULL;

-- Dòng lương: số liệu chụp lại tại lần tính gần nhất; giải trình từng bước trong explanation.
CREATE TABLE hr.payroll_lines (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id              uuid          NOT NULL REFERENCES hr.payrolls(id) ON DELETE CASCADE,
    company_id              uuid          NOT NULL REFERENCES core.companies(id),
    employee_id             uuid          NOT NULL REFERENCES hr.employees(id),
    department_id           uuid          REFERENCES core.departments(id),
    branch_id               uuid          REFERENCES core.branches(id),
    cost_group              text          NOT NULL CHECK (cost_group IN ('selling', 'admin')),
    tax_method              text          NOT NULL CHECK (tax_method IN ('progressive', 'flat')),
    monthly_salary          numeric(20,4) NOT NULL,
    standard_days           numeric(7,4)  NOT NULL,
    paid_days               numeric(7,4)  NOT NULL,
    time_pay                numeric(20,4) NOT NULL,
    allowance_pay           numeric(20,4) NOT NULL,
    overtime_pay            numeric(20,4) NOT NULL,
    night_premium           numeric(20,4) NOT NULL,
    settled_leave_pay       numeric(20,4) NOT NULL,
    additions               numeric(20,4) NOT NULL,
    deductions              numeric(20,4) NOT NULL,
    gross_income            numeric(20,4) NOT NULL,
    taxable_income          numeric(20,4) NOT NULL,
    social_base             numeric(20,4) NOT NULL,
    health_base             numeric(20,4) NOT NULL,
    unemployment_base       numeric(20,4) NOT NULL,
    employee_social         numeric(20,4) NOT NULL,
    employee_health         numeric(20,4) NOT NULL,
    employee_unemployment   numeric(20,4) NOT NULL,
    employer_social         numeric(20,4) NOT NULL,
    employer_health         numeric(20,4) NOT NULL,
    employer_unemployment   numeric(20,4) NOT NULL,
    union_fee               numeric(20,4) NOT NULL,
    family_deduction        numeric(20,4) NOT NULL,
    assessable_income       numeric(20,4) NOT NULL,
    personal_income_tax     numeric(20,4) NOT NULL,
    net_pay                 numeric(20,4) NOT NULL,
    employer_cost           numeric(20,4) NOT NULL,
    warnings                text[]        NOT NULL DEFAULT '{}',
    explanation             jsonb         NOT NULL DEFAULT '{}',
    UNIQUE (payroll_id, employee_id)
);
CREATE INDEX payroll_lines_employee_idx ON hr.payroll_lines (employee_id);

-- Khoản nhập tay (QUYTAC_NGHIEPVU_321): giữ lại khi tính lại.
CREATE TABLE hr.payroll_adjustments (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id      uuid          NOT NULL REFERENCES hr.payrolls(id) ON DELETE CASCADE,
    company_id      uuid          NOT NULL REFERENCES core.companies(id),
    employee_id     uuid          NOT NULL REFERENCES hr.employees(id),
    kind            text          NOT NULL CHECK (kind IN ('addition', 'deduction')),
    category        text          NOT NULL CHECK (category IN ('bonus', 'arrears', 'commission', 'advance', 'compensation', 'union_dues', 'other')),
    taxable         boolean       NOT NULL,
    description     text          NOT NULL CHECK (length(description) BETWEEN 1 AND 200),
    amount          numeric(20,4) NOT NULL CHECK (amount > 0),
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    version         integer       NOT NULL DEFAULT 1,
    CHECK (kind = 'addition' OR NOT taxable),
    CHECK ((kind = 'addition') = (category IN ('bonus', 'arrears', 'commission', 'other')) OR category = 'other')
);
CREATE INDEX payroll_adjustments_payroll_idx ON hr.payroll_adjustments (payroll_id, employee_id);
