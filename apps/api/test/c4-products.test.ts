// CONG_VIEC_04 lát L2: sản phẩm, biến thể, mã hàng, đơn vị, mã vạch, ảnh (TIEUCHI_NGHIEMTHU_57, 58, 63, 64; KICHBAN_KIEMTHU_136 đến 140).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let employee: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};
const categories: Record<string, string> = {};
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

const phone = (extra: Record<string, unknown> = {}) => ({
  categoryId: categories.DTDD,
  name: "Điện thoại VPhone X",
  brand: "VPhone",
  vatRate: "10",
  tracksLots: false,
  tracksSerials: true,
  warrantyMonths: 12,
  baseUnitId: units.CAI,
  weightKg: "0,25",
  options: [
    { name: "Màu", values: ["Đen", "Trắng"] },
    { name: "Dung lượng", values: ["128GB", "256GB"] },
  ],
  specifications: [{ name: "Màn hình", value: "6,1 inch" }],
  units: [{ unitId: units.HOP, factor: "1" }],
  variants: [
    { optionValues: ["Đen", "128GB"], barcodes: [{ unitId: units.CAI, barcode: "8930000000011" }] },
    { optionValues: ["Đen", "256GB"] },
    { optionValues: ["Trắng", "128GB"] },
    { optionValues: ["Trắng", "256GB"] },
  ],
  ...extra,
});

const shirt = (name: string, barcode: string, extra: Record<string, unknown> = {}) => ({
  categoryId: categories.AOTH,
  name,
  vatRate: "8",
  tracksLots: false,
  tracksSerials: false,
  warrantyMonths: 0,
  baseUnitId: units.CAI,
  units: [{ unitId: units.THUNG, factor: "24" }],
  variants: [{ barcodes: [{ unitId: units.CAI, barcode }] }],
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  employee = await signIn(application, "thukho.bd@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const create = async (code: string, parentId: string | null, extra: Record<string, unknown> = {}) => {
    const response = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { parentId, code, nameVi: code, nameEn: code, ...extra } });
    categories[code] = response.body.id;
  };
  await create("DT", null, { tracksSerials: true, warrantyMonths: 12 });
  await create("DTDD", categories.DT!, { tracksSerials: true, warrantyMonths: 12 });
  await create("AO", null);
  await create("AOTH", categories.AO!);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_57: sản phẩm có biến thể, mã hàng theo quy tắc, tách theo công ty", () => {
  it("KICHBAN_KIEMTHU_136: 2 thuộc tính phân loại sinh 4 biến thể, mã hàng tự sinh; công ty khác không đọc được", async () => {
    expect((await employee.call("get", "/catalog/products", { companyId: retail })).status).toBe(403);
    const created = await retailAdmin.call("post", "/catalog/products", { companyId: retail, body: phone() });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ code: "DTDD-00001", weightKg: "0.25", tracksSerials: true, units: [{ unitId: units.HOP, factor: "1" }] });
    expect(created.body.variants.map((variant: { sku: string }) => variant.sku)).toEqual(["DTDD-00001-01", "DTDD-00001-02", "DTDD-00001-03", "DTDD-00001-04"]);
    expect(created.body.variants[0].barcodes).toEqual([{ unitId: units.CAI, barcode: "8930000000011" }]);
    const second = await retailAdmin.call("post", "/catalog/products", { companyId: retail, body: shirt("Áo thun cổ tròn", "8930000000028") });
    expect(second.body.code).toBe("AOTH-00001");
    expect(second.body.variants.map((variant: { sku: string }) => variant.sku)).toEqual(["AOTH-00001"]);
    expect((await groupAdmin.call("get", `/catalog/products/${created.body.id}`, { companyId: trading })).status).toBe(404);
    expect((await groupAdmin.call("get", "/catalog/products", { companyId: trading })).body.total).toBe(0);
    expect((await groupAdmin.call("patch", `/catalog/products/${created.body.id}`, { companyId: trading, body: { ...phone(), version: 1 } })).status).toBe(404);
  });

  it("KICHBAN_KIEMTHU_137: sửa sản phẩm: bỏ biến thể thì ngừng bán biến thể đó, mã vạch chuyển giữa biến thể, sai phiên bản bị từ chối", async () => {
    const product = (await retailAdmin.call("get", "/catalog/products?search=VPhone", { companyId: retail })).body.data[0];
    const detail = (await retailAdmin.call("get", `/catalog/products/${product.id}`, { companyId: retail })).body;
    const variants = detail.variants.map((variant: { id: string; optionValues: string[] }, index: number) => ({
      id: variant.id,
      optionValues: variant.optionValues,
      barcodes: index === 1 ? [{ unitId: units.CAI, barcode: "8930000000011" }] : [],
    }));
    const updated = await retailAdmin.call("patch", `/catalog/products/${product.id}`, {
      companyId: retail,
      body: { ...phone({ name: "Điện thoại VPhone X (2026)" }), variants: variants.slice(0, 3), version: detail.version },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.variants.map((variant: { status: string }) => variant.status)).toEqual(["active", "active", "active", "inactive"]);
    expect(updated.body.variants[1].barcodes).toEqual([{ unitId: units.CAI, barcode: "8930000000011" }]);
    expect(updated.body.variants[0].barcodes).toEqual([]);
    expect((await retailAdmin.call("patch", `/catalog/products/${product.id}`, { companyId: retail, body: { ...phone(), variants, version: detail.version } })).status).toBe(409);
    const stopped = await retailAdmin.call("post", `/catalog/products/${product.id}/deactivate`, { companyId: retail, body: { version: updated.body.version } });
    expect(stopped.body.status).toBe("inactive");
    expect((await retailAdmin.call("get", "/catalog/products?status=active&search=VPhone", { companyId: retail })).body.total).toBe(0);
  });
});

