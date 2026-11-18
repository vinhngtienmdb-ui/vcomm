// ERP: doanh thu iPOS theo cửa hàng, điểm bán và đối soát thu hộ, điểm, voucher (CONG_VIEC_74 L6; CHUC_NANG_260; QUYTAC_NGHIEPVU_626, 627; API_357).
// Chỉ đọc. Không trả dòng hàng, giá vốn, khách của cửa hàng. Phạm vi: cửa hàng thuộc công ty vận hành sàn.
import { Inject, Injectable } from "@nestjs/common";
import type { IposErpRevenue, IposErpRevenueRow, IposMismatchKind, IposMismatchRow, IposReconciliation, iposErpPeriodQuery } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";

type Period = z.infer<typeof iposErpPeriodQuery>;
const maxDays = 366;

type MismatchSqlRow = {
  kind: IposMismatchKind;
  merchant_id: string;
  merchant_name: string;
  outlet_name: string;
  occurred_at: Date;
  sale_document_no: string | null;
  sale_status: "completed" | "cancelled" | null;
  checkout_no: string | null;
  transaction_id: string | null;
  transaction_no: string | null;
  transaction_status: string | null;
  settlement_id: string | null;
  settlement_no: string | null;
  ipos_amount: string | null;
  vcomm_amount: string | null;
};

const money = (value: string | null) => (value === null ? null : String(Number(value)));

