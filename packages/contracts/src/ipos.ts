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

// ---- Lát L1: quầy, thiết bị, đăng nhập trên thiết bị, thu ngân tự đăng ký (QUYTAC_NGHIEPVU_604 đến 607) ----
// Thiết bị gửi khóa thiết bị qua tiêu đề `x-ipos-device`.
export const iposDeviceHeader = "x-ipos-device";
const phone = z
  .string()
  .trim()
  .transform((value) => {
    const digits = value.replace(/[\s.()-]/g, "");
    if (/^0\d{9}$/.test(digits)) return `+84${digits.slice(1)}`;
    if (/^84\d{9}$/.test(digits)) return `+${digits}`;
    return digits;
  })
  .pipe(z.string().regex(/^\+84\d{9}$/, "invalidPhone"));
const otpCode = z.string().trim().regex(/^\d{6}$/, "invalidValue");
const merchantCode = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^CH\d{6}$/, "invalidValue"));

export const iposPairSchema = z
  .object({
    // 8 ký tự chữ in hoa và số; cho phép gõ kèm dấu gạch, khoảng trắng.
    code: z
      .string()
      .trim()
      .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9]{8}$/, "invalidValue")),
    model: z.string().trim().max(100).nullable().optional(),
    appVersion: z.string().trim().max(30).nullable().optional(),
  })
  .strict();
export type IposMemberRole = "owner" | "cashier";
export interface IposDeviceMember {
  memberId: string;
  fullName: string;
  role: IposMemberRole;
  locked: boolean;
}
export interface IposDeviceInfo {
  deviceId: string;
  merchantCode: string;
  merchantName: string;
  outletId: string;
  outletName: string;
  registerId: string;
  registerName: string;
  subscriptionStatus: IposSubscriptionStatus | null;
  // Người đã đặt mã PIN trên máy này.
  members: IposDeviceMember[];
}
export interface IposPairResult {
  // Khóa thiết bị chỉ trả một lần; máy lưu trong kho bảo mật.
  deviceKey: string;
  device: IposDeviceInfo;
}
export const iposLoginOtpSchema = z.object({ phone }).strict();
// Đăng nhập lần đầu: Smart OTP trên ứng dụng VComm (ưu tiên) hoặc mã SMS dự phòng trong thời hạn chuyển đổi (CONG_VIEC_72).
export const iposLoginSchema = z.object({ phone, code: otpCode, method: z.enum(["smart_otp", "sms"]) }).strict();
// Mã PIN 6 số; không nhận 6 số giống nhau hoặc dãy tăng, giảm (kiểm ở máy chủ, lỗi `iposPinWeak`).
export const iposPinSchema = z.object({ pin: z.string().regex(/^\d{6}$/, "invalidValue") }).strict();
export const iposPinLoginSchema = z.object({ memberId: z.string().uuid(), pin: z.string().regex(/^\d{6}$/, "invalidValue") }).strict();
export interface IposLoginResult {
  tokens: { accessToken: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string };
  member: IposDeviceMember & { hasPin: boolean };
}
export interface IposMe {
  member: IposDeviceMember & { hasPin: boolean };
  device: IposDeviceInfo;
  // Hết 12 giờ kể từ đăng nhập thì phải đăng nhập lại.
  sessionExpiresAt: string;
}

export const iposRegistrationOtpSchema = z.object({ merchantCode, phone }).strict();
export const iposRegistrationSchema = z
  .object({
    merchantCode,
    phone,
    code: otpCode,
    fullName: z.string().trim().min(1).max(100),
    outletIds: z.array(z.string().uuid()).max(50),
  })
  .strict();
export interface IposRegistrationOutlet {
  id: string;
  name: string;
  address: string;
}
export interface IposRegistrationCreated {
  id: string;
  status: "pending";
  expiresAt: string;
}

