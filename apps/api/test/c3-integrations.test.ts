// CONG_VIEC_03 lát L6a: Cài đặt tích hợp (TIEUCHI_NGHIEMTHU_48, 49; KICHBAN_KIEMTHU_121 đến 123).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { startTestApplication, testGateway } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let employee: Session;
const secret = "GOCSPX-bi-mat-google-rat-dai-9876";

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  employee = await signIn(application, "phuc.le@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_49: chỉ quản trị tập đoàn mở được Cài đặt tích hợp", () => {
  it("quản trị công ty, nhân viên nhận 403", async () => {
    for (const session of [retailAdmin, employee]) {
      expect((await session.call("get", "/integration-settings")).status).toBe(403);
      expect((await session.call("put", "/integration-settings", { body: { values: { "google.client_id": "x" } } })).status).toBe(403);
      expect((await session.call("post", "/integration-settings/test")).status).toBe(403);
    }
    const listed = await groupAdmin.call("get", "/integration-settings");
    expect(listed.status).toBe(200);
    expect(listed.body.callbackUrls.google).toMatch(/\/api\/v1\/auth\/oauth\/google\/callback$/);
  });
});

describe("TIEUCHI_NGHIEMTHU_48: khóa bí mật không bao giờ trả đầy đủ", () => {
  it("lưu khóa: API, nhật ký chỉ có 4 ký tự cuối; cơ sở dữ liệu lưu dạng mã hóa", async () => {
    const saved = await groupAdmin.call("put", "/integration-settings", { body: { values: { "google.client_id": "123.apps.googleusercontent.com", "google.client_secret": secret } } });
    expect(saved.status).toBe(200);
    const item = saved.body.settings.find((setting: { key: string }) => setting.key === "google.client_secret");
    expect(item).toMatchObject({ secret: true, configured: true, value: null, lastFour: "9876" });
    expect(JSON.stringify(saved.body)).not.toContain(secret);
    expect(saved.body.settings.find((setting: { key: string }) => setting.key === "google.client_id").value).toBe("123.apps.googleusercontent.com");
    const stored = await pool.query("SELECT plain_value, secret_value FROM core.integration_settings WHERE setting_key = 'google.client_secret'");
    expect(stored.rows[0].plain_value).toBeNull();
    expect(Buffer.from(stored.rows[0].secret_value).toString("utf8")).not.toContain("bi-mat");
    const audit = await pool.query("SELECT after_data::text AS data FROM core.audit_events WHERE action = 'integration_settings.update'");
    expect(audit.rows.map((row) => row.data).join(" ")).not.toContain(secret);
    expect(audit.rows[0].data).toContain("••••9876");
  });

  it("để trống khóa bí mật thì giữ khóa cũ; xóa rõ ràng thì mất; giá trị thường để trống thì xóa", async () => {
    await groupAdmin.call("put", "/integration-settings", { body: { values: { "google.client_secret": "", "google.client_id": "" } } });
    const after = (await groupAdmin.call("get", "/integration-settings")).body.settings;
    expect(after.find((setting: { key: string }) => setting.key === "google.client_secret").lastFour).toBe("9876");
    expect(after.find((setting: { key: string }) => setting.key === "google.client_id").configured).toBe(false);
    await groupAdmin.call("put", "/integration-settings", { body: { values: {}, clear: ["google.client_secret"] } });
    expect((await groupAdmin.call("get", "/integration-settings")).body.settings.find((setting: { key: string }) => setting.key === "google.client_secret").configured).toBe(false);
    expect((await groupAdmin.call("put", "/integration-settings", { body: { values: { "khong.co": "x" } } })).status).toBe(400);
  });

  it("kiểm tra kết nối eSMS dùng khóa vừa lưu, không cần khởi động lại", async () => {
    expect((await groupAdmin.call("post", "/integration-settings/test")).body).toMatchObject({ ok: false, message: "esmsMissing" });
    await groupAdmin.call("put", "/integration-settings", { body: { values: { "esms.api_key": "API-KEY-1234", "esms.secret_key": "SECRET-5678" } } });
    const tested = await groupAdmin.call("post", "/integration-settings/test");
    expect(tested.body).toMatchObject({ ok: true, officialAccounts: [{ id: "4097311281936189049", name: "VComm" }] });
    testGateway.fail = true;
    try {
      expect((await groupAdmin.call("post", "/integration-settings/test")).body.ok).toBe(false);
    } finally {
      testGateway.fail = false;
    }
    expect((await groupAdmin.call("get", "/integration-settings/deliveries")).status).toBe(200);
    expect(testIds.groupAdmin).toBeTruthy();
  });
});
