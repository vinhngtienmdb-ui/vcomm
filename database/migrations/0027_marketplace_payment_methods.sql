-- CONG_VIEC_25 L0: phương thức thanh toán theo cổng, công tắc mở đặt hàng (QUYTAC_NGHIEPVU_163, 164).
-- Thông tin kết nối cổng ở biến môi trường; bảng chỉ lưu bật tắt.
CREATE TABLE marketplace.payment_methods (
    code         text        PRIMARY KEY CHECK (code IN ('cod', 'vnpay_qr', 'vnpay_atm', 'vnpay_card')),
    gateway_code text        NOT NULL CHECK (gateway_code IN ('cod', 'vnpay')),
    sort_order   integer     NOT NULL,
    is_enabled   boolean     NOT NULL DEFAULT false,
    updated_by   uuid        REFERENCES core.users(id),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
-- Thanh toán khi nhận hàng giữ bật như CONG_VIEC_24 (người mua thử đang dùng).
INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES
    ('cod', 'cod', 1, true),
    ('vnpay_qr', 'vnpay', 2, false),
    ('vnpay_atm', 'vnpay', 3, false),
    ('vnpay_card', 'vnpay', 4, false);

ALTER TABLE marketplace.store_settings ADD COLUMN ordering_open boolean NOT NULL DEFAULT false;

-- Tổng thanh toán của đơn; tiền thu hộ chỉ còn ở đơn thanh toán khi nhận hàng.
ALTER TABLE marketplace.orders ADD COLUMN total_amount numeric(18,4);
UPDATE marketplace.orders SET total_amount = cod_amount;
ALTER TABLE marketplace.orders ALTER COLUMN total_amount SET NOT NULL;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_total_amount_check CHECK (total_amount >= 0);
ALTER TABLE marketplace.orders DROP CONSTRAINT orders_payment_method_check;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('cod', 'vnpay_qr', 'vnpay_atm', 'vnpay_card'));
ALTER TABLE marketplace.orders ALTER COLUMN payment_method DROP DEFAULT;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_cod_amount_method_check CHECK (payment_method = 'cod' OR cod_amount = 0);
