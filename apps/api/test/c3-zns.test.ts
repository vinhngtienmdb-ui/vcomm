// CONG_VIEC_03 lát L9: thông báo duyệt qua Zalo ZNS (TIEUCHI_NGHIEMTHU_50; KICHBAN_KIEMTHU_127, 128).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApprovalRequestsService } from "../src/approvals/approval-requests.service";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock, testGateway } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let requester: Session;
let approver: Session;
let requesterId: string;
const retail: string = testIds.retailCompany;
const approverPhone = "+84911111111";
const requesterPhone = "+84922222222";

const dispatch = () => application.get(OutboxService).dispatchPending();
const znsTo = (phone: string) => testGateway.sent.filter((item) => item.kind === "zns" && item.input.phone === phone);

async function submit(amount: string) {
  const response = await requester.call("post", "/approval-requests", {
    companyId: retail,
    body: { documentTypeCode: "platform.test_document", documentId: randomUUID(), documentNo: `CT-ZNS-${Date.now()}`, amount, currency: "VND", documentDate: "2026-11-09" },
  });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  const employeeRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
  requesterId = await createTestUser(pool, "lap.zns@vcomm.test", "Ngô Văn Lập", [{ companyId: retail }]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [requesterId, employeeRole, retail]);
  await pool.query("UPDATE core.users SET phone = $1 WHERE id = $2", [approverPhone, testIds.purchasingManager]);
  await pool.query("UPDATE core.users SET phone = $1 WHERE id = $2", [requesterPhone, requesterId]);
  const policy = await retailAdmin.call("post", "/approval-policies", {
    companyId: retail,
    body: {
      documentTypeCode: "platform.test_document",
      currency: "VND",
      effectiveFrom: "2026-01-01",
      levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 4 }],
    },
  });
  expect(policy.status).toBe(201);
  requester = await signIn(application, "lap.zns@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_50: tin ZNS cho sự kiện duyệt", () => {
  it("chưa cài mẫu tin thì không gửi ZNS, thông báo trong ứng dụng vẫn có", async () => {
    const id = await submit("1000000");
    await dispatch();
    expect(testGateway.sent).toHaveLength(0);
    expect((await pool.query("SELECT 1 FROM core.notifications WHERE user_id = $1 AND link = $2", [testIds.purchasingManager, `/hop-duyet/${id}`])).rows).toHaveLength(1);
    await approver.call("post", `/approval-requests/${id}/decisions`, { body: { decision: "approved" } });
    await dispatch();
  });

  it("chờ duyệt, kết quả duyệt: mỗi người nhận đúng một tin theo mẫu đã cài", async () => {
    await groupAdmin.call("put", "/integration-settings", {
      body: {
        values: {
          "esms.api_key": "API-1111",
          "esms.secret_key": "SECRET-2222",
          "esms.oa_id": "4097311281936189049",
          "esms.template.approval_assigned": "301",
          "esms.template.approval_reminder": "302",
          "esms.template.approval_completed": "303",
        },
      },
    });
    const id = await submit("80000000");
    await dispatch();
    await dispatch();
    expect(znsTo(approverPhone)).toHaveLength(1);
    expect(znsTo(approverPhone)[0]!.input).toMatchObject({
      oaId: "4097311281936189049",
      templateId: "301",
      data: { document_type: "Chứng từ thử", amount: "80.000.000 VND", requester: "Ngô Văn Lập", result: "Chờ duyệt" },
    });
    await approver.call("post", `/approval-requests/${id}/decisions`, { body: { decision: "rejected", comment: "Thiếu báo giá" } });
    await dispatch();
    expect(znsTo(requesterPhone)).toHaveLength(1);
    expect(znsTo(requesterPhone)[0]!.input).toMatchObject({ templateId: "303", data: { result: "Bị từ chối" } });
  });

  it("nhắc quá hạn gửi mẫu tin nhắc", async () => {
    const service = application.get(ApprovalRequestsService);
    try {
      testClock.fixed = new Date("2026-11-09T08:00:00+07:00");
      await submit("2000000");
      await dispatch();
      testClock.fixed = new Date("2026-11-09T12:30:00+07:00");
      await service.processOverdue();
      await dispatch();
      expect(znsTo(approverPhone).filter((item) => item.input.templateId === "302")).toHaveLength(1);
    } finally {
      testClock.fixed = null;
    }
  });

  it("eSMS lỗi: luồng duyệt vẫn chạy, ghi lỗi, không gửi lại", async () => {
    testGateway.fail = true;
    try {
      const before = znsTo(approverPhone).length;
      const id = await submit("3000000");
      await dispatch();
      await dispatch();
      expect(znsTo(approverPhone)).toHaveLength(before + 1);
      const failed = await pool.query("SELECT status, error FROM core.message_deliveries WHERE purpose = 'approval.assigned' ORDER BY created_at DESC LIMIT 1");
      expect(failed.rows[0]).toMatchObject({ status: "failed", error: "101: Authorize Failed" });
      expect((await approver.call("post", `/approval-requests/${id}/decisions`, { body: { decision: "approved" } })).body.status).toBe("approved");
    } finally {
      testGateway.fail = false;
    }
  });

  it("người nhận chưa có số điện thoại thì bỏ qua", async () => {
    await pool.query("UPDATE core.users SET phone = NULL WHERE id = $1", [testIds.purchasingManager]);
    await dispatch();
    const before = testGateway.sent.length;
    await submit("4000000");
    await dispatch();
    expect(testGateway.sent).toHaveLength(before);
  });
});
