-- CONG_VIEC_13: Công nợ phải thu, phải trả (MODULE_06, phần 1; tài liệu 16).
CREATE SCHEMA IF NOT EXISTS finance;

-- Quỹ tiền mặt, tài khoản ngân hàng của công ty (CHUC_NANG_65; QUYTAC_NGHIEPVU_85). Số dư hiện tại tính từ phiếu thu chi đã ghi sổ.
CREATE TABLE finance.funds (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    code                    text        NOT NULL CHECK (length(code) BETWEEN 1 AND 20),
    name                    text        NOT NULL,
    kind                    text        NOT NULL CHECK (kind IN ('cash', 'bank')),
    bank_name               text,
    account_no              text,
    account_holder          text,
    opening_balance         numeric(20,4) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
    status                  text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code),
    CHECK (kind <> 'bank' OR (bank_name IS NOT NULL AND account_no IS NOT NULL))
);

-- Khoản công nợ (CHUC_NANG_66; QUYTAC_NGHIEPVU_86, 87, 90): tăng nợ (debit) hoặc giảm nợ (credit) của một đối tác ở phía phải thu hoặc phải trả.
CREATE TABLE finance.debt_items (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    partner_id              uuid        NOT NULL REFERENCES crm.partners(id),
    side                    text        NOT NULL CHECK (side IN ('receivable', 'payable')),
    direction               text        NOT NULL CHECK (direction IN ('debit', 'credit')),
    source_type             text        NOT NULL CHECK (source_type IN ('opening', 'sales_issue', 'sales_return', 'purchase_receipt', 'purchase_return', 'payment')),
    source_id               uuid,                                                   -- phiếu kho hoặc phiếu thu chi; số dư đầu kỳ: trống
    original_item_id        uuid        REFERENCES finance.debt_items(id),          -- trả hàng: khoản tăng của phiếu gốc, trừ trước
    document_no             text        NOT NULL,
    document_date           date        NOT NULL,
    due_date                date,                                                   -- chỉ khoản tăng nợ
    amount                  numeric(20,4) NOT NULL CHECK (amount > 0),              -- tiền tệ công ty, gồm thuế
    open_amount             numeric(20,4) NOT NULL CHECK (open_amount >= 0),
    note                    text,
    created_by              uuid        REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    CHECK (open_amount <= amount),
    CHECK ((direction = 'debit') = (due_date IS NOT NULL)),
    CHECK ((source_type = 'opening') = (source_id IS NULL))
);
CREATE UNIQUE INDEX debt_items_source_idx ON finance.debt_items (source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX debt_items_partner_idx ON finance.debt_items (company_id, side, partner_id, direction);
CREATE INDEX debt_items_open_idx ON finance.debt_items (company_id, side, partner_id) WHERE open_amount > 0;

-- Trừ nợ: ghép một khoản giảm với một khoản tăng (QUYTAC_NGHIEPVU_87).
CREATE TABLE finance.debt_allocations (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    debit_item_id           uuid        NOT NULL REFERENCES finance.debt_items(id) ON DELETE CASCADE,
    credit_item_id          uuid        NOT NULL REFERENCES finance.debt_items(id) ON DELETE CASCADE,
    amount                  numeric(20,4) NOT NULL CHECK (amount > 0),
    created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX debt_allocations_debit_idx ON finance.debt_allocations (debit_item_id);
CREATE INDEX debt_allocations_credit_idx ON finance.debt_allocations (credit_item_id);

-- Phiếu thu, phiếu chi (CHUC_NANG_67; QUYTAC_NGHIEPVU_88, 89).
CREATE TABLE finance.payments (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    document_no             text,                                                   -- cấp khi gửi lần đầu
    kind                    text        NOT NULL CHECK (kind IN ('customer_receipt', 'supplier_payment', 'customer_refund', 'supplier_refund')),
    partner_id              uuid        NOT NULL REFERENCES crm.partners(id),
    fund_id                 uuid        NOT NULL REFERENCES finance.funds(id),
    payment_date            date        NOT NULL,
    amount                  numeric(20,4) NOT NULL CHECK (amount > 0),
    note                    text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'rejected', 'withdrawn')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    posted_at               timestamptz,
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, kind, document_no)
);
CREATE INDEX payments_company_idx ON finance.payments (company_id, status, payment_date);
CREATE INDEX payments_fund_idx ON finance.payments (fund_id, status);
CREATE INDEX payments_approval_idx ON finance.payments (approval_request_id);

-- Chứng từ còn nợ người lập chọn trừ (thu tiền khách hàng, trả tiền nhà cung cấp).
CREATE TABLE finance.payment_lines (
    payment_id              uuid        NOT NULL REFERENCES finance.payments(id) ON DELETE CASCADE,
    debit_item_id           uuid        NOT NULL REFERENCES finance.debt_items(id),
    amount                  numeric(20,4) NOT NULL CHECK (amount > 0),
    PRIMARY KEY (payment_id, debit_item_id)
);

