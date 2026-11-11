// Kết nối ZaloPay dùng chung (CONG_VIEC_42; QUYTAC_NGHIEPVU_270 đến 274) cho mọi cổng đi qua cùng tài khoản ZaloPay: cổng zalopay, Apple Pay (CONG_VIEC_41), Google Pay (CONG_VIEC_40).
// Cùng biến môi trường ZALOPAY_* và cùng kiểu cấu hình với CONG_VIEC_41 để phiên chính gộp lớp Apple Pay về tệp này.
// Theo tài liệu công khai docs.zalopay.vn (API v2): tạo đơn, tra cứu ký HMAC SHA256 bằng key1; kết quả gửi về, trang trả về ký bằng key2.
// Chưa thử với môi trường thử nghiệm của ZaloPay; phải thử trước khi phát hành.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { GatewayNotification, NotificationOutcome, PaymentStartInput } from "../payment-gateway";

export interface ZalopayConfiguration {
  appId: string;
  // key1 ký yêu cầu VComm gửi ZaloPay, key2 kiểm kết quả gửi về và trang trả về (ZaloPay cấp khi đăng ký).
  requestMacKey: string;
  callbackMacKey: string;
  endpoint: string;
  // Địa chỉ công khai của API VComm (không kèm /api/v1), ZaloPay gửi kết quả và chuyển người mua về.
  publicApiUrl: string;
}

// ZALOPAY_ENDPOINT mặc định là môi trường thử nghiệm của ZaloPay.
export function zalopayConfiguration(): ZalopayConfiguration | null {
  const appId = process.env.ZALOPAY_APP_ID?.trim();
  const requestMacKey = process.env.ZALOPAY_KEY1?.trim();
  const callbackMacKey = process.env.ZALOPAY_KEY2?.trim();
  const publicApiUrl = process.env.ZALOPAY_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!appId || !/^\d+$/.test(appId) || !requestMacKey || !callbackMacKey || !publicApiUrl) return null;
  const endpoint = (process.env.ZALOPAY_ENDPOINT?.trim() || "https://sb-openapi.zalopay.vn").replace(/\/+$/, "");
  return { appId, requestMacKey, callbackMacKey, endpoint, publicApiUrl };
}

// Đường dẫn chung của khung (QUYTAC_NGHIEPVU_221) theo mã cổng.
export const zalopayNotifyUrl = (configuration: ZalopayConfiguration, gatewayCode: string) => `${configuration.publicApiUrl}/api/v1/public/payments/${gatewayCode}/notify`;
export const zalopayReturnUrl = (configuration: ZalopayConfiguration, gatewayCode: string) => `${configuration.publicApiUrl}/api/v1/public/payments/${gatewayCode}/return`;

export const zalopayMac = (macKey: string, input: string) => createHmac("sha256", macKey).update(input, "utf8").digest("hex");

