-- CONG_VIEC_48 lát L0: thiết lập lương, loại phụ cấp, hồ sơ lương của nhân viên (QUYTAC_NGHIEPVU_312 đến 315; tài liệu 16).
-- Tiền kiểu numeric(20,4); tỷ lệ numeric(7,4) dạng phần (0,08 là 8%).

-- Tham số pháp luật dùng chung toàn tập đoàn theo ngày hiệu lực (QUYTAC_NGHIEPVU_312). Không gắn công ty: cùng một pháp luật cho mọi công ty.
CREATE TABLE hr.payroll_parameters (
    id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    effective_from              date          NOT NULL UNIQUE CHECK (extract(day FROM effective_from) = 1),
    base_salary                 numeric(20,4) NOT NULL CHECK (base_salary > 0),
    insurance_reference         numeric(20,4) CHECK (insurance_reference > 0),
    region_one_minimum          numeric(20,4) NOT NULL CHECK (region_one_minimum > 0),
    region_two_minimum          numeric(20,4) NOT NULL CHECK (region_two_minimum > 0),
    region_three_minimum        numeric(20,4) NOT NULL CHECK (region_three_minimum > 0),
    region_four_minimum         numeric(20,4) NOT NULL CHECK (region_four_minimum > 0),
    employee_social_rate        numeric(7,4)  NOT NULL CHECK (employee_social_rate BETWEEN 0 AND 1),
    employee_health_rate        numeric(7,4)  NOT NULL CHECK (employee_health_rate BETWEEN 0 AND 1),
    employee_unemployment_rate  numeric(7,4)  NOT NULL CHECK (employee_unemployment_rate BETWEEN 0 AND 1),
    employer_retirement_rate    numeric(7,4)  NOT NULL CHECK (employer_retirement_rate BETWEEN 0 AND 1),
    employer_sickness_rate      numeric(7,4)  NOT NULL CHECK (employer_sickness_rate BETWEEN 0 AND 1),
    employer_health_rate        numeric(7,4)  NOT NULL CHECK (employer_health_rate BETWEEN 0 AND 1),
    employer_unemployment_rate  numeric(7,4)  NOT NULL CHECK (employer_unemployment_rate BETWEEN 0 AND 1),
    social_cap_multiplier       numeric(7,4)  NOT NULL CHECK (social_cap_multiplier > 0),
    health_cap_multiplier       numeric(7,4)  NOT NULL CHECK (health_cap_multiplier > 0),
    unemployment_cap_multiplier numeric(7,4)  NOT NULL CHECK (unemployment_cap_multiplier > 0),
    personal_deduction          numeric(20,4) NOT NULL CHECK (personal_deduction >= 0),
    dependent_deduction         numeric(20,4) NOT NULL CHECK (dependent_deduction >= 0),
    flat_withholding_rate       numeric(7,4)  NOT NULL CHECK (flat_withholding_rate BETWEEN 0 AND 1),
    unpaid_days_threshold       integer       NOT NULL CHECK (unpaid_days_threshold BETWEEN 1 AND 31),
    created_by                  uuid          REFERENCES core.users(id),
    created_at                  timestamptz   NOT NULL DEFAULT now(),
    updated_by                  uuid          REFERENCES core.users(id),
    updated_at                  timestamptz   NOT NULL DEFAULT now(),
    version                     integer       NOT NULL DEFAULT 1
);

-- Biểu thuế lũy tiến từng phần theo tháng: bậc cuối không có ngưỡng trên.
CREATE TABLE hr.payroll_tax_brackets (
    parameter_id    uuid          NOT NULL REFERENCES hr.payroll_parameters(id) ON DELETE CASCADE,
    sort_order      integer       NOT NULL CHECK (sort_order BETWEEN 1 AND 10),
    upper_bound     numeric(20,4) CHECK (upper_bound > 0),
    rate            numeric(7,4)  NOT NULL CHECK (rate BETWEEN 0 AND 1),
    PRIMARY KEY (parameter_id, sort_order)
);

