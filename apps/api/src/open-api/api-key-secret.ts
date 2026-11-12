// Sinh, băm khóa API đối tác (QUYTAC_NGHIEPVU_480): `vck_` + 32 ký tự chữ, số ngẫu nhiên; chỉ lưu SHA-256 và 8 ký tự đầu.
import { createHash, randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const secretLength = 32;
const keyPattern = /^vck_[A-Za-z0-9]{32}$/;

export interface GeneratedApiKey {
  secret: string;
  prefix: string;
  hash: string;
}

export const hashApiKey = (secret: string): string => createHash("sha256").update(secret, "utf8").digest("hex");

export function generateApiKey(): GeneratedApiKey {
  let body = "";
  // Bỏ byte ≥ 248 để mỗi ký tự có xác suất như nhau (248 = 4 × 62).
  while (body.length < secretLength) {
    for (const byte of randomBytes(secretLength * 2)) {
      if (byte < 248 && body.length < secretLength) body += alphabet[byte % alphabet.length];
    }
  }
  const secret = `vck_${body}`;
  return { secret, prefix: body.slice(0, 8), hash: hashApiKey(secret) };
}

// Chuỗi không đúng định dạng thì khỏi tra cơ sở dữ liệu.
export const isApiKeyFormat = (value: string): boolean => keyPattern.test(value);
