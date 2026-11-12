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
  | "income_summary"
  | "retained_earnings"
  | "commission_expense"
  | "collector_receivable"
  | "collection_fee"
  | "service_revenue"
  | "commission_payable"
  | "personal_income_tax"
  | "other_income"
  | "service_expense"
  | "loyalty_expense"
  | "loyalty_liability"
  | "loyalty_intercompany_receivable"
  | "loyalty_intercompany_payable"
  | "staff_receivable"
  // CONG_VIEC_48: lương.
  | "salary_payable"
  | "salary_expense_selling"
  | "salary_expense_admin"
  | "social_insurance_payable"
  | "health_insurance_payable"
  | "unemployment_insurance_payable"
  | "union_fee_payable"
  | "payroll_deduction_payable"
  | "import_duty"
  | "excise_tax"
  | "environmental_tax"
  | "import_vat"
  // CONG_VIEC_56: ngoại tệ, thuế hải quan.
  | "cash_foreign"
  | "bank_foreign"
  | "exchange_difference"
  | "financial_income"
  | "financial_expense"
  | "late_payment_expense";
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
  "income_summary",
  "retained_earnings",
  "commission_expense",
  "collector_receivable",
  "collection_fee",
  "service_revenue",
  "commission_payable",
  "personal_income_tax",
  "other_income",
  "service_expense",
  "loyalty_expense",
  "loyalty_liability",
  "loyalty_intercompany_receivable",
  "loyalty_intercompany_payable",
  "staff_receivable",
  "salary_payable",
  "salary_expense_selling",
  "salary_expense_admin",
  "social_insurance_payable",
  "health_insurance_payable",
  "unemployment_insurance_payable",
  "union_fee_payable",
  "payroll_deduction_payable",
  "import_duty",
  "excise_tax",
  "environmental_tax",
  "import_vat",
  "cash_foreign",
  "bank_foreign",
  "exchange_difference",
  "financial_income",
  "financial_expense",
  "late_payment_expense",
];

export interface DraftLine {
  role: PostingRole;
  partnerId: string | null;
  debit: number;
  credit: number;
}
export interface DraftJournal {
  companyId: string;
  sourceType:
    | "inventory_document"
    | "payment"
    | "internal_write_off"
    | "collection_statement"
    | "marketplace_payment"
    | "marketplace_refund"
    | "marketplace_commission"
    | "marketplace_withdrawal"
    | "loyalty_entry"
    | "loyalty_seller_entry"
    | "loyalty_order_redeem"
    | "marketplace_referral_bonus"
    | "payroll"
    | "payroll_payment"
    | "import_declaration"
    | "landed_cost"
    | "fx_revaluation";
  sourceId: string;
  journalNo: string;
  date: string;
  description: string;
  lines: DraftLine[];
}

const round = (value: number) => Math.round(value * 10000) / 10000;
export const debit = (role: PostingRole, amount: number, partnerId: string | null = null): DraftLine => ({ role, partnerId, debit: round(amount), credit: 0 });
export const credit = (role: PostingRole, amount: number, partnerId: string | null = null): DraftLine => ({ role, partnerId, debit: 0, credit: round(amount) });

// Bút toán ghi theo đơn vị nhỏ nhất của tiền tệ công ty (đồng Việt Nam: không có số lẻ).
export async function rounder(executor: Executor, companyId: string): Promise<(value: number) => number> {
  const units = Number(
    (await executor.execute<{ minor_units: number }>(sql`SELECT cur.minor_units FROM core.companies c JOIN core.currencies cur ON cur.code = c.base_currency WHERE c.id = ${companyId}`)).rows[0]
      ?.minor_units ?? 0,
  );
  const factor = 10 ** units;
  return (value: number) => Math.round(round(value) * factor) / factor;
}

