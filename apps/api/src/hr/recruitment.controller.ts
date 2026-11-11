// API_200 đến API_202: nhu cầu tuyển dụng, tin tuyển dụng, ứng viên (CONG_VIEC_54). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, Req, Res, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
  addApplicationSchema,
  candidateListQuerySchema,
  createCandidateSchema,
  endApplicationSchema,
  jobPostingListQuerySchema,
  moveStageSchema,
  recruitmentReasonSchema,
  recruitmentRequestListQuerySchema,
  recruitmentSettingsSchema,
  reopenJobPostingSchema,
  saveJobPostingSchema,
  saveRecruitmentRequestSchema,
  updateCandidateSchema,
  type CandidateListResponse,
  type CandidateResponse,
  type JobPostingListResponse,
  type JobPostingResponse,
  type RecruitmentOptionsResponse,
  type RecruitmentRequestListResponse,
  type RecruitmentRequestResponse,
  type RecruitmentSettings,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { CandidatesService } from "./candidates.service";
import type { UploadedFile } from "./employees.service";
import { contentDisposition } from "./hr.controller";
import { RecruitmentService } from "./recruitment.service";

type CandidateUploads = { resume?: UploadedFile[]; consentEvidence?: UploadedFile[]; poolEvidence?: UploadedFile[] };
// Biểu mẫu nhiều trường gửi dạng multipart: trường "data" là JSON.
export function formData(body: unknown): unknown {
  const raw = (body as { data?: unknown } | undefined)?.data;
  if (typeof raw !== "string") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { data: "required" } });
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { data: "invalidValue" } });
  }
}
export function sendFile(response: Response, file: { fileName: string; contentType: string; content: Buffer }): void {
  response.setHeader("content-type", file.contentType);
  response.setHeader("content-disposition", contentDisposition(file.fileName));
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("cache-control", "no-store");
  response.send(file.content);
}
// Multer chỉ cắt tệp quá lớn bất thường; giới hạn 10 MB kiểm ở dịch vụ để trả lỗi theo ô.
export const uploadLimits = { fileSize: 20 * 1024 * 1024, files: 3 };

