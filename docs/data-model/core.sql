-- =============================================================================
-- VComm - Mo hinh du lieu mini app Nen tang (schema `core`)
-- PostgreSQL 16+
--
-- Quy uoc:
--   * Khoa chinh UUID. Ung dung sinh UUIDv7 (tang dan theo thoi gian);
--     DEFAULT gen_random_uuid() chi de du phong khi chen tay.
--   * Moi bang nghiep vu co created_at/created_by/updated_at/updated_by
--     va version (khoa lac quan - optimistic locking).
--   * Khong xoa cung du lieu nghiep vu: dung status hoac archived_at.
--   * Tien te luu numeric(20,4); ty gia numeric(20,8).
--   * Ten bang/cot: snake_case, so nhieu cho bang.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS core;
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------------------------------------------------------
-- 1. Tien te & ty gia
-- -----------------------------------------------------------------------------
CREATE TABLE core.currencies (
    code            char(3)      PRIMARY KEY,           -- ISO 4217: VND, USD, CNY...
    name_vi         text         NOT NULL,
    name_en         text         NOT NULL,
    minor_units     smallint     NOT NULL DEFAULT 0,    -- VND = 0, USD = 2
    is_active       boolean      NOT NULL DEFAULT true
);

CREATE TABLE core.exchange_rates (
    id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_date       date         NOT NULL,
    from_currency   char(3)      NOT NULL REFERENCES core.currencies(code),
    to_currency     char(3)      NOT NULL REFERENCES core.currencies(code),
    rate_type       text         NOT NULL CHECK (rate_type IN ('buy', 'sell', 'transfer', 'accounting')),
    rate            numeric(20,8) NOT NULL CHECK (rate > 0),
    source          text         NOT NULL,              -- 'vietcombank', 'manual', ...
    created_at      timestamptz  NOT NULL DEFAULT now(),
    created_by      uuid,
    UNIQUE (rate_date, from_currency, to_currency, rate_type, source),
    CHECK (from_currency <> to_currency)
);

-- -----------------------------------------------------------------------------
-- 2. To chuc: tap doan -> cong ty (phap nhan) -> chi nhanh -> phong ban
-- -----------------------------------------------------------------------------
CREATE TABLE core.companies (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id           uuid        REFERENCES core.companies(id),   -- NULL = cong ty me/tap doan
    code                text        NOT NULL UNIQUE,                 -- 'VCG', 'VCR'...
    legal_name          text        NOT NULL,
    short_name          text        NOT NULL,
    tax_code            text        UNIQUE,                          -- ma so thue
    address             text,
    phone               text,
    email               citext,
    base_currency       char(3)     NOT NULL DEFAULT 'VND' REFERENCES core.currencies(code),
    accounting_regime   text        NOT NULL DEFAULT 'TT200' CHECK (accounting_regime IN ('TT200', 'TT133')),
    fiscal_year_start   smallint    NOT NULL DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid,
    version             integer     NOT NULL DEFAULT 1,
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE TABLE core.branches (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    code            text        NOT NULL,
    name            text        NOT NULL,
    branch_type     text        NOT NULL CHECK (branch_type IN ('head_office', 'office', 'warehouse', 'store', 'other')),
    province_code   text,                               -- ma tinh/thanh theo danh muc hanh chinh
    address         text,
    phone           text,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid,
    version         integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);

CREATE TABLE core.departments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    parent_id       uuid        REFERENCES core.departments(id),
    code            text        NOT NULL,
    name            text        NOT NULL,
    manager_user_id uuid,                               -- FK them sau khi tao core.users
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid,
    version         integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);

-- -----------------------------------------------------------------------------
-- 3. Nguoi dung & dang nhap
-- -----------------------------------------------------------------------------
CREATE TABLE core.users (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    username            citext      UNIQUE,
    email               citext      UNIQUE,
    phone               text        UNIQUE,             -- dinh dang E.164: +84...
    full_name           text        NOT NULL,
    avatar_url          text,
    locale              text        NOT NULL DEFAULT 'vi' CHECK (locale IN ('vi', 'en')),
    timezone            text        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    mfa_required        boolean     NOT NULL DEFAULT false, -- bat buoc OTP (tu dong true neu co vai tro nhay cam)
    is_super_admin      boolean     NOT NULL DEFAULT false,
    status              text        NOT NULL DEFAULT 'invited'
                        CHECK (status IN ('invited', 'active', 'locked', 'disabled')),
    last_login_at       timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid,
    version             integer     NOT NULL DEFAULT 1,
    CHECK (username IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL)
);

