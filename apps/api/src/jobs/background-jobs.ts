// Tác vụ nền bằng BullMQ trên Redis (tài liệu 13): kiểm tra duyệt quá hạn mỗi 15 phút, đẩy outbox mỗi 10 giây,
// tạo trước partition nhật ký thao tác mỗi ngày (tài liệu 16), lấy tỷ giá Vietcombank lúc 8:30 sáng giờ Việt Nam (CHUC_NANG_21),
// nhả hàng giữ hết hạn mỗi 5 phút (CHUC_NANG_43), thông báo hàng dưới tồn an toàn lúc 7 giờ sáng (CHUC_NANG_44),
// gửi hóa đơn điện tử mỗi 30 giây, báo hóa đơn quá hạn mỗi giờ (CHUC_NANG_77), tự hoàn tất đơn VComm mỗi giờ (CHUC_NANG_119),
// hết hạn, nhắc hạn điểm thưởng và xét hạng lúc 0 giờ 10 phút (CHUC_NANG_179),
// áp dụng quyết định công tác lúc 0 giờ 5 phút (CHUC_NANG_162), nhắc hết hạn hợp đồng lúc 7 giờ (CHUC_NANG_164),
// tính lại công ngày hôm trước lúc 1 giờ (CHUC_NANG_165), cộng phép năm, hết hạn phép tồn lúc 0 giờ 15 phút (CHUC_NANG_166),
// tự xác nhận bảng công hết hạn lúc 0 giờ 30 phút (CHUC_NANG_167), chốt nhóm mua chung mỗi phút (CHUC_NANG_172),
// hết hạn, nhắc hạn voucher cửa hàng liên kết lúc 0 giờ 20 phút (CHUC_NANG_195).
// Chỉ chạy trong tiến trình API; kiểm thử gọi thẳng dịch vụ nên không cần Redis.
import { Logger, type INestApplication } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { vietnamDate } from "../common/clock";
import { OutboxService } from "../common/outbox.service";
import { EinvoicesService } from "../einvoice/einvoices.service";
import { LoyaltyJobsService } from "../loyalty/jobs.service";
import { AffiliateSettlementsService } from "../affiliate/settlements.service";
import { AffiliateVouchersService } from "../affiliate/vouchers.service";
import { GroupBuysService } from "../marketplace/group-buys.service";
import { MarketplaceOrdersService } from "../marketplace/marketplace-orders.service";
import { MarketplacePaymentsService } from "../marketplace/payments/payments.service";
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
import { CandidatesService } from "../hr/candidates.service";
import { ReviewsService } from "../hr/reviews.service";

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
  const payments = application.get(MarketplacePaymentsService);
  const loyalty = application.get(LoyaltyJobsService);
  const groupBuys = application.get(GroupBuysService);
  const affiliateVouchers = application.get(AffiliateVouchersService);
  const affiliateSettlements = application.get(AffiliateSettlementsService);
  const workEvents = application.get(WorkEventsService);
  const contractReminders = application.get(ContractRemindersService);
  const attendanceDays = application.get(AttendanceDaysService);
  const leave = application.get(LeaveService);
  const timesheets = application.get(TimesheetsService);
  const recruitment = application.get(RecruitmentService);
  const jobOffers = application.get(JobOffersService);
  const candidates = application.get(CandidatesService);
  const reviews = application.get(ReviewsService);
  const queue = new Queue(queueName, { connection });
  await queue.upsertJobScheduler("approval-overdue", { every: 15 * 60_000 }, { name: "approval-overdue" });
  await queue.upsertJobScheduler("outbox-dispatch", { every: 10_000 }, { name: "outbox-dispatch" });
  await queue.upsertJobScheduler("audit-partitions", { every: 24 * 60 * 60_000 }, { name: "audit-partitions" });
  await queue.upsertJobScheduler("exchange-rate-fetch", { pattern: "30 8 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "exchange-rate-fetch" });
  await queue.upsertJobScheduler("inventory-reservation-expiry", { every: 5 * 60_000 }, { name: "inventory-reservation-expiry" });
  await queue.upsertJobScheduler("inventory-stock-alerts", { pattern: "0 7 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "inventory-stock-alerts" });
  await queue.upsertJobScheduler("hr-work-events", { pattern: "5 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-work-events" });
  await queue.upsertJobScheduler("hr-contract-reminders", { pattern: "0 7 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-contract-reminders" });
  await queue.upsertJobScheduler("hr-timesheet-confirmation", { pattern: "30 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-timesheet-confirmation" });
  await queue.upsertJobScheduler("hr-leave-accrual", { pattern: "15 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-leave-accrual" });
  await queue.upsertJobScheduler("hr-attendance-recalculate", { pattern: "0 1 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-attendance-recalculate" });
  // Tuyển dụng (CONG_VIEC_54): đóng tin quá hạn nộp, đề nghị hết hạn lúc 0 giờ 10 phút; xóa ứng viên đến hạn lúc 1 giờ.
  await queue.upsertJobScheduler("hr-recruitment-daily", { pattern: "10 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-recruitment-daily" });
  await queue.upsertJobScheduler("hr-candidate-erasure", { pattern: "0 1 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-candidate-erasure" });
  // Đánh giá hiệu suất (CONG_VIEC_54): nhắc quá hạn lúc 8 giờ.
  await queue.upsertJobScheduler("hr-review-reminders", { pattern: "0 8 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "hr-review-reminders" });
  // Tự hoàn tất đơn VComm hết hạn trả hàng (CONG_VIEC_24; QUYTAC_NGHIEPVU_162).
  await queue.upsertJobScheduler("marketplace-order-completion", { every: 60 * 60_000 }, { name: "marketplace-order-completion" });
  // Hủy đơn VComm quá hạn thanh toán, nhả hàng (CONG_VIEC_25; QUYTAC_NGHIEPVU_165).
  await queue.upsertJobScheduler("marketplace-payment-expiry", { every: 60_000 }, { name: "marketplace-payment-expiry" });
  // Hết hạn, nhắc hạn điểm thưởng, chuyển năm chi tiêu và xét hạng (CONG_VIEC_51; QUYTAC_NGHIEPVU_350, 351).
  await queue.upsertJobScheduler("loyalty-daily", { pattern: "10 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "loyalty-daily" });
  await queue.upsertJobScheduler("affiliate-voucher-daily", { pattern: "20 0 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "affiliate-voucher-daily" });
  // Đối soát cửa hàng liên kết (CONG_VIEC_55; QUYTAC_NGHIEPVU_403): lập bảng tuần trước 1 giờ sáng thứ Hai; tự xác nhận bảng quá hạn mỗi giờ.
  await queue.upsertJobScheduler("affiliate-settlement-weekly", { pattern: "0 1 * * 1", tz: "Asia/Ho_Chi_Minh" }, { name: "affiliate-settlement-weekly" });
  await queue.upsertJobScheduler("affiliate-settlement-confirm", { every: 60 * 60_000 }, { name: "affiliate-settlement-confirm" });
  // Chốt nhóm mua chung hết hạn (CONG_VIEC_49; QUYTAC_NGHIEPVU_331).
  await queue.upsertJobScheduler("marketplace-group-buy-close", { every: 60_000 }, { name: "marketplace-group-buy-close" });
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
      if (job.name === "hr-attendance-recalculate") return attendanceDays.recalculateRecent();
      if (job.name === "hr-leave-accrual") return leave.accrueDue();
      if (job.name === "hr-timesheet-confirmation") return timesheets.autoConfirm();
      if (job.name === "hr-recruitment-daily") return { ...(await recruitment.runDaily()), expiredOffers: await jobOffers.expireDue() };
      if (job.name === "hr-candidate-erasure") return candidates.eraseDue();
      if (job.name === "hr-review-reminders") return reviews.sendReminders();
      if (job.name === "marketplace-order-completion") return marketplaceOrders.completeDue();
      if (job.name === "marketplace-payment-expiry") return payments.expireDue();
      if (job.name === "loyalty-daily") return loyalty.runDaily();
      if (job.name === "affiliate-voucher-daily") return affiliateVouchers.expireAndRemind();
      if (job.name === "affiliate-settlement-weekly") return affiliateSettlements.generateWeekly();
      if (job.name === "affiliate-settlement-confirm") return affiliateSettlements.autoConfirmDue();
      if (job.name === "marketplace-group-buy-close") return groupBuys.closeDue();
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
