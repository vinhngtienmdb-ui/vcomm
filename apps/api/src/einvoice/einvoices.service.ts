// Hóa đơn điện tử (CONG_VIEC_16; CHUC_NANG_77; QUYTAC_NGHIEPVU_104, 105; API_91): lập khi phiếu xuất giao hàng ghi sổ,
// gửi nền qua nhà cung cấp của công ty (ngoài giao dịch cơ sở dữ liệu), gửi lại khi lỗi tạm thời, tra trạng thái, báo quá hạn.
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { EinvoiceKind, EinvoiceListItem, EinvoiceProvider, EinvoiceResponse, EinvoiceStatus, PageResponse, einvoiceListQuerySchema } from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { vietnamDate } from "../common/clock";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { StockDocumentsService } from "../inventory/stock-documents.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { amountInWords } from "./amount-in-words";
import { einvoicePermissions, providerConfig, seriesFor, settingsRow } from "./einvoice-settings.service";
import type { EinvoiceProviderAdapter, ProviderInvoice, ProviderResult } from "./providers/provider";
import { SimulatorProvider } from "./providers/simulator";

type Executor = Pick<Database, "execute">;
type VatRate = "0" | "5" | "8" | "10" | "exempt" | "not_declared";

// Gửi lại sau 1, 5, 15, 60 phút rồi mỗi 60 phút (QUYTAC_NGHIEPVU_105).
const retryMinutes = [1, 5, 15, 60];
export const retryDelayMinutes = (attempt: number) => retryMinutes[Math.min(Math.max(attempt - 1, 0), retryMinutes.length - 1)]!;
const providerTimeoutMilliseconds = 30_000;

// Ngày làm việc tiếp theo (bỏ thứ Bảy, Chủ nhật; chưa tính ngày nghỉ lễ).
export function nextWorkingDay(date: string): string {
  const moment = new Date(`${date}T00:00:00Z`);
  do moment.setUTCDate(moment.getUTCDate() + 1);
  while (moment.getUTCDay() === 0 || moment.getUTCDay() === 6);
  return moment.toISOString().slice(0, 10);
}

export interface InvoiceItem {
  lineNo: number;
  itemCode: string | null;
  itemName: string;
  unitName: string | null;
  quantity: number;
  unitPrice: number;
  vatRate: VatRate;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  isPromotion: boolean;
}

// Ghi hóa đơn mới (gốc, điều chỉnh, thay thế) trạng thái "Chờ gửi"; thiếu ký hiệu của năm thì "Lỗi cài đặt".
export async function insertInvoice(
  transaction: Executor,
  input: {
    companyId: string;
    sourceDocumentId: string;
    kind: EinvoiceKind;
    relatedInvoiceId: string | null;
    invoiceDate: string;
    settings: { provider: EinvoiceProvider; template_code: string; with_tax_code: boolean };
    seller: { name: string | null; taxCode: string | null; address: string | null };
    buyer: { partnerId: string | null; name: string | null; taxCode: string | null; address: string | null; anonymous: boolean };
    currency: string;
    items: InvoiceItem[];
    note: string | null;
  },
): Promise<string> {
  const total = (key: "netAmount" | "taxAmount" | "totalAmount") => Math.round(input.items.reduce((sum, item) => sum + item[key], 0) * 10000) / 10000;
  const series = await seriesFor(transaction, input.companyId, Number(input.invoiceDate.slice(0, 4)));
  const inserted = await transaction.execute<{ id: string }>(sql`
    INSERT INTO finance.einvoices (company_id, source_document_id, kind, related_invoice_id, provider, invoice_date, template_code, series, with_tax_code, seller, buyer, currency,
      net_amount, tax_amount, total_amount, note, status, last_error, due_date)
    VALUES (${input.companyId}, ${input.sourceDocumentId}, ${input.kind}, ${input.relatedInvoiceId}, ${input.settings.provider}, ${input.invoiceDate}::date, ${input.settings.template_code},
      ${series}, ${input.settings.with_tax_code}, ${JSON.stringify(input.seller)}::jsonb, ${JSON.stringify(input.buyer)}::jsonb, ${input.currency},
      ${total("netAmount")}, ${total("taxAmount")}, ${total("totalAmount")}, ${input.note}, ${series ? "pending" : "setup_error"}, ${series ? null : "einvoiceSeriesMissing"},
      ${nextWorkingDay(input.invoiceDate)}::date)
    RETURNING id`);
  const invoiceId = inserted.rows[0]!.id;
  for (const item of input.items)
    await transaction.execute(sql`
      INSERT INTO finance.einvoice_lines (invoice_id, line_no, item_code, item_name, unit_name, quantity, unit_price, vat_rate, net_amount, tax_amount, total_amount, is_promotion)
      VALUES (${invoiceId}, ${item.lineNo}, ${item.itemCode}, ${item.itemName}, ${item.unitName}, ${item.quantity}, ${item.unitPrice}, ${item.vatRate}, ${item.netAmount},
        ${item.taxAmount}, ${item.totalAmount}, ${item.isPromotion})`);
  return invoiceId;
}

