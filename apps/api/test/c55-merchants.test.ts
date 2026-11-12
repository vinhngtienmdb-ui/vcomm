// CONG_VIEC_55 L0: hợp đồng cửa hàng liên kết, điểm bán, mời và kích hoạt thành viên, phân quyền
// (KICHBAN_KIEMTHU_533, 534, 535; TIEUCHI_NGHIEMTHU_368, 369).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, sessionFrom, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
const operator = testIds.retailCompany;
const http = () => request(application.getHttpServer());
const call = (session: Session, method: "get" | "post" | "put", path: string, body?: object) => session.call(method, path, { companyId: operator, ...(body ? { body } : {}) });
const terms = {
  contractNo: "HDLK-2026/001",
  startsOn: "2026-01-01",
  endsOn: null,
  earnPercent: "2",
  feePercent: "8",
  creditLimit: "50000000",
  transactionCap: "5000000",
  paymentTermDays: 7,
  autoConfirmDays: 3,
};

async function partner(name: string, taxCode: string, companyId: string | null = null): Promise<string> {
  const row = await pool.query<{ id: string }>("INSERT INTO crm.partners (kind, name, tax_code, company_id, search_text) VALUES ('organization', $1, $2, $3, lower($1)) RETURNING id", [
    name,
    taxCode,
    companyId,
  ]);
  return row.rows[0]!.id;
}

