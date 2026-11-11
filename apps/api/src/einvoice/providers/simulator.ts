// Bộ giả lập nhà cung cấp hóa đơn điện tử (CONG_VIEC_16): cấp số liên tục theo ký hiệu, mã cơ quan thuế giả, PDF có dòng "bản giả lập".
// Chỉ dùng ở môi trường không phải môi trường thật. Tình huống lỗi theo cài đặt `simulation` của công ty để kiểm thử, xem trước.
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "../../database/database.module";
import { invoicePdf } from "../invoice-pdf";
import type { EinvoiceProviderAdapter, ProviderConfig, ProviderInvoice, ProviderResult } from "./provider";

type Stored = { invoiceNo: string; taxAuthorityCode: string | null; outcome: "issued" | "awaiting_code" | "rejected"; statusChecks: number };

export class SimulatorProvider implements EinvoiceProviderAdapter {
  // Hóa đơn nhà cung cấp giả đã nhận theo mã tham chiếu (giữ trong bộ nhớ tiến trình).
  private readonly received = new Map<string, Stored>();
  private readonly publishCalls = new Map<string, number>();

  constructor(private readonly database: Pick<Database, "execute">) {}

  async testConnection(): Promise<{ ok: boolean; message: string | null }> {
    return { ok: true, message: null };
  }

  private async nextNumber(config: ProviderConfig, series: string): Promise<string> {
    const stored = (
      await this.database.execute<{ value: string }>(sql`
      SELECT coalesce(max(invoice_no::integer), 0)::text AS value FROM finance.einvoices WHERE company_id = ${config.companyId} AND series = ${series} AND invoice_no IS NOT NULL`)
    ).rows[0]!.value;
    const inMemory = [...this.received.entries()].filter(([key]) => key.startsWith(`${config.companyId}:${series}:`)).map(([, value]) => Number(value.invoiceNo));
    return String(Math.max(Number(stored), 0, ...inMemory) + 1);
  }

  async publish(config: ProviderConfig, invoice: ProviderInvoice): Promise<ProviderResult> {
    const key = `${config.companyId}:${invoice.series}:${invoice.referenceId}`;
    const calls = (this.publishCalls.get(key) ?? 0) + 1;
    this.publishCalls.set(key, calls);
    const existing = this.received.get(key);
    // Cùng mã tham chiếu: trả lại hóa đơn đã lập, không lập trùng.
    if (existing) return { outcome: existing.outcome, invoiceNo: existing.invoiceNo, taxAuthorityCode: existing.taxAuthorityCode, transactionId: invoice.referenceId };
    if (config.simulation === "data_error") return { outcome: "data_error", errorCode: "InvalidData", message: "Dữ liệu hóa đơn không hợp lệ (giả lập)." };
    if (config.simulation === "temporary_error" && calls === 1) return { outcome: "temporary_error", errorCode: "ServiceUnavailable", message: "Nhà cung cấp tạm thời không phản hồi (giả lập)." };
    const invoiceNo = invoice.invoiceNo ?? (await this.nextNumber(config, invoice.series));
    const code = config.withTaxCode ? `M${invoice.series.slice(1, 3)}-${randomBytes(6).toString("hex").toUpperCase()}` : null;
    if (config.simulation === "rejected") {
      this.received.set(key, { invoiceNo, taxAuthorityCode: null, outcome: "rejected", statusChecks: 0 });
      return { outcome: "rejected", invoiceNo, errorCode: "TaxAuthorityRejected", message: "Cơ quan thuế từ chối cấp mã (giả lập).", transactionId: invoice.referenceId };
    }
    const awaiting = config.withTaxCode && config.simulation === "pending_code";
    this.received.set(key, { invoiceNo, taxAuthorityCode: awaiting ? null : code, outcome: awaiting ? "awaiting_code" : "issued", statusChecks: 0 });
    // Hết thời gian chờ: nhà cung cấp đã lập nhưng bên gọi không nhận được phản hồi.
    if (config.simulation === "timeout" && calls === 1) return { outcome: "unknown", errorCode: "Timeout", message: "Hết thời gian chờ phản hồi (giả lập)." };
    return { outcome: awaiting ? "awaiting_code" : "issued", invoiceNo, taxAuthorityCode: awaiting ? null : code, transactionId: invoice.referenceId };
  }

  async status(config: ProviderConfig, invoice: ProviderInvoice): Promise<ProviderResult> {
    const key = `${config.companyId}:${invoice.series}:${invoice.referenceId}`;
    const stored = this.received.get(key);
    if (!stored) return { outcome: "not_found" };
    stored.statusChecks += 1;
    // Chờ cấp mã: lần tra thứ nhất cơ quan thuế cấp mã.
    if (stored.outcome === "awaiting_code") {
      stored.outcome = "issued";
      stored.taxAuthorityCode = `M${invoice.series.slice(1, 3)}-${randomBytes(6).toString("hex").toUpperCase()}`;
    }
    return { outcome: stored.outcome, invoiceNo: stored.invoiceNo, taxAuthorityCode: stored.taxAuthorityCode, transactionId: invoice.referenceId };
  }

  async download(_config: ProviderConfig, invoice: ProviderInvoice, issued: { invoiceNo: string; taxAuthorityCode: string | null }): Promise<{ pdf: Buffer | null; xml: Buffer | null }> {
    const xml = Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>\n<HDon simulated="true"><DLHDon><TTChung><KHMSHDon>${invoice.templateCode}</KHMSHDon><KHHDon>${invoice.series}</KHHDon><SHDon>${issued.invoiceNo}</SHDon><NLap>${invoice.invoiceDate}</NLap></TTChung></DLHDon>${issued.taxAuthorityCode ? `<MCCQT>${issued.taxAuthorityCode}</MCCQT>` : ""}<TgTTTBSo>${invoice.totalAmount}</TgTTTBSo></HDon>\n`,
      "utf8",
    );
    return { pdf: await invoicePdf(invoice, issued, true), xml };
  }
}
