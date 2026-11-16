// CONG_VIEC_65 L4: bảng đối soát tháng với đối tác liên minh, đối chiếu số liệu đối tác, xác nhận, công nợ
// (KICHBAN_KIEMTHU_714, 715; TIEUCHI_NGHIEMTHU_522, 523; API_305).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PartnerSettlementsService } from "../src/loyalty/partners/settlements.service";
import { journalLines, noLimit, operator, preparePartners, type Buyer, type PartnerFixture } from "./c65-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: PartnerFixture;
let service: PartnerSettlementsService;
let fundId: string;

const giftLimits = { outbound: { ...noLimit, minPoints: 100, maxPoints: 50000 }, inbound: noLimit, gift: noLimit };
const gift = (key: string, body: object) =>
  request(application.getHttpServer()).post("/api/v1/open/loyalty-partner/gifts").set("authorization", `Bearer ${key}`).set("accept-language", "vi").send(body);
const outbound = (buyer: Buyer, contractId: string, partnerUnits: number) => buyer.call("post", "/buyer/loyalty/partner-exchanges", { contractId, direction: "outbound", partnerUnits });
const mode = (contractId: string, value: string) => fixture.call("put", `/loyalty/partners/${contractId}/simulator`, { mode: value });
const detail = (id: string) => fixture.call("get", `/loyalty/partner-settlements/${id}`);
const confirm = (id: string, note: string, version: number, file?: { content: Buffer; name: string }) => {
  const sent = fixture.admin.call("post", `/loyalty/partner-settlements/${id}/confirm`, { companyId: operator }).field("note", note).field("version", String(version));
  return file ? sent.attach("file", file.content, file.name) : sent;
};

// Đưa giao dịch của hợp đồng về tháng trước (cả số liệu của bộ giả lập) để việc nền lập bảng tháng trước.
async function backdate(contractId: string): Promise<void> {
  await pool.query("UPDATE loyalty.partner_exchanges SET created_at = created_at - interval '1 month', completed_at = completed_at - interval '1 month' WHERE contract_id = $1", [contractId]);
  await pool.query("UPDATE loyalty.partner_gifts SET created_at = created_at - interval '1 month' WHERE contract_id = $1", [contractId]);
  await pool.query("UPDATE loyalty.partner_simulator_transactions SET created_at = created_at - interval '1 month', completed_at = completed_at - interval '1 month' WHERE contract_id = $1", [
    contractId,
  ]);
}

async function giftSetup(contractId: string): Promise<string> {
  const rate = await fixture.call("post", `/loyalty/partners/${contractId}/rates`, {
    direction: "gift",
    startsOn: fixture.today,
    endsOn: null,
    vcommPoints: null,
    partnerUnits: null,
    unitPrice: "1.05",
  });
  expect(rate.status, JSON.stringify(rate.body)).toBe(201);
  const key = await fixture.call("post", `/loyalty/partners/${contractId}/api-keys`, { name: `Khóa ${randomUUID().slice(0, 8)}` });
  expect(key.status).toBe(201);
  return key.body.secret as string;
}

async function post(kind: "customer_receipt" | "supplier_payment", partnerId: string, amount: string): Promise<void> {
  const payment = await fixture.call("post", "/finance/payments", { kind, partnerId, fundId, paymentDate: fixture.today, amount, note: "Thanh toán đối soát đối tác liên minh" });
  expect(payment.status, JSON.stringify(payment.body)).toBe(201);
  const posted = await fixture.call("post", `/finance/payments/${payment.body.id}/submit`, { version: payment.body.version });
  expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
}

