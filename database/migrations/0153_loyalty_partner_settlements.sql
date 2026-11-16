-- CONG_VIEC_65 L4: bảng đối soát tháng với đối tác liên minh điểm (QUYTAC_NGHIEPVU_548, 549; tài liệu 16).
-- Số DM… theo loại chứng từ `loyalty.partner_settlement` (dãy số của công ty vận hành sàn). A: tiền tặng điểm gồm thuế; B: tiền đổi vào gồm thuế; C: tiền đổi ra.
-- Giao dịch thuộc bảng theo tháng hoàn tất; chỉ gắn `settlement_id` khi xác nhận, nên giao dịch của bảng chưa xác nhận vẫn tính là phát sinh chưa chốt.
CREATE TABLE loyalty.partner_settlements (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no         text          NOT NULL UNIQUE,
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    contract_id         uuid          NOT NULL REFERENCES loyalty.partner_contracts(id),
    period              date          NOT NULL CHECK (extract(day FROM period) = 1),
    gift_count          integer       NOT NULL DEFAULT 0,
    gift_points         bigint        NOT NULL DEFAULT 0,
    gift_amount         numeric(18,4) NOT NULL DEFAULT 0,
    inbound_count       integer       NOT NULL DEFAULT 0,
    inbound_points      bigint        NOT NULL DEFAULT 0,
    inbound_units       bigint        NOT NULL DEFAULT 0,
    inbound_amount      numeric(18,4) NOT NULL DEFAULT 0,
    outbound_count      integer       NOT NULL DEFAULT 0,
    outbound_points     bigint        NOT NULL DEFAULT 0,
    outbound_units      bigint        NOT NULL DEFAULT 0,
    outbound_amount     numeric(18,4) NOT NULL DEFAULT 0,
    receivable_amount   numeric(18,4) NOT NULL DEFAULT 0,
    payable_amount      numeric(18,4) NOT NULL DEFAULT 0,
    offset_amount       numeric(18,4) NOT NULL DEFAULT 0,
    -- Dương: đối tác phải trả; âm: công ty phải trả.
    net_amount          numeric(18,4) NOT NULL DEFAULT 0,
    status              text          NOT NULL CHECK (status IN ('unreconciled', 'mismatched', 'matched', 'confirmed', 'paid')),
    mismatches          jsonb         NOT NULL DEFAULT '[]'::jsonb,
    -- Dấu của danh sách giao dịch lúc lập; xác nhận so lại để phát hiện thay đổi (hủy tặng, chốt tay) sau lần lập.
    lines_digest        text          NOT NULL DEFAULT '',
    reconcile_error     text,
    built_at            timestamptz   NOT NULL DEFAULT now(),
    confirm_note        text          CHECK (confirm_note IS NULL OR length(confirm_note) BETWEEN 1 AND 500),
    confirm_file_id     uuid,
    confirmed_by        uuid          REFERENCES core.users(id),
    confirmed_at        timestamptz,
    due_date            date,
    debt_item_id        uuid          REFERENCES finance.debt_items(id),
    paid_at             timestamptz,
    version             integer       NOT NULL DEFAULT 1,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (contract_id, period),
    CHECK ((status IN ('confirmed', 'paid')) = (confirmed_at IS NOT NULL))
);
CREATE INDEX loyalty_partner_settlements_period_idx ON loyalty.partner_settlements (company_id, period DESC, status);

ALTER TABLE loyalty.partner_exchanges ADD CONSTRAINT partner_exchanges_settlement_fk FOREIGN KEY (settlement_id) REFERENCES loyalty.partner_settlements(id);
ALTER TABLE loyalty.partner_gifts ADD CONSTRAINT partner_gifts_settlement_fk FOREIGN KEY (settlement_id) REFERENCES loyalty.partner_settlements(id);
CREATE INDEX partner_exchanges_completed_idx ON loyalty.partner_exchanges (contract_id, completed_at) WHERE status = 'completed';
CREATE INDEX partner_gifts_created_idx ON loyalty.partner_gifts (contract_id, created_at);

-- Tệp biên bản đối chiếu dùng kho tệp hiện có; gồm mọi giá trị trên main.
ALTER TABLE core.attachments DROP CONSTRAINT attachments_owner_type_check;
ALTER TABLE core.attachments ADD CONSTRAINT attachments_owner_type_check CHECK (owner_type IN ('proposal', 'visit', 'loyalty_partner_settlement'));
ALTER TABLE loyalty.partner_settlements ADD CONSTRAINT partner_settlements_file_fk FOREIGN KEY (confirm_file_id) REFERENCES core.attachments(id);

-- Công nợ phải thu, phải trả của bảng đã xác nhận; gồm mọi giá trị trên main.
ALTER TABLE finance.debt_items DROP CONSTRAINT debt_items_source_type_check;
ALTER TABLE finance.debt_items ADD CONSTRAINT debt_items_source_type_check
    CHECK (source_type IN ('opening', 'sales_issue', 'sales_return', 'purchase_receipt', 'purchase_return', 'payment', 'internal_write_off', 'collection_statement', 'landed_cost',
        'affiliate_settlement', 'loyalty_partner_settlement'));

-- Bút toán bù trừ khi xác nhận bảng; gồm mọi giá trị trên main và 0151, 0152.
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'affiliate_transaction', 'affiliate_transaction_cancel', 'affiliate_voucher', 'affiliate_voucher_expire', 'affiliate_settlement',
        'fx_revaluation', 'import_amendment', 'loyalty_partner_exchange', 'loyalty_partner_gift', 'loyalty_partner_gift_cancel', 'loyalty_partner_settlement'));
