-- CONG_VIEC_17 lát L1: bút toán bảng hoa hồng (QUYTAC_NGHIEPVU_112; tài liệu 16).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission'));
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('commission_expense', '6411', '6421'), ('staff_payable', '334', '334')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;
