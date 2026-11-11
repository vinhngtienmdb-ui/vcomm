// Lớp kết nối ZaloPay theo khung nhiều cổng (CONG_VIEC_32, CONG_VIEC_42; QUYTAC_NGHIEPVU_270 đến 274), theo tài liệu công khai docs.zalopay.vn (API v2).
// Tạo đơn ký HMAC SHA256 bằng key1; kết quả gửi về (callback) và trang trả về ký bằng key2. Chưa thử với môi trường thử nghiệm của ZaloPay; phải thử trước khi phát hành.
import type { PaymentMethodCode } from "contracts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../../../common/api-error";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface ZalopayConfiguration {
  apiUrl: string;
  appId: string;
  // Khóa ký yêu cầu VComm gửi ZaloPay (key1) và khóa kiểm kết quả ZaloPay gửi về (key2).
  requestMacKey: string;
  callbackMacKey: string;
  callbackUrl: string;
  returnUrl: string;
}

// ZALOPAY_API_URL mặc định là môi trường thử nghiệm của ZaloPay.
export function zalopayConfiguration(): ZalopayConfiguration | null {
  const appId = process.env.ZALOPAY_APP_ID?.trim();
  const requestMacKey = process.env.ZALOPAY_KEY1?.trim();
  const callbackMacKey = process.env.ZALOPAY_KEY2?.trim();
  const callbackUrl = process.env.ZALOPAY_CALLBACK_URL?.trim();
  const returnUrl = process.env.ZALOPAY_RETURN_URL?.trim();
  if (!appId || !/^\d+$/.test(appId) || !requestMacKey || !callbackMacKey || !callbackUrl || !returnUrl) return null;
  const apiUrl = (process.env.ZALOPAY_API_URL?.trim() || "https://sb-openapi.zalopay.vn").replace(/\/+$/, "");
  return { apiUrl, appId, requestMacKey, callbackMacKey, callbackUrl, returnUrl };
}

// Phương thức người mua đã chọn mở thẳng trang tương ứng của ZaloPay (embed_data.preferred_payment_method).
const preferredMethods: Partial<Record<PaymentMethodCode, string[]>> = {
  zalopay_wallet: ["zalopay_wallet"],
  zalopay_atm: ["domestic_card", "account"],
  zalopay_card: ["international_card"],
};

// Thời hạn đơn ZaloPay cho phép: 300 giây đến 30 ngày.
const minimumExpireSeconds = 300;
const maximumExpireSeconds = 2_592_000;
const requestTimeoutMilliseconds = 10_000;

export const zalopayMac = (macKey: string, value: string) => createHmac("sha256", macKey).update(value, "utf8").digest("hex");

