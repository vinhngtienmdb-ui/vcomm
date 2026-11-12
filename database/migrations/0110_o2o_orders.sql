-- CONG_VIEC_57 L2: đơn VComm nhận tại trạm hoặc trạm giao (CHUC_NANG_201; QUYTAC_NGHIEPVU_421, 422, 423).

-- Cách nhận, trạm, kho xuất của đơn. Đơn cũ giao qua đơn vị vận chuyển từ kho trong cài đặt bán hàng VComm.
ALTER TABLE marketplace.orders
    ADD COLUMN fulfillment_mode text NOT NULL DEFAULT 'carrier' CHECK (fulfillment_mode IN ('carrier', 'station_pickup', 'station_delivery')),
    ADD COLUMN station_id       uuid REFERENCES retail.stores(id),
    ADD COLUMN warehouse_id     uuid REFERENCES inventory.warehouses(id),
    ADD CONSTRAINT orders_station_check CHECK ((fulfillment_mode = 'carrier') = (station_id IS NULL));
UPDATE marketplace.orders m SET warehouse_id = s.warehouse_id FROM marketplace.store_settings s WHERE s.company_id = m.company_id AND m.warehouse_id IS NULL;
CREATE INDEX marketplace_orders_station_idx ON marketplace.orders (station_id, status, created_at DESC) WHERE station_id IS NOT NULL;

-- Thanh toán khi nhận tại trạm (QUYTAC_NGHIEPVU_423): cổng `station` luôn có kết nối, tắt sẵn.
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES ('pay_at_station', 'station', 100, false) ON CONFLICT (code) DO NOTHING;

-- Tiền thu khi nhận: thu hộ qua đơn vị vận chuyển (`cod`) hoặc thu tại trạm (`pay_at_station`).
ALTER TABLE marketplace.orders DROP CONSTRAINT orders_cod_amount_method_check;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_cod_amount_method_check CHECK (payment_method IN ('cod', 'pay_at_station') OR cod_amount = 0);
