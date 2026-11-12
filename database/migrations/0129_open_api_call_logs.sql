-- CONG_VIEC_61 lát L1: nhật ký gọi API của đối tác (QUYTAC_NGHIEPVU_488). Không ghi nội dung yêu cầu, kết quả; giữ 90 ngày.
CREATE TABLE core.api_call_logs (
    id              bigserial   PRIMARY KEY,
    api_key_id      uuid        NOT NULL REFERENCES core.api_keys(id),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    called_at       timestamptz NOT NULL DEFAULT now(),
    method          text        NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
    path            text        NOT NULL CHECK (char_length(path) BETWEEN 1 AND 300),
    status_code     smallint    NOT NULL CHECK (status_code BETWEEN 100 AND 599),
    error_code      text        CHECK (char_length(error_code) <= 50),
    duration_ms     integer     NOT NULL CHECK (duration_ms >= 0),
    ip              inet,
    request_id      text        CHECK (char_length(request_id) <= 100)
);
CREATE INDEX api_call_logs_company_idx ON core.api_call_logs (company_id, called_at DESC);
CREATE INDEX api_call_logs_key_idx ON core.api_call_logs (api_key_id, called_at DESC);
CREATE INDEX api_call_logs_called_idx ON core.api_call_logs (called_at);
