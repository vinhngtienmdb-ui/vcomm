-- CONG_VIEC_03: Cài đặt tích hợp, mã OTP qua số điện thoại, nhật ký gửi tin, mẫu đề xuất, đề xuất, tệp đính kèm (tài liệu 16).

-- Cài đặt tích hợp (CHUC_NANG_25; QUYTAC_NGHIEPVU_31): giá trị thường hoặc giá trị bí mật đã mã hóa AES-256-GCM.
CREATE TABLE core.integration_settings (
    setting_key     text        PRIMARY KEY,                -- 'google.client_id', 'esms.secret_key'...
    plain_value     text,
    secret_value    bytea,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid        REFERENCES core.users(id),
    CHECK (plain_value IS NULL OR secret_value IS NULL)
);

-- Mã OTP đăng nhập bằng số điện thoại (CHUC_NANG_08; QUYTAC_NGHIEPVU_10): hiệu lực 5 phút, tối đa 5 lần nhập sai.
CREATE TABLE core.otp_codes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    phone           text        NOT NULL,                   -- dạng +84...
    code_hash       text        NOT NULL,                   -- SHA-256 của mã
    expires_at      timestamptz NOT NULL,
    wrong_attempts  smallint    NOT NULL DEFAULT 0,
    consumed_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_phone_idx ON core.otp_codes (phone, created_at DESC);

-- Nhật ký gửi tin Zalo ZNS, SMS qua eSMS.vn (QUYTAC_NGHIEPVU_32). Không lưu nội dung mã OTP.
CREATE TABLE core.message_deliveries (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel             text        NOT NULL CHECK (channel IN ('zns', 'zns_sms', 'sms')),
    purpose             text        NOT NULL,               -- 'login_otp', 'approval.assigned'...
    user_id             uuid        REFERENCES core.users(id),
    phone_masked        text        NOT NULL,               -- +8490***4567
    template_id         text,
    status              text        NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
    provider_message_id text,
    error               text,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_deliveries_created_idx ON core.message_deliveries (created_at DESC);

-- Mẫu đề xuất (CHUC_NANG_27; QUYTAC_NGHIEPVU_33): mỗi mẫu là một loại chứng từ cần duyệt của công ty.
CREATE TABLE core.proposal_templates (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    code                text        NOT NULL,               -- 'PC', 'TU', 'MS'...
    name                text        NOT NULL,
    description         text,
    document_type_code  text        NOT NULL UNIQUE REFERENCES core.document_types(code),
    fields              jsonb       NOT NULL,               -- danh sách trường: key, label, type, required, options, columns
    amount_field        text,                               -- khóa trường tiền dùng làm giá trị duyệt; NULL = tổng thành tiền bảng chi tiết
    currency            char(3)     NOT NULL DEFAULT 'VND' REFERENCES core.currencies(code),
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid,
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);

-- Đề xuất (CHUC_NANG_28; QUYTAC_NGHIEPVU_33, 34).
CREATE TABLE core.proposals (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    template_id         uuid        NOT NULL REFERENCES core.proposal_templates(id),
    template_snapshot   jsonb       NOT NULL,               -- bản chụp mẫu lúc lập, không đổi khi mẫu bị sửa
    document_type_code  text        NOT NULL REFERENCES core.document_types(code),
    proposal_no         text,                               -- cấp khi gửi
    title               text        NOT NULL,
    field_values        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    amount              numeric(20,4) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    currency            char(3)     NOT NULL REFERENCES core.currencies(code),
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn')),
    approval_request_id uuid        REFERENCES core.approval_requests(id),
    requested_by        uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    submitted_at        timestamptz,
    completed_at        timestamptz,
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, proposal_no)
);
CREATE INDEX proposals_requester_idx ON core.proposals (requested_by, created_at DESC);
CREATE INDEX proposals_company_idx ON core.proposals (company_id, created_at DESC);

-- Tệp đính kèm (QUYTAC_NGHIEPVU_35): nội dung lưu S3 hoặc thư mục cục bộ theo khóa lưu trữ.
CREATE TABLE core.attachments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    owner_type      text        NOT NULL CHECK (owner_type IN ('proposal')),
    owner_id        uuid        NOT NULL,
    file_name       text        NOT NULL,
    content_type    text        NOT NULL,
    size_bytes      integer     NOT NULL CHECK (size_bytes > 0),
    storage_key     text        NOT NULL UNIQUE,
    uploaded_by     uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX attachments_owner_idx ON core.attachments (owner_type, owner_id);
