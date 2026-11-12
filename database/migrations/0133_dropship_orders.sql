-- CONG_VIEC_62 lát L2, L3: đơn mua dropship, lịch sử trạng thái giao, trả hàng dropship, phạm vi khóa API nhà cung cấp
-- (CHUC_NANG_223, 224; QUYTAC_NGHIEPVU_500 đến 505).

-- Đơn mua dropship tự lập từ đơn bán kho Dropship; trạng thái giao do nhà cung cấp hoặc nhân viên báo (QUYTAC_NGHIEPVU_500 đến 502, 504).
ALTER TABLE purchasing.orders
    ADD COLUMN dropship_sales_order_id uuid REFERENCES sales.orders(id),
    ADD COLUMN dropship_status text CHECK (dropship_status IN ('awaiting', 'shipping', 'delivered', 'failed', 'cancelled')),
    ADD COLUMN carrier_name text CHECK (length(carrier_name) BETWEEN 1 AND 100),
    ADD COLUMN tracking_code text CHECK (length(tracking_code) BETWEEN 1 AND 100),
    ADD COLUMN delivered_on date,
    ADD COLUMN dropship_reason text CHECK (length(dropship_reason) BETWEEN 1 AND 500),
    ADD COLUMN supplier_invoice_no text CHECK (length(supplier_invoice_no) BETWEEN 1 AND 50),
    ADD COLUMN supplier_invoice_date date,
    ADD CONSTRAINT orders_dropship_check CHECK ((dropship_sales_order_id IS NULL) = (dropship_status IS NULL));
CREATE INDEX orders_dropship_sales_order_idx ON purchasing.orders (dropship_sales_order_id) WHERE dropship_sales_order_id IS NOT NULL;
CREATE INDEX orders_dropship_status_idx ON purchasing.orders (company_id, dropship_status) WHERE dropship_status IS NOT NULL;

CREATE TABLE purchasing.dropship_events (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                uuid        NOT NULL REFERENCES purchasing.orders(id),
    status                  text        NOT NULL CHECK (status IN ('awaiting', 'shipping', 'delivered', 'failed', 'cancelled')),
    note                    text,
    created_by              uuid        REFERENCES core.users(id),
    created_via_api_key_id  uuid        REFERENCES core.api_keys(id),
    created_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dropship_events_order_idx ON purchasing.dropship_events (order_id, created_at);

-- Trả hàng dropship về nhà cung cấp: ghi sổ phiếu trả hàng bán, trả hàng mua khi nhà cung cấp xác nhận đã nhận (QUYTAC_NGHIEPVU_503).
CREATE TABLE purchasing.dropship_returns (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid          NOT NULL REFERENCES core.companies(id),
    order_id                uuid          NOT NULL REFERENCES purchasing.orders(id),
    issue_id                uuid          NOT NULL,                                     -- phiếu xuất bán gốc (inventory.documents)
    reason                  text          NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
    status                  text          NOT NULL DEFAULT 'awaiting_supplier' CHECK (status IN ('awaiting_supplier', 'received', 'cancelled')),
    sales_return_id         uuid,                                                       -- phiếu trả hàng bán khi đã nhận
    purchase_return_id      uuid,                                                       -- phiếu trả hàng mua khi đã nhận
    created_by              uuid          NOT NULL REFERENCES core.users(id),
    created_at              timestamptz   NOT NULL DEFAULT now(),
    closed_at               timestamptz,
    version                 integer       NOT NULL DEFAULT 1
);
CREATE INDEX dropship_returns_order_idx ON purchasing.dropship_returns (order_id);

CREATE TABLE purchasing.dropship_return_lines (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id               uuid          NOT NULL REFERENCES purchasing.dropship_returns(id) ON DELETE CASCADE,
    issue_line_id           uuid          NOT NULL,                                     -- dòng phiếu xuất gốc
    quantity                numeric(20,4) NOT NULL CHECK (quantity > 0)
);
CREATE INDEX dropship_return_lines_return_idx ON purchasing.dropship_return_lines (return_id);

-- Phạm vi khóa API: mọi giá trị trên main và dropship.supplier (QUYTAC_NGHIEPVU_505).
ALTER TABLE core.api_keys DROP CONSTRAINT api_keys_scopes_check;
ALTER TABLE core.api_keys ADD CONSTRAINT api_keys_scopes_check
    CHECK (cardinality(scopes) >= 1 AND scopes <@ ARRAY['catalog.read', 'sales_order.write', 'customer.write', 'loyalty.member', 'dropship.supplier']::text[]);
