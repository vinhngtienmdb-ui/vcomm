-- CONG_VIEC_57 L3: xử lý đơn trực tuyến tại trạm – sẵn sàng nhận, mã nhận hàng, giao, thu tiền trong ca (CHUC_NANG_202; QUYTAC_NGHIEPVU_424 đến 426, 431).

-- Trạng thái Sẵn sàng nhận (QUYTAC_NGHIEPVU_424); gồm mọi giá trị đang có trên main.
ALTER TABLE marketplace.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('awaiting_payment', 'awaiting_group', 'awaiting_shipment', 'ready_for_pickup', 'awaiting_pickup', 'shipping', 'delivered', 'completed', 'cancelled'));

-- Đơn tại trạm: mã nhận hàng, hạn giữ, khóa nhập mã, nhân viên giao (QUYTAC_NGHIEPVU_424, 425, 427).
CREATE TABLE retail.station_orders (
    order_id            uuid        PRIMARY KEY REFERENCES marketplace.orders(id),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    store_id            uuid        NOT NULL REFERENCES retail.stores(id),
    pickup_code         text        NOT NULL CHECK (pickup_code ~ '^[0-9]{6}$'),
    is_active           boolean     NOT NULL DEFAULT true,
    ready_at            timestamptz NOT NULL,
    ready_by            uuid        NOT NULL REFERENCES core.users(id),
    hold_until          timestamptz NOT NULL,
    reminded_at         timestamptz,
    failed_code_count   integer     NOT NULL DEFAULT 0 CHECK (failed_code_count >= 0),
    code_locked_until   timestamptz,
    courier_user_id     uuid        REFERENCES core.users(id),
    delivery_attempts   integer     NOT NULL DEFAULT 0 CHECK (delivery_attempts BETWEEN 0 AND 3),
    handed_over_at      timestamptz,
    handed_over_by      uuid        REFERENCES core.users(id)
);
-- Mã không trùng trong các đơn đang chờ nhận, đang giao của trạm (QUYTAC_NGHIEPVU_425).
CREATE UNIQUE INDEX station_orders_code_idx ON retail.station_orders (store_id, pickup_code) WHERE is_active;
CREATE INDEX station_orders_hold_idx ON retail.station_orders (hold_until) WHERE is_active;

-- Tiền thu tại trạm khi giao đơn chưa trả trước, gắn ca thu ngân (QUYTAC_NGHIEPVU_426, 431).
CREATE TABLE retail.station_collections (
    id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid          NOT NULL REFERENCES core.companies(id),
    order_id        uuid          NOT NULL REFERENCES marketplace.orders(id),
    shift_id        uuid          NOT NULL REFERENCES retail.shifts(id),
    line_no         integer       NOT NULL CHECK (line_no > 0),
    method          text          NOT NULL CHECK (method IN ('cash', 'bank_transfer')),
    amount          numeric(18,4) NOT NULL CHECK (amount > 0),
    change_amount   numeric(18,4) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
    fund_id         uuid          NOT NULL REFERENCES finance.funds(id),
    bank_reference  text          CHECK (char_length(bank_reference) BETWEEN 1 AND 50),
    created_by      uuid          NOT NULL REFERENCES core.users(id),
    created_at      timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (order_id, line_no),
    CHECK (method = 'cash' OR change_amount = 0)
);
CREATE INDEX station_collections_shift_idx ON retail.station_collections (shift_id);
