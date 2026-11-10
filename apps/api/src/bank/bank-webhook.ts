// Đọc webhook giao dịch của dịch vụ trung gian (CONG_VIEC_18; QUYTAC_NGHIEPVU_113, 114).
// SePay: https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook. Bộ giả lập gửi cùng định dạng.
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export type ParsedTransaction = {
  externalId: string;
  transactionAt: Date;
  direction: "in" | "out";
  amount: string;
  content: string;
  referenceCode: string | null;
  balanceAfter: string | null;
  accountNumber: string | null;
};

const money = z.union([z.number().positive(), z.string().regex(/^\d{1,16}(\.\d{1,4})?$/)]).transform(String);
const sepayPayloadSchema = z.object({
  id: z.union([z.number().int(), z.string().min(1).max(100)]).transform(String),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  transferType: z.enum(["in", "out"]),
  transferAmount: money,
  accumulated: z.union([z.number(), z.string().regex(/^-?\d{1,16}(\.\d{1,4})?$/)]).nullish(),
  content: z.string().max(1000).nullish(),
  description: z.string().max(2000).nullish(),
  referenceCode: z.string().max(100).nullish(),
  accountNumber: z.string().max(50).nullish(),
});

// Ngày giờ SePay theo giờ Việt Nam, không kèm múi giờ.
export function parseWebhook(body: unknown): ParsedTransaction | null {
  const parsed = sepayPayloadSchema.safeParse(body);
  if (!parsed.success || Number(parsed.data.transferAmount) <= 0) return null;
  const payload = parsed.data;
  const transactionAt = new Date(`${payload.transactionDate.replace(" ", "T")}+07:00`);
  if (Number.isNaN(transactionAt.getTime())) return null;
  return {
    externalId: payload.id,
    transactionAt,
    direction: payload.transferType,
    amount: payload.transferAmount,
    content: (payload.content ?? payload.description ?? "").trim(),
    referenceCode: payload.referenceCode?.trim() || null,
    balanceAfter: payload.accumulated == null ? null : String(payload.accumulated),
    accountNumber: payload.accountNumber?.trim() || null,
  };
}

// Tiêu đề "Authorization: Apikey <khóa>".
export function authorized(header: string | undefined, secret: string): boolean {
  const supplied = /^Apikey\s+(.+)$/i.exec(header?.trim() ?? "")?.[1];
  if (!supplied) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(secret);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const accountDigits = (value: string | null) => (value ?? "").replace(/\D/g, "");
