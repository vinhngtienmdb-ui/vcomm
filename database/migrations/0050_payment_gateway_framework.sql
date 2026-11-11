-- CONG_VIEC_32: khung nhiều cổng thanh toán. Mã phương thức, mã cổng không còn khóa bằng ràng buộc cố định;
-- danh mục phương thức là nguồn duy nhất, đơn và lần thanh toán tham chiếu danh mục (mỗi cổng thêm phương thức bằng database migration riêng).
ALTER TABLE marketplace.payment_methods DROP CONSTRAINT payment_methods_code_check;
ALTER TABLE marketplace.payment_methods DROP CONSTRAINT payment_methods_gateway_code_check;
ALTER TABLE marketplace.payment_methods ADD CONSTRAINT payment_methods_code_format CHECK (code ~ '^[a-z][a-z0-9_]{1,39}$');
ALTER TABLE marketplace.payment_methods ADD CONSTRAINT payment_methods_gateway_format CHECK (gateway_code ~ '^[a-z][a-z0-9_]{1,29}$');
ALTER TABLE marketplace.orders DROP CONSTRAINT orders_payment_method_check;
ALTER TABLE marketplace.orders ADD CONSTRAINT orders_payment_method_fkey FOREIGN KEY (payment_method) REFERENCES marketplace.payment_methods(code);
ALTER TABLE marketplace.payments DROP CONSTRAINT payments_gateway_code_check;
ALTER TABLE marketplace.payments DROP CONSTRAINT payments_method_check;
ALTER TABLE marketplace.payments ADD CONSTRAINT payments_method_fkey FOREIGN KEY (method) REFERENCES marketplace.payment_methods(code);
ALTER TABLE marketplace.payments ADD CONSTRAINT payments_not_cod CHECK (gateway_code <> 'cod');
