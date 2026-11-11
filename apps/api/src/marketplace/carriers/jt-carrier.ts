// Kết nối J&T Express Việt Nam (CONG_VIEC_30; QUYTAC_NGHIEPVU_190 đến 194): tạo vận đơn có tiền thu hộ, hủy, tra hành trình, đọc mã vận đơn từ webhook.
// Viết theo tài liệu công khai của J&T Open Platform (open.jtexpress.vn); trước khi phát hành phải thử với tài khoản môi trường thử nghiệm của J&T.
import { createHash } from "node:crypto";
import type { CarrierAdapter, CarrierPhase, CreatedShipment, ShipmentRequest } from "./carrier";
import { CarrierFailure } from "./carrier";
import type { JtConfiguration } from "./carrier-registry";

const timeoutMilliseconds = 15_000;
// Hằng số J&T quy định để tạo mật khẩu nghiệp vụ: MD5(mật khẩu gốc + hằng số) viết hoa.
const passwordSalt = "jadada369t3";
// J&T giới hạn giá trị hàng khai báo 0 đến 30.000.000 đồng.
const maximumGoodsValue = 30_000_000;
// Mã quét chưa có, mới tạo vận đơn: coi như "Đã đặt" (103).
const jtOrderPlaced = "103";
// Mã "Hoàn tất" (121) chỉ đóng hành trình, không nói kết quả giao: bỏ qua khi lấy trạng thái.
const finished = "121";
// QUYTAC_NGHIEPVU_192: ánh xạ mã quét của J&T. Tài liệu J&T có hai bộ mã (103 đến 121 và 10 đến 200); nhận cả hai.
const waiting = new Set(["103", "104"]);
const picked = new Set(["10", "20", "30", "50", "92", "94", "106", "109", "110", "112", "116", "172", "200"]);
const delivered = new Set(["100", "113"]);
const returned = new Set(["117", "173"]);
const cancelled = new Set(["105"]);

type JtResponse<T> = { code?: string | number; msg?: string; data?: T };
type TraceDetail = { scanTime?: string; scanTypeCode?: string | number };
type TraceItem = { billCode?: string; details?: TraceDetail[] | TraceDetail };

const md5 = (text: string) => createHash("md5").update(text, "utf8");

// Trạng thái hiện tại của vận đơn: mã quét có thời gian muộn nhất (bỏ qua "Hoàn tất"); bằng thời gian thì lấy mục đứng trước (J&T liệt kê mới nhất trước).
function latestScanCode(item: TraceItem): string {
  const details = (Array.isArray(item.details) ? item.details : item.details ? [item.details] : []).filter((detail) => detail.scanTypeCode !== undefined && String(detail.scanTypeCode) !== finished);
  let latest: TraceDetail | undefined;
  for (const detail of details) {
    if (!latest || (detail.scanTime ?? "").replace("T", " ") > (latest.scanTime ?? "").replace("T", " ")) latest = detail;
  }
  return latest ? String(latest.scanTypeCode) : jtOrderPlaced;
}

export class JtCarrier implements CarrierAdapter {
  readonly code = "jt" as const;

  constructor(private readonly configuration: JtConfiguration) {}

