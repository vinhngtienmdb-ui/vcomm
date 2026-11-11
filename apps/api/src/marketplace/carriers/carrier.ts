// Giao diện chung của đơn vị vận chuyển (CONG_VIEC_24; QUYTAC_NGHIEPVU_160).
import type { CarrierCode } from "contracts";

export interface ShipmentRequest {
  // Số đơn VComm, gửi làm mã đơn của bên gửi để tra cứu chéo.
  clientOrderCode: string;
  recipientName: string;
  recipientPhone: string;
  streetAddress: string;
  wardName: string;
  provinceName: string;
  codAmount: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  items: { name: string; code: string; quantity: number; price: number; weightGrams: number }[];
}

export interface CreatedShipment {
  trackingCode: string;
  fee: string | null;
  status: string;
}

// Trạng thái vận đơn và ngày đơn vị vận chuyển đã thu tiền thu hộ của người mua (đối soát COD, CONG_VIEC_25; QUYTAC_NGHIEPVU_167).
export interface ShipmentInfo {
  status: string;
  codCollectedAt: Date | null;
}

// Ý nghĩa trạng thái của đơn vị vận chuyển với đơn VComm.
export type CarrierPhase = "waiting_pickup" | "picked" | "delivered" | "returned" | "cancelled" | "attention";

export interface CarrierAdapter {
  code: CarrierCode;
  createShipment(request: ShipmentRequest): Promise<CreatedShipment>;
  // clientOrderCode: số đơn đã gửi khi tạo vận đơn (J&T bắt buộc khi hủy; CONG_VIEC_30).
  cancelShipment(trackingCode: string, clientOrderCode: string): Promise<void>;
  shipmentStatus(trackingCode: string): Promise<string>;
  // Đơn vị vận chuyển có API trả ngày thu tiền thu hộ thì cài đặt; không có thì chỉ dùng trạng thái.
  shipmentInfo?(trackingCode: string): Promise<ShipmentInfo>;
  // Tra vận đơn theo mã đơn của bên gửi khi không rõ lần tạo trước đã thành công chưa; null khi không có.
  findShipment(clientOrderCode: string): Promise<CreatedShipment | null>;
  phaseOf(status: string): CarrierPhase;
  // Mã vận đơn trong nội dung webhook; không tin trạng thái trong nội dung, luôn tra lại.
  trackingCodeOf(payload: unknown): string | null;
  // Chỉ đơn vị vận chuyển không có API tra vận đơn (CONG_VIEC_29; QUYTAC_NGHIEPVU_185): đọc trạng thái từ webhook
  // sau khi lớp kết nối tự xác thực thêm khóa trong nội dung; null khi nội dung không hợp lệ hoặc sai khóa.
  webhookReport?(payload: unknown): WebhookReport | null;
  // Nội dung trả lời webhook theo yêu cầu của đơn vị vận chuyển; không có thì trả { result } (CONG_VIEC_30).
  webhookReply?(result: string): unknown;
}

// Trạng thái đơn vị vận chuyển báo qua webhook đã xác thực (CONG_VIEC_29).
export interface WebhookReport {
  trackingCode: string;
  // Mã đơn của bên gửi (số đơn VComm), dùng ghi nhận vận đơn khi lần tạo trước không rõ kết quả.
  clientOrderCode: string | null;
  status: string;
  fee: string | null;
  // Tiền thu hộ đơn vị vận chuyển báo (để đối soát COD ở CONG_VIEC_25); null khi không có.
  codAmount: string | null;
  // Nội dung lưu vào nhật ký webhook, đã bỏ khóa bí mật.
  storedPayload: unknown;
}

// Đơn vị vận chuyển trả lỗi nghiệp vụ (từ chối tạo, hủy) hoặc không trả lời.
export class CarrierFailure extends Error {
  constructor(
    // unsupported: đơn vị vận chuyển không có API cho thao tác này (CONG_VIEC_29).
    readonly kind: "rejected" | "unavailable" | "unsupported",
    message: string,
  ) {
    super(message);
  }
}
