-- CONG_VIEC_29: thêm đơn vị vận chuyển Viettel Post vào khung đơn vị vận chuyển chung (QUYTAC_NGHIEPVU_160, 185).
-- Ràng buộc mã giống hệt ở các công việc kết nối VNPost, J&T, GHTK để hợp nhất không xung đột.
ALTER TABLE marketplace.carriers DROP CONSTRAINT IF EXISTS carriers_code_check;
ALTER TABLE marketplace.carriers ADD CONSTRAINT carriers_code_check CHECK (code IN ('ghn', 'vnpost', 'viettel_post', 'jt', 'ghtk'));
INSERT INTO marketplace.carriers (code) VALUES ('viettel_post') ON CONFLICT (code) DO NOTHING;
