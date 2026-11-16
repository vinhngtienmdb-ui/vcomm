// CONG_VIEC_60 L4: báo cáo liên minh điểm khớp sổ điểm, sổ cái, bảng đối soát; báo cáo gian lận khớp vụ việc; xuất Excel; phân quyền
// (KICHBAN_KIEMTHU_621; TIEUCHI_NGHIEMTHU_442).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { readSheet } from "read-excel-file/node";
import type request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { deviceHashOf } from "../src/loyalty/fraud";
import { LoyaltyLedgerService } from "../src/loyalty/ledger.service";
import { LoyaltySettlementsService } from "../src/loyalty/settlements.service";
import { signIn, type Session } from "./helpers";
import { prepareMarketplace, retail, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let database: Database;
let ledger: LoyaltyLedgerService;
let group: Session;
let buyerId: string;
const trading = testIds.tradingCompany;
let year: number;
let month: string;

const firstOfNextMonth = (day: string) => {
  const value = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
};
const download = (test: request.Test) =>
  test.buffer(true).parse((response, callback) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => callback(null, Buffer.concat(chunks)));
  });
const redeem = (companyId: string, points: number, deviceHash: string | null = null) =>
  database.transaction((transaction) =>
    ledger.redeemWithin(transaction, { userId: buyerId, companyId, sourceType: "retail_sale", sourceId: randomUUID(), day: store.today, goodsAmount: 1000000, points, deviceHash }),
  );
