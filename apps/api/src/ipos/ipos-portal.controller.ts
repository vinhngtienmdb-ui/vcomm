// API_344 đến 352: cổng cửa hàng nhóm iPOS – danh mục hàng, nhập Excel, tồn kho, quyền vào, quầy, mã ghép, thiết bị, duyệt thu ngân tự đăng ký (CONG_VIEC_74).
// Danh mục, tồn kho, quầy, thiết bị, duyệt thu ngân chỉ chủ cửa hàng; thu ngân xem được quyền vào nhóm iPOS của điểm bán được gán.
import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  type IposFeeVietqr,
  type IposMerchantFeeOverview,
  iposCategoryCreateSchema,
  iposCategoryUpdateSchema,
  iposImportMaximumBytes,
  iposItemCreateSchema,
  iposItemUpdateSchema,
  iposOutletPricesSchema,
  iposStockDocumentSchema,
  iposOutletCodeSchema,
  iposCloseShiftSchema,
  iposPortalPeriodQuery,
  iposPaymentMethods,
  type IposOverview,
  type IposPortalReturnRow,
  type IposPortalSaleRow,
  type IposPortalShiftRow,
  type IposReport,
  type IposReturn,
  type IposSale,
  type IposShiftReport,
  iposSettingsSchema,
  type IposSettingsPage,
  type IposCategory,
  type IposImportResult,
  type IposItemDetail,
  type IposItemPage,
  type IposStockDocumentDetail,
  type IposStockDocumentRow,
  type IposStockMove,
  type IposStockRow,
  type IposVariantOption,
  iposRegisterCreateSchema,
  iposRegisterUpdateSchema,
  iposRegistrationApproveSchema,
  iposRegistrationRejectSchema,
  type IposCashierRegistration,
  type IposPairingCode,
  type IposPortalAccess,
  type IposRegisterItem,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { selectedMerchant } from "../affiliate/merchant-portal.controller";
import { MerchantPortalService, requireOwner } from "../affiliate/portal.service";
import { localeOf } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import type { Request, Response } from "express";
import { z } from "zod";
import { IposCatalogService } from "./ipos-catalog.service";
import { IposImportService } from "./ipos-import.service";
import { IposStockService } from "./ipos-stock.service";
import { IposSettingsService } from "./ipos-settings.service";
import { IposFeesService } from "./ipos-fees.service";
import { IposReportsService } from "./ipos-reports.service";
import { IposReturnsService } from "./ipos-returns.service";
import { IposSalesService } from "./ipos-sales.service";
import { IposShiftsService } from "./ipos-shifts.service";
import { messages } from "i18n";
import { IposRegistersService } from "./ipos-registers.service";
import { IposRegistrationsService } from "./ipos-registrations.service";

const flag = z.enum(["true", "false"]).optional().transform((value) => value === "true");
const itemsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
const searchQuery = z.object({ search: z.string().trim().max(100).optional() });
const stockQuery = z.object({ outletId: z.string().uuid(), search: z.string().trim().max(100).optional(), belowMin: flag, negative: flag });
const documentsQuery = z.object({ outletId: z.string().uuid().optional() });
const movesQuery = z.object({ outletId: z.string().uuid(), variantId: z.string().uuid().optional() });
const importBody = z.object({ outletId: z.string().uuid().optional().or(z.literal("").transform(() => undefined)) });
const salesQuery = iposPortalPeriodQuery.extend({ method: z.enum(iposPaymentMethods).optional(), search: z.string().trim().max(30).optional() });
const upload = FileInterceptor("file", { limits: { fileSize: iposImportMaximumBytes * 2, files: 1 } });
type UploadedExcel = { buffer: Buffer; size: number } | undefined;

@Controller("merchant-portal/ipos")
export class IposPortalController {
  constructor(
    private readonly portal: MerchantPortalService,
    private readonly registersService: IposRegistersService,
    private readonly registrations: IposRegistrationsService,
    private readonly catalog: IposCatalogService,
    private readonly imports: IposImportService,
    private readonly stockService: IposStockService,
    private readonly settings: IposSettingsService,
    private readonly reports: IposReportsService,
    private readonly fees: IposFeesService,
    private readonly shiftsService: IposShiftsService,
    private readonly salesService: IposSalesService,
    private readonly returnsService: IposReturnsService,
  ) {}

