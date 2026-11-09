// KICHBAN_KIEMTHU cho TIEUCHI_NGHIEMTHU_37 đến 41, 43, 44 (tài liệu 21, lát L8).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { AuditEventsService } from "../src/settings/audit-events.service";
import { NumberSequencesService } from "../src/settings/number-sequences.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let rateManager: Session;
let employee: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const documentType = "platform.test_document";
let employeeRole: string;

async function newEmployee(email: string, name: string, companies: string[]): Promise<string> {
  const id = await createTestUser(
    pool,
    email,
    name,
    companies.map((companyId) => ({ companyId })),
  );
  for (const companyId of companies) {
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, employeeRole, companyId]);
  }
  return id;
}

const auditOf = async (session: Session, query: string, companyId = retail) => (await session.call("get", `/audit-events?${query}`, { companyId })).body;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  employeeRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  rateManager = await signIn(application, "tygia@vcomm.test");
  employee = await signIn(application, "phuc.le@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("API_43, API_44: dãy số chứng từ", () => {
  it("chưa cấu hình thì không có số kế tiếp; tiền tố sai bị từ chối; nhân viên không có quyền", async () => {
    const list = await retailAdmin.call("get", "/number-sequences", {
      companyId: retail,
    });
    expect(list.status).toBe(200);
    expect(list.body.find((item: { documentTypeCode: string }) => item.documentTypeCode === documentType)).toMatchObject({ configured: false, nextNumber: null });
    const wrong = await retailAdmin.call("patch", `/number-sequences/${documentType}`, {
      companyId: retail,
      body: { prefix: "ct-1", resetPeriod: "year", padding: 6 },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields).toEqual({
      prefix: "Tiền tố chỉ gồm chữ in hoa và chữ số.",
    });
    expect((await employee.call("get", "/number-sequences", { companyId: retail })).status).toBe(403);
    expect(
      (
        await retailAdmin.call("patch", "/number-sequences/platform.khong_co", {
          companyId: retail,
          body: { prefix: "CT", resetPeriod: "year", padding: 6 },
        })
      ).status,
    ).toBe(404);
  });

  it("cấu hình dãy số thì thấy số kế tiếp dạng tiền tố – mã công ty – kỳ – số thứ tự", async () => {
    const saved = await retailAdmin.call("patch", `/number-sequences/${documentType}`, {
      companyId: retail,
      body: { prefix: "CTT", resetPeriod: "year", padding: 6 },
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      configured: true,
      prefix: "CTT",
      resetPeriod: "year",
      padding: 6,
    });
    expect(saved.body.nextNumber).toMatch(/^CTT-VCR-\d{4}-000001$/);
  });

  it("TIEUCHI_NGHIEMTHU_39: 50 lần lưu song song nhận 50 số liên tiếp, không trùng", async () => {
    const service = application.get(NumberSequencesService);
    const database = application.get<Database>(DATABASE);
    const numbers = await Promise.all(Array.from({ length: 50 }, () => database.transaction((transaction) => service.next(retail, documentType, transaction))));
    const sequence = numbers.map((value) => Number(value.slice(-6))).sort((first, second) => first - second);
    expect(new Set(numbers).size).toBe(50);
    expect(sequence).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
  });

  it("TIEUCHI_NGHIEMTHU_40: lưu chứng từ lỗi thì số không bị dùng; chứng từ sau nhận đúng số đó", async () => {
    const service = application.get(NumberSequencesService);
    const database = application.get<Database>(DATABASE);
    let lost = "";
    await expect(
      database.transaction(async (transaction) => {
        lost = await service.next(retail, documentType, transaction);
        throw new Error("Lưu chứng từ lỗi");
      }),
    ).rejects.toThrow("Lưu chứng từ lỗi");
    const next = await database.transaction((transaction) => service.next(retail, documentType, transaction));
    expect(lost).toMatch(/-000051$/);
    expect(next).toBe(lost);
  });

  it("đổi tiền tố chỉ áp dụng cho số cấp sau đó; công ty chưa cấu hình thì báo lỗi", async () => {
    await retailAdmin.call("patch", `/number-sequences/${documentType}`, {
      companyId: retail,
      body: { prefix: "PT", resetPeriod: "year", padding: 5 },
    });
    const service = application.get(NumberSequencesService);
    const database = application.get<Database>(DATABASE);
    expect(await database.transaction((transaction) => service.next(retail, documentType, transaction))).toMatch(/^PT-VCR-\d{4}-00052$/);
    await expect(database.transaction((transaction) => service.next(trading, documentType, transaction))).rejects.toMatchObject({ messageKey: "numberSequenceMissing" });
  });
});

