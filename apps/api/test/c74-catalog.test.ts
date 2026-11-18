// CONG_VIEC_74 L2: danh mục hàng, nhập Excel, tồn kho trên cổng cửa hàng (KICHBAN_KIEMTHU_774, 778 đến 780; TIEUCHI_NGHIEMTHU_565, 569 đến 571).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { iposImportColumns } from "contracts";
import { messages } from "i18n";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import type { Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: AffiliateFixture;
let planId: string;
let otherOwner: Session;

const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const words = messages.vi.iposImport;
const portalOf = (session: Session) => (method: "get" | "post" | "put" | "patch", path: string, body?: object) => session.call(method, `/merchant-portal/ipos${path}`, body ? { body } : {});
const portal = (method: "get" | "post" | "put" | "patch", path: string, body?: object) => portalOf(store.owner)(method, path, body);
const simple = (fields: Partial<Record<string, unknown>> = {}) => ({
  code: "",
  name: "Cà phê sữa đá",
  categoryId: null,
  unit: "Ly",
  price: "29000",
  vatRate: "8",
  trackStock: true,
  attribute1Name: null,
  attribute2Name: null,
  variants: [{ id: null, code: "", attribute1Value: null, attribute2Value: null, price: null, minQuantity: null, barcodes: [], status: "active" }],
  ...fields,
});
const excel = (rows: (string | number)[][]) => writeXlsxFile([[...iposImportColumns], ...rows].map((row) => row.map((value) => ({ value }))), { sheet: "Hàng hóa" }).toBuffer();
const upload = (path: string, file: Buffer, outletId?: string) => {
  const call = store.owner.call("post", `/merchant-portal/ipos/items/import/${path}`).attach("file", file, "hang-hoa.xlsx");
  return outletId ? call.field("outletId", outletId) : call;
};
const subscribe = (merchantId: string, outletId: string) =>
  store.call("post", `/affiliate/merchants/${merchantId}/ipos-subscriptions`, {
    outletId,
    planId,
    periodMonths: 1,
    startsOn: store.today,
    trialDays: null,
    customMonthlyPrice: null,
    customMaxRegisters: null,
  });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareAffiliate(application, pool);
  const plan = await store.call("post", "/ipos/plans", { code: "CO-BAN", name: "Cơ bản", monthlyPrice: "199000", taxPercent: "10", maxRegisters: 2, maxItems: 500, trialDays: 0 });
  planId = plan.body.id as string;
  expect((await subscribe(store.merchantId, store.outletA)).status).toBe(201);
  // Cửa hàng thứ hai để kiểm mã vạch trùng giữa hai cửa hàng.
  const other = await store.createMerchant("Tạp hóa Bình An", "0322222228", "HDLK-02");
  const outlet = (await store.call("post", `/affiliate/merchants/${other}/outlets`, { name: "Chợ Lớn", address: "5 Hải Thượng Lãn Ông" })).body.id as string;
  const detail = await store.call("get", `/affiliate/merchants/${other}`);
  expect((await store.call("post", `/affiliate/merchants/${other}/activate`, { version: detail.body.version })).status).toBe(201);
  await store.call("post", `/affiliate/merchants/${other}/owner-invitations`, { fullName: "Phạm Thị Bình", phone: "0909555666" });
  otherOwner = await store.activate("0909555666");
  expect((await subscribe(other, outlet)).status).toBe(201);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_74 L2 – danh mục hàng", () => {
  it("KICHBAN_KIEMTHU_778: nhóm hai cấp; mã tự sinh, mã trùng; mã vạch trùng trong cửa hàng bị chặn, khác cửa hàng được; biến thể, giá theo điểm bán", async () => {
    const drinks = await portal("post", "/categories", { name: "Đồ uống", parentId: null, sortOrder: 1 });
    expect(drinks.status, JSON.stringify(drinks.body)).toBe(201);
    const drinksId = drinks.body[0].id as string;
    const coffee = await portal("post", "/categories", { name: "Cà phê", parentId: drinksId, sortOrder: 1 });
    const coffeeId = (coffee.body as { id: string; parentId: string | null }[]).find((category) => category.parentId === drinksId)!.id;
    const third = await portal("post", "/categories", { name: "Cà phê pha phin", parentId: coffeeId, sortOrder: 1 });
    expect(third.body.error?.message).toBe(message("iposCategoryDepth"));
    expect((await portal("post", "/categories", { name: "đồ uống", parentId: null, sortOrder: 2 })).body.error?.message).toBe(message("iposCategoryNameTaken"));

    const created = await portal("post", "/items", simple({ categoryId: coffeeId, variants: [{ ...simple().variants[0], barcodes: ["8930001112223"] }] }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.code).toMatch(/^SP\d{6}$/);
    expect(created.body.variants).toHaveLength(1);
    expect(created.body.variants[0].code).toBe(created.body.code);

    expect((await portal("post", "/items", simple({ code: created.body.code.toLowerCase() }))).body.error?.message).toBe(message("iposItemCodeTaken"));
    const barcodeTaken = await portal("post", "/items", simple({ name: "Bạc xỉu", variants: [{ ...simple().variants[0], barcodes: ["8930001112223"] }] }));
    expect(barcodeTaken.body.error?.message).toBe(message("iposBarcodeTaken"));
    // Cửa hàng khác dùng cùng mã vạch, cùng mã mặt hàng được.
    const elsewhere = await portalOf(otherOwner)("post", "/items", simple({ code: created.body.code, variants: [{ ...simple().variants[0], barcodes: ["8930001112223"] }] }));
    expect(elsewhere.status, JSON.stringify(elsewhere.body)).toBe(201);
    // Cửa hàng khác không xem được mặt hàng của cửa hàng này.
    expect((await portalOf(otherOwner)("get", `/items/${created.body.id}`)).status).toBe(404);

    // Mặt hàng có hai thuộc tính: tổ hợp trùng bị chặn; giá biến thể trống thì lấy giá mặt hàng.
    const tea = {
      code: "TRA-SUA",
      name: "Trà sữa",
      categoryId: drinksId,
      unit: "Ly",
      price: "35000",
      vatRate: "8",
      trackStock: false,
      attribute1Name: "Cỡ",
      attribute2Name: "Đường",
      variants: [
        { id: null, code: "", attribute1Value: "M", attribute2Value: "Ít", price: null, minQuantity: null, barcodes: [], status: "active" },
        { id: null, code: "", attribute1Value: "L", attribute2Value: "Ít", price: "42000", minQuantity: null, barcodes: ["TS-L"], status: "active" },
      ],
    };
    expect((await portal("post", "/items", { ...tea, variants: [tea.variants[0], { ...tea.variants[1], attribute1Value: "m" }] })).body.error?.message).toBe(message("iposVariantInvalid"));
    const teaItem = await portal("post", "/items", tea);
    expect(teaItem.status, JSON.stringify(teaItem.body)).toBe(201);
    expect(teaItem.body.variants.map((variant: { code: string }) => variant.code)).toEqual(["TRA-SUA-1", "TRA-SUA-2"]);
    const listed = await portal("get", "/items?search=tra sua");
    expect(listed.body.items[0]).toMatchObject({ code: "TRA-SUA", minPrice: "35000", maxPrice: "42000", variantCount: 2, barcodes: ["TS-L"] });
    expect((await portal("get", "/items?search=TS-L")).body.items.map((item: { code: string }) => item.code)).toEqual(["TRA-SUA"]);
    expect((await portal("get", `/items?categoryId=${drinksId}`)).body.total).toBe(2);

    // Giá riêng điểm bán B cho cỡ L; giá trống thì bỏ giá riêng.
    const large = teaItem.body.variants[1].id as string;
    const prices = await portal("put", `/items/${teaItem.body.id}/outlet-prices`, { prices: [{ outletId: store.outletB, variantId: large, price: "45000" }] });
    expect(prices.status, JSON.stringify(prices.body)).toBe(200);
    expect(prices.body.variants[1].outletPrices).toEqual([{ outletId: store.outletB, price: "45000" }]);
    const cleared = await portal("put", `/items/${teaItem.body.id}/outlet-prices`, { prices: [{ outletId: store.outletB, variantId: large, price: null }] });
    expect(cleared.body.variants[1].outletPrices).toEqual([]);

    // Sửa: bỏ biến thể M khỏi danh sách thì biến thể đó ngừng bán (không xóa).
    const updated = await portal("patch", `/items/${teaItem.body.id}`, { ...tea, variants: [{ ...tea.variants[1], id: large, code: "TRA-SUA-2" }], status: "active", version: teaItem.body.version });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.variants.map((variant: { code: string; status: string }) => [variant.code, variant.status])).toEqual([
      ["TRA-SUA-2", "active"],
      ["TRA-SUA-1", "inactive"],
    ]);
    expect((await portal("patch", `/items/${teaItem.body.id}`, { ...tea, status: "active", version: teaItem.body.version })).status).toBe(409);

    // Thu ngân không vào được danh mục.
    expect((await store.cashier.call("get", "/merchant-portal/ipos/items")).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_779: tệp 5.000 dòng có một dòng lỗi không ghi dòng nào; tệp đúng cập nhật mặt hàng trùng mã, tạo phiếu nhập tồn đầu", async () => {
    const before = (await portal("get", "/items")).body.total as number;
    const rows = Array.from({ length: 5000 }, (_, index) => [`NH${String(index + 1).padStart(5, "0")}`, `Mặt hàng ${index + 1}`, "Tạp hóa", "", "Gói", "12000", "8", "Có", "", "", ""]);
    rows[4321]![5] = "-5";
    const file = await excel(rows);
    const checked = await upload("validate", file);
    expect(checked.status, JSON.stringify(checked.body).slice(0, 500)).toBe(201);
    expect(checked.body.rows).toBe(5000);
    expect(checked.body.errors).toEqual(expect.arrayContaining([{ row: 4323, column: "Giá bán", message: words.price }]));
    // Gói giới hạn 500 mặt hàng: tệp thêm 4.999 mặt hàng hợp lệ cũng bị báo vượt giới hạn.
    expect(checked.body.errors.some((error: { row: number; message: string }) => error.row === 0)).toBe(true);
    const committed = await upload("commit", file);
    expect(committed.body.committed).toBe(false);
    expect((await portal("get", "/items")).body.total).toBe(before);

    // Tệp đúng: một dòng trùng mã có sẵn (cập nhật), một dòng mới có tồn đầu kỳ; thiếu điểm bán thì báo lỗi.
    const existing = (await portal("get", "/items?search=ca phe sua")).body.items[0] as { code: string; id: string };
    const good = await excel([
      [existing.code, "Cà phê sữa đá (ly lớn)", "Đồ uống", "Cà phê", "Ly", "32000", "10", "Có", "", "", ""],
      ["", "Nước suối 500ml", "Đồ uống", "Nước", "Chai", "6.000", "Không chịu thuế", "Có", "8930009998887; 8930009998894", "24", "3500"],
      ["DV0001", "Phí gói quà", "Dịch vụ", "", "Lần", "10000", "0", "Không", "", "", ""],
    ]);
    const noOutlet = await upload("validate", good);
    expect(noOutlet.body.errors).toEqual([{ row: 3, column: "Tồn đầu kỳ", message: words.outletRequired }]);
    const valid = await upload("validate", good, store.outletA);
    expect(valid.body).toMatchObject({ rows: 3, creates: 2, updates: 1, openingStockRows: 1, errors: [], committed: false });
    const written = await upload("commit", good, store.outletA);
    expect(written.body).toMatchObject({ committed: true, creates: 2, updates: 1, receiptNumber: "PN000001" });
    const updated = await portal("get", `/items/${existing.id}`);
    expect(updated.body).toMatchObject({ name: "Cà phê sữa đá (ly lớn)", price: "32000", vatRate: "10" });
    const water = (await portal("get", "/items?search=nuoc suoi")).body.items[0];
    expect(water).toMatchObject({ code: expect.stringMatching(/^SP\d{6}$/), vatRate: "exempt", minPrice: "6000", barcodes: ["8930009998887", "8930009998894"], categoryName: "Nước" });
    const stock = await portal("get", `/stock?outletId=${store.outletA}&search=nuoc suoi`);
    expect(stock.body[0]).toMatchObject({ quantity: "24", averageCost: "3500", value: "84000" });
    // Dòng trùng mã vạch với mặt hàng có sẵn báo lỗi kèm mã mặt hàng.
    const clash = await upload("validate", await excel([["", "Nước suối chai lớn", "", "", "Chai", "9000", "0", "Có", "8930009998887", "", ""]]));
    expect(clash.body.errors).toEqual([{ row: 2, column: "Mã vạch", message: words.barcodeTaken.replace("{code}", water.code) }]);
  });

  it("KICHBAN_KIEMTHU_774: đổi gói giảm số mặt hàng: chặn thêm mới, không ẩn mặt hàng đã có", async () => {
    // Thêm 100 mặt hàng bằng Excel để số đang bán vượt giới hạn 100 của gói mới.
    const bulk = await upload("commit", await excel(Array.from({ length: 100 }, (_, index) => [`LO${index + 1}`, `Hàng lô ${index + 1}`, "", "", "Cái", "1000", "8", "Không", "", "", ""])));
    expect(bulk.body.committed, JSON.stringify(bulk.body.errors)).toBe(true);
    const total = (await portal("get", "/items")).body.activeVariants as number;
    expect(total).toBeGreaterThan(100);
    const lower = await store.call("post", "/ipos/plans", { code: "NHO", name: "Nhỏ", monthlyPrice: "99000", taxPercent: "10", maxRegisters: 1, maxItems: 100, trialDays: 0 });
    await pool.query("UPDATE ipos.subscriptions SET plan_id = $1 WHERE merchant_id = $2", [lower.body.id, store.merchantId]);
    const page = await portal("get", "/items");
    expect(page.body).toMatchObject({ activeVariants: total, maxItems: 100, planName: "Nhỏ" });
    expect((await portal("post", "/items", simple({ name: "Bánh mì" }))).body.error?.message).toBe(message("iposItemLimit"));
    // Sửa mặt hàng có sẵn (không tăng số đang bán) vẫn được.
    const first = page.body.items[0] as { id: string };
    const detail = (await portal("get", `/items/${first.id}`)).body;
    const edit = await portal("patch", `/items/${first.id}`, {
      code: detail.code,
      name: `${detail.name} mới`,
      categoryId: detail.categoryId,
      unit: detail.unit,
      price: detail.price,
      vatRate: detail.vatRate,
      trackStock: detail.trackStock,
      attribute1Name: detail.attribute1Name,
      attribute2Name: detail.attribute2Name,
      variants: detail.variants.map((variant: Record<string, unknown>) => ({ id: variant.id, code: variant.code, attribute1Value: variant.attribute1Value, attribute2Value: variant.attribute2Value, price: variant.price, minQuantity: variant.minQuantity, barcodes: variant.barcodes, status: variant.status })),
      status: detail.status,
      version: detail.version,
    });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    await pool.query("UPDATE ipos.subscriptions SET plan_id = $1 WHERE merchant_id = $2", [planId, store.merchantId]);
  });
});

