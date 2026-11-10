// API_84 đến API_86: quỹ, công nợ, phiếu thu chi (CONG_VIEC_13). Quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  debtPartnerQuerySchema,
  debtSummaryQuerySchema,
  financePartnerQuerySchema,
  fundLedgerQuerySchema,
  openDebtQuerySchema,
  saveFundSchema,
  saveOpeningDebtSchema,
  type DebtPartnerResponse,
  type DebtSummaryResponse,
  type FinancePartnerOption,
  type FundLedgerResponse,
  type FundResponse,
  type OpenDebtsResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { DebtsService } from "./debts.service";
import { FundsService } from "./funds.service";

@Controller("finance")
export class FinanceController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly debts: DebtsService,
    private readonly funds: FundsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "finance.access", "finance.debt.view");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("funds")
  async fundList(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<FundResponse[]> {
    return this.funds.list(await this.actor(request, companyId));
  }

  @Get("funds/:id")
  async fundDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<FundResponse> {
    return this.funds.detail(await this.actor(request, companyId), id);
  }

  @Get("funds/:id/ledger")
  async fundLedger(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<FundLedgerResponse> {
    const parsed = fundLedgerQuerySchema.parse(query);
    return this.funds.ledger(await this.actor(request, companyId), id, parsed.from, parsed.to);
  }

  @Post("funds")
  async fundCreate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<FundResponse> {
    return this.funds.create(await this.actor(request, companyId), saveFundSchema.parse(body));
  }

  @Patch("funds/:id")
  async fundUpdate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<FundResponse> {
    return this.funds.update(await this.actor(request, companyId), id, saveFundSchema.parse(body));
  }

  @Get("partners")
  async partners(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<FinancePartnerOption[]> {
    const parsed = financePartnerQuerySchema.parse(query);
    return this.debts.partners(await this.actor(request, companyId), parsed.side, parsed.search);
  }

  @Get("debts")
  async debtSummary(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<DebtSummaryResponse> {
    const parsed = debtSummaryQuerySchema.parse(query);
    return this.debts.summary(await this.actor(request, companyId), parsed.side, parsed.search, parsed.overdueOnly === "true");
  }

  @Get("debts/open")
  async openDebts(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<OpenDebtsResponse> {
    const parsed = openDebtQuerySchema.parse(query);
    return this.debts.openDebts(await this.actor(request, companyId), parsed.side, parsed.partnerId);
  }

  @Get("debts/partners/:partnerId")
  async debtPartner(
    @Req() request: AuthenticatedRequest,
    @Param("partnerId", UuidPipe) partnerId: string,
    @Query() query: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<DebtPartnerResponse> {
    return this.debts.partnerDetail(await this.actor(request, companyId), partnerId, debtPartnerQuerySchema.parse(query).side);
  }

  @Post("debts/opening")
  async openingCreate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DebtPartnerResponse> {
    return this.debts.createOpening(await this.actor(request, companyId), saveOpeningDebtSchema.parse(body));
  }

  @Delete("debts/opening/:id")
  async openingDelete(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<DebtPartnerResponse> {
    return this.debts.deleteOpening(await this.actor(request, companyId), id);
  }
}
