-- CONG_VIEC_56 lát L0: quỹ ngoại tệ, phiếu mua ngoại tệ, phiếu chi trả nợ nhà cung cấp bằng ngoại tệ, chênh lệch tỷ giá (QUYTAC_NGHIEPVU_406 đến 411; tài liệu 16).

-- Quỹ ngoại tệ (QUYTAC_NGHIEPVU_406): currency trống là tiền tệ công ty. Số dư đầu kỳ ngoại tệ kèm tỷ giá; opening_balance là giá trị đầu kỳ theo tiền tệ công ty.
ALTER TABLE finance.funds
    ADD COLUMN currency                 char(3)       REFERENCES core.currencies(code),
    ADD COLUMN opening_foreign_balance  numeric(20,4) CHECK (opening_foreign_balance >= 0),
    ADD COLUMN opening_exchange_rate    numeric(20,8) CHECK (opening_exchange_rate > 0);
ALTER TABLE finance.funds ADD CONSTRAINT funds_foreign_check
    CHECK ((currency IS NULL) = (opening_foreign_balance IS NULL) AND (currency IS NULL) = (opening_exchange_rate IS NULL));

-- Phiếu thu chi ngoại tệ. amount luôn là tiền tệ công ty: tiền ra, vào quỹ tiền Việt; giá trị ghi sổ ra, vào quỹ ngoại tệ (QUYTAC_NGHIEPVU_407).
-- Phiếu chi trả nợ ngoại tệ: currency, foreign_amount là số ngoại tệ trả; exchange_rate là tỷ giá ngân hàng bán khi chi từ quỹ tiền Việt;
-- exchange_difference là giảm nợ theo tỷ giá đích danh trừ amount, ghi khi ghi sổ (dương: lãi, âm: lỗ; QUYTAC_NGHIEPVU_411).
-- Phiếu mua ngoại tệ (currency_purchase): fund_id là quỹ tiền Việt chi, counter_fund_id là quỹ ngoại tệ nhận (QUYTAC_NGHIEPVU_408).
ALTER TABLE finance.payments
    ADD COLUMN currency             char(3)       REFERENCES core.currencies(code),
    ADD COLUMN foreign_amount       numeric(20,4) CHECK (foreign_amount > 0),
    ADD COLUMN exchange_rate        numeric(20,8) CHECK (exchange_rate > 0),
    ADD COLUMN counter_fund_id      uuid          REFERENCES finance.funds(id),
    ADD COLUMN exchange_difference  numeric(20,4);
ALTER TABLE finance.payments ADD CONSTRAINT payments_foreign_check CHECK ((currency IS NULL) = (foreign_amount IS NULL));
ALTER TABLE finance.payments DROP CONSTRAINT payments_kind_check;
ALTER TABLE finance.payments ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('customer_receipt', 'supplier_payment', 'customer_refund', 'supplier_refund', 'retail_receipt', 'retail_refund', 'cash_shortage', 'cash_surplus', 'currency_purchase'));
ALTER TABLE finance.payments DROP CONSTRAINT payments_partner_kind_check;
ALTER TABLE finance.payments ADD CONSTRAINT payments_partner_kind_check
    CHECK ((partner_id IS NULL) = (kind IN ('retail_receipt', 'retail_refund', 'cash_shortage', 'cash_surplus', 'currency_purchase')));
ALTER TABLE finance.payments ADD CONSTRAINT payments_counter_fund_check
    CHECK ((counter_fund_id IS NOT NULL) = (kind = 'currency_purchase') AND (kind <> 'currency_purchase' OR (currency IS NOT NULL AND exchange_rate IS NOT NULL)));
CREATE INDEX payments_counter_fund_idx ON finance.payments (counter_fund_id, status) WHERE counter_fund_id IS NOT NULL;

-- Dòng trả nợ ngoại tệ: số ngoại tệ trả; amount là giảm nợ theo tỷ giá đích danh (ước tính khi lưu, tính lại khi ghi sổ).
ALTER TABLE finance.payment_lines ADD COLUMN foreign_amount numeric(20,4) CHECK (foreign_amount > 0);

-- Khoản nợ có ngoại tệ (QUYTAC_NGHIEPVU_409): số ngoại tệ còn nợ và tỷ giá ghi sổ đích danh (lúc đầu là tỷ giá ghi nhận, sau là tỷ giá đánh giá lại gần nhất).
ALTER TABLE finance.debt_items
    ADD COLUMN open_foreign_amount  numeric(20,4) CHECK (open_foreign_amount >= 0),
    ADD COLUMN book_rate            numeric(20,8) CHECK (book_rate > 0);
-- Khoản tăng nợ ngoại tệ đã có (CONG_VIEC_45): trước công việc này chỉ giảm bằng trả hàng theo tỷ giá gốc hoặc phiếu chi tiền Việt,
-- nên số ngoại tệ còn nợ lấy theo tỷ lệ số còn nợ trên số nợ ban đầu.
UPDATE finance.debt_items i
SET open_foreign_amount = round(i.foreign_amount * i.open_amount / i.amount, (SELECT minor_units FROM core.currencies WHERE code = i.currency)),
    book_rate = i.exchange_rate
WHERE i.direction = 'debit' AND i.currency IS NOT NULL;
ALTER TABLE finance.debt_items ADD CONSTRAINT debt_items_open_foreign_check
    CHECK ((direction = 'debit' AND currency IS NOT NULL) = (open_foreign_amount IS NOT NULL) AND (open_foreign_amount IS NULL) = (book_rate IS NULL));

-- Biến động quỹ: phiếu thu chi theo quỹ của phiếu, cộng phần nhận vào quỹ ngoại tệ của phiếu mua ngoại tệ.
-- amount theo tiền tệ công ty; foreign_amount chỉ có ở quỹ ngoại tệ. Loại phiếu thu cộng, loại phiếu chi trừ (đồng bộ signedPaymentAmount của mã nguồn).
CREATE VIEW finance.fund_movements AS
SELECT p.fund_id, p.id AS payment_id, p.company_id, p.kind, p.status, p.payment_date, p.posted_at, false AS is_counter,
    CASE WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus') THEN p.amount ELSE -p.amount END AS amount,
    CASE WHEN f.currency IS NULL THEN NULL
        WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus') THEN p.foreign_amount ELSE -p.foreign_amount END AS foreign_amount
FROM finance.payments p JOIN finance.funds f ON f.id = p.fund_id
UNION ALL
SELECT p.counter_fund_id, p.id, p.company_id, p.kind, p.status, p.payment_date, p.posted_at, true, p.amount, p.foreign_amount
FROM finance.payments p
WHERE p.counter_fund_id IS NOT NULL;

-- Vai trò tài khoản mới cho công ty đã khởi tạo kế toán (tài liệu 16; định khoản đổi được).
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('cash_foreign', '111', '1112'), ('bank_foreign', '112', '1122'), ('exchange_difference', '413', '413'), ('financial_income', '515', '515'),
    ('financial_expense', '635', '635'), ('late_payment_expense', '811', '811')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;
