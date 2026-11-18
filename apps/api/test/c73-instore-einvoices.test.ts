// CONG_VIEC_73 lát L6: hóa đơn điện tử lập thay cửa hàng liên kết theo ủy nhiệm và hóa đơn phí sàn tháng
// (QUYTAC_NGHIEPVU_587 đến 589; API_334; TIEUCHI_NGHIEMTHU_557; KICHBAN_KIEMTHU_763).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EinvoicesService } from "../src/einvoice/einvoices.service";
import { InstoreEinvoicesService, mandatedItems } from "../src/instore/mandated-einvoices.service";
import { InstorePayoutsService } from "../src/instore/payouts.service";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { prepareAffiliate, operator, type AffiliateFixture } from "./c55-fixture";
import type { Session } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

const secret = "BIMATKIEMTHU0123456789";
const tmnCode = "VCOMMTST";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let hoa: { id: string; call: BuyerCall; phone: string };
let year: number;
let firstTransaction: string;
let ipnNo = 14000500;

const http = () => request(application.getHttpServer());
const admin = (method: "get" | "put" | "post" | "patch", path: string, body?: object) => fixture.admin.call(method, path, { companyId: operator, ...(body ? { body } : {}) });
const portal = (session: Session, method: "get" | "post", path: string, body?: object) => session.call(method, `/merchant-portal${path}`, body ? { body } : {});

function vnpayQuery(reference: string, amount: number): Record<string, string> {
  ipnNo += 1;
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_TxnRef: reference,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: String(ipnNo),
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261117103000",
    vnp_OrderInfo: "Thanh toan don",
  };
  return { ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, secret).hash };
}

// Khách quét mã QR của đơn thu hộ, trả toàn bộ qua VNPAY; trả số giao dịch LK….
async function sale(billAmount: number, invoiceInfo: object | null = null): Promise<string> {
  const created = await portal(fixture.cashier, "post", "/checkouts", { clientKey: randomUUID(), outletId: fixture.outletA, billAmount: String(billAmount), collectInApp: true });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  expect((await hoa.call("post", "/buyer/instore/checkouts/claim", { token: created.body.qrUrl.split("/tt/")[1] })).status).toBe(200);
  const paid = await hoa.call("post", `/buyer/instore/checkouts/${created.body.id}/pay`, { points: 0, method: "vnpay_qr", invoiceInfo });
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  const reference = new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
  expect((await http().get("/api/v1/public/payments/vnpay/ipn").query(vnpayQuery(reference, billAmount))).body.RspCode).toBe("00");
  const result = (await portal(fixture.cashier, "get", `/checkouts/${created.body.id}`)).body;
  expect(result.status).toBe("completed");
  return result.transactionId as string;
}

const mandateBody = (overrides: Record<string, unknown> = {}) => ({
  sellerName: "Hộ kinh doanh Cà phê Hạt Nâu",
  taxCode: "0311111119",
  address: "12 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
  taxMethod: "deduction",
  defaultVatRate: "8",
  mandateNo: "UN-01/2026",
  effectiveFrom: `${year}-01-01`,
  expiresOn: null,
  series: [{ year, series: `C${String(year).slice(2)}THN` }],
  ...overrides,
});

