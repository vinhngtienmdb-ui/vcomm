// Công văn đến, đi theo Nghị định 30/2020/NĐ-CP (CHUC_NANG_184; QUYTAC_NGHIEPVU_363 đến 366; API_188 đến API_190).
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type {
  OutgoingDigitalSigningInput,
  DocumentOptions,
  DocumentParagraph,
  DocumentSettings,
  DocumentTypeItem,
  IncomingListItem,
  IncomingResponse,
  IncomingStatus,
  OfficeFileItem,
  OfficePerson,
  OutgoingListItem,
  OutgoingResponse,
  OutgoingStatus,
  PageResponse,
  RegisterIncomingInput,
  RegisterItem,
  SaveOutgoingInput,
  incomingListQuerySchema,
  outgoingListQuerySchema,
  documentSettingsSchema,
  directIncomingSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import writeExcelFile from "write-excel-file/node";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { notify, type NotificationInput } from "../common/notifications";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { renderDocumentPdf, renderDocumentWord, type FormattedDocument } from "./document-format";
import { activeGroupUsers, groupCompanyIds, peopleById } from "./office-access";
import { checkOfficeFile, OfficeTasksService } from "./office-tasks.service";
import { OfficeSigningService } from "./signing/office-signing.service";

type Executor = Pick<Database, "execute">;
type Upload = { buffer: Buffer; size: number; originalname: string } | undefined;

// 29 loại văn bản hành chính (Điều 8) và chữ viết tắt (Phụ lục III); công văn, thư công không có viết tắt tên loại.
const defaultDocumentTypes: [string, string | null][] = [
  ["Công văn", null],
  ["Quyết định", "QĐ"],
  ["Thông báo", "TB"],
  ["Tờ trình", "TTr"],
  ["Báo cáo", "BC"],
  ["Kế hoạch", "KH"],
  ["Nghị quyết", "NQ"],
  ["Chỉ thị", "CT"],
  ["Quy chế", "QC"],
  ["Quy định", "QYĐ"],
  ["Thông cáo", "TC"],
  ["Hướng dẫn", "HD"],
  ["Chương trình", "CTr"],
  ["Phương án", "PA"],
  ["Đề án", "ĐA"],
  ["Dự án", "DA"],
  ["Biên bản", "BB"],
  ["Hợp đồng", "HĐ"],
  ["Công điện", "CĐ"],
  ["Bản ghi nhớ", "GN"],
  ["Bản thỏa thuận", "TTh"],
  ["Giấy ủy quyền", "GUQ"],
  ["Giấy mời", "GM"],
  ["Giấy giới thiệu", "GGT"],
  ["Giấy nghỉ phép", "GNP"],
  ["Phiếu gửi", "PG"],
  ["Phiếu chuyển", "PC"],
  ["Phiếu báo", "PB"],
  ["Thư công", null],
];

// Địa danh mặc định theo tỉnh của trụ sở; văn thư sửa ở Cài đặt văn thư.
const placeByProvince: Record<string, string> = { "79": "Thành phố Hồ Chí Minh", "01": "Hà Nội", "48": "Đà Nẵng", "31": "Hải Phòng", "92": "Cần Thơ" };

const iso = (value: string | Date | null): string | null => (value === null ? null : new Date(value).toISOString());
const day = (value: string | Date | null): string | null => (value === null ? null : typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10));
const padNumber = (value: number) => (value < 10 ? `0${value}` : String(value));
const urgencyLabel = { normal: "Thường", urgent: "Khẩn", very_urgent: "Thượng khẩn", flash: "Hỏa tốc" } as const;

type IncomingRow = {
  id: string;
  company_id: string;
  register_id: string | null;
  register_name: string | null;
  year: number | null;
  incoming_no: number | null;
  received_on: string | null;
  sender: string;
  symbol: string | null;
  document_date: string | null;
  document_type_name: string;
  summary: string;
  urgency: IncomingListItem["urgency"];
  due_on: string | null;
  channel: IncomingResponse["channel"];
  status: IncomingStatus;
  leader_user_id: string | null;
  task_id: string | null;
  task_owner: string | null;
  source_outgoing_id: string | null;
  source_company_name: string | null;
  void_reason: string | null;
  version: number;
};

type OutgoingRow = {
  id: string;
  signing_request_id: string | null;
  company_id: string;
  register_id: string;
  register_name: string;
  document_type_id: string;
  type_name: string;
  type_abbreviation: string | null;
  is_official_letter: boolean;
  department_id: string | null;
  department_name: string | null;
  department_code: string | null;
  summary: string;
  urgency: OutgoingListItem["urgency"];
  compose_mode: "compose" | "upload";
  body: DocumentParagraph[];
  recipient_line: string | null;
  signer_user_id: string;
  signer_authority: OutgoingResponse["signerAuthority"];
  signer_authority_of: string | null;
  signer_title: string;
  external_recipients: string[];
  copies: number;
  drafter_code: string | null;
  reply_to_incoming_id: string | null;
  status: OutgoingStatus;
  approval_mode: "policy" | "signer" | null;
  approval_request_id: string | null;
  decision_note: string | null;
  year: number | null;
  outgoing_no: number | null;
  symbol: string | null;
  issued_on: string | null;
  cancel_reason: string | null;
  created_by: string;
  version: number;
};

const incomingSelect = sql`
  SELECT i.id, i.company_id, i.register_id, r.name AS register_name, i.year, i.incoming_no, to_char(i.received_on, 'YYYY-MM-DD') AS received_on, i.sender, i.symbol,
    to_char(i.document_date, 'YYYY-MM-DD') AS document_date, i.document_type_name, i.summary, i.urgency, to_char(i.due_on, 'YYYY-MM-DD') AS due_on, i.channel, i.status,
    i.leader_user_id, i.task_id, t.owner_user_id AS task_owner, i.source_outgoing_id, sc.short_name AS source_company_name, i.void_reason, i.version
  FROM office.incoming_documents i
  LEFT JOIN office.registers r ON r.id = i.register_id
  LEFT JOIN office.tasks t ON t.id = i.task_id
  LEFT JOIN office.outgoing_documents so ON so.id = i.source_outgoing_id
  LEFT JOIN core.companies sc ON sc.id = so.company_id`;

const outgoingSelect = sql`
  SELECT o.id, o.company_id, o.register_id, r.name AS register_name, o.document_type_id, dt.name AS type_name, dt.abbreviation AS type_abbreviation, dt.is_official_letter,
    o.department_id, d.name AS department_name, d.code AS department_code, o.summary, o.urgency, o.compose_mode, o.body, o.recipient_line, o.signer_user_id, o.signer_authority,
    o.signer_authority_of, o.signer_title, o.external_recipients, o.copies, o.drafter_code, o.reply_to_incoming_id, o.status, o.approval_mode, o.approval_request_id, o.decision_note,
    o.year, o.outgoing_no, o.symbol, to_char(o.issued_on, 'YYYY-MM-DD') AS issued_on, o.cancel_reason, o.created_by, o.signing_request_id, o.version
  FROM office.outgoing_documents o
  JOIN office.registers r ON r.id = o.register_id
  JOIN office.document_types dt ON dt.id = o.document_type_id
  LEFT JOIN core.departments d ON d.id = o.department_id`;

