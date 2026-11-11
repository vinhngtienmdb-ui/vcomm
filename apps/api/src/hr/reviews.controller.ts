// API_205: đánh giá hiệu suất (CONG_VIEC_54; QUYTAC_NGHIEPVU_389). Chỉ cần là thành viên công ty đang chọn; quyền nhân sự, người chấm, nhân viên kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Req } from "@nestjs/common";
import {
  acknowledgeReviewSchema,
  addReviewSchema,
  adjustReviewSchema,
  assignReviewerSchema,
  excludeReviewSchema,
  saveReviewCycleSchema,
  saveReviewGoalsSchema,
  saveReviewScoresSchema,
  saveReviewTemplateSchema,
  type MyReviewsResponse,
  type ReviewCycleItem,
  type ReviewCycleOptionsResponse,
  type ReviewCycleResponse,
  type ReviewResponse,
  type ReviewTemplateResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ReviewsService } from "./reviews.service";

@Controller("hr")
export class ReviewsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly reviews: ReviewsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("review-templates")
  async templates(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ReviewTemplateResponse[]> {
    return this.reviews.templates(await this.actor(request, companyId));
  }

  @Post("review-templates")
  async createTemplate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewTemplateResponse> {
    return this.reviews.saveTemplate(await this.actor(request, companyId), null, saveReviewTemplateSchema.parse(body));
  }

  @Patch("review-templates/:id")
  async updateTemplate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewTemplateResponse> {
    return this.reviews.saveTemplate(await this.actor(request, companyId), id, saveReviewTemplateSchema.parse(body));
  }

  @Post("review-templates/:id/copy")
  async copyTemplate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewTemplateResponse> {
    return this.reviews.copyTemplate(await this.actor(request, companyId), id);
  }

  @Get("review-cycles")
  async cycles(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleItem[]> {
    return this.reviews.cycles(await this.actor(request, companyId));
  }

  @Get("review-cycle-options")
  async newCycleOptions(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleOptionsResponse> {
    return this.reviews.cycleOptions(await this.actor(request, companyId), null);
  }

  @Post("review-cycles")
  async createCycle(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.saveCycle(await this.actor(request, companyId), null, saveReviewCycleSchema.parse(body));
  }

  @Get("review-cycles/:id")
  async cycle(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.cycleDetail(await this.actor(request, companyId), id);
  }

  @Get("review-cycles/:id/options")
  async cycleOptions(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleOptionsResponse> {
    return this.reviews.cycleOptions(await this.actor(request, companyId), id);
  }

  @Patch("review-cycles/:id")
  async updateCycle(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.saveCycle(await this.actor(request, companyId), id, saveReviewCycleSchema.parse(body));
  }

  @Post("review-cycles/:id/open")
  async open(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.openCycle(await this.actor(request, companyId), id);
  }

  @Post("review-cycles/:id/close")
  async close(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.closeCycle(await this.actor(request, companyId), id);
  }

  @Post("review-cycles/:id/publish")
  async publish(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.publishCycle(await this.actor(request, companyId), id);
  }

  @Post("review-cycles/:id/reviews")
  async addReview(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.addReview(await this.actor(request, companyId), id, addReviewSchema.parse(body).employeeId);
  }

  @Get("my-reviews")
  async mine(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MyReviewsResponse> {
    return this.reviews.mine(await this.actor(request, companyId));
  }

  @Get("reviews/:id")
  async review(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    return this.reviews.review(await this.actor(request, companyId), id);
  }

  @Put("reviews/:id/goals")
  async goals(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    return this.reviews.saveGoals(await this.actor(request, companyId), id, saveReviewGoalsSchema.parse(body));
  }

  @Post("reviews/:id/goals/confirm")
  async confirmGoals(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    return this.reviews.confirmGoals(await this.actor(request, companyId), id, true);
  }

  @Post("reviews/:id/goals/reopen")
  async reopenGoals(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    return this.reviews.confirmGoals(await this.actor(request, companyId), id, false);
  }

  @Put("reviews/:id/self-assessment")
  async selfAssessment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    return this.reviews.saveScores(await this.actor(request, companyId), id, "self", saveReviewScoresSchema.parse(body));
  }

  @Put("reviews/:id/manager-assessment")
  async managerAssessment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    return this.reviews.saveScores(await this.actor(request, companyId), id, "manager", saveReviewScoresSchema.parse(body));
  }

  @Post("reviews/:id/reopen")
  async reopen(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    return this.reviews.reopen(await this.actor(request, companyId), id);
  }

  @Post("reviews/:id/adjust")
  async adjust(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    const input = adjustReviewSchema.parse(body);
    return this.reviews.adjust(await this.actor(request, companyId), id, input.score, input.reason);
  }

  @Post("reviews/:id/exclude")
  async exclude(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.exclude(await this.actor(request, companyId), id, excludeReviewSchema.parse(body).reason);
  }

  @Put("reviews/:id/reviewer")
  async reviewer(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewCycleResponse> {
    return this.reviews.assignReviewer(await this.actor(request, companyId), id, assignReviewerSchema.parse(body).reviewerId);
  }

  @Post("reviews/:id/acknowledge")
  async acknowledge(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReviewResponse> {
    return this.reviews.acknowledge(await this.actor(request, companyId), id, acknowledgeReviewSchema.parse(body ?? {}).comment);
  }
}
