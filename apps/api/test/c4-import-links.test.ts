// CONG_VIEC_04 lát L3: nhập sản phẩm từ Excel; liên kết, sao chép sản phẩm giữa công ty (TIEUCHI_NGHIEMTHU_59, 60; KICHBAN_KIEMTHU_141 đến 143).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { productImportColumns } from "contracts";
import type { Pool } from "pg";
import { readSheet } from "read-excel-file/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;

const workbook = async (rows: string[][]) => writeXlsxFile([productImportColumns.map((value) => ({ value })), ...rows.map((row) => row.map((value) => ({ value })))]).toBuffer();
// Cột theo thứ tự productImportColumns.
const row = (values: Partial<Record<(typeof productImportColumns)[number], string>>) => productImportColumns.map((title) => values[title] ?? "");
const upload = (session: Session, companyId: string, content: Buffer) => session.call("post", "/catalog/product-imports", { companyId }).attach("file", content, "san-pham.xlsx");

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  const created = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "AO", nameVi: "Áo", nameEn: "Shirts" } });
  await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { parentId: created.body.id, code: "AOTH", nameVi: "Áo thun", nameEn: "T-shirts" } });
  await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "SUA", nameVi: "Sữa", nameEn: "Milk", tracksLots: true } });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_59: nhập sản phẩm từ Excel", () => {
  it("KICHBAN_KIEMTHU_141: tệp mẫu; dòng cùng mã gộp thành sản phẩm có phân loại; dòng lỗi có trong tệp lỗi kèm lý do, dòng đúng vẫn nhập", async () => {
    const template = await retailAdmin
      .call("get", "/catalog/product-imports/template", { companyId: retail })
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(template.status).toBe(200);
    expect(((await readSheet(template.body as Buffer)) as string[][])[0]).toEqual([...productImportColumns]);
    const result = await upload(
      retailAdmin,
      retail,
      await workbook([
        row({
          "Mã sản phẩm": "AOTH-TRON",
          "Tên sản phẩm": "Áo thun cổ tròn",
          "Mã ngành hàng": "aoth",
          "Mã đơn vị cơ sở": "CAI",
          "Thuế suất": "8%",
          "Đơn vị quy đổi": "THUNG=24",
          "Phân loại 1": "Màu: Đen",
          "Phân loại 2": "Cỡ: M",
          "Mã vạch": "8930000001001",
        }),
        row({ "Mã sản phẩm": "AOTH-TRON", "Phân loại 1": "Màu: Trắng", "Phân loại 2": "Cỡ: M", "Mã vạch": "8930000001002" }),
        row({ "Tên sản phẩm": "Sữa tươi 1 lít", "Mã ngành hàng": "SUA", "Mã đơn vị cơ sở": "HOP", "Thuế suất": "5", "Trọng lượng (kg)": "1,05", "Mã vạch": "8930000001003" }),
        row({ "Tên sản phẩm": "Ngành hàng sai", "Mã ngành hàng": "KHONGCO", "Mã đơn vị cơ sở": "CAI" }),
        row({ "Tên sản phẩm": "Mã vạch trùng", "Mã ngành hàng": "SUA", "Mã đơn vị cơ sở": "HOP", "Mã vạch": "8930000001003" }),
      ]),
    );
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({ createdProducts: 2, createdVariants: 3, failedRows: 2 });
    expect(result.body.errors.map((error: { row: number }) => error.row)).toEqual([5, 6]);
    expect(result.body.errors[0].message).toContain("Mã ngành hàng");
    expect(result.body.errors[1].message).toContain("Mã vạch đã có trong công ty.");
    const errorFile = Buffer.from(result.body.errorFileUrl.split(",")[1], "base64");
    const errorRows = (await readSheet(errorFile)) as (string | number)[][];
    expect(errorRows[0]![0]).toBe("Dòng");
    expect(errorRows[1]![errorRows[1]!.length - 1]).toContain("Mã ngành hàng");
    const shirt = (await retailAdmin.call("get", "/catalog/products?search=AOTH-TRON", { companyId: retail })).body.data[0];
    const detail = (await retailAdmin.call("get", `/catalog/products/${shirt.id}`, { companyId: retail })).body;
    expect(detail).toMatchObject({
      code: "AOTH-TRON",
      vatRate: "8",
      options: [
        { name: "Màu", values: ["Đen", "Trắng"] },
        { name: "Cỡ", values: ["M"] },
      ],
    });
    expect(detail.variants.map((variant: { sku: string }) => variant.sku)).toEqual(["AOTH-TRON-01", "AOTH-TRON-02"]);
    const milk = (await retailAdmin.call("get", "/catalog/products?search=sua tuoi", { companyId: retail })).body.data[0];
    expect((await retailAdmin.call("get", `/catalog/products/${milk.id}`, { companyId: retail })).body).toMatchObject({ code: "SUA-00001", tracksLots: true, weightKg: "1.05" });
  });

  it("KICHBAN_KIEMTHU_142: 2.000 dòng nhập trong 30 giây; sai mẫu, quá 2.000 dòng bị từ chối cả tệp", async () => {
    expect((await upload(retailAdmin, retail, await writeXlsxFile([[{ value: "Cột lạ" }]]).toBuffer())).body.error.fields.file).toBe("Tệp không đúng mẫu.");
    const many = Array.from({ length: 2000 }, (_, index) =>
      row({ "Tên sản phẩm": `Áo thun mẫu ${index + 1}`, "Mã ngành hàng": "AOTH", "Mã đơn vị cơ sở": "CAI", "Mã vạch": `89310${String(index).padStart(8, "0")}` }),
    );
    expect(
      (await upload(retailAdmin, retail, await workbook([...many, row({ "Tên sản phẩm": "Dòng thứ 2001", "Mã ngành hàng": "AOTH", "Mã đơn vị cơ sở": "CAI" })]))).body.error.fields.file,
    ).toBeTruthy();
    const started = performance.now();
    const result = await upload(retailAdmin, retail, await workbook(many));
    const seconds = (performance.now() - started) / 1000;
    expect(result.body).toMatchObject({ createdProducts: 2000, failedRows: 0, errorFileUrl: null });
    expect(seconds).toBeLessThan(30);
  }, 60_000);
});

