// Kết nối MISA meInvoice (CONG_VIEC_16 lát L2; QUYTAC_NGHIEPVU_105). REST, JSON; ký số từ xa (HSM) phía MISA.
// Đường dẫn, tên trường lấy theo nguồn thứ cấp trích tài liệu tích hợp `doc.meinvoice.vn/itg` (trang chính thức không truy cập được ngày 2026-11-10):
// phải đối chiếu với tài liệu MISA cấp khi ký hợp đồng và thử với tài khoản thử trước khi bật ở môi trường thật.
import { createHash } from "node:crypto";
import type { EinvoiceProviderAdapter, ProviderConfig, ProviderInvoice, ProviderResult } from "./provider";

const baseUrls = { test: "https://testapi.meinvoice.vn/api/integration", production: "https://api.meinvoice.vn/api/integration" } as const;
// Kiểm thử trỏ tới máy chủ giả.
const baseUrl = (config: ProviderConfig) => process.env.MISA_EINVOICE_BASE_URL ?? baseUrls[config.environment];
const requestTimeoutMilliseconds = 20_000;
// Ký số từ xa đồng bộ: MISA lập, ký, phát hành, gửi cơ quan thuế.
const signTypeRemoteSynchronous = 2;
const authenticationErrors = new Set(["InvalidAppID", "InactiveAppID", "UnAuthorize", "InvalidUser", "InvalidTaxCode"]);
const vatRateNames: Record<string, string> = { "0": "0%", "5": "5%", "8": "8%", "10": "10%", exempt: "KCT", not_declared: "KKKNT" };

type MisaResponse = { Success?: boolean; Data?: unknown; ErrorCode?: string | null; Errors?: string[] | null; DescriptionErrorCode?: string | null };
type MisaInvoiceResult = {
  RefID?: string;
  TransactionID?: string | null;
  InvNo?: string | null;
  InvSeries?: string | null;
  InvoiceCode?: string | null;
  InvCode?: string | null;
  ErrorCode?: string | null;
  DescriptionErrorCode?: string | null;
  SendTaxStatus?: number | null;
};

class TemporaryFailure extends Error {}

// Data có thể là chuỗi JSON hoặc giá trị JSON.
function parseData<T>(data: unknown): T | null {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as T;
    }
  }
  return (data ?? null) as T | null;
}

const vietnamDateTime = (date: string) => `${date}T00:00:00+07:00`;

export class MisaProvider implements EinvoiceProviderAdapter {
  // Mã truy cập theo công ty, giữ trong bộ nhớ; không lưu cơ sở dữ liệu, không ghi nhật ký.
  private readonly tokens = new Map<string, { token: string; expiresAt: number }>();

  private async request(config: ProviderConfig, method: "GET" | "POST", path: string, body: unknown, token: string | null): Promise<MisaResponse> {
    let response: Response;
    try {
      response = await fetch(`${baseUrl(config)}${path}`, {
        method,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: method === "POST" ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(requestTimeoutMilliseconds),
      });
    } catch (error) {
      throw new TemporaryFailure((error as Error).name === "TimeoutError" ? "einvoiceProviderTimeout" : (error as Error).message);
    }
    if (response.status === 401) return { Success: false, ErrorCode: "UnAuthorize" };
    if (response.status >= 500 || response.status === 429) throw new TemporaryFailure(`HTTP ${response.status}`);
    return ((await response.json().catch(() => null)) ?? { Success: false, ErrorCode: `HTTP ${response.status}` }) as MisaResponse;
  }

  // Khóa bộ nhớ theo công ty và thông tin kết nối: đổi cài đặt thì lấy mã mới.
  private tokenKey(config: ProviderConfig): string {
    return createHash("sha256")
      .update(JSON.stringify([config.companyId, config.environment, config.appId, config.taxCode, config.username, config.password]))
      .digest("hex");
  }

  private async token(config: ProviderConfig, refresh = false): Promise<string> {
    const cached = this.tokens.get(this.tokenKey(config));
    if (cached && !refresh && cached.expiresAt > Date.now()) return cached.token;
    const result = await this.request(config, "POST", "/auth/token", { appid: config.appId, taxcode: config.taxCode, username: config.username, password: config.password }, null);
    const token = typeof result.Data === "string" ? result.Data : null;
    if (!result.Success || !token) throw Object.assign(new Error(result.ErrorCode ?? "UnAuthorize"), { authentication: true });
    // Thời hạn mã truy cập chưa rõ trong tài liệu: giữ 12 giờ, lỗi xác thực thì lấy lại.
    this.tokens.set(this.tokenKey(config), { token, expiresAt: Date.now() + 12 * 60 * 60_000 });
    return token;
  }

