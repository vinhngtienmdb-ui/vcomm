-- CONG_VIEC_65 L1: đối tác liên minh điểm ngoài tập đoàn – hợp đồng, tỷ lệ theo chiều và giai đoạn, giới hạn, liên kết thành viên, bộ giả lập
-- (QUYTAC_NGHIEPVU_538 đến 541, 550, 551). Schema loyalty của MODULE_11; khóa ngoại chỉ trỏ vào `core`, `crm`, `loyalty`.

CREATE SEQUENCE loyalty.partner_contract_code_seq;

-- Hợp đồng đối tác liên minh: một hợp đồng cho một đối tác ngoài tập đoàn; thuộc công ty vận hành sàn.
CREATE TABLE loyalty.partner_contracts (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    code                text          NOT NULL UNIQUE DEFAULT 'LM' || lpad(nextval('loyalty.partner_contract_code_seq')::text, 4, '0'),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    partner_id          uuid          NOT NULL UNIQUE REFERENCES crm.partners(id),
    program_name        text          NOT NULL CHECK (length(program_name) BETWEEN 1 AND 100),
    unit_name_vi        text          NOT NULL CHECK (length(unit_name_vi) BETWEEN 1 AND 30),
    unit_name_en        text          NOT NULL CHECK (length(unit_name_en) BETWEEN 1 AND 30),
    contract_no         text          NOT NULL CHECK (length(contract_no) BETWEEN 1 AND 50),
    effective_from      date          NOT NULL,
    effective_to        date          CHECK (effective_to IS NULL OR effective_to >= effective_from),
    outbound_enabled    boolean       NOT NULL DEFAULT false,
    inbound_enabled     boolean       NOT NULL DEFAULT false,
    gift_enabled        boolean       NOT NULL DEFAULT false,
    payment_mode        text          NOT NULL CHECK (payment_mode IN ('prepaid', 'postpaid')),
    credit_limit        numeric(18,4) CHECK (credit_limit IS NULL OR credit_limit > 0),
    payment_term_days   integer       NOT NULL DEFAULT 15 CHECK (payment_term_days BETWEEN 1 AND 60),
    tax_percent         numeric(5,2)  NOT NULL DEFAULT 10 CHECK (tax_percent BETWEEN 0 AND 10),
    connector           text          NOT NULL DEFAULT 'simulator' CHECK (connector IN ('simulator')),
    member_pattern      text          NOT NULL DEFAULT '^[A-Za-z0-9]{6,20}$' CHECK (length(member_pattern) BETWEEN 1 AND 200),
    status              text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'terminated')),
    status_reason       text          CHECK (status_reason IS NULL OR length(status_reason) BETWEEN 1 AND 500),
    created_by          uuid          NOT NULL REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_by          uuid          NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    CHECK (outbound_enabled OR inbound_enabled OR gift_enabled),
    CHECK ((payment_mode = 'postpaid') = (credit_limit IS NOT NULL))
);
CREATE INDEX partner_contracts_company_status_idx ON loyalty.partner_contracts (company_id, status);

-- Tỷ lệ theo chiều và giai đoạn (QUYTAC_NGHIEPVU_539). Không chồng lấn trong cùng chiều: kiểm trong giao dịch có khóa dòng hợp đồng.
-- Đổi ra, đổi vào: vcomm_points điểm VComm = partner_units đơn vị đối tác; unit_price là đơn giá một đơn vị đối tác. Tặng: unit_price là giá bán một điểm VComm.
CREATE TABLE loyalty.partner_rates (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     uuid          NOT NULL REFERENCES loyalty.partner_contracts(id),
    direction       text          NOT NULL CHECK (direction IN ('outbound', 'inbound', 'gift')),
    starts_on       date          NOT NULL,
    ends_on         date          CHECK (ends_on IS NULL OR ends_on >= starts_on),
    vcomm_points    integer       CHECK (vcomm_points IS NULL OR vcomm_points >= 1),
    partner_units   integer       CHECK (partner_units IS NULL OR partner_units >= 1),
    unit_price      numeric(18,4) NOT NULL CHECK (unit_price > 0),
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_by      uuid          NOT NULL REFERENCES core.users(id),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    version         integer       NOT NULL DEFAULT 1,
    CHECK ((direction = 'gift') = (vcomm_points IS NULL AND partner_units IS NULL))
);
CREATE INDEX partner_rates_contract_idx ON loyalty.partner_rates (contract_id, direction, starts_on);

