-- CONG_VIEC_07: Mua hàng trong nước (MODULE_04, phần 1), schema `purchasing` (tài liệu 12 mục 2, tài liệu 16).
-- Khóa ngoại từ `purchasing` chỉ trỏ vào `purchasing`, `core`, `catalog`, `crm`.
-- Số đã nhận, đã trả của dòng đơn mua tính từ phiếu kho, không lưu trùng.

CREATE SCHEMA IF NOT EXISTS purchasing;

-- Cài đặt mua hàng theo công ty: dung sai nhận vượt (QUYTAC_NGHIEPVU_64).
CREATE TABLE purchasing.settings (
    company_id                      uuid        PRIMARY KEY REFERENCES core.companies(id),
    over_receipt_tolerance_percent  numeric(5,2) NOT NULL DEFAULT 0 CHECK (over_receipt_tolerance_percent BETWEEN 0 AND 100),
    updated_by                      uuid        REFERENCES core.users(id),
    updated_at                      timestamptz NOT NULL DEFAULT now(),
    version                         integer     NOT NULL DEFAULT 1
);

-- Bảng giá mua theo nhà cung cấp (CHUC_NANG_49; QUYTAC_NGHIEPVU_61). Chồng hiệu lực kiểm trong service khi khóa dòng nhà cung cấp.
CREATE TABLE purchasing.supplier_prices (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    supplier_id     uuid        NOT NULL REFERENCES crm.partners(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    unit_id         uuid        NOT NULL REFERENCES catalog.units(id),
    min_quantity    numeric(20,4) NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
    unit_price      numeric(20,4) NOT NULL CHECK (unit_price >= 0),     -- chưa gồm thuế giá trị gia tăng, tiền tệ công ty
    supplier_sku    text,                                               -- mã hàng phía nhà cung cấp
    valid_from      date        NOT NULL,
    valid_to        date,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX supplier_prices_lookup_idx ON purchasing.supplier_prices (company_id, supplier_id, variant_id, unit_id);
CREATE INDEX supplier_prices_variant_idx ON purchasing.supplier_prices (company_id, variant_id);

-- Đề nghị mua (CHUC_NANG_50; QUYTAC_NGHIEPVU_62).
CREATE TABLE purchasing.requisitions (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    document_no             text,                                                   -- cấp khi gửi
    warehouse_id            uuid        NOT NULL,                                   -- kho nhận (inventory.warehouses, kiểm trong service)
    needed_by               date        NOT NULL,
    reason                  text        NOT NULL,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'closed')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    submitted_at            timestamptz,
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no)
);
CREATE INDEX requisitions_company_idx ON purchasing.requisitions (company_id, created_at DESC);
CREATE INDEX requisitions_approval_idx ON purchasing.requisitions (approval_request_id);

CREATE TABLE purchasing.requisition_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id          uuid        NOT NULL REFERENCES purchasing.requisitions(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    variant_id              uuid        NOT NULL REFERENCES catalog.variants(id),
    unit_id                 uuid        NOT NULL REFERENCES catalog.units(id),
    quantity                numeric(20,4) NOT NULL CHECK (quantity > 0),
    base_quantity           numeric(20,4) NOT NULL CHECK (base_quantity > 0),
    estimated_unit_price    numeric(20,4) NOT NULL DEFAULT 0 CHECK (estimated_unit_price >= 0),
    suggested_supplier_id   uuid        REFERENCES crm.partners(id),
    note                    text,
    UNIQUE (requisition_id, line_no)
);

-- Đơn mua (CHUC_NANG_51; QUYTAC_NGHIEPVU_63, 64).
CREATE TABLE purchasing.orders (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    document_no             text,                                                   -- cấp khi gửi lần đầu
    supplier_id             uuid        NOT NULL REFERENCES crm.partners(id),
    warehouse_id            uuid        NOT NULL,                                   -- kho nhận (inventory.warehouses, kiểm trong service)
    order_date              date        NOT NULL,
    expected_date           date,
    currency                char(3)     NOT NULL REFERENCES core.currencies(code),
    note                    text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn', 'received', 'closed')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    approved_total          numeric(20,4),                                          -- tổng chưa thuế lần duyệt gần nhất (so khi sửa)
    approved_supplier_id    uuid        REFERENCES crm.partners(id),
    total_amount            numeric(20,4) NOT NULL DEFAULT 0,                       -- chưa gồm thuế giá trị gia tăng
    tax_amount              numeric(20,4) NOT NULL DEFAULT 0,
    closed_reason           text,
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    submitted_at            timestamptz,
    closed_at               timestamptz,
    closed_by               uuid        REFERENCES core.users(id),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no)
);
CREATE INDEX orders_company_idx ON purchasing.orders (company_id, created_at DESC);
CREATE INDEX orders_supplier_idx ON purchasing.orders (company_id, supplier_id);
CREATE INDEX orders_approval_idx ON purchasing.orders (approval_request_id);

