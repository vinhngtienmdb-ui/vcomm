-- CONG_VIEC_51 L4: phiếu điều chỉnh điểm qua luồng duyệt chứng từ (QUYTAC_NGHIEPVU_353). Loại chứng từ loyalty.adjustment đăng ký trong permission-catalog.ts.
CREATE TABLE loyalty.adjustments (
    id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           uuid          NOT NULL REFERENCES core.companies(id),
    document_no          text,
    user_id              uuid          NOT NULL REFERENCES core.users(id),
    direction            text          NOT NULL CHECK (direction IN ('add', 'subtract')),
    points               integer       NOT NULL CHECK (points BETWEEN 1 AND 10000000),
    reason               text          NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
    status               text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'rejected', 'withdrawn', 'post_failed')),
    failure_reason       text,
    -- Giai đoạn, giá trị một điểm dùng khi gửi duyệt (QUYTAC_NGHIEPVU_353).
    phase_id             uuid          REFERENCES loyalty.program_phases(id),
    point_value          numeric(18,4) CHECK (point_value IS NULL OR point_value > 0),
    approval_request_id  uuid          REFERENCES core.approval_requests(id),
    entry_id             uuid          REFERENCES loyalty.entries(id),
    created_by           uuid          NOT NULL REFERENCES core.users(id),
    created_at           timestamptz   NOT NULL DEFAULT now(),
    updated_at           timestamptz   NOT NULL DEFAULT now(),
    version              integer       NOT NULL DEFAULT 0,
    UNIQUE (company_id, document_no),
    CHECK ((status = 'posted') = (entry_id IS NOT NULL)),
    CHECK ((status = 'post_failed') = (failure_reason IS NOT NULL))
);
CREATE INDEX loyalty_adjustments_status_idx ON loyalty.adjustments (company_id, status, created_at DESC);
CREATE INDEX loyalty_adjustments_user_idx ON loyalty.adjustments (user_id, created_at DESC);
CREATE INDEX loyalty_adjustments_approval_idx ON loyalty.adjustments (approval_request_id);
