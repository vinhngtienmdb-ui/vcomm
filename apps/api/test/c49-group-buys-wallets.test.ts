// CONG_VIEC_49 L2: mua chung, ví mua sắm, khóa và chặn ví (KICHBAN_KIEMTHU_467 đến 472; THAY_DOI_22).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GroupBuysService } from "../src/marketplace/group-buys.service";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { signIn } from "./helpers";
import { prepareMarketplace, retail, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
const secret = "BIMATKIEMTHU0123456789";
const tmnCode = "VCOMMTST";
const tiers = [
  { minQuantity: 2, unitPrice: "240000" },
  { minQuantity: 4, unitPrice: "220000" },
  { minQuantity: 6, unitPrice: "200000" },
];
let collaborator: { userId: string; session: BuyerCall };

const ipn = (reference: string, amount: number) => {
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_TxnRef: reference,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: `14${Math.floor(Math.random() * 1e6)}`,
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261111103000",
    vnp_OrderInfo: "Thanh toan don",
  };
  return request(application.getHttpServer())
    .get("/api/v1/public/payments/vnpay/ipn")
    .query({ ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, secret).hash });
};

// Tham gia nhóm: xem trước, đặt đơn trả trực tuyến (và ví nếu chọn), thanh toán phần còn lại qua VNPAY.
async function join(buyer: BuyerCall, groupBuyId: string, quantity: number, useShoppingWallet = false): Promise<{ id: string; version: number; status: string }> {
  const addressId = await store.addressOf(buyer);
  const lines = [{ variantId: store.variants.cream, quantity }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines, groupBuyId, useShoppingWallet });
  expect(preview.status, JSON.stringify(preview.body)).toBe(200);
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "vnpay_qr", groupBuyId, useShoppingWallet });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  if (placed.body.status === "awaiting_payment") {
    const started = await buyer("post", `/buyer/orders/${placed.body.id}/payments`);
    const url = new URL(started.body.paymentUrl as string);
    expect((await ipn(url.searchParams.get("vnp_TxnRef")!, Number(url.searchParams.get("vnp_Amount")) / 100)).body.RspCode).toBe("00");
  }
  return (await buyer("get", `/buyer/orders/${placed.body.id}`)).body;
}
const shoppingBalance = async (userId: string) => (await pool.query("SELECT balance::float::text AS balance FROM marketplace.shopping_wallets WHERE user_id = $1", [userId])).rows[0]?.balance ?? "0";
const userIdOf = async (phone: string) => (await pool.query("SELECT id FROM core.users WHERE phone = $1", [`+84${phone.slice(1)}`])).rows[0].id as string;
const expire = (groupId: string) => pool.query("UPDATE marketplace.group_buys SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 second' WHERE id = $1", [groupId]);
async function openGroup(durationHours = 24): Promise<string> {
  const opened = await collaborator.session("post", "/buyer/group-buys", { variantId: store.variants.cream, durationHours });
  expect(opened.status, JSON.stringify(opened.body)).toBe(201);
  return opened.body.id as string;
}
const message = (response: request.Response) => response.body.error?.message as string;

