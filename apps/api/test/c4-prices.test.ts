// CONG_VIEC_04 lát L4: kênh bán, nhóm khách hàng, bảng giá, phiếu điều chỉnh giá (TIEUCHI_NGHIEMTHU_61, 62; KICHBAN_KIEMTHU_144 đến 146).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { priceChangeImportColumns } from "contracts";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file/node";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let employee: Session;
let approver: Session;
const retail: string = testIds.retailCompany;
const units: Record<string, string> = {};
const channels: Record<string, string> = {};
let groupId: string;
let variantId: string;
let today: string;
const addDays = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// Lập và gửi phiếu một dòng; trả phiếu sau khi gửi.
async function changePrice(priceListId: string, price: string, effectiveFrom: string, unitId = units.CHAI!) {
  const draft = await retailAdmin.call("post", "/catalog/price-changes", { companyId: retail, body: { priceListId, effectiveFrom, lines: [{ variantId, unitId, price }] } });
  expect(draft.status).toBe(201);
  const submitted = await retailAdmin.call("post", `/catalog/price-changes/${draft.body.id}/submit`, { companyId: retail });
  expect(submitted.status).toBe(201);
  return submitted.body;
}
const lookup = (query: Record<string, string>) => retailAdmin.call("get", `/catalog/prices/lookup?${new URLSearchParams({ variantId, unitId: units.CHAI!, ...query })}`, { companyId: retail });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  employee = await signIn(application, "thukho.bd@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "NUOC", nameVi: "Nước uống", nameEn: "Drinks" } });
  const product = await retailAdmin.call("post", "/catalog/products", {
    companyId: retail,
    body: {
      categoryId: category.body.id,
      name: "Nước suối 500ml",
      vatRate: "10",
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: units.CHAI,
      units: [{ unitId: units.THUNG, factor: "24" }],
      variants: [{ barcodes: [] }],
    },
  });
  expect(product.status).toBe(201);
  variantId = product.body.variants[0].id;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("API_60: kênh bán, nhóm khách hàng", () => {
  it("nhân viên không tạo được; thêm kênh có sẵn không trùng khi bấm lại; mã trùng bị từ chối", async () => {
    expect((await employee.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).status).toBe(403);
    const created = await retailAdmin.call("post", "/catalog/sales-channels/defaults", { companyId: retail });
    expect(created.status).toBe(201);
    expect(created.body.map((item: { code: string }) => item.code)).toEqual(["BAN_LE", "BAN_SI", "NOI_BO", "SAN_VCOMM"]);
    expect((await retailAdmin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body).toHaveLength(4);
    for (const item of created.body) channels[item.code] = item.id;
    const group = await retailAdmin.call("post", "/catalog/customer-groups", { companyId: retail, body: { code: "VIP", name: "Khách thân thiết" } });
    expect(group.status).toBe(201);
    groupId = group.body.id;
    expect((await retailAdmin.call("post", "/catalog/customer-groups", { companyId: retail, body: { code: "VIP", name: "Trùng" } })).body.error.fields).toEqual({ code: "Mã đã có trong công ty." });
    const renamed = await retailAdmin.call("patch", `/catalog/customer-groups/${groupId}`, { companyId: retail, body: { name: "Khách VIP", version: 1 } });
    expect(renamed.body).toMatchObject({ name: "Khách VIP", version: 2 });
  });
});

describe("TIEUCHI_NGHIEMTHU_61: bảng giá không trùng; tra giá đúng bảng giá, đúng ngày", () => {
  const lists: Record<string, string> = {};

  it("KICHBAN_KIEMTHU_144: bảng giá đang dùng trùng công ty, kênh, nhóm khách, tiền tệ bị từ chối; ngừng dùng rồi tạo được", async () => {
    const create = (code: string, extra: Record<string, unknown> = {}) =>
      retailAdmin.call("post", "/catalog/price-lists", { companyId: retail, body: { code, name: code, includesVat: true, ...extra } });
    const general = await create("CHUNG");
    expect(general.status).toBe(201);
    expect(general.body).toMatchObject({ channelId: null, customerGroupId: null, currency: "VND", status: "active" });
    lists.CHUNG = general.body.id;
    expect((await create("CHUNG2")).body.error.fields).toEqual({ channelId: "Đã có bảng giá đang dùng cùng kênh, nhóm khách hàng, tiền tệ." });
    expect((await create("LE", { channelId: channels.BAN_LE })).status).toBe(201);
    lists.LE = (await retailAdmin.call("get", "/catalog/price-lists", { companyId: retail })).body.find((list: { code: string }) => list.code === "LE").id;
    lists.VIP = (await create("VIP", { customerGroupId: groupId })).body.id;
    lists.LE_VIP = (await create("LE_VIP", { channelId: channels.BAN_LE, customerGroupId: groupId })).body.id;
    expect((await create("USD", { currency: "USD" })).status).toBe(201);
    expect((await create("LE2", { channelId: channels.BAN_LE })).status).toBe(400);
    const stopped = await retailAdmin.call("post", `/catalog/price-lists/${lists.LE}/deactivate`, { companyId: retail, body: { version: 1 } });
    expect(stopped.body.status).toBe("inactive");
    const replacement = await create("LE2", { channelId: channels.BAN_LE });
    expect(replacement.status).toBe(201);
    expect((await retailAdmin.call("post", `/catalog/price-lists/${lists.LE}/activate`, { companyId: retail, body: { version: 2 } })).status).toBe(409);
    lists.LE = replacement.body.id;
    expect((await employee.call("post", "/catalog/price-lists", { companyId: retail, body: { code: "X", name: "X", includesVat: true } })).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_145: tra giá theo thứ tự kênh và nhóm khách, nhóm khách, kênh, chung; giá theo ngày hiệu lực; đơn vị quy đổi lấy giá cơ sở nhân hệ số", async () => {
    expect((await lookup({})).status).toBe(404);
    await changePrice(lists.CHUNG!, "5000", today);
    await changePrice(lists.CHUNG!, "6000", addDays(10));
    await changePrice(lists.LE!, "5500", today);
    await changePrice(lists.VIP!, "4500", today);
    await changePrice(lists.LE_VIP!, "4000", today);
    expect((await lookup({})).body).toMatchObject({ priceListCode: "CHUNG", price: "5000", fromBaseUnit: false });
    expect((await lookup({ date: addDays(10) })).body).toMatchObject({ priceListCode: "CHUNG", price: "6000", effectiveFrom: addDays(10) });
    expect((await lookup({ date: addDays(9) })).body.price).toBe("5000");
    expect((await lookup({ channelId: channels.BAN_LE! })).body).toMatchObject({ priceListCode: "LE2", price: "5500" });
    expect((await lookup({ customerGroupId: groupId })).body).toMatchObject({ priceListCode: "VIP", price: "4500" });
    expect((await lookup({ channelId: channels.BAN_LE!, customerGroupId: groupId })).body).toMatchObject({ priceListCode: "LE_VIP", price: "4000" });
    // Kênh chưa có bảng giá riêng thì dùng bảng giá chung.
    expect((await lookup({ channelId: channels.BAN_SI! })).body.priceListCode).toBe("CHUNG");
    expect((await lookup({ unitId: units.THUNG! })).body).toMatchObject({ price: "120000", fromBaseUnit: true });
    await changePrice(lists.CHUNG!, "110000", today, units.THUNG!);
    expect((await lookup({ unitId: units.THUNG! })).body).toMatchObject({ price: "110000", fromBaseUnit: false });
    const prices = await retailAdmin.call("get", `/catalog/price-lists/${lists.CHUNG}/prices?date=${addDays(10)}`, { companyId: retail });
    expect(prices.body.data.map((row: { unitName: string; price: string }) => [row.unitName, row.price])).toEqual(
      expect.arrayContaining([
        [expect.any(String), "6000"],
        ["Thùng", "110000"],
      ]),
    );
  });
});

describe("TIEUCHI_NGHIEMTHU_62: phiếu điều chỉnh giá qua luồng duyệt", () => {
  let listId: string;

  it("KICHBAN_KIEMTHU_146: không có chính sách thì đổi ngay; có chính sách thì chỉ đổi sau khi duyệt; từ chối, rút thì giá không đổi; lịch sử giữ giá cũ", async () => {
    listId = (await retailAdmin.call("get", "/catalog/price-lists", { companyId: retail })).body.find((list: { code: string }) => list.code === "CHUNG").id;
    // Ngày hiệu lực trước hôm nay bị từ chối khi gửi.
    const past = await retailAdmin.call("post", "/catalog/price-changes", {
      companyId: retail,
      body: { priceListId: listId, effectiveFrom: addDays(-1), lines: [{ variantId, unitId: units.CHAI, price: "1" }] },
    });
    expect((await retailAdmin.call("post", `/catalog/price-changes/${past.body.id}/submit`, { companyId: retail })).body.error.fields).toEqual({
      effectiveFrom: "Ngày hiệu lực không được trước hôm nay.",
    });
    expect((await retailAdmin.call("delete", `/catalog/price-changes/${past.body.id}`, { companyId: retail })).status).toBe(204);
    // Dòng lặp, biến thể của công ty khác bị từ chối.
    const repeated = await retailAdmin.call("post", "/catalog/price-changes", {
      companyId: retail,
      body: {
        priceListId: listId,
        effectiveFrom: today,
        lines: [
          { variantId, unitId: units.CHAI, price: "1" },
          { variantId, unitId: units.CHAI, price: "2" },
          { variantId, unitId: units.KG, price: "2" },
        ],
      },
    });
    expect(repeated.body.error.fields).toEqual({ "lines.1.unitId": "Mặt hàng và đơn vị bị lặp.", "lines.2.variantId": "Giá trị không hợp lệ." });

    const immediate = await changePrice(listId, "7000", addDays(20));
    expect(immediate).toMatchObject({ status: "approved", approvalRequestId: null, lines: [{ price: "7000", currentPrice: "6000" }] });
    expect(immediate.changeNo).toMatch(/^DCG-VCR-\d{4}-0000\d\d$/);
    expect((await lookup({ date: addDays(20) })).body.price).toBe("7000");

    const policy = await retailAdmin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "catalog.price_change",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect(policy.status).toBe(201);
    const outbox = application.get(OutboxService);

    const pending = await changePrice(listId, "8000", addDays(20));
    expect(pending).toMatchObject({ status: "pending", canEdit: false, canWithdraw: true });
    expect((await lookup({ date: addDays(20) })).body.price).toBe("7000");
    await approver.call("post", `/approval-requests/${pending.approvalRequestId}/decisions`, { body: { decision: "approved" } });
    await outbox.dispatchPending();
    expect((await retailAdmin.call("get", `/catalog/price-changes/${pending.id}`, { companyId: retail })).body.status).toBe("approved");
    expect((await lookup({ date: addDays(20) })).body.price).toBe("8000");

    const rejected = await changePrice(listId, "9000", addDays(20));
    await approver.call("post", `/approval-requests/${rejected.approvalRequestId}/decisions`, { body: { decision: "rejected", comment: "Giá quá cao" } });
    await outbox.dispatchPending();
    expect((await retailAdmin.call("get", `/catalog/price-changes/${rejected.id}`, { companyId: retail })).body.status).toBe("rejected");

    const withdrawn = await changePrice(listId, "9500", addDays(20));
    expect((await retailAdmin.call("post", `/catalog/price-changes/${withdrawn.id}/withdraw`, { companyId: retail })).body.status).toBe("withdrawn");
    await outbox.dispatchPending();
    expect((await lookup({ date: addDays(20) })).body.price).toBe("8000");

    const history = await retailAdmin.call("get", `/catalog/price-lists/${listId}/history?variantId=${variantId}&unitId=${units.CHAI}`, { companyId: retail });
    expect(history.body.map((item: { price: string }) => item.price)).toEqual(["8000", "7000", "6000", "5000"]);
    const list = await retailAdmin.call("get", "/catalog/price-changes?status=approved", { companyId: retail });
    expect(list.body.total).toBe(8);
    // Phiếu đã gửi không sửa được.
    expect(
      (
        await retailAdmin.call("patch", `/catalog/price-changes/${pending.id}`, {
          companyId: retail,
          body: { priceListId: listId, effectiveFrom: today, lines: [{ variantId, unitId: units.CHAI, price: "1" }] },
        })
      ).status,
    ).toBe(409);
  });

  it("nhập dòng phiếu từ Excel: dòng đúng trả kèm giá hiện hành, dòng sai kèm lý do", async () => {
    const file = await writeXlsxFile([
      priceChangeImportColumns.map((value) => ({ value })),
      ...[
        ["NUOC-00001", "thung", "100000"],
        ["KHONGCO", "CAI", "1"],
        ["NUOC-00001", "KG", "1"],
        ["NUOC-00001", "THUNG", "mười"],
      ].map((row) => row.map((value) => ({ value }))),
    ]).toBuffer();
    const result = await retailAdmin.call("post", `/catalog/price-changes/import-lines?priceListId=${listId}`, { companyId: retail }).attach("file", file, "gia.xlsx");
    expect(result.status).toBe(201);
    expect(result.body.lines).toEqual([expect.objectContaining({ sku: "NUOC-00001", unitName: "Thùng", price: "100000", currentPrice: "110000" })]);
    expect(result.body.errors.map((error: { row: number }) => error.row)).toEqual([3, 4, 5]);
  });
});
