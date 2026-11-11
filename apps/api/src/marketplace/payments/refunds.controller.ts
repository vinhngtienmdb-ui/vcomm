// API_133: tài khoản nhận hoàn tiền của người mua; việc chờ hoàn, ghi đã hoàn trên web (CONG_VIEC_25; QUYTAC_NGHIEPVU_168).
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import { buyerBankAccountSchema, type BuyerBankAccount, completeRefundSchema, type PageResponse, type RefundItem, refundListQuerySchema } from "contracts";
import { clientInfo } from "../../auth/auth.controller";
import type { AuthenticatedRequest } from "../../auth/auth.guard";
import { UuidPipe } from "../../common/uuid.pipe";
import { BuyerAdminService } from "../buyer-admin.service";
import { RefundsService } from "./refunds.service";

@Controller()
export class RefundsController {
  constructor(
    private readonly refunds: RefundsService,
    private readonly admin: BuyerAdminService,
  ) {}

  @Get("buyer/bank-account")
  async bankAccount(@Req() request: AuthenticatedRequest): Promise<{ bankAccount: BuyerBankAccount | null }> {
    return { bankAccount: await this.refunds.bankAccount(request.auth.userId) };
  }

  @Put("buyer/bank-account")
  async saveBankAccount(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<{ bankAccount: BuyerBankAccount }> {
    return { bankAccount: await this.refunds.saveBankAccount(request.auth.userId, buyerBankAccountSchema.parse(body)) };
  }

  @Get("marketplace/refunds")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<RefundItem>> {
    return this.refunds.list(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.payment.manage"), refundListQuerySchema.parse(query));
  }

  @Post("marketplace/refunds/:id/complete")
  @HttpCode(200)
  async complete(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<RefundItem> {
    return this.refunds.complete(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.payment.manage"), id, completeRefundSchema.parse(body));
  }
}
