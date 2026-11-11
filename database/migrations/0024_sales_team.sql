-- CONG_VIEC_27: Đội kinh doanh nhiều cấp (CHUC_NANG_109 đến 112; QUYTAC_NGHIEPVU_148 đến 153; THAY_DOI_16).

-- Loại đơn vị kinh doanh của phòng ban thuộc công ty vận hành sàn (QUYTAC_NGHIEPVU_148).
ALTER TABLE core.departments ADD COLUMN sales_unit_type text CHECK (sales_unit_type IN ('division', 'region', 'team'));

-- Đề xuất thay đổi đội kinh doanh của người quản lý (QUYTAC_NGHIEPVU_153).
CREATE TABLE marketplace.sales_team_proposals (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    proposer_user_id    uuid        NOT NULL REFERENCES core.users(id),
    kind                text        NOT NULL CHECK (kind IN ('add', 'move', 'appoint', 'remove')),
    target_user_id      uuid        NOT NULL REFERENCES core.users(id),
    department_id       uuid        REFERENCES core.departments(id),
    reason              text        NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
    status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    decided_by          uuid        REFERENCES core.users(id),
    decided_at          timestamptz,
    decision_note       text        CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK ((kind = 'remove') = (department_id IS NULL))
);
-- Mỗi người chỉ có một đề xuất chờ duyệt.
CREATE UNIQUE INDEX sales_team_proposals_pending_idx ON marketplace.sales_team_proposals (target_user_id) WHERE status = 'pending';
CREATE INDEX sales_team_proposals_status_idx ON marketplace.sales_team_proposals (company_id, status, created_at DESC);
CREATE INDEX sales_team_proposals_proposer_idx ON marketplace.sales_team_proposals (proposer_user_id, created_at DESC);

-- Lịch sử đội kinh doanh: thêm chuyển đơn vị, bổ nhiệm, bỏ quản lý; đề xuất đã duyệt (QUYTAC_NGHIEPVU_152).
ALTER TABLE marketplace.sales_flag_history DROP CONSTRAINT sales_flag_history_action_check;
ALTER TABLE marketplace.sales_flag_history ADD CONSTRAINT sales_flag_history_action_check CHECK (action IN ('flag', 'unflag', 'move', 'appoint', 'unappoint'));
ALTER TABLE marketplace.sales_flag_history ADD COLUMN proposal_id uuid REFERENCES marketplace.sales_team_proposals(id);