  private member(request: AuthenticatedRequest) {
    return this.portal.member(request.auth.userId, selectedMerchant(request), clientInfo(request));
  }

  private async owner(request: AuthenticatedRequest) {
    const member = await this.member(request);
    requireOwner(member);
    return member;
  }

  @Get("access")
  async access(@Req() request: AuthenticatedRequest): Promise<IposPortalAccess> {
    return this.registersService.access(await this.member(request));
  }

  @Get("registers")
  async registers(@Req() request: AuthenticatedRequest): Promise<IposRegisterItem[]> {
    return this.registersService.registers(await this.owner(request));
  }

  @Post("registers")
  async createRegister(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposRegisterItem[]> {
    return this.registersService.createRegister(await this.owner(request), iposRegisterCreateSchema.parse(body));
  }

  @Put("registers/:id")
  async updateRegister(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposRegisterItem[]> {
    return this.registersService.updateRegister(await this.owner(request), id, iposRegisterUpdateSchema.parse(body));
  }

  @Post("registers/:id/pairing-codes")
  async pairingCode(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposPairingCode> {
    return this.registersService.pairingCode(await this.owner(request), id);
  }

  @Post("devices/:id/revoke")
  async revokeDevice(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposRegisterItem[]> {
    return this.registersService.revokeDevice(await this.owner(request), id);
  }

  @Get("cashier-registrations")
  async registrationsList(@Req() request: AuthenticatedRequest): Promise<IposCashierRegistration[]> {
    return this.registrations.list(await this.owner(request));
  }

  @Post("cashier-registrations/:id/approve")
  async approve(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposCashierRegistration[]> {
    return this.registrations.approve(await this.owner(request), id, iposRegistrationApproveSchema.parse(body).outletIds);
  }

  @Post("cashier-registrations/:id/reject")
  async reject(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposCashierRegistration[]> {
    return this.registrations.reject(await this.owner(request), id, iposRegistrationRejectSchema.parse(body).reason);
  }

  // API_345: danh mục hàng.
  @Get("categories")
  async categories(@Req() request: AuthenticatedRequest): Promise<IposCategory[]> {
    return this.catalog.categories(await this.owner(request));
  }

  @Post("categories")
  async createCategory(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposCategory[]> {
    return this.catalog.createCategory(await this.owner(request), iposCategoryCreateSchema.parse(body));
  }

  @Patch("categories/:id")
  async updateCategory(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposCategory[]> {
    return this.catalog.updateCategory(await this.owner(request), id, iposCategoryUpdateSchema.parse(body));
  }

  @Get("items")
  async items(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposItemPage> {
    return this.catalog.items(await this.owner(request), itemsQuery.parse(query));
  }

  // API_346: nhập Excel (đặt trước `items/:id` để không bị hiểu là mã định danh).
  @Get("items/import-template")
  async importTemplate(@Req() request: AuthenticatedRequest, @Res() response: Response): Promise<void> {
    await this.owner(request);
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", 'attachment; filename="mau-nhap-hang-hoa-ipos.xlsx"');
    response.send(await this.imports.template());
  }

  @Post("items/import/validate")
  @UseInterceptors(upload)
  async importValidate(@Req() request: AuthenticatedRequest, @UploadedFile() file: UploadedExcel, @Body() body: unknown): Promise<IposImportResult> {
    return this.imports.validate(await this.owner(request), file, importBody.parse(body ?? {}).outletId ?? null, localeOf(request as unknown as Request));
  }

  @Post("items/import/commit")
  @UseInterceptors(upload)
  async importCommit(@Req() request: AuthenticatedRequest, @UploadedFile() file: UploadedExcel, @Body() body: unknown): Promise<IposImportResult> {
    return this.imports.commit(await this.owner(request), file, importBody.parse(body ?? {}).outletId ?? null, localeOf(request as unknown as Request));
  }

  @Get("variant-options")
  async variantOptions(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposVariantOption[]> {
    return this.catalog.variantOptions(await this.owner(request), searchQuery.parse(query).search);
  }

  @Get("items/:id")
  async item(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposItemDetail> {
    return this.catalog.item(await this.owner(request), id);
  }

  @Post("items")
  async createItem(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposItemDetail> {
    return this.catalog.createItem(await this.owner(request), iposItemCreateSchema.parse(body));
  }

  @Patch("items/:id")
  async updateItem(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposItemDetail> {
    return this.catalog.updateItem(await this.owner(request), id, iposItemUpdateSchema.parse(body));
  }

  @Put("items/:id/outlet-prices")
  async outletPrices(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposItemDetail> {
    return this.catalog.saveOutletPrices(await this.owner(request), id, iposOutletPricesSchema.parse(body));
  }

  // API_347: tồn kho.
  @Get("stock")
  async stock(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposStockRow[]> {
    return this.stockService.stock(await this.owner(request), stockQuery.parse(query));
  }

  @Get("stock-documents")
  async documents(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposStockDocumentRow[]> {
    return this.stockService.documents(await this.owner(request), documentsQuery.parse(query).outletId);
  }

  @Get("stock-documents/:id")
  async document(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposStockDocumentDetail> {
    return this.stockService.document(await this.owner(request), id);
  }

  @Post("stock-documents")
  async createDocument(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposStockDocumentDetail> {
    return this.stockService.createDocument(await this.owner(request), iposStockDocumentSchema.parse(body));
  }

  @Get("stock-moves")
  async moves(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposStockMove[]> {
    return this.stockService.moves(await this.owner(request), movesQuery.parse(query));
  }

  // API_352: cài đặt bán hàng, mã điểm bán.
  @Get("settings")
  async settingsPage(@Req() request: AuthenticatedRequest): Promise<IposSettingsPage> {
    return this.settings.page(await this.owner(request));
  }

  @Put("settings")
  async saveSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposSettingsPage> {
    return this.settings.save(await this.owner(request), iposSettingsSchema.parse(body));
  }

  @Put("outlets/:id/code")
  async outletCode(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposSettingsPage> {
    return this.settings.saveOutletCode(await this.owner(request), id, iposOutletCodeSchema.parse(body).code);
  }

  // API_344: tổng quan.
  // API_353: thuê bao, phiếu phí, mã VietQR trả phí (MAN_HINH_301; chủ cửa hàng).
  @Get("subscription")
  async feeOverview(@Req() request: AuthenticatedRequest): Promise<IposMerchantFeeOverview> {
    return this.fees.merchantOverview((await this.owner(request)).merchantId);
  }

  @Get("fee-invoices/:id/vietqr")
  async feeVietqr(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposFeeVietqr> {
    return this.fees.vietqr((await this.owner(request)).merchantId, id);
  }

  @Get("overview")
  async overview(@Req() request: AuthenticatedRequest): Promise<IposOverview> {
    return this.reports.overview(await this.owner(request));
  }

  // API_350: ca (đóng hộ), hóa đơn, phiếu trả.
  @Get("shifts")
  async shifts(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposPortalShiftRow[]> {
    return this.reports.shifts(await this.owner(request), iposPortalPeriodQuery.parse(query));
  }

  @Get("shifts/:id")
  async shift(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposShiftReport> {
    return this.shiftsService.reportFor((await this.owner(request)).merchantId, id);
  }

  @Post("shifts/:id/close")
  async closeShift(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposShiftReport> {
    const member = await this.owner(request);
    return this.shiftsService.closeOnBehalf(member.merchantId, member.memberId, id, iposCloseShiftSchema.parse(body));
  }

  @Get("sales")
  async sales(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposPortalSaleRow[]> {
    return this.reports.sales(await this.owner(request), salesQuery.parse(query));
  }

  @Get("sales/:id")
  async sale(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposSale> {
    return this.salesService.detailForMerchant((await this.owner(request)).merchantId, id);
  }

  @Get("returns")
  async returnsList(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposPortalReturnRow[]> {
    return this.reports.returns(await this.owner(request), iposPortalPeriodQuery.parse(query));
  }

  @Get("returns/:id")
  async returnDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposReturn> {
    return this.returnsService.detail((await this.owner(request)).merchantId, id);
  }

  // API_351: báo cáo cửa hàng, xuất Excel.
  @Get("reports")
  async report(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposReport> {
    return this.reports.report(await this.owner(request), iposPortalPeriodQuery.parse(query));
  }

  @Get("reports/export")
  async exportReport(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Res() response: Response): Promise<void> {
    const period = iposPortalPeriodQuery.parse(query);
    const words = messages[localeOf(request as unknown as Request)].iposReport as Record<string, string>;
    const file = await this.reports.export(await this.owner(request), period, words);
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", `attachment; filename="bao-cao-ipos-${period.from}-${period.to}.xlsx"`);
    response.send(file);
  }
}
