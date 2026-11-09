// Gửi Zalo ZNS cho thông báo duyệt (CHUC_NANG_26; QUYTAC_NGHIEPVU_32): có chứng từ chờ duyệt, nhắc quá hạn, kết quả duyệt cho người lập.
// Chạy khi đẩy outbox, sau khi giao dịch duyệt đã ghi xong; gửi lỗi chỉ ghi nhật ký gửi tin, không gửi lại để tránh trùng.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { MessagingService, type ZnsEvent } from "./messaging.service";

const eventOfKind: Record<string, ZnsEvent> = {
  "approval.assigned": "approval_assigned",
  "approval.reminder": "approval_reminder",
  "approval.completed": "approval_completed",
};

// Số tiền theo kiểu Việt Nam: 80.000.000 VND.
const formatAmount = (amount: string, currency: string) => `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(Number(amount))} ${currency}`;

@Injectable()
export class ZnsNotifier implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly outbox: OutboxService,
    private readonly messaging: MessagingService,
  ) {}

  onModuleInit(): void {
    this.outbox.subscribe("core.notification.created", async (event) => {
      const kind = String(event.payload.kind ?? "");
      if (eventOfKind[kind]) await this.send(String(event.payload.notificationId), eventOfKind[kind]);
    });
  }

  private async send(notificationId: string, event: ZnsEvent): Promise<void> {
    const row = (
      await this.database.execute<{ user_id: string; document_no: string; document_type: string; amount: string; currency: string; requester: string; status: string }>(sql`
      SELECT n.user_id, q.document_no, t.name_vi AS document_type, q.amount::text AS amount, q.currency, u.full_name AS requester, q.status
      FROM core.notifications n
      JOIN core.approval_requests q ON n.link = '/hop-duyet/' || q.id::text
      JOIN core.document_types t ON t.code = q.document_type_code
      JOIN core.users u ON u.id = q.requested_by
      WHERE n.id = ${notificationId}`)
    ).rows[0];
    if (!row) return;
    const result = row.status === "approved" ? "Đã duyệt" : row.status === "rejected" ? "Bị từ chối" : "Chờ duyệt";
    await this.messaging.sendZns(row.user_id, event, {
      document_no: row.document_no,
      document_type: row.document_type,
      amount: formatAmount(row.amount, row.currency),
      requester: row.requester,
      result,
    });
  }
}
