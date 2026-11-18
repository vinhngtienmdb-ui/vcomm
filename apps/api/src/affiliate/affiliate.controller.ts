// API_206: cửa hàng liên kết trên web quản trị (CONG_VIEC_55). Quyền xét tại công ty vận hành sàn.
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  affiliateCollectionSchema,
  type AffiliateCollectionResponse,
  einvoiceMandateSchema,
  affiliateWebhookSchema,
  type AffiliateWebhookDelivery,
  type AffiliateWebhookSecret,
  type EinvoiceMandateResponse,
  type TransactionEinvoice,
  affiliateApiKeyCreateSchema,
  affiliateApiKeyUpdateSchema,
  revokeApiKeySchema,
  rotateApiKeySchema,
  type AffiliateApiKeyItem,
  type AffiliateApiKeySecret,
  affiliateMemberVersionSchema,
  affiliateMerchantCreateSchema,
  affiliateMerchantListQuerySchema,
  affiliateMerchantStatusSchema,
  affiliateMerchantUpdateSchema,
  affiliateOutletSchema,
  affiliateOutletUpdateSchema,
  affiliateOwnerInviteSchema,
  affiliateVoucherListQuerySchema,
  affiliateSettlementListQuerySchema,
  affiliateAlertQuerySchema,
  affiliateCompanyTransactionQuerySchema,
  type AffiliateCompanyTransaction,
  affiliateReportQuerySchema,
  type AffiliateAlert,
  type AffiliateCompanyReport,
  affiliateSettlementResolveSchema,
  type AffiliateSettlementDetail,
  type AffiliateSettlementItem,
  companyVoucherSchema,
  companyVoucherUpdateSchema,
  type AffiliateVoucherItem,
  type AffiliateMember,
  type AffiliateMerchantDetail,
  type AffiliateMerchantListItem,
  type AffiliateOutlet,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { MerchantPortalSecurityService } from "./portal-security.service";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "../marketplace/buyer-admin.service";
import { voucherAction } from "./merchant-portal.controller";
import { AffiliateApiKeysService } from "./api-keys.service";
import { AffiliateMerchantsService } from "./merchants.service";
import { AffiliateReportsService } from "./reports.service";
import { AffiliateTransactionsService } from "./transactions.service";
import { AffiliateSettlementsService, type SettlementActor } from "./settlements.service";
import { AffiliateVouchersService, type VoucherActor } from "./vouchers.service";
import { AffiliateCheckoutsService } from "./affiliate-checkouts.service";
import { InstoreEinvoicesService } from "../instore/mandated-einvoices.service";
import { AffiliateWebhooksService } from "./webhooks.service";

