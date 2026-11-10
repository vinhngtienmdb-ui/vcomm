-- CONG_VIEC_08: Bán hàng (MODULE_05, phần 1), schema `sales` (tài liệu 12 mục 2, tài liệu 16).
-- Khóa ngoại từ `sales` chỉ trỏ vào `sales`, `core`, `catalog`, `crm`.
-- Số đã giao, đã trả của dòng đơn bán tính từ phiếu kho, không lưu trùng.

CREATE SCHEMA IF NOT EXISTS sales;

-- Cài đặt bán hàng theo công ty: chiết khấu tay tối đa không cần duyệt (QUYTAC_NGHIEPVU_68).
CREATE TABLE sales.settings (
    company_id                      uuid        PRIMARY KEY REFERENCES core.companies(id),
    max_manual_discount_percent     numeric(5,2) NOT NULL DEFAULT 0 CHECK (max_manual_discount_percent BETWEEN 0 AND 100),
    updated_by                      uuid        REFERENCES core.users(id),
    updated_at                      timestamptz NOT NULL DEFAULT now(),
    version                         integer     NOT NULL DEFAULT 1
);

-- Đơn bán (CHUC_NANG_54; QUYTAC_NGHIEPVU_67 đến 71).
CREATE TABLE sales.orders (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    document_no             text,                                                   -- cấp khi gửi lần đầu
    customer_id             uuid        REFERENCES crm.partners(id),                -- để trống: người mua không lấy hóa đơn
    buyer_name              text,
    channel_id              uuid        NOT NULL REFERENCES catalog.sales_channels(id),
    customer_group_id       uuid        REFERENCES catalog.customer_groups(id),    -- nhóm khách lúc lập (tra giá)
    warehouse_id            uuid        NOT NULL,                                   -- kho xuất (inventory.warehouses, kiểm trong service)
    order_date              date        NOT NULL,
    delivery_address        text,
    note                    text,
    currency                char(3)     NOT NULL REFERENCES core.currencies(code),
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'confirmed', 'rejected', 'withdrawn', 'delivered', 'cancelled', 'closed')),
    exceptions              jsonb       NOT NULL DEFAULT '[]'::jsonb,               -- ngoại lệ cần duyệt lần gửi gần nhất
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    net_amount              numeric(20,4) NOT NULL DEFAULT 0,                       -- chưa gồm thuế giá trị gia tăng
    tax_amount              numeric(20,4) NOT NULL DEFAULT 0,
    total_amount            numeric(20,4) NOT NULL DEFAULT 0,                       -- gồm thuế
    closed_reason           text,
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    submitted_at            timestamptz,
    confirmed_at            timestamptz,
    closed_at               timestamptz,
    closed_by               uuid        REFERENCES core.users(id),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no)
);
CREATE INDEX sales_orders_company_idx ON sales.orders (company_id, created_at DESC);
CREATE INDEX sales_orders_customer_idx ON sales.orders (company_id, customer_id);
CREATE INDEX sales_orders_approval_idx ON sales.orders (approval_request_id);

CREATE TABLE sales.order_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                uuid        NOT NULL REFERENCES sales.orders(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    variant_id              uuid        NOT NULL REFERENCES catalog.variants(id),
    unit_id                 uuid        NOT NULL REFERENCES catalog.units(id),
    quantity                numeric(20,4) NOT NULL CHECK (quantity > 0),
    base_quantity           numeric(20,4) NOT NULL CHECK (base_quantity > 0),
    price_list_id           uuid        REFERENCES catalog.price_lists(id),
    list_price              numeric(20,4) NOT NULL CHECK (list_price >= 0),         -- giá bảng giá theo đơn vị của dòng
    price_includes_vat      boolean     NOT NULL,
    discount_percent        numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
    unit_price              numeric(20,4) NOT NULL CHECK (unit_price >= 0),         -- sau chiết khấu, cùng cách tính thuế với bảng giá
    vat_rate                text        NOT NULL CHECK (vat_rate IN ('0', '5', '8', '10', 'exempt', 'not_declared')),
    net_amount              numeric(20,4) NOT NULL,                                 -- chưa thuế
    tax_amount              numeric(20,4) NOT NULL,
    total_amount            numeric(20,4) NOT NULL,                                 -- gồm thuế
    UNIQUE (order_id, line_no)
);

-- Phiếu xuất giao hàng, phiếu nhận hàng trả lại do module Kho ghi (CHUC_NANG_56, 57).
ALTER TABLE inventory.documents DROP CONSTRAINT documents_type_check;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_type_check
    CHECK (type IN ('receipt_other', 'issue_other', 'adjustment', 'transfer', 'purchase_receipt', 'purchase_return', 'sales_issue', 'sales_return'));
ALTER TABLE inventory.documents DROP CONSTRAINT documents_reason_code_check;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_reason_code_check
    CHECK (reason_code IN ('internal_use', 'gift', 'damaged', 'expired_disposal', 'opening_balance', 'found', 'stocktake', 'transfer', 'purchase', 'purchase_return', 'sale', 'sales_return', 'other'));
ALTER TABLE inventory.documents DROP CONSTRAINT documents_purchase_source_check;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_trade_source_check
    CHECK (type NOT IN ('purchase_receipt', 'purchase_return', 'sales_issue', 'sales_return') OR source_id IS NOT NULL);
ALTER TABLE inventory.documents ADD CONSTRAINT documents_purchase_partner_check
    CHECK (type NOT IN ('purchase_receipt', 'purchase_return') OR partner_id IS NOT NULL);
