// API_87 đến API_89: khởi tạo kế toán, tài khoản, định khoản, bút toán, sổ sách (CONG_VIEC_14). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, Req, Res, StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import {
  closePeriodSchema,
  journalListQuerySchema,
  ledgerRangeQuerySchema,
  statementQuerySchema,
  type StatementResponse,
  saveJournalSchema,
  versionSchema,
  type AccountLedgerResponse,
  type JournalListItem,
  type JournalResponse,
  type LedgerPeriodsResponse,
  type TrialBalanceResponse,
  saveAccountSchema,
  updateAccountSchema,
  updatePostingRuleSchema,
  type AccountResponse,
  type LedgerSetupResponse,
  type PostingRuleResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { JournalsService } from "./journals.service";
import { statementFileName, statementPdf, statementXlsx } from "./statement-export";
import { StatementsService } from "./statements.service";
import { LedgerReportsService } from "./ledger-reports.service";
import { LedgerService } from "./ledger.service";
import type { PostingRole } from "./postings";

@Controller("finance")
export class LedgerController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly ledger: LedgerService,
    private readonly journals: JournalsService,
    private readonly reports: LedgerReportsService,
    private readonly statements: StatementsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "finance.access", "finance.ledger.view");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("ledger/setup")
  async setupStatus(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<LedgerSetupResponse> {
    return this.ledger.setupStatus(await this.actor(request, companyId));
  }

  @Post("ledger/setup")
  async setup(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<LedgerSetupResponse> {
    return this.ledger.setup(await this.actor(request, companyId));
  }

  @Get("accounts")
  async accounts(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<AccountResponse[]> {
    return this.ledger.accounts(await this.actor(request, companyId));
  }

  @Post("accounts")
  async createAccount(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AccountResponse[]> {
    return this.ledger.createAccount(await this.actor(request, companyId), saveAccountSchema.parse(body));
  }

  @Patch("accounts/:id")
  async updateAccount(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AccountResponse[]> {
    return this.ledger.updateAccount(await this.actor(request, companyId), id, updateAccountSchema.parse(body));
  }

  @Get("posting-rules")
  async postingRules(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PostingRuleResponse[]> {
    return this.ledger.postingRules(await this.actor(request, companyId));
  }

  @Put("posting-rules/:role")
  async updatePostingRule(@Req() request: AuthenticatedRequest, @Param("role") role: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PostingRuleResponse[]> {
    return this.ledger.updatePostingRule(await this.actor(request, companyId), role as PostingRole, updatePostingRuleSchema.parse(body).accountId);
  }

  @Get("journals")
  async journalList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<JournalListItem[]> {
    return this.journals.list(await this.actor(request, companyId), journalListQuerySchema.parse(query));
  }

  @Get("journals/:id")
  async journalDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<JournalResponse> {
    return this.journals.detail(await this.actor(request, companyId), id);
  }

  @Post("journals")
  async journalCreate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<JournalResponse> {
    return this.journals.create(await this.actor(request, companyId), saveJournalSchema.parse(body));
  }

  @Patch("journals/:id")
  async journalUpdate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<JournalResponse> {
    return this.journals.update(await this.actor(request, companyId), id, saveJournalSchema.parse(body));
  }

  @Post("journals/:id/submit")
  async journalSubmit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<JournalResponse> {
    return this.journals.submit(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Post("journals/:id/withdraw")
  async journalWithdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<JournalResponse> {
    return this.journals.withdraw(await this.actor(request, companyId), id);
  }

  @Get("ledger/periods")
  async periods(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<LedgerPeriodsResponse> {
    return this.journals.periods(await this.actor(request, companyId));
  }

  @Post("ledger/periods/close")
  async closePeriod(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LedgerPeriodsResponse> {
    const parsed = closePeriodSchema.parse(body);
    return this.journals.close(await this.actor(request, companyId), parsed.month, parsed.confirmRevaluation);
  }

  @Post("ledger/periods/reopen")
  async reopenPeriod(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<LedgerPeriodsResponse> {
    return this.journals.reopen(await this.actor(request, companyId));
  }

  @Get("ledger/trial-balance")
  async trialBalance(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<TrialBalanceResponse> {
    const parsed = ledgerRangeQuerySchema.parse(query);
    return this.reports.trialBalance(await this.actor(request, companyId), parsed.from, parsed.to);
  }

  @Get("ledger/accounts/:id")
  async accountLedger(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<AccountLedgerResponse> {
    const parsed = ledgerRangeQuerySchema.parse(query);
    return this.reports.accountLedger(await this.actor(request, companyId), id, parsed.from, parsed.to);
  }

  // API_90: báo cáo tài chính; format=xlsx hoặc pdf thì trả tệp.
  @Get("statements")
  async statement(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<StatementResponse | StreamableFile> {
    const parsed = statementQuerySchema.parse(query);
    const report = await this.statements.statement(await this.actor(request, companyId), parsed.kind, parsed.from ?? parsed.to, parsed.to, parsed.form);
    if (!parsed.format) return report;
    const content = parsed.format === "xlsx" ? await statementXlsx(report) : await statementPdf(report);
    response.setHeader("content-type", parsed.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf");
    response.setHeader("content-disposition", `${parsed.format === "pdf" ? "inline" : "attachment"}; filename="${statementFileName(report, parsed.format)}"`);
    return new StreamableFile(content);
  }
}