describe("TIEUCHI_NGHIEMTHU_58: trùng mã hàng, mã vạch, đơn vị sai bị từ chối, chỉ ra đúng dòng", () => {
  it("KICHBAN_KIEMTHU_138", async () => {
    const duplicateBarcode = await retailAdmin.call("post", "/catalog/products", { companyId: retail, body: shirt("Áo thun dài tay", "8930000000028") });
    expect(duplicateBarcode.status).toBe(400);
    expect(duplicateBarcode.body.error.fields).toEqual({ "variants.0.barcodes.0.barcode": "Mã vạch đã có trong công ty." });
    const duplicateSku = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: shirt("Áo thun dài tay", "8930000000035", { variants: [{ sku: "aoth-00001", barcodes: [] }] }),
    });
    expect(duplicateSku.body.error.fields).toEqual({ "variants.0.sku": "Mã hàng đã có trong công ty." });
    const badUnits = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: shirt("Áo thun dài tay", "8930000000035", {
        units: [
          { unitId: units.CAI, factor: "2" },
          { unitId: units.THUNG, factor: "0" },
        ],
      }),
    });
    expect(Object.keys(badUnits.body.error.fields).sort()).toEqual(["units.0.unitId", "units.1.factor"]);
    const notLeaf = await retailAdmin.call("post", "/catalog/products", { companyId: retail, body: shirt("Áo", "8930000000042", { categoryId: categories.AO }) });
    expect(notLeaf.body.error.fields).toEqual({ categoryId: "Chỉ chọn ngành hàng cuối cùng (không có ngành hàng con)." });
    const badVariants = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: phone({ variants: [{ optionValues: ["Đen", "128GB"] }, { optionValues: ["Đen", "128GB"] }, { optionValues: ["Xanh", "128GB"] }] }),
    });
    expect(Object.keys(badVariants.body.error.fields).sort()).toEqual(["variants.1.optionValues", "variants.2.optionValues"]);
    // Cùng mã vạch ở công ty khác được phép.
    const otherCompany = await groupAdmin.call("post", "/catalog/products", { companyId: trading, body: shirt("Áo thun cổ tròn", "8930000000028") });
    expect(otherCompany.status).toBe(201);
    expect(otherCompany.body.code).toBe("AOTH-00001");
  });
});

