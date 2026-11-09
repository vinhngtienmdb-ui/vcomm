// KICHBAN_KIEMTHU cho TIEUCHI_NGHIEMTHU_28 đến 36 (tài liệu 21, lát L7).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApprovalRequestsService } from "../src/approvals/approval-requests.service";
import { OutboxService, type OutboxEvent } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;
let requester: Session;
let manager: Session;
let director: Session;
let substitute: Session;
const people: Record<string, string> = {};

const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const documentType = "platform.test_document";

async function submit(session: Session, amount: string, options: { currency?: string; documentDate?: string; documentId?: string; companyId?: string } = {}) {
  return session.call("post", "/approval-requests", {
    companyId: options.companyId ?? retail,
    body: { documentTypeCode: documentType, documentId: options.documentId ?? randomUUID(), documentNo: `CT-${amount}-${Date.now()}`, amount, currency: options.currency ?? "VND", documentDate: options.documentDate ?? "2026-11-09" },
  });
}

const decide = (session: Session, id: string, decision: "approved" | "rejected", comment?: string) => session.call("post", `/approval-requests/${id}/decisions`, { body: { decision, comment } });

function policyBody(effectiveFrom = "2026-01-01") {
  return {
    documentTypeCode: documentType,
    currency: "VND",
    effectiveFrom,
    levels: [
      { levelNo: 1, minAmount: "0", approver: { type: "department_manager" }, substitute: { type: "user", userId: people.substitute }, dueHours: 4 },
      { levelNo: 2, minAmount: "50000000", approver: { type: "user", userId: people.director }, substitute: { type: "user", userId: people.substitute }, dueHours: 8 },
      { levelNo: 3, minAmount: "500000000", approver: { type: "user", userId: people.chief }, substitute: { type: "user", userId: people.substitute }, dueHours: 24 },
    ],
  };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  const employeeRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
  for (const [key, email, name, companies] of [
    ["requester", "nhanvien.lap@vcomm.test", "Đinh Văn Lập", [retail, trading]],
    ["director", "giamdoc.vcr@vcomm.test", "Hồ Thị Giám Đốc", [retail, trading]],
    ["substitute", "thaythe.vcr@vcomm.test", "Mai Văn Thay Thế", [retail]],
    ["chief", "tonggiamdoc@vcomm.test", "Tạ Văn Tổng", [retail]],
  ] as const) {
    people[key] = await createTestUser(pool, email, name, companies.map((companyId) => ({ companyId })));
    for (const companyId of companies) {
      await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [people[key], employeeRole, companyId]);
    }
  }
  people.manager = testIds.purchasingManager;
  const department = await retailAdmin.call("post", "/departments", { companyId: retail, body: { code: "PB-MH", name: "Phòng Mua hàng", managerUserId: people.manager } });
  await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = ANY($2) AND company_id = $3", [department.body.id, [people.requester, people.manager], retail]);
  await pool.query(
    `INSERT INTO core.exchange_rates (rate_date, from_currency, to_currency, rate_type, rate, source) VALUES
     ('2026-11-09', 'USD', 'VND', 'accounting', 26300, 'manual'), ('2026-11-10', 'USD', 'VND', 'accounting', 25000, 'manual')`,
  );
  requester = await signIn(application, "nhanvien.lap@vcomm.test");
  manager = await signIn(application, "phuc.le@vcomm.test");
  director = await signIn(application, "giamdoc.vcr@vcomm.test");
  substitute = await signIn(application, "thaythe.vcr@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_28: cấu hình chính sách sai bị từ chối", () => {
  it("KICHBAN_KIEMTHU_70, 71: ngưỡng không tăng dần, thiếu người thay thế", async () => {
    const body = policyBody();
    const decreasing = { ...body, levels: [body.levels[0], { ...body.levels[1], minAmount: "0" }] };
    const notIncreasing = await retailAdmin.call("post", "/approval-policies", { companyId: retail, body: decreasing });
    expect(notIncreasing.status).toBe(400);
    expect(Object.values(notIncreasing.body.error.fields)).toContain("Ngưỡng của cấp sau phải lớn hơn cấp trước.");
    const noSubstitute = await retailAdmin.call("post", "/approval-policies", { companyId: retail, body: { ...body, levels: [body.levels[0], { ...body.levels[1], substitute: null }] } });
    expect(Object.values(noSubstitute.body.error.fields)).toContain("Mỗi cấp phải có người duyệt thay thế.");
    expect(Number((await pool.query("SELECT count(*) FROM core.approval_policies")).rows[0].count)).toBe(0);
  });

  it("KICHBAN_KIEMTHU_73: ngoài quyền bị từ chối", async () => {
    expect((await retailAdmin.call("post", "/approval-policies", { companyId: trading, body: policyBody() })).status).toBe(403);
    expect((await manager.call("post", "/approval-policies", { companyId: retail, body: policyBody() })).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_72: lưu hợp lệ; chính sách mới thay chính sách cũ từ ngày hiệu lực", async () => {
    expect((await retailAdmin.call("post", "/approval-policies", { companyId: retail, body: policyBody("2026-01-01") })).status).toBe(201);
    expect((await retailAdmin.call("post", "/approval-policies", { companyId: retail, body: policyBody("2026-11-01") })).status).toBe(201);
    const list = await retailAdmin.call("get", "/approval-policies", { companyId: retail });
    const old = list.body.find((policy: { effectiveFrom: string }) => policy.effectiveFrom === "2026-01-01");
    expect(old.effectiveTo).toBe("2026-10-31");
    expect(list.body.filter((policy: { active: boolean }) => policy.active)).toHaveLength(1);
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    const employeeRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
    const tradingPolicy = { ...policyBody("2026-01-01"), levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: people.director }, substitute: { type: "role", roleId: employeeRole }, dueHours: 4 }] };
    expect((await groupAdmin.call("post", "/approval-policies", { companyId: trading, body: tradingPolicy })).status).toBe(201);
  });
});

