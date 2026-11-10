// CONG_VIEC_18: Đối soát ngân hàng (KICHBAN_KIEMTHU_246 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let accountant: Session;
let chief: Session;
let seller: Session;
let bankFund: string;
let otherFund: string;
let connectionId: string;
let secret: string;
let customer: string;
let supplier: string;
let today: string;
const retail: string = testIds.retailCompany;
let sequence = 0;

async function assign(email: string, name: string, role: string) {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, retail]);
  return signIn(application, email);
}
const call = (session: Session, method: "get" | "post" | "put" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
async function partner(name: string, taxCode: string, profile: Record<string, unknown>) {
  const created = await admin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name, taxCode } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  await admin.call("put", `/crm/partners/${created.body.id}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: false, paymentTermDays: 0, creditLimit: null, version: 0, ...profile },
  });
  return created.body.id as string;
}
// Payload theo định dạng SePay.
function payload(direction: "in" | "out", amount: number, date: string, extra: Record<string, unknown> = {}) {
  sequence += 1;
  return {
    id: 900000 + sequence,
    gateway: "Vietcombank",
    transactionDate: `${date} 10:15:00`,
    accountNumber: "0071000123456",
    code: null,
    content: `Chuyen tien ${sequence}`,
    transferType: direction,
    transferAmount: amount,
    accumulated: 50000000,
    subAccount: null,
    referenceCode: `FT${sequence}`,
    description: "",
    ...extra,
  };
}
const webhook = (body: unknown, key: string | null = secret, id = connectionId) => {
  const test = request(application.getHttpServer())
    .post(`/api/v1/public/bank-webhooks/${id}`)
    .send(body as object);
  return key === null ? test : test.set("Authorization", `Apikey ${key}`);
};
async function postedPayment(kind: string, partnerId: string, amount: string, date: string, fundId = bankFund) {
  const created = await call(accountant, "post", "/finance/payments", { kind, partnerId, fundId, paymentDate: date, amount, lines: [] });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await call(accountant, "post", `/finance/payments/${created.body.id}/submit`, { version: created.body.version });
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("posted");
  return submitted.body as { id: string; documentNo: string };
}
const transactionByExternal = async (externalId: number) =>
  (await pool.query<{ id: string; status: string; payment_id: string | null }>("SELECT id, status, payment_id FROM finance.bank_transactions WHERE external_id = $1", [String(externalId)])).rows[0];

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  accountant = await assign("ketoan.ns@vcomm.test", "Lý Thị Sổ", "accountant");
  chief = await assign("ketoantruong.ns@vcomm.test", "Tạ Văn Khớp", "chief_accountant");
  seller = await assign("banhang.ns@vcomm.test", "Ông Văn Hàng", "salesperson");
  const fund = await call(accountant, "post", "/finance/funds", { code: "VCB", name: "Vietcombank", kind: "bank", bankName: "Vietcombank", accountNo: "0071 000 123 456", accountHolder: "VCR" });
  expect(fund.status, JSON.stringify(fund.body)).toBe(201);
  bankFund = fund.body.id;
  otherFund = (await call(accountant, "post", "/finance/funds", { code: "ACB", name: "ACB", kind: "bank", bankName: "ACB", accountNo: "999888", accountHolder: "VCR" })).body.id;
  customer = await partner("Khách ngân hàng", "0320001801", { isCustomer: true, paymentTermDays: 30 });
  supplier = await partner("Nhà cung cấp ngân hàng", "0320001802", { isSupplier: true, paymentTermDays: 30 });
});

afterAll(async () => {
  await application?.close();
});

describe("CONG_VIEC_18 kết nối ngân hàng", () => {
  it("KICHBAN_KIEMTHU_246: chỉ người có quyền cài đặt tạo kết nối; khóa trả về một lần, đổi khóa", async () => {
    expect((await call(accountant, "put", `/finance/bank-connections/${bankFund}`, { provider: "sepay", enabled: true, version: null })).status).toBe(403);
    expect((await call(seller, "get", "/finance/bank-connections")).status).toBe(403);
    const created = await call(chief, "put", `/finance/bank-connections/${bankFund}`, { provider: "sepay", enabled: true, version: null });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    secret = created.body.secret;
    expect(secret).toMatch(/^[\w-]{32}$/);
    connectionId = created.body.item.connection.id;
    expect(created.body.item.connection).toMatchObject({ provider: "sepay", enabled: true, secretHint: secret.slice(-4), webhookPath: `/api/v1/public/bank-webhooks/${connectionId}`, version: 0 });
    const listed = await call(accountant, "get", "/finance/bank-connections");
    expect(listed.body.canSetup).toBe(false);
    expect(JSON.stringify(listed.body)).not.toContain(secret);
    expect(listed.body.funds.map((item: { fundId: string }) => item.fundId)).toEqual(expect.arrayContaining([bankFund, otherFund]));
    // Sai phiên bản; đổi khóa thì khóa cũ hết hiệu lực.
    expect((await call(chief, "put", `/finance/bank-connections/${bankFund}`, { provider: "sepay", enabled: true, version: 5 })).status).toBe(409);
    const rotated = await call(chief, "put", `/finance/bank-connections/${bankFund}`, { provider: "sepay", enabled: true, rotateSecret: true, version: 0 });
    expect(rotated.body.secret).not.toBe(secret);
    expect((await webhook(payload("in", 1000, today), secret)).status).toBe(401);
    secret = rotated.body.secret;
    const kept = await call(chief, "put", `/finance/bank-connections/${bankFund}`, { provider: "sepay", enabled: true, version: 1 });
    expect(kept.body.secret).toBeNull();
  });
});

describe("CONG_VIEC_18 quỹ ngừng dùng", () => {
  it("KICHBAN_KIEMTHU_246: quỹ ngừng dùng không tạo được kết nối mới", async () => {
    const inactive = (await call(accountant, "post", "/finance/funds", { code: "TCB", name: "Techcombank", kind: "bank", bankName: "Techcombank", accountNo: "1903", accountHolder: "VCR" })).body.id;
    await pool.query("UPDATE finance.funds SET status = 'inactive' WHERE id = $1", [inactive]);
    const refused = await call(chief, "put", `/finance/bank-connections/${inactive}`, { provider: "sepay", enabled: true, version: null });
    expect(refused.body.error.message).toBe("Quỹ đã ngừng dùng, không tạo được kết nối.");
  });
});

describe("CONG_VIEC_18 webhook", () => {
  it("KICHBAN_KIEMTHU_247: kiểm khóa, dữ liệu, số tài khoản; trùng mã chỉ lưu một lần", async () => {
    expect((await webhook(payload("in", 1000, today), null)).status).toBe(401);
    expect((await webhook(payload("in", 1000, today), "sai-khoa")).status).toBe(401);
    expect((await webhook(payload("in", 1000, today), secret, "00000000-0000-4000-8000-000000000000")).status).toBe(401);
    expect((await webhook({ id: 1, transferType: "in" })).status).toBe(400);
    expect((await webhook(payload("in", 0, today))).status).toBe(400);
    expect((await webhook(payload("in", 1000, today, { accountNumber: "111222" }))).status).toBe(409);
    const body = payload("in", 123456, today);
    const first = await webhook(body);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ success: true });
    expect((await webhook(body)).body).toEqual({ success: true });
    expect((await pool.query("SELECT count(*)::int AS count FROM finance.bank_transactions WHERE external_id = $1", [String(body.id)])).rows[0].count).toBe(1);
    const stored = (await pool.query("SELECT transaction_date::text, direction, amount::text, content, reference_code FROM finance.bank_transactions WHERE external_id = $1", [String(body.id)]))
      .rows[0];
    expect(stored).toEqual({ transaction_date: today, direction: "in", amount: "123456.0000", content: body.content, reference_code: body.referenceCode });
    // Lưu nội dung webhook gốc.
    expect((await pool.query("SELECT raw_payload FROM finance.bank_transactions WHERE external_id = $1", [String(body.id)])).rows[0].raw_payload).toEqual(body);
    // Kết nối tắt: từ chối.
    await call(chief, "put", `/finance/bank-connections/${bankFund}`, { provider: "sepay", enabled: false, version: 2 });
    expect((await webhook(payload("in", 1000, today))).status).toBe(401);
    await call(chief, "put", `/finance/bank-connections/${bankFund}`, { provider: "sepay", enabled: true, version: 3 });
  });
});

describe("CONG_VIEC_18 tự ghép", () => {
  it("KICHBAN_KIEMTHU_248: tiền vào ghép phiếu thu, tiền ra ghép phiếu chi đã ghi sổ cùng quỹ, cùng số tiền, lệch tối đa 3 ngày", async () => {
    const receipt = await postedPayment("customer_receipt", customer, "700000", addDays(today, -3));
    const incoming = payload("in", 700000, today);
    await webhook(incoming);
    expect(await transactionByExternal(incoming.id)).toMatchObject({ status: "matched", payment_id: receipt.id });
    const paid = await postedPayment("supplier_payment", supplier, "250000", today);
    const outgoing = payload("out", 250000, today);
    await webhook(outgoing);
    expect(await transactionByExternal(outgoing.id)).toMatchObject({ status: "matched", payment_id: paid.id });
    // Sai chiều, quỹ khác, lệch 4 ngày: không ghép.
    await postedPayment("customer_receipt", customer, "260000", today);
    const wrongDirection = payload("out", 260000, today);
    await webhook(wrongDirection);
    expect((await transactionByExternal(wrongDirection.id))!.status).toBe("unmatched");
    await postedPayment("customer_receipt", customer, "270000", today, otherFund);
    const otherFundTransaction = payload("in", 270000, today);
    await webhook(otherFundTransaction);
    expect((await transactionByExternal(otherFundTransaction.id))!.status).toBe("unmatched");
    await postedPayment("customer_receipt", customer, "280000", addDays(today, -4));
    const late = payload("in", 280000, today);
    await webhook(late);
    expect((await transactionByExternal(late.id))!.status).toBe("unmatched");
    const list = await call(accountant, "get", `/finance/bank-transactions?fundId=${bankFund}&status=matched`);
    expect(list.status).toBe(200);
    expect(list.body.data.find((item: { amount: string }) => item.amount === "700000")).toMatchObject({
      direction: "in",
      status: "matched",
      autoMatched: true,
      payment: { id: receipt.id, documentNo: receipt.documentNo, kind: "customer_receipt", partnerName: "Khách ngân hàng" },
    });
  });

  it("KICHBAN_KIEMTHU_249: nhiều phiếu cùng số tiền thì không tự ghép; một phiếu không ghép hai giao dịch", async () => {
    await postedPayment("customer_receipt", customer, "310000", today);
    await postedPayment("customer_receipt", customer, "310000", addDays(today, -1));
    const ambiguous = payload("in", 310000, today);
    await webhook(ambiguous);
    expect((await transactionByExternal(ambiguous.id))!.status).toBe("unmatched");
    // Hai giao dịch cùng số tiền trước, một phiếu sau: không tự ghép.
    const first = payload("in", 320000, today);
    const second = payload("in", 320000, today);
    await webhook(first);
    await webhook(second);
    await postedPayment("customer_receipt", customer, "320000", today);
    expect((await transactionByExternal(first.id))!.status).toBe("unmatched");
    expect((await transactionByExternal(second.id))!.status).toBe("unmatched");
  });

  it("KICHBAN_KIEMTHU_250: phiếu ghi sổ sau giao dịch thì tự ghép khi ghi sổ", async () => {
    const early = payload("in", 330000, today);
    await webhook(early);
    expect((await transactionByExternal(early.id))!.status).toBe("unmatched");
    const receipt = await postedPayment("customer_receipt", customer, "330000", addDays(today, -2));
    expect(await transactionByExternal(early.id)).toMatchObject({ status: "matched", payment_id: receipt.id });
  });
});

describe("CONG_VIEC_18 bộ giả lập, danh sách", () => {
  it("KICHBAN_KIEMTHU_251: bộ giả lập gửi giao dịch thử; lọc danh sách; quyền xem", async () => {
    expect((await call(chief, "post", `/finance/bank-connections/${otherFund}/simulate`, { direction: "in", amount: "1000" })).status).toBe(409);
    const created = await call(chief, "put", `/finance/bank-connections/${otherFund}`, { provider: "simulator", enabled: true, version: null });
    expect(created.status).toBe(200);
    // Phiếu 270.000 của quỹ ACB đã ghi sổ ở kịch bản trước: giao dịch thử tự ghép.
    const simulated = await call(chief, "post", `/finance/bank-connections/${otherFund}/simulate`, { direction: "in", amount: "270000", content: "DBH thu thu" });
    expect(simulated.status, JSON.stringify(simulated.body)).toBe(201);
    expect(simulated.body).toMatchObject({ fundId: otherFund, direction: "in", amount: "270000", content: "DBH thu thu", status: "matched", autoMatched: true });
    expect((await call(accountant, "post", `/finance/bank-connections/${otherFund}/simulate`, { direction: "in", amount: "1000" })).status).toBe(403);
    const filtered = await call(accountant, "get", `/finance/bank-transactions?fundId=${bankFund}&status=unmatched&direction=in&search=320000`);
    expect(filtered.body).toMatchObject({ total: 2, canManage: true, currency: "VND" });
    expect((await call(accountant, "get", `/finance/bank-transactions?from=${addDays(today, 1)}`)).body.total).toBe(0);
    expect((await call(seller, "get", "/finance/bank-transactions")).status).toBe(403);
  });
});

describe("CONG_VIEC_18 gợi ý khách, lập phiếu thu", () => {
  let customerCode: string;
  let otherCustomer: string;
  let otherCode: string;
  beforeAll(async () => {
    otherCustomer = await partner("Khách thứ hai", "0320001803", { isCustomer: true, paymentTermDays: 30 });
    customerCode = (await pool.query<{ code: string }>("SELECT code FROM crm.partners WHERE id = $1", [customer])).rows[0]!.code;
    otherCode = (await pool.query<{ code: string }>("SELECT code FROM crm.partners WHERE id = $1", [otherCustomer])).rows[0]!.code;
    const channel = ((await admin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string }[])[0]!.id;
    const creator = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'ketoan.ns@vcomm.test'")).rows[0]!.id;
    await pool.query(
      "INSERT INTO sales.orders (company_id, channel_id, order_date, currency, created_by, document_no, customer_id, status) VALUES ($1, $2, $3, 'VND', $4, 'DBH-VCR-2026-009001', $5, 'closed')",
      [retail, channel, today, creator, otherCustomer],
    );
  });
  const suggestion = async (externalId: number) =>
    (await pool.query("SELECT suggested_partner_id, suggestion_reason FROM finance.bank_transactions WHERE external_id = $1", [String(externalId)])).rows[0];

  it("KICHBAN_KIEMTHU_252: gợi ý theo số đơn bán, mã khách, mã số thuế; nhiều khách hoặc tiền ra thì không gợi ý", async () => {
    const byOrder = payload("in", 410000, today, { content: `CK THANH TOAN DBHVCR2026009001 ${customerCode}` });
    await webhook(byOrder);
    expect(await suggestion(byOrder.id)).toEqual({ suggested_partner_id: otherCustomer, suggestion_reason: "sales_order" });
    const byCode = payload("in", 420000, today, { content: `${customerCode.toLowerCase()} chuyen tien` });
    await webhook(byCode);
    expect(await suggestion(byCode.id)).toEqual({ suggested_partner_id: customer, suggestion_reason: "partner_code" });
    const byTax = payload("in", 430000, today, { content: "MST 0320001803 TT HD" });
    await webhook(byTax);
    expect(await suggestion(byTax.id)).toEqual({ suggested_partner_id: otherCustomer, suggestion_reason: "tax_code" });
    const both = payload("in", 440000, today, { content: `${customerCode} ${otherCode}` });
    await webhook(both);
    expect(await suggestion(both.id)).toEqual({ suggested_partner_id: null, suggestion_reason: null });
    const outgoing = payload("out", 450000, today, { content: customerCode });
    await webhook(outgoing);
    expect(await suggestion(outgoing.id)).toEqual({ suggested_partner_id: null, suggestion_reason: null });
    const listed = await call(accountant, "get", "/finance/bank-transactions?search=430000");
    expect(listed.body.data[0].suggestion).toEqual({ partnerId: otherCustomer, partnerName: "Khách thứ hai", reason: "tax_code" });
  });

  it("KICHBAN_KIEMTHU_253: kế toán xác nhận thì lập phiếu thu ngày giao dịch, ghi sổ và ghép; không lập cho tiền ra, giao dịch đã ghép", async () => {
    const incoming = payload("in", 460000, addDays(today, -1), { content: `${customerCode} tra no` });
    await webhook(incoming);
    const transaction = (await call(accountant, "get", "/finance/bank-transactions?search=460000")).body.data[0];
    expect(transaction.suggestion.partnerId).toBe(customer);
    expect((await call(seller, "post", `/finance/bank-transactions/${transaction.id}/confirm-receipt`, { partnerId: customer, version: transaction.version })).status).toBe(403);
    expect((await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/confirm-receipt`, { partnerId: customer, version: transaction.version + 1 })).status).toBe(409);
    const confirmed = await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/confirm-receipt`, { partnerId: customer, version: transaction.version });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(201);
    expect(confirmed.body).toMatchObject({ status: "matched", autoMatched: false, payment: { kind: "customer_receipt", partnerName: "Khách ngân hàng", paymentDate: addDays(today, -1) } });
    const receipt = (await call(accountant, "get", `/finance/payments/${confirmed.body.payment.id}`)).body;
    expect(receipt).toMatchObject({ status: "posted", amount: "460000", fund: { id: bankFund }, note: `${customerCode} tra no` });
    expect((await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/confirm-receipt`, { partnerId: customer, version: confirmed.body.version })).body.error.message).toBe(
      "Giao dịch không còn ở trạng thái chưa ghép.",
    );
    const outgoing = (await call(accountant, "get", "/finance/bank-transactions?search=450000")).body.data[0];
    expect((await call(accountant, "post", `/finance/bank-transactions/${outgoing.id}/confirm-receipt`, { partnerId: customer, version: outgoing.version })).body.error.message).toBe(
      "Chỉ lập phiếu thu cho tiền vào.",
    );
  });
});