ALTER TABLE core.departments
    ADD CONSTRAINT departments_manager_fk FOREIGN KEY (manager_user_id) REFERENCES core.users(id);

-- Mot nguoi dung co the dang nhap bang nhieu cach.
CREATE TABLE core.user_identities (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    provider            text        NOT NULL CHECK (provider IN ('password', 'google', 'microsoft', 'phone_otp')),
    provider_subject    text        NOT NULL,           -- username/email; 'sub' cua Google/Microsoft; so dien thoai
    password_hash       text,                           -- argon2id, chi voi provider = 'password'
    password_changed_at timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    last_used_at        timestamptz,
    UNIQUE (provider, provider_subject),
    CHECK ((provider = 'password') = (password_hash IS NOT NULL))
);

-- Yeu to xac thuc thu 2.
CREATE TABLE core.mfa_factors (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    factor_type         text        NOT NULL CHECK (factor_type IN ('totp', 'sms', 'email')),
    secret_encrypted    bytea,                          -- ma hoa bang KMS, chi voi totp
    target              text,                           -- so dien thoai/email nhan OTP
    confirmed_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Phien dang nhap; luu bam (hash) cua refresh token, khong luu token goc.
CREATE TABLE core.sessions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
    refresh_token_hash  bytea       NOT NULL UNIQUE,
    client_type         text        NOT NULL CHECK (client_type IN ('web', 'warehouse_app', 'sales_app')),
    ip                  inet,
    user_agent          text,
    mfa_verified        boolean     NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz
);
CREATE INDEX sessions_user_idx ON core.sessions (user_id) WHERE revoked_at IS NULL;

-- Nhat ky dang nhap (thanh cong/that bai) de khoa tai khoan va dieu tra.
CREATE TABLE core.login_attempts (
    id                  bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attempted_at        timestamptz NOT NULL DEFAULT now(),
    provider            text        NOT NULL,
    identifier          text        NOT NULL,           -- username/email/phone da nhap
    user_id             uuid        REFERENCES core.users(id),
    success             boolean     NOT NULL,
    failure_reason      text,
    ip                  inet,
    user_agent          text
);
CREATE INDEX login_attempts_identifier_idx ON core.login_attempts (identifier, attempted_at DESC);

-- Nguoi dung thuoc cong ty nao, lam o dau. Mot nguoi co the thuoc nhieu cong ty.
CREATE TABLE core.user_company_memberships (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES core.users(id),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    default_branch_id   uuid        REFERENCES core.branches(id),
    department_id       uuid        REFERENCES core.departments(id),
    job_title           text,
    is_default          boolean     NOT NULL DEFAULT false, -- cong ty mo san khi dang nhap
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid,
    UNIQUE (user_id, company_id)
);
CREATE UNIQUE INDEX user_company_one_default_idx
    ON core.user_company_memberships (user_id) WHERE is_default;

-- -----------------------------------------------------------------------------
-- 4. Mini app & phan quyen
-- -----------------------------------------------------------------------------
-- Danh sach mini app hien tren trang chu.
CREATE TABLE core.apps (
    code            text        PRIMARY KEY,            -- 'platform', 'catalog', 'inventory', ...
    name_vi         text        NOT NULL,
    name_en         text        NOT NULL,
    description_vi  text,
    description_en  text,
    base_url        text        NOT NULL,               -- '/inventory' hoac domain rieng
    icon            text        NOT NULL,
    sort_order      integer     NOT NULL DEFAULT 0,
    is_active       boolean     NOT NULL DEFAULT true
);

-- Quyen = <app>.<doi tuong>.<hanh dong>, vd 'inventory.stock_receipt.approve'.
-- Do code khai bao va dong bo vao bang khi trien khai; admin khong tao tay.
CREATE TABLE core.permissions (
    code            text        PRIMARY KEY,
    app_code        text        NOT NULL REFERENCES core.apps(code),
    name_vi         text        NOT NULL,
    name_en         text        NOT NULL,
    is_sensitive    boolean     NOT NULL DEFAULT false  -- vai tro co quyen nay => bat buoc OTP
);

-- Vai tro: nhom quyen do admin dinh nghia.
-- company_id NULL = vai tro dung chung toan tap doan.
CREATE TABLE core.roles (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        REFERENCES core.companies(id),
    code            text        NOT NULL,
    name_vi         text        NOT NULL,
    name_en         text        NOT NULL,
    description     text,
    is_system       boolean     NOT NULL DEFAULT false, -- vai tro mac dinh, khong xoa duoc
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid,
    version         integer     NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX roles_code_uq ON core.roles (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), code);

