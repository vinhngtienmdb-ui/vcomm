// Sinh dòng bút toán từ chứng từ nghiệp vụ (CONG_VIEC_14; CHUC_NANG_71; QUYTAC_NGHIEPVU_95). Chỉ tính số tiền theo vai trò tài khoản; tài khoản lấy từ định khoản của công ty.
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";

export type Executor = Pick<Database, "execute">;
export type PostingRole =
  | "receivable"
  | "payable"
  | "revenue"
  | "sales_return"
  | "vat_output"
  | "vat_input"
  | "goods"
  | "cogs"
  | "cash"
  | "bank"
  | "internal_use_expense"
  | "gift_expense"
  | "disposal_expense"
  | "shortage_pending"
  | "surplus_pending"
  | "opening_offset"
  | "internal_shortage"
  | "income_summary"
  | "retained_earnings";
export const postingRoles: PostingRole[] = [
  "receivable",
  "payable",
  "revenue",
  "sales_return",
  "vat_output",
  "vat_input",
  "goods",
  "cogs",
  "cash",
  "bank",
  "internal_use_expense",
  "gift_expense",
  "disposal_expense",
  "shortage_pending",
  "surplus_pending",
  "opening_offset",
  "internal_shortage",
  "income_summary",
  "retained_earnings",
];

