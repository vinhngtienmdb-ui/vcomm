-- CONG_VIEC_56 lát L2, L3: thuế hải quan phải nộp theo tờ khai, phiếu nộp thuế, tiền chậm nộp, phiếu nhận hoàn thuế; tờ khai bổ sung
-- (QUYTAC_NGHIEPVU_414 đến 417; tài liệu 16).

-- Tham số tiền chậm nộp, hạn nộp theo ngày hiệu lực, dùng chung toàn tập đoàn (cách làm như tham số lương CONG_VIEC_48).
-- Mức 0,03%/ngày (Luật Quản lý thuế 38/2019/QH14 Điều 59) và hạn nộp chưa đối chiếu nguyên văn (CONG_VIEC_56 mục 4); đổi bằng bộ tham số mới khi đối chiếu.
CREATE TABLE finance.customs_tax_parameters (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    effective_from          date          NOT NULL UNIQUE,
    late_payment_rate       numeric(9,6)  NOT NULL CHECK (late_payment_rate >= 0 AND late_payment_rate < 1),  -- phần mỗi ngày: 0,0003 là 0,03%
    payment_term_days       integer       NOT NULL CHECK (payment_term_days BETWEEN 0 AND 365),                -- hạn nộp mặc định: số ngày kể từ ngày đăng ký tờ khai
    legal_basis             text          NOT NULL,
    created_by              uuid          REFERENCES core.users(id),
    created_at              timestamptz   NOT NULL DEFAULT now()
);
INSERT INTO finance.customs_tax_parameters (effective_from, late_payment_rate, payment_term_days, legal_basis)
VALUES ('2020-07-01', 0.0003, 0, 'Luật Quản lý thuế 38/2019/QH14 Điều 59 (mức tiền chậm nộp); hạn nộp: nộp trước khi thông quan. Chưa đối chiếu nguyên văn.');

-- Tờ khai: chi cục hải quan; hạn nộp thuế (trống thì theo tham số).
ALTER TABLE purchasing.import_declarations
    ADD COLUMN customs_office   text CHECK (length(customs_office) BETWEEN 1 AND 200),
    ADD COLUMN tax_due_date     date;

-- Tờ khai bổ sung (lát L3; QUYTAC_NGHIEPVU_414): chỉ sửa số thuế từng dòng của tờ khai gốc đã ghi sổ.
CREATE TABLE purchasing.import_amendments (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    declaration_id          uuid        NOT NULL REFERENCES purchasing.import_declarations(id),
    amendment_no            text        NOT NULL CHECK (length(amendment_no) BETWEEN 1 AND 50),
    registered_on           date        NOT NULL,
    posting_date            date        NOT NULL,
    reason                  text        CHECK (length(reason) <= 500),
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    posted_at               timestamptz,
    posted_by               uuid        REFERENCES core.users(id),
    version                 integer     NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX import_amendments_no_idx ON purchasing.import_amendments (company_id, amendment_no) WHERE status <> 'cancelled';
CREATE INDEX import_amendments_declaration_idx ON purchasing.import_amendments (declaration_id);

-- Số thuế sau bổ sung của từng dòng tờ khai gốc; chênh lệch = sau - trước (trước: gốc cộng các bổ sung đã ghi sổ, lấy lúc ghi sổ).
CREATE TABLE purchasing.import_amendment_lines (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    amendment_id            uuid          NOT NULL REFERENCES purchasing.import_amendments(id) ON DELETE CASCADE,
    declaration_line_id     uuid          NOT NULL REFERENCES purchasing.import_declaration_lines(id),
    import_duty_rate        numeric(7,4)  CHECK (import_duty_rate >= 0),
    vat_rate                numeric(7,4)  CHECK (vat_rate >= 0),
    import_duty             numeric(20,4) NOT NULL CHECK (import_duty >= 0),
    excise_tax              numeric(20,4) NOT NULL CHECK (excise_tax >= 0),
    environmental_tax       numeric(20,4) NOT NULL CHECK (environmental_tax >= 0),
    vat_amount              numeric(20,4) NOT NULL CHECK (vat_amount >= 0),
    import_duty_diff        numeric(20,4),
    excise_tax_diff         numeric(20,4),
    environmental_tax_diff  numeric(20,4),
    vat_diff                numeric(20,4),
    stock_value             numeric(20,4),                                  -- chênh lệch thuế vào giá trị tồn kho khi ghi sổ
    expensed_value          numeric(20,4),                                  -- chênh lệch thuế vào giá vốn hàng bán khi ghi sổ
    UNIQUE (amendment_id, declaration_line_id)
);

-- Thuế phải nộp theo tờ khai và loại thuế (QUYTAC_NGHIEPVU_415): tờ khai gốc đã ghi sổ cộng chênh lệch của tờ khai bổ sung đã ghi sổ; hạn nộp.
CREATE VIEW purchasing.declaration_taxes AS
WITH amounts AS (
    SELECT d.id AS declaration_id, t.tax_type,
        sum(CASE t.tax_type WHEN 'import_duty' THEN l.import_duty WHEN 'excise_tax' THEN l.excise_tax WHEN 'environmental_tax' THEN l.environmental_tax ELSE l.vat_amount END)
        + coalesce((SELECT sum(CASE t.tax_type WHEN 'import_duty' THEN al.import_duty_diff WHEN 'excise_tax' THEN al.excise_tax_diff
                WHEN 'environmental_tax' THEN al.environmental_tax_diff ELSE al.vat_diff END)
            FROM purchasing.import_amendments a JOIN purchasing.import_amendment_lines al ON al.amendment_id = a.id
            WHERE a.declaration_id = d.id AND a.status = 'posted'), 0) AS payable
    FROM purchasing.import_declarations d JOIN purchasing.import_declaration_lines l ON l.declaration_id = d.id
    CROSS JOIN (VALUES ('import_duty'), ('excise_tax'), ('environmental_tax'), ('import_vat')) AS t(tax_type)
    WHERE d.status = 'posted'
    GROUP BY d.id, t.tax_type)
SELECT d.id AS declaration_id, d.company_id, d.declaration_no, d.registered_on, d.customs_office,
    coalesce(d.tax_due_date, d.registered_on + (SELECT p.payment_term_days FROM finance.customs_tax_parameters p WHERE p.effective_from <= d.registered_on
        ORDER BY p.effective_from DESC LIMIT 1)) AS due_date,
    a.tax_type, a.payable
FROM amounts a JOIN purchasing.import_declarations d ON d.id = a.declaration_id;

-- Phiếu nộp thuế hải quan (phiếu chi), phiếu nhận hoàn thuế hải quan (phiếu thu): không đối tác; số chứng từ nộp ngân sách, số quyết định hoàn.
ALTER TABLE finance.payments ADD COLUMN reference_no text CHECK (length(reference_no) BETWEEN 1 AND 100);
ALTER TABLE finance.payments DROP CONSTRAINT payments_kind_check;
ALTER TABLE finance.payments ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('customer_receipt', 'supplier_payment', 'customer_refund', 'supplier_refund', 'retail_receipt', 'retail_refund', 'cash_shortage', 'cash_surplus', 'currency_purchase',
        'customs_tax_payment', 'customs_tax_refund'));