describe("TIEUCHI_NGHIEMTHU_29, 30: chứng từ qua đúng các cấp theo giá trị", () => {
  it("KICHBAN_KIEMTHU_74: 80 triệu qua cấp 1 rồi cấp 2, đã duyệt và có sự kiện", async () => {
    const created = await submit(requester, "80000000");
    expect(created.status).toBe(201);
    expect(created.body.steps.map((step: { levelNo: number }) => step.levelNo)).toEqual([1, 2]);
    expect(created.body.steps[0].assignedUserId).toBe(people.manager);
    expect((await decide(manager, created.body.id, "approved")).body.currentLevelNo).toBe(2);
    const done = await decide(director, created.body.id, "approved");
    expect(done.body.status).toBe("approved");
    const events = await pool.query("SELECT payload FROM core.outbox_events WHERE event_type = 'core.approval.completed' AND aggregate_id = $1", [created.body.id]);
    expect(events.rows[0].payload.status).toBe("approved");
  });

  it("KICHBAN_KIEMTHU_75: sai cấp hoặc không phải người duyệt bị 403", async () => {
    const created = await submit(requester, "80000000");
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    for (const session of [director, keeper, retailAdmin]) {
      const response = await decide(session, created.body.id, "approved");
      expect([403, 404]).toContain(response.status);
    }
    expect((await requester.call("get", `/approval-requests/${created.body.id}`)).body.currentLevelNo).toBe(1);
  });

  it("KICHBAN_KIEMTHU_76: giá trị quanh ngưỡng 50 triệu, 500 triệu", async () => {
    const counts = [];
    for (const amount of ["49999999", "50000000", "500000000"]) counts.push((await submit(requester, amount)).body.steps.length);
    expect(counts).toEqual([1, 2, 3]);
  });
});

describe("TIEUCHI_NGHIEMTHU_31: ngoại tệ quy đổi theo tỷ giá hạch toán ngày lập", () => {
  it("KICHBAN_KIEMTHU_77, 78, 79", async () => {
    const usd = await submit(requester, "2000", { currency: "USD", documentDate: "2026-11-09" });
    expect(usd.body).toMatchObject({ amountInPolicyCurrency: "52600000.0000", exchangeRate: "26300.00000000" });
    expect(usd.body.steps).toHaveLength(2);
    expect((await submit(requester, "2000", { currency: "USD", documentDate: "2026-11-10" })).body.steps).toHaveLength(2);
    expect((await submit(requester, "1999.99", { currency: "USD", documentDate: "2026-11-10" })).body.steps).toHaveLength(1);
    const missing = await submit(requester, "2000", { currency: "USD", documentDate: "2026-11-11" });
    expect(missing.status).toBe(409);
    expect(missing.body.error.message).toBe("Chưa có tỷ giá hạch toán ngày lập chứng từ.");
  });
});

