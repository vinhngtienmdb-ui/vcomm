// CONG_VIEC_73 lát L2: quầy cửa hàng tập đoàn nhận thanh toán qua ứng dụng VComm
// (QUYTAC_NGHIEPVU_573, 575 đến 580; TIEUCHI_NGHIEMTHU_547 đến 552; KICHBAN_KIEMTHU_752, 753, 756 đến 758).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { InstoreCheckoutsService } from "../src/instore/checkouts.service";
import { creditLot } from "../src/loyalty/ledger.service";
import { lockAccount } from "../src/loyalty/tiers";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { assignRetailRole, createRetailCatalog, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication, testClock } from "./setup-database";

type BuyerCall = (method: "get" | "post", path: string, body?: object) => request.Test;

const secret = "BIMATKIEMTHU0123456789";
const tmnCode = "VCOMMTST";
const smsCode = "246810";
const password = "MatKhauNguoiMua@2026";

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let cashier: Session;
let manager: Session;
let units: Record<string, string> = {};
let items: Record<string, string> = {};
let shiftId: string;
let storeId: string;
let storeVersion: number;
let minh: { id: string; call: BuyerCall; secret: string; prefix: string };
let hoa: { id: string; call: BuyerCall };

const http = () => request(application.getHttpServer());
const call = (session: Session, method: "get" | "post" | "put" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const rice = (quantity: string) => ({ variantId: items.rice, unitId: units.CAI, quantity });
const totp = (base32: string, offsetSteps = 0) => new TOTP({ secret: Secret.fromBase32(base32), digits: 6, period: 30 }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });
const setSmsCode = (phone: string, purpose: string) =>
  pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = $3 AND consumed_at IS NULL", [
    createHash("sha256").update(smsCode).digest("hex"),
    `+84${phone.slice(1)}`,
    purpose,
  ]);