// Dòng hóa đơn của phiếu xuất giao hàng hoặc phiếu nhận hàng trả lại: tiền theo lũy kế dòng đơn như công nợ (THAY_DOI_10), phiếu trả ghi âm.
export async function documentItems(transaction: Executor, documentId: string, type: "sales_issue" | "sales_return"): Promise<InvoiceItem[]> {
  const orderLine = type === "sales_issue" ? sql`sl.id = dl.source_line_id` : sql`sl.id = (SELECT il.source_line_id FROM inventory.document_lines il WHERE il.id = dl.source_line_id)`;
  const before =
    type === "sales_issue"
      ? sql`SELECT coalesce(sum(abs(o.base_quantity)), 0) AS before FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
          WHERE o.source_line_id = sl.id AND od.type = 'sales_issue' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)`
      : sql`SELECT coalesce(sum(abs(o.base_quantity)), 0) AS before FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
          JOIN inventory.document_lines oi ON oi.id = o.source_line_id
          WHERE oi.source_line_id = sl.id AND od.type = 'sales_return' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)`;
  const lines = (
    await transaction.execute<{ sku: string; name: string; unit_name: string; quantity: string; vat_rate: VatRate; gross: string; net: string; free: boolean; units: number }>(sql`
    WITH d AS (SELECT id, posted_at, finance.company_minor_units(company_id) AS units FROM inventory.documents WHERE id = ${documentId})
    SELECT v.sku, p.name, u.name_vi AS unit_name, abs(dl.quantity)::text AS quantity, sl.vat_rate, sl.total_amount = 0 AS free, d.units,
      finance.line_share(sl.total_amount, b.before, abs(dl.base_quantity), sl.base_quantity, d.units)::text AS gross,
      finance.line_share(sl.net_amount, b.before, abs(dl.base_quantity), sl.base_quantity, d.units)::text AS net
    FROM d JOIN inventory.document_lines dl ON dl.document_id = d.id JOIN sales.order_lines sl ON ${orderLine}
    JOIN catalog.variants v ON v.id = dl.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = dl.unit_id
    CROSS JOIN LATERAL (${before}) b
    ORDER BY dl.line_no`)
  ).rows;
  const sign = type === "sales_return" ? -1 : 1;
  return lines.map((line, index) => {
    const net = Number(line.net);
    const gross = Number(line.gross);
    const quantity = Number(line.quantity);
    const units = 10 ** Number(line.units);
    return {
      lineNo: index + 1,
      itemCode: line.sku,
      itemName: line.name,
      unitName: line.unit_name,
      quantity,
      // Đơn giá chưa thuế làm tròn theo đơn vị tiền tệ công ty (quyết định người dùng 2026-11-10); thành tiền giữ theo công nợ.
      unitPrice: quantity ? Math.round((net / quantity) * units) / units : 0,
      vatRate: line.vat_rate,
      netAmount: sign * net,
      taxAmount: sign * (Math.round((gross - net) * 10000) / 10000),
      totalAmount: sign * gross,
      isPromotion: line.free,
    };
  });
}

