// API_348, API_349: cổng cửa hàng nhóm iPOS – quyền vào, quầy, mã ghép, thiết bị, duyệt thu ngân tự đăng ký (CONG_VIEC_74).
// Quầy, thiết bị, duyệt thu ngân chỉ chủ cửa hàng; thu ngân xem được quyền vào nhóm iPOS của điểm bán được gán.
import { Body, Controller, Get, Param, Post, Put, Req } from "@nestjs/common";
import {
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
import { UuidPipe } from "../common/uuid.pipe";
import { IposRegistersService } from "./ipos-registers.service";
import { IposRegistrationsService } from "./ipos-registrations.service";

@Controller("merchant-portal/ipos")
export class IposPortalController {
  constructor(
    private readonly portal: MerchantPortalService,
    private readonly registersService: IposRegistersService,
    private readonly registrations: IposRegistrationsService,
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
}
