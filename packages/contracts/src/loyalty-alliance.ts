// CONG_VIEC_60: liên minh điểm trong tập đoàn: bảng đối soát nội bộ (API_249, API_250; QUYTAC_NGHIEPVU_470, 471).
import { z } from "zod";

export const loyaltySettlementStatuses = ["pending", "operator_confirmed", "company_confirmed", "disputed", "mismatched", "confirmed", "partially_paid", "settled", "carried_forward"] as const;
export type LoyaltySettlementStatus = (typeof loyaltySettlementStatuses)[number];
// Loại phát sinh: tích, dùng, hoàn điểm đã dùng, trừ lại (gồm phần thiếu quy tiền), thanh toán.
export const loyaltySettlementMovementKinds = ["earn", "redeem", "redeem_refund", "earn_reversal", "payment"] as const;
export type LoyaltySettlementMovementKind = (typeof loyaltySettlementMovementKinds)[number];

export const loyaltySettlementListQuerySchema = z
  .object({
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
    status: z.enum(loyaltySettlementStatuses).optional(),
  })
  .strict();
export const loyaltySettlementVersionSchema = z.object({ version: z.number().int().min(0) }).strict();
export const loyaltySettlementDisputeSchema = z
  .object({
    version: z.number().int().min(0),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

// QUYTAC_NGHIEPVU_473: lập phiếu thu (bên nhận) hoặc phiếu chi (bên trả) từ bảng đối soát.
export const loyaltySettlementPaymentSchema = z
  .object({
    fundId: z.uuid(),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z
      .string()
      .trim()
      .regex(/^\d{1,14}(\.\d{1,4})?$/, "invalidValue")
      .refine((value) => Number(value) > 0, "invalidValue"),
    note: z.string().trim().max(500).nullable().default(null),
  })
  .strict();
export type LoyaltySettlementPaymentInput = z.infer<typeof loyaltySettlementPaymentSchema>;
export interface LoyaltySettlementPayment {
  id: string;
  documentNo: string | null;
  companyName: string;
  kind: "loyalty_intercompany_receipt" | "loyalty_intercompany_payment";
  paymentDate: string;
  amount: string;
  status: string;
}

export interface LoyaltySettlementItem {
  id: string;
  documentNo: string;
  period: string;
  operatorCompanyId: string;
  operatorCompanyName: string;
  companyId: string;
  companyName: string;
  // Số thuần theo sổ công ty vận hành sàn: dương công ty con phải trả, âm công ty vận hành sàn phải trả.
  netOpening: string;
  receivableMovement: string;
  payableMovement: string;
  paymentMovement: string;
  offsetAmount: string;
  netClosing: string;
  status: LoyaltySettlementStatus;
  version: number;
}
export interface LoyaltySettlementsResponse {
  items: LoyaltySettlementItem[];
  isOperator: boolean;
}
// Số tiền theo sổ công ty vận hành sàn (Nợ − Có): dương làm tăng số công ty con phải trả.
export interface LoyaltySettlementMovement {
  kind: LoyaltySettlementMovementKind;
  amount: string;
}
export interface LoyaltySettlementMismatch {
  sourceType: string;
  sourceId: string;
  label: string;
  day: string;
  operatorAmount: string;
  companyAmount: string;
}
export interface LoyaltySettlementLine {
  day: string;
  kind: string;
  documentNo: string | null;
  buyerName: string;
  points: number;
  amount: string;
}
export interface LoyaltySettlementEvent {
  kind: string;
  companyName: string | null;
  actorName: string | null;
  note: string | null;
  createdAt: string;
}
export interface LoyaltySettlementResponse extends LoyaltySettlementItem {
  companyNetClosing: string;
  movements: LoyaltySettlementMovement[];
  mismatches: LoyaltySettlementMismatch[];
  lines: LoyaltySettlementLine[];
  events: LoyaltySettlementEvent[];
  operatorConfirmedBy: string | null;
  operatorConfirmedAt: string | null;
  companyConfirmedBy: string | null;
  companyConfirmedAt: string | null;
  disputeReason: string | null;
  // Bên đang xem: công ty vận hành sàn hoặc công ty con; quyền xác nhận của người xem.
  viewerSide: "operator" | "company";
  canConfirm: boolean;
  canRebuild: boolean;
  // Thanh toán (QUYTAC_NGHIEPVU_473): bên trả, số đã trả (phiếu chi bên trả), đã nhận (phiếu thu bên nhận) đã ghi sổ.
  payerCompanyName: string;
  payeeCompanyName: string;
  paidAmount: string;
  receivedAmount: string;
  payments: LoyaltySettlementPayment[];
  // Loại phiếu người xem lập được (null: không lập được) và số còn lại của phía người xem.
  paymentKind: "loyalty_intercompany_receipt" | "loyalty_intercompany_payment" | null;
  paymentRemaining: string;
}

// Chống gian lận nâng cao (API_251, API_252, API_254; QUYTAC_NGHIEPVU_474 đến 477).
export const loyaltyFraudRuleCodes = ["shared_device", "redeem_burst", "earn_return", "staff_anomaly"] as const;
export type LoyaltyFraudRuleCode = (typeof loyaltyFraudRuleCodes)[number];
export const loyaltyFraudActions = ["alert", "block", "block_and_lock"] as const;
export type LoyaltyFraudAction = (typeof loyaltyFraudActions)[number];
export const loyaltyFraudCaseStatuses = ["new", "reviewing", "violation", "no_violation"] as const;
export type LoyaltyFraudCaseStatus = (typeof loyaltyFraudCaseStatuses)[number];

const fraudParam = z.number().int().min(1).max(100_000_000).nullable();
export const loyaltyFraudRuleSchema = z
  .object({
    enabled: z.boolean(),
    action: z.enum(loyaltyFraudActions),
    // Ngưỡng theo quy tắc: maxAccounts, days; maxCount, maxPoints, balancePercent, newDeviceHours; ratioPercent, minEarnedPoints; maxSalesPerCustomerDay.
    params: z.record(z.string().regex(/^[a-zA-Z]{1,40}$/), fraudParam),
    version: z.number().int().min(0),
  })
  .strict()
  .superRefine((value, context) => {
    for (const key of ["balancePercent", "ratioPercent"])
      if (typeof value.params[key] === "number" && value.params[key]! > 100) context.addIssue({ code: "custom", path: ["params", key], message: "invalidValue" });
    for (const key of ["maxAccounts", "days", "maxCount", "newDeviceHours", "minEarnedPoints", "maxSalesPerCustomerDay"])
      if (key in value.params && value.params[key] === null) context.addIssue({ code: "custom", path: ["params", key], message: "invalidValue" });
  });
export type LoyaltyFraudRuleInput = z.infer<typeof loyaltyFraudRuleSchema>;
export interface LoyaltyFraudRule {
  code: LoyaltyFraudRuleCode;
  name: string;
  enabled: boolean;
  params: Record<string, number | null>;
  action: LoyaltyFraudAction;
  updatedByName: string | null;
  updatedAt: string;
  version: number;
}
export interface LoyaltyFraudRuleHistoryItem {
  code: LoyaltyFraudRuleCode;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  actorName: string;
  createdAt: string;
}
export const loyaltyFraudCaseListQuerySchema = z
  .object({
    ruleCode: z.enum(loyaltyFraudRuleCodes).optional(),
    status: z.enum([...loyaltyFraudCaseStatuses, "open"]).optional(),
    action: z.enum(loyaltyFraudActions).optional(),
    userId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const loyaltyFraudCaseVersionSchema = z.object({ version: z.number().int().min(0) }).strict();
export const loyaltyFraudCaseConcludeSchema = z.object({ version: z.number().int().min(0), violation: z.boolean(), note: z.string().trim().min(1).max(1000) }).strict();
export interface LoyaltyFraudCaseItem {
  id: string;
  documentNo: string;
  ruleCode: LoyaltyFraudRuleCode;
  action: LoyaltyFraudAction;
  subjectKind: "user" | "device" | "staff";
  userId: string | null;
  userName: string | null;
  userPhone: string | null;
  device: string | null;
  staffName: string | null;
  companyName: string | null;
  metrics: Record<string, unknown>;
  hitCount: number;
  caseDay: string;
  status: LoyaltyFraudCaseStatus;
  reviewerName: string | null;
  conclusionNote: string | null;
  createdAt: string;
  version: number;
}
export interface LoyaltyFraudCaseDetail extends LoyaltyFraudCaseItem {
  documents: { sourceType: string; sourceId: string; documentNo: string | null; effect: string; userName: string | null; createdAt: string }[];
  deviceAccounts: string[];
}
export interface LoyaltyDeviceItem {
  device: string;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  otherAccounts: string[];
}

// API_253: báo cáo liên minh điểm và báo cáo gian lận theo năm, chia theo tháng (QUYTAC_NGHIEPVU_478). `format=xlsx` xuất tệp Excel.
export const loyaltyReportQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100),
    format: z.enum(["xlsx"]).optional(),
  })
  .strict();
export interface LoyaltyAllianceReportRow {
  // Tháng dạng YYYY-MM (giờ Việt Nam).
  month: string;
  companyId: string;
  companyName: string;
  isOperator: boolean;
  earnedPoints: number;
  lotValue: string;
  // Chi phí điểm công ty ghi nhận trên sổ cái (vai trò chi phí điểm) theo kiểu chia chi phí của lô.
  costAmount: string;
  redeemedPoints: number;
  redeemedAmount: string;
  // Theo bảng đối soát tháng của công ty con; công ty vận hành sàn và tháng chưa lập bảng: trống.
  settlementId: string | null;
  settlementNo: string | null;
  settlementStatus: LoyaltySettlementStatus | null;
  receivable: string | null;
  payable: string | null;
  offset: string | null;
  paid: string | null;
  remaining: string | null;
}
export interface LoyaltyAllianceReport {
  year: number;
  isOperator: boolean;
  rows: LoyaltyAllianceReportRow[];
}
export interface LoyaltyFraudReportRuleRow {
  month: string;
  ruleCode: LoyaltyFraudRuleCode;
  cases: number;
  alert: number;
  block: number;
  blockAndLock: number;
  violation: number;
  noViolation: number;
  blockedTransactions: number;
  skippedEarns: number;
  skippedPoints: number;
  lockedWallets: number;
}
export interface LoyaltyFraudReportTopItem {
  month: string;
  kind: "user" | "device" | "staff";
  label: string;
  cases: number;
}
export interface LoyaltyFraudReport {
  year: number;
  rules: LoyaltyFraudReportRuleRow[];
  top: LoyaltyFraudReportTopItem[];
}
