// CONG_VIEC_36: cổng chuyển khoản ngân hàng và VietQR (KICHBAN_KIEMTHU_391 đến 394).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bankTransferConfiguration, contentHasReference, crc16, vietQrData } from "../src/marketplace/payments/gateways/bank-transfer-gateway";
import { MarketplacePaymentsService } from "../src/marketplace/payments/payments.service";
import { signIn } from "./helpers";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
let receivingFund: string;
let otherFund: string;
const environment = { BANK_TRANSFER_BANK_BIN: "970436", BANK_TRANSFER_BANK_NAME: "Vietcombank", BANK_TRANSFER_ACCOUNT_NUMBER: "0071000123456", BANK_TRANSFER_ACCOUNT_NAME: "CONG TY VCR" };

async function placeTransferOrder() {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "bank_transfer_vietqr" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const started = await buyer("post", `/buyer/orders/${placed.body.id}/payments`);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  return { orderId: placed.body.id as string, documentNo: placed.body.documentNo as string, transfer: started.body.transfer };
}
const simulate = (fundId: string, amount: string, content: string) => store.call("post", `/finance/bank-connections/${fundId}/simulate`, { direction: "in", amount, content });

beforeAll(async () => {
  Object.assign(process.env, environment);
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/payment-methods/bank_transfer_vietqr", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0936000001", "Người Mua Chuyển Khoản");
  buyer = await store.buyerSession("0936000001");
  addressId = await store.addressOf(buyer);
  // Quỹ nhận tiền có số tài khoản trùng biến môi trường (viết cách quãng vẫn khớp); quỹ khác số tài khoản không được ghép.
  const fund = await store.call("post", "/finance/funds", {
    code: "VCBNHAN",
    name: "Vietcombank nhận chuyển khoản",
    kind: "bank",
    bankName: "Vietcombank",
    accountNo: "0071 000 123 456",
    accountHolder: "VCR",
  });
  expect(fund.status, JSON.stringify(fund.body)).toBe(201);
  receivingFund = fund.body.id;
  otherFund = (await store.call("post", "/finance/funds", { code: "ACBKHAC", name: "ACB", kind: "bank", bankName: "ACB", accountNo: "999888", accountHolder: "VCR" })).body.id;
  for (const fundId of [receivingFund, otherFund]) expect((await store.call("put", `/finance/bank-connections/${fundId}`, { provider: "simulator", enabled: true, version: null })).status).toBe(200);
});

