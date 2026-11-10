-- CONG_VIEC_14: Kế toán tổng hợp (MODULE_06, phần 2; tài liệu 16).
CREATE SCHEMA IF NOT EXISTS accounting;

-- Ngày khóa sổ của công ty đã khởi tạo kế toán (QUYTAC_NGHIEPVU_93, 97); chế độ kế toán lấy từ core.companies.accounting_regime. Không có dòng: chưa khởi tạo.
CREATE TABLE accounting.settings (
    company_id              uuid        PRIMARY KEY REFERENCES core.companies(id),
    locked_through          date,                                                   -- đã khóa sổ đến hết ngày này
    initialized_by          uuid        NOT NULL REFERENCES core.users(id),
    initialized_at          timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1
);

-- Hệ thống tài khoản của công ty (QUYTAC_NGHIEPVU_93).
CREATE TABLE accounting.accounts (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    code                    text        NOT NULL CHECK (code ~ '^[0-9A-Za-z]{3,20}$'),
    name                    text        NOT NULL,
    parent_id               uuid        REFERENCES accounting.accounts(id),
    nature                  text        NOT NULL CHECK (nature IN ('debit', 'credit', 'both')),
    is_system               boolean     NOT NULL DEFAULT false,                     -- nạp từ chế độ kế toán
    status                  text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    UNIQUE (company_id, code)
);
CREATE INDEX accounts_parent_idx ON accounting.accounts (parent_id);

-- Định khoản mặc định: vai trò tài khoản dùng khi sinh bút toán (QUYTAC_NGHIEPVU_94).
CREATE TABLE accounting.posting_rules (
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    role                    text        NOT NULL,
    account_id              uuid        NOT NULL REFERENCES accounting.accounts(id),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    updated_by              uuid        REFERENCES core.users(id),
    PRIMARY KEY (company_id, role)
);

