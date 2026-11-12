// API_301 đến API_303 (CONG_VIEC_65): quản trị đối tác liên minh điểm trên web-crm; quyền xét tại công ty vận hành sàn (QUYTAC_NGHIEPVU_551).
// API_306: người mua liên kết số thành viên đối tác trên ứng dụng VComm.
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  buyerPartnerLinkSchema,
  buyerPartnerLinkVerifySchema,
  partnerContractCreateSchema,
  partnerContractListQuerySchema,
  partnerContractStatusSchema,
  partnerContractUpdateSchema,
  partnerRateCreateSchema,
  partnerRateUpdateSchema,
  partnerSimulatorMemberSchema,
  partnerSimulatorModeSchema,
  type BuyerPartnerItem,
  type BuyerPartnerLinkRequest,
  type PageResponse,
  type PartnerContractDetail,
  type PartnerContractListItem,
  type PartnerRate,
  type PartnerSimulatorState,
} from "contracts";
import { clientInfo } from "../../auth/auth.controller";
import type { AuthenticatedRequest } from "../../auth/auth.guard";
import { UuidPipe } from "../../common/uuid.pipe";
import { BuyerAdminService } from "../../marketplace/buyer-admin.service";
import { BuyerPartnersService } from "./buyer-partners.service";
import { PartnerContractsService } from "./contracts.service";

@Controller("loyalty")
export class PartnerContractsController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly contracts: PartnerContractsService,
  ) {}

  private manager(request: AuthenticatedRequest) {
    return this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.partner.manage");
  }

  // API_301: hợp đồng, giới hạn, trạng thái.
  @Get("partners")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<PartnerContractListItem>> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.partner.view");
    return this.contracts.list(actor, partnerContractListQuerySchema.parse(query));
  }

  @Post("partners")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<PartnerContractDetail> {
    return this.contracts.create(await this.manager(request), partnerContractCreateSchema.parse(body));
  }

  @Get("partners/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<PartnerContractDetail> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.partner.view");
    return this.contracts.detail(actor, id, await this.admin.allows(request.auth.userId, clientInfo(request), "loyalty.partner.manage"));
  }

  @Put("partners/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerContractDetail> {
    return this.contracts.update(await this.manager(request), id, partnerContractUpdateSchema.parse(body));
  }

  @Post("partners/:id/activate")
  async activate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerContractDetail> {
    const input = partnerContractStatusSchema.parse(body);
    return this.contracts.changeStatus(await this.manager(request), id, "active", input.version, null);
  }

  @Post("partners/:id/suspend")
  async suspend(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerContractDetail> {
    const input = partnerContractStatusSchema.parse(body);
    return this.contracts.changeStatus(await this.manager(request), id, "suspended", input.version, input.reason ?? null);
  }

  @Post("partners/:id/terminate")
  async terminate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerContractDetail> {
    const input = partnerContractStatusSchema.parse(body);
    return this.contracts.changeStatus(await this.manager(request), id, "terminated", input.version, input.reason ?? null);
  }

  // API_302: tỷ lệ theo chiều, giai đoạn.
  @Post("partners/:id/rates")
  async createRate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerRate> {
    return this.contracts.createRate(await this.manager(request), id, partnerRateCreateSchema.parse(body));
  }

  @Put("partner-rates/:rateId")
  async updateRate(@Req() request: AuthenticatedRequest, @Param("rateId", UuidPipe) rateId: string, @Body() body: unknown): Promise<PartnerRate> {
    return this.contracts.updateRate(await this.manager(request), rateId, partnerRateUpdateSchema.parse(body));
  }

  @Delete("partner-rates/:rateId")
  @HttpCode(204)
  async deleteRate(@Req() request: AuthenticatedRequest, @Param("rateId", UuidPipe) rateId: string): Promise<void> {
    await this.contracts.deleteRate(await this.manager(request), rateId);
  }

  // API_303 (phần bộ giả lập; khóa API ở lát L3).
  @Get("partners/:id/simulator")
  async simulator(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<PartnerSimulatorState> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.partner.view");
    return this.contracts.simulator(actor, id);
  }

  @Put("partners/:id/simulator")
  async setSimulatorMode(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerSimulatorState> {
    return this.contracts.setSimulatorMode(await this.manager(request), id, partnerSimulatorModeSchema.parse(body).mode);
  }

  @Post("partners/:id/simulator/members")
  async upsertSimulatorMember(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerSimulatorState> {
    return this.contracts.upsertSimulatorMember(await this.manager(request), id, partnerSimulatorMemberSchema.parse(body));
  }
}

@Controller("buyer/loyalty")
export class BuyerPartnersController {
  constructor(private readonly partners: BuyerPartnersService) {}

  @Get("partners")
  list(@Req() request: AuthenticatedRequest): Promise<BuyerPartnerItem[]> {
    return this.partners.list(request.auth.userId);
  }

  @Post("partners/:id/link")
  link(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerPartnerLinkRequest> {
    return this.partners.requestLink(request.auth.userId, id, buyerPartnerLinkSchema.parse(body).memberNumber);
  }

  @Post("partner-links/:requestId/verify")
  @HttpCode(200)
  verify(@Req() request: AuthenticatedRequest, @Param("requestId", UuidPipe) requestId: string, @Body() body: unknown): Promise<BuyerPartnerItem> {
    return this.partners.verifyLink(request.auth.userId, requestId, buyerPartnerLinkVerifySchema.parse(body).otp);
  }

  @Delete("partners/:id/link")
  @HttpCode(204)
  async unlink(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<void> {
    await this.partners.unlink(request.auth.userId, id);
  }
}
