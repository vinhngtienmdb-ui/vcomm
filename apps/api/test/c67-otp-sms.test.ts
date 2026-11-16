// CONG_VIEC_67 lát L2: tích, đổi điểm qua Open API bằng mã OTP (Smart OTP hoặc SMS); phí tin nhắn OTP vào đối soát tuần (THAY_DOI_31)
// (TIEUCHI_NGHIEMTHU_510, 511; KICHBAN_KIEMTHU_700, 701).
// Giai đoạn điểm: 1 điểm = 1.000 đồng, đổi tối đa 50 %, tối thiểu 10 điểm; cửa hàng tích 2 %, phí dịch vụ 8 %.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AffiliateSettlementsService } from "../src/affiliate/settlements.service";
import { operator, prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let secret: string;
let bigSecret: string;
let smartSecret: string;
type Buyer = { id: string; call: BuyerCall; phone: string };
const buyers: Record<"sms" | "smart" | "many" | "late", Buyer> = {} as never;

const open = (method: "get" | "post", path: string, key: string, body?: object) => {
  const sent = request(application.getHttpServer())[method](`/api/v1/open${path}`).set("accept-language", "vi").set("authorization", `Bearer ${key}`);
  return body ? sent.send(body) : sent;
};
const e164 = (phone: string) => `+84${phone.slice(1)}`;
// Đặt mã SMS đang chờ của số về 246810 (kiểm thử không đọc được mã thật).
const setSmsCode = (phone: string) =>
  pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = 'affiliate_redeem' AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), e164(phone)]);
