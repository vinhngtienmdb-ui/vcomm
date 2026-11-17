// CONG_VIEC_73 lát L1: mã thanh toán động, khung đơn chờ thanh toán tại cửa hàng
// (QUYTAC_NGHIEPVU_574 đến 577, 592; TIEUCHI_NGHIEMTHU_546 đến 549; KICHBAN_KIEMTHU_750, 753 đến 755).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { InstoreCheckoutsService, type CheckoutRow } from "../src/instore/checkouts.service";
import { scanFailureLimit } from "../src/instore/pay-code.service";
import type { Session } from "./helpers";
import { assignRetailRole, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication, testClock } from "./setup-database";

type BuyerCall = (method: "get" | "post", path: string, body?: object) => request.Test;

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let checkouts: InstoreCheckoutsService;
let cashier: Session;
let cashierId: string;
let place: { kind: "retail"; companyId: string; storeId: string; registerId: string; shiftId: string };
let secondPlace: typeof place;
const smsCode = "246810";
const password = "MatKhauNguoiMua@2026";

const http = () => request(application.getHttpServer());
const totp = (base32: string, offsetSteps = 0) => new TOTP({ secret: Secret.fromBase32(base32), digits: 6, period: 30 }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });
const setSmsCode = (phone: string, purpose: string) =>
  pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = $3 AND consumed_at IS NULL", [
    createHash("sha256").update(smsCode).digest("hex"),
    `+84${phone.slice(1)}`,
    purpose,
  ]);

// Người mua mới đăng ký và đăng nhập; trả hàm gọi API của người mua.
async function newBuyer(phone: string, fullName: string): Promise<{ id: string; call: BuyerCall }> {
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await setSmsCode(phone, "register");
  const registered = await http().post("/api/v1/buyer/register").send({ phone, code: smsCode, fullName, password });
  expect(registered.status, JSON.stringify(registered.body)).toBe(200);
  const login = await http().post("/api/v1/buyer/login").set("accept-language", "vi").send({ phone, password });
  const token = login.body.tokens.accessToken as string;
  const call: BuyerCall = (method, path, body) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
  return { id: registered.body.user.id, call };
}

