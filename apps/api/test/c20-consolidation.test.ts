// CONG_VIEC_20: Báo cáo tài chính hợp nhất (KICHBAN_KIEMTHU_270 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let companyChief: Session;
let groupChief: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;

async function chief(email: string, scope: "group" | "company") {
  const id = await createTestUser(pool, email, "Kế toán trưởng", [{ companyId: retail }, { companyId: trading }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'chief_accountant' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, $3, $4, '2026-01-01')", [
    id,
    roleId,
    scope,
    scope === "group" ? null : retail,
  ]);
  return signIn(application, email);
}
const as = (session: Session, companyId: string, method: "get" | "post", path: string, body?: unknown) => session.call(method, path, { companyId, body });
async function accountId(companyId: string, code: string): Promise<string> {
  return (await pool.query<{ id: string }>("SELECT id FROM accounting.accounts WHERE company_id = $1 AND code = $2", [companyId, code])).rows[0]!.id;
}
async function journal(companyId: string, date: string, lines: [string, string, string, string?][]) {
  const body = {
    journalDate: date,
    description: "Thử hợp nhất",
    lines: await Promise.all(lines.map(async ([code, debit, credit, partnerId]) => ({ accountId: await accountId(companyId, code), debit, credit, partnerId: partnerId ?? null }))),
  };
  const created = await as(groupAdmin, companyId, "post", "/finance/journals", body);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const posted = await as(groupAdmin, companyId, "post", `/finance/journals/${created.body.id}/submit`, { version: created.body.version });
  expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
}
type Report = { lines: { code: string; combined: string; eliminations: string; consolidated: string; previous: string }[]; memberNames: string[]; form: string; currency: string };
const value = (report: Report, code: string) => report.lines.find((line) => line.code === code)!;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  companyChief = await chief("ketoantruong.cty@vcomm.test", "company");
  groupChief = await chief("ketoantruong.td@vcomm.test", "group");
  // Công ty thương mại theo Thông tư 133.
  await pool.query("UPDATE core.companies SET accounting_regime = 'TT133' WHERE id = $1", [trading]);
  for (const company of [retail, trading]) expect((await as(groupAdmin, company, "post", "/finance/ledger/setup")).status).toBe(201);
});

afterAll(async () => {
  await application?.close();
});

describe("CONG_VIEC_20 phạm vi hợp nhất", () => {
  it("KICHBAN_KIEMTHU_270: chỉ người có quyền ở phạm vi tập đoàn; thành viên và lý do bị loại", async () => {
    expect((await as(companyChief, retail, "get", "/finance/consolidation/scope")).status).toBe(403);
    const scope = await as(groupChief, retail, "get", "/finance/consolidation/scope");
    expect(scope.status, JSON.stringify(scope.body)).toBe(200);
    expect(scope.body).toMatchObject({ group: { id: testIds.groupCompany }, currency: "VND", canManage: true });
    expect(
      scope.body.members.map((member: { companyId: string; isRoot: boolean; excludedReason: string | null; regime: string }) => [
        member.companyId,
        member.isRoot,
        member.excludedReason,
        member.regime,
      ]),
    ).toEqual([
      [testIds.groupCompany, true, "ledger_not_initialized", "TT99_2025"],
      [retail, false, null, "TT99_2025"],
      [trading, false, null, "TT133"],
    ]);
    // Công ty khác đồng tiền bị loại.
    await pool.query("UPDATE core.companies SET base_currency = 'USD' WHERE id = $1", [testIds.groupCompany]);
    const other = await as(groupChief, trading, "get", "/finance/consolidation/scope");
    expect(other.body.currency).toBe("USD");
    expect(other.body.members.filter((member: { excludedReason: string | null }) => member.excludedReason === "other_currency")).toHaveLength(2);
    await pool.query("UPDATE core.companies SET base_currency = 'VND' WHERE id = $1", [testIds.groupCompany]);
  });

  it("KICHBAN_KIEMTHU_271: cộng gộp B01-DN, B02-DN theo mã Thông tư 99; Thông tư 133 ghép 6421 vào 641", async () => {
    await journal(retail, "2026-10-01", [
      ["111", "1000000", "0"],
      ["41111", "0", "1000000"],
    ]);
    await journal(trading, "2026-10-01", [
      ["1121", "500000", "0"],
      ["4111", "0", "500000"],
    ]);
    await journal(trading, "2026-10-15", [
      ["6421", "50000", "0"],
      ["1121", "0", "50000"],
    ]);
    await journal(retail, "2026-10-20", [
      ["6418", "20000", "0"],
      ["111", "0", "20000"],
    ]);
    const balance = await as(groupChief, retail, "get", "/finance/consolidation/preview?kind=balance_sheet&from=2026-10-01&to=2026-10-31");
    expect(balance.status, JSON.stringify(balance.body)).toBe(200);
    const sheet = balance.body as Report;
    expect(sheet).toMatchObject({ form: "B01-DN", currency: "VND", memberNames: ["VComm Bán lẻ Miền Nam", "VComm Thương mại"] });
    expect(value(sheet, "110")).toMatchObject({ combined: "1430000", eliminations: "0", consolidated: "1430000" });
    expect(value(sheet, "280").combined).toBe(value(sheet, "440").combined);
    const income = (await as(groupChief, retail, "get", "/finance/consolidation/preview?kind=income_statement&from=2026-10-01&to=2026-10-31")).body as Report;
    expect(value(income, "25").combined).toBe("70000");
    expect((await as(groupChief, retail, "get", "/finance/consolidation/preview?kind=income_statement&from=2026-10-31&to=2026-10-01")).status).toBe(400);
    expect((await as(companyChief, retail, "get", "/finance/consolidation/preview?kind=balance_sheet&from=2026-10-01&to=2026-10-31")).status).toBe(403);
    // Báo cáo từng công ty không đổi.
    const own = (await as(groupAdmin, trading, "get", "/finance/statements?kind=income_statement&from=2026-10-01&to=2026-10-31")).body as { lines: { code: string; current: string }[] };
    expect(own.lines.length).toBeGreaterThan(0);
  });
});