const earn = (companyId: string, goodsAmount: number) =>
  database.transaction((transaction) => ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: randomUUID(), userId: buyerId, companyId, day: store.today, goodsAmount }));

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  database = application.get(DATABASE);
  ledger = application.get(LoyaltyLedgerService);
  year = Number(store.today.slice(0, 4));
  month = store.today.slice(0, 7);
  expect((await store.call("post", "/finance/ledger/setup")).status).toBe(201);
  group = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await group.call("post", "/finance/ledger/setup", { companyId: trading })).status).toBe(201);
  const phase = {
    startsOn: store.today,
    endsOn: null,
    earnPercent: "2",
    pointValue: "1",
    redeemMaxPercent: "50",
    redeemMinPoints: 1000,
    validityMonths: 12,
    orderCapPoints: null,
    monthlyCapPoints: null,
  };
  expect((await store.call("post", "/loyalty/phases", phase)).status).toBe(201);
  buyerId = await store.register("0939600301", "Khách Báo Cáo Liên Minh");
  // Công ty con: tích 20.000, dùng 5.000; công ty vận hành sàn: tích 10.000.
  await earn(trading, 1000000);
  await redeem(trading, 5000);
  await earn(retail, 500000);
  await application.get(LoyaltySettlementsService).buildMonthly(firstOfNextMonth(store.today));
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_60 báo cáo liên minh và gian lận", () => {
  it("KICHBAN_KIEMTHU_621: báo cáo liên minh khớp sổ điểm, sổ cái và bảng đối soát; công ty con chỉ thấy dòng của mình; xuất Excel", async () => {
    const report = (await store.call("get", `/loyalty/reports/alliance?year=${year}`)).body;
    expect(report.isOperator).toBe(true);
    const rows = report.rows.filter((row: { month: string }) => row.month === month);
    const operatorRow = rows.find((row: { companyId: string }) => row.companyId === retail);
    const tradingRow = rows.find((row: { companyId: string }) => row.companyId === trading);
    expect(operatorRow).toMatchObject({ isOperator: true, earnedPoints: 10000, lotValue: "10000", redeemedPoints: 0, settlementId: null, receivable: null, remaining: null });
    expect(tradingRow).toMatchObject({ isOperator: false, earnedPoints: 20000, lotValue: "20000", redeemedPoints: 5000, redeemedAmount: "5000" });
    // Chi phí điểm từng công ty khớp sổ cái (vai trò chi phí điểm, bút toán điểm của tháng).
    const cost = async (companyId: string) =>
      (
        await pool.query(
          `SELECT coalesce(sum(l.debit - l.credit), 0)::float AS amount FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
           JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role = 'loyalty_expense'
           WHERE j.company_id = $1 AND j.status = 'posted' AND j.source_type IN ('loyalty_entry', 'loyalty_seller_entry')`,
          [companyId],
        )
      ).rows[0].amount as number;
    expect(Number(tradingRow.costAmount)).toBe(await cost(trading));
    expect(Number(operatorRow.costAmount)).toBe(await cost(retail));
    expect(Number(tradingRow.costAmount)).toBeGreaterThan(0);
    // Nợ nội bộ theo bảng đối soát tháng: công ty con còn phải trả 15.000.
    const settlement = (await pool.query("SELECT * FROM loyalty.settlements WHERE company_id = $1", [trading])).rows[0];
    expect(tradingRow).toMatchObject({
      settlementId: settlement.id,
      settlementNo: settlement.document_no,
      settlementStatus: "pending",
      receivable: String(Number(settlement.receivable_movement)),
      payable: String(Number(settlement.payable_movement)),
      offset: String(Number(settlement.offset_amount)),
      paid: "0",
      remaining: "15000",
    });
    // Công ty con chỉ thấy dòng của mình.
    const own = (await group.call("get", `/loyalty/reports/alliance?year=${year}`, { companyId: trading })).body;
    expect(own.isOperator).toBe(false);
    expect(own.rows.map((row: { companyId: string }) => row.companyId)).toEqual([trading]);
    // Không có quyền xem bảng đối soát: từ chối; năm sai: lỗi dữ liệu.
    expect((await (await signIn(application, "phuc.le@vcomm.test")).call("get", `/loyalty/reports/alliance?year=${year}`, { companyId: retail })).status).toBe(403);
    expect((await store.call("get", "/loyalty/reports/alliance?year=abc")).status).toBe(400);
    // Xuất Excel đúng số trên màn hình, ghi nhật ký.
    const file = await download(store.call("get", `/loyalty/reports/alliance?year=${year}&format=xlsx`));
    expect(file.status).toBe(200);
    expect(file.headers["content-disposition"]).toContain(`bao-cao-lien-minh-diem-${year}.xlsx`);
    const sheet = (await readSheet(file.body as Buffer)) as (string | number | null)[][];
    expect(sheet.find((row) => row[1] === "VComm Thương mại")?.slice(0, 13)).toEqual([
      `${month.slice(5, 7)}/${month.slice(0, 4)}`,
      "VComm Thương mại",
      20000,
      20000,
      Number(tradingRow.costAmount),
      5000,
      5000,
      Number(tradingRow.receivable),
      Number(tradingRow.payable),
      Number(tradingRow.offset),
      0,
      15000,
      settlement.document_no,
    ]);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE action = 'loyalty_report.alliance.export'")).rows[0].total).toBe(1);
  });

  it("KICHBAN_KIEMTHU_621: báo cáo gian lận khớp vụ việc theo quy tắc, mức, kết luận; giao dịch bị chặn; mười đối tượng nhiều vụ việc nhất; xuất Excel", async () => {
    const device = deviceHashOf("thiet-bi-bao-cao-0123456789abcdef");
    const setRule = async (code: string, change: object) => {
      const current = ((await store.call("get", "/loyalty/fraud-rules")).body.rules as { code: string; version: number }[]).find((item) => item.code === code)!;
      expect((await store.call("put", `/loyalty/fraud-rules/${code}`, { enabled: true, action: "alert", params: {}, ...change, version: current.version })).status).toBe(200);
    };
    // Đổi điểm dồn dập: lần thứ hai cảnh báo; chuyển sang chặn thì lần thứ ba bị chặn (cùng vụ việc trong ngày).
    await setRule("redeem_burst", { params: { maxCount: 1, maxPoints: null, balancePercent: 100, newDeviceHours: 24 } });
    await redeem(trading, 1000, device);
    await redeem(trading, 1000, device);
    await setRule("redeem_burst", { action: "block", params: { maxCount: 1, maxPoints: null, balancePercent: 100, newDeviceHours: 24 } });
    await expect(redeem(trading, 1000, device)).rejects.toMatchObject({ messageKey: "loyaltyFraudBlocked" });
    // Vụ việc bất thường theo nhân viên đã kết luận vi phạm, có chứng từ không tích điểm.
    const staffCase = await pool.query(
      `INSERT INTO loyalty.fraud_cases (rule_code, action, subject_kind, subject_key, staff_user_id, user_id, company_id, metrics, case_day, status, conclusion_note, concluded_at)
       VALUES ('staff_anomaly', 'block', 'staff', $1::text, $1::uuid, $2, $3, '{}', $4::date, 'violation', 'Thu ngân tự tích', now()) RETURNING id`,
      [testIds.groupAdmin, buyerId, retail, store.today],
    );
    await pool.query("INSERT INTO loyalty.fraud_case_documents (case_id, source_type, source_id, effect, user_id) VALUES ($1, 'retail_sale', $2, 'skipped_earn', $3)", [
      staffCase.rows[0].id,
      randomUUID(),
      buyerId,
    ]);

    const report = (await store.call("get", `/loyalty/reports/fraud?year=${year}`)).body;
    const rules = report.rules.filter((row: { month: string }) => row.month === month);
    expect(rules.map((row: { ruleCode: string }) => row.ruleCode)).toEqual(["redeem_burst", "staff_anomaly"]);
    // Một vụ việc gộp (mức mới nhất là chặn), một giao dịch bị chặn.
    expect(rules[0]).toMatchObject({ cases: 1, alert: 0, block: 1, blockAndLock: 0, violation: 0, noViolation: 0, blockedTransactions: 1, skippedEarns: 0, lockedWallets: 0 });
    expect(rules[1]).toMatchObject({ cases: 1, block: 1, violation: 1, blockedTransactions: 0, skippedEarns: 1, skippedPoints: 0 });
    // Khớp vụ việc trong cơ sở dữ liệu.
    const total = (await pool.query("SELECT count(*)::int AS total FROM loyalty.fraud_cases")).rows[0].total as number;
    expect(rules.reduce((sum: number, row: { cases: number }) => sum + row.cases, 0)).toBe(total);
    const top = report.top.filter((row: { month: string }) => row.month === month);
    expect(top).toEqual([
      { month, kind: "user", label: expect.stringMatching(/\*/), cases: 1 },
      { month, kind: "staff", label: expect.any(String), cases: 1 },
    ]);
    // Người không có quyền điểm thưởng không xem được.
    expect((await (await signIn(application, "phuc.le@vcomm.test")).call("get", `/loyalty/reports/fraud?year=${year}`, { companyId: retail })).status).toBe(403);
    const file = await download(store.call("get", `/loyalty/reports/fraud?year=${year}&format=xlsx`));
    expect(file.status).toBe(200);
    const sheet = (await readSheet(file.body as Buffer)) as (string | number | null)[][];
    expect(sheet.find((row) => row[1] === "Đổi điểm dồn dập")?.slice(2)).toEqual([1, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE action = 'loyalty_report.fraud.export'")).rows[0].total).toBe(1);
  });
});
