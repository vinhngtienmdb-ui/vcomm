// Đối soát tuần với người bán dropship (CONG_VIEC_62 CHUC_NANG_225; QUYTAC_NGHIEPVU_508, 509; API_312, API_313; MAN_HINH_240, MAN_HINH_241).
// Hệ thống lập bảng Nháp lúc 2 giờ thứ Hai cho tuần trước (thứ Hai đến Chủ nhật, giờ Việt Nam): A tiền hàng có thuế của phiếu xuất, B trả hàng, C thu hộ đã ghi sổ,
// D phí giao các vận đơn kết thúc (đã giao, hoàn hàng), E thuế phí giao. Chứng từ trễ của tuần trước vào bảng tuần sau (mỗi chứng từ vào đúng một bảng).
// Kế toán xác nhận: lập đơn bán dịch vụ phí giao D (thuế E theo sản phẩm) cho người bán, công nợ, bút toán, hóa đơn điện tử theo luồng đơn bán dịch vụ có sẵn
// (quyết định người dùng 2026-11-16); số còn lại âm thì lập phiếu chi hoàn tiền khách ở trạng thái nháp, kế toán gửi theo luồng phiếu chi.
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  confirmResellerSettlementSchema,
  ResellerSettlementLineKind,
  ResellerSettlementListItem,
  ResellerSettlementListResponse,
  resellerSettlementListQuerySchema,
  ResellerSettlementResponse,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { vietnamToday } from "../marketplace/shop.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { SalesOrdersService } from "../sales/sales-orders.service";
import { financeAudit, financePermissions, requireFinancePermission } from "./finance-context";

type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0];
type SourceRow = { kind: ResellerSettlementLineKind; source_id: string; order_id: string; document_no: string; document_date: string; amount: string };
type SettlementRow = {
  id: string;
  company_id: string;
  document_no: string;
  reseller_id: string;
  reseller_name: string;
  week_start: Date | string;
  issue_amount: string;
  return_amount: string;
  collection_amount: string;
  fee_amount: string;
  fee_tax_rate: string;
  fee_tax_amount: string;
  remaining_amount: string;
  status: "draft" | "confirmed";
  currency: string;
  fee_order_id: string | null;
  refund_payment_id: string | null;
  confirmed_by_name: string | null;
  confirmed_at: Date | null;
  version: number;
};

const vatFraction = (rate: string) => (["0", "5", "8", "10"].includes(rate) ? Number(rate) / 100 : 0);
// Thuế suất phí giao khi công ty chưa chọn sản phẩm dịch vụ phí giao (QUYTAC_NGHIEPVU_509, mặc định 8%).
const defaultFeeTaxRate = "8";

@Injectable()
export class ResellerSettlementsService {
  private readonly logger = new Logger(ResellerSettlementsService.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly salesOrders: SalesOrdersService,
  ) {}

