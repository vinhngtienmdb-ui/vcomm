// Văn phòng số (CONG_VIEC_52, MODULE_13): hợp đồng dữ liệu công việc (API_184, API_185).
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const officeTaskStatuses = ["new", "in_progress", "pending_confirmation", "completed", "cancelled"] as const;
export type OfficeTaskStatus = (typeof officeTaskStatuses)[number];
export const officeTaskPriorities = ["low", "normal", "high", "urgent"] as const;
export type OfficeTaskPriority = (typeof officeTaskPriorities)[number];
export const officeTaskParticipantMaximum = 20;

// Tệp của Văn phòng số: tối đa 20 MB (QUYTAC_NGHIEPVU_359).
export const officeFileMaximumBytes = 20 * 1024 * 1024;
export const officeFileExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "jpeg", "png", "txt", "zip"] as const;

const userIdList = z.array(z.uuid()).max(officeTaskParticipantMaximum);

// API_184: lập việc (QUYTAC_NGHIEPVU_356, 358).
export const createOfficeTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10000).nullish(),
    ownerUserId: z.uuid(),
    collaboratorIds: userIdList.default([]),
    followerIds: userIdList.default([]),
    startDate: isoDate.nullish(),
    dueAt: z.iso.datetime({ offset: true }).nullish(),
    priority: z.enum(officeTaskPriorities).default("normal"),
    parentId: z.uuid().nullish(),
  })
  .strict();
export type CreateOfficeTaskInput = z.infer<typeof createOfficeTaskSchema>;

export const updateOfficeTaskSchema = createOfficeTaskSchema
  .omit({ parentId: true })
  .extend({ version: z.number().int().min(1) })
  .strict();
export type UpdateOfficeTaskInput = z.infer<typeof updateOfficeTaskSchema>;

export const officeTaskActions = ["start", "report_done", "confirm", "return", "cancel", "claim"] as const;
export type OfficeTaskAction = (typeof officeTaskActions)[number];

export const officeTaskTransitionSchema = z
  .object({
    action: z.enum(officeTaskActions),
    reason: z.string().trim().min(1).max(1000).nullish(),
    // Kết quả khi báo xong việc của bước quy trình (QUYTAC_NGHIEPVU_362).
    outcome: z.string().trim().min(1).max(50).nullish(),
    version: z.number().int().min(1),
  })
  .strict();

export const officeTaskProgressSchema = z.object({ progress: z.number().int().min(0).max(100), version: z.number().int().min(1) }).strict();

export const officeTaskListQuerySchema = z
  .object({
    view: z.enum(["mine", "assigned", "following", "company"]).default("mine"),
    status: z.enum([...officeTaskStatuses, "open", "all"]).default("open"),
    due: z.enum(["overdue", "today", "week"]).optional(),
    priority: z.enum(officeTaskPriorities).optional(),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type OfficeTaskListQuery = z.infer<typeof officeTaskListQuerySchema>;

export interface OfficePerson {
  id: string;
  fullName: string;
  companyId: string | null;
  companyName: string | null;
  departmentName: string | null;
}

export interface OfficeTaskListItem {
  id: string;
  companyId: string;
  companyName: string;
  parentId: string | null;
  title: string;
  owner: OfficePerson | null;
  assignedBy: OfficePerson;
  dueAt: string | null;
  priority: OfficeTaskPriority;
  progress: number;
  status: OfficeTaskStatus;
  overdue: boolean;
}

export interface OfficeFileItem {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: OfficePerson;
  createdAt: string;
  canDelete: boolean;
}

export interface OfficeTaskComment {
  id: string;
  author: OfficePerson;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  canEdit: boolean;
}

export interface OfficeTaskEvent {
  id: string;
  actor: OfficePerson | null;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface OfficeTaskResponse extends OfficeTaskListItem {
  description: string | null;
  startDate: string | null;
  collaborators: OfficePerson[];
  followers: OfficePerson[];
  statusReason: string | null;
  completedAt: string | null;
  createdAt: string;
  version: number;
  children: OfficeTaskListItem[];
  // Việc của bước quy trình: phiên, tên bước, các kết quả để chọn khi báo xong; vai trò được nhận việc khi chưa có chủ trì.
  workflow: { runId: string; runNo: string; stepName: string; outcomes: string[]; instructions: string | null; candidateRoleName: string | null } | null;
  // Thao tác người xem được làm: theo vai trò trên việc và trạng thái.
  allowedActions: (OfficeTaskAction | "edit" | "progress" | "add_child")[];
}

export const officeCommentSchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict();

export const officePeopleQuerySchema = z.object({ search: z.string().trim().min(1).max(100) }).strict();

// Quy trình theo mẫu (QUYTAC_NGHIEPVU_360 đến 362; API_186, API_187).
export const workflowFieldTypes = ["text", "number", "date", "select", "boolean", "user"] as const;
export type WorkflowFieldType = (typeof workflowFieldTypes)[number];
export const workflowOperators = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;
export type WorkflowOperator = (typeof workflowOperators)[number];
export const workflowEnd = "end";
export const workflowStepMaximumRuns = 100;

const workflowKey = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

export const workflowFieldSchema = z
  .object({
    key: workflowKey,
    label: z.string().trim().min(1).max(100),
    type: z.enum(workflowFieldTypes),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
  })
  .strict();
export type WorkflowField = z.infer<typeof workflowFieldSchema>;

export const workflowAssigneeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user"), userId: z.uuid() }).strict(),
  z.object({ type: z.literal("role"), roleId: z.uuid() }).strict(),
  z.object({ type: z.literal("initiator_manager") }).strict(),
  z.object({ type: z.literal("initiator") }).strict(),
  z.object({ type: z.literal("field"), fieldKey: workflowKey }).strict(),
]);
export type WorkflowAssignee = z.infer<typeof workflowAssigneeSchema>;

export const workflowConditionSchema = z.object({ fieldKey: workflowKey, operator: z.enum(workflowOperators), value: z.string().trim().max(200) }).strict();
export type WorkflowCondition = z.infer<typeof workflowConditionSchema>;

const workflowTargets = z
  .array(z.union([workflowKey, z.literal(workflowEnd)]))
  .min(1)
  .max(10);

export const workflowTransitionSchema = z
  .object({
    // Kết quả của bước; null là mọi kết quả.
    outcome: z.string().trim().min(1).max(50).nullable(),
    condition: workflowConditionSchema.nullable().default(null),
    targets: workflowTargets,
  })
  .strict();
export type WorkflowTransition = z.infer<typeof workflowTransitionSchema>;

export const workflowStepSchema = z
  .object({
    key: workflowKey,
    name: z.string().trim().min(1).max(100),
    instructions: z.string().trim().max(2000).nullish(),
    kind: z.enum(["task", "join"]).default("task"),
    days: z.number().int().min(1).max(365),
    assignee: workflowAssigneeSchema,
    outcomes: z.array(z.string().trim().min(1).max(50)).min(1).max(5),
    transitions: z.array(workflowTransitionSchema).max(10).default([]),
    // Trường hợp còn lại (bắt buộc khi kích hoạt).
    otherwise: workflowTargets.nullable().default(null),
  })
  .strict();
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowDefinitionSchema = z
  .object({
    fields: z.array(workflowFieldSchema).max(30).default([]),
    steps: z.array(workflowStepSchema).min(1).max(30),
    firstStepKey: workflowKey,
    starterDepartmentIds: z.array(z.uuid()).max(50).default([]),
  })
  .strict();
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

export const saveWorkflowTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).nullish(),
    definition: workflowDefinitionSchema,
    version: z.number().int().min(1).optional(),
  })
  .strict();