@Injectable()
export class IposErpService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  private check(period: Period): void {
    if (period.from > period.to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "invalidValue" } });
    const days = (new Date(`${period.to}T00:00:00Z`).getTime() - new Date(`${period.from}T00:00:00Z`).getTime()) / 86_400_000 + 1;
    if (days > maxDays) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "iposPeriodTooLong" } });
  }

  // Khoảng ngày theo giờ Việt Nam trên cột thời điểm.
  private within(column: SQL, period: Period): SQL {
    return sql`(${column} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date BETWEEN ${period.from}::date AND ${period.to}::date`;
  }

  private merchants(actor: BuyerAdminActor, period: Period, alias: string): SQL {
    const column = sql.raw(`${alias}.merchant_id`);
    return sql`${column} IN (SELECT id FROM affiliate.merchants WHERE company_id = ${actor.operatorCompanyId}) ${period.merchantId ? sql`AND ${column} = ${period.merchantId}` : sql``}`;
  }

  // Doanh thu thuần = tổng hóa đơn trong khoảng − tiền hàng trả trong khoảng (như báo cáo cửa hàng, QUYTAC_NGHIEPVU_625); phương thức theo dòng thanh toán.
  async revenue(actor: BuyerAdminActor, period: Period): Promise<IposErpRevenue> {
    this.check(period);
    const rows = await this.database.execute<{
      merchant_id: string;
      merchant_name: string;
      outlet_id: string;
      outlet_name: string;
      gross: string;
      returns: string;
      sales_count: number;
      cash: string;
      vietqr: string;
      vcomm_app: string;
      points_voucher: string;
      shift_count: number;
      cash_difference: string;
    }>(sql`
      WITH s AS (SELECT * FROM ipos.sales s WHERE ${this.merchants(actor, period, "s")} AND ${this.within(sql`s.sold_at`, period)}),
        r AS (SELECT r.outlet_id, sum(r.amount) AS amount FROM ipos.returns r WHERE ${this.merchants(actor, period, "r")} AND ${this.within(sql`r.created_at`, period)} GROUP BY 1),
        p AS (SELECT s.outlet_id, p.method, sum(p.amount) AS amount FROM ipos.sale_payments p JOIN s ON s.id = p.sale_id GROUP BY 1, 2),
        sh AS (SELECT sh.outlet_id, count(*)::int AS shifts, COALESCE(sum(sh.difference), 0) AS difference FROM ipos.shifts sh
          WHERE ${this.merchants(actor, period, "sh")} AND sh.closed_at IS NOT NULL AND ${this.within(sql`sh.closed_at`, period)} GROUP BY 1),
        g AS (SELECT s.outlet_id, sum(s.total) AS total, count(*)::int AS sales FROM s GROUP BY 1),
        outlets AS (SELECT outlet_id FROM g UNION SELECT outlet_id FROM r UNION SELECT outlet_id FROM sh)
      SELECT m.id AS merchant_id, pt.name AS merchant_name, o.id AS outlet_id, o.name AS outlet_name,
        COALESCE(g.total, 0)::text AS gross, COALESCE(r.amount, 0)::text AS returns, COALESCE(g.sales, 0)::int AS sales_count,
        COALESCE((SELECT amount FROM p WHERE p.outlet_id = o.id AND p.method = 'cash'), 0)::text AS cash,
        COALESCE((SELECT amount FROM p WHERE p.outlet_id = o.id AND p.method = 'vietqr'), 0)::text AS vietqr,
        COALESCE((SELECT amount FROM p WHERE p.outlet_id = o.id AND p.method = 'vcomm_app'), 0)::text AS vcomm_app,
        COALESCE((SELECT sum(amount) FROM p WHERE p.outlet_id = o.id AND p.method IN ('points', 'voucher')), 0)::text AS points_voucher,
        COALESCE(sh.shifts, 0)::int AS shift_count, COALESCE(sh.difference, 0)::text AS cash_difference
      FROM outlets x JOIN affiliate.outlets o ON o.id = x.outlet_id JOIN affiliate.merchants m ON m.id = o.merchant_id JOIN crm.partners pt ON pt.id = m.partner_id
      LEFT JOIN g ON g.outlet_id = o.id LEFT JOIN r ON r.outlet_id = o.id LEFT JOIN sh ON sh.outlet_id = o.id
      ORDER BY pt.name, o.name`);
    const list: IposErpRevenueRow[] = rows.rows.map((row) => ({
      merchantId: row.merchant_id,
      merchantName: row.merchant_name,
      outletId: row.outlet_id,
      outletName: row.outlet_name,
      netRevenue: String(Number(row.gross) - Number(row.returns)),
      grossSales: money(row.gross)!,
      returns: money(row.returns)!,
      salesCount: row.sales_count,
      cash: money(row.cash)!,
      vietqr: money(row.vietqr)!,
      vcommApp: money(row.vcomm_app)!,
      pointsVoucher: money(row.points_voucher)!,
      shiftCount: row.shift_count,
      cashDifference: money(row.cash_difference)!,
    }));
    const sum = (key: keyof IposErpRevenueRow) => String(list.reduce((total, row) => total + Number(row[key]), 0));
    return {
      rows: list,
      totals: {
        netRevenue: sum("netRevenue"),
        grossSales: sum("grossSales"),
        returns: sum("returns"),
        salesCount: list.reduce((total, row) => total + row.salesCount, 0),
        cash: sum("cash"),
        vietqr: sum("vietqr"),
        vcommApp: sum("vcommApp"),
        pointsVoucher: sum("pointsVoucher"),
        shiftCount: list.reduce((total, row) => total + row.shiftCount, 0),
        cashDifference: sum("cashDifference"),
      },
    };
  }

  private mismatch(row: MismatchSqlRow): IposMismatchRow {
    return {
      kind: row.kind,
      merchantId: row.merchant_id,
      merchantName: row.merchant_name,
      outletName: row.outlet_name,
      occurredAt: new Date(row.occurred_at).toISOString(),
      saleDocumentNo: row.sale_document_no,
      saleStatus: row.sale_status,
      checkoutNo: row.checkout_no,
      transactionId: row.transaction_id,
      transactionNo: row.transaction_no,
      transactionStatus: row.transaction_status,
      settlementId: row.settlement_id,
      settlementNo: row.settlement_no,
      iposAmount: money(row.ipos_amount),
      vcommAmount: money(row.vcomm_amount),
    };
  }

  // Thu hộ (QUYTAC_NGHIEPVU_627 khoản 1): đơn chờ do iPOS tạo, thu qua ứng dụng VComm; khớp dòng "Ứng dụng VComm" của hóa đơn với tiền thu hộ của `LK…`.
  async collection(actor: BuyerAdminActor, period: Period): Promise<IposReconciliation> {
    this.check(period);
    const rows = await this.database.execute<MismatchSqlRow & { matched: boolean }>(sql`
      WITH c AS (
        SELECT c.id, c.document_no, c.status, c.merchant_id, c.outlet_id, c.created_at, c.affiliate_transaction_id FROM instore.checkouts c
        WHERE c.source = 'ipos' AND c.collect_in_app AND ${this.merchants(actor, period, "c")} AND ${this.within(sql`c.created_at`, period)}),
        pay AS (SELECT p.instore_checkout_id, s.document_no, s.status, p.amount FROM ipos.sale_payments p JOIN ipos.sales s ON s.id = p.sale_id
          WHERE p.method = 'vcomm_app' AND p.instore_checkout_id IN (SELECT id FROM c)),
        joined AS (
          SELECT c.*, t.document_no AS transaction_no, t.status AS transaction_status, t.collected_amount, t.id AS transaction_id,
            pay.document_no AS sale_document_no, pay.status AS sale_status, pay.amount AS ipos_amount
          FROM c LEFT JOIN affiliate.transactions t ON t.id = c.affiliate_transaction_id LEFT JOIN pay ON pay.instore_checkout_id = c.id
          WHERE pay.instore_checkout_id IS NOT NULL OR COALESCE(t.collected_amount, 0) > 0)
      SELECT CASE
          WHEN j.sale_document_no IS NULL THEN 'missing_invoice'
          WHEN (j.transaction_status IS DISTINCT FROM 'completed' OR j.status <> 'completed') AND j.sale_status = 'completed' THEN 'collection_cancelled'
          WHEN j.ipos_amount IS DISTINCT FROM j.collected_amount AND j.sale_status = 'completed' THEN 'amount_mismatch'
        END AS kind,
        (j.sale_document_no IS NOT NULL AND j.transaction_status = 'completed' AND j.status = 'completed' AND j.ipos_amount = j.collected_amount) AS matched,
        j.merchant_id, pt.name AS merchant_name, o.name AS outlet_name, j.created_at AS occurred_at, j.sale_document_no, j.sale_status,
        j.document_no AS checkout_no, j.transaction_id, j.transaction_no, j.transaction_status, NULL::uuid AS settlement_id, NULL::text AS settlement_no,
        j.ipos_amount::text, j.collected_amount::text AS vcomm_amount
      FROM joined j JOIN affiliate.merchants m ON m.id = j.merchant_id JOIN crm.partners pt ON pt.id = m.partner_id JOIN affiliate.outlets o ON o.id = j.outlet_id
      ORDER BY j.created_at DESC`);
    return this.summarize(rows.rows);
  }

  // Điểm, voucher (QUYTAC_NGHIEPVU_627 khoản 2): giao dịch `LK…` của máy bán (gắn ca hoặc từ đơn chờ iPOS); khớp dòng "Điểm", "Voucher" với tiền điểm,
  // voucher của giao dịch; ghi bảng đối soát tuần có giao dịch. Giao dịch còn trong ca đang mở chưa gắn hóa đơn là đang làm, không tính lệch.
  async loyalty(actor: BuyerAdminActor, period: Period): Promise<IposReconciliation> {
    this.check(period);
    const rows = await this.database.execute<MismatchSqlRow & { matched: boolean }>(sql`
      WITH ids AS (
        SELECT l.affiliate_transaction_id AS id FROM ipos.shift_links l WHERE l.affiliate_transaction_id IS NOT NULL
        UNION SELECT c.affiliate_transaction_id FROM instore.checkouts c WHERE c.source = 'ipos' AND c.affiliate_transaction_id IS NOT NULL
        UNION SELECT p.affiliate_transaction_id FROM ipos.sale_payments p WHERE p.affiliate_transaction_id IS NOT NULL),
        t AS (SELECT t.* FROM affiliate.transactions t JOIN ids ON ids.id = t.id
          WHERE t.status IN ('completed', 'cancelled') AND (t.redeemed_amount > 0 OR t.voucher_discount > 0)
            AND ${this.merchants(actor, period, "t")} AND ${this.within(sql`t.created_at`, period)}),
        pay AS (SELECT p.affiliate_transaction_id, min(s.document_no) AS document_no, min(s.status) AS status, sum(p.amount) AS amount
          FROM ipos.sale_payments p JOIN ipos.sales s ON s.id = p.sale_id
          WHERE p.method IN ('points', 'voucher') AND p.affiliate_transaction_id IN (SELECT id FROM t) GROUP BY 1),
        joined AS (
          SELECT t.id AS transaction_id, t.document_no AS transaction_no, t.status AS transaction_status, t.merchant_id, t.outlet_id, t.created_at,
            t.redeemed_amount + t.voucher_discount AS vcomm_amount, t.settlement_id, st.document_no AS settlement_no,
            pay.document_no AS sale_document_no, pay.status AS sale_status, pay.amount AS ipos_amount,
            (SELECT c.document_no FROM instore.checkouts c WHERE c.affiliate_transaction_id = t.id) AS checkout_no,
            EXISTS (SELECT 1 FROM ipos.shift_links l JOIN ipos.shifts sh ON sh.id = l.shift_id WHERE l.affiliate_transaction_id = t.id AND sh.closed_at IS NULL) AS in_open_shift
          FROM t LEFT JOIN pay ON pay.affiliate_transaction_id = t.id LEFT JOIN affiliate.settlements st ON st.id = t.settlement_id)
      SELECT CASE
          WHEN j.sale_document_no IS NULL AND j.transaction_status = 'completed' THEN 'missing_invoice'
          WHEN j.sale_document_no IS NOT NULL AND j.transaction_status = 'cancelled' AND j.sale_status = 'completed' THEN 'transaction_cancelled'
          WHEN j.sale_status = 'cancelled' AND j.transaction_status = 'completed' THEN 'invoice_cancelled'
          WHEN j.sale_status = 'completed' AND j.ipos_amount <> j.vcomm_amount THEN 'amount_mismatch'
        END AS kind,
        (j.sale_status = 'completed' AND j.transaction_status = 'completed' AND j.ipos_amount = j.vcomm_amount) AS matched,
        j.merchant_id, pt.name AS merchant_name, o.name AS outlet_name, j.created_at AS occurred_at, j.sale_document_no, j.sale_status, j.checkout_no,
        j.transaction_id, j.transaction_no, j.transaction_status, j.settlement_id, j.settlement_no, j.ipos_amount::text, j.vcomm_amount::text
      FROM joined j JOIN affiliate.merchants m ON m.id = j.merchant_id JOIN crm.partners pt ON pt.id = m.partner_id JOIN affiliate.outlets o ON o.id = j.outlet_id
      WHERE NOT (j.in_open_shift AND j.sale_document_no IS NULL)
      ORDER BY j.created_at DESC`);
    return this.summarize(rows.rows);
  }

  private summarize(rows: (MismatchSqlRow & { matched: boolean })[]): IposReconciliation {
    const matched = rows.filter((row) => row.matched);
    return {
      matched: matched.length,
      matchedAmount: String(matched.reduce((total, row) => total + Number(row.ipos_amount ?? 0), 0)),
      mismatches: rows.filter((row) => row.kind !== null).map((row) => this.mismatch(row)),
    };
  }
}
