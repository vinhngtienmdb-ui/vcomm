// CONG_VIEC_55 L1: giao dịch tích, dùng điểm tại quầy cửa hàng liên kết bằng ba cách định danh; hạn mức; hủy
// (KICHBAN_KIEMTHU_536, 537, 538, 539, 540, 541; TIEUCHI_NGHIEMTHU_370 đến 374).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { creditLot } from "../src/loyalty/ledger.service";
import { lockAccount } from "../src/loyalty/tiers";
import { PermissionService } from "../src/permissions/permission.service";
import { sessionFrom, signIn, type Session } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let owner: Session;
let cashier: Session;
let merchantId: string;
let outletA: string;
let outletB: string;
const operator = testIds.retailCompany;
const http = () => request(application.getHttpServer());
const buyers: Record<"first" | "second" | "third", { id: string; call: BuyerCall; phone: string }> = {} as never;
const balanceOf = async (userId: string) => Number((await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance ?? 0);

async function setOtp(phone: string) {
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
}
async function activate(phone: string): Promise<Session> {
  expect((await http().post("/api/v1/merchant-portal/activation/otp").send({ phone })).status).toBe(204);
  await setOtp(phone);
  const response = await http().post("/api/v1/merchant-portal/activation").send({ phone, code: "246810" });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return sessionFrom(application, response.headers["set-cookie"]);
}
async function register(phone: string, name: string): Promise<{ id: string; call: BuyerCall; phone: string }> {
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await setOtp(phone);
  const created = await http().post("/api/v1/buyer/register").send({ phone, code: "246810", fullName: name, password: "MatKhauNguoiMua@2026" });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  const login = await http().post("/api/v1/buyer/login").send({ phone, password: "MatKhauNguoiMua@2026" });
  const token = login.body.tokens.accessToken as string;
  const call: BuyerCall = (method, path, body) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
  return { id: created.body.user.id, call, phone };
}
// Cộng điểm khởi đầu cho người mua bằng bút toán điều chỉnh cộng (giá trị lúc tích 1.000 đồng, hạn 12 tháng).
async function grantPoints(userId: string, points: number) {
  const database = application.get<Database>(DATABASE);
  await database.transaction(async (transaction) => {
    await lockAccount(transaction, userId);
    const day = application.get(PermissionService).today();
    await creditLot(transaction, { userId, kind: "adjust_add", sourceType: "adjustment", sourceId: randomUUID(), companyId: operator, points, pointValue: 1000, day, validityMonths: 12 });
  });
}
const create = (session: Session, body: object) => session.call("post", "/merchant-portal/transactions", { body });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: operator, body: { companyId: operator } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  const call = (method: "get" | "post" | "put", path: string, body?: object) => admin.call(method, path, { companyId: operator, ...(body ? { body } : {}) });
  const today = application.get(PermissionService).today();
  // Giai đoạn: 1 điểm = 1.000 đồng; đổi tối đa 50 %; tối thiểu 10 điểm; trần 500 điểm mỗi đơn. Hạng Bạc hệ số 1,5 từ 0 đồng để thử hệ số.
  expect(
    (
      await call("post", "/loyalty/phases", {
        startsOn: today,
        endsOn: null,
        earnPercent: "1",
        pointValue: "1000",
        redeemMaxPercent: "50",
        redeemMinPoints: 10,
        validityMonths: 12,
        orderCapPoints: 500,
        monthlyCapPoints: null,
      })
    ).status,
  ).toBe(201);
  const partner = (
    await pool.query<{ id: string }>("INSERT INTO crm.partners (kind, name, tax_code, search_text) VALUES ('organization', 'Cà phê Hạt Nâu', '0311111119', 'ca phe hat nau') RETURNING id")
  ).rows[0]!.id;
  const merchant = await call("post", "/affiliate/merchants", {
    partnerId: partner,
    contractNo: "HDLK-01",
    startsOn: today,
    endsOn: null,
    earnPercent: "2",
    feePercent: "8",
    creditLimit: "30000",
    transactionCap: "5000000",
    paymentTermDays: 7,
    autoConfirmDays: 3,
  });
  merchantId = merchant.body.id;
  outletA = (await call("post", `/affiliate/merchants/${merchantId}/outlets`, { name: "Lê Lợi", address: "12 Lê Lợi" })).body.id;
  outletB = (await call("post", `/affiliate/merchants/${merchantId}/outlets`, { name: "Nguyễn Huệ", address: "88 Nguyễn Huệ" })).body.id;
  expect((await call("post", `/affiliate/merchants/${merchantId}/activate`, { version: merchant.body.version })).status).toBe(201);
  await call("post", `/affiliate/merchants/${merchantId}/owner-invitations`, { fullName: "Trần Minh Khoa", phone: "0909111222" });
  owner = await activate("0909111222");
  await owner.call("post", "/merchant-portal/members", { body: { fullName: "Lê Thu Hà", phone: "0912333444", outletIds: [outletA] } });
  cashier = await activate("0912333444");
  buyers.first = await register("0938000001", "Nguyễn Thị Hồng");
  buyers.second = await register("0938000002", "Trần Văn An");
  buyers.third = await register("0938000003", "Lê Minh Châu");
  await grantPoints(buyers.first.id, 300);
  await grantPoints(buyers.second.id, 300);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_55 giao dịch tại quầy", () => {
  it("KICHBAN_KIEMTHU_536: cách 1 mã QR cửa hàng – khách quét, xác nhận dùng điểm, tích theo tỷ lệ cửa hàng; mã dùng một lần; từ chối; hết hạn", async () => {
    const { first } = buyers;
    const created = await create(cashier, { outletId: outletA, billAmount: "450000", method: "merchant_qr" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.qrCode).toMatch(/^VCLK1\./);
    expect(created.body.transaction).toMatchObject({ status: "pending", method: "merchant_qr", buyerName: null });
    const id = created.body.transaction.id as string;

    const scanned = await first.call("post", "/buyer/affiliate/scan", { code: created.body.qrCode });
    expect(scanned.status, JSON.stringify(scanned.body)).toBe(200);
    expect(scanned.body).toMatchObject({ transactionId: id, merchantName: "Cà phê Hạt Nâu", outletName: "Lê Lợi", billAmount: "450000", balance: 300, maxPoints: 225, minPoints: 10 });
    // Dùng 50 điểm = 50.000 đ; khách trả 400.000 đ; tích 2 % × 400.000 ÷ 1.000 = 8 điểm.
    const confirmed = await first.call("post", `/buyer/affiliate/transactions/${id}/confirm`, { points: 50, code: created.body.qrCode });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body).toMatchObject({ status: "completed", redeemedPoints: 50, redeemedAmount: "50000", paidAmount: "400000", earnedPoints: 8 });
    expect(await balanceOf(first.id)).toBe(300 - 50 + 8);
    const seen = await cashier.call("get", `/merchant-portal/transactions/${id}`);
    expect(seen.body).toMatchObject({ status: "completed", buyerName: "Ng*** H***", earnedAmount: "8000", canCancel: false });
    // Mã đã dùng không quét lại được.
    expect((await buyers.second.call("post", "/buyer/affiliate/scan", { code: created.body.qrCode })).body.error.message).toBe("Mã QR không hợp lệ hoặc đã hết hạn.");
    // Chi tiêu tại cửa hàng liên kết không cộng vào xét hạng.
    expect(Number((await pool.query("SELECT spend_current_year FROM loyalty.accounts WHERE user_id = $1", [first.id])).rows[0].spend_current_year)).toBe(0);

    // Từ chối.
    const declinedQr = await create(cashier, { outletId: outletA, billAmount: "100000", method: "merchant_qr" });
    const declinedId = declinedQr.body.transaction.id;
    expect((await first.call("post", `/buyer/affiliate/transactions/${declinedId}/decline`, { code: declinedQr.body.qrCode })).status).toBe(204);
    expect((await cashier.call("get", `/merchant-portal/transactions/${declinedId}`)).body.status).toBe("declined");
    // Hết hạn 3 phút.
    const late = await create(cashier, { outletId: outletA, billAmount: "100000", method: "merchant_qr" });
    await pool.query("UPDATE affiliate.transactions SET expires_at = now() - interval '1 second' WHERE id = $1", [late.body.transaction.id]);
    expect((await cashier.call("get", `/merchant-portal/transactions/${late.body.transaction.id}`)).body.status).toBe("expired");
    expect((await first.call("post", `/buyer/affiliate/transactions/${late.body.transaction.id}/confirm`, { points: 0, code: late.body.qrCode })).status).toBe(409);

    // Trần mỗi giao dịch; thu ngân không lập ở điểm bán không được gán.
    expect((await create(cashier, { outletId: outletA, billAmount: "6000000", method: "merchant_qr" })).body.error.message).toBe("Tiền hóa đơn vượt trần mỗi giao dịch.");
    expect((await create(cashier, { outletId: outletB, billAmount: "100000", method: "merchant_qr" })).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_537: cách 2 mã thành viên – ký HMAC, 60 giây, dùng một lần; điểm dùng không vượt số khách cho phép", async () => {
    const { second } = buyers;
    const code = (await second.call("post", "/buyer/affiliate/member-code", { points: 40 })).body;
    expect(code.code).toMatch(/^VCTV1\./);
    expect(code.code).not.toContain(second.phone);
    const done = await create(cashier, { outletId: outletA, billAmount: "200000", method: "buyer_qr", memberCode: code.code });
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    // Cho phép 40 điểm; tối đa 100 điểm theo 50 %: dùng 40; khách trả 160.000; tích 2 % → 3 điểm.
    expect(done.body.transaction).toMatchObject({ status: "completed", method: "buyer_qr", redeemedPoints: 40, paidAmount: "160000", earnedPoints: 3 });
    expect((await create(cashier, { outletId: outletA, billAmount: "200000", method: "buyer_qr", memberCode: code.code })).body.error.message).toBe("Mã QR không hợp lệ hoặc đã hết hạn.");
    // Sửa chữ ký hoặc số điểm thì bị từ chối.
    const other = (await second.call("post", "/buyer/affiliate/member-code", { points: 0 })).body.code as string;
    const forgedParts = other.split(".");
    const forged = [forgedParts[0], forgedParts[1], "999", ...forgedParts.slice(3)].join(".");
    expect((await create(cashier, { outletId: outletA, billAmount: "200000", method: "buyer_qr", memberCode: forged })).status).toBe(409);
    // Quá 60 giây.
    const parts = other.split(".");
    const stale = [parts[0], parts[1], parts[2], parts[3], String(Number(parts[4]) - 120), parts[5], parts[6]].join(".");
    expect((await create(cashier, { outletId: outletA, billAmount: "200000", method: "buyer_qr", memberCode: stale })).status).toBe(409);
    // Chỉ tích (0 điểm cho phép).
    const earnOnly = await create(cashier, { outletId: outletA, billAmount: "100000", method: "buyer_qr", memberCode: other });
    expect(earnOnly.body.transaction).toMatchObject({ redeemedPoints: 0, paidAmount: "100000", earnedPoints: 2 });
  });

  it("KICHBAN_KIEMTHU_538: cách 3 số điện thoại – số chưa có tài khoản; một yêu cầu chờ mỗi số; khách xác nhận trên ứng dụng", async () => {
    const { third } = buyers;
    expect((await create(cashier, { outletId: outletA, billAmount: "100000", method: "phone", phone: "0938999999" })).body.error.message).toBe("Số điện thoại chưa có tài khoản VComm.");
    const requested = await create(cashier, { outletId: outletA, billAmount: "100000", method: "phone", phone: third.phone });
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    expect(requested.body.transaction).toMatchObject({ status: "pending", buyerName: "Lê*** C***" });
    expect((await create(cashier, { outletId: outletA, billAmount: "50000", method: "phone", phone: third.phone })).body.error.message).toBe("Số điện thoại này đang có yêu cầu chờ xác nhận.");
    // Người khác không xác nhận được yêu cầu của khách này.
    expect((await buyers.first.call("post", `/buyer/affiliate/transactions/${requested.body.transaction.id}/confirm`, { points: 0 })).status).toBe(409);
    const pending = await third.call("get", "/buyer/affiliate/pending");
    expect(pending.body).toHaveLength(1);
    expect(pending.body[0]).toMatchObject({ transactionId: requested.body.transaction.id, billAmount: "100000", balance: 0, redeemable: false });
    const confirmed = await third.call("post", `/buyer/affiliate/transactions/${requested.body.transaction.id}/confirm`, { points: 0 });
    expect(confirmed.body).toMatchObject({ status: "completed", earnedPoints: 2 });
    expect((await third.call("get", "/buyer/affiliate/transactions")).body).toHaveLength(1);
  });

  it("KICHBAN_KIEMTHU_540: vượt hạn mức nợ thì không tích, vẫn dùng điểm; cửa hàng tạm ngưng không giao dịch", async () => {
    const { first } = buyers;
    // Dư nợ hiện tại: tích 8.000 + 3.000 + 2.000 + 2.000 − dùng 50.000 − 40.000 < 0 → 0. Hạn mức 30.000.
    // Hóa đơn 2.000.000, không dùng điểm: dự tính tích 40.000 > 30.000 → không tích.
    const code = (await first.call("post", "/buyer/affiliate/member-code", { points: 0 })).body.code;
    const blocked = await create(cashier, { outletId: outletA, billAmount: "2000000", method: "buyer_qr", memberCode: code });
    expect(blocked.body.transaction).toMatchObject({ status: "completed", earnedPoints: 0, skipReason: "credit_limit" });
    // Dùng điểm vẫn được khi bị chặn tích.
    const redeemCode = (await first.call("post", "/buyer/affiliate/member-code", { points: 20 })).body.code;
    const redeemed = await create(cashier, { outletId: outletA, billAmount: "100000", method: "buyer_qr", memberCode: redeemCode });
    expect(redeemed.body.transaction).toMatchObject({ redeemedPoints: 20, earnedPoints: 1 });

    const detail = (await admin.call("get", `/affiliate/merchants/${merchantId}`, { companyId: operator })).body;
    await admin.call("post", `/affiliate/merchants/${merchantId}/suspend`, { companyId: operator, body: { version: detail.version, reason: "Thử tạm ngưng" } });
    expect((await create(cashier, { outletId: outletA, billAmount: "100000", method: "merchant_qr" })).body.error.message).toBe("Cửa hàng chưa hoạt động hoặc hợp đồng hết hạn.");
    const again = (await admin.call("get", `/affiliate/merchants/${merchantId}`, { companyId: operator })).body;
    await admin.call("post", `/affiliate/merchants/${merchantId}/activate`, { companyId: operator, body: { version: again.version } });
  });

  it("KICHBAN_KIEMTHU_541: chủ cửa hàng hủy – hoàn điểm đã dùng, trừ lại điểm đã tích; số dư không đủ thì ghi phần thiếu; thu ngân không hủy được", async () => {
    const { first } = buyers;
    const list = await owner.call("get", "/merchant-portal/transactions?status=completed");
    const target = list.body.data.find((item: { redeemedPoints: number; earnedPoints: number }) => item.redeemedPoints === 50);
    expect(target.canCancel).toBe(true);
    expect((await cashier.call("post", `/merchant-portal/transactions/${target.id}/cancel`, { body: { reason: "Khách trả hàng" } })).status).toBe(403);
    const before = await balanceOf(first.id);
    const cancelled = await owner.call("post", `/merchant-portal/transactions/${target.id}/cancel`, { body: { reason: "Khách trả hàng" } });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(201);
    expect(cancelled.body).toMatchObject({ status: "cancelled", cancelReason: "Khách trả hàng", canCancel: false });
    expect(await balanceOf(first.id)).toBe(before + 50 - 8);
    expect((await owner.call("post", `/merchant-portal/transactions/${target.id}/cancel`, { body: { reason: "Lần hai" } })).status).toBe(409);

    // Số dư không đủ trừ lại: khách thứ ba đã tích 2 điểm, dùng hết bằng cách khóa lô rồi hủy → phần thiếu quy tiền, cửa hàng vẫn trả.
    const third = (await owner.call("get", "/merchant-portal/transactions?status=completed")).body.data.find((item: { method: string }) => item.method === "phone");
    await pool.query("UPDATE loyalty.lots SET remaining = 0 WHERE user_id = $1", [buyers.third.id]);
    await pool.query("UPDATE loyalty.accounts SET balance = 0 WHERE user_id = $1", [buyers.third.id]);
    await owner.call("post", `/merchant-portal/transactions/${third.id}/cancel`, { body: { reason: "Nhập sai" } });
    const shortfall = (await pool.query("SELECT shortfall_amount::int AS value FROM affiliate.transactions WHERE id = $1", [third.id])).rows[0].value;
    expect(shortfall).toBe(2000);
    expect(await balanceOf(buyers.third.id)).toBe(0);
    // Tuần đã chốt không hủy được.
    const settled = (await owner.call("get", "/merchant-portal/transactions?status=completed")).body.data[0];
    const settlement = await pool.query<{ id: string }>(
      `INSERT INTO affiliate.settlements (company_id, merchant_id, week_start, fee_percent, fee_tax_rate, confirm_due_at)
       SELECT company_id, id, date_trunc('week', now())::date, fee_percent, 10, now() + interval '3 days' FROM affiliate.merchants WHERE id = $1 RETURNING id`,
      [merchantId],
    );
    await pool.query("UPDATE affiliate.transactions SET settlement_id = $1 WHERE id = $2", [settlement.rows[0]!.id, settled.id]);
    expect((await owner.call("post", `/merchant-portal/transactions/${settled.id}/cancel`, { body: { reason: "Muộn" } })).body.error.message).toBe(
      "Tuần của giao dịch đã chốt đối soát, không hủy được.",
    );
  });

  it("KICHBAN_KIEMTHU_539: thu ngân chỉ thấy giao dịch điểm bán được gán; không có bút toán điểm kế toán theo từng bút toán", async () => {
    const list = await cashier.call("get", "/merchant-portal/transactions");
    expect(list.body.data.every((item: { outletId: string }) => item.outletId === outletA)).toBe(true);
    const journals = await pool.query("SELECT count(*)::int AS total FROM accounting.journals WHERE source_type = 'loyalty_entry'");
    expect(journals.rows[0].total).toBe(0);
  });
});
