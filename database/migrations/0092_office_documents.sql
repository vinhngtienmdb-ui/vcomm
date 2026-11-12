-- CONG_VIEC_52 lát L2: công văn đến, đi theo Nghị định 30/2020/NĐ-CP (CHUC_NANG_184; QUYTAC_NGHIEPVU_363 đến 366).

-- Thông tin thể thức của công ty (QUYTAC_NGHIEPVU_366); chưa có dòng thì dùng mặc định.
CREATE TABLE office.document_settings (
    company_id          uuid        PRIMARY KEY REFERENCES core.companies(id),
    parent_org_name     text,                               -- tên cơ quan chủ quản (không bắt buộc)
    company_display_name text       NOT NULL,               -- tên công ty trên văn bản
    company_abbreviation text       NOT NULL CHECK (company_abbreviation ~ '^[A-ZĐ0-9]{1,20}$'),
    place_name          text        NOT NULL,               -- địa danh
    font_scheme         smallint    NOT NULL DEFAULT 13 CHECK (font_scheme IN (13, 14)),
    margin_top          smallint    NOT NULL DEFAULT 20 CHECK (margin_top BETWEEN 20 AND 25),
    margin_bottom       smallint    NOT NULL DEFAULT 20 CHECK (margin_bottom BETWEEN 20 AND 25),
    margin_left         smallint    NOT NULL DEFAULT 30 CHECK (margin_left BETWEEN 30 AND 35),
    margin_right        smallint    NOT NULL DEFAULT 20 CHECK (margin_right BETWEEN 15 AND 20),
    updated_by          uuid        REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1
);

-- Sổ công văn đến, đi; số đếm theo năm (QUYTAC_NGHIEPVU_363).
CREATE TABLE office.registers (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  uuid        NOT NULL REFERENCES core.companies(id),
    direction   text        NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
    name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    is_default  boolean     NOT NULL DEFAULT false,
    status      text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    version     integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, direction, name)
);
CREATE UNIQUE INDEX registers_one_default_idx ON office.registers (company_id, direction) WHERE is_default;

CREATE TABLE office.register_counters (
    register_id uuid        NOT NULL REFERENCES office.registers(id),
    year        smallint    NOT NULL,
    next_value  integer     NOT NULL DEFAULT 1 CHECK (next_value >= 1),
    PRIMARY KEY (register_id, year)
);

-- Loại văn bản theo Điều 8, chữ viết tắt theo Phụ lục III; công văn không có viết tắt.
CREATE TABLE office.document_types (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    name            text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
    abbreviation    text        CHECK (abbreviation IS NULL OR abbreviation ~ '^[A-ZĐa-z0-9]{1,10}$'),
    is_official_letter boolean  NOT NULL DEFAULT false,
    is_custom       boolean     NOT NULL DEFAULT false,
    sort_order      smallint    NOT NULL DEFAULT 100,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    UNIQUE (company_id, name),
    CHECK (is_official_letter = (abbreviation IS NULL))
);

-- Công văn đến (QUYTAC_NGHIEPVU_364). Công văn liên công ty chờ vào sổ chưa có sổ, số.
CREATE TABLE office.incoming_documents (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    register_id         uuid        REFERENCES office.registers(id),
    year                smallint,
    incoming_no         integer,
    received_on         date,
    sender              text        NOT NULL CHECK (char_length(sender) BETWEEN 1 AND 300),
    symbol              text        CHECK (symbol IS NULL OR char_length(symbol) <= 50),
    document_date       date,
    document_type_name  text        NOT NULL,
    summary             text        NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
    urgency             text        NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'very_urgent', 'flash')),
    due_on              date,
    channel             text        NOT NULL CHECK (channel IN ('paper', 'email', 'group', 'other')),
    status              text        NOT NULL CHECK (status IN ('awaiting_registration', 'registered', 'awaiting_direction', 'processing', 'processed', 'archived', 'voided')),
    leader_user_id      uuid        REFERENCES core.users(id),   -- lãnh đạo đang được trình
    task_id             uuid        REFERENCES office.tasks(id), -- việc xử lý gắn công văn
    source_outgoing_id  uuid,                                    -- công văn đi của công ty khác trong tập đoàn
    void_reason         text,
    registered_by       uuid        REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    CHECK ((status = 'awaiting_registration') = (incoming_no IS NULL)),
    CHECK (incoming_no IS NULL OR (register_id IS NOT NULL AND year IS NOT NULL AND received_on IS NOT NULL)),
    CHECK (status <> 'voided' OR void_reason IS NOT NULL)
);
CREATE UNIQUE INDEX incoming_documents_number_idx ON office.incoming_documents (register_id, year, incoming_no) WHERE incoming_no IS NOT NULL;
CREATE INDEX incoming_documents_company_idx ON office.incoming_documents (company_id, status, created_at DESC);

