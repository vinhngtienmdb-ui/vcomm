// Ứng viên, tệp, đồng ý, hồ sơ ứng tuyển, trang tuyển dụng công khai (CONG_VIEC_54; CHUC_NANG_190, 191; QUYTAC_NGHIEPVU_382, 383, 388; API_202, API_204).
import { Inject, Injectable } from "@nestjs/common";
import { CLOCK, type Clock } from "../common/clock";
import type {
  CandidateEmailItem,
  CandidateConsentItem,
  CandidateFileItem,
  CandidateListItem,
  CandidateListResponse,
  CandidateResponse,
  CareersApplyResponse,
  CareersListResponse,
  CareersPostingResponse,
  RecruitmentSettings,
  candidateListQuerySchema,
  careersApplySchema,
  careersListQuerySchema,
  createCandidateSchema,
  endApplicationSchema,
  erasureRequestSchema,
  updateCandidateSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { messages } from "i18n";
import { randomInt, randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import type { UploadedFile } from "./employees.service";
import { hrAudit } from "./hr-context";
import { duplicateCondition, likePattern, recomputeEraseDue, recruitmentPermission, RecruitmentService, requireRecruitmentPermission, trimDecimal } from "./recruitment.service";

type Executor = Pick<Database, "execute">;
type CandidateRow = {
  id: string;
  company_id: string;
  reference: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  province: string | null;
  education_level: CandidateResponse["educationLevel"];
  experience_years: number | null;
  expected_salary: string | null;
  cover_letter: string | null;
  source: CandidateResponse["source"];
  source_note: string | null;
  locale: "vi" | "en";
  possible_duplicate: boolean;
  pool_until: string | null;
  erase_due: string | null;
  erased_at: string | null;
  created_at: string;
  version: number;
};
export type StoredFile = { fileName: string; contentType: string; size: number; storageKey: string };
export type ClientContext = { ip: string | null; userAgent: string | null };

// Phiên bản điều khoản đồng ý hiện hành; đổi nội dung trong tệp dịch thì tăng phiên bản (QUYTAC_NGHIEPVU_382).
export const careersTermsVersion = "2026-11-11";
const maximumBytes = 10 * 1024 * 1024;
const signatures: Record<string, { type: string; signature: number[] }> = {
  pdf: { type: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: [0x50, 0x4b, 0x03, 0x04] },
  jpg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  jpeg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  png: { type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
};
// Sơ yếu lý lịch: PDF, DOCX; bằng chứng: PDF, JPG, PNG.
const resumeExtensions = ["pdf", "docx"];
const evidenceExtensions = ["pdf", "jpg", "jpeg", "png"];
const referenceAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const emailKey = (email: string) => email.trim().toLowerCase();
export const phoneKey = (phone: string) => phone.replace(/\D/g, "").replace(/^84/, "0");
const newReference = () => `UV-${Array.from({ length: 8 }, (_, index) => (index === 4 ? "-" : "") + referenceAlphabet[randomInt(referenceAlphabet.length)]).join("")}`;
const fill = (template: string, values: Record<string, string | number>) => template.replace(/\{(\w+)\}/g, (whole, key: string) => String(values[key] ?? whole));

@Injectable()
export class CandidatesService {
  constructor(
    @Inject(DATABASE) readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly recruitment: RecruitmentService,
    private readonly approvals: ApprovalRequestsService,
  ) {}

  // ---------- Tệp ----------

  // Kiểm phần mở rộng và chữ ký đầu tệp, tối đa 10 MB; khóa lưu trữ do hệ thống sinh.
  async storeFile(companyId: string, file: UploadedFile | undefined, extensions: string[], field: string): Promise<StoredFile> {
    if (!file || file.size === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "required" } });
    if (file.size > maximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "attachmentTooLarge" } });
    const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    const type = extensions.includes(extension) ? signatures[extension] : undefined;
    if (!type || !type.signature.every((byte, index) => file.buffer[index] === byte)) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: extensions.includes("docx") ? "resumeTypeInvalid" : "evidenceTypeInvalid" } });
    }
    const fileName = Buffer.from(file.originalname, "latin1")
      .toString("utf8")
      .replace(/[\\/\r\n"]/g, "_")
      .slice(-200);
    const storageKey = `hr/${companyId}/candidates/${randomUUID()}`.toLowerCase();
    await this.storage.put(storageKey, file.buffer, type.type);
    return { fileName, contentType: type.type, size: file.size, storageKey };
  }

  async removeStored(files: (StoredFile | null)[]): Promise<void> {
    for (const file of files) if (file) await this.storage.remove(file.storageKey).catch(() => undefined);
  }

  // Lưu tệp trước, ghi cơ sở dữ liệu sau; lỗi thì xóa tệp vừa lưu (mục 10 đặc tả).
  private async withFiles<T>(files: (StoredFile | null)[], work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      await this.removeStored(files);
      throw error;
    }
  }

  private async insertFile(executor: Executor, companyId: string, candidateId: string, kind: CandidateFileItem["kind"], file: StoredFile, uploadedBy: string | null): Promise<string> {
    const inserted = await executor.execute<{ id: string }>(sql`
      INSERT INTO hr.candidate_files (company_id, candidate_id, kind, file_name, content_type, size_bytes, storage_key, uploaded_by)
      VALUES (${companyId}, ${candidateId}, ${kind}, ${file.fileName}, ${file.contentType}, ${file.size}, ${file.storageKey}, ${uploadedBy}) RETURNING id`);
    return inserted.rows[0]!.id;
  }

  // ---------- Đọc ----------

  private select(): SQL {
    return sql`
      SELECT c.id, c.company_id, c.reference, c.full_name, c.email, c.phone, c.province, c.education_level, c.experience_years, c.expected_salary::text, c.cover_letter,
        c.source, c.source_note, c.locale, ${duplicateCondition(sql`c`)} AS possible_duplicate,
        (SELECT (max(k.consented_on) + make_interval(months => COALESCE(s.pool_retention_months, 12)))::date::text FROM hr.candidate_consents k
          WHERE k.candidate_id = c.id AND k.purpose = 'talent_pool' AND k.withdrawn_at IS NULL) AS pool_until,
        c.erase_due::text, c.erased_at::text, c.created_at::text, c.version
      FROM hr.candidates c LEFT JOIN hr.recruitment_settings s ON s.company_id = c.company_id`;
  }

  async requireCandidate(executor: Executor, actor: Actor, id: string, lock = false): Promise<CandidateRow> {
    const row = (await executor.execute<CandidateRow>(sql`${this.select()} WHERE c.company_id = ${actor.companyId} AND c.id = ${id}${lock ? sql` FOR UPDATE OF c` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async list(actor: Actor, query: z.output<typeof candidateListQuerySchema>): Promise<CandidateListResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const today = this.permissionService.today();
    const conditions = [sql`c.company_id = ${actor.companyId}`, sql`c.erased_at IS NULL`];
    if (query.tab === "due") conditions.push(sql`c.erase_due IS NOT NULL AND c.erase_due <= (${today}::date + 7)`);
    if (query.search) {
      const pattern = likePattern(query.search);
      conditions.push(sql`(c.full_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone ILIKE ${pattern} OR c.reference ILIKE ${pattern})`);
    }
    const base = sql`SELECT * FROM (${this.select()} WHERE ${sql.join(conditions, sql` AND `)}) listed${query.tab === "pool" ? sql` WHERE listed.pool_until >= ${today}` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM (${base}) counted`)).rows[0]!.total;
    const rows = await this.database.execute<CandidateRow & { latest_title: string | null; latest_stage: CandidateListItem["latestStage"]; latest_outcome: CandidateListItem["latestOutcome"] }>(sql`
      SELECT listed.*, latest.title AS latest_title, latest.stage AS latest_stage, latest.outcome AS latest_outcome FROM (${base}) listed
      LEFT JOIN LATERAL (SELECT p.title, a.stage, a.outcome FROM hr.applications a JOIN hr.job_postings p ON p.id = a.posting_id WHERE a.candidate_id = listed.id ORDER BY a.created_at DESC LIMIT 1) latest ON TRUE
      ORDER BY ${query.tab === "due" ? sql`listed.erase_due, ` : sql``}listed.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const data = rows.rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      latestPostingTitle: row.latest_title,
      latestStage: row.latest_stage,
      latestOutcome: row.latest_outcome,
      possibleDuplicate: row.possible_duplicate,
      poolUntil: row.pool_until,
      eraseDue: row.erase_due,
      erased: row.erased_at !== null,
    }));
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    return this.response(actor, await this.requireCandidate(this.database, actor, id));
  }

  async response(actor: Actor, row: CandidateRow): Promise<CandidateResponse> {
    const files = await this.database.execute<{ id: string; kind: CandidateFileItem["kind"]; file_name: string; size_bytes: number; uploaded_at: string; storage_key: string | null }>(sql`
      SELECT id, kind, file_name, size_bytes, uploaded_at::text, storage_key FROM hr.candidate_files WHERE candidate_id = ${row.id} ORDER BY uploaded_at`);
    const consents = await this.database.execute<{
      id: string;
      purpose: CandidateConsentItem["purpose"];
      channel: CandidateConsentItem["channel"];
      posting_title: string | null;
      terms_version: string | null;
      terms_text: string | null;
      consented_on: string;
      consented_at: string;
      ip: string | null;
      evidence_file_id: string | null;
      withdrawn_at: string | null;
    }>(sql`
      SELECT k.id, k.purpose, k.channel, p.title AS posting_title, k.terms_version, k.terms_text, k.consented_on::text, k.consented_at::text, k.ip, k.evidence_file_id, k.withdrawn_at::text
      FROM hr.candidate_consents k LEFT JOIN hr.job_postings p ON p.id = k.posting_id WHERE k.candidate_id = ${row.id} ORDER BY k.consented_at`);
    const duplicates = row.possible_duplicate
      ? (
          await this.database.execute<{ id: string; full_name: string; reference: string }>(sql`
          SELECT other.id, other.full_name, other.reference FROM hr.candidates c JOIN hr.candidates other ON other.company_id = c.company_id AND other.id <> c.id AND other.erased_at IS NULL
            AND (other.email_key = c.email_key OR other.phone_key = c.phone_key) WHERE c.id = ${row.id} ORDER BY other.created_at LIMIT 20`)
        ).rows.map((other) => ({ id: other.id, fullName: other.full_name, reference: other.reference }))
      : [];
    return {
      id: row.id,
      reference: row.reference,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      province: row.province,
      educationLevel: row.education_level,
      experienceYears: row.experience_years,
      expectedSalary: trimDecimal(row.expected_salary),
      coverLetter: row.cover_letter,
      source: row.source,
      sourceNote: row.source_note,
      locale: row.locale,
      possibleDuplicate: row.possible_duplicate,
      duplicates,
      poolUntil: row.pool_until,
      eraseDue: row.erase_due,
      erasedAt: row.erased_at,
      createdAt: row.created_at,
      version: row.version,
      files: files.rows.map((file) => ({ id: file.id, kind: file.kind, fileName: file.file_name, sizeBytes: file.size_bytes, uploadedAt: file.uploaded_at, available: file.storage_key !== null })),
      consents: consents.rows.map((consent) => ({
        id: consent.id,
        purpose: consent.purpose,
        channel: consent.channel,
        postingTitle: consent.posting_title,
        termsVersion: consent.terms_version,
        termsText: consent.terms_text,
        consentedOn: consent.consented_on,
        consentedAt: consent.consented_at,
        ip: consent.ip,
        evidenceFileId: consent.evidence_file_id,
        withdrawnAt: consent.withdrawn_at,
      })),
      applications: await this.recruitment.applicationItems(this.database, sql`a.candidate_id = ${row.id}`),
    };
  }

  // Tải tệp ứng viên: người có quyền tuyển dụng; mỗi lần tải ghi nhật ký. Người phỏng vấn được giao dùng hàm riêng ở lát L1.
  async downloadFile(actor: Actor, fileId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    return this.readFile(actor, fileId);
  }

  async readFile(actor: Actor, fileId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const row = (
      await this.database.execute<{ candidate_id: string; kind: string; file_name: string; content_type: string; storage_key: string | null }>(sql`
      SELECT candidate_id, kind, file_name, content_type, storage_key FROM hr.candidate_files WHERE id = ${fileId} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row || !row.storage_key) throw new ApiError("NOT_FOUND", "notFound");
    await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.file.download", entityId: row.candidate_id, afterData: { fileId, kind: row.kind } });
    return { fileName: row.file_name, contentType: row.content_type, content: await this.storage.get(row.storage_key) };
  }

  // ---------- Ghi ----------

  private async requireOpenPosting(executor: Executor, companyId: string, postingId: string, field = "postingId"): Promise<{ id: string; contact_email: string }> {
    const posting = (
      await executor.execute<{ id: string; status: string; contact_email: string }>(sql`
      SELECT id, status, contact_email FROM hr.job_postings WHERE id = ${postingId} AND company_id = ${companyId} FOR SHARE`)
    ).rows[0];
    if (!posting) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "invalidValue" } });
    if (posting.status !== "open") throw new ApiError("BUSINESS_RULE", "postingNotOpen");
    return posting;
  }

  private async insertCandidate(
    executor: Executor,
    companyId: string,
    input: z.output<typeof careersApplySchema> | z.output<typeof createCandidateSchema>,
    source: CandidateRow["source"],
    sourceNote: string | null,
    locale: "vi" | "en",
    createdBy: string | null,
  ): Promise<{ id: string; reference: string }> {
    const reference = newReference();
    const created = await executor.execute<{ id: string }>(sql`
      INSERT INTO hr.candidates (company_id, reference, full_name, email, phone, email_key, phone_key, province, education_level, experience_years, expected_salary, cover_letter,
        source, source_note, locale, created_by)
      VALUES (${companyId}, ${reference}, ${input.fullName}, ${input.email}, ${input.phone}, ${emailKey(input.email)}, ${phoneKey(input.phone)}, ${input.province},
        ${input.educationLevel ?? null}, ${input.experienceYears ?? null}, ${input.expectedSalary}, ${input.coverLetter}, ${source}, ${sourceNote}, ${locale}, ${createdBy})
      RETURNING id`);
    return { id: created.rows[0]!.id, reference };
  }

  // Nhân sự nhập tay: bắt buộc bằng chứng đồng ý tuyển dụng; đồng ý kho ứng viên không bắt buộc (QUYTAC_NGHIEPVU_383).
  async create(actor: Actor, input: z.output<typeof createCandidateSchema>, files: { resume?: UploadedFile; consentEvidence?: UploadedFile; poolEvidence?: UploadedFile }): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const today = this.permissionService.today();
    const fields: Record<string, ErrorMessageKey> = {};
    if (input.consentDate > today) fields.consentDate = "invalidValue";
    if (input.poolConsentDate && input.poolConsentDate > today) fields.poolConsentDate = "invalidValue";
    if (input.poolConsentDate && !files.poolEvidence) fields.poolEvidence = "required";
    if (!files.consentEvidence) fields.consentEvidence = "required";
    if (Object.keys(fields).length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await this.requireOpenPosting(this.database, actor.companyId, input.postingId);
    const stored: (StoredFile | null)[] = [];
    const id = await this.withFiles(stored, async () => {
      const resume = files.resume ? await this.storeFile(actor.companyId, files.resume, resumeExtensions, "resume") : null;
      stored.push(resume);
      const evidence = await this.storeFile(actor.companyId, files.consentEvidence, evidenceExtensions, "consentEvidence");
      stored.push(evidence);
      const poolEvidence = input.poolConsentDate ? await this.storeFile(actor.companyId, files.poolEvidence, evidenceExtensions, "poolEvidence") : null;
      stored.push(poolEvidence);
      return this.database.transaction(async (transaction) => {
        await this.requireOpenPosting(transaction, actor.companyId, input.postingId);
        const candidate = await this.insertCandidate(transaction, actor.companyId, input, input.source, input.sourceNote, "vi", actor.userId);
        if (resume) await this.insertFile(transaction, actor.companyId, candidate.id, "resume", resume, actor.userId);
        const evidenceId = await this.insertFile(transaction, actor.companyId, candidate.id, "consent_evidence", evidence, actor.userId);
        await transaction.execute(sql`
          INSERT INTO hr.candidate_consents (company_id, candidate_id, purpose, posting_id, channel, consented_on, evidence_file_id, recorded_by)
          VALUES (${actor.companyId}, ${candidate.id}, 'recruitment', ${input.postingId}, 'manual', ${input.consentDate}, ${evidenceId}, ${actor.userId})`);
        if (poolEvidence) {
          const poolEvidenceId = await this.insertFile(transaction, actor.companyId, candidate.id, "consent_evidence", poolEvidence, actor.userId);
          await transaction.execute(sql`
            INSERT INTO hr.candidate_consents (company_id, candidate_id, purpose, channel, consented_on, evidence_file_id, recorded_by)
            VALUES (${actor.companyId}, ${candidate.id}, 'talent_pool', 'manual', ${input.poolConsentDate}, ${poolEvidenceId}, ${actor.userId})`);
        }
        await transaction.execute(sql`
          INSERT INTO hr.applications (company_id, candidate_id, posting_id, created_by) VALUES (${actor.companyId}, ${candidate.id}, ${input.postingId}, ${actor.userId})`);
        await this.auditService.record(
          { ...hrAudit(actor, "candidate"), action: "candidate.create", entityId: candidate.id, afterData: { postingId: input.postingId, source: input.source } },
          transaction,
        );
        return candidate.id;
      });
    });
    return this.detail(actor, id);
  }

  // Sửa thông tin ứng viên; nhật ký chỉ ghi tên trường đổi (không ghi giá trị cá nhân).
  async update(actor: Actor, id: string, input: z.output<typeof updateCandidateSchema>): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireCandidate(transaction, actor, id, true);
      if (row.erased_at) throw new ApiError("BUSINESS_RULE", "candidateErased");
      if (input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const before: Record<string, unknown> = {
        fullName: row.full_name,
        email: row.email,
        phone: row.phone,
        province: row.province,
        educationLevel: row.education_level,
        experienceYears: row.experience_years,
        expectedSalary: trimDecimal(row.expected_salary),
        coverLetter: row.cover_letter,
        sourceNote: row.source_note,
      };
      const changed = Object.keys(before).filter((field) => (before[field] ?? null) !== ((input as Record<string, unknown>)[field] ?? null));
      await transaction.execute(sql`
        UPDATE hr.candidates SET full_name = ${input.fullName}, email = ${input.email}, phone = ${input.phone}, email_key = ${emailKey(input.email)}, phone_key = ${phoneKey(input.phone)},
          province = ${input.province}, education_level = ${input.educationLevel ?? null}, experience_years = ${input.experienceYears ?? null}, expected_salary = ${input.expectedSalary},
          cover_letter = ${input.coverLetter}, source_note = ${input.sourceNote}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.update", entityId: id, afterData: { changed } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Thêm ứng viên trong kho (đồng ý kho còn hạn) vào tin khác đang đăng (QUYTAC_NGHIEPVU_383).
  async addApplication(actor: Actor, candidateId: string, postingId: string): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireCandidate(transaction, actor, candidateId, true);
      if (row.erased_at) throw new ApiError("BUSINESS_RULE", "candidateErased");
      if (!row.pool_until || row.pool_until < this.permissionService.today()) throw new ApiError("BUSINESS_RULE", "candidatePoolExpired");
      await this.requireOpenPosting(transaction, actor.companyId, postingId);
      const open = await transaction.execute(sql`SELECT 1 FROM hr.applications WHERE candidate_id = ${candidateId} AND posting_id = ${postingId} AND ended_at IS NULL`);
      if (open.rows.length) throw new ApiError("BUSINESS_RULE", "applicationExists");
      await transaction.execute(sql`INSERT INTO hr.applications (company_id, candidate_id, posting_id, created_by) VALUES (${actor.companyId}, ${candidateId}, ${postingId}, ${actor.userId})`);
      await recomputeEraseDue(transaction, candidateId);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.application.add", entityId: candidateId, afterData: { postingId } }, transaction);
    });
    return this.detail(actor, candidateId);
  }

  async requireApplication(executor: Executor, actor: Actor, applicationId: string): Promise<{ id: string; candidate_id: string; posting_id: string; stage: string; ended_at: string | null }> {
    const row = (
      await executor.execute<{ id: string; candidate_id: string; posting_id: string; stage: string; ended_at: string | null }>(sql`
      SELECT id, candidate_id, posting_id, stage, ended_at::text FROM hr.applications WHERE id = ${applicationId} AND company_id = ${actor.companyId} FOR UPDATE`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Chuyển tự do giữa mới, sàng lọc, phỏng vấn; "đề nghị", "nhận việc" chỉ theo đề nghị nhận việc (QUYTAC_NGHIEPVU_383).
  async moveStage(actor: Actor, applicationId: string, stage: "new" | "screening" | "interview"): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const candidateId = await this.database.transaction(async (transaction) => {
      const row = await this.requireApplication(transaction, actor, applicationId);
      if (row.ended_at) throw new ApiError("BUSINESS_RULE", "applicationEnded");
      if (!["new", "screening", "interview"].includes(row.stage)) throw new ApiError("BUSINESS_RULE", "applicationStageInvalid");
      await transaction.execute(sql`UPDATE hr.applications SET stage = ${stage}, updated_at = now(), version = version + 1 WHERE id = ${applicationId}`);
      await this.auditService.record(
        { ...hrAudit(actor, "candidate"), action: "candidate.application.stage", entityId: row.candidate_id, afterData: { applicationId, from: row.stage, to: stage } },
        transaction,
      );
      return row.candidate_id;
    });
    return this.detail(actor, candidateId);
  }

  // Kết thúc hồ sơ: bị loại (lý do bắt buộc) hoặc ứng viên rút; không mở lại; tính lại ngày xóa (QUYTAC_NGHIEPVU_383, 388).
  async endApplication(
    actor: Actor,
    applicationId: string,
    input: z.output<typeof endApplicationSchema>,
    afterEnd?: (transaction: Executor, candidateId: string) => Promise<void>,
  ): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    if (input.outcome === "rejected" && !input.reason) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { reason: "required" } });
    const candidateId = await this.database.transaction(async (transaction) => {
      const row = await this.requireApplication(transaction, actor, applicationId);
      if (row.ended_at) throw new ApiError("BUSINESS_RULE", "applicationEnded");
      if (row.stage === "hired") throw new ApiError("BUSINESS_RULE", "applicationStageInvalid");
      await transaction.execute(sql`
        UPDATE hr.applications SET outcome = ${input.outcome}, outcome_reason = ${input.reason ?? null}, outcome_note = ${input.note}, ended_at = ${this.clock.now().toISOString()}, updated_at = now(), version = version + 1
        WHERE id = ${applicationId}`);
      if (afterEnd) await afterEnd(transaction, row.candidate_id);
      await recomputeEraseDue(transaction, row.candidate_id);
      await this.auditService.record(
        { ...hrAudit(actor, "candidate"), action: "candidate.application.end", entityId: row.candidate_id, afterData: { applicationId, outcome: input.outcome, reason: input.reason ?? null } },
        transaction,
      );
      return row.candidate_id;
    });
    return this.detail(actor, candidateId);
  }

  async settings(actor: Actor): Promise<RecruitmentSettings> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    const row = (
      await this.database.execute<{ days: number; months: number }>(sql`
      SELECT rejected_retention_days AS days, pool_retention_months AS months FROM hr.recruitment_settings WHERE company_id = ${actor.companyId}`)
    ).rows[0];
    return { rejectedRetentionDays: row?.days ?? 30, poolRetentionMonths: row?.months ?? 12 };
  }

  // Đổi thời hạn lưu giữ thì tính lại ngày xóa của mọi ứng viên chưa xóa của công ty (QUYTAC_NGHIEPVU_388).
  async saveSettings(actor: Actor, input: RecruitmentSettings): Promise<RecruitmentSettings> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        INSERT INTO hr.recruitment_settings (company_id, rejected_retention_days, pool_retention_months, updated_by) VALUES (${actor.companyId}, ${input.rejectedRetentionDays}, ${input.poolRetentionMonths}, ${actor.userId})
        ON CONFLICT (company_id) DO UPDATE SET rejected_retention_days = EXCLUDED.rejected_retention_days, pool_retention_months = EXCLUDED.pool_retention_months, updated_by = EXCLUDED.updated_by, updated_at = now()`);
      const candidates = await transaction.execute<{ id: string }>(sql`SELECT id FROM hr.candidates WHERE company_id = ${actor.companyId} AND erased_at IS NULL`);
      for (const candidate of candidates.rows) await recomputeEraseDue(transaction, candidate.id);
      await this.auditService.record({ ...hrAudit(actor, "recruitment_settings"), action: "recruitment_settings.update", entityId: actor.companyId, afterData: input }, transaction);
    });
    return this.settings(actor);
  }

  // ---------- Trang tuyển dụng công khai (API_204) ----------

  // Tin công khai: đang đăng, đăng công khai, chưa quá hạn nộp, công ty đang hoạt động (QUYTAC_NGHIEPVU_382).
  private publicCondition(): SQL {
    return sql`p.status = 'open' AND p.is_public AND p.deadline >= ${this.permissionService.today()} AND co.status = 'active'`;
  }

  private publicSelect(): SQL {
    return sql`
      SELECT p.id, p.title, p.company_id, co.legal_name AS company_name, p.location, p.work_type, p.salary_display, p.description, p.requirements, p.benefits, p.contact_email,
        CASE p.salary_display WHEN 'request_range' THEN r.salary_min WHEN 'custom_range' THEN p.salary_min END::text AS salary_min,
        CASE p.salary_display WHEN 'request_range' THEN r.salary_max WHEN 'custom_range' THEN p.salary_max END::text AS salary_max,
        p.deadline::text, p.published_at::text
      FROM hr.job_postings p JOIN hr.recruitment_requests r ON r.id = p.request_id JOIN core.companies co ON co.id = p.company_id`;
  }

  async careersList(query: z.output<typeof careersListQuerySchema>): Promise<CareersListResponse> {
    const conditions = [this.publicCondition()];
    if (query.companyId) conditions.push(sql`p.company_id = ${query.companyId}`);
    if (query.location) conditions.push(sql`p.location = ${query.location}`);
    if (query.workType) conditions.push(sql`p.work_type = ${query.workType}`);
    if (query.search) conditions.push(sql`p.title ILIKE ${likePattern(query.search)}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM hr.job_postings p JOIN core.companies co ON co.id = p.company_id WHERE ${where}`)).rows[0]!
      .total;
    const rows = await this.database.execute<PublicRow>(sql`${this.publicSelect()} WHERE ${where} ORDER BY p.published_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const companies = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT DISTINCT co.id, co.legal_name AS name FROM hr.job_postings p JOIN core.companies co ON co.id = p.company_id WHERE ${this.publicCondition()} ORDER BY 2`);
    const locations = await this.database.execute<{ location: string }>(sql`
      SELECT DISTINCT p.location FROM hr.job_postings p JOIN core.companies co ON co.id = p.company_id WHERE ${this.publicCondition()} ORDER BY p.location`);
    return {
      data: rows.rows.map((row) => publicItem(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      companies: companies.rows,
      locations: locations.rows.map((row) => row.location),
    };
  }

  private async publicPosting(executor: Executor, id: string, lock = false): Promise<PublicRow> {
    const row = (await executor.execute<PublicRow>(sql`${this.publicSelect()} WHERE p.id = ${id} AND ${this.publicCondition()}${lock ? sql` FOR SHARE OF p` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Nội dung điều khoản đồng ý theo ngôn ngữ, điền tên công ty, email liên hệ, thời hạn lưu của công ty.
  private async terms(executor: Executor, row: PublicRow, locale: "vi" | "en"): Promise<CareersPostingResponse["terms"]> {
    const settings = (
      await executor.execute<{ days: number; months: number }>(sql`
      SELECT rejected_retention_days AS days, pool_retention_months AS months FROM hr.recruitment_settings WHERE company_id = ${row.company_id}`)
    ).rows[0];
    const values = { company: row.company_name, email: row.contact_email, title: row.title, days: settings?.days ?? 30, months: settings?.months ?? 12 };
    const text = messages[locale].careers;
    return { version: careersTermsVersion, recruitment: fill(text.termsRecruitment, values), talentPool: fill(text.termsTalentPool, values) };
  }

  async careersDetail(id: string, locale: "vi" | "en"): Promise<CareersPostingResponse> {
    const row = await this.publicPosting(this.database, id);
    return {
      ...publicItem(row),
      description: row.description,
      requirements: row.requirements,
      benefits: row.benefits,
      contactEmail: row.contact_email,
      terms: await this.terms(this.database, row, locale),
    };
  }

  // Nộp hồ sơ không đăng nhập: luôn tạo ứng viên mới; lưu nguyên văn điều khoản, thời điểm, IP, trình duyệt làm bằng chứng đồng ý (QUYTAC_NGHIEPVU_382, 383).
  async apply(postingId: string, input: z.output<typeof careersApplySchema>, resume: UploadedFile | undefined, client: ClientContext): Promise<CareersApplyResponse> {
    const posting = await this.publicPosting(this.database, postingId);
    const missing: Record<string, ErrorMessageKey> = {};
    if (!input.recruitmentConsent) missing.recruitmentConsent = "consentRequired";
    if (!resume || resume.size === 0) missing.resume = "required";
    if (Object.keys(missing).length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: missing });
    if (input.termsVersion !== careersTermsVersion) throw new ApiError("BUSINESS_RULE", "termsOutdated");
    const stored = await this.storeFile(posting.company_id, resume, resumeExtensions, "resume");
    return this.withFiles([stored], () =>
      this.database.transaction(async (transaction) => {
        const row = await this.publicPosting(transaction, postingId, true);
        const terms = await this.terms(transaction, row, input.locale);
        const today = this.permissionService.today();
        const candidate = await this.insertCandidate(transaction, row.company_id, input, "careers_page", null, input.locale, null);
        await this.insertFile(transaction, row.company_id, candidate.id, "resume", stored, null);
        const consent = (purpose: "recruitment" | "talent_pool", text: string, posting: string | null) => sql`
          INSERT INTO hr.candidate_consents (company_id, candidate_id, purpose, posting_id, channel, terms_version, terms_text, locale, consented_on, ip, user_agent)
          VALUES (${row.company_id}, ${candidate.id}, ${purpose}, ${posting}, 'careers_page', ${terms.version}, ${text}, ${input.locale}, ${today}, ${client.ip}, ${client.userAgent?.slice(0, 500) ?? null})`;
        await transaction.execute(consent("recruitment", terms.recruitment, postingId));
        if (input.talentPoolConsent) await transaction.execute(consent("talent_pool", terms.talentPool, null));
        await transaction.execute(sql`INSERT INTO hr.applications (company_id, candidate_id, posting_id) VALUES (${row.company_id}, ${candidate.id}, ${postingId})`);
        await this.auditService.record(
          {
            actorUserId: null,
            companyId: row.company_id,
            appCode: "hr",
            entityType: "candidate",
            action: "candidate.apply",
            entityId: candidate.id,
            ip: client.ip ?? undefined,
            afterData: { postingId },
          },
          transaction,
        );
        return { reference: candidate.reference, contactEmail: row.contact_email };
      }),
    );
  }

  // ---------- Đồng ý kho ứng viên, xóa dữ liệu (QUYTAC_NGHIEPVU_388) ----------

  async recordPoolConsent(actor: Actor, id: string, consentDate: string, file: UploadedFile | undefined): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    if (consentDate > this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { consentDate: "invalidValue" } });
    const current = await this.requireCandidate(this.database, actor, id);
    if (current.erased_at) throw new ApiError("BUSINESS_RULE", "candidateErased");
    const stored = await this.storeFile(actor.companyId, file, evidenceExtensions, "file");
    await this.withFiles([stored], () =>
      this.database.transaction(async (transaction) => {
        await this.requireCandidate(transaction, actor, id, true);
        const evidenceId = await this.insertFile(transaction, actor.companyId, id, "consent_evidence", stored, actor.userId);
        await transaction.execute(sql`
          INSERT INTO hr.candidate_consents (company_id, candidate_id, purpose, channel, consented_on, evidence_file_id, recorded_by)
          VALUES (${actor.companyId}, ${id}, 'talent_pool', 'manual', ${consentDate}, ${evidenceId}, ${actor.userId})`);
        await recomputeEraseDue(transaction, id);
        await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.pool_consent.record", entityId: id, afterData: { consentDate } }, transaction);
      }),
    );
    return this.detail(actor, id);
  }

  // Rút đồng ý kho: tính lại ngày xóa (Luật 91/2025/QH15 Điều 10).
  async withdrawPoolConsent(actor: Actor, id: string): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    await this.database.transaction(async (transaction) => {
      const row = await this.requireCandidate(transaction, actor, id, true);
      if (row.erased_at) throw new ApiError("BUSINESS_RULE", "candidateErased");
      await transaction.execute(sql`UPDATE hr.candidate_consents SET withdrawn_at = now() WHERE candidate_id = ${id} AND purpose = 'talent_pool' AND withdrawn_at IS NULL`);
      await recomputeEraseDue(transaction, id);
      await this.auditService.record({ ...hrAudit(actor, "candidate"), action: "candidate.pool_consent.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Yêu cầu xóa của ứng viên: kết thúc hồ sơ đang xử lý ("ứng viên rút"), hủy đề nghị, hủy vòng phỏng vấn, rồi xóa ngay (Nghị định 356/2025/NĐ-CP Điều 5 khoản 4).
  async requestErasure(actor: Actor, id: string, input: z.output<typeof erasureRequestSchema>): Promise<CandidateResponse> {
    await requireRecruitmentPermission(this.permissionService, actor, recruitmentPermission.manage);
    if (input.receivedOn > this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { receivedOn: "invalidValue" } });
    await this.database.transaction(async (transaction) => {
      const row = await this.requireCandidate(transaction, actor, id, true);
      if (row.erased_at) throw new ApiError("BUSINESS_RULE", "candidateErased");
      const hired = await transaction.execute(sql`SELECT 1 FROM hr.applications WHERE candidate_id = ${id} AND employee_id IS NOT NULL`);
      if (hired.rows.length) throw new ApiError("BUSINESS_RULE", "candidateHired");
      const offers = await transaction.execute<{ id: string; status: string; approval_request_id: string | null }>(sql`
        SELECT o.id, o.status, o.approval_request_id FROM hr.job_offers o JOIN hr.applications a ON a.id = o.application_id
        WHERE a.candidate_id = ${id} AND o.status <> ALL (ARRAY['declined', 'expired', 'cancelled']) FOR UPDATE OF o`);
      for (const offer of offers.rows) {
        if (offer.status === "pending" && offer.approval_request_id) await this.approvals.cancelWithin(transaction, offer.approval_request_id);
        await transaction.execute(sql`UPDATE hr.job_offers SET status = 'cancelled', cancel_reason = 'erasure_request', response_token_expires_at = NULL, updated_at = now() WHERE id = ${offer.id}`);
      }
      await transaction.execute(sql`
        UPDATE hr.interviews SET status = 'cancelled', updated_at = now() WHERE status = 'scheduled' AND application_id IN (SELECT id FROM hr.applications WHERE candidate_id = ${id})`);
      await transaction.execute(sql`
        UPDATE hr.applications SET outcome = 'withdrawn', outcome_reason = NULL, ended_at = ${this.clock.now().toISOString()}, updated_at = now(), version = version + 1 WHERE candidate_id = ${id} AND ended_at IS NULL`);
      // Ghi lý do, ngày xóa hôm nay trước khi xóa tệp: kho lưu trữ lỗi thì việc nền 1 giờ chạy lại với lý do "theo yêu cầu".
      await transaction.execute(sql`UPDATE hr.candidates SET erasure_reason = 'request', erase_due = ${this.permissionService.today()}, updated_at = now() WHERE id = ${id}`);
      await this.auditService.record(
        { ...hrAudit(actor, "candidate"), action: "candidate.erasure_request", entityId: id, afterData: { receivedOn: input.receivedOn, channel: input.channel } },
        transaction,
      );
    });
    try {
      await this.erase(id, "request", actor.userId);
    } catch {
      // Kho lưu trữ lỗi: yêu cầu đã ghi, việc nền xóa ứng viên chạy lại (QUYTAC_NGHIEPVU_388).
    }
    return this.detail(actor, id);
  }

  // Khử nhận dạng không khôi phục: xóa tệp trên kho lưu trữ trước (lỗi thì để việc nền chạy lại), rồi xóa trường cá nhân; giữ số liệu thống kê.
  async erase(candidateId: string, reason: "retention" | "request", actorUserId: string | null): Promise<void> {
    const files = await this.database.execute<{ id: string; storage_key: string }>(sql`SELECT id, storage_key FROM hr.candidate_files WHERE candidate_id = ${candidateId} AND storage_key IS NOT NULL`);
    for (const file of files.rows) await this.storage.remove(file.storage_key);
    await this.database.transaction(async (transaction) => {
      const row = (await transaction.execute<{ company_id: string; erased_at: string | null }>(sql`SELECT company_id, erased_at FROM hr.candidates WHERE id = ${candidateId} FOR UPDATE`)).rows[0];
      if (!row || row.erased_at) return;
      await transaction.execute(sql`
        UPDATE hr.candidates SET full_name = '-', email = NULL, phone = NULL, email_key = NULL, phone_key = NULL, province = NULL, cover_letter = NULL, expected_salary = NULL,
          source_note = NULL, erase_due = NULL, erased_at = now(), erasure_reason = COALESCE(erasure_reason, ${reason}), updated_at = now(), version = version + 1 WHERE id = ${candidateId}`);
      await transaction.execute(sql`UPDATE hr.candidate_files SET storage_key = NULL, file_name = '-' WHERE candidate_id = ${candidateId}`);
      await transaction.execute(sql`UPDATE hr.candidate_consents SET terms_text = NULL, ip = NULL, user_agent = NULL WHERE candidate_id = ${candidateId}`);
      await transaction.execute(sql`UPDATE hr.applications SET outcome_note = NULL WHERE candidate_id = ${candidateId}`);
      await transaction.execute(sql`
        UPDATE hr.interview_evaluations SET comment = NULL WHERE interview_id IN (
          SELECT i.id FROM hr.interviews i JOIN hr.applications a ON a.id = i.application_id WHERE a.candidate_id = ${candidateId})`);
      await transaction.execute(sql`UPDATE hr.candidate_emails SET recipient = NULL, body = NULL WHERE candidate_id = ${candidateId}`);
      await transaction.execute(sql`
        UPDATE hr.job_offers SET note = NULL, response_note = NULL, response_ip = NULL, response_user_agent = NULL, response_token_hash = NULL
        WHERE application_id IN (SELECT id FROM hr.applications WHERE candidate_id = ${candidateId})`);
      await this.auditService.record(
        { actorUserId, companyId: row.company_id, appCode: "hr", entityType: "candidate", action: "candidate.erase", entityId: candidateId, afterData: { reason } },
        transaction,
      );
    });
  }

  // Việc nền 1 giờ: xóa ứng viên đến ngày xóa; một ứng viên lỗi không chặn ứng viên khác.
  async eraseDue(): Promise<{ erased: number; failed: number }> {
    const due = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM hr.candidates WHERE erased_at IS NULL AND erase_due IS NOT NULL AND erase_due <= ${this.permissionService.today()} ORDER BY erase_due LIMIT 1000`);
    let erased = 0;
    let failed = 0;
    for (const candidate of due.rows) {
      try {
        await this.erase(candidate.id, "retention", null);
        erased += 1;
      } catch {
        failed += 1;
      }
    }
    return { erased, failed };
  }

  async emails(actor: Actor, candidateId: string): Promise<CandidateEmailItem[]> {
    const rows = await this.database.execute<{ id: string; kind: CandidateEmailItem["kind"]; subject: string; recipient: string | null; sent_at: string; full_name: string }>(sql`
      SELECT e.id, e.kind, e.subject, e.recipient, e.sent_at::text, u.full_name FROM hr.candidate_emails e JOIN core.users u ON u.id = e.sent_by
      WHERE e.candidate_id = ${candidateId} AND e.company_id = ${actor.companyId} ORDER BY e.sent_at DESC`);
    return rows.rows.map((row) => ({ id: row.id, kind: row.kind, subject: row.subject, recipient: row.recipient, sentAt: row.sent_at, sentByName: row.full_name }));
  }

  // Thành viên đang hoạt động của công ty để chọn người phỏng vấn.
  async members(actor: Actor): Promise<{ id: string; fullName: string; email: string | null }[]> {
    const rows = await this.database.execute<{ id: string; full_name: string; email: string | null }>(sql`
      SELECT u.id, u.full_name, u.email::text FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
      WHERE m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status = 'active' ORDER BY u.full_name LIMIT 1000`);
    return rows.rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email }));
  }
}

type PublicRow = {
  id: string;
  title: string;
  company_id: string;
  company_name: string;
  location: string;
  work_type: CareersPostingResponse["workType"];
  salary_display: string;
  description: string;
  requirements: string | null;
  benefits: string | null;
  contact_email: string;
  salary_min: string | null;
  salary_max: string | null;
  deadline: string;
  published_at: string;
};
const publicItem = (row: PublicRow) => ({
  id: row.id,
  title: row.title,
  companyId: row.company_id,
  companyName: row.company_name,
  location: row.location,
  workType: row.work_type,
  salaryMin: trimDecimal(row.salary_min),
  salaryMax: trimDecimal(row.salary_max),
  negotiable: row.salary_display === "negotiable",
  deadline: row.deadline,
  publishedAt: row.published_at,
});
