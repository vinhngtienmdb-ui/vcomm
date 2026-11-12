// CONG_VIEC_58: kế hoạch ngân sách mua, phiếu điều chỉnh, số còn được mua (API_235 đến API_240).
import { z } from "zod";

export const budgetDocumentStatuses = ["draft", "pending", "approved", "rejected", "withdrawn", "cancelled"] as const;
export type BudgetDocumentStatus = (typeof budgetDocumentStatuses)[number];

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
// Số tiền không âm, tối đa 4 chữ số lẻ (QUYTAC_NGHIEPVU_442); nhận số hoặc chuỗi, dấu phẩy thập phân đổi thành dấu chấm.
const budgetAmount = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,16}(\.\d{1,4})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
const note = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

export const saveBudgetPlanSchema = z
  .object({
    fromMonth: month,
    toMonth: month,
    note,
    lines: z.array(z.object({ categoryId: z.uuid(), warehouseId: z.uuid(), month, amount: budgetAmount }).strict()).max(3000),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveBudgetPlanRequest = z.input<typeof saveBudgetPlanSchema>;

export const budgetListQuerySchema = z
  .object({
    status: z.enum(budgetDocumentStatuses).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    planId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface BudgetPlanListItem {
  id: string;
  documentNo: string | null;
  fromMonth: string;
  toMonth: string;
  currency: string;
  totalAmount: string;
  usedAmount: string | null;
  status: BudgetDocumentStatus;
  createdByName: string;
  createdAt: string;
}
export interface BudgetLineResponse {
  id: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  warehouseId: string;
  warehouseName: string;
  month: string;
  amount: string;
  adjustedAmount: string;
  usedAmount: string | null;
}
export interface BudgetPlanResponse extends BudgetPlanListItem {
  note: string | null;
  approvalRequestId: string | null;
  lines: BudgetLineResponse[];
  version: number;
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canCancel: boolean;
  canAdjust: boolean;
}
export interface BudgetOptionsResponse {
  currency: string;
  categories: { id: string; code: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
}

// API_239: số còn được mua theo tháng, quý, năm (QUYTAC_NGHIEPVU_447).
export const openToBuyQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100),
    period: z.enum(["month", "quarter", "year"]).default("month"),
    categoryId: z.uuid().optional(),
    warehouseId: z.uuid().optional(),
  })
  .strict();
export interface OpenToBuyRow {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  warehouseId: string;
  warehouseName: string;
  // "2026-10", "2026-Q4" hoặc "2026".
  period: string;
  // Tháng đầu của kỳ, để mở danh sách đơn khi kỳ là tháng.
  month: string | null;
  budget: string;
  adjusted: string;
  used: string;
  remaining: string;
  // Ô chưa có ngân sách trong tháng đã áp dụng kế hoạch (QUYTAC_NGHIEPVU_450).
  hasBudget: boolean;
}
export interface OpenToBuyResponse {
  currency: string;
  year: number;
  period: "month" | "quarter" | "year";
  rows: OpenToBuyRow[];
  total: { budget: string; adjusted: string; used: string; remaining: string };
}
export const cellOrdersQuerySchema = z.object({ categoryId: z.uuid(), warehouseId: z.uuid(), month }).strict();
export interface CellOrderItem {
  id: string;
  documentNo: string | null;
  supplierName: string;
  orderDate: string;
  status: string;
  currency: string;
  amount: string;
}

// API_240: kiểm tra ngân sách cho đơn mua đang lập, sửa (QUYTAC_NGHIEPVU_451).
export const budgetCheckSchema = z
  .object({
    orderId: z.uuid().nullable().optional(),
    warehouseId: z.uuid().nullable(),
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    currency: z.string().length(3).optional(),
    lines: z.array(z.object({ variantId: z.uuid(), quantity: budgetAmount, unitPrice: budgetAmount }).strip()).max(200),
  })
  .strict();
export interface BudgetCheckCell {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  warehouseId: string;
  warehouseName: string;
  month: string;
  // Trống khi ô chưa có ngân sách.
  budget: string | null;
  // Đã dùng không gồm chính đơn này.
  used: string;
  order: string;
  remainingAfter: string | null;
  status: "within" | "over" | "missing";
}
export interface BudgetCheckResponse {
  // Tháng của ngày đơn thuộc kế hoạch đã duyệt (QUYTAC_NGHIEPVU_450).
  applies: boolean;
  overBudget: boolean;
  currency: string;
  cells: BudgetCheckCell[];
}
