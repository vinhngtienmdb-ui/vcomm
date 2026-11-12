-- CONG_VIEC_58 lát L3: phiếu điều chỉnh ngân sách mua (CHUC_NANG_208; QUYTAC_NGHIEPVU_448, 449).
CREATE TABLE purchasing.budget_adjustments (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    plan_id                 uuid        NOT NULL REFERENCES purchasing.budget_plans(id),
    document_no             text,                                                   -- cấp khi gửi duyệt lần đầu
    reason                  text        NOT NULL,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'cancelled')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    applied_at              timestamptz,                                            -- thời điểm áp vào ô ngân sách
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    submitted_at            timestamptz,
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no)
);
CREATE INDEX budget_adjustments_company_idx ON purchasing.budget_adjustments (company_id, created_at DESC);
CREATE INDEX budget_adjustments_plan_idx ON purchasing.budget_adjustments (plan_id);
CREATE INDEX budget_adjustments_approval_idx ON purchasing.budget_adjustments (approval_request_id);

-- Dòng tăng (dương) hoặc giảm (âm) của một ô; chuyển ngân sách = một dòng giảm, một dòng tăng.
CREATE TABLE purchasing.budget_adjustment_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id           uuid        NOT NULL REFERENCES purchasing.budget_adjustments(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    category_id             uuid        NOT NULL REFERENCES catalog.categories(id),
    warehouse_id            uuid        NOT NULL REFERENCES inventory.warehouses(id),
    month                   date        NOT NULL CHECK (extract(day FROM month) = 1),
    delta                   numeric(20,4) NOT NULL CHECK (delta <> 0),
    UNIQUE (adjustment_id, line_no),
    UNIQUE (adjustment_id, category_id, warehouse_id, month)
);
