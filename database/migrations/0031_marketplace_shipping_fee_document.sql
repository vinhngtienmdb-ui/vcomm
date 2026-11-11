-- CONG_VIEC_25 (sửa sau rà soát): phiếu xuất mang phí giao hàng của đơn VComm, ghi một lần để phí không ghi hai lần khi nhiều phiếu xuất ghi sổ cùng lúc (QUYTAC_NGHIEPVU_169).
ALTER TABLE marketplace.orders ADD COLUMN shipping_fee_document_id uuid REFERENCES inventory.documents(id);
