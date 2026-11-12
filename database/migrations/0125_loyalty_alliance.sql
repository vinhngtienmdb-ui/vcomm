-- CONG_VIEC_60 (MODULE_11 phần 2): liên minh điểm trong tập đoàn.
-- QUYTAC_NGHIEPVU_468: kiểu chia chi phí theo giai đoạn chương trình; lô điểm giữ kiểu của giai đoạn lúc cộng.
ALTER TABLE loyalty.program_phases ADD COLUMN cost_bearer text NOT NULL DEFAULT 'earning_company'
    CHECK (cost_bearer IN ('earning_company', 'redeeming_company', 'operator'));
ALTER TABLE loyalty.lots ADD COLUMN cost_bearer text NOT NULL DEFAULT 'earning_company'
    CHECK (cost_bearer IN ('earning_company', 'redeeming_company', 'operator'));
