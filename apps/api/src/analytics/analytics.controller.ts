// API_170 đến API_175: báo cáo quản trị (CONG_VIEC_50). Chỉ đọc; quyền từng nhóm báo cáo kiểm trong service.
import { Controller, Get, Headers, Query, Req, Res, StreamableFile } from "@nestjs/common";
import {
  analyticsCommissionQuerySchema,
  analyticsDebtQuerySchema,
  analyticsOverviewQuerySchema,
  type AnalyticsCommissionResponse,
  type AnalyticsOverviewResponse,
  analyticsInventoryQuerySchema,
  type AnalyticsDebtResponse,
  analyticsSalesQuerySchema,
  type AnalyticsInventoryResponse,
  type AnalyticsReportKind,
  type AnalyticsSalesResponse,
  type AnalyticsScopeResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuditService } from "../common/audit.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { reportXlsx, xlsxContentType, type ExportTable } from "./analytics-export";
import { AnalyticsScopeService } from "./analytics-scope.service";
import { CommissionReportService } from "./commission-report.service";
import { DebtReportService } from "./debt-report.service";
import { OverviewService } from "./overview.service";
import { InventoryReportService } from "./inventory-report.service";
import { SalesReportService } from "./sales-report.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly scopeService: AnalyticsScopeService,
    private readonly sales: SalesReportService,
    private readonly inventory: InventoryReportService,
    private readonly debts: DebtReportService,
    private readonly commissions: CommissionReportService,
    private readonly overviewService: OverviewService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "analytics.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // QUYTAC_NGHIEPVU_343: xuất Excel cùng bộ lọc, ghi nhật ký thao tác.
  private async export(actor: Actor, response: Response, kind: AnalyticsReportKind, filters: unknown, tables: ExportTable[], fileName: string): Promise<StreamableFile> {
    const content = await reportXlsx(tables);
    await this.auditService.record({
      actorUserId: actor.userId,
      companyId: actor.companyId,
      appCode: "analytics",
      action: `analytics.${kind}.export`,
      entityType: "analytics_report",
      afterData: { filters, rows: tables.reduce((count, table) => count + table.rows.length, 0) },
      ip: actor.client.ip,
      userAgent: actor.client.userAgent,
      requestId: actor.client.requestId,
    });
    response.setHeader("content-type", xlsxContentType);
    response.setHeader("content-disposition", `attachment; filename="${fileName}.xlsx"`);
    return new StreamableFile(content);
  }

  @Get("scope")
  async scope(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<AnalyticsScopeResponse> {
    return this.scopeService.scope(await this.actor(request, companyId));
  }

  @Get("sales")
  async salesReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<AnalyticsSalesResponse | StreamableFile> {
    const parsed = analyticsSalesQuerySchema.parse(query);
    const actor = await this.actor(request, companyId);
    const report = await this.sales.report(actor, parsed, parsed.format === "xlsx");
    if (parsed.format === "json") return report;
    return this.export(actor, response, "sales", parsed, [this.sales.exportTable(report)], `bao-cao-ban-hang-${parsed.from}-${parsed.to}`);
  }

  @Get("inventory")
  async inventoryReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<AnalyticsInventoryResponse | StreamableFile> {
    const parsed = analyticsInventoryQuerySchema.parse(query);
    const actor = await this.actor(request, companyId);
    const report = await this.inventory.report(actor, parsed, parsed.format === "xlsx");
    if (parsed.format === "json") return report;
    return this.export(actor, response, "inventory", parsed, [this.inventory.exportTable(report)], `bao-cao-ton-kho-${parsed.from}-${parsed.to}`);
  }

  @Get("debts")
  async debtReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<AnalyticsDebtResponse | StreamableFile> {
    const parsed = analyticsDebtQuerySchema.parse(query);
    const actor = await this.actor(request, companyId);
    const report = await this.debts.report(actor, parsed, parsed.format === "xlsx");
    if (parsed.format === "json") return report;
    return this.export(actor, response, "debt", parsed, [this.debts.exportTable(report)], `bao-cao-cong-no-${parsed.side === "receivable" ? "phai-thu" : "phai-tra"}-${report.today}`);
  }

  @Get("commissions")
  async commissionReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<AnalyticsCommissionResponse | StreamableFile> {
    const parsed = analyticsCommissionQuerySchema.parse(query);
    const actor = await this.actor(request, companyId);
    const report = await this.commissions.report(actor, parsed, parsed.format === "xlsx");
    if (parsed.format === "json") return report;
    return this.export(actor, response, "commission", parsed, this.commissions.exportTables(report), `bao-cao-hoa-hong-${parsed.from}-${parsed.to}`);
  }

  @Get("overview")
  async overview(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<AnalyticsOverviewResponse> {
    return this.overviewService.overview(await this.actor(request, companyId), analyticsOverviewQuerySchema.parse(query));
  }
}