// Cổng cửa hàng: quyền vào nhóm iPOS, quầy, thiết bị, yêu cầu đăng ký.
export interface IposPortalOutlet {
  outletId: string;
  outletName: string;
  subscriptionId: string;
  subscriptionStatus: IposSubscriptionStatus;
  endsOn: string;
  planName: string;
  maxRegisters: number;
  activeRegisters: number;
}
export interface IposPortalAccess {
  // Có ít nhất một thuê bao chưa hủy, hoặc thuê bao đã hủy trong 12 tháng (chỉ xem).
  enabled: boolean;
  isOwner: boolean;
  outlets: IposPortalOutlet[];
  pendingRegistrations: number;
}
export const iposRegisterCreateSchema = z.object({ outletId: z.string().uuid(), name: z.string().trim().min(1).max(50) }).strict();
export const iposRegisterUpdateSchema = z.object({ name: z.string().trim().min(1).max(50), status: z.enum(["active", "inactive"]), version }).strict();
export interface IposRegisterDevice {
  id: string;
  model: string | null;
  appVersion: string | null;
  pairedAt: string;
  pairedByName: string;
  lastSeenAt: string;
}
export interface IposRegisterItem {
  id: string;
  outletId: string;
  outletName: string;
  name: string;
  status: "active" | "inactive";
  // Quầy đang hoạt động vượt số quầy của thuê bao (mới nhất trước) không mở ca được (QUYTAC_NGHIEPVU_597).
  overLimit: boolean;
  device: IposRegisterDevice | null;
  version: number;
}
export interface IposPairingCode {
  code: string;
  expiresAt: string;
}
export const iposRegistrationStatuses = ["pending", "approved", "rejected", "expired"] as const;
export type IposRegistrationStatus = (typeof iposRegistrationStatuses)[number];
export interface IposCashierRegistration {
  id: string;
  fullName: string;
  phone: string;
  requestedOutlets: { id: string; name: string }[];
  status: IposRegistrationStatus;
  createdAt: string;
  expiresAt: string;
  reason: string | null;
}
export const iposRegistrationApproveSchema = z.object({ outletIds: z.array(z.string().uuid()).min(1).max(50) }).strict();
export const iposRegistrationRejectSchema = z.object({ reason: reason.nullable() }).strict();

// Lát L2: danh mục hàng (QUYTAC_NGHIEPVU_608), nhập Excel (QUYTAC_NGHIEPVU_610), tồn kho (QUYTAC_NGHIEPVU_611).
const wholeMoney = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .pipe(z.string().regex(/^\d{1,13}$/, "invalidValue"));
const stockQuantity = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .pipe(z.string().regex(/^\d{1,11}(\.\d{1,3})?$/, "invalidValue"));
const unitCost = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(",", "."))
  .pipe(z.string().regex(/^\d{1,13}(\.\d{1,4})?$/, "invalidValue"));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value ? value : null));
export const iposVatRates = ["0", "5", "8", "10", "exempt"] as const;
export type IposVatRate = (typeof iposVatRates)[number];
export type IposActiveStatus = "active" | "inactive";
export const iposItemMaxVariants = 100;
export const iposImportMaximumRows = 5000;
export const iposImportMaximumBytes = 5 * 1024 * 1024;
export const iposImportColumns = ["Mã", "Tên", "Nhóm", "Nhóm con", "Đơn vị tính", "Giá bán", "Thuế suất", "Theo dõi tồn kho", "Mã vạch", "Tồn đầu kỳ", "Giá nhập"] as const;

export const iposCategoryCreateSchema = z
  .object({ name: z.string().trim().min(1).max(100), parentId: z.string().uuid().nullable(), sortOrder: z.number().int().min(0).max(9999) })
  .strict();
export const iposCategoryUpdateSchema = z
  .object({ name: z.string().trim().min(1).max(100), parentId: z.string().uuid().nullable(), sortOrder: z.number().int().min(0).max(9999), status: z.enum(["active", "inactive"]), version })
  .strict();
export interface IposCategory {
  id: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
  status: IposActiveStatus;
  activeItems: number;
  version: number;
}

const barcode = z.string().trim().min(1).max(50);
export const iposVariantInputSchema = z
  .object({
    id: z.string().uuid().nullable(),
    code: z.string().trim().max(30).transform((value) => value.toUpperCase()),
    attribute1Value: optionalText(50),
    attribute2Value: optionalText(50),
    price: wholeMoney.nullable(),
    minQuantity: stockQuantity.nullable(),
    barcodes: z.array(barcode).max(20),
    status: z.enum(["active", "inactive"]),
  })
  .strict();
const itemFields = {
  name: z.string().trim().min(1).max(200),
  categoryId: z.string().uuid().nullable(),
  unit: z.string().trim().min(1).max(20),
  price: wholeMoney,
  vatRate: z.enum(iposVatRates),
  trackStock: z.boolean(),
  attribute1Name: optionalText(30),
  attribute2Name: optionalText(30),
  variants: z.array(iposVariantInputSchema).min(1).max(iposItemMaxVariants),
};
export const iposItemCreateSchema = z
  .object({ code: z.string().trim().max(30).transform((value) => value.toUpperCase()), ...itemFields })
  .strict();
