// API_136: rút tiền hoa hồng (CONG_VIEC_26; QUYTAC_NGHIEPVU_204 đến 206): ứng dụng tạo, rút lại; quản trị danh sách, duyệt, từ chối, ghi đã chi, bảng kê thuế.
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import {
  createWithdrawalSchema,
  type PageResponse,
  payWithdrawalSchema,
  rejectWithdrawalSchema,
  type WithdrawalItem,
  withdrawalListQuerySchema,
  type WithdrawalTaxReport,
  withdrawalTaxReportQuerySchema,
  withdrawalVersionSchema,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "./buyer-admin.service";
import { WithdrawalsService } from "./withdrawals.service";

const permission = "marketplace.payment.manage";

@Controller()
export class WithdrawalsController {
  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly admin: BuyerAdminService,
  ) {}

  @Post("buyer/withdrawals")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<WithdrawalItem> {
    return this.withdrawals.create(request.auth.userId, Number(createWithdrawalSchema.parse(body).amount));
  }

  @Post("buyer/withdrawals/:id/cancel")
  @HttpCode(200)
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<WithdrawalItem> {
    return this.withdrawals.cancel(request.auth.userId, id, withdrawalVersionSchema.parse(body).version);
  }

  @Get("marketplace/withdrawals")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<WithdrawalItem>> {
    return this.withdrawals.list(await this.admin.actor(request.auth.userId, clientInfo(request), permission), withdrawalListQuerySchema.parse(query));
  }

  @Get("marketplace/withdrawals/tax-report")
  async taxReport(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<WithdrawalTaxReport> {
    return this.withdrawals.taxReport(await this.admin.actor(request.auth.userId, clientInfo(request), permission), withdrawalTaxReportQuerySchema.parse(query).month);
  }

  @Post("marketplace/withdrawals/:id/approve")
  @HttpCode(200)
  async approve(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<WithdrawalItem> {
    return this.withdrawals.approve(await this.admin.actor(request.auth.userId, clientInfo(request), permission), id, withdrawalVersionSchema.parse(body).version);
  }

  @Post("marketplace/withdrawals/:id/reject")
  @HttpCode(200)
  async reject(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<WithdrawalItem> {
    return this.withdrawals.reject(await this.admin.actor(request.auth.userId, clientInfo(request), permission), id, rejectWithdrawalSchema.parse(body));
  }

  @Post("marketplace/withdrawals/:id/pay")
  @HttpCode(200)
  async pay(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<WithdrawalItem> {
    return this.withdrawals.pay(await this.admin.actor(request.auth.userId, clientInfo(request), permission), id, payWithdrawalSchema.parse(body));
  }
}
