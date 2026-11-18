// Kiểm thử CONG_VIEC_77: gửi email thật qua SMTP, kiểm tra cấu hình, không ghi nội dung thư vào log.
// Máy chủ SMTP giả chạy cục bộ (node:net), không gọi máy chủ thư bên ngoài.
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createServer, type Server, type Socket } from "node:net";
import { createTransport } from "nodemailer";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { createOutboundMessages, LogOutboundMessages, OUTBOUND_MESSAGES, readEmailConfig, SmtpOutboundMessages, smtpTransport, type OutboundMessages } from "../src/common/outbound-messages";
import { startTestApplication } from "./setup-database";

interface FakeSmtpServer {
  port: number;
  commands: string[];
  messages: string[];
  rejectRecipients: boolean;
  close(): Promise<void>;
}

// Máy chủ SMTP tối thiểu: EHLO, AUTH PLAIN, MAIL, RCPT, DATA, QUIT; không quảng bá STARTTLS.
async function startFakeSmtpServer(): Promise<FakeSmtpServer> {
  const state = { commands: [] as string[], messages: [] as string[], rejectRecipients: false };
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffer = "";
    let inData = false;
    let data = "";
    socket.write("220 may-chu-thu-gia ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index: number;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            state.messages.push(data);
            data = "";
            socket.write("250 2.0.0 Da nhan\r\n");
          } else data += `${line}\n`;
          continue;
        }
        state.commands.push(line);
        const verb = line.split(" ")[0]!.toUpperCase();
        if (verb === "EHLO") socket.write("250-may-chu-thu-gia\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
        else if (verb === "AUTH") socket.write("235 2.7.0 Da xac thuc\r\n");
        else if (verb === "MAIL") socket.write("250 2.1.0 OK\r\n");
        else if (verb === "RCPT") socket.write(state.rejectRecipients ? "550 5.1.1 Khong co hop thu\r\n" : "250 2.1.5 OK\r\n");
        else if (verb === "DATA") {
          inData = true;
          socket.write("354 Gui noi dung\r\n");
        } else if (verb === "QUIT") socket.end("221 Tam biet\r\n");
        else if (verb === "RSET" || verb === "NOOP") socket.write("250 OK\r\n");
        else socket.write("502 Khong ho tro\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Không mở được cổng máy chủ thư giả.");
  return Object.assign(state, {
    port: address.port,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  });
}

const smtpEnvironment = (overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: "production",
  EMAIL_DRIVER: "smtp",
  SMTP_HOST: "mail.vcomm.test",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_USER: "thongbao@vcomm.test",
  SMTP_PASSWORD: "mat-khau-hop-thu-thu",
  SMTP_FROM: "VComm <thongbao@vcomm.test>",
  ...overrides,
});

const activationLink = "https://erp.vcomm.test/kich-hoat?token=ma-kich-hoat-bi-mat-123";

