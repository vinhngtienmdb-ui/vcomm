// Hồ sơ nhân sự (CONG_VIEC_46; CHUC_NANG_162; QUYTAC_NGHIEPVU_292 đến 295; API_144, API_145, API_146, API_149).
import { Inject, Injectable } from "@nestjs/common";
import type {
  DependentItem,
  EmployeeDocumentItem,
  EmployeeDocumentKind,
  EmployeeListItem,
  EmployeeListResponse,
  EmployeeOptionsResponse,
  EmployeeResponse,
  RevealField,
  RevealResponse,
  employeeListQuerySchema,
  saveDependentSchema,
  saveEmployeeSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { blindIndex, decryptSecret, encryptSecret } from "../common/secret-box";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { ageAt, hrAudit, hrGranted, hrPermission, lastFour, masked, positionAt, requireHrPermission } from "./hr-context";
import { WorkEventsService } from "./work-events.service";

type Executor = Pick<Database, "execute">;
type EmployeeInput = z.output<typeof saveEmployeeSchema>;
type DependentInput = z.output<typeof saveDependentSchema>;
export type UploadedFile = { buffer: Buffer; size: number; originalname: string };

type EmployeeRow = {
  id: string;
  company_id: string;
  user_id: string | null;
  user_email: string | null;
  code: string;
  full_name: string;
  gender: "male" | "female";
  birth_date: string;
  nationality: string;
  identity_kind: "citizen_id" | "passport";
  identity_last4: string;
  residence: string;
  phone: string | null;
  personal_email: string | null;
  contact_address: string | null;
  marital_status: EmployeeResponse["maritalStatus"];
  education_level: EmployeeResponse["educationLevel"];
  major: string | null;
  tax_code_last4: string | null;
  social_insurance_last4: string | null;
  bank_name: string | null;
  bank_account_last4: string | null;
  bank_account_holder: string | null;
  work_permit_last4: string | null;
  work_permit_expiry: string | null;
  emergency_contact: string | null;
  hire_date: string;
  status: "active" | "terminated";
  termination_date: string | null;
  termination_reason: string | null;
  department_id: string | null;
  department_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  job_title: string | null;
  consent_date: string | null;
  has_sensitive_files: boolean;
  version: number;
};

// Trường mã hóa: tên trong yêu cầu → tên cột (QUYTAC_NGHIEPVU_295).
const protectedColumns: Record<RevealField, string> = {
  identityNumber: "identity",
  taxCode: "tax_code",
  socialInsuranceNumber: "social_insurance",
  bankAccountNumber: "bank_account",
  workPermitNumber: "work_permit",
};

export const documentMaximumBytes = 10 * 1024 * 1024;
const documentTypes: Record<string, { type: string; signature: number[] }> = {
  pdf: { type: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  jpg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  jpeg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  png: { type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
};
// Loại tệp là dữ liệu cá nhân nhạy cảm cần ghi nhận đồng ý (Nghị định 356/2025/NĐ-CP Điều 4).
const sensitiveDocumentKinds: EmployeeDocumentKind[] = ["identity_image", "health_certificate"];

@Injectable()
export class EmployeesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly workEvents: WorkEventsService,
  ) {}

  private select(): SQL {
    const today = this.permissionService.today();
    return sql`
      SELECT e.id, e.company_id, e.user_id, u.email AS user_email, e.code, e.full_name, e.gender, e.birth_date::text, e.nationality, e.identity_kind, e.identity_last4, e.residence,
        e.phone, e.personal_email, e.contact_address, e.marital_status, e.education_level, e.major, e.tax_code_last4, e.social_insurance_last4, e.bank_name, e.bank_account_last4,
        e.bank_account_holder, e.work_permit_last4, e.work_permit_expiry::text, e.emergency_contact, e.hire_date::text, e.status, e.termination_date::text, e.termination_reason,
        position.department_id, d.name AS department_name, position.branch_id, b.name AS branch_name, position.job_title,
        (SELECT max(c.consent_date)::text FROM hr.employee_documents c WHERE c.employee_id = e.id AND c.kind = 'data_consent') AS consent_date,
        EXISTS (SELECT 1 FROM hr.employee_documents s WHERE s.employee_id = e.id AND s.kind IN ('identity_image', 'health_certificate')) AS has_sensitive_files,
        e.version
      FROM hr.employees e
      LEFT JOIN core.users u ON u.id = e.user_id
      CROSS JOIN LATERAL (SELECT ${positionAt(sql`e.id`, sql`GREATEST(${today}::date, e.hire_date)`)}) position
      LEFT JOIN core.departments d ON d.id = position.department_id
      LEFT JOIN core.branches b ON b.id = position.branch_id`;
  }

  private isMinor(row: Pick<EmployeeRow, "birth_date" | "hire_date">): boolean {
    const reference = row.hire_date > this.permissionService.today() ? row.hire_date : this.permissionService.today();
    return ageAt(row.birth_date, reference) < 18;
  }

  private toResponse(row: EmployeeRow, granted: Set<string>): EmployeeResponse {
    return {
      id: row.id,
      code: row.code,
      fullName: row.full_name,
      gender: row.gender,
      birthDate: row.birth_date,
      nationality: row.nationality,
      identityKind: row.identity_kind,
      identityNumber: masked(row.identity_last4)!,
      residence: row.residence,
      phone: row.phone,
      personalEmail: row.personal_email,
      contactAddress: row.contact_address,
      maritalStatus: row.marital_status,
      educationLevel: row.education_level,
      major: row.major,
      taxCode: masked(row.tax_code_last4),
      socialInsuranceNumber: masked(row.social_insurance_last4),
      bankName: row.bank_name,
      bankAccountNumber: masked(row.bank_account_last4),
      bankAccountHolder: row.bank_account_holder,
      workPermitNumber: masked(row.work_permit_last4),
      workPermitExpiry: row.work_permit_expiry,
      emergencyContact: row.emergency_contact,
      hireDate: row.hire_date,
      status: row.status,
      terminationDate: row.termination_date,
      terminationReason: row.termination_reason,
      departmentId: row.department_id,
      departmentName: row.department_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      jobTitle: row.job_title,
      userId: row.user_id,
      userEmail: row.user_email,
      isMinor: this.isMinor(row),
      missingConsent: row.has_sensitive_files && row.consent_date === null,
      consentDate: row.consent_date,
      version: row.version,
      canManage: granted.has(hrPermission.manage) && row.status === "active",
      canViewIdentity: granted.has(hrPermission.identity),
    };
  }

  // Hồ sơ đã nghỉ chỉ người có quyền quản lý hồ sơ thấy; ngoài phạm vi trả 404 (QUYTAC_NGHIEPVU_301).
  async requireVisible(executor: Executor, actor: Actor, id: string, granted: Set<string>, lock = false): Promise<EmployeeRow> {
    const row = (await executor.execute<EmployeeRow>(sql`${this.select()} WHERE e.company_id = ${actor.companyId} AND e.id = ${id}${lock ? sql` FOR UPDATE OF e` : sql``}`)).rows[0];
    if (!row || (row.status === "terminated" && !granted.has(hrPermission.manage))) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async options(actor: Actor): Promise<EmployeeOptionsResponse> {
    await requireHrPermission(this.permissionService, actor, hrPermission.manage, hrPermission.contract);
    const departments = await this.database.execute<{ id: string; code: string; name: string }>(
      sql`SELECT id, code, name FROM core.departments WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`,
    );
    const branches = await this.database.execute<{ id: string; code: string; name: string }>(
      sql`SELECT id, code, name FROM core.branches WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`,
    );
    const users = await this.database.execute<{ id: string; full_name: string; email: string | null }>(sql`
      SELECT u.id, u.full_name, u.email::text FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
      WHERE m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status IN ('invited', 'active')
        AND NOT EXISTS (SELECT 1 FROM hr.employees e WHERE e.company_id = m.company_id AND e.user_id = u.id)
      ORDER BY u.full_name LIMIT 1000`);
    return { departments: departments.rows, branches: branches.rows, users: users.rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email })) };
  }

  async list(actor: Actor, query: z.output<typeof employeeListQuerySchema>): Promise<EmployeeListResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.view, hrPermission.manage);
    const status = granted.has(hrPermission.manage) ? query.status : "active";
    const conditions = [sql`e.company_id = ${actor.companyId}`];
    if (status !== "all") conditions.push(sql`e.status = ${status}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(e.code ILIKE ${pattern} OR e.full_name ILIKE ${pattern} OR e.phone ILIKE ${pattern})`);
    }
    if (query.departmentId) conditions.push(sql`position.department_id = ${query.departmentId}`);
    if (query.branchId) conditions.push(sql`position.branch_id = ${query.branchId}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM (${this.select()} WHERE ${where}) counted`)).rows[0]!.total;
    const rows = await this.database.execute<EmployeeRow>(sql`${this.select()} WHERE ${where} ORDER BY e.status, e.code LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const data: EmployeeListItem[] = rows.rows.map((row) => ({
      id: row.id,
      code: row.code,
      fullName: row.full_name,
      departmentId: row.department_id,
      departmentName: row.department_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      jobTitle: row.job_title,
      hireDate: row.hire_date,
      status: row.status,
      isMinor: this.isMinor(row),
      missingConsent: row.has_sensitive_files && row.consent_date === null,
    }));
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<EmployeeResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.view, hrPermission.manage);
    return this.toResponse(await this.requireVisible(this.database, actor, id, granted), granted);
  }

  // Kiểm dữ liệu chung khi lập, sửa (QUYTAC_NGHIEPVU_292, 294).
  private async validate(executor: Executor, actor: Actor, input: EmployeeInput, current: EmployeeRow | null): Promise<void> {
    const fields: Record<string, ErrorMessageKey> = {};
    const hireDate = current?.hire_date ?? input.hireDate;
    const citizen = input.nationality === "VN";
    if (input.identityNumber !== undefined || !current || current.nationality !== input.nationality) {
      const identity = input.identityNumber?.trim() ?? "";
      if (!identity) fields.identityNumber = "required";
      else if (citizen && !/^\d{12}$/.test(identity)) fields.identityNumber = "citizenIdInvalid";
      else if (!citizen && !/^[A-Z0-9]{5,20}$/i.test(identity)) fields.identityNumber = "passportInvalid";
      else {
        const duplicate = await executor.execute(sql`
          SELECT 1 FROM hr.employees WHERE company_id = ${actor.companyId} AND status = 'active' AND identity_hash = ${blindIndex(identity)} AND id IS DISTINCT FROM ${current?.id ?? null}::uuid`);
        if (duplicate.rows.length > 0) fields.identityNumber = "employeeIdentityExists";
      }
    }
    if (!current) {
      if (!input.hireDate) fields.hireDate = "required";
      if (!input.departmentId) fields.departmentId = "required";
      if (!input.branchId) fields.branchId = "required";
      if (!input.jobTitle) fields.jobTitle = "required";
      if (
        input.departmentId &&
        (await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0
      )
        fields.departmentId = "invalidValue";
      if (input.branchId && (await executor.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.branchId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0)
        fields.branchId = "invalidValue";
      if (input.code && (await executor.execute(sql`SELECT 1 FROM hr.employees WHERE company_id = ${actor.companyId} AND lower(code) = lower(${input.code})`)).rows.length > 0)
        fields.code = "employeeCodeExists";
    }
    if (hireDate && input.birthDate >= hireDate) fields.birthDate = "invalidValue";
    else if (hireDate && ageAt(input.birthDate, hireDate) < 15) fields.birthDate = "employeeUnderFifteen";
    if (!citizen && input.workPermitExpiry && hireDate && input.workPermitExpiry < hireDate) fields.workPermitExpiry = "invalidValue";
    if (input.userId) {
      const member = await executor.execute(sql`
        SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
        WHERE m.user_id = ${input.userId} AND m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status IN ('invited', 'active')`);
      if (member.rows.length === 0) fields.userId = "invalidValue";
      else if (
        (await executor.execute(sql`SELECT 1 FROM hr.employees WHERE company_id = ${actor.companyId} AND user_id = ${input.userId} AND id IS DISTINCT FROM ${current?.id ?? null}::uuid`)).rows.length >
        0
      )
        fields.userId = "employeeUserLinked";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  // Giá trị mã hóa: undefined giữ nguyên; rỗng hoặc null xóa.
  private protectedValue(value: string | null | undefined, column: string): SQL[] {
    if (value === undefined) return [];
    const plain = value?.trim() ?? "";
    return [sql`${sql.raw(`${column}_encrypted`)} = ${plain ? encryptSecret(plain) : null}`, sql`${sql.raw(`${column}_last4`)} = ${plain ? lastFour(plain) : null}`];
  }

  // Dữ liệu ghi nhật ký: trường mã hóa chỉ ghi dạng che.
  private auditData(input: EmployeeInput): Record<string, unknown> {
    const data: Record<string, unknown> = { ...input };
    for (const field of Object.keys(protectedColumns)) {
      const value = data[field];
      if (typeof value === "string" && value) data[field] = masked(lastFour(value.trim()));
    }
    return data;
  }

  async create(actor: Actor, input: EmployeeInput): Promise<EmployeeResponse> {
    await requireHrPermission(this.permissionService, actor, hrPermission.manage);
    const configured = await this.database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${actor.companyId} AND document_type_code = 'hr.employee' LIMIT 1`);
    if (configured.rows.length === 0) await this.sequences.update(actor, "hr.employee", { prefix: "NV", resetPeriod: "never", padding: 6 });
    const id = await this.database.transaction(async (transaction) => {
      // Khóa theo công ty để hai người lập cùng lúc không trùng số căn cước, mã.
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext('hr.employees'), hashtext(${actor.companyId}))`);
      await this.validate(transaction, actor, input, null);
      const code = input.code ?? (await this.sequences.next(actor.companyId, "hr.employee", transaction));
      const identity = input.identityNumber!.trim();
      const optional = (value: string | null | undefined) => (value?.trim() ? encryptSecret(value.trim()) : null);
      const optionalLast4 = (value: string | null | undefined) => (value?.trim() ? lastFour(value.trim()) : null);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.employees (company_id, user_id, code, full_name, gender, birth_date, nationality, identity_kind, identity_encrypted, identity_last4, identity_hash, residence,
          phone, personal_email, contact_address, marital_status, education_level, major, tax_code_encrypted, tax_code_last4, social_insurance_encrypted, social_insurance_last4,
          bank_name, bank_account_encrypted, bank_account_last4, bank_account_holder, work_permit_encrypted, work_permit_last4, work_permit_expiry, emergency_contact, hire_date, created_by)
        VALUES (${actor.companyId}, ${input.userId ?? null}, ${code}, ${input.fullName}, ${input.gender}, ${input.birthDate}::date, ${input.nationality},
          ${input.nationality === "VN" ? "citizen_id" : "passport"}, ${encryptSecret(identity)}, ${lastFour(identity)}, ${blindIndex(identity)}, ${input.residence},
          ${input.phone}, ${input.personalEmail}, ${input.contactAddress}, ${input.maritalStatus ?? null}, ${input.educationLevel ?? null}, ${input.major},
          ${optional(input.taxCode)}, ${optionalLast4(input.taxCode)}, ${optional(input.socialInsuranceNumber)}, ${optionalLast4(input.socialInsuranceNumber)},
          ${input.bankName}, ${optional(input.bankAccountNumber)}, ${optionalLast4(input.bankAccountNumber)}, ${input.bankAccountHolder},
          ${input.nationality === "VN" ? null : optional(input.workPermitNumber)}, ${input.nationality === "VN" ? null : optionalLast4(input.workPermitNumber)},
          ${input.nationality === "VN" ? null : (input.workPermitExpiry ?? null)}::date, ${input.emergencyContact}, ${input.hireDate!}::date, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await transaction.execute(sql`
        INSERT INTO hr.work_events (company_id, employee_id, kind, effective_date, department_id, branch_id, job_title, created_by)
        VALUES (${actor.companyId}, ${created}, 'hire', ${input.hireDate!}::date, ${input.departmentId!}, ${input.branchId!}, ${input.jobTitle!}, ${actor.userId})`);
      await this.workEvents.applyEmployee(transaction, created, actor.userId);
      await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.create", entityId: created, afterData: { ...this.auditData(input), code } }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: EmployeeInput): Promise<EmployeeResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.manage);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext('hr.employees'), hashtext(${actor.companyId}))`);
      const before = await this.requireVisible(transaction, actor, id, granted, true);
      if (before.status !== "active") throw new ApiError("BUSINESS_RULE", "employeeTerminated");
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.validate(transaction, actor, input, before);
      const citizen = input.nationality === "VN";
      const sets: SQL[] = [
        sql`full_name = ${input.fullName}`,
        sql`gender = ${input.gender}`,
        sql`birth_date = ${input.birthDate}::date`,
        sql`nationality = ${input.nationality}`,
        sql`identity_kind = ${citizen ? "citizen_id" : "passport"}`,
        sql`residence = ${input.residence}`,
        sql`phone = ${input.phone}`,
        sql`personal_email = ${input.personalEmail}`,
        sql`contact_address = ${input.contactAddress}`,
        sql`marital_status = ${input.maritalStatus ?? null}`,
        sql`education_level = ${input.educationLevel ?? null}`,
        sql`major = ${input.major}`,
        sql`bank_name = ${input.bankName}`,
        sql`bank_account_holder = ${input.bankAccountHolder}`,
        sql`emergency_contact = ${input.emergencyContact}`,
        sql`work_permit_expiry = ${citizen ? null : (input.workPermitExpiry ?? null)}::date`,
        ...this.protectedValue(input.taxCode, "tax_code"),
        ...this.protectedValue(input.socialInsuranceNumber, "social_insurance"),
        ...this.protectedValue(input.bankAccountNumber, "bank_account"),
        ...this.protectedValue(citizen ? null : input.workPermitNumber, "work_permit"),
      ];
      if (input.identityNumber !== undefined && input.identityNumber?.trim()) {
        const identity = input.identityNumber.trim();
        sets.push(sql`identity_encrypted = ${encryptSecret(identity)}`, sql`identity_last4 = ${lastFour(identity)}`, sql`identity_hash = ${blindIndex(identity)}`);
      }
      if (input.userId !== undefined) sets.push(sql`user_id = ${input.userId}`);
      await transaction.execute(sql`UPDATE hr.employees SET ${sql.join([...sets, sql`updated_at = now()`, sql`version = version + 1`], sql`, `)} WHERE id = ${id}`);
      // Liên kết tài khoản mới: cập nhật ngay phòng ban, chức danh theo vị trí hiện hành.
      if (input.userId && input.userId !== before.user_id) await this.workEvents.applyLinkedUser(transaction, id, actor.userId);
      const beforeData = { code: before.code, fullName: before.full_name, userId: before.user_id, identityNumber: masked(before.identity_last4) };
      await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.update", entityId: id, beforeData, afterData: this.auditData(input) }, transaction);
    });
    return this.detail(actor, id);
  }

  // Hiện giá trị đầy đủ của một trường mã hóa; ghi nhật ký tên trường, không ghi giá trị (QUYTAC_NGHIEPVU_295).
  async reveal(actor: Actor, id: string, field: RevealField): Promise<RevealResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.identity);
    return this.revealRow(actor, await this.requireVisible(this.database, actor, id, granted), field, "employee.reveal");
  }

  // Chủ thể dữ liệu xem số giấy tờ của chính mình (Luật 91/2025/QH15 Điều 4).
  async revealOwn(actor: Actor, field: RevealField): Promise<RevealResponse> {
    return this.revealRow(actor, await this.ownRow(actor), field, "employee.reveal_own");
  }

  private async revealRow(actor: Actor, row: EmployeeRow, field: RevealField, action: string): Promise<RevealResponse> {
    const column = protectedColumns[field];
    const stored = (await this.database.execute<{ value: Buffer | null }>(sql`SELECT ${sql.raw(`${column}_encrypted`)} AS value FROM hr.employees WHERE id = ${row.id}`)).rows[0]!.value;
    await this.auditService.record({ ...hrAudit(actor, "employee"), action, entityId: row.id, afterData: { field } });
    return { field, value: stored ? decryptSecret(stored) : null };
  }

  // Hồ sơ liên kết với tài khoản đang đăng nhập ở công ty đang chọn (API_149).
  async ownRow(actor: Actor): Promise<EmployeeRow> {
    const row = (await this.database.execute<EmployeeRow>(sql`${this.select()} WHERE e.company_id = ${actor.companyId} AND e.user_id = ${actor.userId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async own(actor: Actor): Promise<EmployeeResponse> {
    const row = await this.ownRow(actor);
    return { ...this.toResponse(row, new Set()), canManage: false, canViewIdentity: false };
  }

  async documents(actor: Actor, employeeId: string): Promise<EmployeeDocumentItem[]> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.view, hrPermission.manage);
    await this.requireVisible(this.database, actor, employeeId, granted);
    const rows = await this.database.execute<{
      id: string;
      kind: EmployeeDocumentKind;
      file_name: string;
      content_type: string;
      size_bytes: number;
      consent_date: string | null;
      uploaded_by_name: string;
      uploaded_at: Date;
    }>(sql`
      SELECT d.id, d.kind, d.file_name, d.content_type, d.size_bytes, d.consent_date::text, u.full_name AS uploaded_by_name, d.uploaded_at
      FROM hr.employee_documents d JOIN core.users u ON u.id = d.uploaded_by WHERE d.employee_id = ${employeeId} ORDER BY d.uploaded_at DESC`);
    return rows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      fileName: row.file_name,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      consentDate: row.consent_date,
      uploadedByName: row.uploaded_by_name,
      uploadedAt: new Date(row.uploaded_at).toISOString(),
    }));
  }

  // Tải tệp giấy tờ lên; hồ sơ đã nghỉ vẫn thêm được tệp (QUYTAC_NGHIEPVU_295, 301).
  async uploadDocument(actor: Actor, employeeId: string, kind: EmployeeDocumentKind, consentDate: string | undefined, file: UploadedFile | undefined): Promise<EmployeeDocumentItem[]> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.manage);
    await this.requireVisible(this.database, actor, employeeId, granted);
    if (kind === "data_consent" && !consentDate) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { consentDate: "required" } });
    if (consentDate && consentDate > this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { consentDate: "invalidValue" } });
    const stored = await this.storeFile(`hr/${actor.companyId}/employees/${employeeId}`, file);
    await this.database
      .transaction(async (transaction) => {
        await transaction.execute(sql`
          INSERT INTO hr.employee_documents (company_id, employee_id, kind, file_name, content_type, size_bytes, storage_key, consent_date, uploaded_by)
          VALUES (${actor.companyId}, ${employeeId}, ${kind}, ${stored.fileName}, ${stored.contentType}, ${stored.size}, ${stored.storageKey}, ${kind === "data_consent" ? consentDate! : null}::date, ${actor.userId})`);
        await this.auditService.record(
          { ...hrAudit(actor, "employee"), action: "employee.document.add", entityId: employeeId, afterData: { kind, fileName: stored.fileName, sizeBytes: stored.size } },
          transaction,
        );
      })
      .catch(async (error: unknown) => {
        await this.storage.remove(stored.storageKey).catch(() => undefined);
        throw error;
      });
    return this.documents(actor, employeeId);
  }

  // Kiểm loại tệp theo phần mở rộng và chữ ký đầu tệp, giới hạn 10 MB; khóa lưu trữ do hệ thống sinh.
  async storeFile(prefix: string, file: UploadedFile | undefined): Promise<{ fileName: string; contentType: string; size: number; storageKey: string }> {
    if (!file || file.size === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > documentMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "attachmentTooLarge" } });
    const extension = file.originalname.split(".").pop()?.toLowerCase() ?? "";
    const type = documentTypes[extension];
    if (!type || !type.signature.every((byte, index) => file.buffer[index] === byte)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "attachmentTypeInvalid" } });
    const fileName = Buffer.from(file.originalname, "latin1")
      .toString("utf8")
      .replace(/[\\/\r\n"]/g, "_")
      .slice(-200);
    const storageKey = `${prefix}/${randomUUID()}`.toLowerCase();
    await this.storage.put(storageKey, file.buffer, type.type);
    return { fileName, contentType: type.type, size: file.size, storageKey };
  }

  // Tải tệp xuống: cần quyền xem giấy tờ; mỗi lần tải ghi nhật ký.
  async downloadDocument(actor: Actor, documentId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.identity);
    const row = (
      await this.database.execute<{ employee_id: string; file_name: string; content_type: string; storage_key: string; kind: string }>(sql`
      SELECT employee_id, file_name, content_type, storage_key, kind FROM hr.employee_documents WHERE id = ${documentId} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    await this.requireVisible(this.database, actor, row.employee_id, granted);
    await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.document.download", entityId: row.employee_id, afterData: { documentId, kind: row.kind } });
    return { fileName: row.file_name, contentType: row.content_type, content: await this.storage.get(row.storage_key) };
  }

  async dependents(actor: Actor, employeeId: string): Promise<DependentItem[]> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.view, hrPermission.manage);
    await this.requireVisible(this.database, actor, employeeId, granted);
    const rows = await this.database.execute<{
      id: string;
      full_name: string;
      relationship: DependentItem["relationship"];
      birth_date: string;
      identity_last4: string | null;
      deduction_from: string;
      deduction_to: string | null;
      version: number;
    }>(sql`
      SELECT id, full_name, relationship, birth_date::text, identity_last4, deduction_from::text, deduction_to::text, version
      FROM hr.dependents WHERE employee_id = ${employeeId} ORDER BY birth_date, full_name`);
    return rows.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      relationship: row.relationship,
      birthDate: row.birth_date,
      identityNumber: masked(row.identity_last4),
      deductionFrom: row.deduction_from,
      deductionTo: row.deduction_to,
      version: row.version,
    }));
  }

  async saveDependent(actor: Actor, employeeId: string, dependentId: string | null, input: DependentInput): Promise<DependentItem[]> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.manage);
    await this.database.transaction(async (transaction) => {
      const employee = await this.requireVisible(transaction, actor, employeeId, granted, true);
      if (employee.status !== "active") throw new ApiError("BUSINESS_RULE", "employeeTerminated");
      if (input.birthDate > this.permissionService.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { birthDate: "invalidValue" } });
      if (input.deductionTo && input.deductionTo < input.deductionFrom) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { deductionTo: "invalidValue" } });
      const identity = input.identityNumber?.trim() ?? "";
      if (dependentId === null) {
        await transaction.execute(sql`
          INSERT INTO hr.dependents (company_id, employee_id, full_name, relationship, birth_date, identity_encrypted, identity_last4, deduction_from, deduction_to, created_by)
          VALUES (${actor.companyId}, ${employeeId}, ${input.fullName}, ${input.relationship}, ${input.birthDate}::date, ${identity ? encryptSecret(identity) : null},
            ${identity ? lastFour(identity) : null}, ${input.deductionFrom}::date, ${input.deductionTo ?? null}::date, ${actor.userId})`);
      } else {
        const identitySets = this.protectedValue(input.identityNumber, "identity");
        const updated = await transaction.execute(sql`
          UPDATE hr.dependents SET ${sql.join(
            [
              sql`full_name = ${input.fullName}`,
              sql`relationship = ${input.relationship}`,
              sql`birth_date = ${input.birthDate}::date`,
              sql`deduction_from = ${input.deductionFrom}::date`,
              sql`deduction_to = ${input.deductionTo ?? null}::date`,
              ...identitySets,
              sql`updated_at = now()`,
              sql`version = version + 1`,
            ],
            sql`, `,
          )}
          WHERE id = ${dependentId} AND employee_id = ${employeeId} AND version = ${input.version ?? 0} RETURNING id`);
        if (updated.rows.length === 0) {
          const exists = await transaction.execute(sql`SELECT 1 FROM hr.dependents WHERE id = ${dependentId} AND employee_id = ${employeeId}`);
          throw exists.rows.length === 0 ? new ApiError("NOT_FOUND", "notFound") : new ApiError("CONFLICT_VERSION", "conflictVersion");
        }
      }
      const afterData = { ...input, identityNumber: identity ? masked(lastFour(identity)) : input.identityNumber };
      await this.auditService.record({ ...hrAudit(actor, "employee"), action: dependentId ? "employee.dependent.update" : "employee.dependent.add", entityId: employeeId, afterData }, transaction);
    });
    return this.dependents(actor, employeeId);
  }

  async granted(actor: Actor): Promise<Set<string>> {
    return hrGranted(this.permissionService, actor);
  }
}
