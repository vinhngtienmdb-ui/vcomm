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
import { CatalogController } from "./catalog/catalog.controller";
import { CatalogItemsService } from "./catalog/catalog-items.service";
import { PriceChangesService } from "./catalog/price-changes.service";
import { PriceListsService } from "./catalog/price-lists.service";
import { PricingController } from "./catalog/pricing.controller";
import { InventoryController } from "./inventory/inventory.controller";
import { CrmController } from "./crm/crm.controller";
import { PartnersService } from "./crm/partners.service";
import { PurchasingController } from "./purchasing/purchasing.controller";
import { SupplierPricesService } from "./purchasing/supplier-prices.service";
import { ReservationsService } from "./inventory/reservations.service";
import { StockDocumentsService } from "./inventory/stock-documents.service";
import { StockLedgerService } from "./inventory/stock-ledger.service";
import { StockService } from "./inventory/stock.service";
import { LabelsService } from "./inventory/labels.service";
import { StockLevelsService } from "./inventory/stock-levels.service";
import { StocktakesService } from "./inventory/stocktakes.service";
import { TransfersService } from "./inventory/transfers.service";
import { WarehousesService } from "./inventory/warehouses.service";
import { CategoriesService } from "./catalog/categories.service";
import { UnitsService } from "./catalog/units.service";
import { ProductsService } from "./catalog/products.service";
import { ProductImagesService } from "./catalog/product-images.service";
import { ProductImportService } from "./catalog/product-import.service";
import { VariantLinksService } from "./catalog/variant-links.service";
import { ProposalsService } from "./proposals/proposals.service";
import { EXCHANGE_RATE_FEED, VietcombankFeed } from "./settings/vietcombank-rates";
import { DeactivationService } from "./users/deactivation.service";
import { UsersController } from "./users/users.controller";
import { InvitationsService } from "./users/invitations.service";
import { UserImportService } from "./users/user-import.service";
import { UsersService } from "./users/users.service";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, MeController, HomeController, RolesController, UsersController, OrganizationController, ApprovalsController, SettingsController, IntegrationsController, ProposalsController, CatalogController, PricingController, InventoryController, CrmController, PurchasingController],
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
    CategoriesService,
    UnitsService,
    ProductsService,
    ProductImagesService,
    ProductImportService,
    VariantLinksService,
    CatalogItemsService,
    PriceListsService,
    PriceChangesService,
    WarehousesService,
    PartnersService,
    SupplierPricesService,
    StockLedgerService,
    ReservationsService,
    StockService,
    StockDocumentsService,
    TransfersService,
    StocktakesService,
    StockLevelsService,
    LabelsService,
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
