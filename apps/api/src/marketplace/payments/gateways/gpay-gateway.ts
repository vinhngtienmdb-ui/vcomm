// Lớp kết nối cổng thanh toán G-Pay (g-pay.vn) theo khung nhiều cổng (CONG_VIEC_39; QUYTAC_NGHIEPVU_255 đến 259).
// Định dạng theo mã mẫu chính thức của G-Pay (github.com/gpay86/devportal, java_sample và golang_sample): trang tài liệu developers.g-pay.vn chặn truy cập tự động nên chưa đối chiếu được.
import { createPrivateKey, createPublicKey, sign, verify, randomUUID, X509Certificate, type KeyObject } from "node:crypto";
import type { PaymentMethodCode } from "contracts";
import { ApiError } from "../../../common/api-error";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface GpayConfiguration {
  // Địa chỉ OpenAPI của G-Pay kèm phiên bản, ví dụ https://openapi.sandbox.g-pay.vn/v1.
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  // Khóa riêng của VComm ký yêu cầu gửi G-Pay (SHA256withRSA).
  merchantPrivateKey: KeyObject;
  // Chứng thư công khai của VComm (đã gửi G-Pay), gửi trong tiêu đề x-certificate dạng base64 không kèm dòng BEGIN, END.
  merchantCertificate: string;
  // Khóa công khai (hoặc chứng thư) của G-Pay để kiểm chữ ký kết quả gửi về.
  gatewayPublicKey: KeyObject;
  // Địa chỉ công khai của API: .../api/v1/public/payments/gpay/notify và .../return.
  webhookUrl: string;
  returnUrl: string;
}

// Khóa trong biến môi trường viết trên một dòng thì thay \n bằng xuống dòng.
const pemText = (value: string) => value.replace(/\\n/g, "\n").trim();

function gatewayPublicKey(value: string): KeyObject {
  const text = pemText(value);
  return text.includes("BEGIN CERTIFICATE") ? new X509Certificate(text).publicKey : createPublicKey(text);
}

// GPAY_API_URL mặc định là môi trường thử nghiệm của G-Pay. Thiếu thông tin hoặc khóa không đọc được thì cổng chưa bật.
export function gpayConfiguration(): GpayConfiguration | null {
  const environment = (name: string) => process.env[name]?.trim() ?? "";
  const clientId = environment("GPAY_CLIENT_ID");
  const clientSecret = environment("GPAY_CLIENT_SECRET");
  const privateKeyText = environment("GPAY_MERCHANT_PRIVATE_KEY");
  const certificateText = environment("GPAY_MERCHANT_CERTIFICATE");
  const publicKeyText = environment("GPAY_PUBLIC_KEY");
  const webhookUrl = environment("GPAY_WEBHOOK_URL");
  const returnUrl = environment("GPAY_RETURN_URL");
  if (!clientId || !clientSecret || !privateKeyText || !certificateText || !publicKeyText || !webhookUrl || !returnUrl) return null;
  try {
    return {
      apiUrl: (environment("GPAY_API_URL") || "https://openapi.sandbox.g-pay.vn/v1").replace(/\/+$/, ""),
      clientId,
      clientSecret,
      merchantPrivateKey: createPrivateKey(pemText(privateKeyText)),
      merchantCertificate: pemText(certificateText)
        .replace(/-----(BEGIN|END) CERTIFICATE-----/g, "")
        .replace(/\s+/g, ""),
      gatewayPublicKey: gatewayPublicKey(publicKeyText),
      webhookUrl,
      returnUrl,
    };
  } catch {
    return null;
  }
}

// Phương thức VComm và phương thức trên trang G-Pay (QUYTAC_NGHIEPVU_255).
export const gpayPaymentMethods: Partial<Record<PaymentMethodCode, string>> = {
  gpay_atm: "BANK_ATM",
  gpay_international: "BANK_INTERNATIONAL",
  gpay_va: "VA",
};

// Chuỗi G-Pay ký trong kết quả gửi về, các trường theo thứ tự cố định (QUYTAC_NGHIEPVU_257).
const notificationFields = ["merchant_order_id", "gpay_trans_id", "gpay_bill_id", "status", "embed_data", "user_payment_method"] as const;

