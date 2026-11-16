-- CONG_VIEC_62 lát L1: kho loại Dropship, sản phẩm dropship, tồn nhà cung cấp khai báo (CHUC_NANG_222; QUYTAC_NGHIEPVU_496 đến 498).

-- Loại kho; kho Dropship không có hàng thật, không dùng vị trí; mỗi công ty tối đa một kho Dropship đang hoạt động (QUYTAC_NGHIEPVU_496).
ALTER TABLE inventory.warehouses ADD COLUMN kind text NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard', 'dropship'));
ALTER TABLE inventory.warehouses ADD CONSTRAINT warehouses_dropship_locations_check CHECK (kind <> 'dropship' OR NOT uses_locations);
CREATE UNIQUE INDEX warehouses_dropship_active_idx ON inventory.warehouses (company_id) WHERE kind = 'dropship' AND status = 'active';

-- Sản phẩm dropship: biến thể – nhà cung cấp – đơn vị mua; tồn khai báo theo đơn vị cơ bản (QUYTAC_NGHIEPVU_497, 498).
CREATE TABLE purchasing.dropship_products (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid          NOT NULL REFERENCES core.companies(id),
    variant_id              uuid          NOT NULL REFERENCES catalog.variants(id),
    supplier_id             uuid          NOT NULL REFERENCES crm.partners(id),
    unit_id                 uuid          NOT NULL REFERENCES catalog.units(id),
    declared_quantity       numeric(20,4) NOT NULL DEFAULT 0 CHECK (declared_quantity >= 0 AND declared_quantity = trunc(declared_quantity)),
    declared_at             timestamptz   NOT NULL DEFAULT now(),
    declared_by             uuid          REFERENCES core.users(id),
    declared_via_api_key_id uuid          REFERENCES core.api_keys(id),
    status                  text          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by              uuid          NOT NULL REFERENCES core.users(id),
    created_at              timestamptz   NOT NULL DEFAULT now(),
    updated_by              uuid          REFERENCES core.users(id),
    updated_at              timestamptz   NOT NULL DEFAULT now(),
    version                 integer       NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX dropship_products_active_idx ON purchasing.dropship_products (company_id, variant_id) WHERE status = 'active';
CREATE INDEX dropship_products_supplier_idx ON purchasing.dropship_products (company_id, supplier_id);

-- Lịch sử đổi tồn khai báo: người hoặc khóa API đổi, nguồn (QUYTAC_NGHIEPVU_498).
CREATE TABLE purchasing.dropship_stock_changes (
    id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    dropship_product_id     uuid          NOT NULL REFERENCES purchasing.dropship_products(id),
    old_quantity            numeric(20,4) NOT NULL,
    new_quantity            numeric(20,4) NOT NULL,
    source                  text          NOT NULL CHECK (source IN ('manual', 'import', 'open_api')),
    changed_by              uuid          REFERENCES core.users(id),
    changed_via_api_key_id  uuid          REFERENCES core.api_keys(id),
    created_at              timestamptz   NOT NULL DEFAULT now(),
    CHECK (changed_by IS NOT NULL OR changed_via_api_key_id IS NOT NULL)
);
CREATE INDEX dropship_stock_changes_product_idx ON purchasing.dropship_stock_changes (dropship_product_id, created_at DESC);
