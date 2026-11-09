// Tác vụ nền bằng BullMQ trên Redis (tài liệu 13): kiểm tra duyệt quá hạn mỗi 15 phút, đẩy outbox mỗi 10 giây.
// Chỉ chạy trong tiến trình API; kiểm thử gọi thẳng dịch vụ nên không cần Redis.
import { Logger, type INestApplication } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { OutboxService } from "../common/outbox.service";

const queueName = "nen-tang";

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
  const queue = new Queue(queueName, { connection });
  await queue.upsertJobScheduler("approval-overdue", { every: 15 * 60_000 }, { name: "approval-overdue" });
  await queue.upsertJobScheduler("outbox-dispatch", { every: 10_000 }, { name: "outbox-dispatch" });
  const worker = new Worker(
    queueName,
    async (job) => {
      if (job.name === "approval-overdue") return approvals.processOverdue();
      if (job.name === "outbox-dispatch") return outbox.dispatchPending();
      return null;
    },
    { connection, concurrency: 1 },
  );
  worker.on("failed", (job, error) => logger.error(`${job?.name}: ${error.message}`));
  return async () => {
    await worker.close();
    await queue.close();
  };
}
