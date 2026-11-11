// Cổng chuyển khoản ngân hàng và VietQR (CONG_VIEC_36; QUYTAC_NGHIEPVU_240, 244): chuyển thẳng vào tài khoản của VComm, không qua cổng trung gian.
// Tiền về được ghi nhận qua đối soát ngân hàng (CONG_VIEC_18) hoặc kế toán xác nhận tay, nên cổng không nhận kết quả qua đường dẫn chung.
import type { GatewayNotification, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface BankTransferConfiguration {
  // Mã ngân hàng 6 số theo danh sách NAPAS.
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export function bankTransferConfiguration(): BankTransferConfiguration | null {
  const bankBin = process.env.BANK_TRANSFER_BANK_BIN?.trim() ?? "";
  const bankName = process.env.BANK_TRANSFER_BANK_NAME?.trim() ?? "";
  const accountNumber = process.env.BANK_TRANSFER_ACCOUNT_NUMBER?.trim() ?? "";
  const accountName = process.env.BANK_TRANSFER_ACCOUNT_NAME?.trim() ?? "";
  if (!/^\d{6}$/.test(bankBin) || !/^[A-Za-z0-9]{1,19}$/.test(accountNumber) || !bankName || !accountName) return null;
  return { bankBin, bankName, accountNumber, accountName };
}

// Trường dữ liệu EMVCo: mã trường 2 số, độ dài 2 số, giá trị.
const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

// CRC-16/CCITT-FALSE (đa thức 0x1021, giá trị đầu 0xFFFF) tính trên chuỗi gồm cả "6304".
export function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Chuỗi mã QR VietQR động (QUYTAC_NGHIEPVU_240): chuyển nhanh đến tài khoản (QRIBFTTA), có số tiền và nội dung.
export function vietQrData(input: { bankBin: string; accountNumber: string; amount: number; content: string }): string {
  const beneficiary = field("00", input.bankBin) + field("01", input.accountNumber);
  const merchantAccount = field("00", "A000000727") + field("01", beneficiary) + field("02", "QRIBFTTA");
  const payload =
    field("00", "01") +
    field("01", "12") +
    field("38", merchantAccount) +
    field("53", "704") +
    field("54", String(input.amount)) +
    field("58", "VN") +
    field("62", field("08", input.content)) +
    "6304";
  return payload + crc16(payload);
}

// Nội dung chứa đúng số tham chiếu, không liền chữ hoặc số khác hai bên (QUYTAC_NGHIEPVU_241).
export function contentHasReference(content: string, reference: string): boolean {
  const normalized = content.toUpperCase();
  const target = reference.toUpperCase();
  for (let index = normalized.indexOf(target); index >= 0; index = normalized.indexOf(target, index + 1)) {
    const before = normalized[index - 1] ?? "";
    const after = normalized[index + target.length] ?? "";
    if (!/[A-Z0-9]/.test(before) && !/[A-Z0-9]/.test(after)) return true;
  }
  return false;
}

export class BankTransferGateway implements PaymentGatewayAdapter {
  readonly code = "bank_transfer" as const;

  configured(): boolean {
    return bankTransferConfiguration() !== null;
  }

  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = bankTransferConfiguration()!;
    return {
      kind: "transfer",
      transfer: {
        bankName: configuration.bankName,
        accountNumber: configuration.accountNumber,
        accountName: configuration.accountName,
        amount: String(input.amount),
        content: input.reference,
        qrData: vietQrData({ bankBin: configuration.bankBin, accountNumber: configuration.accountNumber, amount: input.amount, content: input.reference }),
        qrImageUrl: null,
      },
    };
  }

  // Không có bên ngoài gửi kết quả (QUYTAC_NGHIEPVU_244): mọi yêu cầu tới đường dẫn chung đều bị từ chối.
  async verify(): Promise<GatewayNotification | null> {
    return null;
  }

  reply(): { status: number; body: unknown } {
    return { status: 403, body: { success: false } };
  }
}
