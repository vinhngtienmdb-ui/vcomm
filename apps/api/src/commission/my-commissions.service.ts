// Hoa hồng của tôi: phát sinh tháng, bảng hoa hồng có dòng của chính người xem (CHUC_NANG_102; QUYTAC_NGHIEPVU_140; API_115).
import { Inject, Injectable } from "@nestjs/common";
import type { MyCommissionsResponse } from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency } from "../purchasing/requisitions.service";

@Injectable()
export class MyCommissionsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async month(actor: Actor, month: string): Promise<MyCommissionsResponse> {
    const from = `${month}-01`;
    const events = await this.database.execute<{
      event_date: string;
      document_no: string | null;
      customer_name: string | null;
      base_amount: string;
      percent: string;
      amount: string;
    }>(sql`
      SELECT e.event_date::text, o.document_no, coalesce(c.name, o.buyer_name) AS customer_name, e.base_amount::text, e.percent::text, e.amount::text
      FROM finance.commission_events e JOIN sales.orders o ON o.id = e.order_id LEFT JOIN crm.partners c ON c.id = o.customer_id
      WHERE e.company_id = ${actor.companyId} AND e.user_id = ${actor.userId} AND e.event_date >= ${from}::date AND e.event_date < (${from}::date + interval '1 month')
      ORDER BY e.event_date DESC, e.created_at DESC`);
    const base = events.rows.reduce((total, row) => total + Number(row.base_amount), 0);
    const commission = events.rows.reduce((total, row) => total + Number(row.amount), 0);
    const target = (
      await this.database.execute<{ amount: string }>(sql`
      SELECT amount::text FROM finance.commission_targets WHERE company_id = ${actor.companyId} AND user_id = ${actor.userId} AND month = ${month}`)
    ).rows[0]?.amount;
    const statements = await this.database.execute<{
      month: string;
      document_no: string | null;
      status: "pending" | "posted";
      base_amount: string;
      achieved_percent: string | null;
      multiplier: string;
      amount: string;
    }>(sql`
      SELECT s.month, s.document_no, s.status, l.base_amount::text, l.achieved_percent::text, l.multiplier::text, l.amount::text
      FROM finance.commission_statements s JOIN finance.commission_statement_lines l ON l.statement_id = s.id AND l.user_id = ${actor.userId}
      WHERE s.company_id = ${actor.companyId} AND s.status IN ('pending', 'posted') ORDER BY s.month DESC LIMIT 12`);
    return {
      month,
      currency: await companyCurrency(this.database, actor.companyId),
      baseAmount: trimDecimal(base.toFixed(4)),
      commissionAmount: trimDecimal(commission.toFixed(4)),
      targetAmount: target ? trimDecimal(target) : null,
      achievedPercent: target && Number(target) > 0 ? trimDecimal(((base / Number(target)) * 100).toFixed(2)) : null,
      events: events.rows.map((row) => ({
        date: row.event_date,
        orderNo: row.document_no,
        customerName: row.customer_name,
        baseAmount: trimDecimal(row.base_amount),
        percent: trimDecimal(row.percent),
        amount: trimDecimal(row.amount),
      })),
      statements: statements.rows.map((row) => ({
        month: row.month,
        documentNo: row.document_no,
        status: row.status,
        baseAmount: trimDecimal(row.base_amount),
        achievedPercent: row.achieved_percent ? trimDecimal(row.achieved_percent) : null,
        multiplier: trimDecimal(row.multiplier),
        amount: trimDecimal(row.amount),
      })),
    };
  }
}
