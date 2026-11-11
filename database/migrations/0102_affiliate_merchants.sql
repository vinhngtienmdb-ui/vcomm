-- CONG_VIEC_55 L0: cửa hàng liên kết (MODULE_12), schema `affiliate` (QUYTAC_NGHIEPVU_392, 393; tài liệu 16).
-- Khóa ngoại chỉ trỏ vào `core`, `crm`.

CREATE SCHEMA IF NOT EXISTS affiliate;

CREATE SEQUENCE affiliate.merchant_code_seq;

-- Hợp đồng cửa hàng liên kết: một hợp đồng cho một đối tác ngoài tập đoàn; thuộc công ty vận hành sàn.
CREATE TABLE affiliate.merchants (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    code                text          NOT NULL UNIQUE DEFAULT 'CH' || lpad(nextval('affiliate.merchant_code_seq')::text, 6, '0'),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    partner_id          uuid          NOT NULL UNIQUE REFERENCES crm.partners(id),
    contract_no         text          NOT NULL CHECK (length(contract_no) BETWEEN 1 AND 50),
    starts_on           date          NOT NULL,
    ends_on             date          CHECK (ends_on IS NULL OR ends_on >= starts_on),
    earn_percent        numeric(6,4)  NOT NULL CHECK (earn_percent BETWEEN 0.1 AND 20),
    fee_percent         numeric(6,4)  NOT NULL DEFAULT 0 CHECK (fee_percent BETWEEN 0 AND 20),
    credit_limit        numeric(18,4) NOT NULL CHECK (credit_limit > 0),
    transaction_cap     numeric(18,4) NOT NULL CHECK (transaction_cap > 0),
    payment_term_days   integer       NOT NULL DEFAULT 7 CHECK (payment_term_days BETWEEN 1 AND 30),
    auto_confirm_days   integer       NOT NULL DEFAULT 3 CHECK (auto_confirm_days BETWEEN 1 AND 7),
    status              text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'suspended', 'terminated')),
    status_reason       text          CHECK (status_reason IS NULL OR length(status_reason) BETWEEN 1 AND 500),
    created_by          uuid          NOT NULL REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_by          uuid          NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1
);
CREATE INDEX merchants_company_status_idx ON affiliate.merchants (company_id, status);

-- Điểm bán của cửa hàng; chỉ công ty thêm (đặc tả mục 18).
CREATE TABLE affiliate.outlets (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    address         text        NOT NULL CHECK (length(address) BETWEEN 1 AND 300),
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (merchant_id, name)
);

-- Thành viên cửa hàng: chủ (mọi điểm bán) hoặc thu ngân (điểm bán được gán). Người được mời chưa có tài khoản thì `user_id` trống tới khi nhận lời mời.
CREATE TABLE affiliate.members (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    user_id         uuid        REFERENCES core.users(id),
    phone           text        NOT NULL,                                   -- dạng +84…, số được mời
    full_name       text        NOT NULL CHECK (length(full_name) BETWEEN 1 AND 100),
    role            text        NOT NULL CHECK (role IN ('owner', 'cashier')),
    status          text        NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'locked')),
    invited_by      uuid        NOT NULL REFERENCES core.users(id),
    invited_at      timestamptz NOT NULL DEFAULT now(),
    -- Lời mời hiệu lực 72 giờ; người được mời kích hoạt bằng số điện thoại và mã OTP trên cổng cửa hàng (QUYTAC_NGHIEPVU_393).
    invitation_expires_at timestamptz,
    activated_at    timestamptz,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    CHECK (status = 'locked' OR (status = 'invited') = (user_id IS NULL)),
    CHECK ((status = 'invited') <= (invitation_expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX members_merchant_phone_idx ON affiliate.members (merchant_id, phone);
CREATE UNIQUE INDEX members_merchant_user_idx ON affiliate.members (merchant_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX members_user_idx ON affiliate.members (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX members_invited_phone_idx ON affiliate.members (phone) WHERE status = 'invited';

CREATE TABLE affiliate.member_outlets (
    member_id   uuid NOT NULL REFERENCES affiliate.members(id),
    outlet_id   uuid NOT NULL REFERENCES affiliate.outlets(id),
    PRIMARY KEY (member_id, outlet_id)
);
