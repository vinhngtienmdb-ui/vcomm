-- CONG_VIEC_74 L7: iPOS – phiếu phí thuê bao `PI…`, bốn cách thu (QUYTAC_NGHIEPVU_598 đến 603; tài liệu 16). Đặc tả ghi database migration 0170;
-- 0170 đã dùng cho trả hàng ở lát L5, phiên điều phối cấp 0173.

-- Phiếu phí: mỗi thuê bao mỗi kỳ một phiếu chưa hủy. Tiền = giá mỗi tháng × số tháng; thuế = làm tròn đồng (tiền × thuế suất gói); tổng = tiền + thuế.
-- Cách thu chụp lúc lập (đổi cách thu áp cho phiếu lập sau). `switched_at` dự phòng cho chuyển cách thu (quy tắc quá 7 ngày chuyển VietQR người dùng đã bỏ, cột chưa dùng).
CREATE SEQUENCE ipos.fee_invoice_no_seq;
CREATE TABLE ipos.fee_invoices (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no         text          NOT NULL UNIQUE DEFAULT 'PI' || lpad(nextval('ipos.fee_invoice_no_seq')::text, 8, '0'),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    merchant_id         uuid          NOT NULL REFERENCES affiliate.merchants(id),
    subscription_id     uuid          NOT NULL REFERENCES ipos.subscriptions(id),
    outlet_id           uuid          NOT NULL REFERENCES affiliate.outlets(id),
    plan_id             uuid          NOT NULL REFERENCES ipos.plans(id),
    period_start        date          NOT NULL,
    period_end          date          NOT NULL,
    period_months       integer       NOT NULL CHECK (period_months IN (1, 6, 12)),
    monthly_price       numeric(15,0) NOT NULL CHECK (monthly_price >= 0),
    amount              numeric(15,0) NOT NULL CHECK (amount >= 0),
    tax_percent         numeric(5,2)  NOT NULL CHECK (tax_percent IN (0, 5, 8, 10)),
    tax_amount          numeric(15,0) NOT NULL CHECK (tax_amount >= 0),
    total               numeric(15,0) NOT NULL CHECK (total = amount + tax_amount),
    paid_amount         numeric(15,0) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0 AND paid_amount <= total),
    method              text          NOT NULL CHECK (method IN ('collection_deduction', 'settlement_deduction', 'vietqr')),
    status              text          NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting', 'paid', 'voided')),
    issued_on           date          NOT NULL,
    due_on              date          NOT NULL,
    switched_at         timestamptz,
    settlement_id       uuid          REFERENCES affiliate.settlements(id),
    debt_item_id        uuid          REFERENCES finance.debt_items(id),
    void_reason         text          CHECK (void_reason IS NULL OR length(void_reason) BETWEEN 1 AND 500),
    voided_by           uuid          REFERENCES core.users(id),
    voided_at           timestamptz,
    paid_at             timestamptz,
    created_by          uuid          REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    CHECK (period_end > period_start),
    CHECK ((status = 'voided') = (voided_at IS NOT NULL AND void_reason IS NOT NULL)),
    CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
    CHECK (status <> 'paid' OR paid_amount = total)
);
CREATE UNIQUE INDEX fee_invoices_period_idx ON ipos.fee_invoices (subscription_id, period_start) WHERE status <> 'voided';
CREATE INDEX fee_invoices_merchant_idx ON ipos.fee_invoices (merchant_id, created_at DESC);
CREATE INDEX fee_invoices_awaiting_idx ON ipos.fee_invoices (method, issued_on) WHERE status = 'awaiting';
CREATE INDEX fee_invoices_settlement_idx ON ipos.fee_invoices (settlement_id) WHERE settlement_id IS NOT NULL;

-- Phần đã trừ vào bảng chuyển tiền thu hộ: một dòng `instore.payout_deductions` (kind `ipos_subscription`, `reference_id` = phiếu phí) cho mỗi lần trừ.
CREATE INDEX payout_deductions_reference_idx ON instore.payout_deductions (reference_id) WHERE reference_id IS NOT NULL;

-- Bảng đối soát tuần: khoản G "Phí thuê bao iPOS" (đã gồm thuế; không tính thêm thuế phí dịch vụ E). Ghi qua service `affiliate`.
ALTER TABLE affiliate.settlements ADD COLUMN ipos_fee_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (ipos_fee_amount >= 0);
ALTER TABLE affiliate.settlements DROP CONSTRAINT settlements_net_amount_check;
ALTER TABLE affiliate.settlements ADD CONSTRAINT settlements_net_amount_check
    CHECK (net_amount = earned_amount + shortfall_amount + fee_amount + sms_fee_amount + fee_tax_amount + ipos_fee_amount + adjustment_amount - redeemed_amount - company_voucher_amount);

-- Hóa đơn điện tử phí thuê bao (một hóa đơn mỗi phiếu), lập bằng hạ tầng hóa đơn không gắn phiếu xuất của CONG_VIEC_73 lát L6 (database migration 0171).
ALTER TABLE finance.einvoices ADD COLUMN ipos_fee_invoice_id uuid REFERENCES ipos.fee_invoices(id);
ALTER TABLE finance.einvoices DROP CONSTRAINT einvoices_source_check;
ALTER TABLE finance.einvoices ADD CONSTRAINT einvoices_source_check
    CHECK (num_nonnulls(source_document_id, affiliate_transaction_id, instore_fee_invoice_id, ipos_fee_invoice_id) = 1);
CREATE UNIQUE INDEX einvoices_original_ipos_fee_idx ON finance.einvoices (ipos_fee_invoice_id) WHERE kind = 'original' AND ipos_fee_invoice_id IS NOT NULL;

-- Công nợ phải thu cửa hàng của phiếu phí (ipos_fee_invoice) và khoản ghi có đóng công nợ khi chuyển vào bảng đối soát hoặc hủy (ipos_fee_invoice_close); gồm mọi giá trị trên main và nhánh CONG_VIEC_73.
ALTER TABLE finance.debt_items DROP CONSTRAINT debt_items_source_type_check;
ALTER TABLE finance.debt_items ADD CONSTRAINT debt_items_source_type_check
    CHECK (source_type IN ('opening', 'sales_issue', 'sales_return', 'purchase_receipt', 'purchase_return', 'payment', 'internal_write_off', 'collection_statement', 'landed_cost',
        'affiliate_settlement', 'loyalty_partner_settlement', 'instore_payout', 'instore_payout_owner', 'ipos_fee_invoice', 'ipos_fee_invoice_close', 'ipos_fee_deduction'));

-- Bút toán: lập phiếu (Nợ 131 / Có 511, 3331), hủy phiếu (bút toán đảo), trừ thu hộ khi bảng chuyển tiền đã chuyển (Nợ 331 / Có 131).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'affiliate_transaction', 'affiliate_transaction_cancel', 'affiliate_voucher', 'affiliate_voucher_expire', 'affiliate_settlement',
        'fx_revaluation', 'import_amendment', 'loyalty_partner_exchange', 'loyalty_partner_gift', 'loyalty_partner_gift_cancel', 'loyalty_partner_settlement',
        'instore_checkout', 'instore_checkout_owner', 'instore_payout', 'instore_payout_owner', 'ipos_fee_invoice', 'ipos_fee_invoice_void', 'ipos_fee_deduction'));

-- Vai trò định khoản mới cho công ty đã khởi tạo sổ: phải thu phí thuê bao iPOS (131), doanh thu phí thuê bao iPOS (511 / 5113).
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('ipos_fee_receivable', '131', '131'), ('ipos_fee_revenue', '511', '5113')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;
