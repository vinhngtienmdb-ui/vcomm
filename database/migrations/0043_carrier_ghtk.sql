-- CONG_VIEC_31: thêm đơn vị vận chuyển Giao Hàng Tiết Kiệm (GHTK). Ràng buộc mã giữ giống hệt các phiên kết nối VNPost, Viettel Post, J&T.
ALTER TABLE marketplace.carriers DROP CONSTRAINT IF EXISTS carriers_code_check;
ALTER TABLE marketplace.carriers ADD CONSTRAINT carriers_code_check CHECK (code IN ('ghn', 'vnpost', 'viettel_post', 'jt', 'ghtk'));
INSERT INTO marketplace.carriers (code) VALUES ('ghtk') ON CONFLICT (code) DO NOTHING;
