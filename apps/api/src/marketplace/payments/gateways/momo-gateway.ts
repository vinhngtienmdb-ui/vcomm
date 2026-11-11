// Lớp kết nối MoMo (CONG_VIEC_33; QUYTAC_NGHIEPVU_225 đến 227) theo tài liệu công khai MoMo phiên bản 3: tạo thanh toán `POST /v2/gateway/api/create`,
// ký HMAC SHA256 chuỗi `key=value` sắp theo tên trường; kết quả gửi về qua IPN (POST JSON) và trang trả về (GET) cùng định dạng ký.
// Chưa thử với môi trường thử nghiệm của MoMo; phải thử trước khi phát hành.
import { Logger } from "@nestjs/common";
import type { PaymentMethodCode } from "contracts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "../../../common/api-error";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface MomoConfiguration {
  endpoint: string;
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  ipnUrl: string;
  returnUrl: string;
}

// MOMO_ENDPOINT mặc định là môi trường thử nghiệm của MoMo.
export function momoConfiguration(): MomoConfiguration | null {
  const partnerCode = process.env.MOMO_PARTNER_CODE?.trim();
  const accessKey = process.env.MOMO_ACCESS_KEY?.trim();
  const secretKey = process.env.MOMO_SECRET_KEY?.trim();
  const ipnUrl = process.env.MOMO_IPN_URL?.trim();
  const returnUrl = process.env.MOMO_RETURN_URL?.trim();
  if (!partnerCode || !accessKey || !secretKey || !ipnUrl || !returnUrl) return null;
  const endpoint = (process.env.MOMO_ENDPOINT?.trim() || "https://test-payment.momo.vn").replace(/\/+$/, "");
  return { endpoint, partnerCode, accessKey, secretKey, ipnUrl, returnUrl };
}

// Loại thanh toán gửi MoMo và hạn mức số tiền (đồng) của từng phương thức theo tài liệu MoMo (QUYTAC_NGHIEPVU_226).
export const momoMethods: Partial<Record<PaymentMethodCode, { requestType: string; minimum: number; maximum: number }>> = {
  momo_wallet: { requestType: "captureWallet", minimum: 1_000, maximum: 50_000_000 },
  momo_atm: { requestType: "payWithATM", minimum: 10_000, maximum: 50_000_000 },
  momo_card: { requestType: "payWithCC", minimum: 1_000, maximum: 10_000_000 },
};

const createFields = ["accessKey", "amount", "extraData", "ipnUrl", "orderId", "orderInfo", "partnerCode", "redirectUrl", "requestId", "requestType"];
const resultFields = ["accessKey", "amount", "extraData", "message", "orderId", "orderInfo", "orderType", "partnerCode", "payType", "requestId", "responseTime", "resultCode", "transId"];
// Thẻ quốc tế: kết quả có thêm `callbackToken`, `partnerClientId`; câu trả lời IPN có chữ ký.
const cardResultFields = [
  "accessKey",
  "amount",
  "callbackToken",
  "extraData",
  "message",
  "orderId",
  "orderInfo",
  "orderType",
  "partnerClientId",
  "partnerCode",
  "payType",
  "requestId",
  "responseTime",
  "resultCode",
  "transId",
];
const cardReplyFields = ["accessKey", "extraData", "message", "orderId", "partnerCode", "requestId", "responseTime", "resultCode"];

// 0: thành công; 9000: đã cấp phép, thanh toán một bước coi là thành công. 1000, 7000, 7002: đang xử lý, chờ kết quả cuối (QUYTAC_NGHIEPVU_227).
const successCodes = new Set(["0", "9000"]);
const pendingCodes = new Set(["1000", "7000", "7002"]);

export function momoSignature(fields: readonly string[], values: Record<string, string>, secretKey: string): string {
  const text = fields.map((field) => `${field}=${values[field] ?? ""}`).join("&");
  return createHmac("sha256", secretKey).update(text, "utf8").digest("hex");
}

// Giờ Việt Nam dạng YYYY-MM-DD HH:mm:ss (câu trả lời IPN thẻ quốc tế).
const vietnamTime = (value: Date) => new Date(value.getTime() + 7 * 3_600_000).toISOString().slice(0, 19).replace("T", " ");

// Kiểm chữ ký kết quả MoMo gửi về (IPN, trang trả về); sai chữ ký, sai mã đối tác hoặc thiếu trường trả về null.
export function verifiedMomoResult(configuration: MomoConfiguration, source: unknown): GatewayNotification | null {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string") values[key] = value;
    else if (typeof value === "number" && Number.isSafeInteger(value)) values[key] = String(value);
  }
  // Tài liệu MoMo ghi cả `partnerClientid` và `partnerClientId`.
  if (values.partnerClientId === undefined && values.partnerClientid !== undefined) values.partnerClientId = values.partnerClientid;
  const received = values.signature ?? "";
  if (!values.orderId || !values.requestId || !/^\d+$/.test(values.amount ?? "") || !/^-?\d+$/.test(values.resultCode ?? "")) return null;
  const card = values.callbackToken !== undefined;
  const expected = momoSignature(card ? cardResultFields : resultFields, { ...values, accessKey: configuration.accessKey }, configuration.secretKey);
  const receivedBuffer = Buffer.from(received.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  if (values.partnerCode !== configuration.partnerCode) return null;
  const resultCode = values.resultCode!;
  return {
    reference: values.orderId,
    amount: Number(values.amount),
    success: successCodes.has(resultCode),
    pending: pendingCodes.has(resultCode),
    responseCode: resultCode,
    transactionNo: values.transId || null,
    bankCode: values.payType || null,
    ...(card ? { replyContext: { orderId: values.orderId, requestId: values.requestId, extraData: values.extraData ?? "" } } : {}),
  };
}

