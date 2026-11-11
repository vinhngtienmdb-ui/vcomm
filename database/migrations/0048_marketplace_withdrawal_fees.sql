-- CONG_VIEC_26 L5 (THAY_DOI_17; QUYTAC_NGHIEPVU_208): phí rút tiền hoa hồng theo lần rút trong tháng và theo số tiền; hạch toán thu nhập khác (711).
ALTER TABLE marketplace.commission_settings ADD COLUMN withdrawal_fees jsonb NOT NULL DEFAULT '{"byCount": [], "byAmount": []}'::jsonb;

-- Phí chốt khi duyệt cùng thuế; thực nhận = số tiền − thuế − phí.
ALTER TABLE marketplace.withdrawals ADD COLUMN fee_amount numeric(18,4) CHECK (fee_amount IS NULL OR fee_amount >= 0);
UPDATE marketplace.withdrawals SET fee_amount = 0 WHERE status IN ('approved', 'paid');
ALTER TABLE marketplace.withdrawals DROP CONSTRAINT withdrawals_check;
ALTER TABLE marketplace.withdrawals DROP CONSTRAINT withdrawals_check1;
ALTER TABLE marketplace.withdrawals ADD CONSTRAINT withdrawals_decided_amounts_check
    CHECK ((status IN ('approved', 'paid')) = (tax_amount IS NOT NULL AND fee_amount IS NOT NULL AND net_amount IS NOT NULL));
ALTER TABLE marketplace.withdrawals ADD CONSTRAINT withdrawals_net_amount_sum_check CHECK (net_amount IS NULL OR net_amount + tax_amount + fee_amount = amount);

INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, 'other_income', a.id
FROM accounting.settings s JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = '711'
ON CONFLICT DO NOTHING;