  // Gọi API: thân dạng form bizContent=<JSON>; header digest = base64(md5(bizContent + privateKey)).
  private async call<T>(apiName: string, business: Record<string, unknown>): Promise<T | undefined> {
    const password = md5(this.configuration.customerPassword + passwordSalt)
      .digest("hex")
      .toUpperCase();
    const bizContent = JSON.stringify({ customerCode: this.configuration.customerCode, password, ...business });
    let response: Response;
    try {
      response = await fetch(`${this.configuration.baseUrl}/webopenplatformapi/api/${apiName}`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          apiAccount: this.configuration.apiAccount,
          digest: md5(bizContent + this.configuration.privateKey).digest("base64"),
          timestamp: String(Date.now()),
        },
        body: new URLSearchParams({ bizContent }).toString(),
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch (error) {
      throw new CarrierFailure("unavailable", `J&T không trả lời: ${(error as Error).message}`);
    }
    const payload = (await response.json().catch(() => null)) as JtResponse<T> | null;
    if (response.status >= 500 || !payload) throw new CarrierFailure("unavailable", `J&T lỗi ${response.status}`);
    if (String(payload.code) !== "1") throw new CarrierFailure("rejected", payload.msg || `J&T từ chối (${payload.code})`);
    return payload.data;
  }

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    const goodsValue = Math.min(
      request.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      maximumGoodsValue,
    );
    const sender = this.configuration.sender;
    const data = await this.call<{ billCode?: string; inquiryFee?: number | string; codFee?: number | string }>("order/addOrder", {
      txlogisticId: request.clientOrderCode,
      orderType: 1,
      // Lấy hàng tại điểm gửi, giao tận nơi; VComm trả cước theo hợp đồng, người nhận trả tiền thu hộ (QUYTAC_NGHIEPVU_160, 191).
      serviceType: 1,
      deliveryType: 1,
      payType: "PP_PM",
      productType: "EXPRESS",
      goodsType: "bm000010",
      // Địa chỉ hai cấp theo tên đơn vị hành chính, J&T tự ánh xạ; không gửi cấp huyện (QUYTAC_NGHIEPVU_191).
      selfAddress: 1,
      sender: { name: sender.name, mobile: sender.phone, prov: sender.provinceName, area: sender.wardName, address: sender.streetAddress },
      receiver: { name: request.recipientName, mobile: request.recipientPhone, prov: request.provinceName, area: request.wardName, address: request.streetAddress },
      packageInfo: { weight: (request.weightGrams / 1000).toFixed(2), length: request.lengthCm, width: request.widthCm, height: request.heightCm },
      items: request.items.map((item) => ({ itemName: item.name, englishName: item.name, number: String(item.quantity), itemValue: String(item.price) })),
      totalQuantity: 1,
      isInsured: 0,
      goodsValue,
      codMoney: String(request.codAmount),
    });
    if (!data?.billCode) throw new CarrierFailure("unavailable", "J&T không trả mã vận đơn");
    const fees = [data.inquiryFee, data.codFee].filter((fee) => fee !== undefined && fee !== null && fee !== "");
    return { trackingCode: data.billCode, fee: fees.length === 0 ? null : String(fees.reduce<number>((sum, fee) => sum + Number(fee), 0)), status: jtOrderPlaced };
  }

  async cancelShipment(trackingCode: string, clientOrderCode: string): Promise<void> {
    await this.call("order/cancelOrder", { txlogisticId: clientOrderCode, billCode: trackingCode, reason: "Hủy đơn VComm" });
  }

  private async trace(business: Record<string, unknown>): Promise<TraceItem[]> {
    const data = await this.call<TraceItem[] | TraceItem>("logistics/trace", business);
    return Array.isArray(data) ? data : data ? [data] : [];
  }

  async shipmentStatus(trackingCode: string): Promise<string> {
    const item = (await this.trace({ billCodes: trackingCode, txlogisticId: "" })).find((entry) => entry.billCode === trackingCode);
    if (!item) throw new CarrierFailure("rejected", `J&T không có vận đơn ${trackingCode}`);
    return latestScanCode(item);
  }

  // QUYTAC_NGHIEPVU_193: J&T không công bố API tra theo mã đơn của bên gửi; dùng tra hành trình theo txlogisticId (chưa xác minh).
  // J&T trả thành công mà không có vận đơn: chưa tạo. Lỗi khác: báo lỗi, giữ chỗ để nhân viên kiểm tra trên trang J&T.
  async findShipment(clientOrderCode: string): Promise<CreatedShipment | null> {
    const item = (await this.trace({ billCodes: "", txlogisticId: clientOrderCode })).find((entry) => typeof entry.billCode === "string" && entry.billCode !== "");
    return item ? { trackingCode: item.billCode!, fee: null, status: latestScanCode(item) } : null;
  }

  phaseOf(status: string): CarrierPhase {
    if (waiting.has(status)) return "waiting_pickup";
    if (picked.has(status)) return "picked";
    if (delivered.has(status)) return "delivered";
    if (returned.has(status)) return "returned";
    if (cancelled.has(status)) return "cancelled";
    // Vấn đề khi giao (118), khi hoàn (120) và mã chưa biết: hiện cho nhân viên, không ghi sổ phiếu xuất.
    return "attention";
  }

  // J&T đẩy hành trình dạng form bizContent=<JSON>; nhận cả JSON thường.
  trackingCodeOf(payload: unknown): string | null {
    let content: unknown = (payload as { bizContent?: unknown } | null)?.bizContent ?? payload;
    if (typeof content === "string") {
      try {
        content = JSON.parse(content);
      } catch {
        return null;
      }
    }
    const value = (content as { billCode?: unknown } | null)?.billCode;
    return typeof value === "string" && /^[A-Za-z0-9-]{4,40}$/.test(value) ? value : null;
  }

  // J&T coi nội dung khác { code: "1" } là thất bại và gửi lại (QUYTAC_NGHIEPVU_194).
  webhookReply(result: string): unknown {
    return { code: "1", msg: "success", data: result };
  }
}
