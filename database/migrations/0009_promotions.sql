-- CONG_VIEC_12: Khuyến mãi (MODULE_05, phần 3; tài liệu 16).
-- Đã dùng của chương trình tính từ dòng đơn bán, không lưu trùng.

-- Chương trình khuyến mãi (CHUC_NANG_62; QUYTAC_NGHIEPVU_79, 80).
CREATE TABLE sales.promotions (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    document_no             text,                                                   -- cấp khi gửi lần đầu
    name                    text        NOT NULL,
    kind                    text        NOT NULL CHECK (kind IN ('product_discount', 'order_discount', 'buy_get')),
    valid_from              date        NOT NULL,
    valid_to                date        NOT NULL,
    -- Giảm theo đơn: ngưỡng tổng đơn gồm thuế, phần trăm giảm, mức giảm tối đa (trống: không giới hạn).
    min_order_amount        numeric(20,4) CHECK (min_order_amount >= 0),
    order_discount_percent  numeric(5,2) CHECK (order_discount_percent > 0 AND order_discount_percent <= 100),
    max_order_discount      numeric(20,4) CHECK (max_order_discount > 0),
    -- Mua X tặng Y: số lượng theo đơn vị cơ sở.
    buy_variant_id          uuid        REFERENCES catalog.variants(id),
    buy_quantity            numeric(20,4) CHECK (buy_quantity > 0),
    gift_variant_id         uuid        REFERENCES catalog.variants(id),
    gift_quantity           numeric(20,4) CHECK (gift_quantity > 0),
    -- Giới hạn (trống: không giới hạn): tổng tiền giảm gồm thuế, tổng số suất tặng.
    budget_amount           numeric(20,4) CHECK (budget_amount > 0),
    max_gift_sets           integer     CHECK (max_gift_sets > 0),
    note                    text,
    status                  text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'rejected', 'withdrawn', 'stopped')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    stopped_reason          text,
    stopped_at              timestamptz,
    stopped_by              uuid        REFERENCES core.users(id),
    created_by              uuid        NOT NULL REFERENCES core.users(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, document_no),
    CHECK (valid_to >= valid_from),
    CHECK (kind <> 'order_discount' OR (min_order_amount IS NOT NULL AND order_discount_percent IS NOT NULL)),
    CHECK (kind <> 'buy_get' OR (buy_variant_id IS NOT NULL AND buy_quantity IS NOT NULL AND gift_variant_id IS NOT NULL AND gift_quantity IS NOT NULL))
);
CREATE INDEX sales_promotions_company_idx ON sales.promotions (company_id, status, valid_from, valid_to);
CREATE INDEX sales_promotions_approval_idx ON sales.promotions (approval_request_id);

-- Giảm theo sản phẩm: mỗi mặt hàng một phần trăm giảm.
CREATE TABLE sales.promotion_items (
    promotion_id            uuid        NOT NULL REFERENCES sales.promotions(id) ON DELETE CASCADE,
    variant_id              uuid        NOT NULL REFERENCES catalog.variants(id),
    discount_percent        numeric(5,2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    PRIMARY KEY (promotion_id, variant_id)
);

-- Điều kiện kênh, nhóm khách (không có dòng: mọi kênh trừ Nội bộ, mọi khách).
CREATE TABLE sales.promotion_channels (
    promotion_id            uuid        NOT NULL REFERENCES sales.promotions(id) ON DELETE CASCADE,
    channel_id              uuid        NOT NULL REFERENCES catalog.sales_channels(id),
    PRIMARY KEY (promotion_id, channel_id)
);
CREATE TABLE sales.promotion_customer_groups (
    promotion_id            uuid        NOT NULL REFERENCES sales.promotions(id) ON DELETE CASCADE,
    customer_group_id       uuid        NOT NULL REFERENCES catalog.customer_groups(id),
    PRIMARY KEY (promotion_id, customer_group_id)
);

-- Dòng đơn bán: khuyến mãi đã áp (QUYTAC_NGHIEPVU_81 đến 83).
ALTER TABLE sales.order_lines ADD COLUMN promotion_id uuid REFERENCES sales.promotions(id);            -- giảm theo sản phẩm hoặc mua X tặng Y (dòng tặng)
ALTER TABLE sales.order_lines ADD COLUMN promotion_percent numeric(5,2) NOT NULL DEFAULT 0;
ALTER TABLE sales.order_lines ADD COLUMN order_promotion_id uuid REFERENCES sales.promotions(id);      -- giảm theo đơn chia vào dòng
ALTER TABLE sales.order_lines ADD COLUMN order_discount_amount numeric(20,4) NOT NULL DEFAULT 0;      -- phần giảm theo đơn của dòng, gồm thuế
ALTER TABLE sales.order_lines ADD COLUMN promotion_discount_total numeric(20,4) NOT NULL DEFAULT 0;   -- tổng giảm do khuyến mãi của dòng, gồm thuế
ALTER TABLE sales.order_lines ADD COLUMN is_gift boolean NOT NULL DEFAULT false;
ALTER TABLE sales.order_lines ADD COLUMN gift_sets integer NOT NULL DEFAULT 0;                         -- số suất của dòng tặng
CREATE INDEX sales_order_lines_promotion_idx ON sales.order_lines (promotion_id);
CREATE INDEX sales_order_lines_order_promotion_idx ON sales.order_lines (order_promotion_id);