const totp = (base32: string, offsetSteps = 0) => new TOTP({ secret: Secret.fromBase32(base32), digits: 6, period: 30 }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });
const balanceOf = async (userId: string) => Number((await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance ?? 0);
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
let sequence = 0;
const nextCode = () => `OTP-${++sequence}`;

async function setSmsFee(value: string) {
  const detail = (await fixture.call("get", `/affiliate/merchants/${fixture.merchantId}`)).body;
  const updated = await fixture.call("put", `/affiliate/merchants/${fixture.merchantId}`, {
    contractNo: detail.contractNo,
    startsOn: detail.startsOn,
    endsOn: detail.endsOn,
    earnPercent: detail.earnPercent,
    feePercent: detail.feePercent,
    creditLimit: detail.creditLimit,
    transactionCap: detail.transactionCap,
    paymentTermDays: detail.paymentTermDays,
    autoConfirmDays: detail.autoConfirmDays,
    smsFee: value,
    version: detail.version,
  });
  expect(updated.status, JSON.stringify(updated.body)).toBe(200);
  expect(updated.body.smsFee).toBe(value);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await prepareAffiliate(application, pool);
  expect((await fixture.call("post", "/finance/ledger/setup")).status).toBe(201);
  buyers.sms = await fixture.register("0938680001", "Nguyễn Thị Hồng");
  buyers.smart = await fixture.register("0938680002", "Trần Văn Minh");
  buyers.many = await fixture.register("0938680003", "Lê Thu Trang");
  buyers.late = await fixture.register("0938680004", "Phạm Quốc Bảo");
  for (const buyer of Object.values(buyers)) await fixture.grantPoints(buyer.id, 300);
  // Khách thứ hai kích hoạt Smart OTP trên ứng dụng (CONG_VIEC_53).
  expect((await buyers.smart.call("post", "/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = 'smart_otp' AND consumed_at IS NULL", [
    createHash("sha256").update("246810").digest("hex"),
    e164(buyers.smart.phone),
  ]);
  const activated = await buyers.smart.call("post", "/buyer/loyalty/smart-otp/activate", { code: "246810", deviceName: "iPhone của Minh" });
  expect(activated.status, JSON.stringify(activated.body)).toBe(201);
  smartSecret = activated.body.secret;

  await setSmsFee("800");
  const small = await fixture.call("post", `/affiliate/merchants/${fixture.merchantId}/api-keys`, { name: "POS giới hạn 3 tin", outletIds: [fixture.outletA], smsDailyLimit: 3 });
  secret = small.body.secret;
  const big = await fixture.call("post", `/affiliate/merchants/${fixture.merchantId}/api-keys`, { name: "POS chính", outletIds: [fixture.outletA] });
  bigSecret = big.body.secret;
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("TIEUCHI_NGHIEMTHU_510: mã OTP qua Open API", () => {
  it("KICHBAN_KIEMTHU_700: SMS cho khách chưa có Smart OTP; Smart OTP; mã sai; giới hạn tin mỗi số, mỗi khóa", async () => {
    const outletId = fixture.outletA;
    // Tra điểm cho biết khách nào có Smart OTP.
    expect((await open("post", "/affiliate/quote", bigSecret, { outletId, billAmount: "100000", phone: buyers.smart.phone })).body.smartOtpActive).toBe(true);
    expect((await open("post", "/affiliate/quote", bigSecret, { outletId, billAmount: "100000", phone: buyers.sms.phone })).body.smartOtpActive).toBe(false);

    // Khách có Smart OTP không gửi SMS; số không có tài khoản bị từ chối.
    const smartSms = await open("post", "/affiliate/otp", bigSecret, { outletId, phone: buyers.smart.phone });
    expect(smartSms.status).toBe(409);
    expect(smartSms.body.error.message).toBe("Khách đã có Smart OTP, dùng mã trên ứng dụng VComm.");
    expect((await open("post", "/affiliate/otp", bigSecret, { outletId, phone: "0938689999" })).body.error.message).toBe("Số điện thoại chưa có tài khoản VComm.");

    // SMS: gửi mã, mã sai không lập giao dịch, mã đúng hoàn tất với số điểm yêu cầu.
    expect((await open("post", "/affiliate/otp", secret, { outletId, phone: buyers.sms.phone })).status).toBe(204);
    await setSmsCode(buyers.sms.phone);
    const body = { partnerTransactionCode: nextCode(), outletId, billAmount: "100000", method: "otp", phone: buyers.sms.phone, points: 20 };
    const wrong = await open("post", "/affiliate/transactions", secret, { ...body, otp: "111111" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields).toEqual({ otp: "Mã OTP không đúng hoặc đã hết hạn." });
    expect((await pool.query("SELECT count(*)::int AS total FROM affiliate.transactions WHERE partner_transaction_code = $1", [body.partnerTransactionCode])).rows[0].total).toBe(0);
    const done = await open("post", "/affiliate/transactions", secret, { ...body, otp: "246810" });
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    // Dùng 20 điểm (20.000): khách trả 80.000, tích 2 % = 1 điểm.
    expect(done.body).toMatchObject({ method: "otp", status: "completed", redeemedPoints: 20, paidAmount: "80000", earnedPoints: 1 });
    expect(await balanceOf(buyers.sms.id)).toBe(281);
    // Mã đã dùng không dùng lại được.
    expect((await open("post", "/affiliate/transactions", secret, { ...body, partnerTransactionCode: nextCode(), otp: "246810" })).status).toBe(400);

    // Smart OTP: mã đúng hoàn tất; sai 5 lần liên tiếp thì khóa 15 phút.
    const smart = await open("post", "/affiliate/transactions", bigSecret, {
      partnerTransactionCode: nextCode(),
      outletId,
      billAmount: "100000",
      method: "otp",
      phone: buyers.smart.phone,
      otp: totp(smartSecret),
      points: 0,
    });
    expect(smart.status, JSON.stringify(smart.body)).toBe(201);
    expect(smart.body).toMatchObject({ method: "otp", status: "completed", earnedPoints: 2 });
    const smartWrong = { outletId, billAmount: "100000", method: "otp", phone: buyers.smart.phone, otp: "000000", points: 0 };
    for (let attempt = 1; attempt <= 4; attempt++) {
      const failed = await open("post", "/affiliate/transactions", bigSecret, { ...smartWrong, partnerTransactionCode: nextCode() });
      expect(failed.status).toBe(400);
      expect(failed.body.error.fields.otp).toBe("Mã Smart OTP không đúng hoặc đã dùng. Nhờ khách đọc mã mới trong ứng dụng.");
    }
    const locked = await open("post", "/affiliate/transactions", bigSecret, { ...smartWrong, partnerTransactionCode: nextCode() });
    expect(locked.status).toBe(409);
    expect(locked.body.error.message).toBe("Dùng điểm tại quầy đang tạm khóa 15 phút do nhập sai mã Smart OTP nhiều lần.");

    // Khóa giới hạn 3 tin mỗi ngày: đã gửi 1, gửi thêm 2 được, tin thứ 4 bị chặn.
    expect((await open("post", "/affiliate/otp", secret, { outletId, phone: buyers.sms.phone })).status).toBe(204);
    expect((await open("post", "/affiliate/otp", secret, { outletId, phone: buyers.sms.phone })).status).toBe(204);
    const overKey = await open("post", "/affiliate/otp", secret, { outletId, phone: buyers.sms.phone });
    expect(overKey.status).toBe(429);
    expect(overKey.body.error.message).toBe("Đã hết số tin nhắn OTP trong ngày của khóa API.");

    // Một số tối đa 5 mã mỗi giờ (tính chung mọi mục đích; khách này đã nhận 1 mã đăng ký).
    for (let index = 0; index < 4; index++) expect((await open("post", "/affiliate/otp", bigSecret, { outletId, phone: buyers.many.phone })).status).toBe(204);
    expect((await open("post", "/affiliate/otp", bigSecret, { outletId, phone: buyers.many.phone })).status).toBe(429);

    // Mỗi tin gửi được tính một dòng phí theo đơn giá lúc gửi; tin bị chặn không tính.
    const charges = (await pool.query("SELECT count(*)::int AS total, sum(unit_price)::float AS amount FROM affiliate.sms_charges WHERE merchant_id = $1", [fixture.merchantId])).rows[0];
    expect(charges).toEqual({ total: 7, amount: 5600 });
    const keys = (await fixture.call("get", `/affiliate/merchants/${fixture.merchantId}/api-keys`)).body as { name: string; smsToday: number }[];
    expect(keys.find((key) => key.name === "POS giới hạn 3 tin")!.smsToday).toBe(3);
    const connection = (await fixture.owner.call("get", "/merchant-portal/api-keys")).body;
    expect(connection).toMatchObject({ smsToday: 7, smsWeek: 7, smsFeeWeek: "5600" });

    // Nhật ký gọi không chứa mã OTP, số điện thoại.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const logs = JSON.stringify((await pool.query("SELECT path FROM core.api_call_logs WHERE path LIKE '/api/v1/open/affiliate%'")).rows);
    expect(logs).not.toContain("246810");
    expect(logs).not.toContain("938680");
  });
});

describe("TIEUCHI_NGHIEMTHU_511: phí tin nhắn trong đối soát tuần", () => {
  it("KICHBAN_KIEMTHU_701: đơn giá đổi giữa tuần; bảng có F, E tính trên D + F, số còn lại đúng; bút toán phí vào 511, thuế 3331", async () => {
    // Đổi đơn giá: tin sau tính 1.000 đồng.
    await setSmsFee("1000");
    expect((await open("post", "/affiliate/otp", bigSecret, { outletId: fixture.outletA, phone: buyers.late.phone })).status).toBe(204);

    const service = application.get(AffiliateSettlementsService);
    const created = await service.generateWeekly(addDays(fixture.today, 7));
    expect(created).toHaveLength(1);
    const detail = (await fixture.call("get", `/affiliate/settlements/${created[0]}`)).body;
    // F = 7 × 800 + 1 × 1.000 = 6.600; giao dịch: B = 20.000 → D = 1.600; E = làm tròn((1.600 + 6.600) × 10 %) = 820;
    // A = 1.000 + 2.000; số còn lại = 3.000 + 1.600 + 6.600 + 820 − 20.000 = −7.980.
    expect(detail).toMatchObject({
      smsCount: 8,
      smsFeeAmount: "6600",
      earnedAmount: "3000",
      redeemedAmount: "20000",
      feeAmount: "1600",
      feeTaxAmount: "820",
      netAmount: "-7980",
    });
    expect((await pool.query("SELECT count(*)::int AS total FROM affiliate.sms_charges WHERE settlement_id = $1", [created[0]])).rows[0].total).toBe(8);

    const confirmed = await fixture.owner.call("post", `/merchant-portal/settlements/${created[0]}/confirm`, { body: { version: detail.version } });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    const lines = await pool.query<{ role: string; debit: number; credit: number }>(
      `SELECT r.role, sum(l.debit)::float AS debit, sum(l.credit)::float AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
       JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ('affiliate_fee_revenue', 'affiliate_fee_tax')
       WHERE j.source_type = 'affiliate_settlement' AND j.source_id = $1 AND j.company_id = $2 GROUP BY r.role ORDER BY r.role`,
      [created[0], operator],
    );
    expect(lines.rows).toEqual([
      { role: "affiliate_fee_revenue", debit: 0, credit: 8200 },
      { role: "affiliate_fee_tax", debit: 0, credit: 820 },
    ]);
  });
});