  async list(actor: Actor, query: z.output<typeof resellerSettlementListQuerySchema>): Promise<ResellerSettlementListResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.manageDebts);
    const conditions: SQL[] = [sql`s.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`s.status = ${query.status}`);
    if (query.resellerId) conditions.push(sql`s.reseller_id = ${query.resellerId}`);
    if (query.weekStart) conditions.push(sql`s.week_start = ${query.weekStart}::date`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM finance.reseller_settlements s WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<SettlementRow>(
      sql`${this.select()} WHERE ${where} ORDER BY s.week_start DESC, r.name, s.document_no LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    const resellers = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT DISTINCT r.id, r.name FROM finance.reseller_settlements s JOIN crm.partners r ON r.id = s.reseller_id WHERE s.company_id = ${actor.companyId} ORDER BY r.name`);
    return { data: rows.rows.map((row) => this.toItem(row)), page: query.page, pageSize: query.pageSize, total, resellers: resellers.rows };
  }

  async detail(actor: Actor, id: string): Promise<ResellerSettlementResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.manageDebts);
    const row = (await this.database.execute<SettlementRow>(sql`${this.select()} WHERE s.id = ${id} AND s.company_id = ${actor.companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const lines = await this.database.execute<{ kind: ResellerSettlementLineKind; document_no: string; document_date: Date | string; order_id: string; order_code: string | null; amount: string }>(sql`
      SELECT l.kind, l.document_no, l.document_date, l.order_id, coalesce(o.partner_order_code, o.document_no) AS order_code, l.amount::text
      FROM finance.reseller_settlement_lines l JOIN sales.orders o ON o.id = l.order_id WHERE l.settlement_id = ${id}
      ORDER BY array_position(ARRAY['issue', 'return', 'collection', 'shipping_fee'], l.kind), l.document_date, l.document_no`);
    const counts: Record<ResellerSettlementLineKind, number> = { issue: 0, return: 0, collection: 0, shipping_fee: 0 };
    for (const line of lines.rows) counts[line.kind] += 1;
    const feeOrder = row.fee_order_id
      ? (await this.database.execute<{ id: string; document_no: string | null }>(sql`SELECT id, document_no FROM sales.orders WHERE id = ${row.fee_order_id}`)).rows[0]!
      : null;
    const payment = row.refund_payment_id
      ? (
          await this.database.execute<{ id: string; document_no: string | null; status: string; amount: string }>(sql`
          SELECT id, document_no, status, amount::text FROM finance.payments WHERE id = ${row.refund_payment_id}`)
        ).rows[0]!
      : null;
    return {
      ...this.toItem(row),
      counts,
      lines: lines.rows.map((line) => ({
        kind: line.kind,
        documentNo: line.document_no,
        documentDate: day(line.document_date),
        orderId: line.order_id,
        orderCode: line.order_code,
        amount: trimDecimal(line.amount),
      })),
      feeOrder: feeOrder ? { id: feeOrder.id, documentNo: feeOrder.document_no } : null,
      refundPayment: payment ? { id: payment.id, documentNo: payment.document_no, status: payment.status, amount: trimDecimal(payment.amount) } : null,
      confirmedByName: row.confirmed_by_name,
      confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
      canConfirm: row.status === "draft" && granted.has(financePermissions.manageDebts),
      version: row.version,
    };
  }

  // Lập bảng Nháp cho tuần trước của mọi người bán có chứng từ chưa vào bảng (lịch 2 giờ thứ Hai). today: ngày giờ Việt Nam, kiểm thử truyền vào.
  async generateWeekly(today?: string): Promise<number> {
    const date = today ?? (await vietnamToday(this.database));
    const weekStart = (await this.database.execute<{ week_start: string }>(sql`SELECT (date_trunc('week', ${date}::date) - interval '7 days')::date::text AS week_start`)).rows[0]!.week_start;
    const weekEnd = this.addDays(weekStart, 6);
    const candidates = await this.database.execute<{ company_id: string; reseller_id: string }>(sql`
      SELECT DISTINCT company_id, reseller_id FROM (${this.sources(null, null, weekEnd)}) s ORDER BY company_id, reseller_id`);
    let created = 0;
    for (const candidate of candidates.rows) {
      try {
        if (await this.generateFor(candidate.company_id, candidate.reseller_id, weekStart)) created += 1;
      } catch (error) {
        this.logger.error(`Không lập được bảng đối soát người bán ${candidate.reseller_id} tuần ${weekStart}: ${(error as Error).message}`);
      }
    }
    return created;
  }

  private async generateFor(companyId: string, resellerId: string, weekStart: string): Promise<boolean> {
    const weekEnd = this.addDays(weekStart, 6);
    return this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`reseller-settlement:${companyId}:${resellerId}`}))`);
      const exists = await transaction.execute(sql`
        SELECT 1 FROM finance.reseller_settlements WHERE company_id = ${companyId} AND reseller_id = ${resellerId} AND week_start = ${weekStart}::date`);
      if (exists.rows.length > 0) return false;
      const sources = (await transaction.execute<SourceRow>(this.sources(companyId, resellerId, weekEnd))).rows;
      if (sources.length === 0) return false;
      const sum = (kind: ResellerSettlementLineKind) => sources.filter((row) => row.kind === kind).reduce((total, row) => total + Number(row.amount), 0);
      const rate =
        (
          await transaction.execute<{ vat_rate: string }>(sql`
          SELECT p.vat_rate FROM sales.settings st JOIN catalog.variants v ON v.id = st.dropship_fee_variant_id JOIN catalog.products p ON p.id = v.product_id
          WHERE st.company_id = ${companyId}`)
        ).rows[0]?.vat_rate ?? defaultFeeTaxRate;
      const fee = sum("shipping_fee");
      const tax = Math.round(fee * vatFraction(rate));
      const [issue, returned, collected] = [sum("issue"), sum("return"), sum("collection")];
      const remaining = issue - returned - collected + fee + tax;
      const id = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.reseller_settlements (company_id, reseller_id, week_start, issue_amount, return_amount, collection_amount, fee_amount, fee_tax_rate, fee_tax_amount, remaining_amount)
        VALUES (${companyId}, ${resellerId}, ${weekStart}::date, ${issue.toFixed(4)}::numeric, ${returned.toFixed(4)}::numeric, ${collected.toFixed(4)}::numeric, ${fee.toFixed(4)}::numeric,
          ${rate}, ${tax.toFixed(4)}::numeric, ${remaining.toFixed(4)}::numeric) RETURNING id`)
      ).rows[0]!.id;
      for (const row of sources)
        await transaction.execute(sql`
          INSERT INTO finance.reseller_settlement_lines (settlement_id, kind, source_id, order_id, document_no, document_date, amount)
          VALUES (${id}, ${row.kind}, ${row.source_id}, ${row.order_id}, ${row.document_no}, ${row.document_date}::date, ${row.amount}::numeric)`);
      await this.auditService.record(
        {
          actorUserId: null,
          companyId,
          appCode: "finance",
          action: "reseller_settlement.generate",
          entityType: "reseller_settlement",
          entityId: id,
          afterData: { weekStart, lines: sources.length },
          ip: null,
          userAgent: "reseller-settlement-weekly",
          requestId: null,
        },
        transaction,
      );
      return true;
    });
  }

  // API_313: xác nhận bảng; lập đơn phí giao, phiếu chi hoàn tiền nháp khi số còn lại âm. Bảng đã xác nhận không sửa.
  async confirm(actor: Actor, id: string, input: z.output<typeof confirmResellerSettlementSchema>): Promise<ResellerSettlementResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.manageDebts);
    await this.salesOrders.prepareNumbering(actor);
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{
          status: string;
          version: number;
          reseller_id: string;
          document_no: string;
          week_start: string;
          fee_amount: string;
          issue_amount: string;
          return_amount: string;
          collection_amount: string;
        }>(sql`
        SELECT status, version, reseller_id, document_no, week_start::text, fee_amount::text, issue_amount::text, return_amount::text, collection_amount::text
        FROM finance.reseller_settlements WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      const today = await vietnamToday(transaction);
      let feeOrderId: string | null = null;
      let tax = 0;
      let rate: string | null = null;
      if (Number(row.fee_amount) > 0) {
        const setting = (
          await transaction.execute<{ variant_id: string; vat_rate: string }>(sql`
          SELECT st.dropship_fee_variant_id AS variant_id, p.vat_rate FROM sales.settings st JOIN catalog.variants v ON v.id = st.dropship_fee_variant_id
            JOIN catalog.products p ON p.id = v.product_id WHERE st.company_id = ${actor.companyId}`)
        ).rows[0];
        if (!setting) throw new ApiError("BUSINESS_RULE", "dropshipFeeProductMissing");
        // Kênh bán, kho của đơn phí giao lấy theo đơn người bán gần nhất trong bảng (phiếu dịch vụ cần kho, không ghi tồn).
        const source = (
          await transaction.execute<{ channel_id: string; warehouse_id: string }>(sql`
          SELECT o.channel_id, o.warehouse_id FROM finance.reseller_settlement_lines l JOIN sales.orders o ON o.id = l.order_id
          WHERE l.settlement_id = ${id} AND o.warehouse_id IS NOT NULL ORDER BY l.document_date DESC, o.document_no DESC LIMIT 1`)
        ).rows[0]!;
        const placed = await this.salesOrders.placeServiceWithin(transaction, actor, {
          customerId: row.reseller_id,
          channelId: source.channel_id,
          warehouseId: source.warehouse_id,
          orderDate: today,
          note: `Phí giao hàng dropship theo bảng đối soát ${row.document_no} (tuần từ ${row.week_start})`,
          variantId: setting.variant_id,
          netPrice: row.fee_amount,
        });
        feeOrderId = placed.orderId;
        tax = Number(placed.taxAmount);
        rate = setting.vat_rate;
      }
      const remaining = Number(row.issue_amount) - Number(row.return_amount) - Number(row.collection_amount) + Number(row.fee_amount) + tax;
      let paymentId: string | null = null;
      if (remaining < 0) {
        if (!input.fundId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fundId: "required" } });
        const fund = (await transaction.execute<{ status: string }>(sql`SELECT status FROM finance.funds WHERE id = ${input.fundId} AND company_id = ${actor.companyId}`)).rows[0];
        if (!fund) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fundId: "invalidValue" } });
        if (fund.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fundId: "fundInactive" } });
        paymentId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO finance.payments (company_id, kind, partner_id, fund_id, payment_date, amount, note, created_by, reseller_settlement_id)
          VALUES (${actor.companyId}, 'customer_refund', ${row.reseller_id}, ${input.fundId}, ${today}::date, ${(-remaining).toFixed(4)}::numeric,
            ${`Trả tiền người bán theo bảng đối soát ${row.document_no}`}, ${actor.userId}, ${id}) RETURNING id`)
        ).rows[0]!.id;
      }
      await transaction.execute(sql`
        UPDATE finance.reseller_settlements SET status = 'confirmed', fee_order_id = ${feeOrderId}, refund_payment_id = ${paymentId}, fee_tax_amount = ${tax.toFixed(4)}::numeric,
          fee_tax_rate = coalesce(${rate}, fee_tax_rate), remaining_amount = ${remaining.toFixed(4)}::numeric, confirmed_by = ${actor.userId}, confirmed_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record(
        { ...financeAudit(actor, "reseller_settlement"), action: "reseller_settlement.confirm", entityId: id, afterData: { feeOrderId, paymentId, remaining } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Chứng từ của đơn người bán chưa vào bảng nào, ngày chứng từ đến hết tuần đối soát; lọc công ty, người bán khi có.
  private sources(companyId: string | null, resellerId: string | null, weekEnd: string): SQL {
    const order = sql`o.is_reseller_dropship AND (${companyId}::uuid IS NULL OR o.company_id = ${companyId}) AND (${resellerId}::uuid IS NULL OR o.customer_id = ${resellerId})`;
    const unsettled = (kind: ResellerSettlementLineKind, source: SQL) => sql`NOT EXISTS (SELECT 1 FROM finance.reseller_settlement_lines x WHERE x.kind = ${kind} AND x.source_id = ${source})`;
    return sql`
      SELECT 'issue' AS kind, d.id AS source_id, o.id AS order_id, o.company_id, o.customer_id AS reseller_id, d.document_no, d.document_date::text, di.amount::text
      FROM inventory.documents d JOIN sales.orders o ON o.id = d.source_id AND d.source_type = 'sales.order'
        JOIN finance.debt_items di ON di.source_type = 'sales_issue' AND di.source_id = d.id
      WHERE ${order} AND d.type = 'sales_issue' AND d.status = 'posted' AND d.document_date <= ${weekEnd}::date AND ${unsettled("issue", sql`d.id`)}
      UNION ALL
      SELECT 'return', r.id, o.id, o.company_id, o.customer_id, r.document_no, r.document_date::text, di.amount::text
      FROM inventory.documents r JOIN inventory.documents d ON d.id = r.source_id JOIN sales.orders o ON o.id = d.source_id AND d.source_type = 'sales.order'
        JOIN finance.debt_items di ON di.source_type = 'sales_return' AND di.source_id = r.id
      WHERE ${order} AND r.type = 'sales_return' AND r.status = 'posted' AND r.document_date <= ${weekEnd}::date AND ${unsettled("return", sql`r.id`)}
      UNION ALL
      SELECT 'collection', l.id, o.id, o.company_id, o.customer_id, coalesce(cs.document_no, cs.statement_no), cs.statement_date::text, l.collected_amount::text
      FROM finance.collection_statement_lines l JOIN finance.collection_statements cs ON cs.id = l.statement_id JOIN sales.orders o ON o.id = l.order_id
      WHERE ${order} AND cs.status = 'posted' AND l.collected_amount > 0 AND cs.statement_date <= ${weekEnd}::date AND ${unsettled("collection", sql`l.id`)}
      UNION ALL
      SELECT 'shipping_fee', s.id, o.id, o.company_id, o.customer_id, coalesce(s.tracking_code, s.carrier_name, upper(s.carrier_code)), (s.finished_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text,
        s.fee::text
      FROM sales.order_shipments s JOIN sales.orders o ON o.id = s.order_id
      WHERE ${order} AND s.shipping_status IN ('delivered', 'returned') AND s.fee > 0 AND (s.finished_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${weekEnd}::date
        AND ${unsettled("shipping_fee", sql`s.id`)}`;
  }

  private addDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  private toItem(row: SettlementRow): ResellerSettlementListItem {
    const weekStart = day(row.week_start);
    return {
      id: row.id,
      documentNo: row.document_no,
      resellerId: row.reseller_id,
      resellerName: row.reseller_name,
      weekStart,
      weekEnd: this.addDays(weekStart, 6),
      issueAmount: trimDecimal(row.issue_amount),
      returnAmount: trimDecimal(row.return_amount),
      collectionAmount: trimDecimal(row.collection_amount),
      feeAmount: trimDecimal(row.fee_amount),
      feeTaxRate: row.fee_tax_rate,
      feeTaxAmount: trimDecimal(row.fee_tax_amount),
      remainingAmount: trimDecimal(row.remaining_amount),
      status: row.status,
      currency: row.currency,
    };
  }

  private select(): SQL {
    return sql`SELECT s.id, s.company_id, s.document_no, s.reseller_id, r.name AS reseller_name, s.week_start, s.issue_amount::text, s.return_amount::text, s.collection_amount::text,
      s.fee_amount::text, s.fee_tax_rate, s.fee_tax_amount::text, s.remaining_amount::text, s.status, c.base_currency AS currency, s.fee_order_id, s.refund_payment_id,
      u.full_name AS confirmed_by_name, s.confirmed_at, s.version
      FROM finance.reseller_settlements s JOIN crm.partners r ON r.id = s.reseller_id JOIN core.companies c ON c.id = s.company_id LEFT JOIN core.users u ON u.id = s.confirmed_by`;
  }
}
