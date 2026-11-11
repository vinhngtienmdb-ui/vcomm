-- CONG_VIEC_48 lát L2: bút toán lương, trả lương, phiếu lương (QUYTAC_NGHIEPVU_323; tài liệu 16).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment'));

-- Định khoản mặc định cho công ty đã khởi tạo kế toán; công ty thiếu tài khoản thì không thêm (khai ở Định khoản).
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES
    ('salary_payable', '334', '334'),
    ('salary_expense_selling', '6411', '6421'),
    ('salary_expense_admin', '6421', '6422'),
    ('social_insurance_payable', '3383', '3383'),
    ('health_insurance_payable', '3384', '3384'),
    ('unemployment_insurance_payable', '3386', '3385'),
    ('union_fee_payable', '3382', '3382'),
    ('payroll_deduction_payable', '3388', '3388')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;

-- Trả lương: ngày trả, quỹ chi.
ALTER TABLE hr.payrolls ADD COLUMN payment_date date;
ALTER TABLE hr.payrolls ADD COLUMN fund_id uuid REFERENCES finance.funds(id);
ALTER TABLE hr.payrolls ADD COLUMN paid_by uuid REFERENCES core.users(id);
ALTER TABLE hr.payrolls ADD CONSTRAINT payrolls_paid_check CHECK ((status = 'paid') = (payment_date IS NOT NULL AND fund_id IS NOT NULL));

-- Gửi email phiếu lương sau khi duyệt: lúc gửi xong hoặc lỗi để gửi lại.
ALTER TABLE hr.payroll_lines ADD COLUMN email_sent_at timestamptz;
ALTER TABLE hr.payroll_lines ADD COLUMN email_error text;
