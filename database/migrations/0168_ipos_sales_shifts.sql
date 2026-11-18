-- CONG_VIEC_74 L3: iPOS – cài đặt bán hàng, mã điểm bán, ca, thu chi, hóa đơn bán lẻ, số hóa đơn, giỏ treo, duyệt tại chỗ, nhật ký in và ngăn kéo
-- (QUYTAC_NGHIEPVU_611 đến 623; tài liệu 16). Thanh toán VietQR, ứng dụng VComm (L4) và trả hàng (L5) thêm ở 0169.

-- Mã điểm bán dùng trong số hóa đơn (QUYTAC_NGHIEPVU_619): 2 đến 10 ký tự chữ in hoa, số; duy nhất trong cửa hàng; ghi qua service của `affiliate`.
ALTER TABLE affiliate.outlets ADD COLUMN code text CHECK (code IS NULL OR code ~ '^[A-Z0-9]{2,10}$');
CREATE UNIQUE INDEX outlets_merchant_code_idx ON affiliate.outlets (merchant_id, code) WHERE code IS NOT NULL;

-- Cài đặt bán hàng theo cửa hàng (MAN_HINH_302). Chưa có dòng thì dùng mặc định.
CREATE TABLE ipos.settings (
    merchant_id                     uuid          PRIMARY KEY REFERENCES affiliate.merchants(id),
    vietqr_bank_bin                 text          CHECK (vietqr_bank_bin IS NULL OR vietqr_bank_bin ~ '^[0-9]{6}$'),
    vietqr_account_no               text          CHECK (vietqr_account_no IS NULL OR vietqr_account_no ~ '^[0-9A-Za-z]{4,19}$'),
    vietqr_account_name             text          CHECK (vietqr_account_name IS NULL OR length(vietqr_account_name) BETWEEN 1 AND 50),
    cashier_max_discount_percent    numeric(5,2)  NOT NULL DEFAULT 10 CHECK (cashier_max_discount_percent BETWEEN 0 AND 100),
    return_days                     integer       NOT NULL DEFAULT 7 CHECK (return_days BETWEEN 0 AND 365),
    cashier_can_return              boolean       NOT NULL DEFAULT false,
    block_negative_stock            boolean       NOT NULL DEFAULT false,
    receipt_footer                  text          CHECK (receipt_footer IS NULL OR length(receipt_footer) <= 200),
    paper_width                     integer       NOT NULL DEFAULT 80 CHECK (paper_width IN (58, 80)),
    updated_by                      uuid          REFERENCES core.users(id),
    updated_at                      timestamptz   NOT NULL DEFAULT now(),
    version                         integer       NOT NULL DEFAULT 1,
    CHECK ((vietqr_bank_bin IS NULL) = (vietqr_account_no IS NULL) AND (vietqr_account_no IS NULL) = (vietqr_account_name IS NULL))
);

