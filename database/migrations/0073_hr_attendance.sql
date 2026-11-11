-- CONG_VIEC_47: Nhân sự phần 2 (MODULE_08) – ca làm, lịch làm việc, ngày lễ, lượt chấm, công ngày, địa điểm chấm công, đơn giải trình (tài liệu 16).

-- Cài đặt chấm công, nghỉ phép, tăng ca theo công ty; chưa có dòng thì dùng giá trị mặc định (QUYTAC_NGHIEPVU_302, 304, 305, 306, 308, 310).
CREATE TABLE hr.attendance_settings (
    company_id                  uuid        PRIMARY KEY REFERENCES core.companies(id),
    working_time_mode           text        NOT NULL DEFAULT 'daily' CHECK (working_time_mode IN ('daily', 'weekly')),
    grace_minutes               integer     NOT NULL DEFAULT 5 CHECK (grace_minutes BETWEEN 0 AND 30),
    app_location_scope          text        NOT NULL DEFAULT 'branch' CHECK (app_location_scope IN ('branch', 'company')),
    carryover_mode              text        NOT NULL DEFAULT 'expire' CHECK (carryover_mode IN ('expire', 'never')),
    carryover_months            integer     NOT NULL DEFAULT 3 CHECK (carryover_months BETWEEN 1 AND 36),
    allow_advance_leave         boolean     NOT NULL DEFAULT false,
    overtime_annual_limit       integer     NOT NULL DEFAULT 200 CHECK (overtime_annual_limit IN (200, 300)),
    overtime_extended_reason    text,
    correction_monthly_limit    integer     NOT NULL DEFAULT 0 CHECK (correction_monthly_limit BETWEEN 0 AND 31),
    updated_by                  uuid        REFERENCES core.users(id),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    version                     integer     NOT NULL DEFAULT 1,
    CHECK (overtime_annual_limit = 200 OR overtime_extended_reason IS NOT NULL)
);

-- Ca làm (QUYTAC_NGHIEPVU_302). end_time <= start_time nghĩa là ca qua ngày hôm sau.
CREATE TABLE hr.shifts (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    code            text        NOT NULL CHECK (length(code) BETWEEN 1 AND 20),
    name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    start_time      time        NOT NULL,
    end_time        time        NOT NULL,
    break_start     time,
    break_minutes   integer     NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 240),
    break_paid      boolean     NOT NULL DEFAULT false,
    work_units      numeric(3,2) NOT NULL DEFAULT 1 CHECK (work_units IN (1, 0.5)),
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    CHECK ((break_minutes = 0) = (break_start IS NULL))
);
CREATE UNIQUE INDEX shifts_code_idx ON hr.shifts (company_id, lower(code));

-- Lịch tuần: mỗi thứ một ca hoặc nghỉ (trống). Mỗi công ty đúng một lịch mặc định (QUYTAC_NGHIEPVU_303).
CREATE TABLE hr.work_schedules (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    name                text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    is_default          boolean     NOT NULL DEFAULT false,
    monday_shift_id     uuid        REFERENCES hr.shifts(id),
    tuesday_shift_id    uuid        REFERENCES hr.shifts(id),
    wednesday_shift_id  uuid        REFERENCES hr.shifts(id),
    thursday_shift_id   uuid        REFERENCES hr.shifts(id),
    friday_shift_id     uuid        REFERENCES hr.shifts(id),
    saturday_shift_id   uuid        REFERENCES hr.shifts(id),
    sunday_shift_id     uuid        REFERENCES hr.shifts(id),
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX work_schedules_default_idx ON hr.work_schedules (company_id) WHERE is_default;

-- Gán lịch tuần cho phòng ban hoặc hồ sơ từ một ngày.
CREATE TABLE hr.work_schedule_assignments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    schedule_id     uuid        NOT NULL REFERENCES hr.work_schedules(id),
    department_id   uuid        REFERENCES core.departments(id),
    employee_id     uuid        REFERENCES hr.employees(id),
    effective_from  date        NOT NULL,
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK ((department_id IS NULL) <> (employee_id IS NULL))
);
CREATE UNIQUE INDEX work_schedule_assignments_department_idx ON hr.work_schedule_assignments (department_id, effective_from) WHERE department_id IS NOT NULL;
CREATE UNIQUE INDEX work_schedule_assignments_employee_idx ON hr.work_schedule_assignments (employee_id, effective_from) WHERE employee_id IS NOT NULL;

