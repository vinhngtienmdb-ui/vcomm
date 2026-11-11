// Kết nối Giao Hàng Nhanh (CONG_VIEC_24): tạo vận đơn theo địa chỉ hai cấp, hủy, tra trạng thái, đọc mã vận đơn từ webhook.
// Viết theo tài liệu công khai của GHN; trước khi phát hành phải thử với tài khoản môi trường thử nghiệm của GHN.
import type { CarrierAdapter, CarrierPhase, CreatedShipment, ShipmentInfo, ShipmentRequest } from "./carrier";
import { CarrierFailure } from "./carrier";
import type { GhnConfiguration } from "./carrier-registry";

const timeoutMilliseconds = 15_000;
const waiting = new Set(["ready_to_pick", "picking", "money_collect_picking"]);
const delivered = new Set(["delivered"]);
const returned = new Set(["returned"]);
const cancelled = new Set(["cancel"]);
const attention = new Set(["exception", "damage", "lost"]);

type GhnResponse<T> = { code: number; message?: string; code_message_value?: string; data?: T };

export class GhnCarrier implements CarrierAdapter {
  readonly code = "ghn" as const;

  constructor(private readonly configuration: GhnConfiguration) {}

  private async call<T>(path: string, body: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", token: this.configuration.token, shopid: this.configuration.shopId },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch (error) {
      throw new CarrierFailure("unavailable", `GHN không trả lời: ${(error as Error).message}`);
    }
    const payload = (await response.json().catch(() => null)) as GhnResponse<T> | null;
    if (response.status >= 500 || !payload) throw new CarrierFailure("unavailable", `GHN lỗi ${response.status}`);
    if (payload.code !== 200 || payload.data === undefined) throw new CarrierFailure("rejected", payload.code_message_value || payload.message || `GHN từ chối (${payload.code})`);
    return payload.data;
  }

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    const data = await this.call<{ order_code: string; total_fee?: number }>("/shiip/public-api/v2/shipping-order/create", {
      // Bên gửi (VComm) trả phí vận chuyển; người nhận trả tiền thu hộ (QUYTAC_NGHIEPVU_160).
      payment_type_id: 1,
      required_note: "CHOXEMHANGKHONGTHU",
      client_order_code: request.clientOrderCode,
      to_name: request.recipientName,
      to_phone: request.recipientPhone,
      to_address: `${request.streetAddress}, ${request.wardName}, ${request.provinceName}`,
      to_ward_name: request.wardName,
      to_province_name: request.provinceName,
      is_new_to_address: true,
      cod_amount: request.codAmount,
      weight: request.weightGrams,
      length: request.lengthCm,
      width: request.widthCm,
      height: request.heightCm,
      service_type_id: 2,
      items: request.items.map((item) => ({ name: item.name, code: item.code, quantity: item.quantity, price: item.price, weight: item.weightGrams })),
    });
    return { trackingCode: data.order_code, fee: data.total_fee === undefined ? null : String(data.total_fee), status: "ready_to_pick" };
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const data = await this.call<Array<{ order_code: string; result: boolean; message?: string }>>("/shiip/public-api/v2/switch-status/cancel", { order_codes: [trackingCode] });
    const result = data.find((item) => item.order_code === trackingCode);
    if (!result?.result) throw new CarrierFailure("rejected", result?.message ?? "GHN không hủy được vận đơn");
  }

  async shipmentStatus(trackingCode: string): Promise<string> {
    return (await this.shipmentInfo(trackingCode)).status;
  }

  // cod_collect_date: ngày GHN thu tiền của người mua (tài liệu GHN, API chi tiết đơn); null khi chưa thu.
  async shipmentInfo(trackingCode: string): Promise<ShipmentInfo> {
    const data = await this.call<{ status: string; cod_collect_date?: string | null }>("/shiip/public-api/v2/shipping-order/detail", { order_code: trackingCode });
    const collected = data.cod_collect_date ? new Date(data.cod_collect_date) : null;
    // Ngày rỗng dạng 0001-01-01 hoặc không đọc được coi như chưa thu.
    const valid = collected !== null && !Number.isNaN(collected.getTime()) && collected.getUTCFullYear() >= 2000;
    return { status: data.status, codCollectedAt: valid ? collected : null };
  }

  async findShipment(clientOrderCode: string): Promise<CreatedShipment | null> {
    try {
      const data = await this.call<{ order_code: string; status: string; total_fee?: number }>("/shiip/public-api/v2/shipping-order/detail-by-client-code", { client_order_code: clientOrderCode });
      return { trackingCode: data.order_code, fee: data.total_fee === undefined ? null : String(data.total_fee), status: data.status };
    } catch (error) {
      // GHN trả lỗi nghiệp vụ khi không có đơn với mã này.
      if (error instanceof CarrierFailure && error.kind === "rejected") return null;
      throw error;
    }
  }

  phaseOf(status: string): CarrierPhase {
    if (waiting.has(status)) return "waiting_pickup";
    if (delivered.has(status)) return "delivered";
    if (returned.has(status)) return "returned";
    if (cancelled.has(status)) return "cancelled";
    if (attention.has(status)) return "attention";
    // Các trạng thái đã lấy hàng: picked, storing, transporting, sorting, delivering, delivery_fail, waiting_to_return, return, returning...
    return "picked";
  }

  trackingCodeOf(payload: unknown): string | null {
    const value = (payload as { OrderCode?: unknown } | null)?.OrderCode;
    return typeof value === "string" && /^[A-Za-z0-9]{4,40}$/.test(value) ? value : null;
  }
}