describe("API_45, API_46: tiền tệ và tỷ giá", () => {
  it("mọi nhân viên xem được; thấy cảnh báo tiền tệ chưa có tỷ giá hạch toán", async () => {
    const currencies = await employee.call("get", "/currencies", {
      companyId: retail,
    });
    expect(currencies.body.map((currency: { code: string }) => currency.code)).toEqual(["VND", "CNY", "EUR", "USD"]);
    const rates = await employee.call("get", "/exchange-rates?date=2026-11-09", { companyId: retail });
    expect(rates.status).toBe(200);
    expect(rates.body).toMatchObject({
      date: "2026-11-09",
      baseCurrency: "VND",
      canManage: false,
      missingAccounting: ["CNY", "EUR", "USD"],
    });
  });

  it("nhân viên không có quyền thì không nhập được; tỷ giá phải lớn hơn 0", async () => {
    const body = {
      rateDate: "2026-11-09",
      fromCurrency: "USD",
      toCurrency: "VND",
      rateType: "accounting",
      source: "manual",
      rate: "26300",
    };
    expect(
      (
        await employee.call("post", "/exchange-rates", {
          companyId: retail,
          body,
        })
      ).status,
    ).toBe(403);
    const zero = await rateManager.call("post", "/exchange-rates", {
      body: { ...body, rate: "0.000" },
    });
    expect(zero.status).toBe(400);
    expect(zero.body.error.fields).toEqual({ rate: "Tỷ giá phải lớn hơn 0." });
    const same = await rateManager.call("post", "/exchange-rates", {
      body: { ...body, toCurrency: "USD" },
    });
    expect(same.body.error.fields).toEqual({
      toCurrency: "Tiền tệ nguồn và tiền tệ đích phải khác nhau.",
    });
  });

  it("TIEUCHI_NGHIEMTHU_41: nhập trùng ngày, cặp tiền tệ, loại, nguồn thì bị từ chối", async () => {
    const body = {
      rateDate: "2026-11-09",
      fromCurrency: "USD",
      toCurrency: "VND",
      rateType: "accounting",
      source: "manual",
      rate: "26300.5",
    };
    const first = await rateManager.call("post", "/exchange-rates", { body });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ rate: "26300.5", source: "manual" });
    const again = await rateManager.call("post", "/exchange-rates", {
      body: { ...body, rate: "26400" },
    });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe("Đã có tỷ giá cho ngày, cặp tiền tệ, loại và nguồn này.");
    // Khác nguồn hoặc khác loại thì được nhập.
    expect(
      (
        await rateManager.call("post", "/exchange-rates", {
          body: { ...body, source: "vietcombank" },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await rateManager.call("post", "/exchange-rates", {
          body: { ...body, rateType: "sell" },
        })
      ).status,
    ).toBe(201);
    const listed = await employee.call("get", "/exchange-rates?date=2026-11-09", { companyId: retail });
    expect(listed.body.data).toHaveLength(3);
    expect(listed.body.missingAccounting).toEqual(["CNY", "EUR"]);
  });

  it("sửa tỷ giá ghi nhật ký trước và sau", async () => {
    const created = await rateManager.call("post", "/exchange-rates", {
      body: {
        rateDate: "2026-11-10",
        fromCurrency: "EUR",
        toCurrency: "VND",
        rateType: "accounting",
        source: "manual",
        rate: "28540",
      },
    });
    const updated = await rateManager.call("patch", `/exchange-rates/${created.body.id}`, { body: { rate: "28600" } });
    expect(updated.status).toBe(200);
    expect(updated.body.rate).toBe("28600");
    expect(
      (
        await rateManager.call("patch", `/exchange-rates/${created.body.id}`, {
          body: { rate: "-1" },
        })
      ).status,
    ).toBe(400);
    const audit = await auditOf(groupAdmin, `action=exchange_rate.update&entityId=${created.body.id}`, testIds.groupCompany);
    expect(audit.total).toBe(1);
    const detail = await groupAdmin.call("get", `/audit-events/${audit.data[0].id}`, { companyId: testIds.groupCompany });
    expect(detail.body.beforeData).toMatchObject({ rate: "28540" });
    expect(detail.body.afterData).toMatchObject({ rate: "28600" });
  });
});

