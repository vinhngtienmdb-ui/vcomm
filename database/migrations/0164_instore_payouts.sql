-- CONG_VIEC_73 lát L5: bảng chuyển tiền thu hộ ngày, hạch toán hai công ty (QUYTAC_NGHIEPVU_585, 587).

-- Thuế suất phí sàn, phí thu hộ của công ty vận hành sàn (mặc định 10 %), cài ở MAN_HINH_280.
CREATE TABLE instore.settings (
    company_id      uuid          PRIMARY KEY REFERENCES core.companies(id),
    fee_tax_rate    numeric(5,2)  NOT NULL DEFAULT 10 CHECK (fee_tax_rate BETWEEN 0 AND 20),
    updated_by      uuid          REFERENCES core.users(id),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    version         integer       NOT NULL DEFAULT 1
);

-- Bảng chuyển tiền: thuế suất chốt lúc lập, công nợ phải trả (công ty vận hành sàn) và phải thu (công ty sở hữu cửa hàng tập đoàn),
-- phiếu chi, phiếu thu khi ghi đã chuyển.
ALTER TABLE instore.payouts
    ADD COLUMN fee_tax_rate             numeric(5,2) NOT NULL DEFAULT 10,
    ADD COLUMN payable_debt_item_id     uuid         REFERENCES finance.debt_items(id),
    ADD COLUMN receivable_debt_item_id  uuid         REFERENCES finance.debt_items(id),
    ADD COLUMN payment_id               uuid         REFERENCES finance.payments(id),
    ADD COLUMN receipt_id               uuid         REFERENCES finance.payments(id),
    ADD COLUMN transferred_by           uuid         REFERENCES core.users(id),
    ADD COLUMN transferred_at           timestamptz;
CREATE INDEX payouts_status_idx ON instore.payouts (operator_company_id, status, business_date);

-- Phiếu chi chuyển tiền thu hộ (công ty vận hành sàn) và phiếu thu nhận tiền (công ty sở hữu cửa hàng tập đoàn) gắn bảng chuyển tiền.
ALTER TABLE finance.payments ADD COLUMN instore_payout_id uuid REFERENCES instore.payouts(id);
ALTER TABLE finance.payments DROP CONSTRAINT payments_kind_check;
ALTER TABLE finance.payments ADD CONSTRAINT payments_kind_check CHECK (kind IN ('customer_receipt', 'supplier_payment', 'customer_refund', 'supplier_refund', 'retail_receipt',
    'retail_refund', 'cash_shortage', 'cash_surplus', 'currency_purchase', 'customs_tax_payment', 'customs_tax_refund', 'loyalty_intercompany_receipt', 'loyalty_intercompany_payment',
    'instore_payout_payment', 'instore_payout_receipt'));
ALTER TABLE finance.payments ADD CONSTRAINT payments_instore_payout_check CHECK ((kind IN ('instore_payout_payment', 'instore_payout_receipt')) = (instore_payout_id IS NOT NULL));

-- Công nợ của bảng chuyển tiền; gồm mọi giá trị trên main.
ALTER TABLE finance.debt_items DROP CONSTRAINT debt_items_source_type_check;
ALTER TABLE finance.debt_items ADD CONSTRAINT debt_items_source_type_check
    CHECK (source_type IN ('opening', 'sales_issue', 'sales_return', 'purchase_receipt', 'purchase_return', 'payment', 'internal_write_off', 'collection_statement', 'landed_cost',
        'affiliate_settlement', 'loyalty_partner_settlement', 'instore_payout'));

-- Bút toán: nhận tiền cổng (công ty vận hành sàn), dòng "Ứng dụng VComm" của hóa đơn bán lẻ (công ty sở hữu), lập bảng chuyển tiền (hai công ty).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'affiliate_transaction', 'affiliate_transaction_cancel', 'affiliate_voucher', 'affiliate_voucher_expire', 'affiliate_settlement',
        'fx_revaluation', 'import_amendment', 'loyalty_partner_exchange', 'loyalty_partner_gift', 'loyalty_partner_gift_cancel', 'loyalty_partner_settlement',
        'instore_checkout', 'instore_checkout_owner', 'instore_payout', 'instore_payout_owner'));

-- Vai trò định khoản mới cho công ty đã khởi tạo sổ kế toán: doanh thu phí sàn, phải trả nội bộ (công ty vận hành sàn), phải thu nội bộ (công ty sở hữu).
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('instore_fee_revenue', '511', '5113'), ('instore_payable_internal', '3368', '3368'), ('instore_receivable_internal', '1368', '1368')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;
