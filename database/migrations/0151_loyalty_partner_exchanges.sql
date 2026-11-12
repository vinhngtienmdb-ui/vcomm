-- CONG_VIEC_65 L2: giao dịch đổi điểm với đối tác liên minh – đổi ra, đổi vào, chờ đối tác, xử lý tay (QUYTAC_NGHIEPVU_542 đến 544, 547).
-- Ràng buộc kiểm tra dùng chung định nghĩa lại gồm mọi giá trị trên main (bản 0.9.0) cộng giá trị mới.

CREATE SEQUENCE loyalty.partner_exchange_no_seq;

-- Giao dịch đổi (số DL-<năm>-<số>). `reference` là mã tham chiếu VComm gửi đối tác (chống tạo trùng phía đối tác).
-- Tiền: `amount` = số đơn vị × đơn giá (đổi ra: công ty trả; đổi vào: đối tác trả, chưa thuế); `tax_amount` thuế phần chênh lệch dương (đổi vào);
-- `point_value_amount` giá trị điểm theo sổ (đổi ra: giá trị lúc tích của lô đã lấy; đổi vào: điểm × giá trị một điểm lúc cộng).
CREATE TABLE loyalty.partner_exchanges (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_no         text          NOT NULL UNIQUE,
    contract_id         uuid          NOT NULL REFERENCES loyalty.partner_contracts(id),
    membership_id       uuid          NOT NULL REFERENCES loyalty.partner_memberships(id),
    user_id             uuid          NOT NULL REFERENCES core.users(id),
    direction           text          NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    rate_id             uuid          NOT NULL REFERENCES loyalty.partner_rates(id),
    vcomm_points        integer       NOT NULL CHECK (vcomm_points > 0),
    partner_units       integer       NOT NULL CHECK (partner_units > 0),
    unit_price          numeric(18,4) NOT NULL CHECK (unit_price > 0),
    amount              numeric(18,4) NOT NULL CHECK (amount >= 0),
    tax_amount          numeric(18,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    point_value_amount  numeric(18,4),
    -- Đổi vào: giá trị một điểm, hạn dùng của giai đoạn chương trình lúc tạo (lô điểm cộng khi hoàn tất theo hai giá trị này).
    point_value         numeric(18,4) CHECK (point_value IS NULL OR point_value > 0),
    validity_months     integer       CHECK (validity_months IS NULL OR validity_months BETWEEN 1 AND 60),
    reference           text          NOT NULL UNIQUE,
    partner_reference   text          CHECK (partner_reference IS NULL OR length(partner_reference) BETWEEN 1 AND 100),
    status              text          NOT NULL CHECK (status IN ('sending', 'otp_pending', 'pending_partner', 'needs_review', 'completed', 'failed', 'refunded', 'expired')),
    attempts            integer       NOT NULL DEFAULT 0,
    next_check_at       timestamptz,
    last_error_code     text          CHECK (last_error_code IS NULL OR length(last_error_code) <= 100),
    otp_expires_at      timestamptz,
    redeem_entry_id     uuid          REFERENCES loyalty.entries(id),
    lot_id              uuid          REFERENCES loyalty.lots(id),
    resolved_by         uuid          REFERENCES core.users(id),
    resolution_note     text          CHECK (resolution_note IS NULL OR length(resolution_note) BETWEEN 1 AND 500),
    completed_at        timestamptz,
    settlement_id       uuid,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    updated_at          timestamptz   NOT NULL DEFAULT now(),
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX partner_exchanges_user_idx ON loyalty.partner_exchanges (user_id, created_at DESC);
CREATE INDEX partner_exchanges_contract_idx ON loyalty.partner_exchanges (contract_id, direction, created_at);
CREATE INDEX partner_exchanges_check_idx ON loyalty.partner_exchanges (next_check_at) WHERE status = 'pending_partner';

-- Giao dịch giả của bộ giả lập (để hỏi trạng thái, lấy danh sách tháng): cộng (đổi ra), trừ (đổi vào).
CREATE TABLE loyalty.partner_simulator_transactions (
    reference           text        PRIMARY KEY,
    contract_id         uuid        NOT NULL REFERENCES loyalty.partner_contracts(id),
    member_number       text        NOT NULL,
    kind                text        NOT NULL CHECK (kind IN ('credit', 'debit')),
    units               integer     NOT NULL CHECK (units > 0),
    status              text        NOT NULL CHECK (status IN ('pending', 'completed', 'rejected')),
    partner_reference   text        NOT NULL UNIQUE,
    created_at          timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz
);

-- Nguồn chứng từ của sổ cái điểm: thêm đổi điểm đối tác, đối tác tặng (CONG_VIEC_65).
ALTER TABLE loyalty.entries DROP CONSTRAINT entries_source_type_check;
ALTER TABLE loyalty.entries ADD CONSTRAINT entries_source_type_check
    CHECK (source_type IN ('marketplace_order', 'retail_sale', 'retail_return', 'adjustment', 'affiliate_transaction', 'affiliate_voucher', 'partner_exchange', 'partner_gift'));
ALTER TABLE loyalty.lots DROP CONSTRAINT lots_source_type_check;
ALTER TABLE loyalty.lots ADD CONSTRAINT lots_source_type_check
    CHECK (source_type IN ('marketplace_order', 'retail_sale', 'adjustment', 'affiliate_transaction', 'partner_exchange', 'partner_gift'));

-- Nguồn bút toán: giao dịch đổi điểm đối tác.
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'payroll', 'payroll_payment', 'marketplace_referral_bonus', 'import_declaration', 'landed_cost', 'loyalty_entry',
        'loyalty_seller_entry', 'loyalty_order_redeem', 'affiliate_transaction', 'affiliate_transaction_cancel', 'affiliate_voucher', 'affiliate_voucher_expire', 'affiliate_settlement',
        'fx_revaluation', 'import_amendment', 'loyalty_partner_exchange'));

-- Vai trò định khoản của đối tác liên minh cho công ty đã khởi tạo sổ kế toán (QUYTAC_NGHIEPVU_547).
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('loyalty_partner_receivable', '131', '131'), ('loyalty_partner_payable', '331', '331'), ('loyalty_partner_revenue', '511', '5113'),
    ('loyalty_partner_tax', '33311', '33311')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;