describe("CONG_VIEC_74 L2 – tồn kho", () => {
  it("KICHBAN_KIEMTHU_780: hai phiếu nhập giá khác cho giá vốn bình quân; phiếu điều chỉnh; mặt hàng không theo dõi tồn bị chặn; điểm bán chưa có thuê bao bị chặn", async () => {
    const item = await portal("post", "/items", simple({ code: "MI-TOM", name: "Mì tôm chua cay", unit: "Gói", price: "5000", variants: [{ ...simple().variants[0], minQuantity: "20" }] }));
    expect(item.status, JSON.stringify(item.body)).toBe(201);
    const variantId = item.body.variants[0].id as string;
    const options = await portal("get", "/variant-options?search=mi tom");
    expect(options.body.map((option: { variantId: string }) => option.variantId)).toEqual([variantId]);

    const first = await portal("post", "/stock-documents", { kind: "receipt", outletId: store.outletA, note: null, lines: [{ variantId, quantity: "10", unitCost: "3000" }] });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.number).toMatch(/^PN\d{6}$/);
    const second = await portal("post", "/stock-documents", { kind: "receipt", outletId: store.outletA, note: "Nhập thêm", lines: [{ variantId, quantity: "30", unitCost: "3400" }] });
    expect(second.body).toMatchObject({ totalCost: "102000", lineCount: 1 });
    let stock = await portal("get", `/stock?outletId=${store.outletA}&search=mi tom`);
    // (10 × 3.000 + 30 × 3.400) / 40 = 3.300.
    expect(stock.body[0]).toMatchObject({ quantity: "40", averageCost: "3300", value: "132000", minQuantity: "20" });

    const adjustment = await portal("post", "/stock-documents", { kind: "adjustment", outletId: store.outletA, note: "Kiểm kê cuối ngày", lines: [{ variantId, actualQuantity: "12" }] });
    expect(adjustment.status, JSON.stringify(adjustment.body)).toBe(201);
    expect(adjustment.body).toMatchObject({ number: "PC000001", lines: [{ actualQuantity: "12", beforeQuantity: "40", quantity: null }] });
    stock = await portal("get", `/stock?outletId=${store.outletA}&belowMin=true`);
    expect(stock.body.map((row: { variantId: string }) => row.variantId)).toContain(variantId);
    expect(stock.body.find((row: { variantId: string }) => row.variantId === variantId)).toMatchObject({ quantity: "12", averageCost: "3300" });
    const moves = await portal("get", `/stock-moves?outletId=${store.outletA}&variantId=${variantId}`);
    expect(moves.body.map((move: { quantity: string; balanceAfter: string; sourceNumber: string }) => [move.quantity, move.balanceAfter, move.sourceNumber])).toEqual([
      ["-28", "12", "PC000001"],
      ["30", "40", second.body.number],
      ["10", "10", first.body.number],
    ]);
    expect((await portal("get", `/stock-documents?outletId=${store.outletA}`)).body.length).toBeGreaterThanOrEqual(3);

    // Phiếu điều chỉnh bắt buộc lý do; mặt hàng không theo dõi tồn; trùng dòng; điểm bán chưa có thuê bao.
    expect((await portal("post", "/stock-documents", { kind: "adjustment", outletId: store.outletA, note: "", lines: [{ variantId, actualQuantity: "1" }] })).status).toBe(400);
    const service = (await portal("get", "/items?search=phi goi qua")).body.items[0] as { id: string };
    const serviceVariant = (await portal("get", `/items/${service.id}`)).body.variants[0].id as string;
    expect((await portal("post", "/stock-documents", { kind: "receipt", outletId: store.outletA, note: null, lines: [{ variantId: serviceVariant, quantity: "1", unitCost: "0" }] })).body.error?.message).toBe(
      message("iposItemNotTracked"),
    );
    expect(
      (await portal("post", "/stock-documents", { kind: "receipt", outletId: store.outletA, note: null, lines: [{ variantId, quantity: "1", unitCost: "1" }, { variantId, quantity: "2", unitCost: "1" }] })).body.error?.message,
    ).toBe(message("iposStockDuplicateLine"));
    expect((await portal("post", "/stock-documents", { kind: "receipt", outletId: store.outletB, note: null, lines: [{ variantId, quantity: "1", unitCost: "1" }] })).body.error?.message).toBe(
      message("iposNoSubscription"),
    );
    // Cửa hàng khác không lập phiếu cho biến thể của cửa hàng này.
    expect((await portalOf(otherOwner)("post", "/stock-documents", { kind: "receipt", outletId: store.outletA, note: null, lines: [{ variantId, quantity: "1", unitCost: "1" }] })).status).toBe(409);
  });
});
