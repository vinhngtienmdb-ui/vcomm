// Đề nghị nhận việc, liên kết trả lời, lập hồ sơ nhân sự từ ứng viên (CONG_VIEC_54; CHUC_NANG_191; QUYTAC_NGHIEPVU_386, 387; API_203).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { EmployeeDraftResponse, JobOfferResponse, OfferAnswerPageResponse, recordOfferResponseSchema, saveEmployeeSchema, saveJobOfferSchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { messages } from "i18n";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { notify } from "../common/notifications";
import { OUTBOUND_MESSAGES, webOrigin, type OutboundMessages } from "../common/outbound-messages";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { EmployeesService, type Transaction } from "./employees.service";
import { hrAudit } from "./hr-context";
import { applicationContext } from "./interviews.service";
import { fillTemplate, offerEmail } from "./recruitment-emails";
import { recomputeEraseDue, recruitmentPermission, RecruitmentService, requireRecruitmentPermission, trimDecimal } from "./recruitment.service";

type Executor = Pick<Database, "execute">;
type OfferInput = z.output<typeof saveJobOfferSchema>;
export const jobOfferDocumentType = "hr.job_offer";
const editableStatuses = ["draft", "rejected", "withdrawn"];
const openStatuses = ["draft", "pending", "approved", "rejected", "withdrawn", "sent"];
export const tokenHash = (token: string) => createHash("sha256").update(token).digest();

type OfferRow = {
  id: string;
  company_id: string;
  application_id: string;
  candidate_id: string;
  request_id: string;
  document_no: string | null;
  job_title: string;
  department_id: string;
  department_name: string;
  branch_id: string;
  branch_name: string;
  contract_kind: JobOfferResponse["contractKind"];
  salary: string;
  start_date: string;
  response_deadline: string;
  note: string | null;
  outside_range_reason: string | null;
  request_salary_min: string;
  request_salary_max: string;
  status: JobOfferResponse["status"];
  approval_request_id: string | null;
  sent_at: string | null;
  responded_at: string | null;
  response_channel: JobOfferResponse["responseChannel"];
  response_note: string | null;
  cancel_reason: string | null;
  employee_id: string | null;
  created_by: string;
  version: number;
};