describe("TIEUCHI_NGHIEMTHU_32: người lập không tự duyệt; trưởng phòng tự lập thì chuyển người thay thế", () => {
  it("KICHBAN_KIEMTHU_80, 81", async () => {
    const own = await submit(manager, "80000000");
    expect(own.body.steps[0]).toMatchObject({ assignedUserId: people.substitute, isSubstitute: true });
    expect(own.body.steps[1].assignedUserId).toBe(people.director);
    expect((await decide(manager, own.body.id, "approved")).status).toBe(403);
    const directorOwn = await submit(director, "80000000");
    expect(directorOwn.body.steps[1]).toMatchObject({ assignedUserId: people.substitute, isSubstitute: true });
  });
});

describe("TIEUCHI_NGHIEMTHU_33: rút lại khi cấp 1 chưa quyết định", () => {
  it("KICHBAN_KIEMTHU_82, 83", async () => {
    const documentId = randomUUID();
    const first = await submit(requester, "80000000", { documentId });
    expect((await submit(requester, "80000000", { documentId })).body.error.message).toBe("Chứng từ đang chờ duyệt.");
    expect((await manager.call("post", `/approval-requests/${first.body.id}/withdraw`)).status).toBe(403);
    const withdrawn = await requester.call("post", `/approval-requests/${first.body.id}/withdraw`);
    expect(withdrawn.body.status).toBe("withdrawn");
    const again = await submit(requester, "80000000", { documentId });
    expect(again.status).toBe(201);
    await decide(manager, again.body.id, "approved");
    const late = await requester.call("post", `/approval-requests/${again.body.id}/withdraw`);
    expect(late.status).toBe(409);
    expect(late.body.error.message).toBe("Không thể rút lại vì đã có cấp duyệt.");
  });
});

describe("TIEUCHI_NGHIEMTHU_34: một cấp từ chối thì bị từ chối, mini app sở hữu nhận sự kiện", () => {
  it("KICHBAN_KIEMTHU_84, 85", async () => {
    const outbox = application.get(OutboxService);
    await outbox.dispatchPending(1000);
    const received: OutboxEvent[] = [];
    const unsubscribe = outbox.subscribe("core.approval.completed", async (event) => void received.push(event));
    const documentId = randomUUID();
    const created = await submit(requester, "80000000", { documentId });
    await decide(manager, created.body.id, "approved");
    const empty = await decide(director, created.body.id, "rejected", "  ");
    expect(empty.status).toBe(400);
    expect(empty.body.error.fields.comment).toBe("Vui lòng nhập lý do từ chối.");
    expect((await decide(director, created.body.id, "rejected", "Giá cao hơn báo giá")).body.status).toBe("rejected");
    await outbox.dispatchPending(1000);
    unsubscribe();
    const mine = received.filter((event) => event.payload.documentId === documentId);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.payload.status).toBe("rejected");
    expect((await decide(director, created.body.id, "approved")).status).toBe(409);
    expect((await submit(requester, "80000000", { documentId })).status).toBe(201);
  });
});

describe("TIEUCHI_NGHIEMTHU_35: hộp duyệt gom chứng từ chờ từ VCR và VCT", () => {
  it("KICHBAN_KIEMTHU_86, 89", async () => {
    await pool.query("UPDATE core.approval_requests SET status = 'withdrawn', current_level_no = NULL WHERE status = 'pending'");
    const first = await submit(requester, "80000000");
    await decide(manager, first.body.id, "approved");
    const second = await submit(requester, "60000000");
    await decide(manager, second.body.id, "approved");
    await submit(requester, "1000000", { companyId: trading });
    const all = await director.call("get", "/approval-requests/inbox");
    expect(all.body).toHaveLength(3);
    expect(all.body.map((item: { requestedAt: string }) => item.requestedAt)).toEqual([...all.body.map((item: { requestedAt: string }) => item.requestedAt)].sort());
    expect((await director.call("get", `/approval-requests/inbox?companyId=${trading}`)).body).toHaveLength(1);
    const unrelated = await signIn(application, "thukho.bd@vcomm.test");
    expect((await unrelated.call("get", "/approval-requests/inbox")).body).toHaveLength(0);
    expect((await unrelated.call("get", `/approval-requests/${first.body.id}`)).status).toBe(404);
    const home = await director.call("get", "/home", { companyId: retail });
    expect(home.body.pendingApprovals.length).toBeGreaterThanOrEqual(2);
  });
});

