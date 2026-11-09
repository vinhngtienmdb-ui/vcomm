-- CONG_VIEC_05: mini app Kho (MODULE_03), schema `inventory` (tài liệu 12 mục 2, tài liệu 16).
-- Khóa ngoại chỉ trỏ vào `inventory`, `catalog` và `core`. Số lượng theo đơn vị cơ sở của sản phẩm.

CREATE SCHEMA IF NOT EXISTS inventory;

-- Cài đặt kho theo công ty (QUYTAC_NGHIEPVU_54).
CREATE TABLE inventory.settings (
    company_id          uuid        PRIMARY KEY REFERENCES core.companies(id),
    reservation_hours   integer     NOT NULL DEFAULT 72 CHECK (reservation_hours BETWEEN 1 AND 720),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid        REFERENCES core.users(id),
    version             integer     NOT NULL DEFAULT 1
);

-- Kho thuộc chi nhánh của công ty sở hữu kho (CHUC_NANG_38; QUYTAC_NGHIEPVU_45).
CREATE TABLE inventory.warehouses (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    branch_id       uuid        NOT NULL REFERENCES core.branches(id),
    code            text        NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,20}$'),
    name            text        NOT NULL,
    address         text,
    uses_locations  boolean     NOT NULL DEFAULT false,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid        REFERENCES core.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid        REFERENCES core.users(id),
    version         integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);
CREATE INDEX warehouses_branch_idx ON inventory.warehouses (branch_id);

-- Công ty chủ hàng được gửi hàng vào kho (QUYTAC_NGHIEPVU_45, 46).
CREATE TABLE inventory.warehouse_owners (
    warehouse_id    uuid        NOT NULL REFERENCES inventory.warehouses(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    PRIMARY KEY (warehouse_id, company_id)
);
CREATE INDEX warehouse_owners_company_idx ON inventory.warehouse_owners (company_id);

CREATE TABLE inventory.locations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id    uuid        NOT NULL REFERENCES inventory.warehouses(id),
    code            text        NOT NULL CHECK (code ~ '^[A-Z0-9_.-]{1,30}$'),
    name            text,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    UNIQUE (warehouse_id, code)
);

-- Lô của công ty chủ hàng (QUYTAC_NGHIEPVU_47).
CREATE TABLE inventory.lots (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    lot_no          text        NOT NULL,
    manufactured_on date,
    expires_on      date,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, variant_id, lot_no)
);

-- Serial: duy nhất trong công ty chủ hàng, ở một nơi tại một thời điểm.
CREATE TABLE inventory.serials (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    serial_no       text        NOT NULL,
    warehouse_id    uuid        REFERENCES inventory.warehouses(id),
    location_id     uuid        REFERENCES inventory.locations(id),
    status          text        NOT NULL CHECK (status IN ('in_stock', 'in_transit', 'issued')),
    unit_cost       numeric(20,4) NOT NULL DEFAULT 0,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, serial_no)
);
CREATE INDEX serials_stock_idx ON inventory.serials (warehouse_id, company_id, variant_id) WHERE status = 'in_stock';

