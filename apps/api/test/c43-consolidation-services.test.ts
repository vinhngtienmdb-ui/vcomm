// CONG_VIEC_43 lát L4: báo cáo hợp nhất loại trừ dịch vụ nội bộ theo cặp Nợ doanh thu dịch vụ bên bán / Có chi phí dịch vụ bên mua (quyết định người dùng 2026-11-11).
// VComm Bán lẻ (VCR, Thông tư 99: 511, 6427) bán VComm Thương mại (VCT, Thông tư 133: 5113, 6422) 2 × 500.000 dịch vụ; VCT bán VCR 1 × 300.000 dịch vụ.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let chief: Session;
let today: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};
const items: Record<string, string> = {};
const warehouses: Record<string, string> = {};
const channels: Record<string, string> = {};
const partners: Record<string, string> = {};

type Line = { code: string; combined: string; eliminations: string; consolidated: string };
type Detail = {
  entries: { kind: string; lines: { accountCode: string; debit: string; credit: string }[] }[];
  profitLines: unknown[];
  incomeStatement: { lines: Line[] };
  balanceSheet: { lines: Line[] };
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  await pool.query("UPDATE core.companies SET accounting_regime = 'TT133' WHERE id = $1", [trading]);
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  for (const company of [retail, trading]) expect((await groupAdmin.call("post", "/finance/ledger/setup", { companyId: company })).status).toBe(201);
  const chiefId = await createTestUser(pool, "ketoantruong.dv@vcomm.test", "Kế toán trưởng dịch vụ", [{ companyId: retail }, { companyId: trading }]);
  const chiefRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'chief_accountant' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, valid_from) VALUES ($1, $2, 'group', '2026-01-01')", [chiefId, chiefRole]);
  chief = await signIn(application, "ketoantruong.dv@vcomm.test");

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "DVHN", nameVi: "DVHN", nameEn: "DVHN" } })).body.id;
  const product = async (key: string, companyId: string, name: string) => {
    const created = await groupAdmin.call("post", "/catalog/products", {
      companyId,
      body: { categoryId, name, kind: "service", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units.CAI, variants: [{ barcodes: [] }] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  };
  await product("retailService", retail, "Dịch vụ kế toán");
  await product("tradingService", trading, "Dịch vụ kế toán nhận");
  expect((await groupAdmin.call("post", "/catalog/variant-links", { companyId: retail, body: { variantId: items.retailService, linkedVariantId: items.tradingService, factor: "1" } })).status).toBe(
    201,
  );

  warehouses[retail] = (
    await groupAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "DVR", name: "Kho VCR", usesLocations: false } })
  ).body.id;
  warehouses[trading] = (
    await groupAdmin.call("post", "/inventory/warehouses", {
      companyId: retail,
      body: { branchId: testIds.binhDuongWarehouse, code: "DVT", name: "Kho VCT", usesLocations: false, ownerCompanyIds: [trading] },
    })
  ).body.id;
  const prices: [string, string, string][] = [
    [retail, items.retailService!, "500000"],
    [trading, items.tradingService!, "300000"],
  ];
  for (const [companyId, variantId, price] of prices) {
    const created = (await groupAdmin.call("post", "/catalog/sales-channels/defaults", { companyId })).body as { id: string; code: string }[];
    channels[companyId] = created.find((channel) => channel.code === "NOI_BO")!.id;
    const priceListId = (await groupAdmin.call("post", "/catalog/price-lists", { companyId, body: { code: "NBDV", name: "NBDV", includesVat: false, channelId: channels[companyId] } })).body.id;
    const draft = await groupAdmin.call("post", "/catalog/price-changes", { companyId, body: { priceListId, effectiveFrom: today, lines: [{ variantId, unitId: units.CAI, price }] } });
    expect((await groupAdmin.call("post", `/catalog/price-changes/${draft.body.id}/submit`, { companyId })).status).toBe(201);
  }
  for (const companyId of [retail, trading]) partners[companyId] = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [companyId])).rows[0]!.id;
  // Mỗi công ty vừa là khách hàng, vừa là nhà cung cấp của công ty kia.
  for (const [companyId, other] of [
    [retail, trading],
    [trading, retail],
  ] as const) {
    const saved = await groupAdmin.call("put", `/crm/partners/${partners[other]}/profile`, {
      companyId,
      body: { isCustomer: true, isSupplier: true, paymentTermDays: 30, creditLimit: null, version: 0 },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  }

  // Bán dịch vụ nội bộ hai chiều; bên mua xác nhận đơn mua đối ứng thì hai bên lập phiếu dịch vụ, ghi sổ.
  const sellService = async (seller: string, buyer: string, variantId: string, quantity: string) => {
    const created = await groupAdmin.call("post", "/sales/orders", {
      companyId: seller,
      body: { customerId: partners[buyer], channelId: channels[seller], warehouseId: warehouses[seller], orderDate: today, lines: [{ variantId, unitId: units.CAI, quantity, discountPercent: "0" }] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect((await groupAdmin.call("post", `/sales/orders/${created.body.id}/submit`, { companyId: seller, body: {} })).body.status).toBe("confirmed");
    const purchase = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM purchasing.orders WHERE counterpart_order_id = $1", [created.body.id])).rows[0]!;
    const confirmed = await groupAdmin.call("post", `/purchasing/orders/${purchase.id}/counterpart-confirm`, { companyId: buyer, body: { warehouseId: warehouses[buyer], version: purchase.version } });
    expect(confirmed.body.status, JSON.stringify(confirmed.body)).toBe("received");
  };
  await sellService(retail, trading, items.retailService!, "2");
  await sellService(trading, retail, items.tradingService!, "1");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_43 lát L4: hợp nhất loại trừ dịch vụ nội bộ", () => {
  it("loại trừ Nợ doanh thu dịch vụ bên bán / Có chi phí dịch vụ bên mua theo số tiền giao dịch (TT99 511, 6427; TT133 5113, 6422); không giá vốn, không lãi chưa thực hiện", async () => {
    const created = await chief.call("post", "/finance/consolidation", { companyId: retail, body: { from: today, to: today } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const consolidation = created.body as Detail;
    const services = consolidation.entries
      .filter((entry) => entry.kind === "internal_sales")
      .map((entry) => entry.lines.map((item) => [item.accountCode, item.debit, item.credit]))
      .sort((left, right) => left[0]![0]!.localeCompare(right[0]![0]!));
    expect(services).toEqual([
      [
        ["511", "1000000", "0"],
        // 6422 của VCT (TT133) hiện theo hệ thống tài khoản hợp nhất (TT99) là 642.
        ["642", "0", "1000000"],
      ],
      [
        ["5113", "300000", "0"],
        ["6427", "0", "300000"],
      ],
    ]);
    // Phiếu dịch vụ không vào phần hàng hóa: không dòng giá vốn, không lãi chưa thực hiện.
    expect(consolidation.entries.flatMap((entry) => entry.lines).some((item) => item.accountCode === "632" || item.accountCode === "156")).toBe(false);
    expect(consolidation.entries.some((entry) => entry.kind === "unrealized_profit")).toBe(false);
    expect(consolidation.profitLines).toEqual([]);
    // Doanh thu bán hàng và cung cấp dịch vụ hợp nhất còn 0; giá vốn không đổi.
    const income = consolidation.incomeStatement.lines;
    expect(income.find((item) => item.code === "01")).toMatchObject({ combined: "1300000", eliminations: "-1300000", consolidated: "0" });
    expect(income.find((item) => item.code === "11")).toMatchObject({ eliminations: "0" });
    expect(income.find((item) => item.code === "26")).toMatchObject({ combined: "1300000", eliminations: "-1300000", consolidated: "0" });
    const sheet = consolidation.balanceSheet.lines;
    expect(sheet.find((item) => item.code === "280")!.consolidated).toBe(sheet.find((item) => item.code === "440")!.consolidated);
  });
});
