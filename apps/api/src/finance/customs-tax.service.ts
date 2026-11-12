// Thuế hải quan (CONG_VIEC_56; CHUC_NANG_199; QUYTAC_NGHIEPVU_415 đến 417; API_218): số dư thuế theo tờ khai, lập, sửa phiếu nộp, nhận hoàn thuế hải quan,
// tham số tiền chậm nộp. Gửi, duyệt, rút, đọc, ghi sổ phiếu dùng PaymentsService.
import { Inject, Injectable } from "@nestjs/common";
import type { CustomsDeclarationTaxes, CustomsLateFeeResponse, CustomsTaxParameterResponse, customsTaxQuerySchema, PaymentResponse, saveCustomsTaxParameterSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { customsBalances, lateFee, prepareCustoms, type CustomsInput } from "./customs-tax";
import { financeAudit, financePermissions, requireFinancePermission } from "./finance-context";
import { PaymentsService } from "./payments.service";

const parameterPermission = "finance.ledger.setup";
type Input = CustomsInput;

@Injectable()
export class CustomsTaxService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly payments: PaymentsService,
  ) {}

  // API_218: thuế của các tờ khai đã ghi sổ (lọc còn phải nộp hoặc nộp thừa).
  async balances(actor: Actor, query: z.output<typeof customsTaxQuerySchema>): Promise<CustomsDeclarationTaxes[]> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.managePayments);
    const rows = await customsBalances(this.database, actor.companyId, { declarationIds: query.declarationId ? [query.declarationId] : undefined, search: query.search });
    const grouped = new Map<string, CustomsDeclarationTaxes>();
    for (const row of rows) {
      const entry = grouped.get(row.declaration_id) ?? {
        declarationId: row.declaration_id,
        declarationNo: row.declaration_no,
        registeredOn: day(row.registered_on),
        customsOffice: row.customs_office,
        dueDate: day(row.due_date),
        taxes: [],
      };
      entry.taxes.push({
        taxType: row.tax_type,
        payable: trimDecimal(row.payable),
        paid: trimDecimal(row.paid),
        pending: trimDecimal(row.pending),
        remaining: trimDecimal((Number(row.payable) - Number(row.paid)).toFixed(4)),
      });
      grouped.set(row.declaration_id, entry);
    }
    const list = [...grouped.values()];
    return query.openOnly === "true" ? list.filter((item) => item.taxes.some((tax) => Math.abs(Number(tax.remaining)) > 0.00005)) : list;
  }

  async lateFee(actor: Actor, declarationId: string, amount: string, paymentDate: string): Promise<CustomsLateFeeResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.managePayments);
    const row = (await customsBalances(this.database, actor.companyId, { declarationIds: [declarationId] }))[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return lateFee(this.database, actor.companyId, row.due_date, amount, paymentDate);
  }

  // Lập, sửa nháp phiếu nộp thuế, nhận hoàn thuế hải quan (QUYTAC_NGHIEPVU_416).
  async save(actor: Actor, id: string | null, input: Input): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    const savedId = await this.database.transaction(async (transaction) => {
      if (id) {
        const locked = await transaction.execute<{ kind: string }>(sql`
          SELECT kind FROM finance.payments WHERE id = ${id} AND company_id = ${actor.companyId} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${input.version ?? 0} FOR UPDATE`);
        if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        if (locked.rows[0]!.kind !== input.kind) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { kind: "invalidValue" } });
      }
      const fund = (
        await transaction.execute<{ status: string; currency: string | null }>(sql`SELECT status, currency FROM finance.funds WHERE id = ${input.fundId} AND company_id = ${actor.companyId}`)
      ).rows[0];
      if (!fund) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fundId: "invalidValue" } });
      if (fund.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fundId: "fundInactive" } });
      if (fund.currency) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fundId: "fundCurrencyMismatch" } });
      const prepared = await prepareCustoms(transaction, actor.companyId, input, id, false);
      let paymentId = id;
      if (paymentId) {
        await transaction.execute(sql`
          UPDATE finance.payments SET fund_id = ${input.fundId}, payment_date = ${input.paymentDate}::date, amount = ${prepared.amount}::numeric, reference_no = ${input.referenceNo},
            note = ${input.note}, status = 'draft', post_error = NULL, updated_at = now(), version = version + 1
          WHERE id = ${paymentId}`);
        await transaction.execute(sql`DELETE FROM finance.customs_tax_lines WHERE payment_id = ${paymentId}`);
      } else {
        paymentId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO finance.payments (company_id, kind, partner_id, fund_id, payment_date, amount, reference_no, note, created_by)
          VALUES (${actor.companyId}, ${input.kind}, NULL, ${input.fundId}, ${input.paymentDate}::date, ${prepared.amount}::numeric, ${input.referenceNo}, ${input.note}, ${actor.userId})
          RETURNING id`)
        ).rows[0]!.id;
      }
      for (const [index, line] of prepared.lines.entries()) {
        await transaction.execute(sql`
          INSERT INTO finance.customs_tax_lines (payment_id, line_no, line_kind, declaration_id, tax_type, amount, overdue_days, computed_amount)
          VALUES (${paymentId}, ${index + 1}, ${line.lineKind}, ${line.declarationId}, ${line.taxType}, ${line.amount}::numeric, ${line.overdueDays}, ${line.computed}::numeric)`);
      }
      await this.auditService.record({ ...financeAudit(actor, "payment"), action: id ? "payment.update" : "payment.create", entityId: paymentId, afterData: input }, transaction);
      return paymentId;
    });
    return this.payments.detail(actor, savedId);
  }

  async parameters(actor: Actor): Promise<CustomsTaxParameterResponse[]> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.managePayments, parameterPermission);
    const rows = await this.database.execute<{ id: string; effective_from: string; late_payment_rate: string; payment_term_days: number; legal_basis: string }>(sql`
      SELECT id, effective_from::text, late_payment_rate::text, payment_term_days, legal_basis FROM finance.customs_tax_parameters ORDER BY effective_from DESC`);
    return rows.rows.map((row) => ({
      id: row.id,
      effectiveFrom: day(row.effective_from),
      lateRate: trimDecimal(row.late_payment_rate),
      paymentTermDays: row.payment_term_days,
      legalBasis: row.legal_basis,
    }));
  }

  // Thêm bộ tham số mới theo ngày hiệu lực (dùng chung toàn tập đoàn; không sửa bộ đã có).
  async addParameter(actor: Actor, input: z.output<typeof saveCustomsTaxParameterSchema>): Promise<CustomsTaxParameterResponse[]> {
    await requireFinancePermission(this.permissionService, actor, parameterPermission);
    await this.database.transaction(async (transaction) => {
      const taken = await transaction.execute(sql`SELECT 1 FROM finance.customs_tax_parameters WHERE effective_from = ${input.effectiveFrom}::date`);
      if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { effectiveFrom: "invalidValue" } });
      const id = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.customs_tax_parameters (effective_from, late_payment_rate, payment_term_days, legal_basis, created_by)
        VALUES (${input.effectiveFrom}::date, ${input.lateRate}::numeric, ${input.paymentTermDays}, ${input.legalBasis}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.auditService.record({ ...financeAudit(actor, "customs_tax_parameter"), action: "customs_tax_parameter.create", entityId: id, afterData: input }, transaction);
    });
    return this.parameters(actor);
  }
}
