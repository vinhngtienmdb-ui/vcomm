-- CONG_VIEC_21: Gán khách hàng cho nhân viên kinh doanh (CHUC_NANG_96 đến 98; QUYTAC_NGHIEPVU_129 đến 135; THAY_DOI_12).

-- Phiếu giao khách (QUYTAC_NGHIEPVU_131, 132).
CREATE TABLE crm.customer_assignments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    document_no         text,
    target_user_id      uuid        NOT NULL REFERENCES core.users(id),           -- nhân viên nhận
    reason              text        NOT NULL,
    status              text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'applied', 'rejected', 'withdrawn')),
    approval_request_id uuid,
    apply_error         text,                                                     -- khóa thông báo lý do không áp dụng được
    apply_error_detail  text,                                                     -- danh sách khách đã đổi nhân viên phụ trách
    created_by          uuid        NOT NULL REFERENCES core.users(id),
    submitted_by        uuid        REFERENCES core.users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    submitted_at        timestamptz,
    applied_at          timestamptz,
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1
);
CREATE INDEX customer_assignments_company_idx ON crm.customer_assignments (company_id, created_at DESC);
CREATE INDEX customer_assignments_approval_idx ON crm.customer_assignments (approval_request_id);

-- Khách trong phiếu; nhân viên phụ trách lúc gửi để kiểm khi áp dụng (QUYTAC_NGHIEPVU_133).
CREATE TABLE crm.customer_assignment_lines (
    assignment_id       uuid        NOT NULL REFERENCES crm.customer_assignments(id) ON DELETE CASCADE,
    partner_id          uuid        NOT NULL REFERENCES crm.partners(id),
    previous_user_id    uuid        REFERENCES core.users(id),
    PRIMARY KEY (assignment_id, partner_id)
);

-- Lịch sử phụ trách: mỗi khách tại mỗi công ty một dòng đang mở (valid_to trống).
CREATE TABLE crm.partner_owner_history (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),
    partner_id          uuid        NOT NULL REFERENCES crm.partners(id),
    user_id             uuid        NOT NULL REFERENCES core.users(id),
    valid_from          timestamptz NOT NULL DEFAULT now(),
    valid_to            timestamptz,
    assignment_id       uuid        REFERENCES crm.customer_assignments(id),
    created_by          uuid        REFERENCES core.users(id)
);
CREATE INDEX partner_owner_history_partner_idx ON crm.partner_owner_history (company_id, partner_id, valid_from DESC);
CREATE UNIQUE INDEX partner_owner_history_open_idx ON crm.partner_owner_history (company_id, partner_id) WHERE valid_to IS NULL;

CREATE INDEX partner_profiles_owner_idx ON crm.partner_profiles (company_id, owner_user_id);

-- Hồ sơ đã có nhân viên phụ trách: lịch sử bắt đầu từ lần cập nhật hồ sơ gần nhất (QUYTAC_NGHIEPVU_134).
INSERT INTO crm.partner_owner_history (company_id, partner_id, user_id, valid_from, created_by)
SELECT company_id, partner_id, owner_user_id, updated_at, updated_by FROM crm.partner_profiles WHERE owner_user_id IS NOT NULL;

-- Quyền mới; vai trò tự tạo đang xem đối tác hoặc đơn bán giữ được phạm vi xem như cũ (THAY_DOI_12).
-- Vai trò hệ thống được đồng bộ từ danh mục quyền khi khởi động.
INSERT INTO core.permissions (code, app_code, name_vi, name_en, is_sensitive) VALUES
    ('crm.customer.view_all', 'crm', 'Xem mọi khách hàng, đơn bán của công ty', 'View all customers and sales orders of the company', false),
    ('crm.customer.assign', 'crm', 'Giao, chuyển khách hàng cho nhân viên', 'Assign customers to staff', false)
ON CONFLICT (code) DO NOTHING;
INSERT INTO core.role_permissions (role_id, permission_code)
SELECT DISTINCT rp.role_id, 'crm.customer.view_all' FROM core.role_permissions rp JOIN core.roles r ON r.id = rp.role_id
WHERE NOT r.is_system AND rp.permission_code IN ('crm.partner.view', 'sales.order.view')
ON CONFLICT DO NOTHING;
