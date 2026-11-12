// CONG_VIEC_22: hiệu năng Kinh doanh trên ứng dụng VComm (KICHBAN_KIEMTHU_583, TIEUCHI_NGHIEMTHU_411, Mong muốn):
// 1.000 khách, 20.000 đơn của một nhân viên; danh sách khách, chi tiết khách, doanh số nhánh mỗi yêu cầu dưới 1 giây.
// Dữ liệu sinh hàng loạt bằng SQL từ một đơn thật (chép đơn bán và đơn VComm), không qua API đặt hàng.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareMarketplace, retail, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
const people = { head: "", staff: "" };
let customerId = "";
const sessions: Record<"head" | "staff", BuyerCall> = {} as never;
const customerCount = 1000;
const orderCount = 20000;
const limitMilliseconds = 1000;

async function department(code: string, name: string, parent: string | null, type: "division" | "team"): Promise<string> {
  const id = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name, parent_id) VALUES ($1, $2, $3, $4) RETURNING id", [retail, code, name, parent])).rows[0]!.id;
  expect((await store.call("put", `/marketplace/sales-units/${id}`, { type })).status).toBe(200);
  return id;
}
async function member(phone: string, fullName: string, departmentId: string): Promise<string> {
  const userId = await store.register(phone, fullName);
  const detail = await store.call("get", `/marketplace/buyers/${userId}`);
  expect((await store.call("post", `/marketplace/buyers/${userId}/sales-flag`, { departmentId, version: detail.body.version })).status).toBe(200);
  return userId;
}
// Thời gian lâu nhất của 3 lần gọi sau một lần làm nóng.
async function slowest(call: () => Promise<{ status: number }>): Promise<number> {
  expect((await call()).status).toBe(200);
  let worst = 0;
  for (let index = 0; index < 3; index += 1) {
    const started = performance.now();
    expect((await call()).status).toBe(200);
    worst = Math.max(worst, performance.now() - started);
  }
  return Math.round(worst);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  const division = await department("KHOI-HN", "Khối Kinh doanh", null, "division");
  const team = await department("PKD-HN", "Phòng Kinh doanh", division, "team");
  people.head = await member("0937000001", "Trưởng Phòng Hiệu Năng", team);
  people.staff = await member("0937000002", "Nhân Viên Hiệu Năng", team);
  expect((await store.call("put", `/marketplace/sales-units/${team}/manager`, { userId: people.head })).status).toBe(200);
  customerId = await store.register("0937100001", "Khách Thật", "0937000002");
  sessions.head = await store.buyerSession("0937000001");
  sessions.staff = await store.buyerSession("0937000002");
  // Một đơn thật làm mẫu để chép.
  const buyer = await store.buyerSession("0937100001");
  const addressId = await store.addressOf(buyer);
  const lines = [{ variantId: store.variants.cream, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  // 999 khách sinh thêm của Nhân viên; 20.000 đơn chia đều cho 1.000 khách, 90% hoàn tất trong tháng này, 10% đang giao.
  await pool.query(
    `WITH created AS (
       INSERT INTO core.users (full_name, phone, status)
       SELECT 'Khách Sinh ' || g, '+8493' || lpad(g::text, 7, '0'), 'active' FROM generate_series(1, $1::int - 1) g RETURNING id)
     INSERT INTO marketplace.buyer_accounts (user_id, referrer_user_id) SELECT id, $2 FROM created`,
    [customerCount, people.staff],
  );
  await pool.query(
    `WITH base AS (SELECT m.*, so.document_no FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = $1),
       buyers AS (SELECT array_agg(user_id ORDER BY user_id) AS ids FROM marketplace.buyer_accounts WHERE referrer_user_id = $2),
       copies AS (
         INSERT INTO sales.orders
         SELECT (jsonb_populate_record(NULL::sales.orders, to_jsonb(so) || jsonb_build_object('id', gen_random_uuid(), 'document_no', so.document_no || '-' || g))).*
         FROM sales.orders so CROSS JOIN generate_series(1, $3::int) g WHERE so.id = (SELECT sales_order_id FROM base) RETURNING id),
       numbered AS (SELECT id, row_number() OVER () AS n FROM copies)
     INSERT INTO marketplace.orders
     SELECT (jsonb_populate_record(NULL::marketplace.orders, to_jsonb(b) - 'document_no' || jsonb_build_object(
       'id', gen_random_uuid(), 'sales_order_id', x.id, 'buyer_user_id', (SELECT ids FROM buyers)[(x.n % $4::int) + 1], 'sales_staff_user_id', $2::uuid,
       'status', CASE WHEN x.n % 10 = 0 THEN 'shipping' ELSE 'completed' END,
       'completed_at', CASE WHEN x.n % 10 = 0 THEN NULL ELSE now() - make_interval(mins => (x.n % 600)::int) END,
       'completed_amount', CASE WHEN x.n % 10 = 0 THEN NULL ELSE b.goods_amount END))).*
     FROM numbered x CROSS JOIN base b`,
    [placed.body.id, people.staff, orderCount, customerCount],
  );
  await pool.query("ANALYZE marketplace.orders; ANALYZE marketplace.buyer_accounts; ANALYZE sales.orders");
}, 300_000);

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_22 hiệu năng", () => {
  it("KICHBAN_KIEMTHU_583: 1.000 khách, 20.000 đơn: danh sách khách, chi tiết khách, doanh số nhánh mỗi yêu cầu dưới 1 giây", async () => {
    const counts = (await pool.query("SELECT count(*)::int AS orders FROM marketplace.orders WHERE sales_staff_user_id = $1", [people.staff])).rows[0];
    expect(counts.orders).toBeGreaterThanOrEqual(orderCount);
    const list = await slowest(() => sessions.staff("get", "/buyer/sales/customers"));
    const detail = await slowest(() => sessions.head("get", `/buyer/sales/customers/${customerId}`));
    const revenue = await slowest(() => sessions.head("get", "/buyer/sales/revenue"));
    const result = (await sessions.head("get", "/buyer/sales/revenue")).body;
    expect(result.members[0].completedOrderCount).toBeGreaterThan(17000);
    expect((await sessions.staff("get", "/buyer/sales/customers")).body).toHaveLength(customerCount);
    // Ghi thời gian đo để chép vào tài liệu 25.
    console.log(`KICHBAN_KIEMTHU_583: danh sách khách ${list} ms, chi tiết khách ${detail} ms, doanh số nhánh ${revenue} ms`);
    expect(list).toBeLessThan(limitMilliseconds);
    expect(detail).toBeLessThan(limitMilliseconds);
    expect(revenue).toBeLessThan(limitMilliseconds);
  }, 120_000);
});
