// API_71, API_72: đối tác dùng chung tập đoàn, hồ sơ đối tác của công ty (CONG_VIEC_06).
import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  createVisitSchema,
  visitListQuerySchema,
  visitPhotoMaximumBytes,
  visitPhotoMaximumCount,
  type VisitItem,
  customerAssignmentListQuerySchema,
  saveCustomerAssignmentSchema,
  type CustomerAssignmentListItem,
  type CustomerAssignmentOptionsResponse,
  type CustomerAssignmentResponse,
  type PartnerOwnerHistoryItem,
  type PartnerSummaryResponse,
  partnerListQuerySchema,
  partnerLookupQuerySchema,
  savePartnerProfileSchema,
  savePartnerSchema,
  versionSchema,
  type PageResponse,
  type PartnerListItem,
  type PartnerLookupResponse,
  type PartnerProfileOptionsResponse,
  type PartnerResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { CustomerAssignmentsService } from "./customer-assignments.service";
import { PartnersService } from "./partners.service";
import { type UploadedPhoto, VisitsService } from "./visits.service";

const statusOf = (request: AuthenticatedRequest) => (request.path.endsWith("/deactivate") ? "inactive" : "active");

@Controller("crm")
export class CrmController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly partners: PartnersService,
    private readonly assignments: CustomerAssignmentsService,
    private readonly visits: VisitsService,
  ) {}

  // API_114: ghé thăm khách (CONG_VIEC_22). Ảnh giữ trong bộ nhớ rồi ghi kho tệp; giới hạn 5 MB kiểm ở dịch vụ để báo đúng thông báo.
  @Post("visits")
  @UseInterceptors(FilesInterceptor("photos", visitPhotoMaximumCount + 1, { limits: { fileSize: visitPhotoMaximumBytes * 2 } }))
  async createVisit(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
    @UploadedFiles() photos: UploadedPhoto[] | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<VisitItem> {
    return this.visits.create(await this.actor(request, companyId), createVisitSchema.parse(body), photos ?? []);
  }

  @Get("visits")
  async visitList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<VisitItem>> {
    return this.visits.list(await this.actor(request, companyId), visitListQuerySchema.parse(query));
  }

  @Get("visits/:id")
  async visitDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<VisitItem> {
    return this.visits.detail(await this.actor(request, companyId), id);
  }

  @Get("visits/:id/photos/:photoId")
  async visitPhoto(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("photoId", UuidPipe) photoId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    const file = await this.visits.photo(await this.actor(request, companyId), id, photoId);
    response.setHeader("content-type", file.contentType);
    response.setHeader("cache-control", "private, max-age=3600");
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "crm.access", "crm.partner.view");
    return {
      userId: request.auth.userId,
      companyId,
      client: clientInfo(request),
    };
  }

  @Get("partners")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<PartnerListItem>> {
    return this.partners.list(await this.actor(request, companyId), partnerListQuerySchema.parse(query));
  }

  @Get("partners/lookup")
  async lookup(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PartnerLookupResponse> {
    const parsed = partnerLookupQuerySchema.parse(query);
    return this.partners.lookup(await this.actor(request, companyId), parsed.taxCode, parsed.citizenId);
  }

  @Get("partner-profile-options")
  async profileOptions(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PartnerProfileOptionsResponse> {
    return this.partners.profileOptions(await this.actor(request, companyId));
  }

  @Post("partners")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PartnerResponse> {
    return this.partners.create(await this.actor(request, companyId), savePartnerSchema.parse(body));
  }

  @Get("partners/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PartnerResponse> {
    return this.partners.detail(await this.actor(request, companyId), id);
  }

  @Patch("partners/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PartnerResponse> {
    return this.partners.update(await this.actor(request, companyId), id, savePartnerSchema.parse(body));
  }

  @Post(["partners/:id/deactivate", "partners/:id/activate"])
  async setStatus(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PartnerResponse> {
    return this.partners.setStatus(await this.actor(request, companyId), id, statusOf(request), versionSchema.parse(body).version);
  }

  @Get("partners/:id/identity")
  async identity(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<{ citizenId: string | null }> {
    return this.partners.identity(await this.actor(request, companyId), id);
  }

  // CONG_VIEC_21: nhận đối tác có sẵn làm khách của mình (QUYTAC_NGHIEPVU_135).
  @Post("partners/:id/claim")
  async claim(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PartnerResponse> {
    return this.partners.claim(await this.actor(request, companyId), id);
  }

  @Put("partners/:id/profile")
  async saveProfile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PartnerResponse> {
    return this.partners.saveProfile(await this.actor(request, companyId), id, savePartnerProfileSchema.parse(body));
  }

  // API_113: tóm tắt khách cho ứng dụng nhân viên kinh doanh (CONG_VIEC_22).
  @Get("partners/:id/summary")
  async summary(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PartnerSummaryResponse> {
    return this.partners.summary(await this.actor(request, companyId), id);
  }

  // API_111: lịch sử phụ trách (CONG_VIEC_21).
  @Get("partners/:id/owner-history")
  async ownerHistory(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PartnerOwnerHistoryItem[]> {
    return this.assignments.history(await this.actor(request, companyId), id);
  }

  // API_110: phiếu giao khách (CONG_VIEC_21).
  @Get("customer-assignments")
  async assignmentList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<CustomerAssignmentListItem>> {
    return this.assignments.list(await this.actor(request, companyId), customerAssignmentListQuerySchema.parse(query));
  }

  @Get("customer-assignment-options")
  async assignmentOptions(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CustomerAssignmentOptionsResponse> {
    return this.assignments.options(await this.actor(request, companyId));
  }

  @Post("customer-assignments")
  async assignmentCreate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CustomerAssignmentResponse> {
    return this.assignments.create(await this.actor(request, companyId), saveCustomerAssignmentSchema.parse(body));
  }

  @Get("customer-assignments/:id")
  async assignmentDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<CustomerAssignmentResponse> {
    return this.assignments.detail(await this.actor(request, companyId), id);
  }

  @Patch("customer-assignments/:id")
  async assignmentUpdate(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<CustomerAssignmentResponse> {
    return this.assignments.update(await this.actor(request, companyId), id, saveCustomerAssignmentSchema.parse(body));
  }

  @Post("customer-assignments/:id/discard")
  @HttpCode(204)
  async assignmentDiscard(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.assignments.discard(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Post("customer-assignments/:id/submit")
  async assignmentSubmit(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<CustomerAssignmentResponse> {
    return this.assignments.submit(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Post("customer-assignments/:id/withdraw")
  async assignmentWithdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<CustomerAssignmentResponse> {
    return this.assignments.withdraw(await this.actor(request, companyId), id);
  }
}
