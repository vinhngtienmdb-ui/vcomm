// Số đã dùng, số còn được mua của ô ngân sách (QUYTAC_NGHIEPVU_446, 447, 450).
import { sql, type SQL } from "drizzle-orm";
import { receivedOnOrderLine } from "./orders.service";
import type { Executor } from "./purchasing-context";

// Ngành hàng cấp 1 của ngành hàng trên dòng (cây tối đa 4 cấp): tổ tiên sâu nhất khác rỗng.
const topCategory = sql`coalesce(c4.id, c3.id, c2.id, c1.id)`;
const categoryJoins = sql`JOIN catalog.variants v ON v.id = ol.variant_id JOIN catalog.products p ON p.id = v.product_id
  JOIN catalog.categories c1 ON c1.id = p.category_id LEFT JOIN catalog.categories c2 ON c2.id = c1.parent_id
  LEFT JOIN catalog.categories c3 ON c3.id = c2.parent_id LEFT JOIN catalog.categories c4 ON c4.id = c3.parent_id`;

// Giá trị chưa thuế của dòng tính vào ngân sách, theo đồng tiền của đơn:
// đã duyệt, đã nhận đủ: giá trị dòng; đã đóng: phần đã nhận đạt; đơn từng được duyệt đang duyệt lại (hoặc lần duyệt lại bị từ chối, rút): không vượt tổng lần duyệt gần nhất.
const countedLineAmount = sql`CASE
  WHEN o.status IN ('approved', 'received') THEN ol.amount
  WHEN o.status = 'closed' THEN round(ol.amount * least(ol.base_quantity, ${receivedOnOrderLine(sql`ol.id`)}) / ol.base_quantity, 4)
  WHEN o.status IN ('pending', 'rejected', 'withdrawn') AND o.approved_total IS NOT NULL THEN
    CASE WHEN o.total_amount > o.approved_total AND o.total_amount > 0 THEN round(ol.amount * o.approved_total / o.total_amount, 4) ELSE ol.amount END
  ELSE 0 END`;

// Tỷ giá hạch toán từ đồng tiền của đơn sang đồng tiền hạch toán của công ty tại ngày đơn (gần nhất không sau ngày đơn), nhập tay ưu tiên.
export const rateToCompany = (fromCurrency: SQL, toCurrency: SQL, onDate: SQL) => sql`CASE WHEN ${fromCurrency} = ${toCurrency} THEN 1 ELSE (
  SELECT r.rate FROM core.exchange_rates r WHERE r.from_currency = ${fromCurrency} AND r.to_currency = ${toCurrency} AND r.rate_type = 'accounting' AND r.rate_date <= ${onDate}
  ORDER BY r.rate_date DESC, r.source = 'manual' DESC, r.created_at DESC LIMIT 1) END`;

export type UsedCell = { category_id: string; warehouse_id: string; month: string; used: string };

// Số đã dùng theo ô (ngành hàng cấp 1, kho nhận, tháng của ngày đơn) trong khoảng tháng; bỏ một đơn khi cần (kiểm tra cho chính đơn đó).
export async function usedByCell(executor: Executor, companyId: string, fromMonth: string, toMonth: string, excludeOrderId: string | null = null): Promise<UsedCell[]> {
  const rows = await executor.execute<UsedCell>(sql`
    SELECT ${topCategory} AS category_id, o.warehouse_id, to_char(o.order_date, 'YYYY-MM') AS month,
      round(sum((${countedLineAmount}) * coalesce(${rateToCompany(sql`o.currency`, sql`co.base_currency`, sql`o.order_date`)}, 0)), 4)::text AS used
    FROM purchasing.orders o JOIN core.companies co ON co.id = o.company_id JOIN purchasing.order_lines ol ON ol.order_id = o.id ${categoryJoins}
    WHERE o.company_id = ${companyId} AND o.order_date >= ${`${fromMonth}-01`}::date AND o.order_date < (${`${toMonth}-01`}::date + interval '1 month')
      AND o.status IN ('approved', 'received', 'closed', 'pending', 'rejected', 'withdrawn')
      ${excludeOrderId ? sql`AND o.id <> ${excludeOrderId}` : sql``}
    GROUP BY 1, 2, 3`);
  return rows.rows.filter((row) => Number(row.used) !== 0);
}

export type CellOrder = { id: string; document_no: string | null; supplier_name: string; order_date: string; status: string; currency: string; amount: string };

// Các đơn đã tính vào một ô (API_239).
export async function ordersOfCell(executor: Executor, companyId: string, categoryId: string, warehouseId: string, month: string): Promise<CellOrder[]> {
  const rows = await executor.execute<CellOrder>(sql`
    SELECT o.id, o.document_no, s.name AS supplier_name, to_char(o.order_date, 'YYYY-MM-DD') AS order_date, o.status, o.currency,
      round(sum((${countedLineAmount}) * coalesce(${rateToCompany(sql`o.currency`, sql`co.base_currency`, sql`o.order_date`)}, 0)), 4)::text AS amount
    FROM purchasing.orders o JOIN core.companies co ON co.id = o.company_id JOIN crm.partners s ON s.id = o.supplier_id
      JOIN purchasing.order_lines ol ON ol.order_id = o.id ${categoryJoins}
    WHERE o.company_id = ${companyId} AND o.warehouse_id = ${warehouseId} AND ${topCategory} = ${categoryId}
      AND o.order_date >= ${`${month}-01`}::date AND o.order_date < (${`${month}-01`}::date + interval '1 month')
      AND o.status IN ('approved', 'received', 'closed', 'pending', 'rejected', 'withdrawn')
    GROUP BY o.id, s.name
    HAVING sum(${countedLineAmount}) <> 0
    ORDER BY o.order_date, o.document_no`);
  return rows.rows;
}
