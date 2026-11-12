// CONG_VIEC_60 L1: bảng đối soát nợ nội bộ điểm thưởng hằng tháng; đối chiếu sổ hai công ty; xác nhận hai phía, khiếu nại, lập lại; ghi thuần nên không có bút toán bù trừ
// (KICHBAN_KIEMTHU_614, 615; TIEUCHI_NGHIEMTHU_436, 437).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
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
let settlements: LoyaltySettlementsService;
let group: Session;
const trading = testIds.tradingCompany;
const parent = testIds.groupCompany;
let buyerId: string;

const firstOfNextMonth = (day: string) => {
  const value = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
};
const earn = (companyId: string, goodsAmount: number) =>
  database.transaction((transaction) => ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: randomUUID(), userId: buyerId, companyId, day: store.today, goodsAmount }));
const redeem = (companyId: string, points: number) =>
  database.transaction((transaction) =>
    ledger.redeemWithin(transaction, { userId: buyerId, companyId, sourceType: "retail_sale", sourceId: randomUUID(), day: store.today, goodsAmount: 1000000, points }),
  );
const operatorCall = (method: "get" | "post", path: string, body?: object) => store.call(method, path, body);
const companyCall = (method: "get" | "post", path: string, body?: object) => group.call(method, path, { companyId: trading, ...(body ? { body } : {}) });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  database = application.get(DATABASE);
  ledger = application.get(LoyaltyLedgerService);
  settlements = application.get(LoyaltySettlementsService);
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
  buyerId = await store.register("0939600101", "Nguyễn Thị Đối Soát");
  // Công ty con: tích 1.000.000 × 2% = 20.000 điểm (công ty vận hành sàn phải thu 20.000), dùng 5.000 điểm (phải trả 5.000).
  await earn(trading, 1000000);
  await redeem(trading, 5000);
  // Công ty mẹ có đối tác nội bộ nhưng chưa khởi tạo kế toán: chỉ sổ công ty vận hành sàn có bút toán, hai sổ lệch.
  await pool.query("INSERT INTO crm.partners (kind, name, company_id, search_text) VALUES ('organization', 'Tập đoàn VComm', $1, 'tap doan vcomm')", [parent]);
  await earn(parent, 100000);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_60 đối soát điểm nội bộ", () => {
  it("KICHBAN_KIEMTHU_614: việc nền lập bảng tháng cho từng công ty con; số liệu khớp sổ cái; sổ lệch thì Không khớp, không xác nhận được", async () => {
    expect(await settlements.buildMonthly(firstOfNextMonth(store.today))).toBe(2);
    const list = await operatorCall("get", "/loyalty/settlements");
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.isOperator).toBe(true);
    const tradingItem = list.body.items.find((item: { companyId: string }) => item.companyId === trading);
    expect(tradingItem).toMatchObject({
      period: store.today.slice(0, 7),
      netOpening: "0",
      receivableMovement: "20000",
      payableMovement: "5000",
      offsetAmount: "5000",
      netClosing: "15000",
      status: "pending",
    });
    expect(tradingItem.documentNo).toMatch(/^DN-/);
    const detail = (await operatorCall("get", `/loyalty/settlements/${tradingItem.id}`)).body;
    expect(detail).toMatchObject({ companyNetClosing: "15000", mismatches: [], viewerSide: "operator", canConfirm: true, canRebuild: true });
    expect(detail.movements).toEqual([
      { kind: "earn", amount: "20000" },
      { kind: "redeem", amount: "-5000" },
    ]);
    expect(detail.lines).toHaveLength(2);
    expect(detail.lines[0]).toMatchObject({ kind: "earn", points: 20000, amount: "20000", buyerName: "Ng**** Th* Đố* Soát" });
    // Công ty mẹ chưa có sổ: Không khớp, liệt kê bút toán lệch; không xác nhận được.
    const parentItem = list.body.items.find((item: { companyId: string }) => item.companyId === parent);
    expect(parentItem).toMatchObject({ netClosing: "2000", status: "mismatched" });
    const parentDetail = (await operatorCall("get", `/loyalty/settlements/${parentItem.id}`)).body;
    expect(parentDetail.mismatches).toHaveLength(1);
    expect(parentDetail.mismatches[0]).toMatchObject({ operatorAmount: "2000", companyAmount: "0" });
    const refused = await operatorCall("post", `/loyalty/settlements/${parentItem.id}/confirm`, { version: parentItem.version });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe("Số liệu hai công ty chưa khớp, chưa xác nhận được.");
    // Công ty con chỉ thấy bảng của mình; người không có quyền bị chặn.
    const companyList = await companyCall("get", "/loyalty/settlements");
    expect(companyList.body.isOperator).toBe(false);
    expect(companyList.body.items.map((item: { companyId: string }) => item.companyId)).toEqual([trading]);
    expect((await companyCall("get", `/loyalty/settlements/${parentItem.id}`)).status).toBe(404);
    expect((await (await signIn(application, "phuc.le@vcomm.test")).call("get", "/loyalty/settlements", { companyId: retail })).status).toBe(403);
    // Chạy lại việc nền: bảng còn mở được lập lại, không tạo bảng trùng.
    expect(await settlements.buildMonthly(firstOfNextMonth(store.today))).toBe(2);
    expect((await pool.query("SELECT count(*)::int AS total FROM loyalty.settlements")).rows[0].total).toBe(2);
  });

  it("KICHBAN_KIEMTHU_615: khiếu nại bỏ xác nhận; sổ đổi thì lập lại; đủ hai bên xác nhận thì Đã xác nhận, không sinh bút toán; kỳ sau nhận số còn lại", async () => {
    const id = (await pool.query("SELECT id FROM loyalty.settlements WHERE company_id = $1", [trading])).rows[0].id as string;
    const current = async () => (await operatorCall("get", `/loyalty/settlements/${id}`)).body;
    // Công ty vận hành sàn xác nhận, công ty con khiếu nại: bỏ xác nhận phía công ty vận hành sàn.
    let body = (await operatorCall("post", `/loyalty/settlements/${id}/confirm`, { version: (await current()).version })).body;
    expect(body).toMatchObject({ status: "operator_confirmed", canConfirm: false });
    expect((await operatorCall("post", `/loyalty/settlements/${id}/confirm`, { version: body.version })).status).toBe(409);
    const disputed = await companyCall("post", `/loyalty/settlements/${id}/dispute`, { version: body.version, reason: "Thiếu một hóa đơn tích điểm" });
    expect(disputed.status, JSON.stringify(disputed.body)).toBe(201);
    expect(disputed.body).toMatchObject({ status: "disputed", disputeReason: "Thiếu một hóa đơn tích điểm", operatorConfirmedAt: null, viewerSide: "company", canRebuild: false });
    expect((await companyCall("post", `/loyalty/settlements/${id}/confirm`, { version: disputed.body.version })).status).toBe(409);
    expect((await companyCall("post", `/loyalty/settlements/${id}/rebuild`, { version: disputed.body.version })).status).toBe(403);
    body = (await operatorCall("post", `/loyalty/settlements/${id}/rebuild`, { version: disputed.body.version })).body;
    expect(body.status).toBe("pending");
    // Sổ đổi sau khi lập (thêm một lần tích tại công ty con): xác nhận bị từ chối, bảng tự lập lại với số mới.
    body = (await operatorCall("post", `/loyalty/settlements/${id}/confirm`, { version: body.version })).body;
    await earn(trading, 500000);
    const changed = await companyCall("post", `/loyalty/settlements/${id}/confirm`, { version: body.version });
    expect(changed.status).toBe(409);
    expect(changed.body.error.message).toBe("Số liệu sổ đã thay đổi từ lúc lập bảng; hệ thống đã lập lại, vui lòng xem và xác nhận lại.");
    body = await current();
    expect(body).toMatchObject({ status: "pending", receivableMovement: "30000", payableMovement: "5000", netClosing: "25000", operatorConfirmedAt: null });
    // Hai bên xác nhận: Đã xác nhận, công ty con còn phải trả 25.000; sổ ghi thuần nên không có bút toán bù trừ.
    body = (await companyCall("post", `/loyalty/settlements/${id}/confirm`, { version: body.version })).body;
    expect(body.status).toBe("company_confirmed");
    body = (await operatorCall("post", `/loyalty/settlements/${id}/confirm`, { version: body.version })).body;
    expect(body).toMatchObject({ status: "confirmed", offsetAmount: "5000", netClosing: "25000", canConfirm: false, canRebuild: false });
    expect((await pool.query("SELECT count(*)::int AS total FROM accounting.journals WHERE source_id = $1", [id])).rows[0].total).toBe(0);
    expect(body.events.map((event: { kind: string }) => event.kind)).toEqual(["built", "rebuilt", "confirmed", "disputed", "rebuilt", "confirmed", "rebuilt", "confirmed", "confirmed", "agreed"]);
    // Đã xác nhận: không lập lại, không khiếu nại.
    expect((await operatorCall("post", `/loyalty/settlements/${id}/rebuild`, { version: body.version })).status).toBe(409);
    expect((await companyCall("post", `/loyalty/settlements/${id}/dispute`, { version: body.version, reason: "Muộn" })).status).toBe(409);
    // Kỳ sau: số dư đầu kỳ là số còn lại sau bù trừ; bảng kỳ trước chuyển sang kỳ sau.
    const nextPeriod = firstOfNextMonth(store.today);
    const nextId = await database.transaction((transaction) => settlements.buildWithin(transaction, retail, trading, nextPeriod, null));
    const next = (await operatorCall("get", `/loyalty/settlements/${nextId}`)).body;
    expect(next).toMatchObject({ netOpening: "25000", receivableMovement: "0", payableMovement: "0", offsetAmount: "0", netClosing: "25000", status: "pending" });
    expect((await current()).status).toBe("carried_forward");
  });
});
