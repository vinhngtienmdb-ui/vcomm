-- CONG_VIEC_59 lát L1: ký số tài liệu PDF qua nhà cung cấp ký số từ xa (CHUC_NANG_210, 211; QUYTAC_NGHIEPVU_454 đến 461).

-- Nhà cung cấp ký số và chữ ký số của công ty (QUYTAC_NGHIEPVU_454, 456). Thông tin kết nối mã hóa bằng common/secret-box.ts.
CREATE TABLE office.signing_settings (
    company_id              uuid        PRIMARY KEY REFERENCES core.companies(id),
    provider                text        NOT NULL CHECK (provider IN ('simulator')),
    environment             text        NOT NULL CHECK (environment IN ('test', 'production')),
    credentials_encrypted   bytea,
    seal_identity_code      text,
    seal_certificate_chain  jsonb,
    seal_serial_number      text,
    seal_subject_name       text,
    seal_valid_from         timestamptz,
    seal_valid_to           timestamptz,
    updated_at              timestamptz NOT NULL DEFAULT now(),
    updated_by              uuid        NOT NULL REFERENCES core.users(id),
    version                 integer     NOT NULL DEFAULT 1,
    CHECK ((seal_identity_code IS NULL) = (seal_certificate_chain IS NULL))
);

-- Tài khoản ký số của người dùng theo công ty (QUYTAC_NGHIEPVU_455); không lưu khóa bí mật.
CREATE TABLE office.signing_identities (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    user_id             uuid        NOT NULL REFERENCES core.users(id),
    provider            text        NOT NULL,
    identity_code       text        NOT NULL,
    certificate_chain   jsonb       NOT NULL,
    serial_number       text        NOT NULL,
    subject_name        text        NOT NULL,
    subject_identities  text[]      NOT NULL DEFAULT '{}',
    valid_from          timestamptz NOT NULL,
    valid_to            timestamptz NOT NULL,
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced')),
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX signing_identities_active_idx ON office.signing_identities (company_id, user_id) WHERE status = 'active';

-- Chứng thư gốc tin cậy theo tập đoàn (QUYTAC_NGHIEPVU_461).
CREATE TABLE office.trusted_roots (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_company_id    uuid        NOT NULL REFERENCES core.companies(id),
    certificate_pem     text        NOT NULL,
    fingerprint         text        NOT NULL,
    subject_name        text        NOT NULL,
    valid_from          timestamptz NOT NULL,
    valid_to            timestamptz NOT NULL,
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (group_company_id, fingerprint)
);

-- Phiên ký (QUYTAC_NGHIEPVU_458, 459).
CREATE TABLE office.signing_requests (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    request_no          text        NOT NULL,
    source_type         text        NOT NULL DEFAULT 'document' CHECK (source_type IN ('document')),
    source_id           uuid,
    title               text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    note                text        CHECK (char_length(note) <= 2000),
    due_on              date        NOT NULL,
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signing', 'completed', 'rejected', 'cancelled', 'expired')),
    original_file_id    uuid,
    current_file_id     uuid,
    copied_from_id      uuid        REFERENCES office.signing_requests(id),
    end_reason          text,
    sent_at             timestamptz,
    completed_at        timestamptz,
    last_reminded_at    timestamptz,
    due_soon_notified   boolean     NOT NULL DEFAULT false,
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, request_no)
);
CREATE INDEX signing_requests_creator_idx ON office.signing_requests (company_id, created_by, created_at DESC);
CREATE INDEX signing_requests_open_idx ON office.signing_requests (due_on) WHERE status = 'signing';

-- Người ký (QUYTAC_NGHIEPVU_458, 460). Đối tác: chỉ lưu mã băm của mã đường dẫn.
CREATE TABLE office.signing_signers (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          uuid        NOT NULL REFERENCES office.signing_requests(id) ON DELETE CASCADE,
    position            smallint    NOT NULL CHECK (position BETWEEN 1 AND 10),
    sign_order          smallint    NOT NULL CHECK (sign_order BETWEEN 1 AND 10),
    kind                text        NOT NULL CHECK (kind IN ('user', 'company', 'partner')),
    user_id             uuid        REFERENCES core.users(id),
    partner_id          uuid        REFERENCES crm.partners(id),
    partner_kind        text        CHECK (partner_kind IN ('organization', 'individual')),
    partner_name        text,
    partner_email       text,
    partner_identity    text,
    partner_identity_code text,
    page                text        NOT NULL CHECK (page ~ '^(first|last|[1-9][0-9]{0,3})$'),
    corner              text        NOT NULL CHECK (corner IN ('bottom_right', 'bottom_left', 'top_right', 'top_left')),
    status              text        NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'current', 'signed', 'rejected')),
    signed_at           timestamptz,
    signed_by           uuid        REFERENCES core.users(id),
    signer_subject      text,
    reject_reason       text,
    link_token_hash     bytea,
    link_sent_at        timestamptz,
    UNIQUE (request_id, position),
    CHECK ((kind = 'user') = (user_id IS NOT NULL)),
    CHECK (kind <> 'partner' OR (partner_name IS NOT NULL AND partner_email IS NOT NULL AND partner_identity IS NOT NULL AND partner_identity_code IS NOT NULL AND partner_kind IS NOT NULL))
);
CREATE UNIQUE INDEX signing_signers_link_idx ON office.signing_signers (link_token_hash) WHERE link_token_hash IS NOT NULL;
CREATE INDEX signing_signers_user_idx ON office.signing_signers (user_id, status);

-- Mỗi lần gửi nhà cung cấp (QUYTAC_NGHIEPVU_457): bản đã chuẩn bị lưu ở kho tệp, chờ chữ ký tối đa 5 phút.
CREATE TABLE office.signing_attempts (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          uuid        NOT NULL REFERENCES office.signing_requests(id) ON DELETE CASCADE,
    signer_id           uuid        NOT NULL REFERENCES office.signing_signers(id) ON DELETE CASCADE,
    base_file_id        uuid        NOT NULL,
    prepared_storage_key text       NOT NULL,
    certificate_chain   jsonb       NOT NULL,
    identity_code       text        NOT NULL,
    transaction_id      text,
    status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'rejected', 'failed', 'timeout')),
    message             text,
    initiated_by        uuid        REFERENCES core.users(id),
    initiated_ip        text,
    started_at          timestamptz NOT NULL DEFAULT now(),
    finished_at         timestamptz
);
-- Mỗi phiên chỉ một lần ký đang chờ: chữ ký sau tạo chỗ ký trên bản mới (CONG_VIEC_59 mục 10).
CREATE UNIQUE INDEX signing_attempts_pending_idx ON office.signing_attempts (request_id) WHERE status = 'pending';

CREATE TABLE office.signing_events (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          uuid        NOT NULL REFERENCES office.signing_requests(id) ON DELETE CASCADE,
    actor_user_id       uuid        REFERENCES core.users(id),
    actor_label         text,
    kind                text        NOT NULL,
    detail              jsonb       NOT NULL DEFAULT '{}',
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signing_events_request_idx ON office.signing_events (request_id, created_at);

-- Tệp của phiên ký (bản gốc và mỗi bản sau một chữ ký) lưu ở bảng tệp Văn phòng số; gồm mọi giá trị đã có.
ALTER TABLE office.files DROP CONSTRAINT files_owner_type_check;
ALTER TABLE office.files ADD CONSTRAINT files_owner_type_check CHECK (owner_type IN ('task', 'incoming', 'outgoing_draft', 'outgoing_signed', 'post', 'signing_request'));
ALTER TABLE office.files ADD COLUMN sha256 text;
