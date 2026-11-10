// API_87 đến API_89: khởi tạo kế toán, tài khoản, định khoản, bút toán, sổ sách (CONG_VIEC_14). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Req } from "@nestjs/common";
import { saveAccountSchema, updateAccountSchema, updatePostingRuleSchema, type AccountResponse, type LedgerSetupResponse, type PostingRuleResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { LedgerService } from "./ledger.service";
import type { PostingRole } from "./postings";

@Controller("finance")
export class LedgerController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly ledger: LedgerService,
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
}
