// CONG_VIEC_74 L4: thanh toán VietQR kết hợp tiền mặt, khách VComm dùng điểm (service CONG_VIEC_55), đơn chờ thanh toán qua ứng dụng VComm (CONG_VIEC_73)
// (KICHBAN_KIEMTHU_784, 789 phần tạo đơn, gắn mã, hủy; TIEUCHI_NGHIEMTHU_574, 578 phần tạo đơn, 579).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iposVietqrPayload } from "contracts";
import { vietQrData } from "../src/marketplace/payments/gateways/bank-transfer-gateway";
import { operator, prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { DATABASE, type Database } from "../src/database/database.module";
import { InstoreCheckoutsService } from "../src/instore/checkouts.service";
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
let shiftId: string;

describe("CONG_VIEC_74 L4 – VietQR", () => {
  it("KICHBAN_KIEMTHU_784: chuỗi VietQR khớp hàm có sẵn; kết hợp tiền mặt và VietQR; chưa khai tài khoản, tiền VietQR sai bị chặn", async () => {
    const input = { bankBin: "970436", accountNo: "0071000888999", amount: 61600, content: "LL01 3F9A2C71" };
    expect(iposVietqrPayload(input)).toBe(vietQrData({ bankBin: input.bankBin, accountNumber: input.accountNo, amount: input.amount, content: input.content }));
    expect(iposVietqrPayload({ ...input, content: "Hoa don 1" })).toBe(vietQrData({ bankBin: input.bankBin, accountNumber: input.accountNo, amount: input.amount, content: "Hoa don 1" }));

    await portal("put", `/outlets/${store.outletA}/code`, { code: "LL01" });
    shiftId = (await ownerPos.post("/ipos/pos/shifts", { openingCash: "0", note: null })).body.id as string;
    const lines = [{ variantId: bread.variantId, quantity: "2", unitPrice: "15000", discount: null }];
    expect((await ownerPos.post("/ipos/pos/sales", sale(shiftId, lines, [{ method: "vietqr", amount: "30000", reference: "LL01 ABCD1234" }]))).body.error?.message).toBe(message("iposVietqrNotConfigured"));
    const page = (await portal("get", "/settings")).body.settings;
    await portal("put", "/settings", { ...page, vietqrBankBin: "970436", vietqrAccountNo: "0071000888999", vietqrAccountName: "TRAN MINH KHOA" });
    const catalog = await ownerPos.get("/ipos/pos/catalog");
    expect(catalog.body.context.vietqr).toEqual({ bankBin: "970436", accountNo: "0071000888999", accountName: "TRAN MINH KHOA" });
    expect((await ownerPos.post("/ipos/pos/sales", sale(shiftId, lines, [{ method: "vietqr", amount: "40000", reference: "LL01 ABCD1234" }]))).body.error?.message).toBe(message("iposVietqrAmountInvalid"));
    // 30.000 = 20.000 VietQR + 10.000 tiền mặt (khách đưa 50.000, thừa 40.000).
    const mixed = await ownerPos.post("/ipos/pos/sales", sale(shiftId, lines, [{ method: "vietqr", amount: "20000", reference: "LL01 ABCD1234" }, { method: "cash", tendered: "50000" }]));
    expect(mixed.status, JSON.stringify(mixed.body)).toBe(201);
    expect(mixed.body.payments).toEqual([
      expect.objectContaining({ method: "cash", amount: "10000", tendered: "50000" }),
      expect.objectContaining({ method: "vietqr", amount: "20000", vietqrReference: "LL01 ABCD1234" }),
    ]);
    expect(mixed.body.change).toBe("40000");
    const only = await ownerPos.post("/ipos/pos/sales", sale(shiftId, lines, [{ method: "vietqr", amount: "30000", reference: "LL01 FFFF0000" }]));
    expect(only.status, JSON.stringify(only.body)).toBe(201);
    const report = await ownerPos.get(`/ipos/pos/shifts/${shiftId}/report`);
    // Tiền mặt trong két chỉ tính phần tiền mặt.
    expect(report.body).toMatchObject({ cashSales: "10000", revenue: "60000" });
    expect(report.body.revenueByMethod).toEqual(expect.arrayContaining([{ method: "vietqr", amount: "50000" }, { method: "cash", amount: "10000" }]));
  });
});

describe("CONG_VIEC_74 L4 – khách VComm dùng điểm, voucher", () => {
  it("TIEUCHI_NGHIEMTHU_579: thu ngân quét mã thành viên, khách dùng điểm; phần còn lại thu tiền mặt; hóa đơn có dòng Điểm và liên kết LK…; giao dịch dở chặn đóng ca", async () => {
    const buyer = await store.register("0987654321", "Nguyễn Thị Hồng");
    await store.grantPoints(buyer.id, 100);
    const lines = [{ variantId: bread.variantId, quantity: "4", unitPrice: "15000", discount: null }];
    const code = (await buyer.call("post", "/buyer/affiliate/member-code", { points: 20 })).body.code as string;
    const loyalty = await ownerPos.post("/ipos/pos/loyalty-transactions", { shiftId, billAmount: "60000", method: "buyer_qr", memberCode: code });
    expect(loyalty.status, JSON.stringify(loyalty.body)).toBe(201);
    expect(loyalty.body, JSON.stringify(loyalty.body)).toMatchObject({ status: "completed", redeemedPoints: 20, redeemedAmount: "20000", paidAmount: "40000", buyerName: "Ng*** H***" });
    expect(loyalty.body.documentNo).toMatch(/^LK/);
    // Còn giao dịch điểm chưa gắn hóa đơn thì chưa đóng ca.
    expect((await ownerPos.post(`/ipos/pos/shifts/${shiftId}/close`, { countedCash: "10000", denominations: null, differenceReason: null, leftCash: "0" })).body.error?.message).toBe(message("iposShiftOpenPayments"));
    // Tiền hóa đơn khác tiền giao dịch điểm bị chặn.
    expect((await ownerPos.post("/ipos/pos/sales", sale(shiftId, [{ ...lines[0], quantity: "3" }], [{ method: "cash", tendered: "45000" }], { affiliateTransactionId: loyalty.body.id }))).body.error?.message).toBe(message("iposLoyaltyAmountMismatch"));
    expect((await ownerPos.post("/ipos/pos/sales", sale(shiftId, lines, [{ method: "cash", tendered: "30000" }], { affiliateTransactionId: loyalty.body.id }))).body.error?.message).toBe(message("iposTenderedTooLow"));
    const paid = await ownerPos.post("/ipos/pos/sales", sale(shiftId, lines, [{ method: "cash", tendered: "50000" }], { affiliateTransactionId: loyalty.body.id }));
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    expect(paid.body).toMatchObject({ total: "60000", change: "10000", buyerName: "Ng*** H***", redeemedPoints: 20 });
    expect(paid.body.payments).toEqual([
      expect.objectContaining({ method: "cash", amount: "40000" }),
      expect.objectContaining({ method: "points", amount: "20000", linkNumber: loyalty.body.documentNo }),
    ]);
    // Một giao dịch điểm chỉ gắn một hóa đơn.
    expect((await ownerPos.post("/ipos/pos/sales", sale(shiftId, lines, [{ method: "cash", tendered: "50000" }], { affiliateTransactionId: loyalty.body.id }))).body.error?.message).toBe(message("iposLoyaltyNotUsable"));

    // Bỏ giỏ sau khi khách đã dùng điểm: hủy giao dịch, điểm hoàn lại.
    const before = (await pool.query<{ balance: number }>("SELECT COALESCE(sum(remaining), 0)::int AS balance FROM loyalty.lots WHERE user_id = $1", [buyer.id])).rows[0]!.balance;
    const second = await ownerPos.post("/ipos/pos/loyalty-transactions", { shiftId, billAmount: "30000", method: "buyer_qr", memberCode: (await buyer.call("post", "/buyer/affiliate/member-code", { points: 10 })).body.code });
    expect(second.body.status).toBe("completed");
    const cancelled = await ownerPos.post(`/ipos/pos/loyalty-transactions/${second.body.id}/cancel`);
    expect(cancelled.body.status, JSON.stringify(cancelled.body)).toBe("cancelled");
    const after = (await pool.query<{ balance: number }>("SELECT COALESCE(sum(remaining), 0)::int AS balance FROM loyalty.lots WHERE user_id = $1", [buyer.id])).rows[0]!.balance;
    expect(after).toBe(before);

    // Khách quét mã QR cửa hàng: giao dịch chờ khách xác nhận.
    const merchantQr = await ownerPos.post("/ipos/pos/loyalty-transactions", { shiftId, billAmount: "30000", method: "merchant_qr", memberCode: null });
    expect(merchantQr.body).toMatchObject({ status: "pending", qrCode: expect.stringMatching(/^VCLK1\./) });
    // Máy bán quầy khác không xem được giao dịch của quầy này.
    expect((await cashierPos.get(`/ipos/pos/loyalty-transactions/${merchantQr.body.id}`)).status).toBe(404);
  });
});

describe("CONG_VIEC_74 L4 – đơn chờ thanh toán qua ứng dụng VComm", () => {
  it("TIEUCHI_NGHIEMTHU_578 phần máy chủ: đơn chờ do máy bán tạo hoàn tất qua móc \"ipos\" ghi hóa đơn có dòng Ứng dụng VComm và Điểm, trừ tồn, gắn ca; gọi lại không ghi thêm", async () => {
    const lines = [{ variantId: bread.variantId, quantity: "1", unitPrice: "15000", discount: null }];
    const created = await ownerPos.post("/ipos/pos/vcomm-checkouts", { idempotencyKey: randomUUID(), shiftId, lines, invoiceDiscount: null, approvalCode: null });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ completionAvailable: true, saleId: null });
    // Phần khách trả qua cổng là của CONG_VIEC_73; ở đây gọi móc như handler "affiliate" làm sau khi ghi LK… (giao dịch LK… lấy một giao dịch QR cửa hàng của máy bán).
    const lk = (await ownerPos.post("/ipos/pos/loyalty-transactions", { shiftId, billAmount: "15000", method: "merchant_qr", memberCode: null })).body;
    const before = Number((await pool.query("SELECT quantity FROM ipos.stock_balances WHERE variant_id = $1", [bread.variantId])).rows[0]?.quantity ?? 0);
    const instore = application.get(InstoreCheckoutsService);
    const complete = () =>
      application.get<Database>(DATABASE).transaction(async (transaction) => {
        const row = (await instore.find(transaction, created.body.id))!;
        const invoiceId = await instore.completionHook("ipos")!(transaction, row, {
          affiliateTransactionId: lk.id,
          documentNo: lk.documentNo,
          points: 5,
          pointsAmount: "5000",
          voucherAmount: "0",
          appAmount: "10000",
          dueAtCounter: "0",
        });
        await transaction.execute(sql`UPDATE instore.checkouts SET ipos_invoice_id = ${invoiceId} WHERE id = ${row.id}`);
        return invoiceId;
      });
    const saleId = await complete();
    expect(saleId).toEqual(expect.any(String));
    expect(await complete()).toBe(saleId);
    const view = await ownerPos.get(`/ipos/pos/vcomm-checkouts/${created.body.id}`);
    expect(view.body.saleId).toBe(saleId);
    const sale = (await ownerPos.get(`/ipos/pos/sales/${saleId}`)).body;
    expect(sale).toMatchObject({ total: "15000", documentNo: expect.stringMatching(/-\d{6}-\d{4}$/) });
    expect(sale.payments.map((payment: { method: string; amount: string }) => [payment.method, payment.amount]).sort()).toEqual([
      ["points", "5000"],
      ["vcomm_app", "10000"],
    ]);
    const after = Number((await pool.query("SELECT quantity FROM ipos.stock_balances WHERE variant_id = $1", [bread.variantId])).rows[0]?.quantity ?? 0);
    expect(before - after).toBe(1);
    expect((await pool.query("SELECT sale_id FROM ipos.shift_links WHERE instore_checkout_id = $1", [created.body.id])).rows[0].sale_id).toBe(saleId);
    expect((await pool.query("SELECT count(*)::int AS n FROM ipos.sales WHERE idempotency_key = $1", [created.body.id])).rows[0].n).toBe(1);
  });

  it("KICHBAN_KIEMTHU_789 phần đã làm được: tạo đơn TT… có mã QR, gửi lại cùng khóa không tạo mới, mã động sai bị từ chối, hủy; đơn đang chờ chặn đóng ca", async () => {
    const lines = [{ variantId: bread.variantId, quantity: "1", unitPrice: "15000", discount: null }];
    const key = randomUUID();
    const created = await ownerPos.post("/ipos/pos/vcomm-checkouts", { idempotencyKey: key, shiftId, lines, invoiceDiscount: null, approvalCode: null });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "awaiting_buyer", billAmount: "15000", qrUrl: expect.stringContaining("/tt/"), completionAvailable: true, saleId: null });
    expect(created.body.documentNo).toMatch(/^TT\d{8}$/);
    const again = await ownerPos.post("/ipos/pos/vcomm-checkouts", { idempotencyKey: key, shiftId, lines, invoiceDiscount: null, approvalCode: null });
    expect(again.body).toMatchObject({ id: created.body.id, qrUrl: null });
    expect((await ownerPos.post(`/ipos/pos/vcomm-checkouts/${created.body.id}/pay-code`, { code: "123456789012345678" })).status).not.toBe(201);
    expect((await ownerPos.post(`/ipos/pos/vcomm-checkouts/${created.body.id}/pay-code`, { code: "12345" })).status).toBe(400);
    expect((await ownerPos.post(`/ipos/pos/shifts/${shiftId}/close`, { countedCash: "10000", denominations: null, differenceReason: null, leftCash: "0" })).body.error?.message).toBe(message("iposShiftOpenPayments"));
    const cancelled = await ownerPos.post(`/ipos/pos/vcomm-checkouts/${created.body.id}/cancel`);
    expect(cancelled.body.status, JSON.stringify(cancelled.body)).toBe("cancelled");
    expect((await cashierPos.get(`/ipos/pos/vcomm-checkouts/${created.body.id}`)).status).toBe(404);
    // Khách chưa trả qua ứng dụng nên không có hóa đơn; đóng ca được (giao dịch QR cửa hàng đang chờ đã quá hạn được bỏ qua sau 3 phút, ở đây hủy bằng cách cho quá hạn).
    await pool.query("UPDATE affiliate.transactions SET expires_at = now() - interval '1 minute' WHERE status = 'pending'");
    const closed = await ownerPos.post(`/ipos/pos/shifts/${shiftId}/close`, { countedCash: "50000", denominations: null, differenceReason: null, leftCash: "0" });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
  });
});

