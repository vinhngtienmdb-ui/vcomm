// Mã hóa bí mật khi lưu (AES-256-GCM): khóa TOTP, khóa nhà cung cấp trong Cài đặt tích hợp (tài liệu 22, QUYTAC_NGHIEPVU_31).
// Khóa mã hóa lấy từ biến môi trường MFA_SECRET_KEY; môi trường thật dùng khóa AWS KMS (tài liệu 22).
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const value = process.env.MFA_SECRET_KEY;
  if (!value || value.length < 32) throw new Error("MFA_SECRET_KEY phải có ít nhất 32 ký tự.");
  return createHash("sha256").update(value).digest();
}

export function encryptSecret(plain: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

export function decryptSecret(data: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

// Mã băm có khóa (HMAC-SHA256) để kiểm trùng giá trị đã mã hóa mà không lưu giá trị rõ (CONG_VIEC_46, QUYTAC_NGHIEPVU_295).
export function blindIndex(plain: string): Buffer {
  return createHmac("sha256", encryptionKey()).update(plain.trim().toUpperCase(), "utf8").digest();
}
