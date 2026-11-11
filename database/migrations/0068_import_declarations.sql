-- CONG_VIEC_45 lát L1: tờ khai hải quan nhập khẩu, thuế, phân bổ thuế vào giá vốn (QUYTAC_NGHIEPVU_287, 288, 291).

-- Tờ khai thuộc một đơn mua nhập khẩu; số tờ khai không trùng trong công ty (trừ tờ khai đã hủy).
CREATE TABLE purchasing.import_declarations (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    order_id                uuid        NOT NULL REFERENCES purchasing.orders(id),
    declaration_no          text        NOT NULL CHECK (length(declaration_no) BETWEEN 1 AND 50),
    registered_on           date        NOT NULL,                                       -- ngày đăng ký tờ khai
    posting_date            date        NOT NULL,                                       -- ngày ghi sổ
    customs_rate            numeric(20,8) NOT NULL CHECK (customs_rate > 0),            -- tỷ giá tính thuế ghi trên tờ khai
    note                    text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    posted_at               timestamptz,
    posted_by               uuid        REFERENCES core.users(id),
    version                 integer     NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX import_declarations_no_idx ON purchasing.import_declarations (company_id, declaration_no) WHERE status <> 'cancelled';
CREATE INDEX import_declarations_company_idx ON purchasing.import_declarations (company_id, created_at DESC);
CREATE INDEX import_declarations_order_idx ON purchasing.import_declarations (order_id);

-- Dòng tờ khai theo dòng đơn mua. Tiền theo tiền tệ công ty trừ trị giá theo tiền tệ đơn; phần vào tồn, vào giá vốn hàng bán ghi khi ghi sổ.
CREATE TABLE purchasing.import_declaration_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    declaration_id          uuid        NOT NULL REFERENCES purchasing.import_declarations(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    order_line_id           uuid        NOT NULL REFERENCES purchasing.order_lines(id),
    quantity                numeric(20,4) NOT NULL CHECK (quantity > 0),               -- theo đơn vị của dòng đơn mua
    base_quantity           numeric(20,4) NOT NULL CHECK (base_quantity > 0),
    customs_value           numeric(20,4) NOT NULL CHECK (customs_value >= 0),         -- trị giá tính thuế, tiền tệ đơn
    customs_value_converted numeric(20,4) NOT NULL CHECK (customs_value_converted >= 0),
    import_duty_rate        numeric(7,4) NOT NULL DEFAULT 0 CHECK (import_duty_rate >= 0),
    import_duty             numeric(20,4) NOT NULL DEFAULT 0 CHECK (import_duty >= 0),
    import_duty_edited      boolean     NOT NULL DEFAULT false,
    excise_tax              numeric(20,4) NOT NULL DEFAULT 0 CHECK (excise_tax >= 0),
    environmental_tax       numeric(20,4) NOT NULL DEFAULT 0 CHECK (environmental_tax >= 0),
    vat_rate                numeric(7,4) NOT NULL DEFAULT 0 CHECK (vat_rate >= 0),
    vat_amount              numeric(20,4) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    vat_edited              boolean     NOT NULL DEFAULT false,
    stock_value             numeric(20,4),                                              -- thuế vào giá trị tồn kho khi ghi sổ
    expensed_value          numeric(20,4),                                              -- thuế vào giá vốn hàng bán khi ghi sổ
    UNIQUE (declaration_id, line_no)
);
CREATE INDEX import_declaration_lines_order_line_idx ON purchasing.import_declaration_lines (order_line_id);

-- Phiếu điều chỉnh giá trị do Kho ghi khi phân bổ thuế, chi phí nhập khẩu: số lượng trên dòng chỉ để tham chiếu, thẻ kho ghi số lượng 0.
ALTER TABLE inventory.documents DROP CONSTRAINT documents_type_check;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_type_check
    CHECK (type IN ('receipt_other', 'issue_other', 'adjustment', 'transfer', 'purchase_receipt', 'purchase_return', 'sales_issue', 'sales_return', 'cost_adjustment'));
ALTER TABLE inventory.documents DROP CONSTRAINT documents_reason_code_check;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_reason_code_check
    CHECK (reason_code IN ('internal_use', 'gift', 'damaged', 'expired_disposal', 'opening_balance', 'found', 'stocktake', 'transfer', 'purchase', 'purchase_return', 'sale', 'sales_return',
        'import_cost', 'other'));
ALTER TABLE inventory.documents ADD CONSTRAINT documents_cost_adjustment_source_check CHECK (type <> 'cost_adjustment' OR source_id IS NOT NULL);
ALTER TABLE inventory.document_lines ADD COLUMN expensed_value numeric(20,4);          -- phiếu điều chỉnh giá trị: phần vào giá vốn hàng bán

-- Bút toán tờ khai, chứng từ chi phí nhập khẩu; vai trò tài khoản thuế nhập khẩu (mục 9 đặc tả CONG_VIEC_45).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'import_declaration', 'landed_cost'));
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('import_duty', '3333', '3333'), ('excise_tax', '3332', '3332'), ('environmental_tax', '33381', '3338'), ('import_vat', '33312', '33312')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;
