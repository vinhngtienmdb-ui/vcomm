-- CONG_VIEC_51 L1: điểm của chứng từ bán (đơn VComm, bán tại quầy), tiền điểm trên đơn VComm, bút toán điểm (QUYTAC_NGHIEPVU_346 đến 349, 355).

-- Chốt lúc đặt hoặc lúc bán: giai đoạn, hạng, hệ số; điểm dùng, hoàn; điểm dự kiến, đã tích, đã trừ lại.
CREATE TABLE loyalty.document_points (
    source_type       text          NOT NULL CHECK (source_type IN ('marketplace_order', 'retail_sale')),
    source_id         uuid          NOT NULL,
    company_id        uuid          NOT NULL REFERENCES core.companies(id),
    user_id           uuid          NOT NULL REFERENCES loyalty.accounts(user_id),
    document_date     date          NOT NULL,
    goods_amount      numeric(18,4) NOT NULL CHECK (goods_amount >= 0),
    returned_amount   numeric(18,4) NOT NULL DEFAULT 0 CHECK (returned_amount BETWEEN 0 AND goods_amount),
    phase_id          uuid          REFERENCES loyalty.program_phases(id),
    tier_id           uuid          REFERENCES loyalty.tiers(id),
    multiplier        numeric(6,3)  NOT NULL DEFAULT 1 CHECK (multiplier BETWEEN 1 AND 5),
    redeemed_points   integer       NOT NULL DEFAULT 0 CHECK (redeemed_points >= 0),
    redeemed_amount   numeric(18,4) NOT NULL DEFAULT 0 CHECK (redeemed_amount >= 0),
    refunded_points   integer       NOT NULL DEFAULT 0 CHECK (refunded_points BETWEEN 0 AND redeemed_points),
    refunded_amount   numeric(18,4) NOT NULL DEFAULT 0 CHECK (refunded_amount BETWEEN 0 AND redeemed_amount),
    expected_points   integer       NOT NULL DEFAULT 0 CHECK (expected_points >= 0),
    earned_points     integer       CHECK (earned_points IS NULL OR earned_points >= 0),
    reversed_points   integer       NOT NULL DEFAULT 0 CHECK (reversed_points >= 0),
    shortfall_amount  numeric(18,4) NOT NULL DEFAULT 0 CHECK (shortfall_amount >= 0),
    earned_value      numeric(18,4) NOT NULL DEFAULT 0 CHECK (earned_value >= 0),
    earn_status       text          NOT NULL DEFAULT 'pending' CHECK (earn_status IN ('pending', 'earned', 'skipped', 'cancelled')),
    skip_reason       text          CHECK (skip_reason IN ('test_buyer', 'locked', 'inactive', 'no_phase', 'zero')),
    earned_at         timestamptz,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (source_type, source_id),
    CHECK ((earn_status = 'skipped') = (skip_reason IS NOT NULL)),
    CHECK ((earn_status = 'earned') = (earned_points IS NOT NULL))
);
CREATE INDEX loyalty_document_points_user_idx ON loyalty.document_points (user_id, created_at DESC);

-- Tiền phải trả của đơn VComm = tiền hàng + phí giao hàng − tiền điểm (QUYTAC_NGHIEPVU_348).
ALTER TABLE marketplace.orders ADD COLUMN points_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (points_amount >= 0);

-- Bút toán tự sinh của điểm thưởng (QUYTAC_NGHIEPVU_355): mỗi bút toán điểm một bút toán ở công ty vận hành sàn (loyalty_entry), thêm một ở công ty bán
-- khi khác công ty vận hành sàn (loyalty_seller_entry); điểm dùng của đơn VComm ghi gộp khi đơn hoàn tất (loyalty_order_redeem).
ALTER TABLE accounting.journals DROP CONSTRAINT journals_source_type_check;
ALTER TABLE accounting.journals ADD CONSTRAINT journals_source_type_check
    CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing', 'commission', 'collection_statement', 'marketplace_payment', 'marketplace_refund',
        'marketplace_commission', 'marketplace_withdrawal', 'loyalty_entry', 'loyalty_seller_entry', 'loyalty_order_redeem'));
INSERT INTO accounting.posting_rules (company_id, role, account_id)
SELECT s.company_id, r.role, a.id
FROM accounting.settings s
JOIN core.companies c ON c.id = s.company_id
CROSS JOIN (VALUES ('loyalty_expense', '6418', '6421'), ('loyalty_liability', '3388', '3388'), ('loyalty_intercompany_receivable', '1368', '1368'), ('loyalty_intercompany_payable', '3368', '3368')) AS r(role, code_tt99, code_tt133)
JOIN accounting.accounts a ON a.company_id = s.company_id AND a.code = CASE WHEN c.accounting_regime = 'TT133' THEN r.code_tt133 ELSE r.code_tt99 END
ON CONFLICT DO NOTHING;

-- Bút toán hoàn điểm gắn với chứng từ bán gốc (trả hàng tại quầy ghi nguồn là phiếu trả): để tính phần còn hoàn được theo từng lô.
CREATE TABLE loyalty.refund_links (
    entry_id          uuid  PRIMARY KEY REFERENCES loyalty.entries(id),
    sale_source_type  text  NOT NULL CHECK (sale_source_type IN ('marketplace_order', 'retail_sale')),
    sale_source_id    uuid  NOT NULL
);
CREATE INDEX loyalty_refund_links_sale_idx ON loyalty.refund_links (sale_source_type, sale_source_id);
