// API_71, API_72: đối tác dùng chung tập đoàn, hồ sơ đối tác của công ty (CONG_VIEC_06).
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import {
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
import { PartnersService } from "./partners.service";

const statusOf = (request: AuthenticatedRequest) => (request.path.endsWith("/deactivate") ? "inactive" : "active");

@Controller("crm")
export class CrmController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly partners: PartnersService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "crm.access", "crm.partner.view");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
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

  @Put("partners/:id/profile")
  async saveProfile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PartnerResponse> {
    return this.partners.saveProfile(await this.actor(request, companyId), id, savePartnerProfileSchema.parse(body));
  }
}
