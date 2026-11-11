-- CONG_VIEC_49 L2: mua chung bậc giá theo tổng số lượng, trả trước (CHUC_NANG_172; QUYTAC_NGHIEPVU_328 đến 331).

-- Cài đặt mua chung theo biến thể; bậc 1 là mốc tối thiểu thành nhóm (QUYTAC_NGHIEPVU_328).
CREATE TABLE marketplace.group_buy_settings (
    variant_id          uuid        PRIMARY KEY REFERENCES catalog.variants(id),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    is_enabled          boolean     NOT NULL DEFAULT false,
    max_duration_hours  integer     NOT NULL CHECK (max_duration_hours BETWEEN 1 AND 168),
    max_per_buyer       integer     NOT NULL CHECK (max_per_buyer BETWEEN 1 AND 999),
    updated_by          uuid        NOT NULL REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1
);
CREATE TABLE marketplace.group_buy_setting_tiers (
    variant_id    uuid          NOT NULL REFERENCES marketplace.group_buy_settings(variant_id) ON DELETE CASCADE,
    tier_no       integer       NOT NULL CHECK (tier_no BETWEEN 1 AND 5),
    min_quantity  integer       NOT NULL CHECK (min_quantity >= 2),
    unit_price    numeric(18,4) NOT NULL CHECK (unit_price > 0),
    PRIMARY KEY (variant_id, tier_no)
);

-- Nhóm mua chung; bậc giá chụp lúc mở (QUYTAC_NGHIEPVU_329, 331).
CREATE TABLE marketplace.group_buys (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       uuid          NOT NULL REFERENCES core.companies(id),
    variant_id       uuid          NOT NULL REFERENCES catalog.variants(id),
    opener_user_id   uuid          NOT NULL REFERENCES core.users(id),
    opener_kind      text          NOT NULL CHECK (opener_kind IN ('collaborator', 'staff')),
    status           text          NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'succeeded', 'failed', 'cancelled')),
    starts_at        timestamptz   NOT NULL DEFAULT now(),
    ends_at          timestamptz   NOT NULL,
    tiers            jsonb         NOT NULL,
    max_per_buyer    integer       NOT NULL CHECK (max_per_buyer BETWEEN 1 AND 999),
    final_quantity   integer,
    final_price      numeric(18,4),
    cancel_reason    text          CHECK (cancel_reason IS NULL OR char_length(cancel_reason) BETWEEN 1 AND 500),
    closed_at        timestamptz,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    version          integer       NOT NULL DEFAULT 1,
    CHECK (ends_at > starts_at),
    CHECK ((status = 'open') = (closed_at IS NULL)),
    CHECK ((status = 'succeeded') = (final_price IS NOT NULL)),
    CHECK ((status = 'cancelled') = (cancel_reason IS NOT NULL))
);
CREATE INDEX group_buys_open_idx ON marketplace.group_buys (ends_at) WHERE status = 'open';
CREATE INDEX group_buys_company_idx ON marketplace.group_buys (company_id, status, created_at DESC);
CREATE INDEX group_buys_opener_idx ON marketplace.group_buys (opener_user_id) WHERE status = 'open';

-- Đơn tham gia nhóm: trạng thái Chờ chốt nhóm sau khi thu đủ (QUYTAC_NGHIEPVU_330).
ALTER TABLE marketplace.orders ADD COLUMN group_buy_id uuid REFERENCES marketplace.group_buys(id);
CREATE INDEX marketplace_orders_group_buy_idx ON marketplace.orders (group_buy_id, status) WHERE group_buy_id IS NOT NULL;
ALTER TABLE marketplace.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('awaiting_payment', 'awaiting_group', 'awaiting_shipment', 'awaiting_pickup', 'shipping', 'delivered', 'completed', 'cancelled'));
