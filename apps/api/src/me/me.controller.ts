// API_14: hồ sơ, công ty thuộc về, công ty đang chọn, quyền trong công ty đang chọn.
import { Controller, Get, Headers, Inject, Req } from "@nestjs/common";
import type { MeResponse } from "contracts";
import { eq } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { DATABASE, type Database } from "../database/database.module";
import { users } from "../database/schema";
import { PermissionService } from "../permissions/permission.service";

@Controller("me")
export class MeController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
  ) {}

  @Get()
  async me(@Req() request: AuthenticatedRequest, @Headers("x-company-id") requestedCompanyId?: string): Promise<MeResponse> {
    const rows = await this.database.select().from(users).where(eq(users.id, request.auth.userId)).limit(1);
    const user = rows[0];
    if (!user) throw new ApiError("UNAUTHENTICATED", "unauthenticated");
    const { companyId, companies } = await this.permissionService.resolveCompany(user.id, requestedCompanyId);
    const permissions = companyId ? await this.permissionService.permissionsInCompany(user.id, companyId) : [];
    return {
      user: { id: user.id, fullName: user.fullName, email: user.email, locale: user.locale === "en" ? "en" : "vi" },
      companies,
      currentCompanyId: companyId,
      permissions,
    };
  }
}
