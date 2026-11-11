// CONG_VIEC_54: Nhân sự phần 4 (MODULE_08) – tuyển dụng (API_200 đến API_204). Tệp riêng để không sửa cùng chỗ với công việc nhân sự khác.
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
// Số tiền VND dạng chuỗi, lớn hơn 0, tối đa 2 chữ số thập phân.
const money = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim();
  if (!/^\d{1,15}(\.\d{1,2})?$/.test(text) || Number(text) <= 0) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
const optionalMoney = z
  .union([z.literal(""), z.null(), money])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));
const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
// Điện thoại: số Việt Nam 10 chữ số bắt đầu bằng 0, hoặc dạng quốc tế +8 đến 15 chữ số (QUYTAC_NGHIEPVU_382).
export const phoneNumber = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.()-]/g, ""))
  .refine((value) => /^0\d{9}$/.test(value) || /^\+\d{8,15}$/.test(value), "invalidValue");

export const recruitmentContractKinds = ["probation_then_official", "fixed_term", "indefinite"] as const;
export const recruitmentReasons = ["replacement", "expansion", "new_position"] as const;
export const recruitmentRequestStatuses = ["draft", "pending", "approved", "rejected", "withdrawn", "cancelled", "completed", "closed"] as const;
export const workTypes = ["full_time", "part_time"] as const;
export const salaryDisplays = ["request_range", "custom_range", "negotiable"] as const;
export const jobPostingStatuses = ["draft", "open", "closed"] as const;
export const candidateSources = ["careers_page", "referral", "job_board", "email", "other"] as const;
export const applicationStages = ["new", "screening", "interview", "offer", "hired"] as const;
export const applicationOutcomes = ["rejected", "withdrawn"] as const;
export const applicationOutcomeReasons = ["not_qualified", "failed_interview", "declined_offer", "unreachable", "posting_closed", "other"] as const;
export const candidateEducationLevels = ["none", "elementary", "intermediate", "college", "university", "master", "doctorate"] as const;
export type RecruitmentContractKind = (typeof recruitmentContractKinds)[number];
export type RecruitmentReason = (typeof recruitmentReasons)[number];
export type RecruitmentRequestStatus = (typeof recruitmentRequestStatuses)[number];
export type WorkType = (typeof workTypes)[number];
export type SalaryDisplay = (typeof salaryDisplays)[number];
export type JobPostingStatus = (typeof jobPostingStatuses)[number];
export type CandidateSource = (typeof candidateSources)[number];
export type ApplicationStage = (typeof applicationStages)[number];
export type ApplicationOutcome = (typeof applicationOutcomes)[number];
export type ApplicationOutcomeReason = (typeof applicationOutcomeReasons)[number];
export type CandidateEducationLevel = (typeof candidateEducationLevels)[number];

// API_200: nhu cầu tuyển dụng (QUYTAC_NGHIEPVU_380).
export const saveRecruitmentRequestSchema = z
  .object({
    departmentId: z.string().uuid(),
    branchId: z.string().uuid(),
    jobTitle: z.string().trim().min(1).max(100),
    headcount: z.coerce.number().int().min(1).max(100),
    contractKind: z.enum(recruitmentContractKinds),
    salaryMin: money,
    salaryMax: money,
    neededBy: isoDate,
    reason: z.enum(recruitmentReasons),
    description: optionalText(4000),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveRecruitmentRequestRequest = z.input<typeof saveRecruitmentRequestSchema>;

export const recruitmentRequestListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    status: z.enum(recruitmentRequestStatuses).optional(),
    departmentId: z.string().uuid().optional(),
    ...pageFields,
  })
  .strict();

export const recruitmentReasonSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export interface RecruitmentRequestItem {
  id: string;
  documentNo: string | null;
  jobTitle: string;
  departmentId: string;
  departmentName: string;
  branchId: string;
  branchName: string;
  headcount: number;
  hiredCount: number;
  salaryMin: string;
  salaryMax: string;
  neededBy: string;
  status: RecruitmentRequestStatus;
  createdByName: string;
}
export type RecruitmentRequestListResponse = { data: RecruitmentRequestItem[]; page: number; pageSize: number; total: number };

export interface RecruitmentRequestResponse extends RecruitmentRequestItem {
  contractKind: RecruitmentContractKind;
  reason: RecruitmentReason;
  description: string | null;
  approvalRequestId: string | null;
  cancelReason: string | null;
  closeReason: string | null;
  createdAt: string;
  createdBy: string;
  version: number;
  postings: JobPostingItem[];
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canCancel: boolean;
  canClose: boolean;
  canCreatePosting: boolean;
}