beforeAll(async () => {
  Object.assign(process.env, {
    VNPAY_TMN_CODE: tmnCode,
    VNPAY_HASH_SECRET: secret,
    VNPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/vnpay/return",
    VNPAY_PAYMENT_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/payment-methods/vnpay_qr", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  expect(
    (
      await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, {
        calculation: "percent",
        referral: "0",
        collaborator: "4",
        staff: "0",
        teamHead: "0",
        regionalDirector: "0",
        director: "0",
        version: 0,
      })
    ).status,
  ).toBe(200);
  const userId = await store.register("0948000001", "Cộng Tác Viên Mua Chung");
  const session = await store.buyerSession("0948000001");
  await session("post", "/buyer/collaborator", { channel: null, acceptTerms: true, version: 0 });
  expect((await store.call("post", `/marketplace/collaborators/${userId}/approve`, { version: 1 })).status).toBe(200);
  collaborator = { userId, session };
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_49 mua chung, ví mua sắm", () => {
  it("KICHBAN_KIEMTHU_467: cài đặt mua chung kiểm bậc giá, giá bậc đầu, phiên bản, quyền", async () => {
    const path = `/marketplace/group-buy-settings/${store.variants.cream}`;
    const base = { isEnabled: true, tiers, maxDurationHours: 72, maxPerBuyer: 3, version: 0 };
    // Bậc sau giá không thấp hơn: sai dữ liệu; mốc tối thiểu dưới 2: sai dữ liệu; quá 5 bậc: sai dữ liệu.
    expect((await store.call("put", path, { ...base, tiers: [tiers[0], { minQuantity: 4, unitPrice: "250000" }] })).status).toBe(400);
    expect((await store.call("put", path, { ...base, tiers: [{ minQuantity: 1, unitPrice: "240000" }] })).status).toBe(400);
    expect((await store.call("put", path, { ...base, tiers: Array.from({ length: 6 }, (_, index) => ({ minQuantity: index + 2, unitPrice: String(240000 - index * 1000) })) })).status).toBe(400);
    // Giá bậc 1 cao hơn giá bán 250.000.
    const over = await store.call("put", path, { ...base, tiers: [{ minQuantity: 2, unitPrice: "260000" }] });
    expect(over.body.error.fields["tiers.0.unitPrice"]).toBe("Giá bậc 1 không được cao hơn giá bán hiện tại.");
    const saved = await store.call("put", path, base);
    expect(saved.body).toMatchObject({ variantId: store.variants.cream, currentPrice: "250000", isEnabled: true, tiers, maxDurationHours: 72, maxPerBuyer: 3, version: 1 });
    expect((await store.call("put", path, base)).status).toBe(409);
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("put", path, { companyId: retail, body: { ...base, version: 1 } })).status).toBe(403);
    const list = (await store.call("get", "/marketplace/group-buy-settings")).body;
    expect(list.data.find((item: { variantId: string }) => item.variantId === store.variants.soap)).toMatchObject({ isEnabled: false, version: 0, tiers: [] });
    // Người mua thấy biến thể bật mua chung.
    expect((await collaborator.session("get", "/buyer/group-buy-options")).body).toEqual([expect.objectContaining({ variantId: store.variants.cream, tiers, maxPerBuyer: 3 })]);
  });

  it("KICHBAN_KIEMTHU_468: mở nhóm: cộng tác viên đã duyệt, thời hạn, tối đa 5 nhóm, nhân viên mở trên web; nhóm chụp bậc giá", async () => {
    await store.register("0948000002", "Người Mua Thường");
    const plain = await store.buyerSession("0948000002");
    expect(message(await plain("post", "/buyer/group-buys", { variantId: store.variants.cream, durationHours: 24 }))).toBe("Chỉ cộng tác viên đã duyệt mới mở được nhóm mua chung.");
    expect((await collaborator.session("post", "/buyer/group-buys", { variantId: store.variants.cream, durationHours: 100 })).body.error.fields.durationHours).toBe(
      "Thời hạn nhóm vượt mức tối đa VComm cài đặt.",
    );
    expect(message(await collaborator.session("post", "/buyer/group-buys", { variantId: store.variants.soap, durationHours: 24 }))).toBe("Biến thể này chưa bật mua chung.");
    const ids: string[] = [];
    for (let index = 0; index < 5; index += 1) ids.push(await openGroup());
    expect(message(await collaborator.session("post", "/buyer/group-buys", { variantId: store.variants.cream, durationHours: 24 }))).toBe(
      "Bạn đang có 5 nhóm mở, tối đa 5. Chờ nhóm kết thúc để mở thêm.",
    );
    // Nhân viên VComm mở trên web, không tính giới hạn của cộng tác viên.
    const staff = await store.call("post", "/marketplace/group-buys", { variantId: store.variants.cream, durationHours: 48 });
    expect(staff.body).toMatchObject({ openerKind: "staff", status: "open", tiers, quantity: 0, orders: [] });
    // Sửa cài đặt sau khi mở: nhóm đang mở giữ bậc cũ.
    expect(
      (
        await store.call("put", `/marketplace/group-buy-settings/${store.variants.cream}`, {
          isEnabled: true,
          tiers: [{ minQuantity: 3, unitPrice: "230000" }],
          maxDurationHours: 72,
          maxPerBuyer: 3,
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect((await plain("get", `/buyer/group-buys/${ids[0]}`)).body).toMatchObject({ tiers, openerName: "Cộng Tác Viên Mua Chung", currentPrice: null, quantity: 0 });
    expect((await plain("get", "/buyer/group-buys")).body.total).toBe(6);
    // Dọn: hủy các nhóm thừa để các kịch bản sau đếm rõ.
    for (const id of ids.slice(1)) expect((await store.call("post", `/marketplace/group-buys/${id}/cancel`, { reason: "Dọn kiểm thử", version: 1 })).status).toBe(200);
    expect((await store.call("post", `/marketplace/group-buys/${staff.body.id}/cancel`, { reason: "Dọn kiểm thử", version: 1 })).body.status).toBe("cancelled");
    expect((await store.call("put", `/marketplace/group-buy-settings/${store.variants.cream}`, { isEnabled: true, tiers, maxDurationHours: 72, maxPerBuyer: 3, version: 2 })).status).toBe(200);
  });

  it("KICHBAN_KIEMTHU_469, 470: tham gia trả trước giá bậc đầu, giới hạn mỗi người, không COD; chốt thành công sửa giá, hoàn dư vào ví, hoa hồng người mở nhóm", async () => {
    const groupId = await openGroup();
    for (const [phone, name] of [
      ["0948000011", "Người Mua A"],
      ["0948000012", "Người Mua B"],
      ["0948000013", "Người Mua C"],
    ] as const)
      await store.register(phone, name);
    const [a, b, c] = [await store.buyerSession("0948000011"), await store.buyerSession("0948000012"), await store.buyerSession("0948000013")];
    const addressId = await store.addressOf(a);
    const lines = [{ variantId: store.variants.cream, quantity: 2 }];
    // Xem trước: giá bậc đầu, chỉ phương thức trực tuyến.
    const preview = (await a("post", "/buyer/orders/preview", { addressId, lines, groupBuyId: groupId })).body;
    expect(preview).toMatchObject({ goodsAmount: "480000", shippingFee: "30000", total: "510000", paymentMethods: ["vnpay_qr"], walletAmount: "0", payable: "510000" });
    expect(preview.lines[0]).toMatchObject({ unitPrice: "240000", promotionDiscount: "0" });
    // Không thanh toán khi nhận hàng; biến thể khác nhóm bị từ chối.
    expect(message(await a("post", "/buyer/orders", { addressId, lines, expectedTotal: "510000", paymentMethod: "cod", groupBuyId: groupId }))).toBe(
      "Mua chung cần trả trước: chọn thanh toán trực tuyến hoặc dùng ví mua sắm đủ số tiền.",
    );
    expect((await a("post", "/buyer/orders/preview", { addressId, lines: [{ variantId: store.variants.soap, quantity: 1 }], groupBuyId: groupId })).status).toBe(400);
    const orderA = await join(a, groupId, 2);
    expect(orderA).toMatchObject({ status: "awaiting_group", paidAmount: "510000", groupBuy: { id: groupId, status: "open", finalPrice: null } });
    // Tối đa 3 mỗi người: A đã có 2, đặt thêm 2 bị từ chối.
    expect(message(await a("post", "/buyer/orders", { addressId, lines, expectedTotal: "510000", paymentMethod: "vnpay_qr", groupBuyId: groupId }))).toBe(
      "Bạn đã đặt đủ số lượng tối đa cho mỗi người trong nhóm này.",
    );
    const orderB = await join(b, groupId, 2);
    // C đặt rồi hủy khi nhóm còn mở: hoàn toàn bộ vào ví mua sắm.
    const orderC = await join(c, groupId, 1);
    expect((await c("get", `/buyer/group-buys/${groupId}`)).body).toMatchObject({ quantity: 5, currentPrice: "220000", myQuantity: 1 });
    const cancelled = await c("post", `/buyer/orders/${orderC.id}/cancel`, { reason: "Đổi ý", version: orderC.version });
    expect(cancelled.body).toMatchObject({ status: "cancelled", walletRefundedAmount: "0", refundedAmount: "270000" });
    expect(await shoppingBalance(await userIdOf("0948000013"))).toBe("270000");
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.refunds WHERE order_id = $1", [orderC.id])).rows[0].count).toBe(0);
    // C tham gia lại 1, ví mua sắm 270.000 trả toàn bộ: không cần thanh toán trực tuyến, vào thẳng Chờ chốt nhóm.
    const orderC2 = await join(c, groupId, 1, true);
    expect(orderC2).toMatchObject({ status: "awaiting_group", walletAmount: "270000", paidAmount: "0" });
    expect(await shoppingBalance(await userIdOf("0948000013"))).toBe("0");

    // Chốt: tổng 5, bậc 4 trở lên giá 220.000.
    await expire(groupId);
    expect(await application.get(GroupBuysService).closeDue()).toBe(1);
    const group = (await store.call("get", `/marketplace/group-buys/${groupId}`)).body;
    expect(group).toMatchObject({ status: "succeeded", quantity: 5, finalPrice: "220000" });
    const afterA = (await a("get", `/buyer/orders/${orderA.id}`)).body;
    expect(afterA).toMatchObject({ status: "awaiting_shipment", goodsAmount: "440000", shippingFee: "30000", refundedAmount: "40000", groupBuy: { status: "succeeded", finalPrice: "220000" } });
    expect(afterA.lines[0]).toMatchObject({ unitPrice: "220000", total: "440000" });
    expect(await shoppingBalance(await userIdOf("0948000011"))).toBe("40000");
    expect(await shoppingBalance(await userIdOf("0948000012"))).toBe("40000");
    // C: không có tiền mặt, dư 20.000 hoàn từ phần đã trả bằng ví.
    expect((await c("get", `/buyer/orders/${orderC2.id}`)).body).toMatchObject({ goodsAmount: "220000", refundedAmount: "0", walletRefundedAmount: "20000" });
    expect(await shoppingBalance(await userIdOf("0948000013"))).toBe("20000");
    // Đơn bán có tổng theo giá chốt; hoa hồng cộng tác viên cho người mở nhóm tính trên giá chốt.
    const sale = await pool.query("SELECT so.total_amount::float::text AS total FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = $1", [orderB.id]);
    expect(sale.rows[0].total).toBe("440000");
    const commission = (await store.call("get", `/marketplace/orders/${orderB.id}`)).body.commissions;
    expect(commission).toEqual([expect.objectContaining({ share: "collaborator", beneficiaryName: "Cộng Tác Viên Mua Chung", amount: "16000" })]);
    const history = (await a("get", "/buyer/shopping-wallet")).body;
    expect(history).toMatchObject({ balance: "40000", isLocked: false, isBlocked: false });
    expect(history.transactions.data[0]).toMatchObject({ kind: "group_buy_difference", amount: "40000", orderId: orderA.id });
    // Chạy lại không chốt lần hai.
    expect(await application.get(GroupBuysService).closeDue()).toBe(0);
  });

  it("KICHBAN_KIEMTHU_471: không đủ mốc tối thiểu thì hủy, hoàn toàn bộ vào ví; đơn chưa thanh toán bị hủy; nhân viên hủy nhóm", async () => {
    const groupId = await openGroup();
    await store.register("0948000021", "Người Mua D");
    await store.register("0948000022", "Người Mua E");
    const d = await store.buyerSession("0948000021");
    const e = await store.buyerSession("0948000022");
    const orderD = await join(d, groupId, 1);
    // E đặt nhưng chưa thanh toán.
    const addressId = await store.addressOf(e);
    const lines = [{ variantId: store.variants.cream, quantity: 1 }];
    const unpaid = (await e("post", "/buyer/orders", { addressId, lines, expectedTotal: "270000", paymentMethod: "vnpay_qr", groupBuyId: groupId })).body;
    expect(unpaid.status).toBe("awaiting_payment");
    await expire(groupId);
    await application.get(GroupBuysService).closeDue();
    expect((await store.call("get", `/marketplace/group-buys/${groupId}`)).body).toMatchObject({ status: "failed", quantity: 1, finalPrice: null });
    expect((await d("get", `/buyer/orders/${orderD.id}`)).body).toMatchObject({ status: "cancelled", cancelReason: "Nhóm mua chung không đủ số lượng", refundedAmount: "270000" });
    expect(await shoppingBalance(await userIdOf("0948000021"))).toBe("270000");
    expect((await e("get", `/buyer/orders/${unpaid.id}`)).body).toMatchObject({ status: "cancelled", cancelReason: "Nhóm mua chung đã kết thúc" });
    // Hàng giữ được nhả.
    const holds = await pool.query(
      "SELECT count(*)::int AS count FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.group_buy_id = $1 AND r.status = 'active'",
      [groupId],
    );
    expect(holds.rows[0].count).toBe(0);
    const notice = await pool.query("SELECT kind FROM core.notifications WHERE user_id = $1 AND kind LIKE 'group_buy.%'", [await userIdOf("0948000021")]);
    expect(notice.rows.map((row) => row.kind)).toEqual(["group_buy.failed"]);
    // Nhân viên hủy nhóm đang mở có đơn: hoàn vào ví, lý do của nhân viên.
    const other = await openGroup();
    const orderD2 = await join(d, other, 1, true);
    expect(orderD2).toMatchObject({ walletAmount: "270000", paidAmount: "0", status: "awaiting_group" });
    expect((await store.call("post", `/marketplace/group-buys/${other}/cancel`, { reason: "", version: 1 })).status).toBe(400);
    expect((await store.call("post", `/marketplace/group-buys/${other}/cancel`, { reason: "Hết hàng nhà cung cấp", version: 1 })).body).toMatchObject({
      status: "cancelled",
      cancelReason: "Hết hàng nhà cung cấp",
    });
    expect((await d("get", `/buyer/orders/${orderD2.id}`)).body).toMatchObject({ status: "cancelled", walletRefundedAmount: "270000" });
    expect(await shoppingBalance(await userIdOf("0948000021"))).toBe("270000");
    expect((await store.call("post", `/marketplace/group-buys/${other}/cancel`, { reason: "Lần hai", version: 2 })).status).toBe(409);
  });

  it("KICHBAN_KIEMTHU_472: ví mua sắm trả một phần, toàn bộ đơn thường; hủy hoàn về ví; khóa toàn hệ thống; chặn theo tài khoản; đồng thời không trừ quá số dư", async () => {
    const buyerId = await userIdOf("0948000021");
    const d = await store.buyerSession("0948000021");
    const addressId = await store.addressOf(d);
    const place = (lines: { variantId: string; quantity: number }[], expectedTotal: string, useShoppingWallet: boolean) =>
      d("post", "/buyer/orders", { addressId, lines, expectedTotal, paymentMethod: "cod", useShoppingWallet });
    // Xà phòng 2: 88.000 + 30.000 = 118.000, trả toàn bộ bằng ví (số dư 270.000).
    const preview = (await d("post", "/buyer/orders/preview", { addressId, lines: [{ variantId: store.variants.soap, quantity: 2 }], useShoppingWallet: true })).body;
    expect(preview).toMatchObject({ total: "118000", walletAmount: "118000", payable: "0", shoppingWallet: { balance: "270000", usable: true } });
    const full = (await place([{ variantId: store.variants.soap, quantity: 2 }], "118000", true)).body;
    expect(full).toMatchObject({ status: "awaiting_shipment", walletAmount: "118000" });
    expect((await pool.query("SELECT cod_amount::float::text AS cod FROM marketplace.orders WHERE id = $1", [full.id])).rows[0].cod).toBe("0");
    // Kem 1: 250.000 + 30.000; ví còn 152.000 trả một phần, COD phần còn lại 128.000.
    const partial = (await place([{ variantId: store.variants.cream, quantity: 1 }], "280000", true)).body;
    expect(partial).toMatchObject({ walletAmount: "152000" });
    expect((await pool.query("SELECT cod_amount::float::text AS cod FROM marketplace.orders WHERE id = $1", [partial.id])).rows[0].cod).toBe("128000");
    expect(await shoppingBalance(buyerId)).toBe("0");
    // Hủy đơn thường: phần ví hoàn về ví, không lập việc hoàn ngân hàng (COD chưa thu).
    expect((await d("post", `/buyer/orders/${partial.id}/cancel`, { reason: "Đổi ý", version: partial.version })).body).toMatchObject({ walletRefundedAmount: "152000" });
    expect(await shoppingBalance(buyerId)).toBe("152000");
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.refunds WHERE order_id = $1", [partial.id])).rows[0].count).toBe(0);
    const wallet = (await d("get", "/buyer/shopping-wallet")).body;
    expect(wallet.transactions.data.slice(0, 3).map((item: { kind: string; amount: string }) => [item.kind, item.amount])).toEqual([
      ["order_refund", "152000"],
      ["order_payment", "-152000"],
      ["order_payment", "-118000"],
    ]);

    // Đồng thời hai đơn dùng ví: tổng trừ không vượt số dư.
    const both = await Promise.all([place([{ variantId: store.variants.soap, quantity: 1 }], "74000", true), place([{ variantId: store.variants.soap, quantity: 1 }], "74000", true)]);
    expect(both.every((response) => response.status === 201)).toBe(true);
    expect(both.map((response) => Number(response.body.walletAmount)).reduce((sum, value) => sum + value, 0)).toBe(148000);
    expect(await shoppingBalance(buyerId)).toBe("4000");

    // Khóa toàn hệ thống: không dùng được ví; mua hàng vẫn được; quyền.
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("put", "/marketplace/shopping-wallet-settings", { companyId: retail, body: { isLocked: true, version: 0 } })).status).toBe(403);
    expect((await store.call("put", "/marketplace/shopping-wallet-settings", { isLocked: true, version: 0 })).body).toEqual({ isLocked: true, version: 1 });
    expect((await d("post", "/buyer/orders/preview", { addressId, lines: [{ variantId: store.variants.soap, quantity: 1 }], useShoppingWallet: true })).body).toMatchObject({
      walletAmount: "0",
      shoppingWallet: { usable: false },
    });
    expect(message(await place([{ variantId: store.variants.soap, quantity: 1 }], "74000", true))).toBe("Ví mua sắm đang tạm khóa. Bỏ chọn dùng ví để đặt hàng.");
    expect((await place([{ variantId: store.variants.soap, quantity: 1 }], "74000", false)).status).toBe(201);
    expect((await d("get", "/buyer/shopping-wallet")).body).toMatchObject({ isLocked: true, balance: "4000" });
    expect((await store.call("put", "/marketplace/shopping-wallet-settings", { isLocked: false, version: 1 })).status).toBe(200);

    // Chặn ví mua sắm của tài khoản: chỉ ví đó; bắt buộc lý do; lịch sử.
    expect((await store.call("put", `/marketplace/buyers/${buyerId}/wallet-blocks/shopping`, { isBlocked: true, reason: "", version: 0 })).status).toBe(400);
    const blocked = (await store.call("put", `/marketplace/buyers/${buyerId}/wallet-blocks/shopping`, { isBlocked: true, reason: "Nghi gian lận hoàn tiền", version: 0 })).body;
    expect(blocked.blocks).toEqual([
      { wallet: "shopping", isBlocked: true, reason: "Nghi gian lận hoàn tiền", updatedAt: expect.any(String), version: 1 },
      { wallet: "commission", isBlocked: false, reason: null, updatedAt: null, version: 0 },
    ]);
    expect(message(await place([{ variantId: store.variants.soap, quantity: 1 }], "74000", true))).toBe("Ví mua sắm của bạn đang bị chặn. Bỏ chọn dùng ví để đặt hàng.");
    expect((await d("get", "/buyer/shopping-wallet")).body).toMatchObject({ isBlocked: true, isLocked: false });
    expect(message(await store.call("put", `/marketplace/buyers/${buyerId}/wallet-blocks/shopping`, { isBlocked: true, reason: "Lặp", version: 1 }))).toBe(
      "Ví đã ở trạng thái này. Tải lại trang để xem trạng thái mới.",
    );
    const unblocked = (await store.call("put", `/marketplace/buyers/${buyerId}/wallet-blocks/shopping`, { isBlocked: false, reason: "Đã xác minh", version: 1 })).body;
    expect(unblocked.history.map((item: { action: string }) => item.action)).toEqual(["unblock", "block"]);
  });

  it("THAY_DOI_22: chặn ví hoa hồng tự từ chối yêu cầu chờ duyệt, chặn tạo mới và ghi đã chi; gỡ chặn thì chi được; không ảnh hưởng ví mua sắm", async () => {
    await store.register("0948000031", "Người Rút Hoa Hồng");
    const user = await store.buyerSession("0948000031");
    const userId = await userIdOf("0948000031");
    await pool.query("INSERT INTO marketplace.wallets (user_id, balance) VALUES ($1, 1000000)", [userId]);
    expect((await user("put", "/buyer/bank-account", { bankName: "Vietcombank", accountNumber: "0123456789", accountHolder: "NGUOI RUT HOA HONG" })).status).toBe(200);
    const first = (await user("post", "/buyer/withdrawals", { amount: "300000" })).body;
    expect(first.status).toBe("pending");
    const block = (isBlocked: boolean, version: number) =>
      store.call("put", `/marketplace/buyers/${userId}/wallet-blocks/commission`, { isBlocked, reason: isBlocked ? "Đang xác minh danh tính" : "Đã xác minh", version });
    expect((await block(true, 0)).status).toBe(200);
    // Yêu cầu chờ duyệt tự bị từ chối, tiền về lại ví.
    const rejected = (await store.call("get", "/marketplace/withdrawals?status=rejected")).body.data.find((item: { id: string }) => item.id === first.id);
    expect(rejected).toMatchObject({ status: "rejected", rejectReason: "Đang xác minh danh tính", walletBlocked: true });
    expect((await pool.query("SELECT balance::float::text AS balance FROM marketplace.wallets WHERE user_id = $1", [userId])).rows[0].balance).toBe("1000000");
    expect(message(await user("post", "/buyer/withdrawals", { amount: "300000" }))).toBe("Ví hoa hồng đang bị chặn rút tiền.");
    expect((await user("get", "/buyer/wallet")).body.withdrawal.blocked).toBe(true);
    // Ví mua sắm không bị ảnh hưởng.
    expect((await user("get", "/buyer/shopping-wallet")).body.isBlocked).toBe(false);
    // Gỡ chặn, tạo yêu cầu, duyệt; chặn lại khi đã duyệt chưa chi: không ghi đã chi được.
    expect((await block(false, 1)).status).toBe(200);
    const second = (await user("post", "/buyer/withdrawals", { amount: "300000" })).body;
    const approved = (await store.call("post", `/marketplace/withdrawals/${second.id}/approve`, { version: second.version })).body;
    expect(approved.status).toBe("approved");
    expect((await block(true, 2)).status).toBe(200);
    expect((await store.call("get", "/marketplace/withdrawals?status=approved")).body.data.find((item: { id: string }) => item.id === second.id).status).toBe("approved");
    const pay = { bankTransactionNo: "FT2611110001", paidOn: store.today, version: approved.version };
    expect(message(await store.call("post", `/marketplace/withdrawals/${second.id}/pay`, pay))).toBe("Ví hoa hồng đang bị chặn rút tiền.");
    expect((await block(false, 3)).status).toBe(200);
    expect((await store.call("post", `/marketplace/withdrawals/${second.id}/pay`, pay)).body.status).toBe("paid");
    // Quyền: người không có quyền duyệt chi không chặn được.
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("put", `/marketplace/buyers/${userId}/wallet-blocks/commission`, { companyId: retail, body: { isBlocked: true, reason: "x", version: 4 } })).status).toBe(403);
    const notices = await pool.query("SELECT kind FROM core.notifications WHERE user_id = $1 AND kind LIKE 'wallet_block.%' ORDER BY created_at", [userId]);
    expect(notices.rows.map((row) => row.kind)).toEqual(["wallet_block.commission.block", "wallet_block.commission.unblock", "wallet_block.commission.block", "wallet_block.commission.unblock"]);
  });
});
