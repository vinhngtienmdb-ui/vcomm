-- CONG_VIEC_55 L3: đối soát tuần với cửa hàng liên kết, công nợ, bút toán (QUYTAC_NGHIEPVU_398, 403, 404; tài liệu 16).
-- Ràng buộc kiểm tra dùng chung định nghĩa lại gồm mọi giá trị trên `main` mới nhất (0069, 0101).

CREATE SEQUENCE affiliate.settlement_no_seq;

-- Bảng đối soát tuần (thứ Hai đến Chủ nhật) của một cửa hàng. Số còn lại dương: cửa hàng phải trả; âm: công ty phải trả.
CREATE TABLE affiliate.settlements (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no             text          NOT NULL UNIQUE DEFAULT 'DS' || lpad(nextval('affiliate.settlement_no_seq')::text, 8, '0'),
    company_id              uuid          NOT NULL REFERENCES core.companies(id),
    merchant_id             uuid          NOT NULL REFERENCES affiliate.merchants(id),
    week_start              date          NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    transaction_count       integer       NOT NULL DEFAULT 0 CHECK (transaction_count >= 0),
    earned_amount           numeric(18,4) NOT NULL DEFAULT 0 CHECK (earned_amount >= 0),           -- A: tiền điểm tích
    redeemed_amount         numeric(18,4) NOT NULL DEFAULT 0 CHECK (redeemed_amount >= 0),         -- B: tiền điểm khách dùng, gồm voucher đổi bằng điểm
    company_voucher_amount  numeric(18,4) NOT NULL DEFAULT 0 CHECK (company_voucher_amount >= 0),  -- C: tiền voucher công ty
    shortfall_amount        numeric(18,4) NOT NULL DEFAULT 0 CHECK (shortfall_amount >= 0),        -- giao dịch hủy: điểm tích không trừ lại được
    fee_percent             numeric(6,4)  NOT NULL,
    fee_amount              numeric(18,4) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),              -- D
    fee_tax_rate            numeric(6,4)  NOT NULL,
    fee_tax_amount          numeric(18,4) NOT NULL DEFAULT 0 CHECK (fee_tax_amount >= 0),          -- E
    adjustment_amount       numeric(18,4) NOT NULL DEFAULT 0,                                      -- trả lời khiếu nại: dương tăng số cửa hàng phải trả
    adjustment_reason       text          CHECK (adjustment_reason IS NULL OR length(adjustment_reason) BETWEEN 1 AND 500),
    net_amount              numeric(18,4) NOT NULL DEFAULT 0,
    status                  text          NOT NULL DEFAULT 'awaiting_confirmation' CHECK (status IN ('awaiting_confirmation', 'confirmed', 'disputed', 'paid')),
    confirm_due_at          timestamptz   NOT NULL,
    confirmed_by            uuid          REFERENCES core.users(id),                               -- trống khi tự xác nhận
    confirmed_at            timestamptz,
    due_date                date,                                                                  -- hạn thanh toán
    dispute_reason          text          CHECK (dispute_reason IS NULL OR length(dispute_reason) BETWEEN 1 AND 1000),
    disputed_by             uuid          REFERENCES core.users(id),
    disputed_at             timestamptz,
    resolution_note         text          CHECK (resolution_note IS NULL OR length(resolution_note) BETWEEN 1 AND 1000),
    resolved_by             uuid          REFERENCES core.users(id),
    resolved_at             timestamptz,
    debt_item_id            uuid          REFERENCES finance.debt_items(id),
    paid_at                 timestamptz,
    created_at              timestamptz   NOT NULL DEFAULT now(),
    version                 integer       NOT NULL DEFAULT 1,
    UNIQUE (merchant_id, week_start),
    CHECK ((status IN ('confirmed', 'paid')) = (confirmed_at IS NOT NULL)),
    CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
    CHECK ((adjustment_amount = 0) OR adjustment_reason IS NOT NULL),
    CHECK (net_amount = earned_amount + shortfall_amount + fee_amount + fee_tax_amount + adjustment_amount - redeemed_amount - company_voucher_amount)
);
CREATE INDEX settlements_status_idx ON affiliate.settlements (company_id, status, week_start DESC);
CREATE INDEX settlements_awaiting_idx ON affiliate.settlements (confirm_due_at) WHERE status = 'awaiting_confirmation';
CREATE INDEX settlements_debt_idx ON affiliate.settlements (debt_item_id) WHERE debt_item_id IS NOT NULL;
ALTER TABLE affiliate.transactions ADD CONSTRAINT transactions_settlement_fk FOREIGN KEY (settlement_id) REFERENCES affiliate.settlements(id);
CREATE INDEX transactions_settlement_idx ON affiliate.transactions (settlement_id) WHERE settlement_id IS NOT NULL;

-- Công nợ một khoản theo số còn lại của bảng đối soát (gồm mọi giá trị của 0069).
ALTER TABLE finance.debt_items DROP CONSTRAINT debt_items_source_type_check;
ALTER TABLE finance.debt_items ADD CONSTRAINT debt_items_source_type_check
    CHECK (source_type IN ('opening', 'sales_issue', 'sales_return', 'purchase_receipt', 'purchase_return', 'payment', 'internal_write_off', 'collection_statement', 'landed_cost',
        'affiliate_settlement'));

-- Bút toán tự sinh (QUYTAC_NGHIEPVU_404), gồm mọi giá trị của 0101: giao dịch hoàn tất, hủy; voucher đổi bằng điểm khi nhận, khi hết hạn; bảng đối soát khi xác nhận.
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'affiliate_transaction', 'affiliate_transaction_cancel', 'affiliate_voucher', 'affiliate_voucher_expire', 'affiliate_settlement'));

-- Vai trò định khoản của cửa hàng liên kết cho công ty đã khởi tạo sổ kế toán.
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('affiliate_receivable', '131', '131'), ('affiliate_payable', '331', '331'), ('affiliate_fee_revenue', '511', '5113'), ('affiliate_fee_tax', '33311', '33311'),
    ('affiliate_voucher_deferred', '3387', '3387')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;