-- Xếp ca theo ngày, đè lên lịch tuần; shift_id trống là nghỉ.
CREATE TABLE hr.shift_assignments (
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    employee_id     uuid        NOT NULL REFERENCES hr.employees(id),
    work_date       date        NOT NULL,
    shift_id        uuid        REFERENCES hr.shifts(id),
    updated_by      uuid        NOT NULL REFERENCES core.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (employee_id, work_date)
);

-- Ngày lễ: company_id trống là lịch chung tập đoàn; foreigners_only chỉ áp dụng người nước ngoài (Bộ luật Lao động Điều 112).
CREATE TABLE hr.holidays (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        REFERENCES core.companies(id),
    holiday_date    date        NOT NULL,
    name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    foreigners_only boolean     NOT NULL DEFAULT false,
    created_by      uuid        REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX holidays_group_idx ON hr.holidays (holiday_date, foreigners_only) WHERE company_id IS NULL;
CREATE UNIQUE INDEX holidays_company_idx ON hr.holidays (company_id, holiday_date, foreigners_only) WHERE company_id IS NOT NULL;

-- Mã chấm công: mã người dùng trên máy chấm công (QUYTAC_NGHIEPVU_304).
ALTER TABLE hr.employees ADD COLUMN attendance_code text CHECK (length(attendance_code) BETWEEN 1 AND 20);
CREATE UNIQUE INDEX employees_attendance_code_idx ON hr.employees (company_id, lower(attendance_code)) WHERE attendance_code IS NOT NULL;

-- Địa điểm chấm công trên ứng dụng: GPS, dải IP, mã QR động; ít nhất một cách được bật.
CREATE TABLE hr.attendance_locations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    branch_id       uuid        NOT NULL REFERENCES core.branches(id),
    name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    latitude        numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
    longitude       numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
    radius_meters   integer     CHECK (radius_meters BETWEEN 50 AND 1000),
    ip_ranges       cidr[]      NOT NULL DEFAULT '{}',
    qr_enabled      boolean     NOT NULL DEFAULT false,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    CHECK ((latitude IS NULL) = (longitude IS NULL) AND (latitude IS NULL) = (radius_meters IS NULL)),
    CHECK (latitude IS NOT NULL OR cardinality(ip_ranges) > 0 OR qr_enabled)
);

-- Lần nhập tệp máy chấm công.
CREATE TABLE hr.attendance_imports (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    file_name       text        NOT NULL,
    accepted_count  integer     NOT NULL,
    duplicate_count integer     NOT NULL,
    error_count     integer     NOT NULL,
    imported_by     uuid        NOT NULL REFERENCES core.users(id),
    imported_at     timestamptz NOT NULL DEFAULT now()
);

-- Đơn giải trình công (QUYTAC_NGHIEPVU_306).
CREATE TABLE hr.attendance_corrections (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    employee_id         uuid        NOT NULL REFERENCES hr.employees(id),
    correction_no       text,
    work_date           date        NOT NULL,
    kind                text        NOT NULL CHECK (kind IN ('forgot', 'business_trip', 'off_site', 'device_error', 'other')),
    check_in            time,
    check_out           time,
    reason              text        NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
    attachment_key      text,
    attachment_name     text,
    attachment_type     text,
    status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    approval_request_id uuid        REFERENCES core.approval_requests(id),
    requested_by        uuid        NOT NULL REFERENCES core.users(id),
    requested_at        timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz,
    CHECK (check_in IS NOT NULL OR check_out IS NOT NULL)
);
CREATE INDEX attendance_corrections_employee_idx ON hr.attendance_corrections (employee_id, work_date);