-- Giá trị công nợ của phiếu kho đã ghi sổ (QUYTAC_NGHIEPVU_86): gồm thuế theo đơn bán, đơn mua; nhập mua chỉ phần đạt kiểm tra chất lượng.
-- Dùng chung cho mã ứng dụng (khi ghi sổ) và tính lại phiếu cũ bên dưới.
CREATE FUNCTION finance.inventory_debt_amount(document uuid) RETURNS numeric LANGUAGE sql STABLE AS $$
    SELECT round(coalesce(CASE d.type
        WHEN 'sales_issue' THEN (
            SELECT sum(sl.total_amount * abs(dl.base_quantity) / sl.base_quantity)
            FROM inventory.document_lines dl JOIN sales.order_lines sl ON sl.id = dl.source_line_id
            WHERE dl.document_id = d.id)
        WHEN 'sales_return' THEN (
            SELECT sum(sl.total_amount * abs(rl.base_quantity) / sl.base_quantity)
            FROM inventory.document_lines rl JOIN inventory.document_lines dl ON dl.id = rl.source_line_id
            JOIN sales.order_lines sl ON sl.id = dl.source_line_id
            WHERE rl.document_id = d.id)
        WHEN 'purchase_receipt' THEN (
            SELECT sum(pl.amount * (1 + CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END)
                       * (abs(dl.base_quantity) - coalesce(dl.rejected_base_quantity, 0)) / pl.base_quantity)
            FROM inventory.document_lines dl JOIN purchasing.order_lines pl ON pl.id = dl.source_line_id
            WHERE dl.document_id = d.id)
        WHEN 'purchase_return' THEN (
            SELECT sum(pl.amount * (1 + CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END)
                       * abs(rl.base_quantity) / pl.base_quantity)
            FROM inventory.document_lines rl JOIN inventory.document_lines dl ON dl.id = rl.source_line_id
            JOIN purchasing.order_lines pl ON pl.id = dl.source_line_id
            WHERE rl.document_id = d.id)
    END, 0), 4)
    FROM inventory.documents d WHERE d.id = document
$$;

-- Tính lại công nợ của phiếu kho đã ghi sổ trước khi nâng cấp: khoản tăng trước, rồi khoản giảm do trả hàng trừ vào phiếu gốc.
INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, due_date, amount, open_amount)
SELECT d.company_id, d.partner_id,
    CASE WHEN d.type = 'sales_issue' THEN 'receivable' ELSE 'payable' END, 'debit', d.type, d.id, coalesce(d.document_no, ''), d.document_date,
    d.document_date + coalesce((SELECT p.payment_term_days FROM crm.partner_profiles p WHERE p.company_id = d.company_id AND p.partner_id = d.partner_id), 0),
    finance.inventory_debt_amount(d.id), finance.inventory_debt_amount(d.id)
FROM inventory.documents d
WHERE d.type IN ('sales_issue', 'purchase_receipt') AND d.status = 'posted' AND d.partner_id IS NOT NULL AND finance.inventory_debt_amount(d.id) > 0;

INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, original_item_id, document_no, document_date, amount, open_amount)
SELECT d.company_id, d.partner_id,
    CASE WHEN d.type = 'sales_return' THEN 'receivable' ELSE 'payable' END, 'credit', d.type, d.id, o.id, coalesce(d.document_no, ''), d.document_date,
    finance.inventory_debt_amount(d.id), finance.inventory_debt_amount(d.id)
FROM inventory.documents d
LEFT JOIN finance.debt_items o ON o.source_id = d.source_id AND o.direction = 'debit'
WHERE d.type IN ('sales_return', 'purchase_return') AND d.status = 'posted' AND d.partner_id IS NOT NULL AND finance.inventory_debt_amount(d.id) > 0
ORDER BY d.posted_at;

-- Trừ khoản giảm vào khoản tăng của phiếu gốc (theo thứ tự ghi sổ, không vượt số còn lại).
DO $$
DECLARE
    credit record;
    applied numeric;
BEGIN
    FOR credit IN SELECT c.id, c.company_id, c.original_item_id, c.open_amount FROM finance.debt_items c
                  WHERE c.direction = 'credit' AND c.original_item_id IS NOT NULL ORDER BY c.document_date, c.created_at LOOP
        SELECT least(credit.open_amount, open_amount) INTO applied FROM finance.debt_items WHERE id = credit.original_item_id;
        IF applied > 0 THEN
            INSERT INTO finance.debt_allocations (company_id, debit_item_id, credit_item_id, amount) VALUES (credit.company_id, credit.original_item_id, credit.id, applied);
            UPDATE finance.debt_items SET open_amount = open_amount - applied WHERE id IN (credit.id, credit.original_item_id);
        END IF;
    END LOOP;
END $$;
