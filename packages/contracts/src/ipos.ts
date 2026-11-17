// CONG_VIEC_74: iPOS (MODULE_17). Tệp riêng để không sửa cùng chỗ với công việc khác.
// Tiền là chuỗi số thập phân; ngày dạng YYYY-MM-DD.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidValue");
const nonNegativeMoney = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .pipe(z.string().regex(/^\d{1,14}(\.\d{1,4})?$/, "invalidValue"));
const reason = z.string().trim().min(1).max(500);
const version = z.number().int().min(1);

// Gói iPOS (QUYTAC_NGHIEPVU_594).
export const iposPlanStatuses = ["selling", "retired"] as const;
export type IposPlanStatus = (typeof iposPlanStatuses)[number];
export const iposTaxPercents = ["0", "5", "8", "10"] as const;
const planFields = {
  name: z.string().trim().min(1).max(100),
  monthlyPrice: nonNegativeMoney,
  taxPercent: z.enum(iposTaxPercents),
  maxRegisters: z.number().int().min(1).max(50),
  maxItems: z.number().int().min(100).max(100000).nullable(),
  trialDays: z.number().int().min(0).max(90),
};
export const iposPlanCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9-]{1,20}$/, "invalidValue")),
    ...planFields,
  })
  .strict();
export const iposPlanUpdateSchema = z.object({ ...planFields, status: z.enum(iposPlanStatuses), version }).strict();
export interface IposPlan {
  id: string;
  code: string;
  name: string;
  monthlyPrice: string;
  taxPercent: string;
  maxRegisters: number;
  maxItems: number | null;
  trialDays: number;
  status: IposPlanStatus;
  activeSubscriptions: number;
  version: number;
}

// Cách thu phí theo cửa hàng (QUYTAC_NGHIEPVU_598).
export const iposBillingMethods = ["collection_deduction", "settlement_deduction", "vietqr", "free"] as const;
export type IposBillingMethod = (typeof iposBillingMethods)[number];
export const iposBillingSchema = z
  .object({
    method: z.enum(iposBillingMethods),
    freeUntil: isoDate.nullable(),
    freeReason: reason.nullable(),
    // Trống khi cửa hàng chưa có cấu hình cách thu.
    version: version.nullable(),
  })
  .strict()
  .refine((value) => (value.method === "free") === (value.freeReason !== null), { message: "required", path: ["freeReason"] })
  .refine((value) => value.method === "free" || value.freeUntil === null, { message: "invalidValue", path: ["freeUntil"] });
export interface IposBilling {
  method: IposBillingMethod;
  freeUntil: string | null;
  freeReason: string | null;
  version: number;
}

// Thuê bao điểm bán (QUYTAC_NGHIEPVU_595 đến 597).
export const iposSubscriptionStatuses = ["trial", "active", "overdue", "locked", "cancelled"] as const;
export type IposSubscriptionStatus = (typeof iposSubscriptionStatuses)[number];
export const iposPeriods = [1, 6, 12] as const;
const subscriptionTerms = {
  planId: z.string().uuid(),
  periodMonths: z.union([z.literal(1), z.literal(6), z.literal(12)]),
  customMonthlyPrice: nonNegativeMoney.nullable(),
  customMaxRegisters: z.number().int().min(1).max(50).nullable(),
};
export const iposSubscriptionCreateSchema = z
  .object({
    outletId: z.string().uuid(),
    startsOn: isoDate,
    // Trống: số ngày dùng thử mặc định của gói.
    trialDays: z.number().int().min(0).max(90).nullable(),
    ...subscriptionTerms,
  })
  .strict();
export const iposSubscriptionUpdateSchema = z.object({ ...subscriptionTerms, version }).strict();
export const iposSubscriptionActionSchema = z.object({ reason: reason.nullable().optional(), version }).strict();
export const iposSubscriptionListQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  status: z.enum(iposSubscriptionStatuses).optional(),
  // Hết hạn trong số ngày tới (lọc thuê bao sắp hết hạn).
  endsWithinDays: z.coerce.number().int().min(0).max(366).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export interface IposSubscription {
  id: string;
  merchantId: string;
  merchantCode: string;
  merchantName: string;
  outletId: string;
  outletName: string;
  planId: string;
  planCode: string;
  planName: string;
  periodMonths: number;
  startsOn: string;
  trialEndsOn: string | null;
  endsOn: string;
  customMonthlyPrice: string | null;
  customMaxRegisters: number | null;
  // Giá mỗi tháng, số quầy tối đa đang áp (riêng hoặc theo gói).
  monthlyPrice: string;
  maxRegisters: number;
  maxItems: number | null;
  status: IposSubscriptionStatus;
  lockedManually: boolean;
  statusReason: string | null;
  billingMethod: IposBillingMethod | null;
  version: number;
}
// Khối iPOS trong chi tiết cửa hàng liên kết (MAN_HINH_304).
export interface IposMerchantOverview {
  billing: IposBilling | null;
  subscriptions: IposSubscription[];
  // Điểm bán đang hoạt động chưa có thuê bao chưa hủy.
  availableOutlets: { id: string; name: string }[];
  canManage: boolean;
}