// Phiếu kho đã ghi sổ (QUYTAC_NGHIEPVU_95): doanh thu, thuế khi xuất giao hàng; giá vốn theo giá trị ghi sổ kho; nhập mua theo giá đơn mua phần đạt kiểm tra chất lượng.
export async function inventoryDraft(executor: Executor, documentId: string): Promise<DraftJournal | null> {
  const document = (
    await executor.execute<{
      type: string;
      company_id: string;
      partner_id: string | null;
      document_no: string | null;
      document_date: string;
      reason_code: string | null;
      reason: string | null;
      is_service: boolean;
    }>(sql`
    SELECT type, company_id, partner_id, document_no, document_date::text, reason_code, reason, is_service FROM inventory.documents WHERE id = ${documentId}`)
  ).rows[0];
  if (!document || document.type === "transfer") return null;
  const values = (
    await executor.execute<{ cost: string; cost_in: string; cost_out: string }>(sql`
    SELECT coalesce(sum(dl.cost_value), 0)::text AS cost,
      coalesce(sum(CASE WHEN dl.quantity > 0 THEN dl.cost_value END), 0)::text AS cost_in,
      coalesce(sum(CASE WHEN dl.quantity < 0 THEN dl.cost_value END), 0)::text AS cost_out
    FROM inventory.document_lines dl WHERE dl.document_id = ${documentId}`)
  ).rows[0]!;
  // Tiền gồm thuế, chưa thuế theo đơn bán, đơn mua: cùng hàm làm tròn với công nợ (THAY_DOI_10), thuế là phần chênh lệch nên Nợ Có cân.
  const amounts = (await executor.execute<{ gross: string; net: string }>(sql`SELECT gross::text, net::text FROM finance.inventory_amounts(${documentId})`)).rows[0]!;
  const money = await rounder(executor, document.company_id);
  const cost = money(Number(values.cost));
  const gross = Number(amounts.gross);
  const net = Number(amounts.net);
  const saleNet = net;
  const saleTax = round(gross - net);
  const purchaseNet = net;
  const purchaseTax = round(gross - net);
  const partner = document.partner_id;
  let lines: DraftLine[] = [];
  let description = document.reason ?? "";
  switch (document.type) {
    // Phiếu dịch vụ tự lập khi đơn xác nhận (CONG_VIEC_43; QUYTAC_NGHIEPVU_276, 277): không giá vốn, không hàng tồn kho.
    case "sales_issue":
      if (!document.is_service) {
        lines = [debit("receivable", saleNet + saleTax, partner), credit("revenue", saleNet), credit("vat_output", saleTax), debit("cogs", cost), credit("goods", cost)];
        description = "Xuất bán hàng";
        // Phí giao hàng của đơn VComm (CONG_VIEC_25; QUYTAC_NGHIEPVU_169): doanh thu cung cấp dịch vụ, thuế 10% đã gồm trong phí, ghi ở phiếu xuất đầu tiên của đơn.
        lines.push(...(await shippingFeeLines(executor, documentId, money)));
        break;
      }
      lines = [debit("receivable", saleNet + saleTax, partner), credit("service_revenue", saleNet), credit("vat_output", saleTax)];
      description = "Cung cấp dịch vụ";
      break;
    case "purchase_receipt":
      if (!document.is_service) {
        lines = [debit("goods", purchaseNet), debit("vat_input", purchaseTax), credit("payable", purchaseNet + purchaseTax, partner)];
        description = "Nhập mua hàng hóa";
        break;
      }
      lines = [debit("service_expense", purchaseNet), debit("vat_input", purchaseTax), credit("payable", purchaseNet + purchaseTax, partner)];
      description = "Nhận dịch vụ mua vào";
      break;
    case "sales_return":
      lines = [debit("sales_return", saleNet), debit("vat_output", saleTax), credit("receivable", saleNet + saleTax, partner), debit("goods", cost), credit("cogs", cost)];
      description = "Nhận hàng bán bị trả lại";
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
      const gain = money(Number(values.cost_in));
      const loss = money(Number(values.cost_out));
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

// Phí giao hàng của đơn VComm: phiếu xuất ghi sổ đầu tiên của đơn bán mang phí; ghi nhận phiếu đó vào đơn (khóa dòng đơn) nên bút toán, hóa đơn chỉ tính phí một lần.
export async function marketplaceShippingFee(executor: Executor, documentId: string): Promise<number> {
  const row = (
    await executor.execute<{ shipping_fee: string; shipping_fee_document_id: string | null }>(sql`
    SELECT m.shipping_fee::text, m.shipping_fee_document_id FROM inventory.documents d JOIN marketplace.orders m ON m.sales_order_id = d.source_id
    WHERE d.id = ${documentId} AND d.type = 'sales_issue' AND d.status = 'posted' FOR UPDATE OF m`)
  ).rows[0];
  if (!row) return 0;
  if (row.shipping_fee_document_id === null) {
    await executor.execute(sql`UPDATE marketplace.orders SET shipping_fee_document_id = ${documentId} WHERE sales_order_id = (SELECT source_id FROM inventory.documents WHERE id = ${documentId})`);
    return Number(row.shipping_fee);
  }
  return row.shipping_fee_document_id === documentId ? Number(row.shipping_fee) : 0;
}
export const shippingVatRate = 10;

async function shippingFeeLines(executor: Executor, documentId: string, money: (value: number) => number): Promise<DraftLine[]> {
  const fee = money(await marketplaceShippingFee(executor, documentId));
  if (fee <= 0) return [];
  const net = money(fee / (1 + shippingVatRate / 100));
  return [debit("receivable", fee), credit("service_revenue", net), credit("vat_output", round(fee - net))];
}

// Tiền thu trực tuyến của đơn VComm (CONG_VIEC_25; QUYTAC_NGHIEPVU_169): Nợ tiền gửi ngân hàng / Có phải thu khách hàng (không đối tác), ngày cổng báo thành công.
export async function marketplacePaymentDraft(executor: Executor, paymentId: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; reference: string; document_no: string; amount: string; paid_on: string }>(sql`
    SELECT m.company_id, p.reference, so.document_no, p.amount::text, (p.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS paid_on
    FROM marketplace.payments p JOIN marketplace.orders m ON m.id = p.order_id JOIN sales.orders so ON so.id = m.sales_order_id
    WHERE p.id = ${paymentId} AND p.status = 'succeeded'`)
  ).rows[0];
  if (!row) return null;
  const amount = Number(row.amount);
  return {
    companyId: row.company_id,
    sourceType: "marketplace_payment",
    sourceId: paymentId,
    journalNo: row.reference,
    date: row.paid_on,
    description: `Thu tiền đơn VComm ${row.document_no} qua cổng thanh toán`,
    lines: [debit("bank", amount), credit("receivable", amount)],
  };
}

