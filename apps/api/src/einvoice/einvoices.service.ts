// Hóa đơn điện tử (CONG_VIEC_16; CHUC_NANG_77; QUYTAC_NGHIEPVU_104, 105; API_91): lập khi phiếu xuất giao hàng ghi sổ,
// gửi nền qua nhà cung cấp của công ty (ngoài giao dịch cơ sở dữ liệu), gửi lại khi lỗi tạm thời, tra trạng thái, báo quá hạn.
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type { EinvoiceKind, EinvoiceListItem, EinvoiceOrigin, EinvoiceProvider, EinvoiceResponse, EinvoiceStatus, PageResponse, einvoiceListQuerySchema } from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { marketplaceShippingFee, shippingVatRate } from "../accounting/postings";
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
import { cashRegisterSupported, einvoicePermissions, nextCashRegisterNumber, providerConfig, seriesFor, settingsRow } from "./einvoice-settings.service";
import type { EinvoiceProviderAdapter, ProviderInvoice, ProviderResult } from "./providers/provider";
import { MisaProvider } from "./providers/misa";
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

// Mã tra cứu 12 ký tự in trên hóa đơn bán lẻ (bỏ các ký tự dễ nhầm 0, O, 1, I).
const lookupAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function lookupCode(): string {
  return [...randomBytes(12)].map((value) => lookupAlphabet[value % lookupAlphabet.length]).join("");
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
    buyer: { partnerId: string | null; name: string | null; taxCode: string | null; address: string | null; identityNo?: string | null; anonymous: boolean };
    currency: string;
    items: InvoiceItem[];
    note: string | null;
    // Khởi tạo từ máy tính tiền: ký hiệu, số cấp tại quầy, mã tra cứu; hạn gửi cuối ngày hóa đơn (CONG_VIEC_53; QUYTAC_NGHIEPVU_378).
    cashRegister?: { series: string; invoiceNo: string; lookupCode: string };
  },
): Promise<string> {
  const total = (key: "netAmount" | "taxAmount" | "totalAmount") => Math.round(input.items.reduce((sum, item) => sum + item[key], 0) * 10000) / 10000;
  const cashRegister = input.cashRegister;
  const series = cashRegister ? cashRegister.series : await seriesFor(transaction, input.companyId, Number(input.invoiceDate.slice(0, 4)));
  const setupError = series ? null : "einvoiceSeriesMissing";
  const inserted = await transaction.execute<{ id: string }>(sql`
    INSERT INTO finance.einvoices (company_id, source_document_id, kind, related_invoice_id, provider, invoice_date, template_code, series, invoice_no, with_tax_code, seller, buyer,
      currency, net_amount, tax_amount, total_amount, note, status, last_error, due_date, origin, lookup_code)
    VALUES (${input.companyId}, ${input.sourceDocumentId}, ${input.kind}, ${input.relatedInvoiceId}, ${input.settings.provider}, ${input.invoiceDate}::date, ${input.settings.template_code},
      ${series}, ${cashRegister?.invoiceNo ?? null}, ${input.settings.with_tax_code}, ${JSON.stringify(input.seller)}::jsonb, ${JSON.stringify(input.buyer)}::jsonb, ${input.currency},
      ${total("netAmount")}, ${total("taxAmount")}, ${total("totalAmount")}, ${input.note}, ${setupError ? "setup_error" : "pending"}, ${setupError},
      ${cashRegister ? input.invoiceDate : nextWorkingDay(input.invoiceDate)}::date, ${cashRegister ? "cash_register" : "standard"}, ${cashRegister?.lookupCode ?? null})
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
  origin: EinvoiceOrigin;
  lookup_code: string | null;
  provider_transaction_id: string | null;
  seller: { name: string | null; taxCode: string | null; address: string | null };
  buyer: { partnerId: string | null; name: string | null; taxCode: string | null; address: string | null; identityNo?: string | null; anonymous: boolean };
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
  e.series, e.invoice_no, e.with_tax_code, e.tax_authority_code, e.origin, e.lookup_code, e.provider_transaction_id, e.seller, e.buyer, e.currency, e.net_amount::text, e.tax_amount::text, e.total_amount::text,
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
    this.providers = { simulator: new SimulatorProvider(database), misa: new MisaProvider() };
  }

  onModuleInit(): void {
    this.documents.postedHooks.push((transaction, documentId) => this.recordDelivery(transaction, documentId));
  }

  // Phiếu xuất giao hàng ghi sổ: lập hóa đơn "Chờ gửi" trong cùng giao dịch ghi sổ (QUYTAC_NGHIEPVU_104).
  async recordDelivery(transaction: Executor, documentId: string): Promise<void> {
    const document = (
      await transaction.execute<{
        id: string;
        type: string;
        company_id: string;
        document_date: string;
        partner_id: string | null;
        buyer_name: string | null;
        buyer_tax_code: string | null;
        buyer_address: string | null;
        buyer_identity_no: string | null;
        is_retail: boolean;
        currency: string;
      }>(sql`
      SELECT d.id, d.type, d.company_id, d.document_date::text, d.partner_id, o.buyer_name, o.buyer_tax_code, o.buyer_address, o.buyer_identity_no, o.is_retail, o.currency
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
    // Bán lẻ: thông tin người mua chỉ khi khách yêu cầu (Nghị định 254/2026/NĐ-CP Điều 10 khoản 4 điểm b).
    const retailBuyer = document.buyer_name || document.buyer_tax_code || document.buyer_identity_no;
    const buyer = partner
      ? { partnerId: document.partner_id, name: partner.name, taxCode: partner.tax_code, address: partner.address, anonymous: false }
      : document.is_retail
        ? {
            partnerId: null,
            name: document.buyer_name,
            taxCode: document.buyer_tax_code,
            address: document.buyer_address,
            identityNo: document.buyer_identity_no,
            anonymous: !retailBuyer,
          }
        : { partnerId: null, name: document.buyer_name, taxCode: null, address: null, anonymous: true };
    let cashRegister: { series: string; invoiceNo: string; lookupCode: string } | undefined;
    if (document.is_retail && cashRegisterSupported(settings.provider)) {
      // Hóa đơn khởi tạo từ máy tính tiền: năm chưa khai ký hiệu thì chặn bán (QUYTAC_NGHIEPVU_378).
      const numbered = await nextCashRegisterNumber(transaction, document.company_id, Number(document.document_date.slice(0, 4)));
      if (!numbered) throw new ApiError("BUSINESS_RULE", "retailEinvoiceSeriesMissing");
      cashRegister = { ...numbered, lookupCode: lookupCode() };
    }
    const items = await documentItems(transaction, documentId, "sales_issue");
    // Phí giao hàng của đơn VComm: dòng dịch vụ thuế 10%, phí đã gồm thuế (CONG_VIEC_25; QUYTAC_NGHIEPVU_169).
    const shippingFee = await marketplaceShippingFee(transaction, documentId);
    if (shippingFee > 0) {
      const net = Math.round(shippingFee / (1 + shippingVatRate / 100));
      items.push({
        lineNo: items.length + 1,
        itemCode: null,
        itemName: "Phí giao hàng",
        unitName: "Lần",
        quantity: 1,
        unitPrice: net,
        vatRate: "10",
        netAmount: net,
        taxAmount: shippingFee - net,
        totalAmount: shippingFee,
        isPromotion: false,
      });
    }
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
      cashRegister,
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
      invoiceNo: row.origin === "cash_register" ? row.invoice_no : null,
      cashRegister: row.origin === "cash_register",
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
    for (const item of due.rows) {
      try {
        await this.process(item.id);
      } catch (error) {
        this.logger.error(`Gửi hóa đơn ${item.id}: ${(error as Error).message}`);
      }
    }
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
        await transaction.execute<{ status: EinvoiceStatus; attempted: boolean }>(sql`
        SELECT e.status, EXISTS (SELECT 1 FROM finance.einvoice_attempts a WHERE a.invoice_id = e.id) AS attempted
        FROM finance.einvoices e WHERE e.id = ${invoiceId} AND e.status IN ('pending', 'retrying', 'awaiting_code') AND e.next_attempt_at <= now() FOR UPDATE SKIP LOCKED`)
      ).rows[0];
      if (!row) return null;
      // Đã gửi lần nào (kể cả lần lỗi, lần bị gián đoạn) thì tra trạng thái theo mã tham chiếu trước; không thấy mới gửi lại, tránh lập trùng.
      const operation: "publish" | "status" = row.attempted ? "status" : "publish";
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
        let timer: NodeJS.Timeout | undefined;
        files = await Promise.race([
          adapter.download(providerConfig(row.company_id, settings), invoice, {
            invoiceNo: result.invoiceNo!,
            taxAuthorityCode: result.taxAuthorityCode ?? null,
            transactionId: result.transactionId ?? null,
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("einvoiceProviderTimeout")), providerTimeoutMilliseconds);
          }),
        ]).finally(() => clearTimeout(timer));
      } catch (error) {
        this.logger.warn(`Không tải được tệp hóa đơn ${invoiceId}: ${(error as Error).message}`);
      }
    }
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        UPDATE finance.einvoice_attempts SET finished_at = now(), outcome = ${result.outcome}, error_code = ${result.errorCode ?? null}, message = ${result.message ?? null}
        WHERE id = ${claimed.attemptId}`);
      // attempt_count đã tăng khi giữ chỗ.
      const attempts = row.attempt_count;
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
        WHERE id = ${invoiceId} AND status <> 'issued'
          AND (SELECT a.id FROM finance.einvoice_attempts a WHERE a.invoice_id = ${invoiceId} ORDER BY a.started_at DESC, a.id DESC LIMIT 1) = ${claimed.attemptId}`);
      // Chỉ kết quả của lần gửi mới nhất được ghi; hóa đơn đã phát hành không lùi trạng thái.
      // Hóa đơn thay thế phát hành xong mới đánh dấu hóa đơn bị thay thế.
      if (status === "issued" && row.kind === "replacement" && row.related_invoice_id)
        await transaction.execute(sql`
          UPDATE finance.einvoices SET replaced_by_id = ${invoiceId}, version = version + 1 WHERE id = ${row.related_invoice_id} AND replaced_by_id IS NULL
            AND EXISTS (SELECT 1 FROM finance.einvoices r WHERE r.id = ${invoiceId} AND r.status = 'issued')`);
    });
  }

  // Tác vụ nền: báo hóa đơn quá hạn (chưa phát hành sau ngày làm việc tiếp theo ngày hóa đơn) cho người quản lý hóa đơn của công ty.
  async notifyOverdue(): Promise<number> {
    const today = vietnamDate(new Date());
    return this.database.transaction(async (transaction) => {
      const overdue = await transaction.execute<{ company_id: string; count: number }>(sql`
      UPDATE finance.einvoices SET overdue_notified_at = now() WHERE status <> 'issued' AND due_date < ${today}::date AND overdue_notified_at IS NULL
      RETURNING company_id, 1 AS count`);
      const byCompany = new Map<string, number>();
      for (const row of overdue.rows) byCompany.set(row.company_id, (byCompany.get(row.company_id) ?? 0) + 1);
      let sent = 0;
      for (const [companyId, count] of byCompany) {
        const recipients = await transaction.execute<{ user_id: string }>(sql`
        SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.role_permissions rp ON rp.role_id = a.role_id JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
        WHERE rp.permission_code = ${einvoicePermissions.manage} AND a.valid_from <= ${today}::date AND (a.valid_to IS NULL OR a.valid_to >= ${today}::date)
          AND (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${companyId}))`);
        await notify(
          transaction,
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
    });
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
      origin: row.origin,
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
      status: EinvoiceStatus;
      relation: "original" | "replaced_by" | "adjusted_by";
    }>(sql`
      SELECT id, kind, series, invoice_no, invoice_date::text, status, 'original' AS relation FROM finance.einvoices WHERE id = ${row.related_invoice_id}
      UNION ALL SELECT id, kind, series, invoice_no, invoice_date::text, status, CASE WHEN kind = 'adjustment' THEN 'adjusted_by' ELSE 'replaced_by' END
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
      lookupCode: row.lookup_code,
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
      related: related.rows.map((item) => ({
        id: item.id,
        kind: item.kind,
        series: item.series,
        invoiceNo: item.invoice_no,
        invoiceDate: day(item.invoice_date),
        status: item.status,
        relation: item.relation,
      })),
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

  // Gửi lại ngay: hóa đơn lỗi, lỗi cài đặt, đang chờ gửi lại hoặc bị cơ quan thuế từ chối.
  async resend(actor: Actor, id: string, version: number): Promise<EinvoiceResponse> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.manage);
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{
          status: EinvoiceStatus;
          version: number;
          invoice_date: string;
          invoice_no: string | null;
          origin: EinvoiceOrigin;
          last_outcome: string | null;
          in_flight: boolean;
        }>(sql`
        SELECT e.status, e.version, e.invoice_date::text, e.invoice_no, e.origin,
          (SELECT a.outcome FROM finance.einvoice_attempts a WHERE a.invoice_id = e.id ORDER BY a.started_at DESC, a.id DESC LIMIT 1) AS last_outcome,
          EXISTS (SELECT 1 FROM finance.einvoice_attempts a WHERE a.invoice_id = e.id AND a.finished_at IS NULL AND a.started_at > now() - interval '10 minutes') AS in_flight
        FROM finance.einvoices e WHERE e.id = ${id} AND e.company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!["failed", "setup_error", "retrying", "rejected"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "einvoiceNotResendable");
      // Đang gọi nhà cung cấp: không gửi chồng.
      if (row.in_flight) throw new ApiError("BUSINESS_RULE", "einvoiceSending");
      const settings = await settingsRow(transaction, actor.companyId);
      if (!settings) throw new ApiError("BUSINESS_RULE", "einvoiceNotConfigured");
      // Khởi tạo từ máy tính tiền: ký hiệu, số đã in cho khách giữ nguyên; bị từ chối thì gửi lại với mã tham chiếu mới.
      if (row.origin === "cash_register") {
        await transaction.execute(sql`
          UPDATE finance.einvoices SET status = 'pending', next_attempt_at = now(), last_error = NULL, version = version + 1, provider = ${settings.provider},
            reference_id = CASE WHEN ${row.status === "rejected"} THEN gen_random_uuid() ELSE reference_id END, tax_authority_code = NULL
          WHERE id = ${id}`);
        await this.auditService.record({ ...financeAudit(actor, "einvoice"), action: "einvoice.resend", entityId: id, beforeData: { status: row.status } }, transaction);
        return;
      }
      const series = await seriesFor(transaction, actor.companyId, Number(row.invoice_date.slice(0, 4)));
      if (!series) throw new ApiError("BUSINESS_RULE", "einvoiceSeriesMissing");
      const company = (
        await transaction.execute<{ legal_name: string; tax_code: string | null; address: string | null }>(sql`SELECT legal_name, tax_code, address FROM core.companies WHERE id = ${actor.companyId}`)
      ).rows[0]!;
      // Nhà cung cấp có thể đang giữ hóa đơn (đã có số, lần trước lỗi tạm thời hoặc không rõ kết quả): giữ nguyên nội dung, chỉ gửi lại.
      // Bị cơ quan thuế từ chối: lập lại với mã tham chiếu mới. Còn lại (chưa gửi được, lỗi dữ liệu): lấy cài đặt, thông tin công ty hiện tại.
      const rejected = row.status === "rejected";
      const keep = !rejected && (row.invoice_no !== null || row.last_outcome === "unknown" || row.last_outcome === "temporary_error");
      if (keep) {
        await transaction.execute(sql`UPDATE finance.einvoices SET status = 'pending', next_attempt_at = now(), last_error = NULL, version = version + 1 WHERE id = ${id}`);
      } else {
        await transaction.execute(sql`
          UPDATE finance.einvoices SET status = 'pending', next_attempt_at = now(), last_error = NULL, version = version + 1,
            reference_id = CASE WHEN ${rejected} THEN gen_random_uuid() ELSE reference_id END,
            invoice_no = NULL, tax_authority_code = NULL, provider_transaction_id = NULL,
            provider = ${settings.provider}, series = ${series}, with_tax_code = ${settings.with_tax_code}, template_code = ${settings.template_code},
            seller = ${JSON.stringify({ name: company.legal_name, taxCode: company.tax_code, address: company.address })}::jsonb
          WHERE id = ${id}`);
      }
      await this.auditService.record({ ...financeAudit(actor, "einvoice"), action: "einvoice.resend", entityId: id, beforeData: { status: row.status } }, transaction);
    });
    await this.process(id);
    return this.detail(actor, id);
  }

  // Kiểm tra kết nối theo cài đặt đã lưu (CHUC_NANG_76).
  async testConnection(actor: Actor): Promise<{ ok: boolean; message: string | null }> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.setup);
    const settings = await settingsRow(this.database, actor.companyId);
    if (!settings) throw new ApiError("BUSINESS_RULE", "einvoiceNotConfigured");
    const adapter = this.providers[settings.provider];
    if (!adapter) throw new ApiError("BUSINESS_RULE", "einvoiceProviderNotAvailable");
    const result = await adapter.testConnection(providerConfig(actor.companyId, settings));
    await this.auditService.record({ ...financeAudit(actor, "einvoice_settings"), action: "einvoice_settings.test", entityId: actor.companyId, afterData: result });
    return result;
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