CREATE TABLE core.role_permissions (
    role_id         uuid        NOT NULL REFERENCES core.roles(id) ON DELETE CASCADE,
    permission_code text        NOT NULL REFERENCES core.permissions(code),
    PRIMARY KEY (role_id, permission_code)
);

-- Gan vai tro cho nguoi dung TRONG MOT PHAM VI:
--   group   = toan tap doan (scope_id NULL)
--   company = mot cong ty (scope_id = companies.id)
--   branch  = mot chi nhanh (scope_id = branches.id)
CREATE TABLE core.user_role_assignments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid        NOT NULL REFERENCES core.users(id),
    role_id         uuid        NOT NULL REFERENCES core.roles(id),
    scope_type      text        NOT NULL CHECK (scope_type IN ('group', 'company', 'branch')),
    company_id      uuid        REFERENCES core.companies(id),
    branch_id       uuid        REFERENCES core.branches(id),
    valid_from      date        NOT NULL DEFAULT current_date,
    valid_to        date,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid,
    CHECK (
        (scope_type = 'group'   AND company_id IS NULL     AND branch_id IS NULL) OR
        (scope_type = 'company' AND company_id IS NOT NULL AND branch_id IS NULL) OR
        (scope_type = 'branch'  AND company_id IS NOT NULL AND branch_id IS NOT NULL)
    ),
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX user_role_assignments_user_idx ON core.user_role_assignments (user_id);

-- -----------------------------------------------------------------------------
-- 5. Duyet chung tu theo han muc
-- -----------------------------------------------------------------------------
-- Loai chung tu can duyet, do cac mini app dang ky: 'purchasing.purchase_order', 'finance.payment'...
CREATE TABLE core.document_types (
    code            text        PRIMARY KEY,
    app_code        text        NOT NULL REFERENCES core.apps(code),
    name_vi         text        NOT NULL,
    name_en         text        NOT NULL,
    requires_approval boolean   NOT NULL DEFAULT false
);

