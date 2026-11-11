// Hoa hồng đơn VComm (CONG_VIEC_26; CHUC_NANG_135; QUYTAC_NGHIEPVU_201 đến 203): chốt người hưởng, mức lúc đặt; tính và cộng ví khi đơn hoàn tất.
import { Injectable } from "@nestjs/common";
import type { BuyerWalletResponse, SalesTitle, WalletTransactionKind } from "contracts";
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import { returnedOnOrderLine } from "../sales/sales-orders.service";
import { LedgerService } from "../accounting/ledger.service";
import { marketplaceCommissionDraft, marketplaceReferralBonusDraft } from "../accounting/postings";
import { SalesTeamService } from "./sales-team.service";

type Executor = Pick<Database, "execute">;
export type CommissionShare = "referral" | SalesTitle | "collaborator";

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
// Báo cáo quản trị dùng lại ước tính hoa hồng đang chờ (CONG_VIEC_50).
export const estimate = sql`round(CASE WHEN c.calculation = 'percent'
  THEN c.rate / 100 * l.net_amount * greatest(l.base_quantity - ${returnedOnOrderLine(sql`l.id`)}, 0) / l.base_quantity
  ELSE c.rate * greatest(l.base_quantity - ${returnedOnOrderLine(sql`l.id`)}, 0) END)`;
// Dùng lại cho thống kê cộng tác viên (CONG_VIEC_49).
export const commissionEstimate = estimate;

@Injectable()
export class MarketplaceCommissionsService {
  constructor(
    private readonly team: SalesTeamService,
    private readonly ledger: LedgerService,
  ) {}

  // Gọi trong giao dịch đặt hàng, sau khi lập đơn bán và đơn VComm. Chụp người giới thiệu của người mua vào đơn (căn cứ thưởng giới thiệu, QUYTAC_NGHIEPVU_327).
  // groupBuyOpenerId: người mở nhóm mua chung là cộng tác viên thì nhận phần cộng tác viên thay lượt bấm (QUYTAC_NGHIEPVU_326).
  async snapshot(executor: Executor, input: { orderId: string; salesOrderId: string; buyerUserId: string; companyId: string; groupBuyOpenerId?: string | null }): Promise<void> {
    const referrer = (
      await executor.execute<{ referrer_user_id: string | null; is_sales_staff: boolean | null }>(sql`
      SELECT b.referrer_user_id, r.is_sales_staff FROM marketplace.buyer_accounts b LEFT JOIN marketplace.buyer_accounts r ON r.user_id = b.referrer_user_id
      WHERE b.user_id = ${input.buyerUserId}`)
    ).rows[0];
    await executor.execute(sql`UPDATE marketplace.orders SET referrer_user_id = ${referrer?.referrer_user_id ?? null} WHERE id = ${input.orderId}`);
    const recipients = new Map<CommissionShare, string>();
    if (referrer?.referrer_user_id) {
      recipients.set("referral", referrer.referrer_user_id);
      // Hoa hồng đội kinh doanh chỉ khi người giới thiệu đang là nhân viên kinh doanh (nhân viên phụ trách, QUYTAC_NGHIEPVU_145).
      if (referrer.is_sales_staff) {
        const team = await this.team.load(executor, input.companyId);
        const title = team.titleOf(referrer.referrer_user_id);
        if (title) for (const [share, userId] of teamRecipients(referrer.referrer_user_id, title, team.chain(referrer.referrer_user_id))) recipients.set(share, userId);
      }
    }
    const lines = await executor.execute<{
      line_id: string;
      product_id: string;
      calculation: "percent" | "fixed";
      referral: string;
      staff: string;
      team_head: string;
      regional_director: string;
      director: string;
      collaborator: string;
    }>(sql`
      SELECT l.id AS line_id, v.product_id, pc.calculation, pc.referral::text, pc.staff::text, pc.team_head::text, pc.regional_director::text, pc.director::text,
        pc.collaborator::text
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN marketplace.product_commissions pc ON pc.product_id = v.product_id
      WHERE l.order_id = ${input.salesOrderId} AND NOT l.is_gift ORDER BY l.line_no`);
    const collaborators = await this.collaboratorsFor(
      executor,
      input.buyerUserId,
      lines.rows.map((line) => line.product_id),
      input.groupBuyOpenerId ?? null,
    );
    for (const line of lines.rows) {
      const rates: Record<CommissionShare, string> = {
        referral: line.referral,
        staff: line.staff,
        team_head: line.team_head,
        regional_director: line.regional_director,
        director: line.director,
        collaborator: line.collaborator,
      };
      const lineRecipients = new Map(recipients);
      const collaborator = collaborators.get(line.product_id);
      if (collaborator) lineRecipients.set("collaborator", collaborator);
      for (const [share, userId] of lineRecipients) {
        if (Number(rates[share]) <= 0) continue;
        await executor.execute(sql`
          INSERT INTO marketplace.order_commissions (order_id, order_line_id, share, beneficiary_user_id, calculation, rate)
          VALUES (${input.orderId}, ${line.line_id}, ${share}, ${userId}, ${line.calculation}, ${rates[share]}::numeric)`);
      }
    }
  }

