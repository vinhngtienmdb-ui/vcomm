-- CONG_VIEC_74 L4: iPOS – thanh toán VietQR, điểm và voucher của khách VComm, đơn chờ thanh toán qua ứng dụng VComm (QUYTAC_NGHIEPVU_614 đến 617; tài liệu 16).
-- Phần trả hàng của 0169 (phiếu trả) làm ở lát L5 bằng tệp database migration riêng.

-- Dòng thanh toán: nội dung chuyển khoản VietQR; liên kết giao dịch điểm `LK…` (CONG_VIEC_55) và đơn chờ `TT…` (CONG_VIEC_73).
ALTER TABLE ipos.sale_payments
    ADD COLUMN vietqr_reference         text CHECK (vietqr_reference IS NULL OR length(vietqr_reference) BETWEEN 1 AND 25),
    ADD COLUMN affiliate_transaction_id uuid REFERENCES affiliate.transactions(id),
    ADD COLUMN instore_checkout_id      uuid REFERENCES instore.checkouts(id),
    ADD CONSTRAINT sale_payments_vietqr_check CHECK (method <> 'vietqr' OR (vietqr_reference IS NOT NULL AND confirmed_by IS NOT NULL)),
    ADD CONSTRAINT sale_payments_loyalty_check CHECK (method NOT IN ('points', 'voucher') OR affiliate_transaction_id IS NOT NULL OR instore_checkout_id IS NOT NULL),
    ADD CONSTRAINT sale_payments_app_check CHECK (method <> 'vcomm_app' OR instore_checkout_id IS NOT NULL);

-- Một giao dịch điểm, một đơn chờ chỉ gắn với một hóa đơn.
CREATE UNIQUE INDEX sale_payments_affiliate_idx ON ipos.sale_payments (affiliate_transaction_id, method) WHERE affiliate_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX sale_payments_checkout_idx ON ipos.sale_payments (instore_checkout_id, method) WHERE instore_checkout_id IS NOT NULL;
CREATE INDEX sale_payments_vietqr_idx ON ipos.sale_payments (vietqr_reference) WHERE vietqr_reference IS NOT NULL;

-- Hóa đơn ghi lý do không tích điểm (hạn mức, quá hạn đối soát; QUYTAC_NGHIEPVU_616 khoản 6).
ALTER TABLE ipos.sales ADD COLUMN loyalty_skip_reason text CHECK (loyalty_skip_reason IS NULL OR length(loyalty_skip_reason) BETWEEN 1 AND 50);

-- Giao dịch điểm, đơn chờ do máy bán lập trong ca (để chặn đóng ca khi còn dở; QUYTAC_NGHIEPVU_623 khoản 1).
CREATE TABLE ipos.shift_links (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id                    uuid        NOT NULL REFERENCES ipos.shifts(id),
    affiliate_transaction_id    uuid        UNIQUE REFERENCES affiliate.transactions(id),
    instore_checkout_id         uuid        UNIQUE REFERENCES instore.checkouts(id),
    sale_id                     uuid        REFERENCES ipos.sales(id),
    created_at                  timestamptz NOT NULL DEFAULT now(),
    CHECK ((affiliate_transaction_id IS NULL) <> (instore_checkout_id IS NULL))
);
CREATE INDEX shift_links_shift_idx ON ipos.shift_links (shift_id) WHERE sale_id IS NULL;

-- Đơn chờ do iPOS tạo trỏ về hóa đơn iPOS khi hoàn tất (cột do CONG_VIEC_73 chừa sẵn).
ALTER TABLE instore.checkouts ADD CONSTRAINT checkouts_ipos_invoice_fk FOREIGN KEY (ipos_invoice_id) REFERENCES ipos.sales(id);
