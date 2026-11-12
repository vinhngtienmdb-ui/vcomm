-- CONG_VIEC_52 lát L0: mini app Văn phòng số, công việc (CHUC_NANG_182; QUYTAC_NGHIEPVU_356 đến 359).
CREATE SCHEMA IF NOT EXISTS office;

INSERT INTO core.apps (code, name_vi, name_en, base_url, icon, sort_order)
VALUES ('office', 'Văn phòng số', 'Digital Office', '/office', 'briefcase', 100)
ON CONFLICT (code) DO NOTHING;

-- Công việc thuộc công ty nơi lập; người tham gia có thể ở công ty khác cùng tập đoàn (QUYTAC_NGHIEPVU_357).
CREATE TABLE office.tasks (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    parent_id               uuid        REFERENCES office.tasks(id),
    title                   text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description             text        CHECK (description IS NULL OR char_length(description) <= 10000),
    status                  text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'pending_confirmation', 'completed', 'cancelled')),
    priority                text        NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    progress                smallint    NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    start_date              date,
    due_at                  timestamptz,
    assigned_by             uuid        NOT NULL REFERENCES core.users(id),
    owner_user_id           uuid        REFERENCES core.users(id),   -- người chủ trì; NULL khi việc của bước quy trình chờ người nhận (lát L1)
    status_reason           text,                                   -- lý do trả lại hoặc hủy gần nhất
    completed_at            timestamptz,
    cancelled_at            timestamptz,
    due_soon_notified_at    timestamptz,                            -- đã nhắc còn 24 giờ (QUYTAC_NGHIEPVU_358)
    overdue_notified_at     timestamptz,                            -- đã nhắc quá hạn
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX tasks_company_idx ON office.tasks (company_id, created_at DESC);
CREATE INDEX tasks_owner_idx ON office.tasks (owner_user_id) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX tasks_assigned_by_idx ON office.tasks (assigned_by, created_at DESC);
CREATE INDEX tasks_parent_idx ON office.tasks (parent_id);
CREATE INDEX tasks_due_idx ON office.tasks (due_at) WHERE status NOT IN ('completed', 'cancelled');

-- Người phối hợp, người theo dõi; người chủ trì ghi ở office.tasks.
CREATE TABLE office.task_participants (
    task_id     uuid        NOT NULL REFERENCES office.tasks(id),
    user_id     uuid        NOT NULL REFERENCES core.users(id),
    role        text        NOT NULL CHECK (role IN ('collaborator', 'follower')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, user_id)
);
CREATE INDEX task_participants_user_idx ON office.task_participants (user_id);

-- Bình luận: sửa ghi edited_at, xóa mềm ghi deleted_at (QUYTAC_NGHIEPVU_359).
CREATE TABLE office.task_comments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     uuid        NOT NULL REFERENCES office.tasks(id),
    author_id   uuid        NOT NULL REFERENCES core.users(id),
    body        text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
    created_at  timestamptz NOT NULL DEFAULT now(),
    edited_at   timestamptz,
    deleted_at  timestamptz
);
CREATE INDEX task_comments_task_idx ON office.task_comments (task_id, created_at);

-- Lịch sử việc: ai, lúc nào, thao tác, trường đổi.
CREATE TABLE office.task_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     uuid        NOT NULL REFERENCES office.tasks(id),
    actor_id    uuid        REFERENCES core.users(id),
    action      text        NOT NULL,
    details     jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX task_events_task_idx ON office.task_events (task_id, created_at);

-- Tệp của mini app Văn phòng số; nội dung lưu S3 hoặc thư mục cục bộ theo khóa lưu trữ như core.attachments.
-- Bảng riêng để mini app chỉ ghi schema của mình (tài liệu 12 mục 2).
CREATE TABLE office.files (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    owner_type      text        NOT NULL CHECK (owner_type IN ('task')),
    owner_id        uuid        NOT NULL,
    file_name       text        NOT NULL,
    content_type    text        NOT NULL,
    size_bytes      integer     NOT NULL CHECK (size_bytes > 0),
    storage_key     text        NOT NULL UNIQUE,
    uploaded_by     uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    deleted_at      timestamptz,
    deleted_by      uuid        REFERENCES core.users(id)
);
CREATE INDEX files_owner_idx ON office.files (owner_type, owner_id);
