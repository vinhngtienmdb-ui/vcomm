// CONG_VIEC_72 (QUYTAC_NGHIEPVU_570, 572): điều kiện tài khoản cổng cửa hàng đã thiết lập bảo mật, dùng trong truy vấn.
import { type SQL, sql } from "drizzle-orm";

// Điều kiện "đã thiết lập" của một tài khoản (cột user_id truyền vào): có mật khẩu và ứng dụng xác thực đã xác nhận;
// nếu bị đặt lại xác thực thì mật khẩu và ứng dụng xác thực phải đặt sau lần đặt lại. Dùng chung cho danh sách thành viên, thống kê.
export function portalSetUpSql(userId: SQL): SQL {
  return sql`(
    EXISTS (SELECT 1 FROM core.user_identities i WHERE i.user_id = ${userId} AND i.provider = 'password')
    AND EXISTS (SELECT 1 FROM core.mfa_factors f WHERE f.user_id = ${userId} AND f.factor_type = 'totp' AND f.confirmed_at IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM affiliate.members r WHERE r.user_id = ${userId} AND r.status = 'active' AND r.authentication_reset_at IS NOT NULL
        AND (NOT EXISTS (SELECT 1 FROM core.user_identities i WHERE i.user_id = ${userId} AND i.provider = 'password' AND i.password_changed_at > r.authentication_reset_at)
          OR NOT EXISTS (SELECT 1 FROM core.mfa_factors f WHERE f.user_id = ${userId} AND f.factor_type = 'totp' AND f.confirmed_at > r.authentication_reset_at))))`;
}
