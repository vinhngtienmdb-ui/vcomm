// Hoa hồng đơn VComm (CONG_VIEC_26; CHUC_NANG_135; QUYTAC_NGHIEPVU_201 đến 203): chốt người hưởng, mức lúc đặt; tính và cộng ví khi đơn hoàn tất.
import { Injectable } from "@nestjs/common";
import type { SalesTitle } from "contracts";
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import { returnedOnOrderLine } from "../sales/sales-orders.service";
import { SalesTeamService } from "./sales-team.service";

type Executor = Pick<Database, "execute">;
export type CommissionShare = "referral" | SalesTitle;

// Chức danh từ thấp đến cao (QUYTAC_NGHIEPVU_148).
const titleOrder: SalesTitle[] = ["staff", "team_head", "regional_director", "director"];

// Người nhận từng phần chức danh (QUYTAC_NGHIEPVU_201): người giữ chức danh trong chuỗi; thiếu thì người có chức danh cao hơn gần nhất;
// không ai cao hơn thì không ai nhận; chức danh thấp hơn chức danh của người phụ trách thì người phụ trách nhận.
export function teamRecipients(responsibleId: string, responsibleTitle: SalesTitle, chain: { userId: string; title: SalesTitle }[]): Map<SalesTitle, string> {
  const holders = new Map<SalesTitle, string>([[responsibleTitle, responsibleId]]);
  for (const item of chain) if (!holders.has(item.title)) holders.set(item.title, item.userId);
  const start = titleOrder.indexOf(responsibleTitle);
  const result = new Map<SalesTitle, string>();
  titleOrder.forEach((title, index) => {
    if (index < start) {
      result.set(title, responsibleId);
      return;
    }
    const recipient = titleOrder
      .slice(index)
      .map((candidate) => holders.get(candidate))
      .find((userId) => userId !== undefined);
    if (recipient) result.set(title, recipient);
  });
  return result;
}

// Số tiền một dòng hoa hồng (bí danh c: hoa hồng, l: dòng đơn bán).
const estimate = sql`round(CASE WHEN c.calculation = 'percent'
  THEN c.rate / 100 * l.net_amount * greatest(l.base_quantity - ${returnedOnOrderLine(sql`l.id`)}, 0) / l.base_quantity
  ELSE c.rate * greatest(l.base_quantity - ${returnedOnOrderLine(sql`l.id`)}, 0) END)`;

@Injectable()
export class MarketplaceCommissionsService {
  constructor(private readonly team: SalesTeamService) {}

  // Gọi trong giao dịch đặt hàng, sau khi lập đơn bán và đơn VComm.
  async snapshot(executor: Executor, input: { orderId: string; salesOrderId: string; buyerUserId: string; companyId: string }): Promise<void> {
    const referrer = (
      await executor.execute<{ referrer_user_id: string | null; is_sales_staff: boolean | null }>(sql`
      SELECT b.referrer_user_id, r.is_sales_staff FROM marketplace.buyer_accounts b LEFT JOIN marketplace.buyer_accounts r ON r.user_id = b.referrer_user_id
      WHERE b.user_id = ${input.buyerUserId}`)
    ).rows[0];
    if (!referrer?.referrer_user_id) return;
    const recipients = new Map<CommissionShare, string>([["referral", referrer.referrer_user_id]]);
    // Hoa hồng đội kinh doanh chỉ khi người giới thiệu đang là nhân viên kinh doanh (nhân viên phụ trách, QUYTAC_NGHIEPVU_145).
    if (referrer.is_sales_staff) {
      const team = await this.team.load(executor, input.companyId);
      const title = team.titleOf(referrer.referrer_user_id);
      if (title) for (const [share, userId] of teamRecipients(referrer.referrer_user_id, title, team.chain(referrer.referrer_user_id))) recipients.set(share, userId);
    }
    const lines = await executor.execute<{
      line_id: string;
      calculation: "percent" | "fixed";
      referral: string;
      staff: string;
      team_head: string;
      regional_director: string;
      director: string;
    }>(sql`
      SELECT l.id AS line_id, pc.calculation, pc.referral::text, pc.staff::text, pc.team_head::text, pc.regional_director::text, pc.director::text
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN marketplace.product_commissions pc ON pc.product_id = v.product_id
      WHERE l.order_id = ${input.salesOrderId} AND NOT l.is_gift ORDER BY l.line_no`);
    for (const line of lines.rows) {
      const rates: Record<CommissionShare, string> = {
        referral: line.referral,
        staff: line.staff,
        team_head: line.team_head,
        regional_director: line.regional_director,
        director: line.director,
      };
      for (const [share, userId] of recipients) {
        if (Number(rates[share]) <= 0) continue;
        await executor.execute(sql`
          INSERT INTO marketplace.order_commissions (order_id, order_line_id, share, beneficiary_user_id, calculation, rate)
          VALUES (${input.orderId}, ${line.line_id}, ${share}, ${userId}, ${line.calculation}, ${rates[share]}::numeric)`);
      }
    }
  }