// Hoàn tiền đơn VComm đã chuyển khoản (QUYTAC_NGHIEPVU_169): Nợ phải thu khách hàng / Có tiền gửi ngân hàng, ngày chuyển.
export async function marketplaceRefundDraft(executor: Executor, refundId: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; bank_transaction_no: string; document_no: string; amount: string; refunded_on: string }>(sql`
    SELECT m.company_id, f.bank_transaction_no, so.document_no, f.amount::text, f.refunded_on::text
    FROM marketplace.refunds f JOIN marketplace.orders m ON m.id = f.order_id JOIN sales.orders so ON so.id = m.sales_order_id
    WHERE f.id = ${refundId} AND f.status = 'completed'`)
  ).rows[0];
  if (!row) return null;
  const amount = Number(row.amount);
  return {
    companyId: row.company_id,
    sourceType: "marketplace_refund",
    sourceId: refundId,
    // Một lần chuyển khoản có thể hoàn nhiều đơn: số bút toán theo số đơn, mã giao dịch ghi ở diễn giải.
    journalNo: `${row.document_no}-HT`,
    date: row.refunded_on,
    description: `Hoàn tiền đơn VComm ${row.document_no}, giao dịch ${row.bank_transaction_no}`,
    lines: [debit("receivable", amount), credit("bank", amount)],
  };
}