afterAll(async () => {
  for (const name of Object.keys(environment)) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_36 cổng chuyển khoản và VietQR", () => {
  it("KICHBAN_KIEMTHU_391: chuỗi VietQR đúng cấu trúc EMVCo, CRC đúng; thiếu hoặc sai biến môi trường thì chưa cấu hình; mở thanh toán trả thông tin chuyển khoản", async () => {
    // Mẫu công khai (gói sunary/vietqr) có CRC BE74.
    expect(crc16("00020101021138510010A00000072701210006970407010797968680208QRIBFTTA53037045802VN62240820gen by sunary/vietqr6304")).toBe("BE74");
    const data = vietQrData({ bankBin: "970436", accountNumber: "0071000123456", amount: 74000, content: "DH0001T01" });
    expect(data).toBe(`00020101021238570010A00000072701270006970436011300710001234560208QRIBFTTA53037045405740005802VN62130809DH0001T016304${data.slice(-4)}`);
    expect(crc16(data.slice(0, -4))).toBe(data.slice(-4));
    expect(contentHasReference("MBVCB.123.DH0001T01.CT tu 0123", "dh0001t01")).toBe(true);
    expect(contentHasReference("DH0001T011 chuyen tien", "DH0001T01")).toBe(false);
    expect(contentHasReference("XDH0001T01", "DH0001T01")).toBe(false);
    expect(bankTransferConfiguration()).toMatchObject({ bankBin: "970436", accountNumber: "0071000123456" });
    process.env.BANK_TRANSFER_BANK_BIN = "VCB";
    expect(bankTransferConfiguration()).toBeNull();
    process.env.BANK_TRANSFER_BANK_BIN = environment.BANK_TRANSFER_BANK_BIN;
    const settings = (await store.call("get", "/marketplace/store-settings")).body;
    expect(settings.paymentMethods.find((item: { code: string }) => item.code === "bank_transfer_vietqr")).toMatchObject({ gatewayCode: "bank_transfer", isEnabled: true, isConfigured: true });

    const placed = await placeTransferOrder();
    expect(placed.transfer).toMatchObject({ bankName: "Vietcombank", accountNumber: "0071000123456", accountName: "CONG TY VCR", amount: "74000", qrImageUrl: null });
    const reference = placed.transfer.content as string;
    expect(reference).toMatch(/^[A-Za-z0-9]+T01$/);
    expect(placed.transfer.qrData).toBe(vietQrData({ bankBin: "970436", accountNumber: "0071000123456", amount: 74000, content: reference }));
  });

  it("KICHBAN_KIEMTHU_392: tiền vào đúng quỹ, đúng số tiền, nội dung có số tham chiếu thì tự ghép, đơn Chờ giao; sai số tiền, sai nội dung, quỹ khác không ghép; không bỏ ghép được; đường dẫn chung bị từ chối", async () => {
    const placed = await placeTransferOrder();
    const reference = placed.transfer.content as string;
    const wrongAmount = await simulate(receivingFund, "70000", `CK ${reference}`);
    expect(wrongAmount.body).toMatchObject({ status: "unmatched", marketplacePayment: null });
    expect((await simulate(receivingFund, "74000", `CK ${reference}1`)).body.status).toBe("unmatched");
    expect((await simulate(otherFund, "74000", `CK ${reference}`)).body.status).toBe("unmatched");
    expect((await buyer("get", `/buyer/orders/${placed.orderId}`)).body).toMatchObject({ status: "awaiting_payment", paymentStatus: "unpaid" });

    const matched = await simulate(receivingFund, "74000", `MBVCB.9988.${reference.toLowerCase()}.CT tu 0123 NGUYEN VAN A`);
    expect(matched.body).toMatchObject({ status: "matched", autoMatched: true, payment: null, marketplacePayment: { reference, documentNo: placed.documentNo } });
    const detail = (await buyer("get", `/buyer/orders/${placed.orderId}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1)).toMatchObject({ status: "paid" });
    expect(detail.events.at(-1).note).toMatch(/^BANK_TRANSFER SIM/);
    const reopened = await store.call("post", `/finance/bank-transactions/${matched.body.id}/reopen`, { version: matched.body.version });
    expect(reopened.status).toBe(409);
    expect(reopened.body.error.message).toBe("Giao dịch đã ghi nhận tiền đơn VComm, không bỏ ghép được.");
    // Chuyển trùng lần nữa: lần thanh toán đã ghi nhận, giao dịch để kế toán xử lý.
    expect((await simulate(receivingFund, "74000", reference)).body.status).toBe("unmatched");
    expect((await store.call("get", `/marketplace/orders/${placed.orderId}`)).body).toMatchObject({ paidAmount: "74000", canConfirmTransfer: false });

    const notify = await request(application.getHttpServer()).post("/api/v1/public/payments/bank_transfer/notify").send({ reference, amount: 74000 });
    expect(notify.status).toBe(403);
    expect((await pool.query("SELECT result_code FROM marketplace.payment_notifications WHERE gateway_code = 'bank_transfer'")).rows.map((row) => row.result_code)).toEqual(["invalid_signature"]);
  });

  it("KICHBAN_KIEMTHU_393: kế toán xác nhận tay lần thanh toán đang chờ, một lần; người không có quyền bị từ chối; số tham chiếu không thuộc đơn trả 404", async () => {
    const placed = await placeTransferOrder();
    const reference = placed.transfer.content as string;
    expect((await store.call("get", `/marketplace/orders/${placed.orderId}`)).body).toMatchObject({ canConfirmTransfer: true });
    const outsider = await signIn(application, "phuc.le@vcomm.test");
    const path = `/marketplace/orders/${placed.orderId}/transfer-received`;
    expect((await outsider.call("post", path, { body: { reference, bankTransactionNo: "FT001" } })).status).toBe(403);
    expect((await store.call("post", path, { reference: "KHONGCO01", bankTransactionNo: "FT001" })).status).toBe(404);
    expect((await store.call("post", path, { reference, bankTransactionNo: " " })).status).toBe(400);
    const confirmed = await store.call("post", path, { reference, bankTransactionNo: "FT26315001" });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", canConfirmTransfer: false });
    expect(confirmed.body.payments.at(-1)).toMatchObject({ reference, status: "succeeded", responseCode: "manual", transactionNo: "FT26315001" });
    const again = await store.call("post", path, { reference, bankTransactionNo: "FT26315001" });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe("Lần thanh toán không còn chờ xác nhận.");
    expect((await pool.query("SELECT count(*)::int AS count FROM core.audit_events WHERE action = 'marketplace.payment.transfer_confirmed' AND entity_id = $1", [placed.orderId])).rows[0].count).toBe(
      1,
    );
  });

  it("KICHBAN_KIEMTHU_394: tiền về sau khi đơn quá hạn tự hủy thì vẫn ghép, lập việc chờ hoàn tiền", async () => {
    const placed = await placeTransferOrder();
    await pool.query("UPDATE marketplace.orders SET payment_deadline = now() - interval '1 minute' WHERE id = $1", [placed.orderId]);
    expect(await application.get(MarketplacePaymentsService).expireDue()).toBeGreaterThanOrEqual(1);
    expect((await buyer("get", `/buyer/orders/${placed.orderId}`)).body.status).toBe("cancelled");
    const late = await simulate(receivingFund, "74000", `CK ${placed.transfer.content}`);
    expect(late.body).toMatchObject({ status: "matched" });
    const refunds = (await pool.query("SELECT reason, amount::int AS amount, status FROM marketplace.refunds WHERE order_id = $1", [placed.orderId])).rows;
    expect(refunds).toEqual([{ reason: "paid_after_cancel", amount: 74000, status: "pending" }]);
  });
});
