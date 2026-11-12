-- CONG_VIEC_22 (THAY_DOI_26): ghi chú chăm sóc khách người mua, ngày hẹn tiếp theo (QUYTAC_NGHIEPVU_435, 436).
-- Ghi chú không sửa, không xóa; chỉ cột đã xong của hẹn được cập nhật một lần.
CREATE TABLE marketplace.customer_care_notes (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          uuid        NOT NULL REFERENCES core.companies(id),      -- công ty vận hành sàn của người ghi
    buyer_user_id       uuid        NOT NULL REFERENCES marketplace.buyer_accounts(user_id),
    author_user_id      uuid        NOT NULL REFERENCES core.users(id),
    channel             text        NOT NULL CHECK (channel IN ('call', 'message', 'meeting', 'other')),
    content             text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
    follow_up_on        date,
    follow_up_done_at   timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (follow_up_done_at IS NULL OR follow_up_on IS NOT NULL)
);
CREATE INDEX customer_care_notes_buyer_idx ON marketplace.customer_care_notes (buyer_user_id, created_at DESC, id DESC);
-- Hẹn còn chờ của người ghi (danh sách hẹn, nhắc hẹn).
CREATE INDEX customer_care_notes_follow_up_idx ON marketplace.customer_care_notes (author_user_id, follow_up_on) WHERE follow_up_on IS NOT NULL AND follow_up_done_at IS NULL;
