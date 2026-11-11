// Lớp kết nối Apple Pay qua trang thanh toán ZaloPay (CONG_VIEC_41; QUYTAC_NGHIEPVU_265 đến 269): ZaloPay xử lý token Apple Pay, VComm chỉ tạo đơn và nhận kết quả.
// Đặc tả công khai: https://docs.zalopay.vn/docs/specs/order-create, https://docs.zalopay.vn/docs/developer-tools/knowledge-base/callback,
// https://docs.zalopay.vn/docs/guides/payment-acceptance/payment-gateway/intro (trang trả về), https://docs.zalopay.vn/docs/guides/payment-acceptance/applepay/intro.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

// Biến môi trường ZALOPAY_* dùng chung cho mọi phương thức đi qua ZaloPay (Apple Pay CONG_VIEC_41, có thể cả Google Pay CONG_VIEC_40).
export interface ZalopayConfiguration {
  appId: string;
  // key1 ký yêu cầu tạo đơn, key2 kiểm kết quả gửi về và trang trả về (ZaloPay cấp khi đăng ký).
  requestMacKey: string;
  callbackMacKey: string;
  endpoint: string;
  // Địa chỉ công khai của API VComm, ZaloPay gửi kết quả và chuyển người mua về.
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

export const zalopayMac = (macKey: string, input: string) => createHmac("sha256", macKey).update(input, "utf8").digest("hex");

// So sánh chữ ký hex an toàn thời gian.
function sameMac(expected: string, received: unknown): boolean {
  if (typeof received !== "string" || !/^[0-9a-fA-F]{64}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

// app_trans_id phải bắt đầu bằng yymmdd theo giờ Việt Nam (GMT+7), tối đa 40 ký tự.
export function zalopayTransactionId(reference: string, at: Date): string {
  const vietnam = new Date(at.getTime() + 7 * 60 * 60 * 1000);
  const datePart = vietnam.toISOString().slice(2, 10).replace(/-/g, "");
  return `${datePart}_${reference}`;
}

// Số tham chiếu của khung là phần sau dấu gạch dưới đầu tiên.
function referenceOf(transactionId: unknown): string | null {
  if (typeof transactionId !== "string") return null;
  const match = /^\d{6}_([A-Za-z0-9]{1,33})$/.exec(transactionId);
  return match ? match[1]! : null;
}

// Thời hạn đơn trên ZaloPay theo hạn thanh toán của đơn VComm, trong giới hạn ZaloPay cho phép (300 đến 2592000 giây).
const expireDurationSeconds = (input: PaymentStartInput) => Math.min(2592000, Math.max(300, Math.floor((input.expiresAt.getTime() - input.createdAt.getTime()) / 1000)));

// ZaloPay chưa công bố giá trị mở thẳng Apple Pay: để trống thì trang ZaloPay hiện mọi phương thức theo hợp đồng (có Apple Pay).
function preferredPaymentMethods(): string[] {
  return (process.env.ZALOPAY_APPLE_PAY_PREFERRED_METHODS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => /^[a-z0-9_]{1,40}$/.test(item));
}

// return_code: 1 thành công (kể cả đã ghi nhận trước đó để ZaloPay không gửi lại), 2 thất bại, -1 sai chữ ký, 0 để ZaloPay gửi lại (lỗi máy chủ).
const replies: Record<NotificationOutcome, { return_code: number; return_message: string }> = {
  success: { return_code: 1, return_message: "success" },
  already_confirmed: { return_code: 1, return_message: "already confirmed" },
  // ZaloPay chỉ gửi kết quả khi đã thu tiền nên không có trạng thái đang xử lý; giữ cho đủ kiểu của khung (CONG_VIEC_33).
  pending: { return_code: 1, return_message: "received" },
  not_found: { return_code: 2, return_message: "order not found" },
  invalid_amount: { return_code: 2, return_message: "invalid amount" },
  invalid_signature: { return_code: -1, return_message: "mac not equal" },
  error: { return_code: 0, return_message: "retry" },
};

export class ApplePayGateway implements PaymentGatewayAdapter {
  readonly code = "apple_pay" as const;

  configured(): boolean {
    return zalopayConfiguration() !== null;
  }

  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = zalopayConfiguration()!;
    const transactionId = zalopayTransactionId(input.reference, input.createdAt);
    const appUser = "vcomm";
    const appTime = String(input.createdAt.getTime());
    const amount = String(input.amount);
    const item = "[]";
    const embedData = JSON.stringify({ preferred_payment_method: preferredPaymentMethods(), redirecturl: `${configuration.publicApiUrl}/api/v1/public/payments/apple_pay/return` });
    const body = new URLSearchParams({
      app_id: configuration.appId,
      app_user: appUser,
      app_trans_id: transactionId,
      app_time: appTime,
      expire_duration_seconds: String(expireDurationSeconds(input)),
      amount,
      description: `VComm - Thanh toan don ${input.documentNo}`,
      callback_url: `${configuration.publicApiUrl}/api/v1/public/payments/apple_pay/notify`,
      item,
      embed_data: embedData,
      bank_code: "",
      mac: zalopayMac(configuration.requestMacKey, [configuration.appId, transactionId, appUser, amount, appTime, embedData, item].join("|")),
    });
    const response = await fetch(`${configuration.endpoint}/v2/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const result = (await response.json().catch(() => null)) as { return_code?: number; sub_return_code?: number; order_url?: string } | null;
    // Không ghi khóa hay nội dung đơn vào thông báo lỗi; giao dịch mở thanh toán quay lui.
    if (!response.ok || result?.return_code !== 1 || typeof result.order_url !== "string" || !/^https:\/\//.test(result.order_url)) {
      throw new Error(`ZaloPay không tạo được đơn (HTTP ${response.status}, return_code ${result?.return_code ?? "?"}, sub_return_code ${result?.sub_return_code ?? "?"})`);
    }
    return { kind: "redirect", url: result.order_url };
  }

  // Kết quả ZaloPay gửi về (POST JSON {data, mac, type}): mac = HMAC-SHA256(key2, data); ZaloPay chỉ gửi khi đã thu tiền.
  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = zalopayConfiguration();
    const body = request.body as { data?: unknown; mac?: unknown; type?: unknown } | null;
    if (!configuration || request.method !== "POST" || !body || typeof body.data !== "string") return null;
    if (!sameMac(zalopayMac(configuration.callbackMacKey, body.data), body.mac)) return null;
    // Chỉ nhận kết quả của đơn (type 1), không nhận liên kết tài khoản.
    if (body.type !== undefined && Number(body.type) !== 1) return null;
    const data = JSON.parse(body.data) as { app_id?: unknown; app_trans_id?: unknown; amount?: unknown; zp_trans_id?: unknown; channel?: unknown };
    const reference = referenceOf(data.app_trans_id);
    if (!reference || String(data.app_id) !== configuration.appId || typeof data.amount !== "number" || !Number.isFinite(data.amount)) return null;
    return {
      reference,
      amount: data.amount,
      success: true,
      responseCode: "1",
      transactionNo: data.zp_trans_id === undefined || data.zp_trans_id === null ? null : String(data.zp_trans_id).slice(0, 100),
      bankCode: data.channel === undefined || data.channel === null ? null : String(data.channel).slice(0, 20),
    };
  }

  // Trang trả về: checksum = HMAC(key2, appid|apptransid|pmcid|bankcode|amount|discountamount|status); chỉ hiển thị, không ghi nhận tiền.
  async verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = zalopayConfiguration();
    if (!configuration) return null;
    const query = request.query;
    const field = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : "");
    const fields = ["appid", "apptransid", "pmcid", "bankcode", "amount", "discountamount", "status"].map(field);
    if (!sameMac(zalopayMac(configuration.callbackMacKey, fields.join("|")), query.checksum)) return null;
    const reference = referenceOf(field("apptransid"));
    const amount = Number(field("amount"));
    if (!reference || field("appid") !== configuration.appId || !Number.isFinite(amount)) return null;
    return { reference, amount, success: field("status") === "1", responseCode: field("status"), transactionNo: null, bankCode: field("bankcode") || null };
  }

  // ZaloPay nhận HTTP 200 kèm return_code.
  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return { status: 200, body: replies[outcome] };
  }
}
