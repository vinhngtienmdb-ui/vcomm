// Lớp kết nối Google Pay theo khung nhiều cổng (CONG_VIEC_40; QUYTAC_NGHIEPVU_260 đến 264).
// Google Pay không tự thu tiền: VComm tạo đơn trên cổng ZaloPay, người mua trả bằng thẻ trong Google Pay trên trang thanh toán của ZaloPay
// (ZaloPay chỉ nhận Google Pay qua trang thanh toán của mình). VComm không nhận, không lưu token thẻ.
// Tài liệu ZaloPay: docs.zalopay.vn/docs/specs/order-create, docs/specs/callback-api, docs/guides/payment-acceptance/googlepay/intro.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface GooglePayConfiguration {
  // Mã ứng dụng ZaloPay cấp (app_id).
  applicationId: string;
  // Khóa ký yêu cầu gửi ZaloPay (key1).
  requestSigningValue: string;
  // Khóa kiểm kết quả ZaloPay gửi về và trang trả về (key2).
  callbackSigningValue: string;
  // Địa chỉ API ZaloPay, mặc định môi trường thử nghiệm.
  apiUrl: string;
  // Địa chỉ công khai của API VComm, ghép đường dẫn nhận kết quả và trang trả về.
  publicApiUrl: string;
  // Nhóm phương thức hiện trên trang ZaloPay (preferred_payment_method), mặc định thẻ quốc tế (có Google Pay).
  preferredMethod: string;
}

export function googlePayConfiguration(): GooglePayConfiguration | null {
  const applicationId = process.env.GOOGLE_PAY_ZALOPAY_APP_ID?.trim();
  const requestSigningValue = process.env.GOOGLE_PAY_ZALOPAY_MAC_KEY?.trim();
  const callbackSigningValue = process.env.GOOGLE_PAY_ZALOPAY_CALLBACK_KEY?.trim();
  const publicApiUrl = process.env.GOOGLE_PAY_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!applicationId || !/^\d+$/.test(applicationId) || !requestSigningValue || !callbackSigningValue || !publicApiUrl) return null;
  return {
    applicationId,
    requestSigningValue,
    callbackSigningValue,
    apiUrl: (process.env.GOOGLE_PAY_ZALOPAY_API_URL?.trim() || "https://sb-openapi.zalopay.vn/v2").replace(/\/+$/, ""),
    publicApiUrl,
    preferredMethod: process.env.GOOGLE_PAY_ZALOPAY_PREFERRED_METHOD?.trim() || "international_card",
  };
}

export function zalopaySignature(signingValue: string, input: string): string {
  return createHmac("sha256", signingValue).update(input, "utf8").digest("hex");
}

