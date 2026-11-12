-- CONG_VIEC_60 (MODULE_11 phần 2): chống gian lận nâng cao (QUYTAC_NGHIEPVU_474 đến 477).
-- Mã cài đặt ứng dụng: chỉ lưu băm HMAC-SHA256, không lưu mã gốc; giữ 12 tháng kể từ lần cuối.
CREATE TABLE loyalty.device_links (
    device_hash     text          NOT NULL,
    user_id         uuid          NOT NULL REFERENCES core.users(id),
    first_seen_at   timestamptz   NOT NULL DEFAULT now(),
    last_seen_at    timestamptz   NOT NULL DEFAULT now(),
    seen_count      integer       NOT NULL DEFAULT 1 CHECK (seen_count >= 1),
    PRIMARY KEY (device_hash, user_id)
);
CREATE INDEX loyalty_device_links_user_idx ON loyalty.device_links (user_id, last_seen_at DESC);
CREATE INDEX loyalty_device_links_seen_idx ON loyalty.device_links (last_seen_at);

-- Thiết bị lúc đặt đơn (đơn VComm tích điểm khi hoàn tất, xét quy tắc thiết bị theo thiết bị lúc đặt).
ALTER TABLE loyalty.document_points ADD COLUMN device_hash text;
-- Không tích do quy tắc chống gian lận chặn. Gồm mọi giá trị trên main (0088).
ALTER TABLE loyalty.document_points DROP CONSTRAINT document_points_skip_reason_check;
ALTER TABLE loyalty.document_points ADD CONSTRAINT document_points_skip_reason_check
    CHECK (skip_reason IN ('test_buyer', 'locked', 'inactive', 'no_phase', 'zero', 'fraud_rule'));
-- Hệ thống tự khóa ví theo quy tắc: không có người làm.
ALTER TABLE loyalty.lock_history ALTER COLUMN actor_user_id DROP NOT NULL;

CREATE TABLE loyalty.fraud_rules (
    code            text          PRIMARY KEY CHECK (code IN ('shared_device', 'redeem_burst', 'earn_return', 'staff_anomaly')),
    enabled         boolean       NOT NULL DEFAULT true,
    params          jsonb         NOT NULL,
    action          text          NOT NULL DEFAULT 'alert' CHECK (action IN ('alert', 'block', 'block_and_lock')),
    updated_by      uuid          REFERENCES core.users(id),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    version         integer       NOT NULL DEFAULT 0
);
INSERT INTO loyalty.fraud_rules (code, params) VALUES
    ('shared_device', '{"maxAccounts": 3, "days": 30}'),
    ('redeem_burst', '{"maxCount": 5, "maxPoints": null, "balancePercent": 80, "newDeviceHours": 24}'),
    ('earn_return', '{"ratioPercent": 50, "minEarnedPoints": 10000}'),
    ('staff_anomaly', '{"maxSalesPerCustomerDay": 3}');

CREATE TABLE loyalty.fraud_rule_history (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text          NOT NULL REFERENCES loyalty.fraud_rules(code),
    before_data     jsonb         NOT NULL,
    after_data      jsonb         NOT NULL,
    actor_user_id   uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE SEQUENCE loyalty.fraud_case_seq;
CREATE TABLE loyalty.fraud_cases (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no     text          NOT NULL DEFAULT 'GL-' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY') || '-' || lpad(nextval('loyalty.fraud_case_seq')::text, 6, '0'),
    rule_code       text          NOT NULL REFERENCES loyalty.fraud_rules(code),
    action          text          NOT NULL CHECK (action IN ('alert', 'block', 'block_and_lock')),
    subject_kind    text          NOT NULL CHECK (subject_kind IN ('user', 'device', 'staff')),
    subject_key     text          NOT NULL,
    user_id         uuid          REFERENCES core.users(id),
    device_hash     text,
    staff_user_id   uuid          REFERENCES core.users(id),
    company_id      uuid          REFERENCES core.companies(id),
    metrics         jsonb         NOT NULL,
    hit_count       integer       NOT NULL DEFAULT 1,
    case_day        date          NOT NULL,
    status          text          NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'violation', 'no_violation')),
    reviewer_id     uuid          REFERENCES core.users(id),
    conclusion_note text,
    concluded_at    timestamptz,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    version         integer       NOT NULL DEFAULT 0
);
-- Gộp vụ việc đang mở cùng quy tắc, cùng đối tượng, cùng ngày (QUYTAC_NGHIEPVU_477).
CREATE UNIQUE INDEX loyalty_fraud_cases_open_idx ON loyalty.fraud_cases (rule_code, subject_kind, subject_key, case_day) WHERE status IN ('new', 'reviewing');
CREATE INDEX loyalty_fraud_cases_list_idx ON loyalty.fraud_cases (status, created_at DESC);
CREATE INDEX loyalty_fraud_cases_user_idx ON loyalty.fraud_cases (user_id, created_at DESC);

CREATE TABLE loyalty.fraud_case_documents (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id         uuid          NOT NULL REFERENCES loyalty.fraud_cases(id),
    source_type     text          NOT NULL,
    source_id       uuid          NOT NULL,
    effect          text          NOT NULL CHECK (effect IN ('alerted', 'blocked_redeem', 'skipped_earn', 'locked')),
    user_id         uuid          REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_fraud_case_documents_idx ON loyalty.fraud_case_documents (case_id, created_at);
-- Giao dịch cửa hàng liên kết (CONG_VIEC_55) cũng xét quy tắc chống gian lận khi tích. Gồm mọi giá trị trên main (0103).
ALTER TABLE affiliate.transactions DROP CONSTRAINT transactions_skip_reason_check;
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_skip_reason_check
    CHECK (skip_reason IN ('test_buyer', 'locked', 'inactive', 'no_phase', 'zero', 'credit_limit', 'overdue', 'fraud_rule'));