// Hoa hồng đơn VComm hoàn tất (CONG_VIEC_26; QUYTAC_NGHIEPVU_207): Nợ chi phí hoa hồng / Có phải trả hoa hồng (3388), tổng số đã cộng ví của đơn, ngày hoàn tất.
export async function marketplaceCommissionDraft(executor: Executor, orderId: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; document_no: string; completed_on: string; total: string | null }>(sql`
    SELECT m.company_id, so.document_no, (m.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS completed_on,
      (SELECT sum(c.amount) FROM marketplace.order_commissions c WHERE c.order_id = m.id AND c.status = 'credited')::text AS total
    FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = ${orderId} AND m.status = 'completed'`)
  ).rows[0];
  const total = Number(row?.total ?? 0);
  if (!row || total <= 0) return null;
  return {
    companyId: row.company_id,
    sourceType: "marketplace_commission",
    sourceId: orderId,
    journalNo: `${row.document_no}-HH`,
    date: row.completed_on,
    description: `Hoa hồng đơn VComm ${row.document_no}`,
    lines: [debit("commission_expense", total), credit("commission_payable", total)],
  };
}

// Thưởng giới thiệu bạn bè (CONG_VIEC_49; QUYTAC_NGHIEPVU_327): Nợ chi phí hoa hồng / Có phải trả hoa hồng, ngày đơn hoàn tất, số bút toán `<số đơn>-TG`.
export async function marketplaceReferralBonusDraft(executor: Executor, orderId: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; document_no: string; completed_on: string; amount: string }>(sql`
    SELECT m.company_id, so.document_no, (m.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS completed_on, b.amount::text
    FROM marketplace.referral_bonuses b JOIN marketplace.orders m ON m.id = b.order_id JOIN sales.orders so ON so.id = m.sales_order_id WHERE b.order_id = ${orderId}`)
  ).rows[0];
  if (!row) return null;
  return {
    companyId: row.company_id,
    sourceType: "marketplace_referral_bonus",
    sourceId: orderId,
    journalNo: `${row.document_no}-TG`,
    date: row.completed_on,
    description: `Thưởng giới thiệu đơn VComm ${row.document_no}`,
    lines: [debit("commission_expense", Number(row.amount)), credit("commission_payable", Number(row.amount))],
  };
}

// Chi trả rút tiền hoa hồng đã ghi đã chi (QUYTAC_NGHIEPVU_207, 208): Nợ 3388 số tiền yêu cầu / Có tiền gửi ngân hàng số thực nhận / Có thuế thu nhập cá nhân (3335)
// / Có thu nhập khác (711) phí rút tiền, ngày chi.
export async function marketplaceWithdrawalDraft(executor: Executor, withdrawalId: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; amount: string; tax_amount: string; fee_amount: string; net_amount: string; paid_on: string; bank_transaction_no: string; full_name: string }>(sql`
    SELECT w.company_id, w.amount::text, w.tax_amount::text, w.fee_amount::text, w.net_amount::text, w.paid_on::text, w.bank_transaction_no, u.full_name
    FROM marketplace.withdrawals w JOIN core.users u ON u.id = w.user_id WHERE w.id = ${withdrawalId} AND w.status = 'paid'`)
  ).rows[0];
  if (!row) return null;
  return {
    companyId: row.company_id,
    sourceType: "marketplace_withdrawal",
    sourceId: withdrawalId,
    journalNo: `RTHH-${withdrawalId.slice(0, 8).toUpperCase()}`,
    date: row.paid_on,
    description: `Chi hoa hồng cho ${row.full_name}, giao dịch ${row.bank_transaction_no}`,
    lines: [
      debit("commission_payable", Number(row.amount)),
      credit("bank", Number(row.net_amount)),
      credit("personal_income_tax", Number(row.tax_amount)),
      credit("other_income", Number(row.fee_amount)),
    ],
  };
}

