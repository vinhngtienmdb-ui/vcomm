// Thống kê sử dụng trợ lý AI (CHUC_NANG_229; API_279): chỉ số lượt, token, chi phí, đánh giá; không có nội dung hội thoại.
import { Inject, Injectable } from "@nestjs/common";
import { aiFeedbackReasons, type AiFeature, type AiFeedbackReason, type AiUsageFigures, type AiUsageResponse, type aiUsageQuerySchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { ExportTable } from "../analytics/analytics-export";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { AiAccessService } from "./ai-access.service";

type FigureRow = { turns: number; input_tokens: string; output_tokens: string; cache_read_tokens: string; cost_usd: string };

const figures = (row: FigureRow): AiUsageFigures => ({
  turns: row.turns,
  inputTokens: Number(row.input_tokens),
  outputTokens: Number(row.output_tokens),
  cacheReadTokens: Number(row.cache_read_tokens),
  costUsd: Number(row.cost_usd).toFixed(6),
});
const sums = sql`count(*)::int AS turns, COALESCE(sum(u.input_tokens), 0)::text AS input_tokens, COALESCE(sum(u.output_tokens), 0)::text AS output_tokens,
  COALESCE(sum(u.cache_read_tokens), 0)::text AS cache_read_tokens, COALESCE(sum(u.cost_usd), 0)::text AS cost_usd`;

function nextMonth(month: string): string {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, "0")}`;
}

@Injectable()
export class AiUsageService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly access: AiAccessService,
  ) {}

  async report(actor: Actor, query: z.output<typeof aiUsageQuerySchema>): Promise<AiUsageResponse> {
    const from = `${query.month}-01T00:00:00+07:00`;
    const to = `${nextMonth(query.month)}-01T00:00:00+07:00`;
    const where: SQL = sql`u.company_id = ${actor.companyId} AND u.created_at >= ${from}::timestamptz AND u.created_at < ${to}::timestamptz
      ${query.feature ? sql`AND u.feature = ${query.feature}` : sql``}`;
    const totals = (
      await this.database.execute<FigureRow & { errors: number; refusals: number; users: number }>(sql`
        SELECT ${sums}, count(*) FILTER (WHERE u.status = 'error')::int AS errors, count(*) FILTER (WHERE u.status = 'refusal')::int AS refusals,
          count(DISTINCT u.user_id)::int AS users
        FROM ai.usage_events u WHERE ${where}`)
    ).rows[0]!;
    const byDay = await this.database.execute<FigureRow & { day: string }>(sql`
      SELECT (u.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day, ${sums} FROM ai.usage_events u WHERE ${where} GROUP BY 1 ORDER BY 1`);
    const byFeature = await this.database.execute<FigureRow & { feature: AiFeature }>(sql`
      SELECT u.feature, ${sums} FROM ai.usage_events u WHERE ${where} GROUP BY 1 ORDER BY 1`);
    // Đánh giá gắn với câu trả lời qua nhật ký lượt; đánh giá xóa theo hội thoại sau 90 ngày.
    const byUser = await this.database.execute<FigureRow & { user_id: string; full_name: string; up: number; down: number }>(sql`
      SELECT u.user_id, p.full_name, ${sums},
        (SELECT count(*)::int FROM ai.feedback f JOIN ai.messages m ON m.id = f.message_id JOIN ai.usage_events e ON e.id = m.usage_event_id
          WHERE e.user_id = u.user_id AND e.company_id = ${actor.companyId} AND e.created_at >= ${from}::timestamptz AND e.created_at < ${to}::timestamptz AND f.rating = 'up') AS up,
        (SELECT count(*)::int FROM ai.feedback f JOIN ai.messages m ON m.id = f.message_id JOIN ai.usage_events e ON e.id = m.usage_event_id
          WHERE e.user_id = u.user_id AND e.company_id = ${actor.companyId} AND e.created_at >= ${from}::timestamptz AND e.created_at < ${to}::timestamptz AND f.rating = 'down') AS down
      FROM ai.usage_events u JOIN core.users p ON p.id = u.user_id WHERE ${where}
      GROUP BY u.user_id, p.full_name ORDER BY sum(u.cost_usd) DESC, p.full_name`);
    const feedbackRows = await this.database.execute<{ rating: "up" | "down"; reason: AiFeedbackReason | null; count: number }>(sql`
      SELECT f.rating, f.reason, count(*)::int AS count FROM ai.feedback f JOIN ai.messages m ON m.id = f.message_id JOIN ai.usage_events u ON u.id = m.usage_event_id
      WHERE ${where} GROUP BY 1, 2`);
    const byReason = Object.fromEntries(aiFeedbackReasons.map((reason) => [reason, 0])) as Record<AiFeedbackReason, number>;
    let up = 0;
    let down = 0;
    for (const row of feedbackRows.rows) {
      if (row.rating === "up") up += row.count;
      else {
        down += row.count;
        if (row.reason) byReason[row.reason] += row.count;
      }
    }
    const rate = (
      await this.database.execute<{ rate: string; rate_date: string }>(sql`
        SELECT rate::text AS rate, rate_date::text AS rate_date FROM core.exchange_rates
        WHERE from_currency = 'USD' AND to_currency = 'VND' AND rate_type = 'sell' ORDER BY rate_date DESC, created_at DESC LIMIT 1`)
    ).rows[0];
    const settings = await this.access.settings(actor.companyId);
    return {
      month: query.month,
      budgetUsd: Number(settings.monthly_budget_usd).toFixed(2),
      totals: { ...figures(totals), errors: totals.errors, refusals: totals.refusals, users: totals.users },
      byDay: byDay.rows.map((row) => ({ day: row.day, ...figures(row) })),
      byFeature: byFeature.rows.map((row) => ({ feature: row.feature, ...figures(row) })),
      byUser: byUser.rows.map((row) => ({ userId: row.user_id, fullName: row.full_name, up: row.up, down: row.down, ...figures(row) })),
      feedback: { up, down, byReason },
      usdToVnd: rate ? { rate: rate.rate, date: rate.rate_date } : null,
    };
  }

  // Xuất Excel cùng số liệu màn hình (dùng bộ xuất của báo cáo quản trị).
  exportTables(report: AiUsageResponse): ExportTable[] {
    const month = `${report.month.slice(5, 7)}/${report.month.slice(0, 4)}`;
    const notes = [`Tháng ${month}`, `Hạn mức ${report.budgetUsd} USD; đã dùng ${Number(report.totals.costUsd).toFixed(2)} USD`, "Không có nội dung hội thoại"];
    const columns = [
      { title: "Số lượt", numeric: true },
      { title: "Token vào", numeric: true },
      { title: "Token ra", numeric: true },
      { title: "Token đọc bộ nhớ đệm", numeric: true },
      { title: "Chi phí (USD)", numeric: true },
    ];
    const cells = (item: AiUsageFigures) => [item.turns, item.inputTokens, item.outputTokens, item.cacheReadTokens, item.costUsd];
    return [
      {
        title: "Theo người dùng",
        notes,
        columns: [{ title: "Người dùng" }, ...columns, { title: "Đúng", numeric: true }, { title: "Sai", numeric: true }],
        rows: report.byUser.map((row) => [row.fullName, ...cells(row), row.up, row.down]),
        totals: [["Tổng", ...cells(report.totals), report.feedback.up, report.feedback.down]],
      },
      {
        title: "Theo ngày",
        notes,
        columns: [{ title: "Ngày" }, ...columns],
        rows: report.byDay.map((row) => [row.day.split("-").reverse().join("/"), ...cells(row)]),
      },
      {
        title: "Theo tính năng",
        notes,
        columns: [{ title: "Tính năng" }, ...columns],
        rows: report.byFeature.map((row) => [row.feature === "chat" ? "Hỏi đáp số liệu" : "Soạn nội dung sản phẩm", ...cells(row)]),
      },
    ];
  }
}
