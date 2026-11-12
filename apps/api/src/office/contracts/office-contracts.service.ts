// Kho hợp đồng (CONG_VIEC_59 lát L2; CHUC_NANG_212; QUYTAC_NGHIEPVU_462 đến 467; API_246, API_247).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  OfficeContractAppendixItem,
  OfficeContractFile,
  OfficeContractListItem,
  OfficeContractListResponse,
  OfficeContractOptions,
  OfficeContractPartnerItem,
  OfficeContractResponse,
  OfficeContractSigningInput,
  OfficeContractStatus,
  OfficeContractTypeItem,
  OfficeContractValidity,
  OfficeImportContractInput,
  OfficeLaborContractListItem,
  OfficeSaveAppendixInput,
  OfficeSaveContractInput,
  SignatureCheckItem,
  officeContractListQuerySchema,
  officeContractTypeSchema,
  officeImportAppendixSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApprovalRequestsService } from "../../approvals/approval-requests.service";
import { ApiError, type ErrorMessageKey } from "../../common/api-error";
import { AuditService } from "../../common/audit.service";
import { CLOCK, type Clock } from "../../common/clock";
import { FILE_STORAGE, type FileStorage } from "../../common/file-storage";
import { notify } from "../../common/notifications";
import { OutboxService } from "../../common/outbox.service";
import { DATABASE, type Database } from "../../database/database.module";
import { PermissionService } from "../../permissions/permission.service";
import type { Actor } from "../../permissions/roles.service";
import { NumberSequencesService, periodKey } from "../../settings/number-sequences.service";
import { peopleById } from "../office-access";
import { checkOfficeFile } from "../office-tasks.service";
import { OfficeSigningService, type SigningOutcome } from "../signing/office-signing.service";

type Executor = Pick<Database, "execute">;
type Upload = { buffer: Buffer; size: number; originalname: string } | undefined;
type ContractAction = OfficeContractResponse["allowed"][number];
type AppendixAction = OfficeContractAppendixItem["allowed"][number];

// Loại hợp đồng nạp sẵn cho mỗi công ty (QUYTAC_NGHIEPVU_462).
const defaultTypes: [string, "purchase" | "sale" | "none"][] = [
  ["Mua hàng", "purchase"],
  ["Bán hàng", "sale"],
  ["Dịch vụ", "purchase"],
  ["Thuê", "purchase"],
  ["Hợp tác", "none"],
  ["Bảo mật thông tin", "none"],
  ["Khác", "none"],
];
// Mốc nhắc sau hạn (QUYTAC_NGHIEPVU_467): ngày thứ 1, 8, 15, 22, 29.
const afterMilestones = [1, 8, 15, 22, 29];

const iso = (value: string | Date | null): string | null => (value === null ? null : new Date(value).toISOString());
const dayCount = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

type ContractRow = {
  id: string;
  company_id: string;
  contract_code: string;
  contract_no: string | null;
  name: string;
  type_id: string;
  type_name: string;
  direction: "purchase" | "sale" | "none";
  value: string | null;
  currency: string;
  signed_on: string | null;
  effective_from: string;
  expires_on: string | null;
  owner_user_id: string;
  department_id: string | null;
  department_name: string | null;
  confidential: boolean;
  description: string | null;
  reminder_days: number[];
  content_file_id: string | null;
  signed_file_id: string | null;
  signature_checks: SignatureCheckItem[] | null;
  status: OfficeContractStatus;
  imported: boolean;
  approval_mode: "policy" | "manager" | null;
  approval_request_id: string | null;
  approver_user_ids: string[];
  decision_note: string | null;
  signing_request_id: string | null;
  ended_on: string | null;
  end_reason: string | null;
  end_file_id: string | null;
  cancel_reason: string | null;
  created_by: string;
  created_at: string;
  version: number;
  partner_names: string[] | null;
};

type AppendixRow = {
  id: string;
  contract_id: string;
  appendix_no: string;
  summary: string;
  effective_from: string;
  new_expires_on: string | null;
  new_value: string | null;
  content_file_id: string | null;
  signed_file_id: string | null;
  signed_on: string | null;
  previous_expires_on: string | null;
  previous_value: string | null;
  status: OfficeContractAppendixItem["status"];
  imported: boolean;
  approval_mode: "policy" | "manager" | null;
  approval_request_id: string | null;
  approver_user_ids: string[];
  decision_note: string | null;
  signing_request_id: string | null;
  created_by: string;
  version: number;
};

// Cột ngày đọc dạng chuỗi YYYY-MM-DD để không lệch múi giờ.
const contractColumns = sql`
  c.*, c.signed_on::text AS signed_on, c.effective_from::text AS effective_from, c.expires_on::text AS expires_on, c.ended_on::text AS ended_on, c.value::text AS value,
  t.name AS type_name, t.direction, d.name AS department_name,
  (SELECT array_agg(p.name ORDER BY cp.position) FROM office.contract_partners cp JOIN crm.partners p ON p.id = cp.partner_id WHERE cp.contract_id = c.id) AS partner_names`;
const contractFrom = sql`office.contracts c JOIN office.contract_types t ON t.id = c.type_id LEFT JOIN core.departments d ON d.id = c.department_id`;
const appendixColumns = sql`a.*, a.effective_from::text AS effective_from, a.new_expires_on::text AS new_expires_on, a.signed_on::text AS signed_on,
  a.previous_expires_on::text AS previous_expires_on, a.new_value::text AS new_value, a.previous_value::text AS previous_value`;