  // Người hưởng phần cộng tác viên theo sản phẩm (QUYTAC_NGHIEPVU_326): người mở nhóm mua chung nếu có; ngược lại cộng tác viên có lượt bấm gần nhất trong 168 giờ.
  // Người hưởng phải đang Đã duyệt và khác người mua.
  private async collaboratorsFor(executor: Executor, buyerUserId: string, productIds: string[], groupBuyOpenerId: string | null): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (productIds.length === 0) return result;
    if (groupBuyOpenerId) {
      const approved = await executor.execute(sql`SELECT 1 FROM marketplace.collaborators WHERE user_id = ${groupBuyOpenerId} AND status = 'approved'`);
      if (approved.rows.length > 0 && groupBuyOpenerId !== buyerUserId) for (const productId of productIds) result.set(productId, groupBuyOpenerId);
      return result;
    }
    const rows = await executor.execute<{ product_id: string; collaborator_user_id: string }>(sql`
      SELECT DISTINCT ON (k.product_id) k.product_id, k.collaborator_user_id
      FROM marketplace.collaborator_clicks k JOIN marketplace.collaborators c ON c.user_id = k.collaborator_user_id AND c.status = 'approved'
      WHERE k.buyer_user_id = ${buyerUserId} AND k.collaborator_user_id <> ${buyerUserId} AND k.last_clicked_at > now() - interval '168 hours'
        AND k.product_id IN (${sql.join(
          [...new Set(productIds)].map((id) => sql`${id}::uuid`),
          sql`, `,
        )})
      ORDER BY k.product_id, k.last_clicked_at DESC`);
    for (const row of rows.rows) result.set(row.product_id, row.collaborator_user_id);
    return result;
  }

  // Hoa hồng của đơn theo người hưởng, phần: đã cộng thì số thực, chưa thì ước tính theo hàng hiện tại. Đơn hủy thì bỏ (QUYTAC_NGHIEPVU_202).
  async ofOrder(executor: Executor, orderId: string): Promise<{ name: string; phone: string | null; share: CommissionShare; amount: string; credited: boolean }[]> {
    const rows = await executor.execute<{ name: string; phone: string | null; share: CommissionShare; amount: string; credited: boolean }>(sql`
      SELECT u.full_name AS name, u.phone, c.share, sum(coalesce(c.amount, ${estimate})) ::text AS amount, bool_and(c.status = 'credited') AS credited
      FROM marketplace.order_commissions c JOIN sales.order_lines l ON l.id = c.order_line_id JOIN core.users u ON u.id = c.beneficiary_user_id
        JOIN marketplace.orders m ON m.id = c.order_id
      WHERE c.order_id = ${orderId} AND m.status <> 'cancelled' GROUP BY u.full_name, u.phone, c.share, c.beneficiary_user_id
      ORDER BY array_position(ARRAY['referral', 'staff', 'team_head', 'regional_director', 'director', 'collaborator'], c.share), u.full_name`);
    return rows.rows;
  }

  // Tổng hoa hồng theo người hưởng (QUYTAC_NGHIEPVU_203): đã cộng ví; đang chờ là ước tính của đơn chưa hoàn tất, không tính đơn hủy.
  // buyerUserId: chỉ tính đơn của một khách (chi tiết khách, CONG_VIEC_22 QUYTAC_NGHIEPVU_433).
  async totals(executor: Executor, userIds: string[], buyerUserId?: string): Promise<Map<string, { credited: string; pending: string }>> {
    if (userIds.length === 0) return new Map();
    const rows = await executor.execute<{ user_id: string; credited: string; pending: string }>(sql`
      SELECT c.beneficiary_user_id AS user_id,
        coalesce(sum(c.amount) FILTER (WHERE c.status = 'credited'), 0)::float::text AS credited,
        coalesce(sum(${estimate}) FILTER (WHERE c.status = 'pending' AND m.status <> 'cancelled'), 0)::float::text AS pending
      FROM marketplace.order_commissions c JOIN sales.order_lines l ON l.id = c.order_line_id JOIN marketplace.orders m ON m.id = c.order_id
      WHERE c.beneficiary_user_id IN (${sql.join(
        userIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})${buyerUserId ? sql` AND m.buyer_user_id = ${buyerUserId}` : sql``}
      GROUP BY c.beneficiary_user_id`);
    return new Map(rows.rows.map((row) => [row.user_id, { credited: row.credited, pending: row.pending }]));
  }

  // API_135: ví của chính người gọi; lịch sử mới nhất trước.
  async wallet(executor: Executor, userId: string, query: { page: number; pageSize: number }): Promise<Omit<BuyerWalletResponse, "withdrawal">> {
    const balance = (await executor.execute<{ balance: string }>(sql`SELECT balance::float::text AS balance FROM marketplace.wallets WHERE user_id = ${userId}`)).rows[0]?.balance ?? "0";
    const pending = (await this.totals(executor, [userId])).get(userId)?.pending ?? "0";
    const total = (await executor.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM marketplace.wallet_transactions WHERE user_id = ${userId}`)).rows[0]!.total;
    const rows = await executor.execute<{
      id: string;
      kind: WalletTransactionKind;
      amount: string;
      balance_after: string;
      order_id: string | null;
      document_no: string | null;
      note: string | null;
      created_at: Date;
    }>(sql`
      SELECT t.id, t.kind, t.amount::float::text AS amount, t.balance_after::float::text AS balance_after, t.order_id, so.document_no, t.note, t.created_at
      FROM marketplace.wallet_transactions t LEFT JOIN marketplace.orders m ON m.id = t.order_id LEFT JOIN sales.orders so ON so.id = m.sales_order_id
      WHERE t.user_id = ${userId} ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      balance,
      pendingAmount: pending,
      transactions: {
        data: rows.rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          amount: row.amount,
          balanceAfter: row.balance_after,
          orderId: row.order_id,
          orderDocumentNo: row.document_no,
          note: row.note,
          createdAt: new Date(row.created_at).toISOString(),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
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
    // Một giao dịch hoa hồng mỗi đơn mỗi người.
    for (const total of totals.rows) await this.creditWallet(executor, total.user_id, total.amount, "commission", orderId);
    // Bút toán hoa hồng (QUYTAC_NGHIEPVU_207); công ty chưa khởi tạo kế toán thì bỏ qua.
    await this.ledger.record(executor, await marketplaceCommissionDraft(executor, orderId));
    return totals.rows.map((row) => ({ userId: row.user_id, amount: Number(row.amount) }));
  }

  // Khóa dòng ví (tạo nếu chưa có) rồi ghi giao dịch (QUYTAC_NGHIEPVU_203).
  private async creditWallet(executor: Executor, userId: string, amount: string, kind: "commission" | "referral_bonus", orderId: string): Promise<void> {
    await executor.execute(sql`INSERT INTO marketplace.wallets (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`);
    const wallet = (
      await executor.execute<{ balance: string }>(sql`
      UPDATE marketplace.wallets SET balance = balance + ${amount}::numeric, updated_at = now() WHERE user_id = ${userId} RETURNING balance::text`)
    ).rows[0]!;
    await executor.execute(sql`
      INSERT INTO marketplace.wallet_transactions (user_id, kind, amount, balance_after, order_id)
      VALUES (${userId}, ${kind}, ${amount}::numeric, ${wallet.balance}::numeric, ${orderId})`);
  }

  // Gọi trong giao dịch chuyển đơn sang Hoàn tất (QUYTAC_NGHIEPVU_327): chương trình đang bật, đơn có người giới thiệu chụp lúc đặt,
  // giá trị hoàn tất lớn hơn 0 và không dưới mức tối thiểu, người mua chưa từng phát sinh thưởng thì cộng mức thưởng hiện tại vào ví hoa hồng người giới thiệu.
  async creditReferralBonus(executor: Executor, orderId: string): Promise<void> {
    const inserted = await executor.execute<{ beneficiary_user_id: string; amount: string }>(sql`
      INSERT INTO marketplace.referral_bonuses (referred_user_id, beneficiary_user_id, order_id, amount)
      SELECT m.buyer_user_id, m.referrer_user_id, m.id, s.bonus_amount
      FROM marketplace.orders m JOIN marketplace.referral_bonus_settings s ON s.company_id = m.company_id
      WHERE m.id = ${orderId} AND m.status = 'completed' AND m.referrer_user_id IS NOT NULL AND s.is_enabled
        AND m.completed_amount > 0 AND m.completed_amount >= s.minimum_order
      ON CONFLICT (referred_user_id) DO NOTHING
      RETURNING beneficiary_user_id, amount::text`);
    const bonus = inserted.rows[0];
    if (!bonus) return;
    await this.creditWallet(executor, bonus.beneficiary_user_id, bonus.amount, "referral_bonus", orderId);
    await this.ledger.record(executor, await marketplaceReferralBonusDraft(executor, orderId));
  }
}
