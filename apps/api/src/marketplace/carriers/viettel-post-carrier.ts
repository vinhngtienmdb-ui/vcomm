// Kết nối Viettel Post (CONG_VIEC_29; QUYTAC_NGHIEPVU_185 đến 189): tạo vận đơn theo địa chỉ chi tiết (createOrderNlp, nhận địa chỉ hai cấp dạng văn bản),
// hủy (UpdateOrder loại 4), đọc trạng thái từ webhook đã xác thực vì Viettel Post không có API tra vận đơn cho đối tác.
// Viết theo tài liệu công khai tại partner2.viettelpost.vn; trước khi phát hành phải thử với tài khoản môi trường thử nghiệm của Viettel Post.
import { timingSafeEqual } from "node:crypto";
import type { CarrierAdapter, CarrierPhase, CreatedShipment, ShipmentRequest, WebhookReport } from "./carrier";
import { CarrierFailure } from "./carrier";
import type { ViettelPostConfiguration } from "./carrier-registry";

const timeoutMilliseconds = 15_000;
// Bảng trạng thái đơn của Viettel Post (QUYTAC_NGHIEPVU_186).
const waiting = new Set(["100", "102", "103", "104"]);
const picked = new Set(["105", "200", "202", "300", "400", "500", "502", "505", "506", "507", "508", "509", "515", "550"]);
const delivered = new Set(["501"]);
const returned = new Set(["504"]);
const cancelled = new Set(["101", "107", "201"]);
// Thu hộ tiền hàng, không thu hộ tiền cước: tiền thu hộ đã gồm phí giao hàng, VComm trả cước (QUYTAC_NGHIEPVU_160).
const paymentCollectGoodsOnly = 3;
const paymentNoCollection = 1;
// Mã lỗi "mã đơn hàng đã tồn tại" khi tạo đơn có kiểm tra trùng.
const duplicateOrderStatus = 206;
const trackingCodePattern = /^[A-Za-z0-9]{4,40}$/;

type ViettelPostResponse<T> = { status?: number; error?: boolean; message?: string; data?: T };