@Controller("hr")
export class RecruitmentController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly recruitment: RecruitmentService,
    private readonly candidates: CandidatesService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "hr.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // ---------- API_200 ----------
  @Get("recruitment-options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<RecruitmentOptionsResponse> {
    return this.recruitment.options(await this.actor(request, companyId));
  }

  @Get("recruitment-requests")
  async listRequests(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<RecruitmentRequestListResponse> {
    return this.recruitment.listRequests(await this.actor(request, companyId), recruitmentRequestListQuerySchema.parse(query));
  }

  @Get("recruitment-requests/:id")
  async requestDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RecruitmentRequestResponse> {
    return this.recruitment.requestDetail(await this.actor(request, companyId), id);
  }

  @Post("recruitment-requests")
  async createRequest(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RecruitmentRequestResponse> {
    return this.recruitment.createRequest(await this.actor(request, companyId), saveRecruitmentRequestSchema.parse(body));
  }

  @Patch("recruitment-requests/:id")
  async updateRequest(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<RecruitmentRequestResponse> {
    return this.recruitment.updateRequest(await this.actor(request, companyId), id, saveRecruitmentRequestSchema.parse(body));
  }

  @Post("recruitment-requests/:id/submit")
  async submitRequest(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RecruitmentRequestResponse> {
    return this.recruitment.submitRequest(await this.actor(request, companyId), id);
  }

  @Post("recruitment-requests/:id/withdraw")
  async withdrawRequest(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RecruitmentRequestResponse> {
    return this.recruitment.withdrawRequest(await this.actor(request, companyId), id);
  }

  @Post("recruitment-requests/:id/cancel")
  async cancelRequest(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<RecruitmentRequestResponse> {
    return this.recruitment.cancelRequest(await this.actor(request, companyId), id, recruitmentReasonSchema.parse(body).reason);
  }

  @Post("recruitment-requests/:id/close")
  async closeRequest(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RecruitmentRequestResponse> {
    return this.recruitment.closeRequest(await this.actor(request, companyId), id, recruitmentReasonSchema.parse(body).reason);
  }

  // ---------- API_201 ----------
  @Get("job-postings")
  async listPostings(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<JobPostingListResponse> {
    return this.recruitment.listPostings(await this.actor(request, companyId), jobPostingListQuerySchema.parse(query));
  }

  @Get("job-postings/:id")
  async postingDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<JobPostingResponse> {
    return this.recruitment.postingDetail(await this.actor(request, companyId), id);
  }

  @Post("job-postings")
  async createPosting(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<JobPostingResponse> {
    return this.recruitment.createPosting(await this.actor(request, companyId), saveJobPostingSchema.parse(body));
  }

  @Patch("job-postings/:id")
  async updatePosting(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<JobPostingResponse> {
    return this.recruitment.updatePosting(await this.actor(request, companyId), id, saveJobPostingSchema.parse(body));
  }

  @Post("job-postings/:id/publish")
  async publishPosting(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<JobPostingResponse> {
    return this.recruitment.publishPosting(await this.actor(request, companyId), id);
  }

  @Post("job-postings/:id/close")
  async closePosting(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<JobPostingResponse> {
    return this.recruitment.closePosting(await this.actor(request, companyId), id);
  }

  @Post("job-postings/:id/reopen")
  async reopenPosting(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<JobPostingResponse> {
    return this.recruitment.reopenPosting(await this.actor(request, companyId), id, reopenJobPostingSchema.parse(body).deadline);
  }

  // ---------- API_202 ----------
  @Get("candidates")
  async listCandidates(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<CandidateListResponse> {
    return this.candidates.list(await this.actor(request, companyId), candidateListQuerySchema.parse(query));
  }

  @Get("candidates/settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<RecruitmentSettings> {
    return this.candidates.settings(await this.actor(request, companyId));
  }

  @Put("candidates/settings")
  async saveSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RecruitmentSettings> {
    return this.candidates.saveSettings(await this.actor(request, companyId), recruitmentSettingsSchema.parse(body));
  }

  @Get("candidates/:id")
  async candidateDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<CandidateResponse> {
    return this.candidates.detail(await this.actor(request, companyId), id);
  }

  @Post("candidates")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "resume", maxCount: 1 },
        { name: "consentEvidence", maxCount: 1 },
        { name: "poolEvidence", maxCount: 1 },
      ],
      { limits: uploadLimits },
    ),
  )
  async createCandidate(
    @Req() request: AuthenticatedRequest,
    @UploadedFiles() files: CandidateUploads | undefined,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<CandidateResponse> {
    const actor = await this.actor(request, companyId);
    return this.candidates.create(actor, createCandidateSchema.parse(formData(body)), {
      resume: files?.resume?.[0],
      consentEvidence: files?.consentEvidence?.[0],
      poolEvidence: files?.poolEvidence?.[0],
    });
  }

  @Patch("candidates/:id")
  async updateCandidate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CandidateResponse> {
    return this.candidates.update(await this.actor(request, companyId), id, updateCandidateSchema.parse(body));
  }

  @Post("candidates/:id/applications")
  async addApplication(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CandidateResponse> {
    return this.candidates.addApplication(await this.actor(request, companyId), id, addApplicationSchema.parse(body).postingId);
  }

  @Get("candidate-files/:id")
  async downloadFile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    sendFile(response, await this.candidates.downloadFile(await this.actor(request, companyId), id));
  }

  @Post("applications/:id/stage")
  async moveStage(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CandidateResponse> {
    return this.candidates.moveStage(await this.actor(request, companyId), id, moveStageSchema.parse(body).stage);
  }

  @Post("applications/:id/end")
  async endApplication(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CandidateResponse> {
    return this.candidates.endApplication(await this.actor(request, companyId), id, endApplicationSchema.parse(body));
  }
}
