// Nhu cầu tuyển dụng, tin tuyển dụng (CONG_VIEC_54; CHUC_NANG_190; QUYTAC_NGHIEPVU_380, 381, 383; API_200, API_201).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  ApplicationItem,
  JobPostingItem,
  JobPostingListResponse,
  JobPostingResponse,
  JobPostingStatus,
  RecruitmentContractKind,
  RecruitmentOptionsResponse,
  RecruitmentReason,
  RecruitmentRequestItem,
  RecruitmentRequestListResponse,
  RecruitmentRequestResponse,
  RecruitmentRequestStatus,
  SalaryDisplay,
  StageCounts,
  WorkType,
  jobPostingListQuerySchema,
  recruitmentRequestListQuerySchema,
  saveJobPostingSchema,
  saveRecruitmentRequestSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { hrAudit, hrGranted } from "./hr-context";

type Executor = Pick<Database, "execute">;
type Transaction = Pick<Database, "execute" | "insert">;
type RequestInput = z.output<typeof saveRecruitmentRequestSchema>;
type PostingInput = z.output<typeof saveJobPostingSchema>;

export const recruitmentPermission = {
  request: "hr.recruitment.request",
  manage: "hr.recruitment.manage",
} as const;
export const recruitmentRequestDocumentType = "hr.recruitment_request";
const editableStatuses = ["draft", "rejected", "withdrawn"];

type RequestRow = {
  id: string;
  document_no: string | null;
  department_id: string;
  department_name: string;
  branch_id: string;
  branch_name: string;
  job_title: string;
  headcount: number;
  hired_count: number;
  contract_kind: RecruitmentContractKind;
  salary_min: string;
  salary_max: string;
  needed_by: string;
  reason: RecruitmentReason;
  description: string | null;
  status: RecruitmentRequestStatus;
  approval_request_id: string | null;
  cancel_reason: string | null;
  close_reason: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  version: number;
};

type PostingRow = {
  id: string;
  request_id: string;
  request_no: string | null;
  request_status: RecruitmentRequestStatus;
  request_salary_min: string;
  request_salary_max: string;
  request_headcount: number;
  request_hired_count: number;
  title: string;
  location: string;
  work_type: WorkType;
  description: string;
  requirements: string | null;
  benefits: string | null;
  salary_display: SalaryDisplay;
  salary_min: string | null;
  salary_max: string | null;
  deadline: string;
  contact_email: string;
  is_public: boolean;
  status: JobPostingStatus;
  published_at: string | null;
  version: number;
};

