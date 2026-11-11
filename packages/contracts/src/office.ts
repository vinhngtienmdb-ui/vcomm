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
  // Bảng tin: người đăng tin xóa được bình luận bất kỳ; không có thì theo canEdit.
  canDelete?: boolean;
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
  // Công văn đến được giao xử lý bằng việc này.
  incomingDocumentId: string | null;
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

// Công văn đến, đi theo Nghị định 30/2020/NĐ-CP (QUYTAC_NGHIEPVU_363 đến 366; API_188 đến API_190).
export const documentUrgencies = ["normal", "urgent", "very_urgent", "flash"] as const;
export type DocumentUrgency = (typeof documentUrgencies)[number];
export const incomingChannels = ["paper", "email", "group", "other"] as const;
export const signerAuthorities = ["", "TM.", "KT.", "TL.", "TUQ.", "Q."] as const;
export type IncomingStatus = "awaiting_registration" | "registered" | "awaiting_direction" | "processing" | "processed" | "archived" | "voided";
export type OutgoingStatus = "draft" | "pending" | "rejected" | "withdrawn" | "awaiting_number" | "numbered" | "issued" | "cancelled";

export const documentSettingsSchema = z
  .object({
    parentOrgName: z.string().trim().max(200).nullish(),
    companyDisplayName: z.string().trim().min(1).max(200),
    companyAbbreviation: z
      .string()
      .trim()
      .regex(/^[A-ZĐ0-9]{1,20}$/),
    placeName: z.string().trim().min(1).max(100),
    fontScheme: z.union([z.literal(13), z.literal(14)]),
    marginTop: z.number().int().min(20).max(25),
    marginBottom: z.number().int().min(20).max(25),
    marginLeft: z.number().int().min(30).max(35),
    marginRight: z.number().int().min(15).max(20),
    version: z.number().int().min(1).optional(),
  })
  .strict();
export type DocumentSettings = Omit<z.infer<typeof documentSettingsSchema>, "version"> & { version: number };

export const registerSchema = z.object({ name: z.string().trim().min(1).max(100), direction: z.enum(["incoming", "outgoing"]) }).strict();
export const updateRegisterSchema = z.object({ name: z.string().trim().min(1).max(100), status: z.enum(["active", "inactive"]), version: z.number().int().min(1) }).strict();
export interface RegisterItem {
  id: string;
  direction: "incoming" | "outgoing";
  name: string;
  isDefault: boolean;
  status: "active" | "inactive";
  nextNumberThisYear: number;
  version: number;
}

export const documentTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    abbreviation: z
      .string()
      .trim()
      .regex(/^[A-ZĐa-z0-9]{1,10}$/),
  })
  .strict();
export const updateDocumentTypeSchema = z.object({ status: z.enum(["active", "inactive"]) }).strict();
export interface DocumentTypeItem {
  id: string;
  name: string;
  abbreviation: string | null;
  isOfficialLetter: boolean;
  isCustom: boolean;
  status: "active" | "inactive";
}

export const registerIncomingSchema = z
  .object({
    registerId: z.uuid(),
    receivedOn: isoDate,
    sender: z.string().trim().min(1).max(300),
    symbol: z.string().trim().max(50).nullish(),
    documentDate: isoDate.nullish(),
    documentTypeName: z.string().trim().min(1).max(100),
    summary: z.string().trim().min(1).max(500),
    urgency: z.enum(documentUrgencies).default("normal"),
    dueOn: isoDate.nullish(),
    channel: z.enum(incomingChannels),
  })
  .strict();
export type RegisterIncomingInput = z.infer<typeof registerIncomingSchema>;
export const updateIncomingSchema = registerIncomingSchema
  .omit({ registerId: true })
  .extend({ version: z.number().int().min(1) })
  .strict();
// Vào sổ công văn liên công ty đang chờ: chọn sổ, ngày đến.
export const acceptIncomingSchema = z.object({ registerId: z.uuid(), receivedOn: isoDate, version: z.number().int().min(1) }).strict();
export const submitIncomingSchema = z.object({ leaderUserId: z.uuid(), note: z.string().trim().max(2000).nullish(), version: z.number().int().min(1) }).strict();
export const directIncomingSchema = z
  .object({
    action: z.enum(["assign", "forward", "archive"]),
    note: z.string().trim().max(2000).nullish(),
    ownerUserId: z.uuid().nullish(),
    collaboratorIds: z.array(z.uuid()).max(officeTaskParticipantMaximum).default([]),
    dueAt: z.iso.datetime({ offset: true }).nullish(),
    leaderUserId: z.uuid().nullish(),
    version: z.number().int().min(1),
  })
  .strict();
