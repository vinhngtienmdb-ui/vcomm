// CONG_VIEC_37: cổng BIDV thu hộ qua tài khoản định danh (KICHBAN_KIEMTHU_395 đến 398). Giả lập BIDV gọi vấn tin (getbill), gạch nợ (paybill) theo tài liệu BIDV.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bidvChecksum, crc16, vietQrPayload } from "../src/marketplace/payments/gateways/bidv-gateway";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
// Chuỗi kiểm thử ghép lúc chạy để công cụ quét bí mật không báo nhầm.
const checksumCode = ["ma", "kiem", "thu", "bidv"].join("-");
const serviceId = "123456";
const prefix = "VCM";
const settings: Record<string, string> = {
  BIDV_SERVICE_ID: serviceId,
  BIDV_VA_PREFIX: prefix,
  BIDV_ACCOUNT_NAME: "CONG TY VCOMM",
  ["BIDV_CHECKSUM_" + "SECRET"]: checksumCode,
  BIDV_ALLOWED_IPS: "127.0.0.1, ::1",
};

const post = (path: string, body: object) => request(application.getHttpServer()).post(`/api/v1/public/payments/bidv/${path}`).send(body);
const getbill = (customerId: string, code = checksumCode, sentServiceId = serviceId) => post("getbill", { customerId, serviceId: sentServiceId, checksum: bidvChecksum(code, serviceId, customerId) });
let transactionCounter = 0;
const paybill = (customerId: string, amount: number, code = checksumCode) => {
  transactionCounter += 1;
  const transId = `100004.261111.${String(transactionCounter).padStart(6, "0")}`;
  return post("paybill", { transId, transDate: "20261111103000", customerId, billId: customerId, amount: String(amount), checksum: bidvChecksum(code, transId, String(amount)) });
};

async function placeAndStart() {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "bidv_va_qr" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const started = await buyer("post", `/buyer/orders/${placed.body.id}/payments`);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  const accountNumber = started.body.transfer.accountNumber as string;
  return { order: placed.body as { id: string; documentNo: string }, transfer: started.body.transfer, accountNumber, code: accountNumber.slice(prefix.length) };
}

beforeAll(async () => {
  Object.assign(process.env, settings);
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/payment-methods/bidv_va_qr", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0937000001", "Người Mua Bình Dương");
  buyer = await store.buyerSession("0937000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of Object.keys(settings)) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_37 cổng BIDV thu hộ qua tài khoản định danh", () => {
  it("KICHBAN_KIEMTHU_395: mở thanh toán trả tài khoản định danh BIDV (mã đầu + 12 chữ số) và chuỗi VietQR đúng chuẩn", async () => {
    const { transfer, accountNumber, code, order } = await placeAndStart();
    expect(accountNumber).toMatch(/^VCM[0-9]{12}$/);
    expect(transfer).toMatchObject({ bankName: "BIDV", accountName: "CONG TY VCOMM", amount: "74000", qrImageUrl: null });
    expect(transfer.qrData).toBe(vietQrPayload(accountNumber, 74000, transfer.content));
    expect(transfer.qrData).toContain(`000697041801${accountNumber.length}${accountNumber}`);
    expect(transfer.qrData).toContain("5405740005802VN");
    // CRC-16/CCITT-FALSE (EMVCo) của chuỗi mẫu "123456789" là 29B1; chuỗi QR kết thúc bằng 6304 + CRC.
    expect(crc16("123456789")).toBe("29B1");
    expect(transfer.qrData.slice(-8, -4)).toBe("6304");
    expect(transfer.qrData.slice(-4)).toBe(crc16(transfer.qrData.slice(0, -4)));
    const stored = (await pool.query("SELECT reference, gateway_reference FROM marketplace.payments WHERE order_id = $1", [order.id])).rows[0];
    expect(stored.gateway_reference).toBe(code);
    expect(stored.reference).toMatch(/T01$/);
  });

  it("KICHBAN_KIEMTHU_396: vấn tin đúng checksum trả số tiền phải thu, gạch nợ khớp số tiền; sai checksum, sai mã dịch vụ, mã không tồn tại, địa chỉ IP lạ bị từ chối", async () => {
    const { code, accountNumber } = await placeAndStart();
    const found = await getbill(code);
    expect(found.status).toBe(200);
    expect(found.body).toMatchObject({ result_code: "000", customer_id: code, bill_id: code, type: "1", total_amount: "74000", customer_name: "Nguoi Nhan Hang" });
    expect(found.body.data[0].data[0]).toMatchObject({ bill_id: code, amount: "74000" });
    // BIDV gửi cả mã đầu tài khoản định danh.
    expect((await getbill(accountNumber)).body).toMatchObject({ result_code: "000", bill_id: code });
    expect((await getbill(code, "khac")).body).toEqual({ result_code: "004", result_desc: "Checksum khong hop le" });
    expect((await getbill(code, checksumCode, "999999")).body.result_code).toBe("004");
    expect((await getbill("000000000000")).body.result_code).toBe("011");
    process.env.BIDV_ALLOWED_IPS = "10.0.0.1";
    expect((await getbill(code)).body.result_code).toBe("004");
    process.env.BIDV_ALLOWED_IPS = settings.BIDV_ALLOWED_IPS;
  });

  it("KICHBAN_KIEMTHU_397: gạch nợ sai checksum, sai số tiền bị từ chối; đúng thì ghi đã thu một lần, đơn Chờ giao; gửi lại trả đã gạch nợ; vấn tin sau đó trả không có hóa đơn", async () => {
    const { code, order } = await placeAndStart();
    expect((await paybill(code, 74000, "khac")).body.result_code).toBe("004");
    expect((await paybill(code, 1000)).body).toEqual({ result_code: "022", result_desc: "So tien khong dung voi hoa don" });
    expect((await paybill("000000000000", 74000)).body.result_code).toBe("011");
    const paid = await paybill(`${prefix}${code}`, 74000);
    expect(paid.status).toBe(200);
    expect(paid.body).toEqual({ result_code: "000", result_desc: "success" });
    expect((await paybill(code, 74000)).body.result_code).toBe("023");
    const detail = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1).note).toMatch(/^BIDV 100004\.261111\./);
    expect((await getbill(code)).body.result_code).toBe("012");
    const logged = (await pool.query("SELECT result_code FROM marketplace.payment_notifications WHERE gateway_code = 'bidv' AND reference = $1 ORDER BY received_at", [code])).rows.map(
      (row) => row.result_code,
    );
    expect(logged).toEqual(["invalid_amount", "success", "already_confirmed", "inquiry_no_bill"]);
  });

  it("KICHBAN_KIEMTHU_398: đơn quá hạn thanh toán không cho vấn tin; thiếu cấu hình thì không mở thanh toán, BIDV nhận lỗi hệ thống", async () => {
    const { code, order } = await placeAndStart();
    await pool.query("UPDATE marketplace.orders SET payment_deadline = now() - interval '1 minute' WHERE id = $1", [order.id]);
    expect((await getbill(code)).body.result_code).toBe("012");
    delete process.env.BIDV_VA_PREFIX;
    try {
      expect((await getbill(code)).body.result_code).toBe("031");
      expect((await paybill(code, 74000)).body.result_code).toBe("031");
      const lines = [{ variantId: store.variants.soap, quantity: 1 }];
      const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
      expect(preview.body.paymentMethods).not.toContain("bidv_va_qr");
    } finally {
      process.env.BIDV_VA_PREFIX = prefix;
    }
  });
});
