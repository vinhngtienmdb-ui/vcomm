-- CONG_VIEC_73 lát L7: Open API đơn chờ thanh toán, webhook (QUYTAC_NGHIEPVU_590, 591; API_330, 331), hủy giao dịch đã thu hộ và hoàn tiền,
-- ghi ngược L ở bảng chuyển tiền tiếp theo, việc chờ xử lý hóa đơn ủy nhiệm khi hủy (QUYTAC_NGHIEPVU_583, 585, 587).

-- Phạm vi khóa API `instore.checkout` (người có affiliate.manage gán cho khóa cửa hàng liên kết). Gồm mọi phạm vi trên main.
ALTER TABLE core.api_keys DROP CONSTRAINT api_keys_scopes_check;
ALTER TABLE core.api_keys ADD CONSTRAINT api_keys_scopes_check
    CHECK (cardinality(scopes) >= 1 AND scopes <@ ARRAY['catalog.read', 'sales_order.write', 'customer.write', 'loyalty.member', 'dropship.supplier', 'loyalty.partner', 'instore.checkout']::text[]);
-- Khóa cửa hàng liên kết (`loyalty.member`, có thể kèm `instore.checkout`) và khóa đối tác liên minh không có kênh bán.
ALTER TABLE core.api_keys DROP CONSTRAINT api_keys_channel_scope_check;
ALTER TABLE core.api_keys ADD CONSTRAINT api_keys_channel_scope_check
    CHECK ((channel_id IS NULL) = (scopes = ARRAY['loyalty.partner']::text[] OR ('loyalty.member' = ANY(scopes) AND scopes <@ ARRAY['loyalty.member', 'instore.checkout']::text[])));

-- Webhook của khóa: một địa chỉ HTTPS, khóa ký mã hóa AES-256-GCM (cấp, cấp lại hiện một lần).
ALTER TABLE affiliate.api_keys
    ADD COLUMN webhook_url         text        CHECK (webhook_url IS NULL OR (webhook_url ~ '^https://' AND char_length(webhook_url) <= 500)),
    ADD COLUMN webhook_secret      bytea,
    ADD COLUMN webhook_secret_at   timestamptz,
    ADD COLUMN webhook_version     integer     NOT NULL DEFAULT 0;

-- Nhật ký gửi webhook: thử lại sau 1, 5, 30 phút, 2, 6, 24 giờ; hết lượt thì dừng.
CREATE TABLE affiliate.webhook_deliveries (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id          uuid        NOT NULL REFERENCES affiliate.api_keys(api_key_id),
    event_id            uuid        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type          text        NOT NULL CHECK (event_type IN ('checkout.completed', 'checkout.expired', 'checkout.cancelled', 'checkout.declined', 'transaction.cancelled',
        'refund.completed', 'webhook.test')),
    payload             jsonb       NOT NULL,
    status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    attempt_count       integer     NOT NULL DEFAULT 0,
    next_attempt_at     timestamptz NOT NULL DEFAULT now(),
    last_status_code    integer,
    last_error          text        CHECK (last_error IS NULL OR char_length(last_error) <= 500),
    delivered_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_due_idx ON affiliate.webhook_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX webhook_deliveries_key_idx ON affiliate.webhook_deliveries (api_key_id, created_at DESC);

-- Đơn đã thu hộ bị hủy kèm hoàn tiền: trạng thái "refunded"; L (tiền đã chuyển cho cửa hàng: G − H − I − K) và phí ghi ngược khi giao dịch đã vào bảng chuyển tiền,
-- trừ ở bảng chuyển tiền tiếp theo (reversal_payout_id). Công ty vận hành sàn chịu phí cổng (lựa chọn người dùng 2026-11-17).
ALTER TABLE instore.checkouts DROP CONSTRAINT checkouts_status_check;
ALTER TABLE instore.checkouts ADD CONSTRAINT checkouts_status_check
    CHECK (status IN ('awaiting_buyer', 'awaiting_payment', 'paid_unposted', 'completed', 'expired', 'cancelled', 'declined', 'refunded'));
ALTER TABLE instore.checkouts
    ADD COLUMN refunded_at          timestamptz,
    ADD COLUMN reversal_amount      numeric(18,4) NOT NULL DEFAULT 0 CHECK (reversal_amount >= 0),
    ADD COLUMN reversal_fee         numeric(18,4) NOT NULL DEFAULT 0 CHECK (reversal_fee >= 0),
    ADD COLUMN reversal_fee_tax     numeric(18,4) NOT NULL DEFAULT 0 CHECK (reversal_fee_tax >= 0),
    ADD COLUMN reversal_payout_id   uuid REFERENCES instore.payouts(id);
ALTER TABLE instore.checkouts ADD CONSTRAINT checkouts_refunded_check CHECK ((status = 'refunded') = (refunded_at IS NOT NULL));
-- Đơn hủy kèm hoàn tiền giữ thời điểm hoàn tất: ràng buộc "chỉ đơn hoàn tất có completed_at" (0161, tên tự sinh) thay bằng ràng buộc có tên.
DO $$
DECLARE name text;
BEGIN
    SELECT conname INTO name FROM pg_constraint
    WHERE conrelid = 'instore.checkouts'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) = 'CHECK (((status = ''completed''::text) = (completed_at IS NOT NULL)))';
    IF name IS NOT NULL THEN EXECUTE format('ALTER TABLE instore.checkouts DROP CONSTRAINT %I', name); END IF;
