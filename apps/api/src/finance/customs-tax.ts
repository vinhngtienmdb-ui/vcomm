// Thuế hải quan (CONG_VIEC_56; CHUC_NANG_199; QUYTAC_NGHIEPVU_415 đến 417; API_218): số thuế phải nộp, đã nộp, còn phải nộp, nộp thừa theo tờ khai và loại thuế;
// phiếu nộp thuế hải quan (phiếu chi), phiếu nhận hoàn thuế hải quan (phiếu thu); tiền chậm nộp theo tham số có ngày hiệu lực.
// Hàm dùng chung cho PaymentsService (ghi sổ) và CustomsTaxService (lập, sửa, số dư).
import type { CustomsLateFeeResponse, CustomsTaxType, saveCustomsTaxPaymentSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { daysBetween, type Executor } from "./debts.service";
import { fundBalance } from "./funds.service";

export type CustomsInput = z.output<typeof saveCustomsTaxPaymentSchema>;
type FieldErrors = Record<string, keyof Messages["errors"]>;
const fraction = (value: string) => (value.split(".")[1] ?? "").replace(/0+$/, "").length;
const pairKey = (declarationId: string, taxType: string) => `${declarationId}:${taxType}`;

type BalanceRow = {
  declaration_id: string;
  declaration_no: string;
  registered_on: string;
  customs_office: string | null;
  due_date: string;
  tax_type: CustomsTaxType;
  payable: string;
  paid: string;
  pending: string;
};

// Số đã nộp: dòng nộp cộng, bù trừ và hoàn trừ (phiếu đã ghi sổ); số đang chờ: phiếu đang chờ duyệt, trừ phiếu đang xét.
const signedLine = sql`CASE c.line_kind WHEN 'payment' THEN c.amount WHEN 'offset' THEN -c.amount WHEN 'refund' THEN -c.amount ELSE 0 END`;

export async function customsBalances(executor: Executor, companyId: string, filter: { declarationIds?: string[]; search?: string; excludePaymentId?: string | null }): Promise<BalanceRow[]> {
  const ids = filter.declarationIds;
  if (ids && ids.length === 0) return [];
  const exclude = filter.excludePaymentId ?? null;
  const rows = await executor.execute<BalanceRow>(sql`
    SELECT t.declaration_id, t.declaration_no, t.registered_on::text, t.customs_office, t.due_date::text, t.tax_type, t.payable::text,
      coalesce((SELECT sum(${signedLine}) FROM finance.customs_tax_lines c JOIN finance.payments p ON p.id = c.payment_id
        WHERE c.declaration_id = t.declaration_id AND c.tax_type = t.tax_type AND p.status = 'posted'), 0)::text AS paid,
      coalesce((SELECT sum(${signedLine}) FROM finance.customs_tax_lines c JOIN finance.payments p ON p.id = c.payment_id
        WHERE c.declaration_id = t.declaration_id AND c.tax_type = t.tax_type AND p.status = 'pending' AND p.id IS DISTINCT FROM ${exclude}::uuid), 0)::text AS pending
    FROM purchasing.declaration_taxes t
    WHERE t.company_id = ${companyId}
      ${
        ids
          ? sql`AND t.declaration_id IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`
          : sql``
      }
      ${filter.search ? sql`AND (lower(t.declaration_no) LIKE ${`%${searchText(filter.search)}%`} OR lower(coalesce(t.customs_office, '')) LIKE ${`%${searchText(filter.search)}%`})` : sql``}
    ORDER BY t.registered_on DESC, t.declaration_no, array_position(ARRAY['import_duty', 'excise_tax', 'environmental_tax', 'import_vat'], t.tax_type)
    LIMIT 2000`);
  return rows.rows;
}

// Tham số hiệu lực tại một ngày.
export async function customsParameter(executor: Executor, date: string): Promise<{ rate: string; termDays: number }> {
  const row = (
    await executor.execute<{ late_payment_rate: string; payment_term_days: number }>(sql`
    SELECT late_payment_rate::text, payment_term_days FROM finance.customs_tax_parameters WHERE effective_from <= ${date}::date ORDER BY effective_from DESC LIMIT 1`)
  ).rows[0];
  return row ? { rate: row.late_payment_rate, termDays: row.payment_term_days } : { rate: "0", termDays: 0 };
}

// Tiền chậm nộp của một dòng nộp (QUYTAC_NGHIEPVU_417): số nộp nhân mức (tham số hiệu lực ngày nộp) nhân số ngày quá hạn, làm tròn tiền tệ công ty.
export async function lateFee(executor: Executor, companyId: string, dueDate: string, amount: string, paymentDate: string): Promise<CustomsLateFeeResponse> {
  const days = Math.max(0, daysBetween(dueDate, paymentDate));
  const { rate } = await customsParameter(executor, paymentDate);
  const value = (await executor.execute<{ value: string }>(sql`SELECT round(${amount}::numeric * ${rate}::numeric * ${days}, finance.company_minor_units(${companyId}))::text AS value`)).rows[0]!
    .value;
  return { dueDate: day(dueDate), overdueDays: days, rate: trimDecimal(rate), amount: trimDecimal(value) };
}

type PreparedLine = { lineKind: "payment" | "offset" | "refund" | "late_payment"; declarationId: string; taxType: CustomsTaxType; amount: string; overdueDays: number | null; computed: string | null };

// Kiểm phiếu (QUYTAC_NGHIEPVU_416): dòng thuộc tờ khai đã ghi sổ của công ty; nộp không vượt số còn phải nộp, bù trừ và hoàn không vượt số nộp thừa
// (trừ phiếu khác đang chờ); số tiền phiếu bằng nộp cộng tiền chậm nộp trừ bù trừ (phiếu nộp) hoặc tổng hoàn (phiếu hoàn), lớn hơn 0.
export async function prepareCustoms(executor: Executor, companyId: string, input: CustomsInput, paymentId: string | null, strict: boolean): Promise<{ lines: PreparedLine[]; amount: string }> {
  const fields: FieldErrors = {};
  const units = Number((await executor.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${companyId}) AS units`)).rows[0]!.units);
  const balances = new Map(
    (await customsBalances(executor, companyId, { declarationIds: [...new Set(input.lines.map((line) => line.declarationId))], excludePaymentId: paymentId })).map((row) => [
      pairKey(row.declaration_id, row.tax_type),
      row,
    ]),
  );
  const used = new Map<string, number>();
  const lines: PreparedLine[] = [];
  let total = 0;
  for (const [index, line] of input.lines.entries()) {
    const allowed = input.kind === "customs_tax_refund" ? line.lineKind === "refund" : line.lineKind !== "refund";
    const balance = balances.get(pairKey(line.declarationId, line.taxType));
    if (!allowed) fields[`lines.${index}.lineKind`] = "invalidValue";
    if (!balance) {
      fields[`lines.${index}.declarationId`] = "invalidValue";
      continue;
    }
    if (fraction(line.amount) > units) fields[`lines.${index}.amount`] = "invalidValue";
    const key = pairKey(line.declarationId, line.taxType);
    const remaining = Number(balance.payable) - Number(balance.paid) - Number(balance.pending);
    const sign = line.lineKind === "payment" ? 1 : -1;
    const after = (used.get(key) ?? 0) + sign * Number(line.amount);
    used.set(key, after);
    // Nộp: tổng nộp không vượt số còn phải nộp; bù trừ, hoàn: tổng không vượt số nộp thừa.
    if (line.lineKind === "payment" ? after > remaining + 0.00005 : -after > -remaining + 0.00005) {
      fields[`lines.${index}.amount`] = line.lineKind === "payment" ? "customsTaxExceedsRemaining" : "customsTaxExceedsOverpaid";
    }
    lines.push({ lineKind: line.lineKind, declarationId: line.declarationId, taxType: line.taxType, amount: line.amount, overdueDays: null, computed: null });
    total += line.lineKind === "payment" ? Number(line.amount) : line.lineKind === "offset" ? -Number(line.amount) : Number(line.amount);
    if (line.lineKind === "payment") {
      const fee = await lateFee(executor, companyId, balance.due_date, line.amount, input.paymentDate);
      const amount = line.lateAmount ?? fee.amount;
      if (!/^\d{1,12}(\.\d{1,4})?$/.test(amount) || fraction(amount) > units) fields[`lines.${index}.lateAmount`] = "invalidValue";
      if (Number(amount) > 0 || Number(fee.amount) > 0) {
        lines.push({ lineKind: "late_payment", declarationId: line.declarationId, taxType: line.taxType, amount, overdueDays: fee.overdueDays, computed: fee.amount });
        total += Number(amount) || 0;
      }
    }
  }
  if (Object.keys(fields).length === 0 && total <= 0.00005) fields.lines = "invalidValue";
  if (Object.keys(fields).length > 0) {
    if (strict) throw new ApiError("BUSINESS_RULE", Object.values(fields).find((key) => key.startsWith("customsTax")) ?? "invalidValue");
    throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }
  return { lines, amount: total.toFixed(4) };
}

// Ghi sổ phiếu thuế hải quan (gọi từ PaymentsService trong giao dịch ghi sổ): khóa từng tờ khai, kiểm lại số dư theo phiếu đã ghi sổ, số dư quỹ (phiếu nộp).
export async function checkCustomsOnPost(executor: Executor, paymentId: string): Promise<void> {
  const payment = (
    await executor.execute<{ company_id: string; kind: "customs_tax_payment" | "customs_tax_refund"; fund_id: string; payment_date: string; amount: string }>(sql`
    SELECT company_id, kind, fund_id, payment_date::text, amount::text FROM finance.payments WHERE id = ${paymentId}`)
  ).rows[0]!;
  const lines = await executor.execute<{ line_kind: "payment" | "offset" | "refund"; declaration_id: string; tax_type: CustomsTaxType; amount: string }>(sql`
    SELECT line_kind, declaration_id, tax_type, amount::text FROM finance.customs_tax_lines WHERE payment_id = ${paymentId} AND line_kind <> 'late_payment' ORDER BY declaration_id`);
  for (const id of [...new Set(lines.rows.map((line) => line.declaration_id))].sort()) {
    await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`finance.customs_tax:${id}`}, 0))`);
  }
  const balances = new Map(
    (await customsBalances(executor, payment.company_id, { declarationIds: [...new Set(lines.rows.map((line) => line.declaration_id))], excludePaymentId: paymentId })).map((row) => [
      pairKey(row.declaration_id, row.tax_type),
      Number(row.payable) - Number(row.paid),
    ]),
  );
  const used = new Map<string, number>();
  for (const line of lines.rows) {
    const key = pairKey(line.declaration_id, line.tax_type);
    const remaining = balances.get(key);
    if (remaining === undefined) throw new ApiError("BUSINESS_RULE", "customsTaxExceedsRemaining");
    const after = (used.get(key) ?? 0) + (line.line_kind === "payment" ? 1 : -1) * Number(line.amount);
    used.set(key, after);
    if (line.line_kind === "payment" ? after > remaining + 0.00005 : -after > -remaining + 0.00005) {
      throw new ApiError("BUSINESS_RULE", line.line_kind === "payment" ? "customsTaxExceedsRemaining" : "customsTaxExceedsOverpaid");
    }
  }
  if (payment.kind === "customs_tax_payment") {
    await executor.execute(sql`SELECT 1 FROM finance.funds WHERE id = ${payment.fund_id} FOR UPDATE`);
    const balance = (await executor.execute<{ balance: string }>(sql`SELECT ${fundBalance(payment.fund_id)}::text AS balance`)).rows[0]!.balance;
    if (Number(payment.amount) > Number(balance) + 0.00005) throw new ApiError("BUSINESS_RULE", "insufficientFundBalance");
  }
}
