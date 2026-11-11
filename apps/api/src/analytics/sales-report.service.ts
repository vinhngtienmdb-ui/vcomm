// Báo cáo bán hàng (CONG_VIEC_50; CHUC_NANG_176; QUYTAC_NGHIEPVU_337, 338, 339, 343; API_171).
// Doanh số theo hàng đã giao: tiền mỗi dòng phiếu chia bằng đúng công thức của finance.inventory_amounts (bút toán doanh thu), giá vốn là giá trị đã ghi sổ của dòng phiếu.
import { Inject, Injectable } from "@nestjs/common";
import { analyticsDisplayRows, type AnalyticsSalesGrouping, type AnalyticsSalesResponse, type AnalyticsSalesRow, type analyticsSalesQuerySchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { AnalyticsScopeService, requirePeriod, type ReportScope } from "./analytics-scope.service";
import { periodNote, type ExportTable } from "./analytics-export";

type SalesQuery = z.infer<typeof analyticsSalesQuerySchema>;
export interface DeliveredFilter {
  from: string;
  to: string;
  channelId?: string | undefined;
  marketplaceOnly?: boolean;
  warehouseId?: string | undefined;
}
// Danh sách rỗng thành một mã không tồn tại để câu lệnh IN vẫn hợp lệ.
export const uuidList = (ids: string[]) =>
  sql.join(
    (ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]).map((id) => sql`${id}::uuid`),
    sql`, `,
  );

type FigureRow = { quantity: string; revenue: string; cost: string; internal_revenue: string };

