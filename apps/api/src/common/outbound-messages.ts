// Gửi email, SMS (CONG_VIEC_77). EMAIL_DRIVER=log ghi ra log (máy phát triển, kiểm thử); EMAIL_DRIVER=smtp gửi qua máy chủ SMTP
// của hộp thư doanh nghiệp. Môi trường thật (NODE_ENV=production) bắt buộc smtp, thiếu cấu hình thì từ chối khởi động.
// Biến môi trường: EMAIL_DRIVER, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM; SMTP_SECURE không bắt buộc.
import { Injectable, Logger } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";

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
    // Chỉ dùng trên máy phát triển và kiểm thử: đường dẫn kích hoạt nằm trong log; môi trường thật không cho chọn (readEmailConfig).
    const attached = message.attachments?.length ? ` | tệp: ${message.attachments.map((attachment) => attachment.fileName).join(", ")}` : "";
    this.logger.log(`[${message.channel}] tới ${message.to} | ${message.subject} | ${message.body}${attached}`);
  }
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export type EmailConfig = { driver: "log" } | { driver: "smtp"; smtp: SmtpConfig };

// Đọc và kiểm tra cấu hình; lỗi nêu đủ tên biến thiếu hoặc sai, không in giá trị (mật khẩu).
export function readEmailConfig(environment: NodeJS.ProcessEnv = process.env): EmailConfig {
  const production = environment.NODE_ENV === "production";
  const driver = environment.EMAIL_DRIVER?.trim() || (production ? "" : "log");
  if (production && driver !== "smtp") throw new Error("Cấu hình email: môi trường thật phải đặt EMAIL_DRIVER=smtp (không được ghi email ra log).");
  if (driver === "log") return { driver: "log" };
  if (driver !== "smtp") throw new Error(`Cấu hình email: EMAIL_DRIVER chỉ nhận log hoặc smtp.`);

  const problems: string[] = [];
  const required = (name: string) => {
    const value = environment[name]?.trim() ?? "";
    if (!value) problems.push(`thiếu ${name}`);
    return value;
  };
  const host = required("SMTP_HOST");
  const portText = required("SMTP_PORT");
  const port = Number(portText);
  if (portText && !(Number.isInteger(port) && port >= 1 && port <= 65535)) problems.push("SMTP_PORT phải là số cổng từ 1 đến 65535");
  // SMTP_SECURE không bắt buộc: để trống thì TLS ngay khi cổng 465, các cổng khác dùng STARTTLS.
  const secureText = environment.SMTP_SECURE?.trim() || (port === 465 ? "true" : "false");
  if (secureText !== "true" && secureText !== "false") problems.push("SMTP_SECURE chỉ nhận true hoặc false");
  const user = required("SMTP_USER");
  const password = required("SMTP_PASSWORD");
  const from = required("SMTP_FROM");
  if (problems.length > 0) throw new Error(`Cấu hình email SMTP chưa đủ: ${problems.join("; ")}.`);
  return { driver: "smtp", smtp: { host, port, secure: secureText === "true", user, password, from } };
}

// SMTP_SECURE=true: TLS ngay khi kết nối (cổng 465); false: bắt buộc nâng cấp STARTTLS (cổng 587), không gửi mật khẩu khi chưa mã hóa.
export function smtpTransport(config: SmtpConfig): Transporter {
  return createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

// Che phần lớn địa chỉ nhận khi ghi log: log môi trường thật không chứa email, số điện thoại đầy đủ.
export function maskRecipient(recipient: string): string {
  const at = recipient.indexOf("@");
  if (at > 0) return `${recipient.slice(0, 1)}***${recipient.slice(at)}`;
  return recipient.length > 3 ? `***${recipient.slice(-3)}` : "***";
}

export class SmtpOutboundMessages implements OutboundMessages {
  private readonly logger = new Logger("OutboundMessages");

  constructor(
    private readonly transporter: Transporter,
    private readonly from: string,
  ) {}

  // Lỗi gửi được ném lại cho nơi gọi xử lý (ví dụ ghi lỗi gửi phiếu lương); không ghi nội dung thư vào log.
  async send(message: OutboundMessage): Promise<void> {
    if (message.channel === "sms") {
      // SMS cho người không có email chưa có nhà cung cấp ở trình gửi này; nội dung có đường dẫn kích hoạt nên không ghi ra log.
      this.logger.warn(`[sms] chưa gửi được tới ${maskRecipient(message.to)} | ${message.subject}: trình gửi SMTP không gửi SMS.`);
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.body,
      attachments: message.attachments?.map((attachment) => ({ filename: attachment.fileName, contentType: attachment.contentType, content: attachment.content })),
    });
  }
}

export function createOutboundMessages(): OutboundMessages {
  const config = readEmailConfig();
  if (config.driver === "log") return new LogOutboundMessages();
  return new SmtpOutboundMessages(smtpTransport(config.smtp), config.smtp.from);
}

export function webOrigin(): string {
  return process.env.WEB_ORIGIN ?? "http://localhost:3000";
}
