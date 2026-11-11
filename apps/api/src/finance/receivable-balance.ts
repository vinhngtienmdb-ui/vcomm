// Dùng chung với module Bán hàng; tách riêng để không nhập vòng giữa các service.
import { sql, type SQL } from "drizzle-orm";

// Số dư công nợ phải thu của khách (trả trước làm giảm), dùng kiểm hạn mức công nợ của đơn bán (QUYTAC_NGHIEPVU_92).
export const receivableBalance = (companyId: SQL | string, partnerId: SQL | string) => sql`
  (SELECT coalesce(sum(CASE WHEN i.direction = 'debit' THEN i.open_amount ELSE -i.open_amount END), 0)
   FROM finance.debt_items i WHERE i.company_id = ${companyId} AND i.side = 'receivable' AND i.partner_id = ${partnerId})`;
