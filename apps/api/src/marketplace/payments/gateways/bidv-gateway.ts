// Lớp kết nối BIDV: thu hộ qua tài khoản định danh cho khách hàng doanh nghiệp (CONG_VIEC_37; QUYTAC_NGHIEPVU_245 đến 249).
// Người mua chuyển khoản vào tài khoản định danh (mã đầu + mã lần thanh toán) bằng VietQR; BIDV gọi hàm vấn tin (getbill) rồi gạch nợ (paybill).
// Theo "Tài liệu hướng dẫn đối tác xây dựng đặc tả kỹ thuật thu hộ qua tài khoản định danh cho KHDN" của BIDV (V2 23.10.25), phần I.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { GatewayNotification, GatewayRequest, InquiryOutcome, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface BidvConfiguration {
  // Mã dịch vụ BIDV cấp khi tích hợp (serviceId).
  serviceId: string;
  // Mã đầu tài khoản định danh BIDV cấp.
  accountPrefix: string;
  // Tên chủ tài khoản định danh hiện cho người mua.
  accountName: string;
  // Chuỗi bí mật thống nhất với BIDV để tính checksum.
  checksumCode: string;
  // Địa chỉ IP của BIDV được gọi; trống thì không giới hạn.
  allowedIps: string[];
}

// Mã ngân hàng BIDV trong VietQR (NAPAS BIN).
export const bidvBankBin = "970418";
// Mã lần thanh toán gửi BIDV: 12 chữ số; số tài khoản định danh tối đa 19 ký tự nên mã đầu tối đa 7 ký tự (QUYTAC_NGHIEPVU_245).
const referenceLength = 12;
const maximumAccountLength = 19;

