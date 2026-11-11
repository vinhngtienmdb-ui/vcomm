// API_202: người phỏng vấn được giao xem ứng viên, ghi phiếu đánh giá (CONG_VIEC_54; QUYTAC_NGHIEPVU_384). Chỉ cần là thành viên công ty đang chọn.
import { Body, Controller, Get, Headers, Param, Post, Req, Res } from "@nestjs/common";
import { interviewEvaluationSchema, type MyInterviewItem, type MyInterviewResponse } from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { InterviewsService } from "./interviews.service";
import { sendFile } from "./recruitment.controller";

@Controller("hr/my-interviews")
export class InterviewerController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly interviews: InterviewsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MyInterviewItem[]> {
    return this.interviews.mine(await this.actor(request, companyId));
  }

  @Get(":id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<MyInterviewResponse> {
    return this.interviews.mineDetail(await this.actor(request, companyId), id);
  }

  @Post(":id/evaluation")
  async evaluate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<MyInterviewResponse> {
    return this.interviews.evaluate(await this.actor(request, companyId), id, interviewEvaluationSchema.parse(body));
  }

  @Get(":id/files/:fileId")
  async download(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("fileId", UuidPipe) fileId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    sendFile(response, await this.interviews.downloadResume(await this.actor(request, companyId), id, fileId));
  }
}
