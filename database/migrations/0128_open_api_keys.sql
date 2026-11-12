-- CONG_VIEC_61 lát L1: khóa API của đối tác (QUYTAC_NGHIEPVU_480 đến 483, 486).
CREATE TABLE core.api_keys (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    kind                    text        NOT NULL CHECK (kind IN ('partner', 'internal')),
    partner_id              uuid        REFERENCES crm.partners(id),
    name                    text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    key_prefix              text        NOT NULL CHECK (key_prefix ~ '^[A-Za-z0-9]{8}$'),
    key_hash                text        NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),   -- SHA-256 của khóa, không lưu khóa rõ
    scopes                  text[]      NOT NULL CHECK (cardinality(scopes) >= 1 AND scopes <@ ARRAY['catalog.read', 'sales_order.write', 'customer.write', 'loyalty.member']::text[]),
    channel_id              uuid        NOT NULL REFERENCES catalog.sales_channels(id),
    rate_limit_per_minute   integer     NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute BETWEEN 1 AND 600),
    expires_on              date,                                                              -- để trống: không hết hạn
    allowed_ips             inet[]      NOT NULL DEFAULT '{}' CHECK (cardinality(allowed_ips) <= 20),   -- rỗng: mọi IP
    status                  text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    revoked_reason          text        CHECK (char_length(revoked_reason) BETWEEN 1 AND 500),
    revoked_by              uuid        REFERENCES core.users(id),
    revoked_at              timestamptz,
    last_used_at            timestamptz,
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_by              uuid        REFERENCES core.users(id),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    CHECK ((kind = 'partner') = (partner_id IS NOT NULL)),
    CHECK ((status = 'revoked') = (revoked_reason IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX api_keys_name_idx ON core.api_keys (company_id, lower(name)) WHERE status = 'active';
CREATE INDEX api_keys_company_idx ON core.api_keys (company_id, created_at DESC);
CREATE INDEX api_keys_partner_idx ON core.api_keys (partner_id) WHERE partner_id IS NOT NULL;

-- Kho được xem tồn, xuất đơn của khóa.
CREATE TABLE core.api_key_warehouses (
    api_key_id      uuid        NOT NULL REFERENCES core.api_keys(id) ON DELETE CASCADE,
    warehouse_id    uuid        NOT NULL REFERENCES inventory.warehouses(id),
    PRIMARY KEY (api_key_id, warehouse_id)
);

INSERT INTO core.permissions (code, app_code, name_vi, name_en, is_sensitive) VALUES
    ('platform.api_key.manage', 'platform', 'Cấp, sửa, thu hồi khóa API đối tác', 'Manage partner API keys', true),
    ('platform.api_log.view', 'platform', 'Xem nhật ký gọi API đối tác', 'View partner API call log', false)
ON CONFLICT (code) DO NOTHING;