-- Ca bán hàng theo (quầy, thành viên); mỗi quầy, mỗi người cùng lúc tối đa một ca mở (QUYTAC_NGHIEPVU_621, 623).
CREATE TABLE ipos.shifts (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         uuid          NOT NULL REFERENCES affiliate.merchants(id),
    outlet_id           uuid          NOT NULL REFERENCES affiliate.outlets(id),
    register_id         uuid          NOT NULL REFERENCES ipos.registers(id),
    member_id           uuid          NOT NULL REFERENCES affiliate.members(id),
    device_id           uuid          NOT NULL REFERENCES ipos.devices(id),
    opened_at           timestamptz   NOT NULL DEFAULT now(),
    opening_cash        numeric(15,0) NOT NULL CHECK (opening_cash BETWEEN 0 AND 1000000000),
    opening_note        text          CHECK (opening_note IS NULL OR length(opening_note) BETWEEN 1 AND 500),
    closed_at           timestamptz,
    closed_by           uuid          REFERENCES affiliate.members(id),
    system_cash         numeric(15,0),
    counted_cash        numeric(15,0) CHECK (counted_cash IS NULL OR counted_cash >= 0),
    difference          numeric(15,0),
    difference_reason   text          CHECK (difference_reason IS NULL OR length(difference_reason) BETWEEN 1 AND 500),
    left_cash           numeric(15,0) CHECK (left_cash IS NULL OR left_cash >= 0),
    denominations       jsonb,
    CHECK ((closed_at IS NULL) = (closed_by IS NULL)),
    CHECK (closed_at IS NULL OR (system_cash IS NOT NULL AND counted_cash IS NOT NULL AND difference IS NOT NULL AND left_cash IS NOT NULL AND left_cash <= counted_cash))
);
CREATE UNIQUE INDEX shifts_open_register_idx ON ipos.shifts (register_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX shifts_open_member_idx ON ipos.shifts (member_id) WHERE closed_at IS NULL;
CREATE INDEX shifts_outlet_idx ON ipos.shifts (outlet_id, opened_at DESC);
CREATE TRIGGER shifts_outlet_merchant BEFORE INSERT OR UPDATE OF outlet_id, merchant_id ON ipos.shifts
    FOR EACH ROW EXECUTE FUNCTION ipos.check_outlet_merchant();

-- Thu chi tiền mặt trong ca (QUYTAC_NGHIEPVU_622).
CREATE TABLE ipos.cash_movements (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id        uuid          NOT NULL REFERENCES ipos.shifts(id),
    direction       text          NOT NULL CHECK (direction IN ('in', 'out')),
    category        text          NOT NULL CHECK (category IN ('handover', 'expense', 'other')),
    amount          numeric(15,0) NOT NULL CHECK (amount > 0 AND amount <= 1000000000),
    reason          text          NOT NULL CHECK (length(reason) BETWEEN 1 AND 200),
    member_id       uuid          NOT NULL REFERENCES affiliate.members(id),
    created_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX cash_movements_shift_idx ON ipos.cash_movements (shift_id);

-- Số chứng từ theo (điểm bán, ngày theo giờ Việt Nam, loại), đánh lại từ 1 mỗi ngày (QUYTAC_NGHIEPVU_619).
CREATE TABLE ipos.document_sequences (
    outlet_id       uuid        NOT NULL REFERENCES affiliate.outlets(id),
    day             date        NOT NULL,
    kind            text        NOT NULL CHECK (kind IN ('sale', 'return')),
    last_number     integer     NOT NULL CHECK (last_number BETWEEN 1 AND 9999),
    PRIMARY KEY (outlet_id, day, kind)
);

-- Hóa đơn bán lẻ iPOS (QUYTAC_NGHIEPVU_618). Khóa yêu cầu duy nhất theo thiết bị chống ghi trùng.
CREATE TABLE ipos.sales (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         uuid          NOT NULL REFERENCES affiliate.merchants(id),
    outlet_id           uuid          NOT NULL REFERENCES affiliate.outlets(id),
    register_id         uuid          NOT NULL REFERENCES ipos.registers(id),
    device_id           uuid          NOT NULL REFERENCES ipos.devices(id),
    shift_id            uuid          NOT NULL REFERENCES ipos.shifts(id),
    member_id           uuid          NOT NULL REFERENCES affiliate.members(id),
    document_no         text          NOT NULL,
    idempotency_key     uuid          NOT NULL,
    buyer_user_id       uuid          REFERENCES core.users(id),
    subtotal            numeric(15,0) NOT NULL CHECK (subtotal >= 0),
    line_discount       numeric(15,0) NOT NULL CHECK (line_discount >= 0),
    invoice_discount    numeric(15,0) NOT NULL CHECK (invoice_discount >= 0),
    total               numeric(15,0) NOT NULL CHECK (total >= 0),
    discount_approved_by uuid         REFERENCES affiliate.members(id),
    print_count         integer       NOT NULL DEFAULT 0 CHECK (print_count >= 0),
    status              text          NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    sold_at             timestamptz   NOT NULL DEFAULT now(),
    CHECK (total = subtotal - line_discount - invoice_discount)
);
CREATE UNIQUE INDEX sales_document_idx ON ipos.sales (outlet_id, document_no);
CREATE UNIQUE INDEX sales_idempotency_idx ON ipos.sales (device_id, idempotency_key);
CREATE INDEX sales_shift_idx ON ipos.sales (shift_id, sold_at DESC);
CREATE INDEX sales_merchant_idx ON ipos.sales (merchant_id, sold_at DESC);
CREATE TRIGGER sales_outlet_merchant BEFORE INSERT OR UPDATE OF outlet_id, merchant_id ON ipos.sales
    FOR EACH ROW EXECUTE FUNCTION ipos.check_outlet_merchant();

-- Dòng hàng: đơn giá đã gồm thuế, giảm dòng, phần giảm hóa đơn phân bổ, thuế suất, giá vốn tại thời điểm bán.
CREATE TABLE ipos.sale_lines (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id             uuid          NOT NULL REFERENCES ipos.sales(id),
    line_no             integer       NOT NULL CHECK (line_no BETWEEN 1 AND 200),
    variant_id          uuid          NOT NULL REFERENCES ipos.item_variants(id),
    item_code           text          NOT NULL,
    variant_code        text          NOT NULL,
    name                text          NOT NULL,
    unit                text          NOT NULL,
    quantity            numeric(15,3) NOT NULL CHECK (quantity > 0 AND quantity <= 9999),
    unit_price          numeric(15,0) NOT NULL CHECK (unit_price >= 0),
    gross               numeric(15,0) NOT NULL CHECK (gross >= 0),
    discount            numeric(15,0) NOT NULL CHECK (discount >= 0),
    allocated_discount  numeric(15,0) NOT NULL CHECK (allocated_discount >= 0),
    amount              numeric(15,0) NOT NULL CHECK (amount >= 0),
    vat_rate            text          NOT NULL CHECK (vat_rate IN ('0', '5', '8', '10', 'exempt')),
    unit_cost           numeric(18,4),
    UNIQUE (sale_id, line_no),
    CHECK (amount = gross - discount - allocated_discount)
);

-- Dòng thanh toán. L3 chỉ tiền mặt; `vietqr`, `vcomm_app`, `points`, `voucher` dùng từ L4.
CREATE TABLE ipos.sale_payments (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         uuid          NOT NULL REFERENCES ipos.sales(id),
    method          text          NOT NULL CHECK (method IN ('cash', 'vietqr', 'vcomm_app', 'points', 'voucher')),
    amount          numeric(15,0) NOT NULL CHECK (amount >= 0),
    tendered        numeric(15,0) CHECK (tendered IS NULL OR tendered >= amount),
    confirmed_by    uuid          REFERENCES affiliate.members(id),
    created_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX sale_payments_sale_idx ON ipos.sale_payments (sale_id);

-- Giỏ treo theo quầy, tối đa 5 ô, xóa khi đóng ca (QUYTAC_NGHIEPVU_613 khoản 5).
CREATE TABLE ipos.held_carts (
    register_id     uuid        NOT NULL REFERENCES ipos.registers(id),
    slot            integer     NOT NULL CHECK (slot BETWEEN 1 AND 5),
    label           text        NOT NULL CHECK (length(label) BETWEEN 1 AND 50),
    payload         jsonb       NOT NULL,
    member_id       uuid        NOT NULL REFERENCES affiliate.members(id),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (register_id, slot)
);

-- Mã duyệt tại chỗ bằng PIN chủ cửa hàng: dùng một lần, hiệu lực 2 phút (API_342). Chỉ lưu bản băm.
CREATE TABLE ipos.approval_codes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id       uuid        NOT NULL REFERENCES ipos.devices(id),
    approver_id     uuid        NOT NULL REFERENCES affiliate.members(id),
    purpose         text        NOT NULL CHECK (purpose IN ('discount', 'return')),
    code_hash       text        NOT NULL UNIQUE,
    expires_at      timestamptz NOT NULL,
    used_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Nhật ký in lại hóa đơn và mở ngăn kéo (QUYTAC_NGHIEPVU_620 khoản 3, 4).
CREATE TABLE ipos.device_events (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    device_id       uuid        NOT NULL REFERENCES ipos.devices(id),
    member_id       uuid        NOT NULL REFERENCES affiliate.members(id),
    kind            text        NOT NULL CHECK (kind IN ('reprint', 'drawer_open')),
    sale_id         uuid        REFERENCES ipos.sales(id),
    reason          text        CHECK (reason IS NULL OR length(reason) BETWEEN 1 AND 200),
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    CHECK (kind <> 'reprint' OR sale_id IS NOT NULL)
);
CREATE INDEX device_events_merchant_idx ON ipos.device_events (merchant_id, occurred_at DESC);

-- Biến động tồn do bán, trả (đã có cột `source_type` từ 0167); bán dùng giá vốn bình quân hiện tại.
