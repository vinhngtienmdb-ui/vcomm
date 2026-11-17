// Hóa đơn điện tử lập thay cửa hàng liên kết theo ủy nhiệm (CONG_VIEC_73 lát L6; QUYTAC_NGHIEPVU_588, 589; API_334; MAN_HINH_279)
// và hóa đơn phí sàn tháng của công ty vận hành sàn (QUYTAC_NGHIEPVU_587).
// Hóa đơn lập bằng tài khoản nhà cung cấp của công ty vận hành sàn (finance.einvoices.company_id), người bán theo dữ liệu ủy nhiệm, ký hiệu riêng của cửa hàng.
// Thiếu dữ liệu, ủy nhiệm hết hiệu lực, chưa có ký hiệu hoặc chưa bật hóa đơn điện tử: vẫn bán, ghi việc chờ lập; người có affiliate.manage lập bù.
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { EinvoiceBacklogReason, EinvoiceMandateResponse, InstoreCheckoutLine, TransactionEinvoice, einvoiceMandateSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { signPayload, verifyPayload } from "../auth/tokens";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { settingsRow } from "../einvoice/einvoice-settings.service";
import { EinvoicesService, type InvoiceItem, insertInvoice } from "../einvoice/einvoices.service";
import { mandateSeriesFor, mandateSupported, mandateUnsupportedError } from "../einvoice/mandates";
import { vietnamToday } from "../marketplace/shop.service";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";

type Executor = Pick<Database, "execute">;
type Writer = Executor & Pick<Database, "insert">;
type VatRate = InvoiceItem["vatRate"];

const maximumFileBytes = 10 * 1024 * 1024;
const linkLifetimeSeconds = 10 * 60;

type MandateRow = {
  seller_name: string;
  tax_code: string;
  address: string;
  tax_method: "deduction" | "direct";
  default_vat_rate: VatRate | null;
  mandate_no: string;
  effective_from: string;
  expires_on: string | null;
  file_name: string | null;
  file_size: number | null;
  version: number;
};

const vietnameseDate = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
const round4 = (value: number) => Math.round(value * 10000) / 10000;

// Tách tiền đã gồm thuế thành tiền chưa thuế và thuế theo thuế suất (thuế suất không phải số: không tách).
function split(gross: number, rate: VatRate): { net: number; tax: number } {
  const percent = Number(rate);
  if (!Number.isFinite(percent) || percent === 0) return { net: gross, tax: 0 };
  const net = Math.round(gross / (1 + percent / 100));
  return { net, tax: gross - net };
}

// Dòng hóa đơn (QUYTAC_NGHIEPVU_589): dòng của đơn (tên, đơn vị, số lượng, đơn giá, thuế suất nếu có); không có hoặc tổng không khớp tiền hóa đơn
// thì một dòng "Hàng hóa, dịch vụ theo giao dịch số LK…". Voucher cửa hàng phát hành: chiết khấu thương mại, chia theo thuế suất.
// Phương pháp trực tiếp (hóa đơn bán hàng): không tách thuế.
export function mandatedItems(input: {
  documentNo: string;
  billAmount: number;
  lines: (InstoreCheckoutLine & { vatRate?: string | null })[];
  taxMethod: "deduction" | "direct";
  defaultVatRate: VatRate | null;
  storeDiscount: number;
}): InvoiceItem[] {
  const rateOf = (value: string | null | undefined): VatRate =>
    input.taxMethod === "direct" ? "not_declared" : ((["0", "5", "8", "10", "exempt", "not_declared"].includes(value ?? "") ? value : input.defaultVatRate) as VatRate);
  const sold = input.lines.filter((line) => !line.gift);
  const usable = sold.length > 0 && Math.abs(sold.reduce((sum, line) => sum + Number(line.amount), 0) - input.billAmount) < 0.5;
  const goods = usable
    ? input.lines.map((line) => ({
        name: line.name,
        unit: line.unit,
        quantity: Number(line.quantity),
        gross: line.gift ? 0 : Number(line.amount),
        rate: rateOf(line.vatRate),
        gift: line.gift,
      }))
    : [{ name: `Hàng hóa, dịch vụ theo giao dịch số ${input.documentNo}`, unit: null, quantity: 1, gross: input.billAmount, rate: rateOf(null), gift: false }];
  const items: InvoiceItem[] = goods.map((line, index) => {
    const { net, tax } = split(line.gross, line.rate);
    return {
      lineNo: index + 1,
      itemCode: null,
      itemName: line.name,
      unitName: line.unit,
      quantity: line.quantity,
      unitPrice: line.quantity > 0 ? round4(net / line.quantity) : 0,
      vatRate: line.rate,
      netAmount: net,
      taxAmount: tax,
      totalAmount: line.gross,
      isPromotion: line.gift,
    };
  });
  if (input.storeDiscount > 0) {
    const byRate = new Map<VatRate, number>();
    for (const line of goods) if (!line.gift) byRate.set(line.rate, (byRate.get(line.rate) ?? 0) + line.gross);
    const total = [...byRate.values()].reduce((sum, value) => sum + value, 0);
    let left = input.storeDiscount;
    const rates = [...byRate.entries()];
    rates.forEach(([rate, gross], index) => {
      const share = index === rates.length - 1 ? left : Math.round((input.storeDiscount * gross) / total);
      left -= share;
      if (share <= 0) return;
      const { net, tax } = split(share, rate);
      items.push({
        lineNo: items.length + 1,
        itemCode: null,
        itemName: "Chiết khấu thương mại (voucher cửa hàng)",
        unitName: null,
        quantity: 1,
        unitPrice: -net,
        vatRate: rate,
        netAmount: -net,
        taxAmount: -tax,
        totalAmount: -share,
        isPromotion: false,
      });
    });
  }
  return items;
}

@Injectable()
export class InstoreEinvoicesService {
  private readonly logger = new Logger("InstoreEinvoices");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly einvoices: EinvoicesService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lập hóa đơn ủy nhiệm khi giao dịch thu hộ hoàn tất (gọi trong giao dịch hoàn tất) hoặc khi lập bù.
  // ---------------------------------------------------------------------------

  async issueForCheckout(transaction: Writer, checkoutId: string, invoiceDate: string): Promise<{ invoiceId: string } | { reason: EinvoiceBacklogReason }> {
    const checkout = (
      await transaction.execute<{
        operator_company_id: string;
        merchant_id: string;
        affiliate_transaction_id: string;
        document_no: string;
        bill_amount: string;
        lines: (InstoreCheckoutLine & { vatRate?: string | null })[];
        buyer_invoice_info: { name: string; taxCode: string | null; address: string | null } | null;
        voucher_amount: string;
        voucher_issuer: string | null;
      }>(sql`
      SELECT c.operator_company_id, c.merchant_id, c.affiliate_transaction_id, t.document_no, c.bill_amount::text, c.lines, c.buyer_invoice_info, c.voucher_amount::text,
        v.issuer AS voucher_issuer
      FROM instore.checkouts c JOIN affiliate.transactions t ON t.id = c.affiliate_transaction_id
      LEFT JOIN affiliate.voucher_codes vc ON vc.id = c.voucher_code_id LEFT JOIN affiliate.vouchers v ON v.id = vc.voucher_id
      WHERE c.id = ${checkoutId}`)
    ).rows[0];
    if (!checkout) throw new ApiError("NOT_FOUND", "notFound");
    const blocked = async (reason: EinvoiceBacklogReason) => {
      await transaction.execute(sql`
        INSERT INTO affiliate.einvoice_backlog (transaction_id, merchant_id, operator_company_id, reason)
        VALUES (${checkout.affiliate_transaction_id}, ${checkout.merchant_id}, ${checkout.operator_company_id}, ${reason})
        ON CONFLICT (transaction_id) DO UPDATE SET reason = EXCLUDED.reason`);
      return { reason };
    };
    const settings = await settingsRow(transaction, checkout.operator_company_id);
    if (!settings?.enabled || !settings.start_date || invoiceDate < settings.start_date) return blocked("einvoice_off");
    const mandate = await this.mandateRow(transaction, checkout.merchant_id);
    if (!mandate) return blocked("mandate_missing");
    if (mandate.effective_from > invoiceDate || (mandate.expires_on && mandate.expires_on < invoiceDate)) return blocked("mandate_inactive");
    const series = await mandateSeriesFor(transaction, checkout.merchant_id, Number(invoiceDate.slice(0, 4)));
    if (!series) return blocked("series_missing");
    const items = mandatedItems({
      documentNo: checkout.document_no,
      billAmount: Number(checkout.bill_amount),
      lines: checkout.lines,
      taxMethod: mandate.tax_method,
      defaultVatRate: mandate.default_vat_rate,
      // Voucher công ty phát hành, tiền điểm: phương thức thanh toán, không giảm trên hóa đơn.
      storeDiscount: checkout.voucher_issuer && checkout.voucher_issuer !== "company" ? Number(checkout.voucher_amount) : 0,
    });
    const buyer = checkout.buyer_invoice_info
      ? { partnerId: null, name: checkout.buyer_invoice_info.name, taxCode: checkout.buyer_invoice_info.taxCode, address: checkout.buyer_invoice_info.address, anonymous: false }
      : { partnerId: null, name: null, taxCode: null, address: null, anonymous: true };
    const invoiceId = await insertInvoice(transaction, {
      companyId: checkout.operator_company_id,
      sourceDocumentId: null,
      affiliateTransactionId: checkout.affiliate_transaction_id,
      mandateMerchantId: checkout.merchant_id,
      series,
      // Bộ kết nối chưa lập được theo ủy nhiệm (MISA): lỗi cài đặt, không gửi (lựa chọn người dùng 2026-11-17).
      setupError: mandateSupported(settings.provider) ? null : mandateUnsupportedError,
      kind: "original",
      relatedInvoiceId: null,
      invoiceDate,
      settings: { provider: settings.provider, with_tax_code: settings.with_tax_code, template_code: mandate.tax_method === "deduction" ? "1" : "2" },
      seller: { name: mandate.seller_name, taxCode: mandate.tax_code, address: mandate.address },
      buyer,
      currency: "VND",
      items,
      note: `Hóa đơn lập theo ủy nhiệm số ${mandate.mandate_no} ngày ${vietnameseDate(mandate.effective_from)}`,
    });
    await transaction.execute(sql`DELETE FROM affiliate.einvoice_backlog WHERE transaction_id = ${checkout.affiliate_transaction_id}`);
    return { invoiceId };
  }

  // Hủy giao dịch có hóa đơn ủy nhiệm (lát L7; lựa chọn người dùng 2026-11-17): còn trong việc chờ lập thì xóa; hóa đơn chưa phát hành thì "Đã hủy";
  // đã phát hành (hoặc đã gửi chờ cấp mã) thì lập việc chờ xử lý ở MAN_HINH_54 (hóa đơn điều chỉnh giảm toàn bộ, hoặc hóa đơn trả hàng của người mua).
  async cancelForTransaction(transaction: Executor, transactionId: string): Promise<"none" | "backlog_removed" | "cancelled" | "task"> {
    const removed = await transaction.execute(sql`DELETE FROM affiliate.einvoice_backlog WHERE transaction_id = ${transactionId} RETURNING 1`);
    if (removed.rows.length > 0) return "backlog_removed";
    const invoice = (
      await transaction.execute<{ id: string; company_id: string; status: string }>(sql`
      SELECT id, company_id, status FROM finance.einvoices WHERE affiliate_transaction_id = ${transactionId} AND kind = 'original' FOR UPDATE`)
    ).rows[0];
    if (!invoice || invoice.status === "cancelled") return "none";
    if (["pending", "retrying", "failed", "setup_error", "rejected"].includes(invoice.status)) {
      // Lần gửi đang chạy dở không ghi đè: process() chỉ cập nhật hóa đơn chưa phát hành theo lần gửi mới nhất; hủy đặt lại để không gửi tiếp.
      await transaction.execute(sql`UPDATE finance.einvoices SET status = 'cancelled', last_error = NULL, version = version + 1 WHERE id = ${invoice.id}`);
      return "cancelled";
    }
    await transaction.execute(sql`
      INSERT INTO finance.einvoice_return_tasks (company_id, affiliate_transaction_id, original_invoice_id) VALUES (${invoice.company_id}, ${transactionId}, ${invoice.id})
      ON CONFLICT (affiliate_transaction_id) DO NOTHING`);
    return "task";
  }

  // Lập bù (API_334): giao dịch đang trong việc chờ lập; ngày hóa đơn là ngày lập bù.
  async reissue(actor: BuyerAdminActor, transactionId: string): Promise<TransactionEinvoice> {
    const invoiceId = await this.database.transaction(async (transaction) => {
      const backlog = (
        await transaction.execute<{ checkout_id: string; reason: string }>(sql`
        SELECT c.id AS checkout_id, b.reason FROM affiliate.einvoice_backlog b JOIN instore.checkouts c ON c.affiliate_transaction_id = b.transaction_id
        WHERE b.transaction_id = ${transactionId} AND b.operator_company_id = ${actor.operatorCompanyId} FOR UPDATE OF b`)
      ).rows[0];
      if (!backlog) throw new ApiError("NOT_FOUND", "notFound");
      const result = await this.issueForCheckout(transaction, backlog.checkout_id, await vietnamToday(transaction));
      if ("reason" in result) return result;
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "affiliate_transaction.einvoice_reissue",
          entityType: "affiliate_transaction",
          entityId: transactionId,
          beforeData: { reason: backlog.reason },
          afterData: { invoiceId: result.invoiceId },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
      return result;
    });
    // Vẫn thiếu: lưu lý do mới (đã ghi trong giao dịch), báo lỗi theo lý do.
    if ("reason" in invoiceId) throw new ApiError("BUSINESS_RULE", `einvoiceBacklog_${invoiceId.reason}`);
    await this.sendNow(invoiceId.invoiceId);
    return (await this.invoiceOf(transactionId))!;
  }

  // Gửi ngay sau khi lập bù; lỗi để việc nền gửi lại.
  private async sendNow(invoiceId: string): Promise<void> {
    try {
      await this.einvoices.process(invoiceId);
    } catch (error) {
      this.logger.warn(`Gửi hóa đơn ${invoiceId}: ${(error as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Dữ liệu ủy nhiệm (API_334; MAN_HINH_279).
  // ---------------------------------------------------------------------------

  private async mandateRow(executor: Executor, merchantId: string): Promise<MandateRow | undefined> {
    return (
      await executor.execute<MandateRow>(sql`
      SELECT seller_name, tax_code, address, tax_method, default_vat_rate, mandate_no, effective_from::text, expires_on::text, file_name, file_size, version
      FROM affiliate.einvoice_mandates WHERE merchant_id = ${merchantId}`)
    ).rows[0];
  }

  private async merchantOf(executor: Executor, actor: BuyerAdminActor, merchantId: string, lock = false): Promise<void> {
    const merchant = (
      await executor.execute<{ company_id: string }>(sql`SELECT company_id FROM affiliate.merchants WHERE id = ${merchantId} ${lock ? sql`FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!merchant || merchant.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
  }

  async mandate(actor: BuyerAdminActor, merchantId: string, canManage: boolean): Promise<EinvoiceMandateResponse> {
    await this.merchantOf(this.database, actor, merchantId);
    const row = await this.mandateRow(this.database, merchantId);
    const series = await this.database.execute<{ year: number; series: string }>(sql`
      SELECT year, series FROM affiliate.einvoice_series WHERE merchant_id = ${merchantId} ORDER BY year DESC`);
    const settings = await settingsRow(this.database, actor.operatorCompanyId);
    const backlog = await this.database.execute<{ transaction_id: string; document_no: string; created: Date; bill_amount: string; reason: EinvoiceBacklogReason; created_at: Date }>(sql`
      SELECT b.transaction_id, t.document_no, t.created_at AS created, t.bill_amount::text, b.reason, b.created_at
      FROM affiliate.einvoice_backlog b JOIN affiliate.transactions t ON t.id = b.transaction_id WHERE b.merchant_id = ${merchantId} ORDER BY b.created_at LIMIT 200`);
    return {
      merchantId,
      mandate: row
        ? {
            sellerName: row.seller_name,
            taxCode: row.tax_code,
            address: row.address,
            taxMethod: row.tax_method,
            defaultVatRate: row.default_vat_rate,
            mandateNo: row.mandate_no,
            effectiveFrom: row.effective_from,
            expiresOn: row.expires_on,
            file: row.file_name ? { name: row.file_name, size: row.file_size! } : null,
          }
        : null,
      series: series.rows,
      provider: settings?.provider ?? null,
      providerSupportsMandate: settings ? mandateSupported(settings.provider) : false,
      einvoiceEnabled: Boolean(settings?.enabled),
      backlog: backlog.rows.map((item) => ({
        transactionId: item.transaction_id,
        documentNo: item.document_no,
        transactionDate: new Date(item.created).toISOString(),
        amount: trimDecimal(item.bill_amount),
        reason: item.reason,
        createdAt: new Date(item.created_at).toISOString(),
      })),
      canManage,
      version: row?.version ?? 0,
    };
  }

  async saveMandate(actor: BuyerAdminActor, merchantId: string, input: z.infer<typeof einvoiceMandateSchema>): Promise<EinvoiceMandateResponse> {
    await this.database.transaction(async (transaction) => {
      await this.merchantOf(transaction, actor, merchantId, true);
      const before = await this.mandateRow(transaction, merchantId);
      if ((before?.version ?? 0) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Ký hiệu đã có hóa đơn thì không đổi (số hóa đơn theo ký hiệu).
      const used = await transaction.execute<{ year: number; series: string }>(sql`
        SELECT s.year, s.series FROM affiliate.einvoice_series s
        WHERE s.merchant_id = ${merchantId} AND EXISTS (SELECT 1 FROM finance.einvoices e WHERE e.mandate_merchant_id = s.merchant_id AND e.series = s.series)`);
      for (const item of used.rows)
        if (input.series.find((next) => next.year === item.year)?.series !== item.series)
          throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { series: "einvoiceSeriesInUse" } });
      const defaultVatRate = input.taxMethod === "deduction" ? input.defaultVatRate : null;
      await transaction.execute(sql`
        INSERT INTO affiliate.einvoice_mandates (merchant_id, seller_name, tax_code, address, tax_method, default_vat_rate, mandate_no, effective_from, expires_on, updated_by)
        VALUES (${merchantId}, ${input.sellerName}, ${input.taxCode}, ${input.address}, ${input.taxMethod}, ${defaultVatRate}, ${input.mandateNo}, ${input.effectiveFrom}::date,
          ${input.expiresOn}::date, ${actor.userId})
        ON CONFLICT (merchant_id) DO UPDATE SET seller_name = EXCLUDED.seller_name, tax_code = EXCLUDED.tax_code, address = EXCLUDED.address, tax_method = EXCLUDED.tax_method,
          default_vat_rate = EXCLUDED.default_vat_rate, mandate_no = EXCLUDED.mandate_no, effective_from = EXCLUDED.effective_from, expires_on = EXCLUDED.expires_on,
          updated_by = EXCLUDED.updated_by, updated_at = now(), version = affiliate.einvoice_mandates.version + 1`);
      await transaction.execute(sql`DELETE FROM affiliate.einvoice_series WHERE merchant_id = ${merchantId}`);
      for (const item of input.series)
        await transaction.execute(sql`INSERT INTO affiliate.einvoice_series (merchant_id, year, series) VALUES (${merchantId}, ${item.year}, ${item.series})`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "affiliate_merchant.einvoice_mandate",
          entityType: "affiliate_merchant",
          entityId: merchantId,
          beforeData: before ? { ...before, file_name: undefined, file_size: undefined } : null,
          afterData: { ...input, defaultVatRate },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.mandate(actor, merchantId, true);
  }

  // Tệp văn bản ủy nhiệm: PDF, tối đa 10 MB; cần lưu dữ liệu ủy nhiệm trước.
  async saveFile(actor: BuyerAdminActor, merchantId: string, file: { buffer: Buffer; size: number; originalname?: string } | undefined): Promise<EinvoiceMandateResponse> {
    if (!file || file.size === 0) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { file: "required" } });
    if (file.size > maximumFileBytes) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { file: "fileTooLarge" } });
    if (file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { file: "filePdfOnly" } });
    const name = (file.originalname ?? "uy-nhiem.pdf").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 200) || "uy-nhiem.pdf";
    await this.database.transaction(async (transaction) => {
      await this.merchantOf(transaction, actor, merchantId, true);
      const updated = await transaction.execute(sql`
        UPDATE affiliate.einvoice_mandates SET file_name = ${name}, file_content = ${file.buffer}, file_size = ${file.size}, updated_by = ${actor.userId}, updated_at = now(),
          version = version + 1
        WHERE merchant_id = ${merchantId} RETURNING 1`);
      if (updated.rows.length === 0) throw new ApiError("BUSINESS_RULE", "einvoiceMandateMissing");
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "affiliate_merchant.einvoice_mandate_file",
          entityType: "affiliate_merchant",
          entityId: merchantId,
          afterData: { fileName: name, fileSize: file.size },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.mandate(actor, merchantId, true);
  }

  async file(actor: BuyerAdminActor, merchantId: string): Promise<{ content: Buffer; fileName: string }> {
    await this.merchantOf(this.database, actor, merchantId);
    const row = (
      await this.database.execute<{ file_name: string | null; file_content: Buffer | null }>(sql`
      SELECT file_name, file_content FROM affiliate.einvoice_mandates WHERE merchant_id = ${merchantId}`)
    ).rows[0];
    if (!row?.file_content) throw new ApiError("NOT_FOUND", "notFound");
    return { content: Buffer.from(row.file_content), fileName: row.file_name! };
  }

  // ---------------------------------------------------------------------------
  // Xem hóa đơn của giao dịch: cổng cửa hàng, ứng dụng khách (đường dẫn tải có hạn 10 phút).
  // ---------------------------------------------------------------------------

  async invoiceOf(transactionId: string): Promise<TransactionEinvoice | null> {
    return (await this.invoicesOf([transactionId])).get(transactionId) ?? null;
  }

  async invoicesOf(transactionIds: string[]): Promise<Map<string, TransactionEinvoice>> {
    if (transactionIds.length === 0) return new Map();
    const rows = await this.database.execute<{
      affiliate_transaction_id: string;
      id: string;
      status: string;
      series: string | null;
      invoice_no: string | null;
      invoice_date: string;
      total_amount: string;
      has_pdf: boolean;
    }>(sql`
      SELECT affiliate_transaction_id, id, status, series, invoice_no, invoice_date::text, total_amount::text, pdf_content IS NOT NULL AS has_pdf
      FROM finance.einvoices WHERE kind = 'original' AND affiliate_transaction_id IN (${sql.join(
        transactionIds.map((id) => sql`${id}`),
        sql`, `,
      )})`);
    return new Map(
      rows.rows.map((row) => [
        row.affiliate_transaction_id,
        {
          id: row.id,
          status: row.status,
          series: row.series,
          invoiceNo: row.invoice_no,
          invoiceDate: row.invoice_date,
          totalAmount: trimDecimal(row.total_amount),
          hasPdf: row.has_pdf,
        },
      ]),
    );
  }

  // Tệp PDF hóa đơn của giao dịch: cửa hàng (chủ, thu ngân trong phạm vi) hoặc khách của giao dịch.
  async transactionPdf(transactionId: string): Promise<{ content: Buffer; fileName: string }> {
    const row = (
      await this.database.execute<{ series: string | null; invoice_no: string | null; pdf_content: Buffer | null }>(sql`
      SELECT series, invoice_no, pdf_content FROM finance.einvoices WHERE affiliate_transaction_id = ${transactionId} AND kind = 'original'`)
    ).rows[0];
    if (!row?.pdf_content) throw new ApiError("NOT_FOUND", "notFound");
    return { content: Buffer.from(row.pdf_content), fileName: `${row.series ?? "HD"}-${row.invoice_no ?? "0"}.pdf` };
  }

  async buyerLink(buyerId: string, transactionId: string): Promise<{ url: string; expiresAt: string }> {
    const owned = await this.database.execute(sql`
      SELECT 1 FROM affiliate.transactions t JOIN finance.einvoices e ON e.affiliate_transaction_id = t.id AND e.kind = 'original' AND e.pdf_content IS NOT NULL
      WHERE t.id = ${transactionId} AND t.buyer_user_id = ${buyerId}`);
    if (owned.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    const expiresAt = Math.floor(Date.now() / 1000) + linkLifetimeSeconds;
    const token = signPayload({ purpose: "affiliate_einvoice", transactionId, expiresAt });
    return { url: `/api/v1/public/affiliate-einvoices/${token}`, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  async publicPdf(token: string): Promise<{ content: Buffer; fileName: string }> {
    const payload = verifyPayload<{ purpose: string; transactionId: string; expiresAt: number }>(token);
    if (!payload || payload.purpose !== "affiliate_einvoice") throw new ApiError("NOT_FOUND", "notFound");
    return this.transactionPdf(payload.transactionId);
  }

  // ---------------------------------------------------------------------------
  // Hóa đơn phí sàn tháng (việc nền 2 giờ sáng ngày 1): ngày hóa đơn là ngày cuối tháng trước (lựa chọn người dùng 2026-11-17).
  // ---------------------------------------------------------------------------

  async generateMonthlyFeeInvoices(month?: string): Promise<string[]> {
    const today = await vietnamToday(this.database);
    const first = month ?? (await this.database.execute<{ value: string }>(sql`SELECT (date_trunc('month', ${today}::date) - interval '1 month')::date::text AS value`)).rows[0]!.value;
    const invoiceDate = (await this.database.execute<{ value: string }>(sql`SELECT (${first}::date + interval '1 month' - interval '1 day')::date::text AS value`)).rows[0]!.value;
    const operators = await this.database.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator`);
    const created: string[] = [];
    for (const operator of operators.rows) {
      const ids = await this.database.transaction(async (transaction) => {
        await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`instore.fee_invoices:${operator.id}`}))`);
        const settings = await settingsRow(transaction, operator.id);
        if (!settings?.enabled || !settings.start_date || invoiceDate < settings.start_date) {
          this.logger.warn(`Công ty ${operator.id} chưa bật hóa đơn điện tử: chưa lập hóa đơn phí sàn tháng ${first}`);
          return [];
        }
        const groups = await transaction.execute<{
          recipient_kind: "merchant" | "retail_company";
          recipient_company_id: string | null;
          merchant_id: string | null;
          fee_tax_rate: string;
          platform_fee: string;
          platform_fee_tax: string;
        }>(sql`
          SELECT p.recipient_kind, p.recipient_company_id, p.merchant_id, p.fee_tax_rate::text, sum(p.platform_fee)::text AS platform_fee, sum(p.platform_fee_tax)::text AS platform_fee_tax
          FROM instore.payouts p
          WHERE p.operator_company_id = ${operator.id} AND p.business_date >= ${first}::date AND p.business_date <= ${invoiceDate}::date AND p.platform_fee > 0
            AND NOT EXISTS (SELECT 1 FROM instore.fee_invoices f WHERE f.operator_company_id = p.operator_company_id AND f.recipient_kind = p.recipient_kind
              AND coalesce(f.recipient_company_id, f.merchant_id) = coalesce(p.recipient_company_id, p.merchant_id) AND f.month = ${first}::date)
          GROUP BY p.recipient_kind, p.recipient_company_id, p.merchant_id, p.fee_tax_rate
          ORDER BY p.recipient_kind, coalesce(p.recipient_company_id, p.merchant_id), p.fee_tax_rate`);
        // Lát L7: trừ phí ghi ngược (đơn bị hủy sau khi đã vào bảng) ở các bảng trong tháng, theo thuế suất của bảng gốc.
        const reversed = await transaction.execute<{ merchant_id: string; fee_tax_rate: string; fee: string; tax: string }>(sql`
          SELECT c.merchant_id, op.fee_tax_rate::text, sum(c.reversal_fee)::text AS fee, sum(c.reversal_fee_tax)::text AS tax
          FROM instore.checkouts c JOIN instore.payouts rp ON rp.id = c.reversal_payout_id JOIN instore.payouts op ON op.id = c.payout_id
          WHERE rp.operator_company_id = ${operator.id} AND rp.business_date >= ${first}::date AND rp.business_date <= ${invoiceDate}::date AND c.reversal_fee > 0
          GROUP BY c.merchant_id, op.fee_tax_rate`);
        const recipients = new Map<string, typeof groups.rows>();
        for (const row of groups.rows) {
          const key = `${row.recipient_kind}:${row.recipient_company_id ?? row.merchant_id}`;
          recipients.set(key, [...(recipients.get(key) ?? []), { ...row }]);
        }
        for (const item of reversed.rows) {
          const rows = recipients.get(`merchant:${item.merchant_id}`);
          if (!rows) continue;
          const line = rows.find((row) => Number(row.fee_tax_rate) === Number(item.fee_tax_rate));
          if (line) {
            line.platform_fee = String(Number(line.platform_fee) - Number(item.fee));
            line.platform_fee_tax = String(Number(line.platform_fee_tax) - Number(item.tax));
          } else rows.push({ ...rows[0]!, fee_tax_rate: item.fee_tax_rate, platform_fee: String(-Number(item.fee)), platform_fee_tax: String(-Number(item.tax)) });
        }
        // Âm hoặc 0 thì không lập, không mang sang (lựa chọn người dùng 2026-11-17).
        for (const [key, rows] of [...recipients.entries()]) {
          const kept = rows.filter((row) => Number(row.platform_fee) !== 0);
          if (kept.reduce((sum, row) => sum + Number(row.platform_fee), 0) <= 0) {
            this.logger.warn(`Phí sàn tháng ${first} của ${key} sau ghi ngược không dương: không lập hóa đơn`);
            recipients.delete(key);
          } else recipients.set(key, kept);
        }
        const company = (
          await transaction.execute<{ legal_name: string; tax_code: string | null; address: string | null }>(sql`
          SELECT legal_name, tax_code, address FROM core.companies WHERE id = ${operator.id}`)
        ).rows[0]!;
        const label = `${first.slice(5, 7)}/${first.slice(0, 4)}`;
        const result: string[] = [];
        for (const rows of recipients.values()) {
          const head = rows[0]!;
          const fee = rows.reduce((sum, row) => sum + Number(row.platform_fee), 0);
          const tax = rows.reduce((sum, row) => sum + Number(row.platform_fee_tax), 0);
          const feeInvoiceId = (
            await transaction.execute<{ id: string }>(sql`
            INSERT INTO instore.fee_invoices (operator_company_id, recipient_kind, recipient_company_id, merchant_id, month, platform_fee, platform_fee_tax)
            VALUES (${operator.id}, ${head.recipient_kind}, ${head.recipient_company_id}, ${head.merchant_id}, ${first}::date, ${fee}, ${tax}) RETURNING id`)
          ).rows[0]!.id;
          const buyer =
            head.recipient_kind === "merchant"
              ? (
                  await transaction.execute<{ partner_id: string; name: string; tax_code: string | null; address: string | null }>(sql`
                  SELECT p.id AS partner_id, p.name, p.tax_code, p.address FROM affiliate.merchants m JOIN crm.partners p ON p.id = m.partner_id WHERE m.id = ${head.merchant_id}`)
                ).rows[0]!
              : (
                  await transaction.execute<{ partner_id: string | null; name: string; tax_code: string | null; address: string | null }>(sql`
                  SELECT (SELECT id FROM crm.partners WHERE company_id = c.id) AS partner_id, c.legal_name AS name, c.tax_code, c.address FROM core.companies c
                  WHERE c.id = ${head.recipient_company_id}`)
                ).rows[0]!;
          const items: InvoiceItem[] = rows.map((row, index) => {
            const net = Number(row.platform_fee);
            const vat = Number(row.platform_fee_tax);
            return {
              lineNo: index + 1,
              itemCode: null,
              itemName: `Phí dịch vụ sàn tháng ${label}`,
              unitName: "Tháng",
              quantity: 1,
              unitPrice: net,
              vatRate: String(Number(row.fee_tax_rate)) as VatRate,
              netAmount: net,
              taxAmount: vat,
              totalAmount: net + vat,
              isPromotion: false,
            };
          });
          result.push(
            await insertInvoice(transaction, {
              companyId: operator.id,
              sourceDocumentId: null,
              instoreFeeInvoiceId: feeInvoiceId,
              kind: "original",
              relatedInvoiceId: null,
              invoiceDate,
              settings,
              seller: { name: company.legal_name, taxCode: company.tax_code, address: company.address },
              buyer: { partnerId: buyer.partner_id, name: buyer.name, taxCode: buyer.tax_code, address: buyer.address, anonymous: false },
              currency: "VND",
              items,
              note: null,
            }),
          );
        }
        return result;
      });
      created.push(...ids);
    }
    return created;
  }
}