async function activateSmartOtp(phone: string, call: BuyerCall): Promise<string> {
  expect((await call("post", "/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
  await setSmsCode(phone, "smart_otp");
  const activated = await call("post", "/buyer/loyalty/smart-otp/activate", { code: smsCode, deviceName: "iPhone", platform: "ios" });
  expect(activated.status, JSON.stringify(activated.body)).toBe(201);
  return activated.body.secret as string;
}

const newCheckout = async (at = place, collectInApp = true) =>
  application.get<Database>(DATABASE).transaction((transaction) =>
    checkouts.create(transaction, {
      operatorCompanyId: retail,
      place: at,
      creator: { source: "retail_counter", userId: cashierId },
      idempotencyKey: randomUUID(),
      billAmount: "262150",
      lines: [{ name: "Gạo ST25 túi 5kg", unit: "Túi", quantity: "1", unitPrice: "262150", amount: "262150", gift: false }],
      collectInApp,
      saleInput: { lines: [] },
    }),
  );
const scanner = () => ({ subject: `user:${cashierId}`, companyId: retail });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  checkouts = application.get(InstoreCheckoutsService);
  fixture = await createRetailFixture(application, pool);
  const store = (await fixture.admin.call("post", "/retail/stores", { companyId: retail, body: storeBody(fixture) })).body;
  await fixture.admin.call("post", `/retail/stores/${store.id}/registers`, { companyId: retail, body: { code: "Q01", name: "Quầy 1" } });
  const registers = (await fixture.admin.call("post", `/retail/stores/${store.id}/registers`, { companyId: retail, body: { code: "Q02", name: "Quầy 2" } })).body.registers;
  cashier = await assignRetailRole(application, pool, "thungan.tt@vcomm.test", "Nguyễn Thị Lan", "cashier", fixture.storeBranch);
  cashierId = (await pool.query("SELECT id FROM core.users WHERE email = $1", ["thungan.tt@vcomm.test"])).rows[0].id;
  const shift = (registerId: string) => cashier.call("post", "/retail/shifts", { companyId: retail, body: { registerId, openingCash: "0" } });
  const firstShift = (await shift(registers[0].id)).body.id;
  // Một thu ngân chỉ mở một ca: quầy 2 dùng ca do cửa hàng trưởng mở.
  const manager = await assignRetailRole(application, pool, "cuahangtruong.tt@vcomm.test", "Võ Văn Trưởng", "store_manager", fixture.storeBranch);
  const secondShift = (await manager.call("post", "/retail/shifts", { companyId: retail, body: { registerId: registers[1].id, openingCash: "0" } })).body.id;
  place = { kind: "retail", companyId: retail, storeId: store.id, registerId: registers[0].id, shiftId: firstShift };
  secondPlace = { kind: "retail", companyId: retail, storeId: store.id, registerId: registers[1].id, shiftId: secondShift };
});

afterAll(async () => {
  testClock.fixed = null;
  await application.close();
  await pool.end();
});

describe("Mã thanh toán động (KICHBAN_KIEMTHU_750)", () => {
  let minh: { id: string; call: BuyerCall };
  let secret: string;
  let prefix: string;

  it("chưa kích hoạt Smart OTP thì không có mã; kích hoạt rồi cấp mã 12 số, cấp lại thì mã cũ hết hiệu lực", async () => {
    minh = await newBuyer("0939730001", "Trần Văn Minh");
    const before = await minh.call("post", "/buyer/instore/pay-code");
    expect(before.status).toBe(409);
    expect(before.body.error.code).toBe("BUSINESS_RULE");
    secret = await activateSmartOtp("0939730001", minh.call);
    const first = await minh.call("post", "/buyer/instore/pay-code");
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.prefix).toMatch(/^[0-9]{12}$/);
    const second = await minh.call("post", "/buyer/instore/pay-code");
    expect(second.body.prefix).not.toBe(first.body.prefix);
    prefix = second.body.prefix;
    const stored = await pool.query("SELECT pay_code_prefix_hash FROM core.smart_otp_devices WHERE user_id = $1", [minh.id]);
    expect(stored.rows[0].pay_code_prefix_hash).not.toContain(prefix);
    const { checkout } = await newCheckout();
    await expect(checkouts.attachPayCode(checkout.id, first.body.prefix + totp(secret), scanner())).rejects.toThrow("instorePayCodeInvalid");
    await checkouts.cancel(checkout.id, cashierId, "Thử mã cũ");
  });

  it("quét mã đúng gắn khách vào đơn; khách thấy đơn đang chờ; mã đã dùng không dùng lại; lệch một bước được nhận", async () => {
    const { checkout } = await newCheckout();
    const attached = await checkouts.attachPayCode(checkout.id, `${prefix.slice(0, 6)} ${prefix.slice(6)} ${totp(secret)}`, scanner());
    expect(attached.buyer_user_id).toBe(minh.id);
    const pending = await minh.call("get", "/buyer/instore/checkouts/pending");
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toMatchObject({ id: checkout.id, documentNo: checkout.document_no, status: "awaiting_buyer", billAmount: "262150.0000", placeName: "Quầy 1", collectInApp: true });
    expect(pending.body[0].lines[0]).toMatchObject({ name: "Gạo ST25 túi 5kg" });
    const notification = await pool.query("SELECT title FROM core.notifications WHERE user_id = $1 AND kind = 'instore.checkout_waiting'", [minh.id]);
    expect(notification.rows[0].title).toContain(checkout.document_no);
    // Quét mã khác vào đơn đã có khách.
    await expect(checkouts.attachPayCode(checkout.id, prefix + totp(secret, 1), scanner())).rejects.toThrow("instoreCheckoutHasBuyer");
    const other = await newCheckout(secondPlace);
    await expect(checkouts.attachPayCode(other.checkout.id, prefix + totp(secret), scanner())).rejects.toThrow("instorePayCodeInvalid");
    expect((await checkouts.attachPayCode(other.checkout.id, prefix + totp(secret, 1), scanner())).buyer_user_id).toBe(minh.id);
    await checkouts.cancel(checkout.id, cashierId, "Khách đổi ý");
    await checkouts.cancel(other.checkout.id, cashierId, "Khách đổi ý");
  });

  it("khách đang khóa dùng điểm vẫn được định danh bằng mã thanh toán", async () => {
    await pool.query("UPDATE core.account_security SET redeem_locked_until = now() + interval '1 hour' WHERE user_id = $1", [minh.id]);
    const { checkout } = await newCheckout();
    // Bước hiện tại và bước kế đã dùng ở trên: thử ở 90 giây sau.
    testClock.fixed = new Date(Date.now() + 90_000);
    try {
      expect((await checkouts.attachPayCode(checkout.id, prefix + totp(secret, 3), scanner())).buyer_user_id).toBe(minh.id);
    } finally {
      testClock.fixed = null;
      await checkouts.cancel(checkout.id, cashierId, "Thử khóa dùng điểm");
    }
    await pool.query("UPDATE core.account_security SET redeem_locked_until = NULL WHERE user_id = $1", [minh.id]);
  });

  it(`quét sai ${scanFailureLimit} lần trong một giờ thì khóa quét mã của thu ngân`, async () => {
    const { checkout } = await newCheckout();
    const wrongScanner = { subject: `user:${randomUUID()}`, companyId: retail };
    for (let attempt = 0; attempt < scanFailureLimit; attempt += 1)
      await expect(checkouts.attachPayCode(checkout.id, "000000000000123456", wrongScanner)).rejects.toThrow("instorePayCodeInvalid");
    await expect(checkouts.attachPayCode(checkout.id, prefix + totp(secret), wrongScanner)).rejects.toThrow("instoreScanLocked");
    await expect(checkouts.attachPayCode(checkout.id, "12ab", scanner())).rejects.toThrow("instorePayCodeInvalid");
    await checkouts.cancel(checkout.id, cashierId, "Thử khóa quét");
  });
});

