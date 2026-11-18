// Cổng cửa hàng nhóm iPOS: tổng quan (API_344), ca, hóa đơn, phiếu trả (API_350), báo cáo cửa hàng và xuất Excel (API_351)
// (CONG_VIEC_74; CHUC_NANG_259; QUYTAC_NGHIEPVU_623, 625). Chủ cửa hàng xem mọi điểm bán; dữ liệu theo cửa hàng của thành viên.
// Doanh thu thuần = tổng tiền hóa đơn (sau giảm) − tiền hàng trả lại, tính theo ngày lập hóa đơn và ngày lập phiếu trả (giờ Việt Nam).
import { Inject, Injectable } from "@nestjs/common";
import type { IposOverview, IposPaymentMethod, IposPortalReturnRow, IposPortalSaleRow, IposPortalShiftRow, IposReport, iposPortalPeriodQuery } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import writeXlsxFile from "write-excel-file/node";
import type { z } from "zod";
import type { PortalMember } from "../affiliate/portal.service";
import { ApiError } from "../common/api-error";
import { CLOCK, vietnamDate, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { IposRegistersService } from "./ipos-registers.service";

type Period = z.infer<typeof iposPortalPeriodQuery>;
const maxDays = 366;
const shiftOverdueHours = 24;

type ShiftListRow = {
  id: string;
  outlet_name: string;
  register_name: string;
  member_name: string;
  opened_at: Date;
  closed_at: Date | null;
  closed_by_name: string | null;
  sales_count: number;
  revenue: string;
  system_cash: string | null;
  counted_cash: string | null;
  difference: string | null;
};
const shiftList = sql`s.id, o.name AS outlet_name, r.name AS register_name, mb.full_name AS member_name, s.opened_at, s.closed_at, cb.full_name AS closed_by_name,
  (SELECT count(*)::int FROM ipos.sales x WHERE x.shift_id = s.id) AS sales_count,
  (SELECT COALESCE(sum(x.total), 0)::text FROM ipos.sales x WHERE x.shift_id = s.id) AS revenue,
  s.system_cash::text, s.counted_cash::text, s.difference::text`;
const shiftJoins = sql`ipos.shifts s JOIN affiliate.outlets o ON o.id = s.outlet_id JOIN ipos.registers r ON r.id = s.register_id
  JOIN affiliate.members mb ON mb.id = s.member_id LEFT JOIN affiliate.members cb ON cb.id = s.closed_by`;
const toShiftRow = (row: ShiftListRow, now: Date): IposPortalShiftRow => ({
  id: row.id,
  outletName: row.outlet_name,
  registerName: row.register_name,
  memberName: row.member_name,
  openedAt: new Date(row.opened_at).toISOString(),
  closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
  closedByName: row.closed_by_name,
  salesCount: row.sales_count,
  revenue: row.revenue,
  systemCash: row.system_cash,
  countedCash: row.counted_cash,
  difference: row.difference,
  overdue: !row.closed_at && now.getTime() - new Date(row.opened_at).getTime() > shiftOverdueHours * 3_600_000,
});

@Injectable()
export class IposReportsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly registers: IposRegistersService,
  ) {}

  private checkPeriod(period: Period): void {
    if (period.from > period.to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "invalidValue" } });
    const days = (new Date(`${period.to}T00:00:00Z`).getTime() - new Date(`${period.from}T00:00:00Z`).getTime()) / 86_400_000 + 1;
    if (days > maxDays) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "iposPeriodTooLong" } });
  }

  // Lọc theo điểm bán, quầy, thu ngân và khoảng ngày (giờ Việt Nam) cho bảng có cột thời điểm `at`.
  private filter(alias: string, at: string, member: PortalMember, period: Period): SQL {
    const column = (name: string) => sql.raw(`${alias}.${name}`);
    return sql`${column("merchant_id")} = ${member.merchantId}
      AND (${column(at)} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN ${period.from}::date AND ${period.to}::date
      ${period.outletId ? sql`AND ${column("outlet_id")} = ${period.outletId}` : sql``}
      ${period.registerId ? sql`AND ${column("register_id")} = ${period.registerId}` : sql``}
      ${period.memberId ? sql`AND ${column("member_id")} = ${period.memberId}` : sql``}`;
  }

  async overview(member: PortalMember): Promise<IposOverview> {
    const now = this.clock.now();
    const today = vietnamDate(now);
    const weekStart = vietnamDate(new Date(now.getTime() - 6 * 86_400_000));
    const net = async (from: string) =>
      (
        await this.database.execute<{ net: string; sales: number }>(sql`
          SELECT (COALESCE((SELECT sum(total) FROM ipos.sales s WHERE ${this.filter("s", "sold_at", member, { from, to: today })}), 0)
            - COALESCE((SELECT sum(amount) FROM ipos.returns r WHERE ${this.filter("r", "created_at", member, { from, to: today })}), 0))::text AS net,
            (SELECT count(*)::int FROM ipos.sales s WHERE ${this.filter("s", "sold_at", member, { from, to: today })}) AS sales`)
      ).rows[0]!;
    const todayNet = await net(today);
    const week = await net(weekStart);
    const open = await this.database.execute<ShiftListRow>(sql`SELECT ${shiftList} FROM ${shiftJoins} WHERE s.merchant_id = ${member.merchantId} AND s.closed_at IS NULL ORDER BY s.opened_at`);
    const low = await this.database.execute<{ variant_id: string; outlet_name: string; name: string; quantity: string; min_quantity: string; total: number }>(sql`
      SELECT b.variant_id, o.name AS outlet_name, i.name || COALESCE(' – ' || v.attribute1_value, '') || COALESCE(' / ' || v.attribute2_value, '') AS name,
        trim_scale(b.quantity)::text AS quantity, trim_scale(v.min_quantity)::text AS min_quantity, count(*) OVER ()::int AS total
      FROM ipos.stock_balances b JOIN ipos.item_variants v ON v.id = b.variant_id JOIN ipos.items i ON i.id = v.item_id JOIN affiliate.outlets o ON o.id = b.outlet_id
      WHERE b.merchant_id = ${member.merchantId} AND v.min_quantity IS NOT NULL AND b.quantity < v.min_quantity AND v.status = 'active' AND i.status = 'active'
      ORDER BY b.quantity - v.min_quantity LIMIT 5`);
    const access = await this.registers.access(member);
    return {
      todayRevenue: todayNet.net,
      todaySales: todayNet.sales,
      weekRevenue: week.net,
      openShifts: open.rows.map((row) => toShiftRow(row, now)),
      lowStock: low.rows.map((row) => ({ variantId: row.variant_id, outletName: row.outlet_name, name: row.name, quantity: row.quantity, minQuantity: row.min_quantity })),
      lowStockTotal: low.rows[0]?.total ?? 0,
      outlets: access.outlets,
      pendingRegistrations: access.pendingRegistrations,
    };
  }

  async shifts(member: PortalMember, period: Period): Promise<IposPortalShiftRow[]> {
    this.checkPeriod(period);
    const now = this.clock.now();
    const rows = await this.database.execute<ShiftListRow>(sql`
      SELECT ${shiftList} FROM ${shiftJoins} WHERE ${this.filter("s", "opened_at", member, period)} ORDER BY s.opened_at DESC LIMIT 500`);
    return rows.rows.map((row) => toShiftRow(row, now));
  }

  async sales(member: PortalMember, period: Period & { method?: IposPaymentMethod; search?: string }): Promise<IposPortalSaleRow[]> {
    this.checkPeriod(period);
    const rows = await this.database.execute<{
      id: string;
      document_no: string;
      sold_at: Date;
      outlet_name: string;
      register_name: string;
      member_name: string;
      total: string;
      returned: string;
      methods: IposPaymentMethod[];
      status: "completed" | "cancelled";
    }>(sql`
      SELECT s.id, s.document_no, s.sold_at, o.name AS outlet_name, r.name AS register_name, mb.full_name AS member_name, s.total::text, s.status,
        (SELECT COALESCE(sum(x.amount), 0)::text FROM ipos.returns x WHERE x.sale_id = s.id) AS returned,
        ARRAY(SELECT DISTINCT p.method FROM ipos.sale_payments p WHERE p.sale_id = s.id ORDER BY p.method) AS methods
      FROM ipos.sales s JOIN affiliate.outlets o ON o.id = s.outlet_id JOIN ipos.registers r ON r.id = s.register_id JOIN affiliate.members mb ON mb.id = s.member_id
      WHERE ${this.filter("s", "sold_at", member, period)}
        ${period.method ? sql`AND EXISTS (SELECT 1 FROM ipos.sale_payments p WHERE p.sale_id = s.id AND p.method = ${period.method})` : sql``}
        ${period.search ? sql`AND s.document_no ILIKE ${`%${period.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`}` : sql``}
      ORDER BY s.sold_at DESC LIMIT 500`);
    return rows.rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      soldAt: new Date(row.sold_at).toISOString(),
      outletName: row.outlet_name,
      registerName: row.register_name,
      memberName: row.member_name,
      total: row.total,
      returnedAmount: row.returned,
      methods: row.methods,
      status: row.status,
    }));
  }

  async returns(member: PortalMember, period: Period): Promise<IposPortalReturnRow[]> {
    this.checkPeriod(period);
    const rows = await this.database.execute<{
      id: string;
      document_no: string;
      kind: "partial" | "full_cancel";
      sale_document_no: string;
      created_at: Date;
      outlet_name: string;
      member_name: string;
      amount: string;
      refund_cash: string;
      reason: string;
    }>(sql`
      SELECT r.id, r.document_no, r.kind, s.document_no AS sale_document_no, r.created_at, o.name AS outlet_name, mb.full_name AS member_name, r.amount::text, r.refund_cash::text, r.reason
      FROM ipos.returns r JOIN ipos.sales s ON s.id = r.sale_id JOIN affiliate.outlets o ON o.id = r.outlet_id JOIN affiliate.members mb ON mb.id = r.member_id
      WHERE ${this.filter("r", "created_at", member, period)} ORDER BY r.created_at DESC LIMIT 500`);
    return rows.rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      kind: row.kind,
      saleDocumentNo: row.sale_document_no,
      createdAt: new Date(row.created_at).toISOString(),
      outletName: row.outlet_name,
      memberName: row.member_name,
      amount: row.amount,
      refundCash: row.refund_cash,
      reason: row.reason,
    }));
  }

  // Báo cáo cửa hàng (QUYTAC_NGHIEPVU_625): doanh thu thuần, phương thức, theo giờ, hàng bán chạy và lợi nhuận gộp theo giá vốn lúc bán, ca, tồn kho.
  async report(member: PortalMember, period: Period): Promise<IposReport> {
    this.checkPeriod(period);
    const sales = this.filter("s", "sold_at", member, period);
    const returns = this.filter("r", "created_at", member, period);
    const head = (
      await this.database.execute<{ gross: string; sales_count: number; returns: string; returns_count: number; cash_refunds: string }>(sql`
        SELECT (SELECT COALESCE(sum(s.total), 0)::text FROM ipos.sales s WHERE ${sales}) AS gross,
          (SELECT count(*)::int FROM ipos.sales s WHERE ${sales}) AS sales_count,
          (SELECT COALESCE(sum(r.amount), 0)::text FROM ipos.returns r WHERE ${returns}) AS returns,
          (SELECT count(*)::int FROM ipos.returns r WHERE ${returns}) AS returns_count,
          (SELECT COALESCE(sum(r.refund_cash), 0)::text FROM ipos.returns r WHERE ${returns}) AS cash_refunds`)
    ).rows[0]!;
    const byDay = await this.database.execute<{ day: string; net: string; sales: number }>(sql`
      SELECT d.day::date::text AS day, (COALESCE(sv.total, 0) - COALESCE(rv.total, 0))::text AS net, COALESCE(sv.sales, 0)::int AS sales
      FROM (SELECT g::date AS day FROM generate_series(${period.from}::date, ${period.to}::date, interval '1 day') AS g) d
      LEFT JOIN (SELECT (s.sold_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, sum(s.total) AS total, count(*) AS sales FROM ipos.sales s WHERE ${sales} GROUP BY 1) sv ON sv.day = d.day
      LEFT JOIN (SELECT (r.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, sum(r.amount) AS total FROM ipos.returns r WHERE ${returns} GROUP BY 1) rv ON rv.day = d.day
      ORDER BY d.day`);
    const byMethod = await this.database.execute<{ method: IposPaymentMethod; amount: string }>(sql`
      SELECT p.method, sum(p.amount)::text AS amount FROM ipos.sale_payments p JOIN ipos.sales s ON s.id = p.sale_id WHERE ${sales} GROUP BY p.method ORDER BY p.method`);
    const byHour = await this.database.execute<{ hour: number; net: string; sales: number }>(sql`
      SELECT extract(hour FROM s.sold_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour, sum(s.total)::text AS net, count(*)::int AS sales
      FROM ipos.sales s WHERE ${sales} GROUP BY 1 ORDER BY 1`);
    // Hàng bán chạy: số lượng, doanh thu sau giảm trừ phần trả lại; lợi nhuận gộp = doanh thu − giá vốn lúc bán (mặt hàng không theo dõi tồn kho không có giá vốn).
    const top = await this.database.execute<{ variant_id: string; item_code: string; name: string; quantity: string; revenue: string; cost: string | null }>(sql`
      SELECT l.variant_id, min(l.item_code) AS item_code, min(l.name) AS name,
        trim_scale(sum(l.quantity) - COALESCE(sum(rt.quantity), 0))::text AS quantity,
        (sum(l.amount) - COALESCE(sum(rt.amount), 0))::text AS revenue,
        CASE WHEN bool_and(l.unit_cost IS NULL) THEN NULL ELSE round(sum((l.quantity - COALESCE(rt.quantity, 0)) * COALESCE(l.unit_cost, 0)))::text END AS cost
      FROM ipos.sale_lines l JOIN ipos.sales s ON s.id = l.sale_id
      LEFT JOIN (SELECT sale_line_id, sum(quantity) AS quantity, sum(amount) AS amount FROM ipos.return_lines GROUP BY sale_line_id) rt ON rt.sale_line_id = l.id
      WHERE ${sales}
      GROUP BY l.variant_id ORDER BY sum(l.amount) - COALESCE(sum(rt.amount), 0) DESC LIMIT 50`);
    const stock = await this.database.execute<{ outlet_name: string; items: number; value: string; negative: number; below_min: number }>(sql`
      SELECT o.name AS outlet_name, count(*)::int AS items, round(sum(GREATEST(b.quantity, 0) * b.average_cost))::text AS value,
        count(*) FILTER (WHERE b.quantity < 0)::int AS negative, count(*) FILTER (WHERE v.min_quantity IS NOT NULL AND b.quantity < v.min_quantity)::int AS below_min
      FROM ipos.stock_balances b JOIN affiliate.outlets o ON o.id = b.outlet_id JOIN ipos.item_variants v ON v.id = b.variant_id
      WHERE b.merchant_id = ${member.merchantId} ${period.outletId ? sql`AND b.outlet_id = ${period.outletId}` : sql``}
      GROUP BY o.name ORDER BY o.name`);
    const net = Number(head.gross) - Number(head.returns);
    const topItems = top.rows.map((row) => ({
      variantId: row.variant_id,
      itemCode: row.item_code,
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue,
      cost: row.cost,
      grossProfit: row.cost === null ? null : String(Number(row.revenue) - Number(row.cost)),
    }));
    // Lợi nhuận gộp toàn kỳ trên các dòng bán trong kỳ (không giới hạn 50 mặt hàng).
    const profit = (
      await this.database.execute<{ profit: string }>(sql`
        SELECT COALESCE(round(sum((l.amount - COALESCE(rt.amount, 0)) - (l.quantity - COALESCE(rt.quantity, 0)) * COALESCE(l.unit_cost, 0))), 0)::text AS profit
        FROM ipos.sale_lines l JOIN ipos.sales s ON s.id = l.sale_id
        LEFT JOIN (SELECT sale_line_id, sum(quantity) AS quantity, sum(amount) AS amount FROM ipos.return_lines GROUP BY sale_line_id) rt ON rt.sale_line_id = l.id
        WHERE ${sales} AND l.unit_cost IS NOT NULL`)
    ).rows[0]!;
    return {
      from: period.from,
      to: period.to,
      grossSales: head.gross,
      returns: head.returns,
      netRevenue: String(net),
      salesCount: head.sales_count,
      returnsCount: head.returns_count,
      averageSale: head.sales_count === 0 ? "0" : String(Math.round(Number(head.gross) / head.sales_count)),
      grossProfit: profit.profit,
      byDay: byDay.rows,
      byMethod: byMethod.rows,
      cashRefunds: head.cash_refunds,
      byHour: byHour.rows,
      topItems,
      shifts: await this.shifts(member, period),
      stock: stock.rows.map((row) => ({ outletName: row.outlet_name, items: row.items, value: row.value ?? "0", negative: row.negative, belowMin: row.below_min })),
    };
  }

  // Xuất Excel báo cáo: các trang Tổng hợp, Theo ngày, Phương thức, Theo giờ, Hàng bán chạy, Ca, Tồn kho.
  async export(member: PortalMember, period: Period, words: Record<string, string>): Promise<Buffer> {
    const report = await this.report(member, period);
    const bold = (value: string) => ({ value, fontWeight: "bold" as const });
    const num = (value: string | number | null) => (value === null ? { value: "" } : { value: Number(value), type: Number });
    const sheets = [
      [
        [bold(words.metric!), bold(words.value!)],
        [{ value: words.period! }, { value: `${report.from} – ${report.to}` }],
        [{ value: words.grossSales! }, num(report.grossSales)],
        [{ value: words.returns! }, num(report.returns)],
        [{ value: words.netRevenue! }, num(report.netRevenue)],
        [{ value: words.salesCount! }, num(report.salesCount)],
        [{ value: words.averageSale! }, num(report.averageSale)],
        [{ value: words.grossProfit! }, num(report.grossProfit)],
        [{ value: words.cashRefunds! }, num(report.cashRefunds)],
      ],
      [[bold(words.day!), bold(words.netRevenue!), bold(words.salesCount!)], ...report.byDay.map((row) => [{ value: row.day }, num(row.net), num(row.sales)])],
      [[bold(words.method!), bold(words.amount!)], ...report.byMethod.map((row) => [{ value: words[`method_${row.method}`] ?? row.method }, num(row.amount)])],
      [[bold(words.hour!), bold(words.netRevenue!), bold(words.salesCount!)], ...report.byHour.map((row) => [num(row.hour), num(row.net), num(row.sales)])],
      [
        [bold(words.itemCode!), bold(words.item!), bold(words.quantity!), bold(words.revenue!), bold(words.cost!), bold(words.grossProfit!)],
        ...report.topItems.map((row) => [{ value: row.itemCode }, { value: row.name }, num(row.quantity), num(row.revenue), num(row.cost), num(row.grossProfit)]),
      ],
      [
        [bold(words.outlet!), bold(words.register!), bold(words.cashier!), bold(words.openedAt!), bold(words.closedAt!), bold(words.revenue!), bold(words.systemCash!), bold(words.countedCash!), bold(words.difference!)],
        ...report.shifts.map((row) => [
          { value: row.outletName },
          { value: row.registerName },
          { value: row.memberName },
          { value: row.openedAt },
          { value: row.closedAt ?? "" },
          num(row.revenue),
          num(row.systemCash),
          num(row.countedCash),
          num(row.difference),
        ]),
      ],
      [[bold(words.outlet!), bold(words.stockItems!), bold(words.stockValue!), bold(words.negative!), bold(words.belowMin!)], ...report.stock.map((row) => [{ value: row.outletName }, num(row.items), num(row.value), num(row.negative), num(row.belowMin)])],
    ];
    const names = [words.sheetSummary!, words.sheetDays!, words.sheetMethods!, words.sheetHours!, words.sheetItems!, words.sheetShifts!, words.sheetStock!];
    return writeXlsxFile(sheets.map((data, index) => ({ data, sheet: names[index] })) as never).toBuffer();
  }
}