export interface DraftLine {
  role: PostingRole;
  partnerId: string | null;
  debit: number;
  credit: number;
}
export interface DraftJournal {
  companyId: string;
  sourceType: "inventory_document" | "payment" | "internal_write_off";
  sourceId: string;
  journalNo: string;
  date: string;
  description: string;
  lines: DraftLine[];
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const debit = (role: PostingRole, amount: number, partnerId: string | null = null): DraftLine => ({ role, partnerId, debit: round(amount), credit: 0 });
const credit = (role: PostingRole, amount: number, partnerId: string | null = null): DraftLine => ({ role, partnerId, debit: 0, credit: round(amount) });
const vatFraction = sql`(CASE WHEN pl.vat_rate IN ('0', '5', '8', '10') THEN pl.vat_rate::numeric / 100 ELSE 0 END)`;

// Phiếu kho đã ghi sổ (QUYTAC_NGHIEPVU_95): doanh thu, thuế khi xuất giao hàng; giá vốn theo giá trị ghi sổ kho; nhập mua theo giá đơn mua phần đạt kiểm tra chất lượng.
export async function inventoryDraft(executor: Executor, documentId: string): Promise<DraftJournal | null> {
  const document = (
    await executor.execute<{ type: string; company_id: string; partner_id: string | null; document_no: string | null; document_date: string; reason_code: string | null; reason: string | null }>(sql`
    SELECT type, company_id, partner_id, document_no, document_date::text, reason_code, reason FROM inventory.documents WHERE id = ${documentId}`)
  ).rows[0];
  if (!document || document.type === "transfer") return null;
  const values = (
    await executor.execute<{ cost: string; cost_in: string; cost_out: string; sale_net: string; sale_tax: string; purchase_net: string; purchase_tax: string }>(sql`
    SELECT
      coalesce(sum(dl.cost_value), 0)::text AS cost,
      coalesce(sum(CASE WHEN dl.quantity > 0 THEN dl.cost_value END), 0)::text AS cost_in,
      coalesce(sum(CASE WHEN dl.quantity < 0 THEN dl.cost_value END), 0)::text AS cost_out,
      coalesce(sum(CASE
        WHEN d.type = 'sales_issue' THEN (SELECT sl.net_amount * abs(dl.base_quantity) / sl.base_quantity FROM sales.order_lines sl WHERE sl.id = dl.source_line_id)
        WHEN d.type = 'sales_return' THEN (SELECT sl.net_amount * abs(dl.base_quantity) / sl.base_quantity FROM inventory.document_lines il JOIN sales.order_lines sl ON sl.id = il.source_line_id WHERE il.id = dl.source_line_id)
      END), 0)::text AS sale_net,
      coalesce(sum(CASE
        WHEN d.type = 'sales_issue' THEN (SELECT sl.tax_amount * abs(dl.base_quantity) / sl.base_quantity FROM sales.order_lines sl WHERE sl.id = dl.source_line_id)
        WHEN d.type = 'sales_return' THEN (SELECT sl.tax_amount * abs(dl.base_quantity) / sl.base_quantity FROM inventory.document_lines il JOIN sales.order_lines sl ON sl.id = il.source_line_id WHERE il.id = dl.source_line_id)
      END), 0)::text AS sale_tax,
      coalesce(sum(CASE
        WHEN d.type = 'purchase_receipt' THEN (SELECT pl.amount * (abs(dl.base_quantity) - coalesce(dl.rejected_base_quantity, 0)) / pl.base_quantity FROM purchasing.order_lines pl WHERE pl.id = dl.source_line_id)
        WHEN d.type = 'purchase_return' THEN (SELECT pl.amount * abs(dl.base_quantity) / pl.base_quantity FROM inventory.document_lines rl JOIN purchasing.order_lines pl ON pl.id = rl.source_line_id WHERE rl.id = dl.source_line_id)
      END), 0)::text AS purchase_net,
      coalesce(sum(CASE
        WHEN d.type = 'purchase_receipt' THEN (SELECT pl.amount * ${vatFraction} * (abs(dl.base_quantity) - coalesce(dl.rejected_base_quantity, 0)) / pl.base_quantity FROM purchasing.order_lines pl WHERE pl.id = dl.source_line_id)
        WHEN d.type = 'purchase_return' THEN (SELECT pl.amount * ${vatFraction} * abs(dl.base_quantity) / pl.base_quantity FROM inventory.document_lines rl JOIN purchasing.order_lines pl ON pl.id = rl.source_line_id WHERE rl.id = dl.source_line_id)
      END), 0)::text AS purchase_tax
    FROM inventory.document_lines dl JOIN inventory.documents d ON d.id = dl.document_id
    WHERE dl.document_id = ${documentId}`)
  ).rows[0]!;
  const cost = round(Number(values.cost));
  const saleNet = round(Number(values.sale_net));
  const saleTax = round(Number(values.sale_tax));
  const purchaseNet = round(Number(values.purchase_net));
  const purchaseTax = round(Number(values.purchase_tax));
  const partner = document.partner_id;
  let lines: DraftLine[] = [];
  let description = document.reason ?? "";
  switch (document.type) {
    case "sales_issue":
      lines = [debit("receivable", saleNet + saleTax, partner), credit("revenue", saleNet), credit("vat_output", saleTax), debit("cogs", cost), credit("goods", cost)];
      description = "Xuất bán hàng";
      break;
    case "sales_return":
      lines = [debit("sales_return", saleNet), debit("vat_output", saleTax), credit("receivable", saleNet + saleTax, partner), debit("goods", cost), credit("cogs", cost)];
      description = "Nhận hàng bán bị trả lại";
      break;
    case "purchase_receipt":
      lines = [debit("goods", purchaseNet), debit("vat_input", purchaseTax), credit("payable", purchaseNet + purchaseTax, partner)];
      description = "Nhập mua hàng hóa";
      break;
    case "purchase_return":
      lines = [debit("payable", purchaseNet + purchaseTax, partner), credit("goods", purchaseNet), credit("vat_input", purchaseTax)];
      description = "Trả hàng nhà cung cấp";
      break;
    case "receipt_other": {
      const offset: PostingRole = document.reason_code === "opening_balance" ? "opening_offset" : "surplus_pending";
      lines = [debit("goods", cost), credit(offset, cost)];
      break;
    }
    case "issue_other": {
      const expense: PostingRole =
        document.reason_code === "internal_use"
          ? "internal_use_expense"
          : document.reason_code === "gift"
            ? "gift_expense"
            : document.reason_code === "damaged" || document.reason_code === "expired_disposal"
              ? "disposal_expense"
              : "shortage_pending";
      lines = [debit(expense, cost), credit("goods", cost)];
      break;
    }
    case "adjustment": {
      const gain = round(Number(values.cost_in));
      const loss = round(Number(values.cost_out));
      lines = [debit("goods", gain), credit("surplus_pending", gain), debit("shortage_pending", loss), credit("goods", loss)];
      break;
    }
    default:
      return null;
  }
  return {
    companyId: document.company_id,
    sourceType: "inventory_document",
    sourceId: documentId,
    journalNo: document.document_no ?? "",
    date: document.document_date,
    description: description || "Phiếu kho",
    lines,
  };
}

// Phiếu thu chi đã ghi sổ: quỹ tiền mặt hoặc ngân hàng đối ứng phải thu, phải trả của đối tác.
export async function paymentDraft(executor: Executor, paymentId: string): Promise<DraftJournal | null> {
  const payment = (
    await executor.execute<{ company_id: string; kind: string; partner_id: string; fund_kind: "cash" | "bank"; document_no: string; payment_date: string; amount: string; note: string | null }>(sql`
    SELECT p.company_id, p.kind, p.partner_id, f.kind AS fund_kind, p.document_no, p.payment_date::text, p.amount::text, p.note
    FROM finance.payments p JOIN finance.funds f ON f.id = p.fund_id WHERE p.id = ${paymentId}`)
  ).rows[0];
  if (!payment) return null;
  const amount = Number(payment.amount);
  const fund: PostingRole = payment.fund_kind === "cash" ? "cash" : "bank";
  const partner = payment.partner_id;
  const lines: Record<string, DraftLine[]> = {
    customer_receipt: [debit(fund, amount), credit("receivable", amount, partner)],
    customer_refund: [debit("receivable", amount, partner), credit(fund, amount)],
    supplier_payment: [debit("payable", amount, partner), credit(fund, amount)],
    supplier_refund: [debit(fund, amount), credit("payable", amount, partner)],
  };
  const descriptions: Record<string, string> = {
    customer_receipt: "Thu tiền khách hàng",
    customer_refund: "Hoàn tiền cho khách hàng",
    supplier_payment: "Trả tiền nhà cung cấp",
    supplier_refund: "Nhà cung cấp hoàn tiền",
  };
  return {
    companyId: payment.company_id,
    sourceType: "payment",
    sourceId: paymentId,
    journalNo: payment.document_no,
    date: payment.payment_date,
    description: payment.note || descriptions[payment.kind]!,
    lines: lines[payment.kind]!,
  };
}

// Ghi tổn thất hàng thiếu giao nội bộ: hàng thiếu chờ xử lý đối ứng giảm phải thu của công ty mua, theo giá đơn bán của phần thiếu (cùng cách tính với công nợ).
export async function writeOffDraft(executor: Executor, discrepancyId: string, date: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; partner_id: string | null; document_no: string | null; amount: string }>(sql`
    SELECT x.company_id, d.partner_id, d.document_no, round(sl.total_amount * x.shortage_base_quantity / sl.base_quantity, 4)::text AS amount
    FROM inventory.internal_discrepancies x JOIN inventory.documents d ON d.id = x.issue_document_id
    JOIN inventory.document_lines dl ON dl.id = x.issue_line_id JOIN sales.order_lines sl ON sl.id = dl.source_line_id
    WHERE x.id = ${discrepancyId}`)
  ).rows[0];
  if (!row) return null;
  const amount = Number(row.amount);
  return {
    companyId: row.company_id,
    sourceType: "internal_write_off",
    sourceId: discrepancyId,
    journalNo: row.document_no ?? "",
    date,
    description: "Ghi tổn thất hàng thiếu giao nội bộ",
    lines: [debit("internal_shortage", amount), credit("receivable", amount, row.partner_id)],
  };
}
