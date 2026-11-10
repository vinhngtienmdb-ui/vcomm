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
const call = (session: Session, method: "get" | "post" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
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
