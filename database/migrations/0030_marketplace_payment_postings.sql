-- CONG_VIEC_25 L4: bút toán tiền thu trực tuyến, hoàn tiền đơn VComm; vai trò định khoản doanh thu cung cấp dịch vụ (phí giao hàng) (QUYTAC_NGHIEPVU_169).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund'));
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, 'service_revenue', a.id
FROM accounting.settings s JOIN core.companies c ON c.id = s.company_id
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN '5113' ELSE '511' END
ON CONFLICT DO NOTHING;