-- Lượt chấm, làm tròn đến phút. Lượt thủ công xóa mềm (deleted_at); lượt máy, ứng dụng không sửa, không xóa.
CREATE TABLE hr.attendance_punches (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    employee_id     uuid        NOT NULL REFERENCES hr.employees(id),
    punched_at      timestamptz NOT NULL CHECK (extract(second FROM punched_at) = 0),
    source          text        NOT NULL CHECK (source IN ('device', 'manual', 'app', 'correction')),
    import_id       uuid        REFERENCES hr.attendance_imports(id),
    device_code     text,
    reason          text,
    method          text        CHECK (method IN ('gps', 'ip', 'qr')),
    location_id     uuid        REFERENCES hr.attendance_locations(id),
    latitude        numeric(9,6),
    longitude       numeric(9,6),
    accuracy_meters numeric(7,1),
    ip_address      inet,
    correction_id   uuid        REFERENCES hr.attendance_corrections(id),
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_by      uuid        REFERENCES core.users(id),
    deleted_at      timestamptz,
    CHECK (source <> 'manual' OR reason IS NOT NULL),
    CHECK ((source = 'app') = (method IS NOT NULL))
);
CREATE UNIQUE INDEX attendance_punches_minute_idx ON hr.attendance_punches (employee_id, punched_at) WHERE deleted_at IS NULL;

-- Kết quả công từng ngày (QUYTAC_NGHIEPVU_305); tính lại khi dữ liệu nguồn đổi.
CREATE TABLE hr.attendance_days (
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    employee_id         uuid        NOT NULL REFERENCES hr.employees(id),
    work_date           date        NOT NULL,
    day_kind            text        NOT NULL CHECK (day_kind IN ('workday', 'rest_day', 'holiday')),
    shift_id            uuid        REFERENCES hr.shifts(id),
    shift_code          text,
    planned_start       timestamptz,
    planned_end         timestamptz,
    standard_minutes    integer     NOT NULL DEFAULT 0,
    planned_units       numeric(3,2) NOT NULL DEFAULT 0,
    first_in            timestamptz,
    last_out            timestamptz,
    punch_count         integer     NOT NULL DEFAULT 0,
    worked_minutes      integer     NOT NULL DEFAULT 0,
    night_minutes       integer     NOT NULL DEFAULT 0,
    late_minutes        integer     NOT NULL DEFAULT 0,
    early_minutes       integer     NOT NULL DEFAULT 0,
    worked_units        numeric(4,2) NOT NULL DEFAULT 0,
    absent_units        numeric(4,2) NOT NULL DEFAULT 0,
    status              text        NOT NULL CHECK (status IN ('scheduled', 'present', 'missing_punch', 'absent', 'rest', 'holiday')),
    calculated_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (employee_id, work_date)
);
CREATE INDEX attendance_days_company_idx ON hr.attendance_days (company_id, work_date);

-- Kỳ bảng công tháng (QUYTAC_NGHIEPVU_311). Tạo ở đây để mọi ghi dữ liệu chấm công kiểm được kỳ đã chốt; dòng bảng công ở database migration 0075.
-- payroll_locked_at: do CONG_VIEC_48 ghi khi chốt bảng lương kỳ đó, xóa khi mở lại; khác NULL thì không mở lại bảng công.
CREATE TABLE hr.timesheet_periods (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    year                    integer     NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month                   integer     NOT NULL CHECK (month BETWEEN 1 AND 12),
    status                  text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirming', 'closed')),
    confirmation_deadline   date,
    closed_at               timestamptz,
    closed_by               uuid        REFERENCES core.users(id),
    payroll_locked_at       timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, year, month),
    CHECK ((status = 'closed') = (closed_at IS NOT NULL)),
    CHECK (status <> 'confirming' OR confirmation_deadline IS NOT NULL)
);
