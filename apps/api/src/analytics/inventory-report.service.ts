// Báo cáo tồn kho và luân chuyển (CONG_VIEC_50; CHUC_NANG_176; QUYTAC_NGHIEPVU_339, 340, 343; API_172).
// Đầu kỳ, nhập, xuất, cuối kỳ lấy từ thẻ kho (inventory.movements, ngày theo giờ Việt Nam như thẻ kho); giá vốn hàng bán dùng lại báo cáo bán hàng.
import { Inject, Injectable } from "@nestjs/common";
import { analyticsDisplayRows, type AnalyticsInventoryGrouping, type AnalyticsInventoryResponse, type AnalyticsInventoryRow, type analyticsInventoryQuerySchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { periodNote, type ExportTable } from "./analytics-export";
import { AnalyticsScopeService, requirePeriod, type ReportScope } from "./analytics-scope.service";
import { SalesReportService, uuidList } from "./sales-report.service";

type InventoryQuery = z.infer<typeof analyticsInventoryQuerySchema>;
type FigureRow = {
  opening_quantity: string;
  opening_value: string;
  in_quantity: string;
  in_value: string;
  out_quantity: string;
  out_value: string;
  closing_quantity: string;
  closing_value: string;
  cost_of_sales: string;
  turnover: string | null;
  days_of_inventory: string | null;
};

@Injectable()
export class InventoryReportService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly scopeService: AnalyticsScopeService,
    private readonly sales: SalesReportService,
  ) {}

  private key(groupBy: AnalyticsInventoryGrouping, alias: string): SQL {
    const column = { company: "company_id", warehouse: "warehouse_id", product: "variant_id" }[groupBy];
    return sql.raw(`${alias}.${column}::text`);
  }

  // Tồn và luân chuyển theo khóa nhóm, cộng giá vốn hàng bán cùng khóa; dòng tổng khi không nhóm (khóa rỗng).
  private figures(scope: ReportScope, query: InventoryQuery, days: number, groupBy: AnalyticsInventoryGrouping | null, companyIds: string[]): SQL {
    const start = sql`(${query.from}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    const end = sql`((${query.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    const companies = uuidList(companyIds);
    const warehouse = query.warehouseId ? sql`AND m.warehouse_id = ${query.warehouseId}` : sql``;
    const movementKey = groupBy ? this.key(groupBy, "m") : sql`''`;
    const salesKey = groupBy ? this.key(groupBy, "b") : sql`''`;
    return sql`
      WITH moves AS (
        SELECT ${movementKey} AS key, m.company_id,
          coalesce(sum(m.quantity) FILTER (WHERE m.moved_at < ${start}), 0) AS opening_quantity,
          coalesce(sum(m.value) FILTER (WHERE m.moved_at < ${start}), 0) AS opening_value,
          coalesce(sum(m.quantity) FILTER (WHERE m.moved_at >= ${start} AND m.quantity > 0), 0) AS in_quantity,
          coalesce(sum(m.value) FILTER (WHERE m.moved_at >= ${start} AND m.quantity > 0), 0) AS in_value,
          coalesce(-sum(m.quantity) FILTER (WHERE m.moved_at >= ${start} AND m.quantity < 0), 0) AS out_quantity,
          coalesce(-sum(m.value) FILTER (WHERE m.moved_at >= ${start} AND m.quantity < 0), 0) AS out_value
        FROM inventory.movements m
        WHERE m.company_id IN (${companies}) AND m.moved_at < ${end} ${warehouse}
        GROUP BY 1, 2
      ),
      sold AS (
        SELECT ${salesKey} AS key, b.company_id, sum(b.sign * b.cost) AS cost_of_sales
        FROM (${this.sales.base({ ...scope, companies: scope.companies.filter((company) => companyIds.includes(company.id)) }, { from: query.from, to: query.to, warehouseId: query.warehouseId })}) b
        GROUP BY 1, 2
      ),
      joined AS (
        SELECT coalesce(moves.key, sold.key) AS key, coalesce(moves.company_id, sold.company_id) AS company_id,
          coalesce(opening_quantity, 0) AS opening_quantity, coalesce(opening_value, 0) AS opening_value,
          coalesce(in_quantity, 0) AS in_quantity, coalesce(in_value, 0) AS in_value,
          coalesce(out_quantity, 0) AS out_quantity, coalesce(out_value, 0) AS out_value, coalesce(cost_of_sales, 0) AS cost_of_sales
        FROM moves FULL JOIN sold ON sold.key = moves.key AND sold.company_id = moves.company_id
      ),
      -- Tồn cuối kỳ = đầu kỳ + nhập − xuất (QUYTAC_NGHIEPVU_340).
      grouped AS (
        SELECT key, c.base_currency AS currency, sum(opening_quantity) AS opening_quantity, sum(opening_value) AS opening_value, sum(in_quantity) AS in_quantity,
          sum(in_value) AS in_value, sum(out_quantity) AS out_quantity, sum(out_value) AS out_value, sum(cost_of_sales) AS cost_of_sales
        FROM joined JOIN core.companies c ON c.id = joined.company_id GROUP BY 1, 2
      )
      SELECT key, currency, opening_quantity::text, opening_value::text, in_quantity::text, in_value::text, out_quantity::text, out_value::text, cost_of_sales::text,
        (opening_quantity + in_quantity - out_quantity)::text AS closing_quantity, (opening_value + in_value - out_value)::text AS closing_value,
        CASE WHEN cost_of_sales <> 0 AND (2 * opening_value + in_value - out_value) <> 0 THEN round(cost_of_sales / ((2 * opening_value + in_value - out_value) / 2), 2)::text END AS turnover,
        CASE WHEN cost_of_sales <> 0 AND (2 * opening_value + in_value - out_value) <> 0 THEN round(${days} * (2 * opening_value + in_value - out_value) / (2 * cost_of_sales), 1)::text END AS days_of_inventory
      FROM grouped`;
  }

  async report(actor: Actor, query: InventoryQuery, allRows = false): Promise<AnalyticsInventoryResponse> {
    requirePeriod(query.from, query.to);
    // Số ngày của kỳ tính đến hôm nay khi đến ngày ở tương lai, để số ngày tồn không bị phóng đại.
    const today = this.scopeService.today();
    const days = requirePeriod(query.from, query.to < today ? query.to : today < query.from ? query.from : today);
    const scope = await this.scopeService.resolve(actor, "inventory", query.companyIds);
    const companyIds = scope.companies.map((company) => company.id);
    const warehouses = await this.warehouses(companyIds);
    if (query.warehouseId && !warehouses.some((warehouse) => warehouse.id === query.warehouseId)) throw new ApiError("FORBIDDEN", "forbidden");
    const sameCurrency = scope.companies.filter((company) => company.inTotal).map((company) => company.id);
    // Dòng nhóm và dòng tổng chạy song song.
    const [grouped, totalResult] = await Promise.all([
      this.database.execute<FigureRow & { key: string; currency: string }>(this.figures(scope, query, days, query.groupBy, companyIds)),
      this.database.execute<FigureRow & { key: string }>(this.figures(scope, query, days, null, sameCurrency)),
    ]);
    const rows = grouped.rows;
    const labels = await this.labels(
      query.groupBy,
      rows.map((row) => row.key),
    );
    const order = new Map(scope.companies.map((company, index) => [company.id, index]));
    const sorted: AnalyticsInventoryRow[] = rows
      .map((row) => ({ key: row.key, label: labels.get(row.key) ?? row.key, currency: row.currency, inTotal: row.currency === scope.group.currency, ...this.toFigures(row) }))
      .filter((row) => [row.openingValue, row.inValue, row.outValue, row.closingValue, row.costOfSales, row.openingQuantity, row.inQuantity, row.outQuantity].some((value) => Number(value) !== 0));
    if (query.groupBy === "company") sorted.sort((a, b) => order.get(a.key)! - order.get(b.key)!);
    else sorted.sort((a, b) => Number(b.closingValue) - Number(a.closingValue) || a.label.localeCompare(b.label));
    const total = totalResult.rows[0];
    const totals = total
      ? this.toFigures(total)
      : this.toFigures({
          opening_quantity: "0",
          opening_value: "0",
          in_quantity: "0",
          in_value: "0",
          out_quantity: "0",
          out_value: "0",
          closing_quantity: "0",
          closing_value: "0",
          cost_of_sales: "0",
          turnover: null,
          days_of_inventory: null,
        });
    return {
      from: query.from,
      to: query.to,
      days,
      groupBy: query.groupBy,
      currency: scope.group.currency,
      companies: scope.companies,
      warehouses,
      rows: allRows ? sorted : sorted.slice(0, analyticsDisplayRows),
      totals: {
        openingValue: totals.openingValue,
        inValue: totals.inValue,
        outValue: totals.outValue,
        closingValue: totals.closingValue,
        costOfSales: totals.costOfSales,
        turnover: totals.turnover,
        daysOfInventory: totals.daysOfInventory,
      },
      totalRows: sorted.length > analyticsDisplayRows ? sorted.length : null,
    };
  }

  private toFigures(row: FigureRow) {
    return {
      openingQuantity: trimDecimal(row.opening_quantity),
      openingValue: trimDecimal(row.opening_value),
      inQuantity: trimDecimal(row.in_quantity),
      inValue: trimDecimal(row.in_value),
      outQuantity: trimDecimal(row.out_quantity),
      outValue: trimDecimal(row.out_value),
      closingQuantity: trimDecimal(row.closing_quantity),
      closingValue: trimDecimal(row.closing_value),
      costOfSales: trimDecimal(row.cost_of_sales),
      turnover: row.turnover === null ? null : trimDecimal(row.turnover),
      daysOfInventory: row.days_of_inventory === null ? null : trimDecimal(row.days_of_inventory),
    };
  }

  // Kho có hàng của các công ty đã chọn: kho của công ty hoặc kho nhận gửi hàng của công ty.
  private async warehouses(companyIds: string[]): Promise<{ id: string; label: string }[]> {
    return (
      await this.database.execute<{ id: string; label: string }>(sql`
      SELECT w.id::text, w.code || ' · ' || w.name || ' (' || c.code || ')' AS label FROM inventory.warehouses w JOIN core.companies c ON c.id = w.company_id
      WHERE w.company_id IN (${uuidList(companyIds)}) OR w.id IN (SELECT warehouse_id FROM inventory.warehouse_owners WHERE company_id IN (${uuidList(companyIds)}))
      ORDER BY c.code, w.code`)
    ).rows;
  }

  private async labels(groupBy: AnalyticsInventoryGrouping, keys: string[]): Promise<Map<string, string>> {
    if (keys.length === 0) return new Map();
    if (groupBy === "warehouse") {
      const rows = await this.database.execute<{ id: string; label: string }>(sql`
        SELECT w.id::text, w.code || ' · ' || w.name || ' (' || c.code || ')' AS label FROM inventory.warehouses w JOIN core.companies c ON c.id = w.company_id WHERE w.id IN (${uuidList(keys)})`);
      return new Map(rows.rows.map((row) => [row.id, row.label]));
    }
    return this.sales.labels(groupBy, keys);
  }

  exportTable(report: AnalyticsInventoryResponse): ExportTable {
    const groupTitle = { company: "Công ty", warehouse: "Kho", product: "Sản phẩm" }[report.groupBy];
    const titles = [
      "Tồn đầu kỳ (số lượng)",
      "Tồn đầu kỳ (giá trị)",
      "Nhập (số lượng)",
      "Nhập (giá trị)",
      "Xuất (số lượng)",
      "Xuất (giá trị)",
      "Tồn cuối kỳ (số lượng)",
      "Tồn cuối kỳ (giá trị)",
      "Giá vốn hàng bán",
      "Vòng quay",
      "Số ngày tồn",
    ];
    return {
      title: "Tồn kho và luân chuyển",
      notes: [
        `Công ty: ${report.companies.map((company) => company.code).join(", ")}`,
        periodNote(report.from, report.to),
        `Theo thẻ kho. Vòng quay = giá vốn hàng bán ÷ giá trị tồn bình quân; số ngày tồn = ${report.days} ngày ÷ vòng quay. Đơn vị tiền: ${report.currency}.`,
      ],
      columns: [{ title: groupTitle }, { title: "Đồng tiền" }, ...titles.map((title) => ({ title, numeric: true }))],
      rows: report.rows.map((row) => [
        row.label,
        row.currency,
        row.openingQuantity,
        row.openingValue,
        row.inQuantity,
        row.inValue,
        row.outQuantity,
        row.outValue,
        row.closingQuantity,
        row.closingValue,
        row.costOfSales,
        row.turnover,
        row.daysOfInventory,
      ]),
      totals: [
        [
          "Tổng",
          report.currency,
          null,
          report.totals.openingValue,
          null,
          report.totals.inValue,
          null,
          report.totals.outValue,
          null,
          report.totals.closingValue,
          report.totals.costOfSales,
          report.totals.turnover,
          report.totals.daysOfInventory,
        ],
      ],
    };
  }
}
