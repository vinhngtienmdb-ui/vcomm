// CONG_VIEC_65: đối tác liên minh điểm ngoài tập đoàn (MODULE_11). Tệp riêng để không sửa cùng chỗ với công việc khác.
// Tiền, phần trăm là chuỗi số thập phân; điểm, số đơn vị điểm đối tác là số nguyên.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const decimal = (maximumIntegerDigits: number) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim().replace(",", "."))
    .pipe(z.string().regex(new RegExp(`^\\d{1,${maximumIntegerDigits}}(\\.\\d{1,4})?$`), "invalidValue"));
const money = decimal(14).refine((value) => Number(value) > 0, "invalidValue");
const version = z.number().int().min(1);
const optionalPoints = z.number().int().min(1).max(1_000_000_000).nullable();
const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const partnerContractStatuses = ["draft", "active", "suspended", "terminated"] as const;
export type PartnerContractStatus = (typeof partnerContractStatuses)[number];
export const partnerDirections = ["outbound", "inbound", "gift"] as const;
export type PartnerDirection = (typeof partnerDirections)[number];
export type PartnerPaymentMode = "prepaid" | "postpaid";
export const partnerSimulatorModes = ["normal", "reject", "timeout", "statement_mismatch"] as const;
export type PartnerSimulatorMode = (typeof partnerSimulatorModes)[number];

// QUYTAC_NGHIEPVU_540: giới hạn ba tầng (điểm VComm; trống: không giới hạn).
export const partnerLimitSchema = z
  .object({
    minPoints: optionalPoints,
    maxPoints: optionalPoints,
    customerDailyPoints: optionalPoints,
    customerMonthlyPoints: optionalPoints,
    partnerMonthlyPoints: optionalPoints,
  })
  .strict()
  .refine((value) => value.minPoints === null || value.maxPoints === null || value.minPoints <= value.maxPoints, { message: "invalidValue", path: ["maxPoints"] });
export type PartnerLimit = z.infer<typeof partnerLimitSchema>;
const emptyLimit: PartnerLimit = { minPoints: null, maxPoints: null, customerDailyPoints: null, customerMonthlyPoints: null, partnerMonthlyPoints: null };

const validPattern = (value: string) => {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
};

// QUYTAC_NGHIEPVU_538: hợp đồng đối tác liên minh.
const contractTerms = {
  programName: z.string().trim().min(1).max(100),
  unitNameVi: z.string().trim().min(1).max(30),
  unitNameEn: z.string().trim().min(1).max(30),
  contractNo: z.string().trim().min(1).max(50),
  effectiveFrom: isoDate,
  effectiveTo: isoDate.nullable(),
  outboundEnabled: z.boolean(),
  inboundEnabled: z.boolean(),
  giftEnabled: z.boolean(),
  paymentMode: z.enum(["prepaid", "postpaid"]),
  creditLimit: money.nullable(),
  paymentTermDays: z.number().int().min(1).max(60),
  taxPercent: decimal(2).refine((value) => Number(value) <= 10, "invalidValue"),
  connector: z.literal("simulator"),
  memberPattern: z.string().trim().min(1).max(200).refine(validPattern, "invalidValue"),
  limits: z.object({ outbound: partnerLimitSchema.default(emptyLimit), inbound: partnerLimitSchema.default(emptyLimit), gift: partnerLimitSchema.default(emptyLimit) }).strict(),
};
// Chiều được phép, hạn mức theo cách thanh toán kiểm ở máy chủ để trả thông báo riêng (QUYTAC_NGHIEPVU_538).
type TermsShape = { effectiveFrom: string; effectiveTo: string | null };
const withTermRules = <T extends z.ZodType<TermsShape>>(schema: T) =>
  schema.refine((value) => value.effectiveTo === null || value.effectiveTo >= value.effectiveFrom, { message: "invalidValue", path: ["effectiveTo"] });
export const partnerContractCreateSchema = withTermRules(z.object({ partnerId: z.string().uuid(), ...contractTerms }).strict());
export const partnerContractUpdateSchema = withTermRules(z.object({ ...contractTerms, version }).strict());
export type PartnerContractInput = z.infer<typeof partnerContractCreateSchema>;
export const partnerContractStatusSchema = z.object({ reason: z.string().trim().min(1).max(500).nullable().optional(), version }).strict();
export const partnerContractListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(partnerContractStatuses).optional(),
  ...pageQuery,
});

