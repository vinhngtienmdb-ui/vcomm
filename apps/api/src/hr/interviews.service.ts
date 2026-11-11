// Vòng phỏng vấn, phiếu đánh giá, email kèm tệp lịch (CONG_VIEC_54; CHUC_NANG_191; QUYTAC_NGHIEPVU_384, 385; API_202).
import { Inject, Injectable } from "@nestjs/common";
import type { InterviewEvaluationItem, InterviewItem, MyInterviewItem, MyInterviewResponse, cancelInterviewSchema, interviewEvaluationSchema, saveInterviewSchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { messages } from "i18n";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { notify } from "../common/notifications";
import { OUTBOUND_MESSAGES, type OutboundMessages } from "../common/outbound-messages";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { CandidatesService } from "./candidates.service";
import { hrAudit } from "./hr-context";
import { fillTemplate, interviewCalendar, interviewEmail, interviewerEmail, rejectionEmail, type EmailLocale, type InterviewEmailInput } from "./recruitment-emails";
import { recruitmentPermission, requireRecruitmentPermission } from "./recruitment.service";

type Executor = Pick<Database, "execute">;
type InterviewInput = z.output<typeof saveInterviewSchema>;

// Ngữ cảnh gửi email của một hồ sơ ứng tuyển: ứng viên, tin, công ty.
export type ApplicationContext = {
  application_id: string;
  candidate_id: string;
  company_id: string;
  candidate_name: string;
  candidate_email: string | null;
  locale: EmailLocale;
  erased: boolean;
  stage: string;
  ended: boolean;
  posting_title: string;
  contact_email: string;
  company_name: string;
  request_id: string;
};

export async function applicationContext(executor: Executor, companyId: string, applicationId: string, lock = false): Promise<ApplicationContext> {
  const row = (
    await executor.execute<ApplicationContext>(sql`
    SELECT a.id AS application_id, c.id AS candidate_id, a.company_id, c.full_name AS candidate_name, c.email AS candidate_email, c.locale, c.erased_at IS NOT NULL AS erased,
      a.stage, a.ended_at IS NOT NULL AS ended, p.title AS posting_title, p.contact_email, co.legal_name AS company_name, p.request_id
    FROM hr.applications a JOIN hr.candidates c ON c.id = a.candidate_id JOIN hr.job_postings p ON p.id = a.posting_id JOIN core.companies co ON co.id = a.company_id
    WHERE a.id = ${applicationId} AND a.company_id = ${companyId}${lock ? sql` FOR UPDATE OF a` : sql``}`)
  ).rows[0];
  if (!row) throw new ApiError("NOT_FOUND", "notFound");
  return row;
}

type InterviewRow = {
  id: string;
  application_id: string;
  posting_title: string;
  name: string;
  starts_at: string;
  duration_minutes: number;
  mode: InterviewItem["mode"];
  location: string | null;
  meeting_url: string | null;
  status: InterviewItem["status"];
  calendar_sequence: number;
};

@Injectable()
export class InterviewsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(OUTBOUND_MESSAGES) private readonly outbound: OutboundMessages,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly candidates: CandidatesService,
  ) {}

  private select(): SQL {
    return sql`
      SELECT i.id, i.application_id, p.title AS posting_title, i.name, i.starts_at::text, i.duration_minutes, i.mode, i.location, i.meeting_url, i.status, i.calendar_sequence
      FROM hr.interviews i JOIN hr.applications a ON a.id = i.application_id JOIN hr.job_postings p ON p.id = a.posting_id`;
  }

  // Danh sách vòng của các hồ sơ; hideOthersFor: người phỏng vấn chưa nộp phiếu thì không thấy phiếu người khác.
  async items(executor: Executor, where: SQL, hideOthersFor: string | null = null): Promise<InterviewItem[]> {
    const rows = await executor.execute<InterviewRow>(sql`${this.select()} WHERE ${where} ORDER BY i.starts_at`);
    if (rows.rows.length === 0) return [];
    const ids = sql.join(
      rows.rows.map((row) => sql`${row.id}`),
      sql`, `,
    );
    const interviewers = await executor.execute<{ interview_id: string; id: string; full_name: string }>(sql`
      SELECT x.interview_id, u.id, u.full_name FROM hr.interview_interviewers x JOIN core.users u ON u.id = x.user_id WHERE x.interview_id IN (${ids}) ORDER BY u.full_name`);
    const evaluations = await executor.execute<{
      interview_id: string;
      interviewer_id: string;
      full_name: string;
      score: number;
      recommendation: InterviewEvaluationItem["recommendation"];
      comment: string | null;
      submitted_at: string;
    }>(sql`
      SELECT e.interview_id, e.interviewer_id, u.full_name, e.score, e.recommendation, e.comment, e.submitted_at::text
      FROM hr.interview_evaluations e JOIN core.users u ON u.id = e.interviewer_id WHERE e.interview_id IN (${ids}) ORDER BY e.submitted_at`);
    return rows.rows.map((row) => {
      const own = evaluations.rows.filter((item) => item.interview_id === row.id);
      const visible = hideOthersFor && !own.some((item) => item.interviewer_id === hideOthersFor) ? [] : own;
      return {
        id: row.id,
        applicationId: row.application_id,
        postingTitle: row.posting_title,
        name: row.name,
        startsAt: row.starts_at,
        durationMinutes: row.duration_minutes,
        mode: row.mode,
        location: row.location,
        meetingUrl: row.meeting_url,
        status: row.status,
        interviewers: interviewers.rows.filter((item) => item.interview_id === row.id).map((item) => ({ id: item.id, fullName: item.full_name })),
        evaluations: visible.map((item) => ({
          interviewerId: item.interviewer_id,
          interviewerName: item.full_name,
          score: item.score,
          recommendation: item.recommendation,
          comment: item.comment,
          submittedAt: item.submitted_at,
        })),
      };
    });
  }

  private validate(input: InterviewInput): void {
    const fields: Record<string, "required"> = {};
    if (input.mode === "onsite" && !input.location) fields.location = "required";
    if (input.mode === "online" && !input.meetingUrl) fields.meetingUrl = "required";
    if (Object.keys(fields).length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async requireInterviewers(executor: Executor, companyId: string, ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    const rows = await executor.execute(sql`
      SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
      WHERE m.company_id = ${companyId} AND m.status = 'active' AND u.status = 'active' AND u.id IN (${sql.join(
        unique.map((id) => sql`${id}`),
        sql`, `,
      )})`);
    if (rows.rows.length !== unique.length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { interviewerIds: "interviewerInvalid" } });
  }

  private async requireInterview(executor: Executor, actor: Actor, interviewId: string, lock = false): Promise<InterviewRow & { company_id: string }> {
    const row = (
      await executor.execute<InterviewRow & { company_id: string }>(sql`
      SELECT i.id, i.company_id, i.application_id, i.name, i.starts_at::text, i.duration_minutes, i.mode, i.location, i.meeting_url, i.status, i.calendar_sequence, '' AS posting_title
      FROM hr.interviews i WHERE i.id = ${interviewId} AND i.company_id = ${actor.companyId}${lock ? sql` FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async create(actor: Actor, applicationId: string, input: InterviewInput): Promise<string> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    this.validate(input);
    const { id, context } = await this.database.transaction(async (transaction) => {
      const context = await applicationContext(transaction, actor.companyId, applicationId, true);
      if (context.ended || context.erased) throw new ApiError("BUSINESS_RULE", "applicationEnded");
      if (context.stage === "hired") throw new ApiError("BUSINESS_RULE", "applicationStageInvalid");
      await this.requireInterviewers(transaction, actor.companyId, input.interviewerIds);
      const created = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.interviews (company_id, application_id, name, starts_at, duration_minutes, mode, location, meeting_url, created_by)
        VALUES (${actor.companyId}, ${applicationId}, ${input.name}, ${input.startsAt}, ${input.durationMinutes}, ${input.mode},
          ${input.mode === "onsite" ? input.location : null}, ${input.mode === "online" ? input.meetingUrl : null}, ${actor.userId}) RETURNING id`);
      const interviewId = created.rows[0]!.id;
      await this.writeInterviewers(transaction, interviewId, input.interviewerIds);
      // Lập vòng phỏng vấn chuyển hồ sơ sang giai đoạn phỏng vấn (QUYTAC_NGHIEPVU_384).
      await transaction.execute(sql`UPDATE hr.applications SET stage = 'interview', updated_at = now(), version = version + 1 WHERE id = ${applicationId} AND stage IN ('new', 'screening')`);
      const title = fillTemplate(messages.vi.recruitmentEmails.notifyInterview, { candidate: context.candidate_name, title: context.posting_title });
      await notify(
        transaction,
        [...new Set(input.interviewerIds)].map((userId) => ({ userId, companyId: actor.companyId, kind: "hr.interview.assigned", title, link: `/hr/interviews/${interviewId}` })),
      );
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.interview.create", entityId: context.candidate_id, afterData: { interviewId, applicationId } }, transaction);
      return { id: interviewId, context };
    });
    if (input.sendEmail) await this.sendEmails(actor, context, id, "interview_invitation", input.message);
    return context.candidate_id;
  }

  private async writeInterviewers(executor: Executor, interviewId: string, ids: string[]): Promise<void> {
    await executor.execute(sql`DELETE FROM hr.interview_interviewers WHERE interview_id = ${interviewId}`);
    for (const userId of new Set(ids)) await executor.execute(sql`INSERT INTO hr.interview_interviewers (interview_id, user_id) VALUES (${interviewId}, ${userId})`);
  }

  // Đổi lịch khi đang lên lịch; tăng số thứ tự bản lịch để lịch của người nhận cập nhật.
  async update(actor: Actor, interviewId: string, input: InterviewInput): Promise<string> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    this.validate(input);
    const context = await this.database.transaction(async (transaction) => {
      const row = await this.requireInterview(transaction, actor, interviewId, true);
      if (row.status !== "scheduled") throw new ApiError("BUSINESS_RULE", "interviewNotScheduled");
      const context = await applicationContext(transaction, actor.companyId, row.application_id);
      if (context.ended || context.erased) throw new ApiError("BUSINESS_RULE", "applicationEnded");
      await this.requireInterviewers(transaction, actor.companyId, input.interviewerIds);
      await transaction.execute(sql`
        UPDATE hr.interviews SET name = ${input.name}, starts_at = ${input.startsAt}, duration_minutes = ${input.durationMinutes}, mode = ${input.mode},
          location = ${input.mode === "onsite" ? input.location : null}, meeting_url = ${input.mode === "online" ? input.meetingUrl : null},
          calendar_sequence = calendar_sequence + 1, updated_at = now(), version = version + 1 WHERE id = ${interviewId}`);
      await this.writeInterviewers(transaction, interviewId, input.interviewerIds);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.interview.update", entityId: context.candidate_id, afterData: { interviewId } }, transaction);
      return context;
    });
    if (input.sendEmail) await this.sendEmails(actor, context, interviewId, "interview_update", input.message);
    return context.candidate_id;
  }

  async cancel(actor: Actor, interviewId: string, input: z.output<typeof cancelInterviewSchema>): Promise<string> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const context = await this.database.transaction(async (transaction) => {
      const row = await this.requireInterview(transaction, actor, interviewId, true);
      if (row.status !== "scheduled") throw new ApiError("BUSINESS_RULE", "interviewNotScheduled");
      await transaction.execute(sql`UPDATE hr.interviews SET status = 'cancelled', calendar_sequence = calendar_sequence + 1, updated_at = now(), version = version + 1 WHERE id = ${interviewId}`);
      const context = await applicationContext(transaction, actor.companyId, row.application_id);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.interview.cancel", entityId: context.candidate_id, afterData: { interviewId } }, transaction);
      return context;
    });
    if (input.sendEmail && !context.erased) await this.sendEmails(actor, context, interviewId, "interview_cancellation", input.message);
    return context.candidate_id;
  }

  // Có ít nhất một phiếu thì đánh dấu đã xong (QUYTAC_NGHIEPVU_384).
  async complete(actor: Actor, interviewId: string): Promise<string> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    return this.database.transaction(async (transaction) => {
      const row = await this.requireInterview(transaction, actor, interviewId, true);
      if (row.status !== "scheduled") throw new ApiError("BUSINESS_RULE", "interviewNotScheduled");
      const evaluated = await transaction.execute(sql`SELECT 1 FROM hr.interview_evaluations WHERE interview_id = ${interviewId} LIMIT 1`);
      if (evaluated.rows.length === 0) throw new ApiError("BUSINESS_RULE", "interviewNoEvaluation");
      await transaction.execute(sql`UPDATE hr.interviews SET status = 'completed', updated_at = now(), version = version + 1 WHERE id = ${interviewId}`);
      const context = await applicationContext(transaction, actor.companyId, row.application_id);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.interview.complete", entityId: context.candidate_id, afterData: { interviewId } }, transaction);
      return context.candidate_id;
    });
  }

  // Email cho ứng viên và người phỏng vấn, kèm tệp lịch; ghi lịch sử email của ứng viên (QUYTAC_NGHIEPVU_385).
  private async sendEmails(actor: Actor, context: ApplicationContext, interviewId: string, kind: InterviewEmailInput["kind"], message: string | null): Promise<void> {
    if (!context.candidate_email) throw new ApiError("BUSINESS_RULE", "emailMissing");
    const row = (await this.database.execute<InterviewRow>(sql`${this.select()} WHERE i.id = ${interviewId}`)).rows[0]!;
    const base: InterviewEmailInput = {
      kind,
      locale: context.locale,
      candidateName: context.candidate_name,
      companyName: context.company_name,
      postingTitle: context.posting_title,
      roundName: row.name,
      startsAt: row.starts_at,
      durationMinutes: row.duration_minutes,
      mode: row.mode,
      location: row.location,
      meetingUrl: row.meeting_url,
      contactEmail: context.contact_email,
      message,
    };
    const calendar = (summary: string, description: string) =>
      interviewCalendar({
        interviewId,
        sequence: row.calendar_sequence,
        cancelled: kind === "interview_cancellation",
        startsAt: row.starts_at,
        durationMinutes: row.duration_minutes,
        summary,
        description,
        location: row.location ?? row.meeting_url ?? "",
        organizerEmail: context.contact_email,
        now: this.clock.now(),
      });
    const email = interviewEmail(base);
    await this.outbound.send({ channel: "email", to: context.candidate_email, subject: email.subject, body: email.body, attachments: [calendar(email.subject, email.body)] });
    await this.database.execute(sql`
      INSERT INTO hr.candidate_emails (company_id, candidate_id, application_id, kind, recipient, subject, body, sent_by)
      VALUES (${context.company_id}, ${context.candidate_id}, ${context.application_id}, ${kind}, ${context.candidate_email}, ${email.subject}, ${email.body}, ${actor.userId})`);
    const interviewers = await this.database.execute<{ full_name: string; email: string | null }>(sql`
      SELECT u.full_name, u.email::text FROM hr.interview_interviewers x JOIN core.users u ON u.id = x.user_id WHERE x.interview_id = ${interviewId} AND u.email IS NOT NULL`);
    for (const person of interviewers.rows) {
      const internal = interviewerEmail({ ...base, interviewerName: person.full_name });
      await this.outbound.send({ channel: "email", to: person.email!, subject: internal.subject, body: internal.body, attachments: [calendar(internal.subject, internal.body)] });
    }
  }

  // Email báo kết quả không đạt sau khi loại (QUYTAC_NGHIEPVU_385).
  async sendRejection(actor: Actor, applicationId: string, message: string | null): Promise<void> {
    const context = await applicationContext(this.database, actor.companyId, applicationId);
    if (!context.candidate_email || context.erased) throw new ApiError("BUSINESS_RULE", "emailMissing");
    const email = rejectionEmail({
      locale: context.locale,
      candidateName: context.candidate_name,
      companyName: context.company_name,
      postingTitle: context.posting_title,
      contactEmail: context.contact_email,
      message,
    });
    await this.outbound.send({ channel: "email", to: context.candidate_email, subject: email.subject, body: email.body });
    await this.database.execute(sql`
      INSERT INTO hr.candidate_emails (company_id, candidate_id, application_id, kind, recipient, subject, body, sent_by)
      VALUES (${context.company_id}, ${context.candidate_id}, ${applicationId}, 'rejection', ${context.candidate_email}, ${email.subject}, ${email.body}, ${actor.userId})`);
  }

  // ---------- Người phỏng vấn được giao (không cần quyền tuyển dụng) ----------

  async mine(actor: Actor): Promise<MyInterviewItem[]> {
    const rows = await this.database.execute<{
      id: string;
      full_name: string;
      title: string;
      name: string;
      starts_at: string;
      status: MyInterviewItem["status"];
      submitted: boolean;
    }>(sql`
      SELECT i.id, c.full_name, p.title, i.name, i.starts_at::text, i.status,
        EXISTS (SELECT 1 FROM hr.interview_evaluations e WHERE e.interview_id = i.id AND e.interviewer_id = ${actor.userId}) AS submitted
      FROM hr.interviews i JOIN hr.interview_interviewers x ON x.interview_id = i.id AND x.user_id = ${actor.userId}
      JOIN hr.applications a ON a.id = i.application_id JOIN hr.candidates c ON c.id = a.candidate_id JOIN hr.job_postings p ON p.id = a.posting_id
      WHERE i.company_id = ${actor.companyId} AND i.status <> 'cancelled' AND c.erased_at IS NULL ORDER BY i.starts_at DESC LIMIT 200`);
    return rows.rows.map((row) => ({
      interviewId: row.id,
      candidateName: row.full_name,
      postingTitle: row.title,
      name: row.name,
      startsAt: row.starts_at,
      status: row.status,
      submitted: row.submitted,
    }));
  }

  // Người phỏng vấn chỉ thấy vòng mình được giao, chưa hủy, ứng viên chưa xóa; ngoài phạm vi trả 404.
  private async assigned(actor: Actor, interviewId: string) {
    const row = (
      await this.database.execute<{ application_id: string; candidate_id: string; ended: boolean; status: string }>(sql`
      SELECT i.application_id, a.candidate_id, a.ended_at IS NOT NULL AS ended, i.status
      FROM hr.interviews i JOIN hr.interview_interviewers x ON x.interview_id = i.id AND x.user_id = ${actor.userId}
      JOIN hr.applications a ON a.id = i.application_id JOIN hr.candidates c ON c.id = a.candidate_id
      WHERE i.id = ${interviewId} AND i.company_id = ${actor.companyId} AND i.status <> 'cancelled' AND c.erased_at IS NULL`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async mineDetail(actor: Actor, interviewId: string): Promise<MyInterviewResponse> {
    const row = await this.assigned(actor, interviewId);
    const interview = (await this.items(this.database, sql`i.id = ${interviewId}`, actor.userId))[0]!;
    const candidate = (
      await this.database.execute<{
        full_name: string;
        province: string | null;
        education_level: MyInterviewResponse["candidate"]["educationLevel"];
        experience_years: number | null;
        cover_letter: string | null;
        file_id: string | null;
        file_name: string | null;
      }>(sql`
      SELECT c.full_name, c.province, c.education_level, c.experience_years, c.cover_letter, f.id AS file_id, f.file_name
      FROM hr.candidates c LEFT JOIN LATERAL (SELECT id, file_name FROM hr.candidate_files WHERE candidate_id = c.id AND kind = 'resume' AND storage_key IS NOT NULL ORDER BY uploaded_at DESC LIMIT 1) f ON TRUE
      WHERE c.id = ${row.candidate_id}`)
    ).rows[0]!;
    return {
      interview,
      candidate: {
        fullName: candidate.full_name,
        province: candidate.province,
        educationLevel: candidate.education_level,
        experienceYears: candidate.experience_years,
        coverLetter: candidate.cover_letter,
        resumeFileId: candidate.file_id,
        resumeFileName: candidate.file_name,
      },
      myEvaluation: interview.evaluations.find((item) => item.interviewerId === actor.userId) ?? null,
      canEvaluate: !row.ended,
    };
  }

  // Ghi hoặc sửa phiếu của mình; sửa được đến khi hồ sơ kết thúc (QUYTAC_NGHIEPVU_384).
  async evaluate(actor: Actor, interviewId: string, input: z.output<typeof interviewEvaluationSchema>): Promise<MyInterviewResponse> {
    const row = await this.assigned(actor, interviewId);
    if (row.ended) throw new ApiError("BUSINESS_RULE", "interviewClosed");
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        INSERT INTO hr.interview_evaluations (company_id, interview_id, interviewer_id, score, recommendation, comment)
        VALUES (${actor.companyId}, ${interviewId}, ${actor.userId}, ${input.score}, ${input.recommendation}, ${input.comment})
        ON CONFLICT (interview_id, interviewer_id) DO UPDATE SET score = EXCLUDED.score, recommendation = EXCLUDED.recommendation, comment = EXCLUDED.comment, updated_at = now()`);
      await this.auditService.record(
        { ...hrAudit(actor, "candidate"), action: "candidate.interview.evaluate", entityId: row.candidate_id, afterData: { interviewId, score: input.score, recommendation: input.recommendation } },
        transaction,
      );
    });
    return this.mineDetail(actor, interviewId);
  }

  // Người phỏng vấn tải sơ yếu lý lịch của ứng viên mình được giao; ghi nhật ký.
  async downloadResume(actor: Actor, interviewId: string, fileId: string) {
    const row = await this.assigned(actor, interviewId);
    const file = await this.database.execute(sql`SELECT 1 FROM hr.candidate_files WHERE id = ${fileId} AND candidate_id = ${row.candidate_id} AND kind = 'resume'`);
    if (file.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    return this.candidates.readFile(actor, fileId);
  }
}
