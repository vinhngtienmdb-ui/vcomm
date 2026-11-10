-- CONG_VIEC_09: Giao dịch nội bộ giữa công ty con (MODULE_05, phần 2; tài liệu 16).
-- Đơn bán và đơn mua đối ứng trỏ nhau bằng mã, không khóa ngoại khác schema (kiểm trong service).
-- Phiếu nhập mua nội bộ sinh khi bên bán ghi sổ phiếu xuất giao hàng, chờ bên mua nhận (trạng thái in_transit).

-- Đơn bán: trạng thái chờ bên bán xác nhận đơn đối ứng; kho xuất chọn khi xác nhận, đơn đối ứng bị từ chối trước khi chọn kho không có kho (QUYTAC_NGHIEPVU_74).
ALTER TABLE sales.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE sales.orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('counterpart_pending', 'draft', 'pending', 'confirmed', 'rejected', 'withdrawn', 'delivered', 'cancelled', 'closed'));
ALTER TABLE sales.orders ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE sales.orders ADD CONSTRAINT orders_warehouse_check CHECK (warehouse_id IS NOT NULL OR status IN ('counterpart_pending', 'cancelled', 'closed'));
ALTER TABLE sales.orders ADD COLUMN counterpart_order_id uuid;                          -- đơn mua đối ứng ở công ty mua
ALTER TABLE sales.orders ADD COLUMN is_counterpart boolean NOT NULL DEFAULT false;     -- đơn sinh từ đơn mua của công ty mua
ALTER TABLE sales.orders ADD COLUMN counterpart_rejected_reason text;
CREATE INDEX sales_orders_counterpart_idx ON sales.orders (counterpart_order_id);

-- Đơn mua: như trên, kho nhận chọn khi xác nhận.
ALTER TABLE purchasing.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE purchasing.orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('counterpart_pending', 'draft', 'pending', 'approved', 'rejected', 'withdrawn', 'received', 'closed'));
ALTER TABLE purchasing.orders ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE purchasing.orders ADD CONSTRAINT orders_warehouse_check CHECK (warehouse_id IS NOT NULL OR status IN ('counterpart_pending', 'cancelled', 'closed'));
ALTER TABLE purchasing.orders ADD COLUMN counterpart_order_id uuid;                     -- đơn bán đối ứng ở công ty bán
ALTER TABLE purchasing.orders ADD COLUMN is_counterpart boolean NOT NULL DEFAULT false; -- đơn sinh từ đơn bán của công ty bán
ALTER TABLE purchasing.orders ADD COLUMN counterpart_rejected_reason text;
CREATE INDEX purchasing_orders_counterpart_idx ON purchasing.orders (counterpart_order_id);

-- Phiếu nhập mua nội bộ trỏ phiếu xuất giao hàng gốc bên bán; dòng nhập trỏ dòng xuất (QUYTAC_NGHIEPVU_76).
ALTER TABLE inventory.documents ADD COLUMN counterpart_document_id uuid REFERENCES inventory.documents(id);
ALTER TABLE inventory.document_lines ADD COLUMN counterpart_line_id uuid REFERENCES inventory.document_lines(id);
CREATE INDEX documents_counterpart_idx ON inventory.documents (counterpart_document_id);

-- Biên bản chênh lệch giao nhận nội bộ thuộc công ty bán (QUYTAC_NGHIEPVU_77).
CREATE TABLE inventory.internal_discrepancies (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),        -- công ty bán
    warehouse_id            uuid        NOT NULL REFERENCES inventory.warehouses(id),  -- kho xuất
    issue_document_id       uuid        NOT NULL REFERENCES inventory.documents(id),
    issue_line_id           uuid        NOT NULL REFERENCES inventory.document_lines(id),
    receipt_document_id     uuid        NOT NULL REFERENCES inventory.documents(id),
    receipt_line_id         uuid        REFERENCES inventory.document_lines(id),        -- dòng nhập; trống khi không nhận được gì của dòng xuất
    variant_id              uuid        NOT NULL REFERENCES catalog.variants(id),      -- mặt hàng bên bán
    shortage_base_quantity  numeric(20,4) NOT NULL CHECK (shortage_base_quantity > 0), -- đơn vị cơ sở bên bán
    value                   numeric(20,4) NOT NULL,                                     -- theo giá vốn phiếu xuất
    serials                 text[]      NOT NULL DEFAULT '{}',                          -- serial đã xuất chưa nhận
    reason                  text        NOT NULL,                                       -- lý do của bên nhận
    status                  text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'returned', 'written_off')),
    return_document_id      uuid        REFERENCES inventory.documents(id),             -- phiếu nhận hàng trả lại khi nhập lại kho
    resolution_note         text,
    resolved_by             uuid        REFERENCES core.users(id),
    resolved_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (receipt_document_id, issue_line_id)
);
CREATE INDEX internal_discrepancies_company_idx ON inventory.internal_discrepancies (company_id, status, created_at DESC);
