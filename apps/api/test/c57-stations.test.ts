// CONG_VIEC_57 lát L1: cài đặt trạm giao hàng O2O (TIEUCHI_NGHIEMTHU_390, 401 phần điểm giao nhận không bán tại quầy; KICHBAN_KIEMTHU_559, 560).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Session } from "./helpers";
import { assignRetailRole, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let admin: Session;
let manager: Session;
let storeId: string;

const call = (session: Session, method: "get" | "post" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });

const stationBody = (version: number, extra: Record<string, unknown> = {}) => ({
  pickupEnabled: true,
  deliveryEnabled: true,
  displayName: "VComm Thủ Đức",
  provinceCode: "79",
  wardCode: "26800",
  streetAddress: "45 Hoàng Diệu 2",
  phone: "028 3896 1234",
  openingHours: "7:00 – 21:00 mỗi ngày",
  holdDays: 3,
  deliveryFee: "15000",
  freeDeliveryThreshold: "300000",
  deliveryWardCodes: ["26800", "26803", "26800"],
  version,
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await createRetailFixture(application, pool);
  admin = fixture.admin;
  manager = await assignRetailRole(application, pool, "cuahangtruong.o2o@vcomm.test", "Võ Văn Trạm", "store_manager", fixture.storeBranch);
  const created = await call(admin, "post", "/retail/stores", storeBody(fixture));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  storeId = created.body.id;
  expect(created.body).toMatchObject({ kind: "store", station: { pickupEnabled: false, deliveryEnabled: false, holdDays: 3, deliveryWards: [], version: 1 } });
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Cài đặt trạm (KICHBAN_KIEMTHU_559)", () => {
  it("chỉ công ty vận hành sàn bật được trạm; chỉ người cài đặt cửa hàng", async () => {
    await pool.query("UPDATE core.companies SET is_marketplace_operator = false WHERE id = $1", [retail]);
    const notOperator = await call(admin, "patch", `/retail/stores/${storeId}/station`, stationBody(1));
    expect(notOperator.status).toBe(409);
    expect(notOperator.body.error.message).toBe("Chỉ cửa hàng, điểm giao nhận của công ty vận hành sàn VComm bật được trạm giao hàng.");
    // Tắt hẳn thì lưu được dù không vận hành sàn.
    const off = await call(admin, "patch", `/retail/stores/${storeId}/station`, stationBody(1, { pickupEnabled: false, deliveryEnabled: false, deliveryWardCodes: [] }));
    expect(off.status, JSON.stringify(off.body)).toBe(200);
    expect(off.body.station.version).toBe(2);
    await pool.query("UPDATE core.companies SET is_marketplace_operator = (id = $1)", [retail]);
    expect((await call(manager, "patch", `/retail/stores/${storeId}/station`, stationBody(2))).status).toBe(403);
    expect((await call(manager, "get", "/retail/regions/provinces")).status).toBe(403);
  });

  it("thiếu thông tin hiện cho khách, xã sai tỉnh, trạm giao không có xã thì chặn", async () => {
    const missing = await call(
      admin,
      "patch",
      `/retail/stores/${storeId}/station`,
      stationBody(2, { displayName: "", provinceCode: null, wardCode: null, streetAddress: " ", phone: null, openingHours: "", deliveryWardCodes: [] }),
    );
    expect(missing.status).toBe(400);
    expect(Object.keys(missing.body.error.fields).sort()).toEqual(["deliveryWardCodes", "displayName", "openingHours", "phone", "provinceCode", "streetAddress", "wardCode"]);
    const wrongWard = await call(admin, "patch", `/retail/stores/${storeId}/station`, stationBody(2, { provinceCode: "01", deliveryWardCodes: ["99999"] }));
    expect(Object.keys(wrongWard.body.error.fields).sort()).toEqual(["deliveryWardCodes", "wardCode"]);
    expect((await call(admin, "patch", `/retail/stores/${storeId}/station`, stationBody(2, { holdDays: 15 }))).status).toBe(400);
    expect((await call(admin, "patch", `/retail/stores/${storeId}/station`, stationBody(2, { phone: "12345" }))).status).toBe(400);
    expect((await call(admin, "patch", `/retail/stores/${storeId}/station`, stationBody(1))).status).toBe(409);
  });

  it("bật nhận tại trạm, trạm giao; xã giao không trùng; người bán thấy cài đặt trạm", async () => {
    const saved = await call(admin, "patch", `/retail/stores/${storeId}/station`, stationBody(2));
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.station).toMatchObject({
      pickupEnabled: true,
      deliveryEnabled: true,
      displayName: "VComm Thủ Đức",
      province: { code: "79", name: "Hồ Chí Minh" },
      ward: { code: "26800", name: "Linh Xuân" },
      phone: "02838961234",
      deliveryFee: "15000.0000",
      freeDeliveryThreshold: "300000.0000",
      version: 3,
    });
    expect(saved.body.station.deliveryWards.map((ward: { code: string }) => ward.code).sort()).toEqual(["26800", "26803"]);
    expect(saved.body.isMarketplaceOperator).toBe(true);
    const seen = await call(manager, "get", "/retail/stores");
    expect(seen.body[0].station.pickupEnabled).toBe(true);
    const wards = await call(admin, "get", "/retail/regions/provinces/79/wards");
    expect(wards.body.some((ward: { code: string }) => ward.code === "26803")).toBe(true);
    const audit = await pool.query("SELECT 1 FROM core.audit_events WHERE action = 'retail_store.station' AND entity_id = $1", [storeId]);
    expect(audit.rows.length).toBe(2);
  });
});

