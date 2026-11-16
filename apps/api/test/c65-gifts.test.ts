// CONG_VIEC_65 L3: đối tác tặng điểm qua Open API, trả trước, trả sau, hạch toán tặng
// (KICHBAN_KIEMTHU_710, 711, 712, phần tặng của 713; TIEUCHI_NGHIEMTHU_519 đến 521).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateApiKey } from "../src/open-api/api-key-secret";
import { journalLines, noLimit, operator, preparePartners, type Buyer, type PartnerFixture } from "./c65-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: PartnerFixture;
let thao: Buyer;
let binh: Buyer;
let prepaid: { contractId: string; partnerId: string };
let prepaidKey: string;

const http = () => request(application.getHttpServer());
const open = (key: string, method: "get" | "post", path: string, body?: object) => {
  const pending = http()[method](`/api/v1/open/loyalty-partner${path}`).set("authorization", `Bearer ${key}`).set("accept-language", "vi");
  return body ? pending.send(body) : pending;
};
const balance = async (userId: string) => (await pool.query<{ balance: number }>("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance ?? 0;
const giftLimits = { outbound: noLimit, inbound: noLimit, gift: { ...noLimit, maxPoints: 100000, customerMonthlyPoints: 150000 } };

// Khóa API phạm vi `loyalty.partner` (màn hình cấp khóa làm sau khi CONG_VIEC_67 vào main); ghi thẳng như service khóa của Nền tảng.
async function issueKey(partnerId: string, scopes: string[] = ["loyalty.partner"]): Promise<string> {
  const generated = generateApiKey();
  await pool.query(
    `INSERT INTO core.api_keys (company_id, kind, partner_id, name, key_prefix, key_hash, scopes, channel_id, created_by, updated_by)
     VALUES ($1, 'partner', $2, $3, $4, $5, $6::text[], NULL, (SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'), (SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'))`,
    [operator, partnerId, `Khóa ${generated.prefix}`, generated.prefix, generated.hash, scopes],
  );
  return generated.secret;
}

// Đối tác nộp tiền trả trước bằng phiếu thu: khoản giảm phải thu chưa cấn trừ (CONG_VIEC_13).
async function deposit(partnerId: string, amount: number): Promise<void> {
  await pool.query(
    `INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, amount, open_amount)
     VALUES ($1, $2, 'receivable', 'credit', 'payment', $3, $4, current_date, $5, $5)`,
    [operator, partnerId, randomUUID(), `PT-${amount}`, amount],
  );
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await preparePartners(application, pool);
  prepaid = await fixture.createContract("Ví An Bình", "0300000201", { paymentMode: "prepaid", creditLimit: null, limits: giftLimits });
  expect(
    (
      await fixture.call("post", `/loyalty/partners/${prepaid.contractId}/rates`, {
        direction: "gift",
        startsOn: fixture.today,
        endsOn: null,
        vcommPoints: null,
        partnerUnits: null,
        unitPrice: "1.05",
      })
    ).status,
  ).toBe(201);
  prepaidKey = await issueKey(prepaid.partnerId);
  thao = await fixture.register("0912200001", "Nguyễn Thị Thảo");
  binh = await fixture.register("0912200002", "Lê Văn Bình");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("KICHBAN_KIEMTHU_710: tặng điểm qua Open API", () => {
  it("phạm vi khóa: khóa tặng điểm không gọi được API khác; khóa khác phạm vi không gọi được API tặng", async () => {
    const products = await http().get("/api/v1/open/products").set("authorization", `Bearer ${prepaidKey}`);
    expect(products.status).toBe(403);
    expect((await open("not-a-key", "get", "/gifts")).status).toBe(401);
  });

  it("trả trước chưa nộp tiền thì chặn; nộp tiền rồi tặng: cộng lô, bút toán 131/3388, 511, 3331; gửi lại cùng mã trả giao dịch cũ", async () => {
    const blocked = await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0001", phone: "0912200001", points: 1000 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toBe("Số dư trả trước của đối tác không đủ.");
    await deposit(prepaid.partnerId, 200000);
    const created = await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0001", phone: "0912200001", points: 50000, message: "Quà mở ví" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    // 50.000 điểm × 1,05 = 52.500 chưa thuế; giá trị 50.000; chênh lệch 2.500, thuế 10 % = 250.
    expect(created.body).toMatchObject({ partnerTransactionCode: "AB-0001", status: "completed", points: 50000, amount: "52500", taxAmount: "250", customerMasked: "Ng**** Th* Thảo" });
    expect(created.body.documentNo).toMatch(/^TL-\d{4}-\d{6}$/);
    expect(created.body).not.toHaveProperty("phone");
    expect(await balance(thao.id)).toBe(50000);
    const giftId = (await pool.query<{ id: string }>("SELECT id FROM loyalty.partner_gifts WHERE partner_transaction_code = 'AB-0001'")).rows[0]!.id;
    expect(await journalLines(pool, "loyalty_partner_gift", giftId)).toEqual([
      ["loyalty_partner_receivable", 52750, 0],
      ["loyalty_liability", 0, 50000],
      ["loyalty_partner_revenue", 0, 2500],
      ["loyalty_partner_tax", 0, 250],
    ]);
    const lot = await pool.query<{ source_type: string }>("SELECT source_type FROM loyalty.lots WHERE user_id = $1", [thao.id]);
    expect(lot.rows.map((row) => row.source_type)).toEqual(["partner_gift"]);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE user_id = $1 AND kind = 'loyalty.partner_gift'", [thao.id])).rows[0].total).toBe(1);

    const again = await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0001", phone: "0912200002", points: 7 });
    expect(again.status).toBe(200);
    expect(again.body.documentNo).toBe(created.body.documentNo);
    expect(await balance(binh.id)).toBe(0);
  });

  it("hai yêu cầu cùng mã cùng lúc chỉ tạo một giao dịch; số chưa có tài khoản; vượt giới hạn", async () => {
    const [first, second] = await Promise.all([
      open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0002", phone: "0912200002", points: 1000 }),
      open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0002", phone: "0912200002", points: 1000 }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(await balance(binh.id)).toBe(1000);
    expect((await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0003", phone: "0999999999", points: 10 })).body.error.message).toBe("Số điện thoại chưa có tài khoản VComm.");
    expect((await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0004", phone: "0912200001", points: 100001 })).body.error.message).toBe(
      "Vượt giới hạn đổi điểm (giao dịch, ngày, tháng hoặc của đối tác).",
    );
    // Thảo đã nhận 50.000; thêm 100.000 vừa đủ trần tháng 150.000, thêm 1 thì vượt.
    expect((await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0005", phone: "0912200001", points: 100000 })).status).toBe(201);
    expect((await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0006", phone: "0912200001", points: 1 })).status).toBe(409);
    const list = await open(prepaidKey, "get", "/gifts?status=completed");
    expect(list.body.total).toBe(3);
    expect((await open(prepaidKey, "get", "/gifts/AB-0002")).body).toMatchObject({ points: 1000, status: "completed" });
    expect((await open(prepaidKey, "get", "/gifts/KHONG-CO")).status).toBe(404);
  });
});

describe("KICHBAN_KIEMTHU_712: trả trước, trả sau, cảnh báo", () => {
  it("trả trước: hết số dư thì chặn; dưới 20 % lần nộp gần nhất cảnh báo một lần mỗi ngày; số dư hiện trên hợp đồng", async () => {
    // Đã dùng 52.750 + 1.055 (1.050 và thuế 5) + 105.500 (105.000 và thuế 500): còn 200.000 − 159.305 = 40.695.
    const detail = await fixture.call("get", `/loyalty/partners/${prepaid.contractId}`);
    expect(detail.body.exposure, JSON.stringify(detail.body.exposure)).toMatchObject({ paymentMode: "prepaid", deposits: "200000", available: "40695", outstanding: null });
    expect((await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0010", phone: "0912200002", points: 40000 })).body.error.message).toBe("Số dư trả trước của đối tác không đủ.");
    expect((await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0011", phone: "0912200002", points: 600 })).status).toBe(201);
    expect((await open(prepaidKey, "post", "/gifts", { partnerTransactionCode: "AB-0012", phone: "0912200002", points: 600 })).status).toBe(201);
    // Còn 40.695 − 633 × 2 = 39.429, dưới 20 % lần nộp 200.000.
    const alerts = await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'loyalty.partner_exposure' AND payload->>'contractId' = $1", [prepaid.contractId]);
    expect(alerts.rows[0].total).toBeGreaterThan(0);
    const users = await pool.query(
      "SELECT count(DISTINCT user_id)::int AS users, count(*)::int AS total FROM core.notifications WHERE kind = 'loyalty.partner_exposure' AND payload->>'contractId' = $1",
      [prepaid.contractId],
    );
    // Một thông báo cho mỗi người có quyền trong ngày, không lặp ở lần tặng sau.
    expect(users.rows[0].total).toBe(users.rows[0].users);
  });

  it("trả sau: vượt hạn mức thì chặn; từ 80 % hạn mức cảnh báo; đổi ra làm giảm dư nợ", async () => {
    const postpaid = await fixture.createContract("Ngân hàng Bắc Hà", "0300000202", { creditLimit: "100000", limits: giftLimits });
    await fixture.call("post", `/loyalty/partners/${postpaid.contractId}/rates`, { direction: "gift", startsOn: fixture.today, endsOn: null, vcommPoints: null, partnerUnits: null, unitPrice: "1" });
    const key = await issueKey(postpaid.partnerId);
    // Giá bán bằng giá trị điểm: không thuế. 85.000 ≥ 80 % hạn mức.
    expect((await open(key, "post", "/gifts", { partnerTransactionCode: "BH-1", phone: "0912200002", points: 85000 })).status).toBe(201);
    expect((await open(key, "post", "/gifts", { partnerTransactionCode: "BH-2", phone: "0912200002", points: 16000 })).body.error.message).toBe("Đối tác vượt hạn mức hoặc quá hạn thanh toán.");
    const exposure = (await fixture.call("get", `/loyalty/partners/${postpaid.contractId}`)).body.exposure;
    expect(exposure).toMatchObject({ paymentMode: "postpaid", outstanding: "85000", available: "15000", creditLimit: "100000" });
    expect(
      (await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'loyalty.partner_exposure' AND payload->>'contractId' = $1", [postpaid.contractId])).rows[0].total,
    ).toBeGreaterThan(0);
    // Đổi ra 1.000 đơn vị × 8 đồng = 8.000 công ty phải trả: dư nợ còn 77.000.
    const hung = await fixture.register("0912200003", "Trần Văn Hùng");
    await fixture.link(hung, postpaid.contractId, "9704123456");
    await fixture.grantPoints(hung.id, 20000);
    expect((await hung.call("post", "/buyer/loyalty/partner-exchanges", { contractId: postpaid.contractId, direction: "outbound", partnerUnits: 1000 })).body.status).toBe("completed");
    expect((await fixture.call("get", `/loyalty/partners/${postpaid.contractId}`)).body.exposure.outstanding).toBe("77000");
  });

  it("đổi vào trên hợp đồng trả trước cũng bị chặn khi hết số dư; đổi cách thanh toán khi còn giao dịch chưa chốt bị từ chối", async () => {
    await fixture.link(thao, prepaid.contractId, "9704555666");
    const blocked = await thao.call("post", "/buyer/loyalty/partner-exchanges", { contractId: prepaid.contractId, direction: "inbound", partnerUnits: 5000 });
    expect(blocked.body.error.message).toBe("Số dư trả trước của đối tác không đủ.");
    const detail = (await fixture.call("get", `/loyalty/partners/${prepaid.contractId}`)).body;
    const body = {
      programName: detail.programName,
      unitNameVi: detail.unitNameVi,
      unitNameEn: detail.unitNameEn,
      contractNo: detail.contractNo,
      effectiveFrom: detail.effectiveFrom,
      effectiveTo: null,
      outboundEnabled: true,
      inboundEnabled: true,
      giftEnabled: true,
      paymentMode: "postpaid",
      creditLimit: "5000000",
      paymentTermDays: 15,
      taxPercent: "10",
      connector: "simulator",
      memberPattern: detail.memberPattern,
      limits: giftLimits,
      version: detail.version,
    };
    expect((await fixture.call("put", `/loyalty/partners/${prepaid.contractId}`, body)).body.error.message).toBe(
      "Chỉ đổi được cách thanh toán khi không còn giao dịch chưa chốt và không còn công nợ mở.",
    );
  });
});

describe("KICHBAN_KIEMTHU_711: hủy tặng điểm", () => {
  it("hủy trong 24 giờ khi khách chưa dùng: trừ lại lô, bút toán ghi ngược; hủy lần hai trả giao dịch đã hủy", async () => {
    const before = await balance(binh.id);
    const cancelled = await open(prepaidKey, "post", "/gifts/AB-0012/cancel", { reason: "Tặng nhầm khách" });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");
    expect(await balance(binh.id)).toBe(before - 600);
    const giftId = (await pool.query<{ id: string }>("SELECT id FROM loyalty.partner_gifts WHERE partner_transaction_code = 'AB-0012'")).rows[0]!.id;
    expect(await journalLines(pool, "loyalty_partner_gift_cancel", giftId)).toEqual([
      ["loyalty_partner_receivable", 0, 633],
      ["loyalty_liability", 600, 0],
      ["loyalty_partner_revenue", 30, 0],
      ["loyalty_partner_tax", 3, 0],
    ]);
    expect((await open(prepaidKey, "post", "/gifts/AB-0012/cancel", { reason: "Lần hai" })).body.status).toBe("cancelled");
    const admin = await fixture.call("get", `/loyalty/partner-gifts?contractId=${prepaid.contractId}&status=cancelled`);
    expect(admin.body.data).toHaveLength(1);
    expect(admin.body.data[0]).toMatchObject({ partnerTransactionCode: "AB-0012", cancelReason: "Tặng nhầm khách", contractCode: expect.stringMatching(/^LM/) });
  });

  it("khách đã dùng một phần hoặc quá 24 giờ thì không hủy được", async () => {
    // Thảo đổi ra 100 đơn vị = 1.000 điểm, lấy từ lô tặng AB-0001 (lô cũ nhất).
    await fixture.call("put", `/loyalty/partners/${prepaid.contractId}/simulator`, { mode: "normal" });
    const used = await thao.call("post", "/buyer/loyalty/partner-exchanges", { contractId: prepaid.contractId, direction: "outbound", partnerUnits: 100 });
    expect(used.body.status, JSON.stringify(used.body)).toBe("completed");
    expect((await open(prepaidKey, "post", "/gifts/AB-0001/cancel", { reason: "Thử" })).body.error.message).toBe("Giao dịch tặng không hủy được (quá 24 giờ, khách đã dùng điểm hoặc tháng đã chốt).");
    await pool.query("UPDATE loyalty.partner_gifts SET created_at = now() - interval '25 hours' WHERE partner_transaction_code = 'AB-0011'");
    expect((await open(prepaidKey, "post", "/gifts/AB-0011/cancel", { reason: "Thử" })).status).toBe(409);
  });
});