@Injectable()
export class OfficeDocumentsService implements OnModuleInit {
  private readonly logger = new Logger("OfficeDocuments");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly approvals: ApprovalRequestsService,
    private readonly tasks: OfficeTasksService,
    private readonly outbox: OutboxService,
    private readonly auditService: AuditService,
    private readonly signing: OfficeSigningService,
  ) {}

  onModuleInit(): void {
    // Phiên ký số của công văn đi kết thúc (CHUC_NANG_213): báo văn thư phát hành hoặc chọn lại cách ký.
    this.signing.outcomeHooks.push(async (executor, outcome) => {
      if (outcome.sourceType !== "outgoing" || !outcome.sourceId) return;
      const row = (
        await executor.execute<{ id: string; company_id: string; symbol: string | null; summary: string; signing_request_id: string | null }>(sql`
        SELECT id, company_id, symbol, summary, signing_request_id FROM office.outgoing_documents WHERE id = ${outcome.sourceId}`)
      ).rows[0];
      if (!row || row.signing_request_id !== outcome.requestId) return;
      const title = outcome.status === "completed" ? `Công văn đã ký số, chờ phát hành: ${row.symbol ?? row.summary}` : `Phiên ký số công văn ${row.symbol ?? row.summary} không hoàn tất`;
      await this.notifyClerks(executor, row.company_id, row.id, title);
    });
    // Luồng duyệt chung xong thì chuyển công văn đi: duyệt → chờ cấp số; từ chối, rút về sửa được (QUYTAC_NGHIEPVU_365).
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== "office.outgoing_document") return;
      const status = String(event.payload.status);
      const next = status === "approved" ? "awaiting_number" : status === "rejected" ? "rejected" : status === "withdrawn" ? "withdrawn" : null;
      if (!next) return;
      await this.database.transaction(async (transaction) => {
        const updated = await transaction.execute<{ id: string; created_by: string; company_id: string; summary: string }>(sql`
          UPDATE office.outgoing_documents SET status = ${next}, updated_at = now(), version = version + 1
          WHERE id = ${String(event.payload.documentId)} AND status = 'pending' AND approval_mode = 'policy' RETURNING id, created_by, company_id, summary`);
        const row = updated.rows[0];
        if (row && next === "awaiting_number") await this.notifyClerks(transaction, row.company_id, row.id, `Công văn chờ cấp số: ${row.summary}`);
      });
    });
    // Việc xử lý công văn đến: hoàn thành thì công văn đã xử lý; hủy thì về chờ ý kiến (QUYTAC_NGHIEPVU_364).
    this.tasks.statusChangedHooks.push(async (transaction, task) => {
      const incoming = (await transaction.execute<{ id: string }>(sql`SELECT id FROM office.incoming_documents WHERE task_id = ${task.id} AND status = 'processing'`)).rows[0];
      if (!incoming) return;
      if (task.status === "completed") {
        await transaction.execute(sql`UPDATE office.incoming_documents SET status = 'processed', updated_at = now(), version = version + 1 WHERE id = ${incoming.id}`);
        await this.routing(transaction, incoming.id, "processed", task.actorId, null, null);
      }
      if (task.status === "cancelled") {
        await transaction.execute(sql`UPDATE office.incoming_documents SET status = 'awaiting_direction', task_id = NULL, updated_at = now(), version = version + 1 WHERE id = ${incoming.id}`);
        await this.routing(transaction, incoming.id, "task_cancelled", task.actorId, null, null);
      }
    });
  }

  private audit(actor: Actor, entityType: string) {
    return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "office", entityType, ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
  }

  private async granted(actor: Actor, companyId = actor.companyId): Promise<Set<string>> {
    return this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId });
  }

  private async requireClerk(actor: Actor): Promise<void> {
    if (!(await this.granted(actor)).has("office.document.clerk")) throw new ApiError("FORBIDDEN", "forbidden");
  }

  private year(): number {
    return Number(this.permissionService.today().slice(0, 4));
  }

  // Dữ liệu mặc định của công ty: sổ đến, sổ đi, 29 loại văn bản, thông tin thể thức; tạo lần đầu dùng.
  async ensureDefaults(executor: Executor, companyId: string): Promise<void> {
    await executor.execute(sql`
      INSERT INTO office.registers (company_id, direction, name, is_default) VALUES
        (${companyId}, 'incoming', 'Sổ công văn đến', true), (${companyId}, 'outgoing', 'Sổ công văn đi', true)
      ON CONFLICT DO NOTHING`);
    const types = await executor.execute(sql`SELECT 1 FROM office.document_types WHERE company_id = ${companyId} LIMIT 1`);
    if (types.rows.length === 0) {
      for (const [index, [name, abbreviation]] of defaultDocumentTypes.entries()) {
        await executor.execute(sql`
          INSERT INTO office.document_types (company_id, name, abbreviation, is_official_letter, sort_order)
          VALUES (${companyId}, ${name}, ${abbreviation}, ${abbreviation === null}, ${index}) ON CONFLICT DO NOTHING`);
      }
    }
    const company = (
      await executor.execute<{ legal_name: string; code: string; province_code: string | null }>(sql`
        SELECT c.legal_name, c.code, (SELECT province_code FROM core.branches b WHERE b.company_id = c.id AND b.branch_type = 'head_office' ORDER BY b.created_at LIMIT 1) AS province_code
        FROM core.companies c WHERE c.id = ${companyId}`)
    ).rows[0]!;
    const abbreviation =
      company.code
        .toUpperCase()
        .replace(/[^A-ZĐ0-9]/g, "")
        .slice(0, 20) || "CT";
    await executor.execute(sql`
      INSERT INTO office.document_settings (company_id, company_display_name, company_abbreviation, place_name)
      VALUES (${companyId}, ${company.legal_name}, ${abbreviation}, ${placeByProvince[company.province_code ?? ""] ?? "Hà Nội"}) ON CONFLICT DO NOTHING`);
  }

  // ===== API_190: thông tin thể thức, sổ, loại văn bản =====

  async settings(actor: Actor): Promise<DocumentSettings> {
    await this.ensureDefaults(this.database, actor.companyId);
    const row = (
      await this.database.execute<{
        parent_org_name: string | null;
        company_display_name: string;
        company_abbreviation: string;
        place_name: string;
        font_scheme: number;
        margin_top: number;
        margin_bottom: number;
        margin_left: number;
        margin_right: number;
        version: number;
      }>(sql`SELECT * FROM office.document_settings WHERE company_id = ${actor.companyId}`)
    ).rows[0]!;
    return {
      parentOrgName: row.parent_org_name,
      companyDisplayName: row.company_display_name,
      companyAbbreviation: row.company_abbreviation,
      placeName: row.place_name,
      fontScheme: row.font_scheme === 14 ? 14 : 13,
      marginTop: row.margin_top,
      marginBottom: row.margin_bottom,
      marginLeft: row.margin_left,
      marginRight: row.margin_right,
      version: row.version,
    };
  }

  async saveSettings(actor: Actor, input: z.infer<typeof documentSettingsSchema>): Promise<DocumentSettings> {
    await this.requireClerk(actor);
    if (input.version === undefined) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { version: "required" } });
    await this.ensureDefaults(this.database, actor.companyId);
    const updated = await this.database.execute(sql`
      UPDATE office.document_settings SET parent_org_name = ${input.parentOrgName ?? null}, company_display_name = ${input.companyDisplayName},
        company_abbreviation = ${input.companyAbbreviation}, place_name = ${input.placeName}, font_scheme = ${input.fontScheme}, margin_top = ${input.marginTop},
        margin_bottom = ${input.marginBottom}, margin_left = ${input.marginLeft}, margin_right = ${input.marginRight}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
      WHERE company_id = ${actor.companyId} AND version = ${input.version} RETURNING company_id`);
    if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.auditService.record({ ...this.audit(actor, "office_document_settings"), action: "office.document_settings.update", afterData: input });
    return this.settings(actor);
  }

  async registers(actor: Actor): Promise<RegisterItem[]> {
    await this.ensureDefaults(this.database, actor.companyId);
    const rows = await this.database.execute<{
      id: string;
      direction: "incoming" | "outgoing";
      name: string;
      is_default: boolean;
      status: "active" | "inactive";
      next_value: number | null;
      version: number;
    }>(sql`
      SELECT r.id, r.direction, r.name, r.is_default, r.status, c.next_value, r.version FROM office.registers r
      LEFT JOIN office.register_counters c ON c.register_id = r.id AND c.year = ${this.year()}
      WHERE r.company_id = ${actor.companyId} ORDER BY r.direction, r.is_default DESC, r.name`);
    return rows.rows.map((row) => ({
      id: row.id,
      direction: row.direction,
      name: row.name,
      isDefault: row.is_default,
      status: row.status,
      nextNumberThisYear: row.next_value ?? 1,
      version: row.version,
    }));
  }

  async createRegister(actor: Actor, input: { name: string; direction: "incoming" | "outgoing" }): Promise<RegisterItem[]> {
    await this.requireClerk(actor);
    await this.ensureDefaults(this.database, actor.companyId);
    const inserted = await this.database.execute(sql`
      INSERT INTO office.registers (company_id, direction, name) VALUES (${actor.companyId}, ${input.direction}, ${input.name}) ON CONFLICT DO NOTHING RETURNING id`);
    if (inserted.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "officeRegisterDuplicate" } });
    return this.registers(actor);
  }

  async updateRegister(actor: Actor, id: string, input: { name: string; status: "active" | "inactive"; version: number }): Promise<RegisterItem[]> {
    await this.requireClerk(actor);
    const row = (await this.database.execute<{ is_default: boolean; version: number }>(sql`SELECT is_default, version FROM office.registers WHERE id = ${id} AND company_id = ${actor.companyId}`))
      .rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (row.is_default && input.status === "inactive") throw new ApiError("BUSINESS_RULE", "officeDefaultRegister");
    try {
      await this.database.execute(sql`UPDATE office.registers SET name = ${input.name}, status = ${input.status}, version = version + 1 WHERE id = ${id}`);
    } catch {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "officeRegisterDuplicate" } });
    }
    return this.registers(actor);
  }

  async documentTypes(actor: Actor): Promise<DocumentTypeItem[]> {
    await this.ensureDefaults(this.database, actor.companyId);
    const rows = await this.database.execute<{ id: string; name: string; abbreviation: string | null; is_official_letter: boolean; is_custom: boolean; status: "active" | "inactive" }>(sql`
      SELECT id, name, abbreviation, is_official_letter, is_custom, status FROM office.document_types WHERE company_id = ${actor.companyId} ORDER BY sort_order, name`);
    return rows.rows.map((row) => ({ id: row.id, name: row.name, abbreviation: row.abbreviation, isOfficialLetter: row.is_official_letter, isCustom: row.is_custom, status: row.status }));
  }

  async createDocumentType(actor: Actor, input: { name: string; abbreviation: string }): Promise<DocumentTypeItem[]> {
    await this.requireClerk(actor);
    await this.ensureDefaults(this.database, actor.companyId);
    const inserted = await this.database.execute(sql`
      INSERT INTO office.document_types (company_id, name, abbreviation, is_custom, sort_order) VALUES (${actor.companyId}, ${input.name}, ${input.abbreviation}, true, 200)
      ON CONFLICT DO NOTHING RETURNING id`);
    if (inserted.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "officeDocumentTypeDuplicate" } });
    return this.documentTypes(actor);
  }

  async updateDocumentType(actor: Actor, id: string, status: "active" | "inactive"): Promise<DocumentTypeItem[]> {
    await this.requireClerk(actor);
    const updated = await this.database.execute(sql`UPDATE office.document_types SET status = ${status} WHERE id = ${id} AND company_id = ${actor.companyId} RETURNING id`);
    if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    return this.documentTypes(actor);
  }

  // Danh mục cho màn hình công văn: sổ, loại, phòng ban, công ty trong tập đoàn, lãnh đạo được trình.
  async options(actor: Actor): Promise<DocumentOptions> {
    const companies = await groupCompanyIds(this.database, actor.companyId);
    const companyRows = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT id, short_name AS name FROM core.companies WHERE id IN (${sql.join(
        companies.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}) AND id <> ${actor.companyId} ORDER BY short_name`);
    const departments = await this.database.execute<{ id: string; name: string; code: string }>(sql`
      SELECT id, name, code FROM core.departments WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY name`);
    const leaderIds = await this.permissionHolders(this.database, actor.companyId, "office.document.direct");
    const leaders = await peopleById(this.database, leaderIds, actor.companyId);
    return {
      registers: await this.registers(actor),
      documentTypes: await this.documentTypes(actor),
      departments: departments.rows,
      companies: companyRows.rows,
      leaders: [...leaders.values()].sort((left, right) => left.fullName.localeCompare(right.fullName, "vi")),
      settings: await this.settings(actor),
      canClerk: (await this.granted(actor)).has("office.document.clerk"),
    };
  }

  // Người đang hoạt động, thành viên công ty, có quyền bao trùm công ty.
  private async permissionHolders(executor: Executor, companyId: string, permission: string): Promise<string[]> {
    const today = this.permissionService.today();
    const rows = await executor.execute<{ user_id: string }>(sql`
      SELECT DISTINCT a.user_id FROM core.user_role_assignments a
      JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
      JOIN core.role_permissions rp ON rp.role_id = r.id AND rp.permission_code = ${permission}
      JOIN core.users u ON u.id = a.user_id AND u.status = 'active'
      JOIN core.user_company_memberships m ON m.user_id = a.user_id AND m.company_id = ${companyId} AND m.status = 'active'
      WHERE (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${companyId}))
        AND a.valid_from <= ${today}::date AND (a.valid_to IS NULL OR a.valid_to >= ${today}::date)`);
    return rows.rows.map((row) => row.user_id);
  }

  private async notifyClerks(executor: Executor, companyId: string, outgoingOrIncomingId: string, title: string, link = `/office/outgoing/${outgoingOrIncomingId}`): Promise<void> {
    const clerks = await this.permissionHolders(executor, companyId, "office.document.clerk");
    await notify(
      executor,
      clerks.map((userId) => ({ userId, companyId, kind: "office_document", title, link, payload: { documentId: outgoingOrIncomingId } })),
    );
  }

  // Cấp số tiếp theo của sổ trong năm: khóa dòng bộ đếm trong cùng giao dịch, không trùng, không bỏ số (QUYTAC_NGHIEPVU_363).
  private async nextNumber(executor: Executor, registerId: string, year: number): Promise<number> {
    const issued = await executor.execute<{ value: number }>(sql`
      INSERT INTO office.register_counters (register_id, year, next_value) VALUES (${registerId}, ${year}, 2)
      ON CONFLICT (register_id, year) DO UPDATE SET next_value = office.register_counters.next_value + 1
      RETURNING next_value - 1 AS value`);
    return Number(issued.rows[0]!.value);
  }

  private async activeRegister(executor: Executor, companyId: string, registerId: string, direction: "incoming" | "outgoing"): Promise<void> {
    const register = await executor.execute(sql`SELECT 1 FROM office.registers WHERE id = ${registerId} AND company_id = ${companyId} AND direction = ${direction} AND status = 'active'`);
    if (register.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { registerId: "invalidValue" } });
  }

  private async files(ownerType: string, ownerId: string, actor: Actor, canDelete: boolean): Promise<OfficeFileItem[]> {
    const rows = (
      await this.database.execute<{ id: string; file_name: string; content_type: string; size_bytes: number; uploaded_by: string; created_at: string }>(sql`
        SELECT id, file_name, content_type, size_bytes, uploaded_by, created_at FROM office.files WHERE owner_type = ${ownerType} AND owner_id = ${ownerId} AND deleted_at IS NULL ORDER BY created_at`)
    ).rows;
    const people = await peopleById(
      this.database,
      rows.map((row) => row.uploaded_by),
      null,
    );
    return rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      contentType: row.content_type,
      sizeBytes: row.size_bytes,
      uploadedBy: people.get(row.uploaded_by)!,
      createdAt: iso(row.created_at)!,
      canDelete: canDelete && row.uploaded_by === actor.userId,
    }));
  }

  private async storeFile(executor: Executor, staged: string[], companyId: string, ownerType: string, ownerId: string, userId: string, file: Upload, onlyScan = false): Promise<void> {
    const checked = checkOfficeFile(file);
    if (onlyScan && !["application/pdf", "image/jpeg", "image/png"].includes(checked.contentType)) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "officeScanTypeInvalid" } });
    }
    // Khóa lưu trữ chỉ gồm chữ thường, số, "/", "-" (FileStorage): đổi "_" của loại chủ sở hữu (outgoing_signed…) thành "-".
    const storageKey = `office/${companyId}/${ownerType.replaceAll("_", "-")}/${ownerId}/${randomUUID()}`;
    await this.storage.put(storageKey, file!.buffer, checked.contentType);
    staged.push(storageKey);
    await executor.execute(sql`
      INSERT INTO office.files (company_id, owner_type, owner_id, file_name, content_type, size_bytes, storage_key, uploaded_by)
      VALUES (${companyId}, ${ownerType}, ${ownerId}, ${checked.fileName}, ${checked.contentType}, ${file!.size}, ${storageKey}, ${userId})`);
  }

  // Tệp lưu lên kho trong lúc ghi: giao dịch lỗi ở bất kỳ bước nào thì xóa mọi tệp vừa lưu, không để tệp mồ côi.
  private async withStagedFiles<T>(work: (staged: string[]) => Promise<T>): Promise<T> {
    const staged: string[] = [];
    try {
      return await work(staged);
    } catch (error) {
      await Promise.allSettled(staged.map((key) => this.storage.remove(key)));
      throw error;
    }
  }

  private async download(ownerTypes: string[], ownerId: string, fileId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const file = (
      await this.database.execute<{ file_name: string; content_type: string; storage_key: string }>(sql`
        SELECT file_name, content_type, storage_key FROM office.files
        WHERE id = ${fileId} AND owner_id = ${ownerId} AND owner_type IN (${sql.join(
          ownerTypes.map((type) => sql`${type}`),
          sql`, `,
        )}) AND deleted_at IS NULL`)
    ).rows[0];
    if (!file) throw new ApiError("NOT_FOUND", "notFound");
    return { fileName: file.file_name, contentType: file.content_type, content: await this.storage.get(file.storage_key) };
  }

  private async routing(executor: Executor, incomingId: string, action: string, actorId: string | null, toUserId: string | null, note: string | null): Promise<void> {
    await executor.execute(sql`INSERT INTO office.incoming_routings (incoming_id, action, actor_id, to_user_id, note) VALUES (${incomingId}, ${action}, ${actorId}, ${toUserId}, ${note})`);
  }

  // ===== API_188: công văn đến (QUYTAC_NGHIEPVU_364) =====

  // Người xem được công văn đến: văn thư, xem mọi công văn, lãnh đạo được trình (kể cả trước đây), người tham gia việc xử lý.
  private async incomingVisible(actor: Actor): Promise<SQL> {
    const granted = await this.granted(actor);
    if (granted.has("office.document.clerk") || granted.has("office.document.view_all")) return sql`i.company_id = ${actor.companyId}`;
    return sql`i.company_id = ${actor.companyId} AND i.status <> 'awaiting_registration' AND (
      i.leader_user_id = ${actor.userId}
      OR EXISTS (SELECT 1 FROM office.incoming_routings g WHERE g.incoming_id = i.id AND g.to_user_id = ${actor.userId})
      OR EXISTS (SELECT 1 FROM office.tasks t WHERE t.incoming_document_id = i.id AND (t.assigned_by = ${actor.userId} OR t.owner_user_id = ${actor.userId}
        OR EXISTS (SELECT 1 FROM office.task_participants p WHERE p.task_id = t.id AND p.user_id = ${actor.userId}))))`;
  }

  private async loadIncoming(executor: Executor, actor: Actor, id: string, lock = false): Promise<IncomingRow> {
    if (lock) await executor.execute(sql`SELECT 1 FROM office.incoming_documents WHERE id = ${id} FOR UPDATE`);
    const row = (await executor.execute<IncomingRow>(sql`${incomingSelect} WHERE i.id = ${id} AND ${await this.incomingVisible(actor)}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private incomingItem(row: IncomingRow, people: Map<string, OfficePerson>): IncomingListItem {
    return {
      id: row.id,
      registerName: row.register_name,
      year: row.year,
      incomingNo: row.incoming_no,
      receivedOn: row.received_on,
      sender: row.sender,
      symbol: row.symbol,
      documentDate: row.document_date,
      documentTypeName: row.document_type_name,
      summary: row.summary,
      urgency: row.urgency,
      dueOn: row.due_on,
      handler: row.task_owner ? (people.get(row.task_owner) ?? null) : null,
      status: row.status,
    };
  }

  async incomingList(actor: Actor, query: z.infer<typeof incomingListQuerySchema>): Promise<PageResponse<IncomingListItem>> {
    await this.ensureDefaults(this.database, actor.companyId);
    const conditions: SQL[] = [await this.incomingVisible(actor)];
    if (query.registerId) conditions.push(sql`i.register_id = ${query.registerId}`);
    if (query.year) conditions.push(sql`i.year = ${query.year}`);
    if (query.status !== "all") conditions.push(sql`i.status = ${query.status}`);
    if (query.urgency) conditions.push(sql`i.urgency = ${query.urgency}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(i.sender ILIKE ${pattern} OR i.summary ILIKE ${pattern} OR i.symbol ILIKE ${pattern} OR i.incoming_no::text = ${query.search})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM office.incoming_documents i WHERE ${where}`)).rows[0]!.total;
    const rows = (
      await this.database.execute<IncomingRow>(sql`${incomingSelect} WHERE ${where}
        ORDER BY i.year DESC NULLS FIRST, i.incoming_no DESC NULLS FIRST, i.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`)
    ).rows;
    const people = await peopleById(
      this.database,
      rows.map((row) => row.task_owner ?? ""),
      actor.companyId,
    );
    return { data: rows.map((row) => this.incomingItem(row, people)), page: query.page, pageSize: query.pageSize, total };
  }

  async incoming(actor: Actor, id: string): Promise<IncomingResponse> {
    const row = await this.loadIncoming(this.database, actor, id);
    const granted = await this.granted(actor);
    const clerk = granted.has("office.document.clerk");
    const routings = (
      await this.database.execute<{ id: string; action: string; actor_id: string | null; to_user_id: string | null; note: string | null; created_at: string }>(sql`
        SELECT id, action, actor_id, to_user_id, note, created_at FROM office.incoming_routings WHERE incoming_id = ${id} ORDER BY created_at, id`)
    ).rows;
    const people = await peopleById(this.database, [row.leader_user_id ?? "", row.task_owner ?? "", ...routings.flatMap((item) => [item.actor_id ?? "", item.to_user_id ?? ""])], actor.companyId);
    // Cảnh báo trùng: cùng nơi gửi, số ký hiệu, ngày văn bản trong năm (không chặn).
    const duplicates =
      row.symbol && row.year
        ? (
            await this.database.execute<{ id: string; incoming_no: number | null }>(sql`
              SELECT id, incoming_no FROM office.incoming_documents WHERE company_id = ${row.company_id} AND id <> ${id} AND year = ${row.year} AND status <> 'voided'
                AND lower(sender) = lower(${row.sender}) AND lower(symbol) = lower(${row.symbol}) AND document_date IS NOT DISTINCT FROM ${row.document_date}::date`)
          ).rows
        : [];
    const actions: IncomingResponse["allowedActions"] = [];
    if (clerk && row.status === "awaiting_registration") actions.push("accept");
    if (clerk && row.status === "registered") actions.push("edit", "submit", "void", "upload");
    if (clerk && row.status === "awaiting_direction") actions.push("void");
    if (row.status === "awaiting_direction" && row.leader_user_id === actor.userId) actions.push("direct");
    return {
      ...this.incomingItem(row, people),
      channel: row.channel,
      registerId: row.register_id,
      leader: row.leader_user_id ? (people.get(row.leader_user_id) ?? null) : null,
      taskId: row.task_id,
      sourceCompanyName: row.source_company_name,
      voidReason: row.void_reason,
      files: await this.files("incoming", id, actor, clerk && row.status === "registered"),
      routings: routings.map((item) => ({
        id: item.id,
        action: item.action,
        actor: item.actor_id ? (people.get(item.actor_id) ?? null) : null,
        toUser: item.to_user_id ? (people.get(item.to_user_id) ?? null) : null,
        note: item.note,
        createdAt: iso(item.created_at)!,
      })),
      duplicateOf: duplicates.map((item) => ({ id: item.id, incomingNo: item.incoming_no })),
      allowedActions: actions,
      version: row.version,
    };
  }

  // Vào sổ: cấp số đến khi vào sổ; bắt buộc ít nhất một tệp bản quét gửi kèm (multipart nhiều tệp).
  async registerIncoming(actor: Actor, input: RegisterIncomingInput, files: NonNullable<Upload>[]): Promise<IncomingResponse> {
    await this.requireClerk(actor);
    if (files.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    const id = await this.withStagedFiles((staged) =>
      this.database.transaction(async (transaction) => {
        await this.ensureDefaults(transaction, actor.companyId);
        await this.activeRegister(transaction, actor.companyId, input.registerId, "incoming");
        const year = Number(input.receivedOn.slice(0, 4));
        const number = await this.nextNumber(transaction, input.registerId, year);
        const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO office.incoming_documents (company_id, register_id, year, incoming_no, received_on, sender, symbol, document_date, document_type_name, summary, urgency, due_on,
          channel, status, registered_by)
        VALUES (${actor.companyId}, ${input.registerId}, ${year}, ${number}, ${input.receivedOn}, ${input.sender}, ${input.symbol ?? null}, ${input.documentDate ?? null},
          ${input.documentTypeName}, ${input.summary}, ${input.urgency}, ${input.dueOn ?? null}, ${input.channel}, 'registered', ${actor.userId})
        RETURNING id`);
        const incomingId = inserted.rows[0]!.id;
        for (const file of files) await this.storeFile(transaction, staged, actor.companyId, "incoming", incomingId, actor.userId, file, true);
        await this.routing(transaction, incomingId, "registered", actor.userId, null, null);
        await this.auditService.record({ ...this.audit(actor, "office_incoming"), action: "office.incoming.register", entityId: incomingId, afterData: { year, number } }, transaction);
        return incomingId;
      }),
    );
    return this.incoming(actor, id);
  }

  async updateIncoming(actor: Actor, id: string, input: Omit<RegisterIncomingInput, "registerId"> & { version: number }): Promise<IncomingResponse> {
    await this.requireClerk(actor);
    await this.database.transaction(async (transaction) => {
      const row = await this.loadIncoming(transaction, actor, id, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "registered") throw new ApiError("BUSINESS_RULE", "officeIncomingLocked");
      if (row.year !== Number(input.receivedOn.slice(0, 4))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { receivedOn: "officeIncomingYearLocked" } });
      await transaction.execute(sql`
        UPDATE office.incoming_documents SET received_on = ${input.receivedOn}, sender = ${input.sender}, symbol = ${input.symbol ?? null}, document_date = ${input.documentDate ?? null},
          document_type_name = ${input.documentTypeName}, summary = ${input.summary}, urgency = ${input.urgency}, due_on = ${input.dueOn ?? null}, channel = ${input.channel},
          updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...this.audit(actor, "office_incoming"), action: "office.incoming.update", entityId: id }, transaction);
    });
    return this.incoming(actor, id);
  }

  async addIncomingFile(actor: Actor, id: string, file: Upload): Promise<IncomingResponse> {
    await this.requireClerk(actor);
    await this.withStagedFiles((staged) =>
      this.database.transaction(async (transaction) => {
        const row = await this.loadIncoming(transaction, actor, id, true);
        if (row.status !== "registered") throw new ApiError("BUSINESS_RULE", "officeIncomingLocked");
        await this.storeFile(transaction, staged, actor.companyId, "incoming", id, actor.userId, file, true);
      }),
    );
    return this.incoming(actor, id);
  }

  async downloadIncomingFile(actor: Actor, id: string, fileId: string) {
    await this.loadIncoming(this.database, actor, id);
    return this.download(["incoming"], id, fileId);
  }

  // Vào sổ công văn liên công ty đang chờ: số đến cấp lúc vào sổ.
  async acceptIncoming(actor: Actor, id: string, input: { registerId: string; receivedOn: string; version: number }): Promise<IncomingResponse> {
    await this.requireClerk(actor);
    await this.database.transaction(async (transaction) => {
      const row = await this.loadIncoming(transaction, actor, id, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "awaiting_registration") throw new ApiError("BUSINESS_RULE", "officeIncomingLocked");
      await this.activeRegister(transaction, actor.companyId, input.registerId, "incoming");
      const year = Number(input.receivedOn.slice(0, 4));
      const number = await this.nextNumber(transaction, input.registerId, year);
      await transaction.execute(sql`
        UPDATE office.incoming_documents SET register_id = ${input.registerId}, year = ${year}, incoming_no = ${number}, received_on = ${input.receivedOn}, status = 'registered',
          registered_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.routing(transaction, id, "registered", actor.userId, null, null);
    });
    return this.incoming(actor, id);
  }

  async submitIncoming(actor: Actor, id: string, input: { leaderUserId: string; note?: string | null | undefined; version: number }): Promise<IncomingResponse> {
    await this.requireClerk(actor);
    await this.database.transaction(async (transaction) => {
      const row = await this.loadIncoming(transaction, actor, id, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "registered") throw new ApiError("BUSINESS_RULE", "officeIncomingLocked");
      await this.toLeader(transaction, row, actor, input.leaderUserId, input.note ?? null, "submitted");
    });
    return this.incoming(actor, id);
  }

  private async toLeader(executor: Executor, row: IncomingRow, actor: Actor, leaderUserId: string, note: string | null, action: "submitted" | "forwarded"): Promise<void> {
    const leaders = await this.permissionHolders(executor, row.company_id, "office.document.direct");
    if (!leaders.includes(leaderUserId)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { leaderUserId: "officeNotLeader" } });
    await executor.execute(sql`UPDATE office.incoming_documents SET status = 'awaiting_direction', leader_user_id = ${leaderUserId}, updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
    await this.routing(executor, row.id, action, actor.userId, leaderUserId, note);
    await notify(executor, [
      {
        userId: leaderUserId,
        companyId: row.company_id,
        kind: "office_document",
        title: `Công văn đến số ${row.incoming_no} chờ ý kiến: ${row.summary}`,
        link: `/office/incoming/${row.id}`,
        payload: { incomingId: row.id },
      },
    ]);
  }

  // Lãnh đạo cho ý kiến: giao xử lý thành công việc, chuyển lãnh đạo khác, hoặc lưu không cần xử lý.
  async directIncoming(actor: Actor, id: string, input: z.infer<typeof directIncomingSchema>): Promise<IncomingResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadIncoming(transaction, actor, id, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "awaiting_direction") throw new ApiError("BUSINESS_RULE", "officeIncomingLocked");
      if (row.leader_user_id !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
      if (input.action === "forward") {
        if (!input.leaderUserId || input.leaderUserId === actor.userId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { leaderUserId: "required" } });
        await this.toLeader(transaction, row, actor, input.leaderUserId, input.note ?? null, "forwarded");
        return;
      }
      if (input.action === "archive") {
        await transaction.execute(sql`UPDATE office.incoming_documents SET status = 'archived', updated_at = now(), version = version + 1 WHERE id = ${id}`);
        await this.routing(transaction, id, "archived", actor.userId, null, input.note ?? null);
        return;
      }
      if (!input.ownerUserId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { ownerUserId: "required" } });
      const members = await activeGroupUsers(transaction, row.company_id, [input.ownerUserId, ...input.collaboratorIds]);
      if (!members.has(input.ownerUserId)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { ownerUserId: "officeParticipantOutsideGroup" } });
      if (input.collaboratorIds.some((userId) => !members.has(userId))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { collaboratorIds: "officeParticipantOutsideGroup" } });
      const title = `Xử lý công văn đến số ${row.incoming_no}${row.symbol ? ` (${row.symbol})` : ""}: ${row.summary}`.slice(0, 200);
      const description = [input.note ? `Ý kiến chỉ đạo: ${input.note}` : null, `Nơi gửi: ${row.sender}`].filter(Boolean).join("\n");
      const task = await transaction.execute<{ id: string }>(sql`
        INSERT INTO office.tasks (company_id, title, description, priority, due_at, assigned_by, owner_user_id, incoming_document_id)
        VALUES (${row.company_id}, ${title}, ${description}, ${row.urgency === "normal" ? "normal" : "urgent"}, ${input.dueAt ?? (row.due_on ? `${row.due_on}T17:00:00+07:00` : null)},
          ${actor.userId}, ${input.ownerUserId}, ${id})
        RETURNING id`);
      const taskId = task.rows[0]!.id;
      for (const userId of [...new Set(input.collaboratorIds)].filter((item) => item !== input.ownerUserId)) {
        await transaction.execute(sql`INSERT INTO office.task_participants (task_id, user_id, role) VALUES (${taskId}, ${userId}, 'collaborator')`);
      }
      await transaction.execute(
        sql`INSERT INTO office.task_events (task_id, actor_id, action, details) VALUES (${taskId}, ${actor.userId}, 'created', ${JSON.stringify({ incomingNo: row.incoming_no })}::jsonb)`,
      );
      await transaction.execute(sql`UPDATE office.incoming_documents SET status = 'processing', task_id = ${taskId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.routing(transaction, id, "assigned", actor.userId, input.ownerUserId, input.note ?? null);
      const recipients = [input.ownerUserId, ...input.collaboratorIds].filter((userId) => userId !== actor.userId);
      await notify(
        transaction,
        [...new Set(recipients)].map((userId) => ({
          userId,
          companyId: row.company_id,
          kind: "office_task_assigned",
          title: `Việc mới: ${title}`,
          link: `/office/tasks/${taskId}`,
          payload: { taskId },
        })),
      );
    });
    return this.incoming(actor, id);
  }

  async voidIncoming(actor: Actor, id: string, reason: string, version: number): Promise<IncomingResponse> {
    await this.requireClerk(actor);
    await this.database.transaction(async (transaction) => {
      const row = await this.loadIncoming(transaction, actor, id, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "registered" && row.status !== "awaiting_direction") throw new ApiError("BUSINESS_RULE", "officeIncomingLocked");
      await transaction.execute(
        sql`UPDATE office.incoming_documents SET status = 'voided', void_reason = ${reason}, leader_user_id = NULL, updated_at = now(), version = version + 1 WHERE id = ${id}`,
      );
      await this.routing(transaction, id, "voided", actor.userId, null, reason);
      await this.auditService.record({ ...this.audit(actor, "office_incoming"), action: "office.incoming.void", entityId: id, afterData: { reason } }, transaction);
    });
    return this.incoming(actor, id);
  }

  // ===== API_189: công văn đi (QUYTAC_NGHIEPVU_365, 366) =====

  // Người xem được công văn đi: người soạn, người ký, văn thư, xem mọi công văn, người duyệt, người nhận nội bộ sau phát hành.
  private async outgoingVisible(actor: Actor): Promise<SQL> {
    const granted = await this.granted(actor);
    if (granted.has("office.document.clerk") || granted.has("office.document.view_all")) return sql`o.company_id = ${actor.companyId}`;
    const today = this.permissionService.today();
    return sql`o.company_id = ${actor.companyId} AND (
      o.created_by = ${actor.userId} OR o.signer_user_id = ${actor.userId}
      OR EXISTS (SELECT 1 FROM core.approval_steps s WHERE s.request_id = o.approval_request_id AND (s.assigned_user_id = ${actor.userId} OR s.decided_by = ${actor.userId}
        OR (s.assigned_role_id IS NOT NULL AND EXISTS (SELECT 1 FROM core.user_role_assignments a WHERE a.user_id = ${actor.userId} AND a.role_id = s.assigned_role_id
          AND (a.scope_type = 'group' OR a.company_id = o.company_id) AND a.valid_from <= ${today}::date AND (a.valid_to IS NULL OR a.valid_to >= ${today}::date)))))
      OR (o.status = 'issued' AND EXISTS (SELECT 1 FROM office.outgoing_recipients rc WHERE rc.outgoing_id = o.id AND (
        (rc.kind = 'user' AND rc.target_id = ${actor.userId})
        OR (rc.kind = 'department' AND EXISTS (SELECT 1 FROM core.user_company_memberships m WHERE m.user_id = ${actor.userId} AND m.company_id = o.company_id
          AND m.department_id = rc.target_id AND m.status = 'active'))))))`;
  }

  private async loadOutgoing(executor: Executor, actor: Actor, id: string, lock = false): Promise<OutgoingRow> {
    if (lock) await executor.execute(sql`SELECT 1 FROM office.outgoing_documents WHERE id = ${id} FOR UPDATE`);
    const row = (await executor.execute<OutgoingRow>(sql`${outgoingSelect} WHERE o.id = ${id} AND ${await this.outgoingVisible(actor)}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Ký hiệu (QUYTAC_NGHIEPVU_363): văn bản có tên loại `<viết tắt loại>-<viết tắt công ty>`; công văn `<viết tắt công ty>-<viết tắt phòng ban>`.
  private symbolSuffix(row: Pick<OutgoingRow, "is_official_letter" | "type_abbreviation" | "department_code">, companyAbbreviation: string): string {
    if (!row.is_official_letter) return `${row.type_abbreviation}-${companyAbbreviation}`;
    return row.department_code ? `${companyAbbreviation}-${row.department_code.toUpperCase()}` : companyAbbreviation;
  }

  private outgoingItem(row: OutgoingRow, people: Map<string, OfficePerson>, internalNames: string[]): OutgoingListItem {
    return {
      id: row.id,
      registerName: row.register_name,
      outgoingNo: row.outgoing_no,
      symbol: row.symbol,
      issuedOn: row.issued_on,
      documentTypeName: row.type_name,
      summary: row.summary,
      signer: people.get(row.signer_user_id)!,
      recipientsText: [...row.external_recipients, ...internalNames].join("; "),
      urgency: row.urgency,
      status: row.status,
    };
  }

  private async recipients(outgoingId: string): Promise<{ kind: "user" | "department" | "company"; id: string; name: string }[]> {
    const rows = await this.database.execute<{ kind: "user" | "department" | "company"; id: string; name: string | null }>(sql`
      SELECT rc.kind, rc.target_id AS id, COALESCE(u.full_name, d.name, c.short_name) AS name FROM office.outgoing_recipients rc
      LEFT JOIN core.users u ON rc.kind = 'user' AND u.id = rc.target_id
      LEFT JOIN core.departments d ON rc.kind = 'department' AND d.id = rc.target_id
      LEFT JOIN core.companies c ON rc.kind = 'company' AND c.id = rc.target_id
      WHERE rc.outgoing_id = ${outgoingId} ORDER BY rc.kind, name`);
    return rows.rows.map((row) => ({ kind: row.kind, id: row.id, name: row.name ?? "" }));
  }

  async outgoingList(actor: Actor, query: z.infer<typeof outgoingListQuerySchema>): Promise<PageResponse<OutgoingListItem>> {
    await this.ensureDefaults(this.database, actor.companyId);
    const conditions: SQL[] = [await this.outgoingVisible(actor)];
    if (query.registerId) conditions.push(sql`o.register_id = ${query.registerId}`);
    if (query.year) conditions.push(sql`(o.year = ${query.year} OR (o.year IS NULL AND extract(year FROM o.created_at) = ${query.year}))`);
    if (query.status !== "all") conditions.push(sql`o.status = ${query.status}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(o.summary ILIKE ${pattern} OR o.symbol ILIKE ${pattern} OR o.outgoing_no::text = ${query.search})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM office.outgoing_documents o WHERE ${where}`)).rows[0]!.total;
    const rows = (
      await this.database.execute<OutgoingRow>(sql`${outgoingSelect} WHERE ${where}
        ORDER BY o.year DESC NULLS FIRST, o.outgoing_no DESC NULLS FIRST, o.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`)
    ).rows;
    const people = await peopleById(
      this.database,
      rows.map((row) => row.signer_user_id),
      actor.companyId,
    );
    const data: OutgoingListItem[] = [];
    for (const row of rows)
      data.push(
        this.outgoingItem(
          row,
          people,
          (await this.recipients(row.id)).map((item) => item.name),
        ),
      );
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  async outgoing(actor: Actor, id: string): Promise<OutgoingResponse> {
    const row = await this.loadOutgoing(this.database, actor, id);
    const clerk = (await this.granted(actor)).has("office.document.clerk");
    const people = await peopleById(this.database, [row.signer_user_id, row.created_by], actor.companyId);
    const recipients = await this.recipients(id);
    const settings = await this.settings(actor);
    const reply = row.reply_to_incoming_id
      ? ((
          await this.database.execute<{ id: string; incoming_no: number | null; symbol: string | null }>(
            sql`SELECT id, incoming_no, symbol FROM office.incoming_documents WHERE id = ${row.reply_to_incoming_id}`,
          )
        ).rows[0] ?? null)
      : null;
    const creator = row.created_by === actor.userId;
    const actions: OutgoingResponse["allowedActions"] = [];
    if (creator && ["draft", "rejected", "withdrawn"].includes(row.status)) actions.push("edit", "submit", "upload_draft", "cancel");
    if (creator && row.status === "pending") actions.push("withdraw");
    if (row.status === "pending" && row.approval_mode === "signer" && row.signer_user_id === actor.userId) actions.push("decide");
    if (clerk && row.status === "awaiting_number") actions.push("number", "cancel");
    const signing = row.signing_request_id ? await this.signing.latestForSource(this.database, row.company_id, "outgoing", id) : null;
    if (clerk && row.status === "numbered") {
      // Phiên ký đang chạy thì chờ ký xong; phiên kết thúc không xong thì chọn lại Ký số hoặc phát hành bằng bản quét.
      const active = signing && (signing.status === "draft" || signing.status === "signing");
      if (!active) actions.push("issue");
      if (!active && signing?.status !== "completed") actions.push("digital_sign");
    }
    return {
      ...this.outgoingItem(
        row,
        people,
        recipients.map((item) => item.name),
      ),
      registerId: row.register_id,
      documentTypeId: row.document_type_id,
      departmentId: row.department_id,
      departmentName: row.department_name,
      composeMode: row.compose_mode,
      recipientLine: row.recipient_line,
      body: row.body,
      signerAuthority: row.signer_authority,
      signerAuthorityOf: row.signer_authority_of,
      signerTitle: row.signer_title,
      externalRecipients: row.external_recipients,
      internalRecipients: recipients,
      copies: row.copies,
      drafterCode: row.drafter_code,
      replyTo: reply ? { id: reply.id, incomingNo: reply.incoming_no, symbol: reply.symbol } : null,
      approvalMode: row.approval_mode,
      approvalRequestId: row.approval_request_id,
      decisionNote: row.decision_note,
      cancelReason: row.cancel_reason,
      createdBy: people.get(row.created_by)!,
      draftFiles: await this.files("outgoing_draft", id, actor, creator && ["draft", "rejected", "withdrawn"].includes(row.status)),
      signedFiles: await this.files("outgoing_signed", id, actor, false),
      expectedSymbol: row.outgoing_no === null ? this.symbolSuffix(row, settings.companyAbbreviation) : null,
      signing,
      allowedActions: actions,
      version: row.version,
    };
  }

  private async checkOutgoing(executor: Executor, actor: Actor, input: SaveOutgoingInput): Promise<void> {
    await this.activeRegister(executor, actor.companyId, input.registerId, "outgoing");
    const type = await executor.execute(sql`SELECT 1 FROM office.document_types WHERE id = ${input.documentTypeId} AND company_id = ${actor.companyId} AND status = 'active'`);
    if (type.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { documentTypeId: "invalidValue" } });
    if (input.departmentId) {
      const department = await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`);
      if (department.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { departmentId: "invalidValue" } });
    }
    const signer = await executor.execute(sql`
      SELECT 1 FROM core.users u JOIN core.user_company_memberships m ON m.user_id = u.id AND m.company_id = ${actor.companyId} AND m.status = 'active'
      WHERE u.id = ${input.signerUserId} AND u.status = 'active'`);
    if (signer.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signerUserId: "officeSignerInvalid" } });
    if (input.signerAuthority && !input.signerAuthorityOf) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signerAuthorityOf: "required" } });
    const groupCompanies = await groupCompanyIds(executor, actor.companyId);
    for (const recipient of input.internalRecipients) {
      const ok =
        recipient.kind === "company"
          ? recipient.id !== actor.companyId && groupCompanies.includes(recipient.id)
          : recipient.kind === "department"
            ? (await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${recipient.id} AND company_id = ${actor.companyId}`)).rows.length > 0
            : (await executor.execute(sql`SELECT 1 FROM core.user_company_memberships WHERE user_id = ${recipient.id} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length > 0;
      if (!ok) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { internalRecipients: "invalidValue" } });
    }
    if (input.replyToIncomingId) {
      const reply = await executor.execute(sql`SELECT 1 FROM office.incoming_documents WHERE id = ${input.replyToIncomingId} AND company_id = ${actor.companyId} AND incoming_no IS NOT NULL`);
      if (reply.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { replyToIncomingId: "invalidValue" } });
    }
  }

  private async writeRecipients(executor: Executor, id: string, recipients: SaveOutgoingInput["internalRecipients"]): Promise<void> {
    await executor.execute(sql`DELETE FROM office.outgoing_recipients WHERE outgoing_id = ${id}`);
    for (const recipient of recipients) {
      await executor.execute(sql`INSERT INTO office.outgoing_recipients (outgoing_id, kind, target_id) VALUES (${id}, ${recipient.kind}, ${recipient.id}) ON CONFLICT DO NOTHING`);
    }
  }

  async createOutgoing(actor: Actor, input: SaveOutgoingInput): Promise<OutgoingResponse> {
    const id = await this.database.transaction(async (transaction) => {
      await this.ensureDefaults(transaction, actor.companyId);
      await this.checkOutgoing(transaction, actor, input);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO office.outgoing_documents (company_id, register_id, document_type_id, department_id, summary, urgency, compose_mode, body, recipient_line, signer_user_id,
          signer_authority, signer_authority_of, signer_title, external_recipients, copies, drafter_code, reply_to_incoming_id, created_by)
        VALUES (${actor.companyId}, ${input.registerId}, ${input.documentTypeId}, ${input.departmentId ?? null}, ${input.summary}, ${input.urgency}, ${input.composeMode},
          ${JSON.stringify(input.body)}::jsonb, ${input.recipientLine ?? null}, ${input.signerUserId}, ${input.signerAuthority}, ${input.signerAuthorityOf ?? null}, ${input.signerTitle},
          ${JSON.stringify(input.externalRecipients)}::jsonb, ${input.copies}, ${input.drafterCode ?? null}, ${input.replyToIncomingId ?? null}, ${actor.userId})
        RETURNING id`);
      const outgoingId = inserted.rows[0]!.id;
      await this.writeRecipients(transaction, outgoingId, input.internalRecipients);
      await this.auditService.record({ ...this.audit(actor, "office_outgoing"), action: "office.outgoing.create", entityId: outgoingId, afterData: { summary: input.summary } }, transaction);
      return outgoingId;
    });
    return this.outgoing(actor, id);
  }

  async updateOutgoing(actor: Actor, id: string, input: SaveOutgoingInput): Promise<OutgoingResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadOutgoing(transaction, actor, id, true);
      if (row.created_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
      if (!["draft", "rejected", "withdrawn"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "officeOutgoingLocked");
      // Sửa phải gửi phiên bản đang xem (khóa lạc quan).
      if (input.version === undefined) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { version: "required" } });
      if (input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.checkOutgoing(transaction, actor, input);
      await transaction.execute(sql`
        UPDATE office.outgoing_documents SET register_id = ${input.registerId}, document_type_id = ${input.documentTypeId}, department_id = ${input.departmentId ?? null},
          summary = ${input.summary}, urgency = ${input.urgency}, compose_mode = ${input.composeMode}, body = ${JSON.stringify(input.body)}::jsonb, recipient_line = ${input.recipientLine ?? null},
          signer_user_id = ${input.signerUserId}, signer_authority = ${input.signerAuthority}, signer_authority_of = ${input.signerAuthorityOf ?? null}, signer_title = ${input.signerTitle},
          external_recipients = ${JSON.stringify(input.externalRecipients)}::jsonb, copies = ${input.copies}, drafter_code = ${input.drafterCode ?? null},
          reply_to_incoming_id = ${input.replyToIncomingId ?? null}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.writeRecipients(transaction, id, input.internalRecipients);
    });
    return this.outgoing(actor, id);
  }

  async addDraftFile(actor: Actor, id: string, file: Upload): Promise<OutgoingResponse> {
    await this.withStagedFiles((staged) =>
      this.database.transaction(async (transaction) => {
        const row = await this.loadOutgoing(transaction, actor, id, true);
        if (row.created_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
        if (!["draft", "rejected", "withdrawn"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "officeOutgoingLocked");
        await this.storeFile(transaction, staged, actor.companyId, "outgoing_draft", id, actor.userId, file);
      }),
    );
    return this.outgoing(actor, id);
  }

  async downloadOutgoingFile(actor: Actor, id: string, fileId: string) {
    await this.loadOutgoing(this.database, actor, id);
    return this.download(["outgoing_draft", "outgoing_signed"], id, fileId);
  }

  // Trình ký: có chính sách duyệt thì đi luồng duyệt chung; chưa có thì một cấp do người ký duyệt trong mini app (QUYTAC_NGHIEPVU_365).
  async submitOutgoing(actor: Actor, id: string, version: number): Promise<OutgoingResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadOutgoing(transaction, actor, id, true);
      if (row.created_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
      if (!["draft", "rejected", "withdrawn"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "officeOutgoingLocked");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.compose_mode === "compose" && row.body.every((paragraph) => !paragraph.text.trim())) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { body: "required" } });
      if (row.compose_mode === "upload") {
        const drafts = await transaction.execute(sql`SELECT 1 FROM office.files WHERE owner_type = 'outgoing_draft' AND owner_id = ${id} AND deleted_at IS NULL`);
        if (drafts.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
      }
      const today = this.permissionService.today();
      const policy = await transaction.execute(sql`
        SELECT 1 FROM core.approval_policies WHERE company_id = ${row.company_id} AND document_type_code = 'office.outgoing_document'
          AND effective_from <= ${today}::date AND (effective_to IS NULL OR effective_to >= ${today}::date)`);
      if (policy.rows.length > 0) {
        const requestId = await this.approvals.submitWithin(transaction, row.company_id, actor.userId, {
          documentTypeCode: "office.outgoing_document",
          documentId: id,
          documentNo: `CVĐ-${id.slice(0, 8).toUpperCase()}`,
          amount: "0",
          currency: "VND",
          documentDate: today,
        });
        await transaction.execute(sql`
          UPDATE office.outgoing_documents SET status = 'pending', approval_mode = 'policy', approval_request_id = ${requestId}, decision_note = NULL, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      } else {
        await transaction.execute(sql`
          UPDATE office.outgoing_documents SET status = 'pending', approval_mode = 'signer', approval_request_id = NULL, decision_note = NULL, updated_at = now(), version = version + 1 WHERE id = ${id}`);
        await notify(transaction, [
          {
            userId: row.signer_user_id,
            companyId: row.company_id,
            kind: "office_document",
            title: `Công văn chờ bạn duyệt ký: ${row.summary}`,
            link: `/office/outgoing/${id}`,
            payload: { outgoingId: id },
          },
        ]);
      }
      await this.auditService.record({ ...this.audit(actor, "office_outgoing"), action: "office.outgoing.submit", entityId: id }, transaction);
    });
    return this.outgoing(actor, id);
  }

  async withdrawOutgoing(actor: Actor, id: string, version: number): Promise<OutgoingResponse> {
    // Kiểm và đổi trạng thái trong giao dịch có khóa dòng; luồng duyệt chung tự kiểm trạng thái yêu cầu duyệt khi rút.
    const approvalRequestId = await this.database.transaction(async (transaction) => {
      const row = await this.loadOutgoing(transaction, actor, id, true);
      if (row.created_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
      if (row.status !== "pending") throw new ApiError("BUSINESS_RULE", "officeOutgoingLocked");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.approval_mode === "policy" && row.approval_request_id) return row.approval_request_id;
      await transaction.execute(sql`UPDATE office.outgoing_documents SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id}`);
      return null;
    });
    if (approvalRequestId) {
      await this.approvals.withdraw(actor.userId, approvalRequestId);
      await this.outbox.dispatchPending();
    }
    return this.outgoing(actor, id);
  }

  // Người ký duyệt khi công ty chưa có chính sách duyệt công văn đi.
  async decideOutgoing(actor: Actor, id: string, decision: "approved" | "rejected", note: string | null | undefined, version: number): Promise<OutgoingResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadOutgoing(transaction, actor, id, true);
      if (row.status !== "pending" || row.approval_mode !== "signer") throw new ApiError("BUSINESS_RULE", "officeOutgoingLocked");
      if (row.signer_user_id !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (decision === "rejected" && !note) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { note: "required" } });
      await transaction.execute(sql`
        UPDATE office.outgoing_documents SET status = ${decision === "approved" ? "awaiting_number" : "rejected"}, decision_note = ${note ?? null}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await notify(transaction, [
        {
          userId: row.created_by,
          companyId: row.company_id,
          kind: "office_document",
          title: `${decision === "approved" ? "Đã duyệt ký" : "Bị từ chối"}: ${row.summary}`,
          link: `/office/outgoing/${id}`,
          payload: { outgoingId: id },
        },
      ]);
      if (decision === "approved") await this.notifyClerks(transaction, row.company_id, id, `Công văn chờ cấp số: ${row.summary}`);
      await this.auditService.record({ ...this.audit(actor, "office_outgoing"), action: `office.outgoing.${decision}`, entityId: id, afterData: { note } }, transaction);
    });
    return this.outgoing(actor, id);
  }

  async cancelOutgoing(actor: Actor, id: string, reason: string, version: number): Promise<OutgoingResponse> {
    const clerk = (await this.granted(actor)).has("office.document.clerk");
    await this.database.transaction(async (transaction) => {
      const row = await this.loadOutgoing(transaction, actor, id, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const byCreator = row.created_by === actor.userId && ["draft", "rejected", "withdrawn"].includes(row.status);
      const byClerk = clerk && row.status === "awaiting_number";
      if (!byCreator && !byClerk) throw new ApiError(row.outgoing_no !== null ? "BUSINESS_RULE" : "FORBIDDEN", row.outgoing_no !== null ? "officeOutgoingLocked" : "forbidden");
      await transaction.execute(sql`UPDATE office.outgoing_documents SET status = 'cancelled', cancel_reason = ${reason}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...this.audit(actor, "office_outgoing"), action: "office.outgoing.cancel", entityId: id, afterData: { reason } }, transaction);
    });
    return this.outgoing(actor, id);
  }

  // Văn thư cấp số: số tiếp theo của sổ đi trong năm, ngày văn bản là ngày cấp (giờ Việt Nam).
  async numberOutgoing(actor: Actor, id: string, version: number): Promise<OutgoingResponse> {
    await this.requireClerk(actor);
    await this.database.transaction(async (transaction) => {
      const row = await this.loadOutgoing(transaction, actor, id, true);
      if (row.status !== "awaiting_number") throw new ApiError("BUSINESS_RULE", "officeOutgoingLocked");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const today = this.permissionService.today();
      const year = Number(today.slice(0, 4));
      const settings = await this.settings(actor);
      const number = await this.nextNumber(transaction, row.register_id, year);
      const symbol = `${padNumber(number)}/${this.symbolSuffix(row, settings.companyAbbreviation)}`;
      await transaction.execute(sql`
        UPDATE office.outgoing_documents SET status = 'numbered', year = ${year}, outgoing_no = ${number}, symbol = ${symbol}, issued_on = ${today}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...this.audit(actor, "office_outgoing"), action: "office.outgoing.number", entityId: id, afterData: { symbol } }, transaction);
    });
    return this.outgoing(actor, id);
  }

  // Phát hành: tải bản đã ký, đóng dấu (hoặc bản ký số của phiên đã xong); báo người nhận nội bộ; công ty khác trong tập đoàn nhận công văn đến chờ vào sổ.
  async issueOutgoing(actor: Actor, id: string, upload: Upload, version: number): Promise<OutgoingResponse> {
    await this.requireClerk(actor);
    const current = await this.loadOutgoing(this.database, actor, id);
    const signing = current.signing_request_id ? await this.signing.latestForSource(this.database, current.company_id, "outgoing", id) : null;
    if (signing && (signing.status === "draft" || signing.status === "signing")) throw new ApiError("BUSINESS_RULE", "officeOutgoingSigning");
    let file = upload;
    if (signing?.status === "completed") {
      // Bản ký số là bản phát hành: không nhận bản quét khác.
      const result = await this.signing.completedResult(signing.id);
      if (!result) throw new ApiError("BUSINESS_RULE", "officeOutgoingSigning");
      file = { buffer: result.content, size: result.content.length, originalname: Buffer.from(result.fileName, "utf8").toString("latin1") };
    } else if (!file) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    }
    const copies: { companyId: string; incomingId: string }[] = [];
    await this.withStagedFiles((staged) =>
      this.database.transaction(async (transaction) => {
        const row = await this.loadOutgoing(transaction, actor, id, true);
        if (row.status !== "numbered") throw new ApiError("BUSINESS_RULE", "officeOutgoingLocked");
        if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        if (row.signing_request_id !== current.signing_request_id) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await this.storeFile(transaction, staged, row.company_id, "outgoing_signed", id, actor.userId, file, true);
        await transaction.execute(sql`UPDATE office.outgoing_documents SET status = 'issued', issued_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
        const recipients = await transaction.execute<{ kind: "user" | "department" | "company"; target_id: string }>(
          sql`SELECT kind, target_id FROM office.outgoing_recipients WHERE outgoing_id = ${id}`,
        );
        const users = new Set<string>();
        for (const recipient of recipients.rows) {
          if (recipient.kind === "user") users.add(recipient.target_id);
          if (recipient.kind === "department") {
            const members = await transaction.execute<{ user_id: string }>(sql`
            SELECT user_id FROM core.user_company_memberships WHERE company_id = ${row.company_id} AND department_id = ${recipient.target_id} AND status = 'active'`);
            for (const member of members.rows) users.add(member.user_id);
          }
          if (recipient.kind === "company") {
            await this.ensureDefaults(transaction, recipient.target_id);
            const company = (await transaction.execute<{ short_name: string }>(sql`SELECT short_name FROM core.companies WHERE id = ${row.company_id}`)).rows[0]!;
            const incoming = await transaction.execute<{ id: string }>(sql`
            INSERT INTO office.incoming_documents (company_id, sender, symbol, document_date, document_type_name, summary, urgency, channel, status, source_outgoing_id)
            VALUES (${recipient.target_id}, ${company.short_name}, ${row.symbol}, ${row.issued_on}, ${row.type_name}, ${row.summary}, ${row.urgency}, 'group', 'awaiting_registration', ${id})
            ON CONFLICT DO NOTHING RETURNING id`);
            if (incoming.rows[0]) {
              copies.push({ companyId: recipient.target_id, incomingId: incoming.rows[0].id });
              // Bản đã ký chép sang công văn đến chờ vào sổ của công ty nhận trong cùng giao dịch (khóa lưu trữ riêng).
              await this.storeFile(transaction, staged, recipient.target_id, "incoming", incoming.rows[0].id, actor.userId, file, true);
            }
          }
        }
        const items: NotificationInput[] = [...users]
          .filter((userId) => userId !== actor.userId)
          .map((userId) => ({
            userId,
            companyId: row.company_id,
            kind: "office_document",
            title: `Công văn ${row.symbol}: ${row.summary}`,
            link: `/office/outgoing/${id}`,
            payload: { outgoingId: id },
          }));
        await notify(transaction, items);
        for (const copy of copies) await this.notifyClerks(transaction, copy.companyId, copy.incomingId, `Công văn đến chờ vào sổ: ${row.symbol}`, `/office/incoming/${copy.incomingId}`);
        await this.auditService.record({ ...this.audit(actor, "office_outgoing"), action: "office.outgoing.issue", entityId: id }, transaction);
      }),
    );
    return this.outgoing(actor, id);
  }

  // Ký số công văn đi (CHUC_NANG_213; API_248): phiên ký từ bản PDF đã cấp số; người ký của công văn ký trước, văn thư đóng chữ ký công ty sau.
  async startOutgoingSigning(actor: Actor, id: string, input: OutgoingDigitalSigningInput, upload: Upload): Promise<OutgoingResponse> {
    await this.requireClerk(actor);
    const row = await this.loadOutgoing(this.database, actor, id);
    if (row.status !== "numbered") throw new ApiError("BUSINESS_RULE", "officeOutgoingLocked");
    if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    const previous = row.signing_request_id ? await this.signing.latestForSource(this.database, row.company_id, "outgoing", id) : null;
    if (previous && ["draft", "signing", "completed"].includes(previous.status)) throw new ApiError("BUSINESS_RULE", "officeOutgoingSigning");
    // Công văn soạn trên hệ thống: dựng bản PDF đã cấp số theo thể thức; công văn soạn bằng tệp: văn thư tải bản PDF đã cấp số.
    let file = upload;
    if (!file) {
      if (row.compose_mode === "upload") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "officeOutgoingPdfRequired" } });
      const rendered = await this.renderOutgoing(actor, id, "pdf");
      file = { buffer: rendered.content, size: rendered.content.length, originalname: rendered.fileName };
    }
    const created = await this.signing.create(
      actor,
      {
        title: `Công văn ${row.symbol}: ${row.summary}`.slice(0, 200),
        note: input.note ?? null,
        dueOn: input.dueOn,
        signers: [
          { kind: "user", userId: row.signer_user_id, signOrder: 1, page: "last", corner: "bottom_right" },
          { kind: "company", signOrder: 2, page: "last", corner: "bottom_right" },
        ],
      },
      file,
      { type: "outgoing", id },
    );
    try {
      await this.signing.send(actor, created.id, created.version);
    } catch (error) {
      // Gửi không được (người ký chưa khai tài khoản ký số, công ty chưa khai chữ ký số…): hủy phiên nháp.
      await this.database.transaction((transaction) => this.signing.cancelForSource(transaction, created.id, actor.userId, "Gửi phiên ký không thành công."));
      throw error;
    }
    await this.database.transaction(async (transaction) => {
      const locked = await this.loadOutgoing(transaction, actor, id, true);
      if (locked.status !== "numbered" || locked.signing_request_id !== row.signing_request_id) {
        await this.signing.cancelForSource(transaction, created.id, actor.userId, "Công văn đã có phiên ký khác.");
        throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      }
      await transaction.execute(sql`UPDATE office.outgoing_documents SET signing_request_id = ${created.id}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...this.audit(actor, "office_outgoing"), action: "office.outgoing.digital_signing", entityId: id, afterData: { signingRequestId: created.id } }, transaction);
    });
    return this.outgoing(actor, id);
  }

  // Tệp PDF, Word theo thể thức; chưa cấp số thì là dự thảo.
  async renderOutgoing(actor: Actor, id: string, format: "pdf" | "docx"): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const row = await this.loadOutgoing(this.database, actor, id);
    const settings = await this.settings(actor);
    const signer = (await peopleById(this.database, [row.signer_user_id], row.company_id)).get(row.signer_user_id)!;
    const internal = await this.recipients(id);
    const archiveDepartment = row.department_code ? `, ${row.department_code.toUpperCase()}` : "";
    const formatted: FormattedDocument = {
      parentOrgName: settings.parentOrgName ?? null,
      companyName: settings.companyDisplayName,
      placeName: settings.placeName,
      fontScheme: settings.fontScheme,
      margins: { top: settings.marginTop, bottom: settings.marginBottom, left: settings.marginLeft, right: settings.marginRight },
      numberText: row.outgoing_no !== null ? padNumber(row.outgoing_no) : null,
      symbolSuffix: row.symbol ? row.symbol.split("/").slice(1).join("/") : this.symbolSuffix(row, settings.companyAbbreviation),
      issuedOn: row.issued_on,
      year: row.year ?? this.year(),
      isOfficialLetter: row.is_official_letter,
      typeName: row.type_name,
      summary: row.summary,
      urgency: row.urgency,
      recipientLine: row.recipient_line,
      body: row.body,
      externalRecipients: [...row.external_recipients, ...internal.map((item) => item.name)],
      archiveLine: `Lưu: VT${archiveDepartment}`,
      signerAuthorityLine: row.signer_authority ? `${row.signer_authority} ${row.signer_authority_of ?? ""}`.trim() : null,
      signerTitle: row.signer_title,
      signerName: signer.fullName,
      drafterLine: row.drafter_code ? `${row.drafter_code}.${padNumber(row.copies)}` : null,
    };
    const base = (row.symbol ?? `du-thao-${row.id.slice(0, 8)}`).replace(/[^\p{L}\p{N}-]+/gu, "-");
    if (format === "pdf") return { fileName: `${base}.pdf`, contentType: "application/pdf", content: await renderDocumentPdf(formatted) };
    return { fileName: `${base}.docx`, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: await renderDocumentWord(formatted) };
  }

  // ===== Xuất sổ ra Excel theo năm, khoảng ngày (QUYTAC_NGHIEPVU_363) =====
  async exportRegister(actor: Actor, registerId: string, year: number): Promise<{ fileName: string; content: Buffer }> {
    await this.requireClerk(actor);
    const register = (
      await this.database.execute<{ name: string; direction: "incoming" | "outgoing" }>(sql`
      SELECT name, direction FROM office.registers WHERE id = ${registerId} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!register) throw new ApiError("NOT_FOUND", "notFound");
    const header = (value: string) => ({ value, fontWeight: "bold" as const });
    let rows: { value: string | number | null; fontWeight?: "bold" }[][];
    if (register.direction === "incoming") {
      const data = (
        await this.database.execute<IncomingRow & { handler_name: string | null }>(sql`
          SELECT x.*, u.full_name AS handler_name FROM (${incomingSelect} WHERE i.register_id = ${registerId} AND i.year = ${year}) x
          LEFT JOIN core.users u ON u.id = x.task_owner ORDER BY x.incoming_no`)
      ).rows;
      rows = [
        ["Số đến", "Ngày đến", "Nơi gửi", "Số ký hiệu", "Ngày văn bản", "Tên loại và trích yếu", "Độ khẩn", "Người nhận xử lý", "Hạn xử lý", "Ghi chú"].map(header),
        ...data.map((row) => [
          { value: row.incoming_no },
          { value: row.received_on },
          { value: row.sender },
          { value: row.symbol },
          { value: row.document_date },
          { value: `${row.document_type_name}: ${row.summary}` },
          { value: urgencyLabel[row.urgency] },
          { value: row.handler_name },
          { value: row.due_on },
          { value: row.status === "voided" ? `Hủy vào sổ: ${row.void_reason}` : null },
        ]),
      ];
    } else {
      const data = (await this.database.execute<OutgoingRow>(sql`${outgoingSelect} WHERE o.register_id = ${registerId} AND o.year = ${year} AND o.outgoing_no IS NOT NULL ORDER BY o.outgoing_no`))
        .rows;
      const people = await peopleById(
        this.database,
        data.map((row) => row.signer_user_id),
        actor.companyId,
      );
      rows = [["Số", "Ký hiệu", "Ngày văn bản", "Tên loại và trích yếu", "Người ký", "Nơi nhận", "Số bản", "Ghi chú"].map(header)];
      for (const row of data) {
        rows.push([
          { value: row.outgoing_no },
          { value: row.symbol },
          { value: row.issued_on },
          { value: `${row.type_name}: ${row.summary}` },
          { value: people.get(row.signer_user_id)?.fullName ?? "" },
          { value: [...row.external_recipients, ...(await this.recipients(row.id)).map((item) => item.name)].join("; ") },
          { value: row.copies },
          { value: row.status === "issued" ? null : "Chưa phát hành" },
        ]);
      }
    }
    const content = await writeExcelFile(rows as never, { sheet: register.name.slice(0, 31) }).toBuffer();
    return { fileName: `${register.name}-${year}.xlsx`, content: Buffer.from(content) };
  }

  // Ngày (giờ Việt Nam) dùng ở giao diện khi chọn mặc định.
  today(): string {
    return day(this.clock.now().toISOString()) ?? this.permissionService.today();
  }
}
