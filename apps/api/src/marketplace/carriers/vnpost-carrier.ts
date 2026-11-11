// Kết nối Bưu điện Việt Nam, hệ thống MyVNPost (CONG_VIEC_28; QUYTAC_NGHIEPVU_180 đến 184): tạo vận đơn có tiền thu hộ theo địa chỉ hai cấp,
// hủy, tra vận đơn theo mã vận đơn hoặc số đơn, đọc mã vận đơn từ webhook, đọc tiền thu hộ cho đối soát.
// Viết theo tài liệu công khai "VNPost API Documentation" (https://my-uat.vnpost.vn/static/); trước khi phát hành phải thử với tài khoản môi trường thử nghiệm.
import type { CarrierAdapter, CarrierPhase, CreatedShipment, ShipmentRequest } from "./carrier";
import { CarrierFailure } from "./carrier";

export interface VnpostSender {
  name: string;
  phone: string;
  address: string;
  provinceName: string;
  wardName: string;
}

export interface VnpostConfiguration {
  baseUrl: string;
  username: string;
  password: string;
  customerCode: string;
  contractCode: string | null;
  serviceCode: string;
  webhookKey: string;
  sender: VnpostSender;
}

// VNPOST_BASE_URL để trống là môi trường thử nghiệm; môi trường thật: https://connect-my.vnpost.vn
export function vnpostConfiguration(): VnpostConfiguration | null {
  const value = (name: string) => process.env[name]?.trim() || "";
  const required = {
    username: value("VNPOST_USERNAME"),
    password: value("VNPOST_PASSWORD"),
    customerCode: value("VNPOST_CUSTOMER_CODE"),
    serviceCode: value("VNPOST_SERVICE_CODE"),
    webhookKey: value("VNPOST_WEBHOOK_KEY"),
    senderName: value("VNPOST_SENDER_NAME"),
    senderPhone: value("VNPOST_SENDER_PHONE"),
    senderAddress: value("VNPOST_SENDER_ADDRESS"),
    senderProvince: value("VNPOST_SENDER_PROVINCE"),
    senderWard: value("VNPOST_SENDER_WARD"),
  };
  if (Object.values(required).some((item) => !item) || required.webhookKey.length < 24) return null;
  return {
    baseUrl: (value("VNPOST_BASE_URL") || "https://my-uat.vnpost.vn/MYVNP_API").replace(/\/+$/, ""),
    username: required.username,
    password: required.password,
    customerCode: required.customerCode,
    contractCode: value("VNPOST_CONTRACT_CODE") || null,
    serviceCode: required.serviceCode,
    webhookKey: required.webhookKey,
    sender: { name: required.senderName, phone: required.senderPhone, address: required.senderAddress, provinceName: required.senderProvince, wardName: required.senderWard },
  };
}

// Tiền thu hộ của vận đơn để CONG_VIEC_25 đối soát COD; lớp kết nối chỉ đọc, không đối soát.
export interface VnpostCashOnDelivery {
  status: string;
  codAmount: string | null;
  // Trạng thái 21 "Đã trả tiền COD": VNPost đã trả tiền thu hộ cho bên gửi.
  codPaid: boolean;
  paymentStatus: string | null;
  fee: string | null;
}

type VnpostOrder = { originalID?: string; itemCode?: string | null; status?: number | string; totalFee?: number | null; codAmount?: number | null; paymentStatus?: string | null };
type Region = { code: string; name: string; provinceCode: string | null };
type Catalog = { loadedAt: number; provinces: Region[]; communes: Region[] };

const timeoutMilliseconds = 15_000;
const catalogLifetimeMilliseconds = 24 * 3_600_000;
// QUYTAC_NGHIEPVU_182: ánh xạ trạng thái MyVNPost (Phụ lục "Danh mục trạng thái đơn hàng") sang giai đoạn của khung.
const waiting = new Set(["1", "2", "3", "4", "5"]);
const picked = new Set(["6", "7", "10", "11", "12", "13", "15", "16", "17", "18", "24"]);
const delivered = new Set(["14", "21"]);
const returned = new Set(["19"]);
const cancelled = new Set(["9", "22", "29"]);
const codPaidStatus = "21";

// Token và danh mục địa chỉ dùng chung giữa các lần tạo lớp kết nối, theo môi trường và tài khoản.
const tokens = new Map<string, Promise<string>>();
const catalogs = new Map<string, Promise<Catalog>>();

