// CONG_VIEC_73 lát L5: cửa hàng tập đoàn của công ty khác công ty vận hành sàn (QUYTAC_NGHIEPVU_587).
// Công ty vận hành sàn (công ty mẹ) ghi Nợ 112 / Có 336; công ty sở hữu cửa hàng ghi dòng "Ứng dụng VComm" Nợ 136 / Có 131; lập bảng ghi phí ở hai công ty;
// ghi đã chuyển lập phiếu chi ở công ty vận hành sàn và phiếu thu ở công ty sở hữu (quỹ ngân hàng của cửa hàng), trừ công nợ hai bên.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { InstorePayoutsService } from "../src/instore/payouts.service";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { assignRetailRole, createRetailCatalog, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication } from "./setup-database";

const secret = "BIMATKIEMTHU0123456789";
const group = testIds.groupCompany;

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let groupAdmin: Session;
let operatorFund: string;
let payoutId: string;

const http = () => request(application.getHttpServer());

async function journal(sourceType: string, sourceId: string) {
  const rows = await pool.query<{ company_id: string; code: string; debit: string; credit: string }>(
    `SELECT j.company_id, a.code, l.debit::text, l.credit::text FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.accounts a ON a.id = l.account_id WHERE j.source_type = $1 AND j.source_id = $2 ORDER BY l.debit DESC, a.code`,
    [sourceType, sourceId],
  );
  return rows.rows.map((row) => [row.company_id === group ? "mẹ" : "bán lẻ", row.code, Number(row.debit), Number(row.credit)]);
}

