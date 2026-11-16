-- Phát hành 0.11.0: gộp phạm vi khóa API của CONG_VIEC_62 (0133, `dropship.supplier`) và CONG_VIEC_65 (0152, `loyalty.partner`).
-- 0152 chạy sau 0133 và định nghĩa lại ràng buộc không có `dropship.supplier`; định nghĩa lại gồm mọi phạm vi trên main và cả hai phạm vi mới.
-- `api_keys_channel_scope_check` của 0152 giữ nguyên: khóa `dropship.supplier` có kênh bán nên vẫn thỏa.
ALTER TABLE core.api_keys DROP CONSTRAINT api_keys_scopes_check;
ALTER TABLE core.api_keys ADD CONSTRAINT api_keys_scopes_check
    CHECK (cardinality(scopes) >= 1 AND scopes <@ ARRAY['catalog.read', 'sales_order.write', 'customer.write', 'loyalty.member', 'dropship.supplier', 'loyalty.partner']::text[]);
