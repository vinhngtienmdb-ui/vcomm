-- CONG_VIEC_28: đơn vị vận chuyển VNPost (QUYTAC_NGHIEPVU_160, QUYTAC_NGHIEPVU_180). Thông tin kết nối ở biến môi trường.
ALTER TABLE marketplace.carriers DROP CONSTRAINT IF EXISTS carriers_code_check;
ALTER TABLE marketplace.carriers ADD CONSTRAINT carriers_code_check CHECK (code IN ('ghn', 'vnpost', 'viettel_post', 'jt', 'ghtk'));
INSERT INTO marketplace.carriers (code) VALUES ('vnpost') ON CONFLICT (code) DO NOTHING;
