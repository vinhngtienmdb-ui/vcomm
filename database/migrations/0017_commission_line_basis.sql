-- CONG_VIEC_17 sửa sau rà soát: tiền gồm thuế đã thu của từng dòng đơn, để chia lần thu sau theo phần còn phải thu của từng dòng (QUYTAC_NGHIEPVU_110).
ALTER TABLE finance.commission_events ADD COLUMN gross_amount numeric(20,4) NOT NULL DEFAULT 0;