// Phiếu thu chi đã ghi sổ: quỹ tiền mặt hoặc ngân hàng đối ứng phải thu, phải trả của đối tác.
export async function paymentDraft(executor: Executor, paymentId: string): Promise<DraftJournal | null> {
  const payment = (
    await executor.execute<{
      company_id: string;
      kind: string;
      partner_id: string | null;
      fund_kind: "cash" | "bank";
      fund_currency: string | null;
      counter_fund_kind: "cash" | "bank" | null;
      document_no: string;
      payment_date: string;
      amount: string;
      exchange_difference: string | null;
      note: string | null;
    }>(sql`
    SELECT p.company_id, p.kind, p.partner_id, f.kind AS fund_kind, f.currency AS fund_currency, cf.kind AS counter_fund_kind, p.document_no, p.payment_date::text, p.amount::text,
      p.exchange_difference::text, p.note
    FROM finance.payments p JOIN finance.funds f ON f.id = p.fund_id LEFT JOIN finance.funds cf ON cf.id = p.counter_fund_id WHERE p.id = ${paymentId}`)
  ).rows[0];
  if (!payment) return null;
  const round = await rounder(executor, payment.company_id);
  const amount = round(Number(payment.amount));
  // Quỹ ngoại tệ dùng vai trò tiền ngoại tệ (CONG_VIEC_56; QUYTAC_NGHIEPVU_406).
  const fundRole = (kind: "cash" | "bank", foreign: boolean): PostingRole => (foreign ? (kind === "cash" ? "cash_foreign" : "bank_foreign") : kind);
  const fund = fundRole(payment.fund_kind, payment.fund_currency !== null);
  // Phiếu chi trả nợ ngoại tệ: Nợ phải trả theo tỷ giá đích danh, Có quỹ theo giá trị ra; chênh lệch vào 515 (lãi) hoặc 635 (lỗ) (QUYTAC_NGHIEPVU_411).
  const difference = round(Number(payment.exchange_difference ?? 0));
  const supplierPayment =
    difference === 0
      ? [debit("payable", amount, payment.partner_id), credit(fund, amount)]
      : [
          debit("payable", amount + difference, payment.partner_id),
          ...(difference < 0 ? [debit("financial_expense", -difference)] : []),
          credit(fund, amount),
          ...(difference > 0 ? [credit("financial_income", difference)] : []),
        ];
  const partner = payment.partner_id;
  // Đối tác là đơn vị thu hộ: tiền chuyển về trừ phải thu đơn vị thu hộ (1388), không phải 131 (CONG_VIEC_19; QUYTAC_NGHIEPVU_121).
  const isCollector = (await executor.execute(sql`SELECT 1 FROM finance.collectors WHERE company_id = ${payment.company_id} AND partner_id = ${partner}`)).rows.length > 0;
  const receivable: PostingRole = isCollector ? "collector_receivable" : "receivable";
  const lines: Record<string, DraftLine[]> = {
    customer_receipt: [debit(fund, amount), credit(receivable, amount, partner)],
    customer_refund: [debit(receivable, amount, partner), credit(fund, amount)],
    supplier_payment: supplierPayment,
    supplier_refund: [debit(fund, amount), credit("payable", amount, partner)],
    // THAY_DOI_24 (CONG_VIEC_53; QUYTAC_NGHIEPVU_375): chứng từ quỹ bán lẻ lập khi đóng ca; phải thu không đối tượng của phiếu xuất bán lẻ.
    retail_receipt: [debit(fund, amount), credit("receivable", amount)],
    retail_refund: [debit("receivable", amount), credit(fund, amount)],
    cash_shortage: [debit("staff_receivable", amount), credit(fund, amount)],
    cash_surplus: [debit(fund, amount), credit("surplus_pending", amount)],
    // Phiếu mua ngoại tệ (QUYTAC_NGHIEPVU_408): Nợ quỹ ngoại tệ nhận / Có quỹ tiền tệ công ty chi.
    currency_purchase: payment.counter_fund_kind ? [debit(fundRole(payment.counter_fund_kind, true), amount), credit(fund, amount)] : [],
  };
  // Phiếu nộp thuế hải quan: Nợ các tài khoản thuế (dòng nộp), Nợ tiền chậm nộp / Có tài khoản thuế (bù trừ nộp thừa), Có quỹ; nhận hoàn: Nợ quỹ / Có thuế
  // (CONG_VIEC_56; QUYTAC_NGHIEPVU_416, 417).
  if (payment.kind === "customs_tax_payment" || payment.kind === "customs_tax_refund") {
    const taxLines = await executor.execute<{ line_kind: string; tax_type: PostingRole; amount: string }>(sql`
      SELECT line_kind, tax_type, amount::text FROM finance.customs_tax_lines WHERE payment_id = ${paymentId} ORDER BY line_no`);
    const draft: DraftLine[] = [];
    for (const line of taxLines.rows) {
      const value = round(Number(line.amount));
      if (line.line_kind === "payment") draft.push(debit(line.tax_type, value));
      else if (line.line_kind === "late_payment") draft.push(debit("late_payment_expense", value));
      else draft.push(credit(line.tax_type, value));
    }
    lines.customs_tax_payment = [...draft.filter((line) => line.debit > 0), ...draft.filter((line) => line.credit > 0), credit(fund, amount)];
    lines.customs_tax_refund = [debit(fund, amount), ...draft];
  }
  const descriptions: Record<string, string> = {
    customs_tax_payment: "Nộp thuế hải quan",
    customs_tax_refund: "Nhận hoàn thuế hải quan",
    customer_receipt: "Thu tiền khách hàng",
    customer_refund: "Hoàn tiền cho khách hàng",
    supplier_payment: "Trả tiền nhà cung cấp",
    supplier_refund: "Nhà cung cấp hoàn tiền",
    retail_receipt: "Thu tiền bán lẻ tại quầy",
    retail_refund: "Hoàn tiền trả hàng bán lẻ",
    cash_shortage: "Thiếu tiền mặt khi đóng ca thu ngân",
    cash_surplus: "Thừa tiền mặt khi đóng ca thu ngân",
    currency_purchase: "Mua ngoại tệ",
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

// Ghi tổn thất hàng thiếu giao nội bộ (quyết định người dùng 2026-11-10): hàng không đến bên mua nên giảm doanh thu, thuế đầu ra đối ứng giảm phải thu
// theo giá đơn bán của phần thiếu; giá vốn đã xuất giữ ở giá vốn hàng bán.
export async function writeOffDraft(executor: Executor, discrepancyId: string, date: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; partner_id: string | null; document_no: string | null; gross: string; net: string }>(sql`
    SELECT x.company_id, d.partner_id, d.document_no,
      round(sl.total_amount * x.shortage_base_quantity / sl.base_quantity, finance.company_minor_units(x.company_id))::text AS gross,
      round(sl.net_amount * x.shortage_base_quantity / sl.base_quantity, finance.company_minor_units(x.company_id))::text AS net
    FROM inventory.internal_discrepancies x JOIN inventory.documents d ON d.id = x.issue_document_id
    JOIN inventory.document_lines dl ON dl.id = x.issue_line_id JOIN sales.order_lines sl ON sl.id = dl.source_line_id
    WHERE x.id = ${discrepancyId}`)
  ).rows[0];
  if (!row) return null;
  const gross = Number(row.gross);
  const net = Number(row.net);
  return {
    companyId: row.company_id,
    sourceType: "internal_write_off",
    sourceId: discrepancyId,
    journalNo: row.document_no ?? "",
    date,
    description: "Ghi tổn thất hàng thiếu giao nội bộ: giảm doanh thu, thuế",
    lines: [debit("sales_return", net), debit("vat_output", round(gross - net)), credit("receivable", gross, row.partner_id)],
  };
}

