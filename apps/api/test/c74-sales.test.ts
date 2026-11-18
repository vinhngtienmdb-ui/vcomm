// CONG_VIEC_74 L3: cài đặt bán hàng, đồng bộ danh mục, ca, giỏ treo, hóa đơn tiền mặt, giảm giá và duyệt PIN chủ, số hóa đơn, trừ tồn
// (KICHBAN_KIEMTHU_780 phần tồn âm, 781 đến 783, 785; TIEUCHI_NGHIEMTHU_571 đến 573, 575).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeTotals } from "../src/ipos/ipos-sales.service";
import { prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
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

describe("CONG_VIEC_74 L3 – tính tiền", () => {
  it("Giảm dòng, giảm hóa đơn phân bổ theo tỷ lệ, làm tròn đến đồng", () => {
    const totals = computeTotals(
      [
        { quantity: "3", unitPrice: 8000, discount: { type: "percent", value: "10" } },
        { quantity: "1.5", unitPrice: 15000, discount: null },
        { quantity: "1", unitPrice: 10001, discount: { type: "amount", value: "1" } },
      ],
      { type: "amount", value: "1000" },
    );
    expect(totals.lines.map((line) => [line.gross, line.discount, line.allocated, line.amount])).toEqual([
      [24000, 2400, 399, 21201],
      [22500, 0, 416, 22084],
      [10001, 1, 185, 9815],
    ]);
    expect(totals).toMatchObject({ subtotal: 56501, lineDiscount: 2401, invoiceDiscount: 1000, total: 53100 });
  });
});

describe("CONG_VIEC_74 L3 – bán hàng trên máy", () => {
  let shiftId: string;
  let cashierShift: string;

  it("Cài đặt bán hàng và mã điểm bán; chưa có mã thì không ghi hóa đơn", async () => {
    const page = await portal("get", "/settings");
    expect(page.body.settings).toMatchObject({ cashierMaxDiscountPercent: "10", blockNegativeStock: false, paperWidth: 80, version: null });
    expect(page.body.outlets.find((outlet: { id: string }) => outlet.id === store.outletA)).toMatchObject({ code: null, subscribed: true });
    const saved = await portal("put", "/settings", { ...page.body.settings, vietqrBankBin: "970436", vietqrAccountNo: "0071000888999", vietqrAccountName: "tran minh khoa", receiptFooter: "Cảm ơn quý khách!" });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.settings).toMatchObject({ vietqrAccountName: "TRAN MINH KHOA", version: 1 });
    expect((await portal("put", "/settings", { ...page.body.settings })).status).toBe(409);
    // Số tài khoản không ghi vào nhật ký thao tác.
    const audit = await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'ipos.settings.update'");
    expect(JSON.stringify(audit.rows)).not.toContain("0071000888999");

    const opened = await ownerPos.post("/ipos/pos/shifts", { openingCash: "500000", note: null });
    expect(opened.status, JSON.stringify(opened.body)).toBe(201);
    shiftId = opened.body.id as string;
    const noCode = await ownerPos.post("/ipos/pos/sales", { idempotencyKey: randomUUID(), shiftId, lines: [{ variantId: gift.variantId, quantity: "1", unitPrice: "10000", discount: null }], invoiceDiscount: null, payments: [{ method: "cash", tendered: "10000" }], approvalCode: null });
    expect(noCode.body.error?.message).toBe(message("iposOutletCodeMissing"));
    expect((await portal("put", `/outlets/${store.outletA}/code`, { code: "ll01" })).body.outlets.find((outlet: { id: string }) => outlet.id === store.outletA).code).toBe("LL01");
    expect((await portal("put", `/outlets/${store.outletB}/code`, { code: "LL01" })).body.error?.message).toBe(message("iposOutletCodeTaken"));
  });

  it("KICHBAN_KIEMTHU_781: đồng bộ toàn bộ rồi theo thời điểm; đổi giá giữa lúc bán báo giá đã thay đổi", async () => {
    const full = await ownerPos.get("/ipos/pos/catalog");
    expect(full.status, JSON.stringify(full.body)).toBe(200);
    expect(full.body.full).toBe(true);
    expect(full.body.variants.map((row: { variantCode: string }) => row.variantCode).sort()).toEqual(["BANH", "GOI", "SUA"]);
    expect(full.body.context).toMatchObject({ outletCode: "LL01", receiptFooter: "Cảm ơn quý khách!", cashierMaxDiscountPercent: "10", registerName: "Quầy 1" });
    const since = full.body.serverTime as string;
    expect((await ownerPos.get(`/ipos/pos/catalog?since=${encodeURIComponent(since)}`)).body.variants).toEqual([]);
    // Giá riêng điểm bán A cho bánh mì: lần đồng bộ sau chỉ có bánh mì với giá mới.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await portal("put", `/items/${bread.id}/outlet-prices`, { prices: [{ outletId: store.outletA, variantId: bread.variantId, price: "16000" }] });
    const delta = await ownerPos.get(`/ipos/pos/catalog?since=${encodeURIComponent(since)}`);
    expect(delta.body.variants).toEqual([expect.objectContaining({ variantCode: "BANH", price: "16000", active: true })]);
    const stale = await ownerPos.post("/ipos/pos/sales", {
      idempotencyKey: randomUUID(),
      shiftId,
      lines: [{ variantId: bread.variantId, quantity: "1", unitPrice: "15000", discount: null }],
      invoiceDiscount: null,
      payments: [{ method: "cash", tendered: "20000" }],
      approvalCode: null,
    });
    expect(stale.body.error?.message).toBe(message("iposPriceChanged"));
  });

  it("KICHBAN_KIEMTHU_782: giỏ nhiều dòng, giảm dòng và hóa đơn, tiền thừa; trừ tồn theo giá vốn; thu ngân giảm vượt mức cần PIN chủ", async () => {
    const key = randomUUID();
    const body = {
      idempotencyKey: key,
      shiftId,
      lines: [
        { variantId: milk.variantId, quantity: "3", unitPrice: "8000", discount: { type: "percent", value: "10" } },
        { variantId: bread.variantId, quantity: "2", unitPrice: "16000", discount: null },
        { variantId: gift.variantId, quantity: "1", unitPrice: "10000", discount: null },
      ],
      invoiceDiscount: { type: "amount", value: "2000" },
      payments: [{ method: "cash", tendered: "100000" }],
      approvalCode: null,
    };
    const sale = await ownerPos.post("/ipos/pos/sales", body);
    expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    // 24.000 − 2.400 + 32.000 + 10.000 − 2.000 = 61.600; khách đưa 100.000, thừa 38.400.
    expect(sale.body).toMatchObject({ subtotal: "66000", lineDiscount: "2400", invoiceDiscount: "2000", total: "61600", change: "38400", printCount: 0 });
    expect(sale.body.documentNo).toMatch(/^LL01-\d{6}-0001$/);
    expect(sale.body.taxes).toEqual([
      { vatRate: "8", amount: expect.any(String), tax: expect.any(String) },
      { vatRate: "10", amount: expect.any(String), tax: expect.any(String) },
      { vatRate: "exempt", amount: expect.any(String), tax: "0" },
    ]);
    expect(sale.body.lines.reduce((sum: number, line: { amount: string }) => sum + Number(line.amount), 0)).toBe(61600);
    const stock = await portal("get", `/stock?outletId=${store.outletA}&search=sua tuoi`);
    expect(stock.body[0]).toMatchObject({ quantity: "7", averageCost: "6000" });
    const moves = await portal("get", `/stock-moves?outletId=${store.outletA}&variantId=${milk.variantId}`);
    expect(moves.body[0]).toMatchObject({ quantity: "-3", sourceType: "sale", sourceNumber: sale.body.documentNo, unitCost: "6000" });

    // Thu ngân: ca riêng ở quầy 2; giảm 20 % vượt mức 10 % cần mã duyệt của chủ.
    const opened = await cashierPos.post("/ipos/pos/shifts", { openingCash: "0", note: null });
    expect(opened.status, JSON.stringify(opened.body)).toBe(201);
    cashierShift = opened.body.id as string;
    const discounted = {
      idempotencyKey: randomUUID(),
      shiftId: cashierShift,
      lines: [{ variantId: bread.variantId, quantity: "1", unitPrice: "16000", discount: { type: "percent", value: "20" } }],
      invoiceDiscount: null,
      payments: [{ method: "cash", tendered: "12800" }],
      approvalCode: null,
    };
    expect((await cashierPos.post("/ipos/pos/sales", discounted)).body.error?.message).toBe(message("iposDiscountNeedsApproval"));
    // Chủ chưa đặt PIN trên máy quầy 2: chưa duyệt được.
    expect((await cashierPos.post("/ipos/pos/approvals/pin", { memberId: ownerMemberId, pin: "246813", purpose: "discount" })).body.error?.message).toBe(message("iposApproverNoPin"));
    await login(keys[1]!, "0909111222", "246813");
    expect((await cashierPos.post("/ipos/pos/approvals/pin", { memberId: ownerMemberId, pin: "111111", purpose: "discount" })).body.error?.message).toBe(message("iposPinWrong"));
    const approval = await cashierPos.post("/ipos/pos/approvals/pin", { memberId: ownerMemberId, pin: "246813", purpose: "discount" });
    expect(approval.status, JSON.stringify(approval.body)).toBe(201);
    expect(approval.body.approverName).toBe("Trần Minh Khoa");
    expect((await cashierPos.post("/ipos/pos/sales", { ...discounted, approvalCode: "000000" })).body.error?.message).toBe(message("iposApprovalInvalid"));
    const approved = await cashierPos.post("/ipos/pos/sales", { ...discounted, approvalCode: approval.body.approvalCode });
    expect(approved.status, JSON.stringify(approved.body)).toBe(201);
    expect(approved.body).toMatchObject({ total: "12800", change: "0", discountApprovedByName: "Trần Minh Khoa" });
    // Mã duyệt dùng một lần.
    expect((await cashierPos.post("/ipos/pos/sales", { ...discounted, idempotencyKey: randomUUID(), approvalCode: approval.body.approvalCode })).body.error?.message).toBe(message("iposApprovalInvalid"));
    // Tiền khách đưa chưa đủ.
    expect((await cashierPos.post("/ipos/pos/sales", { ...discounted, idempotencyKey: randomUUID(), lines: [{ ...discounted.lines[0], discount: null }] })).body.error?.message).toBe(
      message("iposTenderedTooLow"),
    );
    // Thu ngân không bán được trên ca của người khác.
    expect((await cashierPos.post("/ipos/pos/sales", { ...discounted, idempotencyKey: randomUUID(), shiftId, approvalCode: null, lines: [{ ...discounted.lines[0], discount: null }], payments: [{ method: "cash", tendered: "16000" }] })).body.error?.message).toBe(
      message("iposShiftNotOpen"),
    );
  });

  it("KICHBAN_KIEMTHU_783: hai yêu cầu song song cùng khóa yêu cầu chỉ ghi một hóa đơn", async () => {
    const body = { idempotencyKey: randomUUID(), shiftId, lines: [{ variantId: gift.variantId, quantity: "1", unitPrice: "10000", discount: null }], invoiceDiscount: null, payments: [{ method: "cash", tendered: "10000" }], approvalCode: null };
    const [first, second] = await Promise.all([ownerPos.post("/ipos/pos/sales", body), ownerPos.post("/ipos/pos/sales", body)]);
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.id).toBe(second.body.id);
    const count = await pool.query("SELECT count(*)::int AS total FROM ipos.sales WHERE idempotency_key = $1", [body.idempotencyKey]);
    expect(count.rows[0].total).toBe(1);
    // In lần đầu, in lại.
    expect((await ownerPos.post(`/ipos/pos/sales/${first.body.id}/print-log`, { reprint: false })).body.printCount).toBe(1);
    expect((await ownerPos.post(`/ipos/pos/sales/${first.body.id}/print-log`, { reprint: true })).body.printCount).toBe(2);
    const events = await pool.query("SELECT kind FROM ipos.device_events WHERE sale_id = $1", [first.body.id]);
    expect(events.rows).toEqual([{ kind: "reprint" }]);
  });

  it("KICHBAN_KIEMTHU_780: tồn âm cho phép theo mặc định, chặn khi bật cài đặt", async () => {
    const sell = (quantity: string) =>
      ownerPos.post("/ipos/pos/sales", { idempotencyKey: randomUUID(), shiftId, lines: [{ variantId: milk.variantId, quantity, unitPrice: "8000", discount: null }], invoiceDiscount: null, payments: [{ method: "cash", tendered: "200000" }], approvalCode: null });
    expect((await sell("9")).status).toBe(201);
    expect((await portal("get", `/stock?outletId=${store.outletA}&negative=true`)).body.find((row: { variantId: string }) => row.variantId === milk.variantId)).toMatchObject({ quantity: "-2" });
    const page = (await portal("get", "/settings")).body.settings;
    await portal("put", "/settings", { ...page, blockNegativeStock: true });
    expect((await sell("1")).body.error?.message).toBe(message("iposStockNegativeBlocked"));
    await portal("put", "/settings", { ...page, blockNegativeStock: false, version: page.version + 1 });
  });

  it("Giỏ treo, thu chi, đóng ca có chênh lệch, biên bản; ca sau gợi ý tiền để lại", async () => {
    const saved = await ownerPos.put("/ipos/pos/held-carts/2", { label: "Khách áo xanh", payload: { lines: [{ variantId: milk.variantId, quantity: "2" }] } });
    expect(saved.body).toEqual([expect.objectContaining({ slot: 2, label: "Khách áo xanh", memberName: "Trần Minh Khoa" })]);
    expect((await ownerPos.put("/ipos/pos/held-carts/6", { label: "x", payload: { lines: [] } })).status).toBe(400);
    expect((await ownerPos.post(`/ipos/pos/shifts/${shiftId}/cash-movements`, { direction: "out", category: "expense", amount: "50000", reason: "Mua đá" })).status).toBe(201);
    const report = await ownerPos.get(`/ipos/pos/shifts/${shiftId}/report`);
    // 500.000 + 61.600 + 10.000 + 72.000 − 50.000.
    expect(report.body).toMatchObject({ salesCount: 3, cashSales: "143600", cashOut: "50000", systemCash: "593600" });
    expect((await ownerPos.post(`/ipos/pos/shifts/${shiftId}/close`, { countedCash: "593000", denominations: null, differenceReason: null, leftCash: "500000" })).body.error?.fields?.differenceReason).toBeDefined();
    const closed = await ownerPos.post(`/ipos/pos/shifts/${shiftId}/close`, { countedCash: "593000", denominations: { "500000": 1, "50000": 1, "20000": 2, "2000": 1, "1000": 1 }, differenceReason: "Thối nhầm", leftCash: "500000" });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    expect(closed.body).toMatchObject({ difference: "-600", handedOver: "93000", leftCash: "500000" });
    expect((await ownerPos.get("/ipos/pos/held-carts")).body).toEqual([]);
    const current = await ownerPos.get("/ipos/pos/shifts/current");
    expect(current.body).toMatchObject({ shift: null, suggestedOpeningCash: "500000" });
    expect((await ownerPos.post("/ipos/pos/shifts", { openingCash: "450000", note: null })).body.error?.fields?.note).toBe(message("iposOpeningNoteRequired"));
    // Mở ngăn kéo: chỉ chủ cửa hàng, có nhật ký.
    expect((await ownerPos.post("/ipos/pos/drawer-events", { reason: "Đổi tiền lẻ" })).status).toBe(204);
    expect((await cashierPos.post("/ipos/pos/drawer-events", { reason: null })).status).toBe(403);
    void cashierShift;
  });

  it("KICHBAN_KIEMTHU_785: ba quầy bán đồng thời 300 hóa đơn, số hóa đơn liên tục không trùng", async () => {
    await store.owner.call("post", "/merchant-portal/members", { body: { fullName: "Đỗ Văn Nam", phone: "0933444555", outletIds: [store.outletA] } });
    await store.activate("0933444555");
    const third = await login(keys[2]!, "0933444555", "975310");
    const reopened = await ownerPos.post("/ipos/pos/shifts", { openingCash: "500000", note: null });
    expect(reopened.status, JSON.stringify(reopened.body)).toBe(201);
    const thirdShift = (await third.pos.post("/ipos/pos/shifts", { openingCash: "0", note: null })).body.id as string;
    const sellers = [
      { pos: ownerPos, shiftId: reopened.body.id as string },
      { pos: cashierPos, shiftId: cashierShift },
      { pos: third.pos, shiftId: thirdShift },
    ];
    const before = (await pool.query<{ total: number }>("SELECT count(*)::int AS total FROM ipos.sales WHERE outlet_id = $1", [store.outletA])).rows[0]!.total;
    await Promise.all(
      sellers.map(async (seller) => {
        for (let batch = 0; batch < 10; batch += 1) {
          const results = await Promise.all(
            Array.from({ length: 10 }, () =>
              seller.pos.post("/ipos/pos/sales", { idempotencyKey: randomUUID(), shiftId: seller.shiftId, lines: [{ variantId: gift.variantId, quantity: "1", unitPrice: "10000", discount: null }], invoiceDiscount: null, payments: [{ method: "cash", tendered: "10000" }], approvalCode: null }),
            ),
          );
          for (const result of results) expect(result.status, JSON.stringify(result.body)).toBe(201);
        }
      }),
    );
    const numbers = (await pool.query<{ document_no: string }>("SELECT document_no FROM ipos.sales WHERE outlet_id = $1 ORDER BY document_no", [store.outletA])).rows.map((row) => Number(row.document_no.slice(-4)));
    expect(numbers).toHaveLength(before + 300);
    expect(numbers).toEqual(Array.from({ length: before + 300 }, (_, index) => index + 1));
  }, 120_000);
});
