// CONG_VIEC_55 L2: voucher liên kết ba loại – tạo, duyệt, nhận, dùng tại quầy, hủy trả voucher, hết hạn
// (KICHBAN_KIEMTHU_542, 543; TIEUCHI_NGHIEMTHU_375).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AffiliateVouchersService } from "../src/affiliate/vouchers.service";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let approver: Session;
let buyer: { id: string; call: BuyerCall; phone: string };
let other: { id: string; call: BuyerCall; phone: string };
let otherMerchant: string;
const balanceOf = async (userId: string) => Number((await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance ?? 0);

async function decide(requestId: string, decision: "approved" | "rejected") {
  const decided = await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision, comment: "Ý kiến" } });
  expect(decided.status, JSON.stringify(decided.body)).toBe(200);
  await application.get(OutboxService).dispatchPending();
}
const voucher = (overrides: object = {}) => ({
  titleVi: "Giảm 10 % đồ uống",
  titleEn: "10% off drinks",
  discountKind: "percent",
  discountValue: "10",
  maxDiscount: "30000",
  minBill: "100000",
  totalQuantity: 2,
  perBuyerLimit: 1,
  claimFrom: fixture.today,
  claimTo: fixture.today,
  validDays: 30,
  ...overrides,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await prepareAffiliate(application, pool);
  const policy = await fixture.call("post", "/approval-policies", {
    documentTypeCode: "affiliate.voucher",
    currency: "VND",
    effectiveFrom: "2026-01-01",
    levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
  });
  expect(policy.status, JSON.stringify(policy.body)).toBe(201);
  approver = await signIn(application, "phuc.le@vcomm.test");
  buyer = await fixture.register("0938100001", "Nguyễn Thị Hồng");
  other = await fixture.register("0938100002", "Trần Văn An");
  await fixture.grantPoints(buyer.id, 300);
  otherMerchant = await fixture.createMerchant("Tiệm bánh Mây", "0322222229", "HDLK-02");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_55 voucher liên kết", () => {
  let freeId: string;
  let pointsId: string;
  let companyId: string;

  it("KICHBAN_KIEMTHU_542: ba loại voucher qua duyệt; người lập không tự duyệt; nhận đúng giới hạn, trừ điểm khi đổi bằng điểm", async () => {
    const { owner, call } = fixture;
    // Cửa hàng tặng miễn phí: 10 %, tối đa 30.000, hóa đơn từ 100.000.
    const free = await owner.call("post", "/merchant-portal/vouchers", { body: { issuer: "merchant_free", ...voucher() } });
    expect(free.status, JSON.stringify(free.body)).toBe(201);
    expect(free.body).toMatchObject({ issuer: "merchant_free", status: "draft", displayStatus: "draft", maxDiscount: "30000", merchantId: fixture.merchantId });
    freeId = free.body.id;
    // Đổi bằng điểm thiếu giá điểm bị từ chối.
    expect((await owner.call("post", "/merchant-portal/vouchers", { body: { issuer: "merchant_points", ...voucher() } })).status).toBe(400);
    const points = await owner.call("post", "/merchant-portal/vouchers", {
      body: {
        issuer: "merchant_points",
        pointsPrice: 40,
        ...voucher({ titleVi: "Bánh 50.000", titleEn: "Pastry", discountKind: "amount", discountValue: "50000", maxDiscount: null, minBill: "80000" }),
      },
    });
    expect(points.body).toMatchObject({ pointsPrice: 40, maxDiscount: "50000" });
    pointsId = points.body.id;
    // Công ty phát hành, chỉ dùng tại cửa hàng thứ nhất.
    const company = await call("post", "/affiliate/vouchers", {
      ...voucher({ titleVi: "VComm tặng 20.000", titleEn: "VComm 20,000", discountKind: "amount", discountValue: "20000", maxDiscount: null, totalQuantity: 10 }),
      merchantIds: [fixture.merchantId],
    });
    expect(company.status, JSON.stringify(company.body)).toBe(201);
    expect(company.body).toMatchObject({ issuer: "company", merchantIds: [fixture.merchantId] });
    companyId = company.body.id;

    // Khách chưa thấy voucher nháp.
    expect((await buyer.call("get", "/buyer/affiliate/vouchers")).body).toHaveLength(0);
    // Gửi duyệt; quản trị công ty là người thay thế nhưng tự lập voucher công ty thì không tự duyệt.
    const submitted = [];
    for (const [session, path, id] of [
      [owner, "/merchant-portal/vouchers", freeId],
      [owner, "/merchant-portal/vouchers", pointsId],
    ] as const) {
      const sent = await session.call("post", `${path}/${id}/submit`, { body: { version: 1 } });
      expect(sent.status, JSON.stringify(sent.body)).toBe(201);
      expect(sent.body.status).toBe("pending");
      submitted.push(sent.body.approvalRequestId as string);
    }
    const companySent = await call("post", `/affiliate/vouchers/${companyId}/submit`, { version: 1 });
    expect(companySent.body.status).toBe("pending");
    expect((await call("post", `/approval-requests/${companySent.body.approvalRequestId}/decisions`, { decision: "approved", comment: "Tự duyệt" })).status).toBe(403);
    // Sửa khi chờ duyệt bị chặn.
    expect((await owner.call("put", `/merchant-portal/vouchers/${freeId}`, { body: { issuer: "merchant_free", ...voucher(), version: 2 } })).status).toBe(409);
    for (const requestId of [...submitted, companySent.body.approvalRequestId]) await decide(requestId, "approved");
    expect((await owner.call("get", `/merchant-portal/vouchers/${freeId}`)).body).toMatchObject({ status: "approved", displayStatus: "active" });

    const offers = (await buyer.call("get", "/buyer/affiliate/vouchers")).body;
    expect(offers.map((item: { id: string }) => item.id).sort()).toEqual([freeId, pointsId, companyId].sort());
    // Nhận voucher miễn phí; nhận lần hai vượt giới hạn mỗi khách.
    const claimedFree = await buyer.call("post", `/buyer/affiliate/vouchers/${freeId}/claim`, {});
    expect(claimedFree.status, JSON.stringify(claimedFree.body)).toBe(200);
    expect(claimedFree.body).toMatchObject({ status: "unused", pointsPaid: 0 });
    expect((await buyer.call("post", `/buyer/affiliate/vouchers/${freeId}/claim`, {})).body.error.message).toBe("Voucher đã hết số lượng hoặc bạn đã nhận đủ.");
    // Đổi bằng điểm: trừ 40 điểm.
    const claimedPoints = await buyer.call("post", `/buyer/affiliate/vouchers/${pointsId}/claim`, {});
    expect(claimedPoints.body).toMatchObject({ pointsPaid: 40 });
    expect(await balanceOf(buyer.id)).toBe(260);
    // Khách không có điểm không đổi được.
    expect((await other.call("post", `/buyer/affiliate/vouchers/${pointsId}/claim`, {})).status).toBe(409);
    await buyer.call("post", `/buyer/affiliate/vouchers/${companyId}/claim`, {});
    // Hết số lượng (tổng 2): khách thứ hai nhận voucher miễn phí còn 1 suất.
    expect((await other.call("post", `/buyer/affiliate/vouchers/${freeId}/claim`, {})).status).toBe(200);
    const third = await fixture.register("0938100003", "Lê Minh Châu");
    expect((await third.call("post", `/buyer/affiliate/vouchers/${freeId}/claim`, {})).body.error.message).toBe("Voucher đã hết số lượng hoặc bạn đã nhận đủ.");
    // Giảm tổng số lượng không dưới số đã nhận; tạm dừng thì khách không thấy.
    const current = (await owner.call("get", `/merchant-portal/vouchers/${pointsId}`)).body;
    expect((await owner.call("post", `/merchant-portal/vouchers/${pointsId}/quantity`, { body: { totalQuantity: 0, version: current.version } })).status).toBe(400);
    const paused = await owner.call("post", `/merchant-portal/vouchers/${pointsId}/pause`, { body: { version: current.version } });
    expect(paused.body.displayStatus).toBe("paused");
    expect((await other.call("get", "/buyer/affiliate/vouchers")).body.some((item: { id: string }) => item.id === pointsId)).toBe(false);
    // Chủ cửa hàng khác không thấy voucher của cửa hàng này.
    const list = await fixture.call("get", "/affiliate/vouchers");
    expect(list.body.total).toBe(3);
  });

  it("KICHBAN_KIEMTHU_543: dùng voucher tại quầy – tiền giảm, đúng cửa hàng, hóa đơn tối thiểu, tiền công ty phải trả; hủy trả voucher; hết hạn", async () => {
    const { cashier, owner, outletA } = fixture;
    const codes = (await buyer.call("get", "/buyer/affiliate/my-vouchers")).body as { id: string; voucherId: string }[];
    const freeCode = codes.find((code) => code.voucherId === freeId)!.id;
    const pointsCode = codes.find((code) => code.voucherId === pointsId)!.id;
    const companyCode = codes.find((code) => code.voucherId === companyId)!.id;

    // Cách 1: hóa đơn 450.000; yêu cầu hiện voucher dùng được kèm tiền giảm.
    const created = await cashier.call("post", "/merchant-portal/transactions", { body: { outletId: outletA, billAmount: "450000", method: "merchant_qr" } });
    const request = await buyer.call("post", "/buyer/affiliate/scan", { code: created.body.qrCode });
    const discounts = Object.fromEntries(request.body.vouchers.map((item: { id: string; discount: string }) => [item.id, item.discount]));
    expect(discounts).toEqual({ [freeCode]: "30000", [pointsCode]: "50000", [companyCode]: "20000" });
    // Dùng voucher 10 % (tối đa 30.000) và 50 điểm: khách trả 450.000 − 30.000 − 50.000 = 370.000; tích 2 % → 7 điểm.
    const confirmed = await buyer.call("post", `/buyer/affiliate/transactions/${created.body.transaction.id}/confirm`, { points: 50, code: created.body.qrCode, voucherCodeId: freeCode });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body).toMatchObject({ voucherDiscount: "30000", redeemedPoints: 50, paidAmount: "370000", earnedPoints: 7 });
    const row = (await pool.query("SELECT voucher_payable::int AS payable FROM affiliate.transactions WHERE id = $1", [created.body.transaction.id])).rows[0];
    expect(row.payable).toBe(0);
    // Dùng lại voucher đã dùng bị từ chối.
    const again = await cashier.call("post", "/merchant-portal/transactions", { body: { outletId: outletA, billAmount: "200000", method: "merchant_qr" } });
    expect((await buyer.call("post", `/buyer/affiliate/transactions/${again.body.transaction.id}/confirm`, { points: 0, code: again.body.qrCode, voucherCodeId: freeCode })).body.error.message).toBe(
      "Voucher không dùng được cho giao dịch này.",
    );

    // Cách 2 với voucher đổi bằng điểm: công ty phải trả cửa hàng 40 điểm × 1.000 = 40.000.
    const member = (await buyer.call("post", "/buyer/affiliate/member-code", { points: 0, voucherCodeId: pointsCode })).body.code;
    const withPoints = await cashier.call("post", "/merchant-portal/transactions", { body: { outletId: outletA, billAmount: "90000", method: "buyer_qr", memberCode: member } });
    expect(withPoints.body.transaction).toMatchObject({ voucherDiscount: "50000", paidAmount: "40000" });
    expect((await pool.query("SELECT voucher_payable::int AS payable FROM affiliate.transactions WHERE id = $1", [withPoints.body.transaction.id])).rows[0].payable).toBe(40000);

    // Voucher công ty chỉ dùng tại cửa hàng được chọn; hóa đơn dưới mức tối thiểu không dùng được.
    const low = await cashier.call("post", "/merchant-portal/transactions", { body: { outletId: outletA, billAmount: "50000", method: "merchant_qr" } });
    expect((await buyer.call("post", `/buyer/affiliate/transactions/${low.body.transaction.id}/confirm`, { points: 0, code: low.body.qrCode, voucherCodeId: companyCode })).status).toBe(409);
    const elsewhere = await pool.query("SELECT count(*)::int AS total FROM affiliate.voucher_merchants WHERE voucher_id = $1 AND merchant_id = $2", [companyId, otherMerchant]);
    expect(elsewhere.rows[0].total).toBe(0);
    const companyUse = await cashier.call("post", "/merchant-portal/transactions", { body: { outletId: outletA, billAmount: "150000", method: "merchant_qr" } });
    const usedCompany = await buyer.call("post", `/buyer/affiliate/transactions/${companyUse.body.transaction.id}/confirm`, { points: 0, code: companyUse.body.qrCode, voucherCodeId: companyCode });
    expect(usedCompany.body).toMatchObject({ voucherDiscount: "20000", paidAmount: "130000" });
    expect((await pool.query("SELECT voucher_payable::int AS payable FROM affiliate.transactions WHERE id = $1", [companyUse.body.transaction.id])).rows[0].payable).toBe(20000);

    // Hủy giao dịch trả voucher còn hạn cho khách.
    expect((await owner.call("post", `/merchant-portal/transactions/${companyUse.body.transaction.id}/cancel`, { body: { reason: "Khách trả hàng" } })).status).toBe(201);
    const restored = (await buyer.call("get", "/buyer/affiliate/my-vouchers")).body.find((code: { id: string }) => code.id === companyCode);
    expect(restored.status).toBe("unused");

    // Hết hạn: chuyển hết hạn, không dùng được; nhắc trước 3 ngày một lần.
    await pool.query("UPDATE affiliate.voucher_codes SET expires_at = now() + interval '2 days' WHERE id = $1", [companyCode]);
    await application.get(AffiliateVouchersService).expireAndRemind();
    await application.get(AffiliateVouchersService).expireAndRemind();
    const reminders = await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE user_id = $1 AND kind = 'affiliate.voucher_expiring'", [buyer.id]);
    expect(reminders.rows[0].total).toBe(1);
    await pool.query("UPDATE affiliate.voucher_codes SET expires_at = now() - interval '1 minute' WHERE id = $1", [companyCode]);
    await application.get(AffiliateVouchersService).expireAndRemind();
    expect((await buyer.call("get", "/buyer/affiliate/my-vouchers")).body.find((code: { id: string }) => code.id === companyCode).status).toBe("expired");
  });
});