const balance = async (userId: string) => (await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance as number;
const stockOfRice = async () =>
  Number((await pool.query("SELECT quantity FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [fixture.warehouseId, items.rice])).rows[0].quantity);
const activeHolds = async (checkoutId: string) =>
  (await pool.query("SELECT count(*)::int AS count FROM inventory.reservations WHERE source_type = 'instore.checkout' AND source_id = $1 AND status = 'active'", [checkoutId])).rows[0]
    .count as number;

// Kết quả VNPAY gửi về, ký bằng khóa bí mật (giả lập máy chủ VNPAY như CONG_VIEC_25).
function vnpayQuery(reference: string, amount: number, extra: Record<string, string> = {}): Record<string, string> {
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_TxnRef: reference,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14000077",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261117103000",
    vnp_OrderInfo: "Thanh toan don",
    ...extra,
  };
  return { ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, secret).hash };
}
const ipn = (query: Record<string, string>) => http().get("/api/v1/public/payments/vnpay/ipn").query(query);

async function newBuyer(phone: string, fullName: string): Promise<{ id: string; call: BuyerCall }> {
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await setSmsCode(phone, "register");
  const registered = await http().post("/api/v1/buyer/register").send({ phone, code: smsCode, fullName, password });
  expect(registered.status, JSON.stringify(registered.body)).toBe(200);
  const login = await http().post("/api/v1/buyer/login").set("accept-language", "vi").send({ phone, password });
  const token = login.body.tokens.accessToken as string;
  const buyerCall: BuyerCall = (method, path, body) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
  return { id: registered.body.user.id, call: buyerCall };
}

async function givePoints(userId: string, points: number, today: string) {
  await application.get<Database>(DATABASE).transaction(async (transaction) => {
    await lockAccount(transaction, userId);
    await creditLot(transaction, { userId, kind: "adjust_add", sourceType: "adjustment", sourceId: randomUUID(), companyId: retail, points, pointValue: 1, day: today, validityMonths: 12 });
  });
}

const createCheckout = (quantity = "1", expectedTotal = String(110000 * Number(quantity)), clientKey: string = randomUUID()) =>
  call(cashier, "post", "/retail/checkouts", { shiftId, clientKey, lines: [rice(quantity)], expectedTotal });

beforeAll(async () => {
  Object.assign(process.env, {
    VNPAY_TMN_CODE: tmnCode,
    VNPAY_HASH_SECRET: secret,
    VNPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/vnpay/return",
    VNPAY_PAYMENT_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  });
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  fixture = await createRetailFixture(application, pool);
  ({ units, items } = await createRetailCatalog(application, pool, fixture, today));
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  const phase = { startsOn: today, endsOn: null, earnPercent: "2", pointValue: "1", redeemMaxPercent: "50", redeemMinPoints: 1000, validityMonths: 12, orderCapPoints: null, monthlyCapPoints: null };
  expect((await fixture.admin.call("post", "/loyalty/phases", { companyId: retail, body: phase })).status).toBe(201);
  const store = (await call(fixture.admin, "post", "/retail/stores", storeBody(fixture))).body;
  storeId = store.id;
  storeVersion = store.version;
  const registers = (await call(fixture.admin, "post", `/retail/stores/${store.id}/registers`, { code: "Q01", name: "Quầy 1" })).body.registers;
  cashier = await assignRetailRole(application, pool, "thungan.app@vcomm.test", "Nguyễn Thị Lan", "cashier", fixture.storeBranch);
  manager = await assignRetailRole(application, pool, "cuahangtruong.app@vcomm.test", "Võ Văn Trưởng", "store_manager", fixture.storeBranch);
  shiftId = (await call(cashier, "post", "/retail/shifts", { registerId: registers[0].id, openingCash: "0" })).body.id;
  const registered = await newBuyer("0939731001", "Trần Văn Minh");
  expect((await registered.call("post", "/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
  await setSmsCode("0939731001", "smart_otp");
  const activated = await registered.call("post", "/buyer/loyalty/smart-otp/activate", { code: smsCode, deviceName: "iPhone", platform: "ios" });
  expect(activated.status, JSON.stringify(activated.body)).toBe(201);
  // Kích hoạt trên máy chưa tin cậy tính là khôi phục: bỏ khóa dùng điểm để thử dùng điểm.
  await pool.query("UPDATE core.account_security SET redeem_locked_until = NULL WHERE user_id = $1", [registered.id]);
  const prefix = (await registered.call("post", "/buyer/instore/pay-code")).body.prefix as string;
  minh = { ...registered, secret: activated.body.secret, prefix };
  hoa = await newBuyer("0939731002", "Phạm Thị Hoa");
  await givePoints(minh.id, 20000, today);
  await givePoints(hoa.id, 20000, today);
});

afterAll(async () => {
  testClock.fixed = null;
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("Cài đặt cửa hàng nhận thanh toán qua ứng dụng (QUYTAC_NGHIEPVU_573)", () => {
  it("chưa bật nhận thanh toán qua ứng dụng thì không tạo đơn chờ; chưa bật cổng thì không bật được", async () => {
    expect((await createCheckout()).body.error.message).toBe("Cửa hàng chưa bật nhận thanh toán qua ứng dụng VComm.");
    const blocked = await call(fixture.admin, "patch", `/retail/stores/${storeId}`, storeBody(fixture, { appPaymentEnabled: true, platformFeePercent: "1", version: storeVersion }));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toContain("chưa bật cổng thanh toán trực tuyến");
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    expect((await groupAdmin.call("put", "/marketplace/payment-methods/vnpay_qr", { companyId: retail, body: { isEnabled: true } })).status).toBe(200);
    const saved = await call(fixture.admin, "patch", `/retail/stores/${storeId}`, storeBody(fixture, { appPaymentEnabled: true, platformFeePercent: "1", version: storeVersion }));
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toMatchObject({ appPaymentEnabled: true, platformFeePercent: "1" });
  });
});

describe("Đơn chờ ở quầy (KICHBAN_KIEMTHU_752, 753)", () => {
  it("tổng đổi so với lúc xem thì báo; tạo đơn giữ hàng, trả mã QR; gửi lại cùng khóa trả đơn đã tạo; quầy chỉ một đơn chờ", async () => {
    expect((await createCheckout("1", "100000")).body.error.code).toBe("BUSINESS_RULE");
    const clientKey = randomUUID();
    const created = await createCheckout("2", "220000", clientKey);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "awaiting_buyer", totalAmount: "220000.0000", buyer: null, saleId: null });
    expect(created.body.qrUrl).toMatch(/\/tt\/[A-Za-z0-9_-]{32}$/);
    // Giữ gạo và hàng tặng của khuyến mãi mua 2 tặng 1 (dữ liệu thử của quầy).
    expect(await activeHolds(created.body.id)).toBe(2);
    const again = await createCheckout("2", "220000", clientKey);
    expect(again.body).toMatchObject({ id: created.body.id, qrUrl: null });
    expect((await createCheckout()).body.error.message).toBe("Quầy đang có đơn chờ khách thanh toán. Hủy đơn đó hoặc chờ hết hạn rồi tạo đơn mới.");
    const cancelled = await call(cashier, "post", `/retail/checkouts/${created.body.id}/cancel`, { reason: "Khách đổi ý" });
    expect(cancelled.body.status).toBe("cancelled");
    expect(await activeHolds(created.body.id)).toBe(0);
  });

  it("hai yêu cầu tạo cùng lúc: cùng khóa trả một đơn; khác khóa thì yêu cầu sau báo quầy bận, không lỗi hệ thống", async () => {
    const clientKey = randomUUID();
    const same = await Promise.all([createCheckout("1", "110000", clientKey), createCheckout("1", "110000", clientKey)]);
    expect(same.map((response) => response.status).sort()).toEqual([201, 201]);
    expect(same[0]!.body.id).toBe(same[1]!.body.id);
    await call(cashier, "post", `/retail/checkouts/${same[0]!.body.id}/cancel`, { reason: "Dọn" });
    const different = await Promise.all([createCheckout(), createCheckout()]);
    expect(different.map((response) => response.status).sort()).toEqual([201, 409]);
    const busy = different.find((response) => response.status === 409)!;
    expect(busy.body.error.message).toBe("Quầy đang có đơn chờ khách thanh toán. Hủy đơn đó hoặc chờ hết hạn rồi tạo đơn mới.");
    await call(cashier, "post", `/retail/checkouts/${different.find((response) => response.status === 201)!.body.id}/cancel`, { reason: "Dọn" });
  });

  it("đóng ca bị chặn khi còn đơn chờ trong hạn", async () => {
    const created = (await createCheckout()).body;
    const shift = (await call(cashier, "get", `/retail/shifts/${shiftId}`)).body;
    const closed = await call(cashier, "post", `/retail/shifts/${shiftId}/close`, { countedCash: "0", version: shift.version });
    expect(closed.body.error.message).toBe("Ca còn đơn chờ khách thanh toán qua ứng dụng. Hủy hoặc chờ đơn hoàn tất trước khi đóng ca.");
    await call(cashier, "post", `/retail/checkouts/${created.id}/cancel`, { reason: "Dọn" });
  });
});

describe("Luồng 1 và luồng 2 tại quầy (KICHBAN_KIEMTHU_756 đến 758)", () => {
  it("quét mã thanh toán, khách dùng điểm, trả qua VNPAY; cổng báo thành công thì ghi hóa đơn bán lẻ", async () => {
    const stockBefore = await stockOfRice();
    const created = (await createCheckout("2", "220000")).body;
    const scanned = await call(cashier, "post", `/retail/checkouts/${created.id}/pay-code`, { code: minh.prefix + totp(minh.secret) });
    expect(scanned.status, JSON.stringify(scanned.body)).toBe(200);
    expect(scanned.body.buyer).toMatchObject({ maskedName: "Tr** Vă* Minh" });
    const view = (await minh.call("get", `/buyer/instore/checkouts/${created.id}`)).body;
    expect(view).toMatchObject({ status: "awaiting_buyer", smartOtpRequired: false, loyalty: { balance: 20000, minPoints: 1000, maxPoints: 20000 } });
    expect(view.paymentMethods).toEqual([{ code: "vnpay_qr", gatewayCode: "vnpay" }]);
    // Thiếu phương thức cho phần còn lại; vượt mức điểm.
    expect((await minh.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 10000 })).body.error.message).toBe("Chọn phương thức thanh toán cho phần còn lại.");
    expect(await balance(minh.id)).toBe(20000);
    expect((await minh.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 200000, method: "vnpay_qr" })).status).toBe(409);
    const paid = await minh.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 10000, method: "vnpay_qr" });
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    expect(paid.body.checkout).toMatchObject({ status: "awaiting_payment", points: 10000, pointsAmount: "10000.0000", amountDue: "210000.0000" });
    expect(await balance(minh.id)).toBe(10000);
    const url = new URL(paid.body.paymentUrl);
    expect(url.searchParams.get("vnp_Amount")).toBe("21000000");
    // Mở lại cổng (thanh toán thất bại): giữ nguyên điểm, số tiền.
    const reference = url.searchParams.get("vnp_TxnRef")!;
    expect((await ipn(vnpayQuery(reference, 210000, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }))).body.RspCode).toBe("00");
    const retried = await minh.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 0, method: "vnpay_qr" });
    expect(retried.body.checkout).toMatchObject({ points: 10000, amountDue: "210000.0000" });
    expect(await balance(minh.id)).toBe(10000);
    const secondReference = new URL(retried.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    // Sai số tiền bị từ chối; đúng thì ghi hóa đơn.
    expect((await ipn(vnpayQuery(secondReference, 200000))).body.RspCode).toBe("04");
    expect((await ipn(vnpayQuery(secondReference, 210000))).body.RspCode).toBe("00");
    const done = (await call(cashier, "get", `/retail/checkouts/${created.id}`)).body;
    expect(done).toMatchObject({ status: "completed", saleId: expect.any(String), postingError: null });
    const sale = (await call(cashier, "get", `/retail/sales/${done.saleId}`)).body;
    expect(sale.totalAmount).toBe("220000");
    expect(sale.payments).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "vcomm_app", amount: "210000" }), expect.objectContaining({ method: "points", amount: "10000", points: "10000" })]),
    );
    expect(await stockOfRice()).toBe(stockBefore - 2);
    expect(await activeHolds(created.id)).toBe(0);
    expect((await minh.call("get", `/buyer/instore/checkouts/${created.id}`)).body).toMatchObject({ status: "completed", saleDocumentNo: sale.documentNo });
    // Tích điểm theo tiền hàng trừ phần điểm: (220.000 − 10.000) × 2 %.
    expect(await balance(minh.id)).toBe(10000 + 4200);
    // Gửi lại kết quả: đã xác nhận, không ghi trùng.
    expect((await ipn(vnpayQuery(secondReference, 210000))).body.RspCode).toBe("02");
    // Tiền "Ứng dụng VComm" không vào tiền mặt của ca.
    const shift = (await call(cashier, "get", `/retail/shifts/${shiftId}`)).body;
    expect(JSON.stringify(shift)).not.toContain("210000");
  });

  it("khách quét mã QR: khách đã kích hoạt Smart OTP thì dùng điểm cần mã", async () => {
    const created = (await createCheckout()).body;
    const token = created.qrUrl.split("/tt/")[1];
    expect((await minh.call("post", "/buyer/instore/checkouts/claim", { token })).status).toBe(200);
    expect((await minh.call("get", `/buyer/instore/checkouts/${created.id}`)).body.smartOtpRequired).toBe(true);
    expect((await minh.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 5000 })).body.error.message).toBe("Mở Smart OTP để dùng điểm.");
    const half = await minh.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 5000, method: "vnpay_qr", smartOtp: totp(minh.secret, 1) });
    expect(half.status, JSON.stringify(half.body)).toBe(200);
    expect(half.body.checkout.amountDue).toBe("105000.0000");
    const reference = new URL(half.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    expect((await ipn(vnpayQuery(reference, 105000))).body.RspCode).toBe("00");
    expect((await call(cashier, "get", `/retail/checkouts/${created.id}`)).body.status).toBe("completed");
  });

  it("hết hạn khi chưa thanh toán: hoàn điểm, nhả hàng; tiền về sau hạn thì lập việc chờ hoàn tiền", async () => {
    const created = (await createCheckout()).body;
    // Khách chưa kích hoạt Smart OTP, trong thời hạn chuyển đổi: dùng điểm không cần mã.
    await hoa.call("post", "/buyer/instore/checkouts/claim", { token: created.qrUrl.split("/tt/")[1] });
    const before = await balance(hoa.id);
    const paid = await hoa.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 2000, method: "vnpay_qr" });
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    expect(await balance(hoa.id)).toBe(before - 2000);
    const reference = new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    testClock.fixed = new Date(Date.now() + 11 * 60_000);
    try {
      expect(await application.get(InstoreCheckoutsService).expireDue()).toBeGreaterThanOrEqual(1);
    } finally {
      testClock.fixed = null;
    }
    expect(await balance(hoa.id)).toBe(before);
    expect(await activeHolds(created.id)).toBe(0);
    expect((await ipn(vnpayQuery(reference, 108000))).body.RspCode).toBe("00");
    const refund = await pool.query("SELECT reason, amount::text FROM marketplace.refunds WHERE checkout_id = $1", [created.id]);
    expect(refund.rows).toEqual([{ reason: "paid_after_cancel", amount: "108000.0000" }]);
    expect((await call(cashier, "get", `/retail/checkouts/${created.id}`)).body.status).toBe("expired");
  });

  it("đã thu mà ghi sổ không được: Đã thu, lỗi ghi sổ; Cửa hàng trưởng ghi lại; thu ngân không hủy được", async () => {
    const created = (await createCheckout()).body;
    const token = created.qrUrl.split("/tt/")[1];
    await hoa.call("post", "/buyer/instore/checkouts/claim", { token });
    const paid = await hoa.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 0, method: "vnpay_qr" });
    const reference = new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    // Giả lập giá đổi giữa lúc tạo đơn và lúc tiền về.
    await pool.query("UPDATE instore.checkouts SET sale_input = jsonb_set(sale_input, '{expectedTotal}', '\"999\"') WHERE id = $1", [created.id]);
    expect((await ipn(vnpayQuery(reference, 110000))).body.RspCode).toBe("00");
    const unposted = (await call(cashier, "get", `/retail/checkouts/${created.id}`)).body;
    expect(unposted).toMatchObject({ status: "paid_unposted", postingError: "retailTotalChanged" });
    expect((await call(cashier, "post", `/retail/checkouts/${created.id}/cancel`, { reason: "Thử" })).status).toBe(403);
    expect((await call(cashier, "post", `/retail/checkouts/${created.id}/retry-posting`)).status).toBe(403);
    await pool.query("UPDATE instore.checkouts SET sale_input = jsonb_set(sale_input, '{expectedTotal}', '\"110000\"') WHERE id = $1", [created.id]);
    const retried = await call(manager, "post", `/retail/checkouts/${created.id}/retry-posting`);
    expect(retried.status, JSON.stringify(retried.body)).toBe(200);
    expect(retried.body).toMatchObject({ status: "completed", saleId: expect.any(String) });
  });

  it("Cửa hàng trưởng hủy đơn đã thu chưa ghi sổ thì lập việc chờ hoàn tiền; đóng ca được khi không còn đơn chờ", async () => {
    const created = (await createCheckout()).body;
    await hoa.call("post", "/buyer/instore/checkouts/claim", { token: created.qrUrl.split("/tt/")[1] });
    const paid = await hoa.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 0, method: "vnpay_qr" });
    const reference = new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    await pool.query("UPDATE instore.checkouts SET sale_input = jsonb_set(sale_input, '{expectedTotal}', '\"999\"') WHERE id = $1", [created.id]);
    await ipn(vnpayQuery(reference, 110000));
    const cancelled = await call(manager, "post", `/retail/checkouts/${created.id}/cancel`, { reason: "Hoàn tiền cho khách" });
    expect(cancelled.body.status).toBe("cancelled");
    expect((await pool.query("SELECT reason FROM marketplace.refunds WHERE checkout_id = $1", [created.id])).rows).toEqual([{ reason: "instore_cancelled" }]);
    const shift = (await call(cashier, "get", `/retail/shifts/${shiftId}`)).body;
    const closed = await call(cashier, "post", `/retail/shifts/${shiftId}/close`, { countedCash: shift.expectedCash ?? "0", version: shift.version, differenceReason: "Kiểm thử" });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    expect(closed.body.status).toBe("closed");
  });
});
