// Lập việc chờ hoàn tiền khi nhận hàng trả (CONG_VIEC_25; QUYTAC_NGHIEPVU_168). Tách riêng để dịch vụ trả hàng dùng không phụ thuộc dịch vụ hoàn tiền.
import { sql } from "drizzle-orm";
import type { Database } from "../../database/database.module";

type Executor = Pick<Database, "execute">;

// Nhận hàng trả (QUYTAC_NGHIEPVU_168): hoàn tiền dòng gồm thuế theo tỷ lệ số lượng trả, làm tròn đến đồng; phí giao hàng không hoàn.
// Không vượt tiền đã thu trừ phần đã hoàn và đang chờ hoàn (thanh toán trùng đã có việc hoàn riêng). Đơn thanh toán khi nhận hàng đã giao thì người mua đã trả đủ tổng thanh toán dù chưa ghi đã thu.
export async function refundReturnedGoods(executor: Executor, orderId: string, requestId: string): Promise<number> {
  const inserted = await executor.execute<{ amount: string }>(sql`
    WITH returned AS (
      SELECT round(coalesce(sum(l.total_amount * rl.quantity / l.base_quantity), 0)) AS value
      FROM marketplace.return_request_lines rl JOIN sales.order_lines l ON l.id = rl.order_line_id WHERE rl.request_id = ${requestId}
    ), remaining AS (
      SELECT greatest(m.paid_amount, CASE WHEN m.payment_method = 'cod' THEN m.goods_amount + m.shipping_fee ELSE 0 END) - m.refunded_amount
        - coalesce((SELECT sum(f.amount) FROM marketplace.refunds f WHERE f.order_id = m.id AND f.status = 'pending'), 0) AS value
      FROM marketplace.orders m WHERE m.id = ${orderId}
    )
    INSERT INTO marketplace.refunds (order_id, return_request_id, reason, amount)
    SELECT ${orderId}, ${requestId}, 'return_received', least(returned.value, remaining.value) FROM returned, remaining WHERE least(returned.value, remaining.value) > 0
    RETURNING amount::text`);
  return Number(inserted.rows[0]?.amount ?? 0);
}