@Injectable()
export class OfficeContractsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly permissionService: PermissionService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly signing: OfficeSigningService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit(): void {
    // Luồng duyệt chung xong (QUYTAC_NGHIEPVU_464): duyệt → chờ ký; từ chối, rút → sửa, trình lại.
    this.outbox.subscribe("core.approval.completed", async (event) => {
      const type = String(event.payload.documentTypeCode);
      if (type !== "office.contract" && type !== "office.contract_appendix") return;
      const status = String(event.payload.status);
      const next = status === "approved" ? "awaiting_signature" : status === "rejected" ? "rejected" : status === "withdrawn" ? "withdrawn" : null;
      if (!next) return;
      await this.database.transaction(async (transaction) => {
        const table = type === "office.contract" ? sql`office.contracts` : sql`office.contract_appendices`;
        const updated = await transaction.execute<{ id: string }>(sql`
          UPDATE ${table} SET status = ${next}, version = version + 1 WHERE id = ${String(event.payload.documentId)} AND status = 'pending' AND approval_mode = 'policy' RETURNING id`);
        if (updated.rows.length === 0) return;
        const contractId = type === "office.contract" ? String(event.payload.documentId) : await this.contractOfAppendix(transaction, String(event.payload.documentId));
        await this.afterDecision(transaction, contractId, type === "office.contract" ? null : String(event.payload.documentId), next, null);
      });
    });
    // Phiên ký của hợp đồng, phụ lục kết thúc (QUYTAC_NGHIEPVU_464, 465).
    this.signing.outcomeHooks.push((executor, outcome) => this.signingOutcome(executor, outcome));
  }

  private businessRule(key: ErrorMessageKey): ApiError {
    return new ApiError("BUSINESS_RULE", key);
  }

  private today(): string {
    return this.permissionService.today();
  }

  private async granted(actor: Actor, companyId = actor.companyId): Promise<Set<string>> {
    return this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId });
  }

  private audit(actor: Actor, entityType: string) {
    return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "office", entityType, ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
  }

  private async event(executor: Executor, contractId: string, actorUserId: string | null, kind: string, detail: Record<string, unknown> = {}): Promise<void> {
    await executor.execute(sql`INSERT INTO office.contract_events (contract_id, actor_user_id, kind, detail) VALUES (${contractId}, ${actorUserId}, ${kind}, ${JSON.stringify(detail)}::jsonb)`);
  }

  private async permissionHolders(executor: Executor, companyId: string, permission: string): Promise<string[]> {
    const today = this.today();
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

  // ---------- Loại hợp đồng, tùy chọn (API_247; QUYTAC_NGHIEPVU_462) ----------

  private async ensureTypes(executor: Executor, companyId: string): Promise<void> {
    const existing = await executor.execute(sql`SELECT 1 FROM office.contract_types WHERE company_id = ${companyId} LIMIT 1`);
    if (existing.rows.length > 0) return;
    let order = 0;
    for (const [name, direction] of defaultTypes) {
      order += 10;
      await executor.execute(sql`
        INSERT INTO office.contract_types (company_id, name, direction, sort_order) VALUES (${companyId}, ${name}, ${direction}, ${order}) ON CONFLICT DO NOTHING`);
    }
  }

  async types(actor: Actor): Promise<OfficeContractTypeItem[]> {
    await this.ensureTypes(this.database, actor.companyId);
    const rows = await this.database.execute<{ id: string; name: string; direction: OfficeContractTypeItem["direction"]; status: OfficeContractTypeItem["status"] }>(sql`
      SELECT id, name, direction, status FROM office.contract_types WHERE company_id = ${actor.companyId} ORDER BY sort_order, name`);
    return rows.rows;
  }

  async createType(actor: Actor, input: z.infer<typeof officeContractTypeSchema>): Promise<OfficeContractTypeItem[]> {
    await this.requirePermission(actor, "office.contract.manage");
    await this.ensureTypes(this.database, actor.companyId);
    const duplicate = await this.database.execute(sql`SELECT 1 FROM office.contract_types WHERE company_id = ${actor.companyId} AND lower(name) = lower(${input.name})`);
    if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "contractTypeDuplicate" } });
    await this.database.execute(sql`INSERT INTO office.contract_types (company_id, name, direction, status) VALUES (${actor.companyId}, ${input.name}, ${input.direction}, ${input.status})`);
    return this.types(actor);
  }

  async updateType(actor: Actor, id: string, input: z.infer<typeof officeContractTypeSchema>): Promise<OfficeContractTypeItem[]> {
    await this.requirePermission(actor, "office.contract.manage");
    const duplicate = await this.database.execute(sql`SELECT 1 FROM office.contract_types WHERE company_id = ${actor.companyId} AND lower(name) = lower(${input.name}) AND id <> ${id}`);
    if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "contractTypeDuplicate" } });
    const updated = await this.database.execute(sql`
      UPDATE office.contract_types SET name = ${input.name}, direction = ${input.direction}, status = ${input.status} WHERE id = ${id} AND company_id = ${actor.companyId} RETURNING id`);
    if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    return this.types(actor);
  }

  private async requirePermission(actor: Actor, permission: string): Promise<void> {
    if (!(await this.granted(actor)).has(permission)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  async options(actor: Actor): Promise<OfficeContractOptions> {
    const granted = await this.granted(actor);
    const departments = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM core.departments WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY name`);
    const currencies = await this.database.execute<{ code: string }>(sql`SELECT code FROM core.currencies WHERE is_active ORDER BY (code = 'VND') DESC, code`);
    return {
      types: (await this.types(actor)).filter((type) => type.status === "active"),
      departments: departments.rows,
      currencies: currencies.rows.map((row) => row.code),
      canManage: granted.has("office.contract.manage"),
      canCreate: granted.has("office.contract.create"),
      canViewAll: granted.has("office.contract.view_all"),
      canViewLabor: granted.has("hr.contract.manage"),
    };
  }

  // Đối tác từ danh sách đối tác dùng chung (crm.partners): tên, mã số thuế, thư điện tử; không trả số định danh cá nhân.
  async partners(actor: Actor, search: string): Promise<OfficeContractPartnerItem[]> {
    const granted = await this.granted(actor);
    if (!granted.has("office.contract.create") && !granted.has("office.contract.manage")) throw new ApiError("FORBIDDEN", "forbidden");
    const pattern = `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
    const rows = await this.database.execute<{ id: string; name: string; kind: OfficeContractPartnerItem["kind"]; tax_code: string | null; email: string | null }>(sql`
      SELECT id, name, kind, tax_code, email FROM crm.partners WHERE status = 'active' AND (name ILIKE ${pattern} OR tax_code ILIKE ${pattern} OR code ILIKE ${pattern})
      ORDER BY name LIMIT 20`);
    return rows.rows.map((row) => ({ id: row.id, name: row.name, kind: row.kind, taxCode: row.tax_code, email: row.email }));
  }

  // ---------- Quyền xem (QUYTAC_NGHIEPVU_466) ----------

  // Người liên quan: người lập, phụ trách, duyệt (hợp đồng, phụ lục), người ký nội bộ của phiên ký, người được chia sẻ.
  private relatedCondition(userId: string): SQL {
    return sql`(c.created_by = ${userId} OR c.owner_user_id = ${userId} OR ${userId} = ANY(c.approver_user_ids)
      OR EXISTS (SELECT 1 FROM office.contract_shares sh WHERE sh.contract_id = c.id AND sh.user_id = ${userId})
      OR EXISTS (SELECT 1 FROM core.approval_steps st WHERE st.request_id = c.approval_request_id AND (st.assigned_user_id = ${userId} OR st.decided_by = ${userId}))
      OR EXISTS (SELECT 1 FROM office.contract_appendices ap WHERE ap.contract_id = c.id AND (${userId} = ANY(ap.approver_user_ids)
        OR EXISTS (SELECT 1 FROM core.approval_steps st2 WHERE st2.request_id = ap.approval_request_id AND (st2.assigned_user_id = ${userId} OR st2.decided_by = ${userId}))))
      OR EXISTS (SELECT 1 FROM office.signing_requests r JOIN office.signing_signers s ON s.request_id = r.id
        WHERE s.user_id = ${userId} AND ((r.source_type = 'contract' AND r.source_id = c.id)
          OR (r.source_type = 'contract_appendix' AND r.source_id IN (SELECT ap2.id FROM office.contract_appendices ap2 WHERE ap2.contract_id = c.id)))))`;
  }

  private async visibleCondition(actor: Actor): Promise<SQL> {
    const viewAll = (await this.granted(actor)).has("office.contract.view_all");
    return sql`c.company_id = ${actor.companyId} AND (${this.relatedCondition(actor.userId)} ${viewAll ? sql`OR NOT c.confidential` : sql``})`;
  }

  private validity(row: { status: OfficeContractStatus; effective_from: string; expires_on: string | null; reminder_days: number[] }): OfficeContractValidity | null {
    if (row.status !== "signed") return null;
    const today = this.today();
    if (today < row.effective_from) return "not_effective";
    if (!row.expires_on) return "active";
    if (today > row.expires_on) return "expired";
    return dayCount(today, row.expires_on) <= Math.max(...row.reminder_days) ? "expiring" : "active";
  }

  private async listItem(row: ContractRow, people: Map<string, OfficeContractResponse["owner"]>): Promise<OfficeContractListItem> {
    return {
      id: row.id,
      contractCode: row.contract_code,
      contractNo: row.contract_no,
      name: row.name,
      typeName: row.type_name,
      direction: row.direction,
      partners: row.partner_names ?? [],
      value: row.value,
      currency: row.currency,
      effectiveFrom: row.effective_from,
      expiresOn: row.expires_on,
      status: row.status,
      validity: this.validity(row),
      confidential: row.confidential,
      owner: people.get(row.owner_user_id) ?? { id: row.owner_user_id, fullName: "", companyId: null, companyName: null, departmentName: null },
    };
  }

  async list(actor: Actor, query: z.infer<typeof officeContractListQuerySchema>): Promise<OfficeContractListResponse> {
    const pageSize = 20;
    const visible = await this.visibleCondition(actor);
    const today = this.today();
    const conditions: SQL[] = [visible];
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(c.contract_code ILIKE ${pattern} OR c.contract_no ILIKE ${pattern} OR c.name ILIKE ${pattern}
        OR EXISTS (SELECT 1 FROM office.contract_partners cp JOIN crm.partners p ON p.id = cp.partner_id WHERE cp.contract_id = c.id AND (p.name ILIKE ${pattern} OR p.tax_code ILIKE ${pattern})))`);
    }
    if (query.typeId) conditions.push(sql`c.type_id = ${query.typeId}`);
    if (query.status) conditions.push(sql`c.status = ${query.status}`);
    if (query.mine === "true") conditions.push(sql`c.owner_user_id = ${actor.userId}`);
    if (query.expiresFrom) conditions.push(sql`c.expires_on >= ${query.expiresFrom}::date`);
    if (query.expiresTo) conditions.push(sql`c.expires_on <= ${query.expiresTo}::date`);
    const expiringCondition = sql`(c.status = 'signed' AND c.effective_from <= ${today}::date AND c.expires_on >= ${today}::date
      AND c.expires_on - ${today}::date <= (SELECT max(x) FROM unnest(c.reminder_days) x))`;
    if (query.validity === "not_effective") conditions.push(sql`c.status = 'signed' AND c.effective_from > ${today}::date`);
    if (query.validity === "expired") conditions.push(sql`c.status = 'signed' AND c.expires_on < ${today}::date`);
    if (query.validity === "expiring") conditions.push(expiringCondition);
    if (query.validity === "active")
      conditions.push(sql`c.status = 'signed' AND c.effective_from <= ${today}::date AND (c.expires_on IS NULL OR c.expires_on >= ${today}::date) AND NOT ${expiringCondition}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM ${contractFrom} WHERE ${where}`)).rows[0]?.count ?? 0;
    const rows = await this.database.execute<ContractRow>(sql`
      SELECT ${contractColumns} FROM ${contractFrom} WHERE ${where} ORDER BY c.expires_on NULLS LAST, c.created_at DESC LIMIT ${pageSize} OFFSET ${(query.page - 1) * pageSize}`);
    const summary = (
      await this.database.execute<{ active: number; expiring: number; expired_open: number; in_progress: number }>(sql`
        SELECT count(*) FILTER (WHERE c.status = 'signed' AND c.effective_from <= ${today}::date AND (c.expires_on IS NULL OR c.expires_on >= ${today}::date))::int AS active,
          count(*) FILTER (WHERE ${expiringCondition})::int AS expiring,
          count(*) FILTER (WHERE c.status = 'signed' AND c.expires_on < ${today}::date)::int AS expired_open,
          count(*) FILTER (WHERE c.status IN ('pending', 'awaiting_signature'))::int AS in_progress
        FROM ${contractFrom} WHERE ${visible}`)
    ).rows[0]!;
    const people = await peopleById(
      this.database,
      rows.rows.map((row) => row.owner_user_id),
      actor.companyId,
    );
    const granted = await this.granted(actor);
    let laborContracts: OfficeLaborContractListItem[] | null = null;
    if (granted.has("hr.contract.manage") && query.includeLabor !== "false" && !query.typeId) {
      const labor = await this.database.execute<{
        id: string;
        document_no: string;
        full_name: string;
        kind: OfficeLaborContractListItem["kind"];
        effective_date: string;
        end_date: string | null;
        status: string;
      }>(sql`
        SELECT hc.id, hc.document_no, e.full_name, hc.kind, hc.effective_date::text AS effective_date, hc.end_date::text AS end_date, hc.status
        FROM hr.contracts hc JOIN hr.employees e ON e.id = hc.employee_id
        WHERE hc.company_id = ${actor.companyId} AND hc.status IN ('signed', 'terminated')
          ${query.search ? sql`AND (hc.document_no ILIKE ${`%${query.search}%`} OR e.full_name ILIKE ${`%${query.search}%`})` : sql``}
        ORDER BY hc.end_date NULLS LAST LIMIT 50`);
      laborContracts = labor.rows.map((row) => ({
        id: row.id,
        documentNo: row.document_no,
        employeeName: row.full_name,
        kind: row.kind,
        effectiveDate: row.effective_date,
        endDate: row.end_date,
        status: row.status,
        validity: row.status !== "signed" ? null : this.validity({ status: "signed", effective_from: row.effective_date, expires_on: row.end_date, reminder_days: [30] }),
      }));
    }
    return {
      items: await Promise.all(rows.rows.map((row) => this.listItem(row, people))),
      total,
      page: query.page,
      pageSize,
      summary: { active: summary.active, expiring: summary.expiring, expiredOpen: summary.expired_open, inProgress: summary.in_progress },
      laborContracts,
    };
  }

  // Đọc hợp đồng người xem được; khóa dòng khi cần ghi. Người không xem được nhận 404.
  private async load(executor: Executor, actor: Actor, id: string, lock: boolean): Promise<ContractRow> {
    const visible = await this.visibleCondition(actor);
    const row = (await executor.execute<ContractRow>(sql`SELECT ${contractColumns} FROM ${contractFrom} WHERE c.id = ${id} AND ${visible} ${lock ? sql`FOR UPDATE OF c` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async isManager(actor: Actor, row: { company_id: string }): Promise<boolean> {
    return (await this.granted(actor, row.company_id)).has("office.contract.manage");
  }

  private async contractAllowed(actor: Actor, row: ContractRow): Promise<ContractAction[]> {
    const manager = await this.isManager(actor, row);
    const responsible = row.owner_user_id === actor.userId || row.created_by === actor.userId || manager;
    const allowed: ContractAction[] = [];
    if (responsible && ["draft", "rejected", "withdrawn"].includes(row.status)) allowed.push("edit", "submit");
    if ((row.owner_user_id === actor.userId || row.created_by === actor.userId) && row.status === "pending") allowed.push("withdraw");
    if (row.status === "pending" && row.approval_mode === "manager" && row.approver_user_ids.includes(actor.userId)) allowed.push("decide");
    if (responsible && row.status === "awaiting_signature" && !row.signing_request_id) allowed.push("signing");
    if (responsible && ["draft", "rejected", "withdrawn", "awaiting_signature"].includes(row.status)) allowed.push("cancel");
    if ((row.owner_user_id === actor.userId || manager) && row.status === "signed") allowed.push("end", "appendix", "update_signed");
    if (row.owner_user_id === actor.userId || manager) allowed.push("share");
    if (responsible && !["cancelled"].includes(row.status)) allowed.push("attach");
    return allowed;
  }

  async get(actor: Actor, id: string): Promise<OfficeContractResponse> {
    const row = await this.load(this.database, actor, id, false);
    const partners = await this.database.execute<{ id: string; name: string; kind: OfficeContractPartnerItem["kind"]; tax_code: string | null; email: string | null }>(sql`
      SELECT p.id, p.name, p.kind, p.tax_code, p.email FROM office.contract_partners cp JOIN crm.partners p ON p.id = cp.partner_id WHERE cp.contract_id = ${id} ORDER BY cp.position`);
    const files = await this.database.execute<{ id: string; file_name: string; size_bytes: number; created_at: string }>(sql`
      SELECT id, file_name, size_bytes, created_at FROM office.files WHERE deleted_at IS NULL
        AND (id IN (${row.content_file_id ?? randomUUID()}, ${row.signed_file_id ?? randomUUID()}, ${row.end_file_id ?? randomUUID()}) OR (owner_type = 'contract' AND owner_id = ${id}))
      ORDER BY created_at`);
    const fileRole = (fileId: string): OfficeContractFile["role"] =>
      fileId === row.signed_file_id ? "signed" : fileId === row.content_file_id ? "content" : fileId === row.end_file_id ? "end" : "attachment";
    const appendices = await this.database.execute<AppendixRow>(sql`SELECT ${appendixColumns} FROM office.contract_appendices a WHERE a.contract_id = ${id} ORDER BY a.created_at`);
    const shares = await this.database.execute<{ user_id: string }>(sql`SELECT user_id FROM office.contract_shares WHERE contract_id = ${id} ORDER BY created_at`);
    const events = await this.database.execute<{ id: string; actor_user_id: string | null; kind: string; detail: Record<string, unknown>; created_at: string }>(sql`
      SELECT id, actor_user_id, kind, detail, created_at FROM office.contract_events WHERE contract_id = ${id} ORDER BY created_at DESC, id`);
    const people = await peopleById(
      this.database,
      [row.owner_user_id, row.created_by, ...row.approver_user_ids, ...shares.rows.map((share) => share.user_id), ...events.rows.map((event) => event.actor_user_id ?? "")],
      row.company_id,
    );
    const person = (userId: string) => people.get(userId) ?? { id: userId, fullName: "", companyId: null, companyName: null, departmentName: null };
    const viewReasons: string[] = [];
    if (row.owner_user_id === actor.userId) viewReasons.push("owner");
    if (row.created_by === actor.userId) viewReasons.push("creator");
    if (shares.rows.some((share) => share.user_id === actor.userId)) viewReasons.push("shared");
    if (row.approver_user_ids.includes(actor.userId)) viewReasons.push("approver");
    if (viewReasons.length === 0) viewReasons.push(row.confidential ? "related" : "view_all");
    // Xem chi tiết hợp đồng mật ghi nhật ký thao tác (QUYTAC_NGHIEPVU_466).
    if (row.confidential) await this.auditService.record({ ...this.audit(actor, "office_contract"), action: "office.contract.view", entityId: id });
    const manager = await this.isManager(actor, row);
    return {
      ...(await this.listItem(row, people)),
      companyId: row.company_id,
      typeId: row.type_id,
      partnerItems: partners.rows.map((partner) => ({ id: partner.id, name: partner.name, kind: partner.kind, taxCode: partner.tax_code, email: partner.email })),
      departmentId: row.department_id,
      departmentName: row.department_name,
      description: row.description,
      reminderDays: row.reminder_days,
      signedOn: row.signed_on,
      imported: row.imported,
      approvalMode: row.approval_mode,
      approvalRequestId: row.approval_request_id,
      approvers: row.approver_user_ids.map(person),
      decisionNote: row.decision_note,
      signingRequestId: row.signing_request_id,
      signatureChecks: row.signature_checks,
      endedOn: row.ended_on,
      endReason: row.end_reason,
      cancelReason: row.cancel_reason,
      files: files.rows.map((file) => ({ id: file.id, fileName: file.file_name, sizeBytes: file.size_bytes, role: fileRole(file.id), createdAt: iso(file.created_at)! })),
      appendices: appendices.rows.map((appendix) => this.appendixItem(actor, row, appendix, manager)),
      shares: shares.rows.map((share) => person(share.user_id)),
      viewReasons,
      events: events.rows.map((event) => ({
        id: event.id,
        actor: event.actor_user_id ? person(event.actor_user_id) : null,
        kind: event.kind,
        detail: event.detail,
        createdAt: iso(event.created_at)!,
      })),
      createdBy: person(row.created_by),
      createdAt: iso(row.created_at)!,
      version: row.version,
      allowed: await this.contractAllowed(actor, row),
    };
  }

  private appendixItem(actor: Actor, contract: ContractRow, row: AppendixRow, manager: boolean): OfficeContractAppendixItem {
    const responsible = contract.owner_user_id === actor.userId || row.created_by === actor.userId || manager;
    const allowed: AppendixAction[] = [];
    if (contract.status === "signed") {
      if (responsible && ["draft", "rejected", "withdrawn"].includes(row.status)) allowed.push("edit", "submit", "cancel");
      if ((contract.owner_user_id === actor.userId || row.created_by === actor.userId) && row.status === "pending") allowed.push("withdraw");
      if (row.status === "pending" && row.approval_mode === "manager" && row.approver_user_ids.includes(actor.userId)) allowed.push("decide");
      if (responsible && row.status === "awaiting_signature" && !row.signing_request_id) allowed.push("signing", "cancel");
    }
    return {
      id: row.id,
      appendixNo: row.appendix_no,
      summary: row.summary,
      effectiveFrom: row.effective_from,
      newExpiresOn: row.new_expires_on,
      newValue: row.new_value,
      previousExpiresOn: row.previous_expires_on,
      previousValue: row.previous_value,
      status: row.status,
      signedOn: row.signed_on,
      imported: row.imported,
      signingRequestId: row.signing_request_id,
      approvalRequestId: row.approval_request_id,
      decisionNote: row.decision_note,
      contentFileId: row.content_file_id,
      signedFileId: row.signed_file_id,
      allowed,
      version: row.version,
    };
  }

  // ---------- Lập, sửa, nhập hợp đồng (QUYTAC_NGHIEPVU_463, 465) ----------

  private checkPdf(file: Upload, field = "file"): void {
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "required" } });
    if (file.buffer.subarray(0, 4).toString("latin1") !== "%PDF") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "signingPdfInvalid" } });
  }

  private async storeFile(executor: Executor, companyId: string, ownerType: "contract" | "contract_appendix", ownerId: string, file: NonNullable<Upload>, userId: string): Promise<string> {
    const checked = checkOfficeFile(file);
    const fileId = randomUUID();
    const storageKey = `office/${companyId}/contracts/${ownerId}/${fileId}`;
    await this.storage.put(storageKey, file.buffer, checked.contentType);
    await executor.execute(sql`
      INSERT INTO office.files (id, company_id, owner_type, owner_id, file_name, content_type, size_bytes, storage_key, uploaded_by)
      VALUES (${fileId}, ${companyId}, ${ownerType}, ${ownerId}, ${checked.fileName}, ${checked.contentType}, ${file.size}, ${storageKey}, ${userId})`);
    return fileId;
  }

  // Kiểm loại, đối tác, người phụ trách, phòng ban thuộc công ty.
  private async checkFields(executor: Executor, actor: Actor, input: OfficeSaveContractInput | OfficeImportContractInput): Promise<{ ownerId: string; direction: string }> {
    const type = (
      await executor.execute<{ direction: string; status: string }>(sql`SELECT direction, status FROM office.contract_types WHERE id = ${input.typeId} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!type || type.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { typeId: "notFound" } });
    if (type.direction === "none" && input.value) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { value: "contractValueNotAllowed" } });
    const partners = await executor.execute<{ id: string }>(
      sql`SELECT id FROM crm.partners WHERE status = 'active' AND id IN (${sql.join(
        input.partnerIds.map((partnerId) => sql`${partnerId}::uuid`),
        sql`, `,
      )})`,
    );
    if (new Set(input.partnerIds).size !== input.partnerIds.length || partners.rows.length !== input.partnerIds.length)
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { partnerIds: "notFound" } });
    const ownerId = input.ownerUserId ?? actor.userId;
    const member = await executor.execute(sql`
      SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id WHERE m.user_id = ${ownerId} AND m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status = 'active'`);
    if (member.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { ownerUserId: "notFound" } });
    if (input.departmentId) {
      const department = await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId}`);
      if (department.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { departmentId: "notFound" } });
    }
    const currency = await executor.execute(sql`SELECT 1 FROM core.currencies WHERE code = ${input.currency}`);
    if (currency.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { currency: "notFound" } });
    return { ownerId, direction: type.direction };
  }

  private async setPartners(executor: Executor, contractId: string, partnerIds: string[]): Promise<void> {
    await executor.execute(sql`DELETE FROM office.contract_partners WHERE contract_id = ${contractId}`);
    let position = 0;
    for (const partnerId of partnerIds) {
      position += 1;
      await executor.execute(sql`INSERT INTO office.contract_partners (contract_id, partner_id, position) VALUES (${contractId}, ${partnerId}, ${position})`);
    }
  }

  private async nextCode(executor: Executor, companyId: string): Promise<string> {
    await executor.execute(sql`
      INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
      SELECT ${companyId}, 'office.contract', ${periodKey("year", this.today())}, 'HD', 'year', 5, 1
      WHERE NOT EXISTS (SELECT 1 FROM core.number_sequences WHERE company_id = ${companyId} AND document_type_code = 'office.contract')
      ON CONFLICT DO NOTHING`);
    return this.sequences.next(companyId, "office.contract", executor);
  }

  // Cảnh báo không chặn khi trùng số hợp đồng trong công ty.
  private async duplicateNo(executor: Executor, companyId: string, contractNo: string | null | undefined, exceptId: string | null): Promise<boolean> {
    if (!contractNo) return false;
    const rows = await executor.execute(sql`
      SELECT 1 FROM office.contracts WHERE company_id = ${companyId} AND lower(contract_no) = lower(${contractNo}) AND status <> 'cancelled' ${exceptId ? sql`AND id <> ${exceptId}` : sql``} LIMIT 1`);
    return rows.rows.length > 0;
  }

  async create(actor: Actor, input: OfficeSaveContractInput, file: Upload): Promise<OfficeContractResponse & { duplicateNo: boolean }> {
    await this.requirePermission(actor, "office.contract.create");
    if (file) this.checkPdf(file);
    await this.ensureTypes(this.database, actor.companyId);
    const id = randomUUID();
    let duplicate = false;
    await this.database.transaction(async (transaction) => {
      const { ownerId } = await this.checkFields(transaction, actor, input);
      duplicate = await this.duplicateNo(transaction, actor.companyId, input.contractNo, null);
      const code = await this.nextCode(transaction, actor.companyId);
      await transaction.execute(sql`
        INSERT INTO office.contracts (id, company_id, contract_code, contract_no, name, type_id, value, currency, effective_from, expires_on, owner_user_id, department_id, confidential, description, reminder_days, created_by)
        VALUES (${id}, ${actor.companyId}, ${code}, ${input.contractNo ?? null}, ${input.name}, ${input.typeId}, ${input.value ?? null}, ${input.currency}, ${input.effectiveFrom}, ${input.expiresOn ?? null},
          ${ownerId}, ${input.departmentId ?? null}, ${input.confidential}, ${input.description ?? null}, ${sql`ARRAY[${sql.join(
            input.reminderDays.map((day) => sql`${day}`),
            sql`, `,
          )}]::int[]`}, ${actor.userId})`);
      await this.setPartners(transaction, id, input.partnerIds);
      if (file) {
        const fileId = await this.storeFile(transaction, actor.companyId, "contract", id, file, actor.userId);
        await transaction.execute(sql`UPDATE office.contracts SET content_file_id = ${fileId} WHERE id = ${id}`);
      }
      await this.event(transaction, id, actor.userId, "created");
      await this.auditService.record({ ...this.audit(actor, "office_contract"), action: "office.contract.create", entityId: id }, transaction);
    });
    return { ...(await this.get(actor, id)), duplicateNo: duplicate };
  }

  async update(actor: Actor, id: string, input: OfficeSaveContractInput, file: Upload): Promise<OfficeContractResponse & { duplicateNo: boolean }> {
    if (file) this.checkPdf(file);
    let duplicate = false;
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("edit")) throw this.businessRule("contractStatusInvalid");
      if (input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const { ownerId } = await this.checkFields(transaction, actor, input);
      duplicate = await this.duplicateNo(transaction, row.company_id, input.contractNo, id);
      await transaction.execute(sql`
        UPDATE office.contracts SET contract_no = ${input.contractNo ?? null}, name = ${input.name}, type_id = ${input.typeId}, value = ${input.value ?? null}, currency = ${input.currency},
          effective_from = ${input.effectiveFrom}, expires_on = ${input.expiresOn ?? null}, owner_user_id = ${ownerId}, department_id = ${input.departmentId ?? null},
          confidential = ${input.confidential}, description = ${input.description ?? null},
          reminder_days = ${sql`ARRAY[${sql.join(
            input.reminderDays.map((day) => sql`${day}`),
            sql`, `,
          )}]::int[]`}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.setPartners(transaction, id, input.partnerIds);
      if (file) {
        const fileId = await this.storeFile(transaction, row.company_id, "contract", id, file, actor.userId);
        await transaction.execute(sql`UPDATE office.contracts SET content_file_id = ${fileId} WHERE id = ${id}`);
      }
      await this.event(transaction, id, actor.userId, "updated");
    });
    return { ...(await this.get(actor, id)), duplicateNo: duplicate };
  }

  // Nhập hợp đồng đã ký: đã ký ngay, không qua duyệt; tệp PDF có chữ ký số thì lưu kết quả kiểm tra (QUYTAC_NGHIEPVU_465).
  async importSigned(actor: Actor, input: OfficeImportContractInput, file: Upload): Promise<OfficeContractResponse & { duplicateNo: boolean }> {
    await this.requirePermission(actor, "office.contract.create");
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (input.signedOn > this.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signedOn: "contractSignedOnFuture" } });
    await this.ensureTypes(this.database, actor.companyId);
    const checks = file.buffer.subarray(0, 4).toString("latin1") === "%PDF" ? await this.signing.checkSignatures(actor.companyId, file.buffer) : [];
    const id = randomUUID();
    let duplicate = false;
    await this.database.transaction(async (transaction) => {
      const { ownerId } = await this.checkFields(transaction, actor, input);
      duplicate = await this.duplicateNo(transaction, actor.companyId, input.contractNo, null);
      const code = await this.nextCode(transaction, actor.companyId);
      const fileId = randomUUID();
      await transaction.execute(sql`
        INSERT INTO office.contracts (id, company_id, contract_code, contract_no, name, type_id, value, currency, effective_from, expires_on, owner_user_id, department_id, confidential, description,
          reminder_days, created_by, status, imported, signed_on, signed_file_id, signature_checks)
        VALUES (${id}, ${actor.companyId}, ${code}, ${input.contractNo ?? null}, ${input.name}, ${input.typeId}, ${input.value ?? null}, ${input.currency}, ${input.effectiveFrom}, ${input.expiresOn ?? null},
          ${ownerId}, ${input.departmentId ?? null}, ${input.confidential}, ${input.description ?? null}, ${sql`ARRAY[${sql.join(
            input.reminderDays.map((day) => sql`${day}`),
            sql`, `,
          )}]::int[]`}, ${actor.userId}, 'signed', true, ${input.signedOn}, ${fileId}, ${checks.length ? JSON.stringify(checks) : null}::jsonb)`);
      const stored = await this.storeFile(transaction, actor.companyId, "contract", id, file, actor.userId);
      await transaction.execute(sql`UPDATE office.contracts SET signed_file_id = ${stored} WHERE id = ${id}`);
      await this.setPartners(transaction, id, input.partnerIds);
      await this.event(transaction, id, actor.userId, "imported", { signatures: checks.length });
      await this.auditService.record({ ...this.audit(actor, "office_contract"), action: "office.contract.import", entityId: id }, transaction);
    });
    return { ...(await this.get(actor, id)), duplicateNo: duplicate };
  }

  async updateSigned(actor: Actor, id: string, input: { ownerUserId: string; departmentId?: string | null | undefined; reminderDays: number[]; version: number }): Promise<OfficeContractResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("update_signed")) throw this.businessRule("contractStatusInvalid");
      if (input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const member = await transaction.execute(sql`
        SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id WHERE m.user_id = ${input.ownerUserId} AND m.company_id = ${row.company_id} AND m.status = 'active' AND u.status = 'active'`);
      if (member.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { ownerUserId: "notFound" } });
      await transaction.execute(sql`
        UPDATE office.contracts SET owner_user_id = ${input.ownerUserId}, department_id = ${input.departmentId ?? null},
          reminder_days = ${sql`ARRAY[${sql.join(
            input.reminderDays.map((day) => sql`${day}`),
            sql`, `,
          )}]::int[]`}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, "updated_signed", { ownerUserId: input.ownerUserId, reminderDays: input.reminderDays });
    });
    return this.get(actor, id);
  }

  async attach(actor: Actor, id: string, file: Upload): Promise<OfficeContractResponse> {
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("attach")) throw this.businessRule("contractStatusInvalid");
      await this.storeFile(transaction, row.company_id, "contract", id, file, actor.userId);
      await this.event(transaction, id, actor.userId, "file_added", { fileName: Buffer.from(file.originalname, "latin1").toString("utf8") });
    });
    return this.get(actor, id);
  }

  async file(actor: Actor, id: string, fileId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const row = await this.load(this.database, actor, id, false);
    const appendixFiles = await this.database.execute<{ content_file_id: string | null; signed_file_id: string | null }>(sql`
      SELECT content_file_id, signed_file_id FROM office.contract_appendices WHERE contract_id = ${id}`);
    const allowedIds = new Set([row.content_file_id, row.signed_file_id, row.end_file_id, ...appendixFiles.rows.flatMap((item) => [item.content_file_id, item.signed_file_id])].filter(Boolean));
    const file = (
      await this.database.execute<{ file_name: string; content_type: string; storage_key: string; owner_type: string; owner_id: string }>(sql`
        SELECT file_name, content_type, storage_key, owner_type, owner_id FROM office.files WHERE id = ${fileId} AND deleted_at IS NULL`)
    ).rows[0];
    if (!file || !(allowedIds.has(fileId) || (file.owner_type === "contract" && file.owner_id === id))) throw new ApiError("NOT_FOUND", "notFound");
    if (row.confidential) await this.auditService.record({ ...this.audit(actor, "office_contract"), action: "office.contract.download", entityId: id, afterData: { fileId } });
    return { fileName: file.file_name, contentType: file.content_type, content: await this.storage.get(file.storage_key) };
  }

  // ---------- Duyệt (QUYTAC_NGHIEPVU_464) ----------

  // Người duyệt khi công ty chưa có chính sách duyệt: trưởng phòng của người phụ trách; không có thì người có quyền quản lý hợp đồng.
  private async defaultApprovers(executor: Executor, companyId: string, ownerId: string): Promise<string[]> {
    const manager = (
      await executor.execute<{ manager_user_id: string | null }>(sql`
        SELECT d.manager_user_id FROM core.user_company_memberships m JOIN core.departments d ON d.id = m.department_id
        JOIN core.users u ON u.id = d.manager_user_id AND u.status = 'active'
        WHERE m.user_id = ${ownerId} AND m.company_id = ${companyId} AND m.status = 'active'`)
    ).rows[0]?.manager_user_id;
    if (manager && manager !== ownerId) return [manager];
    const holders = (await this.permissionHolders(executor, companyId, "office.contract.manage")).filter((userId) => userId !== ownerId);
    if (holders.length === 0) throw this.businessRule("contractNoApprover");
    return holders;
  }

  private async submitApproval(
    executor: Pick<Database, "execute" | "insert">,
    actor: Actor,
    kind: "office.contract" | "office.contract_appendix",
    target: { id: string; company_id: string; owner: string; code: string; amount: string | null; currency: string; title: string; contractId: string },
  ): Promise<void> {
    const today = this.today();
    const policy = await executor.execute(sql`
      SELECT 1 FROM core.approval_policies WHERE company_id = ${target.company_id} AND document_type_code = ${kind}
        AND effective_from <= ${today}::date AND (effective_to IS NULL OR effective_to >= ${today}::date)`);
    const table = kind === "office.contract" ? sql`office.contracts` : sql`office.contract_appendices`;
    if (policy.rows.length > 0) {
      const requestId = await this.approvals.submitWithin(executor, target.company_id, actor.userId, {
        documentTypeCode: kind,
        documentId: target.id,
        documentNo: target.code,
        amount: target.amount ?? "0",
        currency: target.currency,
        documentDate: today,
      });
      await executor.execute(sql`
        UPDATE ${table} SET status = 'pending', approval_mode = 'policy', approval_request_id = ${requestId}, approver_user_ids = '{}', decision_note = NULL, version = version + 1 WHERE id = ${target.id}`);
    } else {
      const approvers = await this.defaultApprovers(executor, target.company_id, target.owner);
      await executor.execute(sql`
        UPDATE ${table} SET status = 'pending', approval_mode = 'manager', approval_request_id = NULL, decision_note = NULL, version = version + 1,
          approver_user_ids = ${sql`ARRAY[${sql.join(
            approvers.map((userId) => sql`${userId}::uuid`),
            sql`, `,
          )}]::uuid[]`} WHERE id = ${target.id}`);
      await notify(
        executor,
        approvers.map((userId) => ({
          userId,
          companyId: target.company_id,
          kind: "office_contract",
          title: `Hợp đồng chờ bạn duyệt: ${target.title}`,
          link: `/office/contracts/${target.contractId}`,
        })),
      );
    }
  }

  async submit(actor: Actor, id: string, version: number): Promise<OfficeContractResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("submit")) throw this.businessRule("contractStatusInvalid");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!row.content_file_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "contractContentRequired" } });
      await this.submitApproval(transaction, actor, "office.contract", {
        id,
        company_id: row.company_id,
        owner: row.owner_user_id,
        code: row.contract_code,
        amount: row.value,
        currency: row.currency,
        title: row.name,
        contractId: id,
      });
      await transaction.execute(sql`UPDATE office.contracts SET updated_at = now() WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, "submitted");
    });
    return this.get(actor, id);
  }

  async withdraw(actor: Actor, id: string, version: number): Promise<OfficeContractResponse> {
    const approvalRequestId = await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("withdraw")) throw this.businessRule("contractStatusInvalid");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.event(transaction, id, actor.userId, "withdrawn");
      if (row.approval_mode === "policy" && row.approval_request_id) return row.approval_request_id;
      await transaction.execute(sql`UPDATE office.contracts SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id}`);
      return null;
    });
    if (approvalRequestId) {
      await this.approvals.withdraw(actor.userId, approvalRequestId);
      await this.outbox.dispatchPending();
    }
    return this.get(actor, id);
  }

  async decide(actor: Actor, id: string, decision: "approved" | "rejected", note: string | null | undefined, version: number): Promise<OfficeContractResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("decide")) throw this.businessRule("contractStatusInvalid");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const next = decision === "approved" ? "awaiting_signature" : "rejected";
      await transaction.execute(sql`UPDATE office.contracts SET status = ${next}, decision_note = ${note ?? null}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, decision, { note: note ?? null });
      await this.afterDecision(transaction, id, null, next, actor.userId);
    });
    return this.get(actor, id);
  }

  private async contractOfAppendix(executor: Executor, appendixId: string): Promise<string> {
    return (await executor.execute<{ contract_id: string }>(sql`SELECT contract_id FROM office.contract_appendices WHERE id = ${appendixId}`)).rows[0]!.contract_id;
  }

  private async afterDecision(executor: Executor, contractId: string, appendixId: string | null, status: string, actorUserId: string | null): Promise<void> {
    const row = (await executor.execute<{ owner_user_id: string; company_id: string; name: string }>(sql`SELECT owner_user_id, company_id, name FROM office.contracts WHERE id = ${contractId}`))
      .rows[0]!;
    if (!actorUserId) await this.event(executor, contractId, null, appendixId ? `appendix_${status}` : `approval_${status}`, appendixId ? { appendixId } : {});
    const title =
      status === "awaiting_signature"
        ? `${appendixId ? "Phụ lục" : "Hợp đồng"} đã duyệt, lập phiên ký: ${row.name}`
        : status === "rejected"
          ? `${appendixId ? "Phụ lục" : "Hợp đồng"} bị từ chối: ${row.name}`
          : null;
    if (title) await notify(executor, [{ userId: row.owner_user_id, companyId: row.company_id, kind: "office_contract", title, link: `/office/contracts/${contractId}` }]);
  }

  // ---------- Ký (QUYTAC_NGHIEPVU_464) ----------

  private async startSigning(
    actor: Actor,
    companyId: string,
    fileId: string,
    title: string,
    input: OfficeContractSigningInput,
    source: { type: "contract" | "contract_appendix"; id: string },
  ): Promise<string> {
    const file = (await this.database.execute<{ file_name: string; storage_key: string }>(sql`SELECT file_name, storage_key FROM office.files WHERE id = ${fileId}`)).rows[0]!;
    const content = await this.storage.get(file.storage_key);
    const signingActor: Actor = { ...actor, companyId };
    const created = await this.signing.create(
      signingActor,
      { title, note: input.note ?? null, dueOn: input.dueOn, signers: input.signers },
      { buffer: content, size: content.length, originalname: Buffer.from(file.file_name, "utf8").toString("latin1") },
      source,
    );
    try {
      await this.signing.send(signingActor, created.id, created.version);
    } catch (error) {
      // Gửi không được (người ký chưa khai tài khoản ký số…): hủy phiên nháp để không còn phiên treo.
      await this.database.transaction((transaction) => this.signing.cancelForSource(transaction, created.id, actor.userId, "Gửi phiên ký không thành công."));
      throw error;
    }
    return created.id;
  }

  async startContractSigning(actor: Actor, id: string, input: OfficeContractSigningInput): Promise<OfficeContractResponse> {
    const row = await this.load(this.database, actor, id, false);
    if (!(await this.contractAllowed(actor, row)).includes("signing")) throw this.businessRule("contractStatusInvalid");
    if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (!row.content_file_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "contractContentRequired" } });
    const requestId = await this.startSigning(actor, row.company_id, row.content_file_id, `Hợp đồng ${row.contract_code}: ${row.name}`, input, { type: "contract", id });
    await this.database.transaction(async (transaction) => {
      const locked = await this.load(transaction, actor, id, true);
      if (locked.signing_request_id || locked.status !== "awaiting_signature") {
        await this.signing.cancelForSource(transaction, requestId, actor.userId, "Hợp đồng đã có phiên ký khác.");
        throw this.businessRule("contractStatusInvalid");
      }
      await transaction.execute(sql`UPDATE office.contracts SET signing_request_id = ${requestId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, "signing_started", { signingRequestId: requestId });
    });
    return this.get(actor, id);
  }

  // Phiên ký xong: hợp đồng, phụ lục đã ký, ngày ký là ngày chữ ký cuối; phiên bị từ chối, hết hạn, hủy thì về chờ ký.
  private async signingOutcome(executor: Executor, outcome: SigningOutcome): Promise<void> {
    if (outcome.sourceType === "document" || !outcome.sourceId) return;
    const today = this.today();
    if (outcome.sourceType === "contract") {
      const row = (
        await executor.execute<{ id: string; signing_request_id: string | null; owner_user_id: string; name: string }>(sql`
        SELECT id, signing_request_id, owner_user_id, name FROM office.contracts WHERE id = ${outcome.sourceId} FOR UPDATE`)
      ).rows[0];
      if (!row || row.signing_request_id !== outcome.requestId) return;
      if (outcome.status === "completed") {
        const checks = await this.checksOf(executor, outcome.companyId, outcome.currentFileId);
        await executor.execute(sql`
          UPDATE office.contracts SET status = 'signed', signed_on = ${today}, signed_file_id = ${outcome.currentFileId}, signature_checks = ${checks ? JSON.stringify(checks) : null}::jsonb,
            updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
        await this.event(executor, row.id, null, "signed", { signingRequestId: outcome.requestId });
        await notify(executor, [{ userId: row.owner_user_id, companyId: outcome.companyId, kind: "office_contract", title: `Hợp đồng đã ký: ${row.name}`, link: `/office/contracts/${row.id}` }]);
      } else {
        await executor.execute(sql`UPDATE office.contracts SET signing_request_id = NULL, updated_at = now(), version = version + 1 WHERE id = ${row.id}`);
        await this.event(executor, row.id, null, `signing_${outcome.status}`, { signingRequestId: outcome.requestId, reason: outcome.reason });
      }
      return;
    }
    const appendix = (await executor.execute<AppendixRow>(sql`SELECT ${appendixColumns} FROM office.contract_appendices a WHERE a.id = ${outcome.sourceId} FOR UPDATE`)).rows[0];
    if (!appendix || appendix.signing_request_id !== outcome.requestId) return;
    if (outcome.status === "completed") {
      await this.applyAppendix(executor, appendix, today, outcome.currentFileId!, null);
    } else {
      await executor.execute(sql`UPDATE office.contract_appendices SET signing_request_id = NULL, version = version + 1 WHERE id = ${appendix.id}`);
      await this.event(executor, appendix.contract_id, null, `appendix_signing_${outcome.status}`, { appendixId: appendix.id, reason: outcome.reason });
    }
  }

  private async checksOf(executor: Executor, companyId: string, fileId: string | null): Promise<SignatureCheckItem[] | null> {
    if (!fileId) return null;
    const file = (await executor.execute<{ storage_key: string }>(sql`SELECT storage_key FROM office.files WHERE id = ${fileId}`)).rows[0];
    if (!file) return null;
    const checks = await this.signing.checkSignatures(companyId, await this.storage.get(file.storage_key));
    return checks.length ? checks : null;
  }

  // Phụ lục đã ký: cập nhật ngày hết hạn, giá trị của hợp đồng, giữ giá trị cũ để xem lịch sử (QUYTAC_NGHIEPVU_465).
  private async applyAppendix(executor: Executor, appendix: AppendixRow, signedOn: string, signedFileId: string, actorUserId: string | null): Promise<void> {
    const contract = (
      await executor.execute<{ expires_on: string | null; value: string | null; owner_user_id: string; company_id: string; name: string }>(sql`
      SELECT expires_on::text AS expires_on, value::text AS value, owner_user_id, company_id, name FROM office.contracts WHERE id = ${appendix.contract_id} FOR UPDATE`)
    ).rows[0]!;
    await executor.execute(sql`
      UPDATE office.contract_appendices SET status = 'signed', signed_on = ${signedOn}, signed_file_id = ${signedFileId},
        previous_expires_on = ${contract.expires_on}, previous_value = ${contract.value}, version = version + 1 WHERE id = ${appendix.id}`);
    if (appendix.new_expires_on || appendix.new_value) {
      await executor.execute(sql`
        UPDATE office.contracts SET expires_on = COALESCE(${appendix.new_expires_on}::date, expires_on), value = COALESCE(${appendix.new_value}::numeric, value), updated_at = now(), version = version + 1
        WHERE id = ${appendix.contract_id}`);
    }
    await this.event(executor, appendix.contract_id, actorUserId, "appendix_signed", {
      appendixId: appendix.id,
      appendixNo: appendix.appendix_no,
      previousExpiresOn: contract.expires_on,
      newExpiresOn: appendix.new_expires_on,
      previousValue: contract.value,
      newValue: appendix.new_value,
    });
    await notify(executor, [
      {
        userId: contract.owner_user_id,
        companyId: contract.company_id,
        kind: "office_contract",
        title: `Phụ lục ${appendix.appendix_no} đã ký: ${contract.name}`,
        link: `/office/contracts/${appendix.contract_id}`,
      },
    ]);
  }

  // ---------- Hủy, thanh lý, chấm dứt, chia sẻ ----------

  async cancel(actor: Actor, id: string, reason: string, version: number): Promise<OfficeContractResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("cancel")) throw this.businessRule("contractStatusInvalid");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Hủy cả phiên ký đang chạy; kết quả phiên không còn đổi hợp đồng.
      await transaction.execute(
        sql`UPDATE office.contracts SET status = 'cancelled', cancel_reason = ${reason}, signing_request_id = NULL, updated_at = now(), version = version + 1 WHERE id = ${id}`,
      );
      if (row.signing_request_id) await this.signing.cancelForSource(transaction, row.signing_request_id, actor.userId, reason);
      await this.event(transaction, id, actor.userId, "cancelled", { reason });
    });
    return this.get(actor, id);
  }

  async end(actor: Actor, id: string, input: { kind: "liquidated" | "terminated"; endedOn: string; reason: string; version: number }, file: Upload): Promise<OfficeContractResponse> {
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("end")) throw this.businessRule("contractStatusInvalid");
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.signed_on && input.endedOn < row.signed_on) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { endedOn: "contractEndBeforeSigned" } });
      const fileId = await this.storeFile(transaction, row.company_id, "contract", id, file, actor.userId);
      await transaction.execute(sql`
        UPDATE office.contracts SET status = ${input.kind}, ended_on = ${input.endedOn}, end_reason = ${input.reason}, end_file_id = ${fileId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, input.kind, { endedOn: input.endedOn, reason: input.reason });
      await this.auditService.record({ ...this.audit(actor, "office_contract"), action: `office.contract.${input.kind}`, entityId: id }, transaction);
    });
    return this.get(actor, id);
  }

  async share(actor: Actor, id: string, userId: string): Promise<OfficeContractResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("share")) throw new ApiError("FORBIDDEN", "forbidden");
      const member = await transaction.execute(sql`
        SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id WHERE m.user_id = ${userId} AND m.company_id = ${row.company_id} AND m.status = 'active' AND u.status = 'active'`);
      if (member.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { userId: "notFound" } });
      await transaction.execute(sql`INSERT INTO office.contract_shares (contract_id, user_id, shared_by) VALUES (${id}, ${userId}, ${actor.userId}) ON CONFLICT DO NOTHING`);
      await this.event(transaction, id, actor.userId, "shared", { userId });
      await notify(transaction, [{ userId, companyId: row.company_id, kind: "office_contract", title: `Hợp đồng được chia sẻ với bạn: ${row.name}`, link: `/office/contracts/${id}` }]);
    });
    return this.get(actor, id);
  }

  async unshare(actor: Actor, id: string, userId: string): Promise<OfficeContractResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.load(transaction, actor, id, true);
      if (!(await this.contractAllowed(actor, row)).includes("share")) throw new ApiError("FORBIDDEN", "forbidden");
      await transaction.execute(sql`DELETE FROM office.contract_shares WHERE contract_id = ${id} AND user_id = ${userId}`);
      await this.event(transaction, id, actor.userId, "unshared", { userId });
    });
    return this.get(actor, id);
  }

  // ---------- Phụ lục (QUYTAC_NGHIEPVU_465) ----------

  private async loadAppendix(executor: Executor, contractId: string, appendixId: string): Promise<AppendixRow> {
    const row = (await executor.execute<AppendixRow>(sql`SELECT ${appendixColumns} FROM office.contract_appendices a WHERE a.id = ${appendixId} AND a.contract_id = ${contractId} FOR UPDATE`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async appendixGuard(actor: Actor, contractId: string, appendixId: string | null, action: AppendixAction | "create"): Promise<{ contract: ContractRow; appendix: AppendixRow | null }> {
    const contract = await this.load(this.database, actor, contractId, false);
    if (action === "create") {
      if (!(await this.contractAllowed(actor, contract)).includes("appendix")) throw this.businessRule("contractStatusInvalid");
      return { contract, appendix: null };
    }
    const appendix = await this.loadAppendix(this.database, contractId, appendixId!);
    if (!this.appendixItem(actor, contract, appendix, await this.isManager(actor, contract)).allowed.includes(action)) throw this.businessRule("contractStatusInvalid");
    return { contract, appendix };
  }

  private checkAppendixDates(contract: ContractRow, input: { effectiveFrom: string; newExpiresOn?: string | null | undefined; newValue?: string | null | undefined }): void {
    if (input.newExpiresOn && input.newExpiresOn < input.effectiveFrom) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { newExpiresOn: "contractExpiryBeforeEffective" } });
    if (input.newExpiresOn && input.newExpiresOn < contract.effective_from) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { newExpiresOn: "contractExpiryBeforeEffective" } });
    if (input.newValue && contract.direction === "none") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { newValue: "contractValueNotAllowed" } });
  }

  async createAppendix(actor: Actor, contractId: string, input: OfficeSaveAppendixInput, file: Upload): Promise<OfficeContractResponse> {
    const { contract } = await this.appendixGuard(actor, contractId, null, "create");
    this.checkAppendixDates(contract, input);
    if (file) this.checkPdf(file);
    await this.database.transaction(async (transaction) => {
      const duplicate = await transaction.execute(sql`SELECT 1 FROM office.contract_appendices WHERE contract_id = ${contractId} AND appendix_no = ${input.appendixNo}`);
      if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { appendixNo: "contractAppendixDuplicate" } });
      const id = randomUUID();
      await transaction.execute(sql`
        INSERT INTO office.contract_appendices (id, contract_id, appendix_no, summary, effective_from, new_expires_on, new_value, created_by)
        VALUES (${id}, ${contractId}, ${input.appendixNo}, ${input.summary}, ${input.effectiveFrom}, ${input.newExpiresOn ?? null}, ${input.newValue ?? null}, ${actor.userId})`);
      if (file) {
        const fileId = await this.storeFile(transaction, contract.company_id, "contract_appendix", id, file, actor.userId);
        await transaction.execute(sql`UPDATE office.contract_appendices SET content_file_id = ${fileId} WHERE id = ${id}`);
      }
      await this.event(transaction, contractId, actor.userId, "appendix_created", { appendixId: id, appendixNo: input.appendixNo });
    });
    return this.get(actor, contractId);
  }

  async updateAppendix(actor: Actor, contractId: string, appendixId: string, input: OfficeSaveAppendixInput, file: Upload): Promise<OfficeContractResponse> {
    const { contract } = await this.appendixGuard(actor, contractId, appendixId, "edit");
    this.checkAppendixDates(contract, input);
    if (file) this.checkPdf(file);
    await this.database.transaction(async (transaction) => {
      const appendix = await this.loadAppendix(transaction, contractId, appendixId);
      if (input.version !== appendix.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const duplicate = await transaction.execute(sql`SELECT 1 FROM office.contract_appendices WHERE contract_id = ${contractId} AND appendix_no = ${input.appendixNo} AND id <> ${appendixId}`);
      if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { appendixNo: "contractAppendixDuplicate" } });
      await transaction.execute(sql`
        UPDATE office.contract_appendices SET appendix_no = ${input.appendixNo}, summary = ${input.summary}, effective_from = ${input.effectiveFrom},
          new_expires_on = ${input.newExpiresOn ?? null}, new_value = ${input.newValue ?? null}, version = version + 1 WHERE id = ${appendixId}`);
      if (file) {
        const fileId = await this.storeFile(transaction, contract.company_id, "contract_appendix", appendixId, file, actor.userId);
        await transaction.execute(sql`UPDATE office.contract_appendices SET content_file_id = ${fileId} WHERE id = ${appendixId}`);
      }
      await this.event(transaction, contractId, actor.userId, "appendix_updated", { appendixId });
    });
    return this.get(actor, contractId);
  }

  async importAppendix(actor: Actor, contractId: string, input: z.infer<typeof officeImportAppendixSchema>, file: Upload): Promise<OfficeContractResponse> {
    const { contract } = await this.appendixGuard(actor, contractId, null, "create");
    this.checkAppendixDates(contract, input);
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (input.signedOn > this.today()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { signedOn: "contractSignedOnFuture" } });
    await this.database.transaction(async (transaction) => {
      const duplicate = await transaction.execute(sql`SELECT 1 FROM office.contract_appendices WHERE contract_id = ${contractId} AND appendix_no = ${input.appendixNo}`);
      if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { appendixNo: "contractAppendixDuplicate" } });
      const id = randomUUID();
      await transaction.execute(sql`
        INSERT INTO office.contract_appendices (id, contract_id, appendix_no, summary, effective_from, new_expires_on, new_value, created_by, imported)
        VALUES (${id}, ${contractId}, ${input.appendixNo}, ${input.summary}, ${input.effectiveFrom}, ${input.newExpiresOn ?? null}, ${input.newValue ?? null}, ${actor.userId}, true)`);
      const fileId = await this.storeFile(transaction, contract.company_id, "contract_appendix", id, file, actor.userId);
      const appendix = await this.loadAppendix(transaction, contractId, id);
      await this.applyAppendix(transaction, appendix, input.signedOn, fileId, actor.userId);
    });
    return this.get(actor, contractId);
  }

  async submitAppendix(actor: Actor, contractId: string, appendixId: string, version: number): Promise<OfficeContractResponse> {
    const { contract } = await this.appendixGuard(actor, contractId, appendixId, "submit");
    await this.database.transaction(async (transaction) => {
      const appendix = await this.loadAppendix(transaction, contractId, appendixId);
      if (appendix.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!appendix.content_file_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "contractContentRequired" } });
      await this.submitApproval(transaction, actor, "office.contract_appendix", {
        id: appendixId,
        company_id: contract.company_id,
        owner: contract.owner_user_id,
        code: `${contract.contract_code}-PL${appendix.appendix_no}`.slice(0, 100),
        amount: appendix.new_value ?? contract.value,
        currency: contract.currency,
        title: `${contract.name}, phụ lục ${appendix.appendix_no}`,
        contractId,
      });
      await this.event(transaction, contractId, actor.userId, "appendix_submitted", { appendixId });
    });
    return this.get(actor, contractId);
  }

  async withdrawAppendix(actor: Actor, contractId: string, appendixId: string, version: number): Promise<OfficeContractResponse> {
    await this.appendixGuard(actor, contractId, appendixId, "withdraw");
    const approvalRequestId = await this.database.transaction(async (transaction) => {
      const appendix = await this.loadAppendix(transaction, contractId, appendixId);
      if (appendix.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.event(transaction, contractId, actor.userId, "appendix_withdrawn", { appendixId });
      if (appendix.approval_mode === "policy" && appendix.approval_request_id) return appendix.approval_request_id;
      await transaction.execute(sql`UPDATE office.contract_appendices SET status = 'withdrawn', version = version + 1 WHERE id = ${appendixId}`);
      return null;
    });
    if (approvalRequestId) {
      await this.approvals.withdraw(actor.userId, approvalRequestId);
      await this.outbox.dispatchPending();
    }
    return this.get(actor, contractId);
  }

  async decideAppendix(actor: Actor, contractId: string, appendixId: string, decision: "approved" | "rejected", note: string | null | undefined, version: number): Promise<OfficeContractResponse> {
    await this.appendixGuard(actor, contractId, appendixId, "decide");
    await this.database.transaction(async (transaction) => {
      const appendix = await this.loadAppendix(transaction, contractId, appendixId);
      if (appendix.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const next = decision === "approved" ? "awaiting_signature" : "rejected";
      await transaction.execute(sql`UPDATE office.contract_appendices SET status = ${next}, decision_note = ${note ?? null}, version = version + 1 WHERE id = ${appendixId}`);
      await this.event(transaction, contractId, actor.userId, `appendix_${decision}`, { appendixId, note: note ?? null });
      await this.afterDecision(transaction, contractId, appendixId, next, actor.userId);
    });
    return this.get(actor, contractId);
  }

  async appendixSigning(actor: Actor, contractId: string, appendixId: string, input: OfficeContractSigningInput): Promise<OfficeContractResponse> {
    const { contract, appendix } = await this.appendixGuard(actor, contractId, appendixId, "signing");
    if (appendix!.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (!appendix!.content_file_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "contractContentRequired" } });
    const requestId = await this.startSigning(actor, contract.company_id, appendix!.content_file_id, `Phụ lục ${appendix!.appendix_no} hợp đồng ${contract.contract_code}: ${contract.name}`, input, {
      type: "contract_appendix",
      id: appendixId,
    });
    await this.database.transaction(async (transaction) => {
      const locked = await this.loadAppendix(transaction, contractId, appendixId);
      if (locked.signing_request_id || locked.status !== "awaiting_signature") {
        await this.signing.cancelForSource(transaction, requestId, actor.userId, "Phụ lục đã có phiên ký khác.");
        throw this.businessRule("contractStatusInvalid");
      }
      await transaction.execute(sql`UPDATE office.contract_appendices SET signing_request_id = ${requestId}, version = version + 1 WHERE id = ${appendixId}`);
      await this.event(transaction, contractId, actor.userId, "appendix_signing_started", { appendixId, signingRequestId: requestId });
    });
    return this.get(actor, contractId);
  }

  async cancelAppendix(actor: Actor, contractId: string, appendixId: string, reason: string, version: number): Promise<OfficeContractResponse> {
    await this.appendixGuard(actor, contractId, appendixId, "cancel");
    await this.database.transaction(async (transaction) => {
      const appendix = await this.loadAppendix(transaction, contractId, appendixId);
      if (appendix.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`UPDATE office.contract_appendices SET status = 'cancelled', signing_request_id = NULL, version = version + 1 WHERE id = ${appendixId}`);
      if (appendix.signing_request_id) await this.signing.cancelForSource(transaction, appendix.signing_request_id, actor.userId, reason);
      await this.event(transaction, contractId, actor.userId, "appendix_cancelled", { appendixId, reason });
    });
    return this.get(actor, contractId);
  }

  // ---------- Nhắc hạn (QUYTAC_NGHIEPVU_467; tác vụ nền 7 giờ hằng ngày) ----------

  async remindExpiring(): Promise<number> {
    const today = this.today();
    const rows = await this.database.execute<{
      id: string;
      company_id: string;
      name: string;
      contract_code: string;
      expires_on: string;
      reminder_days: number[];
      owner_user_id: string;
      confidential: boolean;
    }>(sql`
      SELECT id, company_id, name, contract_code, expires_on::text AS expires_on, reminder_days, owner_user_id, confidential FROM office.contracts
      WHERE status = 'signed' AND expires_on IS NOT NULL AND expires_on >= ${today}::date - 29 AND expires_on <= ${today}::date + 365`);
    let sent = 0;
    for (const row of rows.rows) {
      const daysLeft = dayCount(today, row.expires_on);
      let milestone: string | null = null;
      let title = "";
      if (daysLeft >= 0) {
        // Mốc nhỏ nhất đã tới (ví dụ còn 5 ngày: mốc 7); mỗi mốc một lần.
        const reached = [...row.reminder_days].sort((left, right) => left - right).find((day) => daysLeft <= day);
        if (reached !== undefined) {
          milestone = `before_${reached}`;
          title = `Hợp đồng còn ${daysLeft} ngày hết hạn: ${row.name}`;
        }
      } else {
        const after = [...afterMilestones].reverse().find((day) => -daysLeft >= day);
        if (after !== undefined) {
          milestone = `after_${after}`;
          title = `Hợp đồng đã hết hạn ${-daysLeft} ngày, chưa thanh lý: ${row.name}`;
        }
      }
      if (!milestone) continue;
      const inserted = await this.database.transaction(async (transaction) => {
        const recorded = await transaction.execute(sql`
          INSERT INTO office.contract_reminders (contract_id, expires_on, milestone) VALUES (${row.id}, ${row.expires_on}, ${milestone}) ON CONFLICT DO NOTHING RETURNING contract_id`);
        if (recorded.rows.length === 0) return false;
        const managers = row.confidential ? [] : await this.permissionHolders(transaction, row.company_id, "office.contract.manage");
        const recipients = [...new Set([row.owner_user_id, ...managers])];
        await notify(
          transaction,
          recipients.map((userId) => ({ userId, companyId: row.company_id, kind: "office_contract_expiry", title, link: `/office/contracts/${row.id}`, payload: { contractId: row.id, milestone } })),
        );
        await this.event(transaction, row.id, null, "reminded", { milestone });
        return true;
      });
      if (inserted) sent += 1;
    }
    return sent;
  }
}
