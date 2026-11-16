// API_253: báo cáo liên minh điểm (quyền xem bảng đối soát, theo công ty đang chọn) và báo cáo gian lận (loyalty.view tại công ty vận hành sàn);
// `format=xlsx` xuất tệp, ghi nhật ký như xuất báo cáo quản trị (CONG_VIEC_50).
import { Controller, Get, Headers, Query, Req, Res, StreamableFile } from "@nestjs/common";
import { loyaltyReportQuerySchema, type LoyaltyAllianceReport, type LoyaltyFraudReport } from "contracts";
import type { Response } from "express";
import { xlsxContentType } from "../analytics/analytics-export";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import type { ClientInfo } from "../auth/auth.service";
import { AuditService } from "../common/audit.service";
import { BuyerAdminService } from "../marketplace/buyer-admin.service";
import { PermissionService } from "../permissions/permission.service";
import { LoyaltyReportsService } from "./reports.service";
import { settlementPermissions } from "./settlements.service";

@Controller("loyalty/reports")
export class LoyaltyReportsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly admin: BuyerAdminService,
    private readonly reports: LoyaltyReportsService,
    private readonly auditService: AuditService,
  ) {}

  private async file(
    response: Response,
    input: { userId: string; companyId: string; client: ClientInfo; appCode: string; kind: "alliance" | "fraud"; year: number },
    content: Buffer,
  ): Promise<StreamableFile> {
    await this.auditService.record({
      actorUserId: input.userId,
      companyId: input.companyId,
      appCode: input.appCode,
      action: `loyalty_report.${input.kind}.export`,
      entityType: "loyalty_report",
      afterData: { year: input.year },
      ip: input.client.ip,
      userAgent: input.client.userAgent,
      requestId: input.client.requestId,
    });
    response.setHeader("content-type", xlsxContentType);
    response.setHeader("content-disposition", `attachment; filename="bao-cao-${input.kind === "alliance" ? "lien-minh" : "gian-lan"}-diem-${input.year}.xlsx"`);
    return new StreamableFile(content);
  }

  @Get("alliance")
  async alliance(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
    @Query() query: unknown,
    @Headers("x-company-id") requestedCompanyId?: string,
  ): Promise<LoyaltyAllianceReport | StreamableFile> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, settlementPermissions.view, settlementPermissions.manage);
    const actor = { userId: request.auth.userId, companyId, client: clientInfo(request) };
    const input = loyaltyReportQuerySchema.parse(query);
    if (input.format !== "xlsx") return this.reports.alliance(actor, input.year);
    return this.file(response, { ...actor, appCode: "finance", kind: "alliance", year: input.year }, await this.reports.allianceXlsx(actor, input.year));
  }

  @Get("fraud")
  async fraud(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response, @Query() query: unknown): Promise<LoyaltyFraudReport | StreamableFile> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    const input = loyaltyReportQuerySchema.parse(query);
    if (input.format !== "xlsx") return this.reports.fraud(input.year);
    return this.file(
      response,
      { userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client, appCode: "crm", kind: "fraud", year: input.year },
      await this.reports.fraudXlsx(input.year),
    );
  }
}
