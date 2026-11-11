-- CONG_VIEC_30: thêm J&T Express vào khung đơn vị vận chuyển (QUYTAC_NGHIEPVU_160, 190).
-- Hai dòng ràng buộc giống hệt ở các database migration của VNPost, Viettel Post, GHTK để chạy theo thứ tự nào cũng được.
ALTER TABLE marketplace.carriers DROP CONSTRAINT IF EXISTS carriers_code_check;
ALTER TABLE marketplace.carriers ADD CONSTRAINT carriers_code_check CHECK (code IN ('ghn', 'vnpost', 'viettel_post', 'jt', 'ghtk'));
INSERT INTO marketplace.carriers (code) VALUES ('jt') ON CONFLICT (code) DO NOTHING;
