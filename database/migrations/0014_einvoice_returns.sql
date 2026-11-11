-- CONG_VIEC_16 lát L1: xử lý hóa đơn khi trả hàng, hóa đơn thay thế (CHUC_NANG_78, 79; QUYTAC_NGHIEPVU_106, 107; tài liệu 16).

-- Việc chờ kế toán xử lý hóa đơn của phiếu nhận hàng trả lại.
CREATE TABLE finance.einvoice_return_tasks (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    return_document_id      uuid        NOT NULL UNIQUE REFERENCES inventory.documents(id),
    original_invoice_id     uuid        NOT NULL REFERENCES finance.einvoices(id),   -- hóa đơn của phiếu xuất gốc
    status                  text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'adjusted', 'buyer_invoice')),
    adjustment_invoice_id   uuid        REFERENCES finance.einvoices(id),
    buyer_invoice_series    text,
    buyer_invoice_no        text,
    buyer_invoice_date      date,
    resolved_by             uuid        REFERENCES core.users(id),
    resolved_at             timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 0,
    CHECK (status <> 'adjusted' OR adjustment_invoice_id IS NOT NULL),
    CHECK (status <> 'buyer_invoice' OR (buyer_invoice_no IS NOT NULL AND buyer_invoice_date IS NOT NULL))
);
CREATE INDEX einvoice_return_tasks_company_idx ON finance.einvoice_return_tasks (company_id, status, created_at DESC);

-- Hóa đơn điều chỉnh có nguồn là phiếu nhận hàng trả lại; hóa đơn thay thế cùng nguồn với hóa đơn bị thay thế.
CREATE INDEX einvoices_related_idx ON finance.einvoices (related_invoice_id) WHERE related_invoice_id IS NOT NULL;