describe("CONG_VIEC_18 ghép tay, bỏ qua, bỏ ghép, đối chiếu", () => {
  it("KICHBAN_KIEMTHU_254: ghép tay với phiếu đủ điều kiện; bỏ qua cần lý do; bỏ ghép đưa về chưa ghép", async () => {
    // Giao dịch 310.000 có hai phiếu cùng số tiền (KICHBAN_KIEMTHU_249).
    const transaction = (await call(accountant, "get", `/finance/bank-transactions?fundId=${bankFund}&search=310000`)).body.data[0];
    const candidates = await call(accountant, "get", `/finance/bank-transactions/${transaction.id}/candidates`);
    expect(candidates.body).toHaveLength(2);
    expect(candidates.body[0]).toMatchObject({ amount: "310000", paymentDate: today, kind: "customer_receipt" });
    const wrongAmount = (await pool.query<{ id: string }>("SELECT id FROM finance.payments WHERE amount = 260000 AND fund_id = $1", [bankFund])).rows[0]!.id;
    expect((await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/match`, { paymentId: wrongAmount, version: transaction.version })).status).toBe(409);
    const matched = await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/match`, { paymentId: candidates.body[1].id, version: transaction.version });
    expect(matched.body).toMatchObject({ status: "matched", autoMatched: false, payment: { id: candidates.body[1].id } });
    // Phiếu đã ghép không ghép giao dịch khác.
    const other = (await call(accountant, "get", `/finance/bank-transactions?fundId=${bankFund}&search=320000`)).body.data[0];
    expect((await call(accountant, "post", `/finance/bank-transactions/${other.id}/match`, { paymentId: candidates.body[1].id, version: other.version })).status).toBe(409);
    const reopened = await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/reopen`, { version: matched.body.version });
    expect(reopened.body).toMatchObject({ status: "unmatched", payment: null });
    expect((await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/reopen`, { version: reopened.body.version })).status).toBe(409);
    expect((await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/ignore`, { reason: " ", version: reopened.body.version })).status).toBe(400);
    const ignored = await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/ignore`, { reason: "Chuyển khoản nội bộ", version: reopened.body.version });
    expect(ignored.body).toMatchObject({ status: "ignored", ignoreReason: "Chuyển khoản nội bộ" });
    expect((await call(seller, "post", `/finance/bank-transactions/${transaction.id}/reopen`, { version: ignored.body.version })).status).toBe(403);
    const audit = await pool.query("SELECT action FROM core.audit_events WHERE entity_id = $1 ORDER BY occurred_at", [transaction.id]);
    expect(audit.rows.map((row) => row.action)).toEqual(["bank_transaction.match", "bank_transaction.reopen", "bank_transaction.ignore"]);
  });

  it("KICHBAN_KIEMTHU_255: đối chiếu số dư sổ với số dư ngân hàng, đếm giao dịch chưa ghép, liệt kê phiếu chưa có giao dịch", async () => {
    const book = (await call(accountant, "get", `/finance/funds/${bankFund}`)).body.balance as string;
    const result = await call(accountant, "get", `/finance/bank-reconciliation?fundId=${bankFund}&from=${addDays(today, -10)}&to=${today}`);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body).toMatchObject({ bookBalance: book, bankBalance: "50000000", difference: String(50000000 - Number(book)), ignoredCount: 1, currency: "VND" });
    expect(result.body.unmatchedIn.count).toBeGreaterThan(0);
    expect(result.body.unmatchedOut).toEqual({ count: 2, amount: "710000" });
    expect(result.body.unmatchedPayments.map((item: { amount: string }) => item.amount)).toEqual(expect.arrayContaining(["260000", "280000"]));
    expect(result.body.unmatchedPaymentCount).toBe(result.body.unmatchedPayments.length);
    expect((await call(accountant, "get", `/finance/bank-reconciliation?fundId=${bankFund}&from=${today}&to=${addDays(today, -1)}`)).status).toBe(400);
    expect((await call(seller, "get", `/finance/bank-reconciliation?fundId=${bankFund}&from=${today}&to=${today}`)).status).toBe(403);
  });
});

