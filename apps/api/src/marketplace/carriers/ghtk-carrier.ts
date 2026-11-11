// Kết nối Giao Hàng Tiết Kiệm (CONG_VIEC_31; QUYTAC_NGHIEPVU_195): tạo vận đơn có tiền thu hộ theo địa chỉ hai cấp, hủy, tra chi tiết, tìm theo số đơn, đọc mã vận đơn từ webhook.
// Viết theo tài liệu công khai của GHTK; trước khi phát hành phải thử với tài khoản môi trường thử nghiệm của GHTK.
import type { CarrierAdapter, CarrierPhase, CreatedShipment, ShipmentRequest } from "./carrier";
import { CarrierFailure } from "./carrier";
import type { GhtkConfiguration } from "./carrier-registry";

const timeoutMilliseconds = 15_000;
// Mã trạng thái GHTK (QUYTAC_NGHIEPVU_195). Mã "người lấy, giao hàng báo" (123, 128, 45, 49, 410) chưa phải trạng thái chính thức:
// 123 chưa ghi sổ phiếu xuất, 45 chưa chuyển Đã giao; chờ trạng thái chính thức 3, 5.
const waiting = new Set(["1", "2", "8", "12", "123", "128"]);
const picked = new Set(["3", "4", "9", "10", "20", "45", "49", "410"]);
const delivered = new Set(["5", "6"]);
const returned = new Set(["11", "21"]);
const cancelled = new Set(["-1"]);

type GhtkResponse = { success?: boolean; message?: string; order?: Record<string, unknown>; error?: { code?: string } };

// Chi tiết vận đơn GHTK; tiền thu hộ dùng cho đối soát COD (CONG_VIEC_25).
export interface GhtkShipmentDetail extends CreatedShipment {
  // Tiền thu hộ của vận đơn (pick_money).
  codAmount: string | null;
  // Tiền thu hộ đã thu: bằng codAmount khi GHTK báo đã giao (5) hoặc đã đối soát (6); GHTK không có trường tiền đã thu riêng.
  collectedCodAmount: string | null;
}

const text = (value: unknown): string | null => (typeof value === "string" || typeof value === "number" ? String(value) : null);

export class GhtkCarrier implements CarrierAdapter {
  readonly code = "ghtk" as const;

  constructor(private readonly configuration: GhtkConfiguration) {}

  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<GhtkResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.baseUrl}${path}`, {
        method,
        headers: { "content-type": "application/json", token: this.configuration.token, "x-client-source": this.configuration.clientSource },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch (error) {
      throw new CarrierFailure("unavailable", `GHTK không trả lời: ${(error as Error).message}`);
    }
    // Sai token: GHTK trả 403 không có nội dung; coi như không dùng được, không phải từ chối nghiệp vụ.
    const payload = (await response.json().catch(() => null)) as GhtkResponse | null;
    if (response.status >= 500 || !payload || typeof payload !== "object") throw new CarrierFailure("unavailable", `GHTK lỗi ${response.status}`);
    if (payload.success !== true) throw new CarrierFailure("rejected", payload.message || payload.error?.code || `GHTK từ chối (${response.status})`);
    return payload;
  }

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    const configuration = this.configuration;
    const declaredValue = request.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const payload = await this.call("POST", "/services/shipment/order", {
      products: request.items.map((item) => ({ name: item.name, weight: item.weightGrams / 1000, quantity: item.quantity, price: item.price })),
      order: {
        id: request.clientOrderCode,
        ...(configuration.pickAddressId ? { pick_address_id: configuration.pickAddressId } : {}),
        pick_name: configuration.pickName,
        pick_tel: configuration.pickTelephone,
        pick_address: configuration.pickAddress,
        pick_province: configuration.pickProvince,
        pick_ward: configuration.pickWard,
        name: request.recipientName,
        tel: request.recipientPhone,
        // Địa chỉ hai cấp: không gửi quận, huyện; thôn, ấp ghi "Khác" theo hướng dẫn của GHTK.
        address: `${request.streetAddress}, ${request.wardName}, ${request.provinceName}`,
        province: request.provinceName,
        ward: request.wardName,
        hamlet: "Khác",
        // Người nhận chỉ trả tiền thu hộ; tiền thu hộ đã gồm phí giao, VComm trả phí cho GHTK (QUYTAC_NGHIEPVU_160).
        is_freeship: 1,
        pick_money: request.codAmount,
        // Giá trị khai báo là tổng tiền hàng, căn cứ bồi thường khi mất hàng.
        value: declaredValue,
        total_weight: request.weightGrams / 1000,
      },
    });
    const order = payload.order ?? {};
    const label = text(order.label);
    if (!label) throw new CarrierFailure("unavailable", "GHTK không trả mã vận đơn");
    return { trackingCode: label, fee: text(order.fee), status: text(order.status_id) ?? "1" };
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    await this.call("POST", `/services/shipment/cancel/${encodeURIComponent(trackingCode)}`);
  }

  // Tra chi tiết theo mã vận đơn hoặc số đơn của bên gửi (GHTK nhận cả hai).
  async shipmentDetail(code: string): Promise<GhtkShipmentDetail> {
    const order = (await this.call("GET", `/services/shipment/v2/${encodeURIComponent(code)}`)).order ?? {};
    const trackingCode = text(order.label_id);
    const status = text(order.status);
    if (!trackingCode || !status) throw new CarrierFailure("unavailable", "GHTK trả chi tiết vận đơn thiếu mã hoặc trạng thái");
    const codAmount = text(order.pick_money);
    return { trackingCode, status, fee: text(order.ship_money), codAmount, collectedCodAmount: delivered.has(status) ? codAmount : null };
  }

  async shipmentStatus(trackingCode: string): Promise<string> {
    return (await this.shipmentDetail(trackingCode)).status;
  }

  async findShipment(clientOrderCode: string): Promise<CreatedShipment | null> {
    try {
      const detail = await this.shipmentDetail(clientOrderCode);
      return { trackingCode: detail.trackingCode, fee: detail.fee, status: detail.status };
    } catch (error) {
      // GHTK trả lỗi nghiệp vụ khi không có đơn với mã này.
      if (error instanceof CarrierFailure && error.kind === "rejected") return null;
      throw error;
    }
  }

  phaseOf(status: string): CarrierPhase {
    if (waiting.has(status)) return "waiting_pickup";
    if (picked.has(status)) return "picked";
    if (delivered.has(status)) return "delivered";
    if (returned.has(status)) return "returned";
    if (cancelled.has(status)) return "cancelled";
    // 7 không lấy được hàng, 13 bồi hoàn, 127 người lấy hàng báo không lấy được và mã chưa biết: hiện cho nhân viên, không đổi đơn.
    return "attention";
  }

  // Webhook GHTK gửi dạng form: label_id là mã vận đơn (ví dụ S1.A1.2001297581).
  trackingCodeOf(payload: unknown): string | null {
    const value = (payload as { label_id?: unknown } | null)?.label_id;
    return typeof value === "string" && /^[A-Za-z0-9._-]{4,60}$/.test(value) ? value : null;
  }
}
