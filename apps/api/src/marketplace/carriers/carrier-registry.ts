// Khung đơn vị vận chuyển chung (CONG_VIEC_24; QUYTAC_NGHIEPVU_160). Thông tin kết nối chỉ ở biến môi trường.
// Đơn vị chưa có lớp kết nối hoặc chưa đủ biến môi trường: chưa cấu hình (null).
import type { CarrierCode } from "contracts";
import type { CarrierAdapter } from "./carrier";
import { GhnCarrier } from "./ghn-carrier";
import { ViettelPostCarrier } from "./viettel-post-carrier";

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
  if (code === "viettel_post") {
    const configuration = viettelPostConfiguration();
    return configuration ? new ViettelPostCarrier(configuration) : null;
  }
  return null;
}

export function carrierConfigured(code: CarrierCode): boolean {
  return carrierAdapter(code) !== null;
}

export function webhookKeyOf(code: CarrierCode): string | null {
  if (code === "ghn") return ghnConfiguration()?.webhookKey ?? null;
  if (code === "viettel_post") return viettelPostConfiguration()?.webhookKey ?? null;
  return null;
}
