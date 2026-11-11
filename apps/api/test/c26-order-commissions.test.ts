// CONG_VIEC_26 L1, L2: chốt người hưởng hoa hồng khi đặt đơn, cộng ví khi đơn hoàn tất; ví, hoa hồng cấp dưới (KICHBAN_KIEMTHU_357, 358).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { prepareMarketplace, retail, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let ghn: GhnMock;
const webhookKey = "khoa-webhook-kiem-thu-hoa-hong-0123456789";
// Đội: Khối (Giám đốc Kinh doanh) > Vùng (Giám đốc Vùng) > Phòng 1 (Trưởng phòng, Nhân viên); Phòng 2 ngay dưới Khối, chỉ có Nhân viên.
const people = { director: "", regional: "", head: "", staff: "", lonelyStaff: "", plain: "" };
const buyers: Record<"ofStaff" | "ofLonelyStaff" | "ofHead" | "ofPlain" | "alone", BuyerCall> = {} as never;
const percent = { calculation: "percent", referral: "5", staff: "10", teamHead: "3", regionalDirector: "2", director: "1" };

async function department(code: string, name: string, parent: string | null, type: "division" | "region" | "team"): Promise<string> {
  const id = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name, parent_id) VALUES ($1, $2, $3, $4) RETURNING id", [retail, code, name, parent])).rows[0]!.id;
  expect((await store.call("put", `/marketplace/sales-units/${id}`, { type })).status).toBe(200);
  return id;
}
async function member(phone: string, fullName: string, departmentId: string): Promise<string> {
  const userId = await store.register(phone, fullName);
  const detail = await store.call("get", `/marketplace/buyers/${userId}`);
  const flagged = await store.call("post", `/marketplace/buyers/${userId}/sales-flag`, { departmentId, version: detail.body.version });
  expect(flagged.status, JSON.stringify(flagged.body)).toBe(200);
  return userId;
}
async function placeOrder(buyer: BuyerCall, lines: { variantId: string; quantity: number }[]): Promise<{ id: string; version: number }> {
  const addressId = await store.addressOf(buyer);
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body;
}
// Người hưởng chốt trong đơn: [phần, người hưởng, mức] theo dòng hàng.
async function snapshot(orderId: string): Promise<[string, string, string][]> {
  const rows = await pool.query(
    `SELECT c.share, c.beneficiary_user_id, c.rate::float::text AS rate FROM marketplace.order_commissions c JOIN sales.order_lines l ON l.id = c.order_line_id
     WHERE c.order_id = $1 ORDER BY l.line_no, array_position(ARRAY['referral', 'staff', 'team_head', 'regional_director', 'director'], c.share)`,
    [orderId],
  );
  return rows.rows.map((row) => [row.share, row.beneficiary_user_id, row.rate]);
}
const walletOf = async (userId: string) => (await pool.query("SELECT balance::float::text AS balance FROM marketplace.wallets WHERE user_id = $1", [userId])).rows[0]?.balance ?? null;

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  const division = await department("KHOI-KD", "Khối Kinh doanh", null, "division");
  const region = await department("VUNG-BAC", "Vùng Miền Bắc", division, "region");
  const teamOne = await department("PKD-1", "Phòng Kinh doanh 1", region, "team");
  const teamTwo = await department("PKD-2", "Phòng Kinh doanh 2", division, "team");
  people.director = await member("0938000001", "Giám Đốc Kinh Doanh", division);
  people.regional = await member("0938000002", "Giám Đốc Vùng", region);
  people.head = await member("0938000003", "Trưởng Phòng Một", teamOne);
  people.staff = await member("0938000004", "Nhân Viên Một", teamOne);
  people.lonelyStaff = await member("0938000005", "Nhân Viên Phòng Hai", teamTwo);
  for (const [unit, userId] of [
    [division, people.director],
    [region, people.regional],
    [teamOne, people.head],
  ]) {
    expect((await store.call("put", `/marketplace/sales-units/${unit}/manager`, { userId })).status).toBe(200);
  }
  people.plain = await store.register("0938000006", "Người Giới Thiệu Thường");
  await store.register("0938100001", "Khách Của Nhân Viên", "0938000004");
  await store.register("0938100002", "Khách Phòng Hai", "0938000005");
  await store.register("0938100003", "Khách Của Trưởng Phòng", "0938000003");
  await store.register("0938100004", "Khách Người Thường", "0938000006");
  await store.register("0938100005", "Khách Không Giới Thiệu");
  buyers.ofStaff = await store.buyerSession("0938100001");
  buyers.ofLonelyStaff = await store.buyerSession("0938100002");
  buyers.ofHead = await store.buyerSession("0938100003");
  buyers.ofPlain = await store.buyerSession("0938100004");
  buyers.alone = await store.buyerSession("0938100005");
  expect((await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, { ...percent, version: 0 })).status).toBe(200);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_26 hoa hồng theo đơn", () => {
  it("KICHBAN_KIEMTHU_357: chốt người hưởng lúc đặt: giới thiệu, đội theo chức danh, thiếu chức danh, người quản lý tự phụ trách, người giới thiệu thường; sản phẩm chưa thiết lập, sửa mức chỉ áp dụng đơn sau", async () => {
    const { director, regional, head, staff, lonelyStaff, plain } = people;
    // Không có người giới thiệu: không có hoa hồng.
    const alone = await placeOrder(buyers.alone, [{ variantId: store.variants.cream, quantity: 1 }]);
    expect(await snapshot(alone.id)).toEqual([]);
    // Nhân viên giới thiệu: nhận giới thiệu và phần nhân viên; cấp trên nhận theo chức danh. Xà phòng chưa thiết lập: không có dòng.
    const ofStaff = await placeOrder(buyers.ofStaff, [
      { variantId: store.variants.cream, quantity: 1 },
      { variantId: store.variants.soap, quantity: 1 },
    ]);
    expect(await snapshot(ofStaff.id)).toEqual([
      ["referral", staff, "5"],
      ["staff", staff, "10"],
      ["team_head", head, "3"],
      ["regional_director", regional, "2"],
      ["director", director, "1"],
    ]);
    // Phòng hai không có trưởng phòng, không thuộc vùng: Giám đốc Kinh doanh (cao hơn gần nhất) nhận phần thiếu.
    const ofLonely = await placeOrder(buyers.ofLonelyStaff, [{ variantId: store.variants.cream, quantity: 1 }]);
    expect(await snapshot(ofLonely.id)).toEqual([
      ["referral", lonelyStaff, "5"],
      ["staff", lonelyStaff, "10"],
      ["team_head", director, "3"],
      ["regional_director", director, "2"],
      ["director", director, "1"],
    ]);
    // Trưởng phòng tự phụ trách khách: nhận cả phần nhân viên.
    const ofHead = await placeOrder(buyers.ofHead, [{ variantId: store.variants.cream, quantity: 1 }]);
    expect(await snapshot(ofHead.id)).toEqual([
      ["referral", head, "5"],
      ["staff", head, "10"],
      ["team_head", head, "3"],
      ["regional_director", regional, "2"],
      ["director", director, "1"],
    ]);
    // Người giới thiệu không phải nhân viên kinh doanh: chỉ hoa hồng giới thiệu.
    const ofPlain = await placeOrder(buyers.ofPlain, [{ variantId: store.variants.cream, quantity: 1 }]);
    expect(await snapshot(ofPlain.id)).toEqual([["referral", plain, "5"]]);
    // Màn hình đơn quản trị: danh sách người hưởng, chưa cộng thì ước tính.
    const detail = (await store.call("get", `/marketplace/orders/${ofPlain.id}`)).body;
    expect(detail.commissions).toEqual([{ beneficiaryName: "Người Giới Thiệu Thường", beneficiaryPhone: "0938000006", share: "referral", amount: expect.any(String), credited: false }]);
    // Sửa mức: đơn đã đặt giữ mức cũ, đơn sau dùng mức mới.
    expect((await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, { ...percent, referral: "6", version: 1 })).status).toBe(200);
    expect((await snapshot(ofPlain.id))[0]![2]).toBe("5");
    const after = await placeOrder(buyers.ofPlain, [{ variantId: store.variants.cream, quantity: 1 }]);
    expect(await snapshot(after.id)).toEqual([["referral", plain, "6"]]);
  });

  it("KICHBAN_KIEMTHU_358: hoàn tất cộng ví đúng số tiền (phần trăm, cố định, trừ hàng trả), một giao dịch mỗi người mỗi đơn; đơn hủy không có hoa hồng; ví, đang chờ, hoa hồng cấp dưới", async () => {
    const { director, regional, head, staff } = people;
    const fixed = { calculation: "fixed", referral: "2000", staff: "3000", teamHead: "1000", regionalDirector: "500", director: "500", version: 0 };
    expect((await store.call("put", `/marketplace/listings/${store.products.soap}/commission`, fixed)).status).toBe(200);
    // Kem 2 (6%, 10%, 3%, 2%, 1% trên tiền hàng chưa thuế), xà phòng 1 (cố định); người mua trả lại 1 kem.
    const order = await placeOrder(buyers.ofStaff, [
      { variantId: store.variants.cream, quantity: 2 },
      { variantId: store.variants.soap, quantity: 1 },
    ]);
    const shipped = await store.call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
    expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
    ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
    await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
    const delivered = (await buyers.ofStaff("get", `/buyer/orders/${order.id}`)).body;
    expect(delivered.status).toBe("delivered");
    const creamLine = delivered.lines.find((line: { productName: string }) => line.productName === "Kem dưỡng da VComm").orderLineId;
    const returned = (await buyers.ofStaff("post", `/buyer/orders/${order.id}/return-requests`, { reason: "defective", description: "Vỡ nắp", lines: [{ orderLineId: creamLine, quantity: 1 }] }))
      .body[0];
    const approved = (await store.call("post", `/marketplace/return-requests/${returned.id}/approve`, { note: null, version: returned.version })).body;
    expect((await store.call("post", `/marketplace/return-requests/${approved.id}/receive`, { note: null, version: approved.version })).body.status).toBe("received");
    // Chưa hoàn tất: ước tính theo hàng còn lại, chưa cộng ví.
    const pending = (await store.call("get", `/marketplace/orders/${order.id}`)).body.commissions;
    expect(pending.every((item: { credited: boolean }) => !item.credited)).toBe(true);
    expect(await walletOf(staff)).toBeNull();
    // Đang chờ của nhân viên: đơn ở kịch bản 357 (kem 1: 11.364 + 22.727) và đơn này theo hàng còn lại (41.363).
    const staffSession = await store.buyerSession("0938000004");
    expect((await staffSession("get", "/buyer/wallet")).body).toMatchObject({ balance: "0", pendingAmount: "75454", transactions: { data: [], page: 1, pageSize: 20, total: 0 } });

    await pool.query("UPDATE marketplace.orders SET delivered_at = now() - interval '169 hours' WHERE id = $1", [order.id]);
    const service = application.get(MarketplaceOrdersService);
    await service.completeDue();
    // Tiền hàng chưa thuế 1 kem còn lại: 250.000 / 1,1 = 227.272,73.
    // Nhân viên: 6% 13.636 + 10% 22.727 + 2.000 + 3.000 = 41.363; Trưởng phòng 6.818 + 1.000; Giám đốc Vùng 4.545 + 500; Giám đốc Kinh doanh 2.273 + 500.
    const credited = (await store.call("get", `/marketplace/orders/${order.id}`)).body.commissions;
    expect(credited.map((item: { share: string; amount: string; credited: boolean }) => [item.share, item.amount, item.credited])).toEqual([
      ["referral", "15636", true],
      ["staff", "25727", true],
      ["team_head", "7818", true],
      ["regional_director", "5045", true],
      ["director", "2773", true],
    ]);
    expect(await walletOf(staff)).toBe("41363");
    expect(await walletOf(head)).toBe("7818");
    expect(await walletOf(regional)).toBe("5045");
    expect(await walletOf(director)).toBe("2773");
    const transactions = await pool.query("SELECT user_id, kind, amount::float::text AS amount, balance_after::float::text AS balance FROM marketplace.wallet_transactions WHERE order_id = $1", [
      order.id,
    ]);
    expect(transactions.rows).toHaveLength(4);
    expect(transactions.rows.find((row) => row.user_id === staff)).toMatchObject({ kind: "commission", amount: "41363", balance: "41363" });
    // Chạy lại không cộng thêm.
    await service.completeDue();
    expect(await walletOf(staff)).toBe("41363");
    // Ví: số dư, đang chờ còn đơn chưa hoàn tất, lịch sử theo trang; người khác chỉ thấy ví của mình.
    const wallet = (await staffSession("get", "/buyer/wallet")).body;
    expect(wallet).toMatchObject({ balance: "41363", pendingAmount: "34091", transactions: { page: 1, total: 1 } });
    expect(wallet.transactions.data[0]).toMatchObject({ kind: "commission", amount: "41363", balanceAfter: "41363", orderId: order.id, orderDocumentNo: expect.any(String), note: null });
    expect((await staffSession("get", "/buyer/wallet?page=2&pageSize=1")).body.transactions).toMatchObject({ data: [], page: 2, pageSize: 1, total: 1 });
    expect((await staffSession("get", "/buyer/wallet?pageSize=500")).status).toBe(400);
    expect((await buyers.alone("get", "/buyer/wallet")).body).toMatchObject({ balance: "0", pendingAmount: "0", transactions: { data: [], page: 1, pageSize: 20, total: 0 } });
    // Giám đốc Kinh doanh xem hoa hồng từng cấp dưới trong nhánh.
    const members = (await (await store.buyerSession("0938000001"))("get", "/buyer/sales/team")).body.members as { userId: string; creditedCommission: string; pendingCommission: string }[];
    expect(members.find((item) => item.userId === staff)).toMatchObject({ creditedCommission: "41363", pendingCommission: "34091" });
    expect(members.find((item) => item.userId === people.lonelyStaff)).toMatchObject({ creditedCommission: "0", pendingCommission: "34091" });
    expect(members.find((item) => item.userId === head)).toMatchObject({ creditedCommission: "7818" });

    // Đơn hủy: hoa hồng bỏ, không cộng ví.
    const cancelled = await placeOrder(buyers.ofStaff, [{ variantId: store.variants.soap, quantity: 1 }]);
    expect((await store.call("get", `/marketplace/orders/${cancelled.id}`)).body.commissions).toHaveLength(5);
    const result = await buyers.ofStaff("post", `/buyer/orders/${cancelled.id}/cancel`, { reason: "Đổi ý", version: cancelled.version });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect((await store.call("get", `/marketplace/orders/${cancelled.id}`)).body.commissions).toEqual([]);
    expect(await walletOf(staff)).toBe("41363");
  });
});
