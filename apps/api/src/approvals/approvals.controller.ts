// API_37 đến API_42 (CHUC_NANG_15 đến 18).
import { Body, Controller, Get, Headers, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import {
  approvalDecisionSchema,
  approvalInboxQuerySchema,
  createApprovalPolicySchema,
  createApprovalRequestSchema,
  type ApprovalInboxItem,
  type ApprovalPolicyResponse,
  type ApprovalRequestResponse,
  type DocumentTypeResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ApprovalPoliciesService } from "./approval-policies.service";
import { ApprovalRequestsService } from "./approval-requests.service";

// Gửi duyệt qua HTTP chỉ cho chứng từ thử của Nền tảng và chỉ ngoài môi trường thật; mini app khác gọi qua service.
const testDocumentsEnabled = () => process.env.NODE_ENV !== "production" && process.env.APPROVAL_TEST_DOCUMENTS !== "disabled";

@Controller()
export class ApprovalsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly policies: ApprovalPoliciesService,
    private readonly requests: ApprovalRequestsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, permission: string): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, permission);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("document-types")
  async documentTypes(): Promise<DocumentTypeResponse[]> {
    return this.policies.documentTypes();
  }

  // API_37
  @Get("approval-policies")
  async listPolicies(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ApprovalPolicyResponse[]> {
    return this.policies.list(await this.actor(request, companyId, "platform.approval_policy.manage"));
  }

  @Post("approval-policies")
  async createPolicy(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ApprovalPolicyResponse> {
    const actor = await this.actor(request, companyId, "platform.approval_policy.manage");
    return this.policies.create(actor, createApprovalPolicySchema.parse(body));
  }

  // API_38 (chứng từ thử)
  @Post("approval-requests")
  async submit(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ApprovalRequestResponse> {
    const input = createApprovalRequestSchema.parse(body);
    if (!testDocumentsEnabled() || !input.documentTypeCode.startsWith("platform.")) throw new ApiError("FORBIDDEN", "forbidden");
    const actor = await this.actor(request, companyId, "platform.access");
    return this.requests.submit(actor.companyId, actor.userId, input);
  }

  // API_39: khai báo trước ":id".
  @Get("approval-requests/inbox")
  async inbox(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<ApprovalInboxItem[]> {
    return this.requests.inbox(request.auth.userId, approvalInboxQuerySchema.parse(query));
  }

  // API_40
  @Get("approval-requests/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<ApprovalRequestResponse> {
    return this.requests.detail(request.auth.userId, id);
  }

  // API_41
  @Post("approval-requests/:id/decisions")
  @HttpCode(200)
  async decide(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<ApprovalRequestResponse> {
    const input = approvalDecisionSchema.parse(body);
    return this.requests.decide(request.auth.userId, id, input.decision, input.comment);
  }

  // API_42
  @Post("approval-requests/:id/withdraw")
  @HttpCode(200)
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<ApprovalRequestResponse> {
    return this.requests.withdraw(request.auth.userId, id);
  }
}
