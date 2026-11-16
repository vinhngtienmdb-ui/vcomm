// API_301 đến API_304 (CONG_VIEC_65): quản trị đối tác liên minh điểm trên web-crm; quyền xét tại công ty vận hành sàn (QUYTAC_NGHIEPVU_551).
// API_306, API_307: người mua liên kết số thành viên đối tác, đổi điểm trên ứng dụng VComm.
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import {
  partnerApiKeyCreateSchema,
  partnerApiKeyUpdateSchema,
  rotateApiKeySchema,
  revokeApiKeySchema,
  type PartnerApiKeyItem,
  type PartnerApiKeySecret,
  partnerGiftListQuerySchema,
  type PartnerGiftItem,
  buyerPartnerExchangeCreateSchema,
  buyerPartnerExchangeListQuerySchema,
  buyerPartnerExchangeOtpSchema,
  buyerPartnerExchangeQuoteSchema,
  partnerExchangeListQuerySchema,
  partnerExchangeResolveSchema,
  type BuyerPartnerExchange,
  type BuyerPartnerExchangeQuote,
  type PartnerExchangeItem,
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
import { PartnerApiKeysService } from "./api-keys.service";
import { BuyerPartnersService } from "./buyer-partners.service";
import { PartnerContractsService } from "./contracts.service";
import { PartnerExchangesService } from "./exchanges.service";
import { PartnerGiftsService } from "./gifts.service";

@Controller("loyalty")
export class PartnerContractsController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly contracts: PartnerContractsService,
    private readonly exchanges: PartnerExchangesService,
    private readonly gifts: PartnerGiftsService,
    private readonly apiKeys: PartnerApiKeysService,
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

  // API_304: giao dịch đổi điểm đối tác, hỏi lại, chốt tay.
  @Get("partner-exchanges")
  async exchangeList(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<PartnerExchangeItem>> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.partner.view");
    return this.exchanges.list(actor, partnerExchangeListQuerySchema.parse(query));
  }

  @Get("partner-exchanges/:id")
  async exchangeDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<PartnerExchangeItem> {
    return this.exchanges.detail(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.partner.view"), id);
  }

  @Post("partner-exchanges/:id/recheck")
  @HttpCode(200)
  async recheck(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<PartnerExchangeItem> {
    return this.exchanges.recheck(await this.manager(request), id);
  }

  @Post("partner-exchanges/:id/resolve")
  @HttpCode(200)
  async resolve(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerExchangeItem> {
    return this.exchanges.resolve(await this.manager(request), id, partnerExchangeResolveSchema.parse(body));
  }

  // API_304 (phần tặng): điểm đối tác tặng.
  @Get("partner-gifts")
  async giftList(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<PartnerGiftItem>> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.partner.view");
    return this.gifts.list(actor, partnerGiftListQuerySchema.parse(query));
  }

  // API_303 (phần khóa API): khóa tặng điểm phạm vi `loyalty.partner` (QUYTAC_NGHIEPVU_545).
  @Get("partners/:id/api-keys")
  async apiKeyList(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<PartnerApiKeyItem[]> {
    return this.apiKeys.list(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.partner.view"), id);
  }

  @Post("partners/:id/api-keys")
  async createApiKey(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PartnerApiKeySecret> {
    return this.apiKeys.create(await this.manager(request), id, partnerApiKeyCreateSchema.parse(body));
  }

  @Patch("partner-api-keys/:keyId")
  async updateApiKey(@Req() request: AuthenticatedRequest, @Param("keyId", UuidPipe) keyId: string, @Body() body: unknown): Promise<PartnerApiKeyItem> {
    return this.apiKeys.update(await this.manager(request), keyId, partnerApiKeyUpdateSchema.parse(body));
  }

  @Post("partner-api-keys/:keyId/rotate")
  @HttpCode(200)
  async rotateApiKey(@Req() request: AuthenticatedRequest, @Param("keyId", UuidPipe) keyId: string, @Body() body: unknown): Promise<PartnerApiKeySecret> {
    return this.apiKeys.rotate(await this.manager(request), keyId, rotateApiKeySchema.parse(body).version);
  }

  @Post("partner-api-keys/:keyId/revoke")
  @HttpCode(200)
  async revokeApiKey(@Req() request: AuthenticatedRequest, @Param("keyId", UuidPipe) keyId: string, @Body() body: unknown): Promise<PartnerApiKeyItem> {
    const input = revokeApiKeySchema.parse(body);
    return this.apiKeys.revoke(await this.manager(request), keyId, input.reason, input.version);
  }

  // API_303 (phần bộ giả lập).
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
  constructor(
    private readonly partners: BuyerPartnersService,
    private readonly exchanges: PartnerExchangesService,
  ) {}

  // API_307: báo giá, đổi ra, đổi vào, nhập OTP đối tác, lịch sử.
  @Post("partner-exchanges/quote")
  @HttpCode(200)
  quote(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerPartnerExchangeQuote> {
    return this.exchanges.quote(request.auth.userId, buyerPartnerExchangeQuoteSchema.parse(body));
  }

  @Post("partner-exchanges")
  createExchange(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerPartnerExchange> {
    return this.exchanges.create(request.auth.userId, buyerPartnerExchangeCreateSchema.parse(body));
  }

  @Post("partner-exchanges/:id/otp")
  @HttpCode(200)
  confirmExchange(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerPartnerExchange> {
    return this.exchanges.confirmInbound(request.auth.userId, id, buyerPartnerExchangeOtpSchema.parse(body).otp);
  }

  @Get("partner-exchanges")
  exchangeList(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<BuyerPartnerExchange>> {
    const input = buyerPartnerExchangeListQuerySchema.parse(query);
    return this.exchanges.buyerList(request.auth.userId, input.page, input.pageSize);
  }

  @Get("partner-exchanges/:id")
  exchangeDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerPartnerExchange> {
    return this.exchanges.buyerDetail(request.auth.userId, id);
  }

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
