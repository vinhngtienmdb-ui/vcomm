// Chuẩn bị cơ sở dữ liệu kiểm thử: xóa sạch, chạy database migration, nạp dữ liệu thử (tài liệu 20).
import { Test } from "@nestjs/testing";
import { randomBytes } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Pool } from "pg";
import { AppModule } from "../src/app.module";
import { CLOCK, type Clock } from "../src/common/clock";
import { OUTBOUND_MESSAGES, type OutboundMessage } from "../src/common/outbound-messages";
import { runMigrations } from "../src/database/run-migrations";
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

export async function startTestApplication(): Promise<{ application: NestExpressApplication; pool: Pool }> {
  if (!new URL(testDatabaseUrl).pathname.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL phải trỏ tới cơ sở dữ liệu có tên kết thúc bằng _test.");
  }
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.ACCESS_TOKEN_SECRET ??= randomBytes(32).toString("hex");
  const pool = new Pool({ connectionString: testDatabaseUrl, max: 2 });
  await pool.query("DROP SCHEMA IF EXISTS core CASCADE; DROP TABLE IF EXISTS public.schema_migrations");
  await runMigrations(pool);
  await seedTestData(pool);
  testClock.fixed = null;
  const moduleReference = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CLOCK)
    .useValue(testClock)
    .overrideProvider(OUTBOUND_MESSAGES)
    .useValue({ send: async (message: OutboundMessage) => void sentMessages.push(message) })
    .compile();
  const application = configureApplication(moduleReference.createNestApplication<NestExpressApplication>());
  await application.init();
  return { application, pool };
}
