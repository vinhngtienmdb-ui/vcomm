-- CONG_VIEC_59 lát L2: kho hợp đồng (CHUC_NANG_212; QUYTAC_NGHIEPVU_462 đến 467).

-- Loại hợp đồng theo công ty (QUYTAC_NGHIEPVU_462): chiều mua (công ty trả tiền), bán (công ty thu tiền), không có giá trị.
CREATE TABLE office.contract_types (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    name            text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    direction       text        NOT NULL CHECK (direction IN ('purchase', 'sale', 'none')),
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    sort_order      smallint    NOT NULL DEFAULT 100,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contract_types_name_idx ON office.contract_types (company_id, lower(name));

-- Hợp đồng (QUYTAC_NGHIEPVU_463, 464). Tệp nằm ở office.files; tệp đã ký có thể là tệp của phiên ký.
CREATE TABLE office.contracts (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    contract_code       text        NOT NULL,
    contract_no         text        CHECK (char_length(contract_no) <= 100),
    name                text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
    type_id             uuid        NOT NULL REFERENCES office.contract_types(id),
    value               numeric(20, 2) CHECK (value >= 0),
    currency            char(3)     NOT NULL DEFAULT 'VND',
    signed_on           date,
    effective_from      date        NOT NULL,
    expires_on          date,
    owner_user_id       uuid        NOT NULL REFERENCES core.users(id),
    department_id       uuid        REFERENCES core.departments(id),
    confidential        boolean     NOT NULL DEFAULT false,
    description         text        CHECK (char_length(description) <= 5000),
    reminder_days       integer[]   NOT NULL DEFAULT '{30,7}',
    content_file_id     uuid,
    signed_file_id      uuid,
    signature_checks    jsonb,
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'rejected', 'withdrawn', 'awaiting_signature', 'signed', 'liquidated', 'terminated', 'cancelled')),
    imported            boolean     NOT NULL DEFAULT false,
    approval_mode       text        CHECK (approval_mode IN ('policy', 'manager')),
    approval_request_id uuid        REFERENCES core.approval_requests(id),
    approver_user_ids   uuid[]      NOT NULL DEFAULT '{}',
    decision_note       text,
    signing_request_id  uuid        REFERENCES office.signing_requests(id),
    ended_on            date,
    end_reason          text,
    end_file_id         uuid,
    cancel_reason       text,
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, contract_code),
    CHECK (expires_on IS NULL OR expires_on >= effective_from),
    CHECK (cardinality(reminder_days) BETWEEN 1 AND 3),
    CHECK (status NOT IN ('signed', 'liquidated', 'terminated') OR (signed_file_id IS NOT NULL AND signed_on IS NOT NULL))
);
CREATE INDEX contracts_company_idx ON office.contracts (company_id, status, expires_on);
CREATE INDEX contracts_owner_idx ON office.contracts (owner_user_id);

-- Đối tác của hợp đồng (một hoặc nhiều, từ crm.partners).
CREATE TABLE office.contract_partners (
    contract_id     uuid        NOT NULL REFERENCES office.contracts(id) ON DELETE CASCADE,
    partner_id      uuid        NOT NULL REFERENCES crm.partners(id),
    position        smallint    NOT NULL,
    PRIMARY KEY (contract_id, partner_id)
);

-- Phụ lục (QUYTAC_NGHIEPVU_465): thay đổi ngày hết hạn, giá trị khi đã ký.
CREATE TABLE office.contract_appendices (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id         uuid        NOT NULL REFERENCES office.contracts(id),
    appendix_no         text        NOT NULL CHECK (char_length(appendix_no) BETWEEN 1 AND 50),
    summary             text        NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 2000),
    effective_from      date        NOT NULL,
    new_expires_on      date,
    new_value           numeric(20, 2) CHECK (new_value >= 0),
    content_file_id     uuid,
    signed_file_id      uuid,
    signed_on           date,
    previous_expires_on date,
    previous_value      numeric(20, 2),
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'rejected', 'withdrawn', 'awaiting_signature', 'signed', 'cancelled')),
    imported            boolean     NOT NULL DEFAULT false,
    approval_mode       text        CHECK (approval_mode IN ('policy', 'manager')),
    approval_request_id uuid        REFERENCES core.approval_requests(id),
    approver_user_ids   uuid[]      NOT NULL DEFAULT '{}',
    decision_note       text,
    signing_request_id  uuid        REFERENCES office.signing_requests(id),
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (contract_id, appendix_no),
    CHECK (status <> 'signed' OR (signed_file_id IS NOT NULL AND signed_on IS NOT NULL))
);

-- Chia sẻ quyền xem (QUYTAC_NGHIEPVU_466).
CREATE TABLE office.contract_shares (
    contract_id     uuid        NOT NULL REFERENCES office.contracts(id) ON DELETE CASCADE,
    user_id         uuid        NOT NULL REFERENCES core.users(id),
    shared_by       uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contract_id, user_id)
);

CREATE TABLE office.contract_events (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id     uuid        NOT NULL REFERENCES office.contracts(id) ON DELETE CASCADE,
    actor_user_id   uuid        REFERENCES core.users(id),
    kind            text        NOT NULL,
    detail          jsonb       NOT NULL DEFAULT '{}',
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contract_events_contract_idx ON office.contract_events (contract_id, created_at);

-- Mốc nhắc hạn đã gửi (QUYTAC_NGHIEPVU_467): mỗi mốc một lần cho mỗi ngày hết hạn (gia hạn thì mốc tính lại).
CREATE TABLE office.contract_reminders (
    contract_id     uuid        NOT NULL REFERENCES office.contracts(id) ON DELETE CASCADE,
    expires_on      date        NOT NULL,
    milestone       text        NOT NULL,
    sent_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contract_id, expires_on, milestone)
);

-- Tệp hợp đồng, phụ lục, biên bản thanh lý; phiên ký nguồn hợp đồng, phụ lục. Gồm mọi giá trị đã có.
ALTER TABLE office.files DROP CONSTRAINT files_owner_type_check;
ALTER TABLE office.files ADD CONSTRAINT files_owner_type_check CHECK (owner_type IN ('task', 'incoming', 'outgoing_draft', 'outgoing_signed', 'post', 'signing_request', 'contract', 'contract_appendix'));
ALTER TABLE office.signing_requests DROP CONSTRAINT signing_requests_source_type_check;
ALTER TABLE office.signing_requests ADD CONSTRAINT signing_requests_source_type_check CHECK (source_type IN ('document', 'contract', 'contract_appendix'));