describe("TIEUCHI_NGHIEMTHU_36: quá 4 giờ nhắc, quá 8 giờ chuyển người thay thế", () => {
  it("KICHBAN_KIEMTHU_90, 91", async () => {
    const service = application.get(ApprovalRequestsService);
    try {
      testClock.fixed = new Date("2026-11-09T08:00:00+07:00");
      const created = await submit(requester, "1000000");
      const reminders = async () => Number((await pool.query("SELECT count(*) FROM core.notifications WHERE user_id = $1 AND kind = 'approval.reminder' AND link = $2", [people.manager, `/hop-duyet/${created.body.id}`])).rows[0].count);
      testClock.fixed = new Date("2026-11-09T11:59:00+07:00");
      await service.processOverdue();
      expect(await reminders()).toBe(0);
      testClock.fixed = new Date("2026-11-09T12:01:00+07:00");
      await service.processOverdue();
      expect(await reminders()).toBe(1);
      expect((await manager.call("get", "/approval-requests/inbox")).body.find((item: { id: string }) => item.id === created.body.id).overdue).toBe(true);
      testClock.fixed = new Date("2026-11-09T12:16:00+07:00");
      await service.processOverdue();
      expect(await reminders()).toBe(1);
      testClock.fixed = new Date("2026-11-09T15:59:00+07:00");
      await service.processOverdue();
      expect((await requester.call("get", `/approval-requests/${created.body.id}`)).body.steps[0].assignedUserId).toBe(people.manager);
      testClock.fixed = new Date("2026-11-09T16:01:00+07:00");
      await service.processOverdue();
      const escalated = await requester.call("get", `/approval-requests/${created.body.id}`);
      expect(escalated.body.steps[0]).toMatchObject({ assignedUserId: people.substitute, isSubstitute: true });
      const told = await pool.query("SELECT user_id FROM core.notifications WHERE link = $1 AND kind IN ('approval.escalated', 'approval.assigned')", [`/hop-duyet/${created.body.id}`]);
      expect(told.rows.map((row) => row.user_id)).toEqual(expect.arrayContaining([people.manager, people.substitute]));
      expect((await pool.query("SELECT 1 FROM core.audit_events WHERE action = 'approval_request.escalate' AND entity_id = $1", [created.body.id])).rows).toHaveLength(1);
      expect((await decide(manager, created.body.id, "approved")).status).toBe(403);
      expect((await decide(substitute, created.body.id, "approved")).body.status).toBe("approved");
    } finally {
      testClock.fixed = null;
    }
  });

  it("KICHBAN_KIEMTHU_92: người thay thế cũng là người lập thì không chuyển, báo quản trị công ty", async () => {
    const service = application.get(ApprovalRequestsService);
    try {
      testClock.fixed = new Date("2026-11-09T08:00:00+07:00");
      const created = await submit(substitute, "1000000");
      const adminNotices = async () => (await pool.query("SELECT 1 FROM core.notifications WHERE user_id = $1 AND kind = 'approval.escalation_blocked' AND link = $2", [testIds.retailAdmin, `/hop-duyet/${created.body.id}`])).rows.length;
      const before = await adminNotices();
      // Thay thế cũng là người lập: giao cho trưởng phòng của người lập không có, nên dùng người thay thế ngay; đặt lại để thử chuyển quá hạn.
      await pool.query("UPDATE core.approval_steps SET assigned_user_id = $1, is_substitute = false WHERE request_id = $2", [people.manager, created.body.id]);
      testClock.fixed = new Date("2026-11-09T16:01:00+07:00");
      await service.processOverdue();
      expect((await substitute.call("get", `/approval-requests/${created.body.id}`)).body.steps[0].assignedUserId).toBe(people.manager);
      expect(await adminNotices()).toBe(before + 1);
    } finally {
      testClock.fixed = null;
    }
  });
});
