// CONG_VIEC_65 L2: đổi ra, đổi vào, chờ đối tác, xử lý tay, hạch toán đổi
// (KICHBAN_KIEMTHU_707, 708, 709, phần đổi của 713; TIEUCHI_NGHIEMTHU_516 đến 518, 521).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Secret, TOTP } from "otpauth";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PartnerExchangesService } from "../src/loyalty/partners/exchanges.service";
import { createTestUser, signIn } from "./helpers";
import { journalLines, noLimit, operator, preparePartners, type Buyer, type PartnerFixture } from "./c65-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: PartnerFixture;
let thao: Buyer;

const balance = async (userId: string) => (await pool.query<{ balance: number }>("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]!.balance;
const simulatorBalance = async (contractId: string, memberNumber: string) =>
  (await pool.query<{ balance_units: number }>("SELECT balance_units FROM loyalty.partner_simulator_members WHERE contract_id = $1 AND member_number = $2", [contractId, memberNumber])).rows[0]!
    .balance_units;
const outbound = (buyer: Buyer, contractId: string, partnerUnits: number, smartOtp?: string) =>
  buyer.call("post", "/buyer/loyalty/partner-exchanges", { contractId, direction: "outbound", partnerUnits, ...(smartOtp ? { smartOtp } : {}) });
const mode = (contractId: string, value: string) => fixture.call("put", `/loyalty/partners/${contractId}/simulator`, { mode: value });
const runJob = () => application.get(PartnerExchangesService).processDue();
const dueNow = (id: string) => pool.query("UPDATE loyalty.partner_exchanges SET next_check_at = now() - interval '1 second' WHERE id = $1", [id]);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await preparePartners(application, pool);
  thao = await fixture.register("0912100001", "Nguyễn Thị Thảo");
  await fixture.link(thao, fixture.contractId, "9704123456");
  await fixture.grantPoints(thao.id, 100000);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("KICHBAN_KIEMTHU_707: đổi ra", () => {
  it("báo giá, đổi ra thành công: trừ điểm lô hạn sớm, đối tác cộng điểm, bút toán 3388/331 chênh lệch 641", async () => {
    const quote = await thao.call("post", "/buyer/loyalty/partner-exchanges/quote", { contractId: fixture.contractId, direction: "outbound", partnerUnits: 500 });
    expect(quote.status, JSON.stringify(quote.body)).toBe(200);
    expect(quote.body).toMatchObject({ vcommPoints: 5000, unitStep: 1, availablePoints: 100000, remainingToday: 60000, remainingThisMonth: 100000, smartOtpRequired: false });
    const created = await outbound(thao, fixture.contractId, 500);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "completed", vcommPoints: 5000, partnerUnits: 500 });
    expect(created.body.documentNo).toMatch(/^DL-\d{4}-\d{6}$/);
    expect(await balance(thao.id)).toBe(95000);
    expect(await simulatorBalance(fixture.contractId, "9704123456")).toBe(12900);
    // 500 đơn vị × 8 đồng = 4.000 công ty trả; giá trị lúc tích 5.000 điểm × 1 = 5.000; chênh lệch giảm chi phí 1.000.
    expect(await journalLines(pool, "loyalty_partner_exchange", created.body.id)).toEqual([
      ["loyalty_liability", 5000, 0],
      ["loyalty_expense", 0, 1000],
      ["loyalty_partner_payable", 0, 4000],
    ]);
    const detail = await fixture.call("get", `/loyalty/partner-exchanges/${created.body.id}`);
    expect(detail.body).toMatchObject({ status: "completed", amount: "4000", pointValueAmount: "5000", customerMasked: "Ng**** Th* Thảo", memberNumberMasked: "*******456" });
    expect(detail.body.partnerReference).toMatch(/^SIM-/);
  });

  it("giới hạn ba tầng: dưới tối thiểu, trên tối đa, vượt ngày; giới hạn còn lại trên báo giá", async () => {
    expect((await outbound(thao, fixture.contractId, 5)).body.error.message).toBe("Vượt giới hạn đổi điểm (giao dịch, ngày, tháng hoặc của đối tác).");
    expect((await outbound(thao, fixture.contractId, 5001)).status).toBe(409);
    expect((await outbound(thao, fixture.contractId, 5000)).body.status).toBe("completed");
    // Đã dùng 5.000 + 50.000 = 55.000 trong ngày; thêm 6.000 vượt 60.000.
    expect((await outbound(thao, fixture.contractId, 600)).status).toBe(409);
    const quote = await thao.call("post", "/buyer/loyalty/partner-exchanges/quote", { contractId: fixture.contractId, direction: "outbound", partnerUnits: 500 });
    expect(quote.body).toMatchObject({ remainingToday: 5000, remainingThisMonth: 45000 });
    expect((await outbound(thao, fixture.contractId, 500)).body.status).toBe("completed");
    expect(await balance(thao.id)).toBe(40000);
  });

  it("bội số theo tỷ lệ; số dư không đủ; chưa liên kết", async () => {
    const stepped = await fixture.createContract("Hãng bay Sao Việt", "0300000102", {}, { outbound: [100, 5, "90"], inbound: [12, 1, "11"] });
    const binh = await fixture.register("0912100002", "Lê Văn Bình");
    expect((await outbound(binh, stepped.contractId, 10)).body.error.message).toBe("Chưa liên kết thành viên đối tác.");
    await fixture.link(binh, stepped.contractId, "9704998877");
    const notMultiple = await outbound(binh, stepped.contractId, 7);
    expect(notMultiple.status).toBe(400);
    expect(notMultiple.body.error.fields.partnerUnits).toBe("Số điểm phải là bội số theo tỷ lệ quy đổi.");
    // 10 dặm = 200 điểm, khách chưa có điểm.
    expect((await outbound(binh, stepped.contractId, 10)).status).toBe(409);
    expect((await pool.query("SELECT count(*)::int AS total FROM loyalty.partner_exchanges WHERE user_id = $1", [binh.id])).rows[0].total).toBe(0);
  });

  it("khách đã kích hoạt Smart OTP phải nhập mã đúng", async () => {
    const dung = await fixture.register("0912100003", "Phạm Văn Dũng");
    await fixture.link(dung, fixture.contractId, "9704555666");
    await fixture.grantPoints(dung.id, 10000);
    expect((await dung.call("post", "/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
    await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = '+84912100003' AND purpose = 'smart_otp' AND consumed_at IS NULL", [createHash("sha256").update("135790").digest("hex")]);
    const activated = await dung.call("post", "/buyer/loyalty/smart-otp/activate", { code: "135790", deviceName: "iPhone của Dũng" });
    expect(activated.status, JSON.stringify(activated.body)).toBe(201);
    const code = new TOTP({ secret: Secret.fromBase32(activated.body.secret), digits: 6, period: 30 }).generate();
    expect((await dung.call("post", "/buyer/loyalty/partner-exchanges/quote", { contractId: fixture.contractId, direction: "outbound", partnerUnits: 100 })).body.smartOtpRequired).toBe(true);
    const missing = await outbound(dung, fixture.contractId, 100);
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields.smartOtp).toBeTruthy();
    expect((await outbound(dung, fixture.contractId, 100, code === "000000" ? "111111" : "000000")).status).toBe(409);
    expect((await outbound(dung, fixture.contractId, 100, code)).body.status).toBe("completed");
    expect(await balance(dung.id)).toBe(9000);
  });

  it("đối tác từ chối: thất bại, hoàn điểm đúng lô, không có bút toán", async () => {
    // Thảo đã hết giới hạn ngày; dùng khách khác.
    const hoa = await fixture.register("0912100007", "Bùi Thị Hoa");
    await fixture.link(hoa, fixture.contractId, "9704998877");
    await fixture.grantPoints(hoa.id, 3000);
    await mode(fixture.contractId, "reject");
    const before = await balance(hoa.id);
    const rejected = await outbound(hoa, fixture.contractId, 100);
    await mode(fixture.contractId, "normal");
    expect(rejected.body.status, JSON.stringify(rejected.body)).toBe("failed");
    expect(await balance(hoa.id)).toBe(before);
    const entries = await pool.query<{ kind: string; points: number }>("SELECT kind, points FROM loyalty.entries WHERE source_type = 'partner_exchange' AND source_id = $1 ORDER BY created_at", [
      rejected.body.id,
    ]);
    expect(entries.rows).toEqual([
      { kind: "redeem", points: -1000 },
      { kind: "redeem_refund", points: 1000 },
    ]);
    expect(await journalLines(pool, "loyalty_partner_exchange", rejected.body.id)).toEqual([]);
    // Sổ cái khớp lô.
    const lots = await pool.query<{ total: number }>("SELECT coalesce(sum(remaining), 0)::int AS total FROM loyalty.lots WHERE user_id = $1", [hoa.id]);
    expect(lots.rows[0]!.total).toBe(before);
  });
});

describe("KICHBAN_KIEMTHU_708: chờ đối tác, hỏi lại, cần xử lý", () => {
  let other: Buyer;
  beforeAll(async () => {
    const second = await fixture.createContract("Ví An Bình", "0300000103", { limits: { outbound: noLimit, inbound: noLimit, gift: noLimit } });
    fixture.contractId = second.contractId;
    other = await fixture.register("0912100004", "Trần Minh Khoa");
    await fixture.link(other, second.contractId, "9704123456");
    await fixture.grantPoints(other.id, 50000);
  });

  it("không trả lời: chờ đối tác, việc nền hỏi lại; đối tác đã cộng thì hoàn tất, không cộng hai lần", async () => {
    await mode(fixture.contractId, "timeout");
    const pending = await outbound(other, fixture.contractId, 300);
    expect(pending.body.status).toBe("pending_partner");
    expect(await balance(other.id)).toBe(47000);
    expect((await other.call("delete", `/buyer/loyalty/partners/${fixture.contractId}/link`)).body.error.message).toBe("Còn giao dịch đang chờ với đối tác, chưa hủy liên kết được.");
    await dueNow(pending.body.id);
    await runJob();
    expect((await fixture.call("get", `/loyalty/partner-exchanges/${pending.body.id}`)).body).toMatchObject({ status: "pending_partner", attempts: 2 });
    await mode(fixture.contractId, "normal");
    await dueNow(pending.body.id);
    await runJob();
    expect((await other.call("get", `/buyer/loyalty/partner-exchanges/${pending.body.id}`)).body.status).toBe("completed");
    expect(await simulatorBalance(fixture.contractId, "9704123456")).toBe(12400 + 300);
    expect((await journalLines(pool, "loyalty_partner_exchange", pending.body.id)).length).toBe(3);
  });

  it("đối tác không có giao dịch: gửi lại cùng mã tham chiếu", async () => {
    await mode(fixture.contractId, "timeout");
    const pending = await outbound(other, fixture.contractId, 100);
    await mode(fixture.contractId, "normal");
    const reference = (await pool.query<{ reference: string }>("SELECT reference FROM loyalty.partner_exchanges WHERE id = $1", [pending.body.id])).rows[0]!.reference;
    await pool.query("DELETE FROM loyalty.partner_simulator_transactions WHERE reference = $1", [reference]);
    await pool.query("UPDATE loyalty.partner_simulator_members SET balance_units = balance_units - 100 WHERE contract_id = $1 AND member_number = '9704123456'", [fixture.contractId]);
    await dueNow(pending.body.id);
    await runJob();
    expect((await other.call("get", `/buyer/loyalty/partner-exchanges/${pending.body.id}`)).body.status).toBe("completed");
    expect((await pool.query("SELECT count(*)::int AS total FROM loyalty.partner_simulator_transactions WHERE reference = $1", [reference])).rows[0].total).toBe(1);
  });

  it("quá 24 giờ: cần xử lý, thông báo; chốt hoàn tất, hoàn điểm; người không có quyền bị từ chối", async () => {
    await mode(fixture.contractId, "timeout");
    const first = await outbound(other, fixture.contractId, 200);
    const second = await outbound(other, fixture.contractId, 150);
    await pool.query("UPDATE loyalty.partner_exchanges SET created_at = now() - interval '25 hours' WHERE id = ANY($1::uuid[])", [[first.body.id, second.body.id]]);
    await runJob();
    expect((await fixture.call("get", `/loyalty/partner-exchanges/${first.body.id}`)).body.status).toBe("needs_review");
    const notified = await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'loyalty.partner_exchange_review'");
    expect(notified.rows[0].total).toBeGreaterThan(0);
    const list = await fixture.call("get", "/loyalty/partner-exchanges?status=needs_review");
    expect(list.body.data.map((item: { id: string }) => item.id).sort()).toEqual([first.body.id, second.body.id].sort());

    await createTestUser(pool, "khong.quyen.c65x@vcomm.test", "Không Quyền", [{ companyId: operator }]);
    const outsider = await signIn(application, "khong.quyen.c65x@vcomm.test");
    expect((await outsider.call("post", `/loyalty/partner-exchanges/${first.body.id}/resolve`, { companyId: operator, body: { action: "refund", reason: "Thử" } })).status).toBe(403);

    const before = await balance(other.id);
    const completed = await fixture.call("post", `/loyalty/partner-exchanges/${first.body.id}/resolve`, { action: "complete", partnerReference: "AB-778899" });
    expect(completed.body).toMatchObject({ status: "completed", partnerReference: "AB-778899", resolutionNote: "Chốt tay hoàn tất" });
    const refunded = await fixture.call("post", `/loyalty/partner-exchanges/${second.body.id}/resolve`, { action: "refund", reason: "Đối tác xác nhận không cộng điểm" });
    expect(refunded.body).toMatchObject({ status: "refunded", resolutionNote: "Đối tác xác nhận không cộng điểm" });
    expect(await balance(other.id)).toBe(before + 1500);
    expect((await fixture.call("post", `/loyalty/partner-exchanges/${second.body.id}/resolve`, { action: "refund", reason: "Lần hai" })).status).toBe(409);
    await mode(fixture.contractId, "normal");
  });
});

describe("KICHBAN_KIEMTHU_709: đổi vào bằng OTP đối tác", () => {
  let contractId: string;
  let linh: Buyer;
  beforeAll(async () => {
    // Đối tác trả 15 đồng mỗi đơn vị, 1 đơn vị = 12 điểm (giá trị 12 đồng): chênh lệch dương 3 đồng mỗi đơn vị.
    contractId = (await fixture.createContract("Ngân hàng Sông Hồng", "0300000104", {}, { outbound: [10, 1, "8"], inbound: [12, 1, "15"] })).contractId;
    linh = await fixture.register("0912100005", "Võ Thị Linh");
    await fixture.link(linh, contractId, "9704123456");
  });

  it("OTP sai giữ chờ, OTP đúng cộng lô điểm có hạn; bút toán 131/3388, chênh lệch 511 và thuế 3331; không tính chi tiêu", async () => {
    const requested = await linh.call("post", "/buyer/loyalty/partner-exchanges", { contractId, direction: "inbound", partnerUnits: 1000 });
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    expect(requested.body).toMatchObject({ status: "otp_pending", vcommPoints: 12000 });
    await fixture.setSimulatorOtp("731902");
    const wrong = await linh.call("post", `/buyer/loyalty/partner-exchanges/${requested.body.id}/otp`, { otp: "000000" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.otp).toBe("Mã OTP không đúng hoặc đã hết hạn.");
    const confirmed = await linh.call("post", `/buyer/loyalty/partner-exchanges/${requested.body.id}/otp`, { otp: "731902" });
    expect(confirmed.body.status).toBe("completed");
    expect(await balance(linh.id)).toBe(12000);
    expect(await simulatorBalance(contractId, "9704123456")).toBe(11400);
    const lot = await pool.query<{ source_type: string; point_value: string; expires_on: string; earned_on: string }>(
      "SELECT source_type, point_value::text, expires_on::text, earned_on::text FROM loyalty.lots WHERE user_id = $1",
      [linh.id],
    );
    expect(lot.rows[0]).toMatchObject({ source_type: "partner_exchange", point_value: "1.0000" });
    expect(lot.rows[0]!.expires_on > lot.rows[0]!.earned_on).toBe(true);
    // 1.000 × 15 = 15.000 chưa thuế; giá trị 12.000; chênh lệch 3.000, thuế 10 % = 300.
    expect(await journalLines(pool, "loyalty_partner_exchange", requested.body.id)).toEqual([
      ["loyalty_partner_receivable", 15300, 0],
      ["loyalty_liability", 0, 12000],
      ["loyalty_partner_revenue", 0, 3000],
      ["loyalty_partner_tax", 0, 300],
    ]);
    const account = await pool.query<{ spend_current_year: string }>("SELECT spend_current_year::text FROM loyalty.accounts WHERE user_id = $1", [linh.id]);
    expect(Number(account.rows[0]!.spend_current_year)).toBe(0);
    expect((await pool.query("SELECT count(*)::int AS total FROM loyalty.document_points WHERE user_id = $1", [linh.id])).rows[0].total).toBe(0);
  });

  it("chênh lệch âm vào chi phí, không thuế (hợp đồng mặc định 11 đồng mỗi đơn vị)", async () => {
    const minh = await fixture.register("0912100006", "Đỗ Văn Minh");
    const main = (await pool.query<{ id: string }>("SELECT id FROM loyalty.partner_contracts WHERE contract_no = 'HDLM-0300000101'")).rows[0]!.id;
    await fixture.call("post", `/loyalty/partners/${main}/simulator/members`, { memberNumber: "9704000111", fullName: "Đỗ Văn Minh", phone: "0912100006", balanceUnits: 5000 });
    await fixture.link(minh, main, "9704000111");
    const requested = await minh.call("post", "/buyer/loyalty/partner-exchanges", { contractId: main, direction: "inbound", partnerUnits: 100 });
    await fixture.setSimulatorOtp("246802");
    expect((await minh.call("post", `/buyer/loyalty/partner-exchanges/${requested.body.id}/otp`, { otp: "246802" })).body.status).toBe("completed");
    expect(await journalLines(pool, "loyalty_partner_exchange", requested.body.id)).toEqual([
      ["loyalty_partner_receivable", 1100, 0],
      ["loyalty_liability", 0, 1200],
      ["loyalty_expense", 100, 0],
    ]);
  });

  it("OTP hết hạn 5 phút; đối tác không đủ điểm từ chối", async () => {
    const requested = await linh.call("post", "/buyer/loyalty/partner-exchanges", { contractId, direction: "inbound", partnerUnits: 10 });
    await pool.query("UPDATE loyalty.partner_exchanges SET otp_expires_at = now() - interval '1 second' WHERE id = $1", [requested.body.id]);
    expect((await linh.call("post", `/buyer/loyalty/partner-exchanges/${requested.body.id}/otp`, { otp: "123456" })).body.error.message).toBe("Mã OTP không đúng hoặc đã hết hạn.");
    expect((await linh.call("get", `/buyer/loyalty/partner-exchanges/${requested.body.id}`)).body.status).toBe("expired");
    const tooMany = await linh.call("post", "/buyer/loyalty/partner-exchanges", { contractId, direction: "inbound", partnerUnits: 999999 });
    expect(tooMany.body.error.message).toBe("Đối tác từ chối giao dịch.");
    const history = await linh.call("get", "/buyer/loyalty/partner-exchanges");
    expect(history.body.data.map((item: { status: string }) => item.status)).toEqual(["failed", "expired", "completed"]);
    // Người mua khác không xem được giao dịch.
    expect((await thao.call("get", `/buyer/loyalty/partner-exchanges/${requested.body.id}`)).status).toBe(404);
  });
});
