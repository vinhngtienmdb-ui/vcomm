// API_95 đến API_101: kết nối ngân hàng (95–97), webhook (98), giao dịch ngân hàng (99), xử lý giao dịch (100), đối chiếu (101) (CONG_VIEC_18). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  bankReconciliationQuerySchema,
  bankVersionSchema,
  confirmBankReceiptSchema,
  ignoreBankTransactionSchema,
  matchBankTransactionSchema,
  type BankPaymentCandidate,
  type BankReconciliationResponse,
  bankTransactionListQuerySchema,
  saveBankConnectionSchema,
  simulateBankTransactionSchema,
  type BankConnectionsResponse,
  type BankTransactionItem,
  type BankTransactionsResponse,
  type SaveBankConnectionResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import { OwnRateLimit, Public, type AuthenticatedRequest } from "../auth/auth.guard";
import type { Request } from "express";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { BankReconciliationService } from "./bank-reconciliation.service";

@Controller()
export class BankReconciliationController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly bank: BankReconciliationService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "finance.access", "finance.bank.view", "finance.bank.setup");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("finance/bank-connections")
  async connections(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<BankConnectionsResponse> {
    return this.bank.connections(await this.actor(request, companyId));
  }

  @Put("finance/bank-connections/:fundId")
  async saveConnection(
    @Req() request: AuthenticatedRequest,
    @Param("fundId", UuidPipe) fundId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<SaveBankConnectionResponse> {
    return this.bank.saveConnection(await this.actor(request, companyId), fundId, saveBankConnectionSchema.parse(body));
  }

  @Post("finance/bank-connections/:fundId/simulate")
  async simulate(@Req() request: AuthenticatedRequest, @Param("fundId", UuidPipe) fundId: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BankTransactionItem> {
    return this.bank.simulate(await this.actor(request, companyId), fundId, simulateBankTransactionSchema.parse(body));
  }

  // Dịch vụ trung gian gọi, xác thực bằng khóa của kết nối (QUYTAC_NGHIEPVU_113).
  // Không giới hạn yêu cầu đúng khóa; chỉ đếm lần sai khóa theo địa chỉ IP (quyết định của người dùng ngày 2026-11-10).
  @Public()
  @OwnRateLimit()
  @Post("public/bank-webhooks/:connectionId")
  @HttpCode(200)
  async webhook(
    @Req() request: Request,
    @Param("connectionId", UuidPipe) connectionId: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
  ): Promise<{ success: true }> {
    return this.bank.receive(connectionId, authorization, body, request.ip ?? "khong-ro");
  }

  @Get("finance/bank-transactions")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<BankTransactionsResponse> {
    return this.bank.list(await this.actor(request, companyId), bankTransactionListQuerySchema.parse(query));
  }

  @Get("finance/bank-transactions/:id/candidates")
  async candidates(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<BankPaymentCandidate[]> {
    return this.bank.candidates(await this.actor(request, companyId), id);
  }

  @Post("finance/bank-transactions/:id/confirm-receipt")
  async confirmReceipt(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BankTransactionItem> {
    const input = confirmBankReceiptSchema.parse(body);
    return this.bank.confirmReceipt(await this.actor(request, companyId), id, input.partnerId, input.version);
  }

  @Post("finance/bank-transactions/:id/match")
  async match(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BankTransactionItem> {
    const input = matchBankTransactionSchema.parse(body);
    return this.bank.match(await this.actor(request, companyId), id, input.paymentId, input.version);
  }

  @Post("finance/bank-transactions/:id/ignore")
  async ignore(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BankTransactionItem> {
    const input = ignoreBankTransactionSchema.parse(body);
    return this.bank.ignore(await this.actor(request, companyId), id, input.reason, input.version);
  }

  @Post("finance/bank-transactions/:id/reopen")
  async reopen(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BankTransactionItem> {
    return this.bank.reopen(await this.actor(request, companyId), id, bankVersionSchema.parse(body).version);
  }

  @Get("finance/bank-reconciliation")
  async reconciliation(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<BankReconciliationResponse> {
    return this.bank.reconciliation(await this.actor(request, companyId), bankReconciliationQuerySchema.parse(query));
  }
}
