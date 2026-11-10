-- CONG_VIEC_23: Tài khoản người mua VComm (CHUC_NANG_104 đến 108; QUYTAC_NGHIEPVU_141 đến 147; THAY_DOI_14).

CREATE SCHEMA IF NOT EXISTS marketplace;

-- Công ty vận hành sàn VComm: một công ty duy nhất trong tập đoàn (QUYTAC_NGHIEPVU_147).
ALTER TABLE core.companies ADD COLUMN is_marketplace_operator boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX companies_marketplace_operator_idx ON core.companies ((true)) WHERE is_marketplace_operator;

-- Phiên của ứng dụng VComm cho người mua: token làm mới 90 ngày.
ALTER TABLE core.sessions DROP CONSTRAINT sessions_client_type_check;
ALTER TABLE core.sessions ADD CONSTRAINT sessions_client_type_check CHECK (client_type IN ('web', 'warehouse_app', 'sales_app', 'vcomm_app'));

-- Mã OTP theo mục đích: mã đăng ký, đặt lại mật khẩu không dùng để đăng nhập và ngược lại.
ALTER TABLE core.otp_codes ADD COLUMN purpose text NOT NULL DEFAULT 'login' CHECK (purpose IN ('login', 'register', 'password_reset'));
CREATE INDEX otp_codes_phone_purpose_idx ON core.otp_codes (phone, purpose, created_at DESC);

-- Tài khoản người mua: một dòng cho mỗi người dùng đã dùng ứng dụng VComm.
CREATE TABLE marketplace.buyer_accounts (
    user_id             uuid        PRIMARY KEY REFERENCES core.users(id),
    referrer_user_id    uuid        REFERENCES core.users(id),
    registered_at       timestamptz NOT NULL DEFAULT now(),
    is_sales_staff      boolean     NOT NULL DEFAULT false,      -- đánh dấu nhân viên kinh doanh (QUYTAC_NGHIEPVU_144)
    sales_company_id    uuid        REFERENCES core.companies(id),
    sales_department_id uuid        REFERENCES core.departments(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    CHECK (referrer_user_id IS NULL OR referrer_user_id <> user_id),
    CHECK (is_sales_staff = (sales_company_id IS NOT NULL AND sales_department_id IS NOT NULL))
);
CREATE INDEX buyer_accounts_referrer_idx ON marketplace.buyer_accounts (referrer_user_id, registered_at DESC);
CREATE INDEX buyer_accounts_registered_idx ON marketplace.buyer_accounts (registered_at DESC);

-- Lịch sử người giới thiệu: gắn khi đăng ký, khách tự nhập, quản trị đổi (QUYTAC_NGHIEPVU_143).
CREATE TABLE marketplace.referrer_history (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_user_id           uuid        NOT NULL REFERENCES marketplace.buyer_accounts(user_id),
    previous_referrer_id    uuid        REFERENCES core.users(id),
    new_referrer_id         uuid        REFERENCES core.users(id),
    source                  text        NOT NULL CHECK (source IN ('registration', 'self', 'admin')),
    reason                  text        CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500),
    changed_by              uuid        NOT NULL REFERENCES core.users(id),
    changed_at              timestamptz NOT NULL DEFAULT now(),
    CHECK (source <> 'admin' OR reason IS NOT NULL)
);
CREATE INDEX referrer_history_buyer_idx ON marketplace.referrer_history (buyer_user_id, changed_at DESC);

-- Lịch sử đánh dấu nhân viên kinh doanh (QUYTAC_NGHIEPVU_144).
CREATE TABLE marketplace.sales_flag_history (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_user_id       uuid        NOT NULL REFERENCES marketplace.buyer_accounts(user_id),
    action              text        NOT NULL CHECK (action IN ('flag', 'unflag')),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    department_id       uuid        REFERENCES core.departments(id),
    changed_by          uuid        NOT NULL REFERENCES core.users(id),
    changed_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sales_flag_history_buyer_idx ON marketplace.sales_flag_history (buyer_user_id, changed_at DESC);

INSERT INTO core.permissions (code, app_code, name_vi, name_en, is_sensitive) VALUES
    ('marketplace.buyer.view', 'crm', 'Xem tài khoản người mua', 'View buyer accounts', false),
    ('marketplace.buyer.manage', 'crm', 'Đổi người giới thiệu, đánh dấu nhân viên kinh doanh', 'Change referrers, flag sales staff', true)
ON CONFLICT (code) DO NOTHING;
