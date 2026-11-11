-- CONG_VIEC_45: hợp nhất nhánh với main 0.4.0. Database migration 0078 (lương) đặt lại journals_source_type_check sau 0068 nên thiếu nguồn nhập khẩu;
-- đặt lại với danh sách hợp nhất của mọi nguồn bút toán.
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'import_declaration', 'landed_cost'));
