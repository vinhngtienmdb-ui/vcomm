-- CONG_VIEC_62 lát L5: đối soát tuần với người bán dropship (CHUC_NANG_225; QUYTAC_NGHIEPVU_508, 509).
-- Phí giao D, thuế E ghi sổ qua đơn bán dịch vụ phí giao (quyết định người dùng 2026-11-16): công nợ, bút toán, hóa đơn điện tử theo luồng đơn bán dịch vụ có sẵn,
-- không định nghĩa lại ràng buộc nguồn công nợ, bút toán dùng chung.

-- Sản phẩm dịch vụ "Phí giao hàng dropship" dùng lập đơn phí giao khi xác nhận bảng đối soát; thuế suất theo sản phẩm.
ALTER TABLE sales.settings ADD COLUMN dropship_fee_variant_id uuid REFERENCES catalog.variants(id);

-- Thời điểm vận đơn kết thúc (đã giao, hoàn hàng): phí giao tính vào tuần kết thúc.
ALTER TABLE sales.order_shipments ADD COLUMN finished_at timestamptz;

CREATE SEQUENCE finance.reseller_settlement_no_seq;

CREATE TABLE finance.reseller_settlements (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    document_no         text          NOT NULL UNIQUE DEFAULT 'DSNB' || lpad(nextval('finance.reseller_settlement_no_seq')::text, 8, '0'),
    reseller_id         uuid          NOT NULL REFERENCES crm.partners(id),
    week_start          date          NOT NULL CHECK (extract(isodow FROM week_start) = 1),
    issue_amount        numeric(20,4) NOT NULL CHECK (issue_amount >= 0),          -- A: tiền hàng có thuế của phiếu xuất
    return_amount       numeric(20,4) NOT NULL CHECK (return_amount >= 0),         -- B: trả hàng
    collection_amount   numeric(20,4) NOT NULL CHECK (collection_amount >= 0),     -- C: thu hộ đã ghi sổ
    fee_amount          numeric(20,4) NOT NULL CHECK (fee_amount >= 0),            -- D: phí giao chưa thuế
    fee_tax_rate        text          NOT NULL CHECK (fee_tax_rate IN ('0', '5', '8', '10', 'exempt', 'not_declared')),
    fee_tax_amount      numeric(20,4) NOT NULL CHECK (fee_tax_amount >= 0),        -- E: thuế giá trị gia tăng của phí giao
    remaining_amount    numeric(20,4) NOT NULL,                                    -- A − B − C + D + E; dương: người bán nộp; âm: công ty trả
    status              text          NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    fee_order_id        uuid          REFERENCES sales.orders(id),
    refund_payment_id   uuid          REFERENCES finance.payments(id),
    confirmed_by        uuid          REFERENCES core.users(id),
    confirmed_at        timestamptz,
    created_at          timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    UNIQUE (company_id, reseller_id, week_start),
    CHECK (remaining_amount = issue_amount - return_amount - collection_amount + fee_amount + fee_tax_amount),
    CHECK ((status = 'confirmed') = (confirmed_at IS NOT NULL)),
    CHECK (fee_order_id IS NULL OR status = 'confirmed')
);
CREATE INDEX reseller_settlements_company_idx ON finance.reseller_settlements (company_id, week_start DESC);

-- Dòng: chứng từ nguồn đã vào bảng; mỗi nguồn vào đúng một bảng (nguồn trễ của tuần trước vào bảng tuần sau).
CREATE TABLE finance.reseller_settlement_lines (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id   uuid          NOT NULL REFERENCES finance.reseller_settlements(id),
    kind            text          NOT NULL CHECK (kind IN ('issue', 'return', 'collection', 'shipping_fee')),
    source_id       uuid          NOT NULL,                                        -- phiếu xuất, phiếu nhận trả, dòng bảng thu hộ, vận đơn
    order_id        uuid          NOT NULL REFERENCES sales.orders(id),
    document_no     text          NOT NULL,
    document_date   date          NOT NULL,
    amount          numeric(20,4) NOT NULL CHECK (amount >= 0),
    UNIQUE (kind, source_id)
);
CREATE INDEX reseller_settlement_lines_settlement_idx ON finance.reseller_settlement_lines (settlement_id, kind);

-- Phiếu chi hoàn tiền khách lập từ bảng đối soát (số còn lại âm).
ALTER TABLE finance.payments ADD COLUMN reseller_settlement_id uuid REFERENCES finance.reseller_settlements(id);
