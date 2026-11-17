-- CONG_VIEC_73 lát L6: hóa đơn điện tử lập thay cửa hàng liên kết theo ủy nhiệm (QUYTAC_NGHIEPVU_588, 589; API_334) và hóa đơn phí sàn tháng (QUYTAC_NGHIEPVU_587).

-- Dữ liệu ủy nhiệm trong hợp đồng cửa hàng liên kết (MAN_HINH_279). Khấu trừ: hóa đơn giá trị gia tăng (mẫu 1) theo thuế suất mặc định;
-- trực tiếp hoặc hộ kinh doanh: hóa đơn bán hàng (mẫu 2), không ghi thuế suất. Tệp văn bản ủy nhiệm PDF tối đa 10 MB.
CREATE TABLE affiliate.einvoice_mandates (
    merchant_id         uuid        PRIMARY KEY REFERENCES affiliate.merchants(id),
    seller_name         text        NOT NULL CHECK (char_length(seller_name) BETWEEN 1 AND 300),
    tax_code            text        NOT NULL CHECK (tax_code ~ '^[0-9]{10}(-[0-9]{3})?$'),
    address             text        NOT NULL CHECK (char_length(address) BETWEEN 1 AND 300),
    tax_method          text        NOT NULL CHECK (tax_method IN ('deduction', 'direct')),
    default_vat_rate    text        CHECK (default_vat_rate IN ('0', '5', '8', '10', 'exempt', 'not_declared')),
    mandate_no          text        NOT NULL CHECK (char_length(mandate_no) BETWEEN 1 AND 100),
    effective_from      date        NOT NULL,
    expires_on          date,
    file_name           text        CHECK (file_name IS NULL OR char_length(file_name) BETWEEN 1 AND 200),
    file_content        bytea,
    file_size           integer     CHECK (file_size IS NULL OR file_size BETWEEN 1 AND 10485760),
    updated_by          uuid        REFERENCES core.users(id),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    version             integer     NOT NULL DEFAULT 1,
    CHECK (tax_method = 'direct' OR default_vat_rate IS NOT NULL),
    CHECK (expires_on IS NULL OR expires_on >= effective_from),
    CHECK ((file_name IS NULL) = (file_content IS NULL) AND (file_content IS NULL) = (file_size IS NULL))
);

-- Ký hiệu hóa đơn riêng của cửa hàng theo năm.
CREATE TABLE affiliate.einvoice_series (
    merchant_id         uuid        NOT NULL REFERENCES affiliate.merchants(id),
    year                integer     NOT NULL CHECK (year BETWEEN 2000 AND 2099),
    series              text        NOT NULL CHECK (series ~ '^[CK][0-9]{2}T[A-Z]{2}$' AND substr(series, 2, 2) = lpad((year % 100)::text, 2, '0')),
    PRIMARY KEY (merchant_id, year)
);

-- Việc chờ lập hóa đơn ủy nhiệm: giao dịch thu hộ hoàn tất khi thiếu dữ liệu, ủy nhiệm hết hiệu lực, chưa có ký hiệu hoặc công ty vận hành sàn chưa bật hóa đơn điện tử.
-- Lập bù xong thì xóa dòng.
CREATE TABLE affiliate.einvoice_backlog (
    transaction_id      uuid        PRIMARY KEY REFERENCES affiliate.transactions(id),
    merchant_id         uuid        NOT NULL REFERENCES affiliate.merchants(id),
    operator_company_id uuid        NOT NULL REFERENCES core.companies(id),
    reason              text        NOT NULL CHECK (reason IN ('mandate_missing', 'mandate_inactive', 'series_missing', 'einvoice_off')),
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX einvoice_backlog_merchant_idx ON affiliate.einvoice_backlog (merchant_id, created_at);

-- Hóa đơn phí sàn tháng: một dòng mỗi người nhận mỗi tháng (tổng H, I của các bảng chuyển tiền có ngày trong tháng).
CREATE TABLE instore.fee_invoices (
    id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_company_id   uuid          NOT NULL REFERENCES core.companies(id),
    recipient_kind        text          NOT NULL CHECK (recipient_kind IN ('retail_company', 'merchant')),
    recipient_company_id  uuid          REFERENCES core.companies(id),
    merchant_id           uuid          REFERENCES affiliate.merchants(id),
    month                 date          NOT NULL CHECK (extract(day FROM month) = 1),
    platform_fee          numeric(18,4) NOT NULL CHECK (platform_fee > 0),
    platform_fee_tax      numeric(18,4) NOT NULL CHECK (platform_fee_tax >= 0),
    created_at            timestamptz   NOT NULL DEFAULT now(),
    CHECK ((recipient_kind = 'retail_company') = (recipient_company_id IS NOT NULL) AND (recipient_kind = 'merchant') = (merchant_id IS NOT NULL))
);
CREATE UNIQUE INDEX fee_invoices_recipient_month_idx ON instore.fee_invoices (operator_company_id, recipient_kind, coalesce(recipient_company_id, merchant_id), month);

-- Thuế suất phí chỉ nhận các mức hóa đơn điện tử ghi được.
ALTER TABLE instore.settings DROP CONSTRAINT settings_fee_tax_rate_check;
ALTER TABLE instore.settings ADD CONSTRAINT settings_fee_tax_rate_check CHECK (fee_tax_rate IN (0, 5, 8, 10));

-- Nguồn hóa đơn: phiếu xuất (như trước), giao dịch cửa hàng liên kết (lập theo ủy nhiệm, người bán là cửa hàng) hoặc hóa đơn phí sàn tháng.
-- Hóa đơn ủy nhiệm thuộc công ty vận hành sàn (tài khoản nhà cung cấp), số hóa đơn duy nhất theo người bán.
ALTER TABLE finance.einvoices ALTER COLUMN source_document_id DROP NOT NULL;
ALTER TABLE finance.einvoices
    ADD COLUMN affiliate_transaction_id  uuid REFERENCES affiliate.transactions(id),
    ADD COLUMN instore_fee_invoice_id    uuid REFERENCES instore.fee_invoices(id),
    ADD COLUMN mandate_merchant_id       uuid REFERENCES affiliate.merchants(id);
ALTER TABLE finance.einvoices ADD CONSTRAINT einvoices_source_check CHECK (num_nonnulls(source_document_id, affiliate_transaction_id, instore_fee_invoice_id) = 1);
ALTER TABLE finance.einvoices ADD CONSTRAINT einvoices_mandate_check CHECK ((affiliate_transaction_id IS NULL) = (mandate_merchant_id IS NULL));
CREATE UNIQUE INDEX einvoices_original_affiliate_idx ON finance.einvoices (affiliate_transaction_id) WHERE kind = 'original' AND affiliate_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX einvoices_original_fee_idx ON finance.einvoices (instore_fee_invoice_id) WHERE kind = 'original' AND instore_fee_invoice_id IS NOT NULL;
DROP INDEX finance.einvoices_number_idx;
CREATE UNIQUE INDEX einvoices_number_idx ON finance.einvoices (company_id, coalesce(mandate_merchant_id, '00000000-0000-0000-0000-000000000000'::uuid), series, invoice_no)
    WHERE invoice_no IS NOT NULL;
