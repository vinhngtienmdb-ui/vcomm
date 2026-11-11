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

// Ý nghĩa trạng thái của đơn vị vận chuyển với đơn VComm.
export type CarrierPhase = "waiting_pickup" | "picked" | "delivered" | "returned" | "cancelled" | "attention";

export interface CarrierAdapter {
  code: CarrierCode;
  createShipment(request: ShipmentRequest): Promise<CreatedShipment>;
  // clientOrderCode: số đơn đã gửi khi tạo vận đơn (J&T bắt buộc khi hủy; CONG_VIEC_30).
  cancelShipment(trackingCode: string, clientOrderCode: string): Promise<void>;
  shipmentStatus(trackingCode: string): Promise<string>;
  // Tra vận đơn theo mã đơn của bên gửi khi không rõ lần tạo trước đã thành công chưa; null khi không có.
  findShipment(clientOrderCode: string): Promise<CreatedShipment | null>;
  phaseOf(status: string): CarrierPhase;
  // Mã vận đơn trong nội dung webhook; không tin trạng thái trong nội dung, luôn tra lại.
  trackingCodeOf(payload: unknown): string | null;
  // Nội dung trả lời webhook theo yêu cầu của đơn vị vận chuyển; không có thì trả { result } (CONG_VIEC_30).
  webhookReply?(result: string): unknown;
}

// Đơn vị vận chuyển trả lỗi nghiệp vụ (từ chối tạo, hủy) hoặc không trả lời.
export class CarrierFailure extends Error {
  constructor(
    readonly kind: "rejected" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}