export function notificationSigningText(body: Record<string, unknown>): string {
  return notificationFields.map((field) => `${field}=${body[field] === undefined || body[field] === null ? "" : String(body[field])}`).join("&");
}

// Dữ liệu riêng gửi kèm đơn, G-Pay trả nguyên trong kết quả đã ký: số tham chiếu và số tiền để đối chiếu (QUYTAC_NGHIEPVU_256).
export const embedData = (reference: string, amount: number) => `${reference}|${amount}`;

function readEmbedData(value: unknown): { reference: string; amount: number } | null {
  const match = /^([A-Za-z0-9]{1,60})\|(\d{1,15})$/.exec(typeof value === "string" ? value : "");
  return match ? { reference: match[1]!, amount: Number(match[2]) } : null;
}

// Trạng thái kết thúc của đơn G-Pay: ORDER_SUCCESS là thành công; tên có FAIL, CANCEL, EXPIRE, REJECT là thất bại; còn lại là chưa xong.
export function gpayStatusKind(status: unknown): "succeeded" | "failed" | "pending" {
  if (status === "ORDER_SUCCESS") return "succeeded";
  return typeof status === "string" && /FAIL|CANCEL|EXPIRE|REJECT/.test(status) ? "failed" : "pending";
}

// Kết quả đã ký (kết quả gửi về hoặc tra cứu đơn) thành kết quả chung; số tham chiếu phải trùng mã đơn đã gửi G-Pay.
function notificationOf(fields: Record<string, unknown>, success: boolean): GatewayNotification | null {
  const embedded = readEmbedData(fields.embed_data);
  if (!embedded || embedded.reference !== fields.merchant_order_id) return null;
  const text = (value: unknown) => (typeof value === "string" && value ? value.slice(0, 100) : null);
  return {
    reference: embedded.reference,
    amount: embedded.amount,
    success,
    responseCode: text(fields.status) ?? "UNKNOWN",
    transactionNo: text(fields.gpay_trans_id),
    bankCode: text(fields.user_payment_method),
  };
}

const replies: Record<NotificationOutcome, { status: number; body: { code: string; message: string } }> = {
  success: { status: 200, body: { code: "00", message: "OK" } },
  already_confirmed: { status: 200, body: { code: "02", message: "Order already confirmed" } },
  not_found: { status: 400, body: { code: "01", message: "Order not found" } },
  invalid_amount: { status: 400, body: { code: "04", message: "Invalid amount" } },
  invalid_signature: { status: 401, body: { code: "97", message: "Invalid signature" } },
  error: { status: 500, body: { code: "99", message: "Unknown error" } },
};

interface GpayResponse {
  meta?: { code?: string | number; msg?: string };
  data?: Record<string, unknown>;
}

const requestTimeoutMilliseconds = 15_000;

export class GpayGateway implements PaymentGatewayAdapter {
  readonly code = "gpay" as const;
  // Mã truy cập G-Pay dùng lại tới gần hết hạn (QUYTAC_NGHIEPVU_258).
  private accessToken: { value: string; expiresAt: number; owner: string } | null = null;

  configured(): boolean {
    return gpayConfiguration() !== null;
  }

  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = gpayConfiguration()!;
    const paymentMethod = gpayPaymentMethods[input.method];
    if (!paymentMethod) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    const title = `Thanh toan don ${input.documentNo}`;
    const response = await this.call(configuration, "/payments/gateway/init-order", {
      request_id: input.reference,
      amount: input.amount,
      title,
      description: title,
      payment_method: paymentMethod,
      payment_type: "IMMEDIATE",
      callback_url: configuration.returnUrl,
      webhook_url: configuration.webhookUrl,
      embed_data: embedData(input.reference, input.amount),
    });
    const billUrl = response.data?.bill_url;
    if (typeof billUrl !== "string" || !/^https:\/\//.test(billUrl)) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    return { kind: "redirect", url: billUrl };
  }

