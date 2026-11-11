// CONG_VIEC_25 L1: thanh toán VNPAY, chờ thanh toán 15 phút, tự hủy (KICHBAN_KIEMTHU_322, 323).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketplacePaymentsService } from "../src/marketplace/payments/payments.service";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
const secret = "BIMATKIEMTHU0123456789";
const tmnCode = "VCOMMTST";

// Kết quả VNPAY gửi về, ký bằng khóa bí mật (giả lập máy chủ VNPAY).
function vnpayQuery(reference: string, amount: number, extra: Record<string, string> = {}, key = secret): Record<string, string> {
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_TxnRef: reference,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14000001",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261111103000",
    vnp_OrderInfo: "Thanh toan don",
    ...extra,
  };
  return { ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, key).hash };
}
const ipn = (query: Record<string, string>) => request(application.getHttpServer()).get("/api/v1/public/payments/vnpay/ipn").query(query);

async function placeOnline(quantity = 1) {
  const lines = [{ variantId: store.variants.soap, quantity }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "vnpay_qr" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; total: string; version: number; documentNo: string };
}
async function start(orderId: string) {
  const started = await buyer("post", `/buyer/orders/${orderId}/payments`);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  const url = new URL(started.body.paymentUrl as string);
  return { url, reference: url.searchParams.get("vnp_TxnRef")!, deadline: started.body.deadline as string };
}
const activeHolds = async (orderId: string) =>
  (await pool.query("SELECT count(*)::int AS count FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.id = $1 AND r.status = 'active'", [orderId]))
    .rows[0].count as number;

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
  await store.register("0935000001", "Người Mua Trực Tuyến");
  buyer = await store.buyerSession("0935000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_25 thanh toán VNPAY", () => {
  it("KICHBAN_KIEMTHU_322: đường dẫn ký đúng; IPN sai chữ ký, sai số tiền, không có đơn bị từ chối; thành công ghi đã thu một lần, đơn Chờ giao", async () => {
    const order = await placeOnline();
    expect(order).toMatchObject({ status: "awaiting_payment", paymentMethod: "vnpay_qr", paymentStatus: "unpaid", canPay: true, total: "74000" });
    const detail = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    const minutes = (new Date(detail.paymentDeadline).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);
    expect(await activeHolds(order.id)).toBe(1);
    expect((await pool.query("SELECT cod_amount::int FROM marketplace.orders WHERE id = $1", [order.id])).rows[0].cod_amount).toBe(0);
    // Người khác không mở được trang thanh toán của đơn.
    await store.register("0935000002", "Người Mua Khác");
    const other = await store.buyerSession("0935000002");
    expect((await other("post", `/buyer/orders/${order.id}/payments`)).status).toBe(404);

    const { url, reference } = await start(order.id);
    expect(url.origin + url.pathname).toBe("https://sandbox.vnpayment.vn/paymentv2/vpcpay.html");
    const sent: Record<string, string> = {};
    url.searchParams.forEach((value, key) => (sent[key] = value));
    const { vnp_SecureHash: hash, ...signedPart } = sent;
    expect(hash).toBe(signedQuery(signedPart, secret).hash);
    expect(sent).toMatchObject({ vnp_Version: "2.1.0", vnp_Command: "pay", vnp_TmnCode: tmnCode, vnp_Amount: "7400000", vnp_CurrCode: "VND", vnp_BankCode: "VNPAYQR", vnp_Locale: "vn" });
    expect(reference).toBe(`${order.documentNo.replace(/[^A-Za-z0-9]/g, "")}T01`);

    expect((await ipn(vnpayQuery(reference, 74000, {}, "khoa-sai"))).body).toEqual({ RspCode: "97", Message: "Invalid signature" });
    const tampered = { ...vnpayQuery(reference, 74000), vnp_Amount: "100" };
    expect((await ipn(tampered)).body.RspCode).toBe("97");
    expect((await ipn(vnpayQuery(reference, 1000))).body).toEqual({ RspCode: "04", Message: "Invalid amount" });
    expect((await ipn(vnpayQuery("KHONGCO01", 74000))).body).toEqual({ RspCode: "01", Message: "Order not found" });
    // Trang trả về chỉ hiển thị, không ghi nhận tiền.
    const returned = await request(application.getHttpServer()).get("/api/v1/public/payments/vnpay/return").query(vnpayQuery(reference, 74000));
    expect(returned.text).toContain("VComm đang chờ kết quả từ VNPAY");
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.status).toBe("awaiting_payment");

    expect((await ipn(vnpayQuery(reference, 74000))).body).toEqual({ RspCode: "00", Message: "Confirm Success" });
    const paid = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(paid).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000", canPay: false, paymentDeadline: null });
    expect(paid.events.map((event: { status: string }) => event.status)).toEqual(["awaiting_payment", "paid"]);
    // Nhận trùng: không ghi thêm.
    expect((await ipn(vnpayQuery(reference, 74000))).body).toEqual({ RspCode: "02", Message: "Order already confirmed" });
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.paidAmount).toBe("74000");
    expect((await request(application.getHttpServer()).get("/api/v1/public/payments/vnpay/return").query(vnpayQuery(reference, 74000))).text).toContain("Thanh toán thành công");
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).body.error.message).toBe("Đơn không còn chờ thanh toán (đã thanh toán, đã hủy hoặc quá hạn).");
    const admin = (await store.call("get", `/marketplace/orders/${order.id}`)).body;
    expect(admin.payments).toEqual([expect.objectContaining({ reference, method: "vnpay_qr", amount: "74000", status: "succeeded", transactionNo: "14000001", responseCode: "00" })]);
    expect(admin.canShip).toBe(true);
    const logged = (await pool.query("SELECT result_code FROM marketplace.payment_notifications WHERE reference = $1 ORDER BY received_at", [reference])).rows.map((row) => row.result_code);
    expect(logged).toEqual(["97", "97", "04", "00", "02"]);
  });

  it("KICHBAN_KIEMTHU_322 (thất bại, thanh toán lại): cổng báo không thành công thì đơn vẫn chờ thanh toán, mở lại với số tham chiếu mới", async () => {
    const order = await placeOnline();
    const first = await start(order.id);
    expect((await ipn(vnpayQuery(first.reference, 74000, { vnp_ResponseCode: "24", vnp_TransactionStatus: "02" }))).body.RspCode).toBe("00");
    const after = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(after).toMatchObject({ status: "awaiting_payment", paymentStatus: "unpaid", canPay: true });
    expect(
      (
        await request(application.getHttpServer())
          .get("/api/v1/public/payments/vnpay/return")
          .query(vnpayQuery(first.reference, 74000, { vnp_ResponseCode: "24" }))
      ).text,
    ).toContain("Thanh toán không thành công");
    const second = await start(order.id);
    expect(second.reference).toBe(first.reference.replace(/T01$/, "T02"));
    expect((await ipn(vnpayQuery(second.reference, 74000))).body.RspCode).toBe("00");
    // Lần thứ nhất đã kết thúc: báo trùng.
    expect((await ipn(vnpayQuery(first.reference, 74000))).body.RspCode).toBe("02");
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body).toMatchObject({ status: "awaiting_shipment", paidAmount: "74000" });
  });

  it("KICHBAN_KIEMTHU_323: quá 15 phút tự hủy, nhả hàng; tiền về sau khi hủy lập việc chờ hoàn; hủy đơn đã thu lập việc chờ hoàn; người mua hủy đơn chờ thanh toán", async () => {
    const order = await placeOnline(2);
    const { reference } = await start(order.id);
    const payments = application.get(MarketplacePaymentsService);
    // Chưa quá hạn: việc nền không hủy.
    expect(await payments.expireDue()).toBe(0);
    await pool.query("UPDATE marketplace.orders SET payment_deadline = now() - interval '1 second' WHERE id = $1", [order.id]);
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.canPay).toBe(false);
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(409);
    expect(await payments.expireDue()).toBe(1);
    const expired = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(expired).toMatchObject({ status: "cancelled", cancelReason: "Quá hạn thanh toán", paymentStatus: "unpaid" });
    expect(await activeHolds(order.id)).toBe(0);
    expect((await pool.query("SELECT cancelled_by_kind FROM marketplace.orders WHERE id = $1", [order.id])).rows[0].cancelled_by_kind).toBe("system");
    // Tiền về sau khi đơn đã hủy: ghi đã thu, lập việc chờ hoàn, đơn vẫn hủy.
    expect((await ipn(vnpayQuery(reference, 118000))).body.RspCode).toBe("00");
    const late = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(late).toMatchObject({ status: "cancelled", paidAmount: "118000", paymentStatus: "refund_pending" });
    const refunds = (await pool.query("SELECT reason, amount::int, status FROM marketplace.refunds WHERE order_id = $1", [order.id])).rows;
    expect(refunds).toEqual([{ reason: "paid_after_cancel", amount: 118000, status: "pending" }]);

    // Người mua hủy đơn chờ thanh toán: không có tiền nên không có việc hoàn.
    const unpaid = await placeOnline();
    const cancelled = await buyer("post", `/buyer/orders/${unpaid.id}/cancel`, { reason: "Đổi ý", version: unpaid.version });
    expect(cancelled.body).toMatchObject({ status: "cancelled", paymentStatus: "unpaid" });
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.refunds WHERE order_id = $1", [unpaid.id])).rows[0].count).toBe(0);

    // Hủy đơn đã thanh toán (chưa giao): lập việc chờ hoàn toàn bộ tiền đã thu.
    const paidOrder = await placeOnline();
    const started = await start(paidOrder.id);
    expect((await ipn(vnpayQuery(started.reference, 74000))).body.RspCode).toBe("00");
    const current = (await store.call("get", `/marketplace/orders/${paidOrder.id}`)).body;
    const staffCancel = await store.call("post", `/marketplace/orders/${paidOrder.id}/cancel`, { reason: "Hết hàng thực tế", version: current.version });
    expect(staffCancel.status, JSON.stringify(staffCancel.body)).toBe(200);
    expect(staffCancel.body).toMatchObject({ status: "cancelled", paymentStatus: "refund_pending" });
    expect((await pool.query("SELECT reason, amount::int FROM marketplace.refunds WHERE order_id = $1", [paidOrder.id])).rows).toEqual([{ reason: "order_cancelled", amount: 74000 }]);
  });
});
