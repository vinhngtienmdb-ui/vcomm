// CONG_VIEC_60 L3: mã cài đặt ứng dụng, bốn quy tắc chống gian lận, ba mức xử lý, vụ việc (KICHBAN_KIEMTHU_617 đến 620; TIEUCHI_NGHIEMTHU_439 đến 441).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { deviceHashOf } from "../src/loyalty/fraud";
import { LoyaltyFraudService } from "../src/loyalty/fraud.service";
import { LoyaltyLedgerService } from "../src/loyalty/ledger.service";
import { signIn } from "./helpers";
import { prepareMarketplace, retail, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let database: Database;
let ledger: LoyaltyLedgerService;
let fraud: LoyaltyFraudService;
const device = "thiet-bi-kiem-thu-0123456789abcdef";

const earn = (userId: string, goodsAmount: number, sourceId = randomUUID()) =>
  database.transaction((transaction) => ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId, userId, companyId: retail, day: store.today, goodsAmount }));
const redeem = (userId: string, points: number, deviceHash: string | null = deviceHashOf(device)) =>
  database.transaction((transaction) =>
    ledger.redeemWithin(transaction, { userId, companyId: retail, sourceType: "retail_sale", sourceId: randomUUID(), day: store.today, goodsAmount: 1000000, points, deviceHash }),
  );