-- Giới hạn ba tầng theo chiều, điểm VComm; trống: không giới hạn (QUYTAC_NGHIEPVU_540).
-- Tặng: max_points là tối đa mỗi lần tặng; không dùng min_points, customer_daily_points.
CREATE TABLE loyalty.partner_limits (
    contract_id             uuid    NOT NULL REFERENCES loyalty.partner_contracts(id),
    direction               text    NOT NULL CHECK (direction IN ('outbound', 'inbound', 'gift')),
    min_points              integer CHECK (min_points IS NULL OR min_points >= 1),
    max_points              integer CHECK (max_points IS NULL OR max_points >= 1),
    customer_daily_points   integer CHECK (customer_daily_points IS NULL OR customer_daily_points >= 1),
    customer_monthly_points integer CHECK (customer_monthly_points IS NULL OR customer_monthly_points >= 1),
    partner_monthly_points  integer CHECK (partner_monthly_points IS NULL OR partner_monthly_points >= 1),
    PRIMARY KEY (contract_id, direction),
    CHECK (min_points IS NULL OR max_points IS NULL OR min_points <= max_points),
    CHECK (direction <> 'gift' OR (min_points IS NULL AND customer_daily_points IS NULL))
);

-- Liên kết số thành viên đối tác với tài khoản VComm (QUYTAC_NGHIEPVU_541); chỉ lưu tên đã che do đối tác trả.
CREATE TABLE loyalty.partner_memberships (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id         uuid        NOT NULL REFERENCES loyalty.partner_contracts(id),
    user_id             uuid        NOT NULL REFERENCES core.users(id),
    member_number       text        NOT NULL CHECK (length(member_number) BETWEEN 1 AND 50),
    member_name_masked  text        CHECK (member_name_masked IS NULL OR length(member_name_masked) <= 100),
    status              text        NOT NULL DEFAULT 'linked' CHECK (status IN ('linked', 'unlinked')),
    linked_at           timestamptz NOT NULL DEFAULT now(),
    unlinked_at         timestamptz,
    CHECK ((status = 'unlinked') = (unlinked_at IS NOT NULL))
);
CREATE UNIQUE INDEX partner_memberships_member_idx ON loyalty.partner_memberships (contract_id, member_number) WHERE status = 'linked';
CREATE UNIQUE INDEX partner_memberships_user_idx ON loyalty.partner_memberships (contract_id, user_id) WHERE status = 'linked';

-- Yêu cầu liên kết chờ khách nhập mã OTP do đối tác gửi; hết hạn 5 phút. `reference` là mã tham chiếu VComm gửi đối tác.
CREATE TABLE loyalty.partner_link_requests (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     uuid        NOT NULL REFERENCES loyalty.partner_contracts(id),
    user_id         uuid        NOT NULL REFERENCES core.users(id),
    member_number   text        NOT NULL CHECK (length(member_number) BETWEEN 1 AND 50),
    reference       text        NOT NULL UNIQUE,
    status          text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'linked', 'failed', 'expired')),
    expires_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_link_requests_user_idx ON loyalty.partner_link_requests (user_id, contract_id, created_at);

-- Bộ giả lập đối tác (QUYTAC_NGHIEPVU_550): chỉ dùng khi máy chủ bật LOYALTY_PARTNER_SIMULATOR=on.
CREATE TABLE loyalty.partner_simulator_settings (
    contract_id     uuid        PRIMARY KEY REFERENCES loyalty.partner_contracts(id),
    mode            text        NOT NULL DEFAULT 'normal' CHECK (mode IN ('normal', 'reject', 'timeout', 'statement_mismatch')),
    updated_by      uuid        REFERENCES core.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE loyalty.partner_simulator_members (
    contract_id     uuid        NOT NULL REFERENCES loyalty.partner_contracts(id),
    member_number   text        NOT NULL CHECK (length(member_number) BETWEEN 1 AND 50),
    full_name       text        NOT NULL CHECK (length(full_name) BETWEEN 1 AND 100),
    phone           text        NOT NULL CHECK (length(phone) BETWEEN 1 AND 20),
    balance_units   integer     NOT NULL DEFAULT 0 CHECK (balance_units >= 0),
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contract_id, member_number)
);
-- Mã OTP bộ giả lập gửi: chỉ lưu băm; sai 5 lần hết hiệu lực.
CREATE TABLE loyalty.partner_simulator_otps (
    reference       text        PRIMARY KEY,
    contract_id     uuid        NOT NULL REFERENCES loyalty.partner_contracts(id),
    member_number   text        NOT NULL,
    code_hash       text        NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
    wrong_attempts  integer     NOT NULL DEFAULT 0,
    expires_at      timestamptz NOT NULL,
    consumed_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO core.permissions (code, app_code, name_vi, name_en, is_sensitive) VALUES
    ('loyalty.partner.view', 'crm', 'Xem đối tác liên minh điểm, giao dịch đổi, tặng, đối soát', 'View loyalty alliance partners, exchanges, gifts, settlements', false),
    ('loyalty.partner.manage', 'crm', 'Quản lý hợp đồng đối tác liên minh điểm, xử lý giao dịch, xác nhận đối soát', 'Manage loyalty alliance partners, resolve exchanges, confirm settlements', true)
ON CONFLICT (code) DO NOTHING;
