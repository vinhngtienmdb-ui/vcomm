// Dữ liệu thử dùng chung cho kiểm thử bán lẻ tại quầy (CONG_VIEC_53): chi nhánh cửa hàng, kho bán, kênh, quỹ, nhân viên theo vai trò.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { expect } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";

export const retail: string = testIds.retailCompany;

export interface RetailFixture {
  admin: Session;
  storeBranch: string;
  otherStoreBranch: string;
  warehouseId: string;
  otherBranchWarehouse: string;
  retailChannel: string;
  internalChannel: string;
  cashFund: string;
  bankFund: string;
}

export async function assignRetailRole(application: NestExpressApplication, pool: Pool, email: string, name: string, role: string, branchId: string | null, companyId = retail): Promise<Session> {
  const id = await createTestUser(pool, email, name, [{ companyId, branchId: branchId ?? undefined }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    companyId,
    branchId,
  ]);
  return signIn(application, email);
}

export async function createRetailFixture(application: NestExpressApplication, pool: Pool): Promise<RetailFixture> {
  const admin = await signIn(application, "quantri.vcr@vcomm.test");
  const branch = async (code: string, name: string) =>
    (
      await pool.query<{ id: string }>(
        "INSERT INTO core.branches (company_id, code, name, branch_type, province_code, address, phone) VALUES ($1, $2, $3, 'store', '79', '12 Võ Văn Ngân, Thủ Đức', '02838960000') RETURNING id",
        [retail, code, name],
      )
    ).rows[0]!.id;
  const storeBranch = await branch("VCR-TD", "Cửa hàng Thủ Đức");
  const otherStoreBranch = await branch("VCR-Q1", "Cửa hàng Quận 1");
  const warehouse = async (branchId: string, code: string) => {
    const created = await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId, code, name: `Kho ${code}`, usesLocations: false } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.id as string;
  };
  const warehouseId = await warehouse(storeBranch, "KTD");
  const otherBranchWarehouse = await warehouse(otherStoreBranch, "KQ1");
  const channels = (await admin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  const fund = async (body: Record<string, unknown>) => {
    const created = await admin.call("post", "/finance/funds", { companyId: retail, body });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.id as string;
  };
  const cashFund = await fund({ code: "TMTD", name: "Tiền mặt Cửa hàng Thủ Đức", kind: "cash" });
  const bankFund = await fund({ code: "NHTD", name: "Vietcombank Thủ Đức", kind: "bank", bankName: "Vietcombank", accountNo: "0123456789", accountHolder: "VComm Bán lẻ" });
  return {
    admin,
    storeBranch,
    otherStoreBranch,
    warehouseId,
    otherBranchWarehouse,
    retailChannel: channels.find((channel) => channel.code === "BAN_LE")!.id,
    internalChannel: channels.find((channel) => channel.code === "NOI_BO")!.id,
    cashFund,
    bankFund,
  };
}

export const storeBody = (fixture: RetailFixture, extra: Record<string, unknown> = {}) => ({
  branchId: fixture.storeBranch,
  warehouseId: fixture.warehouseId,
  channelId: fixture.retailChannel,
  cashFundId: fixture.cashFund,
  bankFundId: fixture.bankFund,
  vietqrBankBin: "970436",
  vietqrAccountName: "CONG TY VCOMM BAN LE",
  returnDays: 7,
  receiptFooter: "Đổi trả trong 7 ngày kèm hóa đơn này.",
  ...extra,
});

// Hàng hóa, tồn đầu ở kho bán, bảng giá kênh Bán lẻ, khuyến mãi, mức giảm tay 10%, khởi tạo kế toán (dùng chung kiểm thử bán hàng, trả hàng).
// Thuế 10%, giá gồm thuế: Gạo 110.000 (giá vốn 80.000 chưa thuế), Sữa 33.000 (khuyến mãi giảm 10%), Nước rửa chén 22.000 (tặng khi mua 2 Gạo),
// Bánh theo lô 11.000, Điện thoại theo serial 5.500.000.
export async function createRetailCatalog(application: NestExpressApplication, pool: Pool, fixture: RetailFixture, today: string) {
  const admin = fixture.admin;
  const units: Record<string, string> = {};
  const items: Record<string, string> = {};
  const call = (session: Session, method: "get" | "post" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
  const line = (key: string, quantity: string, extra: Record<string, unknown> = {}) => ({ variantId: items[key], unitId: units.CAI, quantity, ...extra });
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "BANLE", nameVi: "Bán lẻ", nameEn: "Retail" } })).body.id;
  const product = async (key: string, name: string, extra: Record<string, unknown> = {}) => {
    const created = await call(admin, "post", "/catalog/products", {
      categoryId,
      name,
      vatRate: "10",
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: units.CAI,
      variants: [{ barcodes: [] }],
      ...extra,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  };
  await product("rice", "Gạo ST25 túi 5kg", { variants: [{ barcodes: [{ unitId: units.CAI, barcode: "8936012345678" }] }] });
  await product("milk", "Sữa tươi tiệt trùng 1L");
  await product("soap", "Nước rửa chén 750ml");
  await product("cake", "Bánh quy bơ", { tracksLots: true });
  await product("phone", "Điện thoại VPhone", { tracksSerials: true });
  await product("repair", "Dịch vụ sửa chữa", { kind: "service" });
  const receipt = await call(admin, "post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId: fixture.warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu cửa hàng",
    lines: [
      line("rice", "10", { unitCost: "80000" }),
      line("milk", "20", { unitCost: "20000" }),
      line("soap", "5", { unitCost: "10000" }),
      line("cake", "2", { unitCost: "5000", lotNo: "L-SOM", expiresOn: "2026-12-01" }),
      line("cake", "10", { unitCost: "6000", lotNo: "L-MUON", expiresOn: "2027-03-01" }),
      line("phone", "3", { unitCost: "4000000", serials: ["IMEI-1", "IMEI-2", "IMEI-3"] }),
    ],
  });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
  expect((await call(admin, "post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const priceList = (await call(admin, "post", "/catalog/price-lists", { code: "BANLE", name: "Giá bán lẻ", includesVat: true, channelId: fixture.retailChannel })).body.id;
  const prices = { rice: "110000", milk: "33000", soap: "22000", cake: "11000", phone: "5500000", repair: "200000" };
  const change = await call(admin, "post", "/catalog/price-changes", {
    priceListId: priceList,
    effectiveFrom: today,
    lines: Object.entries(prices).map(([key, price]) => ({ variantId: items[key], unitId: units.CAI, price })),
  });
  expect((await call(admin, "post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
  const promotion = async (body: Record<string, unknown>) => {
    const created = await call(admin, "post", "/sales/promotions", { validFrom: today, validTo: "2026-12-31", channelIds: [fixture.retailChannel], ...body });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect((await call(admin, "post", `/sales/promotions/${created.body.id}/submit`)).body.status).toBe("active");
  };
  await promotion({ name: "Tuần lễ sữa", kind: "product_discount", items: [{ variantId: items.milk, discountPercent: "10" }] });
  await promotion({ name: "Mua 2 gạo tặng nước rửa chén", kind: "buy_get", buyVariantId: items.rice, buyQuantity: "2", giftVariantId: items.soap, giftQuantity: "1" });
  await call(admin, "put", "/sales/settings", { maxManualDiscountPercent: "10", version: 0 });
  expect((await call(admin, "post", "/finance/ledger/setup")).status).toBe(201);
  return { units, items };
}