// Mã kết quả gửi lại MoMo trong câu trả lời có chữ ký (thẻ quốc tế), theo bảng mã của MoMo.
const cardReplyCodes: Record<NotificationOutcome, { resultCode: number; message: string }> = {
  success: { resultCode: 0, message: "Successful." },
  pending: { resultCode: 0, message: "Received." },
  already_confirmed: { resultCode: 0, message: "Successful." },
  not_found: { resultCode: 42, message: "Invalid orderId or orderId is not found." },
  invalid_amount: { resultCode: 21, message: "Invalid transaction amount." },
  invalid_signature: { resultCode: 20, message: "Bad format request." },
  error: { resultCode: 99, message: "Unknown error." },
};

// Số điện thoại E.164 (+84...) đổi về dạng trong nước như ví dụ của MoMo.
const localPhone = (phone: string | null) => (phone?.startsWith("+84") ? `0${phone.slice(3)}` : phone);

export class MomoGateway implements PaymentGatewayAdapter {
  readonly code = "momo" as const;
  private readonly logger = new Logger("MomoGateway");

  configured(): boolean {
    return momoConfiguration() !== null;
  }

  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = momoConfiguration()!;
    const method = momoMethods[input.method];
    if (!method) throw new ApiError("BUSINESS_RULE", "paymentGatewayStartFailed");
    if (input.amount < method.minimum || input.amount > method.maximum) throw new ApiError("BUSINESS_RULE", "paymentAmountOutOfRange");
    const email = input.buyer?.email?.trim();
    // MoMo bắt buộc email người mua khi thanh toán thẻ quốc tế (QUYTAC_NGHIEPVU_226).
    if (input.method === "momo_card" && !email) throw new ApiError("BUSINESS_RULE", "paymentEmailRequired");
    const values: Record<string, string> = {
      accessKey: configuration.accessKey,
      amount: String(input.amount),
      extraData: "",
      ipnUrl: configuration.ipnUrl,
      // orderId, requestId là số tham chiếu của lần thanh toán: gửi lại sau khi mất kết nối được MoMo trả cùng kết quả (idempotency).
      orderId: input.reference,
      orderInfo: `Thanh toan don ${input.documentNo}`,
      partnerCode: configuration.partnerCode,
      redirectUrl: configuration.returnUrl,
      requestId: input.reference,
      requestType: method.requestType,
    };
    const body = {
      partnerCode: values.partnerCode,
      requestType: values.requestType,
      ipnUrl: values.ipnUrl,
      redirectUrl: values.redirectUrl,
      orderId: values.orderId,
      amount: input.amount,
      orderInfo: values.orderInfo,
      requestId: values.requestId,
      extraData: values.extraData,
      lang: "vi",
      signature: momoSignature(createFields, values, configuration.secretKey),
      ...(input.method === "momo_card" ? { userInfo: { name: input.buyer?.name ?? "", phoneNumber: localPhone(input.buyer?.phone ?? null) ?? "", email } } : {}),
    };
    let reply: { resultCode?: unknown; message?: unknown; payUrl?: unknown; orderId?: unknown } | null;
    try {
      // MoMo yêu cầu chờ tối thiểu 30 giây.
      const response = await fetch(`${configuration.endpoint}/v2/gateway/api/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      reply = (await response.json().catch(() => null)) as typeof reply;
    } catch (error) {
      this.logger.error(`Tạo thanh toán MoMo ${input.reference}: ${(error as Error).message}`);
      throw new ApiError("BUSINESS_RULE", "paymentGatewayStartFailed");
    }
    if (!reply || reply.resultCode !== 0 || reply.orderId !== input.reference || typeof reply.payUrl !== "string" || !reply.payUrl.startsWith("https://")) {
      this.logger.error(`Tạo thanh toán MoMo ${input.reference}: mã ${String(reply?.resultCode)} ${String(reply?.message ?? "")}`.slice(0, 300));
      throw new ApiError("BUSINESS_RULE", "paymentGatewayStartFailed");
    }
    return { kind: "redirect", url: reply.payUrl };
  }

  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = momoConfiguration();
    return configuration ? verifiedMomoResult(configuration, request.body) : null;
  }

  async verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = momoConfiguration();
    return configuration ? verifiedMomoResult(configuration, request.query) : null;
  }

  // Ví MoMo, ATM: HTTP 204 không nội dung; sai chữ ký 400; lỗi phía VComm 500 để MoMo gửi lại.
  // Thẻ quốc tế: HTTP 200 kèm nội dung JSON có chữ ký lặp lại orderId, requestId.
  reply(outcome: NotificationOutcome, notification?: GatewayNotification | null): { status: number; body: unknown } {
    const configuration = momoConfiguration();
    const context = notification?.replyContext;
    if (context && configuration) {
      const values: Record<string, string> = {
        accessKey: configuration.accessKey,
        partnerCode: configuration.partnerCode,
        orderId: context.orderId ?? "",
        requestId: context.requestId ?? "",
        extraData: context.extraData ?? "",
        resultCode: String(cardReplyCodes[outcome].resultCode),
        message: cardReplyCodes[outcome].message,
        responseTime: vietnamTime(new Date()),
      };
      return {
        status: 200,
        body: {
          partnerCode: values.partnerCode,
          requestId: values.requestId,
          orderId: values.orderId,
          resultCode: cardReplyCodes[outcome].resultCode,
          message: values.message,
          responseTime: values.responseTime,
          extraData: values.extraData,
          signature: momoSignature(cardReplyFields, values, configuration.secretKey),
        },
      };
    }
    if (outcome === "invalid_signature") return { status: 400, body: { message: "Invalid signature" } };
    if (outcome === "error") return { status: 500, body: { message: "Unknown error" } };
    return { status: 204, body: null };
  }
}
