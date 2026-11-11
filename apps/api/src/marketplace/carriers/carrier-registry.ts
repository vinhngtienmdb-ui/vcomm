// Khung đơn vị vận chuyển chung (CONG_VIEC_24; QUYTAC_NGHIEPVU_160). Thông tin kết nối chỉ ở biến môi trường.
// Mã chưa có lớp kết nối (hoặc thiếu biến môi trường) được coi là chưa cấu hình.
import type { CarrierCode } from "contracts";
import type { CarrierAdapter } from "./carrier";
import { GhnCarrier } from "./ghn-carrier";
import { JtCarrier } from "./jt-carrier";

export interface GhnConfiguration {
  baseUrl: string;
  token: string;
  shopId: string;
  webhookKey: string;
}

// GHN_BASE_URL mặc định là môi trường thử nghiệm của GHN; môi trường thật đặt https://online-gateway.ghn.vn.
export function ghnConfiguration(): GhnConfiguration | null {
  const token = process.env.GHN_API_TOKEN?.trim();
  const shopId = process.env.GHN_SHOP_ID?.trim();
  const webhookKey = process.env.GHN_WEBHOOK_KEY?.trim();
  if (!token || !shopId || !webhookKey || webhookKey.length < 24) return null;
  return { baseUrl: (process.env.GHN_BASE_URL?.trim() || "https://dev-online-gateway.ghn.vn").replace(/\/+$/, ""), token, shopId, webhookKey };
}

export interface JtConfiguration {
  baseUrl: string;
  apiAccount: string;
  privateKey: string;
  customerCode: string;
  customerPassword: string;
  webhookKey: string;
  // Điểm lấy hàng (người gửi) J&T bắt buộc trong mỗi vận đơn (QUYTAC_NGHIEPVU_191).
  sender: { name: string; phone: string; provinceName: string; wardName: string; streetAddress: string };
}

// CONG_VIEC_30: JT_BASE_URL mặc định là môi trường thử nghiệm của J&T; môi trường thật đặt https://ylopenapi.jtexpress.vn.
export function jtConfiguration(): JtConfiguration | null {
  const value = (name: string) => process.env[name]?.trim() ?? "";
  const configuration: JtConfiguration = {
    baseUrl: (value("JT_BASE_URL") || "https://demoopenapi.jtexpress.vn").replace(/\/+$/, ""),
    apiAccount: value("JT_API_ACCOUNT"),
    privateKey: value("JT_PRIVATE_KEY"),
    customerCode: value("JT_CUSTOMER_CODE"),
    customerPassword: value("JT_CUSTOMER_PASSWORD"),
    webhookKey: value("JT_WEBHOOK_KEY"),
    sender: {
      name: value("JT_SENDER_NAME"),
      phone: value("JT_SENDER_PHONE"),
      provinceName: value("JT_SENDER_PROVINCE"),
      wardName: value("JT_SENDER_WARD"),
      streetAddress: value("JT_SENDER_ADDRESS"),
    },
  };
  const required = [configuration.apiAccount, configuration.privateKey, configuration.customerCode, configuration.customerPassword, ...Object.values(configuration.sender)];
  if (required.some((item) => !item) || configuration.webhookKey.length < 24) return null;
  return configuration;
}

// Lớp kết nối của đơn vị vận chuyển; null khi chưa có lớp kết nối hoặc thông tin kết nối.
export function carrierAdapter(code: CarrierCode): CarrierAdapter | null {
  if (code === "ghn") {
    const configuration = ghnConfiguration();
    return configuration ? new GhnCarrier(configuration) : null;
  }
  if (code === "jt") {
    const configuration = jtConfiguration();
    return configuration ? new JtCarrier(configuration) : null;
  }
  return null;
}

export function carrierConfigured(code: CarrierCode): boolean {
  return carrierAdapter(code) !== null;
}

export function webhookKeyOf(code: CarrierCode): string | null {
  if (code === "ghn") return ghnConfiguration()?.webhookKey ?? null;
  if (code === "jt") return jtConfiguration()?.webhookKey ?? null;
  return null;
}
