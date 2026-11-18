-- CONG_VIEC_74 L2: iPOS – danh mục hàng, tồn kho theo điểm bán (QUYTAC_NGHIEPVU_608, 610, 611; tài liệu 16).
-- Dữ liệu của từng cửa hàng liên kết tách theo `merchant_id`; khóa ngoại chỉ trỏ vào `core`, `affiliate`, `ipos`.

-- Bộ đếm số tự sinh theo cửa hàng: mã mặt hàng `SP…`, phiếu nhập `PN…`, phiếu điều chỉnh `PC…`.
CREATE TABLE ipos.number_counters (
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    kind            text        NOT NULL CHECK (kind IN ('item', 'receipt', 'adjustment')),
    last_number     integer     NOT NULL DEFAULT 0 CHECK (last_number >= 0),
    PRIMARY KEY (merchant_id, kind)
);

-- Nhóm hàng hai cấp, thứ tự hiện trên máy bán (QUYTAC_NGHIEPVU_608 khoản 1).
CREATE TABLE ipos.categories (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    parent_id       uuid        REFERENCES ipos.categories(id),
    name            text        NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    sort_order      integer     NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 9999),
    status          text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    version         integer     NOT NULL DEFAULT 1,
    CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX categories_name_idx ON ipos.categories (merchant_id, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Mặt hàng (QUYTAC_NGHIEPVU_608 khoản 2, 6). Giá đã gồm thuế, đồng.
CREATE TABLE ipos.items (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid          NOT NULL REFERENCES affiliate.merchants(id),
    code            text          NOT NULL CHECK (length(code) BETWEEN 1 AND 30),
    name            text          NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    search_text     text          NOT NULL,
    category_id     uuid          REFERENCES ipos.categories(id),
    unit            text          NOT NULL CHECK (length(unit) BETWEEN 1 AND 20),
    price           numeric(15,0) NOT NULL CHECK (price >= 0),
    vat_rate        text          NOT NULL CHECK (vat_rate IN ('0', '5', '8', '10', 'exempt')),
    track_stock     boolean       NOT NULL DEFAULT true,
    attribute1_name text          CHECK (attribute1_name IS NULL OR length(attribute1_name) BETWEEN 1 AND 30),
    attribute2_name text          CHECK (attribute2_name IS NULL OR length(attribute2_name) BETWEEN 1 AND 30),
    status          text          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    updated_by      uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    version         integer       NOT NULL DEFAULT 1,
    CHECK (attribute2_name IS NULL OR attribute1_name IS NOT NULL)
);
CREATE UNIQUE INDEX items_code_idx ON ipos.items (merchant_id, upper(code));
CREATE INDEX items_merchant_idx ON ipos.items (merchant_id, status, updated_at);

-- Biến thể (khoản 3): mặt hàng không có thuộc tính có đúng một biến thể mặc định cùng mã mặt hàng; giá trống thì lấy giá mặt hàng.
CREATE TABLE ipos.item_variants (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid          NOT NULL REFERENCES affiliate.merchants(id),
    item_id         uuid          NOT NULL REFERENCES ipos.items(id),
    code            text          NOT NULL CHECK (length(code) BETWEEN 1 AND 30),
    attribute1_value text         CHECK (attribute1_value IS NULL OR length(attribute1_value) BETWEEN 1 AND 50),
    attribute2_value text         CHECK (attribute2_value IS NULL OR length(attribute2_value) BETWEEN 1 AND 50),
    price           numeric(15,0) CHECK (price IS NULL OR price >= 0),
    min_quantity    numeric(15,3) CHECK (min_quantity IS NULL OR min_quantity >= 0),
    status          text          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    sort_order      integer       NOT NULL DEFAULT 0,
    updated_at      timestamptz   NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX item_variants_code_idx ON ipos.item_variants (item_id, upper(code));
CREATE INDEX item_variants_merchant_idx ON ipos.item_variants (merchant_id, status);

-- Mã vạch (khoản 4): duy nhất trong cửa hàng, cửa hàng khác trùng được.
CREATE TABLE ipos.item_barcodes (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    variant_id      uuid        NOT NULL REFERENCES ipos.item_variants(id),
    barcode         text        NOT NULL CHECK (length(barcode) BETWEEN 1 AND 50),
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX item_barcodes_barcode_idx ON ipos.item_barcodes (merchant_id, barcode);
CREATE INDEX item_barcodes_variant_idx ON ipos.item_barcodes (variant_id);

-- Giá riêng theo điểm bán, ghi đè giá bán (khoản 5).
CREATE TABLE ipos.outlet_prices (
    outlet_id       uuid          NOT NULL REFERENCES affiliate.outlets(id),
    variant_id      uuid          NOT NULL REFERENCES ipos.item_variants(id),
    merchant_id     uuid          NOT NULL REFERENCES affiliate.merchants(id),
    price           numeric(15,0) NOT NULL CHECK (price >= 0),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (outlet_id, variant_id)
);
CREATE TRIGGER outlet_prices_outlet_merchant BEFORE INSERT OR UPDATE OF outlet_id, merchant_id ON ipos.outlet_prices
    FOR EACH ROW EXECUTE FUNCTION ipos.check_outlet_merchant();

-- Tồn theo (điểm bán, biến thể), giá vốn bình quân gia quyền (QUYTAC_NGHIEPVU_611 khoản 1, 3). Cho phép tồn âm.
CREATE TABLE ipos.stock_balances (
    outlet_id       uuid          NOT NULL REFERENCES affiliate.outlets(id),
    variant_id      uuid          NOT NULL REFERENCES ipos.item_variants(id),
    merchant_id     uuid          NOT NULL REFERENCES affiliate.merchants(id),
    quantity        numeric(15,3) NOT NULL DEFAULT 0,
    average_cost    numeric(18,4) NOT NULL DEFAULT 0 CHECK (average_cost >= 0),
    updated_at      timestamptz   NOT NULL DEFAULT now(),
    PRIMARY KEY (outlet_id, variant_id)
);
CREATE INDEX stock_balances_merchant_idx ON ipos.stock_balances (merchant_id, outlet_id);
CREATE TRIGGER stock_balances_outlet_merchant BEFORE INSERT OR UPDATE OF outlet_id, merchant_id ON ipos.stock_balances
    FOR EACH ROW EXECUTE FUNCTION ipos.check_outlet_merchant();

-- Phiếu tồn: nhập `PN…`, điều chỉnh `PC…`; ghi xong không sửa.
CREATE TABLE ipos.stock_documents (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid        NOT NULL REFERENCES affiliate.merchants(id),
    outlet_id       uuid        NOT NULL REFERENCES affiliate.outlets(id),
    number          text        NOT NULL,
    kind            text        NOT NULL CHECK (kind IN ('receipt', 'adjustment')),
    source          text        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
    note            text        CHECK (note IS NULL OR length(note) BETWEEN 1 AND 500),
    created_by      uuid        NOT NULL REFERENCES core.users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    CHECK (number ~ '^P[NC][0-9]{6,}$'),
    CHECK (kind = 'receipt' OR note IS NOT NULL)
);
CREATE UNIQUE INDEX stock_documents_number_idx ON ipos.stock_documents (merchant_id, number);
CREATE INDEX stock_documents_outlet_idx ON ipos.stock_documents (outlet_id, created_at DESC);
CREATE TRIGGER stock_documents_outlet_merchant BEFORE INSERT OR UPDATE OF outlet_id, merchant_id ON ipos.stock_documents
    FOR EACH ROW EXECUTE FUNCTION ipos.check_outlet_merchant();

-- Dòng phiếu: nhập có số lượng, giá nhập; điều chỉnh có số lượng thực tế (ghi kèm tồn trước khi điều chỉnh).
CREATE TABLE ipos.stock_document_lines (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     uuid          NOT NULL REFERENCES ipos.stock_documents(id),
    variant_id      uuid          NOT NULL REFERENCES ipos.item_variants(id),
    quantity        numeric(15,3),
    unit_cost       numeric(18,4) CHECK (unit_cost IS NULL OR unit_cost >= 0),
    actual_quantity numeric(15,3) CHECK (actual_quantity IS NULL OR actual_quantity >= 0),
    before_quantity numeric(15,3) NOT NULL,
    UNIQUE (document_id, variant_id),
    CHECK ((quantity IS NOT NULL AND quantity > 0 AND unit_cost IS NOT NULL AND actual_quantity IS NULL)
        OR (quantity IS NULL AND unit_cost IS NULL AND actual_quantity IS NOT NULL))
);

-- Biến động tồn gắn nguồn: phiếu tồn (L2), hóa đơn bán, phiếu trả (L3).
CREATE TABLE ipos.stock_moves (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     uuid          NOT NULL REFERENCES affiliate.merchants(id),
    outlet_id       uuid          NOT NULL REFERENCES affiliate.outlets(id),
    variant_id      uuid          NOT NULL REFERENCES ipos.item_variants(id),
    quantity        numeric(15,3) NOT NULL CHECK (quantity <> 0),
    unit_cost       numeric(18,4) NOT NULL CHECK (unit_cost >= 0),
    balance_after   numeric(15,3) NOT NULL,
    source_type     text          NOT NULL CHECK (source_type IN ('stock_document', 'sale', 'return')),
    source_id       uuid          NOT NULL,
    source_number   text          NOT NULL,
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    occurred_at     timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX stock_moves_outlet_idx ON ipos.stock_moves (outlet_id, occurred_at DESC);
CREATE INDEX stock_moves_variant_idx ON ipos.stock_moves (variant_id, occurred_at DESC);
CREATE INDEX stock_moves_source_idx ON ipos.stock_moves (source_type, source_id);
