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
  await pool.query("DROP SCHEMA IF EXISTS core CASCADE; DROP TABLE IF EXISTS public.schema_migrations");
  await runMigrations(pool);
  await seedTestData(pool);
  testClock.fixed = null;
  const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(testClock)
    .overrideProvider(OUTBOUND_MESSAGES)
    .useValue({ send: async (message: OutboundMessage) => void sentMessages.push(message) })
    .overrideProvider(RATE_LIMIT)
    .useValue(testRateLimit)
    .overrideProvider(EXCHANGE_RATE_FEED)
    .useValue(testRateFeed)
    .compile();
  const application = configureApplication(moduleReference.createNestApplication<NestExpressApplication>());
  await application.init();
  return { application, pool };
}
