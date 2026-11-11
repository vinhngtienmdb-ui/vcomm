// Gửi email, SMS. Lát L4 chỉ ghi ra log (EMAIL_DRIVER=log); nhà cung cấp thật gắn ở lát sau (tài liệu 12).
import { Injectable, Logger } from "@nestjs/common";

export const OUTBOUND_MESSAGES = Symbol("OUTBOUND_MESSAGES");

export interface OutboundMessage {
  channel: "email" | "sms";
  to: string;
  subject: string;
  body: string;
  // Tệp đính kèm email, ví dụ tệp lịch .ics mời phỏng vấn (CONG_VIEC_54); không bắt buộc.
  attachments?: { fileName: string; contentType: string; content: string }[];
}

export interface OutboundMessages {
  send(message: OutboundMessage): Promise<void>;
}

@Injectable()
export class LogOutboundMessages implements OutboundMessages {
  private readonly logger = new Logger("OutboundMessages");

  async send(message: OutboundMessage): Promise<void> {
    // Chỉ dùng trên máy phát triển và môi trường thử: đường dẫn kích hoạt nằm trong log.
    const attached = message.attachments?.length ? ` | tệp: ${message.attachments.map((attachment) => attachment.fileName).join(", ")}` : "";
    this.logger.log(`[${message.channel}] tới ${message.to} | ${message.subject} | ${message.body}${attached}`);
  }
}

export function webOrigin(): string {
  return process.env.WEB_ORIGIN ?? "http://localhost:3000";
}
