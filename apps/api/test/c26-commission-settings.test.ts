// CONG_VIEC_26 L0: thiết lập hoa hồng sản phẩm, cài đặt hoa hồng chung (KICHBAN_KIEMTHU_356).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareMarketplace, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_26 thiết lập hoa hồng", () => {
  it("KICHBAN_KIEMTHU_356: thiết lập từng sản phẩm đúng ràng buộc, phiên bản; cài đặt chung mặc định và sửa; phân quyền", async () => {
    const listed = await store.call("get", "/marketplace/listings?pageSize=50");
    const cream = listed.body.data.find((item: { productId: string }) => item.productId === store.products.cream);
    expect(cream.commission).toBeNull();
    const body = { calculation: "percent", referral: "5", staff: "10", teamHead: "3", regionalDirector: "2", director: "1", version: 0 };
    // Phần trăm tổng quá 100%.
    expect((await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, { ...body, staff: "90" })).body.error.message).toBe(
      "Tổng năm mức hoa hồng theo phần trăm không được quá 100%.",
    );
    expect((await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, { ...body, referral: "-1" })).status).toBe(400);
    const saved = await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, body);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toEqual({ calculation: "percent", referral: "5", staff: "10", teamHead: "3", regionalDirector: "2", director: "1", version: 1 });
    // Sửa với phiên bản cũ bị từ chối.
    expect((await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, body)).status).toBe(409);
    // Số tiền cố định: tổng không vượt giá bán thấp nhất (xà phòng 44.000).
    const fixed = { calculation: "fixed", referral: "2000", staff: "3000", teamHead: "1000", regionalDirector: "500", director: "500", version: 0 };
    const over = await store.call("put", `/marketplace/listings/${store.products.soap}/commission`, { ...fixed, staff: "41000" });
    expect(over.body.error?.message, JSON.stringify(over.body)).toBe("Tổng năm mức hoa hồng cố định không được vượt giá bán thấp nhất của sản phẩm.");
    expect((await store.call("put", `/marketplace/listings/${store.products.soap}/commission`, fixed)).body.version).toBe(1);
    const after = (await store.call("get", "/marketplace/listings?pageSize=50")).body.data;
    expect(after.find((item: { productId: string }) => item.productId === store.products.soap).commission).toMatchObject({ calculation: "fixed", staff: "3000" });
    expect((await store.call("put", `/marketplace/listings/00000000-0000-4000-8000-000000000000/commission`, body)).status).toBe(404);

    // Cài đặt chung: mặc định, sửa, phiên bản.
    const settings = (await store.call("get", "/marketplace/store-settings")).body.commissionSettings;
    expect(settings).toEqual({ taxThreshold: "5000000", taxRate: "10", minimumWithdrawal: "100000", version: 0 });
    expect((await store.call("put", "/marketplace/commission-settings", { taxThreshold: "5000000", taxRate: "120", minimumWithdrawal: "100000", version: 0 })).status).toBe(400);
    expect((await store.call("put", "/marketplace/commission-settings", { taxThreshold: "5000000", taxRate: "10", minimumWithdrawal: "0", version: 0 })).status).toBe(400);
    const updated = await store.call("put", "/marketplace/commission-settings", { taxThreshold: "2000000", taxRate: "10", minimumWithdrawal: "50000", version: 0 });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.commissionSettings).toEqual({ taxThreshold: "2000000", taxRate: "10", minimumWithdrawal: "50000", version: 1 });
    expect((await store.call("put", "/marketplace/commission-settings", { taxThreshold: "1", taxRate: "10", minimumWithdrawal: "50000", version: 0 })).status).toBe(409);

    // Người mua không có quyền.
    await store.register("0939000001", "Người Mua Hoa Hồng");
    const buyer = await store.buyerSession("0939000001");
    expect((await buyer("put", `/marketplace/listings/${store.products.cream}/commission`, { ...body, version: 1 })).status).toBe(403);
    expect((await buyer("put", "/marketplace/commission-settings", { taxThreshold: "1", taxRate: "10", minimumWithdrawal: "50000", version: 1 })).status).toBe(403);
    const audits = (await pool.query("SELECT action FROM core.audit_events WHERE action IN ('marketplace.product_commission.update', 'marketplace.commission_settings.update')")).rows;
    expect(audits).toHaveLength(3);
  });
});