function signatureMatches(expected: string, received: unknown): boolean {
  if (typeof received !== "string" || !/^[0-9a-fA-F]{64}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}

// Mã giao dịch ZaloPay (app_trans_id) bắt đầu bằng ngày theo giờ Việt Nam yymmdd, tối đa 40 ký tự.
export function zalopayTransactionId(reference: string, createdAt: Date): string {
  const vietnamTime = new Date(createdAt.getTime() + 7 * 60 * 60 * 1000).toISOString();
  return `${vietnamTime.slice(2, 4)}${vietnamTime.slice(5, 7)}${vietnamTime.slice(8, 10)}_${reference}`;
}

function referenceOf(transactionId: unknown): string | null {
  if (typeof transactionId !== "string") return null;
  const matched = /^\d{6}_([A-Za-z0-9]{1,33})$/.exec(transactionId);
  return matched ? matched[1]! : null;
}

// ZaloPay luôn nhận HTTP 200: 1 đã nhận (kể cả đã ghi nhận trước đó), 2 không hợp lệ, 0 lỗi tạm thời để ZaloPay gửi lại.
const replies: Record<NotificationOutcome, { return_code: number; return_message: string }> = {
  success: { return_code: 1, return_message: "success" },
  already_confirmed: { return_code: 1, return_message: "already confirmed" },
  // ZaloPay không gửi trạng thái đang xử lý; có thì xác nhận đã nhận.
  pending: { return_code: 1, return_message: "received" },
  not_found: { return_code: 2, return_message: "order not found" },
  invalid_amount: { return_code: 2, return_message: "invalid amount" },
  invalid_signature: { return_code: 2, return_message: "mac not equal" },
  error: { return_code: 0, return_message: "error" },
};

export class GooglePayGateway implements PaymentGatewayAdapter {
  readonly code = "google_pay" as const;

  configured(): boolean {
    return googlePayConfiguration() !== null;
  }

  // Tạo đơn trên ZaloPay (POST {apiUrl}/create), trả trang thanh toán order_url.
  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = googlePayConfiguration()!;
    const transactionId = zalopayTransactionId(input.reference, input.createdAt);
    const applicationTime = String(input.createdAt.getTime());
    const applicationUser = "VComm";
    const amount = String(input.amount);
    const embedData = JSON.stringify({ preferred_payment_method: [configuration.preferredMethod], redirecturl: `${configuration.publicApiUrl}/api/v1/public/payments/google_pay/return` });
    const item = "[]";
    const remainingSeconds = Math.floor((input.expiresAt.getTime() - input.createdAt.getTime()) / 1000);
    const fields: Record<string, string> = {
      app_id: configuration.applicationId,
      app_trans_id: transactionId,
      app_user: applicationUser,
      app_time: applicationTime,
      amount,
      item,
      embed_data: embedData,
      description: `VComm - Thanh toan don ${input.documentNo}`.slice(0, 256),
      bank_code: "",
      callback_url: `${configuration.publicApiUrl}/api/v1/public/payments/google_pay/notify`,
      expire_duration_seconds: String(Math.min(2592000, Math.max(300, remainingSeconds))),
    };
    fields.mac = zalopaySignature(configuration.requestSigningValue, [configuration.applicationId, transactionId, applicationUser, amount, applicationTime, embedData, item].join("|"));
    const response = await fetch(`${configuration.apiUrl}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(15000),
    });
    const result = (await response.json().catch(() => null)) as { return_code?: number; order_url?: string; sub_return_code?: number } | null;
    if (!response.ok || result?.return_code !== 1 || typeof result.order_url !== "string" || !result.order_url.startsWith("https://")) {
      throw new Error(`ZaloPay tạo đơn không thành công: HTTP ${response.status}, mã ${result?.return_code ?? "?"}/${result?.sub_return_code ?? "?"}`);
    }
    return { kind: "redirect", url: result.order_url };
  }

  // Kết quả ZaloPay gửi về (chỉ khi thanh toán thành công): POST JSON {data, mac, type}, mac = HMAC-SHA256(key2, data).
  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = googlePayConfiguration();
    if (!configuration || request.method !== "POST") return null;
    const body = request.body as { data?: unknown; mac?: unknown; type?: unknown } | null;
    if (!body || typeof body.data !== "string" || body.data.length > 8192) return null;
    if (!signatureMatches(zalopaySignature(configuration.callbackSigningValue, body.data), body.mac)) return null;
    const data = JSON.parse(body.data) as { app_id?: unknown; app_trans_id?: unknown; amount?: unknown; zp_trans_id?: unknown; channel?: unknown };
    const reference = referenceOf(data.app_trans_id);
    if (String(data.app_id) !== configuration.applicationId || !reference || typeof data.amount !== "number" || !Number.isFinite(data.amount)) return null;
    return {
      reference,
      amount: data.amount,
      // ZaloPay chỉ gửi kết quả khi người mua đã trả tiền thành công (type 1 là đơn hàng).
      success: true,
      responseCode: "1",
      transactionNo: data.zp_trans_id === undefined || data.zp_trans_id === null ? null : String(data.zp_trans_id).slice(0, 50),
      bankCode: data.channel === undefined || data.channel === null ? null : String(data.channel).slice(0, 20),
    };
  }

  // Trang trả về: checksum = HMAC-SHA256(key2, appid|apptransid|pmcid|bankcode|amount|discountamount|status); status 1 là thành công.
  async verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = googlePayConfiguration();
    if (!configuration) return null;
    const query = request.query;
    const names = ["appid", "apptransid", "pmcid", "bankcode", "amount", "discountamount", "status"] as const;
    const values = names.map((name) => (typeof query[name] === "string" ? (query[name] as string) : ""));
    if (!signatureMatches(zalopaySignature(configuration.callbackSigningValue, values.join("|")), query.checksum)) return null;
    const reference = referenceOf(query.apptransid);
    if (values[0] !== configuration.applicationId || !reference) return null;
    return { reference, amount: Number(values[4]), success: values[6] === "1", responseCode: values[6]!, transactionNo: null, bankCode: values[3] || null };
  }

  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return { status: 200, body: replies[outcome] };
  }
}