CREATE TABLE purchasing.order_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                uuid        NOT NULL REFERENCES purchasing.orders(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    variant_id              uuid        NOT NULL REFERENCES catalog.variants(id),
    unit_id                 uuid        NOT NULL REFERENCES catalog.units(id),
    quantity                numeric(20,4) NOT NULL CHECK (quantity > 0),
    base_quantity           numeric(20,4) NOT NULL CHECK (base_quantity > 0),
    unit_price              numeric(20,4) NOT NULL CHECK (unit_price >= 0),         -- chưa gồm thuế, theo đơn vị của dòng
    vat_rate                text        NOT NULL CHECK (vat_rate IN ('0', '5', '8', '10', 'exempt', 'not_declared')),
    amount                  numeric(20,4) NOT NULL,
    requisition_line_id     uuid        REFERENCES purchasing.requisition_lines(id),
    UNIQUE (order_id, line_no)
);
CREATE INDEX order_lines_requisition_idx ON purchasing.order_lines (requisition_line_id);

-- Ngành hàng cần kiểm tra chất lượng khi nhập mua (QUYTAC_NGHIEPVU_65).
ALTER TABLE catalog.categories ADD COLUMN requires_quality_check boolean NOT NULL DEFAULT false;

-- Phiếu nhập mua, phiếu trả hàng nhà cung cấp do module Kho ghi (CHUC_NANG_52, 53).
ALTER TABLE inventory.documents DROP CONSTRAINT documents_type_check;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_type_check CHECK (type IN ('receipt_other', 'issue_other', 'adjustment', 'transfer', 'purchase_receipt', 'purchase_return'));
ALTER TABLE inventory.documents DROP CONSTRAINT documents_status_check;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_status_check CHECK (status IN ('draft', 'pending', 'quality_check', 'posted', 'in_transit', 'received', 'rejected', 'withdrawn'));
ALTER TABLE inventory.documents DROP CONSTRAINT documents_reason_code_check;
ALTER TABLE inventory.documents ADD CONSTRAINT documents_reason_code_check CHECK (reason_code IN ('internal_use', 'gift', 'damaged', 'expired_disposal', 'opening_balance', 'found', 'stocktake', 'transfer', 'purchase', 'purchase_return', 'other'));
ALTER TABLE inventory.documents ADD COLUMN partner_id uuid;                          -- nhà cung cấp (crm.partners), phiếu nhập mua, trả hàng
ALTER TABLE inventory.documents ADD COLUMN quality_checked_at timestamptz;
ALTER TABLE inventory.documents ADD COLUMN quality_checked_by uuid REFERENCES core.users(id);
ALTER TABLE inventory.documents ADD CONSTRAINT documents_purchase_source_check
    CHECK (type NOT IN ('purchase_receipt', 'purchase_return') OR (source_id IS NOT NULL AND partner_id IS NOT NULL));
CREATE INDEX documents_source_idx ON inventory.documents (source_type, source_id);

ALTER TABLE inventory.document_lines ADD COLUMN source_line_id uuid;                 -- dòng đơn mua (nhập mua) hoặc dòng phiếu nhập gốc (trả hàng)
ALTER TABLE inventory.document_lines ADD COLUMN rejected_base_quantity numeric(20,4) CHECK (rejected_base_quantity >= 0);   -- không đạt kiểm tra chất lượng
ALTER TABLE inventory.document_lines ADD COLUMN rejection_reason text;
CREATE INDEX document_lines_source_line_idx ON inventory.document_lines (source_line_id);