describe("CONG_VIEC_77 cấu hình email", () => {
  it("máy phát triển không đặt EMAIL_DRIVER thì ghi log", () => {
    expect(readEmailConfig({ NODE_ENV: "development" })).toEqual({ driver: "log" });
    expect(readEmailConfig({ NODE_ENV: "test", EMAIL_DRIVER: "log" })).toEqual({ driver: "log" });
  });

  it("môi trường thật không đặt EMAIL_DRIVER hoặc đặt log thì báo lỗi", () => {
    expect(() => readEmailConfig({ NODE_ENV: "production" })).toThrow(/EMAIL_DRIVER=smtp/);
    expect(() => readEmailConfig({ NODE_ENV: "production", EMAIL_DRIVER: "log" })).toThrow(/EMAIL_DRIVER=smtp/);
  });

  it("EMAIL_DRIVER không hợp lệ thì báo lỗi", () => {
    expect(() => readEmailConfig({ NODE_ENV: "development", EMAIL_DRIVER: "ses" })).toThrow(/chỉ nhận log hoặc smtp/);
  });

  it("thiếu biến SMTP thì nêu đủ tên biến thiếu", () => {
    const run = () => readEmailConfig({ NODE_ENV: "production", EMAIL_DRIVER: "smtp", SMTP_PASSWORD: "mat-khau-hop-thu-thu" });
    expect(run).toThrow(/thiếu SMTP_HOST; thiếu SMTP_PORT; thiếu SMTP_USER; thiếu SMTP_FROM/);
    expect(run).not.toThrow(/SMTP_PASSWORD/);
  });

  it("giá trị biên của cổng và SMTP_SECURE", () => {
    expect(() => readEmailConfig(smtpEnvironment({ SMTP_PORT: "0" }))).toThrow(/SMTP_PORT phải là số cổng/);
    expect(() => readEmailConfig(smtpEnvironment({ SMTP_PORT: "65536" }))).toThrow(/SMTP_PORT phải là số cổng/);
    expect(() => readEmailConfig(smtpEnvironment({ SMTP_PORT: "58a" }))).toThrow(/SMTP_PORT phải là số cổng/);
    expect(() => readEmailConfig(smtpEnvironment({ SMTP_SECURE: "co" }))).toThrow(/SMTP_SECURE chỉ nhận true hoặc false/);
    expect(readEmailConfig(smtpEnvironment({ SMTP_PORT: "65535" }))).toMatchObject({ driver: "smtp", smtp: { port: 65535 } });
    // Không đặt SMTP_SECURE: cổng 465 dùng TLS ngay, cổng khác dùng STARTTLS.
    expect(readEmailConfig(smtpEnvironment({ SMTP_PORT: "465", SMTP_SECURE: undefined }))).toMatchObject({ smtp: { secure: true } });
    expect(readEmailConfig(smtpEnvironment({ SMTP_PORT: "587", SMTP_SECURE: undefined }))).toMatchObject({ smtp: { secure: false } });
    expect(readEmailConfig(smtpEnvironment({ SMTP_PORT: "465", SMTP_SECURE: "true" }))).toEqual({
      driver: "smtp",
      smtp: { host: "mail.vcomm.test", port: 465, secure: true, user: "thongbao@vcomm.test", password: "mat-khau-hop-thu-thu", from: "VComm <thongbao@vcomm.test>" },
    });
  });

  it("lỗi cấu hình không chứa mật khẩu", () => {
    try {
      readEmailConfig(smtpEnvironment({ SMTP_HOST: "" }));
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("mat-khau-hop-thu-thu");
    }
  });
});

describe("CONG_VIEC_77 từ chối khởi động khi thiếu cấu hình ở môi trường thật", () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, EMAIL_DRIVER: process.env.EMAIL_DRIVER, SMTP_HOST: process.env.SMTP_HOST };
  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("hàm tạo trình gửi chọn đúng loại theo cấu hình", () => {
    process.env.NODE_ENV = "test";
    delete process.env.EMAIL_DRIVER;
    expect(createOutboundMessages()).toBeInstanceOf(LogOutboundMessages);
  });

  it("dựng ứng dụng với NODE_ENV=production, không có SMTP thì thất bại kèm lỗi rõ", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.EMAIL_DRIVER;
    delete process.env.SMTP_HOST;
    await expect(Test.createTestingModule({ imports: [AppModule] }).compile()).rejects.toThrow(/EMAIL_DRIVER=smtp/);
  });
});

