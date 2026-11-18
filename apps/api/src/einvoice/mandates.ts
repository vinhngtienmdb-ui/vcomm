// Hóa đơn lập thay cửa hàng liên kết theo ủy nhiệm (CONG_VIEC_73 lát L6; QUYTAC_NGHIEPVU_588): ký hiệu riêng của cửa hàng, nhà cung cấp hỗ trợ ủy nhiệm.
import type { EinvoiceProvider } from "contracts";
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;

// Bộ kết nối MISA gửi người bán theo mã số thuế của tài khoản, chưa lập được theo ủy nhiệm (lựa chọn người dùng 2026-11-17): hóa đơn ở "Lỗi cài đặt", không gửi.
export const mandateSupported = (provider: EinvoiceProvider) => provider === "simulator";
export const mandateUnsupportedError = "einvoiceMandateUnsupported";

export async function mandateSeriesFor(executor: Executor, merchantId: string, year: number): Promise<string | null> {
  return (await executor.execute<{ series: string }>(sql`SELECT series FROM affiliate.einvoice_series WHERE merchant_id = ${merchantId} AND year = ${year}`)).rows[0]?.series ?? null;
}
