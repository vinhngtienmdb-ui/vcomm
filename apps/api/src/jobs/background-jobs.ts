// Tác vụ nền bằng BullMQ trên Redis (tài liệu 13): kiểm tra duyệt quá hạn mỗi 15 phút, đẩy outbox mỗi 10 giây,
// tạo trước partition nhật ký thao tác mỗi ngày (tài liệu 16), lấy tỷ giá Vietcombank lúc 8:30 sáng giờ Việt Nam (CHUC_NANG_21),
// nhả hàng giữ hết hạn mỗi 5 phút (CHUC_NANG_43), thông báo hàng dưới tồn an toàn lúc 7 giờ sáng (CHUC_NANG_44),
// gửi hóa đơn điện tử mỗi 30 giây, báo hóa đơn quá hạn mỗi giờ (CHUC_NANG_77), tự hoàn tất đơn VComm mỗi giờ (CHUC_NANG_119),
// hết hạn, nhắc hạn điểm thưởng và xét hạng lúc 0 giờ 10 phút (CHUC_NANG_179),
// áp dụng quyết định công tác lúc 0 giờ 5 phút (CHUC_NANG_162), nhắc hết hạn hợp đồng lúc 7 giờ (CHUC_NANG_164),
// tính lại công ngày hôm trước lúc 1 giờ (CHUC_NANG_165), cộng phép năm, hết hạn phép tồn lúc 0 giờ 15 phút (CHUC_NANG_166),
// tự xác nhận bảng công hết hạn lúc 0 giờ 30 phút (CHUC_NANG_167), chốt nhóm mua chung mỗi phút (CHUC_NANG_172),
// hết hạn, nhắc hạn voucher cửa hàng liên kết lúc 0 giờ 20 phút (CHUC_NANG_195), lập bảng đối soát cửa hàng liên kết 1 giờ thứ Hai (CHUC_NANG_196),
// nhắc hẹn chăm sóc khách lúc 7 giờ (CHUC_NANG_205), lập bảng đối soát người bán dropship 2 giờ thứ Hai (CHUC_NANG_225),
// hỏi lại đối tác liên minh giao dịch đổi điểm chờ kết quả mỗi 5 phút (CHUC_NANG_237),
// hết hạn đơn chờ thanh toán tại cửa hàng mỗi phút (CHUC_NANG_248),
// xóa hội thoại trợ lý AI quá 90 ngày, nhật ký lượt quá 24 tháng lúc 1 giờ 30 phút (CHUC_NANG_229).
// Chỉ chạy trong tiến trình API; kiểm thử gọi thẳng dịch vụ nên không cần Redis.
import { Logger, type INestApplication } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { vietnamDate } from "../common/clock";
import { OutboxService } from "../common/outbox.service";
import { EinvoicesService } from "../einvoice/einvoices.service";
import { LoyaltyJobsService } from "../loyalty/jobs.service";
import { LoyaltySettlementsService } from "../loyalty/settlements.service";
import { LoyaltyFraudService } from "../loyalty/fraud.service";
import { PartnerExchangesService } from "../loyalty/partners/exchanges.service";
import { PartnerSettlementsService } from "../loyalty/partners/settlements.service";
import { AffiliateReportsService } from "../affiliate/reports.service";
import { AffiliateSettlementsService } from "../affiliate/settlements.service";
import { ResellerSettlementsService } from "../finance/reseller-settlements.service";
import { AffiliateVouchersService } from "../affiliate/vouchers.service";
import { GroupBuysService } from "../marketplace/group-buys.service";
import { OfficeTasksService } from "../office/office-tasks.service";
import { OfficePostsService } from "../office/office-posts.service";
import { OfficeSigningService } from "../office/signing/office-signing.service";
import { OfficeContractsService } from "../office/contracts/office-contracts.service";
import { MarketplaceOrdersService } from "../marketplace/marketplace-orders.service";
import { RetailStationOrdersService } from "../retail/retail-station-orders.service";
import { SalesCareService } from "../marketplace/sales-care.service";
import { MarketplacePaymentsService } from "../marketplace/payments/payments.service";
import { InstoreCheckoutsService } from "../instore/checkouts.service";
import { InstorePayoutsService } from "../instore/payouts.service";
import { InstoreEinvoicesService } from "../instore/mandated-einvoices.service";
import { AffiliateWebhooksService } from "../affiliate/webhooks.service";
import { ReservationsService } from "../inventory/reservations.service";
import { StockLevelsService } from "../inventory/stock-levels.service";
import { AuditEventsService } from "../settings/audit-events.service";
import { ExchangeRatesService } from "../settings/exchange-rates.service";
import { ContractRemindersService } from "../hr/contract-reminders.service";
import { WorkEventsService } from "../hr/work-events.service";
import { AttendanceDaysService } from "../hr/attendance-days.service";
import { LeaveService } from "../hr/leave.service";
import { TimesheetsService } from "../hr/timesheets.service";
import { RecruitmentService } from "../hr/recruitment.service";
import { JobOffersService } from "../hr/job-offers.service";
import { ApiCallLogsService } from "../open-api/api-call-logs.service";
import { CandidatesService } from "../hr/candidates.service";
import { ReviewsService } from "../hr/reviews.service";
import { SmartOtpRemindersService } from "../auth/smart-otp-reminders.service";
import { AiChatService } from "../ai/ai-chat.service";

