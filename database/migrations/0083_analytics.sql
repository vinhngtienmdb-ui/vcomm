-- CONG_VIEC_50: mini app Báo cáo quản trị (MODULE_15). Chỉ đọc dữ liệu của các module khác; không thêm bảng nghiệp vụ.

INSERT INTO core.apps (code, name_vi, name_en, base_url, icon, sort_order) VALUES
    ('analytics', 'Báo cáo quản trị', 'Management reports', '/analytics', 'chart', 90);

-- Chỉ mục cho báo cáo theo khoảng ngày (CONG_VIEC_50 mục 9).
CREATE INDEX documents_posted_report_idx ON inventory.documents (company_id, type, document_date) WHERE status = 'posted';
CREATE INDEX movements_company_moved_idx ON inventory.movements (company_id, moved_at);
CREATE INDEX order_commissions_credited_idx ON marketplace.order_commissions (credited_at) WHERE status = 'credited';
