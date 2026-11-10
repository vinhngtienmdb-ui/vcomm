// CONG_VIEC_20: Báo cáo hợp nhất – loại trừ nội bộ (KICHBAN_KIEMTHU_272 trở đi).
// VCR bán cho VCT 24 cái bánh (giá vốn 6.000, giá bán chưa thuế 10.000) = 2 hộp bên VCT; VCT theo Thông tư 133.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let keeper: Session;
let tradingSeller: Session;
let chief: Session;
let today: string;
let sellerWarehouse: string;
let buyerWarehouse: string;
let internalChannelId: string;
let retailChannelId: string;
let retailAsPartner: string;
let tradingAsPartner: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};
const items: Record<string, string> = {};

async function assign(email: string, name: string, role: string, companyId: string, branchId?: string) {
  const id = await createTestUser(pool, email, name, [{ companyId, branchId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    companyId,
    branchId ?? null,
  ]);
  return signIn(application, email);
}
const sell = (session: Session, path: string, body?: unknown, method: "get" | "post" | "put" = body === undefined ? "get" : "post") => session.call(method, path, { companyId: retail, body });
const buy = (session: Session, path: string, body?: unknown, method: "get" | "post" | "put" | "patch" = body === undefined ? "get" : "post") =>
  session.call(method, path, { companyId: trading, body });
const salesBody = (quantity: string, extra: Record<string, unknown> = {}) => ({
  customerId: tradingAsPartner,
  channelId: internalChannelId,
  warehouseId: sellerWarehouse,
  orderDate: today,
  lines: [{ variantId: items.retailBiscuit, unitId: units.CAI, quantity, discountPercent: "0" }],
  ...extra,
});
const purchaseBody = (quantity: string, extra: Record<string, unknown> = {}) => ({
  supplierId: retailAsPartner,
  warehouseId: buyerWarehouse,
  orderDate: today,
  lines: [{ variantId: items.tradingBiscuit, unitId: units.HOP, quantity, unitPrice: "1", vatRate: "0" }],
  ...extra,
});
const reserved = async () => Number((await sell(retailAdmin, `/inventory/stock?warehouseId=${sellerWarehouse}&onlyInStock=false&search=${encodeURIComponent("Bánh nội bộ")}`)).body.data[0].reserved);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  // Công ty thương mại theo Thông tư 133; cả hai công ty khởi tạo kế toán trước khi phát sinh.
  await pool.query("UPDATE core.companies SET accounting_regime = 'TT133' WHERE id = $1", [testIds.tradingCompany]);
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  for (const company of [testIds.retailCompany, testIds.tradingCompany]) expect((await groupAdmin.call("post", "/finance/ledger/setup", { companyId: company })).status).toBe(201);
  const chiefId = await createTestUser(pool, "ketoantruong.hn@vcomm.test", "Kế toán trưởng tập đoàn", [{ companyId: testIds.retailCompany }, { companyId: testIds.tradingCompany }]);
  const chiefRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'chief_accountant' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, valid_from) VALUES ($1, $2, 'group', '2026-01-01')", [chiefId, chiefRole]);
  chief = await signIn(application, "ketoantruong.hn@vcomm.test");
  keeper = await assign("thukho.hn@vcomm.test", "Mạc Văn Hợp", "warehouse_keeper", retail, testIds.binhDuongWarehouse);
  tradingSeller = await assign("banhang.hn@vcomm.test", "Ông Thị Nhất", "salesperson", trading);

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = (companyId: string, code: string) => groupAdmin.call("post", "/catalog/categories", { companyId, body: { code, nameVi: code, nameEn: code } });
  const categoryId = (await category(retail, "BANHHN")).body.id;
  const serialCategoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "MAYHN", nameVi: "MAYHN", nameEn: "MAYHN", tracksSerials: true } })).body.id;
  const product = async (key: string, companyId: string, name: string, baseUnit: string, serial = false) => {
    const created = await groupAdmin.call("post", "/catalog/products", {
      companyId,
      body: {
        categoryId: serial ? serialCategoryId : categoryId,
        name,
        vatRate: "10",
        tracksLots: false,
        tracksSerials: serial,
        warrantyMonths: 0,
        baseUnitId: units[baseUnit],
        variants: [{ barcodes: [] }],
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  };
  await product("retailBiscuit", retail, "Bánh nội bộ", "CAI");
  await product("retailUnlinked", retail, "Bánh chưa liên kết", "CAI");
  await product("tradingBiscuit", trading, "Bánh nội bộ hộp", "HOP");
  await product("retailMachine", retail, "Máy nội bộ", "CAI", true);
  await product("tradingMachine", trading, "Máy nội bộ nhận", "CAI", true);
  expect((await groupAdmin.call("post", "/catalog/variant-links", { companyId: retail, body: { variantId: items.retailMachine, linkedVariantId: items.tradingMachine, factor: "1" } })).status).toBe(
    201,
  );
  // Một hộp bên VCT bằng 12 cái bên VCR.
  const link = await groupAdmin.call("post", "/catalog/variant-links", { companyId: trading, body: { variantId: items.tradingBiscuit, linkedVariantId: items.retailBiscuit, factor: "12" } });
  expect(link.status, JSON.stringify(link.body)).toBe(201);

  sellerWarehouse = (
    await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "HNB", name: "Kho bán hợp nhất", usesLocations: false } })
  ).body.id;
  buyerWarehouse = (
    await retailAdmin.call("post", "/inventory/warehouses", {
      companyId: retail,
      body: { branchId: testIds.binhDuongWarehouse, code: "HNM", name: "Kho nhận hợp nhất", usesLocations: false, ownerCompanyIds: [trading] },
    })
  ).body.id;
  const receipt = await retailAdmin.call("post", "/inventory/documents", {
    companyId: retail,
    body: {
      type: "receipt_other",
      warehouseId: sellerWarehouse,
      companyId: retail,
      documentDate: today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [
        { variantId: items.retailBiscuit, unitId: units.CAI, quantity: "500", unitCost: "6000" },
        { variantId: items.retailUnlinked, unitId: units.CAI, quantity: "10", unitCost: "6000" },
        { variantId: items.retailMachine, unitId: units.CAI, quantity: "3", unitCost: "2000000", serials: ["MAY-01", "MAY-02", "MAY-03"] },
      ],
    },
  });
  expect((await retailAdmin.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");

  // Kênh Nội bộ của VCR, bảng giá Nội bộ chưa thuế 10.000 một cái; bảng giá chung bán lẻ.
  const channels = (await retailAdmin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  internalChannelId = channels.find((channel) => channel.code === "NOI_BO")!.id;
  retailChannelId = channels.find((channel) => channel.code === "BAN_LE")!.id;
  const priceList = async (code: string, extra: Record<string, unknown>) =>
    (await retailAdmin.call("post", "/catalog/price-lists", { companyId: retail, body: { code, name: code, ...extra } })).body.id as string;
  const price = async (priceListId: string, lines: Record<string, unknown>[]) => {
    const draft = await retailAdmin.call("post", "/catalog/price-changes", { companyId: retail, body: { priceListId, effectiveFrom: today, lines } });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    expect((await retailAdmin.call("post", `/catalog/price-changes/${draft.body.id}/submit`, { companyId: retail })).status).toBe(201);
  };
  await price(await priceList("NB", { includesVat: false, channelId: internalChannelId }), [
    { variantId: items.retailBiscuit, unitId: units.CAI, price: "10000" },
    { variantId: items.retailUnlinked, unitId: units.CAI, price: "10000" },
    { variantId: items.retailMachine, unitId: units.CAI, price: "3000000" },
  ]);
  await price(await priceList("LE", { includesVat: true }), [{ variantId: items.retailBiscuit, unitId: units.CAI, price: "15000" }]);

  // Đối tác nội bộ tự đồng bộ khi khởi động; hồ sơ khách hàng ở VCR, nhà cung cấp ở VCT.
  const partnerOf = async (companyId: string) => (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [companyId])).rows[0]!.id;
  retailAsPartner = await partnerOf(retail);
  tradingAsPartner = await partnerOf(trading);
  const profile = async (companyId: string, partnerId: string, body: Record<string, unknown>) => {
    const saved = await groupAdmin.call("put", `/crm/partners/${partnerId}/profile`, {
      companyId,
      body: { isCustomer: false, isSupplier: false, paymentTermDays: 30, creditLimit: null, version: 0, ...body },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  };
  await profile(retail, tradingAsPartner, { isCustomer: true });
  await profile(trading, retailAsPartner, { isSupplier: true });
});

// Bán nội bộ đã có đơn mua đối ứng được duyệt; trả về đơn bán và phiếu xuất đã ghi sổ.
async function shipped(lines: { variantId: string | undefined; quantity: string; serials?: string[] }[]) {
  const created = await sell(
    retailAdmin,
    "/sales/orders",
    salesBody("1", { lines: lines.map((line) => ({ variantId: line.variantId, unitId: units.CAI, quantity: line.quantity, discountPercent: "0" })) }),
  );
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const order = (await sell(retailAdmin, `/sales/orders/${created.body.id}/submit`, {})).body;
  const purchase = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM purchasing.orders WHERE counterpart_order_id = $1", [order.id])).rows[0]!;
  expect((await buy(groupAdmin, `/purchasing/orders/${purchase.id}/counterpart-confirm`, { warehouseId: buyerWarehouse, version: purchase.version })).body.status).toBe("approved");
  const draft = await keeper.call("post", "/inventory/sales-issues", {
    companyId: retail,
    body: {
      orderId: order.id,
      documentDate: today,
      lines: lines.map((line, index) => ({ orderLineId: order.lines[index].id, quantity: line.quantity, serials: line.serials ?? [] })),
    },
  });
  expect(draft.status, JSON.stringify(draft.body)).toBe(201);
  const issue = (await keeper.call("post", `/inventory/documents/${draft.body.id}/submit`, { companyId: retail })).body;
  expect(issue.status, JSON.stringify(issue)).toBe("posted");
  const receiptId = (await pool.query<{ id: string }>("SELECT id FROM inventory.documents WHERE counterpart_document_id = $1", [issue.id])).rows[0]!.id;
  return { order, purchaseId: purchase.id, issue, receipt: (await buy(groupAdmin, `/inventory/documents/${receiptId}`)).body };
}
afterAll(async () => {
  await application?.close();
});

type Line = { code: string; combined: string; eliminations: string; consolidated: string };
type Detail = {
  id: string;
  version: number;
  status: string;
  warnings: { receivable: string; payable: string; difference: string }[];
  entries: { entryNo: number; kind: string; lines: { accountCode: string; debit: string; credit: string }[] }[];
  profitLines: { id: string; internalQuantity: string; endingQuantity: string; unitMargin: string; estimatedAmount: string; effectiveAmount: string }[];
  balanceSheet: { lines: Line[] };
  incomeStatement: { lines: Line[] };
  canEdit: boolean;
};
const line = (lines: Line[], code: string) => lines.find((item) => item.code === code)!;
const group = (method: "get" | "post" | "put" | "delete", path: string, body?: unknown) => chief.call(method, path, { companyId: retail, body });

describe("CONG_VIEC_20 loại trừ nội bộ", () => {
  let consolidation: Detail;
  beforeAll(async () => {
    const { receipt } = await shipped([{ variantId: items.retailBiscuit, quantity: "24" }]);
    const received = await buy(groupAdmin, `/inventory/internal-receipts/${receipt.id}/receive`, { lines: [{ lineId: receipt.lines[0].id, receivedQuantity: "2" }], version: receipt.version });
    expect(received.body.status, JSON.stringify(received.body)).toBe("posted");
    // VCT trả 100.000 cho VCR, VCR chưa ghi nhận: lệch công nợ nội bộ.
    const fund = await buy(groupAdmin, "/finance/funds", { code: "TMHN", name: "Tiền mặt", kind: "cash", openingBalance: "1000000" });
    // Vốn góp bằng tiền mặt ghi sổ cái để tiền mặt không âm.
    const account = async (code: string) => (await pool.query<{ id: string }>("SELECT id FROM accounting.accounts WHERE company_id = $1 AND code = $2", [trading, code])).rows[0]!.id;
    const capital = await buy(groupAdmin, "/finance/journals", {
      journalDate: today,
      description: "Vốn góp",
      lines: [
        { accountId: await account("1111"), debit: "1000000", credit: "0" },
        { accountId: await account("4111"), debit: "0", credit: "1000000" },
      ],
    });
    expect(capital.status, JSON.stringify(capital.body)).toBe(201);
    expect((await buy(groupAdmin, `/finance/journals/${capital.body.id}/submit`, { version: capital.body.version })).body.status).toBe("posted");
    const payment = await buy(groupAdmin, "/finance/payments", { kind: "supplier_payment", partnerId: retailAsPartner, fundId: fund.body.id, paymentDate: today, amount: "100000", lines: [] });
    expect(payment.status, JSON.stringify(payment.body)).toBe(201);
    expect((await buy(groupAdmin, `/finance/payments/${payment.body.id}/submit`, { version: payment.body.version })).body.status).toBe("posted");
  });

  it("KICHBAN_KIEMTHU_272: lập bảng hợp nhất: loại trừ công nợ nội bộ phần nhỏ hơn, cảnh báo chênh lệch; loại trừ doanh thu, giá vốn nội bộ; lãi chưa thực hiện ước tính", async () => {
    expect((await groupAdmin.call("post", "/finance/consolidation", { companyId: retail, body: { from: today, to: today } })).status).toBe(201);
    await pool.query("DELETE FROM finance.consolidations");
    const created = await group("post", "/finance/consolidation", { from: today, to: today });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    consolidation = created.body;
    expect((await group("post", "/finance/consolidation", { from: today, to: today })).status).toBe(409);
    // Công nợ: VCR phải thu VCT 264.000, VCT phải trả VCR 164.000.
    expect(consolidation.warnings).toEqual([expect.objectContaining({ receivable: "264000", payable: "164000", difference: "100000" })]);
    const kinds = consolidation.entries.map((entry) => [entry.kind, entry.lines.map((item) => [item.accountCode, item.debit, item.credit])]);
    expect(kinds).toEqual([
      [
        "intercompany_balance",
        [
          ["331", "164000", "0"],
          ["131", "0", "164000"],
        ],
      ],
      [
        "internal_sales",
        [
          ["511", "240000", "0"],
          ["632", "0", "240000"],
        ],
      ],
      [
        "unrealized_profit",
        [
          ["632", "96000", "0"],
          ["156", "0", "96000"],
        ],
      ],
    ]);
    expect(consolidation.profitLines).toEqual([expect.objectContaining({ internalQuantity: "2", endingQuantity: "2", unitMargin: "48000", estimatedAmount: "96000", effectiveAmount: "96000" })]);
    const income = consolidation.incomeStatement.lines;
    expect(line(income, "01")).toMatchObject({ combined: "240000", eliminations: "-240000", consolidated: "0" });
    expect(line(income, "11")).toMatchObject({ combined: "144000", eliminations: "-144000", consolidated: "0" });
    const sheet = consolidation.balanceSheet.lines;
    expect(line(sheet, "280").consolidated).toBe(line(sheet, "440").consolidated);
    expect(line(sheet, "141")).toMatchObject({ eliminations: "-96000" });
  });

  it("KICHBAN_KIEMTHU_273: sửa lãi chưa thực hiện cần lý do, tính lại giữ số đã sửa; điều chỉnh tay phải cân Nợ Có; xóa điều chỉnh tay; không có quyền tập đoàn bị từ chối", async () => {
    const profit = consolidation.profitLines[0]!;
    expect((await group("put", `/finance/consolidation/${consolidation.id}/profit-lines/${profit.id}`, { amount: "90000", reason: null, version: consolidation.version })).status).toBe(400);
    const edited = await group("put", `/finance/consolidation/${consolidation.id}/profit-lines/${profit.id}`, { amount: "90000", reason: "Giảm giá hàng tồn", version: consolidation.version });
    expect(edited.body.profitLines[0]).toMatchObject({ estimatedAmount: "96000", effectiveAmount: "90000" });
    const again = await group("post", `/finance/consolidation/${consolidation.id}/recalculate`, { version: edited.body.version });
    expect(again.body.profitLines[0]).toMatchObject({ effectiveAmount: "90000" });
    expect(
      (
        await group("post", `/finance/consolidation/${consolidation.id}/entries`, {
          description: "Lệch",
          lines: [
            { accountCode: "3388", debit: "100", credit: "0" },
            { accountCode: "1388", debit: "0", credit: "90" },
          ],
          version: again.body.version,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await group("post", `/finance/consolidation/${consolidation.id}/entries`, {
          description: "Sai mã",
          lines: [
            { accountCode: "9999", debit: "100", credit: "0" },
            { accountCode: "1388", debit: "0", credit: "100" },
          ],
          version: again.body.version,
        })
      ).status,
    ).toBe(400);
    const manual = await group("post", `/finance/consolidation/${consolidation.id}/entries`, {
      description: "Ghi nhận tiền đang chuyển nội bộ",
      lines: [
        { accountCode: "113", debit: "100000", credit: "0" },
        { accountCode: "131", debit: "0", credit: "100000" },
      ],
      version: again.body.version,
    });
    expect(manual.status, JSON.stringify(manual.body)).toBe(201);
    const entry = manual.body.entries.find((item: { kind: string }) => item.kind === "manual");
    expect(entry.lines.map((item: { accountCode: string }) => item.accountCode)).toEqual(["113", "131"]);
    expect(line(manual.body.balanceSheet.lines, "280").consolidated).toBe(line(manual.body.balanceSheet.lines, "440").consolidated);
    const removed = await chief.call("delete", `/finance/consolidation/${consolidation.id}/entries/${entry.entryNo}?version=${manual.body.version}`, { companyId: retail });
    expect(removed.body.entries.some((item: { kind: string }) => item.kind === "manual")).toBe(false);
    expect((await retailAdmin.call("get", `/finance/consolidation/${consolidation.id}`, { companyId: retail })).status).toBe(403);
    consolidation = removed.body;
  });
});

describe("CONG_VIEC_20 gửi, chốt số, xuất", () => {
  it("KICHBAN_KIEMTHU_274: chưa có chính sách duyệt thì gửi là chốt số; số đã chốt không đổi khi sổ thay đổi; không sửa, không tính lại; xuất Excel, PDF", async () => {
    const current = (await group("get", "/finance/consolidation")).body.data[0];
    const detail = (await group("get", `/finance/consolidation/${current.id}`)).body as Detail;
    const posted = await group("post", `/finance/consolidation/${detail.id}/submit`, { version: detail.version });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body).toMatchObject({ status: "posted", documentNo: expect.stringMatching(/^HN/), canEdit: false });
    const frozen = line(posted.body.balanceSheet.lines, "280").consolidated;
    // Sổ VCR thay đổi sau khi chốt: bảng đã chốt giữ nguyên số.
    const account = async (code: string) => (await pool.query<{ id: string }>("SELECT id FROM accounting.accounts WHERE company_id = $1 AND code = $2", [retail, code])).rows[0]!.id;
    const extra = await sell(groupAdmin, "/finance/journals", {
      journalDate: today,
      description: "Sau chốt",
      lines: [
        { accountId: await account("111"), debit: "5000", credit: "0" },
        { accountId: await account("41111"), debit: "0", credit: "5000" },
      ],
    });
    expect((await sell(groupAdmin, `/finance/journals/${extra.body.id}/submit`, { version: extra.body.version })).body.status).toBe("posted");
    expect(line((await group("get", `/finance/consolidation/${detail.id}`)).body.balanceSheet.lines, "280").consolidated).toBe(frozen);
    expect((await group("post", `/finance/consolidation/${detail.id}/recalculate`, { version: posted.body.version })).status).toBe(409);
    const excel = await chief.call("get", `/finance/consolidation/${detail.id}/export?kind=balance_sheet&format=xlsx`, { companyId: retail }).responseType("blob");
    expect(excel.status).toBe(200);
    expect(
      Buffer.from(excel.body as Buffer)
        .subarray(0, 2)
        .toString(),
    ).toBe("PK");
    const pdf = await chief.call("get", `/finance/consolidation/${detail.id}/export?kind=income_statement&format=pdf`, { companyId: retail }).responseType("blob");
    expect(
      Buffer.from(pdf.body as Buffer)
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
  });

  it("KICHBAN_KIEMTHU_275: có chính sách duyệt của công ty gốc thì chờ duyệt; người gửi rút; gửi lại giữ số; duyệt xong chốt số", async () => {
    const policy = await groupAdmin.call("post", "/approval-policies", {
      companyId: testIds.groupCompany,
      body: {
        documentTypeCode: "finance.consolidation",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.groupAdmin }, substitute: { type: "user", userId: testIds.exchangeRateManager }, dueHours: 8 }],
      },
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
    const created = (await group("post", "/finance/consolidation", { from: "2026-01-01", to: today })).body as Detail;
    const pending = await group("post", `/finance/consolidation/${created.id}/submit`, { version: created.version });
    expect(pending.body).toMatchObject({ status: "pending", canWithdraw: true, canEdit: false });
    const withdrawn = await group("post", `/finance/consolidation/${created.id}/withdraw`);
    expect(withdrawn.body).toMatchObject({ status: "withdrawn", canEdit: true });
    const again = await group("post", `/finance/consolidation/${created.id}/submit`, { version: withdrawn.body.version });
    expect(again.body).toMatchObject({ status: "pending", documentNo: pending.body.documentNo });
    const requestId = (await pool.query<{ approval_request_id: string }>("SELECT approval_request_id FROM finance.consolidations WHERE id = $1", [created.id])).rows[0]!.approval_request_id;
    const decided = await groupAdmin.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "approved", comment: "" } });
    expect(decided.status, JSON.stringify(decided.body)).toBe(200);
    await application.get(OutboxService).dispatchPending();
    expect((await group("get", `/finance/consolidation/${created.id}`)).body.status).toBe("posted");
  });
});
