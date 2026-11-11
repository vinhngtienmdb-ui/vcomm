-- CONG_VIEC_53 lát L5: hóa đơn điện tử khởi tạo từ máy tính tiền (QUYTAC_NGHIEPVU_378; Nghị định 254/2026/NĐ-CP; Thông tư 91/2026/TT-BTC Phụ lục I).

-- Ký hiệu theo năm và loại: `standard` (ký tự thứ tư `T`), `cash_register` (ký tự thứ tư `M`). Số hóa đơn máy tính tiền cấp tại quầy theo `last_no`.
ALTER TABLE finance.einvoice_series ADD COLUMN kind text NOT NULL DEFAULT 'standard' CHECK (kind IN ('standard', 'cash_register'));
ALTER TABLE finance.einvoice_series ADD COLUMN last_no integer NOT NULL DEFAULT 0 CHECK (last_no BETWEEN 0 AND 99999999);
ALTER TABLE finance.einvoice_series DROP CONSTRAINT einvoice_series_pkey;
ALTER TABLE finance.einvoice_series ADD PRIMARY KEY (company_id, year, kind);
ALTER TABLE finance.einvoice_series DROP CONSTRAINT einvoice_series_series_check;
ALTER TABLE finance.einvoice_series ADD CONSTRAINT einvoice_series_series_check
    CHECK ((kind = 'standard' AND series ~ '^[CK][0-9]{2}T[A-Z]{2}$') OR (kind = 'cash_register' AND series ~ '^[CK][0-9]{2}M[A-Z]{2}$'));

-- Nguồn hóa đơn: lập từ phiếu xuất thường hoặc khởi tạo từ máy tính tiền; mã tra cứu in trên hóa đơn bán lẻ.
ALTER TABLE finance.einvoices ADD COLUMN origin text NOT NULL DEFAULT 'standard' CHECK (origin IN ('standard', 'cash_register'));
ALTER TABLE finance.einvoices ADD COLUMN lookup_code text CHECK (lookup_code ~ '^[A-Z0-9]{12}$');
ALTER TABLE finance.einvoices ADD CONSTRAINT einvoices_cash_register_check CHECK (origin = 'standard' OR (lookup_code IS NOT NULL AND kind = 'original'));
CREATE UNIQUE INDEX einvoices_lookup_idx ON finance.einvoices (lookup_code) WHERE lookup_code IS NOT NULL;
