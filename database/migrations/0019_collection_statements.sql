-- CONG_VIEC_19: Đối soát thu hộ COD, cổng thanh toán (CHUC_NANG_88 đến 91; QUYTAC_NGHIEPVU_118 đến 122).

-- Đơn vị thu hộ: đối tác có hồ sơ khách hàng của công ty (CHUC_NANG_88).
CREATE TABLE finance.collectors (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    partner_id          uuid        NOT NULL REFERENCES crm.partners(id),
    kind                text        NOT NULL CHECK (kind IN ('cod', 'gateway')),
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 0,
    UNIQUE (company_id, partner_id)
);

-- Bảng đối soát thu hộ (CHUC_NANG_89, 90).
CREATE TABLE finance.collection_statements (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    collector_id        uuid        NOT NULL REFERENCES finance.collectors(id),
    statement_no        text        NOT NULL CHECK (length(statement_no) BETWEEN 1 AND 100),   -- số bảng của đơn vị thu hộ
    document_no         text,                                                               -- số nội bộ, cấp khi gửi lần đầu
    statement_date      date        NOT NULL,
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'rejected', 'withdrawn')),
    total_collected     numeric(20,4) NOT NULL DEFAULT 0,
    total_fee           numeric(20,4) NOT NULL DEFAULT 0,
    approval_request_id uuid,
    post_error          text,
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    submitted_at        timestamptz,
    submitted_by        uuid        REFERENCES core.users(id),     -- người gửi, được rút
    posted_at           timestamptz,
    version             integer     NOT NULL DEFAULT 0
);
CREATE INDEX collection_statements_company_idx ON finance.collection_statements (company_id, statement_date);
CREATE INDEX collection_statements_approval_idx ON finance.collection_statements (approval_request_id);

CREATE TABLE finance.collection_statement_lines (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_id        uuid        NOT NULL REFERENCES finance.collection_statements(id) ON DELETE CASCADE,
    line_no             integer     NOT NULL,                       -- dòng trong tệp
    reference           text        NOT NULL CHECK (length(reference) BETWEEN 1 AND 100),
    order_no            text        NOT NULL,
    order_id            uuid        REFERENCES sales.orders(id),
    customer_id         uuid        REFERENCES crm.partners(id),
    collected_amount    numeric(20,4) NOT NULL CHECK (collected_amount >= 0),
    fee_amount          numeric(20,4) NOT NULL CHECK (fee_amount >= 0),
    collected_date      date,
    UNIQUE (statement_id, line_no)
);
CREATE INDEX collection_statement_lines_reference_idx ON finance.collection_statement_lines (reference);
CREATE INDEX collection_statement_lines_order_idx ON finance.collection_statement_lines (order_id);

-- Nguồn công nợ, nguồn bút toán của bảng đối soát (QUYTAC_NGHIEPVU_120, 121).
ALTER TABLE finance.debt_items DROP CONSTRAINT debt_items_source_type_check;
ALTER TABLE finance.debt_items ADD CONSTRAINT debt_items_source_type_check
    CHECK (source_type IN ('opening', 'sales_issue', 'sales_return', 'purchase_receipt', 'purchase_return', 'payment', 'internal_write_off', 'collection_statement'));
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement'));
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('collector_receivable', '1388', '1388'), ('collection_fee', '6418', '6421')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;
