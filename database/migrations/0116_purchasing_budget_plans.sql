-- CONG_VIEC_58 lát L0: kế hoạch ngân sách mua theo ngành hàng cấp 1 × kho × tháng (CHUC_NANG_207; QUYTAC_NGHIEPVU_442 đến 445).

CREATE TABLE purchasing.budget_plans (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    document_no             text,                                                   -- cấp khi gửi duyệt lần đầu
    from_month              date        NOT NULL CHECK (extract(day FROM from_month) = 1),
    to_month                date        NOT NULL CHECK (extract(day FROM to_month) = 1),
    currency                char(3)     NOT NULL REFERENCES core.currencies(code),  -- đồng tiền hạch toán của công ty khi lập
    note                    text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'cancelled')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    submitted_at            timestamptz,
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no),
    -- QUYTAC_NGHIEPVU_443: tối đa 12 tháng.
    CHECK (to_month >= from_month AND to_month < from_month + interval '12 months')
);
CREATE INDEX budget_plans_company_idx ON purchasing.budget_plans (company_id, from_month);
CREATE INDEX budget_plans_approval_idx ON purchasing.budget_plans (approval_request_id);

-- Ô ngân sách (QUYTAC_NGHIEPVU_442). adjusted_amount là tổng điều chỉnh đã duyệt (CHUC_NANG_208).
CREATE TABLE purchasing.budget_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id                 uuid        NOT NULL REFERENCES purchasing.budget_plans(id) ON DELETE CASCADE,
    category_id             uuid        NOT NULL REFERENCES catalog.categories(id),
    warehouse_id            uuid        NOT NULL REFERENCES inventory.warehouses(id),
    month                   date        NOT NULL CHECK (extract(day FROM month) = 1),
    amount                  numeric(20,4) NOT NULL CHECK (amount >= 0),
    adjusted_amount         numeric(20,4) NOT NULL DEFAULT 0,
    UNIQUE (plan_id, category_id, warehouse_id, month)
);
CREATE INDEX budget_lines_cell_idx ON purchasing.budget_lines (category_id, warehouse_id, month);
