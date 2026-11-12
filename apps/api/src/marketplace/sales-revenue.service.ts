// Doanh số tháng của tôi và của nhánh trên ứng dụng VComm (CONG_VIEC_22; CHUC_NANG_206; API_231; QUYTAC_NGHIEPVU_439, 440).
// Đơn tính cho nhân viên phụ trách khách lúc đặt đơn (marketplace.orders.sales_staff_user_id), khớp người hưởng phần nhân viên.
import { Inject, Injectable } from "@nestjs/common";
import type { SalesRevenueResponse, SalesRevenueRow } from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { SalesCareService } from "./sales-care.service";

const maximumMonths = 24;
const monthOf = (date: string) => date.slice(0, 7);
function previousMonth(month: string): string {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return value === 1 ? `${year - 1}-12` : `${year}-${String(value - 1).padStart(2, "0")}`;
}
function nextMonth(month: string): string {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, "0")}`;
}
const addAmount = (left: string, right: string) => trimDecimal((Number(left) + Number(right)).toFixed(4));

@Injectable()
export class SalesRevenueService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly care: SalesCareService,
  ) {}

  async revenue(userId: string, requestedMonth: string | undefined): Promise<SalesRevenueResponse> {
    const { team } = await this.care.teamOf(userId);
    const current = monthOf(vietnamDate(this.clock.now()));
    // Tháng chọn được: từ tháng được đánh dấu lần đầu đến tháng hiện tại, tối đa 24 tháng (QUYTAC_NGHIEPVU_440).
    const firstFlag = (
      await this.database.execute<{ first: Date | null }>(sql`
        SELECT min(changed_at) AS first FROM marketplace.sales_flag_history WHERE buyer_user_id = ${userId} AND action = 'flag'`)
    ).rows[0]?.first;
    const earliest = firstFlag ? monthOf(vietnamDate(new Date(firstFlag))) : current;
    const months = [current];
    while (months.length < maximumMonths && months[months.length - 1]! > earliest) months.push(previousMonth(months[months.length - 1]!));
    const month = requestedMonth ?? current;
    if (!months.includes(month)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { month: "revenueMonthRange" } });

    const people = [team.member(userId)!, ...team.branch(userId)];
    const ids = people.map((person) => sql`${person.userId}::uuid`);
    const rows = await this.database.execute<{
      user_id: string;
      completed_count: number;
      customer_count: number;
      completed_amount: string;
      open_count: number;
      open_amount: string;
    }>(sql`
      SELECT p.user_id,
        count(*) FILTER (WHERE m.status = 'completed' AND m.completed_at >= (${`${month}-01`}::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
          AND m.completed_at < (${`${nextMonth(month)}-01`}::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))::int AS completed_count,
        count(DISTINCT m.buyer_user_id) FILTER (WHERE m.status = 'completed' AND m.completed_at >= (${`${month}-01`}::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
          AND m.completed_at < (${`${nextMonth(month)}-01`}::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))::int AS customer_count,
        coalesce(sum(m.completed_amount) FILTER (WHERE m.status = 'completed' AND m.completed_at >= (${`${month}-01`}::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
          AND m.completed_at < (${`${nextMonth(month)}-01`}::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')), 0)::text AS completed_amount,
        count(*) FILTER (WHERE m.status NOT IN ('completed', 'cancelled'))::int AS open_count,
        coalesce(sum(m.goods_amount) FILTER (WHERE m.status NOT IN ('completed', 'cancelled')), 0)::text AS open_amount
      FROM unnest(ARRAY[${sql.join(ids, sql`, `)}]) AS p(user_id)
        LEFT JOIN marketplace.orders m ON m.sales_staff_user_id = p.user_id
      GROUP BY p.user_id`);
    const byUser = new Map(rows.rows.map((row) => [row.user_id, row]));
    const toRow = (person: { userId: string; fullName: string }): SalesRevenueRow => {
      const row = byUser.get(person.userId);
      return {
        userId: person.userId,
        fullName: person.fullName,
        title: team.titleOf(person.userId)!,
        completedOrderCount: row?.completed_count ?? 0,
        customerCount: row?.customer_count ?? 0,
        completedAmount: trimDecimal(row?.completed_amount ?? "0"),
        openOrderCount: row?.open_count ?? 0,
        openAmount: trimDecimal(row?.open_amount ?? "0"),
      };
    };
    const me = toRow(people[0]!);
    const members = people.slice(1).map(toRow);
    const branchTotal = [me, ...members].reduce(
      (total, row) => ({
        completedOrderCount: total.completedOrderCount + row.completedOrderCount,
        completedAmount: addAmount(total.completedAmount, row.completedAmount),
        openOrderCount: total.openOrderCount + row.openOrderCount,
        openAmount: addAmount(total.openAmount, row.openAmount),
      }),
      { completedOrderCount: 0, completedAmount: "0", openOrderCount: 0, openAmount: "0" },
    );
    return { month, months, me, members, branchTotal };
  }
}
