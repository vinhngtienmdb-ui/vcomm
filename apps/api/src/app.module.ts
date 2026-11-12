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
import { VisitsService } from "./crm/visits.service";
import { BuyerController } from "./marketplace/buyer.controller";
import { BuyerAccountsService } from "./marketplace/buyer-accounts.service";
import { BuyerAdminService } from "./marketplace/buyer-admin.service";
import { MarketplaceController } from "./marketplace/marketplace.controller";
import { SalesTeamService } from "./marketplace/sales-team.service";
import { SalesProposalsService } from "./marketplace/sales-proposals.service";
import { StoreService } from "./marketplace/store.service";
import { ShopController } from "./marketplace/shop.controller";
import { ShopService } from "./marketplace/shop.service";
import { MarketplaceOrdersService } from "./marketplace/marketplace-orders.service";
import { ShipmentsService } from "./marketplace/shipments.service";
import { ReturnRequestsService } from "./marketplace/return-requests.service";
import { CarrierWebhookController } from "./marketplace/carrier-webhook.controller";
import { PaymentsController } from "./marketplace/payments/payments.controller";
import { MarketplacePaymentsService } from "./marketplace/payments/payments.service";
import { BankTransferService } from "./marketplace/payments/bank-transfer.service";
import { RefundsController } from "./marketplace/payments/refunds.controller";
import { RefundsService } from "./marketplace/payments/refunds.service";
import { WithdrawalsController } from "./marketplace/withdrawals.controller";
import { WithdrawalsService } from "./marketplace/withdrawals.service";
import { CollaboratorsController } from "./marketplace/collaborators.controller";
import { CollaboratorsService } from "./marketplace/collaborators.service";
import { GroupBuysController } from "./marketplace/group-buys.controller";
import { GroupBuysService } from "./marketplace/group-buys.service";
import { WalletsController } from "./marketplace/wallets.controller";
import { WalletsService } from "./marketplace/wallets.service";
import { CommunityController } from "./marketplace/community.controller";
import { CommunityService } from "./marketplace/community.service";
import { MarketplaceCommissionsService } from "./marketplace/commissions.service";
import { LoyaltyController } from "./loyalty/loyalty.controller";
import { LoyaltyProgramService } from "./loyalty/program.service";
import { LoyaltyLedgerService } from "./loyalty/ledger.service";
import { LoyaltyAccountsService } from "./loyalty/accounts.service";
import { BuyerLoyaltyController } from "./loyalty/buyer-loyalty.controller";
import { LoyaltyPostingsService } from "./loyalty/postings.service";
import { LoyaltyJobsService } from "./loyalty/jobs.service";
import { LoyaltyAdminService } from "./loyalty/admin.service";
import { AffiliateController } from "./affiliate/affiliate.controller";
import { MerchantPortalController } from "./affiliate/merchant-portal.controller";
import { AffiliateMerchantsService } from "./affiliate/merchants.service";
import { MerchantPortalService } from "./affiliate/portal.service";
import { AffiliateTransactionsService } from "./affiliate/transactions.service";
import { AffiliateVouchersService } from "./affiliate/vouchers.service";
import { AffiliateSettlementsService } from "./affiliate/settlements.service";
import { BuyerAffiliateController } from "./affiliate/buyer-affiliate.controller";
import { PurchasingController } from "./purchasing/purchasing.controller";
import { PurchasingImportsController } from "./purchasing/imports.controller";
import { ImportDeclarationsService } from "./purchasing/import-declarations.service";
import { LandedCostsService } from "./purchasing/landed-costs.service";
import { CostAdjustmentsService } from "./inventory/cost-adjustments.service";
import { SalesController } from "./sales/sales.controller";
import { SalesOrdersService } from "./sales/sales-orders.service";
import { InternalTradeService } from "./sales/internal-trade.service";
import { PromotionsService } from "./sales/promotions.service";
import { FinanceController } from "./finance/finance.controller";
import { RetailController } from "./retail/retail.controller";
import { RetailReturnsService } from "./retail/retail-returns.service";
import { RetailSalesService } from "./retail/retail-sales.service";
import { RetailShiftsService } from "./retail/retail-shifts.service";
import { RetailStoresService } from "./retail/retail-stores.service";
import { ContractRemindersService } from "./hr/contract-reminders.service";
import { ContractsService } from "./hr/contracts.service";
import { EmployeesService } from "./hr/employees.service";
import { HrController } from "./hr/hr.controller";
import { AttendanceController } from "./hr/attendance.controller";
import { AttendanceDaysService } from "./hr/attendance-days.service";
import { AttendanceSetupService } from "./hr/attendance-setup.service";
import { AttendanceService } from "./hr/attendance.service";
import { AttendanceLocationsService } from "./hr/attendance-locations.service";
import { MyAttendanceController } from "./hr/my-attendance.controller";
import { MyAttendanceService } from "./hr/my-attendance.service";
import { PayrollController } from "./hr/payroll.controller";
import { PayrollSetupService } from "./hr/payroll-setup.service";
import { DatabaseTimesheetReader, PAYROLL_TIMESHEET } from "./hr/payroll-timesheet";
import { PayrollsService } from "./hr/payrolls.service";
import { LeaveController } from "./hr/leave.controller";
import { LeaveService } from "./hr/leave.service";
import { OvertimeTimesheetsController } from "./hr/overtime-timesheets.controller";
import { OvertimeService } from "./hr/overtime.service";
import { TimesheetsService } from "./hr/timesheets.service";
import { CandidatesService } from "./hr/candidates.service";
import { CareersController } from "./hr/careers.controller";
import { InterviewerController } from "./hr/interviewer.controller";
import { InterviewsService } from "./hr/interviews.service";
import { JobOffersService } from "./hr/job-offers.service";
import { OfferAnswersController } from "./hr/offer-answers.controller";
import { ReviewsController } from "./hr/reviews.controller";
import { ReviewsService } from "./hr/reviews.service";
import { RecruitmentController } from "./hr/recruitment.controller";
import { RecruitmentService } from "./hr/recruitment.service";
import { WorkEventsService } from "./hr/work-events.service";
import { DebtsService } from "./finance/debts.service";
import { FundsService } from "./finance/funds.service";
import { PaymentsService } from "./finance/payments.service";
import { LedgerService } from "./accounting/ledger.service";
import { LedgerController } from "./accounting/ledger.controller";
import { JournalsService } from "./accounting/journals.service";
import { LedgerReportsService } from "./accounting/ledger-reports.service";
import { StatementsService } from "./accounting/statements.service";
import { BankReconciliationController } from "./bank/bank-reconciliation.controller";
import { BankReconciliationService } from "./bank/bank-reconciliation.service";
import { CollectionStatementsController } from "./collection/collection-statements.controller";
import { CollectionStatementsService } from "./collection/collection-statements.service";
import { ConsolidationController } from "./consolidation/consolidation.controller";
import { ConsolidationService } from "./consolidation/consolidation.service";
import { AnalyticsController } from "./analytics/analytics.controller";
import { AnalyticsScopeService } from "./analytics/analytics-scope.service";
import { SalesReportService } from "./analytics/sales-report.service";
import { InventoryReportService } from "./analytics/inventory-report.service";
import { DebtReportService } from "./analytics/debt-report.service";
import { CommissionReportService } from "./analytics/commission-report.service";
import { OverviewService } from "./analytics/overview.service";
import { EinvoiceCorrectionsService } from "./einvoice/einvoice-corrections.service";
import { EinvoiceSettingsService } from "./einvoice/einvoice-settings.service";
import { EinvoicesController } from "./einvoice/einvoices.controller";
import { EinvoicesService } from "./einvoice/einvoices.service";
import { SupplierPricesService } from "./purchasing/supplier-prices.service";
import { RequisitionsService } from "./purchasing/requisitions.service";
import { PurchaseOrdersService } from "./purchasing/orders.service";
import { ReservationsService } from "./inventory/reservations.service";
import { StockDocumentsService } from "./inventory/stock-documents.service";
import { StockLedgerService } from "./inventory/stock-ledger.service";
import { StockService } from "./inventory/stock.service";
import { LabelsService } from "./inventory/labels.service";
import { StockLevelsService } from "./inventory/stock-levels.service";
import { StocktakesService } from "./inventory/stocktakes.service";
import { TransfersService } from "./inventory/transfers.service";
import { WarehousesService } from "./inventory/warehouses.service";
import { PurchaseReceiptsService } from "./inventory/purchase-receipts.service";
import { SalesDeliveriesService } from "./inventory/sales-deliveries.service";
import { ServiceDocumentsService } from "./inventory/service-documents.service";
import { InternalReceiptsService } from "./inventory/internal-receipts.service";
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
  controllers: [AuthController, MeController, HomeController, RolesController, UsersController, OrganizationController, ApprovalsController, SettingsController, IntegrationsController, ProposalsController, CatalogController, PricingController, InventoryController, CrmController, PurchasingController, SalesController, FinanceController, LedgerController, EinvoicesController, BankReconciliationController, CollectionStatementsController, ConsolidationController, BuyerController, MarketplaceController, ShopController, CarrierWebhookController, PaymentsController, RefundsController, WithdrawalsController, HrController, AttendanceController, MyAttendanceController, LeaveController, OvertimeTimesheetsController, PayrollController, AnalyticsController, RecruitmentController, CareersController, InterviewerController, OfferAnswersController, ReviewsController, LoyaltyController, BuyerLoyaltyController, AffiliateController, MerchantPortalController, BuyerAffiliateController, CollaboratorsController, GroupBuysController, WalletsController, CommunityController, PurchasingImportsController, RetailController],
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
    EmployeesService,
    WorkEventsService,
    AttendanceDaysService,
    AttendanceSetupService,
    AttendanceService,
    AttendanceLocationsService,
    MyAttendanceService,
    LeaveService,
    OvertimeService,
    TimesheetsService,
    ContractsService,
    PayrollSetupService,
    PayrollsService,
    { provide: PAYROLL_TIMESHEET, useClass: DatabaseTimesheetReader },
    ContractRemindersService,
    RecruitmentService,
    CandidatesService,
    InterviewsService,
    JobOffersService,
    ReviewsService,
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
    PurchaseReceiptsService,
    CostAdjustmentsService,
    ImportDeclarationsService,
    LandedCostsService,
    SalesDeliveriesService,
    InternalReceiptsService,
    PartnersService,
    VisitsService,
    BuyerAccountsService,
    BuyerAdminService,
    SalesTeamService,
    SalesProposalsService,
    StoreService,
    ShopService,
    MarketplaceOrdersService,
    ShipmentsService,
    MarketplacePaymentsService,
    BankTransferService,
    RefundsService,
    WithdrawalsService,
    CollaboratorsService,
    GroupBuysService,
    WalletsService,
    CommunityService,
    MarketplaceCommissionsService,
    LoyaltyProgramService,
    LoyaltyLedgerService,
    LoyaltyAccountsService,
    LoyaltyPostingsService,
    LoyaltyJobsService,
    LoyaltyAdminService,
    AffiliateMerchantsService,
    MerchantPortalService,
    AffiliateTransactionsService,
    AffiliateVouchersService,
    AffiliateSettlementsService,
    ReturnRequestsService,
    SupplierPricesService,
    SalesOrdersService,
    InternalTradeService,
    ServiceDocumentsService,
    PromotionsService,
    DebtsService,
    FundsService,
    RetailStoresService,
    RetailShiftsService,
    RetailSalesService,
    RetailReturnsService,
    PaymentsService,
    LedgerService,
    JournalsService,
    LedgerReportsService,
    StatementsService,
    EinvoiceSettingsService,
    EinvoicesService,
    EinvoiceCorrectionsService,
    BankReconciliationService,
    CollectionStatementsService,
    ConsolidationService,
    AnalyticsScopeService,
    SalesReportService,
    InventoryReportService,
    DebtReportService,
    CommissionReportService,
    OverviewService,
    RequisitionsService,
    PurchaseOrdersService,
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