beforeAll(async () => {
  Object.assign(process.env, {
    VNPAY_TMN_CODE: tmnCode,
    VNPAY_HASH_SECRET: secret,
    VNPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/vnpay/return",
    VNPAY_PAYMENT_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  });
  ({ application, pool } = await startTestApplication());
  fixture = await prepareAffiliate(application, pool);
  year = Number(fixture.today.slice(0, 4));
  expect((await fixture.call("post", "/finance/ledger/setup")).status).toBe(201);
  expect((await admin("put", "/marketplace/payment-methods/vnpay_qr", { isEnabled: true })).status).toBe(200);
  expect((await admin("put", "/finance/instore/gateway-fees", { rates: [{ method: "vnpay_qr", percent: "0.9", fixedAmount: "1100", effectiveFrom: fixture.today }] })).status).toBe(200);
  const partner = (await pool.query("SELECT partner_id FROM affiliate.merchants WHERE id = $1", [fixture.merchantId])).rows[0].partner_id as string;
  const account = (
    await pool.query("INSERT INTO crm.partner_bank_accounts (partner_id, bank_name, account_no, account_holder, is_default) VALUES ($1, 'Vietcombank', '0071009998887', 'HAT NAU', true) RETURNING id", [
      partner,
    ])
  ).rows[0].id as string;
  const collection = (await admin("get", `/affiliate/merchants/${fixture.merchantId}/collection`)).body;
  const enabled = await admin("patch", `/affiliate/merchants/${fixture.merchantId}/collection`, {
    enabled: true,
    feePercent: "2",
    payoutBankAccountId: account,
    acknowledged: true,
    version: collection.version,
  });
  expect(enabled.status, JSON.stringify(enabled.body)).toBe(200);
  hoa = await fixture.register("0938740002", "Phạm Thị Hoa");
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("Dòng hóa đơn ủy nhiệm (QUYTAC_NGHIEPVU_589)", () => {
  it("dòng của đơn kèm thuế suất; voucher cửa hàng là chiết khấu chia theo thuế suất; tổng không khớp thì một dòng mặc định", () => {
    const lines = [
      { name: "Cà phê sữa", unit: "Ly", quantity: "2", unitPrice: "54000", amount: "108000", gift: false, vatRate: "8" },
      { name: "Bánh mì", unit: "Cái", quantity: "1", unitPrice: "22000", amount: "22000", gift: false, vatRate: "10" },
      { name: "Nước suối", unit: "Chai", quantity: "1", unitPrice: "0", amount: "0", gift: true },
    ];
    const items = mandatedItems({ documentNo: "LK00000001", billAmount: 130000, lines, taxMethod: "deduction", defaultVatRate: "8", storeDiscount: 13000 });
    expect(items.map((item) => [item.itemName, item.vatRate, item.netAmount, item.taxAmount, item.totalAmount, item.isPromotion])).toEqual([
      ["Cà phê sữa", "8", 100000, 8000, 108000, false],
      ["Bánh mì", "10", 20000, 2000, 22000, false],
      ["Nước suối", "8", 0, 0, 0, true],
      // 13.000 chia theo tiền hàng: 108.000 / 130.000 → 10.800, phần còn lại 2.200.
      ["Chiết khấu thương mại (voucher cửa hàng)", "8", -10000, -800, -10800, false],
      ["Chiết khấu thương mại (voucher cửa hàng)", "10", -2000, -200, -2200, false],
    ]);
    const fallback = mandatedItems({ documentNo: "LK00000002", billAmount: 99000, lines, taxMethod: "direct", defaultVatRate: null, storeDiscount: 0 });
    expect(fallback).toEqual([expect.objectContaining({ itemName: "Hàng hóa, dịch vụ theo giao dịch số LK00000002", vatRate: "not_declared", netAmount: 99000, taxAmount: 0, quantity: 1 })]);
  });
});

describe("Hóa đơn ủy nhiệm của giao dịch thu hộ (KICHBAN_KIEMTHU_763)", () => {
  it("công ty vận hành sàn chưa bật hóa đơn điện tử, cửa hàng chưa có ủy nhiệm: vẫn bán, ghi việc chờ lập", async () => {
    firstTransaction = await sale(108000);
    expect((await pool.query("SELECT reason FROM affiliate.einvoice_backlog WHERE transaction_id = $1", [firstTransaction])).rows).toEqual([{ reason: "einvoice_off" }]);
    const settings = (await admin("get", "/finance/einvoice-settings")).body;
    const saved = await admin("put", "/finance/einvoice-settings", {
      enabled: true,
      startDate: `${year}-01-01`,
      provider: "simulator",
      environment: "test",
      withTaxCode: true,
      templateCode: "1",
      appId: null,
      taxCode: null,
      username: null,
      simulation: "normal",
      series: [{ year, series: `C${String(year).slice(2)}TAA` }],
      cashRegisterSeries: [],
      version: settings.version,
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const second = await sale(54000);
    const mandate = (await admin("get", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate`)).body;
    expect(mandate).toMatchObject({ mandate: null, series: [], provider: "simulator", providerSupportsMandate: true, einvoiceEnabled: true, canManage: true, version: 0 });
    expect(mandate.backlog.map((item: { transactionId: string; reason: string }) => [item.transactionId, item.reason])).toEqual([
      [firstTransaction, "einvoice_off"],
      [second, "mandate_missing"],
    ]);
    // Lập bù khi vẫn thiếu dữ liệu: báo lý do, giữ việc chờ.
    const blocked = await admin("post", `/affiliate/transactions/${second}/einvoice`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toBe("Chưa lập được: cửa hàng chưa có dữ liệu ủy nhiệm hóa đơn.");
  });

  it("lưu dữ liệu ủy nhiệm, ký hiệu theo năm, tệp PDF; kiểm định dạng, năm của ký hiệu, tệp không phải PDF", async () => {
    const put = (body: object) => admin("put", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate`, body);
    expect((await put(mandateBody({ series: [{ year, series: "C20THN" }], version: 0 }))).status).toBe(400);
    expect((await put(mandateBody({ defaultVatRate: null, version: 0 }))).status).toBe(400);
    const saved = await put(mandateBody({ version: 0 }));
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toMatchObject({
      mandate: { sellerName: "Hộ kinh doanh Cà phê Hạt Nâu", taxMethod: "deduction", defaultVatRate: "8", mandateNo: "UN-01/2026", file: null },
      series: [{ year, series: `C${String(year).slice(2)}THN` }],
      version: 1,
    });
    const upload = (content: Buffer, name: string) =>
      fixture.admin.call("post", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate/file`, { companyId: operator }).attach("file", content, name);
    expect((await upload(Buffer.from("khong phai pdf"), "uy-nhiem.txt")).status).toBe(400);
    const uploaded = await upload(Buffer.from("%PDF-1.4\n% van ban uy nhiem\n"), "uy-nhiem.pdf");
    expect(uploaded.status, JSON.stringify(uploaded.body)).toBe(200);
    expect(uploaded.body.mandate.file).toEqual({ name: "uy-nhiem.pdf", size: 28 });
    const audit = await pool.query("SELECT action FROM core.audit_events WHERE entity_id = $1 AND action LIKE 'affiliate_merchant.einvoice%' ORDER BY occurred_at", [fixture.merchantId]);
    expect(audit.rows.map((row) => row.action)).toEqual(["affiliate_merchant.einvoice_mandate", "affiliate_merchant.einvoice_mandate_file"]);
  });

  it("lập bù: hóa đơn giá trị gia tăng, người bán là cửa hàng, ký hiệu riêng, dòng ủy nhiệm, một dòng mặc định thuế suất 8 %", async () => {
    const reissued = await admin("post", `/affiliate/transactions/${firstTransaction}/einvoice`);
    expect(reissued.status, JSON.stringify(reissued.body)).toBe(200);
    expect(reissued.body).toMatchObject({ status: "issued", series: `C${String(year).slice(2)}THN`, invoiceNo: "1", totalAmount: "108000", hasPdf: true });
    const invoice = (await admin("get", `/finance/einvoices/${reissued.body.id}`)).body;
    const documentNo = (await pool.query("SELECT document_no FROM affiliate.transactions WHERE id = $1", [firstTransaction])).rows[0].document_no;
    expect(invoice).toMatchObject({
      templateCode: "1",
      seller: { name: "Hộ kinh doanh Cà phê Hạt Nâu", taxCode: "0311111119", address: "12 Lê Lợi, Quận 1, TP. Hồ Chí Minh" },
      buyer: { anonymous: true },
      note: `Hóa đơn lập theo ủy nhiệm số UN-01/2026 ngày 01/01/${year}`,
      sourceDocumentNo: documentNo,
      sourceKind: "affiliate_transaction",
      sellerName: "Hộ kinh doanh Cà phê Hạt Nâu",
      mandated: true,
      sourceDocumentId: null,
      netAmount: "100000",
      taxAmount: "8000",
    });
    expect(invoice.lines).toEqual([expect.objectContaining({ itemName: `Hàng hóa, dịch vụ theo giao dịch số ${documentNo}`, vatRate: "8", netAmount: "100000", taxAmount: "8000" })]);
    expect((await pool.query("SELECT 1 FROM affiliate.einvoice_backlog WHERE transaction_id = $1", [firstTransaction])).rows).toHaveLength(0);
    // Không lập bù lần hai.
    expect((await admin("post", `/affiliate/transactions/${firstTransaction}/einvoice`)).status).toBe(404);
  });

  it("giao dịch mới có thông tin người mua: lập ngay khi hoàn tất, số tiếp theo của ký hiệu cửa hàng; xem ở cổng cửa hàng, ứng dụng, tải PDF", async () => {
    const transactionId = await sale(216000, { name: "Công ty TNHH Lá Xanh", taxCode: "0312345678", address: "5 Pasteur, Quận 1" });
    await application.get(EinvoicesService).sendDue();
    const detail = (await portal(fixture.owner, "get", `/transactions/${transactionId}`)).body;
    expect(detail.einvoice).toMatchObject({ status: "issued", invoiceNo: "2", totalAmount: "216000" });
    const stored = (await pool.query("SELECT buyer, template_code FROM finance.einvoices WHERE id = $1", [detail.einvoice.id])).rows[0];
    expect(stored).toMatchObject({ buyer: { name: "Công ty TNHH Lá Xanh", taxCode: "0312345678", address: "5 Pasteur, Quận 1", anonymous: false }, template_code: "1" });
    const pdf = await fixture.owner.call("get", `/merchant-portal/transactions/${transactionId}/einvoice.pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    // Khách xem trong lịch sử giao dịch, lấy đường dẫn tải có hạn.
    const history = (await hoa.call("get", "/buyer/affiliate/transactions")).body as { id: string; einvoice: { invoiceNo: string } | null }[];
    expect(history.find((item) => item.id === transactionId)?.einvoice).toMatchObject({ invoiceNo: "2", hasPdf: true });
    const link = await hoa.call("post", `/buyer/affiliate/transactions/${transactionId}/einvoice-link`, {});
    expect(link.status, JSON.stringify(link.body)).toBe(200);
    const file = await http().get(link.body.url);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("application/pdf");
    expect((await http().get(`${link.body.url}x`)).status).toBe(404);
    // Danh sách hóa đơn điện tử của công ty vận hành sàn: lọc hóa đơn lập theo ủy nhiệm.
    const mandated = (await admin("get", "/finance/einvoices?mandated=true")).body.data as { sellerName: string; mandated: boolean }[];
    expect(mandated).toHaveLength(2);
    expect(mandated.every((item) => item.mandated && item.sellerName === "Hộ kinh doanh Cà phê Hạt Nâu")).toBe(true);
    // Hóa đơn ủy nhiệm chưa lập thay thế được (xử lý khi hủy làm ở lát L7).
    const version = (await admin("get", `/finance/einvoices/${detail.einvoice.id}`)).body.version;
    const replaced = await admin("post", `/finance/einvoices/${detail.einvoice.id}/replace`, { buyerName: "Công ty A", buyerTaxCode: null, buyerAddress: "1 Lê Lợi", reason: "Sai tên người mua", version });
    expect(replaced.status, JSON.stringify(replaced.body)).toBe(409);
    expect(replaced.body.error.message).toBe("Hóa đơn lập theo ủy nhiệm hoặc hóa đơn phí sàn chưa lập thay thế được ở đây.");
  });

  it("ủy nhiệm hết hiệu lực: ghi việc chờ; nhà cung cấp MISA: hóa đơn ở Lỗi cài đặt, không gửi", async () => {
    const current = (await admin("get", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate`)).body;
    const expired = await admin("put", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate`, mandateBody({ effectiveFrom: `${year - 1}-01-01`, expiresOn: `${year - 1}-12-31`, version: current.version }));
    expect(expired.status, JSON.stringify(expired.body)).toBe(200);
    const inactive = await sale(54000);
    expect((await pool.query("SELECT reason FROM affiliate.einvoice_backlog WHERE transaction_id = $1", [inactive])).rows).toEqual([{ reason: "mandate_inactive" }]);
    // Ký hiệu đã có hóa đơn thì không đổi.
    const series = await admin("put", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate`, mandateBody({ series: [{ year, series: `C${String(year).slice(2)}TXY` }], version: expired.body.version }));
    expect(series.status).toBe(400);
    expect((await admin("put", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate`, mandateBody({ version: expired.body.version }))).status).toBe(200);
    await pool.query("UPDATE finance.einvoice_settings SET provider = 'misa' WHERE company_id = $1", [operator]);
    try {
      const reissued = await admin("post", `/affiliate/transactions/${inactive}/einvoice`);
      expect(reissued.status, JSON.stringify(reissued.body)).toBe(200);
      expect(reissued.body.status).toBe("setup_error");
      const row = (await pool.query("SELECT last_error, provider FROM finance.einvoices WHERE id = $1", [reissued.body.id])).rows[0];
      expect(row).toEqual({ last_error: "einvoiceMandateUnsupported", provider: "misa" });
      expect((await admin("get", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate`)).body).toMatchObject({ provider: "misa", providerSupportsMandate: false });
    } finally {
      await pool.query("UPDATE finance.einvoice_settings SET provider = 'simulator' WHERE company_id = $1", [operator]);
    }
  });
});

describe("Hóa đơn phí sàn tháng (QUYTAC_NGHIEPVU_587)", () => {
  it("một hóa đơn cho cửa hàng: tổng phí sàn H của tháng, thuế theo bảng chuyển tiền, ngày cuối tháng; không bút toán, không lập trùng", async () => {
    const payouts = application.get(InstorePayoutsService);
    await payouts.generateDaily(fixture.today);
    const fee = (await pool.query("SELECT sum(platform_fee)::text AS fee, sum(platform_fee_tax)::text AS tax FROM instore.payouts WHERE merchant_id = $1", [fixture.merchantId])).rows[0];
    expect(Number(fee.fee)).toBeGreaterThan(0);
    const journals = async () => Number((await pool.query("SELECT count(*) FROM accounting.journals")).rows[0].count);
    const before = await journals();
    const month = `${fixture.today.slice(0, 7)}-01`;
    const service = application.get(InstoreEinvoicesService);
    const created = await service.generateMonthlyFeeInvoices(month);
    expect(created).toHaveLength(1);
    expect(await service.generateMonthlyFeeInvoices(month)).toEqual([]);
    expect(await journals()).toBe(before);
    const invoice = (await admin("get", `/finance/einvoices/${created[0]}`)).body;
    const last = (await pool.query("SELECT (date_trunc('month', $1::date) + interval '1 month' - interval '1 day')::date::text AS value", [fixture.today])).rows[0].value;
    expect(invoice).toMatchObject({
      invoiceDate: last,
      sourceKind: "fee_invoice",
      sourceDocumentNo: `Phí sàn ${fixture.today.slice(5, 7)}/${year}`,
      mandated: false,
      buyer: { name: "Cà phê Hạt Nâu", taxCode: "0311111119", anonymous: false },
      netAmount: String(Number(fee.fee)),
      taxAmount: String(Number(fee.tax)),
    });
    expect(invoice.lines).toEqual([
      expect.objectContaining({ itemName: `Phí dịch vụ sàn tháng ${fixture.today.slice(5, 7)}/${year}`, vatRate: "10", netAmount: String(Number(fee.fee)) }),
    ]);
  });
});
