-- CONG_VIEC_53: hóa đơn bán lẻ tại quầy (CHUC_NANG_187; QUYTAC_NGHIEPVU_370 đến 374; THAY_DOI_24; tài liệu 16).

-- Đơn bán lập từ quầy: đánh dấu bán lẻ; thông tin người mua lấy hóa đơn khi không có đối tác khách hàng (QUYTAC_NGHIEPVU_372).
ALTER TABLE sales.orders
    ADD COLUMN is_retail          boolean NOT NULL DEFAULT false,
    ADD COLUMN buyer_tax_code     text CHECK (buyer_tax_code ~ '^[0-9]{10}(-[0-9]{3})?$'),
    ADD COLUMN buyer_address      text CHECK (char_length(buyer_address) <= 400),
    ADD COLUMN buyer_identity_no  text CHECK (buyer_identity_no ~ '^[0-9]{12}$');

-- Hóa đơn bán lẻ: một lần thanh toán tại quầy (QUYTAC_NGHIEPVU_374). Không sửa, không hủy.
CREATE TABLE retail.sales (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    store_id            uuid        NOT NULL REFERENCES retail.stores(id),
    register_id         uuid        NOT NULL REFERENCES retail.registers(id),
    shift_id            uuid        NOT NULL REFERENCES retail.shifts(id),
    document_no         text        NOT NULL,
    sold_at             timestamptz NOT NULL,
    sale_date           date        NOT NULL,
    cashier_id          uuid        NOT NULL REFERENCES core.users(id),
    buyer_user_id       uuid        REFERENCES core.users(id),              -- tài khoản VComm của khách (không bắt buộc)
    buyer_name          text        CHECK (char_length(buyer_name) BETWEEN 1 AND 200),
    sales_order_id      uuid        NOT NULL UNIQUE REFERENCES sales.orders(id),
    stock_document_id   uuid        NOT NULL UNIQUE REFERENCES inventory.documents(id),
    goods_amount        numeric(18, 4) NOT NULL,                            -- tiền hàng theo giá bảng giá, gồm thuế
    promotion_amount    numeric(18, 4) NOT NULL,                            -- giảm do khuyến mãi
    manual_discount     numeric(18, 4) NOT NULL,                            -- giảm tay
    tax_amount          numeric(18, 4) NOT NULL,
    total_amount        numeric(18, 4) NOT NULL CHECK (total_amount >= 0),  -- phải trả, bằng tiền phiếu xuất
    tendered_amount     numeric(18, 4) NOT NULL,                            -- tổng khách đưa
    change_amount       numeric(18, 4) NOT NULL CHECK (change_amount >= 0),
    client_key          uuid        NOT NULL,                               -- khóa yêu cầu do máy tạo, chống ghi trùng (QUYTAC_NGHIEPVU_373)
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, document_no),
    UNIQUE (register_id, client_key),
    CHECK (tendered_amount = total_amount + change_amount)
);
CREATE INDEX sales_shift_idx ON retail.sales (shift_id);
CREATE INDEX sales_store_date_idx ON retail.sales (store_id, sale_date DESC);

-- Dòng thanh toán của hóa đơn bán lẻ; tiền mặt ghi số khách đưa, tiền thừa ghi ở hóa đơn.
CREATE TABLE retail.sale_payments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id             uuid        NOT NULL REFERENCES retail.sales(id),
    line_no             integer     NOT NULL,
    method              text        NOT NULL CHECK (method IN ('cash', 'bank_transfer', 'points')),
    amount              numeric(18, 4) NOT NULL CHECK (amount > 0),
    fund_id             uuid        REFERENCES finance.funds(id),
    bank_reference      text        CHECK (char_length(bank_reference) BETWEEN 1 AND 50),
    points              numeric(18, 4),
    UNIQUE (sale_id, line_no),
    CHECK ((method = 'points') = (fund_id IS NULL))
);
