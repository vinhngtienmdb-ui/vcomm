-- CONG_VIEC_04: mini app Sản phẩm (MODULE_02, phần Sản phẩm), schema `catalog` (tài liệu 12 mục 2, tài liệu 16).
-- Khóa ngoại chỉ trỏ vào `catalog` và `core`.

CREATE SCHEMA IF NOT EXISTS catalog;

-- Ngành hàng dùng chung tập đoàn, tối đa 4 cấp (CHUC_NANG_30; QUYTAC_NGHIEPVU_37).
CREATE TABLE catalog.categories (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       uuid        REFERENCES catalog.categories(id),
    code            text        NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{2,6}$'),   -- tiền tố mã hàng
    name_vi         text        NOT NULL,
    name_en         text        NOT NULL,
    level           smallint    NOT NULL CHECK (level BETWEEN 1 AND 4),
    tracks_lots     boolean     NOT NULL DEFAULT false,     -- lô và hạn dùng
    tracks_serials  boolean     NOT NULL DEFAULT false,     -- serial, IMEI
    warranty_months smallint    NOT NULL DEFAULT 0 CHECK (warranty_months BETWEEN 0 AND 120),
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid        REFERENCES core.users(id),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid        REFERENCES core.users(id),
    version         integer     NOT NULL DEFAULT 1,
    CHECK (NOT (tracks_lots AND tracks_serials))
);
CREATE INDEX categories_parent_idx ON catalog.categories (parent_id);

-- Đơn vị tính dùng chung tập đoàn (cái, hộp, thùng, kg...).
CREATE TABLE catalog.units (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text        NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9_]{1,10}$'),
    name_vi         text        NOT NULL,
    name_en         text        NOT NULL,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1
);

-- Bộ đếm sinh mã hàng theo công ty và tiền tố (QUYTAC_NGHIEPVU_39).
CREATE TABLE catalog.code_counters (
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    prefix          text        NOT NULL,
    next_value      integer     NOT NULL DEFAULT 1,
    PRIMARY KEY (company_id, prefix)
);

-- Sản phẩm của một công ty (CHUC_NANG_31; QUYTAC_NGHIEPVU_38). Cột nhà bán, trạng thái duyệt dùng ở phần Nhà bán.
CREATE TABLE catalog.products (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    seller_id           uuid,                               -- nhà bán sở hữu; NULL: hàng của công ty
    review_status       text        NOT NULL DEFAULT 'approved' CHECK (review_status IN ('draft', 'pending', 'approved', 'rejected')),
    category_id         uuid        NOT NULL REFERENCES catalog.categories(id),
    code                text        NOT NULL,
    name                text        NOT NULL,
    search_text         text        NOT NULL,               -- tên, mã đã bỏ dấu, chữ thường (tìm không dấu)
    description         text,
    brand               text,
    origin              text,
    vat_rate            text        NOT NULL DEFAULT '10' CHECK (vat_rate IN ('0', '5', '8', '10', 'exempt', 'not_declared')),
    tracks_lots         boolean     NOT NULL DEFAULT false,
    tracks_serials      boolean     NOT NULL DEFAULT false,
    warranty_months     smallint    NOT NULL DEFAULT 0 CHECK (warranty_months BETWEEN 0 AND 120),
    base_unit_id        uuid        NOT NULL REFERENCES catalog.units(id),
    weight_kg           numeric(14,4) CHECK (weight_kg >= 0),
    volume_m3           numeric(14,6) CHECK (volume_m3 >= 0),
    options             jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- thuộc tính phân loại: [{name, values[]}], tối đa 3
    specifications      jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- thông số: [{name, value}]
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid        REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid        REFERENCES core.users(id),
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code),
    CHECK (NOT (tracks_lots AND tracks_serials))
);
CREATE INDEX products_company_category_idx ON catalog.products (company_id, category_id);
CREATE INDEX products_company_updated_idx ON catalog.products (company_id, updated_at DESC);

-- Đơn vị quy đổi của sản phẩm so với đơn vị cơ sở (QUYTAC_NGHIEPVU_40).
CREATE TABLE catalog.product_units (
    product_id      uuid        NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    unit_id         uuid        NOT NULL REFERENCES catalog.units(id),
    factor          numeric(18,4) NOT NULL CHECK (factor > 0),
    PRIMARY KEY (product_id, unit_id)
);

-- Biến thể, mỗi biến thể một mã hàng (QUYTAC_NGHIEPVU_39).
CREATE TABLE catalog.variants (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    product_id      uuid        NOT NULL REFERENCES catalog.products(id),
    sku             text        NOT NULL,
    option_values   jsonb       NOT NULL DEFAULT '[]'::jsonb,       -- giá trị theo thứ tự thuộc tính phân loại
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, sku)
);
CREATE INDEX variants_product_idx ON catalog.variants (product_id);

-- Mã vạch theo biến thể và đơn vị, duy nhất trong công ty (QUYTAC_NGHIEPVU_40).
CREATE TABLE catalog.barcodes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id) ON DELETE CASCADE,
    unit_id         uuid        NOT NULL REFERENCES catalog.units(id),
    barcode         text        NOT NULL CHECK (barcode ~ '^[0-9A-Za-z\-\.]{4,40}$'),
    UNIQUE (company_id, barcode)
);
CREATE INDEX barcodes_variant_idx ON catalog.barcodes (variant_id);

