-- CONG_VIEC_45 lát L0: đơn mua nhập khẩu bằng ngoại tệ, phiếu nhập và trả hàng theo tỷ giá, công nợ kèm ngoại tệ (QUYTAC_NGHIEPVU_285, 286).

-- Đơn mua nhập khẩu: chọn được ngoại tệ; đơn không nhập khẩu giữ tiền tệ công ty (kiểm trong service).
ALTER TABLE purchasing.orders ADD COLUMN is_import boolean NOT NULL DEFAULT false;

-- Phiếu nhập mua, trả hàng theo đơn ngoại tệ: tiền tệ đơn và tỷ giá hạch toán ngày phiếu nhập (trả hàng lấy tỷ giá phiếu nhập gốc). Trống: tiền tệ công ty.
ALTER TABLE inventory.documents ADD COLUMN currency char(3) REFERENCES core.currencies(code);
ALTER TABLE inventory.documents ADD COLUMN exchange_rate numeric(20,8) CHECK (exchange_rate > 0);
ALTER TABLE inventory.documents ADD CONSTRAINT documents_currency_rate_check CHECK ((currency IS NULL) = (exchange_rate IS NULL));

-- Công nợ ghi theo tiền tệ công ty; số ngoại tệ, tỷ giá chỉ để đối chiếu (quyết định người dùng 2026-11-11).
ALTER TABLE finance.debt_items ADD COLUMN currency char(3) REFERENCES core.currencies(code);
ALTER TABLE finance.debt_items ADD COLUMN foreign_amount numeric(20,4) CHECK (foreign_amount > 0);
ALTER TABLE finance.debt_items ADD COLUMN exchange_rate numeric(20,8) CHECK (exchange_rate > 0);
ALTER TABLE finance.debt_items ADD CONSTRAINT debt_items_foreign_check CHECK ((currency IS NULL) = (foreign_amount IS NULL) AND (currency IS NULL) = (exchange_rate IS NULL));

-- Tiền gồm thuế, chưa thuế của phiếu kho đã ghi sổ: như 0011, thêm nhân tỷ giá của phiếu nhập (nhập mua) hoặc phiếu nhập gốc (trả hàng nhà cung cấp).
CREATE OR REPLACE FUNCTION finance.inventory_amounts(document uuid, OUT gross numeric, OUT net numeric) LANGUAGE sql STABLE AS $$
    WITH d AS (SELECT id, type, company_id, posted_at, exchange_rate, finance.company_minor_units(company_id) AS units FROM inventory.documents WHERE id = document),
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
        -- Nhập mua: phần đạt kiểm tra chất lượng, lũy kế các phiếu nhập ghi sổ trước của cùng dòng đơn mua; đơn ngoại tệ nhân tỷ giá của phiếu (QUYTAC_NGHIEPVU_286).
        SELECT pl.amount * coalesce(d.exchange_rate, 1) * (1 + CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END),
            pl.amount * coalesce(d.exchange_rate, 1), pl.base_quantity,
            abs(dl.base_quantity) - coalesce(dl.rejected_base_quantity, 0),
            coalesce((SELECT sum(abs(o.base_quantity) - coalesce(o.rejected_base_quantity, 0)) FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
                      WHERE o.source_line_id = pl.id AND od.type = 'purchase_receipt' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)), 0)
        FROM d JOIN inventory.document_lines dl ON dl.document_id = d.id JOIN purchasing.order_lines pl ON pl.id = dl.source_line_id
        WHERE d.type = 'purchase_receipt'
        UNION ALL
        -- Trả hàng nhà cung cấp: lũy kế các phiếu trả ghi sổ trước của cùng dòng đơn mua; đơn ngoại tệ nhân tỷ giá của phiếu nhập gốc.
        SELECT pl.amount * coalesce(ir.exchange_rate, 1) * (1 + CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END),
            pl.amount * coalesce(ir.exchange_rate, 1), pl.base_quantity, abs(rl.base_quantity),
            coalesce((SELECT sum(abs(o.base_quantity)) FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
                      JOIN inventory.document_lines oi ON oi.id = o.source_line_id
                      WHERE oi.source_line_id = pl.id AND od.type = 'purchase_return' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)), 0)
        FROM d JOIN inventory.document_lines rl ON rl.document_id = d.id JOIN inventory.document_lines il ON il.id = rl.source_line_id
        JOIN inventory.documents ir ON ir.id = il.document_id
        JOIN purchasing.order_lines pl ON pl.id = il.source_line_id
        WHERE d.type = 'purchase_return'
    )
    SELECT coalesce(sum(finance.line_share(total, before, quantity, base, (SELECT units FROM d))), 0),
           coalesce(sum(finance.line_share(net_total, before, quantity, base, (SELECT units FROM d))), 0)
    FROM lines
$$;

-- Số ngoại tệ (gồm thuế theo đơn mua) của phiếu nhập mua, trả hàng theo đơn ngoại tệ; trống khi phiếu theo tiền tệ công ty.
CREATE FUNCTION finance.inventory_foreign_amount(document uuid) RETURNS numeric LANGUAGE sql STABLE AS $$
    WITH d AS (
        SELECT dc.id, dc.type, dc.currency, coalesce(cur.minor_units, 0) AS units FROM inventory.documents dc LEFT JOIN core.currencies cur ON cur.code = dc.currency
        WHERE dc.id = document AND dc.currency IS NOT NULL AND dc.type IN ('purchase_receipt', 'purchase_return')),
    lines AS (
        SELECT pl.amount * (1 + CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END) AS total, pl.base_quantity AS base,
            abs(dl.base_quantity) - coalesce(dl.rejected_base_quantity, 0) AS quantity
        FROM d JOIN inventory.document_lines dl ON dl.document_id = d.id JOIN purchasing.order_lines pl ON pl.id = dl.source_line_id
        WHERE d.type = 'purchase_receipt'
        UNION ALL
        SELECT pl.amount * (1 + CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END), pl.base_quantity, abs(rl.base_quantity)
        FROM d JOIN inventory.document_lines rl ON rl.document_id = d.id JOIN inventory.document_lines il ON il.id = rl.source_line_id
        JOIN purchasing.order_lines pl ON pl.id = il.source_line_id
        WHERE d.type = 'purchase_return'
    )
    SELECT round(sum(total * quantity / base), (SELECT units FROM d)) FROM lines
$$;
