// CONG_VIEC_05 lát L3: kiểm kê (TIEUCHI_NGHIEMTHU_70; KICHBAN_KIEMTHU_155, 156).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let approver: Session;
const retail: string = testIds.retailCompany;
const units: Record<string, string> = {};
const items: Record<string, string> = {};
const categories: Record<string, string> = {};
let warehouseId: string;
let today: string;

const document = (type: string, reasonCode: string, lines: Record<string, unknown>[]) => ({ type, warehouseId, companyId: retail, documentDate: today, reasonCode, reason: "Kiểm thử kiểm kê", lines });
async function submitted(payload: unknown) {
  const created = await retailAdmin.call("post", "/inventory/documents", { companyId: retail, body: payload });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return retailAdmin.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail });
}
const stock = async (search: string) => (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=${search}`, { companyId: retail })).body.data[0];

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  for (const [code, extra] of [
    ["NUOCKK", {}],
    ["SUAKK", { tracksLots: true }],
    ["DTKK", { tracksSerials: true }],
  ] as const) {
    categories[code] = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: code, nameEn: code, ...extra } })).body.id;
  }
  const product = async (key: string, categoryId: string, baseUnit: string, extra: Record<string, unknown> = {}) => {
    const created = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId, name: key, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units[baseUnit], variants: [{ barcodes: [] }], ...extra },
    });
    items[key] = created.body.variants[0].id;
  };
  await product("water", categories.NUOCKK!, "CHAI");
  await product("milk", categories.SUAKK!, "HOP", { tracksLots: true });
  await product("phone", categories.DTKK!, "CAI", { tracksSerials: true });
  warehouseId = (await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "KK1", name: "Kho kiểm kê", usesLocations: false } }))
    .body.id;
  const opening = await submitted(
    document("receipt_other", "opening_balance", [
      { variantId: items.water, unitId: units.CHAI, quantity: "100", unitCost: "1000" },
      { variantId: items.milk, unitId: units.HOP, quantity: "20", unitCost: "5000", lotNo: "KK-L1", expiresOn: "2099-01-01" },
      { variantId: items.phone, unitId: units.CAI, quantity: "2", unitCost: "2000000", serials: ["KK-P1", "KK-P2"] },
    ]),
  );
  expect(opening.body.status).toBe("posted");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_70: kiểm kê khóa mặt hàng đang kiểm, chênh lệch sinh phiếu điều chỉnh", () => {
  it("KICHBAN_KIEMTHU_155: kiểm theo ngành hàng: mặt hàng trong phạm vi bị khóa, ngoài phạm vi vẫn ghi sổ; kết thúc sinh phiếu điều chỉnh, ghi người chịu trách nhiệm", async () => {
    const created = await retailAdmin.call("post", "/inventory/stocktakes", { companyId: retail, body: { warehouseId, companyId: retail, scopeType: "categories", scopeIds: [categories.NUOCKK] } });
    expect(created.body).toMatchObject({ status: "draft", lineCount: 0 });
    const started = await retailAdmin.call("post", `/inventory/stocktakes/${created.body.id}/start`, { companyId: retail });
    expect(started.body).toMatchObject({ status: "counting", stocktakeNo: expect.stringMatching(/^KK-VCR-/), lineCount: 1 });
    expect(started.body.lines[0]).toMatchObject({ systemQuantity: "100", countedQuantity: null, unitCost: "1000" });

    // Không chạy song song hai lần kiểm kê trùng mặt hàng.
    const overlapping = await retailAdmin.call("post", "/inventory/stocktakes", { companyId: retail, body: { warehouseId, companyId: retail, scopeType: "full" } });
    expect((await retailAdmin.call("post", `/inventory/stocktakes/${overlapping.body.id}/start`, { companyId: retail })).body.error.message).toBe(
      "Đang có lần kiểm kê khác kiểm cùng mặt hàng, vị trí.",
    );
    expect((await retailAdmin.call("post", `/inventory/stocktakes/${overlapping.body.id}/cancel`, { companyId: retail })).body.status).toBe("cancelled");
    const locked = await submitted(document("issue_other", "internal_use", [{ variantId: items.water, unitId: units.CHAI, quantity: "1" }]));
    expect(locked.status).toBe(409);
    expect(locked.body.error.message).toBe("Mặt hàng đang kiểm kê, chưa ghi sổ được.");
    const lot = (await retailAdmin.call("get", `/inventory/documents/lot-suggestions?warehouseId=${warehouseId}&companyId=${retail}&variantId=${items.milk}`, { companyId: retail })).body[0].lotId;
    expect((await submitted(document("issue_other", "internal_use", [{ variantId: items.milk, unitId: units.HOP, quantity: "2", lotId: lot }]))).body.status).toBe("posted");

    expect((await retailAdmin.call("post", `/inventory/stocktakes/${created.body.id}/finish`, { companyId: retail, body: { version: started.body.version } })).status).toBe(409);
    const counted = await retailAdmin.call("put", `/inventory/stocktakes/${created.body.id}/counts`, {
      companyId: retail,
      body: { counts: [{ lineId: started.body.lines[0].id, countedQuantity: "97" }] },
    });
    expect(counted.body.lines[0]).toMatchObject({ countedQuantity: "97", difference: "-3", differenceValue: "-3000" });
    const finished = await retailAdmin.call("post", `/inventory/stocktakes/${created.body.id}/finish`, {
      companyId: retail,
      body: { version: counted.body.version, responsibilities: [{ lineId: counted.body.lines[0].id, responsibleUserId: testIds.warehouseKeeper }] },
    });
    expect(finished.status, JSON.stringify(finished.body)).toBe(201);
    expect(finished.body).toMatchObject({ status: "finished", adjustmentDocumentNo: expect.stringMatching(/^DCK-VCR-/) });
    const adjustment = (await retailAdmin.call("get", `/inventory/documents/${finished.body.adjustmentDocumentId}`, { companyId: retail })).body;
    expect(adjustment).toMatchObject({ status: "posted", reasonCode: "stocktake", canEdit: false, stocktakeId: created.body.id });
    expect(adjustment.lines[0]).toMatchObject({ quantity: "-3", responsibleUserId: testIds.warehouseKeeper, compensationAmount: "3000" });
    expect(await stock("water")).toMatchObject({ onHand: "97" });
    expect((await retailAdmin.call("post", `/inventory/stocktakes/${created.body.id}/cancel`, { companyId: retail })).status).toBe(409);
    // Hàng theo lô: dòng không có lô không ghi số đếm được, phải đếm theo lô đã có.
    const milkCount = await retailAdmin.call("post", "/inventory/stocktakes", { companyId: retail, body: { warehouseId, companyId: retail, scopeType: "variants", scopeIds: [items.milk] } });
    const milkStarted = await retailAdmin.call("post", `/inventory/stocktakes/${milkCount.body.id}/start`, { companyId: retail });
    expect(milkStarted.body.lines.map((line: { lotNo: string | null }) => line.lotNo)).toEqual(["KK-L1"]);
    const noLot = await retailAdmin.call("put", `/inventory/stocktakes/${milkCount.body.id}/counts`, { companyId: retail, body: { counts: [{ variantId: items.milk, countedQuantity: "3" }] } });
    expect(noLot.body.error.fields).toEqual({ "counts.0.lotId": "Hàng theo lô: ghi số đếm theo lô đã có; lô mới nhập bằng phiếu nhập khác." });
    expect((await retailAdmin.call("post", `/inventory/stocktakes/${milkCount.body.id}/cancel`, { companyId: retail })).body.status).toBe("cancelled");
    // Kết thúc thì hết khóa.
    expect((await submitted(document("issue_other", "internal_use", [{ variantId: items.water, unitId: units.CHAI, quantity: "1" }]))).body.status).toBe("posted");
  });

  it("KICHBAN_KIEMTHU_156: kiểm theo danh sách sản phẩm có serial: thiếu serial, thừa serial; có chính sách duyệt thì tồn chỉ đổi sau khi duyệt", async () => {
    const response = await retailAdmin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "inventory.adjustment",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect(response.status).toBe(201);
    const created = await retailAdmin.call("post", "/inventory/stocktakes", { companyId: retail, body: { warehouseId, companyId: retail, scopeType: "variants", scopeIds: [items.phone] } });
    const started = await retailAdmin.call("post", `/inventory/stocktakes/${created.body.id}/start`, { companyId: retail });
    const line = started.body.lines[0];
    expect(line).toMatchObject({ systemQuantity: "2", tracksSerials: true });
    expect((await retailAdmin.call("put", `/inventory/stocktakes/${created.body.id}/counts`, { companyId: retail, body: { counts: [{ lineId: line.id, countedQuantity: "2" }] } })).status).toBe(400);
    const counted = await retailAdmin.call("put", `/inventory/stocktakes/${created.body.id}/counts`, {
      companyId: retail,
      body: { counts: [{ lineId: line.id, countedQuantity: "2", serials: ["KK-P1", "KK-P3"] }] },
    });
    const finished = await retailAdmin.call("post", `/inventory/stocktakes/${created.body.id}/finish`, { companyId: retail, body: { version: counted.body.version } });
    expect(finished.status, JSON.stringify(finished.body)).toBe(201);
    const adjustment = (await retailAdmin.call("get", `/inventory/documents/${finished.body.adjustmentDocumentId}`, { companyId: retail })).body;
    expect(adjustment.status).toBe("pending");
    expect(adjustment.lines.map((item: { quantity: string; serials: string[] }) => [item.quantity, item.serials])).toEqual([
      ["-1", ["KK-P2"]],
      ["1", ["KK-P3"]],
    ]);
    expect((await pool.query("SELECT serial_no FROM inventory.serials WHERE status = 'in_stock' AND serial_no LIKE 'KK-%' ORDER BY serial_no")).rows.map((row) => row.serial_no)).toEqual([
      "KK-P1",
      "KK-P2",
    ]);
    await approver.call("post", `/approval-requests/${adjustment.approvalRequestId}/decisions`, { body: { decision: "approved" } });
    await application.get(OutboxService).dispatchPending();
    expect((await pool.query("SELECT serial_no FROM inventory.serials WHERE status = 'in_stock' AND serial_no LIKE 'KK-%' ORDER BY serial_no")).rows.map((row) => row.serial_no)).toEqual([
      "KK-P1",
      "KK-P3",
    ]);
    expect(await stock("phone")).toMatchObject({ onHand: "2" });
  });
});
