-- CONG_VIEC_63 L1: trợ lý AI – cài đặt công ty, xác nhận thông báo xử lý dữ liệu cá nhân, nhật ký lượt (tài liệu 16; QUYTAC_NGHIEPVU_510 đến 515, 520).
-- Quyền `ai.*` khai báo trong danh mục quyền của mã (permission-catalog.ts), đồng bộ khi khởi động.
CREATE SCHEMA IF NOT EXISTS ai;

-- Cài đặt theo công ty; chưa có dòng nghĩa là mặc định (hai tính năng tắt, hạn mức 0).
CREATE TABLE ai.settings (
    company_id              uuid            PRIMARY KEY REFERENCES core.companies(id),
    chat_enabled            boolean         NOT NULL DEFAULT false,
    product_content_enabled boolean         NOT NULL DEFAULT false,
    monthly_budget_usd      numeric(9,2)    NOT NULL DEFAULT 0 CHECK (monthly_budget_usd BETWEEN 0 AND 10000),
    daily_turns_per_user    integer         NOT NULL DEFAULT 30 CHECK (daily_turns_per_user BETWEEN 1 AND 500),
    quota_notified_month    date            CHECK (quota_notified_month IS NULL OR extract(day FROM quota_notified_month) = 1),
    updated_by              uuid            REFERENCES core.users(id),
    updated_at              timestamptz     NOT NULL DEFAULT now(),
    version                 integer         NOT NULL DEFAULT 1
);

-- Người dùng xác nhận một lần cho mỗi phiên bản thông báo (QUYTAC_NGHIEPVU_515).
CREATE TABLE ai.notice_acknowledgements (
    user_id             uuid            NOT NULL REFERENCES core.users(id),
    notice_version      integer         NOT NULL CHECK (notice_version >= 1),
    acknowledged_at     timestamptz     NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, notice_version)
);

-- Mỗi lượt gọi mô hình một dòng; không có nội dung (QUYTAC_NGHIEPVU_512, 520). Giữ 24 tháng.
-- conversation_id không có khóa ngoại để dòng còn lại sau khi hội thoại bị xóa.
CREATE TABLE ai.usage_events (
    id                  bigserial       PRIMARY KEY,
    company_id          uuid            NOT NULL REFERENCES core.companies(id),
    user_id             uuid            NOT NULL REFERENCES core.users(id),
    feature             text            NOT NULL CHECK (feature IN ('chat', 'product_content')),
    conversation_id     uuid,
    product_id          uuid            REFERENCES catalog.products(id),
    provider            text            NOT NULL CHECK (char_length(provider) BETWEEN 1 AND 30),
    model               text            NOT NULL CHECK (char_length(model) BETWEEN 1 AND 100),
    input_tokens        integer         NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
    cache_read_tokens   integer         NOT NULL DEFAULT 0 CHECK (cache_read_tokens >= 0),
    cache_write_tokens  integer         NOT NULL DEFAULT 0 CHECK (cache_write_tokens >= 0),
    output_tokens       integer         NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
    tool_calls          integer         NOT NULL DEFAULT 0 CHECK (tool_calls >= 0),
    cost_usd            numeric(12,6)   NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
    status              text            NOT NULL CHECK (status IN ('ok', 'refusal', 'error', 'max_tokens')),
    duration_ms         integer         NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    created_at          timestamptz     NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_company_idx ON ai.usage_events (company_id, created_at);
CREATE INDEX usage_events_user_idx ON ai.usage_events (user_id, created_at);
