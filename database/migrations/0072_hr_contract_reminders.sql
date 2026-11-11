-- CONG_VIEC_46 lát L2: mốc nhắc hết hạn hợp đồng đã gửi (QUYTAC_NGHIEPVU_301), mỗi mốc gửi một lần cho mỗi hợp đồng.
CREATE TABLE hr.contract_reminders (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      uuid        NOT NULL REFERENCES core.companies(id),
    contract_id     uuid        NOT NULL REFERENCES hr.contracts(id),
    milestone       text        NOT NULL CHECK (milestone IN ('before_30', 'before_7', 'after_1', 'after_8', 'after_15', 'after_22', 'after_29')),
    recipient_count integer     NOT NULL,
    sent_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (contract_id, milestone)
);
