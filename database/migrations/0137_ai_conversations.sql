-- CONG_VIEC_63 L2: hội thoại, tin nhắn, đánh giá của trợ lý AI; khóa một lượt mỗi người (QUYTAC_NGHIEPVU_519 đến 521; tài liệu 16).
CREATE TABLE ai.conversations (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid            NOT NULL REFERENCES core.companies(id),
    user_id             uuid            NOT NULL REFERENCES core.users(id),
    title               text            NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
    message_count       integer         NOT NULL DEFAULT 0 CHECK (message_count BETWEEN 0 AND 40),
    last_message_at     timestamptz     NOT NULL,
    created_at          timestamptz     NOT NULL
);
CREATE INDEX conversations_owner_idx ON ai.conversations (user_id, company_id, last_message_at DESC);
CREATE INDEX conversations_retention_idx ON ai.conversations (last_message_at);

-- Nội dung đã che (đúng như gửi mô hình); tool_calls chỉ có tên, tham số, nhãn nguồn, không có kết quả công cụ.
CREATE TABLE ai.messages (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id     uuid            NOT NULL REFERENCES ai.conversations(id) ON DELETE CASCADE,
    role                text            NOT NULL CHECK (role IN ('user', 'assistant')),
    content             text            NOT NULL CHECK (char_length(content) <= 20000),
    tool_calls          jsonb           NOT NULL DEFAULT '[]'::jsonb,
    status              text            NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'refusal', 'error', 'max_tokens')),
    usage_event_id      bigint          REFERENCES ai.usage_events(id),
    created_at          timestamptz     NOT NULL
);
CREATE INDEX messages_conversation_idx ON ai.messages (conversation_id, created_at);

CREATE TABLE ai.feedback (
    message_id          uuid            PRIMARY KEY REFERENCES ai.messages(id) ON DELETE CASCADE,
    user_id             uuid            NOT NULL REFERENCES core.users(id),
    rating              text            NOT NULL CHECK (rating IN ('up', 'down')),
    reason              text            CHECK (reason IN ('wrong_figures', 'not_relevant', 'missing_data', 'other')),
    note                text            CHECK (note IS NULL OR char_length(note) <= 500),
    updated_at          timestamptz     NOT NULL DEFAULT now(),
    CHECK ((rating = 'down') = (reason IS NOT NULL))
);

-- Một lượt đang chạy mỗi người (QUYTAC_NGHIEPVU_519); dòng quá 3 phút coi như lượt đã chết, được ghi đè.
CREATE TABLE ai.active_turns (
    user_id             uuid            PRIMARY KEY REFERENCES core.users(id),
    started_at          timestamptz     NOT NULL
);
