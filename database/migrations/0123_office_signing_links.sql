-- CONG_VIEC_59 lát L3 (CHUC_NANG_213): gắn ký số vào công văn đi (CONG_VIEC_52) và hợp đồng lao động, phụ lục (CONG_VIEC_46).

-- Công văn đi: phiên ký gần nhất lập từ bản đã cấp số (QUYTAC_NGHIEPVU_365 bổ sung). Phiên xong thì phát hành không cần bản quét.
ALTER TABLE office.outgoing_documents ADD COLUMN signing_request_id uuid REFERENCES office.signing_requests (id);
CREATE INDEX outgoing_documents_signing_idx ON office.outgoing_documents (signing_request_id) WHERE signing_request_id IS NOT NULL;

-- Loại nguồn của phiên ký: thêm công văn đi, hợp đồng lao động, phụ lục hợp đồng lao động. Gồm mọi giá trị đã có.
-- Nhân sự tìm phiên ký của hợp đồng lao động theo (source_type, source_id); Văn phòng số không ghi vào schema hr.
ALTER TABLE office.signing_requests DROP CONSTRAINT signing_requests_source_type_check;
ALTER TABLE office.signing_requests ADD CONSTRAINT signing_requests_source_type_check
    CHECK (source_type IN ('document', 'contract', 'contract_appendix', 'outgoing', 'hr_contract', 'hr_contract_appendix'));
CREATE INDEX signing_requests_source_idx ON office.signing_requests (source_type, source_id, created_at DESC) WHERE source_id IS NOT NULL;
