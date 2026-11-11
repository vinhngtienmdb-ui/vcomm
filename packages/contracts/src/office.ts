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

export const officeTaskActions = ["start", "report_done", "confirm", "return", "cancel"] as const;
export type OfficeTaskAction = (typeof officeTaskActions)[number];

export const officeTaskTransitionSchema = z
  .object({
    action: z.enum(officeTaskActions),
    reason: z.string().trim().min(1).max(1000).nullish(),
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
  // Thao tác người xem được làm: theo vai trò trên việc và trạng thái.
  allowedActions: (OfficeTaskAction | "edit" | "progress" | "add_child")[];
}

export const officeCommentSchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict();

export const officePeopleQuerySchema = z.object({ search: z.string().trim().min(1).max(100) }).strict();