describe("Điểm giao nhận (KICHBAN_KIEMTHU_560)", () => {
  it("gắn chi nhánh loại Khác, không gắn chi nhánh trụ sở; không bán tại quầy", async () => {
    const otherBranch = (
      await pool.query<{ id: string }>(
        "INSERT INTO core.branches (company_id, code, name, branch_type, province_code, address) VALUES ($1, 'VCR-DA', 'Điểm giao nhận Dĩ An', 'other', '79', '8 Trần Hưng Đạo') RETURNING id",
        [retail],
      )
    ).rows[0]!.id;
    const warehouse = await call(admin, "post", "/inventory/warehouses", { branchId: otherBranch, code: "KDA", name: "Kho Dĩ An", usesLocations: false });
    expect(warehouse.status, JSON.stringify(warehouse.body)).toBe(201);
    const options = await call(admin, "get", "/retail/options");
    expect(options.body.branches.find((branch: { id: string }) => branch.id === otherBranch)).toMatchObject({ branchType: "other" });
    const asStore = await call(admin, "post", "/retail/stores", storeBody(fixture, { branchId: otherBranch, warehouseId: warehouse.body.id }));
    expect(asStore.body.error.fields).toEqual({ branchId: "Chọn chi nhánh loại Cửa hàng đang hoạt động của công ty." });
    const created = await call(admin, "post", "/retail/stores", storeBody(fixture, { kind: "pickup_point", branchId: otherBranch, warehouseId: warehouse.body.id }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.kind).toBe("pickup_point");
    const registers = await call(admin, "post", `/retail/stores/${created.body.id}/registers`, { code: "Q01", name: "Quầy giao nhận" });
    const register = registers.body.registers[0].id as string;
    const cashier = await assignRetailRole(application, pool, "nhanvien.da@vcomm.test", "Đỗ Văn Nhận", "cashier", otherBranch);
    const shift = await call(cashier, "post", "/retail/shifts", { registerId: register, openingCash: "0" });
    expect(shift.status, JSON.stringify(shift.body)).toBe(201);
    const items = await call(cashier, "get", `/retail/items?shiftId=${shift.body.id}&search=gao`);
    expect(items.status).toBe(409);
    expect(items.body.error.message).toBe("Điểm giao nhận không bán hàng tại quầy.");
  });
});
