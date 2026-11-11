// CONG_VIEC_53 lát L4: trả hàng theo hóa đơn bán lẻ (TIEUCHI_NGHIEMTHU_355; KICHBAN_KIEMTHU_517). Hàng, giá, khuyến mãi: createRetailCatalog trong retail-fixture.ts.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PermissionService } from "../src/permissions/permission.service";
import type { Session } from "./helpers";
import { assignRetailRole, createRetailCatalog, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let cashier: Session;
let manager: Session;
let units: Record<string, string> = {};
let items: Record<string, string> = {};
let cashierShift: string;
let managerShift: string;
let sale: { id: string; documentNo: string };
const lineIds: Record<string, string> = {};

const call = (session: Session, method: "get" | "post", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const line = (key: string, quantity: string, extra: Record<string, unknown> = {}) => ({ variantId: items[key], unitId: units.CAI, quantity, ...extra });
const stock = async (key: string) =>
  Number((await pool.query<{ quantity: string }>("SELECT quantity FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [fixture.warehouseId, items[key]])).rows[0]?.quantity ?? 0);
const returnBody = (lines: Record<string, unknown>[], expectedRefund: string, extra: Record<string, unknown> = {}) => ({
  shiftId: managerShift,
  saleId: sale.id,
  clientKey: randomUUID(),
  reason: "Hộp bị móp",
  lines,
  refund: { method: "cash" },
  expectedRefund,
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  fixture = await createRetailFixture(application, pool);
  ({ units, items } = await createRetailCatalog(application, pool, fixture, today));
  const admin = fixture.admin;
  const store = (await call(admin, "post", "/retail/stores", storeBody(fixture))).body;
  await call(admin, "post", `/retail/stores/${store.id}/registers`, { code: "Q01", name: "Quầy 1" });
  const registers = (await call(admin, "post", `/retail/stores/${store.id}/registers`, { code: "Q02", name: "Quầy 2" })).body.registers;
  cashier = await assignRetailRole(application, pool, "thungan.td@vcomm.test", "Nguyễn Thị Lan", "cashier", fixture.storeBranch);
  manager = await assignRetailRole(application, pool, "cuahangtruong.td@vcomm.test", "Võ Văn Trưởng", "store_manager", fixture.storeBranch);
  cashierShift = (await call(cashier, "post", "/retail/shifts", { registerId: registers[0].id, openingCash: "0" })).body.id;
  managerShift = (await call(manager, "post", "/retail/shifts", { registerId: registers[1].id, openingCash: "500000" })).body.id;
  const created = await call(cashier, "post", "/retail/sales", {
    shiftId: cashierShift,
    clientKey: randomUUID(),
    lines: [line("rice", "2"), line("milk", "3"), line("phone", "2", { serials: ["IMEI-1", "IMEI-3"] }), line("cake", "3")],
    expectedTotal: String(220000 + 89100 + 11000000 + 33000),
    payments: [{ method: "cash", amount: String(220000 + 89100 + 11000000 + 33000) }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  sale = created.body;
  for (const row of (await pool.query<{ id: string; variant_id: string; is_gift: boolean }>("SELECT id, variant_id, is_gift FROM sales.order_lines WHERE order_id = $1", [created.body.salesOrder.id]))
    .rows) {
    const key = Object.entries(items).find(([, id]) => id === row.variant_id)![0];
    lineIds[row.is_gift ? `${key}Gift` : key] = row.id;
  }
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Trả hàng theo hóa đơn bán lẻ (KICHBAN_KIEMTHU_517)", () => {
  it("cần quyền trả hàng và ca của mình; xem được số còn trả, serial đã bán", async () => {
    expect((await call(cashier, "get", `/retail/sales/${sale.id}/returnable?shiftId=${cashierShift}`)).status).toBe(403);
    const returnable = await call(manager, "get", `/retail/sales/${sale.id}/returnable?shiftId=${managerShift}`);
    expect(returnable.status, JSON.stringify(returnable.body)).toBe(200);
    expect(returnable.body.blockedReason).toBeNull();
    const milk = returnable.body.lines.find((item: { orderLineId: string }) => item.orderLineId === lineIds.milk);
    expect(milk).toMatchObject({ soldQuantity: "3", returnedQuantity: "0", remainingQuantity: "3", lineTotal: "89100" });
    expect(returnable.body.lines.find((item: { orderLineId: string }) => item.orderLineId === lineIds.phone).serials).toEqual(["IMEI-1", "IMEI-3"]);
    expect(returnable.body.lines.find((item: { orderLineId: string }) => item.orderLineId === lineIds.soapGift)).toMatchObject({ isGift: true, lineTotal: "0" });
  });

  it("tính tiền hoàn theo tỷ lệ; chặn vượt số còn trả, serial sai", async () => {
    const quote = await call(manager, "post", "/retail/returns/quote", { shiftId: managerShift, saleId: sale.id, lines: [{ orderLineId: lineIds.milk, quantity: "1" }] });
    expect(quote.body).toMatchObject({ goodsAmount: "29700", refundAmount: "29700" });
    expect((await call(manager, "post", "/retail/returns/quote", { shiftId: managerShift, saleId: sale.id, lines: [{ orderLineId: lineIds.milk, quantity: "4" }] })).body.error.fields).toEqual({
      "lines.0.quantity": "Vượt số đã giao còn trả được của phiếu xuất gốc.",
    });
    expect(
      (await call(manager, "post", "/retail/returns/quote", { shiftId: managerShift, saleId: sale.id, lines: [{ orderLineId: lineIds.phone, quantity: "1", serials: ["IMEI-2"] }] })).body.error.fields,
    ).toEqual({ "lines.0.serials": "Số serial quét chưa khớp số lượng hàng theo serial." });
    // Hai dòng trả cùng một dòng bán: chặn để không hoàn thừa tiền, không nhận trùng serial.
    const duplicate = await call(manager, "post", "/retail/returns/quote", {
      shiftId: managerShift,
      saleId: sale.id,
      lines: [
        { orderLineId: lineIds.milk, quantity: "1" },
        { orderLineId: lineIds.milk, quantity: "2" },
      ],
    });
    expect(duplicate.body.error.fields).toEqual({ "lines.1.orderLineId": "Hàng này đã có ở dòng trả khác. Gộp số lượng vào một dòng." });
  });

  it("trả hàng: nhập lại kho, serial về kho, tiền mặt trừ vào ca; hoàn tiền vượt tiền mặt trong két bị chặn; gửi lại cùng khóa không ghi trùng", async () => {
    const tooMuchCash = await call(manager, "post", "/retail/returns", returnBody([{ orderLineId: lineIds.phone, quantity: "1", serials: ["IMEI-1"] }], "5500000"));
    expect(tooMuchCash.body.error.message).toBe("Tiền mặt trong két không đủ để hoàn. Chọn hoàn chuyển khoản.");
    const noRecipient = await call(
      manager,
      "post",
      "/retail/returns",
      returnBody([{ orderLineId: lineIds.phone, quantity: "1", serials: ["IMEI-1"] }], "5500000", { refund: { method: "bank_transfer" } }),
    );
    expect(noRecipient.status).toBe(400);
    const transfer = await call(
      manager,
      "post",
      "/retail/returns",
      returnBody([{ orderLineId: lineIds.phone, quantity: "1", serials: ["IMEI-1"] }], "5500000", {
        refund: { method: "bank_transfer", recipient: "Vietcombank 0011223344 TRAN VAN MINH", bankReference: "FT26315000" },
      }),
    );
    expect(transfer.status, JSON.stringify(transfer.body)).toBe(201);
    expect((await pool.query("SELECT status, warehouse_id FROM inventory.serials WHERE serial_no = 'IMEI-1'")).rows[0]).toEqual({ status: "in_stock", warehouse_id: fixture.warehouseId });

    const before = await stock("milk");
    const body = returnBody(
      [
        { orderLineId: lineIds.milk, quantity: "2" },
        { orderLineId: lineIds.cake, quantity: "3" },
      ],
      String(59400 + 33000),
    );
    const created = await call(manager, "post", "/retail/returns", body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({
      documentNo: expect.stringMatching(/^TL/),
      goodsAmount: "92400",
      refundAmount: "92400",
      refunds: [{ method: "cash", amount: "92400" }],
      sale: { id: sale.id },
    });
    expect((await call(manager, "post", "/retail/returns", body)).body.id).toBe(created.body.id);
    expect(await stock("milk")).toBe(before + 2);
    const document = (await pool.query("SELECT type, status, partner_id FROM inventory.documents WHERE id = $1", [created.body.stockDocument.id])).rows[0];
    expect(document).toEqual({ type: "sales_return", status: "posted", partner_id: null });
    const shift = (await call(manager, "get", `/retail/shifts/${managerShift}`)).body;
    expect(shift.summary[0]).toMatchObject({ method: "cash", sales: "0", refunds: "92400" });
    expect(shift.expectedCash).toBe(String(500000 - 92400));
    const detail = (await call(cashier, "get", `/retail/sales/${sale.id}`)).body;
    expect(detail.returns.map((item: { refundAmount: string }) => item.refundAmount)).toEqual(["5500000", "92400"]);
  });

  it("trả nốt phần còn lại lấy đúng số còn lại; hết hạn bị chặn", async () => {
    const last = await call(manager, "post", "/retail/returns/quote", { shiftId: managerShift, saleId: sale.id, lines: [{ orderLineId: lineIds.milk, quantity: "1" }] });
    expect(last.body.goodsAmount).toBe("29700");
    await pool.query("UPDATE retail.sales SET sale_date = sale_date - 8 WHERE id = $1", [sale.id]);
    const expired = await call(manager, "get", `/retail/sales/${sale.id}/returnable?shiftId=${managerShift}`);
    expect(expired.body.blockedReason).toBe("expired");
    expect((await call(manager, "post", "/retail/returns", returnBody([{ orderLineId: lineIds.milk, quantity: "1" }], "29700"))).body.error.message).toBe("Hóa đơn đã quá hạn trả hàng của cửa hàng.");
    await pool.query("UPDATE retail.sales SET sale_date = sale_date + 8 WHERE id = $1", [sale.id]);
  });

  it("đóng ca lập phiếu chi hoàn tiền theo quỹ", async () => {
    const shift = (await call(manager, "get", `/retail/shifts/${managerShift}`)).body;
    const closed = await call(manager, "post", `/retail/shifts/${managerShift}/close`, { countedCash: shift.expectedCash, version: shift.version });
    expect(closed.body.fundDocuments.map((item: { kind: string; amount: string }) => [item.kind, item.amount]).sort()).toEqual(
      [
        ["retail_refund", "5500000"],
        ["retail_refund", "92400"],
      ].sort(),
    );
  });
});
