// Token truy cập ký bằng HMAC-SHA256, sống 15 phút; token làm mới ngẫu nhiên, chỉ lưu bản băm (tài liệu 22 mục 3).
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const accessTokenLifetimeSeconds = 15 * 60;
export const refreshTokenLifetimeDays = { web: 30, warehouse_app: 90, sales_app: 90 } as const;

export interface AccessTokenPayload {
  sessionId: string;
  userId: string;
  expiresAt: number; // giây kể từ 1970
}

function secret(): Buffer {
  const value = process.env.ACCESS_TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error("ACCESS_TOKEN_SECRET phải có ít nhất 32 ký tự.");
  }
  return Buffer.from(value, "utf8");
}

const encode = (value: Buffer | string) => Buffer.from(value).toString("base64url");

export function signAccessToken(payload: AccessTokenPayload): string {
  const body = encode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyAccessToken(token: string, nowSeconds = Math.floor(Date.now() / 1000)): AccessTokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AccessTokenPayload;
    return payload.expiresAt > nowSeconds ? payload : null;
  } catch {
    return null;
  }
}

export function newRandomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): Buffer {
  return createHash("sha256").update(token).digest();
}