function sameMac(received: unknown, expected: string): boolean {
  if (typeof received !== "string") return false;
  const receivedBuffer = Buffer.from(received.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

// Mã giao dịch gửi ZaloPay: ngày yymmdd theo giờ Việt Nam, gạch dưới, số tham chiếu (QUYTAC_NGHIEPVU_271).
export function zalopayTransactionId(reference: string, createdAt: Date): string {
  const local = new Date(createdAt.getTime() + 7 * 3_600_000).toISOString();
  return `${local.slice(2, 4)}${local.slice(5, 7)}${local.slice(8, 10)}_${reference}`;
}

// Số tham chiếu từ mã giao dịch ZaloPay; sai định dạng trả null.
export function referenceOf(transactionId: unknown): string | null {
  if (typeof transactionId !== "string") return null;
  const match = /^\d{6}_([A-Za-z0-9]{1,33})$/.exec(transactionId);
  return match ? match[1]! : null;
}

async function postForm(configuration: ZalopayConfiguration, path: string, parameters: Record<string, string>): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${configuration.apiUrl}${path}`, {
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

// Tạo đơn trên ZaloPay (POST /v2/create): trả trang thanh toán order_url; ZaloPay từ chối hoặc không trả lời thì báo phương thức tạm không dùng được.
export async function createOrder(configuration: ZalopayConfiguration, input: PaymentStartInput): Promise<string> {
  const appTime = String(input.createdAt.getTime());
  const transactionId = zalopayTransactionId(input.reference, input.createdAt);
  const embedData = JSON.stringify({ redirecturl: configuration.returnUrl, preferred_payment_method: preferredMethods[input.method] ?? [] });
  const item = "[]";
  const appUser = "VComm";
  const amount = String(Math.round(input.amount));
  const remainingSeconds = Math.floor((input.expiresAt.getTime() - input.createdAt.getTime()) / 1000);
  const expireSeconds = Math.min(maximumExpireSeconds, Math.max(minimumExpireSeconds, remainingSeconds));
  const parameters: Record<string, string> = {
    app_id: configuration.appId,
    app_trans_id: transactionId,
    app_user: appUser,
    app_time: appTime,
    amount,
    item,
    embed_data: embedData,
    description: `VComm - Thanh toan don ${input.documentNo}`,
    bank_code: "",
    callback_url: configuration.callbackUrl,
    expire_duration_seconds: String(expireSeconds),
  };
  parameters.mac = zalopayMac(configuration.requestMacKey, [configuration.appId, transactionId, appUser, amount, appTime, embedData, item].join("|"));
  const result = await postForm(configuration, "/v2/create", parameters);
  const orderUrl = result?.order_url;
  if (result?.return_code !== 1 || typeof orderUrl !== "string" || !/^https:\/\//.test(orderUrl)) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
  return orderUrl;
}

// Kết quả ZaloPay gửi về (POST JSON {data, mac, type}): mac là HMAC key2 trên chuỗi data nguyên bản; ZaloPay chỉ gửi khi thanh toán thành công (QUYTAC_NGHIEPVU_272).
export function verifiedCallback(configuration: ZalopayConfiguration, body: unknown): GatewayNotification | null {
  if (!body || typeof body !== "object") return null;
  const { data, mac, type } = body as Record<string, unknown>;
  if (typeof data !== "string" || !sameMac(mac, zalopayMac(configuration.callbackMacKey, data))) return null;
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
  const transactionNo = fields.zp_trans_id === undefined || fields.zp_trans_id === null ? null : String(fields.zp_trans_id).slice(0, 50);
  return {
    reference,
    amount,
    success: true,
    responseCode: "1",
    transactionNo,
    bankCode: typeof fields.channel === "number" || typeof fields.channel === "string" ? String(fields.channel).slice(0, 20) : null,
  };
}

// Trang ZaloPay chuyển người mua về: checksum là HMAC key2 trên appid|apptransid|pmcid|bankcode|amount|discountamount|status (QUYTAC_NGHIEPVU_273).
export function verifiedRedirect(configuration: ZalopayConfiguration, query: Record<string, unknown>): GatewayNotification | null {
  const text = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : "");
  const signed = ["appid", "apptransid", "pmcid", "bankcode", "amount", "discountamount", "status"].map(text).join("|");
  if (!sameMac(query.checksum, zalopayMac(configuration.callbackMacKey, signed))) return null;
  const reference = referenceOf(text("apptransid"));
  if (text("appid") !== configuration.appId || !reference || !/^\d+$/.test(text("amount"))) return null;
  return { reference, amount: Number(text("amount")), success: text("status") === "1", responseCode: text("status"), transactionNo: null, bankCode: text("bankcode") || null };
}

export type ZalopayOrderStatus = { state: "succeeded"; amount: number; transactionNo: string | null } | { state: "failed" | "processing" | "unknown"; returnCode: number | null };

// Tra cứu trạng thái đơn (POST /v2/query, mac key1 trên app_id|app_trans_id|key1) (QUYTAC_NGHIEPVU_274). Chưa gắn vào luồng ghi nhận tiền: khung chung chưa có chỗ tra cứu.
export async function queryOrder(configuration: ZalopayConfiguration, reference: string, createdAt: Date): Promise<ZalopayOrderStatus> {
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

// Trả lời ZaloPay luôn HTTP 200: 1 thành công, 2 đã ghi nhận hoặc không nhận, -1 sai chữ ký, 0 lỗi phía VComm để ZaloPay gửi lại (tối đa 3 lần).
const replies: Record<NotificationOutcome, { return_code: number; return_message: string }> = {
  success: { return_code: 1, return_message: "success" },
  already_confirmed: { return_code: 2, return_message: "already confirmed" },
  not_found: { return_code: 2, return_message: "order not found" },
  invalid_amount: { return_code: 2, return_message: "invalid amount" },
  invalid_signature: { return_code: -1, return_message: "mac not equal" },
  error: { return_code: 0, return_message: "error" },
};

export class ZalopayGateway implements PaymentGatewayAdapter {
  readonly code = "zalopay" as const;

  configured(): boolean {
    return zalopayConfiguration() !== null;
  }

  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    return { kind: "redirect", url: await createOrder(zalopayConfiguration()!, input) };
  }

  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = zalopayConfiguration();
    return configuration && request.method === "POST" ? verifiedCallback(configuration, request.body) : null;
  }

  async verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = zalopayConfiguration();
    return configuration ? verifiedRedirect(configuration, request.query) : null;
  }

  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return { status: 200, body: replies[outcome] };
  }
}
