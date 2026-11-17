// Băm mã cài đặt ứng dụng (tiêu đề X-Device-Id; QUYTAC_NGHIEPVU_474 của CONG_VIEC_60). Dùng chung cho chống gian lận điểm và
// thiết bị tin cậy, Smart OTP (CONG_VIEC_72): cùng khóa băm nên thiết bị đã ghi nhận ở CONG_VIEC_60 nạp được làm thiết bị tin cậy.
// Mã cài đặt 16 đến 128 ký tự chữ, số, gạch; sai định dạng thì bỏ qua.
import { createHmac } from "node:crypto";
import { purposeKey } from "./secret-box";

export function deviceHashOf(deviceId: string | null | undefined): string | null {
  if (!deviceId || !/^[A-Za-z0-9_-]{16,128}$/.test(deviceId)) return null;
  return createHmac("sha256", purposeKey("loyalty-device")).update(deviceId, "utf8").digest("hex");
}
