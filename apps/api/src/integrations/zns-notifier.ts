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
  "station_order.ready": "station_order_ready",
  "station_order.reminder": "station_hold_reminder",
  "station_order.shipping": "station_order_shipping",
  "station_order.cancelled": "station_order_cancelled",
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
    if (event.startsWith("station_")) return this.sendStation(notificationId, event);
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

  // Tin đơn trạm giao hàng (CONG_VIEC_57; QUYTAC_NGHIEPVU_429): số đơn, trạm, địa chỉ, giờ mở cửa, hạn giữ, lý do hủy; không gửi mã nhận hàng (QUYTAC_NGHIEPVU_425).
  private async sendStation(notificationId: string, event: ZnsEvent): Promise<void> {
    const row = (
      await this.database.execute<{ user_id: string; document_no: string; station_name: string; station_address: string; opening_hours: string; hold_until: string | null; reason: string | null }>(sql`
      SELECT n.user_id, so.document_no, s.display_name AS station_name, s.street_address || ', ' || w.name || ', ' || p.name AS station_address, s.opening_hours,
        to_char(st.hold_until AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM/YYYY') AS hold_until, m.cancel_reason AS reason
      FROM core.notifications n
      JOIN marketplace.orders m ON m.id = (n.payload ->> 'orderId')::uuid
      JOIN sales.orders so ON so.id = m.sales_order_id
      JOIN retail.stores s ON s.id = m.station_id
      JOIN marketplace.wards w ON w.code = s.ward_code JOIN marketplace.provinces p ON p.code = s.province_code
      LEFT JOIN retail.station_orders st ON st.order_id = m.id
      WHERE n.id = ${notificationId}`)
    ).rows[0];
    if (!row) return;
    await this.messaging.sendZns(row.user_id, event, {
      order_no: row.document_no,
      station_name: row.station_name,
      station_address: row.station_address,
      opening_hours: row.opening_hours,
      hold_until: row.hold_until ?? "",
      reason: row.reason ?? "",
    });
  }
}
