// CONG_VIEC_05 lát L2: chuyển kho hai bước (TIEUCHI_NGHIEMTHU_69; KICHBAN_KIEMTHU_154).
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
let approver: Session;
let keeperSource: Session;
let keeperDestination: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};
const items: Record<string, string> = {};
const warehouses: Record<string, string> = {};
let destinationShelf: string;
let today: string;

async function keeper(email: string, branchId: string) {
  const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'warehouse_keeper' AND company_id IS NULL")).rows[0]!.id;
  const id = await createTestUser(pool, email, email, [{ companyId: retail, branchId }]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, 'branch', $3, $4, '2026-01-01')", [
    id,
    role,
    retail,
    branchId,
  ]);
  return signIn(application, email);
}
const body = (type: string, warehouseId: string, lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
  type,
  warehouseId,
  companyId: retail,
  documentDate: today,
  reasonCode: type === "transfer" ? "transfer" : "opening_balance",
  reason: "Kiểm thử chuyển kho",
  lines,
  ...extra,
});
async function submitted(session: Session, payload: unknown) {
  const created = await session.call("post", "/inventory/documents", { companyId: retail, body: payload });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return session.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail });
}
const stock = async (warehouseId: string, search: string) =>
  (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=${search}`, { companyId: retail })).body.data[0];

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  keeperSource = await keeper("thukho.nguon@vcomm.test", testIds.binhDuongWarehouse);
  keeperDestination = await keeper("thukho.dich@vcomm.test", testIds.headOfficeBranch);
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = async (code: string, extra: Record<string, unknown> = {}) =>
    (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: code, nameEn: code, ...extra } })).body.id;
  const product = async (key: string, name: string, categoryId: string, baseUnit: string, extra: Record<string, unknown> = {}) => {
    const created = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId, name, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units[baseUnit], variants: [{ barcodes: [] }], ...extra },
    });
    items[key] = created.body.variants[0].id;
  };
  await product("water", "Nước chuyển kho", await category("NUOCC"), "CHAI");
  await product("milk", "Sữa chuyển kho", await category("SUAC", { tracksLots: true }), "HOP", { tracksLots: true });
  await product("phone", "Điện thoại chuyển kho", await category("DTC", { tracksSerials: true }), "CAI", { tracksSerials: true });
  const warehouse = async (key: string, branchId: string, usesLocations: boolean, ownerCompanyIds: string[] = []) => {
    const created = await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId, code: key, name: key, usesLocations, ownerCompanyIds } });
    warehouses[key] = created.body.id;
  };
  await warehouse("NGUON", testIds.binhDuongWarehouse, false);
  await warehouse("DICH", testIds.headOfficeBranch, true);
  destinationShelf = (await retailAdmin.call("post", `/inventory/warehouses/${warehouses.DICH}/locations`, { companyId: retail, body: { locations: [{ code: "K-01" }] } })).body[0].id;
  // Kho của công ty khác, không nhận hàng của công ty bán lẻ.
  const tradingBranch = (
    await pool.query<{ id: string }>("INSERT INTO core.branches (company_id, code, name, branch_type, province_code) VALUES ($1, 'VCT-HN', 'Kho Hà Nội', 'warehouse', '01') RETURNING id", [trading])
  ).rows[0]!.id;
  warehouses.KHAC = (await groupAdmin.call("post", "/inventory/warehouses", { companyId: trading, body: { branchId: tradingBranch, code: "KHAC", name: "Kho VCT", usesLocations: false } })).body.id;

  const opening = await submitted(
    keeperSource,
    body("receipt_other", warehouses.NGUON!, [
      { variantId: items.water, unitId: units.CHAI, quantity: "100", unitCost: "1000" },
      { variantId: items.milk, unitId: units.HOP, quantity: "10", unitCost: "8000", lotNo: "LS-1", expiresOn: "2099-01-01" },
      { variantId: items.phone, unitId: units.CAI, quantity: "2", unitCost: "3000000", serials: ["CK-1", "CK-2"] },
    ]),
  );
  expect(opening.body.status).toBe("posted");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_69: chuyển kho hai bước, biên bản chênh lệch", () => {
  it("KICHBAN_KIEMTHU_154: duyệt rồi xuất: kho nguồn giảm, hàng đang vận chuyển; kho đích nhận thiếu sinh biên bản; kho không nhận chủ hàng bị từ chối", async () => {
    const notAccepting = await keeperSource.call("post", "/inventory/documents", {
      companyId: retail,
      body: body("transfer", warehouses.NGUON!, [{ variantId: items.water, unitId: units.CHAI, quantity: "1" }], { destinationWarehouseId: warehouses.KHAC }),
    });
    expect(notAccepting.body.error.fields).toEqual({ destinationWarehouseId: "Kho không nhận hàng của công ty này." });
    expect((await keeperSource.call("get", `/inventory/transfer-destinations?companyId=${retail}`, { companyId: retail })).body.map((item: { code: string }) => item.code).sort()).toEqual([
      "DICH",
      "NGUON",
    ]);

    await (async () => {
      const response = await retailAdmin.call("post", "/approval-policies", {
        companyId: retail,
        body: {
          documentTypeCode: "inventory.transfer",
          currency: "VND",
          effectiveFrom: "2026-01-01",
          levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
        },
      });
      expect(response.status).toBe(201);
    })();
    const lot = (await keeperSource.call("get", `/inventory/documents/lot-suggestions?warehouseId=${warehouses.NGUON}&companyId=${retail}&variantId=${items.milk}`, { companyId: retail })).body[0]
      .lotId;
    const transfer = await submitted(
      keeperSource,
      body(
        "transfer",
        warehouses.NGUON!,
        [
          { variantId: items.water, unitId: units.CHAI, quantity: "30" },
          { variantId: items.milk, unitId: units.HOP, quantity: "4", lotId: lot },
          { variantId: items.phone, unitId: units.CAI, quantity: "2", serials: ["CK-1", "CK-2"] },
        ],
        { destinationWarehouseId: warehouses.DICH },
      ),
    );
    expect(transfer.body).toMatchObject({ status: "pending", documentNo: expect.stringMatching(/^CK-VCR-/), canShip: false });
    expect(await stock(warehouses.NGUON!, "NUOCC")).toMatchObject({ onHand: "100", reserved: "30", available: "70" });
    await approver.call("post", `/approval-requests/${transfer.body.approvalRequestId}/decisions`, { body: { decision: "approved" } });
    await application.get(OutboxService).dispatchPending();
    const approved = (await keeperSource.call("get", `/inventory/documents/${transfer.body.id}`, { companyId: retail })).body;
    expect(approved).toMatchObject({ status: "posted", canShip: true, canReceive: false });
    expect(await stock(warehouses.NGUON!, "NUOCC")).toMatchObject({ onHand: "100" });

    // Chỉ kho nguồn xác nhận xuất.
    expect((await keeperDestination.call("post", `/inventory/documents/${transfer.body.id}/ship`, { companyId: retail })).status).toBe(404);
    const shipped = await keeperSource.call("post", `/inventory/documents/${transfer.body.id}/ship`, { companyId: retail });
    expect(shipped.body.status).toBe("in_transit");
    expect((await keeperDestination.call("get", `/inventory/documents/${transfer.body.id}`, { companyId: retail })).body).toMatchObject({ canReceive: true, canShip: false });
    expect((await retailAdmin.call("get", `/inventory/documents/${transfer.body.id}`, { companyId: retail })).body).toMatchObject({ canReceive: true });
    expect(await stock(warehouses.NGUON!, "NUOCC")).toMatchObject({ onHand: "70", reserved: "0" });
    expect((await pool.query("SELECT status FROM inventory.serials WHERE serial_no IN ('CK-1', 'CK-2')")).rows.map((row) => row.status)).toEqual(["in_transit", "in_transit"]);
    expect((await keeperSource.call("post", `/inventory/documents/${transfer.body.id}/ship`, { companyId: retail })).status).toBe(409);

    // Kho đích nhận thiếu 2 chai và 1 điện thoại.
    const lines = shipped.body.lines;
    expect((await keeperSource.call("post", `/inventory/documents/${transfer.body.id}/receive`, { companyId: retail, body: { lines: [] } })).status).toBe(400);
    const receive = (overrides: Record<string, unknown> = {}) => ({
      lines: lines.map((line: { id: string; sku: string; baseQuantity: string }) => ({
        lineId: line.id,
        receivedQuantity: line.baseQuantity,
        destinationLocationId: destinationShelf,
        serials: [] as string[],
        ...((overrides[line.id] as object) ?? {}),
      })),
      note: "Vỡ 2 chai, thiếu 1 máy",
    });
    const water = lines[0].id;
    const phone = lines[2].id;
    const missingSerial = await keeperDestination.call("post", `/inventory/documents/${transfer.body.id}/receive`, { companyId: retail, body: receive({ [water]: { receivedQuantity: "28" } }) });
    expect(missingSerial.body.error.fields).toEqual({ "lines.2.serials": "Số serial phải bằng số lượng theo đơn vị cơ sở." });
    const received = await keeperDestination.call("post", `/inventory/documents/${transfer.body.id}/receive`, {
      companyId: retail,
      body: receive({ [water]: { receivedQuantity: "28" }, [phone]: { receivedQuantity: "1", serials: ["CK-2"] } }),
    });
    expect(received.status, JSON.stringify(received.body)).toBe(201);
    expect(received.body.status).toBe("received");
    expect(received.body.discrepancies.map((item: { difference: string; value: string | null }) => [item.difference, item.value])).toEqual([
      ["-2", null],
      ["-1", null],
    ]);
    const detail = (await retailAdmin.call("get", `/inventory/documents/${transfer.body.id}`, { companyId: retail })).body;
    expect(detail.discrepancies.map((item: { value: string }) => item.value)).toEqual(["-2000", "-3000000"]);
    expect(await stock(warehouses.DICH!, "NUOCC")).toMatchObject({ onHand: "28", averageCost: "1000" });
    expect(await stock(warehouses.DICH!, "DTC")).toMatchObject({ onHand: "1", averageCost: "3000000" });
    const milkDetail = (await retailAdmin.call("get", `/inventory/stock/${items.milk}/details?warehouseId=${warehouses.DICH}&companyId=${retail}`, { companyId: retail })).body;
    expect(milkDetail.balances).toEqual([expect.objectContaining({ lotNo: "LS-1", locationCode: "K-01", quantity: "4" })]);
    expect((await pool.query("SELECT serial_no, status FROM inventory.serials WHERE serial_no IN ('CK-1', 'CK-2') ORDER BY serial_no")).rows).toEqual([
      { serial_no: "CK-1", status: "in_transit" },
      { serial_no: "CK-2", status: "in_stock" },
    ]);
  });
});