// Bảng đối soát thu hộ (CONG_VIEC_19; QUYTAC_NGHIEPVU_121): Nợ phải thu đơn vị thu hộ / Có phải thu khách theo từng khách; Nợ phí thu hộ / Có phải thu đơn vị thu hộ.
export async function collectionDraft(executor: Executor, statementId: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; partner_id: string; document_no: string; statement_no: string; statement_date: string; total_collected: string; total_fee: string }>(sql`
    SELECT s.company_id, c.partner_id, s.document_no, s.statement_no, s.statement_date::text, s.total_collected::text, s.total_fee::text
    FROM finance.collection_statements s JOIN finance.collectors c ON c.id = s.collector_id WHERE s.id = ${statementId}`)
  ).rows[0];
  if (!row) return null;
  const customers = (
    await executor.execute<{ customer_id: string | null; amount: string }>(sql`
    SELECT customer_id, sum(collected_amount)::text AS amount FROM finance.collection_statement_lines WHERE statement_id = ${statementId} GROUP BY customer_id ORDER BY customer_id NULLS LAST`)
  ).rows;
  const collected = Number(row.total_collected);
  const fee = Number(row.total_fee);
  return {
    companyId: row.company_id,
    sourceType: "collection_statement",
    sourceId: statementId,
    journalNo: row.document_no,
    date: row.statement_date,
    description: `Đối soát thu hộ ${row.statement_no}`,
    lines: [
      debit("collector_receivable", collected, row.partner_id),
      ...customers.map((customer) => credit("receivable", Number(customer.amount), customer.customer_id)),
      debit("collection_fee", fee),
      credit("collector_receivable", fee, row.partner_id),
    ],
  };
}