describe("CONG_VIEC_20 trả trước nội bộ, số dư ngược chiều", () => {
  it("KICHBAN_KIEMTHU_277: trả trước giữa hai công ty được loại trừ; số dư ngược chiều của hai công ty không bù trừ nhau khi cộng gộp", async () => {
    const partnerOf = async (companyId: string) => (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [companyId])).rows[0]!.id;
    const profile = async (companyId: string, partnerId: string, body: Record<string, unknown>) => {
      const saved = await groupAdmin.call("put", `/crm/partners/${partnerId}/profile`, {
        companyId,
        body: { isCustomer: false, isSupplier: false, paymentTermDays: 30, creditLimit: null, version: 0, ...body },
      });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    };
    await profile(retail, await partnerOf(trading), { isCustomer: true });
    await profile(trading, await partnerOf(retail), { isSupplier: true });
    // VCT góp thêm vốn để tiền không âm.
    await journal(trading, "2026-11-01", [
      ["1121", "1000000", "0"],
      ["4111", "0", "1000000"],
    ]);
    // VCT ứng trước cho VCR 500.000: VCR dư Có 131 (đối tác VCT), VCT dư Nợ 331 (đối tác VCR).
    await journal(retail, "2026-11-05", [
      ["111", "500000", "0"],
      ["131", "0", "500000", await partnerOf(trading)],
    ]);
    await journal(trading, "2026-11-05", [
      ["331", "500000", "0", await partnerOf(retail)],
      ["1121", "0", "500000"],
    ]);
    // Thuế: VCR còn phải nộp 100.000 (dư Có), VCT nộp thừa 30.000 (dư Nợ).
    await journal(retail, "2026-11-06", [
      ["111", "100000", "0"],
      ["33311", "0", "100000"],
    ]);
    await journal(trading, "2026-11-06", [
      ["33311", "30000", "0"],
      ["1121", "0", "30000"],
    ]);
    const created = await as(groupChief, retail, "post", "/finance/consolidation", { from: "2026-11-01", to: "2026-11-30" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const advance = created.body.entries.find((entry: { description: string }) => entry.description.startsWith("Loại trừ trả trước"));
    expect(advance.lines.map((item: { accountCode: string; debit: string; credit: string }) => [item.accountCode, item.debit, item.credit])).toEqual([
      ["131", "500000", "0"],
      ["331", "0", "500000"],
    ]);
    expect(created.body.warnings).toEqual([]);
    const sheet = created.body.balanceSheet as Report;
    // Người mua trả tiền trước (312), trả trước cho người bán (132) về 0 sau loại trừ.
    expect(value(sheet, "312")).toMatchObject({ combined: "500000", consolidated: "0" });
    expect(value(sheet, "132")).toMatchObject({ combined: "500000", consolidated: "0" });
    // Thuế phải nộp 100.000 và thuế nộp thừa 30.000 giữ riêng.
    expect(value(sheet, "314").combined).toBe("100000");
    expect(value(sheet, "163").combined).toBe("30000");
    expect(value(sheet, "280").consolidated).toBe(value(sheet, "440").consolidated);
  });
});
