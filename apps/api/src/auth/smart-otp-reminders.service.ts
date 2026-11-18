// Nhắc kích hoạt Smart OTP và kết thúc thời hạn chuyển đổi (CONG_VIEC_72; QUYTAC_NGHIEPVU_562, 571). Việc nền chạy 9 giờ hằng ngày, giờ Việt Nam.
// Đối tượng: người mua đang hoạt động chưa kích hoạt Smart OTP, hoặc đang dùng Smart OTP trên bản web.
// Thông báo trong ứng dụng: chỉ gửi mốc gần nhất đã tới (ngày bắt đầu; 14, 7, 1 ngày trước hạn), mỗi mốc một lần.
// Tin ZNS: một tin từ 7 ngày trước hạn, chỉ khi đã cài mẫu; chưa cài thì không đánh dấu, cài trong thời hạn vẫn gửi được.
// Hết hạn: Smart OTP trên bản web hết hiệu lực, ghi nhật ký.
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { MessagingService } from "../integrations/messaging.service";
import { addDays, AuthenticationSettingsService, transitionEndsOn, vietnamDate } from "./authentication-settings.service";

type ReminderKind = "start" | "day_14" | "day_7" | "day_1";
const dayOf = (date: string) => date.split("-").reverse().join("/");

@Injectable()
export class SmartOtpRemindersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: AuthenticationSettingsService,
    private readonly messaging: MessagingService,
    private readonly audit: AuditService,
  ) {}

  async runDaily(): Promise<{ notified: number; zns: number; webExpired: number }> {
    const settings = await this.settings.current();
    const today = vietnamDate(this.clock.now());
    const end = transitionEndsOn(settings.transitionStartsOn, settings.buyerTransitionDays);
    if (today < settings.transitionStartsOn) return { notified: 0, zns: 0, webExpired: 0 };
    if (today > end) return { notified: 0, zns: 0, webExpired: await this.expireWeb() };

    // Mốc gần nhất đã tới; mốc trước ngày bắt đầu (thời hạn ngắn) thì bỏ qua.
    const milestones: { kind: ReminderKind; on: string }[] = [
      { kind: "start", on: settings.transitionStartsOn },
      { kind: "day_14", on: addDays(end, -14) },
      { kind: "day_7", on: addDays(end, -7) },
      { kind: "day_1", on: addDays(end, -1) },
    ];
    const due = milestones.filter((item) => item.on >= settings.transitionStartsOn && item.on <= today).at(-1);
    let notified = 0;
    if (due) {
      const marked = await this.database.execute<{ user_id: string }>(sql`
        INSERT INTO core.smart_otp_reminders (user_id, kind)
        SELECT b.user_id, ${due.kind} FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id AND u.status = 'active'
        LEFT JOIN core.smart_otp_devices d ON d.user_id = b.user_id
        WHERE d.user_id IS NULL OR d.platform = 'web'
        ON CONFLICT (user_id, kind) DO NOTHING RETURNING user_id`);
      const days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1;
      for (let index = 0; index < marked.rows.length; index += 500) {
        await notify(
          this.database,
          marked.rows.slice(index, index + 500).map((row) => ({
            userId: row.user_id,
            companyId: null,
            kind: "auth.smart_otp_reminder",
            title: `Kích hoạt Smart OTP trước hết ngày ${dayOf(end)} (còn ${days} ngày): sau ngày này, dùng điểm và đăng nhập trên máy mới cần Smart OTP thay tin nhắn SMS.`,
            link: "/diem-thuong",
            payload: { transitionEndsOn: end },
          })),
        );
      }
      notified = marked.rows.length;
    }

    let zns = 0;
    if (today >= addDays(end, -7) && (await this.messaging.znsConfigured("smart_otp_reminder"))) {
      const marked = await this.database.execute<{ user_id: string }>(sql`
        INSERT INTO core.smart_otp_reminders (user_id, kind)
        SELECT b.user_id, 'zns_7' FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id AND u.status = 'active' AND u.phone IS NOT NULL
        LEFT JOIN core.smart_otp_devices d ON d.user_id = b.user_id
        WHERE d.user_id IS NULL OR d.platform = 'web'
        ON CONFLICT (user_id, kind) DO NOTHING RETURNING user_id`);
      for (const row of marked.rows) await this.messaging.sendZns(row.user_id, "smart_otp_reminder", { date: dayOf(end) });
      zns = marked.rows.length;
    }
    return { notified, zns, webExpired: 0 };
  }

  // Smart OTP kích hoạt trên bản web trước CONG_VIEC_72 hết hiệu lực khi hết thời hạn chuyển đổi (QUYTAC_NGHIEPVU_562).
  private async expireWeb(): Promise<number> {
    return this.database.transaction(async (transaction) => {
      const removed = await transaction.execute<{ user_id: string }>(sql`DELETE FROM core.smart_otp_devices WHERE platform = 'web' RETURNING user_id`);
      for (const row of removed.rows) {
        await this.audit.record(
          { actorUserId: null, companyId: null, appCode: "crm", action: "smart_otp.web_expired", entityType: "smart_otp", entityId: row.user_id },
          transaction,
        );
      }
      return removed.rows.length;
    });
  }
}