describe("API_31, API_32: vô hiệu hóa và bàn giao", () => {
  let leaving: string;
  let leavingSession: Session;
  let receiver: string;
  let departmentId: string;
  let requestId: string;

  beforeAll(async () => {
    leaving = await newEmployee("nghiviec.vcr@vcomm.test", "Võ Văn Nghỉ", [retail]);
    receiver = await newEmployee("nhanviec.vcr@vcomm.test", "Lý Thị Nhận", [retail]);
    const policy = await retailAdmin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: documentType,
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [
          {
            levelNo: 1,
            minAmount: "0",
            approver: { type: "user", userId: leaving },
            substitute: { type: "user", userId: receiver },
            dueHours: 4,
          },
        ],
      },
    });
    expect(policy.status).toBe(201);
    const submitted = await employee.call("post", "/approval-requests", {
      companyId: retail,
      body: {
        documentTypeCode: documentType,
        documentId: randomUUID(),
        documentNo: "CT-NGHIVIEC-1",
        amount: "1000000",
        currency: "VND",
        documentDate: "2026-11-09",
      },
    });
    expect(submitted.status).toBe(201);
    requestId = submitted.body.id;
    const department = await retailAdmin.call("post", "/departments", {
      companyId: retail,
      body: { code: "PB-NV", name: "Phòng Nghỉ việc", managerUserId: leaving },
    });
    departmentId = department.body.id;
    leavingSession = await signIn(application, "nghiviec.vcr@vcomm.test");
  });

  it("API_31 liệt kê chứng từ chờ duyệt và phòng ban đang làm trưởng phòng", async () => {
    const handover = await retailAdmin.call("get", `/users/${leaving}/handover`, { companyId: retail });
    expect(handover.status).toBe(200);
    expect(handover.body.pendingApprovalSteps).toHaveLength(1);
    expect(handover.body.pendingApprovalSteps[0]).toMatchObject({
      requestId,
      documentNo: "CT-NGHIVIEC-1",
      levelNo: 1,
    });
    expect(handover.body.managedDepartments).toEqual([{ id: departmentId, code: "PB-NV", name: "Phòng Nghỉ việc" }]);
    expect(
      (
        await employee.call("get", `/users/${leaving}/handover`, {
          companyId: retail,
        })
      ).status,
    ).toBe(403);
  });

  it("TIEUCHI_NGHIEMTHU_37: chưa chọn người nhận bàn giao thì không vô hiệu hóa được", async () => {
    const step = (
      await retailAdmin.call("get", `/users/${leaving}/handover`, {
        companyId: retail,
      })
    ).body.pendingApprovalSteps[0].id;
    const none = await retailAdmin.call("post", `/users/${leaving}/deactivate`, { companyId: retail, body: { reason: "Nghỉ việc" } });
    expect(none.status).toBe(409);
    expect(none.body.error.message).toBe("Cần chọn người nhận bàn giao trước khi vô hiệu hóa.");
    const partial = await retailAdmin.call("post", `/users/${leaving}/deactivate`, {
      companyId: retail,
      body: {
        reason: "Nghỉ việc",
        handover: [{ kind: "approval_step", itemId: step, toUserId: receiver }],
      },
    });
    expect(partial.status).toBe(409);
    // Người lập chứng từ không nhận được việc duyệt chứng từ của chính mình.
    const toRequester = await retailAdmin.call("post", `/users/${leaving}/deactivate`, {
      companyId: retail,
      body: {
        reason: "Nghỉ việc",
        handover: [
          {
            kind: "approval_step",
            itemId: step,
            toUserId: testIds.purchasingManager,
          },
          {
            kind: "department_manager",
            itemId: departmentId,
            toUserId: receiver,
          },
        ],
      },
    });
    expect(toRequester.status).toBe(400);
    expect(toRequester.body.error.fields).toHaveProperty("handover.0.toUserId");
    expect((await retailAdmin.call("post", `/users/${testIds.retailAdmin}/deactivate`, { companyId: retail, body: { reason: "Thử" } })).status).toBe(403);
    expect((await pool.query("SELECT status FROM core.users WHERE id = $1", [leaving])).rows[0].status).toBe("active");
    expect((await leavingSession.call("get", "/me")).status).toBe(200);
  });

  it("TIEUCHI_NGHIEMTHU_38: vô hiệu hóa kèm bàn giao; mọi phiên cũ hết hiệu lực ngay", async () => {
    const step = (
      await retailAdmin.call("get", `/users/${leaving}/handover`, {
        companyId: retail,
      })
    ).body.pendingApprovalSteps[0].id;
    const done = await retailAdmin.call("post", `/users/${leaving}/deactivate`, {
      companyId: retail,
      body: {
        reason: "Nghỉ việc từ 30/11/2026",
        handover: [
          { kind: "approval_step", itemId: step, toUserId: receiver },
          {
            kind: "department_manager",
            itemId: departmentId,
            toUserId: receiver,
          },
        ],
      },
    });
    expect(done.status).toBe(200);
    expect(done.body).toEqual({
      id: leaving,
      status: "disabled",
      remainingCompanies: 0,
    });
    expect((await leavingSession.call("get", "/me")).status).toBe(401);
    expect((await pool.query("SELECT assigned_user_id FROM core.approval_steps WHERE id = $1", [step])).rows[0].assigned_user_id).toBe(receiver);
    expect((await pool.query("SELECT manager_user_id FROM core.departments WHERE id = $1", [departmentId])).rows[0].manager_user_id).toBe(receiver);
    expect((await pool.query("SELECT 1 FROM core.notifications WHERE user_id = $1 AND kind = 'approval.assigned' AND link = $2", [receiver, `/hop-duyet/${requestId}`])).rows).toHaveLength(1);
    expect((await pool.query("SELECT 1 FROM core.outbox_events WHERE event_type = 'core.user.disabled' AND aggregate_id = $1", [leaving])).rows).toHaveLength(1);
    const login = await (await import("supertest")).default(application.getHttpServer()).post("/api/v1/auth/login").send({
      identifier: "nghiviec.vcr@vcomm.test",
      password: "MatKhauThu@2026",
    });
    expect(login.status).not.toBe(200);
    // Người nhận thấy chứng từ trong hộp duyệt.
    const receiverSession = await signIn(application, "nhanviec.vcr@vcomm.test");
    const inbox = await receiverSession.call("get", "/approval-requests/inbox", { companyId: retail });
    expect(inbox.body.map((item: { id: string }) => item.id)).toContain(requestId);
  });

  it("nhân viên thuộc nhiều công ty: vô hiệu hóa ở một công ty chỉ gỡ khỏi công ty đó", async () => {
    const both = await newEmployee("haicongty@vcomm.test", "Đỗ Văn Hai", [retail, trading]);
    const session = await signIn(application, "haicongty@vcomm.test");
    const done = await retailAdmin.call("post", `/users/${both}/deactivate`, {
      companyId: retail,
      body: { reason: "Chuyển sang VCT" },
    });
    expect(done.body).toEqual({
      id: both,
      status: "active",
      remainingCompanies: 1,
    });
    const me = await session.call("get", "/me");
    expect(me.status).toBe(200);
    expect(me.body.companies.map((company: { id: string }) => company.id)).toEqual([trading]);
    expect((await session.call("get", "/home", { companyId: retail })).status).toBe(403);
    expect((await retailAdmin.call("get", `/users/${both}`, { companyId: retail })).status).toBe(404);
  });
});

