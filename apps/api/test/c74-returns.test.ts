// CONG_VIEC_74 L5: trả hàng một phần, hủy hóa đơn có điểm, đóng hộ ca, báo cáo cửa hàng, xuất Excel
// (KICHBAN_KIEMTHU_792 đến 796; TIEUCHI_NGHIEMTHU_580 phần đóng hộ, 581 đến 583).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readSheet } from "read-excel-file/node";
import { operator, prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: AffiliateFixture;
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const http = () => request(application.getHttpServer());
type Pos = {
  get: (path: string) => request.Test;
  post: (path: string, body?: object) => request.Test;
  put: (path: string, body?: object) => request.Test;
  delete: (path: string) => request.Test;
};
const posOf = (key: string, token?: string): Pos => {
  const make = (method: "get" | "post" | "put" | "delete", path: string, body?: object) => {
    const call = http()[method](`/api/v1${path}`).set("x-ipos-device", key).set("accept-language", "vi");
    if (token) call.set("authorization", `Bearer ${token}`);
    return body ? call.send(body) : call;
  };
  return { get: (path) => make("get", path), post: (path, body = {}) => make("post", path, body), put: (path, body = {}) => make("put", path, body), delete: (path) => make("delete", path) };
};
const portal = (method: "get" | "post" | "put" | "patch", path: string, body?: object) => store.owner.call(method, `/merchant-portal/ipos${path}`, body ? { body } : {});

async function pair(registerId: string): Promise<string> {
  const code = await portal("post", `/registers/${registerId}/pairing-codes`);
  const paired = await http().post("/api/v1/ipos/devices/pair").send({ code: code.body.code, model: "Sunmi T2", appVersion: "1.0.0" });
  expect(paired.status, JSON.stringify(paired.body)).toBe(201);
  return paired.body.deviceKey as string;
}

// Đăng nhập lần đầu bằng OTP SMS, đặt PIN; trả máy bán đã có token và mã thành viên.
async function login(key: string, phone: string, pin: string): Promise<{ pos: Pos; memberId: string }> {
  expect((await posOf(key).post("/ipos/pos/auth/otp", { phone })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = 'ipos_login' AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
  const logged = await posOf(key).post("/ipos/pos/auth/login", { phone, code: "246810", method: "sms" });
  expect(logged.status, JSON.stringify(logged.body)).toBe(201);
  const pos = posOf(key, logged.body.tokens.accessToken as string);
  expect((await pos.post("/ipos/pos/auth/pin", { pin })).status).toBe(204);
  return { pos, memberId: logged.body.member.memberId as string };
}

const variant = (fields: Partial<Record<string, unknown>> = {}) => ({ id: null, code: "", attribute1Value: null, attribute2Value: null, price: null, minQuantity: null, barcodes: [], status: "active", ...fields });
const item = (code: string, name: string, price: string, fields: Partial<Record<string, unknown>> = {}) => ({
  code,
  name,
  categoryId: null,
  unit: "Cái",
  price,
  vatRate: "8",
  trackStock: true,
  attribute1Name: null,
  attribute2Name: null,
  variants: [variant()],
  ...fields,
});

let ownerPos: Pos;
let ownerMemberId: string;
let cashierPos: Pos;
let registers: string[];
let keys: string[];
let milk: { id: string; variantId: string };
let bread: { id: string; variantId: string };
let gift: { id: string; variantId: string };

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareAffiliate(application, pool);
  const plan = await store.call("post", "/ipos/plans", { code: "BA-QUAY", name: "Ba quầy", monthlyPrice: "299000", taxPercent: "10", maxRegisters: 3, maxItems: 500, trialDays: 0 });
  const subscription = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, {
    outletId: store.outletA,
    planId: plan.body.id,
    periodMonths: 1,
    startsOn: store.today,
    trialDays: null,
    customMonthlyPrice: null,
    customMaxRegisters: null,
  });
  expect(subscription.status, JSON.stringify(subscription.body)).toBe(201);
  let list = (await portal("post", "/registers", { outletId: store.outletA, name: "Quầy 1" })).body;
  list = (await portal("post", "/registers", { outletId: store.outletA, name: "Quầy 2" })).body;
  list = (await portal("post", "/registers", { outletId: store.outletA, name: "Quầy 3" })).body;
  registers = ["Quầy 1", "Quầy 2", "Quầy 3"].map((name) => (list as { id: string; name: string }[]).find((register) => register.name === name)!.id);
  keys = [];
  for (const register of registers) keys.push(await pair(register));
  ({ pos: ownerPos, memberId: ownerMemberId } = await login(keys[0]!, "0909111222", "246813"));
  ({ pos: cashierPos } = await login(keys[1]!, "0912333444", "135792"));
  const create = async (body: object) => {
    const created = await portal("post", "/items", body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return { id: created.body.id as string, variantId: created.body.variants[0].id as string };
  };
  milk = await create(item("SUA", "Sữa tươi hộp 180ml", "8000", { variants: [variant({ barcodes: ["8934673102435"] })] }));
  bread = await create(item("BANH", "Bánh mì que", "15000", { vatRate: "10" }));
  gift = await create(item("GOI", "Phí gói quà", "10000", { vatRate: "exempt", trackStock: false }));
  expect((await portal("post", "/stock-documents", { kind: "receipt", outletId: store.outletA, note: null, lines: [{ variantId: milk.variantId, quantity: "10", unitCost: "6000" }] })).status).toBe(201);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});



const sale = (shiftId: string, lines: object[], payments: object[], extra: object = {}) => ({ idempotencyKey: randomUUID(), shiftId, lines, invoiceDiscount: null, payments, approvalCode: null, ...extra });
const ret = (shiftId: string, saleId: string, kind: "partial" | "full_cancel", lines: object[], extra: object = {}) => ({ idempotencyKey: randomUUID(), shiftId, saleId, kind, lines, reason: "Khách đổi ý", approvalCode: null, ...extra });
let ownerShift: string;
let cashierShift: string;

describe("CONG_VIEC_74 L5 – trả hàng", () => {
  it("KICHBAN_KIEMTHU_794: trả một phần hai lần đến hết số lượng; tiền hoàn theo phân bổ giảm hóa đơn; cộng tồn; hoàn từ két; thu ngân cần PIN chủ", async () => {
    await portal("put", `/outlets/${store.outletA}/code`, { code: "LL01" });
    ownerShift = (await ownerPos.post("/ipos/pos/shifts", { openingCash: "100000", note: null })).body.id as string;
    cashierShift = (await cashierPos.post("/ipos/pos/shifts", { openingCash: "0", note: null })).body.id as string;
    // 3 hộp sữa 8.000 = 24.000 và 1 bánh 15.000; giảm hóa đơn 3.900 phân bổ: sữa 2.400, bánh 1.500.
    const sold = await ownerPos.post(
      "/ipos/pos/sales",
      sale(ownerShift, [{ variantId: milk.variantId, quantity: "3", unitPrice: "8000", discount: null }, { variantId: bread.variantId, quantity: "1", unitPrice: "15000", discount: null }], [{ method: "cash", tendered: "50000" }], { invoiceDiscount: { type: "amount", value: "3900" } }),
    );
    expect(sold.status, JSON.stringify(sold.body)).toBe(201);
    expect(sold.body.total).toBe("35100");
    const lookup = await cashierPos.get(`/ipos/pos/returns/lookup?documentNo=${sold.body.documentNo.toLowerCase()}`);
    expect(lookup.status, JSON.stringify(lookup.body)).toBe(200);
    expect(lookup.body).toMatchObject({ mode: "partial", blockedReason: null, needsApproval: true });
    const milkLine = lookup.body.lines.find((line: { name: string }) => line.name.startsWith("Sữa")) as { saleLineId: string; amount: string };
    expect(milkLine.amount).toBe("21600");
    const before = (await portal("get", `/stock?outletId=${store.outletA}&search=sua tuoi`)).body[0].quantity as string;

    // Thu ngân trả hàng không có mã duyệt bị chặn; chủ nhập PIN trên máy quầy 2.
    expect((await cashierPos.post("/ipos/pos/returns", ret(cashierShift, sold.body.id, "partial", [{ saleLineId: milkLine.saleLineId, quantity: "1" }]))).body.error?.message).toBe(message("iposReturnNeedsApproval"));
    await login(keys[1]!, "0909111222", "246813");
    const approval = await cashierPos.post("/ipos/pos/approvals/pin", { memberId: ownerMemberId, pin: "246813", purpose: "return" });
    const first = await cashierPos.post("/ipos/pos/returns", ret(cashierShift, sold.body.id, "partial", [{ saleLineId: milkLine.saleLineId, quantity: "1" }], { approvalCode: approval.body.approvalCode }));
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({ kind: "partial", amount: "7200", refundCash: "7200", approvedByName: "Trần Minh Khoa", saleDocumentNo: sold.body.documentNo });
    expect(first.body.documentNo).toMatch(/^TR-LL01-\d{6}-0001$/);
    // Trả vượt số còn lại bị chặn; chủ tự trả không cần duyệt; trả hết thì hoàn đúng phần tiền còn lại.
    expect((await ownerPos.post("/ipos/pos/returns", ret(ownerShift, sold.body.id, "partial", [{ saleLineId: milkLine.saleLineId, quantity: "3" }]))).body.error?.message).toBe(message("iposReturnQuantityInvalid"));
    const second = await ownerPos.post("/ipos/pos/returns", ret(ownerShift, sold.body.id, "partial", [{ saleLineId: milkLine.saleLineId, quantity: "2" }]));
    expect(second.body).toMatchObject({ amount: "14400", approvedByName: null });
    expect((await portal("get", `/stock?outletId=${store.outletA}&search=sua tuoi`)).body[0].quantity).toBe(String(Number(before) + 3));
    const moves = await portal("get", `/stock-moves?outletId=${store.outletA}&variantId=${milk.variantId}`);
    expect(moves.body[0]).toMatchObject({ sourceType: "return", quantity: "2", sourceNumber: second.body.documentNo });
    // Tiền hệ thống của ca chủ: 100.000 + 35.100 − 14.400; của ca thu ngân: 0 − 7.200.
    expect((await ownerPos.get(`/ipos/pos/shifts/${ownerShift}/report`)).body).toMatchObject({ cashRefunds: "14400", systemCash: "120700" });
    expect((await cashierPos.get(`/ipos/pos/shifts/${cashierShift}/report`)).body).toMatchObject({ cashRefunds: "7200", systemCash: "-7200" });
    // Trả hết bánh rồi tra lại: đã trả hết.
    const breadLine = lookup.body.lines.find((line: { name: string }) => line.name.startsWith("Bánh")) as { saleLineId: string };
    expect((await ownerPos.post("/ipos/pos/returns", ret(ownerShift, sold.body.id, "partial", [{ saleLineId: breadLine.saleLineId, quantity: "1" }]))).body.amount).toBe("13500");
    expect((await ownerPos.get(`/ipos/pos/returns/lookup?documentNo=${sold.body.documentNo}`)).body.blockedReason).toBe("iposReturnNothingLeft");
    // Gửi lại cùng khóa yêu cầu không lập phiếu mới.
    const body = ret(ownerShift, sold.body.id, "partial", [{ saleLineId: milkLine.saleLineId, quantity: "1" }]);
    const fresh = await ownerPos.post("/ipos/pos/sales", sale(ownerShift, [{ variantId: milk.variantId, quantity: "1", unitPrice: "8000", discount: null }], [{ method: "cash", tendered: "8000" }]));
    const freshLine = (await ownerPos.get(`/ipos/pos/returns/lookup?documentNo=${fresh.body.documentNo}`)).body.lines[0].saleLineId as string;
    const once = { ...body, saleId: fresh.body.id, lines: [{ saleLineId: freshLine, quantity: "1" }] };
    const [a, b] = await Promise.all([ownerPos.post("/ipos/pos/returns", once), ownerPos.post("/ipos/pos/returns", once)]);
    expect(a.body.id).toBe(b.body.id);
    // Quá thời hạn trả (7 ngày) bị chặn.
    await pool.query("UPDATE ipos.sales SET sold_at = now() - interval '9 days' WHERE id = $1", [fresh.body.id]);
    expect((await ownerPos.get(`/ipos/pos/returns/lookup?documentNo=${fresh.body.documentNo}`)).body.blockedReason).toBe("iposReturnExpired");
  });

  it("KICHBAN_KIEMTHU_795: hóa đơn có điểm chỉ hủy toàn bộ; hủy hoàn điểm, sale chuyển đã hủy; tuần đối soát đã chốt bị chặn", async () => {
    const buyer = await store.register("0987654321", "Nguyễn Thị Hồng");
    await store.grantPoints(buyer.id, 100);
    const lines = [{ variantId: bread.variantId, quantity: "2", unitPrice: "15000", discount: null }];
    const loyaltyFor = async (points: number) =>
      (await ownerPos.post("/ipos/pos/loyalty-transactions", { shiftId: ownerShift, billAmount: "30000", method: "buyer_qr", memberCode: (await buyer.call("post", "/buyer/affiliate/member-code", { points })).body.code })).body;
    const loyalty = await loyaltyFor(10);
    const sold = await ownerPos.post("/ipos/pos/sales", sale(ownerShift, lines, [{ method: "cash", tendered: "20000" }], { affiliateTransactionId: loyalty.id }));
    expect(sold.status, JSON.stringify(sold.body)).toBe(201);
    const lookup = await ownerPos.get(`/ipos/pos/returns/lookup?documentNo=${sold.body.documentNo}`);
    expect(lookup.body.mode).toBe("full_cancel");
    expect((await ownerPos.post("/ipos/pos/returns", ret(ownerShift, sold.body.id, "partial", [{ saleLineId: lookup.body.lines[0].saleLineId, quantity: "1" }]))).body.error?.message).toBe(message("iposReturnFullOnly"));
    const balance = async () => (await pool.query<{ total: number }>("SELECT COALESCE(sum(remaining), 0)::int AS total FROM loyalty.lots WHERE user_id = $1", [buyer.id])).rows[0]!.total;
    const before = await balance();
    const cancelled = await ownerPos.post("/ipos/pos/returns", ret(ownerShift, sold.body.id, "full_cancel", []));
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(201);
    expect(cancelled.body).toMatchObject({ kind: "full_cancel", amount: "30000", refundCash: "20000" });
    expect(await balance()).toBe(before + 10);
    expect((await pool.query("SELECT status FROM affiliate.transactions WHERE id = $1", [loyalty.id])).rows[0].status).toBe("cancelled");
    expect((await ownerPos.get(`/ipos/pos/returns/lookup?documentNo=${sold.body.documentNo}`)).body.blockedReason).toBe("iposReturnCancelled");

    // Tuần đối soát đã chốt: không hủy được, không đổi gì.
    const settledLoyalty = await loyaltyFor(5);
    const settledSale = await ownerPos.post("/ipos/pos/sales", sale(ownerShift, lines, [{ method: "cash", tendered: "30000" }], { affiliateTransactionId: settledLoyalty.id }));
    const settlement = await pool.query<{ id: string }>(
      `INSERT INTO affiliate.settlements (company_id, merchant_id, week_start, fee_percent, fee_tax_rate, confirm_due_at) VALUES ($1, $2, date_trunc('week', now())::date, 8, 8, now() + interval '3 days') RETURNING id`,
      [operator, store.merchantId],
    );
    await pool.query("UPDATE affiliate.transactions SET settlement_id = $1 WHERE id = $2", [settlement.rows[0]!.id, settledLoyalty.id]);
    expect((await ownerPos.post("/ipos/pos/returns", ret(ownerShift, settledSale.body.id, "full_cancel", []))).body.error?.message).toBe(message("iposReturnWeekSettled"));
    expect((await pool.query("SELECT status FROM ipos.sales WHERE id = $1", [settledSale.body.id])).rows[0].status).toBe("completed");
  });
});

describe("CONG_VIEC_74 L5 – cổng cửa hàng", () => {
  it("KICHBAN_KIEMTHU_793 phần đóng hộ, 796: tổng quan, ca, hóa đơn, phiếu trả, báo cáo khớp tính tay, xuất Excel; chủ đóng hộ ca thu ngân", async () => {
    const today = store.today;
    const overview = await portal("get", "/overview");
    expect(overview.status, JSON.stringify(overview.body)).toBe(200);
    expect(overview.body.openShifts.length).toBe(2);

    const sales = (await pool.query<{ total: string }>("SELECT COALESCE(sum(total), 0)::text AS total, count(*)::int AS count FROM ipos.sales WHERE merchant_id = $1", [store.merchantId])).rows[0] as unknown as { total: string; count: number };
    const returned = (await pool.query<{ total: string }>("SELECT COALESCE(sum(amount), 0)::text AS total FROM ipos.returns WHERE merchant_id = $1 AND created_at > now() - interval '1 day'", [store.merchantId])).rows[0]!.total;
    const salesToday = (await pool.query<{ total: string; count: number }>("SELECT COALESCE(sum(total), 0)::text AS total, count(*)::int AS count FROM ipos.sales WHERE merchant_id = $1 AND sold_at > now() - interval '1 day'", [store.merchantId])).rows[0]!;
    void sales;
    const report = await portal("get", `/reports?from=${today}&to=${today}`);
    expect(report.status, JSON.stringify(report.body)).toBe(200);
    expect(report.body).toMatchObject({ grossSales: salesToday.total, salesCount: salesToday.count, returns: returned, netRevenue: String(Number(salesToday.total) - Number(returned)) });
    expect(report.body.byDay).toEqual([{ day: today, net: report.body.netRevenue, sales: salesToday.count }]);
    // Lợi nhuận gộp của sữa: doanh thu sau trả − giá vốn 6.000 mỗi hộp còn lại.
    const milkTop = report.body.topItems.find((item: { variantId: string }) => item.variantId === milk.variantId);
    expect(Number(milkTop.grossProfit)).toBe(Number(milkTop.revenue) - Number(milkTop.cost));
    expect((await portal("get", `/reports?from=2025-01-01&to=${today}`)).body.error?.fields?.to).toBe(message("iposPeriodTooLong"));
    const file = await store.owner.call("get", `/merchant-portal/ipos/reports/export?from=${today}&to=${today}`).buffer(true).parse((response, callback) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => callback(null, Buffer.concat(chunks)));
    });
    expect(file.status).toBe(200);
    const summary = await readSheet(file.body as Buffer);
    expect(summary[0]).toEqual(["Chỉ tiêu", "Giá trị"]);
    expect(summary.find((row) => row[0] === "Doanh thu thuần")?.[1]).toBe(Number(report.body.netRevenue));

    const salesList = await portal("get", `/sales?from=${today}&to=${today}&method=points`);
    expect(salesList.body.every((row: { methods: string[] }) => row.methods.includes("points"))).toBe(true);
    const returnsList = await portal("get", `/returns?from=${today}&to=${today}`);
    expect(returnsList.body.length).toBeGreaterThanOrEqual(4);
    expect((await portal("get", `/returns/${returnsList.body[0].id}`)).body.lines.length).toBeGreaterThan(0);
    expect((await portal("get", `/sales/${salesList.body[0].id}`)).status).toBe(200);

    // Chủ đóng hộ ca thu ngân (tiền hệ thống −7.200 do hoàn trả).
    const shifts = await portal("get", `/shifts?from=${today}&to=${today}`);
    const cashier = shifts.body.find((row: { id: string }) => row.id === cashierShift);
    expect(cashier).toMatchObject({ closedAt: null, memberName: "Lê Thu Hà" });
    const closed = await portal("post", `/shifts/${cashierShift}/close`, { countedCash: "0", denominations: null, differenceReason: "Thu ngân quên đóng ca, két trống", leftCash: "0" });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    expect(closed.body).toMatchObject({ difference: "7200", shift: { closedByName: "Trần Minh Khoa" } });
    expect((await portal("get", `/shifts/${cashierShift}`)).body.systemCash).toBe("-7200");
    expect((await store.cashier.call("get", "/merchant-portal/ipos/reports?from=" + today + "&to=" + today)).status).toBe(403);
  });
});