const queueName = "nen-tang";
const einvoiceQueueName = "hoa-don-dien-tu";

export async function startBackgroundJobs(application: INestApplication): Promise<() => Promise<void>> {
  const logger = new Logger("BackgroundJobs");
  const url = process.env.REDIS_URL;
  if (!url || process.env.BACKGROUND_JOBS === "disabled") {
    logger.warn("Không chạy tác vụ nền: thiếu REDIS_URL hoặc BACKGROUND_JOBS=disabled.");
    return async () => undefined;
  }
  const { hostname, port, password } = new URL(url);
  const connection = { host: hostname, port: Number(port || 6379), ...(password ? { password } : {}), maxRetriesPerRequest: null };
  const approvals = application.get(ApprovalRequestsService);
  const outbox = application.get(OutboxService);
  const auditEvents = application.get(AuditEventsService);
  const exchangeRates = application.get(ExchangeRatesService);
  const reservations = application.get(ReservationsService);
  const stockLevels = application.get(StockLevelsService);
  const einvoices = application.get(EinvoicesService);
  const marketplaceOrders = application.get(MarketplaceOrdersService);
  const stationOrders = application.get(RetailStationOrdersService);
  const salesCare = application.get(SalesCareService);
  const payments = application.get(MarketplacePaymentsService);
  const instoreCheckouts = application.get(InstoreCheckoutsService);
  const instorePayouts = application.get(InstorePayoutsService);
  const instoreEinvoices = application.get(InstoreEinvoicesService);
  const affiliateWebhooks = application.get(AffiliateWebhooksService);
  const loyalty = application.get(LoyaltyJobsService);
  const loyaltySettlements = application.get(LoyaltySettlementsService);
  const loyaltyFraud = application.get(LoyaltyFraudService);
  const groupBuys = application.get(GroupBuysService);
  const affiliateVouchers = application.get(AffiliateVouchersService);
  const affiliateSettlements = application.get(AffiliateSettlementsService);
  const resellerSettlements = application.get(ResellerSettlementsService);
  const affiliateReports = application.get(AffiliateReportsService);
  const workEvents = application.get(WorkEventsService);
  const contractReminders = application.get(ContractRemindersService);
  const attendanceDays = application.get(AttendanceDaysService);
  const leave = application.get(LeaveService);
  const timesheets = application.get(TimesheetsService);
  const recruitment = application.get(RecruitmentService);
  const jobOffers = application.get(JobOffersService);
  const candidates = application.get(CandidatesService);
  const aiChat = application.get(AiChatService);
  const reviews = application.get(ReviewsService);
  const apiCallLogs = application.get(ApiCallLogsService);
  const partnerExchanges = application.get(PartnerExchangesService);
  const partnerSettlements = application.get(PartnerSettlementsService);
  const officeTasks = application.get(OfficeTasksService);
  const officePosts = application.get(OfficePostsService);
  const officeSigning = application.get(OfficeSigningService);
  const officeContracts = application.get(OfficeContractsService);
  const smartOtpReminders = application.get(SmartOtpRemindersService);
  const queue = new Queue(queueName, { connection });
  await queue.upsertJobScheduler("approval-overdue", { every: 15 * 60_000 }, { name: "approval-overdue" });
  await queue.upsertJobScheduler("outbox-dispatch", { every: 10_000 }, { name: "outbox-dispatch" });
  await queue.upsertJobScheduler("audit-partitions", { every: 24 * 60 * 60_000 }, { name: "audit-partitions" });
  await queue.upsertJobScheduler("exchange-rate-fetch", { pattern: "30 8 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "exchange-rate-fetch" });
  await queue.upsertJobScheduler("inventory-reservation-expiry", { every: 5 * 60_000 }, { name: "inventory-reservation-expiry" });
  await queue.upsertJobScheduler("inventory-stock-alerts", { pattern: "0 7 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "inventory-stock-alerts" });
  await queue.upsertJobScheduler("hr-work-events", { pattern: "5 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-work-events" });
  await queue.upsertJobScheduler("hr-contract-reminders", { pattern: "0 7 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-contract-reminders" });
  // CONG_VIEC_72 (QUYTAC_NGHIEPVU_571): nhắc kích hoạt Smart OTP 9 giờ hằng ngày; hết thời hạn thì Smart OTP trên bản web hết hiệu lực.
  await queue.upsertJobScheduler("smart-otp-reminders", { pattern: "0 9 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "smart-otp-reminders" });
  await queue.upsertJobScheduler("marketplace-sales-follow-ups", { pattern: "0 7 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "marketplace-sales-follow-ups" });
  await queue.upsertJobScheduler("hr-timesheet-confirmation", { pattern: "30 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-timesheet-confirmation" });
  await queue.upsertJobScheduler("hr-leave-accrual", { pattern: "15 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-leave-accrual" });
  await queue.upsertJobScheduler("hr-attendance-recalculate", { pattern: "0 1 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-attendance-recalculate" });
  // Tuyển dụng (CONG_VIEC_54): đóng tin quá hạn nộp, đề nghị hết hạn lúc 0 giờ 10 phút; xóa ứng viên đến hạn lúc 1 giờ.
  await queue.upsertJobScheduler("hr-recruitment-daily", { pattern: "10 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-recruitment-daily" });
  await queue.upsertJobScheduler("hr-candidate-erasure", { pattern: "0 1 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-candidate-erasure" });
  // Trợ lý AI (CONG_VIEC_63; QUYTAC_NGHIEPVU_520).
  await queue.upsertJobScheduler("ai-conversation-retention", { pattern: "30 1 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "ai-conversation-retention" });
  // Đánh giá hiệu suất (CONG_VIEC_54): nhắc quá hạn lúc 8 giờ.
  await queue.upsertJobScheduler("hr-review-reminders", { pattern: "0 8 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-review-reminders" });
  // Tự hoàn tất đơn VComm hết hạn trả hàng (CONG_VIEC_24; QUYTAC_NGHIEPVU_162).
  await queue.upsertJobScheduler("marketplace-order-completion", { every: 60 * 60_000 }, { name: "marketplace-order-completion" });
  // Hủy đơn VComm quá hạn thanh toán, nhả hàng (CONG_VIEC_25; QUYTAC_NGHIEPVU_165).
  await queue.upsertJobScheduler("marketplace-payment-expiry", { every: 60_000 }, { name: "marketplace-payment-expiry" });
  await queue.upsertJobScheduler("instore-checkout-expiry", { every: 60_000 }, { name: "instore-checkout-expiry" });
  // CONG_VIEC_73 lát L5: bảng chuyển tiền thu hộ ngày (1 giờ sáng, cho ngày hôm trước); nhắc bảng chờ chuyển quá hạn mỗi sáng ngày làm việc.
  await queue.upsertJobScheduler("instore-payouts-daily", { pattern: "0 1 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "instore-payouts-daily" });
  await queue.upsertJobScheduler("instore-payouts-overdue", { pattern: "5 8 * * 1-5", tz: "Asia/Ho_Chi_Minh" }, { name: "instore-payouts-overdue" });
  // Lát L7: gửi webhook cho phần mềm cửa hàng liên kết mỗi phút (thử lại theo lịch của nhật ký gửi).
  await queue.upsertJobScheduler("affiliate-webhooks", { every: 60_000 }, { name: "affiliate-webhooks" });
  // Lát L6: hóa đơn phí sàn tháng trước lúc 2 giờ sáng ngày 1, sau bảng chuyển tiền của ngày cuối tháng.
  await queue.upsertJobScheduler("instore-fee-invoices-monthly", { pattern: "0 2 1 * *", tz: "Asia/Ho_Chi_Minh" }, { name: "instore-fee-invoices-monthly" });
  // Hết hạn, nhắc hạn điểm thưởng, chuyển năm chi tiêu và xét hạng (CONG_VIEC_51; QUYTAC_NGHIEPVU_350, 351).
  await queue.upsertJobScheduler("loyalty-daily", { pattern: "10 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "loyalty-daily" });
  // Lập bảng đối soát điểm nội bộ tháng trước lúc 2 giờ ngày 1; nhắc bảng chờ xác nhận quá 5 ngày hằng ngày (CONG_VIEC_60; QUYTAC_NGHIEPVU_470, 471).
  await queue.upsertJobScheduler("loyalty-settlement-monthly", { pattern: "0 2 1 * *", tz: "Asia/Ho_Chi_Minh" }, { name: "loyalty-settlement-monthly" });
  await queue.upsertJobScheduler("loyalty-settlement-reminders", { pattern: "0 8 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "loyalty-settlement-reminders" });
  // Voucher hết hạn, nhắc hạn; báo dư nợ từ 80 % hạn mức cho chủ cửa hàng (CONG_VIEC_55; QUYTAC_NGHIEPVU_402, 405).
  await queue.upsertJobScheduler("affiliate-voucher-daily", { pattern: "20 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "affiliate-voucher-daily" });
  // Đối soát cửa hàng liên kết (CONG_VIEC_55; QUYTAC_NGHIEPVU_403): lập bảng tuần trước 1 giờ sáng thứ Hai; tự xác nhận bảng quá hạn mỗi giờ.
  await queue.upsertJobScheduler("affiliate-settlement-weekly", { pattern: "0 1 * * 1", tz: "Asia/Ho_Chi_Minh" }, { name: "affiliate-settlement-weekly" });
  await queue.upsertJobScheduler("reseller-settlement-weekly", { pattern: "0 2 * * 1", tz: "Asia/Ho_Chi_Minh" }, { name: "reseller-settlement-weekly" });
  await queue.upsertJobScheduler("affiliate-settlement-confirm", { every: 60 * 60_000 }, { name: "affiliate-settlement-confirm" });
  // Xóa nhật ký gọi API đối tác quá 90 ngày lúc 2 giờ (CONG_VIEC_61; QUYTAC_NGHIEPVU_488).
  await queue.upsertJobScheduler("loyalty-partner-exchanges", { every: 5 * 60_000 }, { name: "loyalty-partner-exchanges" });
  // CONG_VIEC_65: bảng đối soát tháng với đối tác liên minh lúc 3 giờ ngày 1 (QUYTAC_NGHIEPVU_548).
  await queue.upsertJobScheduler("loyalty-partner-settlements", { pattern: "0 3 1 * *", tz: "Asia/Ho_Chi_Minh" }, { name: "loyalty-partner-settlements" });
  await queue.upsertJobScheduler("open-api-log-purge", { pattern: "0 2 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "open-api-log-purge" });
  // Chốt nhóm mua chung hết hạn (CONG_VIEC_49; QUYTAC_NGHIEPVU_331).
  await queue.upsertJobScheduler("marketplace-group-buy-close", { every: 60_000 }, { name: "marketplace-group-buy-close" });
  // Nhắc, hủy đơn quá hạn giữ tại trạm giao hàng O2O (CONG_VIEC_57; QUYTAC_NGHIEPVU_428).
  await queue.upsertJobScheduler("station-order-hold", { every: 60 * 60_000 }, { name: "station-order-hold" });
  // Nhắc công việc sắp đến hạn, quá hạn (CONG_VIEC_52; QUYTAC_NGHIEPVU_358).
  await queue.upsertJobScheduler("office-task-reminders", { every: 15 * 60_000 }, { name: "office-task-reminders" });
  // Tin bảng tin hẹn giờ cần xác nhận đọc: đến giờ thì thông báo (CONG_VIEC_52; QUYTAC_NGHIEPVU_367).
  await queue.upsertJobScheduler("office-post-publish", { every: 60_000 }, { name: "office-post-publish" });
  // CONG_VIEC_59: lấy kết quả lần ký đang chờ mỗi 5 giây; phiên quá hạn ký, nhắc trước hạn mỗi giờ.
  await queue.upsertJobScheduler("office-signing-poll", { every: 5_000 }, { name: "office-signing-poll" });
  await queue.upsertJobScheduler("office-signing-expiry", { every: 60 * 60_000 }, { name: "office-signing-expiry" });
  // CONG_VIEC_59: nhắc hạn hợp đồng lúc 7 giờ (QUYTAC_NGHIEPVU_467).
  await queue.upsertJobScheduler("office-contract-reminders", { pattern: "0 7 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "office-contract-reminders" });
  // Hóa đơn điện tử chạy hàng đợi riêng: gọi nhà cung cấp chậm không làm chậm các tác vụ khác.
  const einvoiceQueue = new Queue(einvoiceQueueName, { connection });
  await einvoiceQueue.upsertJobScheduler("einvoice-send", { every: 30_000 }, { name: "einvoice-send" });
  await einvoiceQueue.upsertJobScheduler("einvoice-overdue", { every: 60 * 60_000 }, { name: "einvoice-overdue" });
  const einvoiceWorker = new Worker(
    einvoiceQueueName,
    async (job) => {
      if (job.name === "einvoice-send") return einvoices.sendDue();
      if (job.name === "einvoice-overdue") return einvoices.notifyOverdue();
      return null;
    },
    { connection, concurrency: 1 },
  );
  einvoiceWorker.on("failed", (job, error) => logger.error(`${job?.name}: ${error.message}`));
  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name === "approval-overdue") return approvals.processOverdue();
      if (job.name === "outbox-dispatch") return outbox.dispatchPending();
      if (job.name === "audit-partitions") return auditEvents.ensurePartitions(vietnamDate(new Date()));
      if (job.name === "exchange-rate-fetch") return exchangeRates.fetchDaily(vietnamDate(new Date()));
      if (job.name === "inventory-reservation-expiry") return reservations.releaseExpired();
      if (job.name === "inventory-stock-alerts") return stockLevels.notifyAlerts();
      if (job.name === "hr-work-events") return workEvents.applyDue();
      if (job.name === "hr-contract-reminders") return contractReminders.sendDue();
      if (job.name === "smart-otp-reminders") return smartOtpReminders.runDaily();
      if (job.name === "hr-attendance-recalculate") return attendanceDays.recalculateRecent();
      if (job.name === "hr-leave-accrual") return leave.accrueDue();
      if (job.name === "hr-timesheet-confirmation") return timesheets.autoConfirm();
      if (job.name === "hr-recruitment-daily") return { ...(await recruitment.runDaily()), expiredOffers: await jobOffers.expireDue() };
      if (job.name === "hr-candidate-erasure") return candidates.eraseDue();
      if (job.name === "ai-conversation-retention") return aiChat.purgeExpired();
      if (job.name === "hr-review-reminders") return reviews.sendReminders();
      if (job.name === "marketplace-order-completion") return marketplaceOrders.completeDue();
      if (job.name === "station-order-hold") return stationOrders.expireDue();
      if (job.name === "marketplace-sales-follow-ups") return salesCare.remindDue();
      if (job.name === "marketplace-payment-expiry") return payments.expireDue();
      if (job.name === "instore-checkout-expiry") return instoreCheckouts.expireDue();
      if (job.name === "instore-payouts-daily") return instorePayouts.generateDaily();
      if (job.name === "instore-payouts-overdue") return instorePayouts.remindOverdue();
      if (job.name === "instore-fee-invoices-monthly") return instoreEinvoices.generateMonthlyFeeInvoices();
      if (job.name === "affiliate-webhooks") return affiliateWebhooks.deliverDue();
      // CONG_VIEC_60 (QUYTAC_NGHIEPVU_474): xóa dữ liệu thiết bị quá 12 tháng cùng lượt.
      if (job.name === "loyalty-daily") return { ...(await loyalty.runDaily()), purgedDevices: await loyaltyFraud.purgeDevices() };
      if (job.name === "loyalty-settlement-monthly") return loyaltySettlements.buildMonthly();
      if (job.name === "loyalty-settlement-reminders") return loyaltySettlements.remindPending();
      if (job.name === "affiliate-voucher-daily") return { vouchers: await affiliateVouchers.expireAndRemind(), creditUsage: await affiliateReports.notifyCreditUsage() };
      if (job.name === "affiliate-settlement-weekly") return affiliateSettlements.generateWeekly();
      if (job.name === "reseller-settlement-weekly") return resellerSettlements.generateWeekly();
      if (job.name === "affiliate-settlement-confirm") return affiliateSettlements.autoConfirmDue();
      if (job.name === "marketplace-group-buy-close") return groupBuys.closeDue();
      if (job.name === "loyalty-partner-exchanges") return partnerExchanges.processDue();
      if (job.name === "loyalty-partner-settlements") return partnerSettlements.generateMonthly();
      if (job.name === "open-api-log-purge") return apiCallLogs.purgeExpired(new Date());
      if (job.name === "office-task-reminders") return officeTasks.remindDue();
      if (job.name === "office-post-publish") return officePosts.publishDue();
      if (job.name === "office-signing-poll") return officeSigning.pollAttempts();
      if (job.name === "office-signing-expiry") return officeSigning.expireAndRemind();
      if (job.name === "office-contract-reminders") return officeContracts.remindExpiring();
      return null;
    },
    { connection, concurrency: 1 },
  );
  worker.on("failed", (job, error) => logger.error(`${job?.name}: ${error.message}`));
  return async () => {
    await worker.close();
    await einvoiceWorker.close();
    await queue.close();
    await einvoiceQueue.close();
  };
}