describe("API_33: đặt lại xác thực hai lớp", () => {
  it("quản trị đặt lại cho nhân viên; nhân viên phải thiết lập lại; không tự đặt lại cho mình", async () => {
    // Quản trị VCR đã thiết lập xác thực hai lớp khi đăng nhập ở đầu tệp.
    expect((await groupAdmin.call("get", `/users/${testIds.retailAdmin}`, { companyId: retail })).body.mfaEnabled).toBe(true);
    expect((await groupAdmin.call("post", `/users/${testIds.groupAdmin}/mfa/reset`, { companyId: retail })).status).toBe(403);
    expect(
      (
        await employee.call("post", `/users/${testIds.retailAdmin}/mfa/reset`, {
          companyId: retail,
        })
      ).status,
    ).toBe(403);
    const reset = await groupAdmin.call("post", `/users/${testIds.retailAdmin}/mfa/reset`, { companyId: retail });
    expect(reset.status).toBe(204);
    expect((await pool.query("SELECT 1 FROM core.mfa_factors WHERE user_id = $1", [testIds.retailAdmin])).rows).toHaveLength(0);
    expect((await retailAdmin.call("get", "/me")).status).toBe(401);
    expect((await groupAdmin.call("post", `/users/${testIds.retailAdmin}/mfa/reset`, { companyId: retail })).status).toBe(409);
    const login = await (await import("supertest")).default(application.getHttpServer()).post("/api/v1/auth/login").send({
      identifier: "quantri.vcr@vcomm.test",
      password: "MatKhauThu@2026",
    });
    expect(login.body).toMatchObject({ mfaRequired: true, mfaEnrolled: false });
    retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  });
});

