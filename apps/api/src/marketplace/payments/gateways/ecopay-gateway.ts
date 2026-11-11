// Lớp kết nối cổng Ecopay của Finviet theo khung nhiều cổng (CONG_VIEC_38; QUYTAC_NGHIEPVU_250 đến 254).
// Chưa có tài liệu chính thức công khai: định dạng ký, đường dẫn API lấy từ hai SDK mã nguồn mở trên GitHub (tonleGit/ecopay-sdk, shinxz12/finviet-ecopay), hai nguồn khớp nhau.
// Vì vậy kết quả gửi về đúng chữ ký vẫn hỏi lại trạng thái giao dịch trên Ecopay trước khi ghi nhận tiền. Phải thử với môi trường thử nghiệm của Finviet trước khi phát hành.
import type { PaymentMethodCode } from "contracts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../../../common/api-error";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface EcopayConfiguration {
  apiUrl: string;
  merchantCode: string;
  signingSecret: string;
  storeCode: string;
  terminalCode: string;
  // Địa chỉ công khai của API + /api/v1/public/payments/ecopay/return, Ecopay chuyển người mua về sau khi trả tiền.
  returnUrl: string;
}

// ECOPAY_API_URL mặc định là môi trường thử nghiệm của Finviet.
export function ecopayConfiguration(): EcopayConfiguration | null {
  const merchantCode = process.env.ECOPAY_MERCHANT_CODE?.trim();
  const signingSecret = process.env.ECOPAY_SECRET_KEY?.trim();
  const storeCode = process.env.ECOPAY_STORE_CODE?.trim();
  const terminalCode = process.env.ECOPAY_TERMINAL_CODE?.trim();
  const returnUrl = process.env.ECOPAY_RETURN_URL?.trim();
  if (!merchantCode || !signingSecret || !storeCode || !terminalCode || !returnUrl) return null;
  const apiUrl = (process.env.ECOPAY_API_URL?.trim() || "https://mgw-test.finviet.com.vn:6868").replace(/\/+$/, "");
  return { apiUrl, merchantCode, signingSecret, storeCode, terminalCode, returnUrl };
}

// Kênh thanh toán của Ecopay theo phương thức (QUYTAC_NGHIEPVU_250).
const channels: Partial<Record<PaymentMethodCode, { payment_channel: string; bank_type?: string }>> = {
  ecopay_wallet: { payment_channel: "eco" },
  ecopay_atm: { payment_channel: "atm", bank_type: "domestic" },
};

// Chữ ký Ecopay (QUYTAC_NGHIEPVU_251): bỏ trường chữ ký và giá trị rỗng, sắp tên trường theo thứ tự chữ cái, nối giá trị liền nhau, HMAC SHA256 dạng hex chữ thường.
export function ecopaySignature(fields: Record<string, unknown>, signingSecret: string): string {
  const content = Object.keys(fields)
    .filter((name) => name !== "signature" && name !== "Signature" && fields[name] !== null && fields[name] !== undefined)
    .sort()
    .map((name) => (typeof fields[name] === "object" ? JSON.stringify(fields[name]) : String(fields[name])))
    .join("");
  return createHmac("sha256", signingSecret).update(content, "utf8").digest("hex");
}