@Injectable()
export class SalesReportService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly scopeService: AnalyticsScopeService,
  ) {}

  // Dòng phiếu xuất giao hàng (dấu +) và nhận hàng trả lại (dấu −) đã ghi sổ, ngày phiếu trong kỳ, kèm tiền chưa thuế, giá vốn, cờ bán nội bộ.
  // Báo cáo tồn kho dùng lại để lấy giá vốn hàng bán (QUYTAC_NGHIEPVU_340).
  base(scope: ReportScope, query: DeliveredFilter): SQL {
    const companies = uuidList(scope.companies.map((company) => company.id));
    const group = uuidList(scope.groupCompanyIds);
    const filter = sql`d.status = 'posted' AND d.company_id IN (${companies}) AND d.document_date BETWEEN ${query.from}::date AND ${query.to}::date`;
    return sql`
      SELECT d.company_id, d.warehouse_id, d.document_date, line.variant_id, line.sign, line.quantity, line.cost,
        finance.line_share(sl.net_amount, line.before, line.quantity, sl.base_quantity, coalesce(cur.minor_units, 0)) AS revenue,
        dc.base_currency AS currency,
        so.channel_id, (mo.id IS NOT NULL) AS is_marketplace,
        coalesce(p.company_id IN (${group}), false) AS is_internal
      FROM inventory.documents d
      CROSS JOIN LATERAL (
        SELECT 1 AS sign, dl.variant_id, abs(dl.base_quantity) AS quantity, coalesce(dl.cost_value, 0) AS cost, dl.source_line_id AS order_line_id,
          coalesce((SELECT sum(abs(o.base_quantity)) FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
                    WHERE o.source_line_id = dl.source_line_id AND od.type = 'sales_issue' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)), 0) AS before
        FROM inventory.document_lines dl WHERE dl.document_id = d.id AND d.type = 'sales_issue'
        UNION ALL
        SELECT -1, rl.variant_id, abs(rl.base_quantity), coalesce(rl.cost_value, 0), il.source_line_id,
          coalesce((SELECT sum(abs(o.base_quantity)) FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
                    JOIN inventory.document_lines oi ON oi.id = o.source_line_id
                    WHERE oi.source_line_id = il.source_line_id AND od.type = 'sales_return' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)), 0)
        FROM inventory.document_lines rl JOIN inventory.document_lines il ON il.id = rl.source_line_id WHERE rl.document_id = d.id AND d.type = 'sales_return'
      ) line
      -- Số lẻ tiền tệ như finance.company_minor_units, nối một lần thay cho gọi hàm từng dòng.
      JOIN core.companies dc ON dc.id = d.company_id
      LEFT JOIN core.currencies cur ON cur.code = dc.base_currency
      JOIN sales.order_lines sl ON sl.id = line.order_line_id
      JOIN sales.orders so ON so.id = sl.order_id
      LEFT JOIN marketplace.orders mo ON mo.sales_order_id = so.id
      LEFT JOIN marketplace.buyer_accounts ba ON ba.user_id = mo.buyer_user_id
      LEFT JOIN crm.partners p ON p.id = so.customer_id
      WHERE d.type IN ('sales_issue', 'sales_return') AND ${filter}
        AND NOT coalesce(ba.is_test_buyer, false)
        ${query.channelId ? sql`AND so.channel_id = ${query.channelId}` : sql``}
        ${query.marketplaceOnly ? sql`AND mo.id IS NOT NULL` : sql``}
        ${query.warehouseId ? sql`AND d.warehouse_id = ${query.warehouseId}` : sql``}`;
  }

  private keyOf(groupBy: AnalyticsSalesGrouping): SQL {
    switch (groupBy) {
      case "company":
        return sql`b.company_id::text`;
      case "channel":
        return sql`b.channel_id::text`;
      case "product":
        return sql`b.variant_id::text`;
      case "day":
        return sql`b.document_date::text`;
      case "month":
        return sql`to_char(b.document_date, 'YYYY-MM')`;
    }
  }

  // Xuất Excel lấy đủ dòng; màn hình hiện tối đa 500 dòng.
  async report(actor: Actor, query: SalesQuery, allRows = false): Promise<AnalyticsSalesResponse> {
    requirePeriod(query.from, query.to);
    const scope = await this.scopeService.resolve(actor, "sales", query.companyIds);
    const figures = sql`
      sum(b.sign * b.quantity)::text AS quantity, sum(b.sign * b.revenue)::text AS revenue, sum(b.sign * b.cost)::text AS cost,
      coalesce(sum(b.sign * b.revenue) FILTER (WHERE b.is_internal), 0)::text AS internal_revenue`;
    // Dòng nhóm theo khóa và đồng tiền hạch toán của công ty (công ty khác đồng tiền không gộp với công ty gốc); dòng có key rỗng là tổng theo đồng tiền.
    const grouped = (
      await this.database.execute<FigureRow & { key: string | null; currency: string }>(sql`
      WITH b AS (${this.base(scope, query)})
      SELECT ${this.keyOf(query.groupBy)} AS key, b.currency, ${figures}
      FROM b
      GROUP BY GROUPING SETS ((${this.keyOf(query.groupBy)}, b.currency), (b.currency))`)
    ).rows;
    const rows = grouped.filter((row): row is FigureRow & { key: string; currency: string } => row.key !== null);
    const labels = await this.labels(
      query.groupBy,
      rows.map((row) => row.key),
    );
    const order = new Map(scope.companies.map((company, index) => [company.id, index]));
    const toRow = (row: FigureRow & { key: string; currency: string }): AnalyticsSalesRow => ({
      key: row.key,
      label: labels.get(row.key) ?? row.key,
      currency: row.currency,
      inTotal: row.currency === scope.group.currency,
      ...this.figures(row),
    });
    const sorted = rows.map(toRow);
    if (query.groupBy === "company") sorted.sort((a, b) => order.get(a.key)! - order.get(b.key)!);
    else if (query.groupBy === "day" || query.groupBy === "month") sorted.sort((a, b) => a.key.localeCompare(b.key) || a.currency.localeCompare(b.currency));
    else sorted.sort((a, b) => Number(b.revenue) - Number(a.revenue) || a.label.localeCompare(b.label));
    const totalRows = sorted.length > analyticsDisplayRows ? sorted.length : null;
    // Tổng các công ty cùng đồng tiền với công ty gốc, tính trong cơ sở dữ liệu để không sai số làm tròn.
    const totals = grouped.find((row) => row.key === null && row.currency === scope.group.currency) ?? { quantity: "0", revenue: "0", cost: "0", internal_revenue: "0" };
    const totalFigures = this.figures(totals);
    return {
      from: query.from,
      to: query.to,
      groupBy: query.groupBy,
      currency: scope.group.currency,
      companies: scope.companies,
      channels: await this.channels(scope),
      rows: allRows ? sorted : sorted.slice(0, analyticsDisplayRows),
      totals: { ...totalFigures, revenueExcludingInternal: trimDecimal(subtract(totalFigures.revenue, totalFigures.internalRevenue)) },
      totalRows,
    };
  }

  private figures(row: FigureRow) {
    const zero = (value: string | null) => trimDecimal(value ?? "0");
    return {
      quantity: zero(row.quantity),
      revenue: zero(row.revenue),
      cost: zero(row.cost),
      grossProfit: trimDecimal(subtract(row.revenue ?? "0", row.cost ?? "0")),
      internalRevenue: zero(row.internal_revenue),
    };
  }

  async labels(groupBy: AnalyticsSalesGrouping, keys: string[]): Promise<Map<string, string>> {
    const ids = keys.filter((key) => /^[0-9a-f-]{36}$/.test(key));
    if (ids.length === 0 || groupBy === "day" || groupBy === "month")
      return new Map(keys.map((key) => [key, groupBy === "day" ? key.split("-").reverse().join("/") : groupBy === "month" ? key.split("-").reverse().join("/") : key]));
    const rows =
      groupBy === "company"
        ? await this.database.execute<{ id: string; label: string }>(
            sql`SELECT id::text, code || ' · ' || coalesce(short_name, legal_name) AS label FROM core.companies WHERE id IN (${uuidList(ids)})`,
          )
        : groupBy === "channel"
          ? await this.database.execute<{ id: string; label: string }>(sql`
            SELECT ch.id::text, c.code || ' · ' || ch.name AS label FROM catalog.sales_channels ch JOIN core.companies c ON c.id = ch.company_id WHERE ch.id IN (${uuidList(ids)})`)
          : await this.database.execute<{ id: string; label: string }>(sql`
            SELECT v.id::text, v.sku || ' · ' || p.name
              || CASE WHEN jsonb_array_length(v.option_values) > 0 THEN ' (' || (SELECT string_agg(value, ', ') FROM jsonb_array_elements_text(v.option_values)) || ')' ELSE '' END
              || ' · ' || c.code AS label
            FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id JOIN core.companies c ON c.id = v.company_id WHERE v.id IN (${uuidList(ids)})`);
    return new Map(rows.rows.map((row) => [row.id, row.label]));
  }

  private async channels(scope: ReportScope): Promise<{ id: string; label: string }[]> {
    return (
      await this.database.execute<{ id: string; label: string }>(sql`
      SELECT ch.id::text, c.code || ' · ' || ch.name AS label FROM catalog.sales_channels ch JOIN core.companies c ON c.id = ch.company_id
      WHERE ch.company_id IN (${uuidList(scope.companies.map((company) => company.id))}) ORDER BY c.code, ch.name`)
    ).rows;
  }

  exportTable(report: AnalyticsSalesResponse): ExportTable {
    const groupTitle = { company: "Công ty", channel: "Kênh", product: "Sản phẩm", day: "Ngày", month: "Tháng" }[report.groupBy];
    const line = (row: { quantity: string; revenue: string; cost: string; grossProfit: string; internalRevenue: string }) => [
      row.quantity,
      row.revenue,
      row.cost,
      row.grossProfit,
      margin(row.revenue, row.grossProfit),
      row.internalRevenue,
    ];
    return {
      title: "Báo cáo bán hàng",
      notes: [
        `Công ty: ${report.companies.map((company) => company.code).join(", ")}`,
        periodNote(report.from, report.to),
        `Doanh số theo hàng đã giao, chưa thuế giá trị gia tăng. Đơn vị tiền: ${report.currency}; dòng khác đồng tiền không cộng vào tổng.`,
      ],
      columns: [
        { title: groupTitle },
        { title: "Đồng tiền" },
        ...["Số lượng", "Doanh số chưa thuế", "Giá vốn", "Lãi gộp", "Tỷ lệ lãi gộp (%)", "Trong đó bán nội bộ"].map((title) => ({ title, numeric: true })),
      ],
      rows: report.rows.map((row) => [row.label, row.currency, ...line(row)]),
      totals: [
        ["Cộng các công ty", report.currency, ...line(report.totals)],
        ["Tổng loại trừ nội bộ", report.currency, null, report.totals.revenueExcludingInternal, null, null, null, null],
      ],
    };
  }
}

// Phép trừ trên chuỗi số thập phân (tối đa 4 chữ số lẻ) không qua số thực.
export function subtract(left: string, right: string): string {
  const scaled = (value: string) => {
    const [whole, fraction = ""] = value.replace("-", "").split(".");
    const result = BigInt(whole! + fraction.padEnd(4, "0").slice(0, 4));
    return value.startsWith("-") ? -result : result;
  };
  const difference = scaled(left) - scaled(right);
  const negative = difference < 0n;
  const digits = (negative ? -difference : difference).toString().padStart(5, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -4)}.${digits.slice(-4)}`;
}

// Tỷ lệ lãi gộp (%), để trống khi doanh số bằng 0.
export function margin(revenue: string, grossProfit: string): string | null {
  return Number(revenue) === 0 ? null : ((Number(grossProfit) / Number(revenue)) * 100).toFixed(2);
}
