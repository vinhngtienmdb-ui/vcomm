// Đổi chế độ kế toán của công ty (API_21; QUYTAC_NGHIEPVU_93): đã có bút toán thì từ chối; đã khởi tạo kế toán nhưng chưa có bút toán thì bỏ khởi tạo để khởi tạo lại theo chế độ mới.
// Tách riêng để module Tổ chức gọi được mà không nhập vòng với các service kế toán.
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";

export async function beforeRegimeChange(executor: Pick<Database, "execute">, companyId: string): Promise<void> {
  const journals = await executor.execute(sql`SELECT 1 FROM accounting.journals WHERE company_id = ${companyId} LIMIT 1`);
  if (journals.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { accountingRegime: "ledgerHasJournals" } });
  await executor.execute(sql`DELETE FROM accounting.posting_rules WHERE company_id = ${companyId}`);
  await executor.execute(sql`DELETE FROM accounting.accounts WHERE company_id = ${companyId}`);
  await executor.execute(sql`DELETE FROM accounting.settings WHERE company_id = ${companyId}`);
}
