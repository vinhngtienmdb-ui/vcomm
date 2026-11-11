// Chuẩn bị cơ sở dữ liệu kiểm thử: xóa sạch, chạy database migration, nạp dữ liệu thử (tài liệu 20).
import { Test } from "@nestjs/testing";
import { randomBytes } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Pool } from "pg";
import { AppModule } from "../src/app.module";
import { CLOCK, type Clock } from "../src/common/clock";
import { OUTBOUND_MESSAGES, type OutboundMessage } from "../src/common/outbound-messages";
import { runMigrations } from "../src/database/run-migrations";
import { EXCHANGE_RATE_FEED } from "../src/settings/vietcombank-rates";
import { RATE_LIMIT } from "../src/common/rate-limiter";
import { FILE_STORAGE, type FileStorage } from "../src/common/file-storage";
import { OAUTH_CLIENT, type OauthClient, type OauthProfile } from "../src/auth/oauth-providers";
import { MESSAGE_GATEWAY, type EsmsCredentials, type MessageGateway } from "../src/integrations/esms-gateway";
import { seedTestData } from "../src/database/seed";
import { configureApplication } from "../src/main";

const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "postgres://vcomm_ung_dung:mat_khau_phat_trien@localhost:5432/vcomm_test";

// Đồng hồ giả lập: đặt `fixed` để thử ngày hiệu lực; để null thì dùng giờ thật.
export const testClock: Clock & { fixed: Date | null } = {
  fixed: null,
  now() {
    return this.fixed ?? new Date();
  },
};

// Email, SMS gửi đi trong kiểm thử được giữ lại để lấy đường dẫn kích hoạt.
export const sentMessages: OutboundMessage[] = [];

// Nguồn tỷ giá giả: đặt `xml` là nội dung trả về, để null thì giả lập nguồn lỗi. Kiểm thử không gọi mạng ngoài.
export const testRateFeed = {
  xml: null as string | null,
  async fetchXml(): Promise<string> {
    if (this.xml === null) throw new Error("Nguồn tỷ giá giả lập lỗi");
    return this.xml;
  },
};

// Giới hạn số yêu cầu không cần đăng nhập: để rất cao cho các kiểm thử đăng nhập nhiều lần; KICHBAN_KIEMTHU_120 đặt lại 20.
export const testRateLimit = { perMinute: 1_000_000 };

// Cổng gửi tin giả: giữ lại mọi lần gửi; đặt `fail` để giả lập eSMS từ chối. Kiểm thử không gọi eSMS thật.
export const testGateway = {
  fail: false as boolean,
  sent: [] as { kind: "zns" | "otp"; credentials: EsmsCredentials; input: Record<string, unknown> }[],
  async sendZns(credentials, input) {
    this.sent.push({ kind: "zns", credentials, input });
    return this.fail ? { ok: false, messageId: null, error: "101: Authorize Failed" } : { ok: true, messageId: `zns-${this.sent.length}`, error: null };
  },
  async sendOtp(credentials, input) {
    this.sent.push({ kind: "otp", credentials, input });
    return this.fail ? { ok: false, messageId: null, error: "101: Authorize Failed" } : { ok: true, messageId: `otp-${this.sent.length}`, error: null };
  },
  async listOfficialAccounts() {
    return this.fail ? { ok: false, error: "Authorize Failed", accounts: [] } : { ok: true, error: null, accounts: [{ id: "4097311281936189049", name: "VComm" }] };
  },
} satisfies MessageGateway & { fail: boolean; sent: unknown[] };

// Nhà cung cấp đăng nhập giả: mã ủy quyền tra trong `profiles`; không có thì giả lập nhà cung cấp lỗi.
export const testOauth = {
  profiles: new Map<string, OauthProfile>(),
  authorizationUrl(provider, _app, input) {
    return `https://nha-cung-cap.test/${provider}?state=${input.state}&challenge=${input.codeChallenge}`;
  },
  async exchange(_provider, _app, input) {
    const profile = this.profiles.get(input.code);
    if (!profile) throw new Error("invalid_grant");
    return profile;
  },
} satisfies OauthClient & { profiles: Map<string, OauthProfile> };

// Kho tệp trong bộ nhớ thay S3 khi kiểm thử.
export const testStorage = {
  files: new Map<string, Buffer>(),
  async put(key, content) {
    this.files.set(key, content);
  },
  async get(key) {
    const content = this.files.get(key);
    if (!content) throw new Error("Không có tệp");
    return content;
  },
  async remove(key) {
    this.files.delete(key);
  },
} satisfies FileStorage & { files: Map<string, Buffer> };

export async function startTestApplication(): Promise<{ application: NestExpressApplication; pool: Pool }> {
  if (!new URL(testDatabaseUrl).pathname.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL phải trỏ tới cơ sở dữ liệu có tên kết thúc bằng _test.");
  }
  process.env.DATABASE_URL = testDatabaseUrl;
  // Bộ đếm giới hạn yêu cầu dùng bộ nhớ trong kiểm thử, không dùng Redis của máy.
  delete process.env.REDIS_URL;
  process.env.ACCESS_TOKEN_SECRET ??= randomBytes(32).toString("hex");
  process.env.MFA_SECRET_KEY ??= randomBytes(32).toString("hex");
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 2 });
  await pool.query(
    "DROP SCHEMA IF EXISTS hr CASCADE; DROP SCHEMA IF EXISTS marketplace CASCADE; DROP SCHEMA IF EXISTS accounting CASCADE; DROP SCHEMA IF EXISTS finance CASCADE; DROP SCHEMA IF EXISTS sales CASCADE; DROP SCHEMA IF EXISTS purchasing CASCADE; DROP SCHEMA IF EXISTS crm CASCADE; DROP SCHEMA IF EXISTS inventory CASCADE; DROP SCHEMA IF EXISTS catalog CASCADE; DROP SCHEMA IF EXISTS core CASCADE; DROP TABLE IF EXISTS public.schema_migrations",
  );
  await runMigrations(pool);
  await seedTestData(pool);
  testClock.fixed = null;
  const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(testClock)
    .overrideProvider(OUTBOUND_MESSAGES)
    .useValue({ send: async (message: OutboundMessage) => void sentMessages.push(message) })
    .overrideProvider(FILE_STORAGE)
    .useValue(testStorage)
    .overrideProvider(OAUTH_CLIENT)
    .useValue(testOauth)
    .overrideProvider(MESSAGE_GATEWAY)
    .useValue(testGateway)
    .overrideProvider(RATE_LIMIT)
    .useValue(testRateLimit)
    .overrideProvider(EXCHANGE_RATE_FEED)
    .useValue(testRateFeed)
    .compile();
  const application = configureApplication(moduleReference.createNestApplication<NestExpressApplication>());
  await application.init();
  return { application, pool };
}
