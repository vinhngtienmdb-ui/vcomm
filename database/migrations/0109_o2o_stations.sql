-- CONG_VIEC_57 L1: trạm giao hàng O2O – loại trạm, thông tin hiện cho khách, xã được giao (CHUC_NANG_200; QUYTAC_NGHIEPVU_418, 419, 420).

-- Loại trạm: cửa hàng bán tại quầy hoặc điểm giao nhận không bán tại quầy (QUYTAC_NGHIEPVU_418).
ALTER TABLE retail.stores
    ADD COLUMN kind                    text          NOT NULL DEFAULT 'store' CHECK (kind IN ('store', 'pickup_point')),
    ADD COLUMN pickup_enabled          boolean       NOT NULL DEFAULT false,
    ADD COLUMN delivery_enabled        boolean       NOT NULL DEFAULT false,
    ADD COLUMN display_name            text          CHECK (char_length(display_name) BETWEEN 1 AND 100),
    ADD COLUMN province_code           text          REFERENCES marketplace.provinces(code),
    ADD COLUMN ward_code               text,
    ADD COLUMN street_address          text          CHECK (char_length(street_address) BETWEEN 1 AND 200),
    ADD COLUMN phone                   text          CHECK (phone ~ '^[0-9]{8,11}$'),
    ADD COLUMN opening_hours           text          CHECK (char_length(opening_hours) BETWEEN 1 AND 200),
    ADD COLUMN hold_days               integer       NOT NULL DEFAULT 3 CHECK (hold_days BETWEEN 1 AND 14),
    ADD COLUMN delivery_fee            numeric(18,4) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    ADD COLUMN free_delivery_threshold numeric(18,4) CHECK (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0),
    ADD COLUMN station_version         integer       NOT NULL DEFAULT 1,
    ADD CONSTRAINT stores_ward_fkey FOREIGN KEY (ward_code, province_code) REFERENCES marketplace.wards(code, province_code),
    -- Bật nhận tại trạm hoặc trạm giao cần đủ thông tin hiện cho khách (QUYTAC_NGHIEPVU_419).
    ADD CONSTRAINT stores_station_info_check CHECK (
        NOT (pickup_enabled OR delivery_enabled)
        OR (display_name IS NOT NULL AND province_code IS NOT NULL AND ward_code IS NOT NULL AND street_address IS NOT NULL AND phone IS NOT NULL AND opening_hours IS NOT NULL)
    );
CREATE INDEX stores_station_idx ON retail.stores (company_id) WHERE pickup_enabled OR delivery_enabled;

-- Xã trạm giao tận nơi (QUYTAC_NGHIEPVU_420).
CREATE TABLE retail.station_wards (
    store_id    uuid NOT NULL REFERENCES retail.stores(id),
    ward_code   text NOT NULL REFERENCES marketplace.wards(code),
    PRIMARY KEY (store_id, ward_code)
);
CREATE INDEX station_wards_ward_idx ON retail.station_wards (ward_code);
