// Giao diện chung của cổng thanh toán (CONG_VIEC_32; QUYTAC_NGHIEPVU_220): mỗi cổng một lớp kết nối, thông tin kết nối chỉ ở biến môi trường.
import type { PaymentGatewayCode, PaymentMethodCode, PaymentTransferInstruction } from "contracts";

export interface PaymentStartInput {
  // Số tham chiếu duy nhất của lần thanh toán (chữ và số), gửi cổng làm mã đơn.
  reference: string;
  // Số tiền đồng, đã làm tròn.
  amount: number;
  method: PaymentMethodCode;
  documentNo: string;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
  // Người mua (CONG_VIEC_33): cổng cần thông tin người mua thì dùng (MoMo thẻ quốc tế bắt buộc email).
  buyer?: { name: string | null; phone: string | null; email: string | null };
}

// Cổng chuyển trang: địa chỉ trang thanh toán; cổng chuyển khoản: thông tin chuyển khoản, mã QR.
export type PaymentInstruction = { kind: "redirect"; url: string } | { kind: "transfer"; transfer: PaymentTransferInstruction };

// Kết quả cổng gửi về đã kiểm chữ ký (hoặc khóa xác thực).
export interface GatewayNotification {
  reference: string;
  amount: number;
  success: boolean;
  // Cổng báo giao dịch đang xử lý, chưa có kết quả cuối (CONG_VIEC_33): không đổi trạng thái lần thanh toán.
  pending?: boolean;
  responseCode: string;
  transactionNo: string | null;
  bankCode: string | null;
  // Giá trị cổng gửi về cần lặp lại trong câu trả lời có chữ ký (CONG_VIEC_33).
  replyContext?: Record<string, string>;
}

export interface GatewayRequest {
  method: string;
  query: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

// Cách trả lời cổng theo kết quả xử lý.
export type NotificationOutcome = "success" | "pending" | "not_found" | "invalid_amount" | "already_confirmed" | "invalid_signature" | "error";

export interface PaymentGatewayAdapter {
  readonly code: PaymentGatewayCode;
  configured(): boolean;
  start(input: PaymentStartInput): Promise<PaymentInstruction>;
  // Kiểm chữ ký, đọc kết quả; sai chữ ký hoặc không đọc được trả null.
  verify(request: GatewayRequest): Promise<GatewayNotification | null>;
  // notification: kết quả đã kiểm chữ ký (null khi sai chữ ký), cho cổng cần trả lời có chữ ký.
  reply(outcome: NotificationOutcome, notification?: GatewayNotification | null): { status: number; body: unknown };
  // Thông tin để hiện trang trả về (chỉ hiển thị, không ghi nhận tiền); cổng không có trang trả về thì để trống.
  verifyReturn?(request: GatewayRequest): Promise<GatewayNotification | null>;
}