export const voidIncomingSchema = z.object({ reason: z.string().trim().min(1).max(1000), version: z.number().int().min(1) }).strict();

export const incomingListQuerySchema = z
  .object({
    registerId: z.uuid().optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    status: z.enum(["awaiting_registration", "registered", "awaiting_direction", "processing", "processed", "archived", "voided", "all"]).default("all"),
    urgency: z.enum(documentUrgencies).optional(),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface IncomingListItem {
  id: string;
  registerName: string | null;
  year: number | null;
  incomingNo: number | null;
  receivedOn: string | null;
  sender: string;
  symbol: string | null;
  documentDate: string | null;
  documentTypeName: string;
  summary: string;
  urgency: DocumentUrgency;
  dueOn: string | null;
  handler: OfficePerson | null;
  status: IncomingStatus;
}

export interface IncomingRouting {
  id: string;
  action: string;
  actor: OfficePerson | null;
  toUser: OfficePerson | null;
  note: string | null;
  createdAt: string;
}

export interface IncomingResponse extends IncomingListItem {
  channel: (typeof incomingChannels)[number];
  registerId: string | null;
  leader: OfficePerson | null;
  taskId: string | null;
  sourceCompanyName: string | null;
  voidReason: string | null;
  files: OfficeFileItem[];
  routings: IncomingRouting[];
  duplicateOf: { id: string; incomingNo: number | null }[];
  allowedActions: ("edit" | "submit" | "direct" | "void" | "accept" | "upload")[];
  version: number;
}

// Nội dung soạn theo thể thức: danh sách đoạn; đoạn danh sách bắt đầu bằng gạch đầu dòng.
export const documentParagraphSchema = z.object({ kind: z.enum(["paragraph", "bullet"]), text: z.string().max(5000), bold: z.boolean().default(false), italic: z.boolean().default(false) }).strict();
export type DocumentParagraph = z.infer<typeof documentParagraphSchema>;

export const saveOutgoingSchema = z
  .object({
    registerId: z.uuid(),
    documentTypeId: z.uuid(),
    departmentId: z.uuid().nullish(),
    summary: z.string().trim().min(1).max(500),
    urgency: z.enum(documentUrgencies).default("normal"),
    composeMode: z.enum(["compose", "upload"]),
    recipientLine: z.string().trim().max(500).nullish(),
    body: z.array(documentParagraphSchema).max(500).default([]),
    signerUserId: z.uuid(),
    signerAuthority: z.enum(signerAuthorities).default(""),
    signerAuthorityOf: z.string().trim().max(100).nullish(),
    signerTitle: z.string().trim().min(1).max(100),
    externalRecipients: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
    internalRecipients: z
      .array(z.object({ kind: z.enum(["user", "department", "company"]), id: z.uuid() }).strict())
      .max(50)
      .default([]),
    copies: z.number().int().min(1).max(999).default(1),
    drafterCode: z.string().trim().max(20).nullish(),
    replyToIncomingId: z.uuid().nullish(),
    version: z.number().int().min(1).optional(),
  })
  .strict();
export type SaveOutgoingInput = z.infer<typeof saveOutgoingSchema>;

export const outgoingListQuerySchema = z
  .object({
    registerId: z.uuid().optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    status: z.enum(["draft", "pending", "rejected", "withdrawn", "awaiting_number", "numbered", "issued", "cancelled", "all"]).default("all"),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface OutgoingListItem {
  id: string;
  registerName: string;
  outgoingNo: number | null;
  symbol: string | null;
  issuedOn: string | null;
  documentTypeName: string;
  summary: string;
  signer: OfficePerson;
  recipientsText: string;
  urgency: DocumentUrgency;
  status: OutgoingStatus;
}

export interface OutgoingResponse extends OutgoingListItem {
  registerId: string;
  documentTypeId: string;
  departmentId: string | null;
  departmentName: string | null;
  composeMode: "compose" | "upload";
  recipientLine: string | null;
  body: DocumentParagraph[];
  signerAuthority: (typeof signerAuthorities)[number];
  signerAuthorityOf: string | null;
  signerTitle: string;
  externalRecipients: string[];
  internalRecipients: { kind: "user" | "department" | "company"; id: string; name: string }[];
  copies: number;
  drafterCode: string | null;
  replyTo: { id: string; incomingNo: number | null; symbol: string | null } | null;
  approvalMode: "policy" | "signer" | null;
  approvalRequestId: string | null;
  decisionNote: string | null;
  cancelReason: string | null;
  createdBy: OfficePerson;
  draftFiles: OfficeFileItem[];
  signedFiles: OfficeFileItem[];
  // Ký hiệu dự kiến nếu cấp số bây giờ (văn thư).
  expectedSymbol: string | null;
  allowedActions: ("edit" | "submit" | "withdraw" | "cancel" | "decide" | "number" | "issue" | "upload_draft")[];
  version: number;
}

export const outgoingDecisionSchema = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(1000).nullish(), version: z.number().int().min(1) }).strict();
export const outgoingCancelSchema = z.object({ reason: z.string().trim().min(1).max(1000), version: z.number().int().min(1) }).strict();
export const outgoingVersionSchema = z.object({ version: z.number().int().min(1) }).strict();

export interface DocumentOptions {
  registers: RegisterItem[];
  documentTypes: DocumentTypeItem[];
  departments: { id: string; name: string; code: string }[];
  companies: { id: string; name: string }[];
  leaders: OfficePerson[];
  settings: DocumentSettings;
  canClerk: boolean;
}

// Bảng tin nội bộ (CHUC_NANG_185; QUYTAC_NGHIEPVU_367; API_191).
// Nội dung dạng văn bản có đánh dấu đơn giản: **đậm**, *nghiêng*, [chữ](https://…), dòng bắt đầu "- " là danh sách; hiển thị không dùng HTML.
export const postMaximumPinned = 5;
export const postAudienceTypes = ["company", "units", "group"] as const;
export type PostAudienceType = (typeof postAudienceTypes)[number];
// Đường dẫn trong nội dung chỉ cho http, https (lọc mã độc).
const postLinkPattern = /\[[^\]]*\]\(([^)\s]*)\)/g;
export const postBodyLinksSafe = (body: string) => [...body.matchAll(postLinkPattern)].every((match) => /^https?:\/\/[^\s]+$/i.test(match[1] ?? ""));

