-- CONG_VIEC_52 lát L3: bảng tin nội bộ (CHUC_NANG_185; QUYTAC_NGHIEPVU_367).

-- Tin thuộc công ty đăng; đối tượng: toàn công ty, danh sách chi nhánh, phòng ban, hoặc toàn tập đoàn.
CREATE TABLE office.posts (
    id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                uuid        NOT NULL REFERENCES core.companies(id),
    group_company_id          uuid        NOT NULL REFERENCES core.companies(id),  -- công ty gốc của tập đoàn, dùng cho tin toàn tập đoàn
    title                     text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    body                      text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 20000),
    audience_type             text        NOT NULL CHECK (audience_type IN ('company', 'units', 'group')),
    pinned                    boolean     NOT NULL DEFAULT false,
    publish_at                timestamptz NOT NULL,
    expires_at                timestamptz,
    requires_acknowledgement  boolean     NOT NULL DEFAULT false,
    allow_comments            boolean     NOT NULL DEFAULT true,
    status                    text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    notified_at               timestamptz,                                          -- đã gửi thông báo cần xác nhận đọc
    created_by                uuid        NOT NULL REFERENCES core.users(id),
    created_at                timestamptz NOT NULL DEFAULT now(),
    edited_at                 timestamptz,
    revoked_at                timestamptz,
    revoked_by                uuid        REFERENCES core.users(id),
    version                   integer     NOT NULL DEFAULT 1,
    CONSTRAINT posts_expiry_check CHECK (expires_at IS NULL OR expires_at > publish_at),
    CONSTRAINT posts_revoked_check CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);
CREATE INDEX posts_company_idx ON office.posts (company_id, publish_at DESC);
CREATE INDEX posts_group_idx ON office.posts (group_company_id, publish_at DESC) WHERE audience_type = 'group';
CREATE INDEX posts_notify_idx ON office.posts (publish_at) WHERE requires_acknowledgement AND notified_at IS NULL AND status = 'active';

-- Đối tượng khi chọn chi nhánh, phòng ban (audience_type = 'units').
CREATE TABLE office.post_audiences (
    post_id     uuid NOT NULL REFERENCES office.posts(id),
    kind        text NOT NULL CHECK (kind IN ('branch', 'department')),
    target_id   uuid NOT NULL,
    PRIMARY KEY (post_id, kind, target_id)
);

-- Đã đọc (lần mở đầu tiên), xác nhận đã đọc.
CREATE TABLE office.post_reads (
    post_id           uuid        NOT NULL REFERENCES office.posts(id),
    user_id           uuid        NOT NULL REFERENCES core.users(id),
    read_at           timestamptz NOT NULL DEFAULT now(),
    acknowledged_at   timestamptz,
    PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_reads_user_idx ON office.post_reads (user_id);

-- Bình luận: xóa mềm như bình luận công việc.
CREATE TABLE office.post_comments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id     uuid        NOT NULL REFERENCES office.posts(id),
    author_id   uuid        NOT NULL REFERENCES core.users(id),
    body        text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
    created_at  timestamptz NOT NULL DEFAULT now(),
    edited_at   timestamptz,
    deleted_at  timestamptz,
    deleted_by  uuid        REFERENCES core.users(id)
);
CREATE INDEX post_comments_post_idx ON office.post_comments (post_id, created_at);

ALTER TABLE office.files DROP CONSTRAINT files_owner_type_check;
ALTER TABLE office.files ADD CONSTRAINT files_owner_type_check CHECK (owner_type IN ('task', 'incoming', 'outgoing_draft', 'outgoing_signed', 'post'));