// Bút toán trích lương khi bảng lương được duyệt (CONG_VIEC_48; QUYTAC_NGHIEPVU_323): chi phí theo nhóm phòng ban, phải trả người lao động,
// bảo hiểm, kinh phí công đoàn phải nộp, thuế thu nhập cá nhân khấu trừ, khoản khấu trừ. Tiền tổng hợp trong PostgreSQL (numeric), đã làm tròn đến đồng.
export async function payrollDraft(executor: Executor, payrollId: string, date: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{
      company_id: string;
      document_no: string;
      month: string;
      selling_cost: string;
      admin_cost: string;
      gross: string;
      social: string;
      health: string;
      unemployment: string;
      union_fee: string;
      employee_insurance: string;
      tax: string;
      deductions: string;
    }>(sql`
    SELECT p.company_id, p.document_no, p.month::text,
      COALESCE(sum(l.employer_cost) FILTER (WHERE l.cost_group = 'selling'), 0)::text AS selling_cost,
      COALESCE(sum(l.employer_cost) FILTER (WHERE l.cost_group = 'admin'), 0)::text AS admin_cost,
      COALESCE(sum(l.gross_income), 0)::text AS gross,
      COALESCE(sum(l.employer_social + l.employee_social), 0)::text AS social,
      COALESCE(sum(l.employer_health + l.employee_health), 0)::text AS health,
      COALESCE(sum(l.employer_unemployment + l.employee_unemployment), 0)::text AS unemployment,
      COALESCE(sum(l.union_fee), 0)::text AS union_fee,
      COALESCE(sum(l.employee_social + l.employee_health + l.employee_unemployment), 0)::text AS employee_insurance,
      COALESCE(sum(l.personal_income_tax), 0)::text AS tax,
      COALESCE(sum(l.deductions), 0)::text AS deductions
    FROM hr.payrolls p LEFT JOIN hr.payroll_lines l ON l.payroll_id = p.id
    WHERE p.id = ${payrollId}
    GROUP BY p.id`)
  ).rows[0];
  if (!row || !row.document_no) return null;
  const money = await rounder(executor, row.company_id);
  const value = (text: string) => money(Number(text));
  const withheld = value(row.employee_insurance) + value(row.tax) + value(row.deductions);
  return {
    companyId: row.company_id,
    sourceType: "payroll",
    sourceId: payrollId,
    journalNo: row.document_no,
    date,
    description: `Lương tháng ${row.month.slice(5, 7)}/${row.month.slice(0, 4)}`,
    lines: [
      debit("salary_expense_selling", value(row.selling_cost)),
      debit("salary_expense_admin", value(row.admin_cost)),
      credit("salary_payable", value(row.gross)),
      credit("social_insurance_payable", value(row.social)),
      credit("health_insurance_payable", value(row.health)),
      credit("unemployment_insurance_payable", value(row.unemployment)),
      credit("union_fee_payable", value(row.union_fee)),
      debit("salary_payable", withheld),
      credit("personal_income_tax", value(row.tax)),
      credit("payroll_deduction_payable", value(row.deductions)),
    ],
  };
}