let bank: { contractId: string; partnerId: string };
let airline: { contractId: string; partnerId: string };
let wallet: { contractId: string; partnerId: string };
let bankSettlement: string;
let bankKey: string;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await preparePartners(application, pool);
  service = application.get(PartnerSettlementsService);
  const fund = await fixture.call("post", "/finance/funds", { code: "TMLM", name: "Quỹ tiền mặt liên minh", kind: "cash", openingBalance: "1000000" });
  expect(fund.status, JSON.stringify(fund.body)).toBe(201);
  fundId = fund.body.id;

  // Ngân hàng (trả sau): đổi ra 500 đơn vị, đổi vào 1.000 đơn vị, tặng 20.000 điểm.
  bank = await fixture.createContract("Ngân hàng Đông Á", "0300000301", { creditLimit: "1000000000", limits: giftLimits });
  bankKey = await giftSetup(bank.contractId);
  const thao = await fixture.register("0912300001", "Nguyễn Thị Thảo");
  await fixture.link(thao, bank.contractId, "9704123456");
  await fixture.grantPoints(thao.id, 100000);
  expect((await outbound(thao, bank.contractId, 500)).body.status).toBe("completed");
  const inbound = await thao.call("post", "/buyer/loyalty/partner-exchanges", { contractId: bank.contractId, direction: "inbound", partnerUnits: 1000 });
  await fixture.setSimulatorOtp("731902");
  expect((await thao.call("post", `/buyer/loyalty/partner-exchanges/${inbound.body.id}/otp`, { otp: "731902" })).body.status).toBe("completed");
  expect((await gift(bankKey, { partnerTransactionCode: "DA-0001", phone: "0912300001", points: 20000, message: "Quà mở thẻ" })).status).toBe(201);
  await backdate(bank.contractId);

  // Hãng bay (trả sau): chỉ đổi ra, công ty phải trả đối tác.
  airline = await fixture.createContract("Hãng bay Tây Nguyên", "0300000302", { creditLimit: "1000000000", limits: giftLimits });
  const binh = await fixture.register("0912300002", "Lê Văn Bình");
  await fixture.link(binh, airline.contractId, "9704123456");
  await fixture.grantPoints(binh.id, 100000);
  for (const units of [300, 400, 500]) expect((await outbound(binh, airline.contractId, units)).body.status).toBe("completed");
  await backdate(airline.contractId);

  // Ví (trả trước): đã nộp 50.000, đối tác tặng 20.000 điểm.
  wallet = await fixture.createContract("Ví Hòa Bình", "0300000303", { paymentMode: "prepaid", creditLimit: null, limits: giftLimits });
  const walletKey = await giftSetup(wallet.contractId);
  await pool.query(
    `INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, amount, open_amount)
     VALUES ($1, $2, 'receivable', 'credit', 'payment', $3, 'PT-VHB', current_date, 50000, 50000)`,
    [operator, wallet.partnerId, randomUUID()],
  );
  expect((await gift(walletKey, { partnerTransactionCode: "HB-0001", phone: "0912300001", points: 20000 })).status).toBe(201);
  await backdate(wallet.contractId);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("KICHBAN_KIEMTHU_714: lập bảng tháng, đối chiếu số liệu đối tác", () => {
  it("việc nền lập bảng tháng trước cho mỗi đối tác có giao dịch: số liệu A, B, C, bù trừ, còn lại; khớp với bộ giả lập; chạy lại không lập trùng", async () => {
    const created = await service.generateMonthly(fixture.today);
    expect(created).toHaveLength(3);
    const listed = await fixture.call("get", `/loyalty/partner-settlements?contractId=${bank.contractId}`);
    expect(listed.body.data).toHaveLength(1);
    bankSettlement = listed.body.data[0].id;
    const shown = await detail(bankSettlement);
    expect(shown.status, JSON.stringify(shown.body)).toBe(200);
    // A: 20.000 × 1,05 = 21.000 + thuế 10 % của chênh lệch 1.000 = 21.100. B: 1.000 × 11 = 11.000 (giá trị 12.000 lớn hơn, không thuế). C: 500 × 8 = 4.000.
    expect(shown.body).toMatchObject({
      status: "matched",
      gift: { count: 1, points: 20000, units: null, amount: "21100" },
      inbound: { count: 1, points: 12000, units: 1000, amount: "11000" },
      outbound: { count: 1, points: 5000, units: 500, amount: "4000" },
      receivableAmount: "32100",
      payableAmount: "4000",
      offsetAmount: "4000",
      netAmount: "28100",
      mismatches: [],
      debt: null,
    });
    expect(shown.body.documentNo).toMatch(/^DM-/);
    expect(shown.body.lines.map((line: { kind: string }) => line.kind).sort()).toEqual(["gift", "inbound", "outbound"]);
    expect(shown.body.lines.find((line: { kind: string }) => line.kind === "gift")).toMatchObject({ reference: "DA-0001", customerMasked: "Ng**** Th* Thảo" });
    expect(await service.generateMonthly(fixture.today)).toEqual([]);
    // Bảng chưa xác nhận: giao dịch vẫn là phát sinh chưa chốt của hợp đồng.
    expect((await fixture.call("get", `/loyalty/partners/${bank.contractId}`)).body.exposure).toMatchObject({ unsettled: "28100", openReceivable: "0" });
  });

  it("bộ giả lập sai lệch: thiếu ở đối tác, khác số, thiếu ở VComm; không xác nhận được; không lấy được số liệu; lập lại khi đối tác sửa", async () => {
    const id = (await fixture.call("get", `/loyalty/partner-settlements?contractId=${airline.contractId}`)).body.data[0].id as string;
    await mode(airline.contractId, "statement_mismatch");
    let shown = await detail(id);
    const rebuilt = await fixture.call("post", `/loyalty/partner-settlements/${id}/rebuild`, { version: shown.body.version });
    expect(rebuilt.status, JSON.stringify(rebuilt.body)).toBe(200);
    expect(rebuilt.body.status).toBe("mismatched");
    expect(rebuilt.body.mismatches.map((item: { kind: string }) => item.kind).sort()).toEqual(["missing_partner", "missing_vcomm", "units"]);
    expect(rebuilt.body.mismatches.find((item: { kind: string }) => item.kind === "missing_vcomm")).toMatchObject({ lineKind: "outbound", vcomm: null, partner: "1" });
    expect((await fixture.call("get", "/loyalty/partner-settlements?status=mismatched")).body.data[0]).toMatchObject({ id, mismatchCount: 3 });
    const refused = await confirm(id, "BB-TN-01", rebuilt.body.version);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe("Bảng chưa khớp, chưa xác nhận được.");

    await mode(airline.contractId, "reject");
    shown = await fixture.call("post", `/loyalty/partner-settlements/${id}/rebuild`, { version: rebuilt.body.version });
    expect(shown.body).toMatchObject({ status: "unreconciled", reconcileError: "rejected:SIMULATED_REJECT", mismatches: [] });

    await mode(airline.contractId, "normal");
    shown = await fixture.call("post", `/loyalty/partner-settlements/${id}/rebuild`, { version: shown.body.version });
    expect(shown.body).toMatchObject({ status: "matched", payableAmount: "9600", receivableAmount: "0", offsetAmount: "0", netAmount: "-9600" });
    // Phiên bản cũ bị từ chối.
    expect((await fixture.call("post", `/loyalty/partner-settlements/${id}/rebuild`, { version: rebuilt.body.version })).status).toBe(409);
  });

  it("giao dịch của tháng thay đổi sau khi lập: xác nhận từ chối; số liệu trở lại như lúc lập thì xác nhận được", async () => {
    const before = await detail(bankSettlement);
    // Giao dịch tặng của tháng bị hủy sau khi lập bảng (ghi thẳng để không phụ thuộc hạn 24 giờ).
    const changedId = (await pool.query<{ id: string }>("SELECT id FROM loyalty.partner_gifts WHERE contract_id = $1", [bank.contractId])).rows[0]!.id;
    await pool.query("UPDATE loyalty.partner_gifts SET status = 'cancelled', cancel_reason = 'Thử', cancelled_at = now() WHERE id = $1", [changedId]);
    const refused = await confirm(bankSettlement, "BB-DA-10", before.body.version);
    expect(refused.body.error.message).toBe("Giao dịch của tháng đã thay đổi từ lúc lập bảng. Vui lòng lập lại rồi xác nhận.");
    await pool.query("UPDATE loyalty.partner_gifts SET status = 'completed', cancel_reason = NULL, cancelled_at = NULL WHERE id = $1", [changedId]);
    expect((await confirm(bankSettlement, "BB-DA-10", before.body.version)).status).toBe(200);
  });
});

