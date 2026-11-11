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

// Số tiền tối đa 16 chữ số phần nguyên, 4 chữ số lẻ (numeric(20,4)).
const money = z
  .union([z.number(), z.string()])
  .transform(String)
  .pipe(z.string().regex(/^\d{1,16}(\.\d{1,4})?$/));
const signedMoney = z
  .union([z.number(), z.string()])
  .transform(String)
  .pipe(z.string().regex(/^-?\d{1,16}(\.\d{1,4})?$/));
const text = (max: number) =>
  z
    .string()
    .max(max)
    .transform((value) => value.replace(/\u0000/g, ""));
const sepayPayloadSchema = z.object({
  id: z.union([z.number().int(), text(100).pipe(z.string().min(1))]).transform(String),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  transferType: z.enum(["in", "out"]),
  transferAmount: money,
  accumulated: signedMoney.nullish(),
  content: text(1000).nullish(),
  description: text(2000).nullish(),
  referenceCode: text(100).nullish(),
  accountNumber: text(50).nullish(),
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
