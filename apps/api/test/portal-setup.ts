// CONG_VIEC_72 (QUYTAC_NGHIEPVU_570): kích hoạt lời mời cổng cửa hàng xong phải thiết lập bảo mật (mật khẩu, ứng dụng xác thực) mới vào cổng.
// Hàm dùng chung cho kiểm thử: hoàn tất thiết lập với phiên kích hoạt, trả mã bí mật ứng dụng xác thực để tạo mã khi cần.
import { Secret, TOTP } from "otpauth";
import { expect } from "vitest";
import type { Session } from "./helpers";

export const portalPassword = "MatKhauCong@2026";
export const authenticatorCode = (secret: string, at = Date.now()) => new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({ timestamp: at });

export async function completePortalSetup(session: Session, password = portalPassword): Promise<{ secret: string; backupCodes: string[] } | null> {
  const state = await session.call("get", "/merchant-portal/security");
  expect(state.status, JSON.stringify(state.body)).toBe(200);
  if (state.body.status !== "required") return null;
  if (state.body.needsPassword) expect((await session.call("post", "/merchant-portal/security/password", { body: { password } })).status).toBe(201);
  const enrolled = await session.call("post", "/auth/mfa/enroll");
  expect(enrolled.status).toBe(201);
  const secret = enrolled.body.secretForManualEntry as string;
  const confirmed = await session.call("post", "/auth/mfa/enroll/confirm", { body: { code: authenticatorCode(secret) } });
  expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(201);
  return { secret, backupCodes: confirmed.body.backupCodes };
}
