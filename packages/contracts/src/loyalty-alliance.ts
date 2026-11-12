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
