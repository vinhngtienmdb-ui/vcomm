-- CONG_VIEC_53: chứng từ quỹ khi đóng ca (QUYTAC_NGHIEPVU_375; THAY_DOI_24) và trả hàng theo hóa đơn bán lẻ (QUYTAC_NGHIEPVU_376, 377; tài liệu 16).

-- Chứng từ quỹ bán lẻ: hệ thống lập khi đóng ca, không đối tượng; phiếu thiếu tiền ghi nhân viên chịu.
ALTER TABLE finance.payments DROP CONSTRAINT payments_kind_check;
ALTER TABLE finance.payments ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('customer_receipt', 'supplier_payment', 'customer_refund', 'supplier_refund', 'retail_receipt', 'retail_refund', 'cash_shortage', 'cash_surplus'));
ALTER TABLE finance.payments ALTER COLUMN partner_id DROP NOT NULL;
ALTER TABLE finance.payments
    ADD COLUMN source_type    text,                                   -- 'retail.shift' cho chứng từ quỹ bán lẻ
    ADD COLUMN source_id      uuid,
    ADD COLUMN staff_user_id  uuid REFERENCES core.users(id);         -- người chịu tiền thiếu
ALTER TABLE finance.payments ADD CONSTRAINT payments_partner_kind_check
    CHECK ((partner_id IS NULL) = (kind IN ('retail_receipt', 'retail_refund', 'cash_shortage', 'cash_surplus')));
ALTER TABLE finance.payments ADD CONSTRAINT payments_staff_kind_check CHECK ((staff_user_id IS NOT NULL) = (kind = 'cash_shortage'));
CREATE INDEX payments_source_idx ON finance.payments (source_type, source_id) WHERE source_id IS NOT NULL;

-- Định khoản thiếu tiền ca: phải thu khác 1388 cho công ty đã khởi tạo kế toán; kế toán đổi được.
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, 'staff_receivable', a.id
FROM accounting.settings s
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = '1388'
ON CONFLICT DO NOTHING;

-- Phiếu trả hàng bán lẻ: trả theo hóa đơn bán lẻ cùng cửa hàng, trong ca đang mở của người trả (QUYTAC_NGHIEPVU_376).
CREATE TABLE retail.returns (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    store_id            uuid        NOT NULL REFERENCES retail.stores(id),
    register_id         uuid        NOT NULL REFERENCES retail.registers(id),
    shift_id            uuid        NOT NULL REFERENCES retail.shifts(id),
    sale_id             uuid        NOT NULL REFERENCES retail.sales(id),
    document_no         text        NOT NULL,
    returned_at         timestamptz NOT NULL,
    return_date         date        NOT NULL,
    cashier_id          uuid        NOT NULL REFERENCES core.users(id),
    reason              text        NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
    stock_document_id   uuid        NOT NULL UNIQUE REFERENCES inventory.documents(id),   -- phiếu nhận hàng trả lại
    goods_amount        numeric(18, 4) NOT NULL CHECK (goods_amount >= 0),               -- tiền hàng trả theo hóa đơn gốc
    refund_amount       numeric(18, 4) NOT NULL CHECK (refund_amount >= 0),              -- tiền hoàn bằng tiền mặt, chuyển khoản
    client_key          uuid        NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, document_no),
    UNIQUE (register_id, client_key)
);
CREATE INDEX returns_sale_idx ON retail.returns (sale_id);
CREATE INDEX returns_shift_idx ON retail.returns (shift_id);

CREATE TABLE retail.return_lines (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id           uuid        NOT NULL REFERENCES retail.returns(id),
    line_no             integer     NOT NULL,
    order_line_id       uuid        NOT NULL REFERENCES sales.order_lines(id),
    base_quantity       numeric(18, 4) NOT NULL CHECK (base_quantity > 0),
    amount              numeric(18, 4) NOT NULL CHECK (amount >= 0),
    UNIQUE (return_id, line_no)
);

-- Cách hoàn: tiền mặt từ ca, chuyển khoản (người nhận), điểm (CONG_VIEC_51).
CREATE TABLE retail.return_refunds (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id           uuid        NOT NULL REFERENCES retail.returns(id),
    line_no             integer     NOT NULL,
    method              text        NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'points')),
    amount              numeric(18, 4) NOT NULL CHECK (amount > 0),
    fund_id             uuid        REFERENCES finance.funds(id),
    bank_reference      text        CHECK (char_length(bank_reference) BETWEEN 1 AND 50),
    recipient           text        CHECK (char_length(recipient) BETWEEN 1 AND 300),     -- ngân hàng, số tài khoản, tên người nhận
    points              numeric(18, 4),
    UNIQUE (return_id, line_no),
    CHECK ((method = 'points') = (fund_id IS NULL)),
    CHECK (method <> 'bank_transfer' OR recipient IS NOT NULL)
);
