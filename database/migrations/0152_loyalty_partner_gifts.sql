-- CONG_VIEC_65 L3: đối tác tặng điểm VComm qua Open API, trả trước, trả sau (QUYTAC_NGHIEPVU_545 đến 547).

CREATE SEQUENCE loyalty.partner_gift_no_seq;

-- Giao dịch tặng (số TL-<năm>-<số>); mã giao dịch đối tác duy nhất theo hợp đồng (chống tạo trùng).
-- `amount` = số điểm × giá bán (chưa thuế); `tax_amount` thuế phần chênh lệch dương; `point_value_amount` = điểm × giá trị một điểm lúc cộng.
CREATE TABLE loyalty.partner_gifts (
    id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no                 text          NOT NULL UNIQUE,
    contract_id                 uuid          NOT NULL REFERENCES loyalty.partner_contracts(id),
    api_key_id                  uuid          REFERENCES core.api_keys(id),
    partner_transaction_code    text          NOT NULL CHECK (partner_transaction_code ~ '^[A-Za-z0-9._-]{1,50}$'),
    user_id                     uuid          NOT NULL REFERENCES core.users(id),
    rate_id                     uuid          NOT NULL REFERENCES loyalty.partner_rates(id),
    points                      integer       NOT NULL CHECK (points > 0),
    unit_price                  numeric(18,4) NOT NULL CHECK (unit_price > 0),
    amount                      numeric(18,4) NOT NULL CHECK (amount > 0),
    tax_amount                  numeric(18,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    point_value_amount          numeric(18,4) NOT NULL CHECK (point_value_amount > 0),
    message                     text          CHECK (message IS NULL OR length(message) BETWEEN 1 AND 200),
    lot_id                      uuid          NOT NULL REFERENCES loyalty.lots(id),
    status                      text          NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    cancel_reason               text          CHECK (cancel_reason IS NULL OR length(cancel_reason) BETWEEN 1 AND 500),
    cancelled_at                timestamptz,
    settlement_id               uuid,
    created_at                  timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (contract_id, partner_transaction_code),
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL))
);
CREATE INDEX partner_gifts_contract_idx ON loyalty.partner_gifts (contract_id, created_at);
CREATE INDEX partner_gifts_user_idx ON loyalty.partner_gifts (user_id, created_at);

-- Ngày đã cảnh báo số dư trả trước thấp hoặc dư nợ gần hạn mức (một lần mỗi ngày, QUYTAC_NGHIEPVU_546).
ALTER TABLE loyalty.partner_contracts ADD COLUMN exposure_alerted_on date;

-- Khóa API phạm vi `loyalty.partner` (QUYTAC_NGHIEPVU_545): không kênh bán, không kho.
-- Định nghĩa lại ràng buộc gồm mọi phạm vi trên main và phạm vi mới; khóa không kênh khi chỉ có phạm vi điểm thưởng
-- (`loyalty.member` của CONG_VIEC_67 hoặc `loyalty.partner`), viết để chạy được cả khi chưa hay đã có database migration 0146.
ALTER TABLE core.api_keys DROP CONSTRAINT api_keys_scopes_check;
ALTER TABLE core.api_keys ADD CONSTRAINT api_keys_scopes_check
    CHECK (cardinality(scopes) >= 1 AND scopes <@ ARRAY['catalog.read', 'sales_order.write', 'customer.write', 'loyalty.member', 'loyalty.partner']::text[]);
ALTER TABLE core.api_keys ALTER COLUMN channel_id DROP NOT NULL;
ALTER TABLE core.api_keys DROP CONSTRAINT IF EXISTS api_keys_channel_scope_check;
ALTER TABLE core.api_keys ADD CONSTRAINT api_keys_channel_scope_check
    CHECK ((channel_id IS NULL) = (scopes = ARRAY['loyalty.member']::text[] OR scopes = ARRAY['loyalty.partner']::text[]));

-- Nguồn bút toán: đối tác tặng điểm, hủy tặng.
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'affiliate_transaction', 'affiliate_transaction_cancel', 'affiliate_voucher', 'affiliate_voucher_expire', 'affiliate_settlement',
        'fx_revaluation', 'import_amendment', 'loyalty_partner_exchange', 'loyalty_partner_gift', 'loyalty_partner_gift_cancel'));
