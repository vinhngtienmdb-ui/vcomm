-- CONG_VIEC_45 lát L2: chứng từ chi phí nhập khẩu, phân bổ vào giá vốn theo dòng tờ khai (QUYTAC_NGHIEPVU_289, 290, 291).

-- Chứng từ chi phí thuộc một tờ khai đã ghi sổ; một nhà cung cấp dịch vụ; tiền tệ chứng từ (ngoại tệ thì lưu tỷ giá hạch toán ngày chứng từ).
CREATE TABLE purchasing.landed_costs (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    declaration_id          uuid        NOT NULL REFERENCES purchasing.import_declarations(id),
    supplier_id             uuid        NOT NULL REFERENCES crm.partners(id),
    document_no             text,                                                   -- cấp khi ghi sổ
    invoice_no              text        NOT NULL CHECK (length(invoice_no) BETWEEN 1 AND 50),
    document_date           date        NOT NULL,
    currency                char(3)     NOT NULL REFERENCES core.currencies(code),
    exchange_rate           numeric(20,8) NOT NULL CHECK (exchange_rate > 0),          -- 1 khi theo tiền tệ công ty
    note                    text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    posted_at               timestamptz,
    posted_by               uuid        REFERENCES core.users(id),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no)
);
CREATE INDEX landed_costs_company_idx ON purchasing.landed_costs (company_id, created_at DESC);
CREATE INDEX landed_costs_declaration_idx ON purchasing.landed_costs (declaration_id);

-- Khoản chi phí: tiền chưa thuế theo tiền tệ chứng từ và quy đổi; thuế giá trị gia tăng theo tiền tệ công ty; tiêu thức phân bổ.
CREATE TABLE purchasing.landed_cost_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    landed_cost_id          uuid        NOT NULL REFERENCES purchasing.landed_costs(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    kind                    text        NOT NULL CHECK (kind IN ('international_freight', 'insurance', 'domestic_freight', 'customs_fee', 'other')),
    description             text,
    amount                  numeric(20,4) NOT NULL CHECK (amount > 0),
    amount_converted        numeric(20,4) NOT NULL CHECK (amount_converted >= 0),
    vat_rate                text        NOT NULL CHECK (vat_rate IN ('0', '5', '8', '10', 'exempt', 'not_declared')),
    vat_amount              numeric(20,4) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    basis                   text        NOT NULL DEFAULT 'value' CHECK (basis IN ('value', 'quantity')),
    UNIQUE (landed_cost_id, line_no)
);

-- Kết quả phân bổ khi ghi sổ: phần của từng khoản cho từng dòng tờ khai; cộng theo dòng tờ khai thì có phần vào tồn, vào giá vốn hàng bán.
CREATE TABLE purchasing.landed_cost_allocations (
    landed_cost_line_id     uuid        NOT NULL REFERENCES purchasing.landed_cost_lines(id) ON DELETE CASCADE,
    declaration_line_id     uuid        NOT NULL REFERENCES purchasing.import_declaration_lines(id),
    amount                  numeric(20,4) NOT NULL,
    PRIMARY KEY (landed_cost_line_id, declaration_line_id)
);
CREATE TABLE purchasing.landed_cost_targets (
    landed_cost_id          uuid        NOT NULL REFERENCES purchasing.landed_costs(id) ON DELETE CASCADE,
    declaration_line_id     uuid        NOT NULL REFERENCES purchasing.import_declaration_lines(id),
    amount                  numeric(20,4) NOT NULL,
    stock_value             numeric(20,4) NOT NULL,
    expensed_value          numeric(20,4) NOT NULL,
    PRIMARY KEY (landed_cost_id, declaration_line_id)
);

-- Công nợ phải trả nhà cung cấp dịch vụ phát sinh từ chứng từ chi phí đã ghi sổ.
ALTER TABLE finance.debt_items DROP CONSTRAINT debt_items_source_type_check;
ALTER TABLE finance.debt_items ADD CONSTRAINT debt_items_source_type_check
    CHECK (source_type IN ('opening', 'sales_issue', 'sales_return', 'purchase_receipt', 'purchase_return', 'payment', 'internal_write_off', 'collection_statement', 'landed_cost'));