@Controller("affiliate")
export class AffiliateController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly merchants: AffiliateMerchantsService,
    private readonly vouchers: AffiliateVouchersService,
    private readonly settlements: AffiliateSettlementsService,
    private readonly reports: AffiliateReportsService,
    private readonly transactions: AffiliateTransactionsService,
    private readonly apiKeys: AffiliateApiKeysService,
    private readonly portalSecurity: MerchantPortalSecurityService,
    private readonly checkouts: AffiliateCheckoutsService,
    private readonly mandatedEinvoices: InstoreEinvoicesService,
    private readonly webhooks: AffiliateWebhooksService,
  ) {}

  private async voucherActor(request: AuthenticatedRequest, permission: "affiliate.view" | "affiliate.manage"): Promise<VoucherActor> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), permission);
    return { userId: actor.userId, companyId: actor.operatorCompanyId, merchantId: null, client: actor.client };
  }

  private manager(request: AuthenticatedRequest) {
    return this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.manage");
  }

  @Get("merchants")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateMerchantListItem>> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.merchants.list(actor, affiliateMerchantListQuerySchema.parse(query));
  }

  @Post("merchants")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    return this.merchants.create(await this.manager(request), affiliateMerchantCreateSchema.parse(body));
  }

  @Get("merchants/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateMerchantDetail> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.merchants.detail(actor, id, await this.admin.allows(request.auth.userId, clientInfo(request), "affiliate.manage"));
  }

  // API_332 (CONG_VIEC_73 lát L4; MAN_HINH_279): cài đặt thu hộ qua ứng dụng của cửa hàng.
  @Get("merchants/:id/collection")
  async collection(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateCollectionResponse> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.checkouts.collection(actor, id, await this.admin.allows(request.auth.userId, clientInfo(request), "affiliate.manage"));
  }

  @Patch("merchants/:id/collection")
  async updateCollection(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateCollectionResponse> {
    return this.checkouts.updateCollection(await this.manager(request), id, affiliateCollectionSchema.parse(body));
  }

  // API_334 (CONG_VIEC_73 lát L6; MAN_HINH_279): dữ liệu ủy nhiệm hóa đơn, ký hiệu theo năm, tệp văn bản ủy nhiệm, việc chờ lập, lập bù.
  @Get("merchants/:id/einvoice-mandate")
  async mandate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<EinvoiceMandateResponse> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.mandatedEinvoices.mandate(actor, id, await this.admin.allows(request.auth.userId, clientInfo(request), "affiliate.manage"));
  }

  @Put("merchants/:id/einvoice-mandate")
  async saveMandate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<EinvoiceMandateResponse> {
    return this.mandatedEinvoices.saveMandate(await this.manager(request), id, einvoiceMandateSchema.parse(body));
  }

  @Post("merchants/:id/einvoice-mandate/file")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 + 1, files: 1 } }))
  async mandateFile(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname?: string } | undefined,
  ): Promise<EinvoiceMandateResponse> {
    return this.mandatedEinvoices.saveFile(await this.manager(request), id, file);
  }

  @Get("merchants/:id/einvoice-mandate/file")
  async downloadMandateFile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res({ passthrough: true }) response: Response): Promise<StreamableFile> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    const file = await this.mandatedEinvoices.file(actor, id);
    response.setHeader("content-type", "application/pdf");
    response.setHeader("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
    return new StreamableFile(file.content);
  }

  @Post("transactions/:id/einvoice")
  @HttpCode(200)
  async reissueEinvoice(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<TransactionEinvoice> {
    return this.mandatedEinvoices.reissue(await this.manager(request), id);
  }

  @Put("merchants/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    return this.merchants.update(await this.manager(request), id, affiliateMerchantUpdateSchema.parse(body));
  }

  @Post("merchants/:id/activate")
  async activate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    const input = affiliateMerchantStatusSchema.parse(body);
    return this.merchants.changeStatus(await this.manager(request), id, "active", input.version, null);
  }

  @Post("merchants/:id/suspend")
  async suspend(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    const input = affiliateMerchantStatusSchema.parse(body);
    return this.merchants.changeStatus(await this.manager(request), id, "suspended", input.version, input.reason ?? null);
  }

  @Post("merchants/:id/terminate")
  async terminate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    const input = affiliateMerchantStatusSchema.parse(body);
    return this.merchants.changeStatus(await this.manager(request), id, "terminated", input.version, input.reason ?? null);
  }

  @Post("merchants/:id/outlets")
  async addOutlet(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateOutlet> {
    return this.merchants.addOutlet(await this.manager(request), id, affiliateOutletSchema.parse(body));
  }

  @Put("outlets/:id")
  async updateOutlet(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateOutlet> {
    return this.merchants.updateOutlet(await this.manager(request), id, affiliateOutletUpdateSchema.parse(body));
  }

  @Post("merchants/:id/owner-invitations")
  async inviteOwner(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.merchants.inviteOwner(await this.manager(request), id, affiliateOwnerInviteSchema.parse(body));
  }

  // API_325 (CONG_VIEC_72): đặt lại xác thực cổng cho chủ, thu ngân (MAN_HINH_178).
  @Post("merchants/:id/members/:memberId/reset-authentication")
  async resetMemberAuthentication(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("memberId", UuidPipe) memberId: string,
    @Body() body: unknown,
  ): Promise<AffiliateMember[]> {
    const actor = await this.manager(request);
    await this.portalSecurity.resetAuthentication({ userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client }, memberId, affiliateMemberVersionSchema.parse(body).version, {
      merchantId: id,
      cashierOnly: false,
    });
    return this.merchants.members(id);
  }

  @Post("members/:id/lock")
  async lockMember(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.merchants.setMemberLocked(await this.manager(request), id, true, affiliateMemberVersionSchema.parse(body).version);
  }

  @Post("members/:id/unlock")
  async unlockMember(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.merchants.setMemberLocked(await this.manager(request), id, false, affiliateMemberVersionSchema.parse(body).version);
  }

  // API_210: mọi voucher liên kết; tạo, sửa voucher công ty phát hành.
  @Get("vouchers")
  async listVouchers(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateVoucherItem>> {
    return this.vouchers.list(await this.voucherActor(request, "affiliate.view"), affiliateVoucherListQuerySchema.parse(query));
  }

  @Get("vouchers/:id")
  async voucher(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateVoucherItem> {
    return this.vouchers.voucher(await this.voucherActor(request, "affiliate.view"), id);
  }

  @Post("vouchers")
  async createVoucher(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    return this.vouchers.create(await this.voucherActor(request, "affiliate.manage"), { issuer: "company", ...companyVoucherSchema.parse(body) });
  }

  @Put("vouchers/:id")
  async updateVoucher(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    const actor = await this.voucherActor(request, "affiliate.manage");
    await this.companyIssued(actor, id);
    return this.vouchers.update(actor, id, { issuer: "company", ...companyVoucherUpdateSchema.parse(body) });
  }

  // Công ty gửi duyệt, rút, tạm dừng, giảm số lượng voucher do công ty phát hành; tạm dừng được cả voucher cửa hàng.
  @Post("vouchers/:id/:action")
  async voucherAction(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Param("action") action: string, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    const actor = await this.voucherActor(request, "affiliate.manage");
    if (action !== "pause" && action !== "resume") await this.companyIssued(actor, id);
    return voucherAction(this.vouchers, actor, id, action, body);
  }

  // API_213: báo cáo theo cửa hàng, cảnh báo bất thường.
  @Get("report")
  async report(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<AffiliateCompanyReport> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.reports.companyReport(actor.operatorCompanyId, affiliateReportQuerySchema.parse(query));
  }

  // Giao dịch mọi cửa hàng (MAN_HINH_180 thẻ Giao dịch).
  @Get("transactions")
  async listTransactions(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateCompanyTransaction>> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.transactions.companyList(actor.operatorCompanyId, affiliateCompanyTransactionQuerySchema.parse(query));
  }

  @Get("alerts")
  async alerts(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<AffiliateAlert[]> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.reports.alerts(actor.operatorCompanyId, affiliateAlertQuerySchema.parse(query));
  }

  // API_212: đối soát tuần mọi cửa hàng; trả lời khiếu nại và chốt lại.
  private async settlementActor(request: AuthenticatedRequest, permission: "affiliate.view" | "affiliate.manage"): Promise<SettlementActor> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), permission);
    return { userId: actor.userId, companyId: actor.operatorCompanyId, merchantId: null, client: actor.client };
  }

  @Get("settlements")
  async listSettlements(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateSettlementItem>> {
    return this.settlements.list(await this.settlementActor(request, "affiliate.view"), affiliateSettlementListQuerySchema.parse(query));
  }

  @Get("settlements/:id")
  async settlement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateSettlementDetail> {
    return this.settlements.detail(await this.settlementActor(request, "affiliate.view"), id);
  }

  @Post("settlements/:id/resolve")
  @HttpCode(200)
  async resolveSettlement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateSettlementDetail> {
    return this.settlements.resolve(await this.settlementActor(request, "affiliate.manage"), id, affiliateSettlementResolveSchema.parse(body));
  }

  // API_295: khóa API của cửa hàng (CONG_VIEC_67; QUYTAC_NGHIEPVU_495).
  @Get("merchants/:id/api-keys")
  async listApiKeys(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateApiKeyItem[]> {
    return this.apiKeys.list(await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view"), id);
  }

  @Post("merchants/:id/api-keys")
  async createApiKey(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateApiKeySecret> {
    return this.apiKeys.create(await this.manager(request), id, affiliateApiKeyCreateSchema.parse(body));
  }

  @Put("api-keys/:id")
  async updateApiKey(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateApiKeyItem> {
    return this.apiKeys.update(await this.manager(request), id, affiliateApiKeyUpdateSchema.parse(body));
  }

  @Post("api-keys/:id/rotate")
  @HttpCode(200)
  async rotateApiKey(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateApiKeySecret> {
    return this.apiKeys.rotate(await this.manager(request), id, rotateApiKeySchema.parse(body).version);
  }

  // API_331 (CONG_VIEC_73 lát L7; MAN_HINH_231): webhook của khóa — địa chỉ, khóa ký, gửi thử, nhật ký gửi, gửi lại.
  @Put("api-keys/:id/webhook")
  async webhook(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<{ url: string | null; version: number }> {
    return this.webhooks.configure({ kind: "admin", actor: await this.manager(request) }, id, affiliateWebhookSchema.parse(body));
  }

  @Post("api-keys/:id/webhook/rotate-secret")
  @HttpCode(200)
  async webhookSecret(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateWebhookSecret> {
    return this.webhooks.rotateSecret({ kind: "admin", actor: await this.manager(request) }, id);
  }

  @Post("api-keys/:id/webhook/test")
  @HttpCode(200)
  async webhookTest(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateWebhookDelivery> {
    return this.webhooks.test({ kind: "admin", actor: await this.manager(request) }, id);
  }

  @Get("api-keys/:id/webhook/deliveries")
  async webhookDeliveries(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateWebhookDelivery[]> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.manage");
    return this.webhooks.deliveries({ kind: "admin", actor }, id);
  }

  @Post("webhook-deliveries/:id/resend")
  @HttpCode(200)
  async webhookResend(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateWebhookDelivery> {
    return this.webhooks.resend({ kind: "admin", actor: await this.manager(request) }, id);
  }

  @Post("api-keys/:id/revoke")
  @HttpCode(200)
  async revokeApiKey(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateApiKeyItem> {
    const input = revokeApiKeySchema.parse(body);
    return this.apiKeys.revoke(await this.manager(request), id, input.reason, input.version);
  }

  private async companyIssued(actor: VoucherActor, id: string): Promise<void> {
    if ((await this.vouchers.voucher(actor, id)).issuer !== "company") throw new ApiError("FORBIDDEN", "forbidden");
  }
}
