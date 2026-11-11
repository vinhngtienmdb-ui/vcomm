-- CONG_VIEC_26 L4: bút toán hoa hồng đơn VComm, chi trả rút tiền, thuế thu nhập cá nhân khấu trừ (QUYTAC_NGHIEPVU_207).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal'));
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
CROSS JOIN (VALUES ('commission_payable', '3388'), ('personal_income_tax', '3335')) AS r(role, code)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = r.code
ON CONFLICT DO NOTHING;
