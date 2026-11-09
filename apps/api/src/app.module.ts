import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ApprovalPoliciesService } from "./approvals/approval-policies.service";
import { ApprovalRequestsService } from "./approvals/approval-requests.service";
import { ApprovalsController } from "./approvals/approvals.controller";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { ActivationService } from "./auth/activation.service";
import { MfaService } from "./auth/mfa.service";
import { HttpOauthClient, OAUTH_CLIENT } from "./auth/oauth-providers";
import { OauthService } from "./auth/oauth.service";
import { PhoneOtpService } from "./auth/phone-otp.service";
import { PasswordService } from "./auth/password.service";
import { AuthService } from "./auth/auth.service";
import { ApiErrorFilter } from "./common/api-error";
import { AuditService } from "./common/audit.service";
import { OutboxService } from "./common/outbox.service";
import { defaultRateLimit, RATE_LIMIT, RateLimiter } from "./common/rate-limiter";
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
import { AuditEventsService } from "./settings/audit-events.service";
import { ExchangeRatesService } from "./settings/exchange-rates.service";
import { NumberSequencesService } from "./settings/number-sequences.service";
import { SettingsController } from "./settings/settings.controller";
import { EsmsGateway, MESSAGE_GATEWAY } from "./integrations/esms-gateway";
import { IntegrationSettingsService } from "./integrations/integration-settings.service";
import { IntegrationsController } from "./integrations/integrations.controller";
import { MessagingService } from "./integrations/messaging.service";
import { ZnsNotifier } from "./integrations/zns-notifier";
import { createFileStorage, FILE_STORAGE } from "./common/file-storage";
import { ProposalPdfService } from "./proposals/proposal-pdf.service";
import { ProposalTemplatesService } from "./proposals/proposal-templates.service";
import { ProposalsController } from "./proposals/proposals.controller";
import { ProposalsService } from "./proposals/proposals.service";
import { EXCHANGE_RATE_FEED, VietcombankFeed } from "./settings/vietcombank-rates";
import { DeactivationService } from "./users/deactivation.service";
import { UsersController } from "./users/users.controller";
import { InvitationsService } from "./users/invitations.service";
import { UserImportService } from "./users/user-import.service";
import { UsersService } from "./users/users.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, MeController, HomeController, RolesController, UsersController, OrganizationController, ApprovalsController, SettingsController, IntegrationsController, ProposalsController],
  providers: [
    AuthService,
    ActivationService,
    MfaService,
    PasswordService,
    InvitationsService,
    UserImportService,
    { provide: OUTBOUND_MESSAGES, useClass: LogOutboundMessages },
    { provide: EXCHANGE_RATE_FEED, useClass: VietcombankFeed },
    { provide: MESSAGE_GATEWAY, useClass: EsmsGateway },
    IntegrationSettingsService,
    MessagingService,
    ZnsNotifier,
    { provide: FILE_STORAGE, useFactory: createFileStorage },
    ProposalTemplatesService,
    ProposalsService,
    ProposalPdfService,
    PhoneOtpService,
    OauthService,
    { provide: OAUTH_CLIENT, useClass: HttpOauthClient },
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
    DeactivationService,
    NumberSequencesService,
    ExchangeRatesService,
    AuditEventsService,
    { provide: CLOCK, useValue: systemClock },
    { provide: RATE_LIMIT, useValue: defaultRateLimit },
    RateLimiter,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
export class AppModule {}