beforeAll(async () => {
  Object.assign(process.env, {
    VNPAY_TMN_CODE: "VCOMMTST",
    VNPAY_HASH_SECRET: secret,
    VNPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/vnpay/return",
    VNPAY_PAYMENT_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  });
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  fixture = await createRetailFixture(application, pool);
  await createRetailCatalog(application, pool, fixture, today);
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  // Công ty mẹ vận hành sàn; hai công ty có đối tác nội bộ, đã khởi tạo sổ kế toán.
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: group, body: { companyId: group } })).status).toBe(200);
  await pool.query("INSERT INTO crm.partners (kind, name, company_id, search_text) VALUES ('organization', 'Tập đoàn VComm', $1, 'tap doan vcomm'), ('organization', 'VComm Bán lẻ', $2, 'vcomm ban le') ON CONFLICT (company_id) DO NOTHING", [
    group,
    retail,
  ]);
  const groupLedger = await groupAdmin.call("post", "/finance/ledger/setup", { companyId: group });
  expect([201, 409], JSON.stringify(groupLedger.body)).toContain(groupLedger.status);
  const retailLedger = await fixture.admin.call("post", "/finance/ledger/setup", { companyId: retail });
  expect([201, 409], JSON.stringify(retailLedger.body)).toContain(retailLedger.status);
  expect((await groupAdmin.call("put", "/marketplace/payment-methods/vnpay_qr", { companyId: group, body: { isEnabled: true } })).status).toBe(200);
  await groupAdmin.call("put", "/finance/instore/gateway-fees", { companyId: group, body: { rates: [{ method: "vnpay_qr", percent: "0.9", fixedAmount: "1100", effectiveFrom: today }] } });
  const fund = await groupAdmin.call("post", "/finance/funds", { companyId: group, body: { code: "NHME", name: "Vietcombank công ty mẹ", kind: "bank", bankName: "Vietcombank", accountNo: "0011", accountHolder: "VComm" } });
  expect(fund.status, JSON.stringify(fund.body)).toBe(201);
  operatorFund = fund.body.id;
  const store = (await fixture.admin.call("post", "/retail/stores", { companyId: retail, body: storeBody(fixture, { appPaymentEnabled: true, platformFeePercent: "1" }) })).body;
  expect(store.appPaymentEnabled, JSON.stringify(store)).toBe(true);
  const registers = (await fixture.admin.call("post", `/retail/stores/${store.id}/registers`, { companyId: retail, body: { code: "Q01", name: "Quầy 1" } })).body.registers;
  const cashier = await assignRetailRole(application, pool, "thungan.me@vcomm.test", "Nguyễn Thị Lan", "cashier", fixture.storeBranch);
  const shiftId = (await cashier.call("post", "/retail/shifts", { companyId: retail, body: { registerId: registers[0].id, openingCash: "0" } })).body.id;
  const rice = (await pool.query("SELECT v.id FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE p.name = 'Gạo ST25 túi 5kg'")).rows[0].id;
  const unit = (await pool.query("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0].id;
  const checkout = await cashier.call("post", "/retail/checkouts", {
    companyId: retail,
    body: { shiftId, clientKey: randomUUID(), lines: [{ variantId: rice, unitId: unit, quantity: "1" }], expectedTotal: "110000" },
  });
  expect(checkout.status, JSON.stringify(checkout.body)).toBe(201);
  // Khách quét mã QR, trả toàn bộ qua VNPAY.
  const phone = "0939760001";
  await http().post("/api/v1/buyer/register/otp").send({ phone });
  await pool.query("UPDATE core.otp_codes SET code_hash = encode(sha256('246810'), 'hex') WHERE phone = '+84939760001' AND consumed_at IS NULL");
  const registered = await http().post("/api/v1/buyer/register").send({ phone, code: "246810", fullName: "Lê Văn Khách", password: "MatKhauNguoiMua@2026" });
  const token = registered.body.tokens.accessToken as string;
  const buyer = (method: "get" | "post", path: string, body?: object) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
  expect((await buyer("post", "/buyer/instore/checkouts/claim", { token: checkout.body.qrUrl.split("/tt/")[1] })).status).toBe(200);
  const paid = await buyer("post", `/buyer/instore/checkouts/${checkout.body.id}/pay`, { points: 0, method: "vnpay_qr" });
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  const parameters: Record<string, string> = {
    vnp_TmnCode: "VCOMMTST",
    vnp_Amount: "11000000",
    vnp_TxnRef: new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14000222",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261117103000",
    vnp_OrderInfo: "Thanh toan don",
  };
  const ipn = await http()
    .get("/api/v1/public/payments/vnpay/ipn")
    .query({ ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, secret).hash });
  expect(ipn.body.RspCode).toBe("00");
  expect((await cashier.call("get", `/retail/checkouts/${checkout.body.id}`, { companyId: retail })).body.status).toBe("completed");
  [payoutId] = await application.get(InstorePayoutsService).generateDaily(today);
  // Đơn dùng để đối chiếu bút toán của từng bước.
  process.env.C73_CHECKOUT = checkout.body.id;
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL", "C73_CHECKOUT"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("Hạch toán hai công ty khi cửa hàng tập đoàn khác công ty vận hành sàn (QUYTAC_NGHIEPVU_587)", () => {
  it("tiền về: công ty mẹ Nợ 112 / Có 3368; công ty bán lẻ Nợ 1368 / Có 131", async () => {
    const checkout = process.env.C73_CHECKOUT!;
    expect(await journal("instore_checkout", checkout)).toEqual([
      ["mẹ", "112", 110000, 0],
      ["mẹ", "3368", 0, 110000],
    ]);
    expect(await journal("instore_checkout_owner", checkout)).toEqual([
      ["bán lẻ", "1368", 110000, 0],
      ["bán lẻ", "131", 0, 110000],
    ]);
  });

  it("lập bảng: phí ghi ở hai công ty; công nợ phải trả nội bộ và phải thu nội bộ", async () => {
    // G 110.000; H 1 % = 1.100; I 10 % = 110; K 0,9 % + 1.100 = 2.090; chuyển 106.700.
    const detail = (await groupAdmin.call("get", `/finance/instore/payouts/${payoutId}`, { companyId: group })).body;
    expect(detail).toMatchObject({ recipientKind: "retail_company", collectedAmount: "110000", platformFee: "1100", platformFeeTax: "110", gatewayFee: "2090", amount: "106700" });
    expect(await journal("instore_payout", payoutId)).toEqual([
      ["mẹ", "3368", 3300, 0],
      ["mẹ", "33311", 0, 110],
      ["mẹ", "511", 0, 1100],
      ["mẹ", "6418", 0, 2090],
    ]);
    expect(await journal("instore_payout_owner", payoutId)).toEqual([
      ["bán lẻ", "6418", 3190, 0],
      ["bán lẻ", "1331", 110, 0],
      ["bán lẻ", "1368", 0, 3300],
    ]);
    // Công ty bán lẻ xem bảng của mình trong mini app Tài chính – Kế toán.
    const own = await fixture.admin.call("get", "/finance/instore/payouts", { companyId: retail });
    expect(own.body.data.map((item: { id: string }) => item.id)).toEqual([payoutId]);
    expect((await fixture.admin.call("post", `/finance/instore/payouts/${payoutId}/transferred`, { companyId: retail, body: { transferredOn: "2026-12-01", bankTransactionNo: "X", fundId: operatorFund, version: 1 } })).status).toBe(403);
  });

  it("ghi đã chuyển: phiếu chi ở công ty mẹ, phiếu thu ở công ty bán lẻ vào quỹ ngân hàng của cửa hàng; công nợ hai bên hết", async () => {
    const current = (await groupAdmin.call("get", `/finance/instore/payouts/${payoutId}`, { companyId: group })).body;
    const done = await groupAdmin.call("post", `/finance/instore/payouts/${payoutId}/transferred`, {
      companyId: group,
      body: { transferredOn: current.businessDate, bankTransactionNo: "FT0001", fundId: operatorFund, version: current.version },
    });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body).toMatchObject({ status: "transferred", paymentNo: expect.stringMatching(/^PC/), receiptNo: expect.stringMatching(/^PT/), receiptMissing: false });
    const vouchers = (await pool.query("SELECT id, company_id, kind, fund_id FROM finance.payments WHERE instore_payout_id = $1 ORDER BY kind", [payoutId])).rows;
    expect(vouchers.map((row) => [row.company_id === group ? "mẹ" : "bán lẻ", row.kind])).toEqual([
      ["mẹ", "instore_payout_payment"],
      ["bán lẻ", "instore_payout_receipt"],
    ]);
    expect(vouchers[1].fund_id).toBe(fixture.bankFund);
    expect(await journal("payment", vouchers[0].id)).toEqual([
      ["mẹ", "3368", 106700, 0],
      ["mẹ", "112", 0, 106700],
    ]);
    expect(await journal("payment", vouchers[1].id)).toEqual([
      ["bán lẻ", "112", 106700, 0],
      ["bán lẻ", "1368", 0, 106700],
    ]);
    const open = await pool.query("SELECT open_amount::text FROM finance.debt_items WHERE source_type IN ('instore_payout', 'instore_payout_owner') AND source_id = $1", [payoutId]);
    expect(open.rows.map((row) => row.open_amount)).toEqual(["0.0000", "0.0000"]);
  });
});
