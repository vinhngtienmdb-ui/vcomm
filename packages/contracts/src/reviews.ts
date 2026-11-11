// CONG_VIEC_54 lát L2: đánh giá hiệu suất (API_205; QUYTAC_NGHIEPVU_389). Tệp riêng để không sửa cùng chỗ với công việc nhân sự khác.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => value || null);
const threshold = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d(\.\d{1,2})?$/.test(text) || Number(text) < 1 || Number(text) > 5) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
const score = z.coerce.number().int().min(1).max(5);

export const reviewCycleStatuses = ["draft", "open", "closed", "published"] as const;
export const reviewGrades = ["A", "B", "C", "D"] as const;
export type ReviewCycleStatus = (typeof reviewCycleStatuses)[number];
export type ReviewGrade = (typeof reviewGrades)[number];
export type ReviewPhase = "goals" | "self" | "manager" | "submitted" | "excluded";

export const saveReviewTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    criteria: z
      .array(z.object({ name: z.string().trim().min(1).max(150), description: optionalText(1000), weight: z.coerce.number().int().min(1).max(100) }).strict())
      .min(1)
      .max(30),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveReviewTemplateRequest = z.input<typeof saveReviewTemplateSchema>;
export interface ReviewTemplateResponse {
  id: string;
  name: string;
  criteria: { id: string; name: string; description: string | null; weight: number }[];
  usedInCycles: number;
  version: number;
}

export const saveReviewCycleSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    periodFrom: isoDate,
    periodTo: isoDate,
    templateId: z.string().uuid(),
    goalWeight: z.coerce.number().int().min(0).max(100),
    competencyWeight: z.coerce.number().int().min(0).max(100),
    thresholdA: threshold.default("4.5"),
    thresholdB: threshold.default("3.5"),
    thresholdC: threshold.default("2.5"),
    goalDeadline: isoDate,
    selfDeadline: isoDate,
    managerDeadline: isoDate,
    allDepartments: z.boolean().default(true),
    departmentIds: z.array(z.string().uuid()).max(200).default([]),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveReviewCycleRequest = z.input<typeof saveReviewCycleSchema>;

export interface ReviewCycleItem {
  id: string;
  name: string;
  periodFrom: string;
  periodTo: string;
  templateName: string;
  goalWeight: number;
  competencyWeight: number;
  status: ReviewCycleStatus;
  reviewCount: number;
  submittedCount: number;
}
export interface ReviewListItem {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  phase: ReviewPhase;
  goalsConfirmed: boolean;
  selfSubmitted: boolean;
  managerSubmitted: boolean;
  totalScore: string | null;
  finalScore: string | null;
  grade: ReviewGrade | null;
  excludedReason: string | null;
  acknowledged: boolean;
}
export interface ReviewCycleResponse extends ReviewCycleItem {
  templateId: string;
  thresholdA: string;
  thresholdB: string;
  thresholdC: string;
  goalDeadline: string;
  selfDeadline: string;
  managerDeadline: string;
  allDepartments: boolean;
  departmentIds: string[];
  version: number;
  reviews: ReviewListItem[];
  gradeDistribution: Record<ReviewGrade, number>;
  canEdit: boolean;
  canOpen: boolean;
  canClose: boolean;
  canPublish: boolean;
}
export interface ReviewCycleOptionsResponse {
  templates: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  employees: { id: string; code: string; fullName: string }[];
  members: { id: string; fullName: string }[];
}

export const addReviewSchema = z.object({ employeeId: z.string().uuid() }).strict();
export const assignReviewerSchema = z.object({ reviewerId: z.string().uuid().nullable() }).strict();
export const excludeReviewSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export const adjustReviewSchema = z.object({ score: threshold, reason: z.string().trim().min(1).max(1000) }).strict();
export const saveReviewGoalsSchema = z
  .object({
    goals: z
      .array(z.object({ name: z.string().trim().min(1).max(200), target: optionalText(1000), weight: z.coerce.number().int().min(1).max(100) }).strict())
      .min(1)
      .max(20),
  })
  .strict();
export const saveReviewScoresSchema = z
  .object({
    goals: z.array(z.object({ id: z.string().uuid(), score: score.nullable() }).strict()).max(20),
    criteria: z.array(z.object({ id: z.string().uuid(), score: score.nullable() }).strict()).max(30),
    comment: optionalText(4000),
    submit: z.boolean().default(false),
  })
  .strict();
export type SaveReviewScoresRequest = z.input<typeof saveReviewScoresSchema>;
export const acknowledgeReviewSchema = z.object({ comment: optionalText(2000) }).strict();

export interface ReviewResponse {
  id: string;
  cycleId: string;
  cycleName: string;
  cycleStatus: ReviewCycleStatus;
  periodFrom: string;
  periodTo: string;
  goalWeight: number;
  competencyWeight: number;
  thresholds: { A: string; B: string; C: string };
  goalDeadline: string;
  selfDeadline: string;
  managerDeadline: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  reviewerName: string | null;
  phase: ReviewPhase;
  goalsConfirmedAt: string | null;
  selfSubmittedAt: string | null;
  managerSubmittedAt: string | null;
  // Điểm người chấm, điểm tổng, xếp loại: trả cho người chấm, nhân sự; nhân viên chỉ sau khi công bố.
  goals: { id: string; name: string; target: string | null; weight: number; selfScore: number | null; managerScore: number | null }[];
  criteria: { id: string; name: string; description: string | null; weight: number; selfScore: number | null; managerScore: number | null }[];
  selfComment: string | null;
  managerComment: string | null;
  goalScore: string | null;
  competencyScore: string | null;
  totalScore: string | null;
  adjustedScore: string | null;
  adjustmentReason: string | null;
  finalScore: string | null;
  grade: ReviewGrade | null;
  acknowledgedAt: string | null;
  employeeComment: string | null;
  role: { employee: boolean; reviewer: boolean; manager: boolean };
  canEditGoals: boolean;
  canConfirmGoals: boolean;
  canUnconfirmGoals: boolean;
  canSelfAssess: boolean;
  canScore: boolean;
  canReopen: boolean;
  canAdjust: boolean;
  canAcknowledge: boolean;
}
export interface MyReviewsResponse {
  own: { id: string; cycleName: string; reviewerName: string | null; phase: ReviewPhase; published: boolean; finalScore: string | null; grade: ReviewGrade | null }[];
  scoring: { id: string; cycleName: string; employeeName: string; managerDeadline: string; phase: ReviewPhase }[];
}