-- Tồn theo kho, chủ hàng, biến thể, lô, vị trí; không âm (QUYTAC_NGHIEPVU_47).
CREATE TABLE inventory.balances (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id    uuid        NOT NULL REFERENCES inventory.warehouses(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    lot_id          uuid        REFERENCES inventory.lots(id),
    location_id     uuid        REFERENCES inventory.locations(id),
    quantity        numeric(20,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX balances_key ON inventory.balances (warehouse_id, company_id, variant_id, coalesce(lot_id, '00000000-0000-0000-0000-000000000000'), coalesce(location_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX balances_company_idx ON inventory.balances (company_id, variant_id);

-- Giá vốn bình quân gia quyền di động theo kho, chủ hàng, biến thể (QUYTAC_NGHIEPVU_48).
CREATE TABLE inventory.costs (
    warehouse_id    uuid        NOT NULL REFERENCES inventory.warehouses(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    quantity        numeric(20,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    value           numeric(20,4) NOT NULL DEFAULT 0,
    average_cost    numeric(20,4) NOT NULL DEFAULT 0,
    method          text        NOT NULL DEFAULT 'moving_average',     -- chừa chỗ cho phương pháp khác
    updated_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (warehouse_id, company_id, variant_id)
);

-- Phiếu kho thuộc công ty chủ hàng (QUYTAC_NGHIEPVU_46, 50, 52).
CREATE TABLE inventory.documents (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),   -- công ty chủ hàng
    warehouse_id            uuid        NOT NULL REFERENCES inventory.warehouses(id),
    destination_warehouse_id uuid       REFERENCES inventory.warehouses(id),      -- kho đích (chuyển kho)
    type                    text        NOT NULL CHECK (type IN ('receipt_other', 'issue_other', 'adjustment', 'transfer')),
    document_no             text,                                                 -- cấp khi gửi
    document_date           date        NOT NULL,
    reason_code             text        NOT NULL DEFAULT 'other' CHECK (reason_code IN ('internal_use', 'gift', 'damaged', 'expired_disposal', 'opening_balance', 'found', 'stocktake', 'transfer', 'other')),
    reason                  text        NOT NULL,
    note                    text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'posted', 'in_transit', 'received', 'rejected', 'withdrawn')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    source_type             text,                                                 -- NULL: không có chứng từ gốc
    source_id               uuid,
    stocktake_id            uuid,
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    submitted_at            timestamptz,
    posted_at               timestamptz,
    shipped_at              timestamptz,
    shipped_by              uuid        REFERENCES core.users(id),
    received_at             timestamptz,
    received_by             uuid        REFERENCES core.users(id),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no),
    CHECK ((type = 'transfer') = (destination_warehouse_id IS NOT NULL))
);
CREATE INDEX documents_company_idx ON inventory.documents (company_id, created_at DESC);
CREATE INDEX documents_warehouse_idx ON inventory.documents (warehouse_id, created_at DESC);
CREATE INDEX documents_approval_idx ON inventory.documents (approval_request_id);

CREATE TABLE inventory.document_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id             uuid        NOT NULL REFERENCES inventory.documents(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    variant_id              uuid        NOT NULL REFERENCES catalog.variants(id),
    unit_id                 uuid        NOT NULL REFERENCES catalog.units(id),
    quantity                numeric(20,4) NOT NULL CHECK (quantity <> 0),       -- âm chỉ ở phiếu điều chỉnh
    base_quantity           numeric(20,4) NOT NULL,
    unit_cost               numeric(20,4),                                       -- đơn giá nhập theo đơn vị của dòng
    cost_value              numeric(20,4),                                       -- giá trị đã ghi sổ
    lot_id                  uuid        REFERENCES inventory.lots(id),
    lot_no                  text,
    manufactured_on         date,
    expires_on              date,
    lot_override_reason     text,
    location_id             uuid        REFERENCES inventory.locations(id),
    destination_location_id uuid        REFERENCES inventory.locations(id),
    received_base_quantity  numeric(20,4),
    responsible_user_id     uuid        REFERENCES core.users(id),
    compensation_amount     numeric(20,4),
    UNIQUE (document_id, line_no)
);

CREATE TABLE inventory.document_line_serials (
    line_id         uuid        NOT NULL REFERENCES inventory.document_lines(id) ON DELETE CASCADE,
    serial_no       text        NOT NULL,
    serial_id       uuid        REFERENCES inventory.serials(id),
    PRIMARY KEY (line_id, serial_no)
);

-- Thẻ kho: chỉ thêm, không sửa, không xóa (QUYTAC_NGHIEPVU_49).
CREATE TABLE inventory.movements (
    id              bigserial   PRIMARY KEY,
    warehouse_id    uuid        NOT NULL REFERENCES inventory.warehouses(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    lot_id          uuid        REFERENCES inventory.lots(id),
    location_id     uuid        REFERENCES inventory.locations(id),
    serial_id       uuid        REFERENCES inventory.serials(id),
    quantity        numeric(20,4) NOT NULL,
    unit_cost       numeric(20,4) NOT NULL,
    value           numeric(20,4) NOT NULL,
    balance_after   numeric(20,4) NOT NULL,           -- tồn của biến thể tại kho cho chủ hàng sau biến động
    document_id     uuid        NOT NULL REFERENCES inventory.documents(id),
    line_id         uuid        REFERENCES inventory.document_lines(id),
    moved_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX movements_card_idx ON inventory.movements (warehouse_id, company_id, variant_id, id);
CREATE INDEX movements_document_idx ON inventory.movements (document_id);

CREATE FUNCTION inventory.reject_movement_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'inventory.movements chỉ thêm, không sửa, không xóa';
END $$;
CREATE TRIGGER movements_append_only BEFORE UPDATE OR DELETE ON inventory.movements FOR EACH ROW EXECUTE FUNCTION inventory.reject_movement_change();

-- Biên bản chênh lệch chuyển kho (QUYTAC_NGHIEPVU_52).
CREATE TABLE inventory.transfer_discrepancies (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid        NOT NULL REFERENCES inventory.documents(id),
    line_id         uuid        NOT NULL REFERENCES inventory.document_lines(id),
    shipped_quantity  numeric(20,4) NOT NULL,
    received_quantity numeric(20,4) NOT NULL,
    difference      numeric(20,4) NOT NULL,
    value           numeric(20,4) NOT NULL,
    note            text,
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Kiểm kê (QUYTAC_NGHIEPVU_53).
CREATE TABLE inventory.stocktakes (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    warehouse_id            uuid        NOT NULL REFERENCES inventory.warehouses(id),
    stocktake_no            text,
    scope_type              text        NOT NULL CHECK (scope_type IN ('full', 'categories', 'locations', 'variants')),
    scope_ids               uuid[]      NOT NULL DEFAULT '{}',
    note                    text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'counting', 'finished', 'cancelled')),
    adjustment_document_id  uuid        REFERENCES inventory.documents(id),
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    started_at              timestamptz,
    finished_at             timestamptz,
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, stocktake_no)
);
ALTER TABLE inventory.documents ADD FOREIGN KEY (stocktake_id) REFERENCES inventory.stocktakes(id);

CREATE TABLE inventory.stocktake_lines (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    stocktake_id        uuid        NOT NULL REFERENCES inventory.stocktakes(id) ON DELETE CASCADE,
    variant_id          uuid        NOT NULL REFERENCES catalog.variants(id),
    lot_id              uuid        REFERENCES inventory.lots(id),
    location_id         uuid        REFERENCES inventory.locations(id),
    system_quantity     numeric(20,4) NOT NULL,
    counted_quantity    numeric(20,4) CHECK (counted_quantity >= 0),
    counted_serials     text[],                             -- hàng theo dõi serial: serial đếm được
    unit_cost           numeric(20,4) NOT NULL DEFAULT 0,
    responsible_user_id uuid        REFERENCES core.users(id),
    compensation_amount numeric(20,4)
);
CREATE INDEX stocktake_lines_lock_idx ON inventory.stocktake_lines (variant_id, location_id);

-- Giữ hàng (QUYTAC_NGHIEPVU_54).
CREATE TABLE inventory.reservations (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id    uuid        NOT NULL REFERENCES inventory.warehouses(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    quantity        numeric(20,4) NOT NULL CHECK (quantity > 0),
    source_type     text        NOT NULL,           -- 'inventory.document', 'sales.order'...
    source_id       uuid        NOT NULL,
    source_no       text,
    expires_at      timestamptz,                    -- NULL: giữ đến khi nguồn kết thúc
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'consumed')),
    created_by      uuid        REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    released_at     timestamptz,
    version         integer     NOT NULL DEFAULT 1
);
CREATE INDEX reservations_active_idx ON inventory.reservations (warehouse_id, company_id, variant_id) WHERE status = 'active';
CREATE INDEX reservations_source_idx ON inventory.reservations (source_type, source_id);
CREATE INDEX reservations_expiry_idx ON inventory.reservations (expires_at) WHERE status = 'active';

-- Tồn an toàn (QUYTAC_NGHIEPVU_55).
CREATE TABLE inventory.stock_levels (
    warehouse_id    uuid        NOT NULL REFERENCES inventory.warehouses(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    minimum         numeric(20,4) NOT NULL CHECK (minimum >= 0),
    maximum         numeric(20,4) NOT NULL,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid        REFERENCES core.users(id),
    PRIMARY KEY (warehouse_id, company_id, variant_id),
    CHECK (maximum >= minimum)
);