// Chuẩn hóa tên địa chỉ để so khớp tên của VComm ("Phường Ba Đình", "Thành phố Hà Nội") với tên của VNPost ("P. Ba Đình", "TP. Hà Nội").
const prefixes: [RegExp, string][] = [
  [/^tp\.?\s*/, "thành phố "],
  [/^p\.\s*/, "phường "],
  [/^x\.\s*/, "xã "],
  [/^tt\.\s*/, "thị trấn "],
  [/^đk\.\s*/, "đặc khu "],
];
const kinds = /^(thành phố|tỉnh|phường|xã|thị trấn|đặc khu)\s+/;
function fullName(name: string): string {
  let text = name.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of prefixes) text = text.replace(pattern, replacement);
  return text;
}
const bareName = (name: string) => fullName(name).replace(kinds, "");
const plainName = (name: string) => bareName(name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

// Tìm đúng một mục theo tên: so tên đầy đủ, rồi tên bỏ loại (phường, xã), rồi tên bỏ dấu; nhiều kết quả thì không đoán.
function findRegion(regions: Region[], name: string, label: string): Region {
  for (const key of [fullName, bareName, plainName]) {
    const wanted = key(name);
    const matches = regions.filter((region) => key(region.name) === wanted);
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) throw new CarrierFailure("rejected", `VNPost có nhiều ${label} trùng tên "${name}"`);
  }
  throw new CarrierFailure("rejected", `Không tìm thấy ${label} "${name}" trong danh mục của VNPost`);
}

// Kết quả getOrder có thể là một đơn, một danh sách đơn hoặc danh sách nhóm { results: [...] } (ví dụ trong tài liệu).
function ordersIn(payload: unknown): VnpostOrder[] {
  if (Array.isArray(payload)) return payload.flatMap(ordersIn);
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.results)) return record.results.flatMap(ordersIn);
  if ("data" in record && !("itemCode" in record) && !("originalID" in record)) return ordersIn(record.data);
  return "itemCode" in record || "originalID" in record ? [record as VnpostOrder] : [];
}

const money = (value: number | null | undefined) => (typeof value === "number" && Number.isFinite(value) ? String(value) : null);

export class VnpostCarrier implements CarrierAdapter {
  readonly code = "vnpost" as const;

  constructor(private readonly configuration: VnpostConfiguration) {}

  private get accountKey(): string {
    return `${this.configuration.baseUrl}|${this.configuration.username}|${this.configuration.customerCode}`;
  }

  private async send(method: "GET" | "POST", path: string, body: unknown, headers: Record<string, string>): Promise<{ status: number; payload: unknown }> {
    let response: Response;
    try {
      response = await fetch(`${this.configuration.baseUrl}${path}`, {
        method,
        headers: { "content-type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMilliseconds),
      });
    } catch (error) {
      throw new CarrierFailure("unavailable", `VNPost không trả lời: ${(error as Error).message}`);
    }
    const text = await response.text().catch(() => "");
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // VNPost trả thông báo lỗi dạng chuỗi ("Invalid parameters request").
    }
    if (response.status >= 500) throw new CarrierFailure("unavailable", `VNPost lỗi ${response.status}`);
    return { status: response.status, payload };
  }

  // Một lần đăng nhập dùng chung cho các lời gọi đồng thời.
  private token(): Promise<string> {
    const key = this.accountKey;
    const cached = tokens.get(key);
    if (cached) return cached;
    const loading = this.login().catch((error: unknown) => {
      tokens.delete(key);
      throw error;
    });
    tokens.set(key, loading);
    return loading;
  }

  private async login(): Promise<string> {
    const { status, payload } = await this.send(
      "POST",
      "/GetAccessToken",
      { username: this.configuration.username, password: this.configuration.password, customerCode: this.configuration.customerCode },
      {},
    );
    const result = payload as { success?: unknown; token?: unknown; errorMessage?: unknown } | null;
    if (status !== 200 || !result || (result.success !== true && result.success !== "true") || typeof result.token !== "string" || !result.token) {
      throw new CarrierFailure("rejected", `VNPost từ chối đăng nhập: ${typeof result?.errorMessage === "string" ? result.errorMessage : status}`);
    }
    return result.token;
  }

