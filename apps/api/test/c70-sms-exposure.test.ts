// CONG_VIEC_70 (THAY_DOI_36): phí tin nhắn OTP chưa vào bảng đối soát tính vào dư nợ xét hạn mức của cửa hàng liên kết, kèm thuế:
// dư nợ cộng F + làm tròn (F × 10 %) (TIEUCHI_NGHIEMTHU_535; KICHBAN_KIEMTHU_731 đến 733).
// Giai đoạn điểm: 1 điểm = 1.000 đồng, đổi tối đa 50 %, tối thiểu 10 điểm; cửa hàng tích 2 %, phí dịch vụ 8 %; hạn mức nợ 10.000 đồng.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AffiliateReportsService } from "../src/affiliate/reports.service";
import { AffiliateSettlementsService } from "../src/affiliate/settlements.service";
import { merchantExposure } from "../src/affiliate/transactions.service";
import { DATABASE, type Database } from "../src/database/database.module";
import { prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let keyId: string;
let secret: string;
type Buyer = { id: string; call: BuyerCall; phone: string };
let buyer: Buyer;
let smsBuyer: Buyer;

const exposure = () => merchantExposure(application.get<Database>(DATABASE), fixture.merchantId);
// Ghi tin OTP đã gửi thẳng vào bảng phí (đường gửi thật đã có kiểm thử ở c67-otp-sms).
const recordSms = async (count: number, unitPrice: string) => {
  for (let index = 0; index < count; index += 1) {
    await pool.query("INSERT INTO affiliate.sms_charges (merchant_id, api_key_id, buyer_user_id, unit_price) VALUES ($1, $2, $3, $4)", [fixture.merchantId, keyId, smsBuyer.id, unitPrice]);
  }
};

// Thu ngân lập giao dịch mã QR của cửa hàng, khách xác nhận với số điểm dùng.
async function sale(billAmount: string, points: number) {
  const created = await fixture.cashier.call("post", "/merchant-portal/transactions", { body: { outletId: fixture.outletA, billAmount, method: "merchant_qr" } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const confirmed = await buyer.call("post", `/buyer/affiliate/transactions/${created.body.transaction.id}/confirm`, { points, code: created.body.qrCode });
  expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
  return (await pool.query("SELECT earned_points, redeemed_points, skip_reason FROM affiliate.transactions WHERE id = $1", [created.body.transaction.id])).rows[0] as {
    earned_points: number;
    redeemed_points: number;
    skip_reason: string | null;
  };
}

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
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await prepareAffiliate(application, pool, { creditLimit: "10000" });
  buyer = await fixture.register("0938700001", "Ngô Thị Mai");
  smsBuyer = await fixture.register("0938700002", "Đặng Văn Phúc");
  await fixture.grantPoints(buyer.id, 300);
  const created = await fixture.call("post", `/affiliate/merchants/${fixture.merchantId}/api-keys`, { name: "POS quầy 1", outletIds: [fixture.outletA] });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  keyId = created.body.key.id;
  secret = created.body.secret;
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("TIEUCHI_NGHIEMTHU_535: phí tin nhắn chưa chốt tính vào dư nợ xét hạn mức", () => {
  it("KICHBAN_KIEMTHU_731: phí tin chưa chốt đẩy dư nợ vượt hạn mức thì giao dịch không tích, vẫn dùng điểm; phí mỗi tin 0 đồng giữ nguyên dư nợ", async () => {
    // Tin phí 0 đồng: dư nợ như cũ; giao dịch 100.000 không dùng điểm tích 2 điểm (2.000 ≤ 10.000).
    await recordSms(5, "0");
    expect(await exposure()).toBe(0);
    expect(await sale("100000", 0)).toEqual({ earned_points: 2, redeemed_points: 0, skip_reason: null });
    expect(await exposure()).toBe(2000);

    // 20 tin × 1.000 đồng chưa chốt: dư nợ = 2.000 + 20.000 + thuế 2.000 = 24.000.
    await recordSms(20, "1000");
    expect(await exposure()).toBe(24000);
    // Dùng 10 điểm (10.000) trên hóa đơn 100.000: 24.000 − 10.000 + 1.800 > 10.000, không tích nhưng vẫn trừ điểm.
    // (Không tính phí tin: 2.000 − 10.000 + 1.800 trong hạn mức, giao dịch sẽ được tích.)
    expect(await sale("100000", 10)).toEqual({ earned_points: 0, redeemed_points: 10, skip_reason: "credit_limit" });
    expect(await exposure()).toBe(14000);
  });

  it("KICHBAN_KIEMTHU_733: báo cáo cổng cửa hàng, báo cáo công ty, cảnh báo dư nợ 80 % gồm phí tin chưa chốt", async () => {
    const today = fixture.today;
    const report = await fixture.owner.call("get", `/merchant-portal/report?from=${today}&to=${today}&groupBy=day`);
    expect(report.status, JSON.stringify(report.body)).toBe(200);
    expect(report.body.exposure).toEqual({ amount: "14000", creditLimit: "10000", remaining: "0", percent: "140.0" });
    const company = await fixture.call("get", `/affiliate/report?from=${today}&to=${today}`);
    expect(company.status, JSON.stringify(company.body)).toBe(200);
    expect(company.body.rows).toEqual([expect.objectContaining({ merchantId: fixture.merchantId, exposure: { amount: "14000", creditLimit: "10000", remaining: "0", percent: "140.0" } })]);
    const alerts = (await fixture.call("get", "/affiliate/alerts?kind=credit_usage")).body as { amount: string; percent: string }[];
    expect(alerts).toEqual([expect.objectContaining({ amount: "14000", limit: "10000", percent: "140.0" })]);
    expect(await application.get(AffiliateReportsService).notifyCreditUsage()).toBe(1);
  });

  it("KICHBAN_KIEMTHU_732: lập bảng tuần không tính trùng phí tin; tin mới tính tiếp; vẫn gửi OTP khi vượt hạn mức", async () => {
    // Đưa mọi tin về tuần trước rồi lập bảng: F = 20.000, thuế 2.000 chuyển vào số còn lại của bảng, dư nợ không đổi.
    await pool.query("UPDATE affiliate.sms_charges SET sent_at = sent_at - interval '7 days' WHERE merchant_id = $1", [fixture.merchantId]);
    expect(await exposure()).toBe(14000);
    const created = await application.get(AffiliateSettlementsService).generateWeekly(fixture.today);
    expect(created).toHaveLength(1);
    const settlement = (await pool.query("SELECT status, transaction_count, sms_count, sms_fee_amount::text, fee_tax_amount::text, net_amount::text FROM affiliate.settlements WHERE id = $1", [created[0]]))
      .rows[0];
    expect(settlement).toEqual({ status: "awaiting_confirmation", transaction_count: 0, sms_count: 25, sms_fee_amount: "20000.0000", fee_tax_amount: "2000.0000", net_amount: "22000.0000" });
    expect(await exposure()).toBe(14000);

    // Dư nợ đang vượt hạn mức: phần mềm cửa hàng vẫn gửi được OTP SMS; tin mới 1.000 đồng cộng 1.100 vào dư nợ.
    await setSmsFee("1000");
    const sent = await request(application.getHttpServer())
      .post("/api/v1/open/affiliate/otp")
      .set("accept-language", "vi")
      .set("authorization", `Bearer ${secret}`)
      .send({ outletId: fixture.outletA, phone: smsBuyer.phone });
    expect(sent.status, JSON.stringify(sent.body)).toBe(204);
    expect(await exposure()).toBe(15100);
  });
});
