-- CONG_VIEC_25 L1: đơn chờ thanh toán, lần thanh toán qua cổng, sổ thanh toán của đơn, việc chờ hoàn tiền (QUYTAC_NGHIEPVU_165 đến 168).
ALTER TABLE marketplace.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_status_check
    CHECK (status IN ('awaiting_payment', 'awaiting_shipment', 'awaiting_pickup', 'shipping', 'delivered', 'completed', 'cancelled'));
ALTER TABLE marketplace.orders DROP CONSTRAINT orders_cancelled_by_kind_check;
-- system: quá hạn thanh toán, việc nền tự hủy.
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_cancelled_by_kind_check CHECK (cancelled_by_kind IN ('buyer', 'staff', 'carrier', 'system'));
ALTER TABLE marketplace.orders
    ADD COLUMN payment_deadline timestamptz,
    ADD COLUMN paid_amount      numeric(18,4) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    ADD COLUMN refunded_amount  numeric(18,4) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
    ADD COLUMN paid_at          timestamptz;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_payment_deadline_check CHECK (status <> 'awaiting_payment' OR payment_deadline IS NOT NULL);
CREATE INDEX marketplace_orders_payment_deadline_idx ON marketplace.orders (payment_deadline) WHERE status = 'awaiting_payment';

-- Lần thanh toán: mỗi lần người mua mở trang cổng là một lần, số tham chiếu duy nhất gửi cổng.
CREATE TABLE marketplace.payments (
    id                     uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id               uuid          NOT NULL REFERENCES marketplace.orders(id),
    gateway_code           text          NOT NULL CHECK (gateway_code IN ('vnpay')),
    method                 text          NOT NULL CHECK (method IN ('vnpay_qr', 'vnpay_atm', 'vnpay_card')),
    reference              text          NOT NULL UNIQUE,
    amount                 numeric(18,4) NOT NULL CHECK (amount > 0),
    status                 text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    gateway_transaction_no text,
    bank_code              text,
    response_code          text,
    created_by             uuid          NOT NULL REFERENCES core.users(id),
    created_at             timestamptz   NOT NULL DEFAULT now(),
    completed_at           timestamptz,
    CHECK ((status = 'pending') = (completed_at IS NULL))
);
CREATE INDEX payments_order_idx ON marketplace.payments (order_id, created_at);

-- Kết quả cổng gửi về (IPN), lưu nguyên để tra soát.
CREATE TABLE marketplace.payment_notifications (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_code text        NOT NULL,
    reference    text,
    payload      jsonb       NOT NULL,
    result_code  text        NOT NULL,
    received_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_notifications_reference_idx ON marketplace.payment_notifications (reference, received_at);

-- Việc chờ hoàn tiền (QUYTAC_NGHIEPVU_168); kế toán chuyển khoản rồi ghi đã hoàn.
CREATE TABLE marketplace.refunds (
    id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                 uuid          NOT NULL REFERENCES marketplace.orders(id),
    payment_id               uuid          REFERENCES marketplace.payments(id),
    return_request_id        uuid          REFERENCES marketplace.return_requests(id),
    reason                   text          NOT NULL CHECK (reason IN ('paid_after_cancel', 'duplicate_payment', 'order_cancelled', 'return_received')),
    amount                   numeric(18,4) NOT NULL CHECK (amount > 0),
    status                   text          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    bank_transaction_no      text          CHECK (bank_transaction_no IS NULL OR char_length(bank_transaction_no) <= 100),
    refunded_on              date,
    note                     text          CHECK (note IS NULL OR char_length(note) <= 500),
    completed_by             uuid          REFERENCES core.users(id),
    completed_at             timestamptz,
    created_at               timestamptz   NOT NULL DEFAULT now(),
    version                  integer       NOT NULL DEFAULT 1,
    CHECK ((status = 'completed') = (completed_at IS NOT NULL AND bank_transaction_no IS NOT NULL AND refunded_on IS NOT NULL))
);
CREATE INDEX refunds_status_idx ON marketplace.refunds (status, created_at);
CREATE INDEX refunds_order_idx ON marketplace.refunds (order_id);
CREATE UNIQUE INDEX refunds_payment_idx ON marketplace.refunds (payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX refunds_return_request_idx ON marketplace.refunds (return_request_id) WHERE return_request_id IS NOT NULL;