-- Bút toán (chứng từ kế toán): tự sinh từ chứng từ nghiệp vụ, phiếu kế toán nhập tay, kết chuyển khóa sổ (QUYTAC_NGHIEPVU_95 đến 97).
CREATE TABLE accounting.journals (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              uuid        NOT NULL REFERENCES core.companies(id),
    journal_no              text,                                                   -- phiếu kế toán: cấp khi gửi; tự sinh: số chứng từ gốc
    journal_date            date        NOT NULL,
    source_type             text        NOT NULL CHECK (source_type IN ('manual', 'inventory_document', 'payment', 'internal_write_off', 'closing')),
    source_id               uuid,                                                   -- phiếu kho, phiếu thu chi, biên bản; kết chuyển, nhập tay: trống
    description             text        NOT NULL,
    status                  text        NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'pending', 'posted', 'rejected', 'withdrawn')),
    approval_request_id     uuid        REFERENCES core.approval_requests(id),
    post_error              text,                                                   -- khóa thông báo khi duyệt xong nhưng không ghi sổ được (kỳ đã khóa)
    total_amount            numeric(20,4) NOT NULL DEFAULT 0,                       -- tổng Nợ
    created_by              uuid        REFERENCES core.users(id),
    posted_at               timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    version                 integer     NOT NULL DEFAULT 1,
    CHECK (source_type = 'manual' OR status = 'posted')
);
CREATE UNIQUE INDEX journals_source_idx ON accounting.journals (source_type, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX journals_company_idx ON accounting.journals (company_id, status, journal_date);
CREATE INDEX journals_approval_idx ON accounting.journals (approval_request_id);

CREATE TABLE accounting.journal_lines (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id              uuid        NOT NULL REFERENCES accounting.journals(id) ON DELETE CASCADE,
    line_no                 integer     NOT NULL,
    account_id              uuid        NOT NULL REFERENCES accounting.accounts(id),
    partner_id              uuid        REFERENCES crm.partners(id),
    debit                   numeric(20,4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit                  numeric(20,4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
    description             text,
    UNIQUE (journal_id, line_no),
    CHECK ((debit > 0) <> (credit > 0))
);
CREATE INDEX journal_lines_account_idx ON accounting.journal_lines (account_id);
CREATE INDEX journal_lines_partner_idx ON accounting.journal_lines (partner_id);

-- THAY_DOI_10: tiền công nợ, bút toán làm tròn theo đơn vị nhỏ nhất của tiền tệ công ty. Mỗi lần giao, nhận, trả của một dòng đơn lấy phần
-- theo số lượng lũy kế (làm tròn lũy kế sau trừ làm tròn lũy kế trước) để tổng các lần đúng bằng tiền của dòng đơn.
CREATE FUNCTION finance.company_minor_units(company uuid) RETURNS integer LANGUAGE sql STABLE AS $$
    SELECT coalesce((SELECT cur.minor_units FROM core.companies c JOIN core.currencies cur ON cur.code = c.base_currency WHERE c.id = company), 0)
$$;

CREATE FUNCTION finance.line_share(amount numeric, before numeric, quantity numeric, base numeric, units integer) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
    SELECT round(amount * least(before + quantity, base) / base, units) - round(amount * least(before, base) / base, units)
$$;

-- Tiền gồm thuế và chưa thuế của phiếu kho đã ghi sổ (phiếu đang ghi sổ đã có posted_at): xuất giao hàng, nhận hàng trả lại theo đơn bán;
-- nhập mua (phần đạt kiểm tra chất lượng), trả hàng nhà cung cấp theo đơn mua.
CREATE FUNCTION finance.inventory_amounts(document uuid, OUT gross numeric, OUT net numeric) LANGUAGE sql STABLE AS $$
    WITH d AS (SELECT id, type, company_id, posted_at, finance.company_minor_units(company_id) AS units FROM inventory.documents WHERE id = document),
    lines AS (
        -- Xuất giao hàng: lũy kế các phiếu xuất ghi sổ trước của cùng dòng đơn bán.
        SELECT sl.total_amount AS total, sl.net_amount AS net_total, sl.base_quantity AS base, abs(dl.base_quantity) AS quantity,
            coalesce((SELECT sum(abs(o.base_quantity)) FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
                      WHERE o.source_line_id = sl.id AND od.type = 'sales_issue' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)), 0) AS before
        FROM d JOIN inventory.document_lines dl ON dl.document_id = d.id JOIN sales.order_lines sl ON sl.id = dl.source_line_id
        WHERE d.type = 'sales_issue'
        UNION ALL
        -- Nhận hàng trả lại: lũy kế các phiếu trả ghi sổ trước của cùng dòng đơn bán.
        SELECT sl.total_amount, sl.net_amount, sl.base_quantity, abs(rl.base_quantity),
            coalesce((SELECT sum(abs(o.base_quantity)) FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
                      JOIN inventory.document_lines oi ON oi.id = o.source_line_id
                      WHERE oi.source_line_id = sl.id AND od.type = 'sales_return' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)), 0)
        FROM d JOIN inventory.document_lines rl ON rl.document_id = d.id JOIN inventory.document_lines il ON il.id = rl.source_line_id
        JOIN sales.order_lines sl ON sl.id = il.source_line_id
        WHERE d.type = 'sales_return'
        UNION ALL
        -- Nhập mua: phần đạt kiểm tra chất lượng, lũy kế các phiếu nhập ghi sổ trước của cùng dòng đơn mua.
        SELECT pl.amount * (1 + CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END), pl.amount, pl.base_quantity,
            abs(dl.base_quantity) - coalesce(dl.rejected_base_quantity, 0),
            coalesce((SELECT sum(abs(o.base_quantity) - coalesce(o.rejected_base_quantity, 0)) FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
                      WHERE o.source_line_id = pl.id AND od.type = 'purchase_receipt' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)), 0)
        FROM d JOIN inventory.document_lines dl ON dl.document_id = d.id JOIN purchasing.order_lines pl ON pl.id = dl.source_line_id
        WHERE d.type = 'purchase_receipt'
        UNION ALL
        -- Trả hàng nhà cung cấp: lũy kế các phiếu trả ghi sổ trước của cùng dòng đơn mua.
        SELECT pl.amount * (1 + CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END), pl.amount, pl.base_quantity, abs(rl.base_quantity),
            coalesce((SELECT sum(abs(o.base_quantity)) FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
                      JOIN inventory.document_lines oi ON oi.id = o.source_line_id
                      WHERE oi.source_line_id = pl.id AND od.type = 'purchase_return' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)), 0)
        FROM d JOIN inventory.document_lines rl ON rl.document_id = d.id JOIN inventory.document_lines il ON il.id = rl.source_line_id
        JOIN purchasing.order_lines pl ON pl.id = il.source_line_id
        WHERE d.type = 'purchase_return'
    )
    SELECT coalesce(sum(finance.line_share(total, before, quantity, base, (SELECT units FROM d))), 0),
           coalesce(sum(finance.line_share(net_total, before, quantity, base, (SELECT units FROM d))), 0)
    FROM lines
$$;

CREATE OR REPLACE FUNCTION finance.inventory_debt_amount(document uuid) RETURNS numeric LANGUAGE sql STABLE AS $$
    SELECT gross FROM finance.inventory_amounts(document)
$$;