-- Thiết lập lương của công ty (QUYTAC_NGHIEPVU_313, 318). Chưa có dòng thì dùng giá trị mặc định trong mã.
CREATE TABLE hr.payroll_company_settings (
    company_id                  uuid          PRIMARY KEY REFERENCES core.companies(id),
    union_fee_enabled           boolean       NOT NULL DEFAULT true,
    union_fee_rate              numeric(7,4)  NOT NULL DEFAULT 0.02 CHECK (union_fee_rate BETWEEN 0 AND 1),
    accident_rate               numeric(7,4)  NOT NULL DEFAULT 0.005 CHECK (accident_rate BETWEEN 0 AND 1),
    withholding_threshold       numeric(20,4) NOT NULL DEFAULT 2000000 CHECK (withholding_threshold >= 0),
    fallback_standard_days      integer       NOT NULL DEFAULT 26 CHECK (fallback_standard_days BETWEEN 1 AND 31),
    overtime_weekday_rate       numeric(7,4)  NOT NULL DEFAULT 1.5 CHECK (overtime_weekday_rate >= 1),
    overtime_weekly_rest_rate   numeric(7,4)  NOT NULL DEFAULT 2 CHECK (overtime_weekly_rest_rate >= 1),
    overtime_holiday_rate       numeric(7,4)  NOT NULL DEFAULT 3 CHECK (overtime_holiday_rate >= 1),
    night_rate                  numeric(7,4)  NOT NULL DEFAULT 0.3 CHECK (night_rate >= 0),
    night_overtime_rate         numeric(7,4)  NOT NULL DEFAULT 0.2 CHECK (night_overtime_rate >= 0),
    updated_by                  uuid          REFERENCES core.users(id),
    updated_at                  timestamptz   NOT NULL DEFAULT now(),
    version                     integer       NOT NULL DEFAULT 1
);

