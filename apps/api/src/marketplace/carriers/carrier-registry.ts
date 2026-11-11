// Khung đơn vị vận chuyển chung (CONG_VIEC_24; QUYTAC_NGHIEPVU_160). Thông tin kết nối chỉ ở biến môi trường.
// Đơn vị chưa có lớp kết nối hoặc chưa đủ biến môi trường: chưa cấu hình (null).
import type { CarrierCode } from "contracts";
import type { CarrierAdapter } from "./carrier";
import { GhnCarrier } from "./ghn-carrier";
import { GhtkCarrier } from "./ghtk-carrier";
import { JtCarrier } from "./jt-carrier";
import { ViettelPostCarrier } from "./viettel-post-carrier";
import { VnpostCarrier, vnpostConfiguration } from "./vnpost-carrier";

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

export interface GhtkConfiguration {
  baseUrl: string;
  token: string;
  clientSource: string;
  webhookKey: string;
  // Địa chỉ lấy hàng (kho xuất của VComm); mã địa chỉ lấy hàng trên GHTK không bắt buộc, có thì GHTK ưu tiên.
  pickAddressId: string | null;
  pickName: string;
  pickTelephone: string;
  pickAddress: string;
  pickProvince: string;
  pickWard: string;
}

// GHTK_BASE_URL mặc định là môi trường thử nghiệm của GHTK; môi trường thật đặt https://services.giaohangtietkiem.vn (CONG_VIEC_31).
export function ghtkConfiguration(): GhtkConfiguration | null {
  const value = (name: string) => process.env[name]?.trim() || null;
  const token = value("GHTK_API_TOKEN");
  const clientSource = value("GHTK_CLIENT_SOURCE");
  const webhookKey = value("GHTK_WEBHOOK_KEY");
  const pickName = value("GHTK_PICK_NAME");
  const pickTelephone = value("GHTK_PICK_TEL");
  const pickAddress = value("GHTK_PICK_ADDRESS");
  const pickProvince = value("GHTK_PICK_PROVINCE");
  const pickWard = value("GHTK_PICK_WARD");
  if (!token || !clientSource || !webhookKey || webhookKey.length < 24 || !pickName || !pickTelephone || !pickAddress || !pickProvince || !pickWard) return null;
  return {
    baseUrl: (value("GHTK_BASE_URL") || "https://services-staging.ghtklab.com").replace(/\/+$/, ""),
    token,
    clientSource,
    webhookKey,
    pickAddressId: value("GHTK_PICK_ADDRESS_ID"),
    pickName,
    pickTelephone,
    pickAddress,
    pickProvince,
    pickWard,
  };
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

export interface ViettelPostConfiguration {
  baseUrl: string;
  token: string;
  serviceCode: string;
  webhookKey: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
}

// CONG_VIEC_29. VIETTEL_POST_BASE_URL mặc định là môi trường thử nghiệm; môi trường thật đặt https://partner.viettelpost.vn.
export function viettelPostConfiguration(): ViettelPostConfiguration | null {
  const value = (name: string) => process.env[name]?.trim() ?? "";
  const configuration = {
    baseUrl: (value("VIETTEL_POST_BASE_URL") || "https://partnerdev.viettelpost.vn").replace(/\/+$/, ""),
    token: value("VIETTEL_POST_TOKEN"),
    serviceCode: value("VIETTEL_POST_SERVICE_CODE"),
    webhookKey: value("VIETTEL_POST_WEBHOOK_KEY"),
    senderName: value("VIETTEL_POST_SENDER_NAME"),
    senderPhone: value("VIETTEL_POST_SENDER_PHONE"),
    senderAddress: value("VIETTEL_POST_SENDER_ADDRESS"),
  };
  if (Object.values(configuration).some((item) => item === "") || configuration.webhookKey.length < 24) return null;
  return configuration;
}

// Lớp kết nối của đơn vị vận chuyển; null khi chưa có lớp kết nối hoặc chưa có thông tin kết nối.
export function carrierAdapter(code: CarrierCode): CarrierAdapter | null {
  if (code === "ghn") {
    const configuration = ghnConfiguration();
    return configuration ? new GhnCarrier(configuration) : null;
  }
  if (code === "ghtk") {
    const configuration = ghtkConfiguration();
    return configuration ? new GhtkCarrier(configuration) : null;
  }
  if (code === "jt") {
    const configuration = jtConfiguration();
    return configuration ? new JtCarrier(configuration) : null;
  }
  if (code === "viettel_post") {
    const configuration = viettelPostConfiguration();
    return configuration ? new ViettelPostCarrier(configuration) : null;
  }
  if (code === "vnpost") {
    const configuration = vnpostConfiguration();
    return configuration ? new VnpostCarrier(configuration) : null;
  }
  return null;
}

export function carrierConfigured(code: CarrierCode): boolean {
  return carrierAdapter(code) !== null;
}

export function webhookKeyOf(code: CarrierCode): string | null {
  if (code === "ghn") return ghnConfiguration()?.webhookKey ?? null;
  if (code === "ghtk") return ghtkConfiguration()?.webhookKey ?? null;
  if (code === "jt") return jtConfiguration()?.webhookKey ?? null;
  if (code === "viettel_post") return viettelPostConfiguration()?.webhookKey ?? null;
  if (code === "vnpost") return vnpostConfiguration()?.webhookKey ?? null;
  return null;
}
