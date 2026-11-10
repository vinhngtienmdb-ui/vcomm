// CONG_VIEC_19: Đối soát thu hộ COD, cổng thanh toán (KICHBAN_KIEMTHU_261 trở đi).
// Hàng A thuế 10%: giá bán gồm thuế 11.000.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let admin: Session;
let accountant: Session;
let seller: Session;
let keeper: Session;
let chief: Session;
let cashFund: string;
let today: string;
let warehouseId: string;
let retailChannel: string;
let customer: string;
let itemA: string;
let itemB: string;
let unitId: string;
const retail: string = testIds.retailCompany;

async function assign(email: string, name: string, role: string, branchId?: string) {
  const id = await createTestUser(pool, email, name, [{ companyId: retail, branchId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    retail,
    branchId ?? null,
  ]);
  return signIn(application, email);
}
const call = (session: Session, method: "get" | "post" | "put" | "patch" | "delete", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

async function partner(name: string, taxCode: string, profile: Record<string, unknown>) {
  const created = await admin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name, taxCode } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  await admin.call("put", `/crm/partners/${created.body.id}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: false, paymentTermDays: 0, creditLimit: null, version: 0, ...profile },
  });
  return created.body.id as string;
}
// Đơn bán đã xác nhận (chưa có chính sách duyệt) rồi giao một phần.
async function confirmedOrder(quantity: string, customerId: string | null, variantId = itemA) {
  const created = await call(seller, "post", "/sales/orders", {
    channelId: retailChannel,
    warehouseId,
    orderDate: today,
    ...(customerId ? { customerId } : { buyerName: "Khách lẻ" }),
    lines: [{ variantId, unitId, quantity, discountPercent: "0" }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await call(seller, "post", `/sales/orders/${created.body.id}/submit`);
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("confirmed");
  return submitted.body as { id: string; lines: { id: string }[] };
}
async function deliver(order: { id: string; lines: { id: string }[] }, quantity: string) {
  const issue = await keeper.call("post", "/inventory/sales-issues", { companyId: retail, body: { orderId: order.id, documentDate: today, lines: [{ orderLineId: order.lines[0]!.id, quantity }] } });
  expect(issue.status, JSON.stringify(issue.body)).toBe(201);
  const posted = await keeper.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail });
  expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
  return posted.body as { id: string; documentNo: string; lines: { id: string }[] };
}
beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  accountant = await assign("ketoan.th@vcomm.test", "Phan Thị Hộ", "accountant");
  chief = await assign("ketoantruong.th@vcomm.test", "Hồ Văn Soát", "chief_accountant");
  seller = await assign("banhang.th@vcomm.test", "Kha Văn Giao", "salesperson");
  keeper = await assign("thukho.th@vcomm.test", "Âu Văn Xuất", "warehouse_keeper", testIds.binhDuongWarehouse);

  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "THT", nameVi: "THT", nameEn: "THT" } })).body.id;
  const product = await admin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Hàng công nợ A", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
  });
  itemA = product.body.variants[0].id;
  // Hàng B giá gồm thuế 12.000: đơn giá chưa thuế lẻ (10.909,09...).
  itemB = (
    await admin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId: category, name: "Hàng hoa hồng B", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
    })
  ).body.variants[0].id;
  warehouseId = (await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "THW", name: "Kho thu hộ", usesLocations: false } })).body
    .id;
  const receipt = await admin.call("post", "/inventory/documents", {
    companyId: retail,
    body: {
      type: "receipt_other",
      warehouseId,
      companyId: retail,
      documentDate: today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [
        { variantId: itemA, unitId, quantity: "1000", unitCost: "8000" },
        { variantId: itemB, unitId, quantity: "100", unitCost: "8000" },
      ],
    },
  });
  expect((await admin.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  const channels = (await admin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  retailChannel = channels.find((channel) => channel.code === "BAN_LE")!.id;
  const general = (await admin.call("post", "/catalog/price-lists", { companyId: retail, body: { code: "CHUNG", name: "Chung", includesVat: true } })).body.id;
  const change = await admin.call("post", "/catalog/price-changes", {
    companyId: retail,
    body: {
      priceListId: general,
      effectiveFrom: today,
      lines: [
        { variantId: itemA, unitId, price: "11000" },
        { variantId: itemB, unitId, price: "12000" },
      ],
    },
  });
  expect((await admin.call("post", `/catalog/price-changes/${change.body.id}/submit`, { companyId: retail })).status).toBe(201);
  customer = await partner("Khách công nợ", "0320001901", { isCustomer: true, paymentTermDays: 30 });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

type Row = (string | number | null)[];
const columns = ["Mã vận đơn hoặc mã giao dịch", "Số đơn bán", "Tiền thu hộ", "Phí", "Ngày thu"];
const workbook = async (rows: Row[], header = columns) =>
  (await writeXlsxFile([header.map((value) => ({ value })), ...rows.map((row) => row.map((value) => (value === null ? null : { value, ...(typeof value === "number" ? { type: Number } : {}) })))], {
    sheet: "Đối soát",
  }).toBuffer()) as Buffer;
const upload = (session: Session, fields: Record<string, string>, file: Buffer) => {
  let test = session.call("post", "/finance/collection-statements", { companyId: retail });
  for (const [key, value] of Object.entries(fields)) test = test.field(key, value);
  return test.attach("file", file, "doi-soat.xlsx");
};
let collector: string;
let collectorPartner: string;
let orderOne: { id: string; documentNo: string };
let orderTwo: { id: string; documentNo: string };

describe("CONG_VIEC_19 đơn vị thu hộ", () => {
  it("KICHBAN_KIEMTHU_261: khai đơn vị thu hộ là đối tác có hồ sơ khách hàng; trùng, không có quyền bị từ chối", async () => {
    const supplierOnly = await partner("Nhà vận chuyển chưa là khách", "0320001902", { isSupplier: true, paymentTermDays: 0 });
    expect((await call(chief, "post", "/finance/collectors", { partnerId: supplierOnly, kind: "cod", version: null })).body.error.fields).toEqual({ partnerId: expect.any(String) });
    collectorPartner = await partner("Giao hàng nhanh thử", "0320001903", { isCustomer: true, paymentTermDays: 0 });
    expect((await call(accountant, "post", "/finance/collectors", { partnerId: collectorPartner, kind: "cod", version: null })).status).toBe(403);
    const created = await call(chief, "post", "/finance/collectors", { partnerId: collectorPartner, kind: "cod", version: null });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ partnerName: "Giao hàng nhanh thử", kind: "cod", status: "active", version: 0 });
    collector = created.body.id;
    expect((await call(chief, "post", "/finance/collectors", { partnerId: collectorPartner, kind: "gateway", version: null })).body.error.fields).toEqual({
      partnerId: "Đối tác đã là đơn vị thu hộ.",
    });
    const listed = await call(accountant, "get", "/finance/collectors");
    expect(listed.body).toMatchObject({ canSetup: false, canManage: true, collectors: [expect.objectContaining({ id: collector })] });
    expect((await call(seller, "get", "/finance/collectors")).status).toBe(403);
  });
});

describe("CONG_VIEC_19 nhập bảng đối soát", () => {
  beforeAll(async () => {
    // Kế toán đã khởi tạo; hoa hồng tính cho người lập đơn (kiểm tra tiền thu hộ là tiền đã thu).
    expect((await call(chief, "post", "/finance/ledger/setup")).status).toBe(201);
    const settings = (await call(chief, "get", "/finance/commission-settings")).body as { version: number };
    const saved = await call(chief, "put", "/finance/commission-settings", {
      enabled: true,
      startDate: "2026-01-01",
      assignment: "order_creator",
      combination: "matrix",
      defaultPercent: "2",
      tiers: [{ fromPercent: "0", multiplier: "1" }],
      rates: [],
      channelFactors: [],
      version: settings.version,
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const first = await confirmedOrder("10", customer);
    await deliver(first, "10");
    const second = await confirmedOrder("5", customer);
    await deliver(second, "5");
    const number = async (id: string) => (await pool.query<{ document_no: string }>("SELECT document_no FROM sales.orders WHERE id = $1", [id])).rows[0]!.document_no;
    orderOne = { id: first.id, documentNo: await number(first.id) };
    orderTwo = { id: second.id, documentNo: await number(second.id) };
  });

  it("KICHBAN_KIEMTHU_262: tệp mẫu; tệp sai mẫu, sai số tiền bị từ chối; nhập thành công ghép đơn, báo lỗi, cảnh báo, tổng", async () => {
    const template = await accountant.call("get", "/finance/collection-statements/template", { companyId: retail }).responseType("blob");
    expect(template.status).toBe(200);
    expect(
      Buffer.from(template.body as Buffer)
        .subarray(0, 2)
        .toString(),
    ).toBe("PK");
    const fields = { collectorId: collector, statementNo: "GHN-2026-11-01", statementDate: today };
    expect((await upload(accountant, fields, await workbook([["A", orderOne.documentNo, 1, 0, null]], ["Mã", "Đơn"]))).body.error.fields).toEqual({ file: expect.any(String) });
    const invalid = await upload(
      accountant,
      fields,
      await workbook([
        ["V1", orderOne.documentNo, "abc", 0, null],
        ["", orderOne.documentNo, 1, 0, "31/02/2026"],
      ]),
    );
    expect(Object.keys(invalid.body.error.fields).sort()).toEqual(["rows.2.collected", "rows.3.collectedDate", "rows.3.reference"]);
    expect((await upload(seller, fields, await workbook([["V1", orderOne.documentNo, 1, 0, null]]))).status).toBe(403);
    const imported = await upload(
      accountant,
      fields,
      await workbook([
        ["V1", orderOne.documentNo.toLowerCase(), 110000, 16500, "10/11/2026"],
        ["V2", orderTwo.documentNo, "50.000", "16.500", null],
        ["V3", "DBH-KHONG-CO", 20000, 0, null],
        ["V3", orderTwo.documentNo, 0, 22000, null],
      ]),
    );
    expect(imported.status, JSON.stringify(imported.body)).toBe(201);
    expect(imported.body).toMatchObject({
      status: "draft",
      collectorName: "Giao hàng nhanh thử",
      statementNo: "GHN-2026-11-01",
      totalCollected: "180000",
      totalFee: "55000",
      netAmount: "125000",
      lineCount: 4,
      errorCount: 2,
      warningCount: 1,
      canManage: true,
    });
    expect(imported.body.lines.map((line: Record<string, unknown>) => [line.reference, line.orderId !== null, line.customerName, line.orderOpenAmount, line.error, line.amountDiffers])).toEqual([
      ["V1", true, "Khách công nợ", "110000", null, false],
      ["V2", true, "Khách công nợ", "55000", null, true],
      ["V3", false, null, null, "order_not_found", false],
      ["V3", true, "Khách công nợ", "55000", "duplicate_reference", false],
    ]);
    expect(imported.body.lines[0].collectedDate).toBe("2026-11-10");
    const listed = await call(accountant, "get", `/finance/collection-statements?collectorId=${collector}`);
    expect(listed.body).toMatchObject({ total: 1, canManage: true, currency: "VND", data: [expect.objectContaining({ id: imported.body.id, errorCount: 2 })] });
  });

  it("KICHBAN_KIEMTHU_263: bỏ dòng, nhập lại thay các dòng, trùng số bảng bị từ chối, bỏ bảng nháp", async () => {
    const statement = (await call(accountant, "get", `/finance/collection-statements?collectorId=${collector}`)).body.data[0];
    const detail = (await call(accountant, "get", `/finance/collection-statements/${statement.id}`)).body;
    const missing = detail.lines.find((line: { orderId: string | null }) => line.orderId === null);
    const removed = await accountant.call("delete", `/finance/collection-statements/${statement.id}/lines/${missing.id}?version=${detail.version}`, { companyId: retail });
    expect(removed.body).toMatchObject({ lineCount: 3, errorCount: 0, totalCollected: "160000" });
    expect((await accountant.call("delete", `/finance/collection-statements/${statement.id}/lines/${missing.id}?version=${detail.version}`, { companyId: retail })).status).toBe(409);
    const fields = { collectorId: collector, statementNo: "GHN-2026-11-01", statementDate: today };
    // Bảng khác cùng số bảng: từ chối.
    expect((await upload(accountant, fields, await workbook([["V9", orderOne.documentNo, 1, 0, null]]))).body.error.fields).toEqual({ statementNo: "Số bảng đối soát đã có với đơn vị thu hộ này." });
    const reimported = await upload(
      accountant,
      { ...fields, statementId: statement.id, version: String(removed.body.version) },
      await workbook([
        ["V1", orderOne.documentNo, 110000, 16500, null],
        ["V2", orderTwo.documentNo, 55000, 16500, null],
      ]),
    );
    expect(reimported.status, JSON.stringify(reimported.body)).toBe(201);
    expect(reimported.body).toMatchObject({ id: statement.id, lineCount: 2, errorCount: 0, warningCount: 0, netAmount: "132000" });
    // Bảng nháp thứ hai dùng lại mã V1: chưa là lỗi khi bảng kia còn nháp (chỉ tính bảng chờ duyệt, đã ghi sổ); bỏ bảng nháp.
    const second = await upload(accountant, { ...fields, statementNo: "GHN-2026-11-02" }, await workbook([["V1", orderOne.documentNo, 110000, 0, null]]));
    expect(second.body.lines[0].error).toBeNull();
    expect((await call(accountant, "post", `/finance/collection-statements/${second.body.id}/discard`, { version: second.body.version + 1 })).status).toBe(409);
    expect((await call(accountant, "post", `/finance/collection-statements/${second.body.id}/discard`, { version: second.body.version })).status).toBe(204);
    expect((await call(accountant, "get", `/finance/collection-statements/${second.body.id}`)).status).toBe(404);
  });
});

const journalOf = async (statementId: string) =>
  (
    await pool.query<{ code: string; partner_id: string | null; debit: string; credit: string }>(
      `SELECT a.code, l.partner_id, l.debit::text, l.credit::text FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
       JOIN accounting.accounts a ON a.id = l.account_id WHERE j.source_type = 'collection_statement' AND j.source_id = $1 ORDER BY l.line_no`,
      [statementId],
    )
  ).rows.map((row) => [row.code, row.partner_id, Number(row.debit), Number(row.credit)]);
const openOfOrder = async (orderId: string) =>
  Number(
    (
      await pool.query<{ open: string }>(
        `SELECT coalesce(sum(d.open_amount), 0)::text AS open FROM finance.debt_items d JOIN inventory.documents doc ON doc.id = d.source_id
         WHERE d.source_type = 'sales_issue' AND doc.source_id = $1`,
        [orderId],
      )
    ).rows[0]!.open,
  );
const collectorOpen = async () => (await call(accountant, "get", `/finance/debts/open?side=receivable&partnerId=${collectorPartner}`)).body as { advance: string; items: { openAmount: string }[] };

describe("CONG_VIEC_19 gửi, ghi sổ", () => {
  it("KICHBAN_KIEMTHU_264: còn dòng lỗi thì không gửi được; gửi khi chưa có chính sách thì ghi sổ: trừ nợ đơn, nợ đơn vị thu hộ bằng thực nhận, bút toán, hoa hồng", async () => {
    const fields = { collectorId: collector, statementDate: today };
    const broken = await upload(accountant, { ...fields, statementNo: "GHN-LOI" }, await workbook([["E1", "DBH-KHONG-CO", 1000, 0, null]]));
    expect((await call(accountant, "post", `/finance/collection-statements/${broken.body.id}/submit`, { version: broken.body.version })).body.error.message).toBe(
      "Bảng đối soát còn dòng lỗi; bỏ dòng hoặc nhập lại tệp.",
    );
    await call(accountant, "post", `/finance/collection-statements/${broken.body.id}/discard`, { version: broken.body.version });
    const statement = (await call(accountant, "get", `/finance/collection-statements?collectorId=${collector}`)).body.data.find(
      (item: { statementNo: string }) => item.statementNo === "GHN-2026-11-01",
    );
    const detail = (await call(accountant, "get", `/finance/collection-statements/${statement.id}`)).body;
    expect((await call(seller, "post", `/finance/collection-statements/${statement.id}/submit`, { version: detail.version })).status).toBe(403);
    const posted = await call(accountant, "post", `/finance/collection-statements/${statement.id}/submit`, { version: detail.version });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body).toMatchObject({ status: "posted", documentNo: expect.stringMatching(/^DST/), netAmount: "132000", canManage: true });
    expect(posted.body.lines[0]).toMatchObject({ error: null, orderOpenAmount: null, amountDiffers: false });
    expect(await openOfOrder(orderOne.id)).toBe(0);
    expect(await openOfOrder(orderTwo.id)).toBe(0);
    expect((await collectorOpen()).items).toEqual([expect.objectContaining({ openAmount: "132000" })]);
    expect(await journalOf(statement.id)).toEqual([
      ["1388", collectorPartner, 165000, 0],
      ["131", customer, 0, 165000],
      ["6418", null, 33000, 0],
      ["1388", collectorPartner, 0, 33000],
    ]);
    // Tiền thu hộ là tiền đã thu: hoa hồng 2% trên tiền chưa thuế 150.000.
    const events = (
      await pool.query<{ base: string; amount: string }>("SELECT sum(base_amount)::text AS base, sum(amount)::text AS amount FROM finance.commission_events WHERE order_id = ANY($1)", [
        [orderOne.id, orderTwo.id],
      ])
    ).rows[0]!;
    expect([Number(events.base), Number(events.amount)]).toEqual([150000, 3000]);
    // Mã đã ghi sổ: bảng khác dùng lại là lỗi.
    const reused = await upload(accountant, { collectorId: collector, statementNo: "GHN-TRUNG", statementDate: today }, await workbook([["V1", orderOne.documentNo, 1000, 0, null]]));
    expect(reused.body.lines[0].error).toBe("reference_used");
    await call(accountant, "post", `/finance/collection-statements/${reused.body.id}/discard`, { version: reused.body.version });
    // Đã ghi sổ: không sửa, không bỏ dòng, không gửi lại.
    expect((await accountant.call("delete", `/finance/collection-statements/${statement.id}/lines/${posted.body.lines[0].id}?version=${posted.body.version}`, { companyId: retail })).status).toBe(409);
    expect((await call(accountant, "post", `/finance/collection-statements/${statement.id}/submit`, { version: posted.body.version })).status).toBe(409);
  });

  it("KICHBAN_KIEMTHU_265: thu thừa thành tiền trả trước của khách; đơn không có khách chỉ có bút toán; dòng chỉ có phí", async () => {
    const retailOrder = await confirmedOrder("1", null);
    await deliver(retailOrder, "1");
    const retailNo = (await pool.query<{ document_no: string }>("SELECT document_no FROM sales.orders WHERE id = $1", [retailOrder.id])).rows[0]!.document_no;
    const advanceBefore = Number((await call(accountant, "get", `/finance/debts/open?side=receivable&partnerId=${customer}`)).body.advance);
    const imported = await upload(
      accountant,
      { collectorId: collector, statementNo: "GHN-2026-11-03", statementDate: today },
      await workbook([
        ["W1", orderOne.documentNo, 5000, 0, null],
        ["W2", retailNo, 11000, 1000, null],
        ["W3", orderTwo.documentNo, 0, 20000, null],
      ]),
    );
    expect(imported.body).toMatchObject({ errorCount: 0, warningCount: 1, netAmount: "-5000" });
    expect(imported.body.lines[1]).toMatchObject({ customerName: null, orderOpenAmount: null, amountDiffers: false });
    const posted = await call(accountant, "post", `/finance/collection-statements/${imported.body.id}/submit`, { version: imported.body.version });
    expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
    expect(Number((await call(accountant, "get", `/finance/debts/open?side=receivable&partnerId=${customer}`)).body.advance)).toBe(advanceBefore + 5000);
    // Thực nhận âm: giảm nợ đơn vị thu hộ 5.000.
    expect((await collectorOpen()).items).toEqual([expect.objectContaining({ openAmount: "127000" })]);
    expect(await journalOf(imported.body.id)).toEqual([
      ["1388", collectorPartner, 16000, 0],
      ["131", customer, 0, 5000],
      ["131", null, 0, 11000],
      ["6418", null, 21000, 0],
      ["1388", collectorPartner, 0, 21000],
    ]);
  });

  it("KICHBAN_KIEMTHU_266: tiền đơn vị thu hộ chuyển về lập phiếu thu của đơn vị, trừ nợ đơn vị thu hộ", async () => {
    const fund = await call(accountant, "post", "/finance/funds", { code: "NHTH", name: "Ngân hàng thu hộ", kind: "bank", bankName: "ACB", accountNo: "778899", accountHolder: "VCR" });
    const receipt = await call(accountant, "post", "/finance/payments", {
      kind: "customer_receipt",
      partnerId: collectorPartner,
      fundId: fund.body.id,
      paymentDate: today,
      amount: "127000",
      lines: [],
    });
    expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
    expect((await call(accountant, "post", `/finance/payments/${receipt.body.id}/submit`, { version: receipt.body.version })).body.status).toBe("posted");
    expect((await collectorOpen()).items).toEqual([]);
    // Bút toán phiếu thu: Có phải thu đơn vị thu hộ (1388), không phải 131.
    const lines = (
      await pool.query<{ code: string; credit: string }>(
        `SELECT a.code, l.credit::text FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id JOIN accounting.accounts a ON a.id = l.account_id
         WHERE j.source_type = 'payment' AND j.source_id = $1 AND l.credit > 0`,
        [receipt.body.id],
      )
    ).rows;
    expect(lines).toEqual([{ code: "1388", credit: "127000.0000" }]);
  });

  it("KICHBAN_KIEMTHU_267: có chính sách duyệt thì chờ duyệt; rút; gửi lại; duyệt xong ghi sổ", async () => {
    const policy = await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "finance.collection_statement",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.retailAdmin }, substitute: { type: "user", userId: testIds.purchasingManager }, dueHours: 8 }],
      },
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
    const third = await confirmedOrder("2", customer);
    await deliver(third, "2");
    const thirdNo = (await pool.query<{ document_no: string }>("SELECT document_no FROM sales.orders WHERE id = $1", [third.id])).rows[0]!.document_no;
    const imported = await upload(accountant, { collectorId: collector, statementNo: "GHN-2026-11-04", statementDate: today }, await workbook([["X1", thirdNo, 22000, 1000, null]]));
    const pending = await call(accountant, "post", `/finance/collection-statements/${imported.body.id}/submit`, { version: imported.body.version });
    expect(pending.body).toMatchObject({ status: "pending", canWithdraw: true });
    // Tiền trả trước 5.000 của khách (KICHBAN_KIEMTHU_265) đã tự trừ khi giao; bảng chờ duyệt chưa trừ nợ.
    expect(await openOfOrder(third.id)).toBe(17000);
    const withdrawn = await call(accountant, "post", `/finance/collection-statements/${imported.body.id}/withdraw`);
    expect(withdrawn.body).toMatchObject({ status: "withdrawn", canWithdraw: false });
    const again = await call(accountant, "post", `/finance/collection-statements/${imported.body.id}/submit`, { version: withdrawn.body.version });
    expect(again.body).toMatchObject({ status: "pending", documentNo: pending.body.documentNo });
    const requestId = (await pool.query<{ approval_request_id: string }>("SELECT approval_request_id FROM finance.collection_statements WHERE id = $1", [imported.body.id])).rows[0]!
      .approval_request_id;
    const decided = await admin.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "approved", comment: "" } });
    expect(decided.status, JSON.stringify(decided.body)).toBe(200);
    await application.get(OutboxService).dispatchPending();
    expect((await call(accountant, "get", `/finance/collection-statements/${imported.body.id}`)).body.status).toBe("posted");
    expect(await openOfOrder(third.id)).toBe(0);
  });
});

describe("CONG_VIEC_19 sửa lỗi rà soát", () => {
  it("KICHBAN_KIEMTHU_269: người gửi được rút; bảng nháp trùng mã không làm bảng đang chờ duyệt bị từ chối; đọc số tiền", async () => {
    const fourth = await confirmedOrder("1", customer);
    await deliver(fourth, "1");
    const fourthNo = (await pool.query<{ document_no: string }>("SELECT document_no FROM sales.orders WHERE id = $1", [fourth.id])).rows[0]!.document_no;
    // Số tiền: ô số kết quả công thức làm tròn; chữ có dấu tách hàng nghìn.
    const imported = await upload(accountant, { collectorId: collector, statementNo: "GHN-2026-11-05", statementDate: today }, await workbook([["Y1", fourthNo, 11000.0000000001, "1.000", null]]));
    expect(imported.body).toMatchObject({ totalCollected: "11000", totalFee: "1000", errorCount: 0 });
    expect(
      (await upload(accountant, { collectorId: collector, statementNo: "GHN-SO-DAI", statementDate: today }, await workbook([[1234567890123456, fourthNo, 1, 0, null]]))).body.error.fields,
    ).toEqual({
      "rows.2.reference": expect.any(String),
    });
    // Kế toán trưởng gửi bảng do kế toán nhập: kế toán trưởng được rút, kế toán thì không.
    const pending = await call(chief, "post", `/finance/collection-statements/${imported.body.id}/submit`, { version: imported.body.version });
    expect(pending.body).toMatchObject({ status: "pending", canWithdraw: true });
    expect((await call(accountant, "get", `/finance/collection-statements/${imported.body.id}`)).body.canWithdraw).toBe(false);
    expect((await call(accountant, "post", `/finance/collection-statements/${imported.body.id}/withdraw`)).status).toBe(403);
    // Bảng nháp khác cùng mã Y1 không chặn ghi sổ bảng đang chờ duyệt; bảng nháp đó thì có lỗi mã đã dùng.
    const draft = await upload(accountant, { collectorId: collector, statementNo: "GHN-2026-11-06", statementDate: today }, await workbook([["Y1", fourthNo, 11000, 0, null]]));
    expect(draft.body.lines[0].error).toBe("reference_used");
    const requestId = (await pool.query<{ approval_request_id: string }>("SELECT approval_request_id FROM finance.collection_statements WHERE id = $1", [imported.body.id])).rows[0]!
      .approval_request_id;
    expect((await admin.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "approved", comment: "" } })).status).toBe(200);
    await application.get(OutboxService).dispatchPending();
    expect((await call(accountant, "get", `/finance/collection-statements/${imported.body.id}`)).body.status).toBe("posted");
  });
});