// Bỏ số 0 thừa ở phần thập phân của numeric: "8000000.00" → "8000000".
export const trimDecimal = (value: string | null) => (value === null ? null : value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""));
export const likePattern = (search: string) => `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;

export async function requireRecruitmentPermission(permissionService: PermissionService, actor: Actor, ...anyOf: string[]): Promise<Set<string>> {
  const granted = await hrGranted(permissionService, actor);
  if (!anyOf.some((permission) => granted.has(permission))) throw new ApiError("FORBIDDEN", "forbidden");
  return granted;
}

// Đếm hồ sơ ứng tuyển theo giai đoạn của các tin; hồ sơ đã kết thúc tính vào "ended".
export async function stageCounts(executor: Executor, postingIds: string[]): Promise<Map<string, StageCounts>> {
  const result = new Map<string, StageCounts>();
  for (const id of postingIds) result.set(id, { new: 0, screening: 0, interview: 0, offer: 0, hired: 0, ended: 0 });
  if (postingIds.length === 0) return result;
  const rows = await executor.execute<{ posting_id: string; stage: string; total: number }>(sql`
    SELECT posting_id, CASE WHEN ended_at IS NULL THEN stage ELSE 'ended' END AS stage, count(*)::int AS total
    FROM hr.applications WHERE posting_id IN (${sql.join(
      postingIds.map((id) => sql`${id}`),
      sql`, `,
    )}) GROUP BY 1, 2`);
  for (const row of rows.rows) result.get(row.posting_id)![row.stage as keyof StageCounts] = row.total;
  return result;
}

@Injectable()
export class RecruitmentService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
  ) {}

  // Kết quả luồng duyệt của nhu cầu tuyển dụng (QUYTAC_NGHIEPVU_380).
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (String(event.payload.documentTypeCode) !== recruitmentRequestDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.execute(sql`
        UPDATE hr.recruitment_requests SET status = ${status}, updated_at = now() WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`);
    });
  }

  async options(actor: Actor): Promise<RecruitmentOptionsResponse> {
    const granted = await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.request, recruitmentPermission.manage);
    const departments = await this.database.execute<{ id: string; code: string; name: string }>(
      sql`SELECT id, code, name FROM core.departments WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`,
    );
    const branches = await this.database.execute<{ id: string; code: string; name: string; address: string | null }>(
      sql`SELECT id, code, name, address FROM core.branches WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`,
    );
    if (!granted.has(recruitmentPermission.manage)) return { departments: departments.rows, branches: branches.rows, approvedRequests: [], openPostings: [] };
    const requests = await this.database.execute<{ id: string; document_no: string | null; job_title: string; salary_min: string; salary_max: string }>(sql`
      SELECT id, document_no, job_title, salary_min::text, salary_max::text FROM hr.recruitment_requests WHERE company_id = ${actor.companyId} AND status = 'approved' ORDER BY created_at DESC`);
    const postings = await this.database.execute<{ id: string; title: string }>(sql`SELECT id, title FROM hr.job_postings WHERE company_id = ${actor.companyId} AND status = 'open' ORDER BY title`);
    return {
      departments: departments.rows,
      branches: branches.rows,
      approvedRequests: requests.rows.map((row) => ({
        id: row.id,
        documentNo: row.document_no,
        jobTitle: row.job_title,
        salaryMin: trimDecimal(row.salary_min)!,
        salaryMax: trimDecimal(row.salary_max)!,
      })),
      openPostings: postings.rows,
    };
  }

  // ---------- Nhu cầu tuyển dụng ----------

  private requestSelect(): SQL {
    return sql`
      SELECT r.id, r.document_no, r.department_id, d.name AS department_name, r.branch_id, b.name AS branch_name, r.job_title, r.headcount, r.hired_count, r.contract_kind,
        r.salary_min::text, r.salary_max::text, r.needed_by::text, r.reason, r.description, r.status, r.approval_request_id, r.cancel_reason, r.close_reason,
        r.created_by, u.full_name AS created_by_name, r.created_at::text, r.version
      FROM hr.recruitment_requests r
      JOIN core.departments d ON d.id = r.department_id
      JOIN core.branches b ON b.id = r.branch_id
      JOIN core.users u ON u.id = r.created_by`;
  }

  // Người chỉ có quyền lập nhu cầu chỉ thấy nhu cầu của mình; ngoài phạm vi trả 404.
  private visibility(actor: Actor, granted: Set<string>): SQL {
    return granted.has(recruitmentPermission.manage) ? sql`TRUE` : sql`r.created_by = ${actor.userId}`;
  }

  private async requireRequest(executor: Executor, actor: Actor, id: string, granted: Set<string>, lock = false): Promise<RequestRow> {
    const row = (
      await executor.execute<RequestRow>(
        sql`${this.requestSelect()} WHERE r.company_id = ${actor.companyId} AND r.id = ${id} AND ${this.visibility(actor, granted)}${lock ? sql` FOR UPDATE OF r` : sql``}`,
      )
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private item(row: RequestRow): RecruitmentRequestItem {
    return {
      id: row.id,
      documentNo: row.document_no,
      jobTitle: row.job_title,
      departmentId: row.department_id,
      departmentName: row.department_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      headcount: row.headcount,
      hiredCount: row.hired_count,
      salaryMin: trimDecimal(row.salary_min)!,
      salaryMax: trimDecimal(row.salary_max)!,
      neededBy: row.needed_by,
      status: row.status,
      createdByName: row.created_by_name,
    };
  }

  private async firstStepOpen(requestId: string | null): Promise<boolean> {
    if (!requestId) return false;
    return (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${requestId} AND level_no = 1 AND decision IS NOT NULL`)).rows.length === 0;
  }

  async listRequests(actor: Actor, query: z.output<typeof recruitmentRequestListQuerySchema>): Promise<RecruitmentRequestListResponse> {
    const granted = await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.request, recruitmentPermission.manage);
    const conditions = [sql`r.company_id = ${actor.companyId}`, this.visibility(actor, granted)];
    if (query.status) conditions.push(sql`r.status = ${query.status}`);
    if (query.departmentId) conditions.push(sql`r.department_id = ${query.departmentId}`);
    if (query.search) conditions.push(sql`(r.document_no ILIKE ${likePattern(query.search)} OR r.job_title ILIKE ${likePattern(query.search)})`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM hr.recruitment_requests r WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<RequestRow>(sql`${this.requestSelect()} WHERE ${where} ORDER BY r.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.item(row)), page: query.page, pageSize: query.pageSize, total };
  }

  async requestDetail(actor: Actor, id: string): Promise<RecruitmentRequestResponse> {
    const granted = await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.request, recruitmentPermission.manage);
    const row = await this.requireRequest(this.database, actor, id, granted);
    const manage = granted.has(recruitmentPermission.manage);
    const owner = row.created_by === actor.userId;
    const postings = manage ? await this.postingItems(this.database, sql`p.request_id = ${id}`) : [];
    return {
      ...this.item(row),
      contractKind: row.contract_kind,
      reason: row.reason,
      description: row.description,
      approvalRequestId: row.approval_request_id,
      cancelReason: row.cancel_reason,
      closeReason: row.close_reason,
      createdAt: row.created_at,
      createdBy: row.created_by,
      version: row.version,
      postings,
      canEdit: (owner || manage) && editableStatuses.includes(row.status),
      canSubmit: (owner || manage) && editableStatuses.includes(row.status),
      canWithdraw: owner && row.status === "pending" && (await this.firstStepOpen(row.approval_request_id)),
      canCancel: (owner || manage) && editableStatuses.includes(row.status),
      canClose: manage && row.status === "approved",
      canCreatePosting: manage && row.status === "approved",
    };
  }

  private async validateRequest(executor: Executor, actor: Actor, input: RequestInput, strict: boolean): Promise<void> {
    const fields: Record<string, ErrorMessageKey> = {};
    const department = await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`);
    if (department.rows.length === 0) fields.departmentId = "invalidValue";
    const branch = await executor.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.branchId} AND company_id = ${actor.companyId} AND status = 'active'`);
    if (branch.rows.length === 0) fields.branchId = "invalidValue";
    if (Number(input.salaryMax) < Number(input.salaryMin)) fields.salaryMax = "recruitmentSalaryRange";
    if (strict && input.neededBy < this.permissionService.today()) fields.neededBy = "recruitmentNeededByPast";
    if (Object.keys(fields).length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private values(input: RequestInput) {
    return sql`department_id = ${input.departmentId}, branch_id = ${input.branchId}, job_title = ${input.jobTitle}, headcount = ${input.headcount}, contract_kind = ${input.contractKind},
      salary_min = ${input.salaryMin}, salary_max = ${input.salaryMax}, needed_by = ${input.neededBy}, reason = ${input.reason}, description = ${input.description}`;
  }

  async createRequest(actor: Actor, input: RequestInput): Promise<RecruitmentRequestResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.request, recruitmentPermission.manage);
    await this.validateRequest(this.database, actor, input, false);
    const id = await this.database.transaction(async (transaction) => {
      const created = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.recruitment_requests (company_id, department_id, branch_id, job_title, headcount, contract_kind, salary_min, salary_max, needed_by, reason, description, created_by)
        VALUES (${actor.companyId}, ${input.departmentId}, ${input.branchId}, ${input.jobTitle}, ${input.headcount}, ${input.contractKind}, ${input.salaryMin}, ${input.salaryMax},
          ${input.neededBy}, ${input.reason}, ${input.description}, ${actor.userId}) RETURNING id`);
      const requestId = created.rows[0]!.id;
      await this.auditService.record({ ...hrAudit(actor, "recruitment_request"), action: "recruitment_request.create", entityId: requestId }, transaction);
      return requestId;
    });
    return this.requestDetail(actor, id);
  }

  async updateRequest(actor: Actor, id: string, input: RequestInput): Promise<RecruitmentRequestResponse> {
    const granted = await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.request, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireRequest(transaction, actor, id, granted, true);
      if (!editableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      if (input.version !== undefined && input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.validateRequest(transaction, actor, input, false);
      await transaction.execute(sql`UPDATE hr.recruitment_requests SET ${this.values(input)}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "recruitment_request"), action: "recruitment_request.update", entityId: id }, transaction);
    });
    return this.requestDetail(actor, id);
  }

  // Gửi duyệt; giá trị duyệt = lương tối đa × số lượng; chưa có chính sách duyệt thì duyệt ngay (QUYTAC_NGHIEPVU_380).
  async submitRequest(actor: Actor, id: string): Promise<RecruitmentRequestResponse> {
    const granted = await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.request, recruitmentPermission.manage);
    await ensureSequence(this.database, this.sequences, actor, recruitmentRequestDocumentType, "TD");
    await this.database.transaction(async (transaction) => {
      const row = await this.requireRequest(transaction, actor, id, granted, true);
      if (!editableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      await this.validateRequest(
        transaction,
        actor,
        {
          departmentId: row.department_id,
          branchId: row.branch_id,
          jobTitle: row.job_title,
          headcount: row.headcount,
          contractKind: row.contract_kind,
          salaryMin: row.salary_min,
          salaryMax: row.salary_max,
          neededBy: row.needed_by,
          reason: row.reason,
          description: row.description,
        },
        true,
      );
      const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, recruitmentRequestDocumentType, transaction));
      const amount = (Number(row.salary_max) * row.headcount).toFixed(2);
      const requestId = await this.submitApproval(transaction, actor, recruitmentRequestDocumentType, id, documentNo, amount);
      await transaction.execute(sql`
        UPDATE hr.recruitment_requests SET status = ${requestId ? "pending" : "approved"}, document_no = ${documentNo}, approval_request_id = ${requestId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record(
        { ...hrAudit(actor, "recruitment_request"), action: "recruitment_request.submit", entityId: id, afterData: { documentNo, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.requestDetail(actor, id);
  }

  async submitApproval(transaction: Transaction, actor: Actor, documentTypeCode: string, documentId: string, documentNo: string, amount: string): Promise<string | null> {
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

  async withdrawRequest(actor: Actor, id: string): Promise<RecruitmentRequestResponse> {
    const granted = await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.request, recruitmentPermission.manage);
    const row = await this.requireRequest(this.database, actor, id, granted);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE hr.recruitment_requests SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...hrAudit(actor, "recruitment_request"), action: "recruitment_request.withdraw", entityId: id }, transaction);
    });
    return this.requestDetail(actor, id);
  }

  async cancelRequest(actor: Actor, id: string, reason: string): Promise<RecruitmentRequestResponse> {
    const granted = await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.request, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireRequest(transaction, actor, id, granted, true);
      if (!editableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "recruitmentStatusInvalid");
      await transaction.execute(sql`UPDATE hr.recruitment_requests SET status = 'cancelled', cancel_reason = ${reason}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "recruitment_request"), action: "recruitment_request.cancel", entityId: id, afterData: { reason } }, transaction);
    });
    return this.requestDetail(actor, id);
  }

  // Đóng nhu cầu đã duyệt: đóng mọi tin của nhu cầu (QUYTAC_NGHIEPVU_380).
  async closeRequest(actor: Actor, id: string, reason: string): Promise<RecruitmentRequestResponse> {
    const granted = await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireRequest(transaction, actor, id, granted, true);
      if (row.status !== "approved") throw new ApiError("BUSINESS_RULE", "recruitmentStatusInvalid");
      await transaction.execute(sql`UPDATE hr.recruitment_requests SET status = 'closed', close_reason = ${reason}, closed_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.closePostings(transaction, sql`request_id = ${id} AND status = 'open'`);
      await this.auditService.record({ ...hrAudit(actor, "recruitment_request"), action: "recruitment_request.close", entityId: id, afterData: { reason } }, transaction);
    });
    return this.requestDetail(actor, id);
  }

  // ---------- Tin tuyển dụng ----------

  private postingSelect(): SQL {
    return sql`
      SELECT p.id, p.request_id, r.document_no AS request_no, r.status AS request_status, r.salary_min::text AS request_salary_min, r.salary_max::text AS request_salary_max,
        r.headcount AS request_headcount, r.hired_count AS request_hired_count, p.title, p.location, p.work_type, p.description, p.requirements, p.benefits, p.salary_display,
        p.salary_min::text, p.salary_max::text, p.deadline::text, p.contact_email, p.is_public, p.status, p.published_at::text, p.version
      FROM hr.job_postings p JOIN hr.recruitment_requests r ON r.id = p.request_id`;
  }

  private async postingItems(executor: Executor, where: SQL, limit = 1000, offset = 0): Promise<JobPostingItem[]> {
    const rows = await executor.execute<PostingRow>(sql`${this.postingSelect()} WHERE ${where} ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`);
    const counts = await stageCounts(
      executor,
      rows.rows.map((row) => row.id),
    );
    return rows.rows.map((row) => ({
      id: row.id,
      requestId: row.request_id,
      requestNo: row.request_no,
      title: row.title,
      deadline: row.deadline,
      isPublic: row.is_public,
      status: row.status,
      stageCounts: counts.get(row.id)!,
    }));
  }

  private async requirePosting(executor: Executor, actor: Actor, id: string, lock = false): Promise<PostingRow> {
    const row = (await executor.execute<PostingRow>(sql`${this.postingSelect()} WHERE p.company_id = ${actor.companyId} AND p.id = ${id}${lock ? sql` FOR UPDATE OF p` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async listPostings(actor: Actor, query: z.output<typeof jobPostingListQuerySchema>): Promise<JobPostingListResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const conditions = [sql`p.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`p.status = ${query.status}`);
    if (query.requestId) conditions.push(sql`p.request_id = ${query.requestId}`);
    if (query.search) conditions.push(sql`p.title ILIKE ${likePattern(query.search)}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM hr.job_postings p WHERE ${where}`)).rows[0]!.total;
    return { data: await this.postingItems(this.database, where, query.pageSize, (query.page - 1) * query.pageSize), page: query.page, pageSize: query.pageSize, total };
  }

  async postingDetail(actor: Actor, id: string): Promise<JobPostingResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const row = await this.requirePosting(this.database, actor, id);
    const counts = await stageCounts(this.database, [id]);
    const applications = await this.applicationItems(this.database, sql`a.posting_id = ${id}`);
    const today = this.permissionService.today();
    return {
      id: row.id,
      requestId: row.request_id,
      requestNo: row.request_no,
      title: row.title,
      deadline: row.deadline,
      isPublic: row.is_public,
      status: row.status,
      stageCounts: counts.get(id)!,
      location: row.location,
      workType: row.work_type,
      description: row.description,
      requirements: row.requirements,
      benefits: row.benefits,
      salaryDisplay: row.salary_display,
      salaryMin: trimDecimal(row.salary_min),
      salaryMax: trimDecimal(row.salary_max),
      requestSalaryMin: trimDecimal(row.request_salary_min)!,
      requestSalaryMax: trimDecimal(row.request_salary_max)!,
      requestHeadcount: row.request_headcount,
      requestHiredCount: row.request_hired_count,
      contactEmail: row.contact_email,
      publishedAt: row.published_at,
      version: row.version,
      applications,
      canEdit: row.status !== "closed",
      canPublish: row.status === "draft" && row.request_status === "approved" && row.deadline >= today,
      canClose: row.status === "open",
      canReopen: row.status === "closed" && row.request_status === "approved",
    };
  }

  // Danh sách hồ sơ ứng tuyển kèm đánh dấu "Có thể trùng" theo email, điện thoại trong công ty (QUYTAC_NGHIEPVU_383).
  async applicationItems(executor: Executor, where: SQL): Promise<ApplicationItem[]> {
    const rows = await executor.execute<{
      id: string;
      candidate_id: string;
      full_name: string;
      posting_id: string;
      posting_title: string;
      source: ApplicationItem["source"];
      experience_years: number | null;
      stage: ApplicationItem["stage"];
      outcome: ApplicationItem["outcome"];
      outcome_reason: ApplicationItem["outcomeReason"];
      possible_duplicate: boolean;
      employee_id: string | null;
      created_at: string;
      ended_at: string | null;
    }>(sql`
      SELECT a.id, a.candidate_id, c.full_name, a.posting_id, p.title AS posting_title, c.source, c.experience_years, a.stage, a.outcome, a.outcome_reason,
        ${duplicateCondition(sql`c`)} AS possible_duplicate, a.employee_id, a.created_at::text, a.ended_at::text
      FROM hr.applications a JOIN hr.candidates c ON c.id = a.candidate_id JOIN hr.job_postings p ON p.id = a.posting_id
      WHERE ${where} ORDER BY a.created_at DESC`);
    return rows.rows.map((row) => ({
      id: row.id,
      candidateId: row.candidate_id,
      candidateName: row.full_name,
      postingId: row.posting_id,
      postingTitle: row.posting_title,
      source: row.source,
      experienceYears: row.experience_years,
      stage: row.stage,
      outcome: row.outcome,
      outcomeReason: row.outcome_reason,
      possibleDuplicate: row.possible_duplicate,
      employeeId: row.employee_id,
      createdAt: row.created_at,
      endedAt: row.ended_at,
    }));
  }

  // Khoảng lương nhập riêng phải nằm trong khoảng của nhu cầu; hạn nộp từ hôm nay (QUYTAC_NGHIEPVU_381).
  private validatePosting(input: PostingInput, request: { salary_min: string; salary_max: string }): void {
    const fields: Record<string, ErrorMessageKey> = {};
    if (input.deadline < this.permissionService.today()) fields.deadline = "postingDeadlinePast";
    if (input.salaryDisplay === "custom_range") {
      if (!input.salaryMin) fields.salaryMin = "required";
      if (!input.salaryMax) fields.salaryMax = "required";
      if (input.salaryMin && input.salaryMax) {
        if (Number(input.salaryMax) < Number(input.salaryMin)) fields.salaryMax = "recruitmentSalaryRange";
        else if (Number(input.salaryMin) < Number(request.salary_min) || Number(input.salaryMax) > Number(request.salary_max)) fields.salaryMax = "postingSalaryOutsideRequest";
      }
    }
    if (Object.keys(fields).length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private salary(input: PostingInput) {
    return input.salaryDisplay === "custom_range" ? { minimum: input.salaryMin, maximum: input.salaryMax } : { minimum: null, maximum: null };
  }

  async createPosting(actor: Actor, input: PostingInput): Promise<JobPostingResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const id = await this.database.transaction(async (transaction) => {
      const request = (
        await transaction.execute<{ status: string; salary_min: string; salary_max: string }>(sql`
        SELECT status, salary_min::text, salary_max::text FROM hr.recruitment_requests WHERE id = ${input.requestId} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!request) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { requestId: "invalidValue" } });
      if (request.status !== "approved") throw new ApiError("BUSINESS_RULE", "recruitmentNotApproved");
      this.validatePosting(input, request);
      const salary = this.salary(input);
      const created = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.job_postings (company_id, request_id, title, location, work_type, description, requirements, benefits, salary_display, salary_min, salary_max, deadline, contact_email, is_public, created_by)
        VALUES (${actor.companyId}, ${input.requestId}, ${input.title}, ${input.location}, ${input.workType}, ${input.description}, ${input.requirements}, ${input.benefits}, ${input.salaryDisplay},
          ${salary.minimum}, ${salary.maximum}, ${input.deadline}, ${input.contactEmail}, ${input.isPublic}, ${actor.userId}) RETURNING id`);
      const postingId = created.rows[0]!.id;
      await this.auditService.record({ ...hrAudit(actor, "job_posting"), action: "job_posting.create", entityId: postingId }, transaction);
      return postingId;
    });
    return this.postingDetail(actor, id);
  }

  // Tin đang đăng sửa được mọi trường, ghi nhật ký (QUYTAC_NGHIEPVU_381). Không đổi nhu cầu của tin.
  async updatePosting(actor: Actor, id: string, input: PostingInput): Promise<JobPostingResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requirePosting(transaction, actor, id, true);
      if (row.status === "closed") throw new ApiError("BUSINESS_RULE", "postingStatusInvalid");
      if (input.requestId !== row.request_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { requestId: "invalidValue" } });
      if (input.version !== undefined && input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      this.validatePosting(input, { salary_min: row.request_salary_min, salary_max: row.request_salary_max });
      const salary = this.salary(input);
      await transaction.execute(sql`
        UPDATE hr.job_postings SET title = ${input.title}, location = ${input.location}, work_type = ${input.workType}, description = ${input.description}, requirements = ${input.requirements},
          benefits = ${input.benefits}, salary_display = ${input.salaryDisplay}, salary_min = ${salary.minimum}, salary_max = ${salary.maximum}, deadline = ${input.deadline},
          contact_email = ${input.contactEmail}, is_public = ${input.isPublic}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      const changed = (["title", "location", "workType", "description", "requirements", "benefits", "salaryDisplay", "deadline", "contactEmail", "isPublic"] as const).filter((field) => {
        const before = {
          title: row.title,
          location: row.location,
          workType: row.work_type,
          description: row.description,
          requirements: row.requirements,
          benefits: row.benefits,
          salaryDisplay: row.salary_display,
          deadline: row.deadline,
          contactEmail: row.contact_email,
          isPublic: row.is_public,
        }[field];
        return before !== input[field];
      });
      await this.auditService.record({ ...hrAudit(actor, "job_posting"), action: "job_posting.update", entityId: id, afterData: { changed } }, transaction);
    });
    return this.postingDetail(actor, id);
  }

  async publishPosting(actor: Actor, id: string): Promise<JobPostingResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requirePosting(transaction, actor, id, true);
      if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "postingStatusInvalid");
      if (row.request_status !== "approved") throw new ApiError("BUSINESS_RULE", "recruitmentNotApproved");
      if (row.deadline < this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { deadline: "postingDeadlinePast" } });
      await transaction.execute(sql`UPDATE hr.job_postings SET status = 'open', published_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "job_posting"), action: "job_posting.publish", entityId: id }, transaction);
    });
    return this.postingDetail(actor, id);
  }

  async closePosting(actor: Actor, id: string): Promise<JobPostingResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requirePosting(transaction, actor, id, true);
      if (row.status !== "open") throw new ApiError("BUSINESS_RULE", "postingStatusInvalid");
      await this.closePostings(transaction, sql`id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "job_posting"), action: "job_posting.close", entityId: id }, transaction);
    });
    return this.postingDetail(actor, id);
  }

  async reopenPosting(actor: Actor, id: string, deadline: string): Promise<JobPostingResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requirePosting(transaction, actor, id, true);
      if (row.status !== "closed") throw new ApiError("BUSINESS_RULE", "postingStatusInvalid");
      if (row.request_status !== "approved") throw new ApiError("BUSINESS_RULE", "recruitmentNotApproved");
      if (deadline < this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { deadline: "postingDeadlinePast" } });
      await transaction.execute(sql`UPDATE hr.job_postings SET status = 'open', deadline = ${deadline}, closed_at = NULL, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "job_posting"), action: "job_posting.reopen", entityId: id, afterData: { deadline } }, transaction);
    });
    return this.postingDetail(actor, id);
  }

  // Đóng tin: hồ sơ ở giai đoạn mới, sàng lọc kết thúc lý do "tin đã đóng"; tính lại ngày xóa ứng viên (QUYTAC_NGHIEPVU_383, 388).
  async closePostings(transaction: Executor, where: SQL): Promise<void> {
    const closed = await transaction.execute<{ id: string }>(
      sql`UPDATE hr.job_postings SET status = 'closed', closed_at = now(), updated_at = now(), version = version + 1 WHERE ${where} RETURNING id`,
    );
    if (closed.rows.length === 0) return;
    const ids = sql.join(
      closed.rows.map((row) => sql`${row.id}`),
      sql`, `,
    );
    const ended = await transaction.execute<{ candidate_id: string }>(sql`
      UPDATE hr.applications SET outcome = 'rejected', outcome_reason = 'posting_closed', ended_at = now(), updated_at = now(), version = version + 1
      WHERE posting_id IN (${ids}) AND ended_at IS NULL AND stage IN ('new', 'screening') RETURNING candidate_id`);
    for (const candidateId of new Set(ended.rows.map((row) => row.candidate_id))) await recomputeEraseDue(transaction, candidateId);
  }

  // Việc nền 0 giờ 10 phút (hr-recruitment-daily).
  async runDaily(): Promise<{ closedPostings: number }> {
    return { closedPostings: await this.closeExpiredPostings() };
  }

  // Đóng tin quá hạn nộp (QUYTAC_NGHIEPVU_381).
  async closeExpiredPostings(): Promise<number> {
    const today = this.permissionService.today();
    return this.database.transaction(async (transaction) => {
      const expired = await transaction.execute<{ id: string; company_id: string }>(sql`SELECT id, company_id FROM hr.job_postings WHERE status = 'open' AND deadline < ${today} FOR UPDATE`);
      for (const posting of expired.rows) {
        await this.closePostings(transaction, sql`id = ${posting.id}`);
        await this.auditService.record({ actorUserId: null, companyId: posting.company_id, appCode: "hr", entityType: "job_posting", action: "job_posting.expire", entityId: posting.id }, transaction);
      }
      return expired.rows.length;
    });
  }
}

