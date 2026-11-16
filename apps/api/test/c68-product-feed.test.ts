// CONG_VIEC_68 lát L2: tệp danh mục sản phẩm cho Facebook Commerce Manager (KICHBAN_KIEMTHU_725 đến 727).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { csvCell, feedColumns } from "../src/marketplace/product-feed.service";
import { signIn } from "./helpers";
import { prepareMarketplace, retail, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let gel: { productId: string; variants: string[] };
const http = () => request(application.getHttpServer());

// Đọc CSV theo RFC 4180 (ô có ngoặc kép, dấu phẩy, xuống dòng).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\r" && text[index + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 1;
    } else cell += character;
  }
  return rows;
}
const records = (text: string) => {
  const [header, ...rows] = parseCsv(text);
  return rows.map((row) => Object.fromEntries(header!.map((column, index) => [column, row[index]])));
};
const feedPath = (url: string) => url.replace("https://vcomm.vn", "");

beforeAll(async () => {
  process.env.SHARE_PUBLIC_URL = "https://vcomm.vn";
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  const userId = (await pool.query("SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'")).rows[0].id as string;
  // Sản phẩm hai phân loại khác giá, tên có dấu phẩy và ngoặc kép, chưa có tồn.
  const categoryId = (await pool.query("SELECT category_id FROM catalog.products WHERE id = $1", [store.products.cream])).rows[0].category_id as string;
  const unitId = (await pool.query("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0].id as string;
  const created = await store.call("post", "/catalog/products", {
    categoryId,
    name: 'Sữa tắm "Thảo Mộc", hương sả',
    brand: "Thảo Mộc",
    vatRate: "10",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: unitId,
    weightKg: "0.5",
    options: [{ name: "Dung tích", values: ["250 ml", "500 ml"] }],
    variants: [{ optionValues: ["250 ml"] }, { optionValues: ["500 ml"] }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  gel = { productId: created.body.id, variants: created.body.variants.map((variant: { id: string }) => variant.id) };
  const priceListId = (await pool.query("SELECT id FROM catalog.price_lists WHERE code = 'VCOMM' AND company_id = $1", [retail])).rows[0].id as string;
  const draft = await store.call("post", "/catalog/price-changes", {
    priceListId,
    effectiveFrom: store.today,
    lines: [
      { variantId: gel.variants[0], unitId, price: "129000" },
      { variantId: gel.variants[1], unitId, price: "189000" },
    ],
  });
  expect(draft.status, JSON.stringify(draft.body)).toBe(201);
  expect((await store.call("post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  expect((await store.call("put", `/marketplace/listings/${gel.productId}`, { isPublished: true, description: "Dịu nhẹ,\nhương sả chanh." })).status).toBe(204);
  for (const [productId, key, order] of [
    [gel.productId, "gel-1", 0],
    [gel.productId, "gel-2", 1],
    [store.products.cream, "kem-1", 0],
  ] as const)
    await pool.query("INSERT INTO catalog.product_images (product_id, file_name, content_type, size_bytes, storage_key, sort_order, uploaded_by) VALUES ($1, 'a.jpg', 'image/jpeg', 10, $2, $3, $4)", [
      productId,
      `c68/${key}.jpg`,
      order,
      userId,
    ]);
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_68 tệp danh mục Facebook", () => {
  it("KICHBAN_KIEMTHU_725: ô CSV theo chuẩn RFC 4180", () => {
    expect(csvCell("Kem")).toBe("Kem");
    expect(csvCell('Sữa "A", B')).toBe('"Sữa ""A"", B"');
    expect(csvCell("dòng 1\ndòng 2")).toBe('"dòng 1\ndòng 2"');
    expect(csvCell(" đầu")).toBe('" đầu"');
  });

  it("KICHBAN_KIEMTHU_726: tắt mặc định; bật lần đầu tạo mã; tạo lại mã thì mã cũ 404; tắt 404; sai version 409; nhật ký không có mã", async () => {
    const initial = (await store.call("get", "/marketplace/product-feed")).body;
    expect(initial).toMatchObject({ enabled: false, url: null, tokenCreatedAt: null, lastFetchedAt: null, productCount: 2, skippedWithoutImage: 1, canManage: true });
    // Sai version.
    expect((await store.call("put", "/marketplace/product-feed", { enabled: true, version: initial.version + 5 })).status).toBe(409);
    expect((await store.call("put", "/marketplace/product-feed", { enabled: "co", version: initial.version })).status).toBe(400);
    const enabled = await store.call("put", "/marketplace/product-feed", { enabled: true, version: initial.version });
    expect(enabled.status, JSON.stringify(enabled.body)).toBe(200);
    expect(enabled.body).toMatchObject({ enabled: true, version: initial.version + 1 });
    expect(enabled.body.url).toMatch(/^https:\/\/vcomm\.vn\/api\/v1\/public\/product-feeds\/facebook\/[A-Za-z0-9_-]{43}\.csv$/);
    const firstUrl = feedPath(enabled.body.url as string);
    const firstToken = /facebook\/(.+)\.csv$/.exec(firstUrl)![1]!;
    expect((await http().get(firstUrl)).status).toBe(200);
    // Tắt rồi bật lại giữ mã cũ.
    const disabled = await store.call("put", "/marketplace/product-feed", { enabled: false, version: enabled.body.version });
    expect(disabled.body).toMatchObject({ enabled: false, url: null });
    expect((await http().get(firstUrl)).status).toBe(404);
    const again = await store.call("put", "/marketplace/product-feed", { enabled: true, version: disabled.body.version });
    expect(feedPath(again.body.url)).toBe(firstUrl);
    // Tạo lại mã.
    expect((await store.call("post", "/marketplace/product-feed/regenerate", { version: again.body.version - 1 })).status).toBe(409);
    const regenerated = await store.call("post", "/marketplace/product-feed/regenerate", { version: again.body.version });
    expect(regenerated.status).toBe(200);
    const secondUrl = feedPath(regenerated.body.url as string);
    expect(secondUrl).not.toBe(firstUrl);
    expect((await http().get(firstUrl)).status).toBe(404);
    expect((await http().get(secondUrl)).status).toBe(200);
    // Mã sai dạng, sai đuôi.
    expect((await http().get("/api/v1/public/product-feeds/facebook/abc.csv")).status).toBe(404);
    expect((await http().get(secondUrl.replace(".csv", ".xml"))).status).toBe(404);
    // Nhật ký thao tác có ba loại hành động, không chứa mã.
    const audits = await pool.query("SELECT action, before_data::text AS before, after_data::text AS after FROM core.audit_events WHERE action LIKE 'marketplace.product_feed.%' ORDER BY occurred_at");
    expect(audits.rows.map((row) => row.action)).toEqual([
      "marketplace.product_feed.enable",
      "marketplace.product_feed.disable",
      "marketplace.product_feed.enable",
      "marketplace.product_feed.regenerate",
    ]);
    const secondToken = /facebook\/(.+)\.csv$/.exec(secondUrl)![1]!;
    for (const row of audits.rows) {
      expect(`${row.before}${row.after}`).not.toContain(firstToken);
      expect(`${row.before}${row.after}`).not.toContain(secondToken);
    }
    // Thời điểm lấy gần nhất.
    expect((await store.call("get", "/marketplace/product-feed")).body.lastFetchedAt).not.toBeNull();
  });

  it("KICHBAN_KIEMTHU_725: đúng cột Facebook, mỗi phân loại một dòng, giá, tình trạng còn hàng; không có sản phẩm chưa ảnh, ngừng bán; giữ tạm 5 phút", async () => {
    const status = (await store.call("get", "/marketplace/product-feed")).body;
    const path = feedPath(status.url as string);
    const response = await http().get(path);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text.split("\r\n")[0]).toBe(feedColumns.join(","));
    const items = records(response.text);
    expect(items.map((item) => item.item_group_id).sort()).toEqual([gel.productId, gel.productId, store.products.cream].sort());
    const cream = items.find((item) => item.item_group_id === store.products.cream)!;
    expect(cream).toMatchObject({
      availability: "in stock",
      condition: "new",
      price: "250000 VND",
      link: `https://vcomm.vn/s/${store.products.cream}`,
      brand: "VComm Bán lẻ Miền Nam",
      additional_image_link: "",
      additional_variant_attribute: "",
    });
    expect(cream.image_link).toMatch(/^https:\/\/vcomm\.vn\/api\/v1\/buyer\/shop\/images\/[0-9a-f-]{36}$/);
    const small = items.find((item) => item.title?.endsWith("250 ml"))!;
    expect(small).toMatchObject({
      title: 'Sữa tắm "Thảo Mộc", hương sả - 250 ml',
      description: "Dịu nhẹ,\nhương sả chanh.",
      availability: "out of stock",
      price: "129000 VND",
      brand: "Thảo Mộc",
      additional_variant_attribute: "Dung tích:250 ml",
    });
    expect(small.additional_image_link).toMatch(/^https:\/\/vcomm\.vn\/api\/v1\/buyer\/shop\/images\/[0-9a-f-]{36}$/);
    expect(items.find((item) => item.title?.endsWith("500 ml"))).toMatchObject({ price: "189000 VND", additional_variant_attribute: "Dung tích:500 ml" });
    const smallSku = (await pool.query("SELECT sku FROM catalog.variants WHERE id = $1", [gel.variants[0]])).rows[0].sku;
    expect(small.id).toBe(smallSku);
    // Xà phòng chưa có ảnh: không có trong tệp.
    expect(response.text).not.toContain("Xà phòng");

    // Đổi giá, ngừng bán: trong 5 phút giữ tạm vẫn là bản cũ; sau 5 phút có bản mới.
    await pool.query("UPDATE marketplace.listings SET is_published = false WHERE product_id = $1", [gel.productId]);
    await pool.query("UPDATE inventory.costs SET quantity = 0 WHERE variant_id = $1", [store.variants.cream]);
    expect(records((await http().get(path)).text)).toHaveLength(3);
    testClock.fixed = new Date(Date.now() + 6 * 60_000);
    const fresh = records((await http().get(path)).text);
    expect(fresh.map((item) => item.item_group_id)).toEqual([store.products.cream]);
    expect(fresh[0]!.availability).toBe("out of stock");
    testClock.fixed = null;
    await pool.query("UPDATE inventory.costs SET quantity = 20 WHERE variant_id = $1", [store.variants.cream]);
    await pool.query("UPDATE marketplace.listings SET is_published = true WHERE product_id = $1", [gel.productId]);
  });

  it("KICHBAN_KIEMTHU_727: người chỉ xem không thấy đường dẫn, không bật tắt được; người không có quyền, người mua bị chặn", async () => {
    const permissions = await pool.query("SELECT 1 FROM core.permissions WHERE code = 'marketplace.order.view'");
    expect(permissions.rows).toHaveLength(1);
    // Vai trò thử chỉ có quyền xem đơn VComm, giao cho nhân viên sau khi kiểm tra bị chặn.
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("get", "/marketplace/product-feed", { companyId: retail })).status).toBe(403);
    const roleId = (
      await pool.query(
        "INSERT INTO core.roles (company_id, code, name_vi, name_en, status) VALUES ($1, 'test_c68_viewer', 'Chỉ xem sàn (kiểm thử)', 'Marketplace viewer (test)', 'active') RETURNING id",
        [retail],
      )
    ).rows[0].id;
    await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'marketplace.order.view')", [roleId]);
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $2, 'company', $3, '2026-01-01' FROM core.users WHERE email = $1", [
      "phuc.le@vcomm.test",
      roleId,
      retail,
    ]);
    const viewer = await signIn(application, "phuc.le@vcomm.test");
    const seen = await viewer.call("get", "/marketplace/product-feed", { companyId: retail });
    expect(seen.status, JSON.stringify(seen.body)).toBe(200);
    expect(seen.body).toMatchObject({ enabled: true, url: null, canManage: false });
    expect((await viewer.call("put", "/marketplace/product-feed", { companyId: retail, body: { enabled: false, version: seen.body.version } })).status).toBe(403);
    expect((await viewer.call("post", "/marketplace/product-feed/regenerate", { companyId: retail, body: { version: seen.body.version } })).status).toBe(403);
    await store.register("0947680001", "Người Mua C68");
    const buyer = await store.buyerSession("0947680001");
    expect((await buyer("get", "/marketplace/product-feed")).status).toBe(403);
  });
});