// API_201: tin tuyển dụng (QUYTAC_NGHIEPVU_381). Nội dung là chữ thường, không nhận HTML.
const plainText = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .min(minimum)
    .max(maximum)
    .refine((value) => !/<[a-z!/]/i.test(value), "invalidValue");
export const saveJobPostingSchema = z
  .object({
    requestId: z.string().uuid(),
    title: plainText(1, 150),
    location: plainText(1, 100),
    workType: z.enum(workTypes),
    description: plainText(1, 8000),
    requirements: plainText(0, 8000)
      .nullable()
      .optional()
      .transform((value) => value || null),
    benefits: plainText(0, 8000)
      .nullable()
      .optional()
      .transform((value) => value || null),
    salaryDisplay: z.enum(salaryDisplays),
    salaryMin: optionalMoney,
    salaryMax: optionalMoney,
    deadline: isoDate,
    contactEmail: z.string().trim().pipe(z.email().max(254)),
    isPublic: z.boolean().default(true),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveJobPostingRequest = z.input<typeof saveJobPostingSchema>;

export const jobPostingListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    status: z.enum(jobPostingStatuses).optional(),
    requestId: z.string().uuid().optional(),
    ...pageFields,
  })
  .strict();
export const reopenJobPostingSchema = z.object({ deadline: isoDate }).strict();

export type StageCounts = Record<ApplicationStage | "ended", number>;
export interface JobPostingItem {
  id: string;
  requestId: string;
  requestNo: string | null;
  title: string;
  deadline: string;
  isPublic: boolean;
  status: JobPostingStatus;
  stageCounts: StageCounts;
}
export type JobPostingListResponse = { data: JobPostingItem[]; page: number; pageSize: number; total: number };

export interface ApplicationItem {
  id: string;
  candidateId: string;
  candidateName: string;
  postingId: string;
  postingTitle: string;
  source: CandidateSource;
  experienceYears: number | null;
  stage: ApplicationStage;
  outcome: ApplicationOutcome | null;
  outcomeReason: ApplicationOutcomeReason | null;
  possibleDuplicate: boolean;
  employeeId: string | null;
  createdAt: string;
  endedAt: string | null;
}

export interface JobPostingResponse extends JobPostingItem {
  location: string;
  workType: WorkType;
  description: string;
  requirements: string | null;
  benefits: string | null;
  salaryDisplay: SalaryDisplay;
  salaryMin: string | null;
  salaryMax: string | null;
  requestSalaryMin: string;
  requestSalaryMax: string;
  requestHeadcount: number;
  requestHiredCount: number;
  contactEmail: string;
  publishedAt: string | null;
  version: number;
  applications: ApplicationItem[];
  canEdit: boolean;
  canPublish: boolean;
  canClose: boolean;
  canReopen: boolean;
}

// API_202: ứng viên (QUYTAC_NGHIEPVU_383, 388). Nhập tay gửi dạng multipart: trường "data" là JSON, tệp "resume", "consentEvidence", "poolEvidence".
const candidateFields = {
  fullName: z.string().trim().min(1).max(200),
  email: z.string().trim().pipe(z.email().max(254)),
  phone: phoneNumber,
  province: optionalText(100),
  educationLevel: z.enum(candidateEducationLevels).nullable().optional(),
  experienceYears: z.coerce.number().int().min(0).max(50).nullable().optional(),
  expectedSalary: optionalMoney,
  coverLetter: optionalText(2000),
};
export const createCandidateSchema = z
  .object({
    postingId: z.string().uuid(),
    ...candidateFields,
    source: z.enum(["referral", "job_board", "email", "other"]),
    sourceNote: optionalText(200),
    consentDate: isoDate,
    poolConsentDate: isoDate.nullable().optional(),
  })
  .strict();
export type CreateCandidateRequest = z.input<typeof createCandidateSchema>;
export const updateCandidateSchema = z.object({ ...candidateFields, sourceNote: optionalText(200), version: z.number().int().positive() }).strict();
export type UpdateCandidateRequest = z.input<typeof updateCandidateSchema>;

export const candidateListQuerySchema = z
  .object({
    tab: z.enum(["all", "pool", "due"]).default("all"),
    search: z.string().trim().max(100).optional(),
    ...pageFields,
  })
  .strict();
