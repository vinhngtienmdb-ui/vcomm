// Khung đơn vị vận chuyển chung (CONG_VIEC_24; QUYTAC_NGHIEPVU_160). Thông tin kết nối chỉ ở biến môi trường.
import type { CarrierCode } from "contracts";
import type { CarrierAdapter } from "./carrier";
import { GhnCarrier } from "./ghn-carrier";

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

export function carrierConfigured(code: CarrierCode): boolean {
  if (code === "ghn") return ghnConfiguration() !== null;
  return false;
}

// Lớp kết nối của đơn vị vận chuyển; null khi chưa có thông tin kết nối.
export function carrierAdapter(code: CarrierCode): CarrierAdapter | null {
  const configuration = code === "ghn" ? ghnConfiguration() : null;
  return configuration ? new GhnCarrier(configuration) : null;
}

export function webhookKeyOf(code: CarrierCode): string | null {
  return code === "ghn" ? (ghnConfiguration()?.webhookKey ?? null) : null;
}
