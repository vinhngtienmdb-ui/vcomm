// Số đã dùng, số còn được mua của ô ngân sách (QUYTAC_NGHIEPVU_446, 447, 450).
import type { BudgetCheckCell, BudgetCheckResponse } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import type { Executor } from "./purchasing-context";

// Ngành hàng cấp 1 của ngành hàng trên dòng (cây tối đa 4 cấp): tổ tiên sâu nhất khác rỗng.
const topCategory = sql`coalesce(c4.id, c3.id, c2.id, c1.id)`;
const categoryJoins = sql`JOIN catalog.variants v ON v.id = ol.variant_id JOIN catalog.products p ON p.id = v.product_id
  JOIN catalog.categories c1 ON c1.id = p.category_id LEFT JOIN catalog.categories c2 ON c2.id = c1.parent_id
  LEFT JOIN catalog.categories c3 ON c3.id = c2.parent_id LEFT JOIN catalog.categories c4 ON c4.id = c3.parent_id`;

// Số nhận đạt đã ghi sổ của dòng đơn (cùng cách tính receivedOnOrderLine của đơn mua; viết lại ở đây để tránh nhập vòng giữa hai tệp).
const receivedGood = sql`coalesce((
  SELECT sum(dl.base_quantity - coalesce(dl.rejected_base_quantity, 0)) FROM inventory.document_lines dl JOIN inventory.documents d ON d.id = dl.document_id
  WHERE dl.source_line_id = ol.id AND d.type = 'purchase_receipt' AND d.status = 'posted'), 0)`;

// Giá trị chưa thuế của dòng tính vào ngân sách, theo đồng tiền của đơn:
// đã duyệt, đã nhận đủ: giá trị dòng; đã đóng: phần đã nhận đạt; đơn từng được duyệt đang duyệt lại (hoặc lần duyệt lại bị từ chối, rút): không vượt tổng lần duyệt gần nhất.
const countedLineAmount = sql`CASE
  WHEN o.status IN ('approved', 'received') THEN ol.amount
  WHEN o.status = 'closed' THEN round(ol.amount * least(ol.base_quantity, ${receivedGood}) / ol.base_quantity, 4)
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

export type BudgetCheckInput = { warehouseId: string | null; orderDate: string; currency: string; lines: { variantId: string; amount: string }[] };

// Kiểm tra ngân sách của một đơn (QUYTAC_NGHIEPVU_450 đến 452): giá trị đơn theo ô so với số còn được mua không gồm chính đơn.
// lock: khóa theo công ty trong giao dịch gửi duyệt để hai đơn gửi cùng lúc không cùng lọt trong ngân sách.
export async function checkBudget(executor: Executor, companyId: string, input: BudgetCheckInput, excludeOrderId: string | null, lock = false): Promise<BudgetCheckResponse> {
  const currency = (await executor.execute<{ base_currency: string }>(sql`SELECT base_currency FROM core.companies WHERE id = ${companyId}`)).rows[0]!.base_currency;
  const month = input.orderDate.slice(0, 7);
  const covered = await executor.execute(sql`
    SELECT 1 FROM purchasing.budget_plans WHERE company_id = ${companyId} AND status = 'approved' AND from_month <= ${`${month}-01`}::date AND to_month >= ${`${month}-01`}::date LIMIT 1`);
  if (covered.rows.length === 0 || !input.warehouseId || input.lines.length === 0) return { applies: covered.rows.length > 0, overBudget: false, currency, cells: [] };
  if (lock) await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext('purchasing.budget'), hashtext(${companyId}))`);
  const rate = (await executor.execute<{ rate: string | null }>(sql`SELECT (${rateToCompany(sql`${input.currency}::text`, sql`${currency}::text`, sql`${input.orderDate}::date`)})::text AS rate`))
    .rows[0]!.rate;
  if (rate === null) throw new ApiError("BUSINESS_RULE", "exchangeRateMissing");
  const variantIds = [...new Set(input.lines.map((line) => line.variantId))];
  const categoryOf = new Map(
    (
      await executor.execute<{ variant_id: string; category_id: string }>(sql`
      SELECT v.id AS variant_id, ${topCategory} AS category_id FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
        JOIN catalog.categories c1 ON c1.id = p.category_id LEFT JOIN catalog.categories c2 ON c2.id = c1.parent_id
        LEFT JOIN catalog.categories c3 ON c3.id = c2.parent_id LEFT JOIN catalog.categories c4 ON c4.id = c3.parent_id
      WHERE v.id IN (${sql.join(
        variantIds.map((id) => sql`${id}`),
        sql`, `,
      )})`)
    ).rows.map((row) => [row.variant_id, row.category_id]),
  );
  const orderByCategory = new Map<string, number>();
  for (const line of input.lines) {
    const categoryId = categoryOf.get(line.variantId);
    if (categoryId) orderByCategory.set(categoryId, (orderByCategory.get(categoryId) ?? 0) + Number(line.amount) * Number(rate));
  }
  const categoryIds = [...orderByCategory.keys()];
  if (categoryIds.length === 0) return { applies: true, overBudget: false, currency, cells: [] };
  const inList = sql.join(
    categoryIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const budgets = new Map(
    (
      await executor.execute<{ category_id: string; budget: string }>(sql`
      SELECT l.category_id, sum(l.amount + l.adjusted_amount)::text AS budget FROM purchasing.budget_lines l JOIN purchasing.budget_plans b ON b.id = l.plan_id
      WHERE b.company_id = ${companyId} AND b.status = 'approved' AND l.warehouse_id = ${input.warehouseId} AND l.month = ${`${month}-01`}::date AND l.category_id IN (${inList})
      GROUP BY l.category_id`)
    ).rows.map((row) => [row.category_id, Number(row.budget)]),
  );
  const used = await usedByCell(executor, companyId, month, month, excludeOrderId);
  const names = new Map(
    (await executor.execute<{ id: string; code: string; name: string }>(sql`SELECT id, code, name_vi AS name FROM catalog.categories WHERE id IN (${inList})`)).rows.map((row) => [row.id, row]),
  );
  const warehouseName = (await executor.execute<{ name: string }>(sql`SELECT name FROM inventory.warehouses WHERE id = ${input.warehouseId}`)).rows[0]?.name ?? "";
  const money = (value: number) => trimDecimal(value.toFixed(4));
  const cells: BudgetCheckCell[] = categoryIds
    .map((categoryId) => {
      const budget = budgets.get(categoryId);
      const usedAmount = Number(used.find((cell) => cell.category_id === categoryId && cell.warehouse_id === input.warehouseId)?.used ?? 0);
      const orderAmount = orderByCategory.get(categoryId)!;
      const remainingAfter = budget === undefined ? null : budget - usedAmount - orderAmount;
      return {
        categoryId,
        categoryCode: names.get(categoryId)?.code ?? "",
        categoryName: names.get(categoryId)?.name ?? "",
        warehouseId: input.warehouseId!,
        warehouseName,
        month,
        budget: budget === undefined ? null : money(budget),
        used: money(usedAmount),
        order: money(orderAmount),
        remainingAfter: remainingAfter === null ? null : money(remainingAfter),
        // Sai số làm tròn 4 chữ số lẻ không tính là vượt.
        status: remainingAfter === null ? "missing" : remainingAfter < -0.00005 ? "over" : "within",
      } satisfies BudgetCheckCell;
    })
    .sort((left, right) => left.categoryCode.localeCompare(right.categoryCode));
  return { applies: true, overBudget: cells.some((cell) => cell.status !== "within"), currency, cells };
}
