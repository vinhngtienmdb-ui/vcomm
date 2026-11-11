// CONG_VIEC_53 lát L6: điểm tại quầy với Smart OTP (QUYTAC_NGHIEPVU_377, 379; TIEUCHI_NGHIEMTHU_357; KICHBAN_KIEMTHU_519).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { creditLot } from "../src/loyalty/ledger.service";
import { lockAccount } from "../src/loyalty/tiers";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { assignRetailRole, createRetailCatalog, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication } from "./setup-database";

type BuyerCall = (method: "get" | "post" | "delete", path: string, body?: object) => request.Test;

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let cashier: Session;
let manager: Session;
let units: Record<string, string> = {};
let items: Record<string, string> = {};
let cashierShift: string;
let managerShift: string;
let buyerId: string;
let buyer: BuyerCall;
let secret: string;
const phone = "0939300001";
const password = "MatKhauNguoiMua@2026";
const smsCode = "246810";

const call = (session: Session, method: "get" | "post", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const http = () => request(application.getHttpServer());
const rice = (quantity: string) => ({ variantId: items.rice, unitId: units.CAI, quantity });
const balance = async () => (await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [buyerId])).rows[0].balance as number;
const setSmsCode = (purpose: string) =>
  pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = $3 AND consumed_at IS NULL", [
    createHash("sha256").update(smsCode).digest("hex"),
    `+84${phone.slice(1)}`,
    purpose,
  ]);