export function bidvConfiguration(): BidvConfiguration | null {
  const serviceId = process.env.BIDV_SERVICE_ID?.trim();
  const accountPrefix = process.env.BIDV_VA_PREFIX?.trim().toUpperCase();
  const accountName = process.env.BIDV_ACCOUNT_NAME?.trim();
  const checksumCode = process.env.BIDV_CHECKSUM_SECRET?.trim();
  if (!serviceId || !accountPrefix || !accountName || !checksumCode) return null;
  if (!/^[A-Z0-9]+$/.test(accountPrefix) || accountPrefix.length + referenceLength > maximumAccountLength) return null;
  const allowedIps = (process.env.BIDV_ALLOWED_IPS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return { serviceId, accountPrefix, accountName, checksumCode, allowedIps };
}

// Checksum theo tài liệu BIDV: Base64(SHA256(chuỗi ghép liền)), so sánh an toàn thời gian.
export function bidvChecksum(...parts: string[]): string {
  return createHash("sha256").update(parts.join(""), "utf8").digest("base64");
}

function checksumMatches(expected: string, received: unknown): boolean {
  if (typeof received !== "string") return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

// Địa chỉ IP qua proxy có dạng ::ffff:1.2.3.4.
const normalizedIp = (ip: string | undefined) => (ip ?? "").replace(/^::ffff:/, "");

function allowedCaller(configuration: BidvConfiguration, request: GatewayRequest): boolean {
  return configuration.allowedIps.length === 0 || configuration.allowedIps.includes(normalizedIp(request.ip));
}

const textField = (body: Record<string, unknown>, name: string): string | null => {
  const value = body[name];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

// BIDV gửi mã khách hàng có hoặc không kèm mã đầu tài khoản định danh.
function referenceOf(configuration: BidvConfiguration, customerId: string): string | null {
  const upper = customerId.toUpperCase();
  const reference = upper.startsWith(configuration.accountPrefix) && upper.length > referenceLength ? upper.slice(configuration.accountPrefix.length) : upper;
  return new RegExp(`^[0-9]{${referenceLength}}$`).test(reference) ? reference : null;
}

// Chuỗi VietQR theo chuẩn EMVCo của NAPAS: chuyển khoản nhanh tới tài khoản (QRIBFTTA), QR động có số tiền.
function emvField(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(payload, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function vietQrPayload(accountNumber: string, amount: number, content: string): string {
  const beneficiary = emvField("00", bidvBankBin) + emvField("01", accountNumber);
  const merchantAccount = emvField("00", "A000000727") + emvField("01", beneficiary) + emvField("02", "QRIBFTTA");
  const body =
    emvField("00", "01") +
    emvField("01", "12") +
    emvField("38", merchantAccount) +
    emvField("53", "704") +
    emvField("54", String(amount)) +
    emvField("58", "VN") +
    emvField("62", emvField("08", content)) +
    "6304";
  return body + crc16(body);
}

// Mã trả lời theo bảng mã lỗi trong tài liệu BIDV; BIDV luôn nhận HTTP 200.
const resultCodes = {
  success: ["000", "success"],
  invalid_signature: ["004", "Checksum khong hop le"],
  not_found: ["011", "Ma khach hang khong ton tai"],
  no_bill: ["012", "Khach hang khong co hoa don"],
  invalid_amount: ["022", "So tien khong dung voi hoa don"],
  already_confirmed: ["023", "Hoa don da gach no"],
  error: ["031", "Loi he thong"],
} as const;
const answer = (key: keyof typeof resultCodes) => ({ result_code: resultCodes[key][0], result_desc: resultCodes[key][1] });

export class BidvGateway implements PaymentGatewayAdapter {
  readonly code = "bidv" as const;

  configured(): boolean {
    return bidvConfiguration() !== null;
  }

  // Mã lần thanh toán ngẫu nhiên 12 chữ số, duy nhất trong cổng (chỉ mục duy nhất của database migration 0055).
  gatewayReference(): string {
    return Array.from({ length: referenceLength }, () => randomInt(10)).join("");
  }

  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = bidvConfiguration()!;
    const accountNumber = `${configuration.accountPrefix}${input.gatewayReference!}`;
    const content = `VCOMM ${input.documentNo.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 25);
    return {
      kind: "transfer",
      transfer: {
        bankName: "BIDV",
        accountNumber,
        accountName: configuration.accountName,
        amount: String(input.amount),
        content,
        qrData: vietQrPayload(accountNumber, input.amount, content),
        qrImageUrl: null,
      },
    };
  }

  // Vấn tin (getbill): checksum = Base64(SHA256(mã bí mật + serviceId + customerId)).
  async inquire(request: GatewayRequest): Promise<{ reference: string } | null> {
    const configuration = bidvConfiguration();
    if (!configuration || !allowedCaller(configuration, request) || !request.body || typeof request.body !== "object") return null;
    const body = request.body as Record<string, unknown>;
    const customerId = textField(body, "customerId");
    const serviceId = textField(body, "serviceId");
    if (!customerId || (serviceId && serviceId !== configuration.serviceId)) return null;
    if (!checksumMatches(bidvChecksum(configuration.checksumCode, configuration.serviceId, customerId), body.checksum)) return null;
    const reference = referenceOf(configuration, customerId);
    // Mã sai định dạng vẫn đúng checksum: trả "không tồn tại" thay vì "sai checksum".
    return { reference: reference ?? customerId.slice(0, 30) };
  }

  inquiryReply(result: InquiryOutcome): { status: number; body: unknown } {
    if (result.outcome !== "found") return { status: 200, body: answer(result.outcome) };
    const amount = String(result.amount);
    return {
      status: 200,
      body: {
        ...answer("success"),
        customer_id: result.reference,
        customer_name: result.customerName,
        customer_addr: "",
        bill_id: result.reference,
        // 1: chỉ gạch nợ khi đúng số tiền (QUYTAC_NGHIEPVU_246).
        type: "1",
        total_amount: amount,
        data: [{ period: `Don hang ${result.documentNo.replace(/[^A-Za-z0-9]/g, "")}`, data: [{ bill_id: result.reference, amount, remark: `${result.reference} VCOMM` }] }],
      },
    };
  }

  // Gạch nợ (paybill): checksum = Base64(SHA256(mã bí mật + transId + amount)); BIDV chỉ gọi khi đã hạch toán thành công.
  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = bidvConfiguration();
    if (!configuration || !allowedCaller(configuration, request) || !request.body || typeof request.body !== "object") return null;
    const body = request.body as Record<string, unknown>;
    const transactionId = textField(body, "transId");
    const customerId = textField(body, "customerId");
    const amountText = textField(body, "amount");
    if (!transactionId || !customerId || !amountText || !/^[0-9]{1,15}$/.test(amountText)) return null;
    if (!checksumMatches(bidvChecksum(configuration.checksumCode, transactionId, amountText), body.checksum)) return null;
    return {
      reference: referenceOf(configuration, customerId) ?? customerId.slice(0, 30),
      amount: Number(amountText),
      success: true,
      responseCode: "000",
      transactionNo: transactionId.slice(0, 100),
      bankCode: "BIDV",
    };
  }

  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return { status: 200, body: answer(outcome) };
  }
}
