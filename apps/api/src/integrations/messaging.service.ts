// Gửi mã OTP đăng nhập và tin Zalo ZNS theo sự kiện duyệt (QUYTAC_NGHIEPVU_32); ghi nhật ký gửi tin, không lưu mã OTP.
// Gửi lỗi không làm lỗi nghiệp vụ gọi tới: chỉ ghi trạng thái "failed".
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { IntegrationSettingKey, IntegrationTestResponse, MessageDeliveryItem } from "contracts";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DATABASE, type Database } from "../database/database.module";
import { type EsmsCredentials, MESSAGE_GATEWAY, type MessageGateway } from "./esms-gateway";
import { IntegrationSettingsService } from "./integration-settings.service";

export type ZnsEvent = "approval_assigned" | "approval_reminder" | "approval_completed";

const maskPhone = (phone: string) => (phone.length > 7 ? `${phone.slice(0, 5)}***${phone.slice(-4)}` : "***");

@Injectable()
export class MessagingService {
  private readonly logger = new Logger("Messaging");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(MESSAGE_GATEWAY) private readonly gateway: MessageGateway,
    private readonly settings: IntegrationSettingsService,
  ) {}

  // Đã cài khóa eSMS thì đăng nhập bằng số điện thoại dùng được (API_54).
  async smsConfigured(): Promise<boolean> {
    const values = await this.settings.getMany(["esms.api_key", "esms.secret_key", "esms.brandname"]);
    return Boolean(values["esms.api_key"] && values["esms.secret_key"] && values["esms.brandname"]);
  }

  async sendLoginOtp(phone: string, code: string, userId: string | null): Promise<boolean> {
    const values = await this.settings.getMany(["esms.api_key", "esms.secret_key", "esms.brandname", "esms.sandbox", "esms.oa_id", "esms.template.login_otp"]);
    const credentials = this.credentials(values);
    if (!credentials || !values["esms.brandname"]) {
      await this.record({ channel: "sms", purpose: "login_otp", userId, phone, templateId: null, status: "skipped", messageId: null, error: "Chưa cài đặt eSMS" });
      return false;
    }
    const withZalo = Boolean(values["esms.oa_id"] && values["esms.template.login_otp"]);
    const result = await this.gateway.sendOtp(credentials, {
      phone,
      code,
      oaId: values["esms.oa_id"],
      templateId: values["esms.template.login_otp"],
      brandname: values["esms.brandname"],
      requestId: randomUUID(),
    });
    await this.record({
      channel: withZalo ? "zns_sms" : "sms",
      purpose: "login_otp",
      userId,
      phone,
      templateId: values["esms.template.login_otp"],
      status: result.ok ? "sent" : "failed",
      messageId: result.messageId,
      error: result.error,
    });
    return result.ok;
  }

  // Tin ZNS theo sự kiện duyệt (CHUC_NANG_26). Thiếu số điện thoại hoặc chưa cài mẫu tin thì bỏ qua, không ghi lỗi.
  async sendZns(userId: string, event: ZnsEvent, data: Record<string, string>): Promise<void> {
    try {
      const templateKey = `esms.template.${event}` as IntegrationSettingKey;
      const values = await this.settings.getMany(["esms.api_key", "esms.secret_key", "esms.sandbox", "esms.oa_id", templateKey]);
      const credentials = this.credentials(values);
      const templateId = values[templateKey];
      if (!credentials || !values["esms.oa_id"] || !templateId) return;
      const phone = (await this.database.execute<{ phone: string | null }>(sql`SELECT phone FROM core.users WHERE id = ${userId} AND status = 'active'`)).rows[0]?.phone;
      if (!phone) return;
      const result = await this.gateway.sendZns(credentials, { phone, oaId: values["esms.oa_id"], templateId, data, requestId: randomUUID() });
      await this.record({
        channel: "zns",
        purpose: `approval.${event.replace("approval_", "")}`,
        userId,
        phone,
        templateId,
        status: result.ok ? "sent" : "failed",
        messageId: result.messageId,
        error: result.error,
      });
    } catch (error) {
      this.logger.error(`Không gửi được ZNS ${event}: ${(error as Error).message}`);
    }
  }

  // Nút "Kiểm tra kết nối" trên MAN_HINH_19: lấy danh sách Zalo OA bằng khóa đã lưu.
  async test(): Promise<IntegrationTestResponse> {
    const credentials = this.credentials(await this.settings.getMany(["esms.api_key", "esms.secret_key", "esms.sandbox"]));
    if (!credentials) return { ok: false, message: "esmsMissing", officialAccounts: [] };
    const result = await this.gateway.listOfficialAccounts(credentials);
    return { ok: result.ok, message: result.ok ? "esmsConnected" : (result.error ?? "esmsFailed"), officialAccounts: result.accounts };
  }

  async recentDeliveries(): Promise<MessageDeliveryItem[]> {
    const rows = await this.database.execute<{
      id: string;
      channel: MessageDeliveryItem["channel"];
      purpose: string;
      phone_masked: string;
      status: MessageDeliveryItem["status"];
      error: string | null;
      created_at: Date;
    }>(sql`
      SELECT id, channel, purpose, phone_masked, status, error, created_at FROM core.message_deliveries ORDER BY created_at DESC LIMIT 50`);
    return rows.rows.map((row) => ({
      id: row.id,
      channel: row.channel,
      purpose: row.purpose,
      phoneMasked: row.phone_masked,
      status: row.status,
      error: row.error,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  private credentials(values: Partial<Record<IntegrationSettingKey, string | null>>): EsmsCredentials | null {
    const apiKey = values["esms.api_key"];
    const secretKey = values["esms.secret_key"];
    return apiKey && secretKey ? { apiKey, secretKey, sandbox: values["esms.sandbox"] === "true" } : null;
  }

  private async record(input: {
    channel: "zns" | "zns_sms" | "sms";
    purpose: string;
    userId: string | null;
    phone: string;
    templateId: string | null;
    status: "sent" | "failed" | "skipped";
    messageId: string | null;
    error: string | null;
  }): Promise<void> {
    await this.database.execute(sql`
      INSERT INTO core.message_deliveries (channel, purpose, user_id, phone_masked, template_id, status, provider_message_id, error)
      VALUES (${input.channel}, ${input.purpose}, ${input.userId}, ${maskPhone(input.phone)}, ${input.templateId}, ${input.status}, ${input.messageId}, ${input.error})`);
  }
}
