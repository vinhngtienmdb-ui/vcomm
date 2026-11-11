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
  cancelShipment(trackingCode: string): Promise<void>;
  shipmentStatus(trackingCode: string): Promise<string>;
  // Đơn vị vận chuyển có API trả ngày thu tiền thu hộ thì cài đặt; không có thì chỉ dùng trạng thái.
  shipmentInfo?(trackingCode: string): Promise<ShipmentInfo>;
  // Tra vận đơn theo mã đơn của bên gửi khi không rõ lần tạo trước đã thành công chưa; null khi không có.
  findShipment(clientOrderCode: string): Promise<CreatedShipment | null>;
  phaseOf(status: string): CarrierPhase;
  // Mã vận đơn trong nội dung webhook; không tin trạng thái trong nội dung, luôn tra lại.
  trackingCodeOf(payload: unknown): string | null;
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