type InvoiceRow = {
  id: string;
  company_id: string;
  source_document_id: string;
  source_document_no: string | null;
  kind: EinvoiceKind;
  related_invoice_id: string | null;
  reference_id: string;
  provider: EinvoiceProvider;
  invoice_date: string;
  template_code: string;
  series: string | null;
  invoice_no: string | null;
  with_tax_code: boolean;
  tax_authority_code: string | null;
  provider_transaction_id: string | null;
  seller: { name: string | null; taxCode: string | null; address: string | null };
  buyer: { partnerId: string | null; name: string | null; taxCode: string | null; address: string | null; anonymous: boolean };
  currency: string;
  net_amount: string;
  tax_amount: string;
  total_amount: string;
  note: string | null;
  status: EinvoiceStatus;
  replaced_by_id: string | null;
  last_error: string | null;
  attempt_count: number;
  due_date: string;
  issued_at: Date | null;
  has_pdf: boolean;
  has_xml: boolean;
  overdue: boolean;
  version: number;
};
type LineRow = {
  line_no: number;
  item_code: string | null;
  item_name: string;
  unit_name: string | null;
  quantity: string;
  unit_price: string;
  vat_rate: VatRate;
  net_amount: string;
  tax_amount: string;
  total_amount: string;
  is_promotion: boolean;
};

const invoiceColumns = sql`
  e.id, e.company_id, e.source_document_id, d.document_no AS source_document_no, e.kind, e.related_invoice_id, e.reference_id, e.provider, e.invoice_date::text, e.template_code,
  e.series, e.invoice_no, e.with_tax_code, e.tax_authority_code, e.provider_transaction_id, e.seller, e.buyer, e.currency, e.net_amount::text, e.tax_amount::text, e.total_amount::text,
  e.note, e.status, e.replaced_by_id, e.last_error, e.attempt_count, e.due_date::text, e.issued_at, e.pdf_content IS NOT NULL AS has_pdf, e.xml_content IS NOT NULL AS has_xml,
  (e.status <> 'issued' AND e.due_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS overdue, e.version`;