describe("Đơn chờ thanh toán (KICHBAN_KIEMTHU_753 đến 755, phần khung)", () => {
  let lan: { id: string; call: BuyerCall };
  let hoa: { id: string; call: BuyerCall };

  beforeAll(async () => {
    lan = await newBuyer("0939730002", "Lê Thị Lan");
    hoa = await newBuyer("0939730003", "Phạm Thị Hoa");
  });

  it("khóa yêu cầu không tạo trùng; mỗi quầy một đơn chờ", async () => {
    const key = randomUUID();
    const input = {
      operatorCompanyId: retail,
      place,
      creator: { source: "retail_counter" as const, userId: cashierId },
      idempotencyKey: key,
      billAmount: "50000",
      lines: [],
      collectInApp: true,
      saleInput: { lines: [] },
    };
    const database = application.get<Database>(DATABASE);
    const first = await database.transaction((transaction) => checkouts.create(transaction, input));
    const again = await database.transaction((transaction) => checkouts.create(transaction, input));
    expect(first.created).toBe(true);
    expect(again).toMatchObject({ created: false, qrToken: "" });
    expect(again.checkout.id).toBe(first.checkout.id);
    expect(new Date(first.checkout.expires_at).getTime() - Date.now()).toBeGreaterThan(9 * 60_000);
    await expect(newCheckout()).rejects.toThrow("instoreRegisterBusy");
    await checkouts.cancel(first.checkout.id, cashierId, "Thử trùng");
  });

  it("khách quét mã QR: khách đầu tiên được gắn; khách khác bị từ chối; mã sai bị từ chối", async () => {
    const { checkout, qrToken } = await newCheckout();
    const claimed = await lan.call("post", "/buyer/instore/checkouts/claim", { token: qrToken });
    expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
    expect(claimed.body).toMatchObject({ id: checkout.id, status: "awaiting_buyer", storeName: expect.any(String) });
    expect((await lan.call("post", "/buyer/instore/checkouts/claim", { token: qrToken })).status).toBe(200);
    const taken = await hoa.call("post", "/buyer/instore/checkouts/claim", { token: qrToken });
    expect(taken.status).toBe(409);
    expect(taken.body.error.message).toBe("Đơn đang được khách khác thanh toán.");
    expect((await hoa.call("get", `/buyer/instore/checkouts/${checkout.id}`)).status).toBe(404);
    const wrong = await hoa.call("post", "/buyer/instore/checkouts/claim", { token: "a".repeat(32) });
    expect(wrong.status).toBe(409);
    expect(wrong.body.error.message).toBe("Không tìm thấy đơn hoặc mã đã hết hạn. Nhờ cửa hàng tạo mã mới.");
    expect((await hoa.call("post", "/buyer/instore/checkouts/claim", { token: "ngắn" })).status).toBe(400);
    await checkouts.cancel(checkout.id, cashierId, "Thử quét QR");
  });

  it("khách từ chối; đơn đã đóng không từ chối, không mở lại được", async () => {
    const { checkout, qrToken } = await newCheckout();
    await lan.call("post", "/buyer/instore/checkouts/claim", { token: qrToken });
    const declined = await lan.call("post", `/buyer/instore/checkouts/${checkout.id}/decline`);
    expect(declined.body.status).toBe("declined");
    expect((await lan.call("post", `/buyer/instore/checkouts/${checkout.id}/decline`)).status).toBe(409);
    expect((await hoa.call("post", "/buyer/instore/checkouts/claim", { token: qrToken })).status).toBe(409);
    await expect(checkouts.cancel(checkout.id, cashierId, "Đã đóng")).rejects.toThrow("instoreCheckoutClosed");
  });

  it("hết hạn sau 10 phút: khách thấy Hết hạn, việc nền đóng đơn, quầy tạo được đơn mới", async () => {
    const { checkout, qrToken } = await newCheckout();
    await lan.call("post", "/buyer/instore/checkouts/claim", { token: qrToken });
    testClock.fixed = new Date(Date.now() + 10 * 60_000 + 1000);
    try {
      expect((await lan.call("get", `/buyer/instore/checkouts/${checkout.id}`)).body.status).toBe("expired");
      expect((await lan.call("get", "/buyer/instore/checkouts/pending")).body).toEqual([]);
      // Quầy tạo đơn mới ngay cả khi việc nền chưa đóng đơn quá hạn.
      const next = await newCheckout();
      const row = (await pool.query<Pick<CheckoutRow, "status">>("SELECT status FROM instore.checkouts WHERE id = $1", [checkout.id])).rows[0]!;
      expect(row.status).toBe("expired");
      expect(next.checkout.status).toBe("awaiting_buyer");
      await checkouts.cancel(next.checkout.id, cashierId, "Dọn");
      // Việc nền đóng đơn quá hạn của quầy khác.
      const other = await newCheckout(secondPlace);
      testClock.fixed = new Date(Date.now() + 21 * 60_000);
      expect(await checkouts.expireDue()).toBeGreaterThanOrEqual(1);
      expect((await pool.query("SELECT status FROM instore.checkouts WHERE id = $1", [other.checkout.id])).rows[0].status).toBe("expired");
    } finally {
      testClock.fixed = null;
    }
  });
});