-- Trình, ý kiến chỉ đạo, giao xử lý, chuyển, lưu.
CREATE TABLE office.incoming_routings (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    incoming_id     uuid        NOT NULL REFERENCES office.incoming_documents(id),
    action          text        NOT NULL CHECK (action IN ('registered', 'submitted', 'forwarded', 'assigned', 'archived', 'task_cancelled', 'processed', 'voided')),
    actor_id        uuid        REFERENCES core.users(id),
    to_user_id      uuid        REFERENCES core.users(id),
    note            text        CHECK (note IS NULL OR char_length(note) <= 2000),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incoming_routings_incoming_idx ON office.incoming_routings (incoming_id, created_at);

-- Công văn đi (QUYTAC_NGHIEPVU_365, 366).
CREATE TABLE office.outgoing_documents (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    register_id         uuid        NOT NULL REFERENCES office.registers(id),
    document_type_id    uuid        NOT NULL REFERENCES office.document_types(id),
    department_id       uuid        REFERENCES core.departments(id),
    summary             text        NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
    urgency             text        NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'very_urgent', 'flash')),
    compose_mode        text        NOT NULL CHECK (compose_mode IN ('compose', 'upload')),
    body                jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- danh sách đoạn có kiểu, không lưu HTML
    recipient_line      text,                                       -- "Kính gửi: ..." với công văn
    signer_user_id      uuid        NOT NULL REFERENCES core.users(id),
    signer_authority    text        NOT NULL DEFAULT '' CHECK (signer_authority IN ('', 'TM.', 'KT.', 'TL.', 'TUQ.', 'Q.')),
    signer_authority_of text,                                       -- ví dụ "GIÁM ĐỐC" trong "KT. GIÁM ĐỐC"
    signer_title        text        NOT NULL CHECK (char_length(signer_title) BETWEEN 1 AND 100),
    external_recipients jsonb       NOT NULL DEFAULT '[]'::jsonb,
    copies              smallint    NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 999),
    drafter_code        text        CHECK (drafter_code IS NULL OR char_length(drafter_code) <= 20),
    reply_to_incoming_id uuid       REFERENCES office.incoming_documents(id),
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'rejected', 'withdrawn', 'awaiting_number', 'numbered', 'issued', 'cancelled')),
    approval_mode       text        CHECK (approval_mode IN ('policy', 'signer')),
    approval_request_id uuid        REFERENCES core.approval_requests(id),
    decision_note       text,                                       -- ý kiến người ký khi từ chối (không có chính sách duyệt)
    year                smallint,
    outgoing_no         integer,
    symbol              text,
    issued_on           date,                                       -- ngày văn bản = ngày cấp số
    issued_at           timestamptz,
    cancel_reason       text,
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    CHECK ((outgoing_no IS NULL) = (status NOT IN ('numbered', 'issued'))),
    CHECK (outgoing_no IS NULL OR (year IS NOT NULL AND symbol IS NOT NULL AND issued_on IS NOT NULL)),
    CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL)
);
CREATE UNIQUE INDEX outgoing_documents_number_idx ON office.outgoing_documents (register_id, year, outgoing_no) WHERE outgoing_no IS NOT NULL;
CREATE INDEX outgoing_documents_company_idx ON office.outgoing_documents (company_id, status, created_at DESC);
ALTER TABLE office.incoming_documents ADD CONSTRAINT incoming_documents_source_fk FOREIGN KEY (source_outgoing_id) REFERENCES office.outgoing_documents(id);
CREATE UNIQUE INDEX incoming_documents_source_idx ON office.incoming_documents (source_outgoing_id, company_id) WHERE source_outgoing_id IS NOT NULL;

-- Nơi nhận nội bộ: người, phòng ban của công ty, công ty khác trong tập đoàn.
CREATE TABLE office.outgoing_recipients (
    outgoing_id uuid        NOT NULL REFERENCES office.outgoing_documents(id),
    kind        text        NOT NULL CHECK (kind IN ('user', 'department', 'company')),
    target_id   uuid        NOT NULL,
    PRIMARY KEY (outgoing_id, kind, target_id)
);

-- Việc xử lý gắn công văn đến; tệp công văn.
ALTER TABLE office.tasks ADD COLUMN incoming_document_id uuid REFERENCES office.incoming_documents(id);
ALTER TABLE office.files DROP CONSTRAINT files_owner_type_check;
ALTER TABLE office.files ADD CONSTRAINT files_owner_type_check CHECK (owner_type IN ('task', 'incoming', 'outgoing_draft', 'outgoing_signed'));
