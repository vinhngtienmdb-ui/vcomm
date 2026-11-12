-- CONG_VIEC_52 lát L1: quy trình theo mẫu (CHUC_NANG_183; QUYTAC_NGHIEPVU_360 đến 362).

-- Mẫu quy trình của một công ty; nội dung bước nằm ở phiên bản.
CREATE TABLE office.workflow_templates (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    name                text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    description         text,
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive')),
    active_version_id   uuid,
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1
);
CREATE INDEX workflow_templates_company_idx ON office.workflow_templates (company_id, name);

-- Phiên bản: sửa mẫu đang dùng tạo bản nháp mới; phiên đang chạy giữ phiên bản lúc khởi tạo (QUYTAC_NGHIEPVU_361).
CREATE TABLE office.workflow_template_versions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     uuid        NOT NULL REFERENCES office.workflow_templates(id),
    version_no      integer     NOT NULL CHECK (version_no >= 1),
    definition      jsonb       NOT NULL,       -- biểu mẫu khởi tạo, bước, quy tắc chuyển; kiểm bằng lược đồ zod
    status          text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'retired')),
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    activated_at    timestamptz,
    UNIQUE (template_id, version_no)
);
CREATE UNIQUE INDEX workflow_template_versions_one_draft_idx ON office.workflow_template_versions (template_id) WHERE status = 'draft';
CREATE UNIQUE INDEX workflow_template_versions_one_active_idx ON office.workflow_template_versions (template_id) WHERE status = 'active';
ALTER TABLE office.workflow_templates ADD CONSTRAINT workflow_templates_active_version_fk FOREIGN KEY (active_version_id) REFERENCES office.workflow_template_versions(id);

-- Phiên quy trình (QUYTAC_NGHIEPVU_362).
CREATE TABLE office.workflow_runs (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    template_id         uuid        NOT NULL REFERENCES office.workflow_templates(id),
    template_version_id uuid        NOT NULL REFERENCES office.workflow_template_versions(id),
    run_no              text        NOT NULL,
    title               text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    field_values        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    initiator_id        uuid        NOT NULL REFERENCES core.users(id),
    status              text        NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'blocked', 'completed', 'cancelled')),
    step_count          integer     NOT NULL DEFAULT 0 CHECK (step_count >= 0),
    cancel_reason       text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz,
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, run_no),
    CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL)
);
CREATE INDEX workflow_runs_initiator_idx ON office.workflow_runs (initiator_id, created_at DESC);
CREATE INDEX workflow_runs_company_idx ON office.workflow_runs (company_id, created_at DESC);

-- Lượt mở một bước: chờ gộp (waiting), đang mở (open), bị chặn (blocked), xong (done), đã hủy (cancelled).
CREATE TABLE office.workflow_step_instances (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          uuid        NOT NULL REFERENCES office.workflow_runs(id),
    step_key        text        NOT NULL,
    status          text        NOT NULL CHECK (status IN ('waiting', 'open', 'blocked', 'done', 'cancelled')),
    task_id         uuid        REFERENCES office.tasks(id),
    outcome         text,
    blocked_reason  text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    completed_at    timestamptz,
    CHECK (status <> 'done' OR outcome IS NOT NULL)
);
CREATE INDEX workflow_step_instances_run_idx ON office.workflow_step_instances (run_id, created_at);
CREATE UNIQUE INDEX workflow_step_instances_task_idx ON office.workflow_step_instances (task_id) WHERE task_id IS NOT NULL;

-- Việc của bước quy trình; chủ trì trống thì người giữ vai trò ứng viên bấm "Nhận việc".
ALTER TABLE office.tasks ADD COLUMN workflow_step_instance_id uuid REFERENCES office.workflow_step_instances(id);
ALTER TABLE office.tasks ADD COLUMN candidate_role_id uuid REFERENCES core.roles(id);
ALTER TABLE office.tasks ADD CONSTRAINT tasks_owner_or_candidate_check CHECK (owner_user_id IS NOT NULL OR candidate_role_id IS NOT NULL);