-- Ảnh sản phẩm; nội dung lưu S3 hoặc thư mục cục bộ theo khóa lưu trữ.
CREATE TABLE catalog.product_images (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      uuid        NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    file_name       text        NOT NULL,
    content_type    text        NOT NULL,
    size_bytes      integer     NOT NULL CHECK (size_bytes > 0),
    storage_key     text        NOT NULL UNIQUE,
    sort_order      smallint    NOT NULL DEFAULT 0,
    uploaded_by     uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON catalog.product_images (product_id, sort_order);

-- Liên kết biến thể tương ứng giữa hai công ty (QUYTAC_NGHIEPVU_41); lưu một chiều, đọc cả hai chiều.
CREATE TABLE catalog.variant_links (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    variant_id          uuid        NOT NULL REFERENCES catalog.variants(id),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    linked_variant_id   uuid        NOT NULL REFERENCES catalog.variants(id),
    linked_company_id   uuid        NOT NULL REFERENCES core.companies(id),
    factor              numeric(18,4) NOT NULL DEFAULT 1 CHECK (factor > 0),   -- đơn vị cơ sở bên kia trên một đơn vị cơ sở bên này
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid        REFERENCES core.users(id),
    CHECK (company_id <> linked_company_id),
    UNIQUE (variant_id, linked_company_id),
    UNIQUE (linked_variant_id, company_id)
);

-- Kênh bán, nhóm khách hàng của công ty (CHUC_NANG_35).
CREATE TABLE catalog.sales_channels (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    code            text        NOT NULL CHECK (code ~ '^[A-Z0-9_]{1,20}$'),
    name            text        NOT NULL,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);

CREATE TABLE catalog.customer_groups (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    code            text        NOT NULL CHECK (code ~ '^[A-Z0-9_]{1,20}$'),
    name            text        NOT NULL,
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);

-- Bảng giá (CHUC_NANG_36; QUYTAC_NGHIEPVU_42): không có hai bảng giá đang dùng trùng công ty, kênh, nhóm khách, tiền tệ.
CREATE TABLE catalog.price_lists (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    code                text        NOT NULL CHECK (code ~ '^[A-Z0-9_]{1,20}$'),
    name                text        NOT NULL,
    channel_id          uuid        REFERENCES catalog.sales_channels(id),
    customer_group_id   uuid        REFERENCES catalog.customer_groups(id),
    currency            char(3)     NOT NULL REFERENCES core.currencies(code),
    includes_vat        boolean     NOT NULL,
    status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    created_by          uuid        REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid        REFERENCES core.users(id),
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);
CREATE UNIQUE INDEX price_lists_active_unique ON catalog.price_lists (company_id, coalesce(channel_id, '00000000-0000-0000-0000-000000000000'), coalesce(customer_group_id, '00000000-0000-0000-0000-000000000000'), currency) WHERE status = 'active';

-- Phiếu điều chỉnh giá (CHUC_NANG_37; QUYTAC_NGHIEPVU_44).
CREATE TABLE catalog.price_changes (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    price_list_id       uuid        NOT NULL REFERENCES catalog.price_lists(id),
    change_no           text,                               -- cấp khi gửi
    effective_from      date        NOT NULL,
    note                text,
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'withdrawn')),
    approval_request_id uuid        REFERENCES core.approval_requests(id),
    requested_by        uuid        NOT NULL REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    submitted_at        timestamptz,
    completed_at        timestamptz,
    version             integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, change_no)
);
CREATE INDEX price_changes_company_idx ON catalog.price_changes (company_id, created_at DESC);

CREATE TABLE catalog.price_change_lines (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    price_change_id uuid        NOT NULL REFERENCES catalog.price_changes(id) ON DELETE CASCADE,
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    unit_id         uuid        NOT NULL REFERENCES catalog.units(id),
    price           numeric(20,4) NOT NULL CHECK (price >= 0),
    current_price   numeric(20,4),                          -- giá hiện hành lúc lập, để so sánh
    UNIQUE (price_change_id, variant_id, unit_id)
);

-- Lịch sử giá (QUYTAC_NGHIEPVU_43): chỉ thêm, không sửa, không xóa.
CREATE TABLE catalog.prices (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id   uuid        NOT NULL REFERENCES catalog.price_lists(id),
    variant_id      uuid        NOT NULL REFERENCES catalog.variants(id),
    unit_id         uuid        NOT NULL REFERENCES catalog.units(id),
    price           numeric(20,4) NOT NULL CHECK (price >= 0),
    effective_from  date        NOT NULL,
    price_change_id uuid        NOT NULL REFERENCES catalog.price_changes(id),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX prices_lookup_idx ON catalog.prices (price_list_id, variant_id, unit_id, effective_from DESC, created_at DESC);

-- Đơn vị tính có sẵn.
INSERT INTO catalog.units (code, name_vi, name_en) VALUES
    ('CAI', 'Cái', 'Piece'),
    ('CHIEC', 'Chiếc', 'Unit'),
    ('HOP', 'Hộp', 'Box'),
    ('THUNG', 'Thùng', 'Carton'),
    ('GOI', 'Gói', 'Pack'),
    ('CHAI', 'Chai', 'Bottle'),
    ('LON', 'Lon', 'Can'),
    ('BO', 'Bộ', 'Set'),
    ('KG', 'Kilôgam', 'Kilogram'),
    ('G', 'Gam', 'Gram'),
    ('L', 'Lít', 'Litre'),
    ('ML', 'Mililít', 'Millilitre'),
    ('M', 'Mét', 'Metre'),
    ('M2', 'Mét vuông', 'Square metre');