describe("KICHBAN_KIEMTHU_715: xác nhận, bù trừ, công nợ, thanh toán", () => {
  it("bảng đã xác nhận: bút toán bù trừ 331/131, công nợ phải thu hạn 15 ngày, biên bản; giao dịch hết là chưa chốt; không lập lại; thu đủ thì Đã thanh toán", async () => {
    const shown = await detail(bankSettlement);
    expect(shown.body).toMatchObject({ status: "confirmed", confirmNote: "BB-DA-10", debt: { side: "receivable", amount: "28100", openAmount: "28100" } });
    expect(shown.body.dueDate > fixture.today).toBe(true);
    expect(await journalLines(pool, "loyalty_partner_settlement", bankSettlement)).toEqual([
      ["loyalty_partner_payable", 4000, 0],
      ["loyalty_partner_receivable", 0, 4000],
    ]);
    const settled = await pool.query("SELECT count(*)::int AS total FROM loyalty.partner_exchanges WHERE settlement_id = $1", [bankSettlement]);
    expect(settled.rows[0].total).toBe(2);
    expect((await fixture.call("get", `/loyalty/partners/${bank.contractId}`)).body.exposure).toMatchObject({ unsettled: "0", openReceivable: "28100", outstanding: "28100" });
    const again = await fixture.call("post", `/loyalty/partner-settlements/${bankSettlement}/rebuild`, { version: shown.body.version });
    expect(again.body.error.message).toBe("Bảng đối soát đã xác nhận, không lập lại được.");
    // Tháng đã chốt (KICHBAN_KIEMTHU_711): giao dịch tặng đã vào bảng xác nhận thì không hủy được, kể cả còn trong 24 giờ.
    const settledGift = await pool.query("SELECT settlement_id FROM loyalty.partner_gifts WHERE contract_id = $1", [bank.contractId]);
    expect(settledGift.rows[0].settlement_id).toBe(bankSettlement);
    await pool.query("UPDATE loyalty.partner_gifts SET created_at = now() - interval '1 hour' WHERE partner_transaction_code = 'DA-0001'");
    const cancel = await request(application.getHttpServer())
      .post("/api/v1/open/loyalty-partner/gifts/DA-0001/cancel")
      .set("authorization", `Bearer ${bankKey}`)
      .set("accept-language", "vi")
      .send({ reason: "Tặng nhầm" });
    expect(cancel.status).toBe(409);
    expect(cancel.body.error.message).toBe("Giao dịch tặng không hủy được (quá 24 giờ, khách đã dùng điểm hoặc tháng đã chốt).");
    // Bảng quá hạn thanh toán (KICHBAN_KIEMTHU_712): trả sau bị chặn tặng điểm, đổi vào cho đến khi thu đủ.
    await pool.query("UPDATE finance.debt_items SET due_date = current_date - 1 WHERE source_type = 'loyalty_partner_settlement' AND source_id = $1", [bankSettlement]);
    expect((await fixture.call("get", `/loyalty/partner-settlements/${bankSettlement}`)).body.overdue).toBe(true);
    const overdueGift = await gift(bankKey, { partnerTransactionCode: "DA-0002", phone: "0912300001", points: 1000 });
    expect(overdueGift.status).toBe(409);
    expect(overdueGift.body.error.message).toBe("Đối tác vượt hạn mức hoặc quá hạn thanh toán.");
    await post("customer_receipt", bank.partnerId, "28100");
    expect((await gift(bankKey, { partnerTransactionCode: "DA-0002", phone: "0912300001", points: 1000 })).status).toBe(201);
    expect((await detail(bankSettlement)).body).toMatchObject({ status: "paid", debt: { openAmount: "0" }, paidAt: expect.any(String) });
  });

  it("biên bản đính kèm: chỉ PDF hoặc ảnh, tối đa 10 MB; tải lại được", async () => {
    const id = (await fixture.call("get", `/loyalty/partner-settlements?contractId=${airline.contractId}`)).body.data[0].id as string;
    const shown = await detail(id);
    const wrong = await confirm(id, "BB-TN-10", shown.body.version, { content: Buffer.from("không phải PDF"), name: "bien-ban.pdf" });
    expect(wrong.status).toBe(400);
    const pdf = Buffer.from("%PDF-1.4\n% biên bản đối chiếu\n");
    const confirmed = await confirm(id, "BB-TN-10", shown.body.version, { content: pdf, name: "bien-ban-tn-10.pdf" });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    // Công ty phải trả 9.600, không bù trừ (không có phải thu): không có bút toán bù trừ.
    expect(confirmed.body).toMatchObject({ status: "confirmed", debt: { side: "payable", amount: "9600" }, confirmFile: { fileName: "bien-ban-tn-10.pdf" } });
    expect(await journalLines(pool, "loyalty_partner_settlement", id)).toEqual([]);
    const file = await fixture.call("get", `/loyalty/partner-settlements/${id}/file`);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("application/pdf");
    await post("supplier_payment", airline.partnerId, "9600");
    expect((await detail(id)).body.status).toBe("paid");
  });

  it("trả trước: công nợ phải thu khớp ngay với tiền đối tác đã nộp, bảng Đã thanh toán; số dư trả trước giảm đúng", async () => {
    const id = (await fixture.call("get", `/loyalty/partner-settlements?contractId=${wallet.contractId}`)).body.data[0].id as string;
    const shown = await detail(id);
    expect(shown.body).toMatchObject({ status: "matched", receivableAmount: "21100", netAmount: "21100", paymentMode: "prepaid" });
    const confirmed = await confirm(id, "BB-HB-10", shown.body.version);
    expect(confirmed.body).toMatchObject({ status: "paid", debt: { side: "receivable", amount: "21100", openAmount: "0" } });
    expect((await fixture.call("get", `/loyalty/partners/${wallet.contractId}`)).body.exposure).toMatchObject({ deposits: "28900", unsettled: "0", available: "28900" });
  });
});