describe("TIEUCHI_NGHIEMTHU_63: ảnh sản phẩm", () => {
  it("KICHBAN_KIEMTHU_139: sai loại, quá 5 MB, quá 10 ảnh bị từ chối; công ty khác không tải được", async () => {
    const product = (await retailAdmin.call("get", "/catalog/products?search=ao thun co tron", { companyId: retail })).body.data[0];
    const upload = (content: Buffer, name: string) => retailAdmin.call("post", `/catalog/products/${product.id}/images`, { companyId: retail }).attach("file", content, name);
    expect((await upload(Buffer.from("không phải ảnh"), "anh.png")).body.error.fields).toEqual({ file: "Chỉ nhận ảnh JPG, PNG, WEBP." });
    expect((await upload(Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]), "lon.png")).body.error.fields).toEqual({ file: "Ảnh vượt quá 5 MB." });
    const first = await upload(png, "Áo thun mặt trước.png");
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ fileName: "Áo thun mặt trước.png", contentType: "image/png" });
    for (let index = 2; index <= 10; index += 1) expect((await upload(png, `anh-${index}.png`)).status).toBe(201);
    expect((await upload(png, "anh-11.png")).status).toBe(409);
    const listed = (await retailAdmin.call("get", `/catalog/products?search=ao thun`, { companyId: retail })).body.data[0];
    expect(listed.imageId).toBe(first.body.id);
    const downloaded = await retailAdmin.call("get", `/catalog/product-images/${first.body.id}?companyId=${retail}`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toBe("image/png");
    expect((await groupAdmin.call("get", `/catalog/product-images/${first.body.id}`, { companyId: trading })).status).toBe(404);
    const detail = (await retailAdmin.call("get", `/catalog/products/${product.id}`, { companyId: retail })).body;
    expect((await retailAdmin.call("post", `/catalog/product-images/${detail.images[3].id}/primary`, { companyId: retail })).status).toBe(204);
    expect((await retailAdmin.call("get", `/catalog/products/${product.id}`, { companyId: retail })).body.images[0].id).toBe(detail.images[3].id);
    expect((await retailAdmin.call("delete", `/catalog/product-images/${first.body.id}`, { companyId: retail })).status).toBe(204);
  });
});

describe("TIEUCHI_NGHIEMTHU_64: tìm không dấu, theo mã vạch; danh sách nhanh", () => {
  it("KICHBAN_KIEMTHU_140: tìm 'ao thun' ra 'Áo thun'; tìm theo mã vạch, mã hàng; 10.000 sản phẩm trả trang đầu dưới 500 ms", async () => {
    const byName = await retailAdmin.call("get", "/catalog/products?search=ao thun", { companyId: retail });
    expect(byName.body.data.map((item: { name: string }) => item.name)).toEqual(["Áo thun cổ tròn"]);
    expect((await retailAdmin.call("get", "/catalog/products?search=8930000000028", { companyId: retail })).body.total).toBe(1);
    expect((await retailAdmin.call("get", "/catalog/products?search=dtdd-00001-02", { companyId: retail })).body.data[0].code).toBe("DTDD-00001");
    await pool.query(
      `INSERT INTO catalog.products (company_id, category_id, code, name, search_text, base_unit_id)
       SELECT $1, $2, 'AOTH-T' || n, 'Áo thử ' || n, 'aoth-t' || n || ' ao thu ' || n, $3 FROM generate_series(1, 10000) n`,
      [retail, categories.AOTH, units.CAI],
    );
    const started = performance.now();
    const page = await retailAdmin.call("get", "/catalog/products?pageSize=20", { companyId: retail });
    const elapsed = performance.now() - started;
    expect(page.body.total).toBeGreaterThan(10000);
    expect(elapsed).toBeLessThan(500);
  });
});
