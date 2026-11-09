import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ApprovalPoliciesService } from "./approvals/approval-policies.service";
import { ApprovalRequestsService } from "./approvals/approval-requests.service";
import { ApprovalsController } from "./approvals/approvals.controller";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { ActivationService } from "./auth/activation.service";
import { MfaService } from "./auth/mfa.service";
import { PasswordService } from "./auth/password.service";
import { AuthService } from "./auth/auth.service";
import { ApiErrorFilter } from "./common/api-error";
import { AuditService } from "./common/audit.service";
import { OutboxService } from "./common/outbox.service";
import { CLOCK, systemClock } from "./common/clock";
import { LogOutboundMessages, OUTBOUND_MESSAGES } from "./common/outbound-messages";
import { DatabaseModule } from "./database/database.module";
import { HomeController } from "./home/home.controller";
import { MeController } from "./me/me.controller";
import { BranchesService } from "./organization/branches.service";
import { CompaniesService } from "./organization/companies.service";
import { DepartmentsService } from "./organization/departments.service";
import { OrganizationController } from "./organization/organization.controller";
import { PermissionService } from "./permissions/permission.service";
import { RolesController } from "./permissions/roles.controller";
import { RolesService } from "./permissions/roles.service";
import { UsersController } from "./users/users.controller";
import { InvitationsService } from "./users/invitations.service";
import { UserImportService } from "./users/user-import.service";
import { UsersService } from "./users/users.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, MeController, HomeController, RolesController, UsersController, OrganizationController, ApprovalsController],
  providers: [
    AuthService,
    ActivationService,
    MfaService,
    PasswordService,
    InvitationsService,
    UserImportService,
    { provide: OUTBOUND_MESSAGES, useClass: LogOutboundMessages },
    AuditService,
    PermissionService,
    RolesService,
    UsersService,
    CompaniesService,
    ApprovalPoliciesService,
    ApprovalRequestsService,
    OutboxService,
    BranchesService,
    DepartmentsService,
    { provide: CLOCK, useValue: systemClock },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
export class AppModule {}