  // Gọi kèm mã truy cập; lỗi xác thực thì lấy mã mới và gọi lại một lần.
  private async authorized(config: ProviderConfig, method: "GET" | "POST", path: string, body: unknown): Promise<MisaResponse> {
    let result = await this.request(config, method, path, body, await this.token(config));
    if (!result.Success && result.ErrorCode && authenticationErrors.has(result.ErrorCode)) result = await this.request(config, method, path, body, await this.token(config, true));
    return result;
  }

  private async guarded(call: () => Promise<ProviderResult>): Promise<ProviderResult> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof TemporaryFailure)
        return { outcome: (error as Error).message === "einvoiceProviderTimeout" ? "unknown" : "temporary_error", errorCode: "ProviderUnavailable", message: (error as Error).message };
      if ((error as { authentication?: boolean }).authentication) return { outcome: "data_error", errorCode: (error as Error).message, message: "einvoiceProviderAuthentication" };
      throw error;
    }
  }

  async testConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string | null }> {
    try {
      await this.token(config, true);
      const year = new Date().getFullYear();
      const result = await this.authorized(config, "GET", `/invoice/templates?invoiceWithCode=${config.withTaxCode}&year=${year}`, null);
      return result.Success ? { ok: true, message: null } : { ok: false, message: result.ErrorCode ?? "einvoiceProviderRejected" };
    } catch (error) {
      return { ok: false, message: (error as { authentication?: boolean }).authentication ? "einvoiceProviderAuthentication" : (error as Error).message };
    }
  }

  invoiceData(invoice: ProviderInvoice) {
    const rates = new Map<string, { net: number; tax: number }>();
    for (const line of invoice.lines) {
      const target = rates.get(line.vatRate) ?? { net: 0, tax: 0 };
      target.net += line.netAmount;
      target.tax += line.taxAmount;
      rates.set(line.vatRate, target);
    }
    const buyerName = invoice.buyer.anonymous ? null : invoice.buyer.name;
    return {
      RefID: invoice.referenceId,
      InvSeries: invoice.series,
      InvTemplateNo: invoice.templateCode,
      InvDate: vietnamDateTime(invoice.invoiceDate),
      CurrencyCode: invoice.currency,
      ExchangeRate: 1,
      PaymentMethodName: "TM/CK",
      BuyerLegalName: buyerName,
      BuyerTaxCode: invoice.buyer.taxCode,
      BuyerAddress: invoice.buyer.address,
      // Người mua không cung cấp thông tin: chỉ ghi họ tên người mua nếu có.
      BuyerFullName: invoice.buyer.anonymous ? (invoice.buyer.name ?? "Người mua không cung cấp tên, địa chỉ, mã số thuế") : null,
      TotalSaleAmountOC: invoice.netAmount,
      TotalDiscountAmountOC: 0,
      TotalAmountWithoutVATOC: invoice.netAmount,
      TotalVATAmountOC: invoice.taxAmount,
      TotalAmountOC: invoice.totalAmount,
      TotalAmountInWords: invoice.amountInWords,
      OriginalInvoiceDetail: invoice.lines.map((line) => ({
        // 1: hàng hóa, dịch vụ; 2: hàng khuyến mại (theo nguồn thứ cấp, chưa xác minh).
        ItemType: line.isPromotion ? 2 : 1,
        LineNumber: line.lineNo,
        SortOrder: line.lineNo,
        ItemCode: line.itemCode,
        ItemName: line.itemName,
        UnitName: line.unitName,
        Quantity: line.quantity,
        UnitPrice: line.unitPrice,
        DiscountRate: 0,
        DiscountAmountOC: 0,
        AmountOC: line.netAmount,
        AmountWithoutVATOC: line.netAmount,
        VATRateName: vatRateNames[line.vatRate],
        VATAmountOC: line.taxAmount,
      })),
      TaxRateInfo: [...rates.entries()].map(([rate, value]) => ({ VATRateName: vatRateNames[rate], AmountWithoutVATOC: value.net, VATAmountOC: value.tax })),
      // Hóa đơn điều chỉnh (2), thay thế (1) tham chiếu hóa đơn gốc.
      ...(invoice.original && invoice.kind !== "original"
        ? {
            ReferenceType: invoice.kind === "replacement" ? 1 : 2,
            OrgInvTemplateNo: invoice.original.templateCode,
            OrgInvSeries: invoice.original.series,
            OrgInvNo: invoice.original.invoiceNo,
            OrgInvDate: vietnamDateTime(invoice.original.invoiceDate),
            InvoiceNote: invoice.note,
          }
        : {}),
    };
  }

  private outcomeOf(config: ProviderConfig, item: MisaInvoiceResult | undefined, response: MisaResponse): ProviderResult {
    if (!item) {
      if (response.ErrorCode && authenticationErrors.has(response.ErrorCode)) return { outcome: "data_error", errorCode: response.ErrorCode, message: "einvoiceProviderAuthentication" };
      return { outcome: "data_error", errorCode: response.ErrorCode ?? "EmptyResponse", message: response.DescriptionErrorCode ?? response.Errors?.join("; ") ?? null };
    }
    // Trùng mã tham chiếu: nhà cung cấp đã nhận hóa đơn này, tra trạng thái thay vì coi là lỗi dữ liệu.
    if (item.ErrorCode && /duplicate|exist/i.test(item.ErrorCode))
      return { outcome: "unknown", errorCode: item.ErrorCode, message: item.DescriptionErrorCode ?? null, transactionId: item.TransactionID ?? null };
    if (item.ErrorCode) return { outcome: "data_error", errorCode: item.ErrorCode, message: item.DescriptionErrorCode ?? item.ErrorCode, transactionId: item.TransactionID ?? null };
    const code = item.InvoiceCode ?? item.InvCode ?? null;
    if (!item.InvNo) return { outcome: "unknown", errorCode: "MissingNumber", transactionId: item.TransactionID ?? null };
    // Hóa đơn có mã: chưa có mã của cơ quan thuế thì chờ cấp mã.
    if (config.withTaxCode && !code) return { outcome: "awaiting_code", invoiceNo: item.InvNo, transactionId: item.TransactionID ?? null };
    return { outcome: "issued", invoiceNo: item.InvNo, taxAuthorityCode: code, transactionId: item.TransactionID ?? null };
  }

  async publish(config: ProviderConfig, invoice: ProviderInvoice): Promise<ProviderResult> {
    return this.guarded(async () => {
      const response = await this.authorized(config, "POST", "/invoice", { SignType: signTypeRemoteSynchronous, InvoiceData: [this.invoiceData(invoice)], PublishInvoiceData: null });
      const items = parseData<MisaInvoiceResult[]>(response.Data);
      return this.outcomeOf(config, Array.isArray(items) ? items.find((item) => item.RefID === invoice.referenceId) : undefined, response);
    });
  }

  async status(config: ProviderConfig, invoice: ProviderInvoice): Promise<ProviderResult> {
    return this.guarded(async () => {
      const response = await this.authorized(config, "POST", `/invoice/status?invoiceWithCode=${config.withTaxCode}&inputType=2`, [invoice.referenceId]);
      const items = parseData<MisaInvoiceResult[]>(response.Data);
      const item = Array.isArray(items) ? items.find((entry) => entry.RefID === invoice.referenceId) : undefined;
      if (response.Success && !item) return { outcome: "not_found" };
      return this.outcomeOf(config, item, response);
    });
  }

  async download(config: ProviderConfig, _invoice: ProviderInvoice, issued: { transactionId: string | null }): Promise<{ pdf: Buffer | null; xml: Buffer | null }> {
    if (!issued.transactionId) return { pdf: null, xml: null };
    const file = async (format: "pdf" | "xml") => {
      const response = await this.authorized(config, "POST", `/invoice/Download?downloadDataType=${format}`, [issued.transactionId]);
      const items = parseData<{ TransactionID?: string; Data?: string }[]>(response.Data);
      const data = Array.isArray(items) ? items.find((item) => item.TransactionID === issued.transactionId)?.Data : null;
      return data ? Buffer.from(data, "base64") : null;
    };
    return { pdf: await file("pdf"), xml: await file("xml") };
  }
}
