// Hợp đồng lao động, phụ lục, nghỉ việc (CONG_VIEC_46; CHUC_NANG_163; QUYTAC_NGHIEPVU_294, 297 đến 301; API_144, API_147, API_148, API_149).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  AppendixResponse,
  ContractAllowance,
  ContractKind,
  ContractListItem,
  ContractListResponse,
  ContractResponse,
  ContractStatus,
  ContractTerms,
  ContractValidity,
  MyContractsResponse,
  ProbationLevel,
  SalaryPaymentMethod,
  TerminationReason,
  contractListQuerySchema,
  saveAppendixSchema,
  saveContractSchema,
  terminateContractSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { notify } from "../common/notifications";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { EmployeesService, type UploadedFile } from "./employees.service";
import { ageAt, hrAudit, hrPermission, positionAt, requireHrPermission } from "./hr-context";
import { WorkEventsService } from "./work-events.service";

type Executor = Pick<Database, "execute">;
// Giao dịch cần cả ghi nhật ký thao tác (AuditService dùng insert).
type Transaction = Pick<Database, "execute" | "insert">;
type ContractInput = z.output<typeof saveContractSchema>;
type AppendixInput = z.output<typeof saveAppendixSchema>;
type TerminateInput = z.output<typeof terminateContractSchema>;

export const contractDocumentType = "hr.contract";
export const appendixDocumentType = "hr.contract_appendix";
const editableStatuses = ["draft", "rejected", "withdrawn"];
// Thời gian thử việc tối đa (Bộ luật Lao động Điều 25); "other" tính theo ngày làm việc thứ hai đến thứ bảy.
const probationLimits: Record<ProbationLevel, number> = { manager: 180, college: 60, intermediate: 30, other: 6 };

type ContractRow = {
  id: string;
  company_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  employee_status: string;
  employee_user_id: string | null;
  kind: ContractKind;
  document_no: string | null;
  status: ContractStatus;
  effective_date: string;
  end_date: string | null;
  job_title: string;
  department_id: string;
  department_name: string;
  branch_id: string;
  branch_name: string;
  salary: string;
  current_salary: string;
  probation_level: ProbationLevel | null;
  official_salary: string | null;
  payment_method: SalaryPaymentMethod;
  signer_name: string;
  signer_title: string;
  other_terms: string | null;
  legal_exception_reason: string | null;
  approval_request_id: string | null;
  sign_date: string | null;
  signed_storage_key: string | null;
  signed_file_name: string | null;
  signed_content_type: string | null;
  cancel_reason: string | null;
  termination_date: string | null;
  termination_reason: TerminationReason | null;
  termination_note: string | null;
  days_to_end: number | null;
  has_successor: boolean;
  created_by: string;
  version: number;
};

type AppendixRow = {
  id: string;
  contract_id: string;
  sequence_no: number | null;
  document_no: string | null;
  status: AppendixResponse["status"];
  effective_date: string;
  job_title: string | null;
  department_id: string | null;
  department_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  salary: string | null;
  payment_method: SalaryPaymentMethod | null;
  replaces_allowances: boolean;
  description: string;
  approval_request_id: string | null;
  sign_date: string | null;
  signed_storage_key: string | null;
  signed_file_name: string | null;
  signed_content_type: string | null;
  cancel_reason: string | null;
  created_by: string;
  version: number;
};

const trim = (value: string | null) => (value === null ? null : value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""));
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const daysInclusive = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
// Ngày cuối của thời hạn n tháng tính từ ngày hiệu lực (ngày tương ứng của tháng thứ n, trừ 1 ngày).
function monthsEnd(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date, lastDay));
  return addDays(target.toISOString().slice(0, 10), -1);
}
function workingDays(from: string, to: string): number {
  let count = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) if (new Date(`${day}T00:00:00Z`).getUTCDay() !== 0) count += 1;
  return count;
}
const compareDecimal = (left: string, right: string) => Number(left) - Number(right);

