-- CONG_VIEC_36: cổng chuyển khoản ngân hàng và VietQR (QUYTAC_NGHIEPVU_240 đến 244).
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES ('bank_transfer_vietqr', 'bank_transfer', 40, false) ON CONFLICT (code) DO NOTHING;

-- Giao dịch ngân hàng tự ghép với lần thanh toán đơn VComm (quyết định của người dùng ngày 2026-11-11): đã ghép thì có đúng một trong phiếu thu chi hoặc lần thanh toán.
ALTER TABLE finance.bank_transactions ADD COLUMN marketplace_payment_id uuid REFERENCES marketplace.payments(id);
ALTER TABLE finance.bank_transactions DROP CONSTRAINT bank_transactions_check;
ALTER TABLE finance.bank_transactions ADD CONSTRAINT bank_transactions_matched_check
    CHECK ((status = 'matched') = (payment_id IS NOT NULL OR marketplace_payment_id IS NOT NULL) AND (payment_id IS NULL OR marketplace_payment_id IS NULL));
-- Một lần thanh toán ghép tối đa một giao dịch.
CREATE UNIQUE INDEX bank_transactions_marketplace_payment_idx ON finance.bank_transactions (marketplace_payment_id) WHERE marketplace_payment_id IS NOT NULL;
