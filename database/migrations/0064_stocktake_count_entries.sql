-- CONG_VIEC_44: số đếm kiểm kê cộng dồn từ ứng dụng kho (QUYTAC_NGHIEPVU_284).

-- Lịch sử đếm, chỉ thêm, không sửa, không xóa.
CREATE TABLE inventory.stocktake_count_entries (
    id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    stocktake_id      uuid          NOT NULL REFERENCES inventory.stocktakes(id),
    stocktake_line_id uuid          NOT NULL REFERENCES inventory.stocktake_lines(id),
    counted_by        uuid          NOT NULL REFERENCES core.users(id),
    counted_at        timestamptz   NOT NULL DEFAULT now(),
    quantity          numeric(20,4) NOT NULL,                 -- số cộng, có dấu
    added_serials     text[]        NOT NULL DEFAULT '{}',
    removed_serials   text[]        NOT NULL DEFAULT '{}',
    client_type       text          NOT NULL CHECK (client_type IN ('web', 'warehouse_app', 'sales_app', 'vcomm_app'))
);
CREATE INDEX stocktake_count_entries_stocktake_idx ON inventory.stocktake_count_entries (stocktake_id, counted_at DESC);

-- Hai người cùng thêm dòng mới (biến thể, lô, vị trí) chỉ sinh một dòng.
CREATE UNIQUE INDEX stocktake_lines_key_idx ON inventory.stocktake_lines (stocktake_id, variant_id, lot_id, location_id) NULLS NOT DISTINCT;