describe("API_47: nhật ký thao tác", () => {
  it("đăng nhập thất bại cũng có dòng nhật ký; chỉ quản trị tập đoàn thấy", async () => {
    const server = (await import("supertest")).default(application.getHttpServer());
    expect((await server.post("/api/v1/auth/login").send({ identifier: "khongton.tai@vcomm.test", password: "sai-mat-khau" })).status).toBe(401);
    const failed = await auditOf(groupAdmin, "action=login.failed", testIds.groupCompany);
    expect(failed.data[0]).toMatchObject({ actorUserId: null, entityLabel: "khongton.tai@vcomm.test" });
    expect((await auditOf(retailAdmin, "action=login.failed")).total).toBe(0);
  });

  it("TIEUCHI_NGHIEMTHU_43: các thao tác ghi trên đều có dòng nhật ký với dữ liệu trước và sau", async () => {
    for (const action of ["number_sequence.update", "user.deactivate"]) {
      const listed = await auditOf(retailAdmin, `action=${action}`);
      expect(listed.total).toBeGreaterThan(0);
      const detail = (
        await retailAdmin.call("get", `/audit-events/${listed.data[0].id}`, {
          companyId: retail,
        })
      ).body;
      expect(detail.beforeData).not.toBeNull();
      expect(detail.afterData).not.toBeNull();
      if (action === "number_sequence.update") {
        expect(detail.entityLabel).toBe("Chứng từ thử");
        expect(detail.beforeData).toEqual({ documentTypeCode: documentType, prefix: "CTT", resetPeriod: "year", padding: 6 });
      }
      expect(detail.actorName).toBe("Trần Minh Quân");
    }
    const created = await auditOf(groupAdmin, "action=exchange_rate.create", testIds.groupCompany);
    expect(created.total).toBe(4);
    expect(created.data[0].entityLabel).toMatch(/→ VND/);
    const reset = await auditOf(groupAdmin, "action=user.mfa.reset", retail);
    expect(reset.data[0]).toMatchObject({
      entityId: testIds.retailAdmin,
      entityLabel: "Trần Minh Quân",
      actorName: "Nguyễn Thị Hồng Nhung",
    });
  });

  it("lọc theo người làm, đối tượng, khoảng thời gian; có phân trang", async () => {
    const mine = await auditOf(retailAdmin, `actorUserId=${testIds.retailAdmin}&pageSize=2`);
    expect(mine.data).toHaveLength(2);
    expect(mine.total).toBeGreaterThan(2);
    expect(mine.data.every((item: { actorUserId: string }) => item.actorUserId === testIds.retailAdmin)).toBe(true);
    expect((await auditOf(retailAdmin, "from=2030-01-01")).total).toBe(0);
    expect(
      (
        await retailAdmin.call("get", "/audit-events?pageSize=500", {
          companyId: retail,
        })
      ).status,
    ).toBe(400);
  });

  it("TIEUCHI_NGHIEMTHU_44: không có API sửa, xóa nhật ký; quản trị VCR không xem được nhật ký VCT", async () => {
    const branch = await groupAdmin.call("post", "/branches", {
      companyId: trading,
      body: {
        code: "VCT-HN",
        name: "Chi nhánh Hà Nội",
        branchType: "office",
        provinceCode: "01",
      },
    });
    expect(branch.status).toBe(201);
    const fromGroup = await auditOf(groupAdmin, `entityId=${branch.body.id}`, trading);
    expect(fromGroup.total).toBe(1);
    const eventId = fromGroup.data[0].id;
    expect((await auditOf(retailAdmin, `entityId=${branch.body.id}`)).total).toBe(0);
    expect(
      (
        await retailAdmin.call("get", `/audit-events/${eventId}`, {
          companyId: retail,
        })
      ).status,
    ).toBe(404);
    expect((await retailAdmin.call("get", "/audit-events", { companyId: trading })).status).toBe(403);
    for (const method of ["patch", "put", "delete"] as const) {
      expect(
        (
          await groupAdmin.call(method, `/audit-events/${eventId}`, {
            companyId: trading,
            body: {},
          })
        ).status,
      ).toBe(404);
    }
    expect((await employee.call("get", "/audit-events", { companyId: retail })).status).toBe(403);
  });

  it("tạo trước partition nhật ký cho tháng sau", async () => {
    const created = await application.get(AuditEventsService).ensurePartitions("2027-01-15");
    expect(created).toEqual(["audit_events_2027_01", "audit_events_2027_02", "audit_events_2027_03"]);
    await pool.query("INSERT INTO core.audit_events (occurred_at, app_code, action, entity_type) VALUES ('2027-02-10T00:00:00Z', 'platform', 'test', 'test')");
    expect(await application.get(AuditEventsService).ensurePartitions("2027-01-20")).toEqual([]);
  });
});

describe("API_48: thông báo", () => {
  it("chỉ thấy và đánh dấu đã đọc thông báo của chính mình", async () => {
    const receiver = await signIn(application, "nhanviec.vcr@vcomm.test");
    const listed = await receiver.call("get", "/notifications");
    expect(listed.status).toBe(200);
    expect(listed.body.unreadCount).toBeGreaterThan(0);
    const item = listed.body.data.find((notification: { kind: string }) => notification.kind === "approval.assigned");
    expect(item.payload).toMatchObject({ documentNo: "CT-NGHIVIEC-1" });
    expect((await employee.call("post", `/notifications/${item.id}/read`)).status).toBe(404);
    expect((await receiver.call("post", `/notifications/${item.id}/read`)).status).toBe(204);
    const after = await receiver.call("get", "/notifications");
    expect(after.body.unreadCount).toBe(listed.body.unreadCount - 1);
    expect(after.body.data.find((notification: { id: string }) => notification.id === item.id).readAt).not.toBeNull();
  });
});