@Injectable()
export class EinvoicesService implements OnModuleInit {
  private readonly logger = new Logger("Einvoices");
  private readonly providers: Partial<Record<EinvoiceProvider, EinvoiceProviderAdapter>>;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly documents: StockDocumentsService,
  ) {
    this.providers = { simulator: new SimulatorProvider(database) };
  }

  onModuleInit(): void {
    this.documents.postedHooks.push((transaction, documentId) => this.recordDelivery(transaction, documentId));
  }

  // Phiếu xuất giao hàng ghi sổ: lập hóa đơn "Chờ gửi" trong cùng giao dịch ghi sổ (QUYTAC_NGHIEPVU_104).
  async recordDelivery(transaction: Executor, documentId: string): Promise<void> {
    const document = (
      await transaction.execute<{ id: string; type: string; company_id: string; document_date: string; partner_id: string | null; buyer_name: string | null; currency: string }>(sql`
      SELECT d.id, d.type, d.company_id, d.document_date::text, d.partner_id, o.buyer_name, o.currency
      FROM inventory.documents d JOIN sales.orders o ON o.id = d.source_id AND d.source_type = 'sales.order' WHERE d.id = ${documentId}`)
    ).rows[0];
    if (!document) {
      await this.recordReturn(transaction, documentId);
      return;
    }
    if (document.type !== "sales_issue") return;
    const settings = await settingsRow(transaction, document.company_id);
    if (!settings?.enabled || !settings.start_date || document.document_date < settings.start_date) return;
    const company = (
      await transaction.execute<{ legal_name: string; tax_code: string | null; address: string | null }>(sql`
      SELECT legal_name, tax_code, address FROM core.companies WHERE id = ${document.company_id}`)
    ).rows[0]!;
    const partner = document.partner_id
      ? (
          await transaction.execute<{ name: string; tax_code: string | null; address: string | null }>(sql`
          SELECT name, tax_code, address FROM crm.partners WHERE id = ${document.partner_id}`)
        ).rows[0]
      : undefined;
    const buyer = partner
      ? { partnerId: document.partner_id, name: partner.name, taxCode: partner.tax_code, address: partner.address, anonymous: false }
      : { partnerId: null, name: document.buyer_name, taxCode: null, address: null, anonymous: true };
    const items = await documentItems(transaction, documentId, "sales_issue");
    await insertInvoice(transaction, {
      companyId: document.company_id,
      sourceDocumentId: documentId,
      kind: "original",
      relatedInvoiceId: null,
      invoiceDate: document.document_date,
      settings,
      seller: { name: company.legal_name, taxCode: company.tax_code, address: company.address },
      buyer,
      currency: document.currency,
      items,
      note: null,
    });
  }

  // Phiếu nhận hàng trả lại ghi sổ mà phiếu xuất gốc có hóa đơn: tạo việc chờ kế toán chọn cách xử lý (QUYTAC_NGHIEPVU_106).
  private async recordReturn(transaction: Executor, documentId: string): Promise<void> {
    await transaction.execute(sql`
      INSERT INTO finance.einvoice_return_tasks (company_id, return_document_id, original_invoice_id)
      SELECT r.company_id, r.id, e.id FROM inventory.documents r JOIN finance.einvoices e ON e.source_document_id = r.source_id AND e.kind = 'original'
      WHERE r.id = ${documentId} AND r.type = 'sales_return' AND r.source_type = 'inventory.document'
      ON CONFLICT (return_document_id) DO NOTHING`);
  }

  private async invoiceRow(executor: Executor, condition: SQL): Promise<InvoiceRow | undefined> {
    return (
      await executor.execute<InvoiceRow>(sql`
      SELECT ${invoiceColumns} FROM finance.einvoices e JOIN inventory.documents d ON d.id = e.source_document_id WHERE ${condition}`)
    ).rows[0];
  }

  private async lineRows(executor: Executor, invoiceId: string): Promise<LineRow[]> {
    return (
      await executor.execute<LineRow>(sql`
      SELECT line_no, item_code, item_name, unit_name, quantity::text, unit_price::text, vat_rate, net_amount::text, tax_amount::text, total_amount::text, is_promotion
      FROM finance.einvoice_lines WHERE invoice_id = ${invoiceId} ORDER BY line_no`)
    ).rows;
  }

  private async providerInvoice(row: InvoiceRow): Promise<ProviderInvoice> {
    const lines = await this.lineRows(this.database, row.id);
    const original = row.related_invoice_id ? await this.invoiceRow(this.database, sql`e.id = ${row.related_invoice_id}`) : undefined;
    return {
      referenceId: row.reference_id,
      kind: row.kind,
      invoiceDate: row.invoice_date,
      templateCode: row.template_code,
      series: row.series!,
      currency: row.currency,
      seller: row.seller,
      buyer: { name: row.buyer.name, taxCode: row.buyer.taxCode, address: row.buyer.address, anonymous: row.buyer.anonymous },
      lines: lines.map((line) => ({
        lineNo: line.line_no,
        itemCode: line.item_code,
        itemName: line.item_name,
        unitName: line.unit_name,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unit_price),
        vatRate: line.vat_rate,
        netAmount: Number(line.net_amount),
        taxAmount: Number(line.tax_amount),
        totalAmount: Number(line.total_amount),
        isPromotion: line.is_promotion,
      })),
      netAmount: Number(row.net_amount),
      taxAmount: Number(row.tax_amount),
      totalAmount: Number(row.total_amount),
      amountInWords: amountInWords(Number(row.total_amount), row.currency),
      original: original?.invoice_no ? { templateCode: original.template_code, series: original.series!, invoiceNo: original.invoice_no, invoiceDate: original.invoice_date } : null,
      note: row.note,
    };
  }

  // Tác vụ nền: gửi hóa đơn đến giờ gửi (QUYTAC_NGHIEPVU_105). Trả số hóa đơn đã xử lý.
  async sendDue(limit = 20): Promise<number> {
    const due = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM finance.einvoices WHERE status IN ('pending', 'retrying', 'awaiting_code') AND next_attempt_at <= now() ORDER BY next_attempt_at LIMIT ${limit}`);
    for (const item of due.rows) await this.process(item.id);
    return due.rows.length;
  }

  private async withTimeout(call: Promise<ProviderResult>): Promise<ProviderResult> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<ProviderResult>((resolve) => {
      timer = setTimeout(() => resolve({ outcome: "unknown", errorCode: "Timeout", message: "einvoiceProviderTimeout" }), providerTimeoutMilliseconds);
    });
    try {
      return await Promise.race([call, timeout]);
    } catch (error) {
      return { outcome: "temporary_error", errorCode: "ProviderError", message: (error as Error).message };
    } finally {
      clearTimeout(timer);
    }
  }

  // Một hóa đơn: ghi lần gửi trước khi gọi, gọi nhà cung cấp ngoài giao dịch, ghi kết quả.
  async process(invoiceId: string): Promise<void> {
    const claimed = await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ status: EinvoiceStatus; last_outcome: string | null }>(sql`
        SELECT e.status, (SELECT a.outcome FROM finance.einvoice_attempts a WHERE a.invoice_id = e.id ORDER BY a.started_at DESC LIMIT 1) AS last_outcome
        FROM finance.einvoices e WHERE e.id = ${invoiceId} AND e.status IN ('pending', 'retrying', 'awaiting_code') AND e.next_attempt_at <= now() FOR UPDATE SKIP LOCKED`)
      ).rows[0];
      if (!row) return null;
      // Chờ cấp mã hoặc lần trước không rõ kết quả: tra trạng thái theo mã tham chiếu trước, không gửi lại ngay.
      const operation: "publish" | "status" = row.status === "awaiting_code" || row.last_outcome === "unknown" ? "status" : "publish";
      const attempt = await transaction.execute<{ id: string }>(sql`INSERT INTO finance.einvoice_attempts (invoice_id, operation) VALUES (${invoiceId}, ${operation}) RETURNING id`);
      // Giữ chỗ: tiến trình khác không lấy lại hóa đơn trong lúc đang gọi.
      await transaction.execute(sql`UPDATE finance.einvoices SET attempt_count = attempt_count + 1, next_attempt_at = now() + interval '10 minutes' WHERE id = ${invoiceId}`);
      return { operation, attemptId: attempt.rows[0]!.id };
    });
    if (!claimed) return;
    const row = (await this.invoiceRow(this.database, sql`e.id = ${invoiceId}`))!;
    const settings = await settingsRow(this.database, row.company_id);
    const adapter = this.providers[row.provider];
    let result: ProviderResult;
    let invoice: ProviderInvoice | null = null;
    if (!settings || !adapter || settings.provider !== row.provider) {
      result = { outcome: "data_error", errorCode: "ProviderNotAvailable", message: "einvoiceProviderNotAvailable" };
    } else {
      const config = providerConfig(row.company_id, settings);
      invoice = await this.providerInvoice(row);
      result = await this.withTimeout(claimed.operation === "status" ? adapter.status(config, invoice) : adapter.publish(config, invoice));
      // Tra không thấy: nhà cung cấp chưa nhận, gửi ngay.
      if (result.outcome === "not_found") result = await this.withTimeout(adapter.publish(config, invoice));
    }
    let files: { pdf: Buffer | null; xml: Buffer | null } = { pdf: null, xml: null };
    if (result.outcome === "issued" && adapter && settings && invoice) {
      try {
        files = await adapter.download(providerConfig(row.company_id, settings), invoice, {
          invoiceNo: result.invoiceNo!,
          taxAuthorityCode: result.taxAuthorityCode ?? null,
          transactionId: result.transactionId ?? null,
        });
      } catch (error) {
        this.logger.warn(`Không tải được tệp hóa đơn ${invoiceId}: ${(error as Error).message}`);
      }
    }
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        UPDATE finance.einvoice_attempts SET finished_at = now(), outcome = ${result.outcome}, error_code = ${result.errorCode ?? null}, message = ${result.message ?? null}
        WHERE id = ${claimed.attemptId}`);
      const attempts = row.attempt_count + 1;
      const status: EinvoiceStatus =
        result.outcome === "issued"
          ? "issued"
          : result.outcome === "awaiting_code"
            ? "awaiting_code"
            : result.outcome === "rejected"
              ? "rejected"
              : result.outcome === "data_error"
                ? "failed"
                : "retrying";
      await transaction.execute(sql`
        UPDATE finance.einvoices SET status = ${status},
          invoice_no = coalesce(${result.invoiceNo ?? null}, invoice_no),
          tax_authority_code = coalesce(${result.taxAuthorityCode ?? null}, tax_authority_code),
          provider_transaction_id = coalesce(${result.transactionId ?? null}, provider_transaction_id),
          last_error = ${status === "issued" || status === "awaiting_code" ? null : (result.message ?? result.errorCode ?? null)},
          next_attempt_at = now() + make_interval(mins => ${retryDelayMinutes(attempts)}),
          issued_at = CASE WHEN ${status} = 'issued' THEN now() ELSE issued_at END,
          pdf_content = coalesce(${files.pdf}, pdf_content), xml_content = coalesce(${files.xml}, xml_content), version = version + 1
        WHERE id = ${invoiceId}`);
    });
  }

  // Tác vụ nền: báo hóa đơn quá hạn (chưa phát hành sau ngày làm việc tiếp theo ngày hóa đơn) cho người quản lý hóa đơn của công ty.
  async notifyOverdue(): Promise<number> {
    const today = vietnamDate(new Date());
    const overdue = await this.database.execute<{ company_id: string; count: number }>(sql`
      UPDATE finance.einvoices SET overdue_notified_at = now() WHERE status <> 'issued' AND due_date < ${today}::date AND overdue_notified_at IS NULL
      RETURNING company_id, 1 AS count`);
    const byCompany = new Map<string, number>();
    for (const row of overdue.rows) byCompany.set(row.company_id, (byCompany.get(row.company_id) ?? 0) + 1);
    let sent = 0;
    for (const [companyId, count] of byCompany) {
      const recipients = await this.database.execute<{ user_id: string }>(sql`
        SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.role_permissions rp ON rp.role_id = a.role_id JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
        WHERE rp.permission_code = ${einvoicePermissions.manage} AND a.valid_from <= current_date AND (a.valid_to IS NULL OR a.valid_to >= current_date)
          AND (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${companyId}))`);
      await notify(
        this.database,
        recipients.rows.map((recipient) => ({
          userId: recipient.user_id,
          companyId,
          kind: "einvoice_overdue",
          title: String(count),
          link: "/finance/einvoices?overdue=true",
          payload: { count },
        })),
      );
      sent += recipients.rows.length;
    }
    return sent;
  }

  async list(actor: Actor, query: z.output<typeof einvoiceListQuerySchema>): Promise<PageResponse<EinvoiceListItem>> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.view);
    const conditions: SQL[] = [sql`e.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`e.status = ${query.status}`);
    if (query.overdue === "true") conditions.push(sql`e.status <> 'issued' AND e.due_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`);
    if (query.from) conditions.push(sql`e.invoice_date >= ${query.from}::date`);
    if (query.to) conditions.push(sql`e.invoice_date <= ${query.to}::date`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(e.buyer->>'name' ILIKE ${pattern} OR e.buyer->>'taxCode' ILIKE ${pattern} OR e.invoice_no ILIKE ${pattern} OR d.document_no ILIKE ${pattern})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = Number(
      (await this.database.execute<{ total: string }>(sql`SELECT count(*)::text AS total FROM finance.einvoices e JOIN inventory.documents d ON d.id = e.source_document_id WHERE ${where}`)).rows[0]!
        .total,
    );
    const rows = await this.database.execute<InvoiceRow>(sql`
      SELECT ${invoiceColumns} FROM finance.einvoices e JOIN inventory.documents d ON d.id = e.source_document_id WHERE ${where}
      ORDER BY e.invoice_date DESC, e.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.listItem(row)), page: query.page, pageSize: query.pageSize, total };
  }

  private listItem(row: InvoiceRow): EinvoiceListItem {
    return {
      id: row.id,
      kind: row.kind,
      invoiceDate: day(row.invoice_date),
      series: row.series,
      invoiceNo: row.invoice_no,
      buyerName: row.buyer.name ?? "",
      totalAmount: trimDecimal(row.total_amount),
      currency: row.currency,
      status: row.status,
      overdue: row.overdue,
      replaced: Boolean(row.replaced_by_id),
      sourceDocumentNo: row.source_document_no,
    };
  }

  async detail(actor: Actor, id: string): Promise<EinvoiceResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, einvoicePermissions.view);
    const row = await this.invoiceRow(this.database, sql`e.id = ${id} AND e.company_id = ${actor.companyId}`);
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const lines = await this.lineRows(this.database, id);
    const related = await this.database.execute<{
      id: string;
      kind: EinvoiceKind;
      series: string | null;
      invoice_no: string | null;
      invoice_date: string;
      relation: "original" | "replaced_by" | "adjusted_by";
    }>(sql`
      SELECT id, kind, series, invoice_no, invoice_date::text, 'original' AS relation FROM finance.einvoices WHERE id = ${row.related_invoice_id}
      UNION ALL SELECT id, kind, series, invoice_no, invoice_date::text, CASE WHEN kind = 'adjustment' THEN 'adjusted_by' ELSE 'replaced_by' END
      FROM finance.einvoices WHERE related_invoice_id = ${id} ORDER BY invoice_date`);
    const attempts = await this.database.execute<{
      operation: "publish" | "status";
      started_at: Date;
      finished_at: Date | null;
      outcome: string | null;
      error_code: string | null;
      message: string | null;
    }>(sql`
      SELECT operation, started_at, finished_at, outcome, error_code, message FROM finance.einvoice_attempts WHERE invoice_id = ${id} ORDER BY started_at DESC LIMIT 50`);
    const summary = new Map<string, { net: number; tax: number }>();
    for (const line of lines) {
      const target = summary.get(line.vat_rate) ?? { net: 0, tax: 0 };
      target.net += Number(line.net_amount);
      target.tax += Number(line.tax_amount);
      summary.set(line.vat_rate, target);
    }
    const text = (value: number) => trimDecimal((Math.round(value * 10000) / 10000).toFixed(4));
    return {
      ...this.listItem(row),
      provider: row.provider,
      templateCode: row.template_code,
      withTaxCode: row.with_tax_code,
      taxAuthorityCode: row.tax_authority_code,
      referenceId: row.reference_id,
      seller: row.seller,
      buyer: row.buyer,
      netAmount: trimDecimal(row.net_amount),
      taxAmount: trimDecimal(row.tax_amount),
      note: row.note,
      lastError: row.last_error,
      dueDate: day(row.due_date),
      issuedAt: row.issued_at ? new Date(row.issued_at).toISOString() : null,
      sourceDocumentId: row.source_document_id,
      related: related.rows.map((item) => ({ id: item.id, kind: item.kind, series: item.series, invoiceNo: item.invoice_no, invoiceDate: day(item.invoice_date), relation: item.relation })),
      lines: lines.map((line) => ({
        lineNo: line.line_no,
        itemCode: line.item_code,
        itemName: line.item_name,
        unitName: line.unit_name,
        quantity: trimDecimal(line.quantity),
        unitPrice: trimDecimal(line.unit_price),
        vatRate: line.vat_rate,
        netAmount: trimDecimal(line.net_amount),
        taxAmount: trimDecimal(line.tax_amount),
        totalAmount: trimDecimal(line.total_amount),
        isPromotion: line.is_promotion,
      })),
      taxSummary: [...summary.entries()].map(([vatRate, value]) => ({ vatRate, netAmount: text(value.net), taxAmount: text(value.tax) })),
      attempts: attempts.rows.map((attempt) => ({
        operation: attempt.operation,
        startedAt: new Date(attempt.started_at).toISOString(),
        finishedAt: attempt.finished_at ? new Date(attempt.finished_at).toISOString() : null,
        outcome: attempt.outcome,
        errorCode: attempt.error_code,
        message: attempt.message,
      })),
      hasPdf: row.has_pdf,
      hasXml: row.has_xml,
      canManage: granted.has(einvoicePermissions.manage),
      version: row.version,
    };
  }

  // Gửi lại ngay: hóa đơn lỗi, lỗi cài đặt hoặc đang chờ gửi lại. Chưa phát hành nên lấy lại nhà cung cấp, ký hiệu, thông tin người bán theo cài đặt, công ty hiện tại.
  async resend(actor: Actor, id: string, version: number): Promise<EinvoiceResponse> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.manage);
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ status: EinvoiceStatus; version: number; invoice_date: string; invoice_no: string | null }>(sql`
        SELECT status, version, invoice_date::text, invoice_no FROM finance.einvoices WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!["failed", "setup_error", "retrying"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "einvoiceNotResendable");
      const settings = await settingsRow(transaction, actor.companyId);
      if (!settings) throw new ApiError("BUSINESS_RULE", "einvoiceNotConfigured");
      const series = await seriesFor(transaction, actor.companyId, Number(row.invoice_date.slice(0, 4)));
      if (!series) throw new ApiError("BUSINESS_RULE", "einvoiceSeriesMissing");
      const company = (
        await transaction.execute<{ legal_name: string; tax_code: string | null; address: string | null }>(sql`SELECT legal_name, tax_code, address FROM core.companies WHERE id = ${actor.companyId}`)
      ).rows[0]!;
      // Đã có số từ nhà cung cấp thì giữ nhà cung cấp, ký hiệu.
      await transaction.execute(sql`
        UPDATE finance.einvoices SET status = 'pending', next_attempt_at = now(), last_error = NULL, version = version + 1,
          provider = CASE WHEN invoice_no IS NULL THEN ${settings.provider} ELSE provider END,
          series = CASE WHEN invoice_no IS NULL THEN ${series} ELSE series END,
          with_tax_code = CASE WHEN invoice_no IS NULL THEN ${settings.with_tax_code} ELSE with_tax_code END,
          template_code = CASE WHEN invoice_no IS NULL THEN ${settings.template_code} ELSE template_code END,
          seller = CASE WHEN invoice_no IS NULL THEN ${JSON.stringify({ name: company.legal_name, taxCode: company.tax_code, address: company.address })}::jsonb ELSE seller END
        WHERE id = ${id}`);
      await this.auditService.record({ ...financeAudit(actor, "einvoice"), action: "einvoice.resend", entityId: id, beforeData: { status: row.status } }, transaction);
    });
    await this.process(id);
    return this.detail(actor, id);
  }

  async file(actor: Actor, id: string, format: "pdf" | "xml"): Promise<{ content: Buffer; fileName: string }> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.view);
    const row = (
      await this.database.execute<{ series: string | null; invoice_no: string | null; content: Buffer | null }>(sql`
      SELECT series, invoice_no, ${format === "pdf" ? sql`pdf_content` : sql`xml_content`} AS content FROM finance.einvoices WHERE id = ${id} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (!row.content) throw new ApiError("BUSINESS_RULE", "einvoiceFileUnavailable");
    return { content: Buffer.from(row.content), fileName: `${row.series ?? "HD"}-${row.invoice_no ?? id.slice(0, 8)}.${format}` };
  }
}
