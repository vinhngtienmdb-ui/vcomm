// CONG_VIEC_50: báo cáo công nợ theo tuổi nợ (KICHBAN_KIEMTHU_482). Số liệu đối chiếu với sổ công nợ (API_85).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { readSheet } from "read-excel-file/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let today: string;
let external: string;
let internalRetail: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
const report = (query: string, session: Session = groupAdmin) => session.call("get", `/analytics/debts?${query}`, { companyId: retail });
let counter = 0;

async function opening(companyId: string, partnerId: string, side: "receivable" | "payable", direction: "debit" | "credit", amount: string, dueInDays: number | null) {
  counter += 1;
  const created = await groupAdmin.call("post", "/finance/debts/opening", {
    companyId,
    body: {
      partnerId,
      side,
      direction,
      documentNo: `DK-${counter}`,
      documentDate: addDays(today, -120),
      ...(direction === "debit" ? { dueDate: dueInDays === null ? null : addDays(today, dueInDays) } : {}),
      amount,
      note: null,
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const partner = await groupAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Khách công nợ báo cáo", taxCode: "0320005002" } });
  external = partner.body.id;
  internalRetail = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [retail])).rows[0]!.id;
  const internalTrading = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [trading])).rows[0]!.id;
  for (const [companyId, partnerId] of [
    [retail, external],
    [retail, internalTrading],
    [trading, external],
    [trading, internalRetail],
  ] as const) {
    const profile = await groupAdmin.call("put", `/crm/partners/${partnerId}/profile`, {
      companyId,
      body: { isCustomer: true, isSupplier: true, paymentTermDays: 0, creditLimit: null, version: 0 },
    });
    expect(profile.status, JSON.stringify(profile.body)).toBeLessThan(300);
  }
  // Công ty Bán lẻ: khách ngoài quá hạn 45 ngày, chưa đến hạn, trả trước; phải thu công ty Thương mại quá hạn 100 ngày.
  await opening(retail, external, "receivable", "debit", "1000000", -45);
  await opening(retail, external, "receivable", "debit", "500000", 10);
  await opening(retail, internalTrading, "receivable", "debit", "300000", -100);
  await opening(retail, external, "payable", "debit", "250000", -5);
  // Công ty Thương mại: phải trả công ty Bán lẻ, phải thu khách ngoài.
  await opening(trading, internalRetail, "payable", "debit", "300000", -100);
  await opening(trading, external, "receivable", "debit", "700000", -20);
  await opening(trading, external, "receivable", "credit", "100000", null);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_50 công nợ theo tuổi nợ", () => {
  it("KICHBAN_KIEMTHU_482: tuổi nợ từng công ty khớp sổ công nợ; theo đối tác; nội bộ tách cột; thẻ phải thu, phải trả; quyền", async () => {
    const response = await report("side=receivable&groupBy=company");
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    for (const companyId of [retail, trading]) {
      const ledger = (await groupAdmin.call("get", "/finance/debts?side=receivable", { companyId })).body.totals;
      const row = response.body.rows.find((item: { key: string }) => item.key === companyId);
      expect(row).toMatchObject(ledger);
    }
    const retailRow = response.body.rows.find((item: { key: string }) => item.key === retail);
    expect(retailRow).toMatchObject({ balance: "1800000", notDue: "500000", overdue31To60: "1000000", overdueOver90: "300000", internalBalance: "300000", inTotal: true });
    expect(response.body.totals).toMatchObject({ balance: "2400000", internalBalance: "300000", balanceExcludingInternal: "2100000" });
    expect(response.body.summary).toEqual({ receivable: { balance: "2400000", overdue: "1900000" }, payable: { balance: "550000", overdue: "550000" } });

    const partners = await report("side=receivable&groupBy=partner");
    const ledgerPartners = (await groupAdmin.call("get", "/finance/debts?side=receivable", { companyId: retail })).body.partners;
    for (const partner of ledgerPartners) {
      const row = partners.body.rows.find((item: { key: string }) => item.key === `${partner.partnerId}:${retail}`);
      expect(row).toMatchObject({ balance: partner.balance, notDue: partner.notDue, overdueOver90: partner.overdueOver90, advance: partner.advance });
    }
    expect(partners.body.rows[0].label).toContain("(VCR)");

    const payable = await report("side=payable&groupBy=company");
    expect(payable.body.rows.find((item: { key: string }) => item.key === trading)).toMatchObject({ balance: "300000", internalBalance: "300000", overdueOver90: "300000" });

    // Xuất Excel đúng số trên màn hình, ghi nhật ký.
    const file = await groupAdmin
      .call("get", "/analytics/debts?side=receivable&groupBy=company&format=xlsx", { companyId: retail })
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(file.status).toBe(200);
    const sheet = (await readSheet(file.body as Buffer)) as (string | number | null)[][];
    expect(sheet.find((row) => row[0] === "Cộng các công ty")?.[2]).toBe(2400000);
    expect(sheet.find((row) => row[0] === "Tổng loại trừ nội bộ")?.[2]).toBe(2100000);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE action = 'analytics.debt.export'")).rows[0].total).toBe(1);

    // Quản trị công ty chỉ xem công ty mình; nhân viên bán hàng không có quyền công nợ.
    const companyAdmin = await signIn(application, "quantri.vcr@vcomm.test");
    const own = await report("side=receivable", companyAdmin);
    expect(own.body.rows.map((item: { key: string }) => item.key)).toEqual([retail]);
    expect(own.body.summary.receivable).toEqual({ balance: "1800000", overdue: "1300000" });
    expect((await report(`side=receivable&companyIds=${trading}`, companyAdmin)).status).toBe(403);
  });
});