const text = (value: unknown): string | null => (typeof value === "string" || typeof value === "number" ? String(value).trim() || null : null);
const money = (value: unknown): string | null => (typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" && /^\d+(\.\d+)?$/.test(value) ? value : null);

export class ViettelPostCarrier implements CarrierAdapter {
  readonly code = "viettel_post" as const;

  constructor(private readonly configuration: ViettelPostConfiguration) {}

  private async call<T>(path: string, body: unknown): Promise<ViettelPostResponse<T>> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json;charset=UTF-8", token: this.configuration.token },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch (error) {
      throw new CarrierFailure("unavailable", `Viettel Post không trả lời: ${(error as Error).message}`);
    }
    const payload = (await response.json().catch(() => null)) as ViettelPostResponse<T> | null;
    if (response.status >= 500 || !payload) throw new CarrierFailure("unavailable", `Viettel Post lỗi ${response.status}`);
    if (payload.status === duplicateOrderStatus) {
      // Đơn đã có trên Viettel Post (lần tạo trước có thể đã thành công): không rõ kết quả, chờ webhook ghi nhận (QUYTAC_NGHIEPVU_188).
      throw new CarrierFailure("unavailable", `Viettel Post báo mã đơn đã tồn tại: ${payload.message ?? ""}`);
    }
    if (payload.error !== false || payload.status !== 200) throw new CarrierFailure("rejected", payload.message || `Viettel Post từ chối (${payload.status ?? response.status})`);
    return payload;
  }

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    const productNames = request.items.map((item) => item.name).join(", ");
    const response = await this.call<{ ORDER_NUMBER?: unknown; MONEY_TOTAL?: unknown }>("/v2/order/createOrderNlp", {
      ORDER_NUMBER: request.clientOrderCode,
      SENDER_FULLNAME: this.configuration.senderName,
      SENDER_PHONE: this.configuration.senderPhone,
      SENDER_ADDRESS: this.configuration.senderAddress,
      RECEIVER_FULLNAME: request.recipientName,
      RECEIVER_PHONE: request.recipientPhone,
      // Địa chỉ hai cấp dạng văn bản: Viettel Post tự nhận diện xã, tỉnh (QUYTAC_NGHIEPVU_187).
      RECEIVER_ADDRESS: `${request.streetAddress}, ${request.wardName}, ${request.provinceName}`,
      PRODUCT_NAME: productNames.length > 200 ? `${productNames.slice(0, 197)}...` : productNames,
      PRODUCT_QUANTITY: request.items.reduce((sum, item) => sum + item.quantity, 0),
      PRODUCT_PRICE: request.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      PRODUCT_WEIGHT: request.weightGrams,
      PRODUCT_LENGTH: request.lengthCm,
      PRODUCT_WIDTH: request.widthCm,
      PRODUCT_HEIGHT: request.heightCm,
      PRODUCT_TYPE: "HH",
      ORDER_PAYMENT: request.codAmount > 0 ? paymentCollectGoodsOnly : paymentNoCollection,
      ORDER_SERVICE: this.configuration.serviceCode,
      ORDER_SERVICE_ADD: null,
      ORDER_NOTE: "Cho xem hàng, không cho thử",
      MONEY_COLLECTION: request.codAmount,
      // Viettel Post chặn tạo trùng số đơn VComm khi giao lại sau lần không rõ kết quả.
      CHECK_UNIQUE: true,
      PRODUCT_DETAIL: request.items.map((item) => ({ PRODUCT_NAME: item.name, PRODUCT_QUANTITY: item.quantity, PRODUCT_PRICE: item.price, PRODUCT_WEIGHT: item.weightGrams })),
    });
    const trackingCode = text(response.data?.ORDER_NUMBER);
    if (!trackingCode || !trackingCodePattern.test(trackingCode)) throw new CarrierFailure("unavailable", "Viettel Post không trả mã vận đơn");
    // Trạng thái ban đầu: đơn chờ xử lý.
    return { trackingCode, fee: money(response.data?.MONEY_TOTAL), status: "102" };
  }

  // Hủy chỉ được khi Viettel Post chưa nhận hàng (trạng thái nhỏ hơn 200); không hủy được thì Viettel Post trả lỗi.
  async cancelShipment(trackingCode: string): Promise<void> {
    await this.call("/v2/order/UpdateOrder", { TYPE: 4, ORDER_NUMBER: trackingCode, NOTE: "VComm hủy đơn" });
  }

  // Viettel Post không có API tra vận đơn cho đối tác: trạng thái chỉ đến qua webhook (QUYTAC_NGHIEPVU_185).
  async shipmentStatus(): Promise<string> {
    throw new CarrierFailure("unsupported", "Viettel Post không có API tra vận đơn");
  }

  // Không có API tìm theo mã đơn của bên gửi: vận đơn được ghi nhận khi webhook đầu tiên mang số đơn VComm tới (QUYTAC_NGHIEPVU_188).
  async findShipment(): Promise<CreatedShipment | null> {
    throw new CarrierFailure("unsupported", "Viettel Post không có API tìm vận đơn theo số đơn");
  }

  phaseOf(status: string): CarrierPhase {
    if (waiting.has(status)) return "waiting_pickup";
    if (picked.has(status)) return "picked";
    if (delivered.has(status)) return "delivered";
    if (returned.has(status)) return "returned";
    if (cancelled.has(status)) return "cancelled";
    // 503 (hủy, tiêu hủy theo yêu cầu sau khi đã nhận hàng) và mã chưa biết: hiện cho nhân viên, không tự xuất kho.
    return "attention";
  }

  trackingCodeOf(payload: unknown): string | null {
    const value = text((payload as { DATA?: { ORDER_NUMBER?: unknown } } | null)?.DATA?.ORDER_NUMBER);
    return value && trackingCodePattern.test(value) ? value : null;
  }

  // Webhook đã đúng khóa trên đường dẫn; kiểm tra thêm TOKEN trong nội dung (khóa khai báo với Viettel Post) bằng so sánh an toàn.
  webhookReport(payload: unknown): WebhookReport | null {
    const body = payload as { DATA?: Record<string, unknown>; TOKEN?: unknown } | null;
    const token = typeof body?.TOKEN === "string" ? Buffer.from(body.TOKEN) : null;
    const expected = Buffer.from(this.configuration.webhookKey);
    if (!token || token.length !== expected.length || !timingSafeEqual(token, expected)) return null;
    const trackingCode = this.trackingCodeOf(payload);
    const status = text(body?.DATA?.ORDER_STATUS);
    if (!trackingCode || !status || !/^-?\d{1,4}$/.test(status)) return null;
    const reference = text(body?.DATA?.ORDER_REFERENCE);
    return {
      trackingCode,
      clientOrderCode: reference && reference.length <= 50 ? reference : null,
      status,
      fee: money(body?.DATA?.MONEY_TOTAL),
      codAmount: money(body?.DATA?.MONEY_COLLECTION),
      // Không lưu TOKEN (khóa webhook) vào cơ sở dữ liệu.
      storedPayload: { DATA: body?.DATA ?? null },
    };
  }
}
