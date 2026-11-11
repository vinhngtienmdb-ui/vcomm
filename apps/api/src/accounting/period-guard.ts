// Kiểm kỳ kế toán đã khóa (QUYTAC_NGHIEPVU_97). Tách riêng để module Kho, Tài chính gọi được mà không nhập vòng với các service kế toán.
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;

// Ngày khóa sổ của công ty; công ty chưa khởi tạo kế toán: null. Khóa dòng cài đặt (hoặc dòng công ty khi chưa có cài đặt)
// để không chạy song song với khóa sổ, khởi tạo kế toán.
export async function ledgerSettings(executor: Executor, companyId: string): Promise<{ locked: string | null } | null> {
  const read = async () => (await executor.execute<{ locked_through: string | null }>(sql`SELECT locked_through::text FROM accounting.settings WHERE company_id = ${companyId} FOR SHARE`)).rows[0];
  let row = await read();
  if (!row) {
    await executor.execute(sql`SELECT 1 FROM core.companies WHERE id = ${companyId} FOR SHARE`);
    row = await read();
  }
  return row ? { locked: row.locked_through } : null;
}

// Ngày thuộc kỳ đã khóa thì từ chối. Trả về công ty đã khởi tạo kế toán hay chưa.
export async function assertOpenPeriod(executor: Executor, companyId: string, date: string): Promise<boolean> {
  const settings = await ledgerSettings(executor, companyId);
  if (!settings) return false;
  if (settings.locked && date.slice(0, 10) <= settings.locked) throw new ApiError("BUSINESS_RULE", "periodLocked");
  return true;
}