  // Hoa hồng của đơn theo người hưởng, phần: đã cộng thì số thực, chưa thì ước tính theo hàng hiện tại.
  async ofOrder(executor: Executor, orderId: string): Promise<{ name: string; phone: string | null; share: CommissionShare; amount: string; credited: boolean }[]> {
    const rows = await executor.execute<{ name: string; phone: string | null; share: CommissionShare; amount: string; credited: boolean }>(sql`
      SELECT u.full_name AS name, u.phone, c.share, sum(coalesce(c.amount, ${estimate})) ::text AS amount, bool_and(c.status = 'credited') AS credited
      FROM marketplace.order_commissions c JOIN sales.order_lines l ON l.id = c.order_line_id JOIN core.users u ON u.id = c.beneficiary_user_id
      WHERE c.order_id = ${orderId} GROUP BY u.full_name, u.phone, c.share, c.beneficiary_user_id
      ORDER BY array_position(ARRAY['referral', 'staff', 'team_head', 'regional_director', 'director'], c.share), u.full_name`);
    return rows.rows;
  }

  // Gọi trong giao dịch chuyển đơn sang Hoàn tất: tính số tiền từng dòng theo phần không trả (QUYTAC_NGHIEPVU_202: phần trăm trên tiền hàng chưa thuế
  // sau khuyến mãi, số tiền cố định trên mỗi đơn vị cơ sở; làm tròn đến đồng), cộng ví mỗi người hưởng một giao dịch.
  async credit(executor: Executor, orderId: string): Promise<{ userId: string; amount: number }[]> {
    await executor.execute(sql`
      UPDATE marketplace.order_commissions c SET status = 'credited', credited_at = now(), amount = ${estimate}
      FROM sales.order_lines l WHERE l.id = c.order_line_id AND c.order_id = ${orderId} AND c.status = 'pending'`);
    const totals = await executor.execute<{ user_id: string; amount: string }>(sql`
      SELECT beneficiary_user_id AS user_id, sum(amount)::text AS amount FROM marketplace.order_commissions
      WHERE order_id = ${orderId} AND status = 'credited' GROUP BY beneficiary_user_id HAVING sum(amount) > 0 ORDER BY beneficiary_user_id`);
    for (const total of totals.rows) {
      // Khóa dòng ví (tạo nếu chưa có) rồi ghi giao dịch; một giao dịch hoa hồng mỗi đơn mỗi người.
      await executor.execute(sql`INSERT INTO marketplace.wallets (user_id) VALUES (${total.user_id}) ON CONFLICT DO NOTHING`);
      const wallet = (
        await executor.execute<{ balance: string }>(sql`
        UPDATE marketplace.wallets SET balance = balance + ${total.amount}::numeric, updated_at = now() WHERE user_id = ${total.user_id} RETURNING balance::text`)
      ).rows[0]!;
      await executor.execute(sql`
        INSERT INTO marketplace.wallet_transactions (user_id, kind, amount, balance_after, order_id)
        VALUES (${total.user_id}, 'commission', ${total.amount}::numeric, ${wallet.balance}::numeric, ${orderId})`);
    }
    return totals.rows.map((row) => ({ userId: row.user_id, amount: Number(row.amount) }));
  }
}