ALTER TABLE finance.payments DROP CONSTRAINT payments_partner_kind_check;
ALTER TABLE finance.payments ADD CONSTRAINT payments_partner_kind_check
    CHECK ((partner_id IS NULL) = (kind IN ('retail_receipt', 'retail_refund', 'cash_shortage', 'cash_surplus', 'currency_purchase', 'customs_tax_payment', 'customs_tax_refund')));

-- Dòng thuế của phiếu (QUYTAC_NGHIEPVU_416, 417): nộp (payment), bù trừ số nộp thừa (offset), hoàn (refund), tiền chậm nộp (late_payment).
-- Tờ khai ở schema purchasing: lưu mã, kiểm trong dịch vụ (không khóa ngoại khác schema). computed_amount: số tiền chậm nộp hệ thống tính.
CREATE TABLE finance.customs_tax_lines (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id              uuid          NOT NULL REFERENCES finance.payments(id) ON DELETE CASCADE,
    line_no                 integer       NOT NULL,
    line_kind               text          NOT NULL CHECK (line_kind IN ('payment', 'offset', 'refund', 'late_payment')),
    declaration_id          uuid          NOT NULL,
    tax_type                text          NOT NULL CHECK (tax_type IN ('import_duty', 'excise_tax', 'environmental_tax', 'import_vat')),
    amount                  numeric(20,4) NOT NULL CHECK (amount >= 0),
    overdue_days            integer       CHECK (overdue_days >= 0),
    computed_amount         numeric(20,4) CHECK (computed_amount >= 0),
    UNIQUE (payment_id, line_no),
    CHECK ((line_kind = 'late_payment') = (overdue_days IS NOT NULL))
);
CREATE INDEX customs_tax_lines_declaration_idx ON finance.customs_tax_lines (declaration_id, tax_type);

-- Biến động quỹ: phiếu nhận hoàn thuế là phiếu thu.
CREATE OR REPLACE VIEW finance.fund_movements AS
SELECT p.fund_id, p.id AS payment_id, p.company_id, p.kind, p.status, p.payment_date, p.posted_at, false AS is_counter,
    CASE WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus', 'customs_tax_refund') THEN p.amount ELSE -p.amount END AS amount,
    CASE WHEN f.currency IS NULL THEN NULL
        WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus', 'customs_tax_refund') THEN p.foreign_amount ELSE -p.foreign_amount END AS foreign_amount
FROM finance.payments p JOIN finance.funds f ON f.id = p.fund_id
UNION ALL
SELECT p.counter_fund_id, p.id, p.company_id, p.kind, p.status, p.payment_date, p.posted_at, true, p.amount, p.foreign_amount
FROM finance.payments p
WHERE p.counter_fund_id IS NOT NULL
UNION ALL
SELECT l.fund_id, r.id, r.company_id, 'fx_revaluation', r.status, r.revaluation_date, r.posted_at, false, l.difference, 0
FROM finance.fx_revaluation_lines l JOIN finance.fx_revaluations r ON r.id = l.revaluation_id
WHERE l.kind = 'fund' AND r.status = 'posted';

-- Nguồn bút toán tờ khai bổ sung; giữ mọi giá trị của 0107.
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'fx_revaluation', 'import_amendment'));