export const addApplicationSchema = z.object({ postingId: z.string().uuid() }).strict();
export const moveStageSchema = z.object({ stage: z.enum(["new", "screening", "interview"]) }).strict();
export const endApplicationSchema = z
  .object({
    outcome: z.enum(applicationOutcomes),
    reason: z.enum(applicationOutcomeReasons).nullable().optional(),
    note: optionalText(1000),
  })
  .strict();
export const recruitmentSettingsSchema = z
  .object({
    rejectedRetentionDays: z.coerce.number().int().min(0).max(90),
    poolRetentionMonths: z.coerce.number().int().min(1).max(24),
  })
  .strict();
export type RecruitmentSettings = z.output<typeof recruitmentSettingsSchema>;
export const poolConsentSchema = z.object({ consentDate: isoDate }).strict();

export interface CandidateListItem {
  id: string;
  reference: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  latestPostingTitle: string | null;
  latestStage: ApplicationStage | null;
  latestOutcome: ApplicationOutcome | null;
  possibleDuplicate: boolean;
  poolUntil: string | null;
  eraseDue: string | null;
  erased: boolean;
}
export type CandidateListResponse = { data: CandidateListItem[]; page: number; pageSize: number; total: number };

export interface CandidateFileItem {
  id: string;
  kind: "resume" | "consent_evidence" | "erasure_evidence";
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  available: boolean;
}
export interface CandidateConsentItem {
  id: string;
  purpose: "recruitment" | "talent_pool";
  channel: "careers_page" | "manual";
  postingTitle: string | null;
  termsVersion: string | null;
  termsText: string | null;
  consentedOn: string;
  consentedAt: string;
  ip: string | null;
  evidenceFileId: string | null;
  withdrawnAt: string | null;
}
export interface CandidateResponse {
  id: string;
  reference: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  province: string | null;
  educationLevel: CandidateEducationLevel | null;
  experienceYears: number | null;
  expectedSalary: string | null;
  coverLetter: string | null;
  source: CandidateSource;
  sourceNote: string | null;
  locale: "vi" | "en";
  possibleDuplicate: boolean;
  duplicates: { id: string; fullName: string; reference: string }[];
  poolUntil: string | null;
  eraseDue: string | null;
  erasedAt: string | null;
  createdAt: string;
  version: number;
  files: CandidateFileItem[];
  consents: CandidateConsentItem[];
  applications: ApplicationItem[];
}

// API_204: trang tuyển dụng công khai (QUYTAC_NGHIEPVU_382). Chỉ trả trường được công khai.
export const careersListQuerySchema = z
  .object({
    companyId: z.string().uuid().optional(),
    location: z.string().trim().max(100).optional(),
    workType: z.enum(workTypes).optional(),
    search: z.string().trim().max(100).optional(),
    ...pageFields,
  })
  .strict();
export interface CareersPostingItem {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  location: string;
  workType: WorkType;
  salaryMin: string | null;
  salaryMax: string | null;
  negotiable: boolean;
  deadline: string;
  publishedAt: string;
}
export interface CareersListResponse {
  data: CareersPostingItem[];
  page: number;
  pageSize: number;
  total: number;
  companies: { id: string; name: string }[];
  locations: string[];
}
export interface CareersPostingResponse extends CareersPostingItem {
  description: string;
  requirements: string | null;
  benefits: string | null;
  contactEmail: string;
  terms: { version: string; recruitment: string; talentPool: string };
}
export const careersLocales = ["vi", "en"] as const;
export const careersApplySchema = z
  .object({
    ...candidateFields,
    locale: z.enum(careersLocales).default("vi"),
    termsVersion: z.string().trim().min(1).max(40),
    recruitmentConsent: z.boolean(),
    talentPoolConsent: z.boolean().default(false),
  })
  .strict();
export type CareersApplyRequest = z.input<typeof careersApplySchema>;
export interface CareersApplyResponse {
  reference: string;
  contactEmail: string;
}

// Tùy chọn cho biểu mẫu tuyển dụng (API_200): phòng ban, chi nhánh; với người quản lý tuyển dụng thêm nhu cầu đã duyệt, tin đang đăng.
export interface RecruitmentOptionsResponse {
  departments: { id: string; code: string; name: string }[];
  branches: { id: string; code: string; name: string; address: string | null }[];
  approvedRequests: { id: string; documentNo: string | null; jobTitle: string; salaryMin: string; salaryMax: string }[];
  openPostings: { id: string; title: string }[];
}