// Bút toán trả lương: Nợ phải trả người lao động, Có quỹ tiền mặt hoặc ngân hàng tổng thực lĩnh (QUYTAC_NGHIEPVU_323).
export async function payrollPaymentDraft(executor: Executor, payrollId: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; document_no: string; month: string; payment_date: string; net_pay: string; fund_kind: "cash" | "bank" }>(sql`
    SELECT p.company_id, p.document_no, p.month::text, p.payment_date::text, p.net_pay::text, f.kind AS fund_kind
    FROM hr.payrolls p JOIN finance.funds f ON f.id = p.fund_id WHERE p.id = ${payrollId}`)
  ).rows[0];
  if (!row) return null;
  const amount = (await rounder(executor, row.company_id))(Number(row.net_pay));
  return {
    companyId: row.company_id,
    sourceType: "payroll_payment",
    sourceId: payrollId,
    journalNo: `${row.document_no}-TT`,
    date: row.payment_date,
    description: `Trả lương tháng ${row.month.slice(5, 7)}/${row.month.slice(0, 4)}`,
    lines: [debit("salary_payable", amount), credit(row.fund_kind === "cash" ? "cash" : "bank", amount)],
  };
}

// Đánh giá lại ngoại tệ (CONG_VIEC_56; QUYTAC_NGHIEPVU_413): từng dòng qua 413 (quỹ tăng: Nợ quỹ / Có 413; nợ phải trả tăng: Nợ 413 / Có phải trả),
// rồi kết chuyển số thuần của 413 sang 515 (lãi) hoặc 635 (lỗ) để 413 không còn số dư.
export async function fxRevaluationDraft(executor: Executor, revaluationId: string): Promise<DraftJournal | null> {
  const header = (
    await executor.execute<{ company_id: string; document_no: string; revaluation_date: string }>(sql`
    SELECT company_id, document_no, revaluation_date::text FROM finance.fx_revaluations WHERE id = ${revaluationId} AND status = 'posted'`)
  ).rows[0];
  if (!header) return null;
  const round = await rounder(executor, header.company_id);
  const rows = await executor.execute<{ kind: "fund" | "payable"; fund_kind: "cash" | "bank" | null; partner_id: string | null; difference: string }>(sql`
    SELECT l.kind, f.kind AS fund_kind, l.partner_id, l.difference::text FROM finance.fx_revaluation_lines l LEFT JOIN finance.funds f ON f.id = l.fund_id
    WHERE l.revaluation_id = ${revaluationId} AND l.difference <> 0 ORDER BY l.line_no`);
  const lines: DraftLine[] = [];
  let net = 0;
  for (const row of rows.rows) {
    const value = round(Number(row.difference));
    if (row.kind === "fund") {
      const fund: PostingRole = row.fund_kind === "cash" ? "cash_foreign" : "bank_foreign";
      lines.push(...(value > 0 ? [debit(fund, value), credit("exchange_difference", value)] : [debit("exchange_difference", -value), credit(fund, -value)]));
      net += value;
    } else {
      lines.push(...(value > 0 ? [debit("exchange_difference", value), credit("payable", value, row.partner_id)] : [debit("payable", -value, row.partner_id), credit("exchange_difference", -value)]));
      net -= value;
    }
  }
  net = round(net);
  if (net > 0) lines.push(debit("exchange_difference", net), credit("financial_income", net));
  if (net < 0) lines.push(debit("financial_expense", -net), credit("exchange_difference", -net));
  return {
    companyId: header.company_id,
    sourceType: "fx_revaluation",
    sourceId: revaluationId,
    journalNo: header.document_no,
    date: header.revaluation_date,
    description: `Đánh giá lại số dư ngoại tệ ngày ${header.revaluation_date.split("-").reverse().join("/")}`,
    lines,
  };
}