// Kích hoạt lời mời: đặt mã OTP đã biết rồi gọi API kích hoạt; trả phiên web của thành viên.
async function activate(phone: string): Promise<Session> {
  expect((await http().post("/api/v1/merchant-portal/activation/otp").send({ phone })).status).toBe(204);
  const updated = await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("135790").digest("hex"), `+84${phone.slice(1)}`]);
  expect(updated.rowCount).toBe(1);
  const response = await http().post("/api/v1/merchant-portal/activation").send({ phone, code: "135790" });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return sessionFrom(application, response.headers["set-cookie"]);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: operator, body: { companyId: operator } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_55 cửa hàng liên kết", () => {
  let merchantId: string;
  let version: number;
  let outletA: string;
  let outletB: string;

  it("KICHBAN_KIEMTHU_533: hợp đồng chỉ cho đối tác ngoài; kích hoạt cần điểm bán; tạm ngưng cần lý do; phân quyền", async () => {
    const existing = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [testIds.tradingCompany])).rows[0]?.id;
    const internal = existing ?? (await partner("Công ty con nội bộ", "0300000001", testIds.tradingCompany));
    const rejected = await call(admin, "post", "/affiliate/merchants", { partnerId: internal, ...terms });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.message).toBe("Cửa hàng liên kết phải là đối tác ngoài tập đoàn.");

    const outside = await partner("Công ty TNHH Cà phê Hạt Nâu", "0311111111");
    expect((await call(admin, "post", "/affiliate/merchants", { partnerId: outside, ...terms, earnPercent: "25" })).status).toBe(400);
    expect((await call(admin, "post", "/affiliate/merchants", { partnerId: outside, ...terms, endsOn: "2025-12-31" })).status).toBe(400);
    const created = await call(admin, "post", "/affiliate/merchants", { partnerId: outside, ...terms });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "draft", name: "Công ty TNHH Cà phê Hạt Nâu", earnPercent: "2", feePercent: "8", creditLimit: "50000000" });
    expect(created.body.code).toMatch(/^CH\d{6}$/);
    merchantId = created.body.id;
    version = created.body.version;
    expect((await call(admin, "post", "/affiliate/merchants", { partnerId: outside, ...terms })).body.error.message).toBe("Đối tác này đã có hợp đồng cửa hàng liên kết.");

    const noOutlet = await call(admin, "post", `/affiliate/merchants/${merchantId}/activate`, { version });
    expect(noOutlet.body.error.message).toBe("Cửa hàng cần ít nhất một điểm bán đang hoạt động.");
    outletA = (await call(admin, "post", `/affiliate/merchants/${merchantId}/outlets`, { name: "Lê Lợi", address: "12 Lê Lợi, TP Hồ Chí Minh" })).body.id;
    outletB = (await call(admin, "post", `/affiliate/merchants/${merchantId}/outlets`, { name: "Nguyễn Huệ", address: "88 Nguyễn Huệ, TP Hồ Chí Minh" })).body.id;
    const duplicate = await call(admin, "post", `/affiliate/merchants/${merchantId}/outlets`, { name: "Lê Lợi", address: "khác" });
    expect(duplicate.status).toBe(400);
    const activated = await call(admin, "post", `/affiliate/merchants/${merchantId}/activate`, { version });
    expect(activated.status, JSON.stringify(activated.body)).toBe(201);
    expect(activated.body.status).toBe("active");
    version = activated.body.version;

    // Sửa điều khoản có phiên bản; sai phiên bản bị từ chối.
    expect((await call(admin, "put", `/affiliate/merchants/${merchantId}`, { ...terms, earnPercent: "3", version: version - 1 })).status).toBe(409);
    const updated = await call(admin, "put", `/affiliate/merchants/${merchantId}`, { ...terms, earnPercent: "3", version });
    expect(updated.body.earnPercent).toBe("3");
    version = updated.body.version;

    expect((await call(admin, "post", `/affiliate/merchants/${merchantId}/suspend`, { version })).status).toBe(400);
    const suspended = await call(admin, "post", `/affiliate/merchants/${merchantId}/suspend`, { version, reason: "Chậm thanh toán" });
    expect(suspended.body).toMatchObject({ status: "suspended", statusReason: "Chậm thanh toán" });
    const resumed = await call(admin, "post", `/affiliate/merchants/${merchantId}/activate`, { version: suspended.body.version });
    version = resumed.body.version;
    expect(resumed.body.status).toBe("active");

    const list = await call(admin, "get", "/affiliate/merchants?search=hạt nâu");
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ id: merchantId, outletCount: 2 });

    // Nhân viên không có quyền affiliate.view bị từ chối.
    await createTestUser(pool, "khong.quyen.c55@vcomm.test", "Không Quyền", [{ companyId: operator }]);
    const outsider = await signIn(application, "khong.quyen.c55@vcomm.test");
    expect((await call(outsider, "get", "/affiliate/merchants")).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_534: mời chủ, kích hoạt bằng số điện thoại và OTP, chủ mời thu ngân gán điểm bán; lời mời hết hạn", async () => {
    const invited = await call(admin, "post", `/affiliate/merchants/${merchantId}/owner-invitations`, { fullName: "Trần Minh Khoa", phone: "0909111222" });
    expect(invited.status, JSON.stringify(invited.body)).toBe(201);
    expect(invited.body[0]).toMatchObject({ role: "owner", status: "invited", phone: "+84909111222" });
    expect(invited.body[0].invitationExpiresAt).not.toBeNull();

    // Số không có lời mời: vẫn trả 204, không tạo mã OTP.
    expect((await http().post("/api/v1/merchant-portal/activation/otp").send({ phone: "0909999000" })).status).toBe(204);
    expect((await pool.query("SELECT 1 FROM core.otp_codes WHERE phone = '+84909999000'")).rowCount).toBe(0);
    // Sai mã bị từ chối.
    expect((await http().post("/api/v1/merchant-portal/activation/otp").send({ phone: "0909111222" })).status).toBe(204);
    expect((await http().post("/api/v1/merchant-portal/activation").send({ phone: "0909111222", code: "000000" })).status).toBe(401);

    const owner = await activate("0909111222");
    const me = await owner.call("get", "/merchant-portal/me");
    expect(me.body.fullName).toBe("Trần Minh Khoa");
    expect(me.body.memberships).toHaveLength(1);
    expect(me.body.memberships[0]).toMatchObject({ merchantId, role: "owner" });
    expect(me.body.memberships[0].outlets).toHaveLength(2);

    const store = await owner.call("get", "/merchant-portal/store");
    expect(store.body).toMatchObject({ merchantId, earnPercent: "3", status: "active" });

    const cashier = await owner.call("post", "/merchant-portal/members", { body: { fullName: "Lê Thu Hà", phone: "0912333444", outletIds: [outletA] } });
    expect(cashier.status, JSON.stringify(cashier.body)).toBe(201);
    const pending = cashier.body.find((member: { phone: string }) => member.phone === "+84912333444");
    expect(pending).toMatchObject({ role: "cashier", status: "invited", outletIds: [outletA] });
    // Điểm bán của cửa hàng khác bị từ chối.
    expect((await owner.call("post", "/merchant-portal/members", { body: { fullName: "X", phone: "0912333555", outletIds: ["00000000-0000-0000-0000-000000000001"] } })).status).toBe(400);

    // Lời mời quá hạn không kích hoạt được.
    await owner.call("post", "/merchant-portal/members", { body: { fullName: "Phạm Văn Tú", phone: "0933555666", outletIds: [outletA, outletB] } });
    await pool.query("UPDATE affiliate.members SET invitation_expires_at = now() - interval '1 minute' WHERE phone = '+84933555666'");
    expect((await http().post("/api/v1/merchant-portal/activation/otp").send({ phone: "0933555666" })).status).toBe(204);
    expect((await pool.query("SELECT 1 FROM core.otp_codes WHERE phone = '+84933555666'")).rowCount).toBe(0);

    const cashierSession = await activate("0912333444");
    const cashierMe = await cashierSession.call("get", "/merchant-portal/me");
    expect(cashierMe.body.memberships[0]).toMatchObject({ role: "cashier" });
    expect(cashierMe.body.memberships[0].outlets.map((outlet: { id: string }) => outlet.id)).toEqual([outletA]);
    // Thu ngân không xem cửa hàng, không mời được.
    expect((await cashierSession.call("get", "/merchant-portal/store")).status).toBe(403);
    expect((await cashierSession.call("post", "/merchant-portal/members", { body: { fullName: "Y", phone: "0912000111", outletIds: [outletA] } })).status).toBe(403);

    // Chủ đổi điểm bán, khóa, mở thu ngân; không khóa được chủ khác.
    const active = (await owner.call("get", "/merchant-portal/store")).body.members.find((member: { phone: string }) => member.phone === "+84912333444");
    const moved = await owner.call("put", `/merchant-portal/members/${active.id}`, { body: { outletIds: [outletA, outletB], version: active.version } });
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    const after = moved.body.find((member: { id: string }) => member.id === active.id);
    const locked = await owner.call("post", `/merchant-portal/members/${active.id}/lock`, { body: { version: after.version } });
    expect(locked.body.find((member: { id: string }) => member.id === active.id).status).toBe("locked");
    expect((await cashierSession.call("get", "/merchant-portal/store")).status).toBe(403);
    expect((await cashierSession.call("get", "/merchant-portal/me")).body.memberships).toHaveLength(0);
    const ownerRow = locked.body.find((member: { role: string }) => member.role === "owner");
    expect((await owner.call("post", `/merchant-portal/members/${ownerRow.id}/lock`, { body: { version: ownerRow.version } })).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_535: cửa hàng không thấy dữ liệu cửa hàng khác; công ty khóa chủ cửa hàng", async () => {
    const other = await partner("Tiệm bánh Mây", "0322222222");
    const created = await call(admin, "post", "/affiliate/merchants", { partnerId: other, ...terms, contractNo: "HDLK-2026/002" });
    const otherId = created.body.id as string;
    await call(admin, "post", `/affiliate/merchants/${otherId}/outlets`, { name: "Quận 3", address: "1 Võ Văn Tần" });
    await call(admin, "post", `/affiliate/merchants/${otherId}/activate`, { version: created.body.version });
    await call(admin, "post", `/affiliate/merchants/${otherId}/owner-invitations`, { fullName: "Ngô Thị Mây", phone: "0977000111" });
    const otherOwner = await activate("0977000111");
    // Gửi cửa hàng khác qua header: không phải thành viên thì bị từ chối.
    const forged = await otherOwner.call("get", "/merchant-portal/store").set("x-merchant-id", merchantId);
    expect(forged.status).toBe(403);
    const own = await otherOwner.call("get", "/merchant-portal/store");
    expect(own.body.merchantId).toBe(otherId);
    expect(own.body.members.map((member: { phone: string }) => member.phone)).toEqual(["+84977000111"]);

    const detail = await call(admin, "get", `/affiliate/merchants/${otherId}`);
    const ownerMember = detail.body.members[0];
    const locked = await call(admin, "post", `/affiliate/members/${ownerMember.id}/lock`, { version: ownerMember.version });
    expect(locked.body[0].status).toBe("locked");
    expect((await otherOwner.call("get", "/merchant-portal/store")).status).toBe(403);
  });
});
