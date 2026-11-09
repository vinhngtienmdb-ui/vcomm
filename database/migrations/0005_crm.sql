-- CONG_VIEC_06: danh mục đối tác dùng chung tập đoàn (MODULE_07, phần tối thiểu), schema `crm` (tài liệu 12 mục 2, tài liệu 16).
-- Khóa ngoại chỉ trỏ vào `crm` và `core`.

CREATE SCHEMA IF NOT EXISTS crm;

CREATE SEQUENCE crm.partner_code_seq;

-- Đối tác dùng chung tập đoàn (CHUC_NANG_46, 47; QUYTAC_NGHIEPVU_56 đến 59).
CREATE TABLE crm.partners (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text        NOT NULL UNIQUE DEFAULT 'DT' || lpad(nextval('crm.partner_code_seq')::text, 6, '0'),
    kind            text        NOT NULL CHECK (kind IN ('organization', 'household', 'individual')),
    name            text        NOT NULL,
    short_name      text,
    tax_code        text        UNIQUE CHECK (tax_code ~ '^[0-9]{10}(-[0-9]{3})?$'),
    citizen_id      text        UNIQUE CHECK (citizen_id ~ '^[0-9]{12}$'),          -- dữ liệu cá nhân, không trả về trong danh sách
    address         text,
    phone           text,
    email           text,
    company_id      uuid        UNIQUE REFERENCES core.companies(id),               -- đối tác nội bộ: công ty con trong tập đoàn
    search_text     text        NOT NULL,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid        REFERENCES core.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid        REFERENCES core.users(id),
    version         integer     NOT NULL DEFAULT 1,
    CHECK (kind = 'individual' OR tax_code IS NOT NULL OR company_id IS NOT NULL),   -- công ty con chưa khai mã số thuế vẫn là đối tác nội bộ
    CHECK (kind <> 'individual' OR citizen_id IS NOT NULL)
);
CREATE INDEX partners_search_idx ON crm.partners (search_text);
CREATE INDEX partners_phone_idx ON crm.partners (phone);

CREATE TABLE crm.partner_contacts (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id      uuid        NOT NULL REFERENCES crm.partners(id) ON DELETE CASCADE,
    full_name       text        NOT NULL,
    position        text,
    phone           text,
    email           text,
    is_primary      boolean     NOT NULL DEFAULT false,
    sort_order      integer     NOT NULL DEFAULT 0
);
CREATE INDEX partner_contacts_partner_idx ON crm.partner_contacts (partner_id);

CREATE TABLE crm.partner_bank_accounts (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id      uuid        NOT NULL REFERENCES crm.partners(id) ON DELETE CASCADE,
    bank_name       text        NOT NULL,
    account_no      text        NOT NULL,
    account_holder  text        NOT NULL,
    branch          text,
    is_default      boolean     NOT NULL DEFAULT false,
    sort_order      integer     NOT NULL DEFAULT 0
);
CREATE INDEX partner_bank_accounts_partner_idx ON crm.partner_bank_accounts (partner_id);

-- Hồ sơ đối tác của từng công ty (CHUC_NANG_48; QUYTAC_NGHIEPVU_60). Nhóm khách hàng thuộc schema catalog nên không đặt khóa ngoại.
CREATE TABLE crm.partner_profiles (
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    partner_id          uuid        NOT NULL REFERENCES crm.partners(id),
    is_customer         boolean     NOT NULL DEFAULT false,
    is_supplier         boolean     NOT NULL DEFAULT false,
    payment_term_days   integer     NOT NULL DEFAULT 0 CHECK (payment_term_days BETWEEN 0 AND 365),
    credit_limit        numeric(20,4) CHECK (credit_limit >= 0),                 -- để trống: không giới hạn
    customer_group_id   uuid,
    owner_user_id       uuid        REFERENCES core.users(id),                   -- nhân viên phụ trách
    note                text,
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid        REFERENCES core.users(id),
    version             integer     NOT NULL DEFAULT 1,
    PRIMARY KEY (company_id, partner_id),
    CHECK (is_customer OR is_supplier)
);
CREATE INDEX partner_profiles_partner_idx ON crm.partner_profiles (partner_id);