-- Vùng lương tối thiểu của chi nhánh (chọn tay: vùng xác định theo xã, phường).
CREATE TABLE hr.payroll_branch_regions (
    branch_id       uuid        PRIMARY KEY REFERENCES core.branches(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    region          smallint    NOT NULL CHECK (region BETWEEN 1 AND 4),
    updated_by      uuid        NOT NULL REFERENCES core.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Nhóm chi phí lương của phòng ban (QUYTAC_NGHIEPVU_323). Chưa có dòng: quản lý.
CREATE TABLE hr.payroll_department_groups (
    department_id   uuid        PRIMARY KEY REFERENCES core.departments(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    cost_group      text        NOT NULL CHECK (cost_group IN ('selling', 'admin')),
    updated_by      uuid        NOT NULL REFERENCES core.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Loại phụ cấp (QUYTAC_NGHIEPVU_314).
CREATE TABLE hr.allowance_types (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid          NOT NULL REFERENCES core.companies(id),
    name            text          NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    tax_mode        text          NOT NULL CHECK (tax_mode IN ('taxable', 'exempt', 'exempt_up_to')),
    exempt_limit    numeric(20,4) CHECK (exempt_limit > 0),
    prorated        boolean       NOT NULL DEFAULT true,
    overtime_base   boolean       NOT NULL DEFAULT false,
    status          text          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_by      uuid          NOT NULL REFERENCES core.users(id),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    version         integer       NOT NULL DEFAULT 1,
    CHECK ((tax_mode = 'exempt_up_to') = (exempt_limit IS NOT NULL))
);
CREATE UNIQUE INDEX allowance_types_name_key ON hr.allowance_types (company_id, lower(name));

-- Phiếu thay đổi CONG_VIEC_48 mục 15: dòng phụ cấp hợp đồng, phụ lục có loại; dòng cũ để trống.
ALTER TABLE hr.contract_allowances ADD COLUMN allowance_type_id uuid REFERENCES hr.allowance_types(id);

-- Lương đóng bảo hiểm khai theo tháng hiệu lực (QUYTAC_NGHIEPVU_315).
CREATE TABLE hr.employee_insurance_salaries (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid          NOT NULL REFERENCES core.companies(id),
    employee_id     uuid          NOT NULL REFERENCES hr.employees(id),
    effective_month date          NOT NULL CHECK (extract(day FROM effective_month) = 1),
    amount          numeric(20,4) NOT NULL CHECK (amount > 0),
    note            text          CHECK (length(note) <= 500),
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (employee_id, effective_month)
);

-- Miễn đóng, cách tính thuế (QUYTAC_NGHIEPVU_315). Chưa có dòng: đóng đủ, cách tính theo hợp đồng.
CREATE TABLE hr.employee_payroll_profiles (
    employee_id         uuid        PRIMARY KEY REFERENCES hr.employees(id),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    social_exempt       boolean     NOT NULL DEFAULT false,
    health_exempt       boolean     NOT NULL DEFAULT false,
    unemployment_exempt boolean     NOT NULL DEFAULT false,
    exemption_reason    text        CHECK (length(exemption_reason) <= 500),
    tax_method          text        NOT NULL DEFAULT 'auto' CHECK (tax_method IN ('auto', 'progressive', 'flat')),
    updated_by          uuid        NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    CHECK (NOT (social_exempt OR health_exempt OR unemployment_exempt) OR exemption_reason IS NOT NULL)
);

-- Cam kết 08/CK-TNCN theo năm: có thì không khấu trừ 10%.
CREATE TABLE hr.employee_tax_commitments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    employee_id     uuid        NOT NULL REFERENCES hr.employees(id),
    year            integer     NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    file_name       text        NOT NULL,
    content_type    text        NOT NULL,
    size_bytes      integer     NOT NULL CHECK (size_bytes > 0),
    storage_key     text        NOT NULL UNIQUE,
    uploaded_by     uuid        NOT NULL REFERENCES core.users(id),
    uploaded_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (employee_id, year)
);

-- Bộ tham số đã tra ngày 2026-11-11 (CONG_VIEC_48 mục 3): Nghị định 161/2026/NĐ-CP, 293/2025/NĐ-CP, 399/2026/NĐ-CP; Luật Bảo hiểm xã hội 41/2024/QH15;
-- Luật Việc làm 74/2025/QH15; Luật Thuế thu nhập cá nhân 109/2025/QH15.
INSERT INTO hr.payroll_parameters (effective_from, base_salary, region_one_minimum, region_two_minimum, region_three_minimum, region_four_minimum,
    employee_social_rate, employee_health_rate, employee_unemployment_rate, employer_retirement_rate, employer_sickness_rate, employer_health_rate, employer_unemployment_rate,
    social_cap_multiplier, health_cap_multiplier, unemployment_cap_multiplier, personal_deduction, dependent_deduction, flat_withholding_rate, unpaid_days_threshold)
VALUES
    ('2026-07-01', 2530000, 5310000, 4730000, 4140000, 3700000, 0.08, 0.015, 0.01, 0.14, 0.03, 0.03, 0.01, 20, 20, 20, 15500000, 6200000, 0.1, 14),
    ('2027-01-01', 2530000, 5700000, 5080000, 4450000, 4040000, 0.08, 0.015, 0.01, 0.14, 0.03, 0.03, 0.01, 20, 20, 20, 15500000, 6200000, 0.1, 14);
INSERT INTO hr.payroll_tax_brackets (parameter_id, sort_order, upper_bound, rate)
SELECT p.id, b.sort_order, b.upper_bound, b.rate
FROM hr.payroll_parameters p
CROSS JOIN (VALUES (1, 10000000::numeric, 0.05), (2, 30000000, 0.10), (3, 60000000, 0.20), (4, 100000000, 0.30), (5, NULL, 0.35)) AS b(sort_order, upper_bound, rate);
