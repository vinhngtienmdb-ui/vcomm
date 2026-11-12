-- CONG_VIEC_66: khách hàng do đối tác tạo qua Open API, người nhận giao thẳng (QUYTAC_NGHIEPVU_494; tài liệu 16).

-- Hồ sơ đối tác tạo qua Open API: ghi khóa đã tạo; khách cá nhân nguồn Open API được để trống số căn cước (QUYTAC_NGHIEPVU_494 khoản 2).
ALTER TABLE crm.partners ADD COLUMN created_via_api_key_id uuid REFERENCES core.api_keys(id);
ALTER TABLE crm.partners DROP CONSTRAINT partners_check1;
ALTER TABLE crm.partners ADD CONSTRAINT partners_check1 CHECK (kind <> 'individual' OR citizen_id IS NOT NULL OR created_via_api_key_id IS NOT NULL);

-- Khách trong phạm vi của đối tác (hoặc khóa nội bộ) tại một công ty: do phạm vi tạo (is_owner) hoặc gắn do trùng mã số thuế, căn cước (khoản 1, 4).
CREATE TABLE crm.open_api_customers (
    company_id                  uuid        NOT NULL REFERENCES core.companies(id),
    scope_id                    uuid        NOT NULL,                                   -- đối tác của khóa, hoặc chính khóa nội bộ
    partner_id                  uuid        NOT NULL REFERENCES crm.partners(id),
    api_key_id                  uuid        NOT NULL REFERENCES core.api_keys(id),     -- khóa đã tạo hoặc gắn
    is_owner                    boolean     NOT NULL,
    personal_data_consent_at    timestamptz,                                            -- đối tác xác nhận đã có đồng ý của khách cá nhân
    created_at                  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, scope_id, partner_id)
);
CREATE INDEX open_api_customers_partner_idx ON crm.open_api_customers (company_id, partner_id);

-- Người nhận giao thẳng trên đơn bán; địa chỉ giao dùng cột delivery_address (khoản 7).
ALTER TABLE sales.orders
    ADD COLUMN recipient_name   text CHECK (char_length(recipient_name) BETWEEN 1 AND 100),
    ADD COLUMN recipient_phone  text CHECK (recipient_phone ~ '^\+84[0-9]{9}$'),
    ADD CONSTRAINT orders_recipient_check CHECK ((recipient_name IS NULL) = (recipient_phone IS NULL) AND (recipient_name IS NULL OR delivery_address IS NOT NULL));