describe("CONG_VIEC_74 L6 – doanh thu, đối soát iPOS trong ERP (API_357)", () => {
  it("KICHBAN_KIEMTHU_797: doanh thu theo điểm bán khớp tổng hóa đơn trừ trả hàng; không có dòng hàng, giá vốn, khách; người ngoài ERP bị chặn", async () => {
    const revenue = await store.call("get", `/ipos/reports/revenue?from=${store.today}&to=${store.today}`);
    expect(revenue.status, JSON.stringify(revenue.body)).toBe(200);
    const expected = (
      await pool.query(
        `SELECT (SELECT COALESCE(sum(total), 0) FROM ipos.sales WHERE outlet_id = $1)::numeric - (SELECT COALESCE(sum(amount), 0) FROM ipos.returns WHERE outlet_id = $1) AS net,
          (SELECT count(*)::int FROM ipos.sales WHERE outlet_id = $1) AS sales`,
        [store.outletA],
      )
    ).rows[0];
    const row = revenue.body.rows.find((item: { outletId: string }) => item.outletId === store.outletA);
    expect(row).toMatchObject({ merchantId: store.merchantId, netRevenue: String(Number(expected.net)), salesCount: expected.sales });
    expect(Number(row.cash) + Number(row.vietqr) + Number(row.vcommApp) + Number(row.pointsVoucher)).toBe(Number(row.grossSales));
    expect(row.shiftCount).toBeGreaterThan(0);
    expect(JSON.stringify(revenue.body)).not.toMatch(/"(lines|cost|unitCost|grossProfit|buyer\w*)"/);
    expect((await store.owner.call("get", `/ipos/reports/revenue?from=${store.today}&to=${store.today}`)).status).toBe(403);
    expect((await store.call("get", `/ipos/reports/revenue?from=2025-01-01&to=${store.today}`)).status).toBe(400);
  });

  it("KICHBAN_KIEMTHU_798: đối soát thu hộ, điểm hiện đúng các dòng lệch dựng sẵn; dòng khớp không hiện", async () => {
    const query = `from=${store.today}&to=${store.today}&merchantId=${store.merchantId}`;
    // Điểm: giao dịch LK… của ca L4 đã gắn hóa đơn (khớp).
    let loyalty = (await store.call("get", `/ipos/reconciliation/loyalty?${query}`)).body;
    expect(loyalty.matched, JSON.stringify(loyalty)).toBe(1);
    expect(loyalty.mismatches).toEqual([]);

    // Dựng lệch 1 (có thu hộ, không có hóa đơn): đơn chờ iPOS mới, giao dịch LK… đã hủy ở ca L4 sửa thành hoàn tất có tiền thu hộ.
    const ownerUser = (await pool.query("SELECT user_id FROM affiliate.members WHERE merchant_id = $1 AND role = 'owner'", [store.merchantId])).rows[0].user_id as string;
    const instore = application.get(InstoreCheckoutsService);
    const orphan = await application.get<Database>(DATABASE).transaction((transaction) =>
      instore.create(transaction, {
        operatorCompanyId: operator,
        place: { kind: "affiliate", merchantId: store.merchantId, outletId: store.outletA },
        creator: { source: "ipos", userId: ownerUser },
        idempotencyKey: randomUUID(),
        billAmount: "30000",
        lines: [{ name: "Bánh mì que", unit: "Cái", quantity: "2", unitPrice: "15000", amount: "30000", gift: false }],
        collectInApp: true,
      }),
    );
    const cancelledLk = (await pool.query("SELECT id, document_no FROM affiliate.transactions WHERE merchant_id = $1 AND status = 'cancelled' AND redeemed_points = 10", [store.merchantId])).rows[0];
    await pool.query("UPDATE affiliate.transactions SET status = 'completed', cancelled_at = NULL, checkout_id = $2, collected_amount = 20000 WHERE id = $1", [cancelledLk.id, orphan.checkout.id]);
    await pool.query("UPDATE instore.checkouts SET affiliate_transaction_id = $2 WHERE id = $1", [orphan.checkout.id, cancelledLk.id]);
    // Dựng lệch 2 (lệch tiền điểm): dòng Điểm của hóa đơn ít hơn tiền điểm của giao dịch.
    await pool.query("UPDATE ipos.sale_payments SET amount = 19000 WHERE method = 'points' AND amount = 20000 AND affiliate_transaction_id IS NOT NULL AND instore_checkout_id IS NULL");

    const collection = (await store.call("get", `/ipos/reconciliation/collection?${query}`)).body;
    const kinds = (rows: { kind: string; checkoutNo: string | null; transactionNo: string | null }[]) => rows.map((item) => item.kind).sort();
    // Đơn chờ của móc hoàn tất (kiểm thử L4) không có LK… thu hộ: hiện "có hóa đơn, thu hộ không còn".
    expect(kinds(collection.mismatches), JSON.stringify(collection)).toEqual(["collection_cancelled", "missing_invoice"]);
    expect(collection.mismatches.find((item: { kind: string }) => item.kind === "missing_invoice")).toMatchObject({
      checkoutNo: orphan.checkout.document_no,
      transactionNo: cancelledLk.document_no,
      saleDocumentNo: null,
      vcommAmount: "20000",
    });
    loyalty = (await store.call("get", `/ipos/reconciliation/loyalty?${query}`)).body;
    expect(kinds(loyalty.mismatches), JSON.stringify(loyalty)).toEqual(["amount_mismatch", "missing_invoice"]);
    expect(loyalty.mismatches.find((item: { kind: string }) => item.kind === "amount_mismatch")).toMatchObject({ iposAmount: "19000", vcommAmount: "20000" });
    expect(loyalty.matched).toBe(0);
  });
});
