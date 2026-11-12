// CONG_VIEC_68 lát L1: trang chia sẻ sản phẩm, tệp liên kết ứng dụng (KICHBAN_KIEMTHU_719 đến 724).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderSharePage, shareLinks } from "../src/marketplace/share-page";
import { prepareMarketplace, retail, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let imageId: string;
const environment = { SHARE_PUBLIC_URL: "https://vcomm.vn/", VCOMM_WEB_URL: "https://app.vcomm.vn", APP_STORE_URL: "", GOOGLE_PLAY_URL: "", APPLE_TEAM_ID: "", ANDROID_SHA256_CERT_FINGERPRINTS: "" };
const http = () => request(application.getHttpServer());
const page = (path: string, language = "vi") => http().get(path).set("accept-language", language);
const metaOf = (html: string, property: string) => new RegExp(`<meta property="${property}" content="([^"]*)">`).exec(html)?.[1] ?? null;
const hrefs = (html: string) => [...html.matchAll(/<a class="nut [^"]+" href="([^"]+)">([^<]+)<\/a>/g)].map((match) => [match[2], match[1].replace(/&#38;/g, "&")]);

beforeAll(async () => {
  Object.assign(process.env, environment);
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  const userId = (await pool.query("SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'")).rows[0].id as string;
  imageId = (
    await pool.query(
      "INSERT INTO catalog.product_images (product_id, file_name, content_type, size_bytes, storage_key, sort_order, uploaded_by) VALUES ($1, 'kem.jpg', 'image/jpeg', 10, 'c68/kem.jpg', 0, $2) RETURNING id",
      [store.products.cream, userId],
    )
  ).rows[0].id;
  await pool.query(
    "INSERT INTO catalog.product_images (product_id, file_name, content_type, size_bytes, storage_key, sort_order, uploaded_by) VALUES ($1, 'kem2.jpg', 'image/jpeg', 10, 'c68/kem2.jpg', 1, $2)",
    [store.products.cream, userId],
  );
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_68 trang chia sẻ sản phẩm", () => {
  it("KICHBAN_KIEMTHU_719: đủ thẻ Open Graph, giá kênh gồm thuế, ảnh tuyệt đối, tên được thoát ký tự, chính sách nội dung", async () => {
    await pool.query("UPDATE catalog.products SET name = $2, brand = 'Thảo Mộc' WHERE id = $1", [store.products.cream, `Kem dưỡng <b>&"đặc biệt"`]);
    await pool.query("UPDATE marketplace.listings SET description = $2 WHERE product_id = $1", [store.products.cream, "Dưỡng ẩm\nsâu cho da khô."]);
    const response = await page(`/s/${store.products.cream}?ref=0912345678&ctv=ab12cd34`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("public, max-age=300");
    expect(response.headers["content-security-policy"]).toBe("default-src 'none'; img-src https://vcomm.vn; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    const html = response.text;
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>&");
    expect(metaOf(html, "og:title")).toBe("Kem dưỡng &#60;b&#62;&#38;&#34;đặc biệt&#34;");
    expect(metaOf(html, "og:type")).toBe("product");
    expect(metaOf(html, "og:image")).toBe(`https://vcomm.vn/api/v1/buyer/shop/images/${imageId}`);
    expect(metaOf(html, "og:url")).toBe(`https://vcomm.vn/s/${store.products.cream}?ref=0912345678&#38;ctv=AB12CD34`);
    expect(metaOf(html, "og:site_name")).toBe("VComm Bán lẻ Miền Nam");
    expect(metaOf(html, "og:description")).toBe("250.000 ₫ · Dưỡng ẩm sâu cho da khô.");
    expect(metaOf(html, "product:price:amount")).toBe("250000");
    expect(metaOf(html, "product:price:currency")).toBe("VND");
    expect(html).toContain("Cửa hàng: VComm Bán lẻ Miền Nam");
    expect(html).not.toContain("Hết hàng");
    // Tiếng Anh theo ngôn ngữ trình duyệt.
    const english = (await page(`/s/${store.products.cream}`, "en-US,en;q=0.9")).text;
    expect(english).toContain('<html lang="en">');
    expect(english).toContain("Open the VComm app");
  });

  it("KICHBAN_KIEMTHU_719: nhiều phân loại khác giá ghi Từ giá thấp nhất", () => {
    const html = renderSharePage({
      locale: "vi",
      links: shareLinks(),
      storeName: "VCR",
      currency: "VND",
      codes: { ref: null, ctv: null },
      product: {
        id: "8f1c2a7e-0000-4000-8000-000000000001",
        name: "Sữa tắm",
        description: null,
        brand: null,
        options: [{ name: "Dung tích", values: ["250 ml", "500 ml"] }],
        imageIds: [],
        variants: [
          { variantId: "a", sku: "ST-500", optionValues: ["500 ml"], grossPrice: "189000", available: "0" },
          { variantId: "b", sku: "ST-250", optionValues: ["250 ml"], grossPrice: "129000", available: "3" },
        ],
      },
    });
    expect(metaOf(html, "og:description")).toBe("Từ 129.000 ₫");
    expect(metaOf(html, "product:price:amount")).toBe("129000");
  });

  it("KICHBAN_KIEMTHU_720: không ảnh thì không có og:image; mô tả dài cắt 160 ký tự; máy đọc Facebook đọc được thẻ", async () => {
    await pool.query("UPDATE catalog.products SET description = $2 WHERE id = $1", [store.products.soap, "Xà phòng ".repeat(40)]);
    const response = await http().get(`/s/${store.products.soap}`).set("user-agent", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)");
    expect(response.status).toBe(200);
    expect(metaOf(response.text, "og:image")).toBeNull();
    expect(response.text).toContain('<meta name="twitter:card" content="summary">');
    const description = metaOf(response.text, "og:description")!;
    expect(description.startsWith("44.000 ₫ · Xà phòng Xà phòng")).toBe(true);
    expect(description.endsWith("…")).toBe(true);
    expect(description.length).toBe("44.000 ₫ · ".length + 160);
  });

  it("KICHBAN_KIEMTHU_721: nút giữ mã giới thiệu, mã cộng tác viên; mã sai dạng bị bỏ", async () => {
    const id = store.products.cream;
    expect(hrefs((await page(`/s/${id}?ref=0912345678&ctv=ab12cd34`)).text)).toEqual([
      ["Mở ứng dụng VComm", `vcomm://r/0912345678?sp=${id}&ctv=AB12CD34`],
      ["Xem trên web", `https://app.vcomm.vn/r/0912345678?sp=${id}&ctv=AB12CD34`],
    ]);
    expect(hrefs((await page(`/s/${id}?ctv=K7MZ4QHP`)).text)).toEqual([
      ["Mở ứng dụng VComm", `vcomm://p/${id}?ctv=K7MZ4QHP`],
      ["Xem trên web", `https://app.vcomm.vn/p/${id}?ctv=K7MZ4QHP`],
    ]);
    const bad = (await page(`/s/${id}?ref=%3Cscript%3E&ctv=QU%C3%81D%C3%80I123`)).text;
    expect(hrefs(bad)).toEqual([
      ["Mở ứng dụng VComm", `vcomm://san-pham/${id}`],
      ["Xem trên web", `https://app.vcomm.vn/san-pham/${id}`],
    ]);
    expect(bad).not.toContain("&#60;script");
    expect(bad).not.toContain("<script");
    expect(metaOf(bad, "og:url")).toBe(`https://vcomm.vn/s/${id}`);
    // Câu ghi người giới thiệu chỉ hiện khi có mã giới thiệu.
    expect((await page(`/s/${id}?ref=0912345678`)).text).toContain("Đăng ký từ đường dẫn này sẽ ghi người giới thiệu 0912345678.");
    expect(bad).not.toContain("Đăng ký từ đường dẫn này");
  });

  it("KICHBAN_KIEMTHU_722: nút tải ứng dụng chỉ hiện khi có cấu hình", async () => {
    expect((await page(`/s/${store.products.cream}`)).text).not.toContain("Tải trên");
    Object.assign(process.env, { APP_STORE_URL: "https://apps.apple.com/vn/app/vcomm/id1", GOOGLE_PLAY_URL: "https://play.google.com/store/apps/details?id=vn.vcomm.app" });
    const links = hrefs((await page(`/s/${store.products.cream}`)).text);
    expect(links.slice(2)).toEqual([
      ["Tải trên App Store", "https://apps.apple.com/vn/app/vcomm/id1"],
      ["Tải trên Google Play", "https://play.google.com/store/apps/details?id=vn.vcomm.app"],
    ]);
    Object.assign(process.env, { APP_STORE_URL: "", GOOGLE_PLAY_URL: "" });
  });

  it("KICHBAN_KIEMTHU_723: sản phẩm không hiện trên cửa hàng trả 404 không lộ tên, giá; hết hàng vẫn hiện", async () => {
    const other = (await pool.query("SELECT id FROM catalog.products WHERE company_id <> $1 LIMIT 1", [retail])).rows[0]?.id as string | undefined;
    const cases: string[] = ["khong-phai-ma", "00000000-0000-4000-8000-000000000000", ...(other ? [other] : [])];
    await pool.query("UPDATE marketplace.listings SET is_published = false WHERE product_id = $1", [store.products.soap]);
    cases.push(store.products.soap);
    for (const id of cases) {
      const response = await page(`/s/${id}?ref=0912345678`);
      expect(response.status, id).toBe(404);
      expect(response.text).toContain("Sản phẩm không còn bán.");
      expect(response.text).toContain('href="https://app.vcomm.vn/"');
      expect(response.text).not.toContain("og:");
      expect(response.text).not.toContain("44.000");
      expect(response.text).not.toContain("Xà phòng");
    }
    await pool.query("UPDATE marketplace.listings SET is_published = true WHERE product_id = $1", [store.products.soap]);
    await pool.query("UPDATE catalog.products SET review_status = 'pending' WHERE id = $1", [store.products.soap]);
    expect((await page(`/s/${store.products.soap}`)).status).toBe(404);
    await pool.query("UPDATE catalog.products SET review_status = 'approved' WHERE id = $1", [store.products.soap]);
    // Hết hàng.
    await pool.query("UPDATE inventory.costs SET quantity = 0 WHERE variant_id = $1", [store.variants.soap]);
    const empty = await page(`/s/${store.products.soap}`);
    expect(empty.status).toBe(200);
    expect(empty.text).toContain("Hết hàng");
    await pool.query("UPDATE inventory.costs SET quantity = 10 WHERE variant_id = $1", [store.variants.soap]);
  });

  it("KICHBAN_KIEMTHU_724: tệp liên kết ứng dụng có, không có cấu hình; đường dẫn /api/v1 vẫn chạy", async () => {
    expect((await http().get("/.well-known/apple-app-site-association")).status).toBe(404);
    expect((await http().get("/.well-known/assetlinks.json")).status).toBe(404);
    Object.assign(process.env, { APPLE_TEAM_ID: "ABCDE12345", ANDROID_SHA256_CERT_FINGERPRINTS: "aa:bb:cc, DD:EE:FF" });
    const apple = await http().get("/.well-known/apple-app-site-association");
    expect(apple.status).toBe(200);
    expect(apple.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(apple.text)).toEqual({ applinks: { details: [{ appIDs: ["ABCDE12345.vn.vcomm.app"], components: [{ "/": "/s/*" }] }] } });
    const android = await http().get("/.well-known/assetlinks.json");
    expect(JSON.parse(android.text)).toEqual([
      { relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "vn.vcomm.app", sha256_cert_fingerprints: ["AA:BB:CC", "DD:EE:FF"] } },
    ]);
    Object.assign(process.env, { APPLE_TEAM_ID: "", ANDROID_SHA256_CERT_FINGERPRINTS: "" });
    // Tiền tố /api/v1 vẫn áp dụng cho API khác; /api/v1/s/... không phải trang chia sẻ.
    expect((await http().get(`/api/v1/s/${store.products.cream}`)).status).toBe(404);
    expect((await http().get(`/api/v1/buyer/shop/images/${imageId}`)).status).not.toBe(404);
  });
});