describe("CONG_VIEC_77 gửi qua SMTP", () => {
  let smtp: FakeSmtpServer;
  let logs: string[];

  beforeAll(async () => {
    smtp = await startFakeSmtpServer();
  });

  afterAll(async () => {
    await smtp.close();
  });

  const captureLogs = () => {
    logs = [];
    for (const level of ["log", "warn", "error", "debug", "verbose"] as const)
      vi.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => void logs.push(String(message)));
  };

  afterEach(() => {
    vi.restoreAllMocks();
    smtp.commands.length = 0;
    smtp.messages.length = 0;
    smtp.rejectRecipients = false;
  });

  // Bộ gửi tới máy chủ giả: máy chủ giả không có TLS nên không bắt buộc STARTTLS ở đây; bắt buộc STARTTLS kiểm ở ca riêng bên dưới.
  const plainSender = () =>
    new SmtpOutboundMessages(
      createTransport({ host: "127.0.0.1", port: smtp.port, secure: false, ignoreTLS: true, auth: { user: "thongbao@vcomm.test", pass: "mat-khau-hop-thu-thu" } }),
      "VComm <thongbao@vcomm.test>",
    );

  it("gửi email kèm tệp đính kèm tới máy chủ SMTP, có xác thực, log không chứa nội dung", async () => {
    captureLogs();
    await plainSender().send({
      channel: "email",
      to: "nhan.vien@vcomm.test",
      subject: "Kích hoạt tài khoản VComm",
      body: `Mở đường dẫn: ${activationLink}`,
      attachments: [{ fileName: "lich.ics", contentType: "text/calendar", content: "BEGIN:VCALENDAR\nEND:VCALENDAR" }],
    });
    expect(smtp.commands.some((command) => command.startsWith("AUTH PLAIN"))).toBe(true);
    expect(smtp.commands).toContain("MAIL FROM:<thongbao@vcomm.test>");
    expect(smtp.commands).toContain("RCPT TO:<nhan.vien@vcomm.test>");
    expect(smtp.messages).toHaveLength(1);
    const raw = smtp.messages[0]!;
    expect(raw).toMatch(/^To: nhan\.vien@vcomm\.test$/m);
    expect(raw).toMatch(/^From: VComm <thongbao@vcomm\.test>$/m);
    expect(raw).toContain("lich.ics");
    expect(raw.replace(/=\n/g, "")).toContain("ma-kich-hoat-bi-mat-123");
    expect(logs.join("\n")).not.toContain("ma-kich-hoat-bi-mat-123");
    expect(logs.join("\n")).not.toContain("nhan.vien@vcomm.test");
  });

  it("máy chủ từ chối người nhận thì báo lỗi cho nơi gọi", async () => {
    smtp.rejectRecipients = true;
    await expect(plainSender().send({ channel: "email", to: "khong.co@vcomm.test", subject: "Thử", body: "Nội dung" })).rejects.toThrow();
  });

  it("tin SMS không gửi qua SMTP và log không chứa đường dẫn kích hoạt, số điện thoại đầy đủ", async () => {
    captureLogs();
    await plainSender().send({ channel: "sms", to: "0901234567", subject: "Kích hoạt tài khoản VComm", body: `Mở đường dẫn: ${activationLink}` });
    expect(smtp.commands).toHaveLength(0);
    const text = logs.join("\n");
    expect(text).toContain("***567");
    expect(text).not.toContain("0901234567");
    expect(text).not.toContain("ma-kich-hoat-bi-mat-123");
  });

  it("SMTP_SECURE=false bắt buộc STARTTLS: máy chủ không hỗ trợ thì không gửi mật khẩu, không gửi thư", async () => {
    const transport = smtpTransport({ host: "127.0.0.1", port: smtp.port, secure: false, user: "thongbao@vcomm.test", password: "mat-khau-hop-thu-thu", from: "thongbao@vcomm.test" });
    await expect(new SmtpOutboundMessages(transport, "thongbao@vcomm.test").send({ channel: "email", to: "nhan.vien@vcomm.test", subject: "Thử", body: "Nội dung" })).rejects.toThrow();
    expect(smtp.commands.some((command) => command.startsWith("AUTH"))).toBe(false);
    expect(smtp.messages).toHaveLength(0);
  });
});

describe("CONG_VIEC_77 quên mật khẩu khi gửi thư lỗi", () => {
  let application: NestExpressApplication;
  let pool: Pool;

  beforeAll(async () => {
    ({ application, pool } = await startTestApplication());
  });

  afterAll(async () => {
    await application?.close();
    await pool?.end();
  });

  it("vẫn trả 204 như tài khoản không tồn tại, không lộ lỗi gửi", async () => {
    const messages = application.get<OutboundMessages>(OUTBOUND_MESSAGES);
    const original = messages.send;
    messages.send = async () => {
      throw new Error("Máy chủ thư không phản hồi");
    };
    try {
      const existing = await request(application.getHttpServer()).post("/api/v1/auth/password/forgot").send({ identifier: "quantri.vcr@vcomm.test" });
      const missing = await request(application.getHttpServer()).post("/api/v1/auth/password/forgot").send({ identifier: "khong.ton.tai@vcomm.test" });
      expect(existing.status).toBe(missing.status);
      expect(existing.status).toBe(204);
    } finally {
      messages.send = original;
    }
  });
});
