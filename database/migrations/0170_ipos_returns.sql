-- CONG_VIEC_74 L5: iPOS – phiếu trả hàng, hủy hóa đơn (QUYTAC_NGHIEPVU_624; tài liệu 16). Phần trả hàng của database migration 0169 trong đặc tả
-- tách ra tệp này vì 0169 đã dùng cho phần thanh toán ở lát L4.

-- Phiếu trả `TR-<mã điểm bán>-<YYMMDD>-<4 số>`: trả một phần (hóa đơn chỉ tiền mặt, VietQR) hoặc hủy toàn bộ hóa đơn (có điểm, voucher, ứng dụng VComm).
-- Tiền hoàn trả bằng tiền mặt từ két của ca đang mở tại quầy trả.
CREATE TABLE ipos.returns (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid          NOT NULL REFERENCES affiliate.merchants(id),
    outlet_id       uuid          NOT NULL REFERENCES affiliate.outlets(id),
    register_id     uuid          NOT NULL REFERENCES ipos.registers(id),
    device_id       uuid          NOT NULL REFERENCES ipos.devices(id),
    shift_id        uuid          NOT NULL REFERENCES ipos.shifts(id),
    member_id       uuid          NOT NULL REFERENCES affiliate.members(id),
    sale_id         uuid          NOT NULL REFERENCES ipos.sales(id),
    document_no     text          NOT NULL,
    idempotency_key uuid          NOT NULL,
    kind            text          NOT NULL CHECK (kind IN ('partial', 'full_cancel')),
    amount          numeric(15,0) NOT NULL CHECK (amount >= 0),
    refund_cash     numeric(15,0) NOT NULL CHECK (refund_cash >= 0),
    approved_by     uuid          REFERENCES affiliate.members(id),
    reason          text          NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
    print_count     integer       NOT NULL DEFAULT 0,
    created_at      timestamptz   NOT NULL DEFAULT now(),
    CHECK (document_no ~ '^TR-')
);
CREATE UNIQUE INDEX returns_document_idx ON ipos.returns (outlet_id, document_no);
CREATE UNIQUE INDEX returns_idempotency_idx ON ipos.returns (device_id, idempotency_key);
-- Một hóa đơn chỉ hủy toàn bộ một lần.
CREATE UNIQUE INDEX returns_full_cancel_idx ON ipos.returns (sale_id) WHERE kind = 'full_cancel';
CREATE INDEX returns_sale_idx ON ipos.returns (sale_id);
CREATE INDEX returns_shift_idx ON ipos.returns (shift_id);
CREATE INDEX returns_merchant_idx ON ipos.returns (merchant_id, created_at DESC);
CREATE TRIGGER returns_outlet_merchant BEFORE INSERT OR UPDATE OF outlet_id, merchant_id ON ipos.returns
    FOR EACH ROW EXECUTE FUNCTION ipos.check_outlet_merchant();

-- Dòng trả: số lượng không vượt số đã mua trừ đã trả (kiểm ở service, khóa hóa đơn); tiền hoàn theo phần sau giảm (gồm phần giảm hóa đơn phân bổ).
CREATE TABLE ipos.return_lines (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id       uuid          NOT NULL REFERENCES ipos.returns(id),
    sale_line_id    uuid          NOT NULL REFERENCES ipos.sale_lines(id),
    quantity        numeric(15,3) NOT NULL CHECK (quantity > 0),
    amount          numeric(15,0) NOT NULL CHECK (amount >= 0),
    unit_cost       numeric(18,4),
    UNIQUE (return_id, sale_line_id)
);
CREATE INDEX return_lines_sale_line_idx ON ipos.return_lines (sale_line_id);

-- Hóa đơn bị hủy toàn bộ ghi thời điểm hủy.
ALTER TABLE ipos.sales ADD COLUMN cancelled_at timestamptz;
