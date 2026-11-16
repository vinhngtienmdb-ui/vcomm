// CONG_VIEC_67 lát L1: cửa hàng liên kết tích, đổi điểm qua Open API – khóa của cửa hàng, tra điểm, mã thành viên, số điện thoại, chống trùng, hủy
// (TIEUCHI_NGHIEMTHU_504 đến 509, 512; KICHBAN_KIEMTHU_693 đến 699, 702).
// Giai đoạn điểm của dữ liệu thử: 1 điểm = 1.000 đồng, đổi tối đa 50 %, tối thiểu 10 điểm; cửa hàng tích 2 %.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AffiliateSettlementsService } from "../src/affiliate/settlements.service";
import { generateApiKey } from "../src/open-api/api-key-secret";
import { operator, prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { createTestUser, signIn } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let keyId: string;
let secret: string;
const buyers: Record<"first" | "second" | "third", { id: string; call: BuyerCall; phone: string }> = {} as never;

// Gọi API phần mềm cửa hàng bằng khóa, giả lập IP người gọi.
const open = (method: "get" | "post", path: string, key: string | null, body?: object) => {
  const sent = request(application.getHttpServer())[method](`/api/v1/open${path}`).set("accept-language", "vi").set("x-forwarded-for", "203.113.10.24");
  const withKey = key ? sent.set("authorization", `Bearer ${key}`) : sent;
  return body ? withKey.send(body) : withKey;
};
const balanceOf = async (userId: string) => Number((await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance ?? 0);
let sequence = 0;
const nextCode = () => `POS-LL-${++sequence}`;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await prepareAffiliate(application, pool);
  expect((await fixture.call("post", "/finance/ledger/setup")).status).toBe(201);
  buyers.first = await fixture.register("0938670001", "Nguyễn Thị Hồng");
  buyers.second = await fixture.register("0938670002", "Trần Văn Minh");
  buyers.third = await fixture.register("0938670003", "Lê Thu Trang");
  for (const buyer of Object.values(buyers)) await fixture.grantPoints(buyer.id, 300);
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("TIEUCHI_NGHIEMTHU_504, 505: khóa API của cửa hàng liên kết", () => {
  it("KICHBAN_KIEMTHU_693: cấp khóa cho cửa hàng; điểm bán sai, cửa hàng chấm dứt bị từ chối; quyền xem; chủ cửa hàng chỉ xem", async () => {
    const created = await fixture.call("post", `/affiliate/merchants/${fixture.merchantId}/api-keys`, { name: "Hạt Nâu · máy POS", outletIds: [fixture.outletA] });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    secret = created.body.secret;
    keyId = created.body.key.id;
    expect(secret).toMatch(/^vck_[A-Za-z0-9]{32}$/);
    expect(created.body.key).toMatchObject({ keyPrefix: secret.slice(4, 12), outlets: [{ id: fixture.outletA, name: "Lê Lợi" }], rateLimitPerMinute: 60, smsDailyLimit: 200, status: "active" });
    const stored = (await pool.query("SELECT scopes, channel_id, key_hash FROM core.api_keys WHERE id = $1", [keyId])).rows[0];
    expect(stored).toMatchObject({ scopes: ["loyalty.member"], channel_id: null });
    expect(stored.key_hash).not.toContain(secret);

    const listed = await fixture.call("get", `/affiliate/merchants/${fixture.merchantId}/api-keys`);
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).not.toContain(secret);

    // Điểm bán của cửa hàng khác bị từ chối đúng trường.
    const otherMerchant = await fixture.createMerchant("Tiệm bánh Mây", "0311111127", "HDLK-67");
    const otherOutlet = (await fixture.call("post", `/affiliate/merchants/${otherMerchant}/outlets`, { name: "Mây 1", address: "1 Hai Bà Trưng" })).body.id as string;
    const wrongOutlet = await fixture.call("post", `/affiliate/merchants/${fixture.merchantId}/api-keys`, { name: "Sai điểm bán", outletIds: [otherOutlet] });
    expect(wrongOutlet.status).toBe(400);
    expect(wrongOutlet.body.error.fields).toMatchObject({ outletIds: expect.any(String) });
    // Cửa hàng đã chấm dứt không cấp khóa được.
    await pool.query("UPDATE affiliate.merchants SET status = 'terminated', status_reason = 'Thử' WHERE id = $1", [otherMerchant]);
    expect((await fixture.call("post", `/affiliate/merchants/${otherMerchant}/api-keys`, { name: "Mây POS", outletIds: [otherOutlet] })).status).toBe(409);

    // Nhân viên không có quyền cửa hàng liên kết bị từ chối.
    await createTestUser(pool, "khong.quyen.c67@vcomm.test", "Không Quyền", [{ companyId: operator }]);
    const outsider = await signIn(application, "khong.quyen.c67@vcomm.test");
    expect((await outsider.call("get", `/affiliate/merchants/${fixture.merchantId}/api-keys`, { companyId: operator })).status).toBe(403);

    // Màn hình Khóa API của Nền tảng: không cấp phạm vi điểm thưởng, không sửa khóa cửa hàng; vẫn thấy khóa.
    const platformKeys = await fixture.call("get", "/platform/api-keys");
    expect(platformKeys.body.find((key: { id: string }) => key.id === keyId)).toMatchObject({ channelId: null, channelName: null, scopes: ["loyalty.member"] });
    const patched = await fixture.admin.call("patch", `/platform/api-keys/${keyId}`, {
      companyId: operator,
      body: { name: "Đổi tên", scopes: ["loyalty.member"], channelId: keyId, warehouseIds: [], rateLimitPerMinute: 60, expiresOn: null, allowedIps: [], version: 1 },
    });
    expect(patched.status).toBe(409);

    // Chủ cửa hàng xem kết nối phần mềm; thu ngân không xem được.
    const connection = await fixture.owner.call("get", "/merchant-portal/api-keys");
    expect(connection.status).toBe(200);
    expect(connection.body.keys).toHaveLength(1);
    expect(JSON.stringify(connection.body)).not.toContain(secret);
    expect((await fixture.cashier.call("get", "/merchant-portal/api-keys")).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_694: phạm vi sai hai chiều; cửa hàng tạm ngưng chỉ tra được giao dịch; điểm bán ngoài khóa", async () => {
    expect((await open("get", "/products", secret)).body.error.code).toBe("SCOPE_NOT_GRANTED");
    // Khóa nội bộ chỉ có phạm vi sản phẩm gọi API điểm thưởng.
    const catalogKey = generateApiKey();
    const company = operator;
    const channel = (await pool.query("INSERT INTO catalog.sales_channels (company_id, code, name) VALUES ($1, 'C67', 'Kênh thử') RETURNING id", [company])).rows[0].id;
    const creator = (await pool.query("SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'")).rows[0].id;
    await pool.query(
      `INSERT INTO core.api_keys (company_id, kind, name, key_prefix, key_hash, scopes, channel_id, created_by) VALUES ($1, 'internal', 'Kế toán', $2, $3, ARRAY['catalog.read'], $4, $5)`,
      [company, catalogKey.prefix, catalogKey.hash, channel, creator],
    );
    expect((await open("get", "/affiliate/outlets", catalogKey.secret)).body.error.code).toBe("SCOPE_NOT_GRANTED");

    const outlets = await open("get", "/affiliate/outlets", secret);
    expect(outlets.status).toBe(200);
    expect(outlets.body).toEqual([{ id: fixture.outletA, name: "Lê Lợi", address: "12 Lê Lợi", active: true }]);

    const body = { partnerTransactionCode: nextCode(), outletId: fixture.outletB, billAmount: "100000", method: "phone", phone: buyers.first.phone };
    const outside = await open("post", "/affiliate/transactions", secret, body);
    expect(outside.status).toBe(400);
    expect(outside.body.error.fields).toMatchObject({ outletId: expect.any(String) });

    await pool.query("UPDATE affiliate.merchants SET status = 'suspended', status_reason = 'Thử' WHERE id = $1", [fixture.merchantId]);
    const suspended = await open("post", "/affiliate/transactions", secret, { ...body, outletId: fixture.outletA });
    expect(suspended.status).toBe(409);
    expect(suspended.body.error.message).toBe("Cửa hàng chưa hoạt động hoặc hợp đồng hết hạn.");
    expect((await open("get", "/affiliate/transactions", secret)).status).toBe(200);
    await pool.query("UPDATE affiliate.merchants SET status = 'active', status_reason = NULL WHERE id = $1", [fixture.merchantId]);
  });
});

describe("TIEUCHI_NGHIEMTHU_506 đến 509: tra điểm, giao dịch qua API", () => {
  it("KICHBAN_KIEMTHU_695: tra điểm theo mã thành viên, số điện thoại; không có số dư, số điện thoại, tên đầy đủ", async () => {
    const code = (await buyers.first.call("post", "/buyer/affiliate/member-code", { points: 0 })).body.code as string;
    const byCode = await open("post", "/affiliate/quote", secret, { outletId: fixture.outletA, billAmount: "200000", memberCode: code });
    expect(byCode.status, JSON.stringify(byCode.body)).toBe(200);
    // Tối đa 50 % × 200.000 = 100 điểm; dự kiến 2 % × 200.000 = 4 điểm.
    expect(byCode.body).toMatchObject({ buyerName: "Ng*** H***", redeemable: true, minPoints: 10, maxPoints: 100, pointValue: "1000", estimatedEarnPoints: 4, vouchers: [], smartOtpActive: false });
    const byPhone = await open("post", "/affiliate/quote", secret, { outletId: fixture.outletA, billAmount: "200000", phone: buyers.first.phone });
    expect(byPhone.body).toEqual(byCode.body);
    const text = JSON.stringify(byPhone.body);
    expect(text).not.toContain("balance");
    expect(text).not.toContain("938670001");
    expect(text).not.toContain("Nguyễn Thị Hồng");
    // Mã thành viên chưa bị dùng khi tra điểm.
    expect((await open("post", "/affiliate/quote", secret, { outletId: fixture.outletA, billAmount: "200000", memberCode: code })).status).toBe(200);
    expect((await open("post", "/affiliate/quote", secret, { outletId: fixture.outletA, billAmount: "200000", phone: "0938679999" })).body.error.message).toBe(
      "Số điện thoại chưa có tài khoản VComm.",
    );
  });

  it("KICHBAN_KIEMTHU_696: mã thành viên qua API bằng giao dịch trên cổng; mã dùng một lần", async () => {
    // Qua API: hóa đơn 200.000, khách cho phép 40 điểm.
    const viaApi = (await buyers.first.call("post", "/buyer/affiliate/member-code", { points: 40 })).body.code as string;
    const partnerTransactionCode = nextCode();
    const created = await open("post", "/affiliate/transactions", secret, { partnerTransactionCode, outletId: fixture.outletA, billAmount: "200000", method: "member_code", memberCode: viaApi });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    // Qua cổng cửa hàng cùng dữ liệu cho khách thứ hai.
    const viaPortal = (await buyers.second.call("post", "/buyer/affiliate/member-code", { points: 40 })).body.code as string;
    const portal = await fixture.cashier.call("post", "/merchant-portal/transactions", { body: { outletId: fixture.outletA, billAmount: "200000", method: "buyer_qr", memberCode: viaPortal } });
    expect(portal.status, JSON.stringify(portal.body)).toBe(201);
    const pick = (value: Record<string, unknown>) => ({
      status: value.status,
      redeemedPoints: value.redeemedPoints,
      redeemedAmount: value.redeemedAmount,
      paidAmount: value.paidAmount,
      earnedPoints: value.earnedPoints,
      skipReason: value.skipReason,
    });
    expect(pick(created.body)).toEqual(pick(portal.body.transaction));
    expect(created.body).toMatchObject({ partnerTransactionCode, source: "open_api", method: "buyer_qr", redeemedPoints: 40, paidAmount: "160000", earnedPoints: 3 });
    expect(await balanceOf(buyers.first.id)).toBe(263);

    // Gửi lại cùng mã giao dịch: trả giao dịch cũ; dùng lại mã thành viên với mã giao dịch mới: từ chối.
    const again = await open("post", "/affiliate/transactions", secret, { partnerTransactionCode, outletId: fixture.outletA, billAmount: "999", method: "member_code", memberCode: "x" });
    expect(again.status).toBe(200);
    expect(again.body.documentNo).toBe(created.body.documentNo);
    const reused = await open("post", "/affiliate/transactions", secret, {
      partnerTransactionCode: nextCode(),
      outletId: fixture.outletA,
      billAmount: "200000",
      method: "member_code",
      memberCode: viaApi,
    });
    expect(reused.body.error.message).toBe("Mã QR không hợp lệ hoặc đã hết hạn.");
  });

  it("KICHBAN_KIEMTHU_697: vượt hạn mức nợ thì không tích", async () => {
    // Hạn mức 1 đồng: tích 2.000 đồng tiền điểm vượt hạn mức (giao dịch không dùng điểm nên không giảm dư nợ).
    await pool.query("UPDATE affiliate.merchants SET credit_limit = 1 WHERE id = $1", [fixture.merchantId]);
    const code = (await buyers.third.call("post", "/buyer/affiliate/member-code", { points: 0 })).body.code as string;
    const created = await open("post", "/affiliate/transactions", secret, {
      partnerTransactionCode: nextCode(),
      outletId: fixture.outletA,
      billAmount: "100000",
      method: "member_code",
      memberCode: code,
    });
    expect(created.body).toMatchObject({ status: "completed", redeemedPoints: 0, earnedPoints: 0, skipReason: "credit_limit" });
    await pool.query("UPDATE affiliate.merchants SET credit_limit = 50000000 WHERE id = $1", [fixture.merchantId]);
  });

  it("KICHBAN_KIEMTHU_698: số điện thoại chờ khách xác nhận, từ chối, giới hạn từ chối mỗi giờ theo khóa", async () => {
    const code = nextCode();
    const pending = await open("post", "/affiliate/transactions", secret, {
      partnerTransactionCode: code,
      outletId: fixture.outletA,
      billAmount: "150000",
      method: "phone",
      phone: buyers.second.phone,
    });
    expect(pending.status, JSON.stringify(pending.body)).toBe(201);
    expect(pending.body).toMatchObject({ status: "pending", method: "phone", buyerName: "Tr*** M***" });
    expect(pending.body.expiresAt).not.toBeNull();
    const requests = (await buyers.second.call("get", "/buyer/affiliate/pending")).body;
    expect(requests).toHaveLength(1);
    expect((await buyers.second.call("post", `/buyer/affiliate/transactions/${requests[0].transactionId}/confirm`, { points: 0 })).status).toBe(200);
    expect((await open("get", `/affiliate/transactions/${code}`, secret)).body).toMatchObject({ status: "completed", earnedPoints: 3 });

    const declinedCode = nextCode();
    await open("post", "/affiliate/transactions", secret, { partnerTransactionCode: declinedCode, outletId: fixture.outletA, billAmount: "150000", method: "phone", phone: buyers.second.phone });
    const second = (await buyers.second.call("get", "/buyer/affiliate/pending")).body[0].transactionId as string;
    expect((await buyers.second.call("post", `/buyer/affiliate/transactions/${second}/decline`, {})).status).toBeLessThan(300);
    expect((await open("get", `/affiliate/transactions/${declinedCode}`, secret)).body.status).toBe("declined");

    // Đủ 10 yêu cầu bị từ chối trong giờ của khóa: yêu cầu thứ 11 bị chặn; thu ngân trên cổng không bị ảnh hưởng.
    for (let index = 0; index < 9; index++) {
      await pool.query(
        `INSERT INTO affiliate.transactions (merchant_id, outlet_id, buyer_user_id, method, status, bill_amount, earn_percent, source, api_key_id, partner_transaction_code)
         VALUES ($1, $2, $3, 'phone', 'declined', 1000, 2, 'open_api', $4, $5)`,
        [fixture.merchantId, fixture.outletA, buyers.third.id, keyId, nextCode()],
      );
    }
    const limited = await open("post", "/affiliate/transactions", secret, {
      partnerTransactionCode: nextCode(),
      outletId: fixture.outletA,
      billAmount: "150000",
      method: "phone",
      phone: buyers.third.phone,
    });
    expect(limited.status).toBe(429);
    const portal = await fixture.cashier.call("post", "/merchant-portal/transactions", { body: { outletId: fixture.outletA, billAmount: "150000", method: "phone", phone: buyers.third.phone } });
    expect(portal.status, JSON.stringify(portal.body)).toBe(201);
  });

  it("KICHBAN_KIEMTHU_699: hai lần gửi cùng mã cùng lúc chỉ một giao dịch; hủy qua API; tuần đã chốt không hủy được", async () => {
    const partnerTransactionCode = nextCode();
    const code = (await buyers.third.call("post", "/buyer/affiliate/member-code", { points: 30 })).body.code as string;
    const body = { partnerTransactionCode, outletId: fixture.outletA, billAmount: "100000", method: "member_code", memberCode: code };
    const results = await Promise.all([open("post", "/affiliate/transactions", secret, body), open("post", "/affiliate/transactions", secret, body)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 201]);
    expect((await pool.query("SELECT count(*)::int AS total FROM affiliate.transactions WHERE partner_transaction_code = $1", [partnerTransactionCode])).rows[0].total).toBe(1);

    const before = await balanceOf(buyers.third.id);
    const cancelled = await open("post", `/affiliate/transactions/${partnerTransactionCode}/cancel`, secret, { reason: "Khách trả hàng" });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body).toMatchObject({ status: "cancelled", cancelReason: "Khách trả hàng" });
    // Hoàn 30 điểm đã dùng, trừ lại 1 điểm đã tích (2 % × 70.000 = 1,4).
    expect(await balanceOf(buyers.third.id)).toBe(before + 30 - 1);
    const audit = (
      await pool.query(
        "SELECT actor_user_id, after_data FROM core.audit_events WHERE action = 'affiliate_transaction.cancel' AND entity_id = (SELECT id FROM affiliate.transactions WHERE partner_transaction_code = $1)",
        [partnerTransactionCode],
      )
    ).rows[0];
    expect(audit.actor_user_id).toBeNull();
    expect(audit.after_data).toMatchObject({ apiKeyId: keyId, keyPrefix: secret.slice(4, 12) });
    expect(JSON.stringify(audit.after_data)).not.toContain(secret);
    expect((await open("post", "/affiliate/transactions/KHONG-CO/cancel", secret, { reason: "x" })).status).toBe(404);

    // Lập bảng đối soát tuần (chốt tuần): giao dịch đã chốt không hủy qua API được.
    const settledCode = nextCode();
    const settledMember = (await buyers.first.call("post", "/buyer/affiliate/member-code", { points: 0 })).body.code as string;
    await open("post", "/affiliate/transactions", secret, { partnerTransactionCode: settledCode, outletId: fixture.outletA, billAmount: "50000", method: "member_code", memberCode: settledMember });
    const nextWeek = new Date(Date.parse(`${fixture.today}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
    await application.get(AffiliateSettlementsService).generateWeekly(nextWeek);
    expect((await open("post", `/affiliate/transactions/${settledCode}/cancel`, secret, { reason: "Muộn" })).body.error.message).toBe("Tuần của giao dịch đã chốt đối soát, không hủy được.");
  });
});

describe("TIEUCHI_NGHIEMTHU_512: giao dịch API trên báo cáo, danh sách, nhật ký gọi", () => {
  it("KICHBAN_KIEMTHU_702: danh sách giao dịch có nguồn API; nhật ký gọi không có số điện thoại, mã thành viên", async () => {
    const company = await fixture.call("get", "/affiliate/transactions?pageSize=100");
    const viaApi = company.body.data.filter((item: { source: string }) => item.source === "open_api");
    expect(viaApi.length).toBeGreaterThan(0);
    expect(viaApi[0]).toMatchObject({ cashierName: null, partnerTransactionCode: expect.stringMatching(/^POS-LL-/) });
    const ownerList = await fixture.owner.call("get", "/merchant-portal/transactions?pageSize=100");
    expect(ownerList.body.data.some((item: { source: string }) => item.source === "open_api")).toBe(true);

    const listed = await open("get", "/affiliate/transactions?status=completed&pageSize=100", secret);
    expect(listed.status).toBe(200);
    expect(listed.body.data.every((item: { source: string; status: string }) => item.source === "open_api" && item.status === "completed")).toBe(true);

    // Nhật ký gọi ghi sau khi trả kết quả.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const logs = await fixture.call("get", `/platform/api-call-logs?apiKeyId=${keyId}&pageSize=100`);
    expect(logs.status).toBe(200);
    expect(logs.body.data.length).toBeGreaterThan(5);
    const text = JSON.stringify(logs.body);
    expect(text).not.toContain("938670");
    expect(text).not.toContain("VCTV1");
    expect(logs.body.data.some((row: { path: string }) => row.path.startsWith("/api/v1/open/affiliate/transactions"))).toBe(true);
  });
});
