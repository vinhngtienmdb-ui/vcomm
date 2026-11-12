-- CONG_VIEC_61 lát L2: đơn bán tạo qua Open API (QUYTAC_NGHIEPVU_490 đến 492).
-- open_api_scope_id: đối tác của khóa (khóa đối tác) hoặc chính khóa (khóa nội bộ); mã đơn đối tác duy nhất trong phạm vi này.
ALTER TABLE sales.orders
    ADD COLUMN open_api_key_id      uuid REFERENCES core.api_keys(id),
    ADD COLUMN open_api_scope_id    uuid,
    ADD COLUMN partner_order_code   text CHECK (partner_order_code ~ '^[A-Za-z0-9._-]{1,50}$'),
    ADD CONSTRAINT orders_open_api_check CHECK ((open_api_key_id IS NULL) = (partner_order_code IS NULL) AND (open_api_key_id IS NULL) = (open_api_scope_id IS NULL));

CREATE UNIQUE INDEX orders_partner_order_code_idx ON sales.orders (company_id, open_api_scope_id, partner_order_code) WHERE open_api_key_id IS NOT NULL;
CREATE INDEX orders_open_api_scope_idx ON sales.orders (open_api_scope_id, updated_at DESC) WHERE open_api_key_id IS NOT NULL;