describe("CONG_VIEC_18 sửa lỗi rà soát", () => {
  const draftReceipt = async (partnerId: string, amount: string) => {
    const created = await call(accountant, "post", "/finance/payments", { kind: "customer_receipt", partnerId, fundId: bankFund, paymentDate: today, amount, lines: [] });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body as { id: string; version: number };
  };
  const byAmount = async (amount: string) => (await call(accountant, "get", `/finance/bank-transactions?fundId=${bankFund}&search=${amount}`)).body.data[0];

  it("KICHBAN_KIEMTHU_257: phiếu nháp còn lại từ lần xác nhận lỗi được gửi lại theo khách vừa chọn", async () => {
    const otherCustomer = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE tax_code = '0320001803'")).rows[0]!.id;
    await webhook(payload("in", 470000, today, { content: "khong ro" }));
    const transaction = await byAmount("470000");
    // Lần xác nhận trước gửi lỗi: phiếu nháp của khách thứ nhất còn gắn với giao dịch.
    const draft = await draftReceipt(customer, "470000");
    await pool.query("UPDATE finance.bank_transactions SET receipt_id = $1 WHERE id = $2", [draft.id, transaction.id]);
    const confirmed = await call(accountant, "post", `/finance/bank-transactions/${transaction.id}/confirm-receipt`, { partnerId: otherCustomer, version: transaction.version });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(201);
    expect(confirmed.body).toMatchObject({ status: "matched", payment: { id: draft.id, partnerName: "Khách thứ hai" } });
  });

  it("KICHBAN_KIEMTHU_258: phiếu nháp gắn giao dịch bị sửa số tiền thì không ghép khi ghi sổ, bỏ liên kết", async () => {
    await webhook(payload("in", 480000, today, { content: "khong ro" }));
    const transaction = await byAmount("480000");
    const draft = await draftReceipt(customer, "480000");
    await pool.query("UPDATE finance.bank_transactions SET receipt_id = $1 WHERE id = $2", [draft.id, transaction.id]);
    const edited = await call(accountant, "patch", `/finance/payments/${draft.id}`, {
      kind: "customer_receipt",
      partnerId: customer,
      fundId: bankFund,
      paymentDate: today,
      amount: "490000",
      lines: [],
      version: draft.version,
    });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    expect((await call(accountant, "post", `/finance/payments/${draft.id}/submit`, { version: edited.body.version })).body.status).toBe("posted");
    expect(await byAmount("480000")).toMatchObject({ status: "unmatched", payment: null, receipt: null });
  });

  it("KICHBAN_KIEMTHU_259: số tiền ngoài giới hạn bị từ chối 400; ký tự rỗng bị bỏ", async () => {
    expect((await webhook(payload("in", 0.00001, today))).status).toBe(400);
    expect((await webhook(payload("in", 1e16, today))).status).toBe(400);
    expect((await webhook(payload("in", 1000, today, { accumulated: 1e21 }))).status).toBe(400);
    const dirty = payload("in", 1100, today, { content: "a\u0000b" });
    expect((await webhook(dirty)).status).toBe(200);
    expect((await pool.query("SELECT content FROM finance.bank_transactions WHERE external_id = $1", [String(dirty.id)])).rows[0].content).toBe("ab");
    expect((await call(chief, "post", `/finance/bank-connections/${otherFund}/simulate`, { direction: "in", amount: "0" })).status).toBe(400);
  });
});
