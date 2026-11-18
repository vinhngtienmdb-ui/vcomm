-- CONG_VIEC_74 L1: iPOS – quầy, ghép thiết bị, mã PIN, phiên trên thiết bị, thu ngân tự đăng ký
-- (QUYTAC_NGHIEPVU_604 đến 607; tài liệu 16). Ràng buộc dùng chung định nghĩa lại gồm mọi giá trị trên `main` mới nhất.

-- Quầy thu ngân của điểm bán có thuê bao (QUYTAC_NGHIEPVU_606).
CREATE TABLE ipos.registers (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    outlet_id       uuid        NOT NULL REFERENCES affiliate.outlets(id),
    name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    UNIQUE (outlet_id, name)
);
CREATE INDEX registers_merchant_idx ON ipos.registers (merchant_id);
CREATE TRIGGER registers_outlet_merchant BEFORE INSERT OR UPDATE OF outlet_id, merchant_id ON ipos.registers
    FOR EACH ROW EXECUTE FUNCTION ipos.check_outlet_merchant();

-- Thiết bị đã ghép với quầy: khóa thiết bị chỉ lưu bản băm; mỗi quầy tối đa một thiết bị đang ghép.
CREATE TABLE ipos.devices (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    register_id     uuid        NOT NULL REFERENCES ipos.registers(id),
    key_hash        text        NOT NULL UNIQUE,
    model           text        CHECK (model IS NULL OR length(model) <= 100),
    app_version     text        CHECK (app_version IS NULL OR length(app_version) <= 30),
    paired_by       uuid        NOT NULL REFERENCES core.users(id),
    paired_at       timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    revoked_at      timestamptz,
    revoked_by      uuid        REFERENCES core.users(id)
);
CREATE UNIQUE INDEX devices_register_active_idx ON ipos.devices (register_id) WHERE revoked_at IS NULL;
CREATE INDEX devices_merchant_idx ON ipos.devices (merchant_id);

-- Mã ghép 8 ký tự, hiệu lực 10 phút, dùng một lần; chỉ lưu bản băm.
CREATE TABLE ipos.pairing_codes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    register_id     uuid        NOT NULL REFERENCES ipos.registers(id),
    code_hash       text        NOT NULL,
    expires_at      timestamptz NOT NULL,
    used_at         timestamptz,
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pairing_codes_hash_idx ON ipos.pairing_codes (code_hash) WHERE used_at IS NULL;

-- Mã PIN theo (thành viên, thiết bị), băm argon2id; sai 5 lần khóa 15 phút (QUYTAC_NGHIEPVU_607).
CREATE TABLE ipos.member_pins (
    member_id       uuid        NOT NULL REFERENCES affiliate.members(id),
    device_id       uuid        NOT NULL REFERENCES ipos.devices(id),
    pin_hash        text        NOT NULL,
    failed_count    integer     NOT NULL DEFAULT 0 CHECK (failed_count BETWEEN 0 AND 5),
    locked_until    timestamptz,
    last_login_at   timestamptz,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, device_id)
);

-- Phiên đăng nhập trên thiết bị: chuỗi phiên `core.sessions` loại `ipos_app` gắn một thiết bị, một thành viên.
CREATE TABLE ipos.device_sessions (
    -- Chuỗi phiên (family_id của core.sessions): token làm mới đổi mỗi lần dùng nhưng giữ chuỗi.
    family_id       uuid        PRIMARY KEY,
    device_id       uuid        NOT NULL REFERENCES ipos.devices(id),
    member_id       uuid        NOT NULL REFERENCES affiliate.members(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX device_sessions_device_idx ON ipos.device_sessions (device_id);

-- Thu ngân tự đăng ký chờ chủ cửa hàng duyệt (QUYTAC_NGHIEPVU_605). Vai trò luôn là thu ngân.
CREATE TABLE ipos.cashier_registrations (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id             uuid        NOT NULL REFERENCES affiliate.merchants(id),
    user_id                 uuid        NOT NULL REFERENCES core.users(id),
    phone                   text        NOT NULL,
    full_name               text        NOT NULL CHECK (length(full_name) BETWEEN 1 AND 100),
    requested_outlet_ids    uuid[]      NOT NULL DEFAULT '{}',
    status                  text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    expires_at              timestamptz NOT NULL,
    decided_by              uuid        REFERENCES core.users(id),
    decided_at              timestamptz,
    reason                  text        CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 500),
    created_at              timestamptz NOT NULL DEFAULT now(),
    CHECK ((status IN ('approved', 'rejected')) = (decided_at IS NOT NULL))
);
CREATE UNIQUE INDEX cashier_registrations_pending_idx ON ipos.cashier_registrations (merchant_id, phone) WHERE status = 'pending';
CREATE INDEX cashier_registrations_merchant_idx ON ipos.cashier_registrations (merchant_id, status, created_at);
CREATE INDEX cashier_registrations_phone_idx ON ipos.cashier_registrations (phone, created_at);

-- Phiên ứng dụng iPOS (token làm mới 12 giờ).
ALTER TABLE core.sessions DROP CONSTRAINT sessions_client_type_check;
ALTER TABLE core.sessions ADD CONSTRAINT sessions_client_type_check CHECK (client_type IN ('web', 'warehouse_app', 'sales_app', 'vcomm_app', 'ipos_app'));

-- Mã OTP đăng ký thu ngân, đăng nhập thiết bị iPOS lần đầu.
ALTER TABLE core.otp_codes DROP CONSTRAINT otp_codes_purpose_check;
ALTER TABLE core.otp_codes ADD CONSTRAINT otp_codes_purpose_check CHECK (purpose IN ('login', 'register', 'password_reset', 'smart_otp', 'affiliate_redeem', 'ipos_register', 'ipos_login'));
