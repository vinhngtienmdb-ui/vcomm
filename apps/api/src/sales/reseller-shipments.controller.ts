// API_310, API_311: vận đơn đơn dropship của người bán, phiếu giao danh nghĩa người bán (CONG_VIEC_62 CHUC_NANG_225; QUYTAC_NGHIEPVU_507).
// Quyền: vào mini app Kho; quyền xuất giao hàng tại kho của đơn kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import {
  resellerShipmentCarrierSchema,
  resellerShipmentListQuerySchema,
  resellerShipmentManualSchema,
  resellerShipmentVersionSchema,
  type ResellerShipmentListResponse,
  type ResellerShipmentOrder,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { inventoryPermissions } from "../inventory/inventory-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ResellerShipmentsService } from "./reseller-shipments.service";

@Controller("sales")
export class ResellerShipmentsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly shipments: ResellerShipmentsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, inventoryPermissions.access);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("reseller-shipments")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ResellerShipmentListResponse> {
    return this.shipments.list(await this.actor(request, companyId), resellerShipmentListQuerySchema.parse(query));
  }

  @Get("orders/:id/reseller-shipment")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ResellerShipmentOrder> {
    return this.shipments.detail(await this.actor(request, companyId), id);
  }

  @Patch("orders/:id/reseller-shipment")
  async saveManual(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ResellerShipmentOrder> {
    return this.shipments.saveManual(await this.actor(request, companyId), id, resellerShipmentManualSchema.parse(body));
  }

  @Post("orders/:id/reseller-shipment/carrier")
  async createWithCarrier(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ResellerShipmentOrder> {
    const input = resellerShipmentCarrierSchema.parse(body);
    return this.shipments.createWithCarrier(await this.actor(request, companyId), id, input.carrierCode, input.version);
  }

  @Post("orders/:id/reseller-shipment/carrier/refresh")
  async refresh(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ResellerShipmentOrder> {
    return this.shipments.refresh(await this.actor(request, companyId), id);
  }

  @Post("orders/:id/reseller-shipment/carrier/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ResellerShipmentOrder> {
    return this.shipments.cancel(await this.actor(request, companyId), id, resellerShipmentVersionSchema.parse(body).version);
  }

  @Get("orders/:id/reseller-delivery-note")
  async deliveryNote(@Req() request: AuthenticatedRequest, @Res() response: Response, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    const note = await this.shipments.deliveryNote(await this.actor(request, companyId), id);
    response.setHeader("content-type", "application/pdf");
    response.setHeader("content-disposition", `attachment; filename="${note.fileName.replace(/[^\w.-]/g, "-")}"`);
    response.end(note.content);
  }
}
