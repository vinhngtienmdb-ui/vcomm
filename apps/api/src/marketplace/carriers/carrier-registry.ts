// Khung đơn vị vận chuyển chung (CONG_VIEC_24; QUYTAC_NGHIEPVU_160). Thông tin kết nối chỉ ở biến môi trường.
// Mã chưa có lớp kết nối trả về chưa cấu hình.
import type { CarrierCode } from "contracts";
import type { CarrierAdapter } from "./carrier";
import { GhnCarrier } from "./ghn-carrier";
import { GhtkCarrier } from "./ghtk-carrier";

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

export function carrierConfigured(code: CarrierCode): boolean {
  return carrierAdapter(code) !== null;
}

// Lớp kết nối của đơn vị vận chuyển; null khi chưa có thông tin kết nối hoặc chưa có lớp kết nối.
export function carrierAdapter(code: CarrierCode): CarrierAdapter | null {
  if (code === "ghn") {
    const configuration = ghnConfiguration();
    return configuration ? new GhnCarrier(configuration) : null;
  }
  if (code === "ghtk") {
    const configuration = ghtkConfiguration();
    return configuration ? new GhtkCarrier(configuration) : null;
  }
  return null;
}

export function webhookKeyOf(code: CarrierCode): string | null {
  if (code === "ghn") return ghnConfiguration()?.webhookKey ?? null;
  if (code === "ghtk") return ghtkConfiguration()?.webhookKey ?? null;
  return null;
}