@Injectable()
export class JobOffersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(OUTBOUND_MESSAGES) private readonly outbound: OutboundMessages,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly recruitment: RecruitmentService,
    private readonly employees: EmployeesService,
  ) {}

  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (String(event.payload.documentTypeCode) !== jobOfferDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.execute(sql`
        UPDATE hr.job_offers SET status = ${status}, updated_at = now() WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`);
    });
  }

  private select(): SQL {
    return sql`
      SELECT o.id, o.company_id, o.application_id, a.candidate_id, p.request_id, o.document_no, o.job_title, o.department_id, d.name AS department_name, o.branch_id, b.name AS branch_name,
        o.contract_kind, o.salary::text, o.start_date::text, o.response_deadline::text, o.note, o.outside_range_reason, r.salary_min::text AS request_salary_min,
        r.salary_max::text AS request_salary_max, o.status, o.approval_request_id, o.sent_at::text, o.responded_at::text, o.response_channel, o.response_note, o.cancel_reason,
        a.employee_id, o.created_by, o.version
      FROM hr.job_offers o JOIN hr.applications a ON a.id = o.application_id JOIN hr.job_postings p ON p.id = a.posting_id
      JOIN hr.recruitment_requests r ON r.id = p.request_id JOIN core.departments d ON d.id = o.department_id JOIN core.branches b ON b.id = o.branch_id`;
  }

  private async requireOffer(executor: Executor, actor: Actor, id: string, lock = false): Promise<OfferRow> {
    const row = (await executor.execute<OfferRow>(sql`${this.select()} WHERE o.company_id = ${actor.companyId} AND o.id = ${id}${lock ? sql` FOR UPDATE OF o` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async firstStepOpen(requestId: string | null): Promise<boolean> {
    if (!requestId) return false;
    return (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${requestId} AND level_no = 1 AND decision IS NOT NULL`)).rows.length === 0;
  }

  async response(actor: Actor, row: OfferRow): Promise<JobOfferResponse> {
    return {
      id: row.id,
      applicationId: row.application_id,
      documentNo: row.document_no,
      jobTitle: row.job_title,
      departmentId: row.department_id,
      departmentName: row.department_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      contractKind: row.contract_kind,
      salary: trimDecimal(row.salary)!,
      startDate: row.start_date,
      responseDeadline: row.response_deadline,
      note: row.note,
      outsideRangeReason: row.outside_range_reason,
      requestSalaryMin: trimDecimal(row.request_salary_min)!,
      requestSalaryMax: trimDecimal(row.request_salary_max)!,
      status: row.status,
      approvalRequestId: row.approval_request_id,
      sentAt: row.sent_at,
      respondedAt: row.responded_at,
      responseChannel: row.response_channel,
      responseNote: row.response_note,
      cancelReason: row.cancel_reason,
      employeeId: row.employee_id,
      version: row.version,
      canEdit: editableStatuses.includes(row.status),
      canSubmit: editableStatuses.includes(row.status),
      canWithdraw: row.status === "pending" && row.created_by === actor.userId && (await this.firstStepOpen(row.approval_request_id)),
      canCancel: openStatuses.includes(row.status),
      canSend: row.status === "approved" || row.status === "sent",
      canRecordResponse: row.status === "sent",
      canHire: row.status === "accepted" && row.employee_id === null,
    };
  }

  async forCandidate(actor: Actor, candidateId: string): Promise<JobOfferResponse[]> {
    const rows = await this.database.execute<OfferRow>(sql`${this.select()} WHERE o.company_id = ${actor.companyId} AND a.candidate_id = ${candidateId} ORDER BY o.created_at DESC`);
    return Promise.all(rows.rows.map((row) => this.response(actor, row)));
  }

  async detail(actor: Actor, id: string): Promise<JobOfferResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    return this.response(actor, await this.requireOffer(this.database, actor, id));
  }

  // Ngoài khoảng lương của nhu cầu phải có lý do; ngày bắt đầu, hạn trả lời kiểm khi gửi (QUYTAC_NGHIEPVU_386).
  private async validate(executor: Executor, actor: Actor, input: OfferInput, strict: boolean): Promise<void> {
    const fields: Record<string, ErrorMessageKey> = {};
    const range = (
      await executor.execute<{ salary_min: string; salary_max: string }>(sql`
      SELECT r.salary_min::text, r.salary_max::text FROM hr.applications a JOIN hr.job_postings p ON p.id = a.posting_id JOIN hr.recruitment_requests r ON r.id = p.request_id
      WHERE a.id = ${input.applicationId}`)
    ).rows[0]!;
    if (Number(input.salary) < Number(range.salary_min) || Number(input.salary) > Number(range.salary_max)) {
      if (!input.outsideRangeReason) fields.outsideRangeReason = "offerOutsideRange";
    }
    if ((await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0) {
      fields.departmentId = "invalidValue";
    }
    if ((await executor.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.branchId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0)
      fields.branchId = "invalidValue";
    if (input.responseDeadline >= input.startDate) fields.responseDeadline = "offerDeadlineInvalid";
    const today = this.permissionService.today();
    if (strict && input.startDate < today) fields.startDate = "offerStartPast";
    if (strict && input.responseDeadline < today) fields.responseDeadline = "offerDeadlineInvalid";
    if (Object.keys(fields).length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private inputOf(row: OfferRow): OfferInput {
    return {
      applicationId: row.application_id,
      jobTitle: row.job_title,
      departmentId: row.department_id,
      branchId: row.branch_id,
      contractKind: row.contract_kind,
      salary: row.salary,
      startDate: row.start_date,
      responseDeadline: row.response_deadline,
      note: row.note,
      outsideRangeReason: row.outside_range_reason,
    };
  }

  // Lập đề nghị chuyển hồ sơ sang giai đoạn đề nghị; mỗi hồ sơ một đề nghị chưa kết thúc.
  async create(actor: Actor, input: OfferInput): Promise<JobOfferResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const id = await this.database.transaction(async (transaction) => {
      const context = await applicationContext(transaction, actor.companyId, input.applicationId, true);
      if (context.ended || context.erased || context.stage === "hired") throw new ApiError("BUSINESS_RULE", "applicationEnded");
      const open = await transaction.execute(sql`SELECT 1 FROM hr.job_offers WHERE application_id = ${input.applicationId} AND status <> ALL (ARRAY['declined', 'expired', 'cancelled'])`);
      if (open.rows.length) throw new ApiError("BUSINESS_RULE", "offerOpenExists");
      await this.validate(transaction, actor, input, false);
      const created = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.job_offers (company_id, application_id, job_title, department_id, branch_id, contract_kind, salary, start_date, response_deadline, note, outside_range_reason, created_by)
        VALUES (${actor.companyId}, ${input.applicationId}, ${input.jobTitle}, ${input.departmentId}, ${input.branchId}, ${input.contractKind}, ${input.salary}, ${input.startDate},
          ${input.responseDeadline}, ${input.note}, ${input.outsideRangeReason}, ${actor.userId}) RETURNING id`);
      await transaction.execute(sql`UPDATE hr.applications SET stage = 'offer', updated_at = now(), version = version + 1 WHERE id = ${input.applicationId}`);
      const offerId = created.rows[0]!.id;
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.offer.create", entityId: context.candidate_id, afterData: { offerId } }, transaction);
      return offerId;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: OfferInput): Promise<JobOfferResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireOffer(transaction, actor, id, true);
      if (!editableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      if (input.applicationId !== row.application_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { applicationId: "invalidValue" } });
      if (input.version !== undefined && input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.validate(transaction, actor, input, false);
      await transaction.execute(sql`
        UPDATE hr.job_offers SET job_title = ${input.jobTitle}, department_id = ${input.departmentId}, branch_id = ${input.branchId}, contract_kind = ${input.contractKind},
          salary = ${input.salary}, start_date = ${input.startDate}, response_deadline = ${input.responseDeadline}, note = ${input.note}, outside_range_reason = ${input.outsideRangeReason},
          updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.offer.update", entityId: row.candidate_id, afterData: { offerId: id } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gửi duyệt; giá trị duyệt = mức lương; chưa có chính sách duyệt thì duyệt ngay.
  async submit(actor: Actor, id: string): Promise<JobOfferResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await ensureSequence(this.database, this.sequences, actor, jobOfferDocumentType, "DNNV");
    await this.database.transaction(async (transaction) => {
      const row = await this.requireOffer(transaction, actor, id, true);
      if (!editableStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      await this.validate(transaction, actor, this.inputOf(row), true);
      const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, jobOfferDocumentType, transaction));
      const requestId = await this.recruitment.submitApproval(transaction, actor, jobOfferDocumentType, id, documentNo, row.salary);
      await transaction.execute(sql`
        UPDATE hr.job_offers SET status = ${requestId ? "pending" : "approved"}, document_no = ${documentNo}, approval_request_id = ${requestId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record(
        { ...hrAudit(actor, "candidate"), action: "candidate.offer.submit", entityId: row.candidate_id, afterData: { offerId: id, documentNo, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<JobOfferResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const row = await this.requireOffer(this.database, actor, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE hr.job_offers SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.offer.withdraw", entityId: row.candidate_id, afterData: { offerId: id } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Hủy đề nghị chưa chấp nhận: liên kết mất hiệu lực, hồ sơ về giai đoạn phỏng vấn.
  async cancel(actor: Actor, id: string, reason: string): Promise<JobOfferResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireOffer(transaction, actor, id, true);
      if (!openStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "offerStatusInvalid");
      await this.cancelRow(transaction, row, reason);
      await transaction.execute(sql`UPDATE hr.applications SET stage = 'interview', updated_at = now(), version = version + 1 WHERE id = ${row.application_id} AND ended_at IS NULL`);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.offer.cancel", entityId: row.candidate_id, afterData: { offerId: id, reason } }, transaction);
    });
    return this.detail(actor, id);
  }

  async cancelRow(transaction: Transaction, row: Pick<OfferRow, "id" | "status" | "approval_request_id">, reason: string): Promise<void> {
    if (row.status === "pending" && row.approval_request_id) await this.approvals.cancelWithin(transaction, row.approval_request_id);
    await transaction.execute(sql`
      UPDATE hr.job_offers SET status = 'cancelled', cancel_reason = ${reason}, response_token_expires_at = NULL, updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
  }

  // Gửi thư đề nghị kèm liên kết trả lời mới (mã cũ mất hiệu lực) hoặc chỉ đánh dấu đã báo ngoài hệ thống.
  async send(actor: Actor, id: string, sendEmail: boolean, message: string | null): Promise<JobOfferResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const token = randomBytes(32).toString("base64url");
    const row = await this.database.transaction(async (transaction) => {
      const row = await this.requireOffer(transaction, actor, id, true);
      if (row.status !== "approved" && row.status !== "sent") throw new ApiError("BUSINESS_RULE", "offerStatusInvalid");
      if (row.response_deadline < this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { responseDeadline: "offerDeadlineInvalid" } });
      await transaction.execute(sql`
        UPDATE hr.job_offers SET status = 'sent', sent_at = now(),
          response_token_hash = ${sendEmail ? tokenHash(token) : null},
          response_token_expires_at = ${sendEmail ? sql`((response_deadline + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')` : sql`NULL`},
          updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.offer.send", entityId: row.candidate_id, afterData: { offerId: id, email: sendEmail } }, transaction);
      return row;
    });
    if (sendEmail) {
      const context = await applicationContext(this.database, actor.companyId, row.application_id);
      if (!context.candidate_email) throw new ApiError("BUSINESS_RULE", "emailMissing");
      const email = offerEmail({
        locale: context.locale,
        candidateName: context.candidate_name,
        companyName: context.company_name,
        jobTitle: row.job_title,
        departmentName: row.department_name,
        branchName: row.branch_name,
        salary: row.salary,
        startDate: row.start_date,
        responseDeadline: row.response_deadline,
        link: `${webOrigin()}/hr/careers/offers/${token}`,
        contactEmail: context.contact_email,
        message,
      });
      await this.outbound.send({ channel: "email", to: context.candidate_email, subject: email.subject, body: email.body });
      // Lịch sử email không lưu liên kết trả lời.
      await this.database.execute(sql`
        INSERT INTO hr.candidate_emails (company_id, candidate_id, application_id, kind, recipient, subject, body, sent_by)
        VALUES (${actor.companyId}, ${context.candidate_id}, ${row.application_id}, 'offer', ${context.candidate_email}, ${email.subject},
          ${email.body.replace(token, "…")}, ${actor.userId})`);
    }
    return this.detail(actor, id);
  }

  // Áp dụng trả lời: chấp nhận chuyển hồ sơ sang nhận việc; từ chối kết thúc hồ sơ (QUYTAC_NGHIEPVU_386).
  private async applyAnswer(
    transaction: Transaction,
    row: OfferRow,
    accepted: boolean,
    channel: "link" | "manual",
    respondedAt: SQL,
    note: string | null,
    client: { ip: string | null; userAgent: string | null },
  ) {
    await transaction.execute(sql`
      UPDATE hr.job_offers SET status = ${accepted ? "accepted" : "declined"}, responded_at = ${respondedAt}, response_channel = ${channel}, response_note = ${note},
        response_ip = ${client.ip}, response_user_agent = ${client.userAgent?.slice(0, 500) ?? null}, response_token_expires_at = NULL, updated_at = now(), version = version + 1
      WHERE id = ${row.id}`);
    if (accepted) await transaction.execute(sql`UPDATE hr.applications SET stage = 'hired', updated_at = now(), version = version + 1 WHERE id = ${row.application_id}`);
    else {
      await transaction.execute(sql`
        UPDATE hr.applications SET outcome = 'rejected', outcome_reason = 'declined_offer', ended_at = now(), updated_at = now(), version = version + 1 WHERE id = ${row.application_id} AND ended_at IS NULL`);
      await recomputeEraseDue(transaction, row.candidate_id);
    }
  }

  async recordResponse(actor: Actor, id: string, input: z.output<typeof recordOfferResponseSchema>): Promise<JobOfferResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    if (input.respondedOn > this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { respondedOn: "invalidValue" } });
    await this.database.transaction(async (transaction) => {
      const row = await this.requireOffer(transaction, actor, id, true);
      if (row.status !== "sent") throw new ApiError("BUSINESS_RULE", "offerStatusInvalid");
      await this.applyAnswer(transaction, row, input.accepted, "manual", sql`(${input.respondedOn}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`, input.note, { ip: null, userAgent: null });
      await this.auditService.record(
        { ...hrAudit(actor, "candidate"), action: "candidate.offer.response", entityId: row.candidate_id, afterData: { offerId: id, accepted: input.accepted, channel: "manual" } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // ---------- Trang trả lời công khai ----------

  private async byToken(executor: Executor, token: string, lock = false) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError("NOT_FOUND", "notFound");
    const row = (
      await executor.execute<OfferRow & { candidate_name: string; company_name: string; open: boolean }>(sql`
      SELECT x.*, c.full_name AS candidate_name, co.legal_name AS company_name,
        (x.status = 'sent' AND o.response_token_expires_at > now()) AS open
      FROM (${this.select()} WHERE o.response_token_hash = ${tokenHash(token)}) x
      JOIN hr.job_offers o ON o.id = x.id JOIN hr.candidates c ON c.id = x.candidate_id JOIN core.companies co ON co.id = x.company_id
      WHERE c.erased_at IS NULL${lock ? sql` FOR UPDATE OF o` : sql``}`)
    ).rows[0];
    // Hết hạn, đã hủy hoặc mã sai: 404 như nhau; đã trả lời qua liên kết thì vẫn xem được kết quả.
    if (!row || (!row.open && !(row.response_channel === "link" && (row.status === "accepted" || row.status === "declined")))) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async answerPage(token: string): Promise<OfferAnswerPageResponse> {
    const row = await this.byToken(this.database, token);
    return {
      companyName: row.company_name,
      candidateName: row.candidate_name,
      jobTitle: row.job_title,
      departmentName: row.department_name,
      branchName: row.branch_name,
      salary: trimDecimal(row.salary)!,
      startDate: row.start_date,
      responseDeadline: row.response_deadline,
      answered: row.status === "accepted" || row.status === "declined" ? row.status : null,
    };
  }

  // Mỗi liên kết trả lời một lần; ghi IP, trình duyệt; báo người lập đề nghị.
  async answer(token: string, accepted: boolean, note: string | null, client: { ip: string | null; userAgent: string | null }): Promise<OfferAnswerPageResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.byToken(transaction, token, true);
      if (!row.open) throw new ApiError("BUSINESS_RULE", "offerStatusInvalid");
      await this.applyAnswer(transaction, row, accepted, "link", sql`now()`, note, client);
      const text = messages.vi.recruitmentEmails;
      await notify(transaction, [
        {
          userId: row.created_by,
          companyId: row.company_id,
          kind: "hr.job_offer.answered",
          title: fillTemplate(text.notifyOfferAnswered, { candidate: row.candidate_name, answer: accepted ? text.answerAccepted : text.answerDeclined, documentNo: row.document_no ?? "" }),
          link: `/hr/candidates/${row.candidate_id}`,
        },
      ]);
      await this.auditService.record(
        {
          actorUserId: null,
          companyId: row.company_id,
          appCode: "hr",
          entityType: "candidate",
          action: "candidate.offer.response",
          entityId: row.candidate_id,
          ip: client.ip ?? undefined,
          afterData: { offerId: row.id, accepted, channel: "link" },
        },
        transaction,
      );
    });
    return this.answerPage(token);
  }

  // ---------- Lập hồ sơ nhân sự từ ứng viên (QUYTAC_NGHIEPVU_387) ----------

  async employeeDraft(actor: Actor, id: string): Promise<EmployeeDraftResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const row = await this.requireOffer(this.database, actor, id);
    if (row.status !== "accepted") throw new ApiError("BUSINESS_RULE", "offerNotAccepted");
    if (row.employee_id) throw new ApiError("BUSINESS_RULE", "candidateHired");
    const candidate = (
      await this.database.execute<{ full_name: string; phone: string | null; email: string | null; education_level: EmployeeDraftResponse["educationLevel"] }>(sql`
      SELECT full_name, phone, email, education_level FROM hr.candidates WHERE id = ${row.candidate_id}`)
    ).rows[0]!;
    return {
      fullName: candidate.full_name,
      phone: candidate.phone,
      personalEmail: candidate.email,
      educationLevel: candidate.education_level,
      departmentId: row.department_id,
      branchId: row.branch_id,
      jobTitle: row.job_title,
      hireDate: row.start_date,
    };
  }

  // Lập hồ sơ nhân sự và trong cùng giao dịch: liên kết hồ sơ ứng tuyển, chép sơ yếu lý lịch, tăng số đã tuyển (khóa nhu cầu), đủ số thì hoàn thành nhu cầu, đóng tin.
  async hire(actor: Actor, id: string, input: z.output<typeof saveEmployeeSchema>) {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const row = await this.requireOffer(this.database, actor, id);
    if (row.status !== "accepted") throw new ApiError("BUSINESS_RULE", "offerNotAccepted");
    if (row.employee_id) throw new ApiError("BUSINESS_RULE", "candidateHired");
    const copied: string[] = [];
    try {
      return await this.employees.create(actor, input, async (transaction, employeeId) => {
        const request = (
          await transaction.execute<{ headcount: number; hired_count: number; status: string }>(sql`
          SELECT headcount, hired_count, status FROM hr.recruitment_requests WHERE id = ${row.request_id} FOR UPDATE`)
        ).rows[0]!;
        if (request.hired_count >= request.headcount) throw new ApiError("BUSINESS_RULE", "headcountReached");
        const linked = await transaction.execute(
          sql`UPDATE hr.applications SET employee_id = ${employeeId}, updated_at = now(), version = version + 1 WHERE id = ${row.application_id} AND employee_id IS NULL RETURNING id`,
        );
        if (linked.rows.length === 0) throw new ApiError("BUSINESS_RULE", "candidateHired");
        const resume = (
          await transaction.execute<{ file_name: string; content_type: string; size_bytes: number; storage_key: string }>(sql`
          SELECT file_name, content_type, size_bytes, storage_key FROM hr.candidate_files WHERE candidate_id = ${row.candidate_id} AND kind = 'resume' AND storage_key IS NOT NULL
          ORDER BY uploaded_at DESC LIMIT 1`)
        ).rows[0];
        if (resume) {
          const key = `hr/${actor.companyId}/employees/${employeeId}/${randomUUID()}`.toLowerCase();
          await this.storage.put(key, await this.storage.get(resume.storage_key), resume.content_type);
          copied.push(key);
          await transaction.execute(sql`
            INSERT INTO hr.employee_documents (company_id, employee_id, kind, file_name, content_type, size_bytes, storage_key, uploaded_by)
            VALUES (${actor.companyId}, ${employeeId}, 'resume', ${resume.file_name}, ${resume.content_type}, ${resume.size_bytes}, ${key}, ${actor.userId})`);
        }
        const hired = request.hired_count + 1;
        await transaction.execute(sql`
          UPDATE hr.recruitment_requests SET hired_count = ${hired}, status = ${hired >= request.headcount && request.status === "approved" ? "completed" : request.status},
            updated_at = now(), version = version + 1 WHERE id = ${row.request_id}`);
        if (hired >= request.headcount) await this.recruitment.closePostings(transaction, sql`request_id = ${row.request_id} AND status = 'open'`);
        await recomputeEraseDue(transaction, row.candidate_id);
        await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.hire", entityId: row.candidate_id, afterData: { offerId: id, employeeId } }, transaction);
      });
    } catch (error) {
      for (const key of copied) await this.storage.remove(key).catch(() => undefined);
      throw error;
    }
  }

  // Việc nền: đề nghị đã gửi quá hạn trả lời chuyển hết hạn; hồ sơ giữ giai đoạn đề nghị (QUYTAC_NGHIEPVU_386).
  async expireDue(): Promise<number> {
    const result = await this.database.execute<{ id: string }>(sql`
      UPDATE hr.job_offers SET status = 'expired', response_token_expires_at = NULL, updated_at = now(), version = version + 1
      WHERE status = 'sent' AND response_deadline < ${this.permissionService.today()} RETURNING id`);
    return result.rows.length;
  }
}