  // Kết quả G-Pay gửi về (POST JSON): kiểm chữ ký SHA256withRSA bằng khóa công khai của G-Pay (QUYTAC_NGHIEPVU_257).
  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = gpayConfiguration();
    const body = request.body;
    if (!configuration || !body || typeof body !== "object" || Array.isArray(body)) return null;
    const fields = body as Record<string, unknown>;
    if (typeof fields.signature !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(fields.signature)) return null;
    const valid = verify("sha256", Buffer.from(notificationSigningText(fields), "utf8"), configuration.gatewayPublicKey, Buffer.from(fields.signature, "base64"));
    // Kết quả chưa kết thúc thì không ghi nhận (G-Pay chỉ gửi khi giao dịch kết thúc; gặp thì coi như không đọc được).
    if (!valid || gpayStatusKind(fields.status) === "pending") return null;
    return notificationOf(fields, gpayStatusKind(fields.status) === "succeeded");
  }

  // Trang trả về: không tin tham số trên đường dẫn, tra cứu đơn với G-Pay để hiển thị (QUYTAC_NGHIEPVU_259).
  async verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = gpayConfiguration();
    const query = request.query;
    const text = (value: unknown) => (typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value) ? value : null);
    const merchantOrderId = text(query.merchant_order_id) ?? text(query.request_id);
    if (!configuration || !merchantOrderId) return null;
    const response = await this.call(configuration, "/payments/gateway/query-order", {
      merchant_order_id: merchantOrderId,
      gpay_bill_id: text(query.gpay_bill_id) ?? text(query.bill_id) ?? "",
    });
    // Trang trả về chỉ hiển thị, "thành công" lấy theo lần thanh toán đã ghi nhận; đơn G-Pay chưa xong thì không báo thất bại để trang hiện "đang chờ".
    const result = response.data ? notificationOf(response.data, gpayStatusKind(response.data.status) !== "failed") : null;
    return result && result.reference === merchantOrderId ? result : null;
  }

  // G-Pay chỉ cần HTTP 200 khi đã nhận; lỗi máy chủ trả 500 để G-Pay gửi lại.
  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return replies[outcome];
  }

  // Gọi OpenAPI của G-Pay: mã truy cập, tiêu đề x-timestamp, x-requests-id, x-certificate, chữ ký trên x-timestamp + x-requests-id + nội dung.
  private async call(configuration: GpayConfiguration, path: string, payload: object, retried = false): Promise<GpayResponse> {
    const token = await this.token(configuration);
    const body = JSON.stringify(payload);
    const timestamp = String(Date.now());
    const requestId = randomUUID();
    const signature = sign("sha256", Buffer.from(timestamp + requestId + body, "utf8"), configuration.merchantPrivateKey).toString("base64");
    const response = await fetch(configuration.apiUrl + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-timestamp": timestamp,
        "x-requests-id": requestId,
        "x-certificate": configuration.merchantCertificate,
        signature,
      },
      body,
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    }).catch(() => null);
    if (response?.status === 401 && !retried) {
      this.accessToken = null;
      return this.call(configuration, path, payload, true);
    }
    const result = response ? ((await response.json().catch(() => null)) as GpayResponse | null) : null;
    if (!response?.ok || !result || String(result.meta?.code) !== "200") throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    return result;
  }

  private async token(configuration: GpayConfiguration): Promise<string> {
    const owner = `${configuration.apiUrl} ${configuration.clientId}`;
    if (this.accessToken && this.accessToken.owner === owner && this.accessToken.expiresAt > Date.now()) return this.accessToken.value;
    const response = await fetch(`${configuration.apiUrl}/auth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: configuration.clientId, client_secret: configuration.clientSecret }),
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    }).catch(() => null);
    const result = response?.ok ? ((await response.json().catch(() => null)) as GpayResponse | null) : null;
    const value = result?.data?.access_token;
    if (typeof value !== "string" || !value) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    // Thời hạn G-Pay trả (giây); không có thì dùng 3 phút như mã mẫu; lấy lại trước khi hết hạn 30 giây.
    const lifetimeSeconds = Number(result?.data?.expires_in) > 0 ? Number(result!.data!.expires_in) : 180;
    this.accessToken = { value, expiresAt: Date.now() + Math.max(lifetimeSeconds - 30, 30) * 1000, owner };
    return value;
  }
}