@Injectable()
export class ContractsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly employees: EmployeesService,
    private readonly workEvents: WorkEventsService,
  ) {}

  // Duyệt xong thì chờ ký; từ chối, rút thì về trạng thái tương ứng để sửa, gửi lại (QUYTAC_NGHIEPVU_299).
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      const type = String(event.payload.documentTypeCode);
      if (type !== contractDocumentType && type !== appendixDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      const table = type === contractDocumentType ? sql`hr.contracts` : sql`hr.contract_appendices`;
      await this.database.execute(sql`
        UPDATE ${table} SET status = ${status}, updated_at = now() WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`);
    });
  }

  private select(): SQL {
    const today = this.permissionService.today();
    return sql`
      SELECT c.id, c.company_id, c.employee_id, c.kind, c.document_no, c.status, c.effective_date::text, c.end_date::text, c.job_title, c.department_id, c.branch_id,
        c.salary::text, c.probation_level, c.official_salary::text, c.payment_method, c.signer_name, c.signer_title, c.other_terms, c.legal_exception_reason, c.approval_request_id,
        c.sign_date::text, c.signed_storage_key, c.signed_file_name, c.signed_content_type, c.cancel_reason, c.termination_date::text, c.termination_reason, c.termination_note,
        c.created_by, c.created_at, c.version,
        COALESCE((SELECT a.salary FROM hr.contract_appendices a WHERE a.contract_id = c.id AND a.status = 'signed' AND a.salary IS NOT NULL AND a.effective_date <= ${today}::date
          ORDER BY a.effective_date DESC LIMIT 1), c.salary)::text AS current_salary,
        e.code AS employee_code, e.full_name AS employee_name, e.status AS employee_status, e.user_id AS employee_user_id,
        d.name AS department_name, b.name AS branch_name,
        CASE WHEN c.end_date IS NULL THEN NULL ELSE (c.end_date - ${today}::date) END AS days_to_end,
        EXISTS (SELECT 1 FROM hr.contracts n WHERE n.employee_id = c.employee_id AND n.id <> c.id AND n.status IN ('signed', 'terminated')
          AND n.effective_date > c.effective_date AND n.effective_date <= c.end_date + 30) AS has_successor
      FROM hr.contracts c
      JOIN hr.employees e ON e.id = c.employee_id
      JOIN core.departments d ON d.id = c.department_id
      JOIN core.branches b ON b.id = c.branch_id`;
  }

  private validity(row: Pick<ContractRow, "status" | "effective_date" | "end_date">): ContractValidity {
    const today = this.permissionService.today();
    if (row.status === "terminated") return "terminated";
    if (row.status !== "signed") return null;
    if (row.effective_date > today) return "not_started";
    if (row.end_date && row.end_date < today) return "expired";
    return "active";
  }

  // Hợp đồng còn phải xử lý khi hết hạn: đã ký, có ngày kết thúc, chưa có hợp đồng tiếp theo, hồ sơ đang làm (QUYTAC_NGHIEPVU_301).
  private pendingExpiry(row: ContractRow): boolean {
    return row.status === "signed" && row.end_date !== null && !row.has_successor && row.employee_status === "active";
  }

  private listItem(row: ContractRow, showSalary: boolean): ContractListItem {
    const open = this.pendingExpiry(row);
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      employeeName: row.employee_name,
      documentNo: row.document_no,
      kind: row.kind,
      status: row.status,
      validity: this.validity(row),
      effectiveDate: row.effective_date,
      endDate: row.end_date,
      terminationDate: row.termination_date,
      // Mức lương hiện hành sau phụ lục đã ký có hiệu lực (QUYTAC_NGHIEPVU_300).
      salary: showSalary ? trim(row.current_salary) : null,
      daysToEnd: open ? row.days_to_end : null,
      overThirtyDays: open && row.kind === "fixed_term" && row.days_to_end !== null && row.days_to_end < -30,
    };
  }

  private async allowances(contractId: string, appendixId: string | null): Promise<ContractAllowance[]> {
    const rows = await this.database.execute<{ name: string; amount: string; allowance_type_id: string | null; allowance_type_name: string | null }>(sql`
      SELECT a.name, a.amount::text, a.allowance_type_id, t.name AS allowance_type_name
      FROM hr.contract_allowances a LEFT JOIN hr.allowance_types t ON t.id = a.allowance_type_id
      WHERE a.contract_id = ${contractId} AND a.appendix_id IS NOT DISTINCT FROM ${appendixId}::uuid ORDER BY a.sort_order`);
    return rows.rows.map((row) => ({ name: row.name, amount: trim(row.amount)!, allowanceTypeId: row.allowance_type_id, allowanceTypeName: row.allowance_type_name }));
  }

  private async appendixRows(contractId: string): Promise<AppendixRow[]> {
    return (
      await this.database.execute<AppendixRow>(sql`
      SELECT a.*, a.effective_date::text, a.sign_date::text, a.salary::text, d.name AS department_name, b.name AS branch_name
      FROM hr.contract_appendices a LEFT JOIN core.departments d ON d.id = a.department_id LEFT JOIN core.branches b ON b.id = a.branch_id
      WHERE a.contract_id = ${contractId} ORDER BY a.effective_date, a.created_at`)
    ).rows;
  }

  private async firstStepOpen(requestId: string | null): Promise<boolean> {
    if (!requestId) return false;
    return (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${requestId} AND level_no = 1 AND decision IS NOT NULL`)).rows.length === 0;
  }

  // Giá trị hiện hành tại một ngày = hợp đồng gốc áp lần lượt các phụ lục đã ký có hiệu lực (QUYTAC_NGHIEPVU_300).
  private async terms(row: ContractRow, appendices: AppendixRow[], day: string | null, showSalary: boolean): Promise<ContractTerms> {
    const terms: ContractTerms = {
      jobTitle: row.job_title,
      departmentId: row.department_id,
      departmentName: row.department_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      salary: trim(row.salary),
      paymentMethod: row.payment_method,
      allowances: await this.allowances(row.id, null),
    };
    if (day !== null) {
      for (const appendix of appendices.filter((item) => item.status === "signed" && item.effective_date <= day)) {
        if (appendix.job_title) terms.jobTitle = appendix.job_title;
        if (appendix.department_id) [terms.departmentId, terms.departmentName] = [appendix.department_id, appendix.department_name!];
        if (appendix.branch_id) [terms.branchId, terms.branchName] = [appendix.branch_id, appendix.branch_name!];
        if (appendix.salary) terms.salary = trim(appendix.salary);
        if (appendix.payment_method) terms.paymentMethod = appendix.payment_method;
        if (appendix.replaces_allowances) terms.allowances = await this.allowances(row.id, appendix.id);
      }
    }
    if (!showSalary) return { ...terms, salary: null, allowances: null };
    return terms;
  }

  private async response(actor: Actor, row: ContractRow, granted: Set<string>, own = false): Promise<ContractResponse> {
    const showSalary = own || granted.has(hrPermission.contract);
    const appendices = await this.appendixRows(row.id);
    const canManage = !own && granted.has(hrPermission.contract);
    const appendixResponses: AppendixResponse[] = [];
    for (const appendix of appendices) {
      if (own && appendix.status !== "signed") continue;
      appendixResponses.push({
        id: appendix.id,
        documentNo: appendix.document_no,
        status: appendix.status,
        effectiveDate: appendix.effective_date,
        jobTitle: appendix.job_title,
        departmentId: appendix.department_id,
        departmentName: appendix.department_name,
        branchId: appendix.branch_id,
        branchName: appendix.branch_name,
        salary: showSalary ? trim(appendix.salary) : null,
        paymentMethod: appendix.payment_method,
        allowances: showSalary && appendix.replaces_allowances ? await this.allowances(row.id, appendix.id) : null,
        description: appendix.description,
        signDate: appendix.sign_date,
        hasSignedFile: appendix.signed_storage_key !== null,
        approvalRequestId: own ? null : appendix.approval_request_id,
        cancelReason: own ? null : appendix.cancel_reason,
        canWithdraw: canManage && appendix.status === "pending" && appendix.created_by === actor.userId && (await this.firstStepOpen(appendix.approval_request_id)),
        version: appendix.version,
      });
    }
    return {
      ...this.listItem(row, showSalary),
      currency: await companyCurrency(this.database, row.company_id),
      original: await this.terms(row, appendices, null, showSalary),
      current: await this.terms(row, appendices, this.permissionService.today(), showSalary),
      probationLevel: row.probation_level,
      officialSalary: showSalary ? trim(row.official_salary) : null,
      signerName: row.signer_name,
      signerTitle: row.signer_title,
      otherTerms: row.other_terms,
      legalExceptionReason: row.legal_exception_reason,
      approvalRequestId: own ? null : row.approval_request_id,
      signDate: row.sign_date,
      hasSignedFile: row.signed_storage_key !== null,
      cancelReason: own ? null : row.cancel_reason,
      terminationReason: row.termination_reason,
      terminationNote: own ? null : row.termination_note,
      appendices: appendixResponses,
      canManage,
      canWithdraw: canManage && row.status === "pending" && row.created_by === actor.userId && (await this.firstStepOpen(row.approval_request_id)),
      version: row.version,
    };
  }

  // Hợp đồng của hồ sơ đã nghỉ chỉ người quản lý hồ sơ hoặc người quản lý hợp đồng xem; ngoài công ty trả 404.
  private async requireVisible(executor: Executor, actor: Actor, id: string, granted: Set<string>, lock = false): Promise<ContractRow> {
    const row = (await executor.execute<ContractRow>(sql`${this.select()} WHERE c.company_id = ${actor.companyId} AND c.id = ${id}${lock ? sql` FOR UPDATE OF c` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.employee_status !== "active" && !granted.has(hrPermission.manage) && !granted.has(hrPermission.contract)) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async list(actor: Actor, query: z.output<typeof contractListQuerySchema>): Promise<ContractListResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.view, hrPermission.contract);
    const conditions = [sql`c.company_id = ${actor.companyId}`];
    if (!granted.has(hrPermission.manage) && !granted.has(hrPermission.contract)) conditions.push(sql`c.employee_status = 'active'`);
    if (query.employeeId) conditions.push(sql`c.employee_id = ${query.employeeId}`);
    if (query.kind) conditions.push(sql`c.kind = ${query.kind}`);
    if (query.status) conditions.push(sql`c.status = ${query.status}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(c.document_no ILIKE ${pattern} OR c.employee_name ILIKE ${pattern} OR c.employee_code ILIKE ${pattern})`);
    }
    // Sắp hết hạn: còn 30 ngày trở xuống hoặc đã hết hạn mà chưa xử lý (QUYTAC_NGHIEPVU_301).
    const base = sql`(${this.select()}) c WHERE ${sql.join(conditions, sql` AND `)}`;
    const expiring = query.expiring === "true" ? sql` AND c.status = 'signed' AND c.end_date IS NOT NULL AND NOT c.has_successor AND c.employee_status = 'active' AND c.days_to_end <= 30` : sql``;
    const fixed = sql`SELECT * FROM ${base}${expiring}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM (${fixed}) counted`)).rows[0]!.total;
    const order = query.expiring === "true" ? sql`ORDER BY c.days_to_end, c.employee_code` : sql`ORDER BY c.effective_date DESC, c.created_at DESC`;
    const rows = await this.database.execute<ContractRow>(sql`SELECT * FROM ${base}${expiring} ${order} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.listItem(row, granted.has(hrPermission.contract))), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.view, hrPermission.contract);
    return this.response(actor, await this.requireVisible(this.database, actor, id, granted), granted);
  }

  // Kiểm luật khi lưu, gửi, ký (QUYTAC_NGHIEPVU_294, 297, 298).
  private async validate(executor: Executor, actor: Actor, input: ContractInput, contractId: string | null, strict: boolean): Promise<void> {
    const fields: Record<string, ErrorMessageKey> = {};
    const employee = (
      await executor.execute<{ status: string; birth_date: string; nationality: string; work_permit_expiry: string | null; hire_date: string }>(sql`
      SELECT status, birth_date::text, nationality, work_permit_expiry::text, hire_date::text FROM hr.employees WHERE id = ${input.employeeId} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!employee) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { employeeId: "invalidValue" } });
    if (employee.status !== "active") throw new ApiError("BUSINESS_RULE", "employeeTerminated");
    if ((await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0)
      fields.departmentId = "invalidValue";
    if ((await executor.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.branchId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0)
      fields.branchId = "invalidValue";
    if (compareDecimal(input.salary, "0") <= 0) fields.salary = "invalidValue";
    for (const [index, allowance] of input.allowances.entries()) if (compareDecimal(allowance.amount, "0") <= 0) fields[`allowances.${index}.amount`] = "invalidValue";
    if (ageAt(employee.birth_date, input.effectiveDate) < 15) fields.effectiveDate = "employeeUnderFifteen";
    const end = input.kind === "indefinite" ? null : (input.endDate ?? null);
    if (input.kind !== "indefinite" && !end) fields.endDate = "required";
    else if (end && end < input.effectiveDate) fields.endDate = "invalidValue";
    else if (end && input.kind === "fixed_term") {
      if (end > monthsEnd(input.effectiveDate, 36)) fields.endDate = "contractOverThirtySixMonths";
      else if (end < monthsEnd(input.effectiveDate, 1)) fields.endDate = "contractUnderOneMonth";
    } else if (end && input.kind === "probation") {
      if (!input.probationLevel) fields.probationLevel = "required";
      else {
        const length = input.probationLevel === "other" ? workingDays(input.effectiveDate, end) : daysInclusive(input.effectiveDate, end);
        if (length > probationLimits[input.probationLevel]) fields.endDate = "probationTooLong";
      }
      if (!input.officialSalary) fields.officialSalary = "required";
      else if (Number(input.salary) * 100 < Number(input.officialSalary) * 85) fields.salary = "probationSalaryTooLow";
    }
    // Người nước ngoài: hợp đồng không vượt thời hạn giấy phép lao động (Bộ luật Lao động Điều 151 khoản 2).
    if (employee.nationality !== "VN" && employee.work_permit_expiry && (end === null || end > employee.work_permit_expiry)) fields.endDate = "contractBeyondWorkPermit";
    if (Object.keys(fields).length === 0) {
      const overlap = await executor.execute(sql`
        SELECT 1 FROM hr.contracts WHERE employee_id = ${input.employeeId} AND id IS DISTINCT FROM ${contractId}::uuid AND status <> 'cancelled'
          AND daterange(effective_date, COALESCE(termination_date, end_date), '[]') && daterange(${input.effectiveDate}::date, ${end}::date, '[]')`);
      if (overlap.rows.length > 0) fields.effectiveDate = "contractOverlap";
    }
    if (Object.keys(fields).length === 0 && input.kind === "probation") {
      const again = await executor.execute(sql`
        SELECT 1 FROM hr.contracts WHERE employee_id = ${input.employeeId} AND id IS DISTINCT FROM ${contractId}::uuid AND status <> 'cancelled' AND kind = 'probation'
          AND lower(job_title) = lower(${input.jobTitle})`);
      if (again.rows.length > 0) fields.kind = "probationRepeated";
    }
    // Chỉ ký thêm 01 lần hợp đồng xác định thời hạn (Điều 20 khoản 2 điểm c), trừ người nước ngoài hoặc ngoại lệ có lý do.
    if (Object.keys(fields).length === 0 && strict && input.kind === "fixed_term" && employee.nationality === "VN" && !input.legalExceptionReason) {
      const previous = await executor.execute<{ effective_date: string; finish: string }>(sql`
        SELECT effective_date::text, COALESCE(termination_date, end_date)::text AS finish FROM hr.contracts
        WHERE employee_id = ${input.employeeId} AND id IS DISTINCT FROM ${contractId}::uuid AND kind = 'fixed_term' AND status IN ('signed', 'terminated') AND effective_date < ${input.effectiveDate}::date
        ORDER BY effective_date DESC`);
      let chain = 0;
      let start = input.effectiveDate;
      for (const row of previous.rows) {
        if (start > addDays(row.finish, 30)) break;
        chain += 1;
        start = row.effective_date;
      }
      if (chain >= 2) fields.kind = "fixedTermLimitReached";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  // Loại phụ cấp phải thuộc công ty, đang dùng (QUYTAC_NGHIEPVU_314).
  private async writeAllowances(
    executor: Executor,
    companyId: string,
    contractId: string,
    appendixId: string | null,
    allowances: { name: string; amount: string; allowanceTypeId: string }[] | null | undefined,
  ): Promise<void> {
    const list = allowances ?? [];
    const fields: Record<string, ErrorMessageKey> = {};
    for (const [index, allowance] of list.entries()) {
      const found = await executor.execute(sql`SELECT 1 FROM hr.allowance_types WHERE id = ${allowance.allowanceTypeId} AND company_id = ${companyId} AND status = 'active'`);
      if (found.rows.length === 0) fields[`allowances.${index}.allowanceTypeId`] = "invalidValue";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await executor.execute(sql`DELETE FROM hr.contract_allowances WHERE contract_id = ${contractId} AND appendix_id IS NOT DISTINCT FROM ${appendixId}::uuid`);
    for (const [index, allowance] of list.entries()) {
      await executor.execute(sql`
        INSERT INTO hr.contract_allowances (contract_id, appendix_id, sort_order, name, amount, allowance_type_id)
        VALUES (${contractId}, ${appendixId}, ${index + 1}, ${allowance.name}, ${allowance.amount}::numeric, ${allowance.allowanceTypeId})`);
    }
  }

  private contractValues(input: ContractInput) {
    const probation = input.kind === "probation";
    return {
      end: input.kind === "indefinite" ? null : (input.endDate ?? null),
      level: probation ? (input.probationLevel ?? null) : null,
      official: probation ? (input.officialSalary ?? null) : null,
      exception: input.kind === "fixed_term" ? input.legalExceptionReason : null,
    };
  }

  async create(actor: Actor, input: ContractInput): Promise<ContractResponse> {
    await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    const id = await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM hr.employees WHERE id = ${input.employeeId} AND company_id = ${actor.companyId} FOR UPDATE`);
      await this.validate(transaction, actor, input, null, false);
      const values = this.contractValues(input);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.contracts (company_id, employee_id, kind, effective_date, end_date, job_title, department_id, branch_id, salary, probation_level, official_salary, payment_method,
          signer_name, signer_title, other_terms, legal_exception_reason, created_by)
        VALUES (${actor.companyId}, ${input.employeeId}, ${input.kind}, ${input.effectiveDate}::date, ${values.end}::date, ${input.jobTitle}, ${input.departmentId}, ${input.branchId},
          ${input.salary}::numeric, ${values.level}, ${values.official}::numeric, ${input.paymentMethod}, ${input.signerName}, ${input.signerTitle}, ${input.otherTerms}, ${values.exception}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.writeAllowances(transaction, actor.companyId, created, null, input.allowances);
      await this.auditService.record({ ...hrAudit(actor, "contract"), action: "contract.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: ContractInput): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    await this.database.transaction(async (transaction) => {
      const before = await this.requireVisible(transaction, actor, id, granted, true);
      if (!editableStatuses.includes(before.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (before.employee_id !== input.employeeId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { employeeId: "invalidValue" } });
      // Số đã cấp giữ nguyên nên không đổi loại hợp đồng giữa các dãy; mọi loại dùng chung dãy hr.contract.
      await this.validate(transaction, actor, input, id, false);
      const values = this.contractValues(input);
      await transaction.execute(sql`
        UPDATE hr.contracts SET kind = ${input.kind}, effective_date = ${input.effectiveDate}::date, end_date = ${values.end}::date, job_title = ${input.jobTitle},
          department_id = ${input.departmentId}, branch_id = ${input.branchId}, salary = ${input.salary}::numeric, probation_level = ${values.level},
          official_salary = ${values.official}::numeric, payment_method = ${input.paymentMethod}, signer_name = ${input.signerName}, signer_title = ${input.signerTitle},
          other_terms = ${input.otherTerms}, legal_exception_reason = ${values.exception}, status = 'draft', updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.writeAllowances(transaction, actor.companyId, id, null, input.allowances);
      await this.auditService.record(
        { ...hrAudit(actor, "contract"), action: "contract.update", entityId: id, beforeData: { status: before.status, salary: before.salary }, afterData: input },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  private inputOf(row: ContractRow, allowances: ContractAllowance[]): ContractInput {
    return {
      employeeId: row.employee_id,
      kind: row.kind,
      effectiveDate: row.effective_date,
      endDate: row.end_date,
      jobTitle: row.job_title,
      departmentId: row.department_id,
      branchId: row.branch_id,
      salary: trim(row.salary)!,
      probationLevel: row.probation_level,
      officialSalary: trim(row.official_salary),
      paymentMethod: row.payment_method,
      // Chỉ dùng để kiểm luật khi gửi, ký (không ghi lại dòng phụ cấp); dòng cũ chưa có loại.
      allowances: allowances.map((allowance) => ({ name: allowance.name, amount: allowance.amount, allowanceTypeId: allowance.allowanceTypeId ?? "" })),
      signerName: row.signer_name,
      signerTitle: row.signer_title,
      otherTerms: row.other_terms,
      legalExceptionReason: row.legal_exception_reason,
    };
  }

  // Gửi duyệt; công ty chưa có chính sách duyệt thì duyệt ngay (QUYTAC_NGHIEPVU_299). Giá trị duyệt là mức lương.
  async submit(actor: Actor, id: string): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    await ensureSequence(this.database, this.sequences, actor, contractDocumentType, "HDLD");
    await this.database.transaction(async (transaction) => {
      const row = await this.requireVisible(transaction, actor, id, granted, true);
      if (!editableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      await transaction.execute(sql`SELECT 1 FROM hr.employees WHERE id = ${row.employee_id} FOR UPDATE`);
      await this.validate(transaction, actor, this.inputOf(row, await this.allowances(id, null)), id, true);
      const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, contractDocumentType, transaction));
      const requestId = await this.submitApproval(transaction, actor, contractDocumentType, id, documentNo, row.salary);
      await transaction.execute(sql`
        UPDATE hr.contracts SET status = ${requestId ? "pending" : "approved"}, document_no = ${documentNo}, approval_request_id = ${requestId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "contract"), action: "contract.submit", entityId: id, afterData: { documentNo, approvalRequestId: requestId } }, transaction);
    });
    return this.detail(actor, id);
  }

  private async submitApproval(transaction: Transaction, actor: Actor, documentTypeCode: string, documentId: string, documentNo: string, amount: string): Promise<string | null> {
    try {
      return await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
        documentTypeCode,
        documentId,
        documentNo,
        amount,
        currency: await companyCurrency(transaction, actor.companyId),
        documentDate: this.permissionService.today(),
      });
    } catch (error) {
      if (error instanceof ApiError && error.messageKey === "policyNotFound") return null;
      throw error;
    }
  }

  async withdraw(actor: Actor, id: string): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    const row = await this.requireVisible(this.database, actor, id, granted);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE hr.contracts SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...hrAudit(actor, "contract"), action: "contract.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Xác nhận đã ký: ngày ký thật, tải bản đã ký (bắt buộc); kiểm lại luật; lao động chưa thành niên cần văn bản đồng ý của người đại diện (QUYTAC_NGHIEPVU_294, 299).
  async sign(actor: Actor, id: string, signDate: string, file: UploadedFile | undefined): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    if (signDate > this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signDate: "invalidValue" } });
    const current = await this.requireVisible(this.database, actor, id, granted);
    if (current.status !== "approved") throw new ApiError("BUSINESS_RULE", "contractNotApproved");
    const stored = await this.employees.storeFile(`hr/${actor.companyId}/contracts/${id}`, file);
    try {
      await this.database.transaction(async (transaction) => {
        const row = await this.requireVisible(transaction, actor, id, granted, true);
        if (row.status !== "approved") throw new ApiError("BUSINESS_RULE", "contractNotApproved");
        await transaction.execute(sql`SELECT 1 FROM hr.employees WHERE id = ${row.employee_id} FOR UPDATE`);
        await this.validate(transaction, actor, this.inputOf(row, await this.allowances(id, null)), id, false);
        const employee = (await transaction.execute<{ birth_date: string }>(sql`SELECT birth_date::text FROM hr.employees WHERE id = ${row.employee_id}`)).rows[0]!;
        if (ageAt(employee.birth_date, row.effective_date) < 18) {
          const consent = await transaction.execute(sql`SELECT 1 FROM hr.employee_documents WHERE employee_id = ${row.employee_id} AND kind = 'guardian_consent'`);
          if (consent.rows.length === 0) throw new ApiError("BUSINESS_RULE", "guardianConsentMissing");
        }
        await transaction.execute(sql`
          UPDATE hr.contracts SET status = 'signed', sign_date = ${signDate}::date, signed_file_name = ${stored.fileName}, signed_content_type = ${stored.contentType},
            signed_size_bytes = ${stored.size}, signed_storage_key = ${stored.storageKey}, updated_at = now(), version = version + 1
          WHERE id = ${id}`);
        await this.placementEvent(transaction, actor, row.employee_id, row.effective_date, { jobTitle: row.job_title, departmentId: row.department_id, branchId: row.branch_id }, "contract", id);
        await this.auditService.record({ ...hrAudit(actor, "contract"), action: "contract.sign", entityId: id, afterData: { signDate, fileName: stored.fileName } }, transaction);
      });
    } catch (error) {
      await this.storage.remove(stored.storageKey).catch(() => undefined);
      throw error;
    }
    return this.detail(actor, id);
  }

  // Hợp đồng, phụ lục ký có vị trí khác vị trí tại ngày hiệu lực thì tạo quyết định "Theo hợp đồng" (QUYTAC_NGHIEPVU_299, 300).
  private async placementEvent(
    executor: Executor,
    actor: Actor,
    employeeId: string,
    effectiveDate: string,
    placement: { jobTitle: string | null; departmentId: string | null; branchId: string | null },
    sourceType: "contract" | "appendix",
    sourceId: string,
  ): Promise<void> {
    const current = (
      await executor.execute<{ department_id: string | null; branch_id: string | null; job_title: string | null; hire_date: string }>(sql`
      SELECT e.hire_date::text, position.* FROM hr.employees e CROSS JOIN LATERAL (SELECT ${positionAt(sql`e.id`, sql`${effectiveDate}::date`)}) position WHERE e.id = ${employeeId}`)
    ).rows[0]!;
    const department = placement.departmentId && placement.departmentId !== current.department_id ? placement.departmentId : null;
    const branch = placement.branchId && placement.branchId !== current.branch_id ? placement.branchId : null;
    const title = placement.jobTitle && placement.jobTitle !== current.job_title ? placement.jobTitle : null;
    if (!department && !branch && !title) return;
    const sameDay = (
      await executor.execute<{ id: string; kind: string; source_type: string; applied_at: Date | null }>(sql`
      SELECT id, kind, source_type, applied_at FROM hr.work_events WHERE employee_id = ${employeeId} AND effective_date = ${effectiveDate}::date FOR UPDATE`)
    ).rows[0];
    if (sameDay) {
      // Cùng ngày với quyết định khác: gộp mục đổi vào quyết định đó (vào làm, quyết định nhập tay giữ loại của mình).
      await executor.execute(sql`
        UPDATE hr.work_events SET department_id = COALESCE(${department}::uuid, department_id), branch_id = COALESCE(${branch}::uuid, branch_id), job_title = COALESCE(${title}, job_title),
          applied_at = NULL, version = version + 1
        WHERE id = ${sameDay.id}`);
    } else {
      await executor.execute(sql`
        INSERT INTO hr.work_events (company_id, employee_id, kind, effective_date, department_id, branch_id, job_title, source_type, source_id, created_by)
        VALUES (${actor.companyId}, ${employeeId}, 'contract', ${effectiveDate}::date, ${department}, ${branch}, ${title}, ${sourceType}, ${sourceId}, ${actor.userId})`);
    }
    await this.workEvents.applyEmployee(executor, employeeId, actor.userId);
  }

  async cancel(actor: Actor, id: string, reason: string): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireVisible(transaction, actor, id, granted, true);
      if (![...editableStatuses, "approved"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "contractNotCancellable");
      await transaction.execute(sql`UPDATE hr.contracts SET status = 'cancelled', cancel_reason = ${reason}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "contract"), action: "contract.cancel", entityId: id, afterData: { reason } }, transaction);
    });
    return this.detail(actor, id);
  }

  async terminate(actor: Actor, id: string, input: TerminateInput): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireVisible(transaction, actor, id, granted, true);
      await this.terminateRow(transaction, actor, row, input);
    });
    return this.detail(actor, id);
  }

  private async terminateRow(executor: Transaction, actor: Actor, row: ContractRow, input: TerminateInput): Promise<void> {
    if (row.status !== "signed") throw new ApiError("BUSINESS_RULE", "contractNotSigned");
    if (input.terminationDate < row.effective_date || (row.end_date && input.terminationDate > row.end_date))
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { terminationDate: "invalidValue" } });
    await executor.execute(sql`
      UPDATE hr.contracts SET status = 'terminated', termination_date = ${input.terminationDate}::date, termination_reason = ${input.reason}, termination_note = ${input.note},
        updated_at = now(), version = version + 1
      WHERE id = ${row.id}`);
    // Phụ lục chưa ký của hợp đồng đã chấm dứt không còn dùng được.
    await executor.execute(
      sql`UPDATE hr.contract_appendices SET status = 'cancelled', cancel_reason = 'contract_terminated', updated_at = now() WHERE contract_id = ${row.id} AND status IN ('draft', 'rejected', 'withdrawn', 'approved')`,
    );
    const pending = await executor.execute<{ id: string; approval_request_id: string }>(sql`
      SELECT id, approval_request_id FROM hr.contract_appendices WHERE contract_id = ${row.id} AND status = 'pending'`);
    for (const appendix of pending.rows) {
      await this.approvals.cancelWithin(executor, appendix.approval_request_id);
      await executor.execute(sql`UPDATE hr.contract_appendices SET status = 'cancelled', cancel_reason = 'contract_terminated', updated_at = now() WHERE id = ${appendix.id}`);
    }
    await this.auditService.record({ ...hrAudit(actor, "contract"), action: "contract.terminate", entityId: row.id, afterData: input }, executor);
  }

  // Nghỉ việc (QUYTAC_NGHIEPVU_301): chấm dứt hợp đồng đã ký, hủy hợp đồng chưa ký, xóa quyết định nhập tay chưa hiệu lực từ ngày nghỉ, tạo quyết định "Nghỉ việc";
  // hồ sơ chuyển "Đã nghỉ" khi đến ngày nghỉ; nhắc quản trị công ty vô hiệu hóa tài khoản liên kết.
  async terminateEmployee(actor: Actor, employeeId: string, input: TerminateInput): Promise<void> {
    await requireHrPermission(this.permissionService, actor, hrPermission.manage);
    await this.database.transaction(async (transaction) => {
      const employee = (
        await transaction.execute<{ id: string; status: string; hire_date: string; termination_date: string | null; user_id: string | null; full_name: string; code: string }>(sql`
        SELECT id, status, hire_date::text, termination_date::text, user_id, full_name, code FROM hr.employees WHERE id = ${employeeId} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!employee) throw new ApiError("NOT_FOUND", "notFound");
      if (employee.status !== "active" || employee.termination_date) throw new ApiError("BUSINESS_RULE", "employeeTerminated");
      if (input.terminationDate <= employee.hire_date) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { terminationDate: "invalidValue" } });
      const contracts = await transaction.execute<ContractRow>(sql`${this.select()} WHERE c.employee_id = ${employeeId} FOR UPDATE OF c`);
      for (const row of contracts.rows) {
        if (row.status === "signed") {
          const finish = row.end_date && row.end_date < input.terminationDate ? null : input.terminationDate < row.effective_date ? row.effective_date : input.terminationDate;
          if (finish) await this.terminateRow(transaction, actor, row, { ...input, terminationDate: finish });
        } else if (row.status === "pending") {
          await this.approvals.cancelWithin(transaction, row.approval_request_id!);
          await transaction.execute(sql`UPDATE hr.contracts SET status = 'cancelled', cancel_reason = 'employee_terminated', updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
        } else if ([...editableStatuses, "approved"].includes(row.status)) {
          await transaction.execute(sql`UPDATE hr.contracts SET status = 'cancelled', cancel_reason = 'employee_terminated', updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
        }
      }
      await transaction.execute(sql`DELETE FROM hr.work_events WHERE employee_id = ${employeeId} AND effective_date >= ${input.terminationDate}::date AND applied_at IS NULL AND kind <> 'hire'`);
      await transaction.execute(sql`
        INSERT INTO hr.work_events (company_id, employee_id, kind, effective_date, note, created_by)
        VALUES (${actor.companyId}, ${employeeId}, 'termination', ${input.terminationDate}::date, ${input.note}, ${actor.userId})
        ON CONFLICT (employee_id, effective_date) DO UPDATE SET kind = 'termination', department_id = NULL, branch_id = NULL, job_title = NULL, note = EXCLUDED.note, applied_at = NULL`);
      await transaction.execute(sql`
        UPDATE hr.employees SET termination_date = ${input.terminationDate}::date, termination_reason = ${input.reason}, termination_note = ${input.note}, updated_at = now(), version = version + 1
        WHERE id = ${employeeId}`);
      await this.workEvents.applyEmployee(transaction, employeeId, actor.userId);
      if (employee.user_id) {
        const admins = await transaction.execute<{ user_id: string }>(sql`
          SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.role_permissions rp ON rp.role_id = a.role_id
          WHERE rp.permission_code = 'platform.user.manage' AND a.valid_from <= ${this.permissionService.today()}::date
            AND (a.valid_to IS NULL OR a.valid_to >= ${this.permissionService.today()}::date) AND (a.scope_type = 'group' OR a.company_id = ${actor.companyId})`);
        await notify(
          transaction,
          admins.rows.map((admin) => ({
            userId: admin.user_id,
            companyId: actor.companyId,
            kind: "hr.employee.terminated",
            title: `Nhân viên ${employee.code} ${employee.full_name} nghỉ việc ngày ${input.terminationDate}: xem xét vô hiệu hóa tài khoản`,
            link: `/platform/users/${employee.user_id}`,
            payload: { employeeId, userId: employee.user_id, terminationDate: input.terminationDate },
          })),
        );
      }
      await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.terminate", entityId: employeeId, afterData: input }, transaction);
    });
  }

  // Phụ lục (QUYTAC_NGHIEPVU_300).
  private async validateAppendix(executor: Executor, actor: Actor, contract: ContractRow, input: AppendixInput, appendixId: string | null): Promise<void> {
    const fields: Record<string, ErrorMessageKey> = {};
    if (contract.status !== "signed" || (contract.end_date && contract.end_date < this.permissionService.today())) throw new ApiError("BUSINESS_RULE", "contractNotSigned");
    if (input.effectiveDate < contract.effective_date || (contract.end_date && input.effectiveDate > contract.end_date)) fields.effectiveDate = "appendixOutsideContract";
    if (
      input.departmentId &&
      (await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0
    )
      fields.departmentId = "invalidValue";
    if (input.branchId && (await executor.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.branchId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0)
      fields.branchId = "invalidValue";
    if (input.salary && compareDecimal(input.salary, "0") <= 0) fields.salary = "invalidValue";
    if (Object.keys(fields).length === 0) {
      const sameDay = await executor.execute(sql`
        SELECT 1 FROM hr.contract_appendices WHERE contract_id = ${contract.id} AND id IS DISTINCT FROM ${appendixId}::uuid AND status <> 'cancelled' AND effective_date = ${input.effectiveDate}::date`);
      if (sameDay.rows.length > 0) fields.effectiveDate = "appendixSameDay";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async appendix(executor: Executor, contractId: string, appendixId: string, lock = false): Promise<AppendixRow> {
    const row = (
      await executor.execute<AppendixRow>(sql`
      SELECT a.*, a.effective_date::text, a.sign_date::text, a.salary::text, NULL AS department_name, NULL AS branch_name
      FROM hr.contract_appendices a WHERE a.id = ${appendixId} AND a.contract_id = ${contractId}${lock ? sql` FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async saveAppendix(actor: Actor, contractId: string, appendixId: string | null, input: AppendixInput): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    await this.database.transaction(async (transaction) => {
      const contract = await this.requireVisible(transaction, actor, contractId, granted, true);
      await this.validateAppendix(transaction, actor, contract, input, appendixId);
      const replaces = input.allowances !== undefined && input.allowances !== null;
      let id = appendixId;
      if (id === null) {
        id = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO hr.contract_appendices (company_id, contract_id, effective_date, job_title, department_id, branch_id, salary, payment_method, replaces_allowances, description, created_by)
          VALUES (${actor.companyId}, ${contractId}, ${input.effectiveDate}::date, ${input.jobTitle}, ${input.departmentId ?? null}, ${input.branchId ?? null}, ${input.salary ?? null}::numeric,
            ${input.paymentMethod ?? null}, ${replaces}, ${input.description}, ${actor.userId})
          RETURNING id`)
        ).rows[0]!.id;
      } else {
        const before = await this.appendix(transaction, contractId, id, true);
        if (!editableStatuses.includes(before.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
        if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`
          UPDATE hr.contract_appendices SET effective_date = ${input.effectiveDate}::date, job_title = ${input.jobTitle}, department_id = ${input.departmentId ?? null},
            branch_id = ${input.branchId ?? null}, salary = ${input.salary ?? null}::numeric, payment_method = ${input.paymentMethod ?? null}, replaces_allowances = ${replaces},
            description = ${input.description}, status = 'draft', updated_at = now(), version = version + 1
          WHERE id = ${id}`);
      }
      await this.writeAllowances(transaction, actor.companyId, contractId, id, replaces ? input.allowances : []);
      await this.auditService.record(
        { ...hrAudit(actor, "contract"), action: appendixId ? "contract.appendix.update" : "contract.appendix.create", entityId: contractId, afterData: { appendixId: id, ...input } },
        transaction,
      );
    });
    return this.detail(actor, contractId);
  }

  async submitAppendix(actor: Actor, contractId: string, appendixId: string): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    await this.database.transaction(async (transaction) => {
      const contract = await this.requireVisible(transaction, actor, contractId, granted, true);
      const row = await this.appendix(transaction, contractId, appendixId, true);
      if (!editableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      const allowances = row.replaces_allowances ? await this.allowances(contractId, appendixId) : null;
      await this.validateAppendix(
        transaction,
        actor,
        contract,
        {
          effectiveDate: row.effective_date,
          jobTitle: row.job_title,
          departmentId: row.department_id,
          branchId: row.branch_id,
          salary: row.salary,
          paymentMethod: row.payment_method,
          // Chỉ dùng để kiểm luật khi gửi; dòng cũ chưa có loại.
          allowances: allowances?.map((allowance) => ({ name: allowance.name, amount: allowance.amount, allowanceTypeId: allowance.allowanceTypeId ?? "" })) ?? null,
          description: row.description,
        },
        appendixId,
      );
      let sequenceNo = row.sequence_no;
      if (sequenceNo === null) {
        sequenceNo = (await transaction.execute<{ next: number }>(sql`SELECT COALESCE(max(sequence_no), 0) + 1 AS next FROM hr.contract_appendices WHERE contract_id = ${contractId}`)).rows[0]!.next;
      }
      const documentNo = row.document_no ?? `${contract.document_no}/PL${String(sequenceNo).padStart(2, "0")}`;
      // Giá trị duyệt: mức lương sau khi áp phụ lục.
      const salary = row.salary ?? (await this.terms(contract, await this.appendixRows(contractId), row.effective_date, true)).salary!;
      const requestId = await this.submitApproval(transaction, actor, appendixDocumentType, appendixId, documentNo, salary);
      await transaction.execute(sql`
        UPDATE hr.contract_appendices SET status = ${requestId ? "pending" : "approved"}, sequence_no = ${sequenceNo}, document_no = ${documentNo}, approval_request_id = ${requestId},
          updated_at = now(), version = version + 1
        WHERE id = ${appendixId}`);
      await this.auditService.record(
        { ...hrAudit(actor, "contract"), action: "contract.appendix.submit", entityId: contractId, afterData: { appendixId, documentNo, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.detail(actor, contractId);
  }

  async withdrawAppendix(actor: Actor, contractId: string, appendixId: string): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    await this.requireVisible(this.database, actor, contractId, granted);
    const row = await this.appendix(this.database, contractId, appendixId);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE hr.contract_appendices SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${appendixId} AND status = 'pending'`);
      await this.auditService.record({ ...hrAudit(actor, "contract"), action: "contract.appendix.withdraw", entityId: contractId, afterData: { appendixId } }, transaction);
    });
    return this.detail(actor, contractId);
  }

  async signAppendix(actor: Actor, contractId: string, appendixId: string, signDate: string, file: UploadedFile | undefined): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    if (signDate > this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signDate: "invalidValue" } });
    await this.requireVisible(this.database, actor, contractId, granted);
    if ((await this.appendix(this.database, contractId, appendixId)).status !== "approved") throw new ApiError("BUSINESS_RULE", "contractNotApproved");
    const stored = await this.employees.storeFile(`hr/${actor.companyId}/contracts/${contractId}`, file);
    try {
      await this.database.transaction(async (transaction) => {
        const contract = await this.requireVisible(transaction, actor, contractId, granted, true);
        if (contract.status !== "signed") throw new ApiError("BUSINESS_RULE", "contractNotSigned");
        const row = await this.appendix(transaction, contractId, appendixId, true);
        if (row.status !== "approved") throw new ApiError("BUSINESS_RULE", "contractNotApproved");
        await transaction.execute(sql`
          UPDATE hr.contract_appendices SET status = 'signed', sign_date = ${signDate}::date, signed_file_name = ${stored.fileName}, signed_content_type = ${stored.contentType},
            signed_size_bytes = ${stored.size}, signed_storage_key = ${stored.storageKey}, updated_at = now(), version = version + 1
          WHERE id = ${appendixId}`);
        await this.placementEvent(
          transaction,
          actor,
          contract.employee_id,
          row.effective_date,
          { jobTitle: row.job_title, departmentId: row.department_id, branchId: row.branch_id },
          "appendix",
          appendixId,
        );
        await this.auditService.record(
          { ...hrAudit(actor, "contract"), action: "contract.appendix.sign", entityId: contractId, afterData: { appendixId, signDate, fileName: stored.fileName } },
          transaction,
        );
      });
    } catch (error) {
      await this.storage.remove(stored.storageKey).catch(() => undefined);
      throw error;
    }
    return this.detail(actor, contractId);
  }

  async cancelAppendix(actor: Actor, contractId: string, appendixId: string, reason: string): Promise<ContractResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.contract);
    await this.database.transaction(async (transaction) => {
      await this.requireVisible(transaction, actor, contractId, granted, true);
      const row = await this.appendix(transaction, contractId, appendixId, true);
      if (![...editableStatuses, "approved"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "contractNotCancellable");
      await transaction.execute(sql`UPDATE hr.contract_appendices SET status = 'cancelled', cancel_reason = ${reason}, updated_at = now(), version = version + 1 WHERE id = ${appendixId}`);
      await this.auditService.record({ ...hrAudit(actor, "contract"), action: "contract.appendix.cancel", entityId: contractId, afterData: { appendixId, reason } }, transaction);
    });
    return this.detail(actor, contractId);
  }

  // Tải bản đã ký: người có quyền xem giấy tờ, hoặc chính người lao động (own); mỗi lần tải ghi nhật ký.
  async downloadSigned(actor: Actor, contractId: string, appendixId: string | null, own: boolean): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    let row: { employee_user_id: string | null; signed_storage_key: string | null; signed_file_name: string | null; signed_content_type: string | null } | undefined;
    if (own) {
      row = (
        await this.database.execute<NonNullable<typeof row>>(sql`
        SELECT e.user_id AS employee_user_id, ${appendixId ? sql`a` : sql`c`}.signed_storage_key, ${appendixId ? sql`a` : sql`c`}.signed_file_name, ${appendixId ? sql`a` : sql`c`}.signed_content_type
        FROM hr.contracts c JOIN hr.employees e ON e.id = c.employee_id ${appendixId ? sql`JOIN hr.contract_appendices a ON a.contract_id = c.id AND a.id = ${appendixId}` : sql``}
        WHERE c.id = ${contractId} AND c.company_id = ${actor.companyId}`)
      ).rows[0];
      if (!row || row.employee_user_id !== actor.userId) throw new ApiError("NOT_FOUND", "notFound");
    } else {
      const granted = await requireHrPermission(this.permissionService, actor, hrPermission.identity);
      const contract = await this.requireVisible(this.database, actor, contractId, granted);
      row = appendixId ? { ...(await this.appendix(this.database, contractId, appendixId)), employee_user_id: contract.employee_user_id } : contract;
    }
    if (!row.signed_storage_key) throw new ApiError("NOT_FOUND", "notFound");
    await this.auditService.record({ ...hrAudit(actor, "contract"), action: own ? "contract.download_own" : "contract.download", entityId: contractId, afterData: { appendixId } });
    return { fileName: row.signed_file_name!, contentType: row.signed_content_type!, content: await this.storage.get(row.signed_storage_key) };
  }

  // API_149: hợp đồng, phụ lục đã ký của chính mình (kèm mức lương).
  async own(actor: Actor): Promise<MyContractsResponse> {
    const employee = await this.employees.ownRow(actor);
    const rows = await this.database.execute<ContractRow>(sql`${this.select()} WHERE c.employee_id = ${employee.id} AND c.status IN ('signed', 'terminated') ORDER BY c.effective_date DESC`);
    const contracts: ContractResponse[] = [];
    for (const row of rows.rows) contracts.push(await this.response(actor, row, new Set(), true));
    return { currency: await companyCurrency(this.database, actor.companyId), contracts };
  }
}
