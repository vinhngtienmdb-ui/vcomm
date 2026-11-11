// CONG_VIEC_50: báo cáo bán hàng (KICHBAN_KIEMTHU_478, 479, 480, 484, 485).
// Xà phòng 10.000 gồm thuế 10% ở bảng giá chung: đơn 3 cái có tiền chưa thuế 27.273, chia theo lũy kế 9.091 mỗi cái.
// Kem 110.000 gồm thuế ở bảng giá chung (chưa thuế 100.000); 250.000 gồm thuế trên VComm (chưa thuế 227.273). Giá vốn kem 100.000, xà phòng 20.000 mỗi cái.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { readSheet } from "read-excel-file/node";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { allowManualGoodsOrders, signIn, type Session } from "./helpers";
import { prepareMarketplace, retail, startGhnMock, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let ghn: GhnMock;
let store: MarketplaceFixture;
let groupAdmin: Session;
let channels: Record<string, string>;
let customer: string;
let today: string;
let monthStart: string;
let nextMonth: string;
const webhookKey = "khoa-webhook-kiem-thu-bao-cao-0123456789";
const issues: string[] = [];
let returnId: string;

type Row = { key: string; label: string; currency: string; inTotal: boolean; quantity: string; revenue: string; cost: string; grossProfit: string; internalRevenue: string };
const report = (query: string, session: Session = groupAdmin) => session.call("get", `/analytics/sales?${query}`, { companyId: retail });
const period = () => `from=${monthStart}&to=${today}`;
const byKey = (rows: Row[]) => Object.fromEntries(rows.map((row) => [row.key, row]));

async function order(channelId: string, lines: { variantId: string; quantity: string; discountPercent?: string }[]) {
  const created = await store.call("post", "/sales/orders", {
    channelId,
    warehouseId: store.warehouseId,
    orderDate: today,
    customerId: customer,
    lines: lines.map((line) => ({ unitId: unitId, discountPercent: "0", ...line })),
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await store.call("post", `/sales/orders/${created.body.id}/submit`);
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("confirmed");
  return submitted.body as { id: string; lines: { id: string }[] };
}
async function deliver(orderBody: { id: string; lines: { id: string }[] }, quantities: string[]) {
  const issue = await store.call("post", "/inventory/sales-issues", {
    orderId: orderBody.id,
    documentDate: today,
    lines: quantities.map((quantity, index) => ({ orderLineId: orderBody.lines[index]!.id, quantity })),
  });
  expect(issue.status, JSON.stringify(issue.body)).toBe(201);
  const posted = await store.call("post", `/inventory/documents/${issue.body.id}/submit`);
  expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
  issues.push(posted.body.id);
  return posted.body as { id: string; lines: { id: string }[] };
}
let unitId: string;

async function marketplaceOrder(phone: string, name: string, testBuyer: boolean) {
  const userId = await store.register(phone, name);
  if (testBuyer) await pool.query("UPDATE marketplace.buyer_accounts SET is_test_buyer = true WHERE user_id = $1", [userId]);
  const buyer = await store.buyerSession(phone);
  const addressId = await store.addressOf(buyer);
  const lines = [{ variantId: store.variants.cream, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const shipped = await store.call("post", `/marketplace/orders/${placed.body.id}/ship`, { carrierCode: "ghn", version: placed.body.version });
  expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
  ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
  await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
  expect((await buyer("get", `/buyer/orders/${placed.body.id}`)).body.status).toBe("delivered");
}

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  today = store.today;
  monthStart = `${today.slice(0, 8)}01`;
  const next = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1));
  nextMonth = next.toISOString().slice(0, 10);
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  await allowManualGoodsOrders(pool, retail);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const created = (await store.call("post", "/catalog/sales-channels/defaults")).body as { id: string; code: string }[];
  channels = Object.fromEntries(created.map((channel) => [channel.code, channel.id]));
  const general = (await store.call("post", "/catalog/price-lists", { code: "CHUNG", name: "Chung", includesVat: true })).body.id;
  const change = await store.call("post", "/catalog/price-changes", {
    priceListId: general,
    effectiveFrom: today,
    lines: [
      { variantId: store.variants.cream, unitId, price: "110000" },
      { variantId: store.variants.soap, unitId, price: "10000" },
    ],
  });
  expect((await store.call("post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
  const partner = await store.call("post", "/crm/partners", { kind: "organization", name: "Khách báo cáo", taxCode: "0320005001" });
  customer = partner.body.id;
  await store.call("put", `/crm/partners/${customer}/profile`, { isCustomer: true, isSupplier: false, paymentTermDays: 0, creditLimit: null, version: 0 });

  // Bán lẻ: 3 xà phòng giao 1 rồi 2, trả 1 (sau dời sang tháng sau).
  const retailOrder = await order(channels.BAN_LE!, [{ variantId: store.variants.soap, quantity: "3" }]);
  await deliver(retailOrder, ["1"]);
  const second = await deliver(retailOrder, ["2"]);
  const returned = await store.call("post", "/inventory/sales-returns", { issueId: second.id, documentDate: today, reason: "Lỗi", lines: [{ issueLineId: second.lines[0]!.id, quantity: "1" }] });
  expect(returned.status, JSON.stringify(returned.body)).toBe(201);
  expect((await store.call("post", `/inventory/documents/${returned.body.id}/submit`)).body.status).toBe("posted");
  returnId = returned.body.id;
  // Bán sỉ cho công ty trong tập đoàn: 1 kem và 1 xà phòng tặng (chiết khấu 100%).
  const wholesale = await order(channels.BAN_SI!, [
    { variantId: store.variants.cream, quantity: "1" },
    { variantId: store.variants.soap, quantity: "1", discountPercent: "100" },
  ]);
  await deliver(wholesale, ["1", "1"]);
  // Khách là đối tác nội bộ (công ty Thương mại): đổi trực tiếp trên dữ liệu thử vì đơn hàng hóa nội bộ đi theo luồng giao dịch nội bộ.
  const internal = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [testIds.tradingCompany])).rows[0]!.id;
  await pool.query("UPDATE sales.orders SET customer_id = $1 WHERE id = $2", [internal, wholesale.id]);
  // Đơn VComm thật và đơn của người mua thử.
  await marketplaceOrder("0938500001", "Người Mua Báo Cáo", false);
  await marketplaceOrder("0938500002", "Người Mua Thử", true);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_50 báo cáo bán hàng", () => {
  it("KICHBAN_KIEMTHU_478: doanh số theo hàng đã giao trừ hàng trả, khớp tiền bút toán doanh thu và giá vốn của các phiếu; trả hàng tính vào kỳ nhận trả", async () => {
    const response = await report(`${period()}&groupBy=company`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const vcr = byKey(response.body.rows)[retail]!;
    // Xà phòng 9.091 + 18.182 − 9.091; kem bán sỉ 100.000, tặng 0; kem VComm 227.273 (đơn người mua thử không tính).
    expect(vcr).toMatchObject({ quantity: "5", revenue: "345455", cost: "260000", grossProfit: "85455", internalRevenue: "100000", inTotal: true, currency: "VND" });
    // Cùng số với hàm chia tiền của bút toán doanh thu (finance.inventory_amounts) và giá trị xuất kho đã ghi sổ, trừ phiếu của người mua thử.
    const ledger = (
      await pool.query<{ revenue: string; cost: string }>(
        `SELECT sum(CASE d.type WHEN 'sales_issue' THEN a.net ELSE -a.net END)::text AS revenue,
           sum(CASE d.type WHEN 'sales_issue' THEN 1 ELSE -1 END * (SELECT sum(cost_value) FROM inventory.document_lines WHERE document_id = d.id))::text AS cost
         FROM inventory.documents d CROSS JOIN finance.inventory_amounts(d.id) a
         WHERE d.company_id = $1 AND d.status = 'posted' AND d.type IN ('sales_issue', 'sales_return')
           AND d.id NOT IN (SELECT dl.document_id FROM inventory.document_lines dl JOIN sales.order_lines sl ON sl.id = dl.source_line_id
             JOIN marketplace.orders mo ON mo.sales_order_id = sl.order_id JOIN marketplace.buyer_accounts b ON b.user_id = mo.buyer_user_id WHERE b.is_test_buyer)`,
        [retail],
      )
    ).rows[0]!;
    expect(Number(vcr.revenue)).toBe(Number(ledger.revenue));
    expect(Number(vcr.cost)).toBe(Number(ledger.cost));
    expect(response.body.totals).toMatchObject({ revenue: "345455", internalRevenue: "100000", revenueExcludingInternal: "245455" });

    // Phiếu nhận trả dời sang tháng sau: kỳ này không trừ, tháng sau âm.
    await pool.query("UPDATE inventory.documents SET document_date = $1 WHERE id = $2", [nextMonth, returnId]);
    expect(byKey((await report(`${period()}&groupBy=company`)).body.rows)[retail]).toMatchObject({ quantity: "6", revenue: "354546", cost: "280000" });
    const later = await report(`from=${nextMonth}&to=${nextMonth}&groupBy=company`);
    expect(byKey(later.body.rows)[retail]).toMatchObject({ quantity: "-1", revenue: "-9091", cost: "-20000", grossProfit: "10909" });
    await pool.query("UPDATE inventory.documents SET document_date = $1 WHERE id = $2", [today, returnId]);
  });

  it("KICHBAN_KIEMTHU_479: nhóm theo kênh, sản phẩm, ngày, tháng; lọc kênh, chỉ đơn VComm", async () => {
    const channel = byKey((await report(`${period()}&groupBy=channel`)).body.rows);
    expect(channel[channels.BAN_LE!]).toMatchObject({ revenue: "18182", label: "VCR · Bán lẻ" });
    expect(channel[channels.BAN_SI!]).toMatchObject({ revenue: "100000", internalRevenue: "100000" });
    expect(channel[store.channelId]).toMatchObject({ revenue: "227273", quantity: "1" });
    const product = await report(`${period()}&groupBy=product`);
    expect(product.body.rows.map((row: Row) => [row.key, row.quantity, row.revenue])).toEqual([
      [store.variants.cream, "2", "327273"],
      [store.variants.soap, "3", "18182"],
    ]);
    expect(product.body.rows[0].label).toContain("Kem dưỡng da VComm");
    const day = await report(`${period()}&groupBy=day`);
    expect(day.body.rows).toEqual([expect.objectContaining({ key: today, label: today.split("-").reverse().join("/"), revenue: "345455" })]);
    const month = await report(`${period()}&groupBy=month`);
    expect(month.body.rows).toEqual([expect.objectContaining({ key: today.slice(0, 7), revenue: "345455" })]);
    const marketplace = await report(`${period()}&groupBy=company&marketplaceOnly=true`);
    expect(marketplace.body.totals).toMatchObject({ revenue: "227273", quantity: "1" });
    const filtered = await report(`${period()}&groupBy=product&channelId=${channels.BAN_LE}`);
    expect(filtered.body.rows.map((row: Row) => row.key)).toEqual([store.variants.soap]);
    expect(filtered.body.channels.map((item: { id: string }) => item.id)).toContain(store.channelId);
  });

  it("KICHBAN_KIEMTHU_480: bán nội bộ tách cột, tổng loại trừ nội bộ; công ty khác đồng tiền không cộng vào tổng; công ty không có bán vẫn đúng", async () => {
    const all = await report(`${period()}&groupBy=company`);
    expect(all.body.totals).toMatchObject({ revenue: "345455", internalRevenue: "100000", revenueExcludingInternal: "245455" });
    await pool.query("UPDATE core.companies SET base_currency = 'USD' WHERE id = $1", [retail]);
    try {
      const other = await report(`${period()}&groupBy=company`);
      expect(byKey(other.body.rows)[retail]).toMatchObject({ currency: "USD", inTotal: false });
      expect(other.body.totals).toMatchObject({ revenue: "0", internalRevenue: "0", revenueExcludingInternal: "0" });
      expect(other.body.companies.find((company: { id: string }) => company.id === retail)).toMatchObject({ inTotal: false });
    } finally {
      await pool.query("UPDATE core.companies SET base_currency = 'VND' WHERE id = $1", [retail]);
    }
    const trading = await report(`${period()}&groupBy=company&companyIds=${testIds.tradingCompany}`);
    expect(trading.status).toBe(200);
    expect(trading.body).toMatchObject({ rows: [], totals: { revenue: "0", quantity: "0" } });
  });

  it("KICHBAN_KIEMTHU_484: khoảng ngày bắt buộc, không đảo, tối đa 366 ngày; báo cáo không ghi dữ liệu nghiệp vụ; công ty ngoài phạm vi bị từ chối", async () => {
    expect((await report("groupBy=company")).body.error.fields).toMatchObject({ from: expect.any(String), to: expect.any(String) });
    expect((await report(`from=${today}&to=${monthStart}`)).body.error.fields).toEqual({ to: "Từ ngày không được sau đến ngày." });
    expect((await report("from=2025-01-01&to=2026-01-02")).body.error.fields).toEqual({ to: "Khoảng ngày tối đa 366 ngày. Hãy thu hẹp khoảng ngày." });
    expect((await report("from=2025-01-01&to=2026-01-01")).status).toBe(200);
    expect((await report("from=2026-02-30&to=2026-03-01")).body.error.fields).toEqual({ from: "Giá trị không hợp lệ." });
    const counts = async () =>
      (await pool.query("SELECT (SELECT count(*) FROM inventory.documents) + (SELECT count(*) FROM sales.orders) + (SELECT count(*) FROM finance.debt_items) AS total")).rows[0].total;
    const before = await counts();
    await report(`${period()}&groupBy=product`);
    expect(await counts()).toBe(before);
    const companyAdmin = await signIn(application, "quantri.vcr@vcomm.test");
    expect((await report(`${period()}&companyIds=${testIds.tradingCompany}`, companyAdmin)).status).toBe(403);
    expect((await report(`${period()}`, companyAdmin)).body.companies.map((company: { id: string }) => company.id)).toEqual([retail]);
  });

  it("KICHBAN_KIEMTHU_485: xuất Excel đúng số trên màn hình, ghi nhật ký xuất", async () => {
    const json = (await report(`${period()}&groupBy=channel`)).body;
    const file = await groupAdmin
      .call("get", `/analytics/sales?${period()}&groupBy=channel&format=xlsx`, { companyId: retail })
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(file.status).toBe(200);
    expect(file.headers["content-disposition"]).toContain(`bao-cao-ban-hang-${monthStart}-${today}.xlsx`);
    const sheet = (await readSheet(file.body as Buffer)) as (string | number | null)[][];
    const header = sheet.findIndex((row) => row[0] === "Kênh");
    const body = sheet.slice(header + 1, header + 1 + json.rows.length);
    expect(body.map((row) => [row[0], row[3]])).toEqual(json.rows.map((row: Row) => [row.label, Number(row.revenue)]));
    expect(sheet.find((row) => row[0] === "Tổng loại trừ nội bộ")?.[3]).toBe(Number(json.totals.revenueExcludingInternal));
    const audit = await pool.query("SELECT action, after_data FROM core.audit_events WHERE action = 'analytics.sales.export' ORDER BY occurred_at DESC LIMIT 1");
    expect(audit.rows[0]).toMatchObject({ action: "analytics.sales.export", after_data: expect.objectContaining({ rows: json.rows.length }) });
  });
});
