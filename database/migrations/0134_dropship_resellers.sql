-- CONG_VIEC_62 lát L4: người bán dropship, địa chỉ người nhận tách, thu hộ, vận đơn đơn người bán (CHUC_NANG_225; QUYTAC_NGHIEPVU_506 đến 508).

-- Cờ người bán dropship trên hồ sơ khách hàng của đối tác ở công ty (QUYTAC_NGHIEPVU_506).
ALTER TABLE crm.partner_profiles ADD COLUMN is_dropship_reseller boolean NOT NULL DEFAULT false;

-- Đơn dropship của người bán: địa chỉ người nhận tách (số nhà, đường; phường/xã theo danh mục), tiền thu hộ (QUYTAC_NGHIEPVU_506, 508).
ALTER TABLE sales.orders
    ADD COLUMN is_reseller_dropship boolean NOT NULL DEFAULT false,
    ADD COLUMN cod_amount numeric(20,4) NOT NULL DEFAULT 0 CHECK (cod_amount >= 0 AND cod_amount <= 50000000),
    ADD COLUMN recipient_street text CHECK (length(recipient_street) BETWEEN 1 AND 300),
    ADD COLUMN recipient_ward_code text REFERENCES marketplace.wards(code),
    ADD CONSTRAINT orders_reseller_cod_check CHECK (cod_amount = 0 OR is_reseller_dropship),
    ADD CONSTRAINT orders_reseller_recipient_check CHECK (NOT is_reseller_dropship OR (recipient_name IS NOT NULL AND recipient_street IS NOT NULL AND recipient_ward_code IS NOT NULL));

-- Vận đơn của đơn người bán: tạo qua kết nối đơn vị vận chuyển (carrier_code) hoặc nhập tay (carrier_name) (QUYTAC_NGHIEPVU_507).
CREATE TABLE sales.order_shipments (
    id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid          NOT NULL REFERENCES core.companies(id),
    order_id            uuid          NOT NULL REFERENCES sales.orders(id),
    carrier_code        text          REFERENCES marketplace.carriers(code),
    carrier_name        text          CHECK (length(carrier_name) BETWEEN 1 AND 100),
    tracking_code       text          CHECK (length(tracking_code) BETWEEN 1 AND 100),
    carrier_status      text,
    shipping_status     text          NOT NULL CHECK (shipping_status IN ('requesting', 'awaiting_pickup', 'shipping', 'delivered', 'returned', 'cancelled')),
    fee                 numeric(20,4) CHECK (fee >= 0 AND fee <= 5000000),
    cod_amount          numeric(20,4) NOT NULL DEFAULT 0,
    cod_collected_at    timestamptz,
    is_active           boolean       NOT NULL DEFAULT true,
    created_by          uuid          NOT NULL REFERENCES core.users(id),
    created_at          timestamptz   NOT NULL DEFAULT now(),
    synced_at           timestamptz   NOT NULL DEFAULT now(),
    version             integer       NOT NULL DEFAULT 1,
    CHECK ((carrier_code IS NULL) <> (carrier_name IS NULL)),
    CHECK (carrier_code IS NOT NULL OR tracking_code IS NOT NULL)
);
CREATE UNIQUE INDEX order_shipments_active_idx ON sales.order_shipments (order_id) WHERE is_active;
CREATE UNIQUE INDEX order_shipments_tracking_idx ON sales.order_shipments (carrier_code, tracking_code) WHERE carrier_code IS NOT NULL AND tracking_code IS NOT NULL;
CREATE INDEX order_shipments_company_idx ON sales.order_shipments (company_id, shipping_status);
