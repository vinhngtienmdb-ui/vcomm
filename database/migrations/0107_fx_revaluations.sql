-- CONG_VIEC_56 lát L1: đánh giá lại số dư ngoại tệ (QUYTAC_NGHIEPVU_412, 413; tài liệu 16).
-- Chứng từ đánh giá lại thay đổi số dư quỹ ngoại tệ, khoản nợ phải trả ngoại tệ nên đặt ở schema finance; bút toán sinh qua kế toán.

-- Chứng từ đánh giá lại: ngày đánh giá là ngày cuối tháng; số cấp khi ghi sổ (dãy accounting.fx_revaluation, tiền tố DGL).
CREATE TABLE finance.fx_revaluations (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    document_no         text,
    revaluation_date    date        NOT NULL CHECK (revaluation_date = (date_trunc('month', revaluation_date) + interval '1 month - 1 day')::date),
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    note                text,
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    posted_by           uuid        REFERENCES core.users(id),
    posted_at           timestamptz,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no)
);
-- Mỗi ngày đánh giá tối đa một chứng từ đã ghi sổ (QUYTAC_NGHIEPVU_412).
CREATE UNIQUE INDEX fx_revaluations_posted_idx ON finance.fx_revaluations (company_id, revaluation_date) WHERE status = 'posted';
CREATE INDEX fx_revaluations_company_idx ON finance.fx_revaluations (company_id, revaluation_date DESC);

-- Tỷ giá theo tiền tệ: tỷ giá chuyển khoản trung bình ngày đánh giá (source_rate), người lập sửa được (rate).
CREATE TABLE finance.fx_revaluation_rates (
    revaluation_id      uuid          NOT NULL REFERENCES finance.fx_revaluations(id),
    currency            char(3)       NOT NULL REFERENCES core.currencies(code),
    rate                numeric(20,8) CHECK (rate > 0),
    source_rate         numeric(20,8) CHECK (source_rate > 0),
    PRIMARY KEY (revaluation_id, currency)
);

-- Dòng đánh giá lại: quỹ ngoại tệ (fund) hoặc khoản nợ phải trả ngoại tệ (payable); nhóm dùng cho bảng điều chỉnh thuế thu nhập doanh nghiệp.
-- Giá trị ghi sổ, giá trị mới theo tiền tệ công ty; chênh lệch = giá trị mới - giá trị ghi sổ (dương: tài sản tăng hoặc nợ tăng).
CREATE TABLE finance.fx_revaluation_lines (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    revaluation_id      uuid          NOT NULL REFERENCES finance.fx_revaluations(id),
    line_no             integer       NOT NULL,
    kind                text          NOT NULL CHECK (kind IN ('fund', 'payable')),
    fund_id             uuid          REFERENCES finance.funds(id),
    debt_item_id        uuid          REFERENCES finance.debt_items(id),
    partner_id          uuid          REFERENCES crm.partners(id),
    currency            char(3)       NOT NULL REFERENCES core.currencies(code),
    foreign_amount      numeric(20,4) NOT NULL,
    book_value          numeric(20,4) NOT NULL,
    new_value           numeric(20,4),
    difference          numeric(20,4),
    UNIQUE (revaluation_id, line_no),
    CHECK ((kind = 'fund') = (fund_id IS NOT NULL) AND (kind = 'payable') = (debt_item_id IS NOT NULL))
);
CREATE INDEX fx_revaluation_lines_fund_idx ON finance.fx_revaluation_lines (fund_id) WHERE fund_id IS NOT NULL;
CREATE INDEX fx_revaluation_lines_debt_idx ON finance.fx_revaluation_lines (debt_item_id) WHERE debt_item_id IS NOT NULL;

-- Biến động quỹ thêm phần đánh giá lại quỹ ngoại tệ (chỉ đổi giá trị, không đổi số ngoại tệ). payment_id là chứng từ nguồn.
CREATE OR REPLACE VIEW finance.fund_movements AS
SELECT p.fund_id, p.id AS payment_id, p.company_id, p.kind, p.status, p.payment_date, p.posted_at, false AS is_counter,
    CASE WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus') THEN p.amount ELSE -p.amount END AS amount,
    CASE WHEN f.currency IS NULL THEN NULL
        WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus') THEN p.foreign_amount ELSE -p.foreign_amount END AS foreign_amount
FROM finance.payments p JOIN finance.funds f ON f.id = p.fund_id
UNION ALL
SELECT p.counter_fund_id, p.id, p.company_id, p.kind, p.status, p.payment_date, p.posted_at, true, p.amount, p.foreign_amount
FROM finance.payments p
WHERE p.counter_fund_id IS NOT NULL
UNION ALL
SELECT l.fund_id, r.id, r.company_id, 'fx_revaluation', r.status, r.revaluation_date, r.posted_at, false, l.difference, 0
FROM finance.fx_revaluation_lines l JOIN finance.fx_revaluations r ON r.id = l.revaluation_id
WHERE l.kind = 'fund' AND r.status = 'posted';

-- Nguồn bút toán đánh giá lại; giữ mọi giá trị của 0101 (phát hành 0.5.0).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'fx_revaluation'));
