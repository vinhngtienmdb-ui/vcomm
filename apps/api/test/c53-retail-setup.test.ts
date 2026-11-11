// CONG_VIEC_53 lát L1: cửa hàng, quầy, mở ca, đóng ca (TIEUCHI_NGHIEMTHU_349, 350, 354 phần đối chiếu, 358 phần phân quyền;
// KICHBAN_KIEMTHU_510, 511, 516 phần không có bán hàng, 520).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { assignRetailRole, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let admin: Session;
let cashier: Session;
let secondCashier: Session;
let otherBranchCashier: Session;
let manager: Session;
let accountant: Session;
let employee: Session;
let tradingAdmin: Session;
let storeId: string;
let registerOne: string;
let registerTwo: string;

const call = (session: Session, method: "get" | "post" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await createRetailFixture(application, pool);
  admin = fixture.admin;
  cashier = await assignRetailRole(application, pool, "thungan.td@vcomm.test", "Nguyễn Thị Lan", "cashier", fixture.storeBranch);
  secondCashier = await assignRetailRole(application, pool, "thungan2.td@vcomm.test", "Lê Văn Hùng", "cashier", fixture.storeBranch);
  otherBranchCashier = await assignRetailRole(application, pool, "thungan.q1@vcomm.test", "Phan Thị Một", "cashier", fixture.otherStoreBranch);
  manager = await assignRetailRole(application, pool, "cuahangtruong.td@vcomm.test", "Võ Văn Trưởng", "store_manager", fixture.storeBranch);
  accountant = await assignRetailRole(application, pool, "ketoan.bl@vcomm.test", "Đào Thị Toán", "accountant", null);
  employee = await assignRetailRole(application, pool, "nhanvien.bl@vcomm.test", "Ngô Thị Văn", "employee", null);
  tradingAdmin = await signIn(application, "phuc.le@vcomm.test");
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Cửa hàng, quầy (KICHBAN_KIEMTHU_510)", () => {
  it("chặn sai điều kiện, không có quyền", async () => {
    expect((await call(cashier, "post", "/retail/stores", storeBody(fixture))).status).toBe(403);
    expect((await call(employee, "get", "/retail/stores")).status).toBe(403);
    const wrong = await call(admin, "post", "/retail/stores", {
      ...storeBody(fixture),
      branchId: testIds.headOfficeBranch,
      warehouseId: fixture.otherBranchWarehouse,
      channelId: fixture.internalChannel,
      cashFundId: fixture.bankFund,
      bankFundId: fixture.cashFund,
    });
    expect(wrong.status).toBe(400);
    expect(Object.keys(wrong.body.error.fields).sort()).toEqual(["bankFundId", "branchId", "cashFundId", "channelId", "warehouseId"]);
    const sameBranch = await call(admin, "post", "/retail/stores", { ...storeBody(fixture), warehouseId: fixture.otherBranchWarehouse });
    expect(sameBranch.body.error.fields).toEqual({ warehouseId: "Kho bán phải là kho đang hoạt động thuộc chi nhánh của cửa hàng." });
    const noBin = await call(admin, "post", "/retail/stores", { ...storeBody(fixture), vietqrBankBin: "", vietqrAccountName: "" });
    expect(Object.keys(noBin.body.error.fields).sort()).toEqual(["vietqrAccountName", "vietqrBankBin"]);
    expect((await call(admin, "post", "/retail/stores", { ...storeBody(fixture), vietqrBankBin: "97043" })).status).toBe(400);
    expect((await call(admin, "post", "/retail/stores", { ...storeBody(fixture), returnDays: 91 })).status).toBe(400);
  });

  it("thêm cửa hàng, quầy; không thêm cửa hàng thứ hai cho chi nhánh; mã quầy không trùng", async () => {
    const created = await call(admin, "post", "/retail/stores", storeBody(fixture));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    storeId = created.body.id;
    expect(created.body).toMatchObject({ branch: { name: "Cửa hàng Thủ Đức" }, channel: { code: "BAN_LE" }, bankFund: { accountNo: "0123456789" }, returnDays: 7, status: "active", canSetup: true });
    const duplicate = await call(admin, "post", "/retail/stores", storeBody(fixture));
    expect(duplicate.body.error.fields).toEqual({ branchId: "Chi nhánh này đã có cửa hàng bán lẻ." });
    const withoutBank = await call(admin, "post", "/retail/stores", {
      ...storeBody(fixture),
      branchId: fixture.otherStoreBranch,
      warehouseId: fixture.otherBranchWarehouse,
      bankFundId: null,
      vietqrBankBin: "970436",
    });
    expect(withoutBank.status, JSON.stringify(withoutBank.body)).toBe(201);
    expect(withoutBank.body).toMatchObject({ bankFund: null, vietqrBankBin: null });
    const otherStoreId = withoutBank.body.id;
    expect((await call(admin, "post", `/retail/stores/${otherStoreId}/registers`, { code: "Q01", name: "Quầy 1" })).status).toBe(201);

    expect((await call(manager, "post", `/retail/stores/${storeId}/registers`, { code: "Q01", name: "Quầy 1" })).status).toBe(403);
    const one = await call(admin, "post", `/retail/stores/${storeId}/registers`, { code: "q01", name: "Quầy 1" });
    expect(one.status, JSON.stringify(one.body)).toBe(201);
    expect(one.body.registers.map((register: { code: string }) => register.code)).toEqual(["Q01"]);
    expect((await call(admin, "post", `/retail/stores/${storeId}/registers`, { code: "Q01", name: "Trùng" })).body.error.fields).toEqual({ code: "Mã quầy đã có trong cửa hàng." });
    expect((await call(admin, "post", `/retail/stores/${storeId}/registers`, { code: "Q-02", name: "Sai mã" })).status).toBe(400);
    const two = await call(admin, "post", `/retail/stores/${storeId}/registers`, { code: "Q02", name: "Quầy 2" });
    registerOne = two.body.registers[0].id;
    registerTwo = two.body.registers[1].id;
  });

  it("người bán, quản lý ca chỉ thấy cửa hàng của chi nhánh mình; công ty khác không thấy", async () => {
    expect((await call(cashier, "get", "/retail/stores")).body.map((store: { id: string; canSetup: boolean }) => [store.id, store.canSetup])).toEqual([[storeId, false]]);
    expect((await call(otherBranchCashier, "get", "/retail/stores")).body.map((store: { id: string }) => store.id)).not.toContain(storeId);
    expect((await call(otherBranchCashier, "get", `/retail/stores/${storeId}`)).status).toBe(404);
    expect((await call(accountant, "get", "/retail/stores")).body).toHaveLength(2);
    expect((await tradingAdmin.call("get", "/retail/stores", { companyId: testIds.tradingCompany })).status).toBe(403);
    expect((await call(cashier, "get", "/retail/options")).status).toBe(403);
    const options = await call(admin, "get", "/retail/options");
    expect(options.body.channels.map((channel: { code: string }) => channel.code)).not.toContain("NOI_BO");
    expect(options.body.branches.find((branch: { id: string }) => branch.id === fixture.storeBranch)).toMatchObject({ hasStore: true });
  });
});

