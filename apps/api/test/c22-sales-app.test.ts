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
  // Nhân viên bán hàng thứ hai dùng ở kiểm thử ghé thăm (trước CONG_VIEC_43 được tạo trong kiểm thử hoa hồng của tôi đã bỏ).
  await assign("other", "banhang.khac@vcomm.test", "Bán Hàng Khác", "salesperson");
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
  it("KICHBAN_KIEMTHU_289: tóm tắt khách: liên hệ, phải thu còn lại sau khi trừ trả trước, phần quá hạn, đơn gần đây; không có hạn mức; xem mọi đối tác của công ty (CONG_VIEC_43)", async () => {
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
    // CONG_VIEC_43 (QUYTAC_NGHIEPVU_279): nhân viên thêm đối tác không còn tự có hồ sơ khách hàng; hồ sơ do người quản lý hồ sơ lập (thanh toán ngay).
    await pool.query("INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier, payment_term_days, credit_limit, status) VALUES ($1, $2, true, false, 0, 0, 'active')", [
      retail,
      partnerId,
    ]);
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
    // CONG_VIEC_43 (QUYTAC_NGHIEPVU_279): đối tác không do mình phụ trách vẫn xem được.
    const other = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id IS NOT NULL LIMIT 1")).rows[0]!.id;
    expect((await bearer("get", `/crm/partners/${other}/summary`, token)).status).toBe(200);
  });
});

describe("CONG_VIEC_22 ghé thăm khách", () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
  const visit = (token: string, fields: Record<string, string>, photos: { content: Buffer; name: string }[] = []) => {
    let call = http().post("/api/v1/crm/visits").set("authorization", `Bearer ${token}`).set("x-company-id", retail).set("accept-language", "vi");
    for (const [key, value] of Object.entries(fields)) call = call.field(key, value);
    for (const photo of photos) call = call.attach("photos", photo.content, photo.name);
    return call;
  };
  const location = { latitude: "10.776889", longitude: "106.700806", accuracyMeters: "12.5" };

  it("KICHBAN_KIEMTHU_290: ghi lượt ghé thăm bắt buộc vị trí, ghi chú; 0 đến 3 ảnh JPEG, PNG kiểm theo nội dung, tối đa 5 MB; chỉ khách hàng đang giao dịch của công ty", async () => {
    const token = (await appLogin("banhang.app@vcomm.test")).body.tokens.accessToken as string;
    const partnerId = (await bearer("get", "/crm/partners?search=0322000002", token)).body.data[0].id as string;
    const created = await visit(token, { partnerId, ...location, note: "Khách hẹn đặt hàng tuần sau" }, [
      { content: png, name: "a.png" },
      { content: jpeg, name: "b.jpg" },
    ]);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ partnerId, userName: "Bán Hàng Ứng Dụng", latitude: "10.776889", longitude: "106.700806", accuracyMeters: "12.5", note: "Khách hẹn đặt hàng tuần sau" });
    expect(created.body.photoIds).toHaveLength(2);
    const photo = await bearer("get", `/crm/visits/${created.body.id}/photos/${created.body.photoIds[0]}`, token);
    expect(photo.status).toBe(200);
    expect(photo.headers["content-type"]).toBe("image/png");
    // Thiếu vị trí, thiếu ghi chú, vĩ độ sai.
    expect((await visit(token, { partnerId, note: "Không có vị trí" })).status).toBe(400);
    expect((await visit(token, { partnerId, ...location, note: " " })).status).toBe(400);
    expect((await visit(token, { partnerId, ...location, latitude: "91", note: "Sai vĩ độ" })).status).toBe(400);
    // Ảnh giả (phần mở rộng .jpg nhưng nội dung không phải ảnh), quá nhiều ảnh, quá lớn.
    const fake = await visit(token, { partnerId, ...location, note: "Ảnh giả" }, [{ content: Buffer.from("not an image"), name: "x.jpg" }]);
    expect(fake.status).toBe(400);
    expect(Object.keys(fake.body.error.fields)).toEqual(["photos.0"]);
    const many = await visit(
      token,
      { partnerId, ...location, note: "Nhiều ảnh" },
      [1, 2, 3, 4].map((index) => ({ content: png, name: `${index}.png` })),
    );
    expect(many.status).toBe(400);
    expect(many.body.error.fields.photos).toBe("Tối đa 3 ảnh mỗi lượt ghé thăm.");
    const large = await visit(token, { partnerId, ...location, note: "Ảnh lớn" }, [{ content: Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]), name: "big.png" }]);
    expect(large.status).toBe(400);
    expect(large.body.error.fields["photos.0"]).toBe("Ảnh vượt quá 5 MB.");
    // Đối tác chưa có hồ sơ khách hàng ở công ty.
    const other = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id IS NOT NULL LIMIT 1")).rows[0]!.id;
    const outside = await visit(token, { partnerId: other, ...location, note: "Ngoài phạm vi" });
    expect(outside.status).toBe(400);
    expect(outside.body.error.fields.partnerId).toBeDefined();
    expect((await pool.query("SELECT count(*)::int AS total FROM crm.visits")).rows[0].total).toBe(1);
  });

  it("KICHBAN_KIEMTHU_291: xem ghé thăm: người có quyền xem đối tác thấy mọi lượt, ảnh của công ty (CONG_VIEC_43); lọc theo khách, ngày", async () => {
    const seller = (await appLogin("banhang.app@vcomm.test")).body.tokens.accessToken as string;
    const other = (await appLogin("banhang.khac@vcomm.test")).body.tokens.accessToken as string;
    const mine = (await bearer("get", "/crm/visits", seller)).body;
    expect(mine.total).toBe(1);
    const visitId = mine.data[0].id as string;
    // CONG_VIEC_43 (QUYTAC_NGHIEPVU_279): nhân viên khác cũng thấy lượt, ảnh; lọc theo nhân viên ghi.
    expect((await bearer("get", "/crm/visits", other)).body.total).toBe(1);
    expect((await bearer("get", `/crm/visits/${visitId}`, other)).status).toBe(200);
    expect((await bearer("get", `/crm/visits/${visitId}/photos/${mine.data[0].photoIds[0]}`, other)).status).toBe(200);
    expect((await bearer("get", `/crm/visits?userId=${ids.other}`, other)).body.total).toBe(0);
    const staff = (await bearer("get", "/crm/visit-options", other)).body.users.map((user: { fullName: string }) => user.fullName);
    expect(staff).toEqual(expect.arrayContaining(["Bán Hàng Ứng Dụng", "Bán Hàng Khác"]));
    const admin = await signIn(application, "quantri.vcr@vcomm.test");
    const all = await admin.call("get", `/crm/visits?partnerId=${mine.data[0].partnerId}`, { companyId: retail });
    expect(all.body.total).toBe(1);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    expect((await admin.call("get", `/crm/visits?from=${today}&to=${today}`, { companyId: retail })).body.total).toBe(1);
    expect((await admin.call("get", "/crm/visits?from=2020-01-01&to=2020-01-31", { companyId: retail })).body.total).toBe(0);
  });
});
