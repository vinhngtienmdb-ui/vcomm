// Ví mua sắm (CONG_VIEC_49; CHUC_NANG_173; QUYTAC_NGHIEPVU_332; THAY_DOI_22): số dư chỉ đổi qua giao dịch có khóa dòng ví; dùng trả đơn, nhận tiền hoàn.
// Tách riêng để đặt hàng, thanh toán, hoàn tiền, mua chung dùng chung không nạp vòng giữa các dịch vụ.
import type { ShoppingWalletTransactionKind, WalletKind } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;

// Các khoản khấu trừ trả trước của đơn (alias của marketplace.orders): tiền điểm thưởng (CONG_VIEC_51) và phần trả bằng ví mua sắm.
// Tiền còn phải trả qua cổng hoặc COD = tiền hàng + phí giao hàng − khấu trừ (CONG_VIEC_51 mục 19).
export const orderDeductions = (order: SQL): SQL => sql`(${order}.points_amount + ${order}.wallet_amount)`;

// Khóa ví mua sắm toàn hệ thống của công ty vận hành sàn (THAY_DOI_22; QUYTAC_NGHIEPVU_390).
export async function shoppingWalletLocked(executor: Executor, companyId: string): Promise<boolean> {
  return (await executor.execute<{ is_locked: boolean }>(sql`SELECT is_locked FROM marketplace.shopping_wallet_settings WHERE company_id = ${companyId}`)).rows[0]?.is_locked ?? false;
}

// Tài khoản bị chặn ví (THAY_DOI_22; QUYTAC_NGHIEPVU_391): chặn ví nào chỉ ảnh hưởng ví đó.
export async function walletBlocked(executor: Executor, userId: string, wallet: WalletKind): Promise<boolean> {
  return (await executor.execute(sql`SELECT 1 FROM marketplace.wallet_blocks WHERE user_id = ${userId} AND wallet = ${wallet} AND is_blocked`)).rows.length > 0;
}

export async function shoppingWalletState(executor: Executor, userId: string, companyId: string): Promise<{ balance: number; locked: boolean; blocked: boolean }> {
  const balance = Number((await executor.execute<{ balance: string }>(sql`SELECT balance::text FROM marketplace.shopping_wallets WHERE user_id = ${userId}`)).rows[0]?.balance ?? 0);
  return { balance, locked: await shoppingWalletLocked(executor, companyId), blocked: await walletBlocked(executor, userId, "shopping") };
}

// Cộng hoặc trừ ví, khóa dòng ví; trừ quá số dư thì báo lỗi (ràng buộc số dư không âm cũng chặn).
async function move(executor: Executor, userId: string, amount: number, kind: ShoppingWalletTransactionKind, orderId: string, note: string | null): Promise<void> {
  if (amount === 0) return;
  await executor.execute(sql`INSERT INTO marketplace.shopping_wallets (user_id) VALUES (${userId}) ON CONFLICT DO NOTHING`);
  const current = Number((await executor.execute<{ balance: string }>(sql`SELECT balance::text FROM marketplace.shopping_wallets WHERE user_id = ${userId} FOR UPDATE`)).rows[0]!.balance);
  if (current + amount < 0) throw new ApiError("BUSINESS_RULE", "shoppingWalletChanged");
  const wallet = (
    await executor.execute<{ balance: string }>(sql`
    UPDATE marketplace.shopping_wallets SET balance = balance + ${amount}::numeric, updated_at = now() WHERE user_id = ${userId} RETURNING balance::text`)
  ).rows[0]!;
  await executor.execute(sql`
    INSERT INTO marketplace.shopping_wallet_transactions (user_id, kind, amount, balance_after, order_id, note)
    VALUES (${userId}, ${kind}, ${amount}::numeric, ${wallet.balance}::numeric, ${orderId}, ${note})`);
}