describe("Ca thu ngân (KICHBAN_KIEMTHU_511, 516)", () => {
  let shiftId: string;

  it("mở ca: quyền tại chi nhánh, một ca mỗi quầy và mỗi người", async () => {
    expect((await call(otherBranchCashier, "post", "/retail/shifts", { registerId: registerOne, openingCash: "1000000" })).status).toBe(403);
    expect((await call(employee, "post", "/retail/shifts", { registerId: registerOne, openingCash: "1000000" })).status).toBe(403);
    expect((await call(cashier, "post", "/retail/shifts", { registerId: registerOne, openingCash: "-1" })).status).toBe(400);
    expect((await call(cashier, "post", "/retail/shifts", { registerId: registerOne, openingCash: "1000000001" })).status).toBe(400);
    const opened = await call(cashier, "post", "/retail/shifts", { registerId: registerOne, openingCash: "1500000.4" });
    expect(opened.status, JSON.stringify(opened.body)).toBe(201);
    shiftId = opened.body.id;
    expect(opened.body).toMatchObject({
      status: "open",
      openingCash: "1500000",
      expectedCash: "1500000",
      cashier: { name: "Nguyễn Thị Lan" },
      register: { code: "Q01" },
      canClose: true,
      saleCount: 0,
    });
    expect((await call(cashier, "post", "/retail/shifts", { registerId: registerTwo, openingCash: "0" })).status).toBe(409);
    const busy = await call(secondCashier, "post", "/retail/shifts", { registerId: registerOne, openingCash: "0" });
    expect(busy.status).toBe(409);
    expect(busy.body.error.message).toBe("Quầy đang có ca mở của người khác.");
    const context = await call(cashier, "get", "/retail/counter");
    expect(context.body.currentShift).toMatchObject({ id: shiftId });
    expect(context.body.stores[0].registers.map((register: { code: string; busy: boolean }) => [register.code, register.busy])).toEqual([
      ["Q01", true],
      ["Q02", false],
    ]);
    expect((await call(manager, "get", "/retail/counter")).body.currentShift).toBeNull();
  });

  it("không ngừng cửa hàng, quầy khi còn ca mở", async () => {
    const store = (await call(admin, "get", `/retail/stores/${storeId}`)).body;
    const stop = await call(admin, "patch", `/retail/stores/${storeId}`, { ...storeBody(fixture), status: "inactive", version: store.version });
    expect(stop.status).toBe(409);
    expect(stop.body.error.message).toBe("Đang có ca mở. Đóng ca trước khi ngừng hoặc đổi chi nhánh, kho.");
    const register = store.registers.find((item: { id: string }) => item.id === registerOne);
    expect((await call(admin, "patch", `/retail/registers/${registerOne}`, { code: "Q01", name: "Quầy 1", status: "inactive", version: register.version })).status).toBe(409);
    const renamed = await call(admin, "patch", `/retail/stores/${storeId}`, { ...storeBody(fixture), returnDays: 5, version: store.version });
    expect(renamed.status, JSON.stringify(renamed.body)).toBe(200);
    expect(renamed.body.returnDays).toBe(5);
    expect((await call(admin, "patch", `/retail/stores/${storeId}`, { ...storeBody(fixture), version: store.version })).status).toBe(409);
  });

  it("đóng ca: lệch bắt buộc lý do; người khác cần quyền quản lý ca; ca đã đóng không đóng lại", async () => {
    const detail = (await call(cashier, "get", `/retail/shifts/${shiftId}`)).body;
    expect((await call(secondCashier, "get", `/retail/shifts/${shiftId}`)).status).toBe(404);
    expect((await call(secondCashier, "post", `/retail/shifts/${shiftId}/close`, { countedCash: "1500000", version: detail.version })).status).toBe(403);
    expect((await call(otherBranchCashier, "post", `/retail/shifts/${shiftId}/close`, { countedCash: "1500000", version: detail.version })).status).toBe(404);
    const missingReason = await call(cashier, "post", `/retail/shifts/${shiftId}/close`, { countedCash: "1488000", version: detail.version });
    expect(missingReason.body.error.fields).toEqual({ differenceReason: "Tiền đếm được lệch với số hệ thống tính: vui lòng ghi lý do." });
    expect((await call(manager, "get", `/retail/shifts/${shiftId}`)).body.canClose).toBe(true);
    const closed = await call(manager, "post", `/retail/shifts/${shiftId}/close`, { countedCash: "1488000", differenceReason: "Trả nhầm tiền thừa", version: detail.version });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    expect(closed.body).toMatchObject({
      status: "closed",
      expectedCash: "1500000",
      countedCash: "1488000",
      difference: "-12000",
      differenceReason: "Trả nhầm tiền thừa",
      closedBy: "Võ Văn Trưởng",
      canClose: false,
    });
    expect((await call(manager, "post", `/retail/shifts/${shiftId}/close`, { countedCash: "1488000", version: closed.body.version })).status).toBe(409);
  });

  it("mở lại: tiền đầu ca khác tiền cuối ca trước cần ghi chú; khớp thì không cần, lệch 0 không lưu lý do", async () => {
    const context = (await call(secondCashier, "get", "/retail/counter")).body;
    expect(context.stores[0].registers[0]).toMatchObject({ code: "Q01", busy: false, lastClosingCash: "1488000" });
    const noNote = await call(secondCashier, "post", "/retail/shifts", { registerId: registerOne, openingCash: "1000000" });
    expect(noNote.body.error.fields).toEqual({ openingNote: "Tiền đầu ca khác tiền cuối ca trước: vui lòng ghi chú." });
    const withNote = await call(secondCashier, "post", "/retail/shifts", { registerId: registerOne, openingCash: "1000000", openingNote: "Nộp 488.000 về két tổng" });
    expect(withNote.status).toBe(201);
    const closed = await call(secondCashier, "post", `/retail/shifts/${withNote.body.id}/close`, { countedCash: "1000000", differenceReason: "không cần", version: withNote.body.version });
    expect(closed.body).toMatchObject({ difference: "0", differenceReason: null });
    expect((await call(cashier, "post", "/retail/shifts", { registerId: registerOne, openingCash: "1000000" })).status).toBe(201);
  });

  it("danh sách ca: thu ngân thấy ca của mình; quản lý ca, kế toán thấy ca trong phạm vi; lọc ca lệch", async () => {
    expect((await call(secondCashier, "get", "/retail/shifts")).body.items.map((item: { cashierName: string }) => item.cashierName)).toEqual(["Lê Văn Hùng"]);
    expect((await call(manager, "get", "/retail/shifts")).body.total).toBe(3);
    expect((await call(accountant, "get", "/retail/shifts?differenceOnly=true")).body.items.map((item: { difference: string }) => item.difference)).toEqual(["-12000"]);
    expect((await call(otherBranchCashier, "get", "/retail/shifts")).body.total).toBe(0);
    expect((await call(employee, "get", "/retail/shifts")).status).toBe(403);
    const open = (await call(manager, "get", "/retail/shifts?status=open")).body.items;
    expect(open).toEqual([expect.objectContaining({ cashierName: "Nguyễn Thị Lan", openedLong: false })]);
  });
});
