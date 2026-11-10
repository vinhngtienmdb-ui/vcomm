-- CONG_VIEC_15: Báo cáo tài chính (MODULE_06, phần 3; tài liệu 16).
-- Tài khoản chi tiết đánh dấu dài hạn: số dư vào chỉ tiêu dài hạn của báo cáo tình hình tài chính (QUYTAC_NGHIEPVU_101); tài khoản con kế thừa.
ALTER TABLE accounting.accounts ADD COLUMN is_long_term boolean NOT NULL DEFAULT false;