-- Chinh sach duyet: moi cong ty x loai chung tu co mot chinh sach dang hieu luc.
CREATE TABLE core.approval_policies (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    document_type_code  text        NOT NULL REFERENCES core.document_types(code),
    currency            char(3)     NOT NULL DEFAULT 'VND' REFERENCES core.currencies(code),
    effective_from      date        NOT NULL,
    effective_to        date,
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

-- Cac cap duyet. Chung tu co gia tri >= min_amount phai qua cap nay.
-- Vi du don mua: cap 1 >= 0 (truong bo phan), cap 2 >= 50 trieu (giam doc), cap 3 >= 500 trieu (TGD).
CREATE TABLE core.approval_policy_levels (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id           uuid        NOT NULL REFERENCES core.approval_policies(id) ON DELETE CASCADE,
    level_no            smallint    NOT NULL CHECK (level_no >= 1),
    min_amount          numeric(20,4) NOT NULL DEFAULT 0 CHECK (min_amount >= 0),
    approver_type       text        NOT NULL CHECK (approver_type IN ('role', 'user', 'department_manager')),
    approver_role_id    uuid        REFERENCES core.roles(id),
    approver_user_id    uuid        REFERENCES core.users(id),
    UNIQUE (policy_id, level_no),
    CHECK (
        (approver_type = 'role'               AND approver_role_id IS NOT NULL AND approver_user_id IS NULL) OR
        (approver_type = 'user'               AND approver_user_id IS NOT NULL AND approver_role_id IS NULL) OR
        (approver_type = 'department_manager' AND approver_role_id IS NULL     AND approver_user_id IS NULL)
    )
);

-- Mot yeu cau duyet cho mot chung tu cu the.
CREATE TABLE core.approval_requests (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    document_type_code  text        NOT NULL REFERENCES core.document_types(code),
    document_id         uuid        NOT NULL,
    document_no         text        NOT NULL,
    amount              numeric(20,4) NOT NULL,
    currency            char(3)     NOT NULL REFERENCES core.currencies(code),
    policy_id           uuid        NOT NULL REFERENCES core.approval_policies(id),
    status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    current_level_no    smallint,
    requested_by        uuid        NOT NULL REFERENCES core.users(id),
    requested_at        timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz
);
CREATE UNIQUE INDEX approval_requests_open_uq
    ON core.approval_requests (document_type_code, document_id) WHERE status = 'pending';

CREATE TABLE core.approval_steps (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          uuid        NOT NULL REFERENCES core.approval_requests(id) ON DELETE CASCADE,
    level_no            smallint    NOT NULL,
    decision            text        CHECK (decision IN ('approved', 'rejected')),
    decided_by          uuid        REFERENCES core.users(id),
    decided_at          timestamptz,
    comment             text,
    UNIQUE (request_id, level_no)
);

-- -----------------------------------------------------------------------------
-- 6. Danh so chung tu
-- -----------------------------------------------------------------------------
-- Vi du: PN-VCR-2026-000123. Lay so bang UPDATE ... RETURNING trong cung giao dich.
CREATE TABLE core.number_sequences (
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    document_type_code  text        NOT NULL REFERENCES core.document_types(code),
    period_key          text        NOT NULL,           -- '2026' hoac '2026-11' tuy reset_period
    prefix              text        NOT NULL,
    reset_period        text        NOT NULL DEFAULT 'year' CHECK (reset_period IN ('never', 'year', 'month')),
    padding             smallint    NOT NULL DEFAULT 6,
    next_value          bigint      NOT NULL DEFAULT 1,
    PRIMARY KEY (company_id, document_type_code, period_key)
);

-- -----------------------------------------------------------------------------
-- 7. Nhat ky thao tac (audit) & su kien (outbox)
-- -----------------------------------------------------------------------------
-- Chi INSERT, khong UPDATE/DELETE. Chia partition theo thang.
CREATE TABLE core.audit_events (
    id              uuid        NOT NULL DEFAULT gen_random_uuid(),
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    actor_user_id   uuid,
    company_id      uuid,
    app_code        text        NOT NULL,
    action          text        NOT NULL,               -- 'create', 'update', 'approve', 'login', ...
    entity_type     text        NOT NULL,               -- 'core.users', 'inventory.stock_receipts'...
    entity_id       uuid,
    before_data     jsonb,
    after_data      jsonb,
    ip              inet,
    user_agent      text,
    request_id      text,
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE core.audit_events_2026_11 PARTITION OF core.audit_events
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE core.audit_events_2026_12 PARTITION OF core.audit_events
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE INDEX audit_events_entity_idx ON core.audit_events (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_events_actor_idx  ON core.audit_events (actor_user_id, occurred_at DESC);

-- Outbox: ghi su kien trong cung giao dich voi du lieu, worker day sang SQS/SNS.
CREATE TABLE core.outbox_events (
    id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    event_type      text        NOT NULL,               -- 'core.user.created', 'inventory.stock.changed'...
    aggregate_type  text        NOT NULL,
    aggregate_id    uuid        NOT NULL,
    company_id      uuid,
    payload         jsonb       NOT NULL,
    published_at    timestamptz,
    attempts        integer     NOT NULL DEFAULT 0,
    last_error      text
);
CREATE INDEX outbox_unpublished_idx ON core.outbox_events (id) WHERE published_at IS NULL;

-- -----------------------------------------------------------------------------
-- 8. Du lieu khoi tao
-- -----------------------------------------------------------------------------
INSERT INTO core.currencies (code, name_vi, name_en, minor_units) VALUES
    ('VND', 'Đồng Việt Nam', 'Vietnamese dong', 0),
    ('USD', 'Đô la Mỹ', 'US dollar', 2),
    ('CNY', 'Nhân dân tệ', 'Chinese yuan', 2),
    ('EUR', 'Euro', 'Euro', 2);

INSERT INTO core.apps (code, name_vi, name_en, base_url, icon, sort_order) VALUES
    ('platform',   'Quản trị hệ thống', 'Administration',     '/platform',   'settings',  10),
    ('catalog',    'Sản phẩm & Nhà bán', 'Products & Sellers', '/catalog',    'package',   20),
    ('inventory',  'Kho',               'Inventory',          '/inventory',  'warehouse', 30),
    ('purchasing', 'Mua hàng',          'Purchasing',         '/purchasing', 'cart',      40),
    ('sales',      'Bán hàng',          'Sales',              '/sales',      'receipt',   50),
    ('finance',    'Tài chính - Kế toán', 'Finance & Accounting', '/finance', 'calculator', 60),
    ('crm',        'Khách hàng & Đối tác', 'Customers & Partners', '/crm',    'users',     70),
    ('hr',         'Nhân sự',           'Human Resources',    '/hr',         'id-card',   80);