export const savePostSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(20000).refine(postBodyLinksSafe, { message: "officePostLinkInvalid" }),
    audienceType: z.enum(postAudienceTypes),
    branchIds: z.array(z.uuid()).max(100).default([]),
    departmentIds: z.array(z.uuid()).max(100).default([]),
    pinned: z.boolean().default(false),
    // Không gửi là đăng ngay; thời điểm có múi giờ.
    publishAt: z.iso.datetime({ offset: true }).nullish(),
    expiresAt: z.iso.datetime({ offset: true }).nullish(),
    requiresAcknowledgement: z.boolean().default(false),
    allowComments: z.boolean().default(true),
    version: z.number().int().min(1).optional(),
  })
  .strict();
export type SavePostInput = z.infer<typeof savePostSchema>;

export const postListQuerySchema = z
  .object({
    // feed: tin mình nhận; manage: tin của công ty (người có quyền đăng), kể cả hẹn giờ, hết hạn, thu hồi.
    view: z.enum(["feed", "manage"]).default("feed"),
    unread: z.enum(["true", "false"]).optional(),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type PostState = "scheduled" | "published" | "expired" | "revoked";

export interface PostListItem {
  id: string;
  title: string;
  excerpt: string;
  author: OfficePerson;
  companyName: string;
  audienceType: PostAudienceType;
  audienceText: string;
  pinned: boolean;
  publishAt: string;
  expiresAt: string | null;
  requiresAcknowledgement: boolean;
  state: PostState;
  isRead: boolean;
  acknowledgedAt: string | null;
  commentCount: number;
  fileCount: number;
}

export interface PostResponse extends PostListItem {
  body: string;
  branchIds: string[];
  departmentIds: string[];
  allowComments: boolean;
  editedAt: string | null;
  files: OfficeFileItem[];
  comments: OfficeTaskComment[];
  // Người đăng, người có quyền đăng cùng phạm vi xem thống kê đọc.
  readStats: { recipients: number; read: number; acknowledged: number } | null;
  allowedActions: ("edit" | "revoke" | "acknowledge" | "comment" | "upload" | "view_readers")[];
  version: number;
}

export interface PostReader {
  person: OfficePerson;
  readAt: string | null;
  acknowledgedAt: string | null;
}

export interface PostOptions {
  branches: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  canPost: boolean;
  canPostGroup: boolean;
  pinnedCount: number;
}

export const postRevokeSchema = z.object({ version: z.number().int().min(1) }).strict();