// So sánh chữ ký hex an toàn thời gian.
function sameMac(expected: string, received: unknown): boolean {
  if (typeof received !== "string" || !/^[0-9a-fA-F]{64}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

// app_trans_id: yymmdd theo giờ Việt Nam, gạch dưới, số tham chiếu (tối đa 40 ký tự).
export function zalopayTransactionId(reference: string, at: Date): string {
  const vietnam = new Date(at.getTime() + 7 * 3_600_000).toISOString();
  return `${vietnam.slice(2, 4)}${vietnam.slice(5, 7)}${vietnam.slice(8, 10)}_${reference}`;
}

// Số tham chiếu của khung là phần sau dấu gạch dưới; sai định dạng trả null.
export function referenceOf(transactionId: unknown): string | null {
  if (typeof transactionId !== "string") return null;
  const match = /^\d{6}_([A-Za-z0-9]{1,33})$/.exec(transactionId);
  return match ? match[1]! : null;
}

// Thời hạn đơn theo hạn thanh toán của đơn VComm, trong giới hạn ZaloPay cho phép (300 giây đến 30 ngày).
const expireDurationSeconds = (input: PaymentStartInput) => Math.min(2_592_000, Math.max(300, Math.floor((input.expiresAt.getTime() - input.createdAt.getTime()) / 1000)));
const requestTimeoutMilliseconds = 10_000;

async function postForm(configuration: ZalopayConfiguration, path: string, parameters: Record<string, string>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${configuration.endpoint}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(parameters).toString(),
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Tạo đơn (POST /v2/create): mac = HMAC key1 trên app_id|app_trans_id|app_user|amount|app_time|embed_data|item (QUYTAC_NGHIEPVU_271).
// Trả order_url; ZaloPay từ chối, không trả lời hoặc order_url không phải https thì trả null.
export async function createZalopayOrder(configuration: ZalopayConfiguration, gatewayCode: string, input: PaymentStartInput, preferredPaymentMethods: string[]): Promise<string | null> {
  const transactionId = zalopayTransactionId(input.reference, input.createdAt);
  const appUser = "VComm";
  const appTime = String(input.createdAt.getTime());
  const amount = String(Math.round(input.amount));
  const item = "[]";
  const embedData = JSON.stringify({ redirecturl: zalopayReturnUrl(configuration, gatewayCode), preferred_payment_method: preferredPaymentMethods });
  const result = await postForm(configuration, "/v2/create", {
    app_id: configuration.appId,
    app_trans_id: transactionId,
    app_user: appUser,
    app_time: appTime,
    amount,
    item,
    embed_data: embedData,
    description: `VComm - Thanh toan don ${input.documentNo}`,
    bank_code: "",
    callback_url: zalopayNotifyUrl(configuration, gatewayCode),
    expire_duration_seconds: String(expireDurationSeconds(input)),
    mac: zalopayMac(configuration.requestMacKey, [configuration.appId, transactionId, appUser, amount, appTime, embedData, item].join("|")),
  });
  const orderUrl = result?.order_url;
  return result?.return_code === 1 && typeof orderUrl === "string" && /^https:\/\//.test(orderUrl) ? orderUrl : null;
}

// Kết quả gửi về (POST JSON {data, mac, type}): mac = HMAC key2 trên chuỗi data nguyên bản; ZaloPay chỉ gửi khi đã thu tiền (QUYTAC_NGHIEPVU_272).
export function verifiedZalopayCallback(configuration: ZalopayConfiguration, method: string, body: unknown): GatewayNotification | null {
  if (method !== "POST" || !body || typeof body !== "object") return null;
  const { data, mac, type } = body as Record<string, unknown>;
  if (typeof data !== "string" || !sameMac(zalopayMac(configuration.callbackMacKey, data), mac)) return null;
  // Chỉ nhận kết quả của đơn (type 1), không nhận liên kết tài khoản.
  if (type !== undefined && Number(type) !== 1) return null;
  let fields: Record<string, unknown>;
  try {
    fields = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
  const reference = referenceOf(fields.app_trans_id);
  const amount = Number(fields.amount);
  if (String(fields.app_id) !== configuration.appId || !reference || !Number.isSafeInteger(amount) || amount <= 0) return null;
  const text = (value: unknown, length: number) => (value === undefined || value === null || typeof value === "object" ? null : String(value).slice(0, length));
  return { reference, amount, success: true, responseCode: "1", transactionNo: text(fields.zp_trans_id, 100), bankCode: text(fields.channel, 20) };
}

// Trang trả về: checksum = HMAC key2 trên appid|apptransid|pmcid|bankcode|amount|discountamount|status; status 1 là thành công (QUYTAC_NGHIEPVU_273).
export function verifiedZalopayRedirect(configuration: ZalopayConfiguration, query: Record<string, unknown>): GatewayNotification | null {
  const field = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : "");
  const signed = ["appid", "apptransid", "pmcid", "bankcode", "amount", "discountamount", "status"].map(field).join("|");
  if (!sameMac(zalopayMac(configuration.callbackMacKey, signed), query.checksum)) return null;
  const reference = referenceOf(field("apptransid"));
  if (field("appid") !== configuration.appId || !reference || !/^\d+$/.test(field("amount"))) return null;
  return { reference, amount: Number(field("amount")), success: field("status") === "1", responseCode: field("status"), transactionNo: null, bankCode: field("bankcode") || null };
}

export type ZalopayOrderStatus = { state: "succeeded"; amount: number; transactionNo: string | null } | { state: "failed" | "processing" | "unknown"; returnCode: number | null };

// Tra cứu trạng thái (POST /v2/query, mac = HMAC key1 trên app_id|app_trans_id|key1): 1 thành công, 2 thất bại, 3 đang xử lý (QUYTAC_NGHIEPVU_274).
// Chưa gắn vào luồng ghi nhận tiền: khung chung chưa có chỗ tra cứu.
export async function queryZalopayOrder(configuration: ZalopayConfiguration, reference: string, createdAt: Date): Promise<ZalopayOrderStatus> {
  const transactionId = zalopayTransactionId(reference, createdAt);
  const result = await postForm(configuration, "/v2/query", {
    app_id: configuration.appId,
    app_trans_id: transactionId,
    mac: zalopayMac(configuration.requestMacKey, [configuration.appId, transactionId, configuration.requestMacKey].join("|")),
  });
  const returnCode = typeof result?.return_code === "number" ? result.return_code : null;
  if (returnCode === 1 && Number.isSafeInteger(Number(result!.amount))) {
    return { state: "succeeded", amount: Number(result!.amount), transactionNo: result!.zp_trans_id === undefined ? null : String(result!.zp_trans_id) };
  }
  if (returnCode === 2) return { state: "failed", returnCode };
  if (returnCode === 3) return { state: "processing", returnCode };
  return { state: "unknown", returnCode };
}

// Trả lời ZaloPay luôn HTTP 200: 1 đã nhận (kể cả đã ghi nhận trước đó, để ZaloPay không gửi lại), 2 không nhận, -1 sai chữ ký, 0 lỗi phía VComm để ZaloPay gửi lại (tối đa 3 lần).
export const zalopayReplies: Record<NotificationOutcome, { return_code: number; return_message: string }> = {
  success: { return_code: 1, return_message: "success" },
  already_confirmed: { return_code: 1, return_message: "already confirmed" },
  // ZaloPay chỉ gửi khi đã thu tiền nên không có trạng thái đang xử lý; giữ cho đủ kiểu của khung (CONG_VIEC_33).
  pending: { return_code: 1, return_message: "received" },
  not_found: { return_code: 2, return_message: "order not found" },
  invalid_amount: { return_code: 2, return_message: "invalid amount" },
  invalid_signature: { return_code: -1, return_message: "mac not equal" },
  error: { return_code: 0, return_message: "retry" },
};