export const iposItemUpdateSchema = z
  .object({ code: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()), ...itemFields, status: z.enum(["active", "inactive"]), version })
  .strict();
export const iposOutletPricesSchema = z
  .object({ prices: z.array(z.object({ outletId: z.string().uuid(), variantId: z.string().uuid(), price: wholeMoney.nullable() }).strict()).max(5000) })
  .strict();
export interface IposItemRow {
  id: string;
  code: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  unit: string;
  minPrice: string;
  maxPrice: string;
  vatRate: IposVatRate;
  trackStock: boolean;
  variantCount: number;
  barcodes: string[];
  status: IposActiveStatus;
}
export interface IposItemPage {
  items: IposItemRow[];
  total: number;
  page: number;
  pageSize: number;
  // Số biến thể đang bán so với giới hạn mặt hàng của gói (null: không giới hạn).
  activeVariants: number;
  maxItems: number | null;
  planName: string | null;
}
export interface IposVariant {
  id: string;
  code: string;
  attribute1Value: string | null;
  attribute2Value: string | null;
  price: string | null;
  minQuantity: string | null;
  barcodes: string[];
  status: IposActiveStatus;
  outletPrices: { outletId: string; price: string }[];
}
export interface IposItemDetail {
  id: string;
  code: string;
  name: string;
  categoryId: string | null;
  unit: string;
  price: string;
  vatRate: IposVatRate;
  trackStock: boolean;
  attribute1Name: string | null;
  attribute2Name: string | null;
  status: IposActiveStatus;
  variants: IposVariant[];
  version: number;
}

export interface IposImportError {
  row: number;
  column: string | null;
  message: string;
}
export interface IposImportResult {
  rows: number;
  creates: number;
  updates: number;
  openingStockRows: number;
  errors: IposImportError[];
  committed: boolean;
  receiptNumber: string | null;
}

// Tồn kho.
export interface IposVariantOption {
  variantId: string;
  itemCode: string;
  variantCode: string;
  name: string;
  unit: string;
}
export interface IposStockRow {
  variantId: string;
  itemId: string;
  itemCode: string;
  variantCode: string;
  name: string;
  unit: string;
  quantity: string;
  minQuantity: string | null;
  averageCost: string;
  value: string;
}
export const iposStockDocumentKinds = ["receipt", "adjustment"] as const;
export type IposStockDocumentKind = (typeof iposStockDocumentKinds)[number];
export const iposStockDocumentSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("receipt"),
      outletId: z.string().uuid(),
      note: optionalText(500),
      lines: z
        .array(z.object({ variantId: z.string().uuid(), quantity: stockQuantity, unitCost }).strict())
        .min(1)
        .max(500),
    })
    .strict(),
  z
    .object({
      kind: z.literal("adjustment"),
      outletId: z.string().uuid(),
      note: z.string().trim().min(1).max(500),
      lines: z
        .array(z.object({ variantId: z.string().uuid(), actualQuantity: stockQuantity }).strict())
        .min(1)
        .max(500),
    })
    .strict(),
]);
export type IposStockDocumentInput = z.infer<typeof iposStockDocumentSchema>;
export interface IposStockDocumentRow {
  id: string;
  number: string;
  kind: IposStockDocumentKind;
  source: "manual" | "import";
  outletId: string;
  outletName: string;
  note: string | null;
  lineCount: number;
  totalCost: string | null;
  createdByName: string;
  createdAt: string;
}
export interface IposStockDocumentDetail extends IposStockDocumentRow {
  lines: {
    variantId: string;
    itemCode: string;
    variantCode: string;
    name: string;
    unit: string;
    quantity: string | null;
    unitCost: string | null;
    actualQuantity: string | null;
    beforeQuantity: string;
  }[];
}
export interface IposStockMove {
  id: string;
  occurredAt: string;
  variantId: string;
  itemCode: string;
  variantCode: string;
  name: string;
  quantity: string;
  unitCost: string;
  balanceAfter: string;
  sourceType: "stock_document" | "sale" | "return";
  sourceId: string;
  sourceNumber: string;
  createdByName: string;
}
