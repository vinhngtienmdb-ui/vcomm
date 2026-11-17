// Trạng thái bảo mật tài khoản dùng chung (CONG_VIEC_72; QUYTAC_NGHIEPVU_566): khóa dùng điểm sau khôi phục Smart OTP.
// Đọc bằng now() của cơ sở dữ liệu như quoteRedemption để mọi luồng dùng điểm thống nhất một mốc giờ.
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;

export async function redeemLockedUntil(executor: Executor, userId: string): Promise<string | null> {
  const row = (
    await executor.execute<{ until: Date | null }>(sql`
      SELECT redeem_locked_until AS until FROM core.account_security WHERE user_id = ${userId} AND redeem_locked_until > now()`)
  ).rows[0];
  return row?.until ? new Date(row.until).toISOString() : null;
}

export async function assertRedeemAllowed(executor: Executor, userId: string): Promise<void> {
  if (await redeemLockedUntil(executor, userId)) throw new ApiError("BUSINESS_RULE", "loyaltyRedeemLocked");
}