const totp = (base32: string, offsetSteps = 0) => new TOTP({ secret: Secret.fromBase32(base32), digits: 6, period: 30 }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });
const sell = (lines: Record<string, unknown>[], total: string, customer?: Record<string, unknown>, payments?: Record<string, unknown>[]) =>
  call(cashier, "post", "/retail/sales", {
    shiftId: cashierShift,
    clientKey: randomUUID(),
    lines,
    customer,
    expectedTotal: total,
    payments: payments ?? [{ method: "cash", amount: total }],
  });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  fixture = await createRetailFixture(application, pool);
  ({ units, items } = await createRetailCatalog(application, pool, fixture, today));
  // Công ty bán lẻ vận hành sàn: bút toán điểm một công ty.
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: retail, body: { companyId: retail } })).status).toBe(200);
  // Tích 2%, 1 điểm = 1 đồng, dùng tối đa 50% tiền hàng, tối thiểu 1.000 điểm.
  const phase = { startsOn: today, endsOn: null, earnPercent: "2", pointValue: "1", redeemMaxPercent: "50", redeemMinPoints: 1000, validityMonths: 12, orderCapPoints: null, monthlyCapPoints: null };
  const created = await fixture.admin.call("post", "/loyalty/phases", { companyId: retail, body: phase });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const store = (await call(fixture.admin, "post", "/retail/stores", storeBody(fixture))).body;
  await call(fixture.admin, "post", `/retail/stores/${store.id}/registers`, { code: "Q01", name: "Quầy 1" });
  const registers = (await call(fixture.admin, "post", `/retail/stores/${store.id}/registers`, { code: "Q02", name: "Quầy 2" })).body.registers;
  cashier = await assignRetailRole(application, pool, "thungan.diem@vcomm.test", "Nguyễn Thị Lan", "cashier", fixture.storeBranch);
  manager = await assignRetailRole(application, pool, "cuahangtruong.diem@vcomm.test", "Võ Văn Trưởng", "store_manager", fixture.storeBranch);
  cashierShift = (await call(cashier, "post", "/retail/shifts", { registerId: registers[0].id, openingCash: "0" })).body.id;
  managerShift = (await call(manager, "post", "/retail/shifts", { registerId: registers[1].id, openingCash: "1000000" })).body.id;
  // Người mua VComm có 20.000 điểm.
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await setSmsCode("register");
  const registered = await http().post("/api/v1/buyer/register").send({ phone, code: smsCode, fullName: "Trần Văn Minh", password });
  expect(registered.status, JSON.stringify(registered.body)).toBe(200);
  buyerId = registered.body.user.id;
  const login = await http().post("/api/v1/buyer/login").set("accept-language", "vi").send({ phone, password });
  const token = login.body.tokens.accessToken as string;
  buyer = (method, path, body) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
  await application.get<Database>(DATABASE).transaction(async (transaction) => {
    await lockAccount(transaction, buyerId);
    await creditLot(transaction, {
      userId: buyerId,
      kind: "adjust_add",
      sourceType: "adjustment",
      sourceId: randomUUID(),
      companyId: retail,
      points: 20000,
      pointValue: 1,
      day: today,
      validityMonths: 12,
    });
  });
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Điểm tại quầy với Smart OTP (KICHBAN_KIEMTHU_519)", () => {
  it("tra khách theo số điện thoại: tên che, điểm, mức dùng theo giỏ; số chưa có tài khoản", async () => {
    const missing = await call(cashier, "get", `/retail/customers?shiftId=${cashierShift}&phone=0988888999`);
    expect(missing.body).toMatchObject({ found: false, maskedPhone: "098****999" });
    const found = await call(cashier, "get", `/retail/customers?shiftId=${cashierShift}&phone=${phone}&goodsAmount=110000`);
    expect(found.body).toMatchObject({
      found: true,
      userId: buyerId,
      maskedName: "Tr** Vă* Minh",
      maskedPhone: "093****001",
      balance: 20000,
      minPoints: 1000,
      maxPoints: 20000,
      smartOtpActive: false,
      redeemBlockedReason: "smart_otp_inactive",
      expectedPoints: 2200,
    });
  });

  it("kích hoạt Smart OTP trên ứng dụng bằng mã SMS; sai mã SMS bị từ chối", async () => {
    expect((await buyer("get", "/buyer/loyalty/smart-otp")).body).toMatchObject({ active: false, maskedPhone: "093****001" });
    expect((await buyer("post", "/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
    await setSmsCode("smart_otp");
    expect((await buyer("post", "/buyer/loyalty/smart-otp/activate", { code: "000000", deviceName: "iPhone của Minh" })).status).toBe(409);
    const activated = await buyer("post", "/buyer/loyalty/smart-otp/activate", { code: smsCode, deviceName: "iPhone của Minh" });
    expect(activated.status, JSON.stringify(activated.body)).toBe(201);
    expect(activated.body).toMatchObject({ active: true, deviceName: "iPhone của Minh", digits: 6, period: 30 });
    secret = activated.body.secret;
    expect((await call(cashier, "get", `/retail/customers?shiftId=${cashierShift}&phone=${phone}`)).body).toMatchObject({ smartOtpActive: true });
  });

  it("chỉ tích điểm khi không dùng điểm; tích theo tiền hàng gồm thuế", async () => {
    const sale = await sell([rice("1")], "110000", { userId: buyerId });
    expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    expect(sale.body.loyalty).toMatchObject({ maskedName: "Tr** Vă* Minh", pointsUsed: 0, pointsEarned: 2200, balanceAfter: 22200 });
    expect(await balance()).toBe(22200);
  });

  it("dùng điểm cần mã Smart OTP đúng; sai mã ghi lần sai; mã đúng dùng một lần", async () => {
    const missingCode = await sell([rice("2")], "220000", { userId: buyerId, points: 10000 }, [{ method: "cash", amount: "210000" }]);
    expect(missingCode.body.error.fields).toEqual({ "customer.smartOtp": "Nhập mã Smart OTP của khách để dùng điểm." });
    const wrong = await sell([rice("2")], "220000", { userId: buyerId, points: 10000, smartOtp: "000000" }, [{ method: "cash", amount: "210000" }]);
    expect(wrong.body.error.message).toBe("Mã Smart OTP không đúng hoặc đã dùng. Nhờ khách đọc mã mới trong ứng dụng.");
    expect((await pool.query("SELECT failed_count FROM loyalty.smart_otp_devices WHERE user_id = $1", [buyerId])).rows[0].failed_count).toBe(1);
    const code = totp(secret);
    const paid = await sell([rice("2")], "220000", { userId: buyerId, points: 10000, smartOtp: code }, [{ method: "cash", amount: "210000" }]);
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    expect(paid.body.payments).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "cash", amount: "210000" }), expect.objectContaining({ method: "points", amount: "10000", points: "10000" })]),
    );
    // Tích theo tiền hàng trừ tiền điểm: 2% × 210.000.
    expect(paid.body.loyalty).toMatchObject({ pointsUsed: 10000, pointsAmount: "10000", pointsEarned: 4200 });
    expect(await balance()).toBe(22200 - 10000 + 4200);
    expect((await pool.query("SELECT failed_count FROM loyalty.smart_otp_devices WHERE user_id = $1", [buyerId])).rows[0].failed_count).toBe(0);
    const reused = await sell([rice("1")], "110000", { userId: buyerId, points: 1000, smartOtp: code }, [{ method: "cash", amount: "109000" }]);
    expect(reused.body.error.message).toBe("Mã Smart OTP không đúng hoặc đã dùng. Nhờ khách đọc mã mới trong ứng dụng.");
    expect((await pool.query("SELECT failed_count FROM loyalty.smart_otp_devices WHERE user_id = $1", [buyerId])).rows[0].failed_count).toBe(1);
  });

  it("trả hàng: hoàn điểm đã dùng, thu hồi điểm đã tích theo tỷ lệ; tiền hoàn trừ phần điểm", async () => {
    const sale = (await call(cashier, "get", "/retail/sales")).body.items.find((item: { totalAmount: string }) => item.totalAmount === "220000");
    const detail = (await call(manager, "get", `/retail/sales/${sale.id}/returnable?shiftId=${managerShift}`)).body;
    const line = detail.lines[0];
    const quote = await call(manager, "post", "/retail/returns/quote", { shiftId: managerShift, saleId: sale.id, lines: [{ orderLineId: line.orderLineId, quantity: "1" }] });
    expect(quote.body).toMatchObject({ goodsAmount: "110000", refundedPoints: 5000, refundedPointsAmount: "5000", reversedPoints: 2100, shortfallAmount: "0", refundAmount: "105000" });
    const before = await balance();
    const returned = await call(manager, "post", "/retail/returns", {
      shiftId: managerShift,
      saleId: sale.id,
      clientKey: randomUUID(),
      reason: "Khách đổi ý",
      lines: [{ orderLineId: line.orderLineId, quantity: "1" }],
      refund: { method: "cash" },
      expectedRefund: "105000",
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    expect(returned.body).toMatchObject({ goodsAmount: "110000", refundAmount: "105000" });
    expect(returned.body.refunds).toEqual(
      expect.arrayContaining([expect.objectContaining({ method: "cash", amount: "105000" }), expect.objectContaining({ method: "points", amount: "5000", points: "5000" })]),
    );
    expect(await balance()).toBe(before + 5000 - 2100);
  });

  it("sai mã 5 lần liên tiếp thì khóa dùng điểm 15 phút; vẫn tích điểm được", async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) await sell([rice("1")], "110000", { userId: buyerId, points: 1000, smartOtp: "000000" }, [{ method: "cash", amount: "109000" }]);
    const locked = await call(cashier, "get", `/retail/customers?shiftId=${cashierShift}&phone=${phone}&goodsAmount=110000`);
    expect(locked.body).toMatchObject({ redeemBlockedReason: "smart_otp_locked", smartOtpLockedUntil: expect.any(String) });
    const blocked = await sell([rice("1")], "110000", { userId: buyerId, points: 1000, smartOtp: totp(secret, 1) }, [{ method: "cash", amount: "109000" }]);
    expect(blocked.body.error.message).toBe("Dùng điểm tại quầy đang tạm khóa 15 phút do nhập sai mã Smart OTP nhiều lần.");
    expect((await sell([rice("1")], "110000", { userId: buyerId })).status).toBe(201);
    expect((await buyer("get", "/buyer/loyalty/smart-otp")).body.lockedUntil).toEqual(expect.any(String));
  });

  it("kích hoạt máy mới thì khóa cũ hết hiệu lực; hủy Smart OTP", async () => {
    await pool.query("UPDATE loyalty.smart_otp_devices SET locked_until = NULL WHERE user_id = $1", [buyerId]);
    expect((await buyer("post", "/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
    await setSmsCode("smart_otp");
    const second = await buyer("post", "/buyer/loyalty/smart-otp/activate", { code: smsCode, deviceName: "Máy mới" });
    expect(second.body.secret).not.toBe(secret);
    const old = await sell([rice("1")], "110000", { userId: buyerId, points: 1000, smartOtp: totp(secret, 1) }, [{ method: "cash", amount: "109000" }]);
    expect(old.status).toBe(409);
    expect((await buyer("delete", "/buyer/loyalty/smart-otp")).body).toMatchObject({ active: false });
    const inactive = await sell([rice("1")], "110000", { userId: buyerId, points: 1000, smartOtp: totp(second.body.secret) }, [{ method: "cash", amount: "109000" }]);
    expect(inactive.body.error.message).toBe("Khách chưa kích hoạt Smart OTP. Mời khách mở ứng dụng VComm → Điểm thưởng → Kích hoạt Smart OTP.");
  });

  it("đóng ca: dòng điểm không vào chứng từ quỹ; phải thu không đối tượng về 0", async () => {
    for (const [session, shiftId] of [
      [cashier, cashierShift],
      [manager, managerShift],
    ] as const) {
      const shift = (await call(session, "get", `/retail/shifts/${shiftId}`)).body;
      const closed = await call(session, "post", `/retail/shifts/${shiftId}/close`, { countedCash: shift.expectedCash, version: shift.version });
      expect(closed.status, JSON.stringify(closed.body)).toBe(201);
      expect(closed.body.fundDocuments.every((document: { kind: string }) => ["retail_receipt", "retail_refund"].includes(document.kind))).toBe(true);
    }
    const receivable = await pool.query<{ balance: string }>(
      `SELECT coalesce(sum(l.debit - l.credit), 0)::text AS balance FROM accounting.journal_lines l JOIN accounting.accounts a ON a.id = l.account_id
       JOIN accounting.journals j ON j.id = l.journal_id WHERE a.code = '131' AND l.partner_id IS NULL AND j.company_id = $1`,
      [retail],
    );
    expect(Number(receivable.rows[0]!.balance)).toBe(0);
  });
});
