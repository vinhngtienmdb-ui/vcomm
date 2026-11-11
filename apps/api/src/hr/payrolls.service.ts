// Bảng lương tháng (CONG_VIEC_48; CHUC_NANG_169, 170; QUYTAC_NGHIEPVU_316 đến 323; API_159 đến API_161).
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type {
  PayrollJournal,
  PayrollPostingInfo,
  PayslipListItem,
  PayslipResponse,
  payPayrollSchema,
  PayrollAdjustmentItem,
  PayrollLineDetail,
  PayrollLineItem,
  PayrollListResponse,
  PayrollResponse,
  PayrollStatus,
  PayrollWarningCode,
  payrollLineQuerySchema,
  payrollListQuerySchema,
  savePayrollAdjustmentSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import writeXlsxFile from "write-excel-file/node";
import type { z } from "zod";
import { assertOpenPeriod, ledgerSettings } from "../accounting/period-guard";
import { LedgerService } from "../accounting/ledger.service";
import { payrollDraft, payrollPaymentDraft } from "../accounting/postings";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { notify } from "../common/notifications";
import { OUTBOUND_MESSAGES, type OutboundMessages, webOrigin } from "../common/outbound-messages";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { hrAudit, positionAt, requireHrPermission } from "./hr-context";
import { blockingWarnings, calculateLine, type AllowanceInput, type CalculationResult, type ParameterSet } from "./payroll-calculation";
import { payrollPermission, PayrollSetupService } from "./payroll-setup.service";
import { PAYROLL_TIMESHEET, type PayrollTimesheetReader } from "./payroll-timesheet";

type Executor = Pick<Database, "execute">;
type AdjustmentInput = z.output<typeof savePayrollAdjustmentSchema>;
export const payrollDocumentType = "hr.payroll";
const editableStatuses: PayrollStatus[] = ["draft", "rejected", "withdrawn"];
const trim = (value: string | null): string | null => (value === null ? null : value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value);
const amount = (value: string) => trim(value)!;
// Ngày cuối tháng, số ngày của tháng (tháng dạng YYYY-MM-01).
const monthEnd = (month: string) => {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
};
const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;
const addMonths = (day: string, months: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
};

type PayrollRow = {
  id: string;
  company_id: string;
  month: string;
  status: PayrollStatus;
  document_no: string | null;
  parameter_id: string;
  approval_request_id: string | null;
  employee_count: number;
  gross_income: string;
  employee_insurance: string;
  personal_income_tax: string;
  deductions: string;
  net_pay: string;
  employer_insurance: string;
  union_fee: string;
  employer_cost: string;
  standard_days: string | null;
  timesheet_closed: boolean;
  calculated_at: string;
  calculated_by_name: string;
  cancel_reason: string | null;
  created_by: string;
  version: number;
  parameter_effective_from: string;
  base_salary: string;
  payment_date: string | null;
  fund_name: string | null;
};

type LineRow = {
  id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  department_id: string | null;
  department_name: string | null;
  cost_group: "selling" | "admin";
  tax_method: "progressive" | "flat";
  monthly_salary: string;
  standard_days: string;
  paid_days: string;
  time_pay: string;
  allowance_pay: string;
  overtime_pay: string;
  night_premium: string;
  settled_leave_pay: string;
  additions: string;
  deductions: string;
  gross_income: string;
  taxable_income: string;
  social_base: string;
  health_base: string;
  unemployment_base: string;
  employee_social: string;
  employee_health: string;
  employee_unemployment: string;
  employer_social: string;
  employer_health: string;
  employer_unemployment: string;
  union_fee: string;
  family_deduction: string;
  assessable_income: string;
  personal_income_tax: string;
  net_pay: string;
  employer_cost: string;
  employee_insurance: string;
  employer_insurance: string;
  warnings: PayrollWarningCode[];
  explanation: Record<string, unknown>;
};

@Injectable()
export class PayrollsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(PAYROLL_TIMESHEET) private readonly timesheet: PayrollTimesheetReader,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly setup: PayrollSetupService,
    private readonly ledger: LedgerService,
    @Inject(OUTBOUND_MESSAGES) private readonly messages: OutboundMessages,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private readonly logger = new Logger("PayrollsService");

  // Duyệt xong: đã duyệt; từ chối, rút: sửa, tính lại, gửi lại (QUYTAC_NGHIEPVU_322).
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (String(event.payload.documentTypeCode) !== payrollDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      const approvedId = await this.database.transaction(async (transaction) => {
        const row = (
          await transaction.execute<{ id: string; company_id: string; month: string }>(sql`
          SELECT id, company_id, month::text FROM hr.payrolls WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending' FOR UPDATE`)
        ).rows[0];
        if (!row) return null;
        if (status !== "approved") {
          await transaction.execute(sql`UPDATE hr.payrolls SET status = ${status}, updated_at = now() WHERE id = ${row.id}`);
          return null;
        }
        await this.approve(transaction, row.id, row.company_id, row.month);
        return row.id;
      });
      if (approvedId) await this.sendPayslipEmails(approvedId);
    });
  }

  // Đã duyệt: khóa mở lại bảng công, ghi bút toán trích lương, thông báo phiếu lương (QUYTAC_NGHIEPVU_323).
  // Bút toán ghi ngày cuối tháng; kỳ đó đã khóa sổ sau khi gửi duyệt thì ghi ngày duyệt để không ghi vào kỳ đã khóa.
  private async approve(transaction: Executor, payrollId: string, companyId: string, month: string): Promise<void> {
    await transaction.execute(sql`UPDATE hr.payrolls SET status = 'approved', approved_at = ${this.clock.now().toISOString()}::timestamptz, updated_at = now() WHERE id = ${payrollId}`);
    await this.timesheet.lock(transaction, companyId, month, true);
    const settings = await ledgerSettings(transaction, companyId);
    const end = monthEnd(month);
    const date = settings?.locked && end <= settings.locked ? this.permissionService.today() : end;
    await this.ledger.record(transaction, await payrollDraft(transaction, payrollId, date));
    const recipients = await transaction.execute<{ user_id: string }>(sql`
      SELECT e.user_id FROM hr.payroll_lines l JOIN hr.employees e ON e.id = l.employee_id WHERE l.payroll_id = ${payrollId} AND e.user_id IS NOT NULL`);
    await notify(
      transaction,
      recipients.rows.map((recipient) => ({
        userId: recipient.user_id,
        companyId,
        kind: "hr.payslip.issued",
        title: `Phiếu lương tháng ${month.slice(5, 7)}/${month.slice(0, 4)} đã có`,
        link: "/hr/me?tab=payslips",
        payload: { payrollId },
      })),
    );
  }

  // Gửi email phiếu lương tới email cá nhân trong hồ sơ, sau khi giao dịch duyệt xong; lỗi gửi ghi lại để gửi lại, không làm hỏng duyệt.
  async sendPayslipEmails(payrollId: string): Promise<void> {
    const lines = await this.database.execute<{
      id: string;
      personal_email: string;
      full_name: string;
      month: string;
      company_name: string;
      gross_income: string;
      employee_insurance: string;
      personal_income_tax: string;
      deductions: string;
      net_pay: string;
    }>(sql`
      SELECT l.id, e.personal_email, e.full_name, p.month::text, c.short_name AS company_name, l.gross_income::text,
        (l.employee_social + l.employee_health + l.employee_unemployment)::text AS employee_insurance, l.personal_income_tax::text, l.deductions::text, l.net_pay::text
      FROM hr.payroll_lines l JOIN hr.payrolls p ON p.id = l.payroll_id JOIN hr.employees e ON e.id = l.employee_id JOIN core.companies c ON c.id = p.company_id
      WHERE l.payroll_id = ${payrollId} AND p.status IN ('approved', 'paid') AND e.personal_email IS NOT NULL AND l.email_sent_at IS NULL`);
    const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} đồng`;
    for (const line of lines.rows) {
      const period = `${line.month.slice(5, 7)}/${line.month.slice(0, 4)}`;
      try {
        await this.messages.send({
          channel: "email",
          to: line.personal_email,
          subject: `${line.company_name}: phiếu lương tháng ${period}`,
          body: [
            `Chào ${line.full_name},`,
            `Phiếu lương tháng ${period}:`,
            `Tổng thu nhập: ${money(line.gross_income)}`,
            `Bảo hiểm: ${money(line.employee_insurance)}`,
            `Thuế thu nhập cá nhân: ${money(line.personal_income_tax)}`,
            `Khấu trừ: ${money(line.deductions)}`,
            `Thực lĩnh: ${money(line.net_pay)}`,
            `Chi tiết: ${webOrigin()}/hr/me?tab=payslips`,
          ].join("\n"),
        });
        await this.database.execute(sql`UPDATE hr.payroll_lines SET email_sent_at = now(), email_error = NULL WHERE id = ${line.id}`);
      } catch (error) {
        this.logger.error(`Không gửi được email phiếu lương dòng ${line.id}: ${(error as Error).message}`);
        await this.database.execute(sql`UPDATE hr.payroll_lines SET email_error = ${(error as Error).message.slice(0, 500)} WHERE id = ${line.id}`);
      }
    }
  }

  private async parameterFor(executor: Executor, month: string): Promise<{ id: string; set: ParameterSet } | null> {
    const end = monthEnd(month);
    const row = (await executor.execute<{ id: string }>(sql`SELECT id FROM hr.payroll_parameters WHERE effective_from <= ${end}::date ORDER BY effective_from DESC LIMIT 1`)).rows[0];
    if (!row) return null;
    const settings = await this.setup.parameterItems(executor);
    const item = settings.find((parameter) => parameter.id === row.id)!;
    return { id: row.id, set: item };
  }

  private async row(executor: Executor, actor: Actor, id: string, lock = false): Promise<PayrollRow> {
    const row = (
      await executor.execute<PayrollRow>(sql`
      SELECT p.id, p.company_id, p.month::text, p.status, p.document_no, p.parameter_id, p.approval_request_id, p.employee_count, p.gross_income::text,
        p.employee_insurance::text, p.personal_income_tax::text, p.deductions::text, p.net_pay::text, p.employer_insurance::text, p.union_fee::text, p.employer_cost::text,
        p.standard_days::text, p.timesheet_closed, p.calculated_at::text, u.full_name AS calculated_by_name, p.cancel_reason, p.created_by, p.version,
        pp.effective_from::text AS parameter_effective_from, pp.base_salary::text, p.payment_date::text, f.name AS fund_name
      FROM hr.payrolls p JOIN core.users u ON u.id = p.calculated_by JOIN hr.payroll_parameters pp ON pp.id = p.parameter_id LEFT JOIN finance.funds f ON f.id = p.fund_id
      WHERE p.id = ${id} AND p.company_id = ${actor.companyId}${lock ? sql` FOR UPDATE OF p` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async list(actor: Actor, query: z.output<typeof payrollListQuerySchema>): Promise<PayrollListResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, payrollPermission.view, payrollPermission.manage);
    const rows = await this.database.execute<PayrollRow>(sql`
      SELECT id, month::text, document_no, status, employee_count, gross_income::text, employee_insurance::text, personal_income_tax::text, deductions::text, net_pay::text,
        employer_insurance::text, union_fee::text, employer_cost::text
      FROM hr.payrolls WHERE company_id = ${actor.companyId}
        ${query.year ? sql`AND extract(year FROM month) = ${query.year}` : sql``}
        ${query.status ? sql`AND status = ${query.status}` : sql``}
      ORDER BY month DESC, created_at DESC`);
    return { data: rows.rows.map((row) => ({ id: row.id, month: row.month, documentNo: row.document_no, status: row.status, ...this.totals(row) })), canManage: granted.has(payrollPermission.manage) };
  }

  private totals(
    row: Pick<PayrollRow, "employee_count" | "gross_income" | "employee_insurance" | "personal_income_tax" | "deductions" | "net_pay" | "employer_insurance" | "union_fee" | "employer_cost">,
  ) {
    return {
      employeeCount: row.employee_count,
      grossIncome: amount(row.gross_income),
      employeeInsurance: amount(row.employee_insurance),
      personalIncomeTax: amount(row.personal_income_tax),
      deductions: amount(row.deductions),
      netPay: amount(row.net_pay),
      employerInsurance: amount(row.employer_insurance),
      unionFee: amount(row.union_fee),
      employerCost: amount(row.employer_cost),
    };
  }

  private async lines(executor: Executor, payrollId: string, query: z.output<typeof payrollLineQuerySchema> = {}, lineId: string | null = null): Promise<LineRow[]> {
    return (
      await executor.execute<LineRow>(sql`
      SELECT l.id, l.employee_id, e.code AS employee_code, e.full_name AS employee_name, l.department_id, d.name AS department_name, l.cost_group, l.tax_method,
        l.monthly_salary::text, l.standard_days::text, l.paid_days::text, l.time_pay::text, l.allowance_pay::text, l.overtime_pay::text, l.night_premium::text,
        l.settled_leave_pay::text, l.additions::text, l.deductions::text, l.gross_income::text, l.taxable_income::text, l.social_base::text, l.health_base::text,
        l.unemployment_base::text, l.employee_social::text, l.employee_health::text, l.employee_unemployment::text, l.employer_social::text, l.employer_health::text,
        l.employer_unemployment::text, l.union_fee::text, l.family_deduction::text, l.assessable_income::text, l.personal_income_tax::text, l.net_pay::text,
        l.employer_cost::text, (l.employee_social + l.employee_health + l.employee_unemployment)::text AS employee_insurance,
        (l.employer_social + l.employer_health + l.employer_unemployment)::text AS employer_insurance, l.warnings, l.explanation
      FROM hr.payroll_lines l JOIN hr.employees e ON e.id = l.employee_id LEFT JOIN core.departments d ON d.id = l.department_id
      WHERE l.payroll_id = ${payrollId}
        ${lineId ? sql`AND l.id = ${lineId}` : sql``}
        ${query.departmentId ? sql`AND l.department_id = ${query.departmentId}` : sql``}
        ${query.warningsOnly === "true" ? sql`AND cardinality(l.warnings) > 0` : sql``}
      ORDER BY e.code`)
    ).rows;
  }

  private lineItem(row: LineRow): PayrollLineItem {
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      employeeName: row.employee_name,
      departmentId: row.department_id,
      departmentName: row.department_name,
      costGroup: row.cost_group,
      taxMethod: row.tax_method,
      standardDays: amount(row.standard_days),
      paidDays: amount(row.paid_days),
      timePay: amount(row.time_pay),
      allowancePay: amount(row.allowance_pay),
      overtimePay: amount(row.overtime_pay),
      nightPremium: amount(row.night_premium),
      settledLeavePay: amount(row.settled_leave_pay),
      additions: amount(row.additions),
      deductions: amount(row.deductions),
      grossIncome: amount(row.gross_income),
      taxableIncome: amount(row.taxable_income),
      employeeInsurance: amount(row.employee_insurance),
      personalIncomeTax: amount(row.personal_income_tax),
      netPay: amount(row.net_pay),
      employerCost: amount(row.employer_cost),
      warnings: row.warnings,
    };
  }

  async detail(actor: Actor, id: string, query: z.output<typeof payrollLineQuerySchema> = {}): Promise<PayrollResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, payrollPermission.view, payrollPermission.manage);
    const row = await this.row(this.database, actor, id);
    const all = await this.lines(this.database, id);
    const shown = query.departmentId || query.warningsOnly ? await this.lines(this.database, id, query) : all;
    const manage = granted.has(payrollPermission.manage);
    const editable = editableStatuses.includes(row.status);
    return {
      id: row.id,
      month: row.month,
      documentNo: row.document_no,
      status: row.status,
      parameterEffectiveFrom: row.parameter_effective_from,
      baseSalary: amount(row.base_salary),
      standardDays: trim(row.standard_days),
      timesheetClosed: row.timesheet_closed,
      calculatedAt: new Date(row.calculated_at).toISOString(),
      calculatedByName: row.calculated_by_name,
      approvalRequestId: row.approval_request_id,
      cancelReason: row.cancel_reason,
      blockingCount: all.filter((line) => line.warnings.some((warning) => (blockingWarnings as readonly string[]).includes(warning))).length,
      warningCount: all.filter((line) => line.warnings.length > 0).length,
      ...this.totals(row),
      lines: shown.map((line) => this.lineItem(line)),
      canEdit: manage && editable,
      canSubmit: manage && editable,
      canWithdraw: manage && row.status === "pending" && row.created_by === actor.userId,
      canCancel: manage && editable,
      version: row.version,
      ...(await this.postingInfo(actor, row, manage)),
    };
  }

  // Bút toán liên kết, trả lương, email lỗi (MAN_HINH_127).
  private async postingInfo(actor: Actor, row: PayrollRow, manage: boolean): Promise<PayrollPostingInfo> {
    const journals = await this.database.execute<{ id: string; journal_no: string; journal_date: string; source_type: PayrollJournal["sourceType"] }>(sql`
      SELECT id, journal_no, journal_date::text, source_type FROM accounting.journals
      WHERE company_id = ${actor.companyId} AND source_id = ${row.id} AND source_type IN ('payroll', 'payroll_payment') ORDER BY source_type, journal_date`);
    const items: PayrollJournal[] = [];
    for (const journal of journals.rows) {
      const lines = await this.database.execute<{ code: string; name: string; debit: string; credit: string }>(sql`
        SELECT a.code, a.name, l.debit::text, l.credit::text FROM accounting.journal_lines l JOIN accounting.accounts a ON a.id = l.account_id
        WHERE l.journal_id = ${journal.id} ORDER BY l.line_no`);
      items.push({
        id: journal.id,
        journalNo: journal.journal_no,
        journalDate: journal.journal_date,
        sourceType: journal.source_type,
        lines: lines.rows.map((line) => ({ accountCode: line.code, accountName: line.name, debit: amount(line.debit), credit: amount(line.credit) })),
      });
    }
    const failed = (
      await this.database.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM hr.payroll_lines WHERE payroll_id = ${row.id} AND email_error IS NOT NULL AND email_sent_at IS NULL`)
    ).rows[0]!.count;
    const canPay = manage && row.status === "approved";
    const funds = canPay
      ? (
          await this.database.execute<{ id: string; name: string; kind: "cash" | "bank" }>(sql`
          SELECT id, name, kind FROM finance.funds WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY kind DESC, name`)
        ).rows
      : [];
    return { paymentDate: row.payment_date, fundName: row.fund_name, journals: items, emailFailedCount: failed, canPay, funds };
  }

  // Ghi đã trả lương: ngày trả không trước ngày duyệt, không sau hôm nay; quỹ của công ty; bút toán trả lương (QUYTAC_NGHIEPVU_323).
  async pay(actor: Actor, id: string, input: z.output<typeof payPayrollSchema>): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, actor, id, true);
      if (row.status !== "approved") throw new ApiError("BUSINESS_RULE", "payrollNotApproved");
      const approvedOn = (await transaction.execute<{ day: string }>(sql`SELECT (approved_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day FROM hr.payrolls WHERE id = ${id}`)).rows[0]!.day;
      if (input.paymentDate < approvedOn || input.paymentDate > this.permissionService.today())
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { paymentDate: "invalidValue" } });
      if ((await transaction.execute(sql`SELECT 1 FROM finance.funds WHERE id = ${input.fundId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0)
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fundId: "invalidValue" } });
      await assertOpenPeriod(transaction, actor.companyId, input.paymentDate);
      await transaction.execute(sql`
        UPDATE hr.payrolls SET status = 'paid', payment_date = ${input.paymentDate}::date, fund_id = ${input.fundId}, paid_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.ledger.record(transaction, await payrollPaymentDraft(transaction, id));
      await this.auditService.record({ ...hrAudit(actor, "payroll"), action: "payroll.pay", entityId: id, afterData: { ...input } }, transaction);
    });
    return this.detail(actor, id);
  }

  async resendPayslips(actor: Actor, id: string): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    await this.row(this.database, actor, id);
    await this.sendPayslipEmails(id);
    return this.detail(actor, id);
  }

  // Phiếu lương của tôi (MAN_HINH_130; API_161): dòng lương của hồ sơ liên kết tài khoản trong công ty đang chọn, bảng lương đã duyệt.
  async myPayslips(actor: Actor): Promise<PayslipListItem[]> {
    const rows = await this.database.execute<{ line_id: string; month: string; net_pay: string; status: "approved" | "paid"; payment_date: string | null }>(sql`
      SELECT l.id AS line_id, p.month::text, l.net_pay::text, p.status, p.payment_date::text
      FROM hr.payroll_lines l JOIN hr.payrolls p ON p.id = l.payroll_id JOIN hr.employees e ON e.id = l.employee_id
      WHERE e.user_id = ${actor.userId} AND e.company_id = ${actor.companyId} AND p.status IN ('approved', 'paid')
      ORDER BY p.month DESC`);
    return rows.rows.map((row) => ({ lineId: row.line_id, month: row.month, netPay: amount(row.net_pay), status: row.status, paymentDate: row.payment_date }));
  }

  async myPayslip(actor: Actor, lineId: string): Promise<PayslipResponse> {
    const row = (
      await this.database.execute<{ payroll_id: string; month: string; status: "approved" | "paid"; payment_date: string | null; company_name: string }>(sql`
      SELECT p.id AS payroll_id, p.month::text, p.status, p.payment_date::text, c.short_name AS company_name
      FROM hr.payroll_lines l JOIN hr.payrolls p ON p.id = l.payroll_id JOIN hr.employees e ON e.id = l.employee_id JOIN core.companies c ON c.id = p.company_id
      WHERE l.id = ${lineId} AND e.user_id = ${actor.userId} AND e.company_id = ${actor.companyId} AND p.status IN ('approved', 'paid')`)
    ).rows[0];
    // Không phải phiếu của mình hoặc chưa duyệt: không tiết lộ là có tồn tại.
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const line = (await this.lines(this.database, row.payroll_id, {}, lineId))[0]!;
    const detail = this.lineDetailOf(line, await this.adjustments(this.database, row.payroll_id, line.employee_id), false);
    await this.auditService.record({ ...hrAudit(actor, "payroll"), action: "payslip.view", entityId: row.payroll_id, afterData: { lineId } });
    return {
      lineId,
      month: row.month,
      status: row.status,
      paymentDate: row.payment_date,
      employeeCode: line.employee_code,
      employeeName: line.employee_name,
      companyName: row.company_name,
      line: detail,
    };
  }

  async lineDetail(actor: Actor, payrollId: string, lineId: string): Promise<PayrollLineDetail> {
    const granted = await requireHrPermission(this.permissionService, actor, payrollPermission.view, payrollPermission.manage);
    const payroll = await this.row(this.database, actor, payrollId);
    const line = (await this.lines(this.database, payrollId, {}, lineId))[0];
    if (!line) throw new ApiError("NOT_FOUND", "notFound");
    return this.lineDetailOf(line, await this.adjustments(this.database, payrollId, line.employee_id), granted.has(payrollPermission.manage) && editableStatuses.includes(payroll.status));
  }

  private lineDetailOf(line: LineRow, adjustments: PayrollAdjustmentItem[], canEdit: boolean): PayrollLineDetail {
    return {
      ...this.lineItem(line),
      monthlySalary: amount(line.monthly_salary),
      socialBase: amount(line.social_base),
      healthBase: amount(line.health_base),
      unemploymentBase: amount(line.unemployment_base),
      employeeSocial: amount(line.employee_social),
      employeeHealth: amount(line.employee_health),
      employeeUnemployment: amount(line.employee_unemployment),
      employerSocial: amount(line.employer_social),
      employerHealth: amount(line.employer_health),
      employerUnemployment: amount(line.employer_unemployment),
      unionFee: amount(line.union_fee),
      familyDeduction: amount(line.family_deduction),
      assessableIncome: amount(line.assessable_income),
      explanation: line.explanation,
      adjustments,
      canEdit,
    };
  }

  private async adjustments(executor: Executor, payrollId: string, employeeId: string | null): Promise<PayrollAdjustmentItem[]> {
    const rows = await executor.execute<{
      id: string;
      employee_id: string;
      kind: "addition" | "deduction";
      category: PayrollAdjustmentItem["category"];
      taxable: boolean;
      description: string;
      amount: string;
      version: number;
    }>(sql`
      SELECT id, employee_id, kind, category, taxable, description, amount::text, version FROM hr.payroll_adjustments
      WHERE payroll_id = ${payrollId}${employeeId ? sql` AND employee_id = ${employeeId}` : sql``} ORDER BY created_at`);
    return rows.rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      kind: row.kind,
      category: row.category,
      taxable: row.taxable,
      description: row.description,
      amount: amount(row.amount),
      version: row.version,
    }));
  }

  async create(actor: Actor, month: string): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    const id = await this.database.transaction(async (transaction) => {
      // Khóa dòng công ty để hai yêu cầu lập cùng tháng không chạy song song.
      await transaction.execute(sql`SELECT 1 FROM core.companies WHERE id = ${actor.companyId} FOR UPDATE`);
      if ((await transaction.execute(sql`SELECT 1 FROM hr.payrolls WHERE company_id = ${actor.companyId} AND month = ${month}::date AND status <> 'cancelled'`)).rows.length > 0)
        throw new ApiError("BUSINESS_RULE", "payrollExists");
      const parameter = await this.parameterFor(transaction, month);
      if (!parameter) throw new ApiError("BUSINESS_RULE", "payrollParametersMissing");
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.payrolls (company_id, month, parameter_id, calculated_by, created_by) VALUES (${actor.companyId}, ${month}::date, ${parameter.id}, ${actor.userId}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.calculate(transaction, actor, created, month);
      await this.auditService.record({ ...hrAudit(actor, "payroll"), action: "payroll.create", entityId: created, afterData: { month } }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  // Tính lại toàn bộ dòng từ dữ liệu mới nhất; khoản nhập tay giữ nguyên (QUYTAC_NGHIEPVU_316).
  private async calculate(transaction: Executor, actor: Actor, payrollId: string, month: string): Promise<void> {
    const parameter = await this.parameterFor(transaction, month);
    if (!parameter) throw new ApiError("BUSINESS_RULE", "payrollParametersMissing");
    const end = monthEnd(month);
    const company = await this.setup.companySettings(transaction, actor.companyId);
    const sheet = await this.timesheet.read(transaction, actor.companyId, month);
    const year = Number(month.slice(0, 4));
    // Hợp đồng đã ký (kể cả đã chấm dứt) có hiệu lực ít nhất một ngày trong tháng.
    const contracts = (
      await transaction.execute<{ id: string; employee_id: string; kind: string; effective_date: string; last_day: string; salary: string }>(sql`
      SELECT c.id, c.employee_id, c.kind, c.effective_date::text, LEAST(COALESCE(c.termination_date, c.end_date, ${end}::date), ${end}::date)::text AS last_day, c.salary::text
      FROM hr.contracts c
      WHERE c.company_id = ${actor.companyId} AND c.status IN ('signed', 'terminated') AND c.effective_date <= ${end}::date
        AND COALESCE(c.termination_date, c.end_date, ${end}::date) >= ${month}::date
      ORDER BY c.employee_id, c.effective_date`)
    ).rows;
    const employeeIds = [...new Set(contracts.map((contract) => contract.employee_id))];
    await transaction.execute(sql`DELETE FROM hr.payroll_lines WHERE payroll_id = ${payrollId}`);
    let standardDays: string | null = null;
    for (const employeeId of employeeIds) {
      const own = contracts.filter((contract) => contract.employee_id === employeeId);
      const latest = own[own.length - 1]!;
      // Đoạn lương: mỗi hợp đồng chia theo phụ lục đổi lương đã ký có hiệu lực trong tháng.
      const salarySegments: { salary: string; days: number }[] = [];
      for (const contract of own) {
        const start = contract.effective_date > month ? contract.effective_date : month;
        const appendices = (
          await transaction.execute<{ effective_date: string; salary: string }>(sql`
          SELECT effective_date::text, salary::text FROM hr.contract_appendices
          WHERE contract_id = ${contract.id} AND status = 'signed' AND salary IS NOT NULL AND effective_date <= ${contract.last_day}::date ORDER BY effective_date`)
        ).rows;
        let salary = appendices.filter((appendix) => appendix.effective_date <= start).pop()?.salary ?? contract.salary;
        let from = start;
        for (const appendix of appendices.filter((item) => item.effective_date > start)) {
          salarySegments.push({ salary, days: dayNumber(appendix.effective_date) - dayNumber(from) });
          salary = appendix.salary;
          from = appendix.effective_date;
        }
        salarySegments.push({ salary, days: dayNumber(contract.last_day) - dayNumber(from) + 1 });
      }
      // Phụ cấp hiện hành tại ngày cuối của hợp đồng mới nhất trong tháng.
      const appendixWithAllowances = (
        await transaction.execute<{ id: string }>(sql`
        SELECT id FROM hr.contract_appendices WHERE contract_id = ${latest.id} AND status = 'signed' AND replaces_allowances AND effective_date <= ${latest.last_day}::date
        ORDER BY effective_date DESC LIMIT 1`)
      ).rows[0];
      const allowanceRows = (
        await transaction.execute<{
          name: string;
          amount: string;
          type_name: string | null;
          tax_mode: "taxable" | "exempt" | "exempt_up_to" | null;
          exempt_limit: string | null;
          prorated: boolean | null;
          overtime_base: boolean | null;
        }>(sql`
        SELECT a.name, a.amount::text, t.name AS type_name, t.tax_mode, t.exempt_limit::text, t.prorated, t.overtime_base
        FROM hr.contract_allowances a LEFT JOIN hr.allowance_types t ON t.id = a.allowance_type_id
        WHERE a.contract_id = ${latest.id} AND a.appendix_id IS NOT DISTINCT FROM ${appendixWithAllowances?.id ?? null}::uuid ORDER BY a.sort_order`)
      ).rows;
      const allowances: AllowanceInput[] = allowanceRows.map((row) => ({
        name: row.name,
        amount: row.amount,
        type: row.tax_mode === null ? null : { name: row.type_name!, taxMode: row.tax_mode, exemptLimit: row.exempt_limit, prorated: row.prorated!, overtimeBase: row.overtime_base! },
      }));
      const profile = (
        await transaction.execute<{
          nationality: string;
          tax_code_last4: string | null;
          department_id: string | null;
          branch_id: string | null;
          social_exempt: boolean | null;
          health_exempt: boolean | null;
          unemployment_exempt: boolean | null;
          tax_method: "auto" | "progressive" | "flat" | null;
          region: number | null;
          cost_group: "selling" | "admin" | null;
          insurance_salary: string | null;
          dependents: number;
          has_commitment: boolean;
        }>(sql`
        SELECT e.nationality, e.tax_code_last4, position.department_id, position.branch_id, p.social_exempt, p.health_exempt, p.unemployment_exempt, p.tax_method,
          (SELECT region FROM hr.payroll_branch_regions WHERE branch_id = position.branch_id) AS region,
          (SELECT cost_group FROM hr.payroll_department_groups WHERE department_id = position.department_id) AS cost_group,
          (SELECT amount::text FROM hr.employee_insurance_salaries WHERE employee_id = e.id AND effective_month <= ${month}::date ORDER BY effective_month DESC LIMIT 1) AS insurance_salary,
          (SELECT count(*)::int FROM hr.dependents WHERE employee_id = e.id AND deduction_from <= ${month}::date AND (deduction_to IS NULL OR deduction_to >= ${month}::date)) AS dependents,
          EXISTS (SELECT 1 FROM hr.employee_tax_commitments WHERE employee_id = e.id AND year = ${year}) AS has_commitment
        FROM hr.employees e
        CROSS JOIN LATERAL (SELECT ${positionAt(sql`e.id`, sql`${end}::date`)}) position
        LEFT JOIN hr.employee_payroll_profiles p ON p.employee_id = e.id
        WHERE e.id = ${employeeId}`)
      ).rows[0]!;
      // Thử việc hoặc thời hạn dưới 3 tháng: khấu trừ 10%; thử việc hoặc dưới 1 tháng: không đóng bảo hiểm (QUYTAC_NGHIEPVU_315, 319).
      const contractEnd = (await transaction.execute<{ end_date: string | null }>(sql`SELECT COALESCE(termination_date, end_date)::text AS end_date FROM hr.contracts WHERE id = ${latest.id}`))
        .rows[0]!.end_date;
      const shorterThan = (months: number) => contractEnd !== null && contractEnd < addMonths(latest.effective_date, months);
      const taxMethod = profile.tax_method === "progressive" || profile.tax_method === "flat" ? profile.tax_method : latest.kind === "probation" || shorterThan(3) ? "flat" : "progressive";
      const regionMinimum = profile.region === null ? null : parameter.set.regionMinimums[profile.region - 1]!;
      const adjustments = (
        await transaction.execute<{ kind: "addition" | "deduction"; taxable: boolean; amount: string }>(sql`
        SELECT kind, taxable, amount::text FROM hr.payroll_adjustments WHERE payroll_id = ${payrollId} AND employee_id = ${employeeId}`)
      ).rows;
      const figures = sheet?.employees.get(employeeId) ?? null;
      const result = calculateLine({
        parameters: parameter.set,
        company,
        salarySegments,
        allowances,
        employee: {
          vietnamese: profile.nationality === "VN",
          regionMinimum,
          insuranceSalary: profile.insurance_salary,
          insuranceEligible: latest.kind !== "probation" && !shorterThan(1),
          socialExempt: profile.social_exempt ?? false,
          healthExempt: profile.health_exempt ?? false,
          unemploymentExempt: profile.unemployment_exempt ?? false,
          taxMethod,
          hasCommitment: profile.has_commitment,
          hasTaxCode: profile.tax_code_last4 !== null,
          dependents: profile.dependents,
        },
        timesheet: figures,
        adjustments,
      });
      // Chi nhánh làm việc chưa chọn vùng: chặn gửi (QUYTAC_NGHIEPVU_313).
      if (profile.region === null && !result.warnings.includes("branchRegionMissing")) result.warnings.push("branchRegionMissing");
      standardDays ??= result.standardDays;
      await this.insertLine(transaction, actor.companyId, payrollId, employeeId, profile.department_id, profile.branch_id, profile.cost_group ?? "admin", taxMethod, result);
    }
    await transaction.execute(sql`
      UPDATE hr.payrolls p SET employee_count = totals.employee_count, gross_income = totals.gross_income, employee_insurance = totals.employee_insurance,
        personal_income_tax = totals.personal_income_tax, deductions = totals.deductions, net_pay = totals.net_pay, employer_insurance = totals.employer_insurance,
        union_fee = totals.union_fee, employer_cost = totals.employer_cost, parameter_id = ${parameter.id}, standard_days = ${standardDays}::numeric,
        timesheet_closed = ${sheet?.closed ?? false}, calculated_at = now(), calculated_by = ${actor.userId}, updated_at = now()
      FROM (SELECT count(*)::int AS employee_count, COALESCE(sum(gross_income), 0) AS gross_income,
              COALESCE(sum(employee_social + employee_health + employee_unemployment), 0) AS employee_insurance, COALESCE(sum(personal_income_tax), 0) AS personal_income_tax,
              COALESCE(sum(deductions), 0) AS deductions, COALESCE(sum(net_pay), 0) AS net_pay,
              COALESCE(sum(employer_social + employer_health + employer_unemployment), 0) AS employer_insurance, COALESCE(sum(union_fee), 0) AS union_fee,
              COALESCE(sum(employer_cost), 0) AS employer_cost
            FROM hr.payroll_lines WHERE payroll_id = ${payrollId}) totals
      WHERE p.id = ${payrollId}`);
  }

  private async insertLine(
    executor: Executor,
    companyId: string,
    payrollId: string,
    employeeId: string,
    departmentId: string | null,
    branchId: string | null,
    costGroup: string,
    taxMethod: string,
    result: CalculationResult,
  ): Promise<void> {
    const value = (amountValue: bigint) => sql`${amountValue.toString()}::numeric`;
    await executor.execute(sql`
      INSERT INTO hr.payroll_lines (payroll_id, company_id, employee_id, department_id, branch_id, cost_group, tax_method, monthly_salary, standard_days, paid_days, time_pay,
        allowance_pay, overtime_pay, night_premium, settled_leave_pay, additions, deductions, gross_income, taxable_income, social_base, health_base, unemployment_base,
        employee_social, employee_health, employee_unemployment, employer_social, employer_health, employer_unemployment, union_fee, family_deduction, assessable_income,
        personal_income_tax, net_pay, employer_cost, warnings, explanation)
      VALUES (${payrollId}, ${companyId}, ${employeeId}, ${departmentId}, ${branchId}, ${costGroup}, ${taxMethod}, ${value(result.monthlySalary)}, ${result.standardDays}::numeric,
        ${result.paidDays}::numeric, ${value(result.timePay)}, ${value(result.allowancePay)}, ${value(result.overtimePay)}, ${value(result.nightPremium)},
        ${value(result.settledLeavePay)}, ${value(result.additions)}, ${value(result.deductions)}, ${value(result.grossIncome)}, ${value(result.taxableIncome)},
        ${value(result.socialBase)}, ${value(result.healthBase)}, ${value(result.unemploymentBase)}, ${value(result.employeeSocial)}, ${value(result.employeeHealth)},
        ${value(result.employeeUnemployment)}, ${value(result.employerSocial)}, ${value(result.employerHealth)}, ${value(result.employerUnemployment)}, ${value(result.unionFee)},
        ${value(result.familyDeduction)}, ${value(result.assessableIncome)}, ${value(result.personalIncomeTax)}, ${value(result.netPay)}, ${value(result.employerCost)},
        ${`{${result.warnings.join(",")}}`}::text[], ${JSON.stringify(result.explanation)}::jsonb)`);
  }

  private async editable(transaction: Executor, actor: Actor, id: string, version?: number): Promise<PayrollRow> {
    const row = await this.row(transaction, actor, id, true);
    if (!editableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    if (version !== undefined && row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return row;
  }

  async recalculate(actor: Actor, id: string): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.editable(transaction, actor, id);
      await this.calculate(transaction, actor, id, row.month);
      await transaction.execute(sql`UPDATE hr.payrolls SET version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "payroll"), action: "payroll.recalculate", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Khoản nhập tay: thêm, sửa, xóa rồi tính lại bảng lương. Nhật ký không ghi số tiền.
  async saveAdjustment(actor: Actor, payrollId: string, adjustmentId: string | null, input: AdjustmentInput): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    if (Number(input.amount) <= 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { amount: "invalidValue" } });
    const additionCategories = ["bonus", "arrears", "commission", "other"];
    const deductionCategories = ["advance", "compensation", "union_dues", "other"];
    if (!(input.kind === "addition" ? additionCategories : deductionCategories).includes(input.category))
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { category: "invalidValue" } });
    const taxable = input.kind === "addition" && input.taxable;
    await this.database.transaction(async (transaction) => {
      const row = await this.editable(transaction, actor, payrollId);
      if ((await transaction.execute(sql`SELECT 1 FROM hr.payroll_lines WHERE payroll_id = ${payrollId} AND employee_id = ${input.employeeId}`)).rows.length === 0)
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { employeeId: "invalidValue" } });
      if (adjustmentId === null) {
        await transaction.execute(sql`
          INSERT INTO hr.payroll_adjustments (payroll_id, company_id, employee_id, kind, category, taxable, description, amount, created_by)
          VALUES (${payrollId}, ${actor.companyId}, ${input.employeeId}, ${input.kind}, ${input.category}, ${taxable}, ${input.description}, ${input.amount}::numeric, ${actor.userId})`);
      } else {
        const before = (await transaction.execute<{ version: number }>(sql`SELECT version FROM hr.payroll_adjustments WHERE id = ${adjustmentId} AND payroll_id = ${payrollId} FOR UPDATE`)).rows[0];
        if (!before) throw new ApiError("NOT_FOUND", "notFound");
        if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`
          UPDATE hr.payroll_adjustments SET employee_id = ${input.employeeId}, kind = ${input.kind}, category = ${input.category}, taxable = ${taxable}, description = ${input.description},
            amount = ${input.amount}::numeric, updated_at = now(), version = version + 1
          WHERE id = ${adjustmentId}`);
      }
      await this.calculate(transaction, actor, payrollId, row.month);
      await transaction.execute(sql`UPDATE hr.payrolls SET version = version + 1 WHERE id = ${payrollId}`);
      await this.auditService.record(
        {
          ...hrAudit(actor, "payroll"),
          action: adjustmentId ? "payroll.adjustment.update" : "payroll.adjustment.create",
          entityId: payrollId,
          afterData: { employeeId: input.employeeId, kind: input.kind, category: input.category, description: input.description },
        },
        transaction,
      );
    });
    return this.detail(actor, payrollId);
  }

  async deleteAdjustment(actor: Actor, payrollId: string, adjustmentId: string): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.editable(transaction, actor, payrollId);
      const removed = await transaction.execute<{ employee_id: string }>(sql`DELETE FROM hr.payroll_adjustments WHERE id = ${adjustmentId} AND payroll_id = ${payrollId} RETURNING employee_id`);
      if (removed.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      await this.calculate(transaction, actor, payrollId, row.month);
      await transaction.execute(sql`UPDATE hr.payrolls SET version = version + 1 WHERE id = ${payrollId}`);
      await this.auditService.record(
        { ...hrAudit(actor, "payroll"), action: "payroll.adjustment.delete", entityId: payrollId, beforeData: { adjustmentId, employeeId: removed.rows[0]!.employee_id } },
        transaction,
      );
    });
    return this.detail(actor, payrollId);
  }

  // Gửi duyệt: tính lại, kiểm bảng công đã chốt, kỳ kế toán mở, không còn cảnh báo chặn (QUYTAC_NGHIEPVU_316, 322).
  async submit(actor: Actor, id: string): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    await ensureSequence(this.database, this.sequences, actor, payrollDocumentType, "BL");
    const approvedNow = await this.database.transaction(async (transaction) => {
      const before = await this.editable(transaction, actor, id);
      await this.calculate(transaction, actor, id, before.month);
      const row = await this.row(transaction, actor, id);
      if (!row.timesheet_closed) throw new ApiError("BUSINESS_RULE", "timesheetNotClosed");
      if (row.employee_count === 0) throw new ApiError("BUSINESS_RULE", "payrollEmpty");
      const blocking = (
        await transaction.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM hr.payroll_lines WHERE payroll_id = ${id} AND warnings && ${`{${blockingWarnings.join(",")}}`}::text[]`)
      ).rows[0]!.count;
      if (blocking > 0) throw new ApiError("BUSINESS_RULE", "payrollBlockingWarnings");
      if (!(await assertOpenPeriod(transaction, actor.companyId, monthEnd(row.month)))) throw new ApiError("BUSINESS_RULE", "ledgerNotInitialized");
      const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, payrollDocumentType, transaction));
      const requestId = await this.submitApproval(transaction, actor, id, documentNo, row.employer_cost);
      await transaction.execute(sql`
        UPDATE hr.payrolls SET status = ${requestId ? "pending" : "approved"}, document_no = ${documentNo}, approval_request_id = ${requestId}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      if (!requestId) await this.approve(transaction, id, actor.companyId, row.month);
      await this.auditService.record({ ...hrAudit(actor, "payroll"), action: "payroll.submit", entityId: id, afterData: { documentNo, approvalRequestId: requestId } }, transaction);
      return !requestId;
    });
    if (approvedNow) await this.sendPayslipEmails(id);
    return this.detail(actor, id);
  }

  private async submitApproval(transaction: Pick<Database, "execute" | "insert">, actor: Actor, documentId: string, documentNo: string, total: string): Promise<string | null> {
    try {
      return await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
        documentTypeCode: payrollDocumentType,
        documentId,
        documentNo,
        amount: total,
        currency: await companyCurrency(transaction, actor.companyId),
        documentDate: this.permissionService.today(),
      });
    } catch (error) {
      if (error instanceof ApiError && error.messageKey === "policyNotFound") return null;
      throw error;
    }
  }

  async withdraw(actor: Actor, id: string): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    const row = await this.row(this.database, actor, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE hr.payrolls SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...hrAudit(actor, "payroll"), action: "payroll.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  async cancel(actor: Actor, id: string, reason: string): Promise<PayrollResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    await this.database.transaction(async (transaction) => {
      await this.editable(transaction, actor, id);
      await transaction.execute(sql`UPDATE hr.payrolls SET status = 'cancelled', cancel_reason = ${reason}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "payroll"), action: "payroll.cancel", entityId: id, afterData: { reason } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Xuất Excel bảng lương (MAN_HINH_127). Nhật ký ghi lượt xuất, không ghi số tiền.
  async export(actor: Actor, id: string): Promise<{ fileName: string; content: Buffer }> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.view, payrollPermission.manage);
    const row = await this.row(this.database, actor, id);
    const lines = await this.lines(this.database, id);
    const headings = [
      "Mã nhân viên",
      "Họ tên",
      "Phòng ban",
      "Ngày công chuẩn",
      "Ngày công hưởng lương",
      "Lương thời gian",
      "Phụ cấp",
      "Làm thêm giờ",
      "Làm đêm",
      "Phép thanh toán",
      "Cộng thêm",
      "Tổng thu nhập",
      "Thu nhập chịu thuế",
      "Bảo hiểm xã hội",
      "Bảo hiểm y tế",
      "Bảo hiểm thất nghiệp",
      "Thuế thu nhập cá nhân",
      "Khấu trừ",
      "Thực lĩnh",
      "Công ty đóng bảo hiểm",
      "Kinh phí công đoàn",
      "Tổng chi phí",
    ];
    const number = (value: string) => ({ value: Number(value), type: Number });
    const data = [
      headings.map((value) => ({ value, fontWeight: "bold" as const })),
      ...lines.map((line) => [
        { value: line.employee_code },
        { value: line.employee_name },
        { value: line.department_name ?? "" },
        number(line.standard_days),
        number(line.paid_days),
        number(line.time_pay),
        number(line.allowance_pay),
        number(line.overtime_pay),
        number(line.night_premium),
        number(line.settled_leave_pay),
        number(line.additions),
        number(line.gross_income),
        number(line.taxable_income),
        number(line.employee_social),
        number(line.employee_health),
        number(line.employee_unemployment),
        number(line.personal_income_tax),
        number(line.deductions),
        number(line.net_pay),
        number(line.employer_insurance),
        number(line.union_fee),
        number(line.employer_cost),
      ]),
    ];
    await this.auditService.record({ ...hrAudit(actor, "payroll"), action: "payroll.export", entityId: id });
    const content = await writeXlsxFile(data, { sheet: "Bảng lương" }).toBuffer();
    return { fileName: `${row.document_no ?? "bang-luong"}-${row.month.slice(0, 7)}.xlsx`, content };
  }
}
