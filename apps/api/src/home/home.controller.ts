// API_19: trang chủ mini app (CHUC_NANG_14, QUYTAC_NGHIEPVU_16).
import { Controller, Get, Headers, Inject, Req } from "@nestjs/common";
import type { HomeResponse } from "contracts";
import { asc, eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { DATABASE, type Database } from "../database/database.module";
import { apps } from "../database/schema";
import { PermissionService } from "../permissions/permission.service";

@Controller("home")
export class HomeController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
  ) {}

  @Get()
  async home(@Req() request: AuthenticatedRequest, @Headers("x-company-id") requestedCompanyId?: string): Promise<HomeResponse> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) return { apps: [], pendingApprovals: [] };
    const granted = new Set(await this.permissionService.permissionsInCompany(request.auth.userId, companyId));
    const allApps = await this.database.select().from(apps).where(eq(apps.isActive, true)).orderBy(asc(apps.sortOrder));
    return {
      // Số việc chờ của từng mini app có khi các module đó được xây; chứng từ chờ duyệt có ở lát L7.
      apps: allApps
        .filter((app) => granted.has(`${app.code}.access`))
        .map((app) => ({ code: app.code, nameVi: app.nameVi, nameEn: app.nameEn, url: app.baseUrl, icon: app.icon, pendingCount: 0 })),
      pendingApprovals: [],
    };
  }
}
