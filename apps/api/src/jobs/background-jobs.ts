// Tác vụ nền bằng BullMQ trên Redis (tài liệu 13): kiểm tra duyệt quá hạn mỗi 15 phút, đẩy outbox mỗi 10 giây,
// tạo trước partition nhật ký thao tác mỗi ngày (tài liệu 16), lấy tỷ giá Vietcombank lúc 8:30 sáng giờ Việt Nam (CHUC_NANG_21),
// nhả hàng giữ hết hạn mỗi 5 phút (CHUC_NANG_43), thông báo hàng dưới tồn an toàn lúc 7 giờ sáng (CHUC_NANG_44),
// gửi hóa đơn điện tử mỗi 30 giây, báo hóa đơn quá hạn mỗi giờ (CHUC_NANG_77), tự hoàn tất đơn VComm mỗi giờ (CHUC_NANG_119).
// Chỉ chạy trong tiến trình API; kiểm thử gọi thẳng dịch vụ nên không cần Redis.
import { Logger, type INestApplication } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { vietnamDate } from "../common/clock";
import { OutboxService } from "../common/outbox.service";
import { EinvoicesService } from "../einvoice/einvoices.service";
import { OfficeTasksService } from "../office/office-tasks.service";
import { MarketplaceOrdersService } from "../marketplace/marketplace-orders.service";
import { MarketplacePaymentsService } from "../marketplace/payments/payments.service";
import { ReservationsService } from "../inventory/reservations.service";
import { StockLevelsService } from "../inventory/stock-levels.service";
import { AuditEventsService } from "../settings/audit-events.service";
import { ExchangeRatesService } from "../settings/exchange-rates.service";

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
  const officeTasks = application.get(OfficeTasksService);
  const queue = new Queue(queueName, { connection });
  await queue.upsertJobScheduler("approval-overdue", { every: 15 * 60_000 }, { name: "approval-overdue" });
  await queue.upsertJobScheduler("outbox-dispatch", { every: 10_000 }, { name: "outbox-dispatch" });
  await queue.upsertJobScheduler("audit-partitions", { every: 24 * 60 * 60_000 }, { name: "audit-partitions" });
  await queue.upsertJobScheduler("exchange-rate-fetch", { pattern: "30 8 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "exchange-rate-fetch" });
  await queue.upsertJobScheduler("inventory-reservation-expiry", { every: 5 * 60_000 }, { name: "inventory-reservation-expiry" });
  await queue.upsertJobScheduler("inventory-stock-alerts", { pattern: "0 7 * * *", tz: "Asia/Ho_Chi_Minh" }, { name: "inventory-stock-alerts" });
  // Tự hoàn tất đơn VComm hết hạn trả hàng (CONG_VIEC_24; QUYTAC_NGHIEPVU_162).
  await queue.upsertJobScheduler("marketplace-order-completion", { every: 60 * 60_000 }, { name: "marketplace-order-completion" });
  // Hủy đơn VComm quá hạn thanh toán, nhả hàng (CONG_VIEC_25; QUYTAC_NGHIEPVU_165).
  await queue.upsertJobScheduler("marketplace-payment-expiry", { every: 60_000 }, { name: "marketplace-payment-expiry" });
  // Nhắc công việc sắp đến hạn, quá hạn (CONG_VIEC_52; QUYTAC_NGHIEPVU_358).
  await queue.upsertJobScheduler("office-task-reminders", { every: 15 * 60_000 }, { name: "office-task-reminders" });
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
      if (job.name === "marketplace-order-completion") return marketplaceOrders.completeDue();
      if (job.name === "marketplace-payment-expiry") return payments.expireDue();
      if (job.name === "office-task-reminders") return officeTasks.remindDue();
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