export type SaveWorkflowTemplateInput = z.infer<typeof saveWorkflowTemplateSchema>;

export type WorkflowTemplateStatus = "draft" | "active" | "inactive";

export interface WorkflowValidationIssue {
  stepKey: string | null;
  code:
    | "noFirstStep"
    | "duplicateKey"
    | "unknownTarget"
    | "unreachable"
    | "noPathToEnd"
    | "missingOtherwise"
    | "unknownOutcome"
    | "joinNeedsTwoInputs"
    | "unknownField"
    | "fieldTypeMismatch"
    | "fieldNotUser"
    | "unknownRole"
    | "inactiveUser"
    | "unknownDepartment"
    | "duplicateOutcome"
    | "selectNeedsOptions";
}

export interface WorkflowTemplateListItem {
  id: string;
  name: string;
  status: WorkflowTemplateStatus;
  activeVersionNo: number | null;
  hasDraft: boolean;
  runningCount: number;
}

export interface WorkflowTemplateResponse extends WorkflowTemplateListItem {
  description: string | null;
  // Bản đang sửa: bản nháp nếu có, ngược lại bản đang dùng.
  editingVersionNo: number;
  editingIsDraft: boolean;
  definition: WorkflowDefinition;
  issues: WorkflowValidationIssue[];
  // Người được chọn làm người thực hiện cụ thể trong các bước, để hiển thị tên.
  people: OfficePerson[];
  version: number;
}

// Mẫu được khởi tạo (theo phòng ban của người dùng).
export interface WorkflowStartOption {
  templateId: string;
  name: string;
  description: string | null;
  versionNo: number;
  fields: WorkflowField[];
}

export const startWorkflowRunSchema = z
  .object({
    templateId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    values: z.record(z.string(), z.union([z.string().max(2000), z.boolean(), z.null()])).default({}),
  })
  .strict();

export type WorkflowRunStatus = "running" | "blocked" | "completed" | "cancelled";
export type WorkflowStepInstanceStatus = "open" | "waiting" | "blocked" | "done" | "cancelled";

export const workflowRunListQuerySchema = z
  .object({
    scope: z.enum(["mine", "involved", "company"]).default("mine"),
    status: z.enum(["running", "blocked", "completed", "cancelled", "all"]).default("all"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface WorkflowRunListItem {
  id: string;
  runNo: string;
  title: string;
  templateName: string;
  initiator: OfficePerson;
  openSteps: string[];
  status: WorkflowRunStatus;
  createdAt: string;
}

export interface WorkflowStepInstanceItem {
  id: string;
  stepKey: string;
  stepName: string;
  status: WorkflowStepInstanceStatus;
  taskId: string | null;
  owner: OfficePerson | null;
  outcome: string | null;
  blockedReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WorkflowRunResponse extends WorkflowRunListItem {
  templateId: string;
  versionNo: number;
  definition: WorkflowDefinition;
  values: Record<string, string | boolean | null>;
  valueLabels: Record<string, string>;
  steps: WorkflowStepInstanceItem[];
  cancelReason: string | null;
  completedAt: string | null;
  canCancel: boolean;
  canAssign: boolean;
  version: number;
}

export const assignWorkflowStepSchema = z.object({ stepInstanceId: z.uuid(), userId: z.uuid(), version: z.number().int().min(1) }).strict();
export const cancelWorkflowRunSchema = z.object({ reason: z.string().trim().min(1).max(1000), version: z.number().int().min(1) }).strict();

// Danh mục cho trình thiết kế mẫu: vai trò dùng được ở công ty, phòng ban đang dùng.
export interface WorkflowDesignOptions {
  roles: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}
