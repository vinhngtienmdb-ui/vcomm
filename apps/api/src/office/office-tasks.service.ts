// Công việc của Văn phòng số (CHUC_NANG_182; QUYTAC_NGHIEPVU_356 đến 359; API_184, API_185).
import { Inject, Injectable } from "@nestjs/common";
import {
  officeFileExtensions,
  officeFileMaximumBytes,
  type CreateOfficeTaskInput,
  type OfficeFileItem,
  type OfficePerson,
  type OfficeTaskAction,
  type OfficeTaskComment,
  type OfficeTaskEvent,
  type OfficeTaskListItem,
  type OfficeTaskListQuery,
  type OfficeTaskPriority,
  type OfficeTaskResponse,
  type OfficeTaskStatus,
  type PageResponse,
  type UpdateOfficeTaskInput,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { notify, type NotificationInput } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { activeGroupUsers, peopleById, searchGroupPeople } from "./office-access";

type Executor = Pick<Database, "execute">;

type TaskRow = {
  id: string;
  company_id: string;
  company_name: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  status: OfficeTaskStatus;
  priority: OfficeTaskPriority;
  progress: number;
  start_date: string | null;
  due_at: Date | null;
  assigned_by: string;
  owner_user_id: string | null;
  status_reason: string | null;
  completed_at: Date | null;
  created_at: Date;
  version: number;
  workflow_step_instance_id: string | null;
  candidate_role_id: string | null;
  incoming_document_id: string | null;
  can_claim?: boolean;
};

// Móc nối khi việc của bước quy trình hoàn thành: chạy trong cùng giao dịch (dịch vụ quy trình đăng ký).
export type WorkflowTaskCompletedHook = (transaction: Executor, task: { id: string; stepInstanceId: string; outcome: string }) => Promise<void>;
// Thông tin bước cho chi tiết việc; dịch vụ quy trình cung cấp.
export type WorkflowTaskInfoProvider = (stepInstanceId: string, candidateRoleId: string | null) => Promise<OfficeTaskResponse["workflow"]>;

const taskColumns = sql`t.id, t.company_id, c.short_name AS company_name, t.parent_id, t.title, t.description, t.status, t.priority, t.progress,
  to_char(t.start_date, 'YYYY-MM-DD') AS start_date, t.due_at, t.assigned_by, t.owner_user_id, t.status_reason, t.completed_at, t.created_at, t.version,
  t.workflow_step_instance_id, t.candidate_role_id, t.incoming_document_id`;

// Cơ sở dữ liệu trả thời điểm dạng chuỗi; đổi về ISO 8601 thống nhất.
const isoOrNull = (value: Date | string | null): string | null => (value === null ? null : new Date(value).toISOString());

const closedStatuses: OfficeTaskStatus[] = ["completed", "cancelled"];

// Loại tệp theo phần mở rộng và chữ ký đầu tệp; tệp văn bản thuần không có chữ ký.
const fileKinds: Record<(typeof officeFileExtensions)[number], { type: string; signature: number[] | null }> = {
  pdf: { type: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  doc: { type: "application/msword", signature: [0xd0, 0xcf, 0x11, 0xe0] },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: [0x50, 0x4b, 0x03, 0x04] },
  xls: { type: "application/vnd.ms-excel", signature: [0xd0, 0xcf, 0x11, 0xe0] },
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: [0x50, 0x4b, 0x03, 0x04] },
  ppt: { type: "application/vnd.ms-powerpoint", signature: [0xd0, 0xcf, 0x11, 0xe0] },
  pptx: { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", signature: [0x50, 0x4b, 0x03, 0x04] },
  jpg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  jpeg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  png: { type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
  txt: { type: "text/plain; charset=utf-8", signature: null },
  zip: { type: "application/zip", signature: [0x50, 0x4b, 0x03, 0x04] },
};

// Kiểm tra tệp tải lên của Văn phòng số (QUYTAC_NGHIEPVU_359); dùng chung cho công văn, bảng tin ở lát sau.
export function checkOfficeFile(file: { buffer: Buffer; size: number; originalname: string } | undefined): { fileName: string; contentType: string } {
  if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
  if (file.size > officeFileMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "officeFileTooLarge" } });
  const extension = file.originalname.split(".").pop()?.toLowerCase() as (typeof officeFileExtensions)[number] | undefined;
  const kind = extension && (officeFileExtensions as readonly string[]).includes(extension) ? fileKinds[extension] : null;
  if (!kind || (kind.signature && !kind.signature.every((byte, index) => file.buffer[index] === byte))) {
    throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "officeFileTypeInvalid" } });
  }
  // Tên tệp gốc giữ để hiển thị; bỏ ký tự điều khiển và đường dẫn.
  // multer đọc tên tệp theo latin1; đổi lại UTF-8 để giữ tên tiếng Việt.
  const decoded = Buffer.from(file.originalname, "latin1").toString("utf8");
  const fileName = (decoded.split(/[\\/]/).pop() ?? "tep").replace(/[\u0000-\u001f"]/g, "").slice(-200) || "tep";
  return { fileName, contentType: kind.type };
}

@Injectable()
export class OfficeTasksService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  readonly workflowCompletedHooks: WorkflowTaskCompletedHook[] = [];
  // Móc nối khi việc hoàn thành hoặc hủy (công văn đến gắn việc xử lý); chạy trong cùng giao dịch.
  readonly statusChangedHooks: ((transaction: Executor, task: { id: string; status: OfficeTaskStatus; actorId: string }) => Promise<void>)[] = [];
  workflowInfo: WorkflowTaskInfoProvider | null = null;

  // Người dùng giữ vai trò ứng viên của việc (gán ở tập đoàn hoặc công ty của việc, còn hiệu lực).
  private candidateCondition(userId: string): SQL {
    const today = this.permissionService.today();
    return sql`(t.owner_user_id IS NULL AND t.candidate_role_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM core.user_role_assignments a JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
      WHERE a.user_id = ${userId} AND a.role_id = t.candidate_role_id AND (a.scope_type = 'group' OR a.company_id = t.company_id)
        AND a.valid_from <= ${today}::date AND (a.valid_to IS NULL OR a.valid_to >= ${today}::date)))`;
  }

  // Công ty mà người dùng có quyền xem mọi việc (bao trùm công ty; quyền gán ở chi nhánh không dùng được).
  private async viewAllCompanies(userId: string): Promise<SQL> {
    return sql`(
      SELECT a.company_id FROM core.user_role_assignments a
      JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
      JOIN core.role_permissions rp ON rp.role_id = r.id AND rp.permission_code = 'office.task.view_all'
      WHERE a.user_id = ${userId} AND a.scope_type = 'company'
        AND a.valid_from <= ${this.permissionService.today()}::date AND (a.valid_to IS NULL OR a.valid_to >= ${this.permissionService.today()}::date)
      UNION
      SELECT c.id FROM core.companies c
      WHERE EXISTS (
        SELECT 1 FROM core.user_role_assignments a
        JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
        JOIN core.role_permissions rp ON rp.role_id = r.id AND rp.permission_code = 'office.task.view_all'
        WHERE a.user_id = ${userId} AND a.scope_type = 'group'
          AND a.valid_from <= ${this.permissionService.today()}::date AND (a.valid_to IS NULL OR a.valid_to >= ${this.permissionService.today()}::date)))`;
  }

  // Điều kiện người dùng xem được việc t (QUYTAC_NGHIEPVU_357).
  private async visibleCondition(userId: string): Promise<SQL> {
    return sql`(t.assigned_by = ${userId} OR t.owner_user_id = ${userId}
      OR EXISTS (SELECT 1 FROM office.task_participants p WHERE p.task_id = t.id AND p.user_id = ${userId})
      OR ${this.candidateCondition(userId)}
      OR t.company_id IN ${await this.viewAllCompanies(userId)})`;
  }

  private async loadVisible(executor: Executor, actor: Actor, id: string, lock = false): Promise<TaskRow> {
    const result = await executor.execute<TaskRow>(sql`
      SELECT ${taskColumns}, ${this.candidateCondition(actor.userId)} AS can_claim FROM office.tasks t JOIN core.companies c ON c.id = t.company_id
      WHERE t.id = ${id} AND ${await this.visibleCondition(actor.userId)} ${lock ? sql`FOR UPDATE OF t` : sql``}`);
    const row = result.rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private overdue(row: Pick<TaskRow, "status" | "due_at">): boolean {
    return !closedStatuses.includes(row.status) && row.due_at !== null && new Date(row.due_at).getTime() < this.clock.now().getTime();
  }

  private listItem(row: TaskRow, people: Map<string, OfficePerson>): OfficeTaskListItem {
    return {
      id: row.id,
      companyId: row.company_id,
      companyName: row.company_name,
      parentId: row.parent_id,
      title: row.title,
      owner: row.owner_user_id ? (people.get(row.owner_user_id) ?? null) : null,
      assignedBy: people.get(row.assigned_by)!,
      dueAt: isoOrNull(row.due_at),
      priority: row.priority,
      progress: row.progress,
      status: row.status,
      overdue: this.overdue(row),
    };
  }

  async people(actor: Actor, search: string): Promise<OfficePerson[]> {
    return searchGroupPeople(this.database, actor.companyId, search);
  }

  async list(actor: Actor, query: OfficeTaskListQuery): Promise<PageResponse<OfficeTaskListItem>> {
    const userId = actor.userId;
    const conditions: SQL[] = [];
    if (query.view === "mine")
      conditions.push(sql`(t.owner_user_id = ${userId} OR EXISTS (SELECT 1 FROM office.task_participants p WHERE p.task_id = t.id AND p.user_id = ${userId} AND p.role = 'collaborator'))`);
    if (query.view === "assigned") conditions.push(sql`t.assigned_by = ${userId}`);
    if (query.view === "following") conditions.push(sql`EXISTS (SELECT 1 FROM office.task_participants p WHERE p.task_id = t.id AND p.user_id = ${userId} AND p.role = 'follower')`);
    if (query.view === "company") {
      const covering = await this.permissionService.permissionsCovering(userId, { scopeType: "company", companyId: actor.companyId });
      if (!covering.has("office.task.view_all")) throw new ApiError("FORBIDDEN", "forbidden");
      conditions.push(sql`t.company_id = ${actor.companyId}`);
    }
    if (query.status === "open") conditions.push(sql`t.status NOT IN ('completed', 'cancelled')`);
    else if (query.status !== "all") conditions.push(sql`t.status = ${query.status}`);
    const now = this.clock.now().toISOString();
    if (query.due === "overdue") conditions.push(sql`t.due_at < ${now}::timestamptz AND t.status NOT IN ('completed', 'cancelled')`);
    if (query.due === "today") conditions.push(sql`(t.due_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (${now}::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`);
    if (query.due === "week") conditions.push(sql`t.due_at >= ${now}::timestamptz AND t.due_at < ${now}::timestamptz + interval '7 days'`);
    if (query.priority) conditions.push(sql`t.priority = ${query.priority}`);
    if (query.search) conditions.push(sql`t.title ILIKE ${`%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`}`);
    const where = sql.join([await this.visibleCondition(userId), ...conditions], sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM office.tasks t WHERE ${where}`)).rows[0]!.total;
    const rows = (
      await this.database.execute<TaskRow>(sql`
        SELECT ${taskColumns} FROM office.tasks t JOIN core.companies c ON c.id = t.company_id
        WHERE ${where}
        ORDER BY (t.due_at IS NULL), t.due_at, t.created_at DESC
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`)
    ).rows;
    const people = await peopleById(
      this.database,
      rows.flatMap((row) => [row.assigned_by, row.owner_user_id ?? ""]),
      actor.companyId,
    );
    return { data: rows.map((row) => this.listItem(row, people)), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<OfficeTaskResponse> {
    const row = await this.loadVisible(this.database, actor, id);
    const participants = (
      await this.database.execute<{ user_id: string; role: "collaborator" | "follower" }>(sql`
        SELECT user_id, role FROM office.task_participants WHERE task_id = ${id} ORDER BY created_at`)
    ).rows;
    const children = (
      await this.database.execute<TaskRow>(sql`
        SELECT ${taskColumns} FROM office.tasks t JOIN core.companies c ON c.id = t.company_id WHERE t.parent_id = ${id} ORDER BY t.created_at`)
    ).rows;
    const people = await peopleById(
      this.database,
      [row.assigned_by, row.owner_user_id ?? "", ...participants.map((item) => item.user_id), ...children.flatMap((child) => [child.assigned_by, child.owner_user_id ?? ""])],
      row.company_id,
    );
    return {
      ...this.listItem(row, people),
      description: row.description,
      startDate: row.start_date,
      collaborators: participants.filter((item) => item.role === "collaborator").map((item) => people.get(item.user_id)!),
      followers: participants.filter((item) => item.role === "follower").map((item) => people.get(item.user_id)!),
      statusReason: row.status_reason,
      completedAt: isoOrNull(row.completed_at),
      createdAt: isoOrNull(row.created_at)!,
      version: row.version,
      children: children.map((child) => this.listItem(child, people)),
      incomingDocumentId: row.incoming_document_id,
      workflow: row.workflow_step_instance_id && this.workflowInfo ? await this.workflowInfo(row.workflow_step_instance_id, row.candidate_role_id) : null,
      allowedActions: this.allowedActions(actor.userId, row),
    };
  }

  private allowedActions(userId: string, row: TaskRow): OfficeTaskResponse["allowedActions"] {
    const actions: OfficeTaskResponse["allowedActions"] = [];
    const isAssigner = row.assigned_by === userId;
    const isOwner = row.owner_user_id === userId;
    if (closedStatuses.includes(row.status)) return actions;
    // Việc của bước quy trình: không sửa, không hủy riêng (hủy cả phiên); báo xong là hoàn thành (QUYTAC_NGHIEPVU_362).
    if (row.workflow_step_instance_id) {
      if (row.owner_user_id === null && row.can_claim) actions.push("claim");
      if (isOwner && row.status === "new") actions.push("start");
      if (isOwner && ["new", "in_progress"].includes(row.status)) actions.push("report_done", "progress");
      return actions;
    }
    if (isAssigner) actions.push("edit", "cancel");
    if (isOwner && row.status === "new") actions.push("start");
    if (isOwner && ["new", "in_progress"].includes(row.status)) actions.push("report_done", "progress");
    if (isAssigner && row.status === "pending_confirmation") actions.push("confirm", "return");
    if ((isAssigner || isOwner) && row.parent_id === null) actions.push("add_child");
    return actions;
  }

  // Người tham gia hợp lệ: đang hoạt động, thuộc công ty trong tập đoàn; một người một vai trò (QUYTAC_NGHIEPVU_356, 357).
  private async checkParticipants(executor: Executor, companyId: string, input: Pick<CreateOfficeTaskInput, "ownerUserId" | "collaboratorIds" | "followerIds">): Promise<void> {
    const all = [input.ownerUserId, ...input.collaboratorIds, ...input.followerIds];
    if (new Set(all).size !== all.length) throw new ApiError("VALIDATION_FAILED", "officeParticipantDuplicate");
    const valid = await activeGroupUsers(executor, companyId, all);
    if (!valid.has(input.ownerUserId)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { ownerUserId: "officeParticipantOutsideGroup" } });
    if (input.collaboratorIds.some((id) => !valid.has(id))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { collaboratorIds: "officeParticipantOutsideGroup" } });
    if (input.followerIds.some((id) => !valid.has(id))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { followerIds: "officeParticipantOutsideGroup" } });
  }

  private checkDates(startDate: string | null | undefined, dueAt: string | null | undefined): void {
    if (startDate && dueAt && new Date(dueAt).getTime() < new Date(`${startDate}T00:00:00+07:00`).getTime()) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { dueAt: "officeDueBeforeStart" } });
    }
  }

  private async writeParticipants(executor: Executor, taskId: string, collaboratorIds: string[], followerIds: string[]): Promise<void> {
    await executor.execute(sql`DELETE FROM office.task_participants WHERE task_id = ${taskId}`);
    for (const [role, ids] of [
      ["collaborator", collaboratorIds],
      ["follower", followerIds],
    ] as const) {
      for (const userId of ids) await executor.execute(sql`INSERT INTO office.task_participants (task_id, user_id, role) VALUES (${taskId}, ${userId}, ${role})`);
    }
  }

  private async event(executor: Executor, taskId: string, actorId: string | null, action: string, details: Record<string, unknown> = {}): Promise<void> {
    await executor.execute(sql`INSERT INTO office.task_events (task_id, actor_id, action, details) VALUES (${taskId}, ${actorId}, ${action}, ${JSON.stringify(details)}::jsonb)`);
  }

  private notification(userId: string, companyId: string, taskId: string, kind: string, title: string): NotificationInput {
    return { userId, companyId, kind, title, link: `/office/tasks/${taskId}`, payload: { taskId } };
  }

  async create(actor: Actor, input: CreateOfficeTaskInput): Promise<OfficeTaskResponse> {
    this.checkDates(input.startDate, input.dueAt);
    const id = await this.database.transaction(async (transaction) => {
      if (input.parentId) {
        const parent = await this.loadVisible(transaction, actor, input.parentId, true);
        // Việc con một cấp, cùng công ty, hạn không sau hạn việc cha (QUYTAC_NGHIEPVU_358).
        if (parent.company_id !== actor.companyId) throw new ApiError("NOT_FOUND", "notFound");
        if (parent.parent_id !== null) throw new ApiError("BUSINESS_RULE", "officeSubtaskDepth");
        if (closedStatuses.includes(parent.status)) throw new ApiError("BUSINESS_RULE", "officeTaskClosed");
        if (parent.assigned_by !== actor.userId && parent.owner_user_id !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
        if (parent.due_at && (!input.dueAt || new Date(input.dueAt).getTime() > new Date(parent.due_at).getTime())) {
          throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { dueAt: "officeSubtaskDueAfterParent" } });
        }
      }
      await this.checkParticipants(transaction, actor.companyId, input);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO office.tasks (company_id, parent_id, title, description, priority, start_date, due_at, assigned_by, owner_user_id)
        VALUES (${actor.companyId}, ${input.parentId ?? null}, ${input.title}, ${input.description ?? null}, ${input.priority}, ${input.startDate ?? null},
          ${input.dueAt ?? null}, ${actor.userId}, ${input.ownerUserId})
        RETURNING id`);
      const taskId = inserted.rows[0]!.id;
      await this.writeParticipants(transaction, taskId, input.collaboratorIds, input.followerIds);
      await this.event(transaction, taskId, actor.userId, "created");
      await notify(
        transaction,
        [input.ownerUserId, ...input.collaboratorIds, ...input.followerIds]
          .filter((userId) => userId !== actor.userId)
          .map((userId) => this.notification(userId, actor.companyId, taskId, "office_task_assigned", `Việc mới: ${input.title}`)),
      );
      await this.auditService.record({ ...this.audit(actor), action: "office.task.create", entityId: taskId, afterData: { title: input.title } }, transaction);
      return taskId;
    });
    return this.detail(actor, id);
  }

  private audit(actor: Actor) {
    return {
      actorUserId: actor.userId,
      companyId: actor.companyId,
      appCode: "office",
      entityType: "office_task",
      ip: actor.client.ip,
      userAgent: actor.client.userAgent,
      requestId: actor.client.requestId,
    };
  }

  async update(actor: Actor, id: string, input: UpdateOfficeTaskInput): Promise<OfficeTaskResponse> {
    this.checkDates(input.startDate, input.dueAt);
    await this.database.transaction(async (transaction) => {
      const row = await this.loadVisible(transaction, actor, id, true);
      if (row.assigned_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
      if (closedStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "officeTaskClosed");
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.parent_id) {
        const parent = (await transaction.execute<{ due_at: Date | null }>(sql`SELECT due_at FROM office.tasks WHERE id = ${row.parent_id}`)).rows[0]!;
        if (parent.due_at && (!input.dueAt || new Date(input.dueAt).getTime() > new Date(parent.due_at).getTime())) {
          throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { dueAt: "officeSubtaskDueAfterParent" } });
        }
      }
      await this.checkParticipants(transaction, row.company_id, input);
      const before = (await transaction.execute<{ user_id: string }>(sql`SELECT user_id FROM office.task_participants WHERE task_id = ${id}`)).rows.map((item) => item.user_id);
      const changed: string[] = [];
      if (row.title !== input.title) changed.push("title");
      if ((row.description ?? null) !== (input.description ?? null)) changed.push("description");
      if (row.owner_user_id !== input.ownerUserId) changed.push("owner");
      if (isoOrNull(row.due_at) !== (input.dueAt ? new Date(input.dueAt).toISOString() : null)) changed.push("dueAt");
      if (row.start_date !== (input.startDate ?? null)) changed.push("startDate");
      if (row.priority !== input.priority) changed.push("priority");
      await transaction.execute(sql`
        UPDATE office.tasks SET title = ${input.title}, description = ${input.description ?? null}, owner_user_id = ${input.ownerUserId}, priority = ${input.priority},
          start_date = ${input.startDate ?? null}, due_at = ${input.dueAt ?? null},
          due_soon_notified_at = CASE WHEN ${changed.includes("dueAt")}::boolean THEN NULL ELSE due_soon_notified_at END,
          overdue_notified_at = CASE WHEN ${changed.includes("dueAt")}::boolean THEN NULL ELSE overdue_notified_at END,
          updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.writeParticipants(transaction, id, input.collaboratorIds, input.followerIds);
      const added = [input.ownerUserId, ...input.collaboratorIds, ...input.followerIds].filter((userId) => userId !== row.owner_user_id && !before.includes(userId) && userId !== actor.userId);
      if (added.length > 0) changed.push("participants");
      await this.event(transaction, id, actor.userId, "updated", { fields: changed });
      await notify(
        transaction,
        added.map((userId) => this.notification(userId, row.company_id, id, "office_task_assigned", `Việc mới: ${input.title}`)),
      );
    });
    return this.detail(actor, id);
  }

  async transition(actor: Actor, id: string, action: OfficeTaskAction, reason: string | null | undefined, version: number, outcome?: string | null): Promise<OfficeTaskResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadVisible(transaction, actor, id, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!this.allowedActions(actor.userId, row).includes(action)) {
        if (closedStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "officeTaskClosed");
        throw new ApiError(
          row.assigned_by === actor.userId || row.owner_user_id === actor.userId ? "BUSINESS_RULE" : "FORBIDDEN",
          row.assigned_by === actor.userId || row.owner_user_id === actor.userId ? "officeTaskActionInvalid" : "forbidden",
        );
      }
      if ((action === "return" || action === "cancel") && !reason) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { reason: "required" } });
      if (action === "claim") {
        await transaction.execute(sql`UPDATE office.tasks SET owner_user_id = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
        await this.event(transaction, id, actor.userId, "claimed");
        return;
      }
      const stepOutcomes = row.workflow_step_instance_id && action === "report_done" && this.workflowInfo ? ((await this.workflowInfo(row.workflow_step_instance_id, null))?.outcomes ?? []) : null;
      if (stepOutcomes && (!outcome || !stepOutcomes.includes(outcome))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { outcome: "required" } });
      let next: OfficeTaskStatus = row.status;
      if (action === "start") next = "in_progress";
      if (action === "report_done") {
        const open = (await transaction.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM office.tasks WHERE parent_id = ${id} AND status NOT IN ('completed', 'cancelled')`)).rows[0]!
          .total;
        if (open > 0) throw new ApiError("BUSINESS_RULE", "officeSubtasksOpen");
        next = stepOutcomes || row.assigned_by === row.owner_user_id ? "completed" : "pending_confirmation";
      }
      if (action === "confirm") next = "completed";
      if (action === "return") next = "in_progress";
      if (action === "cancel") next = "cancelled";
      await transaction.execute(sql`
        UPDATE office.tasks SET status = ${next},
          progress = CASE WHEN ${action === "report_done"}::boolean THEN 100 ELSE progress END,
          status_reason = ${action === "return" || action === "cancel" ? (reason ?? null) : sql`status_reason`},
          completed_at = CASE WHEN ${next === "completed"}::boolean THEN now() ELSE completed_at END,
          cancelled_at = CASE WHEN ${next === "cancelled"}::boolean THEN now() ELSE cancelled_at END,
          updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, `status_${action}`, { from: row.status, to: next, ...(reason ? { reason } : {}), ...(stepOutcomes ? { outcome } : {}) });
      if (stepOutcomes && row.workflow_step_instance_id) {
        for (const hook of this.workflowCompletedHooks) await hook(transaction, { id, stepInstanceId: row.workflow_step_instance_id, outcome: outcome! });
      }
      if (action === "cancel") {
        // Hủy việc cha hủy mọi việc con chưa xong (QUYTAC_NGHIEPVU_358).
        const children = await transaction.execute<{ id: string }>(sql`
          UPDATE office.tasks SET status = 'cancelled', status_reason = ${reason ?? null}, cancelled_at = now(), updated_at = now(), version = version + 1
          WHERE parent_id = ${id} AND status NOT IN ('completed', 'cancelled') RETURNING id`);
        for (const child of children.rows) await this.event(transaction, child.id, actor.userId, "status_cancel", { reason, byParent: true });
      }
      if (next === "completed" || next === "cancelled") {
        for (const hook of this.statusChangedHooks) await hook(transaction, { id, status: next, actorId: actor.userId });
      }
      // Đổi trạng thái: báo người giao và người theo dõi; trả lại, hủy báo cả người chủ trì.
      const followers = (await transaction.execute<{ user_id: string }>(sql`SELECT user_id FROM office.task_participants WHERE task_id = ${id} AND role = 'follower'`)).rows.map(
        (item) => item.user_id,
      );
      const recipients = new Set([row.assigned_by, ...followers, ...(action === "return" || action === "cancel" ? [row.owner_user_id ?? ""] : [])]);
      recipients.delete(actor.userId);
      recipients.delete("");
      await notify(
        transaction,
        [...recipients].map((userId) => this.notification(userId, row.company_id, id, "office_task_status", `${row.title}: ${statusText[next]}`)),
      );
    });
    return this.detail(actor, id);
  }

  async updateProgress(actor: Actor, id: string, progress: number, version: number): Promise<OfficeTaskResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadVisible(transaction, actor, id, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!this.allowedActions(actor.userId, row).includes("progress"))
        throw new ApiError(row.owner_user_id === actor.userId ? "BUSINESS_RULE" : "FORBIDDEN", row.owner_user_id === actor.userId ? "officeTaskActionInvalid" : "forbidden");
      await transaction.execute(sql`UPDATE office.tasks SET progress = ${progress}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.event(transaction, id, actor.userId, "progress", { from: row.progress, to: progress });
    });
    return this.detail(actor, id);
  }

  // Bình luận (QUYTAC_NGHIEPVU_359): mọi người xem được việc chưa hủy.
  async comments(actor: Actor, id: string): Promise<OfficeTaskComment[]> {
    await this.loadVisible(this.database, actor, id);
    const rows = (
      await this.database.execute<{ id: string; author_id: string; body: string; created_at: Date; edited_at: Date | null; deleted_at: Date | null }>(sql`
        SELECT id, author_id, body, created_at, edited_at, deleted_at FROM office.task_comments WHERE task_id = ${id} ORDER BY created_at`)
    ).rows;
    const people = await peopleById(
      this.database,
      rows.map((row) => row.author_id),
      null,
    );
    return rows.map((row) => ({
      id: row.id,
      author: people.get(row.author_id)!,
      body: row.deleted_at ? null : row.body,
      createdAt: isoOrNull(row.created_at)!,
      editedAt: isoOrNull(row.edited_at),
      deleted: row.deleted_at !== null,
      canEdit: row.author_id === actor.userId && row.deleted_at === null,
    }));
  }

  async addComment(actor: Actor, id: string, body: string): Promise<OfficeTaskComment[]> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadVisible(transaction, actor, id);
      if (row.status === "cancelled") throw new ApiError("BUSINESS_RULE", "officeTaskClosed");
      await transaction.execute(sql`INSERT INTO office.task_comments (task_id, author_id, body) VALUES (${id}, ${actor.userId}, ${body})`);
      const participants = (await transaction.execute<{ user_id: string }>(sql`SELECT user_id FROM office.task_participants WHERE task_id = ${id}`)).rows.map((item) => item.user_id);
      const recipients = new Set([row.assigned_by, row.owner_user_id ?? "", ...participants]);
      recipients.delete(actor.userId);
      recipients.delete("");
      await notify(
        transaction,
        [...recipients].map((userId) => this.notification(userId, row.company_id, id, "office_task_comment", `Bình luận mới: ${row.title}`)),
      );
    });
    return this.comments(actor, id);
  }

  async editComment(actor: Actor, id: string, commentId: string, body: string | null): Promise<OfficeTaskComment[]> {
    await this.database.transaction(async (transaction) => {
      await this.loadVisible(transaction, actor, id);
      const comment = (
        await transaction.execute<{ author_id: string; deleted_at: Date | null }>(sql`
        SELECT author_id, deleted_at FROM office.task_comments WHERE id = ${commentId} AND task_id = ${id} FOR UPDATE`)
      ).rows[0];
      if (!comment || comment.deleted_at) throw new ApiError("NOT_FOUND", "notFound");
      if (comment.author_id !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
      if (body === null) await transaction.execute(sql`UPDATE office.task_comments SET deleted_at = now() WHERE id = ${commentId}`);
      else await transaction.execute(sql`UPDATE office.task_comments SET body = ${body}, edited_at = now() WHERE id = ${commentId}`);
    });
    return this.comments(actor, id);
  }

  async history(actor: Actor, id: string): Promise<OfficeTaskEvent[]> {
    await this.loadVisible(this.database, actor, id);
    const rows = (
      await this.database.execute<{ id: string; actor_id: string | null; action: string; details: Record<string, unknown>; created_at: Date }>(sql`
        SELECT id, actor_id, action, details, created_at FROM office.task_events WHERE task_id = ${id} ORDER BY created_at DESC, id`)
    ).rows;
    const people = await peopleById(
      this.database,
      rows.map((row) => row.actor_id ?? ""),
      null,
    );
    return rows.map((row) => ({ id: row.id, actor: row.actor_id ? (people.get(row.actor_id) ?? null) : null, action: row.action, details: row.details, createdAt: isoOrNull(row.created_at)! }));
  }

  // Tệp của việc (QUYTAC_NGHIEPVU_359).
  async files(actor: Actor, id: string): Promise<OfficeFileItem[]> {
    const row = await this.loadVisible(this.database, actor, id);
    const files = (
      await this.database.execute<{ id: string; file_name: string; content_type: string; size_bytes: number; uploaded_by: string; created_at: Date }>(sql`
        SELECT id, file_name, content_type, size_bytes, uploaded_by, created_at FROM office.files
        WHERE owner_type = 'task' AND owner_id = ${id} AND deleted_at IS NULL ORDER BY created_at`)
    ).rows;
    const people = await peopleById(
      this.database,
      files.map((file) => file.uploaded_by),
      null,
    );
    return files.map((file) => ({
      id: file.id,
      fileName: file.file_name,
      contentType: file.content_type,
      sizeBytes: file.size_bytes,
      uploadedBy: people.get(file.uploaded_by)!,
      createdAt: isoOrNull(file.created_at)!,
      canDelete: file.uploaded_by === actor.userId && !closedStatuses.includes(row.status),
    }));
  }

  async addFile(actor: Actor, id: string, file: { buffer: Buffer; size: number; originalname: string } | undefined): Promise<OfficeFileItem[]> {
    const checked = checkOfficeFile(file);
    const row = await this.loadVisible(this.database, actor, id);
    if (closedStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "officeTaskClosed");
    const storageKey = `office/${row.company_id}/task/${id}/${randomUUID()}`;
    await this.storage.put(storageKey, file!.buffer, checked.contentType);
    try {
      await this.database.transaction(async (transaction) => {
        await transaction.execute(sql`
          INSERT INTO office.files (company_id, owner_type, owner_id, file_name, content_type, size_bytes, storage_key, uploaded_by)
          VALUES (${row.company_id}, 'task', ${id}, ${checked.fileName}, ${checked.contentType}, ${file!.size}, ${storageKey}, ${actor.userId})`);
        await this.event(transaction, id, actor.userId, "file_added", { fileName: checked.fileName });
      });
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
    return this.files(actor, id);
  }

  async downloadFile(actor: Actor, id: string, fileId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    await this.loadVisible(this.database, actor, id);
    const file = (
      await this.database.execute<{ file_name: string; content_type: string; storage_key: string }>(sql`
      SELECT file_name, content_type, storage_key FROM office.files WHERE id = ${fileId} AND owner_type = 'task' AND owner_id = ${id} AND deleted_at IS NULL`)
    ).rows[0];
    if (!file) throw new ApiError("NOT_FOUND", "notFound");
    return { fileName: file.file_name, contentType: file.content_type, content: await this.storage.get(file.storage_key) };
  }

  // Xóa mềm: giữ bản ghi và nội dung tệp để tra lại; người tải lên xóa khi việc chưa xong.
  async removeFile(actor: Actor, id: string, fileId: string): Promise<OfficeFileItem[]> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadVisible(transaction, actor, id);
      const file = (
        await transaction.execute<{ uploaded_by: string; file_name: string }>(sql`
        SELECT uploaded_by, file_name FROM office.files WHERE id = ${fileId} AND owner_type = 'task' AND owner_id = ${id} AND deleted_at IS NULL FOR UPDATE`)
      ).rows[0];
      if (!file) throw new ApiError("NOT_FOUND", "notFound");
      if (file.uploaded_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
      if (closedStatuses.includes(row.status)) throw new ApiError("BUSINESS_RULE", "officeTaskClosed");
      await transaction.execute(sql`UPDATE office.files SET deleted_at = now(), deleted_by = ${actor.userId} WHERE id = ${fileId}`);
      await this.event(transaction, id, actor.userId, "file_removed", { fileName: file.file_name });
    });
    return this.files(actor, id);
  }

  // Việc nền mỗi 15 phút: nhắc còn 24 giờ và vừa quá hạn, mỗi mốc một lần (QUYTAC_NGHIEPVU_358).
  async remindDue(): Promise<{ dueSoon: number; overdue: number }> {
    const now = this.clock.now().toISOString();
    return this.database.transaction(async (transaction) => {
      const dueSoon = (
        await transaction.execute<{ id: string; company_id: string; title: string; owner_user_id: string | null }>(sql`
          UPDATE office.tasks SET due_soon_notified_at = ${now}::timestamptz
          WHERE status NOT IN ('completed', 'cancelled') AND due_soon_notified_at IS NULL AND due_at IS NOT NULL
            AND due_at > ${now}::timestamptz AND due_at <= ${now}::timestamptz + interval '24 hours'
          RETURNING id, company_id, title, owner_user_id`)
      ).rows;
      const overdue = (
        await transaction.execute<{ id: string; company_id: string; title: string; owner_user_id: string | null; assigned_by: string }>(sql`
          UPDATE office.tasks SET overdue_notified_at = ${now}::timestamptz, due_soon_notified_at = COALESCE(due_soon_notified_at, ${now}::timestamptz)
          WHERE status NOT IN ('completed', 'cancelled') AND overdue_notified_at IS NULL AND due_at IS NOT NULL AND due_at <= ${now}::timestamptz
          RETURNING id, company_id, title, owner_user_id, assigned_by`)
      ).rows;
      const items: NotificationInput[] = [];
      for (const [rows, kind, prefix, includeAssigner] of [
        [dueSoon, "office_task_due_soon", "Sắp đến hạn", false],
        [overdue, "office_task_overdue", "Quá hạn", true],
      ] as const) {
        for (const row of rows) {
          const collaborators = (await transaction.execute<{ user_id: string }>(sql`SELECT user_id FROM office.task_participants WHERE task_id = ${row.id} AND role = 'collaborator'`)).rows.map(
            (item) => item.user_id,
          );
          const recipients = new Set([row.owner_user_id ?? "", ...collaborators, ...(includeAssigner && "assigned_by" in row ? [row.assigned_by] : [])]);
          recipients.delete("");
          for (const userId of recipients) items.push(this.notification(userId, row.company_id, row.id, kind, `${prefix}: ${row.title}`));
        }
      }
      await notify(transaction, items);
      return { dueSoon: dueSoon.length, overdue: overdue.length };
    });
  }
}

const statusText: Record<OfficeTaskStatus, string> = {
  new: "Mới",
  in_progress: "Đang làm",
  pending_confirmation: "Chờ xác nhận",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};
