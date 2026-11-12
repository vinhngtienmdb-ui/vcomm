-- CONG_VIEC_60 (MODULE_11 phần 2): liên minh điểm trong tập đoàn.
-- QUYTAC_NGHIEPVU_468: kiểu chia chi phí theo giai đoạn chương trình; lô điểm giữ kiểu của giai đoạn lúc cộng.
ALTER TABLE loyalty.program_phases ADD COLUMN cost_bearer text NOT NULL DEFAULT 'earning_company'
    CHECK (cost_bearer IN ('earning_company', 'redeeming_company', 'operator'));
ALTER TABLE loyalty.lots ADD COLUMN cost_bearer text NOT NULL DEFAULT 'earning_company'
    CHECK (cost_bearer IN ('earning_company', 'redeeming_company', 'operator'));

-- QUYTAC_NGHIEPVU_470, 471: bảng đối soát nợ nội bộ điểm thưởng hằng tháng giữa công ty vận hành sàn và từng công ty con.
-- Bút toán điểm (CONG_VIEC_51) ghi nợ nội bộ thuần trên một tài khoản mỗi bên nên không có bút toán bù trừ; hai bên xác nhận là biên bản đối chiếu
-- (người dùng chọn giữ ghi thuần ngày 2026-11-12).
CREATE TABLE loyalty.settlements (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no             text          NOT NULL,
    operator_company_id     uuid          NOT NULL REFERENCES core.companies(id),
    company_id              uuid          NOT NULL REFERENCES core.companies(id),
    period                  date          NOT NULL CHECK (extract(day FROM period) = 1),
    -- Số liệu theo sổ công ty vận hành sàn với đối tác nội bộ của công ty con; số thuần dương: công ty con phải trả, âm: công ty vận hành sàn phải trả.
    net_opening             numeric(18,4) NOT NULL DEFAULT 0,
    -- Phát sinh trong kỳ: phải thu (tích, trừ lại), phải trả (dùng điểm, hoàn điểm đã dùng), thanh toán; theo loại: [{ "kind", "amount" }].
    receivable_movement     numeric(18,4) NOT NULL DEFAULT 0,
    payable_movement        numeric(18,4) NOT NULL DEFAULT 0,
    payment_movement        numeric(18,4) NOT NULL DEFAULT 0,
    movements               jsonb         NOT NULL DEFAULT '[]',
    offset_amount           numeric(18,4) NOT NULL DEFAULT 0 CHECK (offset_amount >= 0),
    net_closing             numeric(18,4) NOT NULL DEFAULT 0,
    -- Sổ công ty con với đối tác nội bộ là công ty vận hành sàn (số thuần phải trả).
    company_net_closing     numeric(18,4) NOT NULL DEFAULT 0,
    mismatches              jsonb         NOT NULL DEFAULT '[]',
    status                  text          NOT NULL CHECK (status IN ('pending', 'operator_confirmed', 'company_confirmed', 'disputed', 'mismatched', 'confirmed', 'partially_paid', 'settled', 'carried_forward')),
    operator_confirmed_by   uuid          REFERENCES core.users(id),
    operator_confirmed_at   timestamptz,
    company_confirmed_by    uuid          REFERENCES core.users(id),
    company_confirmed_at    timestamptz,
    dispute_reason          text,
    reminded_at             timestamptz,
    built_at                timestamptz   NOT NULL DEFAULT now(),
    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_at              timestamptz   NOT NULL DEFAULT now(),
    version                 integer       NOT NULL DEFAULT 0,
    UNIQUE (company_id, period),
    CHECK (company_id <> operator_company_id)
);
CREATE INDEX loyalty_settlements_period_idx ON loyalty.settlements (period DESC, status);

CREATE TABLE loyalty.settlement_events (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id   uuid          NOT NULL REFERENCES loyalty.settlements(id),
    kind            text          NOT NULL CHECK (kind IN ('built', 'rebuilt', 'confirmed', 'disputed', 'agreed', 'paid', 'carried_forward', 'reminded')),
    company_id      uuid          REFERENCES core.companies(id),
    actor_id        uuid          REFERENCES core.users(id),
    note            text,
    -- Nhiều sự kiện trong một giao dịch: giữ đúng thứ tự xảy ra.
    created_at      timestamptz   NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX loyalty_settlement_events_idx ON loyalty.settlement_events (settlement_id, created_at);

-- QUYTAC_NGHIEPVU_473: phiếu thu, phiếu chi nợ nội bộ điểm gắn bảng đối soát. Ràng buộc gồm mọi giá trị trên main (0096, 0106, 0108).
ALTER TABLE finance.payments DROP CONSTRAINT payments_kind_check;
ALTER TABLE finance.payments ADD CONSTRAINT payments_kind_check
    CHECK (kind IN ('customer_receipt', 'supplier_payment', 'customer_refund', 'supplier_refund', 'retail_receipt', 'retail_refund', 'cash_shortage', 'cash_surplus', 'currency_purchase',
        'customs_tax_payment', 'customs_tax_refund', 'loyalty_intercompany_receipt', 'loyalty_intercompany_payment'));
ALTER TABLE finance.payments ADD COLUMN loyalty_settlement_id uuid REFERENCES loyalty.settlements(id);
ALTER TABLE finance.payments ADD CONSTRAINT payments_loyalty_settlement_check
    CHECK ((kind IN ('loyalty_intercompany_receipt', 'loyalty_intercompany_payment')) = (loyalty_settlement_id IS NOT NULL));
CREATE INDEX payments_loyalty_settlement_idx ON finance.payments (loyalty_settlement_id) WHERE loyalty_settlement_id IS NOT NULL;
-- Biến động quỹ (định nghĩa lại theo 0108, giữ nguyên phần còn lại): phiếu thu nợ nội bộ điểm là phiếu thu.
CREATE OR REPLACE VIEW finance.fund_movements AS
SELECT p.fund_id, p.id AS payment_id, p.company_id, p.kind, p.status, p.payment_date, p.posted_at, false AS is_counter,
    CASE WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus', 'customs_tax_refund', 'loyalty_intercompany_receipt') THEN p.amount ELSE -p.amount END AS amount,
    CASE WHEN f.currency IS NULL THEN NULL
        WHEN p.kind IN ('customer_receipt', 'supplier_refund', 'retail_receipt', 'cash_surplus', 'customs_tax_refund', 'loyalty_intercompany_receipt') THEN p.foreign_amount ELSE -p.foreign_amount END AS foreign_amount
FROM finance.payments p JOIN finance.funds f ON f.id = p.fund_id
UNION ALL
SELECT p.counter_fund_id, p.id, p.company_id, p.kind, p.status, p.payment_date, p.posted_at, true, p.amount, p.foreign_amount
FROM finance.payments p
WHERE p.counter_fund_id IS NOT NULL
UNION ALL
SELECT l.fund_id, r.id, r.company_id, 'fx_revaluation', r.status, r.revaluation_date, r.posted_at, false, l.difference, 0
FROM finance.fx_revaluation_lines l JOIN finance.fx_revaluations r ON r.id = l.revaluation_id
WHERE l.kind = 'fund' AND r.status = 'posted';
-- Số đã thanh toán theo sổ từng bên (bên trả: phiếu chi đã ghi sổ; bên nhận: phiếu thu đã ghi sổ).
ALTER TABLE loyalty.settlements ADD COLUMN paid_amount numeric(18,4) NOT NULL DEFAULT 0, ADD COLUMN received_amount numeric(18,4) NOT NULL DEFAULT 0;