describe("TIEUCHI_NGHIEMTHU_60: liên kết, sao chép sản phẩm giữa công ty", () => {
  it("KICHBAN_KIEMTHU_143: sao chép tạo đủ biến thể, đơn vị, mã vạch, liên kết; không có quyền ở công ty đích bị từ chối; gợi ý theo mã vạch", async () => {
    const shirt = (await groupAdmin.call("get", "/catalog/products?search=AOTH-TRON", { companyId: retail })).body.data[0];
    expect((await retailAdmin.call("post", `/catalog/products/${shirt.id}/copy`, { companyId: retail, body: { targetCompanyId: trading } })).status).toBe(403);
    expect((await groupAdmin.call("post", `/catalog/products/${shirt.id}/copy`, { companyId: retail, body: { targetCompanyId: retail } })).status).toBe(400);
    const copied = await groupAdmin.call("post", `/catalog/products/${shirt.id}/copy`, { companyId: retail, body: { targetCompanyId: trading } });
    expect(copied.status).toBe(201);
    const target = (await groupAdmin.call("get", `/catalog/products/${copied.body.productId}`, { companyId: trading })).body;
    expect(target).toMatchObject({
      code: "AOTH-TRON",
      options: [
        { name: "Màu", values: ["Đen", "Trắng"] },
        { name: "Cỡ", values: ["M"] },
      ],
    });
    expect(target.variants.map((variant: { sku: string; barcodes: { barcode: string }[] }) => [variant.sku, variant.barcodes[0]?.barcode])).toEqual([
      ["AOTH-TRON-01", "8930000001001"],
      ["AOTH-TRON-02", "8930000001002"],
    ]);
    expect(target.units).toHaveLength(1);
    const links = (await groupAdmin.call("get", `/catalog/products/${shirt.id}/links`, { companyId: retail })).body;
    expect(links.map((link: { sku: string; linkedSku: string; linkedCompanyName: string; factor: string }) => [link.sku, link.linkedSku, link.linkedCompanyName, link.factor])).toEqual([
      ["AOTH-TRON-01", "AOTH-TRON-01", "VComm Thương mại", "1"],
      ["AOTH-TRON-02", "AOTH-TRON-02", "VComm Thương mại", "1"],
    ]);
    // Đọc từ phía công ty đích thấy liên kết ngược.
    expect((await groupAdmin.call("get", `/catalog/products/${target.id}/links`, { companyId: trading })).body[0].linkedCompanyName).toBe("VComm Bán lẻ Miền Nam");
    // Biến thể đã liên kết với công ty đó thì không liên kết thêm.
    const again = await groupAdmin.call("post", "/catalog/variant-links", { companyId: retail, body: { variantId: links[0].variantId, linkedVariantId: target.variants[1].id } });
    expect(again.status).toBe(409);
    // Bỏ liên kết rồi gợi ý lại theo mã vạch trùng, liên kết với hệ số.
    expect((await groupAdmin.call("delete", `/catalog/variant-links/${links[0].id}`, { companyId: retail })).status).toBe(204);
    const suggestions = (await groupAdmin.call("get", `/catalog/products/${shirt.id}/link-suggestions?targetCompanyId=${trading}`, { companyId: retail })).body;
    expect(suggestions).toEqual([expect.objectContaining({ sku: "AOTH-TRON-01", linkedSku: "AOTH-TRON-01", barcode: "8930000001001" })]);
    const linked = await groupAdmin.call("post", "/catalog/variant-links", {
      companyId: retail,
      body: { variantId: suggestions[0].variantId, linkedVariantId: suggestions[0].linkedVariantId, factor: "2" },
    });
    expect(linked.body).toMatchObject({ sku: "AOTH-TRON-01", factor: "2" });
    expect((await groupAdmin.call("get", `/catalog/products/${target.id}/links`, { companyId: trading })).body.find((link: { sku: string }) => link.sku === "AOTH-TRON-01").factor).toBe("0.5");
    // Người không có quyền ở công ty bên kia không liên kết được.
    expect((await retailAdmin.call("post", "/catalog/variant-links", { companyId: retail, body: { variantId: links[1].variantId, linkedVariantId: target.variants[0].id } })).status).toBe(403);
  });
});
