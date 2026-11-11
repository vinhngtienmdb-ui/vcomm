-- CONG_VIEC_22: Ứng dụng nhân viên kinh doanh (CHUC_NANG_99 đến 103; QUYTAC_NGHIEPVU_136 đến 140; THAY_DOI_13).

-- Lượt ghé thăm khách: vị trí bắt buộc, thời điểm do máy chủ ghi, không sửa, không xóa (QUYTAC_NGHIEPVU_138).
CREATE TABLE crm.visits (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    partner_id          uuid        NOT NULL REFERENCES crm.partners(id),
    user_id             uuid        NOT NULL REFERENCES core.users(id),           -- người ghi
    visited_at          timestamptz NOT NULL DEFAULT now(),
    latitude            numeric(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude           numeric(9,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    accuracy_meters     numeric(8,1) NOT NULL CHECK (accuracy_meters BETWEEN 0 AND 10000),
    note                text        NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1000)
);
CREATE INDEX visits_company_idx ON crm.visits (company_id, visited_at DESC);
CREATE INDEX visits_partner_idx ON crm.visits (company_id, partner_id, visited_at DESC);
CREATE INDEX visits_user_idx ON crm.visits (company_id, user_id, visited_at DESC);

-- Ảnh ghé thăm lưu như tệp đính kèm (core.attachments, owner_type = 'visit').
ALTER TABLE core.attachments DROP CONSTRAINT attachments_owner_type_check;
ALTER TABLE core.attachments ADD CONSTRAINT attachments_owner_type_check CHECK (owner_type IN ('proposal', 'visit'));

-- Quyền mới; vai trò hệ thống được đồng bộ từ danh mục quyền khi khởi động.
INSERT INTO core.permissions (code, app_code, name_vi, name_en, is_sensitive) VALUES
    ('crm.visit.manage', 'crm', 'Ghi lượt ghé thăm khách', 'Record customer visits', false),
    ('finance.commission.view_own', 'finance', 'Xem hoa hồng của chính mình', 'View own commissions', false)
ON CONFLICT (code) DO NOTHING;
