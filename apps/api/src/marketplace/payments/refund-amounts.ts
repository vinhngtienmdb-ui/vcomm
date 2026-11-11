// Lập việc chờ hoàn tiền khi nhận hàng trả (CONG_VIEC_25; QUYTAC_NGHIEPVU_168). Tách riêng để dịch vụ trả hàng dùng không phụ thuộc dịch vụ hoàn tiền.
import { sql } from "drizzle-orm";
import type { Database } from "../../database/database.module";
import { returnSalePoints } from "../../loyalty/ledger.service";

type Executor = Pick<Database, "execute">;

// Nhận hàng trả (QUYTAC_NGHIEPVU_168): hoàn tiền dòng gồm thuế theo tỷ lệ số lượng trả, làm tròn đến đồng, trừ phần tiền điểm (QUYTAC_NGHIEPVU_349); phí giao hàng không hoàn.
// Không vượt tiền đã thu trừ phần đã hoàn và đang chờ hoàn (thanh toán trùng đã có việc hoàn riêng). Đơn thanh toán khi nhận hàng đã giao thì người mua đã trả đủ tổng thanh toán dù chưa ghi đã thu.
export async function refundReturnedGoods(executor: Executor, orderId: string, requestId: string): Promise<number> {
  const returned = Number(
    (
      await executor.execute<{ value: string }>(sql`
      SELECT round(coalesce(sum(l.total_amount * rl.quantity / l.base_quantity), 0))::text AS value
      FROM marketplace.return_request_lines rl JOIN sales.order_lines l ON l.id = rl.order_line_id WHERE rl.request_id = ${requestId}`)
    ).rows[0]!.value,
  );
  // Điểm thưởng đã dùng: hoàn điểm theo tỷ lệ hàng trả, tiền hoàn trừ phần tiền điểm tương ứng (CONG_VIEC_51; QUYTAC_NGHIEPVU_349).
  const order = (
    await executor.execute<{ company_id: string; today: string }>(sql`
    SELECT company_id, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today FROM marketplace.orders WHERE id = ${orderId}`)
  ).rows[0]!;
  const points = await returnSalePoints(executor, {
    saleSourceType: "marketplace_order",
    saleSourceId: orderId,
    returnSourceId: requestId,
    companyId: order.company_id,
    day: order.today,
    returnedGoodsAmount: returned,
  });
  const cash = Math.max(returned - points.refundedPointsAmount, 0);
  const inserted = await executor.execute<{ amount: string }>(sql`
    WITH remaining AS (
      SELECT greatest(m.paid_amount, CASE WHEN m.payment_method = 'cod' THEN m.goods_amount + m.shipping_fee - m.points_amount ELSE 0 END) - m.refunded_amount
        - coalesce((SELECT sum(f.amount) FROM marketplace.refunds f WHERE f.order_id = m.id AND f.status = 'pending'), 0) AS value
      FROM marketplace.orders m WHERE m.id = ${orderId}
    )
    INSERT INTO marketplace.refunds (order_id, return_request_id, reason, amount)
    SELECT ${orderId}, ${requestId}, 'return_received', least(${cash}::numeric, remaining.value) FROM remaining WHERE least(${cash}::numeric, remaining.value) > 0
    RETURNING amount::text`);
  return Number(inserted.rows[0]?.amount ?? 0);
}
