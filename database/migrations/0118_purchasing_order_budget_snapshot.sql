-- CONG_VIEC_58 lát L2: ảnh chụp ô vượt ngân sách lúc gửi duyệt đơn mua (QUYTAC_NGHIEPVU_452); chỉ mục tính số đã dùng (QUYTAC_NGHIEPVU_446).
ALTER TABLE purchasing.orders ADD COLUMN budget_snapshot jsonb;
CREATE INDEX orders_budget_idx ON purchasing.orders (company_id, order_date) WHERE status IN ('approved', 'received', 'closed', 'pending', 'rejected', 'withdrawn');