const rule = async (code: string) => ((await store.call("get", "/loyalty/fraud-rules")).body.rules as { code: string; version: number; params: object }[]).find((item) => item.code === code)!;
const setRule = async (code: string, change: object) => {
  const current = await rule(code);
  const response = await store.call("put", `/loyalty/fraud-rules/${code}`, { enabled: true, action: "alert", params: {}, ...change, version: current.version });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
};
const cases = async (ruleCode: string) => (await store.call("get", `/loyalty/fraud-cases?ruleCode=${ruleCode}&status=open`)).body.data as Record<string, unknown>[];

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  database = application.get(DATABASE);
  ledger = application.get(LoyaltyLedgerService);
  fraud = application.get(LoyaltyFraudService);
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
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_60 chống gian lận nâng cao", () => {
  it("KICHBAN_KIEMTHU_617: mã cài đặt chỉ lưu băm; không có hoặc sai định dạng thì không ghi; đăng nhập ghi thiết bị; xóa sau 12 tháng", async () => {
    const userId = await store.register("0939600301", "Khách Thiết Bị");
    const login = (deviceId?: string) => {
      const call = request(application.getHttpServer()).post("/api/v1/buyer/login").send({ phone: "0939600301", password: "MatKhauNguoiMua@2026" });
      return deviceId ? call.set("x-device-id", deviceId) : call;
    };
    expect((await login()).status).toBe(200);
    expect((await login("ngan")).status).toBe(200);
    expect((await pool.query("SELECT count(*)::int AS total FROM loyalty.device_links WHERE user_id = $1", [userId])).rows[0].total).toBe(0);
    expect((await login(device)).status).toBe(200);
    expect((await login(device)).status).toBe(200);
    const links = (await pool.query("SELECT device_hash, seen_count FROM loyalty.device_links WHERE user_id = $1", [userId])).rows;
    expect(links).toEqual([{ device_hash: deviceHashOf(device), seen_count: 2 }]);
    expect(links[0].device_hash).not.toContain(device);
    expect((await pool.query("SELECT count(*)::int AS total FROM loyalty.device_links WHERE device_hash = $1", [device])).rows[0].total).toBe(0);
    const devices = (await store.call("get", `/loyalty/accounts/${userId}/devices`)).body;
    expect(devices).toEqual([expect.objectContaining({ device: deviceHashOf(device)!.slice(0, 8), seenCount: 2, otherAccounts: [] })]);
    await pool.query("UPDATE loyalty.device_links SET last_seen_at = now() - interval '13 months' WHERE user_id = $1", [userId]);
    expect(await fraud.purgeDevices()).toBe(1);
  });

  it("KICHBAN_KIEMTHU_618: nhiều tài khoản trên một thiết bị: cảnh báo, chặn (vụ việc vẫn ghi), chặn và khóa ví; gộp vụ việc trong ngày", async () => {
    const users: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const userId = await store.register(`093960040${index}`, `Khách Chung Máy ${index}`);
      await fraud.link(userId, device);
      await earn(userId, 1000000);
      users.push(userId);
    }
    const fourth = users[3]!;
    // Mức cảnh báo (mặc định): vẫn dùng được điểm, ghi vụ việc.
    expect((await redeem(fourth, 2000)).points).toBe(2000);
    let open = await cases("shared_device");
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ action: "alert", subjectKind: "device", hitCount: 1, metrics: { accounts: 4, days: 30, maxAccounts: 3 } });
    // Chặn: báo lỗi cho khách, vụ việc vẫn ghi (gộp cùng ngày).
    await setRule("shared_device", { action: "block" });
    await expect(redeem(fourth, 2000)).rejects.toMatchObject({ messageKey: "loyaltyFraudBlocked" });
    open = await cases("shared_device");
    expect(open[0]).toMatchObject({ action: "block", hitCount: 2 });
    const detail = (await store.call("get", `/loyalty/fraud-cases/${open[0]!.id}`)).body;
    expect(detail.documents.map((document: { effect: string }) => document.effect)).toEqual(["alerted", "blocked_redeem"]);
    expect(detail.deviceAccounts).toHaveLength(4);
    // Chặn và khóa ví: ví tự khóa, lịch sử khóa không có người làm.
    await setRule("shared_device", { action: "block_and_lock" });
    await expect(redeem(users[2]!, 2000)).rejects.toMatchObject({ messageKey: "loyaltyFraudBlocked" });
    expect((await pool.query("SELECT locked, lock_reason FROM loyalty.accounts WHERE user_id = $1", [users[2]])).rows[0]).toEqual({
      locked: true,
      lock_reason: "Tự khóa theo quy tắc Nhiều tài khoản trên một thiết bị",
    });
    expect((await pool.query("SELECT actor_user_id FROM loyalty.lock_history WHERE user_id = $1", [users[2]])).rows).toEqual([{ actor_user_id: null }]);
    // Tab Vụ việc của ví: vụ việc theo thiết bị có chứng từ của tài khoản cũng hiện.
    const related = (await store.call("get", `/loyalty/fraud-cases?userId=${users[2]}&status=open`)).body.data as Record<string, unknown>[];
    expect(related.map((item) => item.ruleCode)).toEqual(["shared_device"]);
    // Không có mã cài đặt: không xét quy tắc thiết bị.
    await setRule("shared_device", { action: "block" });
    expect((await redeem(users[0]!, 2000, null)).points).toBe(2000);
    // Lịch sử sửa quy tắc.
    const history = (await store.call("get", "/loyalty/fraud-rules/history")).body;
    expect(history.map((item: { after: { action: string } }) => item.after.action)).toEqual(["block", "block_and_lock", "block"]);
    await setRule("shared_device", { enabled: false });
  });

  it("KICHBAN_KIEMTHU_619: đổi điểm dồn dập, tích rồi trả hàng lặp lại, bất thường theo nhân viên (chặn tích); biên ngưỡng", async () => {
    const userId = await store.register("0939600501", "Khách Dồn Dập");
    await earn(userId, 2000000);
    // Ngưỡng 2 lần trong 24 giờ: lần thứ hai chưa vượt, lần thứ ba vượt.
    await setRule("redeem_burst", { params: { maxCount: 2 } });
    await redeem(userId, 1000, null);
    await redeem(userId, 1000, null);
    expect(await cases("redeem_burst")).toHaveLength(0);
    await redeem(userId, 1000, null);
    expect((await cases("redeem_burst"))[0]).toMatchObject({ subjectKind: "user", metrics: { count24h: 3, maxCount: 2 } });
    // Thiết bị mới dùng ≥ 80 % số dư.
    const fresh = await store.register("0939600502", "Khách Máy Mới");
    await earn(fresh, 1000000);
    await fraud.link(fresh, "thiet-bi-moi-0123456789abcdef");
    await redeem(fresh, 16000, deviceHashOf("thiet-bi-moi-0123456789abcdef"));
    expect((await cases("redeem_burst")).find((item) => item.userId === fresh)).toMatchObject({ metrics: { newDevice: true, balance: 20000, points: 16000 } });

    // Tích rồi trả hàng: tích 20.000 (≥ 10.000), trả toàn bộ → trừ lại 100 % ≥ 50 %; mức chặn và khóa thì khóa ví.
    await setRule("earn_return", { action: "block_and_lock" });
    const returner = await store.register("0939600503", "Khách Trả Hàng");
    const sale = randomUUID();
    await earn(returner, 1000000, sale);
    await database.transaction((transaction) =>
      ledger.returnWithin(transaction, { saleSourceType: "retail_sale", saleSourceId: sale, returnSourceId: randomUUID(), companyId: retail, day: store.today, returnedGoodsAmount: 1000000 }),
    );
    expect((await cases("earn_return"))[0]).toMatchObject({ userId: returner, metrics: { earned90d: 20000, reversed90d: 20000 } });
    expect((await pool.query("SELECT locked FROM loyalty.accounts WHERE user_id = $1", [returner])).rows[0].locked).toBe(true);

    // Bất thường theo nhân viên: thu ngân tích điểm cho chính tài khoản của mình; mức chặn thì không tích, lý do fraud_rule.
    await setRule("staff_anomaly", { action: "block" });
    const staffBuyer = await store.register("0939600504", "Thu Ngân Tự Tích");
    const cashierId = staffBuyer;
    const fakeSale = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("SET session_replication_role = replica");
      await client.query(
        `INSERT INTO retail.sales (id, company_id, store_id, register_id, shift_id, document_no, sold_at, sale_date, cashier_id, sales_order_id, stock_document_id, goods_amount, promotion_amount,
           manual_discount, tax_amount, total_amount, tendered_amount, change_amount, client_key, loyalty_user_id)
         VALUES ($1, $2, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'BL-THU', now(), $3::date, $4, gen_random_uuid(), gen_random_uuid(), 500000, 0, 0, 0, 500000, 500000, 0,
           gen_random_uuid(), $5)`,
        [fakeSale, retail, store.today, cashierId, staffBuyer],
      );
    } finally {
      await client.query("SET session_replication_role = DEFAULT");
      client.release();
    }
    expect(await earn(staffBuyer, 500000, fakeSale)).toEqual({ points: 0, skipReason: "fraud_rule" });
    expect((await pool.query("SELECT earn_status, skip_reason FROM loyalty.document_points WHERE source_id = $1", [fakeSale])).rows[0]).toEqual({
      earn_status: "skipped",
      skip_reason: "fraud_rule",
    });
    expect((await cases("staff_anomaly"))[0]).toMatchObject({ subjectKind: "staff", metrics: { samePhone: true } });
  });

  it("KICHBAN_KIEMTHU_620: xem xét, kết luận vụ việc; kết luận rồi không đổi được; phân quyền", async () => {
    const item = (await cases("redeem_burst"))[0]!;
    let detail = (await store.call("post", `/loyalty/fraud-cases/${item.id}/review`, { version: item.version })).body;
    expect(detail).toMatchObject({ status: "reviewing", reviewerName: expect.any(String) });
    expect((await store.call("post", `/loyalty/fraud-cases/${item.id}/conclude`, { version: detail.version, violation: false, note: "" })).status).toBe(400);
    detail = (await store.call("post", `/loyalty/fraud-cases/${item.id}/conclude`, { version: detail.version, violation: false, note: "Khách mua nhiều thật" })).body;
    expect(detail).toMatchObject({ status: "no_violation", conclusionNote: "Khách mua nhiều thật" });
    expect((await store.call("post", `/loyalty/fraud-cases/${item.id}/review`, { version: detail.version })).status).toBe(409);
    // Kết luận xong: lần bắt sau cùng ngày mở vụ việc mới.
    expect((await store.call("get", `/loyalty/fraud-cases?status=no_violation`)).body.total).toBe(1);
    // Phân quyền: nhân viên không có quyền bị chặn; người chỉ có quyền xem không sửa được quy tắc.
    expect((await (await signIn(application, "phuc.le@vcomm.test")).call("get", "/loyalty/fraud-cases", { companyId: retail })).status).toBe(403);
    const roleId = (await pool.query("INSERT INTO core.roles (company_id, code, name_vi, name_en, status) VALUES ($1, 'xem_diem_c60', 'Xem điểm', 'View points', 'active') RETURNING id", [retail]))
      .rows[0].id;
    await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'crm.access'), ($1, 'loyalty.view')", [roleId]);
    await pool.query(
      "INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $1, 'company', $2, '2026-01-01' FROM core.users WHERE email = 'phuc.le@vcomm.test'",
      [roleId, retail],
    );
    const viewer = await signIn(application, "phuc.le@vcomm.test");
    const listed = await viewer.call("get", "/loyalty/fraud-rules", { companyId: retail });
    expect(listed.body.canManage).toBe(false);
    expect((await viewer.call("put", "/loyalty/fraud-rules/redeem_burst", { companyId: retail, body: { enabled: false, action: "alert", params: {}, version: 0 } })).status).toBe(403);
  });
});