// QUYTAC_NGHIEPVU_539: tỷ lệ theo chiều và giai đoạn.
const rateTerms = {
  startsOn: isoDate,
  endsOn: isoDate.nullable(),
  vcommPoints: z.number().int().min(1).max(1_000_000).nullable(),
  partnerUnits: z.number().int().min(1).max(1_000_000).nullable(),
  unitPrice: money,
};
type RateShape = { startsOn: string; endsOn: string | null };
const rateEnds = (value: RateShape) => value.endsOn === null || value.endsOn >= value.startsOn;
export const partnerRateCreateSchema = z
  .object({ direction: z.enum(partnerDirections), ...rateTerms })
  .strict()
  .refine(rateEnds, { message: "invalidValue", path: ["endsOn"] })
  .refine((value) => (value.direction === "gift") === (value.vcommPoints === null && value.partnerUnits === null), { message: "invalidValue", path: ["vcommPoints"] })
  .refine((value) => (value.vcommPoints === null) === (value.partnerUnits === null), { message: "invalidValue", path: ["partnerUnits"] });
export const partnerRateUpdateSchema = z
  .object({ ...rateTerms, version })
  .strict()
  .refine(rateEnds, { message: "invalidValue", path: ["endsOn"] });

export interface PartnerRate {
  id: string;
  direction: PartnerDirection;
  startsOn: string;
  endsOn: string | null;
  vcommPoints: number | null;
  partnerUnits: number | null;
  unitPrice: string;
  status: "upcoming" | "active" | "ended";
  version: number;
}

export interface PartnerContractListItem {
  id: string;
  code: string;
  partnerId: string;
  partnerName: string;
  programName: string;
  unitNameVi: string;
  unitNameEn: string;
  directions: PartnerDirection[];
  paymentMode: PartnerPaymentMode;
  creditLimit: string | null;
  status: PartnerContractStatus;
}

export interface PartnerSimulatorMember {
  memberNumber: string;
  fullName: string;
  phone: string;
  balanceUnits: number;
}

export interface PartnerSimulatorState {
  enabled: boolean;
  mode: PartnerSimulatorMode;
  members: PartnerSimulatorMember[];
}

export interface PartnerContractDetail extends PartnerContractListItem {
  partnerCode: string;
  taxCode: string | null;
  contractNo: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  outboundEnabled: boolean;
  inboundEnabled: boolean;
  giftEnabled: boolean;
  paymentTermDays: number;
  taxPercent: string;
  connector: "simulator";
  memberPattern: string;
  limits: Record<PartnerDirection, PartnerLimit>;
  statusReason: string | null;
  rates: PartnerRate[];
  linkedMembers: number;
  canManage: boolean;
  version: number;
}

// Bộ giả lập (QUYTAC_NGHIEPVU_550): chế độ trả lời, thành viên giả.
export const partnerSimulatorModeSchema = z.object({ mode: z.enum(partnerSimulatorModes) }).strict();
export const partnerSimulatorMemberSchema = z
  .object({
    memberNumber: z.string().trim().min(1).max(50),
    fullName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(1).max(20),
    balanceUnits: z.number().int().min(0).max(1_000_000_000),
  })
  .strict();

// QUYTAC_NGHIEPVU_541: liên kết thành viên trên ứng dụng VComm.
export const buyerPartnerLinkSchema = z.object({ memberNumber: z.string().trim().min(1).max(50) }).strict();
export const buyerPartnerLinkVerifySchema = z
  .object({
    otp: z
      .string()
      .trim()
      .regex(/^\d{4,8}$/, "invalidValue"),
  })
  .strict();

export interface BuyerPartnerRate {
  vcommPoints: number;
  partnerUnits: number;
}

export interface BuyerPartnerLink {
  memberNumberMasked: string;
  memberNameMasked: string | null;
  linkedAt: string;
}

export interface BuyerPartnerItem {
  id: string;
  partnerName: string;
  programName: string;
  unitNameVi: string;
  unitNameEn: string;
  memberPattern: string;
  outbound: BuyerPartnerRate | null;
  inbound: BuyerPartnerRate | null;
  link: BuyerPartnerLink | null;
}

export interface BuyerPartnerLinkRequest {
  requestId: string;
  expiresAt: string;
}