function sameSignature(received: unknown, expected: string): boolean {
  if (typeof received !== "string") return false;
  const receivedBuffer = Buffer.from(received.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

// Hai SDK khác nhau ở trường dạng đối tượng (bỏ qua, hoặc ghép chuỗi JSON): chấp nhận chữ ký đúng theo một trong hai cách.
function signatureMatches(fields: Record<string, unknown>, received: unknown, signingSecret: string): boolean {
  const scalarFields = Object.fromEntries(Object.entries(fields).filter(([, value]) => typeof value !== "object"));
  return sameSignature(received, ecopaySignature(scalarFields, signingSecret)) || sameSignature(received, ecopaySignature(fields, signingSecret));
}

const asRecord = (value: unknown): Record<string, unknown> | null => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const asAmount = (value: unknown): number | null => (typeof value === "number" || (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) ? Number(value) : null);

// Gửi yêu cầu có ký tới Ecopay; trả phần data khi Ecopay báo thành công và chữ ký phần data đúng.
async function signedCall(configuration: EcopayConfiguration, path: string, fields: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const body = { ...fields, merchant_code: configuration.merchantCode, req_time: Date.now() };
  const response = await fetch(`${configuration.apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...body, signature: ecopaySignature(body, configuration.signingSecret) }),
    signal: AbortSignal.timeout(15_000),
  });
  const answer = asRecord(await response.json().catch(() => null));
  const data = asRecord(answer?.data);
  if (!response.ok || !answer || answer.message_key !== "SUCCESS" || !data) return null;
  return signatureMatches(data, answer.signature, configuration.signingSecret) ? data : null;
}

// Trạng thái cuối của giao dịch: thành công, hoặc thất bại; trạng thái khác (đang xử lý) báo đang chờ, không đổi lần thanh toán (QUYTAC_NGHIEPVU_252).
const failedStatuses = new Set(["failed", "cancelled", "timeout"]);

// Câu trả lời cho Ecopay (QUYTAC_NGHIEPVU_253): result_code "00" là đã nhận; lỗi máy chủ trả HTTP 500 để Ecopay gửi lại.
const replies: Record<NotificationOutcome, { status: number; body: { result_code: string; message: string } }> = {
  success: { status: 200, body: { result_code: "00", message: "Success" } },
  pending: { status: 200, body: { result_code: "00", message: "Pending" } },
  already_confirmed: { status: 200, body: { result_code: "00", message: "Already confirmed" } },
  not_found: { status: 200, body: { result_code: "01", message: "Order not found" } },
  invalid_amount: { status: 200, body: { result_code: "02", message: "Invalid amount" } },
  invalid_signature: { status: 400, body: { result_code: "97", message: "Invalid signature" } },
  error: { status: 500, body: { result_code: "99", message: "Unknown error" } },
};

export class EcopayGateway implements PaymentGatewayAdapter {
  readonly code = "ecopay" as const;

  configured(): boolean {
    return ecopayConfiguration() !== null;
  }

  // Mở thanh toán (QUYTAC_NGHIEPVU_251): Ecopay trả trang thanh toán; lỗi kết nối hoặc sai chữ ký thì báo phương thức tạm không dùng được.
  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = ecopayConfiguration()!;
    const channel = channels[input.method];
    if (!channel) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    const data = await signedCall(configuration, "/api/v1/payment/init", {
      platform: "web",
      ...channel,
      store_code: configuration.storeCode,
      terminal_code: configuration.terminalCode,
      merchant_order_id: input.reference,
      amount: input.amount,
      currency: "VND",
      description: `Thanh toan don ${input.documentNo}`,
      redirect_url: configuration.returnUrl,
    }).catch(() => null);
    const url = typeof data?.payment_url === "string" ? data.payment_url : "";
    if (!/^https?:\/\//.test(url)) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    return { kind: "redirect", url };
  }

  // Kết quả Ecopay gửi về (QUYTAC_NGHIEPVU_252): kiểm chữ ký, mã đơn vị; hỏi lại trạng thái giao dịch, số tiền phải khớp kết quả gửi về.
  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = ecopayConfiguration();
    const body = asRecord(request.body);
    if (!configuration || !body || !signatureMatches(body, body.signature, configuration.signingSecret)) return null;
    const reference = body.merchant_order_id;
    const amount = asAmount(body.amount);
    if (body.merchant_code !== configuration.merchantCode || typeof reference !== "string" || !reference || amount === null) return null;
    const transaction = await signedCall(configuration, "/api/v1/payment/checktrans", { merchant_order_id: reference });
    if (!transaction || transaction.merchant_order_id !== reference || asAmount(transaction.amount) !== amount || transaction.status !== body.status) return null;
    const status = String(transaction.status);
    return {
      reference,
      amount,
      success: status === "success",
      pending: status !== "success" && !failedStatuses.has(status),
      responseCode: status,
      transactionNo: typeof body.fv_transid === "string" ? body.fv_transid : null,
      bankCode: typeof body.bank_code === "string" && body.bank_code ? body.bank_code : null,
    };
  }

  // Trang trả về (QUYTAC_NGHIEPVU_254): Ecopay gửi order_id, fv_payment_transid, status, ts kèm Signature; chỉ để hiển thị, không có số tiền.
  async verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = ecopayConfiguration();
    if (!configuration) return null;
    const fields: Record<string, string> = {};
    for (const [name, value] of Object.entries(request.query)) if (typeof value === "string") fields[name] = value;
    const received = fields.Signature ?? fields.signature;
    if (!signatureMatches(fields, received, configuration.signingSecret) || !fields.order_id) return null;
    const status = fields.status ?? "";
    return {
      reference: fields.order_id,
      amount: 0,
      success: status === "success",
      pending: status !== "success" && !failedStatuses.has(status),
      responseCode: status,
      transactionNo: fields.fv_payment_transid ?? null,
      bankCode: null,
    };
  }

  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return replies[outcome];
  }
}