  // Gọi API có token; token hết hạn (401, 403) thì lấy token mới và gọi lại một lần.
  private async call(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const pendingToken = this.token();
      const { status, payload } = await this.send(method, path, body, { token: await pendingToken });
      if ((status === 401 || status === 403) && attempt === 0) {
        // Chỉ bỏ token vừa dùng; lời gọi khác có thể đã lấy token mới.
        if (tokens.get(this.accountKey) === pendingToken) tokens.delete(this.accountKey);
        continue;
      }
      if (status !== 200) throw new CarrierFailure("rejected", `VNPost từ chối (${status}): ${typeof payload === "string" ? payload : JSON.stringify(payload)}`.slice(0, 300));
      return payload;
    }
  }

  // Danh mục tỉnh, xã hai cấp của VNPost (mã riêng của VNPost, khác mã Tổng cục Thống kê); giữ 24 giờ (QUYTAC_NGHIEPVU_181).
  private catalog(): Promise<Catalog> {
    const key = this.configuration.baseUrl;
    const cached = catalogs.get(key);
    const load = async (): Promise<Catalog> => {
      const [provinceRows, communeRows] = await Promise.all([this.call("GET", "/getNewProvinceAll"), this.call("GET", "/getNewCommuneAll")]);
      const rows = (payload: unknown) => (Array.isArray(payload) ? payload : ((payload as { data?: unknown } | null)?.data as unknown[]) || []) as Record<string, unknown>[];
      const provinces = rows(provinceRows).map((row) => ({ code: String(row.provinceCode ?? ""), name: String(row.provinceName ?? ""), provinceCode: null }));
      // Tài liệu ghi trường mã tỉnh của xã là provinceCode, ví dụ lại ghi districtCode: đọc cả hai.
      const communes = rows(communeRows).map((row) => ({
        code: String(row.communeCode ?? ""),
        name: String(row.communeName ?? ""),
        provinceCode: String(row.provinceCode ?? row.districtCode ?? ""),
      }));
      if (provinces.length === 0 || communes.length === 0) throw new CarrierFailure("unavailable", "VNPost trả danh mục địa chỉ rỗng");
      return { loadedAt: Date.now(), provinces, communes };
    };
    if (!cached) {
      const loading = load().catch((error: unknown) => {
        catalogs.delete(key);
        throw error;
      });
      catalogs.set(key, loading);
      return loading;
    }
    return cached.then((catalog) => {
      if (Date.now() - catalog.loadedAt < catalogLifetimeMilliseconds) return catalog;
      catalogs.delete(key);
      return this.catalog();
    });
  }

  private async regionCodes(provinceName: string, wardName: string): Promise<{ provinceCode: string; communeCode: string }> {
    const catalog = await this.catalog();
    const province = findRegion(catalog.provinces, provinceName, "tỉnh");
    const commune = findRegion(
      catalog.communes.filter((item) => item.provinceCode === province.code),
      wardName,
      "xã",
    );
    return { provinceCode: province.code, communeCode: commune.code };
  }

  // getOrder: type 1 theo số hiệu bưu gửi (mã vận đơn), 2 theo mã đơn của bên gửi, 3 theo ID gốc. Không có đơn thì null.
  private async order(type: 1 | 2, code: string): Promise<VnpostOrder | null> {
    let payload: unknown;
    try {
      payload = await this.call("GET", `/getOrder?type=${type}&code=${encodeURIComponent(code)}`);
    } catch (error) {
      if (error instanceof CarrierFailure && error.kind === "rejected" && /\(400\)/.test(error.message)) return null;
      throw error;
    }
    const orders = ordersIn(payload);
    return (type === 1 ? orders.find((item) => item.itemCode === code) : orders[0]) ?? null;
  }

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    const { sender } = this.configuration;
    const [senderCodes, receiverCodes] = await Promise.all([this.regionCodes(sender.provinceName, sender.wardName), this.regionCodes(request.provinceName, request.wardName)]);
    const payload = await this.call("POST", "/CreateOrder", {
      orderCreationStatus: 1,
      type: "GUI",
      customerCode: this.configuration.customerCode,
      contractCode: this.configuration.contractCode,
      informationOrder: {
        senderName: sender.name,
        senderPhone: sender.phone,
        senderEmail: null,
        senderAddress: sender.address,
        senderProvinceCode: senderCodes.provinceCode,
        // Địa chỉ hai cấp: mã quận huyện là "VNPOST".
        senderDistrictCode: "VNPOST",
        senderCommuneCode: senderCodes.communeCode,
        receiverName: request.recipientName,
        receiverAddress: request.streetAddress,
        receiverProvinceCode: receiverCodes.provinceCode,
        receiverDistrictCode: "VNPOST",
        receiverCommuneCode: receiverCodes.communeCode,
        receiverPhone: request.recipientPhone,
        receiverEmail: null,
        serviceCode: this.configuration.serviceCode,
        // QUYTAC_NGHIEPVU_183: tiền thu hộ qua dịch vụ cộng thêm GTG021 "Phát hàng thu tiền", thuộc tính PROP0018 là số tiền.
        addonService: request.codAmount > 0 ? [{ code: "GTG021", propValue: `PROP0018:${request.codAmount};PROP0019:null;PROP0020:null` }] : [],
        additionRequest: [],
        orgCodeCollect: null,
        orgCodeAccept: null,
        saleOrderCode: request.clientOrderCode,
        contentNote: request.items
          .map((item) => `${item.name} (SL: ${item.quantity})`)
          .join("; ")
          .slice(0, 500),
        weight: request.weightGrams,
        length: request.lengthCm,
        width: request.widthCm,
        height: request.heightCm,
        vehicle: "BO",
        sendType: "1",
        isBroken: "0",
        deliveryTime: "N",
        deliveryRequire: "1",
        deliveryInstruction: null,
      },
    });
    const created = ordersIn(payload)[0];
    // Không có số hiệu bưu gửi: chưa rõ kết quả, nhân viên tra lại theo số đơn trước khi giao lại.
    if (!created?.itemCode) throw new CarrierFailure("unavailable", "VNPost không trả số hiệu bưu gửi");
    return { trackingCode: created.itemCode, fee: money(created.totalFee), status: String(created.status ?? "1") };
  }

  async cancelShipment(trackingCode: string): Promise<void> {
    const order = await this.order(1, trackingCode);
    if (!order?.originalID) throw new CarrierFailure("rejected", `VNPost không có vận đơn ${trackingCode}`);
    const result = (await this.call("POST", "/orderCancel", { OriginalId: order.originalID })) as { Type?: unknown; Message?: unknown; Note?: unknown } | null;
    if (result?.Type === "00") return;
    // QUYTAC_NGHIEPVU_184: "02 – Chờ xử lý" chưa phải đã hủy; đơn giữ nguyên, VNPost hủy xong thì webhook hủy đơn.
    const reason = result?.Type === "02" ? "VNPost đang xử lý yêu cầu hủy" : [result?.Message, result?.Note].filter((item) => typeof item === "string" && item).join(": ");
    throw new CarrierFailure("rejected", reason || "VNPost không hủy được vận đơn");
  }

  async shipmentStatus(trackingCode: string): Promise<string> {
    const order = await this.order(1, trackingCode);
    if (!order || order.status === undefined || order.status === null) throw new CarrierFailure("rejected", `VNPost không có vận đơn ${trackingCode}`);
    return String(order.status);
  }

  async findShipment(clientOrderCode: string): Promise<CreatedShipment | null> {
    const order = await this.order(2, clientOrderCode);
    if (!order) return null;
    // Có đơn nhưng chưa có số hiệu bưu gửi: chưa ghi nhận được, không bỏ chỗ giữ (tránh tạo trùng).
    if (!order.itemCode) throw new CarrierFailure("unavailable", "Đơn VNPost chưa có số hiệu bưu gửi");
    return { trackingCode: order.itemCode, fee: money(order.totalFee), status: String(order.status ?? "1") };
  }

  // Tiền thu hộ trên vận đơn (API chi tiết getOrder) cho CONG_VIEC_25.
  async cashOnDelivery(trackingCode: string): Promise<VnpostCashOnDelivery> {
    const order = await this.order(1, trackingCode);
    if (!order) throw new CarrierFailure("rejected", `VNPost không có vận đơn ${trackingCode}`);
    const status = String(order.status ?? "");
    return { status, codAmount: money(order.codAmount), codPaid: status === codPaidStatus, paymentStatus: order.paymentStatus ?? null, fee: money(order.totalFee) };
  }

  phaseOf(status: string): CarrierPhase {
    if (waiting.has(status)) return "waiting_pickup";
    if (picked.has(status)) return "picked";
    if (delivered.has(status)) return "delivered";
    if (returned.has(status)) return "returned";
    if (cancelled.has(status)) return "cancelled";
    // 8 lấy hàng thất bại, 20 trả một phần, 23 giao một phần, 28 đã trả phí, mã chưa biết: nhân viên xem, không tự đổi đơn.
    return "attention";
  }

  // Webhook MyVNPost: { data: [đơn...] hoặc chuỗi JSON, sendDate, signature }; lấy số hiệu bưu gửi của đơn đầu tiên.
  trackingCodeOf(payload: unknown): string | null {
    let data = (payload as { data?: unknown } | null)?.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return null;
      }
    }
    const value = (Array.isArray(data) ? data[0] : data) as { itemCode?: unknown } | undefined;
    return typeof value?.itemCode === "string" && /^[A-Za-z0-9]{4,40}$/.test(value.itemCode) ? value.itemCode : null;
  }
}

// Chỉ dùng trong kiểm thử: xóa token, danh mục đã giữ.
export function resetVnpostCaches(): void {
  tokens.clear();
  catalogs.clear();
}