// Trả đơn bằng ví lúc đặt, bước 1 (trước khi lập đơn): kiểm khóa, chặn, khóa dòng ví, trả về số sẽ trừ (tối đa số cần trả).
export async function walletAmountFor(executor: Executor, input: { userId: string; companyId: string; total: number }): Promise<number> {
  if (await shoppingWalletLocked(executor, input.companyId)) throw new ApiError("BUSINESS_RULE", "shoppingWalletLocked");
  if (await walletBlocked(executor, input.userId, "shopping")) throw new ApiError("BUSINESS_RULE", "shoppingWalletBlocked");
  const row = (await executor.execute<{ balance: string }>(sql`SELECT balance::text FROM marketplace.shopping_wallets WHERE user_id = ${input.userId} FOR UPDATE`)).rows[0];
  return Math.max(Math.min(Number(row?.balance ?? 0), input.total), 0);
}

// Bước 2 (sau khi lập đơn với wallet_amount): ghi giao dịch trừ ví.
export async function chargeWallet(executor: Executor, userId: string, orderId: string, amount: number): Promise<void> {
  await move(executor, userId, -amount, "order_payment", orderId, null);
}

// Hoàn phần trả bằng ví chưa hoàn của đơn (hủy đơn thường; nhận hàng trả vượt tiền mặt), tối đa limit nếu có.
export async function returnWalletPart(
  executor: Executor,
  orderId: string,
  kind: ShoppingWalletTransactionKind = "order_refund",
  note: string | null = null,
  limit: number | null = null,
): Promise<number> {
  const row = (
    await executor.execute<{ buyer_user_id: string; available: string }>(sql`
    SELECT buyer_user_id, (wallet_amount - wallet_refunded_amount)::text AS available FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`)
  ).rows[0]!;
  const amount = limit === null ? Number(row.available) : Math.min(Number(row.available), limit);
  if (amount <= 0) return 0;
  await executor.execute(sql`UPDATE marketplace.orders SET wallet_refunded_amount = wallet_refunded_amount + ${amount} WHERE id = ${orderId}`);
  await move(executor, row.buyer_user_id, amount, kind, orderId, note);
  return amount;
}

// Hoàn vào ví mua sắm cho đơn mua chung (QUYTAC_NGHIEPVU_330, 331): lấy từ phần tiền mặt đã thu chưa hoàn trước, sau đó phần trả bằng ví.
// amount null: hoàn toàn bộ phần chưa hoàn. Phần tiền mặt hoàn vào ví ghi vào refunded_amount để luồng hoàn ngân hàng không hoàn lần nữa.
export async function refundOrderToWallet(executor: Executor, orderId: string, amount: number | null, kind: ShoppingWalletTransactionKind, note: string | null = null): Promise<number> {
  const row = (
    await executor.execute<{ buyer_user_id: string; cash: string; wallet: string }>(sql`
    SELECT buyer_user_id,
      (paid_amount - refunded_amount - coalesce((SELECT sum(f.amount) FROM marketplace.refunds f WHERE f.order_id = m.id AND f.status = 'pending'), 0))::text AS cash,
      (wallet_amount - wallet_refunded_amount)::text AS wallet
    FROM marketplace.orders m WHERE id = ${orderId} FOR UPDATE`)
  ).rows[0]!;
  const cashAvailable = Math.max(Number(row.cash), 0);
  const walletAvailable = Math.max(Number(row.wallet), 0);
  const total = amount === null ? cashAvailable + walletAvailable : Math.min(amount, cashAvailable + walletAvailable);
  if (total <= 0) return 0;
  const cashPart = Math.min(total, cashAvailable);
  const walletPart = total - cashPart;
  await executor.execute(sql`
    UPDATE marketplace.orders SET refunded_amount = refunded_amount + ${cashPart}, wallet_refunded_amount = wallet_refunded_amount + ${walletPart} WHERE id = ${orderId}`);
  await move(executor, row.buyer_user_id, total, kind, orderId, note);
  return total;
}