// Có ứng viên khác chưa xóa trong cùng công ty trùng email hoặc điện thoại (QUYTAC_NGHIEPVU_383).
export const duplicateCondition = (candidate: SQL) => sql`(${candidate}.erased_at IS NULL AND EXISTS (
  SELECT 1 FROM hr.candidates other WHERE other.company_id = ${candidate}.company_id AND other.id <> ${candidate}.id AND other.erased_at IS NULL
    AND (other.email_key = ${candidate}.email_key OR other.phone_key = ${candidate}.phone_key)))`;

// Ngày xóa của ứng viên (QUYTAC_NGHIEPVU_388): đã thành nhân viên hoặc còn hồ sơ đang xử lý thì không có;
// còn lại ngày kết thúc muộn nhất + số ngày giữ, hoặc ngày đồng ý kho gần nhất + số tháng kho nếu muộn hơn.
export async function recomputeEraseDue(executor: Executor, candidateId: string): Promise<void> {
  await executor.execute(sql`
    UPDATE hr.candidates c SET erase_due = CASE
        WHEN EXISTS (SELECT 1 FROM hr.applications a WHERE a.candidate_id = c.id AND (a.employee_id IS NOT NULL OR a.ended_at IS NULL)) THEN NULL
        ELSE NULLIF(GREATEST(
          COALESCE((SELECT max((a.ended_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) FROM hr.applications a WHERE a.candidate_id = c.id) + settings.days, '-infinity'::date),
          COALESCE(((SELECT max(k.consented_on) FROM hr.candidate_consents k WHERE k.candidate_id = c.id AND k.purpose = 'talent_pool' AND k.withdrawn_at IS NULL)
            + make_interval(months => settings.months))::date, '-infinity'::date)
        ), '-infinity'::date)
      END,
      updated_at = now()
    FROM (SELECT COALESCE(s.rejected_retention_days, 30) AS days, COALESCE(s.pool_retention_months, 12) AS months
          FROM hr.candidates x LEFT JOIN hr.recruitment_settings s ON s.company_id = x.company_id WHERE x.id = ${candidateId}) settings
    WHERE c.id = ${candidateId} AND c.erased_at IS NULL`);
}
