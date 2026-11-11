-- Phát hành 0.5.0: đặt lại ràng buộc kiểm tra bị nhiều công việc định nghĩa lại khi phát triển song song.
-- accounting.journals.source_type: 0078 (Nhân sự, 0.4.0), 0079 (CONG_VIEC_49), 0084 (CONG_VIEC_45), 0088 (CONG_VIEC_51) mỗi tệp định nghĩa lại theo nhánh của mình,
-- tệp chạy sau cùng (0088) làm mất nguồn của 0079, 0084. Ràng buộc dưới đây là hợp của mọi giá trị mã nguồn dùng.
-- Các ràng buộc khác (inventory.documents type, reason_code: 0068; finance.debt_items source_type: 0069; finance.payments kind: 0096;
-- marketplace.wallet_transactions kind: 0079; marketplace.orders status: 0081) chỉ được định nghĩa lại một lần, không cần đặt lại.
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem'));
