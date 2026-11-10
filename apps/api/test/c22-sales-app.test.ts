// CONG_VIEC_22: Ứng dụng nhân viên kinh doanh (KICHBAN_KIEMTHU_287 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, totpCode, totpSecrets } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
const retail: string = testIds.retailCompany;
const ids: Record<string, string> = {};

const http = () => request(application.getHttpServer());
const bearer = (method: "get" | "post", path: string, token: string, body?: object) => {
  const call = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("x-company-id", retail).set("accept-language", "vi");
  return body ? call.send(body) : call;
};
async function assign(key: string, email: string, name: string, role: string) {
  ids[key] = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [ids[key], roleId, retail]);
}
const appLogin = (identifier: string) => http().post("/api/v1/auth/app/login").send({ identifier, password: "MatKhauThu@2026" });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  await assign("seller", "banhang.app@vcomm.test", "Bán Hàng Ứng Dụng", "salesperson");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_22 đăng nhập ứng dụng", () => {
  it("KICHBAN_KIEMTHU_287: đăng nhập trả token trong thân phản hồi, phiên của ứng dụng 90 ngày; token làm mới đổi mới mỗi lần dùng, dùng lại token cũ thu hồi cả chuỗi; đăng xuất thu hồi phiên", async () => {
    const login = await appLogin("banhang.app@vcomm.test");
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    expect(login.body).toMatchObject({ mfaRequired: false, user: { fullName: "Bán Hàng Ứng Dụng" } });
    expect(login.headers["set-cookie"]).toBeUndefined();
    const tokens = login.body.tokens as { accessToken: string; refreshToken: string; refreshExpiresAt: string };
    const days = (Date.parse(tokens.refreshExpiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThanOrEqual(90);
    const session = (await pool.query("SELECT client_type FROM core.sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [ids.seller])).rows[0];
    expect(session.client_type).toBe("sales_app");
    const me = await bearer("get", "/me", tokens.accessToken);
    expect(me.status).toBe(200);
    expect(me.body.permissions).toContain("sales.access");
    // Ghi bằng header Authorization không cần CSRF.
    const created = await bearer("post", "/crm/partners", tokens.accessToken, { kind: "organization", name: "Khách ứng dụng", taxCode: "0322000001" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);

    const refreshed = await http().post("/api/v1/auth/app/refresh").send({ refreshToken: tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.refreshToken).not.toBe(tokens.refreshToken);
    expect((await bearer("get", "/me", refreshed.body.accessToken)).status).toBe(200);
    // Dùng lại token làm mới cũ: thu hồi cả chuỗi, token mới cũng hết dùng được.
    expect((await http().post("/api/v1/auth/app/refresh").send({ refreshToken: tokens.refreshToken })).status).toBe(401);
    expect((await http().post("/api/v1/auth/app/refresh").send({ refreshToken: refreshed.body.refreshToken })).status).toBe(401);
    expect((await bearer("get", "/me", refreshed.body.accessToken)).status).toBe(401);

    const again = await appLogin("banhang.app@vcomm.test");
    expect((await bearer("post", "/auth/logout", again.body.tokens.accessToken)).status).toBe(204);
    expect((await bearer("get", "/me", again.body.tokens.accessToken)).status).toBe(401);
    expect((await http().post("/api/v1/auth/app/refresh").send({ refreshToken: again.body.tokens.refreshToken })).status).toBe(401);
  });

  it("KICHBAN_KIEMTHU_288: sai mật khẩu báo chung một lỗi; xác thực hai lớp qua header Authorization; token làm mới của phiên web không dùng được ở ứng dụng", async () => {
    const wrong = await http().post("/api/v1/auth/app/login").send({ identifier: "banhang.app@vcomm.test", password: "Sai@12345" });
    expect(wrong.status).toBe(401);
    expect((await http().post("/api/v1/auth/app/login").send({ identifier: "khongco@vcomm.test", password: "Sai@12345" })).body.error.message).toBe(wrong.body.error.message);
    // Quản trị công ty bắt buộc xác thực hai lớp: đăng ký qua web trước, ứng dụng nhập mã.
    await signIn(application, "quantri.vcr@vcomm.test");
    const login = await appLogin("quantri.vcr@vcomm.test");
    expect(login.body).toMatchObject({ mfaRequired: true, mfaEnrolled: true });
    const pending = login.body.tokens.accessToken as string;
    expect((await bearer("get", "/crm/partners", pending)).status).toBe(401);
    const verified = await bearer("post", "/auth/mfa/verify", pending, { code: totpCode(totpSecrets.get("quantri.vcr@vcomm.test")!) });
    expect(verified.status, JSON.stringify(verified.body)).toBe(204);
    expect((await bearer("get", "/crm/partners", pending)).status).toBe(200);
    // Token làm mới của phiên web gửi tới API của ứng dụng bị từ chối.
    const web = await http().post("/api/v1/auth/login").send({ identifier: "banhang.app@vcomm.test", password: "MatKhauThu@2026" });
    const webRefresh = (web.headers["set-cookie"] as unknown as string[])
      .find((cookie) => cookie.startsWith("vc_refresh="))!
      .split(";")[0]!
      .slice("vc_refresh=".length);
    expect(
      (
        await http()
          .post("/api/v1/auth/app/refresh")
          .send({ refreshToken: decodeURIComponent(webRefresh) })
      ).status,
    ).toBe(401);
  });
});

describe("CONG_VIEC_22 khách của tôi", () => {
  it("KICHBAN_KIEMTHU_289: tóm tắt khách trong phạm vi: liên hệ, phải thu còn lại sau khi trừ trả trước, phần quá hạn, đơn gần đây; không có hạn mức; khách ngoài phạm vi nhận 404", async () => {
    const token = (await appLogin("banhang.app@vcomm.test")).body.tokens.accessToken as string;
    const created = await bearer("post", "/crm/partners", token, {
      kind: "organization",
      name: "Khách có công nợ",
      taxCode: "0322000002",
      phone: "0281234567",
      contacts: [{ fullName: "Chị Lan", position: "Kế toán", phone: "0909000111", email: null, isPrimary: true }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const partnerId = created.body.id as string;
    const debt = (direction: string, amount: number, open: number, due: string | null) =>
      pool.query(
        `INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, document_no, document_date, due_date, amount, open_amount)
         VALUES ($1, $2, 'receivable', $3, 'opening', 'SDĐK', '2026-10-01', $4, $5, $6)`,
        [retail, partnerId, direction, due, amount, open],
      );
    await debt("debit", 1000000, 600000, "2026-10-15");
    await debt("debit", 300000, 300000, "2099-12-31");
    await debt("credit", 200000, 100000, null);
    const summary = await bearer("get", `/crm/partners/${partnerId}/summary`, token);
    expect(summary.status, JSON.stringify(summary.body)).toBe(200);
    expect(summary.body).toMatchObject({
      name: "Khách có công nợ",
      phone: "0281234567",
      paymentTermDays: 0,
      currency: "VND",
      receivable: "800000",
      overdue: "600000",
      recentOrders: [],
      contacts: [{ fullName: "Chị Lan", phone: "0909000111", isPrimary: true }],
    });
    expect(summary.body).not.toHaveProperty("creditLimit");
    // Khách của người khác (đối tác nội bộ, chưa có người phụ trách) ngoài phạm vi.
    const other = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id IS NOT NULL LIMIT 1")).rows[0]!.id;
    expect((await bearer("get", `/crm/partners/${other}/summary`, token)).status).toBe(404);
  });
});

describe("CONG_VIEC_22 hoa hồng của tôi", () => {
  it("KICHBAN_KIEMTHU_292: chỉ trả phát sinh, chỉ tiêu, bảng hoa hồng của chính người xem; tổng khớp phát sinh; không có quyền thì 403", async () => {
    const admin = await signIn(application, "quantri.vcr@vcomm.test");
    const call = (method: "get" | "post", path: string, body?: unknown) => admin.call(method, path, { companyId: retail, body });
    const unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "HHUD", nameVi: "Hoa hồng ứng dụng", nameEn: "App commission" } })).body.id;
    const product = await call("post", "/catalog/products", {
      categoryId,
      name: "Hàng tính hoa hồng",
      vatRate: "10",
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: unitId,
      variants: [{ barcodes: [] }],
    });
    expect(product.status, JSON.stringify(product.body)).toBe(201);
    const variantId = product.body.variants[0].id as string;
    const warehouseId = (await call("post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "KHHUD", name: "Kho hoa hồng", usesLocations: false })).body.id as string;
    const channelId = (await call("post", "/catalog/sales-channels/defaults")).body.find((item: { code: string }) => item.code === "BAN_LE").id as string;
    await assign("other", "banhang.khac@vcomm.test", "Bán Hàng Khác", "salesperson");
    const order = (
      await pool.query<{ id: string }>(
        `INSERT INTO sales.orders (company_id, buyer_name, channel_id, warehouse_id, order_date, currency, created_by, document_no) VALUES ($1, 'Khách lẻ', $2, $3, '2026-11-02', 'VND', $4, 'DBH-UD-1') RETURNING id`,
        [retail, channelId, warehouseId, ids.seller],
      )
    ).rows[0]!.id;
    const line = (
      await pool.query<{ id: string }>(
        `INSERT INTO sales.order_lines (order_id, line_no, variant_id, unit_id, quantity, base_quantity, list_price, price_includes_vat, unit_price, vat_rate, net_amount, tax_amount, total_amount)
         VALUES ($1, 1, $2, $3, 1, 1, 1000000, false, 1000000, '10', 1000000, 100000, 1100000) RETURNING id`,
        [order, variantId, unitId],
      )
    ).rows[0]!.id;
    const document = (
      await pool.query<{ id: string }>(
        `INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason, created_by, source_id) VALUES ($1, $2, 'sales_issue', '2026-11-02', 'Thử', $3, $4) RETURNING id`,
        [retail, warehouseId, ids.seller, order],
      )
    ).rows[0]!.id;
    const event = (userId: string, date: string, base: number, amount: number, source: string) =>
      pool.query(
        `INSERT INTO finance.commission_events (company_id, user_id, order_id, source_type, source_id, document_id, order_line_id, event_date, base_amount, percent, amount)
         VALUES ($1, $2, $3, 'retail_delivery', $4, $5, $6, $7, $8, 2, $9)`,
        [retail, userId, order, source, document, line, date, base, amount],
      );
    await event(ids.seller!, "2026-11-02", 1000000, 20000, "00000000-0000-4000-8000-000000000001");
    await event(ids.seller!, "2026-11-05", -200000, -4000, "00000000-0000-4000-8000-000000000002");
    await event(ids.seller!, "2026-10-30", 500000, 10000, "00000000-0000-4000-8000-000000000003");
    await event(ids.other!, "2026-11-03", 900000, 18000, "00000000-0000-4000-8000-000000000004");
    await pool.query("INSERT INTO finance.commission_targets (company_id, user_id, month, amount) VALUES ($1, $2, '2026-11', 1600000)", [retail, ids.seller]);
    const statement = (
      await pool.query<{ id: string }>("INSERT INTO finance.commission_statements (company_id, month, document_no, status) VALUES ($1, '2026-10', 'HH-10', 'posted') RETURNING id", [retail])
    ).rows[0]!.id;
    await pool.query(
      `INSERT INTO finance.commission_statement_lines (statement_id, user_id, base_amount, commission_before, target_amount, achieved_percent, multiplier, amount) VALUES
       ($1, $2, 500000, 10000, null, null, 1, 10000), ($1, $3, 700000, 14000, null, null, 1, 14000)`,
      [statement, ids.seller, ids.other],
    );

    const token = (await appLogin("banhang.app@vcomm.test")).body.tokens.accessToken as string;
    const mine = await bearer("get", "/finance/my-commissions?month=2026-11", token);
    expect(mine.status, JSON.stringify(mine.body)).toBe(200);
    expect(mine.body).toMatchObject({ month: "2026-11", currency: "VND", baseAmount: "800000", commissionAmount: "16000", targetAmount: "1600000", achievedPercent: "50" });
    expect(mine.body.events.map((item: { date: string; amount: string; orderNo: string }) => [item.date, item.amount, item.orderNo])).toEqual([
      ["2026-11-05", "-4000", "DBH-UD-1"],
      ["2026-11-02", "20000", "DBH-UD-1"],
    ]);
    expect(mine.body.statements).toEqual([{ month: "2026-10", documentNo: "HH-10", status: "posted", baseAmount: "500000", achievedPercent: null, multiplier: "1", amount: "10000" }]);
    expect((await bearer("get", "/finance/my-commissions?month=2026-13", token)).status).toBe(400);
    // Kế toán (không có quyền xem hoa hồng của mình) bị từ chối.
    await assign("accountant", "ketoan.ud@vcomm.test", "Kế Toán Ứng Dụng", "accountant");
    const accountant = (await appLogin("ketoan.ud@vcomm.test")).body.tokens.accessToken as string;
    expect((await bearer("get", "/finance/my-commissions?month=2026-11", accountant)).status).toBe(403);
  });
});
