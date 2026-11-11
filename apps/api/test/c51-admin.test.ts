// CONG_VIEC_51 L4: ví điểm quản trị, khóa, mở; phiếu điều chỉnh qua luồng duyệt; cảnh báo bất thường; phân quyền
// (KICHBAN_KIEMTHU_494, 495; TIEUCHI_NGHIEMTHU_336, 338).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { LoyaltyLedgerService } from "../src/loyalty/ledger.service";
import { signIn, type Session } from "./helpers";
import { prepareMarketplace, retail, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let approver: Session;
const buyers: { id: string; call: BuyerCall; phone: string }[] = [];

async function order(buyer: BuyerCall): Promise<{ id: string; version: number }> {
  const addressId = await store.addressOf(buyer);
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body;
}
async function decide(requestId: string, decision: "approved" | "rejected") {
  const decided = await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision, comment: "Ý kiến" } });
  expect(decided.status, JSON.stringify(decided.body)).toBe(200);
  await application.get(OutboxService).dispatchPending();
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  const phase = {
    startsOn: store.today,
    endsOn: null,
    earnPercent: "2",
    pointValue: "1",
    redeemMaxPercent: "50",
    redeemMinPoints: 1000,
    validityMonths: 12,
    orderCapPoints: null,
    monthlyCapPoints: null,
  };
  expect((await store.call("post", "/loyalty/phases", phase)).status).toBe(201);
  const policy = await store.call("post", "/approval-policies", {
    documentTypeCode: "loyalty.adjustment",
    currency: "VND",
    effectiveFrom: "2026-01-01",
    levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
  });
  expect(policy.status, JSON.stringify(policy.body)).toBe(201);
  approver = await signIn(application, "phuc.le@vcomm.test");
  for (const phone of ["0939500001", "0939500002", "0939500003"]) {
    const id = await store.register(phone, `Khách ${phone.slice(-1)}`);
    buyers.push({ id, call: await store.buyerSession(phone), phone });
  }
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_51 quản trị điểm", () => {
  it("KICHBAN_KIEMTHU_494: phiếu điều chỉnh qua duyệt (người lập không tự duyệt, từ chối, rút, trừ không vượt số dư); khóa, mở ví; ví điểm quản trị; phân quyền", async () => {
    const [first] = buyers;
    // Lập nháp cộng 20.000 điểm; số điện thoại không phải người mua bị từ chối.
    expect((await store.call("post", "/loyalty/adjustments", { phone: "0909999999", direction: "add", points: 100, reason: "Thử" })).body.error.fields).toEqual({
      phone: "Không tìm thấy người mua có số điện thoại này.",
    });
    const draft = (await store.call("post", "/loyalty/adjustments", { phone: first!.phone, direction: "add", points: 20000, reason: "Bù điểm đơn giao chậm" })).body;
    expect(draft).toMatchObject({ status: "draft", documentNo: null, value: "20000", canEdit: true, buyerPhone: first!.phone });
    const submitted = (await store.call("post", `/loyalty/adjustments/${draft.id}/submit`, { version: draft.version })).body;
    expect(submitted).toMatchObject({ status: "pending", documentNo: expect.stringMatching(/^DD/), approvalRequestId: expect.any(String), canWithdraw: true, canEdit: false });
    // Người lập không tự duyệt được.
    expect((await store.call("post", `/approval-requests/${submitted.approvalRequestId}/decisions`, { decision: "approved", comment: "Tự duyệt" })).status).toBe(403);
    await decide(submitted.approvalRequestId, "approved");
    const posted = (await store.call("get", `/loyalty/adjustments/${draft.id}`)).body;
    expect(posted).toMatchObject({ status: "posted", canEdit: false });
    expect((await first!.call("get", "/buyer/loyalty")).body.balance).toBe(20000);
    const entry = (await first!.call("get", "/buyer/loyalty/entries")).body.data[0];
    expect(entry).toMatchObject({ kind: "adjust_add", points: 20000, documentNo: posted.documentNo });

    // Trừ 30.000 điểm khi số dư 20.000: được duyệt nhưng không ghi sổ được.
    const tooMuch = (await store.call("post", "/loyalty/adjustments", { phone: first!.phone, direction: "subtract", points: 30000, reason: "Thu hồi điểm" })).body;
    const tooMuchPending = (await store.call("post", `/loyalty/adjustments/${tooMuch.id}/submit`, { version: tooMuch.version })).body;
    await decide(tooMuchPending.approvalRequestId, "approved");
    expect((await store.call("get", `/loyalty/adjustments/${tooMuch.id}`)).body).toMatchObject({ status: "post_failed", failureReason: "loyaltyInsufficientBalance" });
    expect((await first!.call("get", "/buyer/loyalty")).body.balance).toBe(20000);
    // Bị từ chối thì sửa, gửi lại được; rút khi chờ duyệt.
    const rejected = (await store.call("post", "/loyalty/adjustments", { phone: first!.phone, direction: "subtract", points: 5000, reason: "Thu hồi" })).body;
    const rejectedPending = (await store.call("post", `/loyalty/adjustments/${rejected.id}/submit`, { version: rejected.version })).body;
    await decide(rejectedPending.approvalRequestId, "rejected");
    const afterReject = (await store.call("get", `/loyalty/adjustments/${rejected.id}`)).body;
    expect(afterReject).toMatchObject({ status: "rejected", canEdit: true });
    const edited = (
      await store.call("put", `/loyalty/adjustments/${rejected.id}`, { phone: first!.phone, direction: "subtract", points: 4000, reason: "Thu hồi đúng số", version: afterReject.version })
    ).body;
    expect(edited).toMatchObject({ points: 4000, documentNo: afterReject.documentNo });
    const resubmitted = (await store.call("post", `/loyalty/adjustments/${rejected.id}/submit`, { version: edited.version })).body;
    expect((await store.call("post", `/loyalty/adjustments/${rejected.id}/withdraw`)).body).toMatchObject({ status: "withdrawn" });
    expect((await approver.call("post", `/approval-requests/${resubmitted.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Muộn" } })).status).not.toBe(200);
    // Danh sách theo trạng thái.
    expect((await store.call("get", "/loyalty/adjustments?status=posted")).body).toMatchObject({ total: 1 });

    // Khóa ví: lý do bắt buộc; khóa hai lần bị từ chối; lịch sử; mở lại.
    expect((await store.call("post", `/loyalty/accounts/${first!.id}/lock`, { reason: "" })).status).toBe(400);
    const locked = (await store.call("post", `/loyalty/accounts/${first!.id}/lock`, { reason: "Nghi gian lận" })).body;
    expect(locked).toMatchObject({ locked: true, lockReason: "Nghi gian lận", balance: 20000 });
    expect((await store.call("post", `/loyalty/accounts/${first!.id}/lock`, { reason: "Lại" })).status).toBe(409);
    expect((await first!.call("get", "/buyer/loyalty")).body.locked).toBe(true);
    const unlocked = (await store.call("post", `/loyalty/accounts/${first!.id}/unlock`, { reason: "Đã xác minh" })).body;
    expect(unlocked).toMatchObject({ locked: false, lockReason: null });
    expect(unlocked.lockHistory.map((item: { action: string; reason: string }) => [item.action, item.reason])).toEqual([
      ["unlock", "Đã xác minh"],
      ["lock", "Nghi gian lận"],
    ]);
    expect(unlocked.lots).toEqual([expect.objectContaining({ sourceType: "adjustment", documentNo: posted.documentNo, points: 20000, remaining: 20000, pointValue: "1" })]);

    // Danh sách ví: tìm theo số điện thoại, lọc đang khóa; sổ cái của người mua.
    const found = (await store.call("get", `/loyalty/accounts?search=${first!.phone}`)).body;
    expect(found).toMatchObject({ total: 1, data: [{ userId: first!.id, balance: 20000, locked: false, tierName: "Thành viên" }] });
    expect((await store.call("get", "/loyalty/accounts?locked=true")).body.total).toBe(0);
    expect((await store.call("get", `/loyalty/accounts/${first!.id}/entries`)).body.total).toBe(1);

    // Phân quyền: chỉ quyền xem thì xem được, không khóa, không lập phiếu; người mua không gọi được API quản trị.
    const roleId = (
      await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en, status) VALUES ($1, 'test_loyalty_view', 'Xem điểm', 'View loyalty', 'active') RETURNING id", [
        retail,
      ])
    ).rows[0]!.id;
    await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'crm.access'), ($1, 'loyalty.view')", [roleId]);
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [
      testIds.purchasingManager,
      roleId,
      retail,
    ]);
    const viewer = await signIn(application, "phuc.le@vcomm.test");
    expect((await viewer.call("get", `/loyalty/accounts/${first!.id}`, { companyId: retail })).body.canManage).toBe(false);
    expect((await viewer.call("post", `/loyalty/accounts/${first!.id}/lock`, { companyId: retail, body: { reason: "Thử" } })).status).toBe(403);
    expect((await viewer.call("post", "/loyalty/adjustments", { companyId: retail, body: { phone: first!.phone, direction: "add", points: 1, reason: "Thử" } })).status).toBe(403);
    expect((await first!.call("get", "/loyalty/accounts")).status).toBe(403);
    expect((await first!.call("get", `/loyalty/accounts/${first!.id}`)).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_495: cảnh báo trùng thông tin nhận hàng, hủy, trả nhiều, đổi điểm dồn dập", async () => {
    // Ba người mua cùng số nhận, địa chỉ (sổ địa chỉ mẫu): một nhóm theo số, một nhóm theo địa chỉ.
    for (const buyer of buyers) await order(buyer.call);
    const shared = (await store.call("get", "/loyalty/alerts?kind=shared_contact")).body;
    expect(shared.items).toHaveLength(2);
    expect(shared.items.map((item: { buyers: unknown[] }) => item.buyers.length)).toEqual([3, 3]);
    expect(shared.items.map((item: { label: string }) => item.label)).toEqual(expect.arrayContaining(["+84911222444", expect.stringContaining("1 tràng tiền")]));

    // Người mua 2: 5 đơn, hủy 3.
    const second = buyers[1]!;
    for (let index = 0; index < 4; index += 1) {
      const placed = await order(second.call);
      if (index < 3) expect((await second.call("post", `/buyer/orders/${placed.id}/cancel`, { reason: "Đổi ý", version: placed.version })).status).toBe(200);
    }
    const cancels = (await store.call("get", "/loyalty/alerts?kind=cancel_return")).body;
    expect(cancels.items).toEqual([expect.objectContaining({ buyers: [expect.objectContaining({ userId: second.id })], orderCount: 5, cancelledOrReturned: 3 })]);

    // Người mua 1 dùng điểm cho 5 chứng từ trong ngày.
    const database = application.get(DATABASE) as Database;
    const ledger = application.get(LoyaltyLedgerService);
    for (let index = 0; index < 5; index += 1) {
      await database.transaction((transaction) =>
        ledger.redeemWithin(transaction, { userId: buyers[0]!.id, companyId: retail, sourceType: "retail_sale", sourceId: randomUUID(), day: store.today, goodsAmount: 10000, points: 1000 }),
      );
    }
    const burst = (await store.call("get", "/loyalty/alerts?kind=redeem_burst")).body;
    expect(burst.items).toEqual([{ label: store.today, buyers: [expect.objectContaining({ userId: buyers[0]!.id })], orderCount: 5, cancelledOrReturned: null, points: 5000 }]);
    expect((await store.call("get", "/loyalty/alerts?kind=other")).status).toBe(400);
  });
});