END $$;
ALTER TABLE instore.checkouts ADD CONSTRAINT checkouts_completed_at_check CHECK ((status IN ('completed', 'refunded')) = (completed_at IS NOT NULL));
CREATE INDEX checkouts_reversal_idx ON instore.checkouts (merchant_id) WHERE reversal_amount > 0 AND reversal_payout_id IS NULL;
-- Phí ghi ngược trong bảng (để hóa đơn phí sàn tháng trừ phần ghi ngược).
ALTER TABLE instore.payouts
    ADD COLUMN reversal_fee      numeric(18,4) NOT NULL DEFAULT 0 CHECK (reversal_fee >= 0),
    ADD COLUMN reversal_fee_tax  numeric(18,4) NOT NULL DEFAULT 0 CHECK (reversal_fee_tax >= 0);

-- Việc chờ hoàn tiền khi hủy giao dịch đã thu hộ.
ALTER TABLE marketplace.refunds DROP CONSTRAINT refunds_reason_check;
ALTER TABLE marketplace.refunds ADD CONSTRAINT refunds_reason_check
    CHECK (reason IN ('paid_after_cancel', 'duplicate_payment', 'order_cancelled', 'return_received', 'instore_cancelled', 'transaction_cancelled'));

-- Hóa đơn chưa phát hành của giao dịch bị hủy: "Đã hủy" (không gửi). Gồm mọi trạng thái trên main.
ALTER TABLE finance.einvoices DROP CONSTRAINT einvoices_status_check;
ALTER TABLE finance.einvoices ADD CONSTRAINT einvoices_status_check
    CHECK (status IN ('pending', 'retrying', 'awaiting_code', 'issued', 'failed', 'rejected', 'setup_error', 'cancelled'));

-- Việc chờ xử lý hóa đơn ủy nhiệm đã phát hành khi hủy giao dịch (như trả hàng CONG_VIEC_16, 53): hóa đơn điều chỉnh giảm toàn bộ hoặc hóa đơn trả hàng của người mua.
ALTER TABLE finance.einvoice_return_tasks ALTER COLUMN return_document_id DROP NOT NULL;
ALTER TABLE finance.einvoice_return_tasks ADD COLUMN affiliate_transaction_id uuid UNIQUE REFERENCES affiliate.transactions(id);
ALTER TABLE finance.einvoice_return_tasks ADD CONSTRAINT einvoice_return_tasks_source_check CHECK (num_nonnulls(return_document_id, affiliate_transaction_id) = 1);

-- Bút toán: hủy đơn đã thu (phải trả hoàn tiền khách), tiền về sau khi đơn đã đóng, hoàn tiền đơn tại cửa hàng. Gồm mọi giá trị trên main và của 0164.
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'affiliate_transaction', 'affiliate_transaction_cancel', 'affiliate_voucher', 'affiliate_voucher_expire', 'affiliate_settlement',
        'fx_revaluation', 'import_amendment', 'loyalty_partner_exchange', 'loyalty_partner_gift', 'loyalty_partner_gift_cancel', 'loyalty_partner_settlement',
        'instore_checkout', 'instore_checkout_owner', 'instore_payout', 'instore_payout_owner', 'instore_checkout_cancel', 'instore_refund_receipt', 'instore_refund'));

-- Vai trò tài khoản phải trả hoàn tiền khách (3388, kế toán trưởng xác nhận trước khi triển khai) cho công ty đã khởi tạo sổ kế toán.
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, 'instore_refund_payable', a.id
FROM accounting.settings s JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = '3388'
ON CONFLICT DO NOTHING;
