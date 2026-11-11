// CONG_VIEC_49 L1: cộng tác viên, lượt bấm và hoa hồng cộng tác viên, thưởng giới thiệu bạn bè (KICHBAN_KIEMTHU_464 đến 466).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { signIn } from "./helpers";
import { prepareMarketplace, retail, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let ghn: GhnMock;
const webhookKey = "khoa-webhook-kiem-thu-cong-dong-0123456789";
const percent = { calculation: "percent", referral: "5", staff: "0", teamHead: "0", regionalDirector: "0", director: "0", collaborator: "4" };

async function placeOrder(buyer: BuyerCall, lines: { variantId: string; quantity: number }[]): Promise<{ id: string; version: number }> {
  const addressId = await store.addressOf(buyer);
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body;
}
// Giao thành công rồi đưa thời điểm giao về trước 7 ngày, chạy việc hoàn tất.
async function complete(order: { id: string; version: number }): Promise<void> {
  const shipped = await store.call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
  expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
  ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
  await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
  await pool.query("UPDATE marketplace.orders SET delivered_at = now() - interval '169 hours' WHERE id = $1", [order.id]);
  await application.get(MarketplaceOrdersService).completeDue();
  expect((await pool.query("SELECT status FROM marketplace.orders WHERE id = $1", [order.id])).rows[0].status).toBe("completed");
}
async function shares(orderId: string): Promise<[string, string, string][]> {
  const rows = await pool.query(
    `SELECT v.product_id, c.share, c.beneficiary_user_id FROM marketplace.order_commissions c JOIN sales.order_lines l ON l.id = c.order_line_id
     JOIN catalog.variants v ON v.id = l.variant_id WHERE c.order_id = $1 ORDER BY l.line_no, c.share`,
    [orderId],
  );
  return rows.rows.map((row) => [row.product_id, row.share, row.beneficiary_user_id]);
}
const bonusOf = async (userId: string) =>
  (await pool.query("SELECT coalesce(sum(amount), 0)::float::text AS total FROM marketplace.wallet_transactions WHERE user_id = $1 AND kind = 'referral_bonus'", [userId])).rows[0].total;
const walletOf = async (userId: string) => (await pool.query("SELECT balance::float::text AS balance FROM marketplace.wallets WHERE user_id = $1", [userId])).rows[0]?.balance ?? null;

// Đăng ký và được duyệt làm cộng tác viên; trả về mã.
async function approvedCollaborator(phone: string, name: string): Promise<{ userId: string; code: string; session: BuyerCall }> {
  const userId = await store.register(phone, name);
  const session = await store.buyerSession(phone);
  expect((await session("post", "/buyer/collaborator", { channel: null, acceptTerms: true, version: 0 })).status).toBe(200);
  const approved = await store.call("post", `/marketplace/collaborators/${userId}/approve`, { version: 1 });
  expect(approved.status, JSON.stringify(approved.body)).toBe(200);
  return { userId, code: approved.body.code as string, session };
}

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_49 cộng tác viên, thưởng giới thiệu", () => {
  it("KICHBAN_KIEMTHU_464: đăng ký, từ chối, gửi lại, duyệt cấp mã, tạm ngừng, khôi phục, gắn nhãn; phiên bản, trạng thái, quyền", async () => {
    const userId = await store.register("0947000001", "Hà Ly Cộng Tác");
    const buyer = await store.buyerSession("0947000001");
    expect((await buyer("get", "/buyer/collaborator")).body).toEqual({ profile: null, stats: null, termsVersion: 1 });
    // Chưa đồng ý điều khoản: sai dữ liệu.
    expect((await buyer("post", "/buyer/collaborator", { channel: "Nhóm Zalo", acceptTerms: false, version: 0 })).status).toBe(400);
    expect((await buyer("post", "/buyer/collaborator", { channel: "x".repeat(201), acceptTerms: true, version: 0 })).status).toBe(400);
    const submitted = await buyer("post", "/buyer/collaborator", { channel: "Nhóm Zalo Mẹ và bé", acceptTerms: true, version: 0 });
    expect(submitted.body.profile).toMatchObject({ status: "pending", code: null, label: null, channel: "Nhóm Zalo Mẹ và bé", version: 1 });
    expect((await buyer("post", "/buyer/collaborator", { channel: null, acceptTerms: true, version: 1 })).body.error.message).toBe(
      "Bạn đã gửi đăng ký cộng tác viên. Chờ VComm xét duyệt hoặc xem kết quả trong mục Cộng tác viên.",
    );

    // Danh sách quản trị lọc trạng thái; người không có quyền bị chặn.
    const pending = (await store.call("get", "/marketplace/collaborators?status=pending")).body;
    expect(pending.data.map((item: { userId: string }) => item.userId)).toContain(userId);
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("get", "/marketplace/collaborators", { companyId: retail })).status).toBe(403);
    expect((await employee.call("post", `/marketplace/collaborators/${userId}/approve`, { companyId: retail, body: { version: 1 } })).status).toBe(403);

    // Từ chối cần lý do; người mua gửi lại được.
    expect((await store.call("post", `/marketplace/collaborators/${userId}/reject`, { version: 1 })).status).toBe(400);
    const rejected = await store.call("post", `/marketplace/collaborators/${userId}/reject`, { reason: "Kênh chia sẻ chưa rõ", version: 1 });
    expect(rejected.body).toMatchObject({ status: "rejected", reason: "Kênh chia sẻ chưa rõ", code: null, version: 2 });
    const notice = await pool.query("SELECT kind FROM core.notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [userId]);
    expect(notice.rows[0].kind).toBe("collaborator.reject");
    expect((await store.call("put", `/marketplace/collaborators/${userId}/label`, { label: "kol", version: 2 })).body.error.message).toBe("Chỉ gắn nhãn cho cộng tác viên đã duyệt.");
    expect((await buyer("post", "/buyer/collaborator", { channel: "Trang Góc nhà Hà Ly", acceptTerms: true, version: 1 })).status).toBe(409);
    const resubmitted = await buyer("post", "/buyer/collaborator", { channel: "Trang Góc nhà Hà Ly", acceptTerms: true, version: 2 });
    expect(resubmitted.body.profile).toMatchObject({ status: "pending", reason: null, version: 3 });

    // Duyệt cấp mã; phiên bản cũ bị từ chối; khôi phục khi đang duyệt sai trạng thái.
    expect((await store.call("post", `/marketplace/collaborators/${userId}/approve`, { version: 2 })).status).toBe(409);
    const approved = (await store.call("post", `/marketplace/collaborators/${userId}/approve`, { version: 3 })).body;
    expect(approved.status).toBe("approved");
    expect(approved.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect((await store.call("post", `/marketplace/collaborators/${userId}/restore`, { version: 4 })).body.error.message).toBe("Hồ sơ cộng tác viên đã đổi trạng thái. Tải lại trang rồi thử lại.");
    const suspended = (await store.call("post", `/marketplace/collaborators/${userId}/suspend`, { reason: "Chia sẻ sai thông tin", version: 4 })).body;
    expect(suspended).toMatchObject({ status: "suspended", code: approved.code });
    expect((await store.call("put", `/marketplace/collaborators/${userId}/label`, { label: "koc", version: 5 })).body).toMatchObject({ label: "koc", version: 6 });
    const restored = (await store.call("post", `/marketplace/collaborators/${userId}/restore`, { version: 6 })).body;
    expect(restored).toMatchObject({ status: "approved", code: approved.code, label: "koc", reason: null });
    expect(restored.history.map((item: { action: string }) => item.action)).toEqual(["restore", "label", "suspend", "approve", "submit", "reject", "submit"]);
    // Người mua thấy mã, nhãn, thống kê.
    const mine = (await buyer("get", "/buyer/collaborator")).body;
    expect(mine.profile).toMatchObject({ status: "approved", code: approved.code, label: "koc" });
    expect(mine.stats).toEqual({ clicks: 0, orders: 0, pendingAmount: "0", creditedAmount: "0" });
    expect((await store.call("get", "/marketplace/collaborators?label=koc&search=Hà Ly")).body.total).toBe(1);
  });

  it("KICHBAN_KIEMTHU_465: lượt bấm trong 168 giờ chụp phần cộng tác viên theo sản phẩm; tự mua, quá hạn, tạm ngừng, mã sai không có phần; lượt gần nhất thắng; giới hạn ngày", async () => {
    expect((await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, { ...percent, version: 0 })).status).toBe(200);
    // Tổng sáu mức phần trăm vượt 100% bị chặn.
    expect((await store.call("put", `/marketplace/listings/${store.products.soap}/commission`, { ...percent, collaborator: "96", version: 0 })).body.error.message).toBe(
      "Tổng năm mức hoa hồng theo phần trăm không được quá 100%.",
    );
    const first = await approvedCollaborator("0947000011", "Cộng Tác Viên Một");
    const second = await approvedCollaborator("0947000012", "Cộng Tác Viên Hai");
    const referrerId = await store.register("0947000013", "Người Giới Thiệu");
    await store.register("0947000014", "Người Mua Qua Đường Dẫn", "0947000013");
    const buyer = await store.buyerSession("0947000014");

    // Mã sai, sản phẩm không đăng bán: không ghi; chính cộng tác viên bấm mã của mình: không ghi.
    expect((await buyer("post", "/buyer/collaborator/clicks", { code: "ZZZZZZZZ", productId: store.products.cream })).status).toBe(204);
    expect((await buyer("post", "/buyer/collaborator/clicks", { code: "abc", productId: store.products.cream })).status).toBe(400);
    expect((await first.session("post", "/buyer/collaborator/clicks", { code: first.code, productId: store.products.cream })).status).toBe(204);
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.collaborator_clicks")).rows[0].count).toBe(0);

    // Bấm mã thứ nhất rồi mã thứ hai (chữ thường vẫn nhận): lượt gần nhất (thứ hai) nhận phần kem; xà phòng không có lượt bấm.
    await buyer("post", "/buyer/collaborator/clicks", { code: first.code, productId: store.products.cream });
    await pool.query("UPDATE marketplace.collaborator_clicks SET last_clicked_at = now() - interval '1 hour'");
    await buyer("post", "/buyer/collaborator/clicks", { code: second.code.toLowerCase(), productId: store.products.cream });
    const order = await placeOrder(buyer, [
      { variantId: store.variants.cream, quantity: 1 },
      { variantId: store.variants.soap, quantity: 1 },
    ]);
    expect(await shares(order.id)).toEqual([
      [store.products.cream, "collaborator", second.userId],
      [store.products.cream, "referral", referrerId],
    ]);
    expect((await store.call("get", `/marketplace/orders/${order.id}`)).body.commissions.map((item: { share: string }) => item.share)).toEqual(["referral", "collaborator"]);
    expect((await pool.query("SELECT referrer_user_id FROM marketplace.orders WHERE id = $1", [order.id])).rows[0].referrer_user_id).toBe(referrerId);

    // Thống kê của cộng tác viên hai: 1 lượt, 1 đơn, đang chờ 4% của 227.273 = 9.091.
    expect((await second.session("get", "/buyer/collaborator")).body.stats).toEqual({ clicks: 1, orders: 1, pendingAmount: "9091", creditedAmount: "0" });
    expect((await second.session("get", "/buyer/collaborator/orders")).body).toEqual([
      { orderId: order.id, documentNo: expect.any(String), productName: "Kem dưỡng da VComm", credited: false, amount: "9091", createdAt: expect.any(String) },
    ]);
    await complete(order);
    expect(await walletOf(second.userId)).toBe("9091");

    // Quá 168 giờ: không có phần.
    await pool.query("UPDATE marketplace.collaborator_clicks SET last_clicked_at = now() - interval '169 hours'");
    const late = await placeOrder(buyer, [{ variantId: store.variants.cream, quantity: 1 }]);
    expect((await shares(late.id)).map((row) => row[1])).toEqual(["referral"]);
    // Cộng tác viên tạm ngừng: không ghi lượt mới, không có phần; đơn đã chụp giữ nguyên.
    await buyer("post", "/buyer/collaborator/clicks", { code: first.code, productId: store.products.cream });
    expect((await store.call("post", `/marketplace/collaborators/${first.userId}/suspend`, { reason: "Kiểm tra", version: 2 })).status).toBe(200);
    await buyer("post", "/buyer/collaborator/clicks", { code: second.code, productId: store.products.cream });
    await pool.query("UPDATE marketplace.collaborator_clicks SET last_clicked_at = now() - interval '200 hours' WHERE collaborator_user_id = $1", [second.userId]);
    const suspendedOrder = await placeOrder(buyer, [{ variantId: store.variants.cream, quantity: 1 }]);
    expect((await shares(suspendedOrder.id)).map((row) => row[1])).toEqual(["referral"]);
    expect((await shares(order.id))[0]).toEqual([store.products.cream, "collaborator", second.userId]);

    // Giới hạn 200 lượt mỗi ngày.
    await pool.query("INSERT INTO marketplace.collaborator_click_log (buyer_user_id, collaborator_user_id, product_id) SELECT $1, $2, $3 FROM generate_series(1, 200)", [
      (await pool.query("SELECT id FROM core.users WHERE phone = '+84947000014'")).rows[0].id,
      second.userId,
      store.products.cream,
    ]);
    const before = (await pool.query("SELECT last_clicked_at FROM marketplace.collaborator_clicks WHERE collaborator_user_id = $1", [second.userId])).rows[0].last_clicked_at;
    await buyer("post", "/buyer/collaborator/clicks", { code: second.code, productId: store.products.cream });
    const after = (await pool.query("SELECT last_clicked_at FROM marketplace.collaborator_clicks WHERE collaborator_user_id = $1", [second.userId])).rows[0].last_clicked_at;
    expect(after).toEqual(before);
  });

  it("KICHBAN_KIEMTHU_466: thưởng giới thiệu một lần vào ví hoa hồng khi đơn hoàn tất đạt mức; tắt, dưới mức, đã thưởng không thưởng; mời bạn bè", async () => {
    // Quyền: xem cần marketplace.order.view; nhân viên thường bị chặn. Cài đặt theo phiên bản.
    expect((await store.call("get", "/marketplace/referral-bonus-settings")).body).toEqual({ isEnabled: false, bonusAmount: null, minimumOrder: "0", version: 0 });
    expect((await store.call("put", "/marketplace/referral-bonus-settings", { isEnabled: true, bonusAmount: "0", minimumOrder: "0", version: 0 })).status).toBe(400);
    expect((await store.call("put", "/marketplace/referral-bonus-settings", { isEnabled: true, bonusAmount: "10000001", minimumOrder: "0", version: 0 })).status).toBe(400);
    const saved = await store.call("put", "/marketplace/referral-bonus-settings", { isEnabled: false, bonusAmount: "50000", minimumOrder: "200000", version: 0 });
    expect(saved.body).toEqual({ isEnabled: false, bonusAmount: "50000", minimumOrder: "200000", version: 1 });
    expect((await store.call("put", "/marketplace/referral-bonus-settings", { isEnabled: true, bonusAmount: "50000", minimumOrder: "200000", version: 0 })).status).toBe(409);

    const inviterId = await store.register("0947000021", "Người Mời Bạn");
    await store.register("0947000022", "Bạn Được Mời Một", "0947000021");
    await store.register("0947000023", "Bạn Được Mời Hai", "0947000021");
    await store.register("0947000024", "Bạn Chưa Mua", "0947000021");
    const friendOne = await store.buyerSession("0947000022");
    const friendTwo = await store.buyerSession("0947000023");

    // Chương trình đang tắt lúc hoàn tất: không thưởng.
    const offOrder = await placeOrder(friendOne, [{ variantId: store.variants.cream, quantity: 1 }]);
    await complete(offOrder);
    expect(await bonusOf(inviterId)).toBe("0");
    expect((await store.call("put", "/marketplace/referral-bonus-settings", { isEnabled: true, bonusAmount: "50000", minimumOrder: "200000", version: 1 })).status).toBe(200);
    // Dưới mức tối thiểu: không thưởng; đơn sau đạt mức thì thưởng một lần.
    const small = await placeOrder(friendTwo, [{ variantId: store.variants.soap, quantity: 1 }]);
    await complete(small);
    expect(await bonusOf(inviterId)).toBe("0");
    const pendingOrder = await placeOrder(friendTwo, [{ variantId: store.variants.cream, quantity: 1 }]);
    const inviter = await store.buyerSession("0947000021");
    const statuses = async () =>
      Object.fromEntries((await inviter("get", "/buyer/invitations")).body.invitees.map((item: { fullName: string; bonusStatus: string }) => [item.fullName, item.bonusStatus]));
    expect(await statuses()).toEqual({ "Bạn Được Mời Một": "not_qualified", "Bạn Được Mời Hai": "in_progress", "Bạn Chưa Mua": "no_order" });
    await complete(pendingOrder);
    expect(await bonusOf(inviterId)).toBe("50000");
    const transaction = await pool.query("SELECT kind, amount::float::text AS amount, order_id FROM marketplace.wallet_transactions WHERE user_id = $1 AND kind = 'referral_bonus'", [inviterId]);
    expect(transaction.rows).toEqual([{ kind: "referral_bonus", amount: "50000", order_id: pendingOrder.id }]);
    // Đơn hoàn tất tiếp theo của cùng người: không thưởng lần hai.
    const again = await placeOrder(friendTwo, [{ variantId: store.variants.cream, quantity: 1 }]);
    await complete(again);
    expect(await bonusOf(inviterId)).toBe("50000");
    // Bạn được mời một (đã có đơn hoàn tất lúc tắt) đặt đơn mới đạt mức: được thưởng.
    const later = await placeOrder(friendOne, [{ variantId: store.variants.cream, quantity: 1 }]);
    await complete(later);
    expect(await bonusOf(inviterId)).toBe("100000");
    const invitations = (await inviter("get", "/buyer/invitations")).body;
    expect(invitations.program).toEqual({ isEnabled: true, bonusAmount: "50000", minimumOrder: "200000" });
    expect(invitations.invitees.find((item: { fullName: string }) => item.fullName === "Bạn Được Mời Hai")).toMatchObject({
      phone: "0947***023",
      bonusStatus: "credited",
      bonusAmount: "50000",
    });
    // Ví hoa hồng hiện giao dịch thưởng giới thiệu kèm số đơn.
    const wallet = (await inviter("get", "/buyer/wallet")).body;
    expect(wallet.transactions.data.find((item: { orderId: string; kind: string }) => item.orderId === later.id && item.kind === "referral_bonus")).toMatchObject({
      amount: "50000",
      orderDocumentNo: expect.any(String),
    });
  });
});
