// CONG_VIEC_65 L1: hợp đồng đối tác liên minh, tỷ lệ theo chiều và giai đoạn, giới hạn, bộ giả lập, liên kết thành viên bằng OTP đối tác
// (KICHBAN_KIEMTHU_705, 706, 716 phần L1; TIEUCHI_NGHIEMTHU_514, 515, 524).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

process.env.LOYALTY_PARTNER_SIMULATOR = "on";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let today: string;
const operator = testIds.retailCompany;
const http = () => request(application.getHttpServer());
const call = (session: Session, method: "get" | "post" | "put" | "delete", path: string, body?: object) => session.call(method, path, { companyId: operator, ...(body ? { body } : {}) });
const noLimit = { minPoints: null, maxPoints: null, customerDailyPoints: null, customerMonthlyPoints: null, partnerMonthlyPoints: null };
const terms = (overrides: object = {}) => ({
  programName: "PN Rewards",
  unitNameVi: "điểm PN",
  unitNameEn: "PN points",
  contractNo: "HDLM-2026/014",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  outboundEnabled: true,
  inboundEnabled: true,
  giftEnabled: false,
  paymentMode: "prepaid",
  creditLimit: null,
  paymentTermDays: 15,
  taxPercent: "10",
  connector: "simulator",
  memberPattern: "^[0-9]{10}$",
  limits: { outbound: { ...noLimit, minPoints: 1000, maxPoints: 500000 }, inbound: noLimit, gift: noLimit },
  ...overrides,
});

async function partner(name: string, taxCode: string): Promise<string> {
  const row = await pool.query<{ id: string }>("INSERT INTO crm.partners (kind, name, tax_code, search_text) VALUES ('organization', $1, $2, lower($1)) RETURNING id", [name, taxCode]);
  return row.rows[0]!.id;
}

async function register(phone: string, name: string): Promise<{ id: string; call: BuyerCall }> {
  const setOtp = () => pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), `+84${phone.slice(1)}`]);
  expect((await http().post("/api/v1/buyer/register/otp").send({ phone })).status).toBe(204);
  await setOtp();
  const created = await http().post("/api/v1/buyer/register").send({ phone, code: "246810", fullName: name, password: "MatKhauNguoiMua@2026" });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  const login = await http().post("/api/v1/buyer/login").send({ phone, password: "MatKhauNguoiMua@2026" });
  const token = login.body.tokens.accessToken as string;
  const buyerCall: BuyerCall = (method, path, body) => {
    const pending = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("accept-language", "vi");
    return body ? pending.send(body) : pending;
  };
  return { id: created.body.user.id as string, call: buyerCall };
}

// Mã OTP bộ giả lập ghi log; kiểm thử đặt mã đã biết theo mã tham chiếu mới nhất.
async function setSimulatorOtp(code: string): Promise<void> {
  await pool.query("UPDATE loyalty.partner_simulator_otps SET code_hash = $1 WHERE reference = (SELECT reference FROM loyalty.partner_simulator_otps ORDER BY created_at DESC LIMIT 1)", [
    createHash("sha256").update(code).digest("hex"),
  ]);
}

async function activeContract(name: string, taxCode: string): Promise<string> {
  const created = await call(admin, "post", "/loyalty/partners", { partnerId: await partner(name, taxCode), ...terms() });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = created.body.id as string;
  expect((await call(admin, "post", `/loyalty/partners/${id}/rates`, { direction: "outbound", startsOn: today, endsOn: null, vcommPoints: 10, partnerUnits: 1, unitPrice: "8" })).status).toBe(201);
  expect((await call(admin, "post", `/loyalty/partners/${id}/rates`, { direction: "inbound", startsOn: today, endsOn: null, vcommPoints: 12, partnerUnits: 1, unitPrice: "11" })).status).toBe(201);
  expect((await call(admin, "post", `/loyalty/partners/${id}/activate`, { version: created.body.version })).status).toBe(201);
  expect((await call(admin, "post", `/loyalty/partners/${id}/simulator/members`, { memberNumber: "9704123456", fullName: "Nguyễn Thị Thảo", phone: "0912345678", balanceUnits: 12400 })).status).toBe(
    201,
  );
  expect((await call(admin, "post", `/loyalty/partners/${id}/simulator/members`, { memberNumber: "9704998877", fullName: "Lê Văn Bình", phone: "0987654321", balanceUnits: 350 })).status).toBe(201);
  return id;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/operator-company", { companyId: operator, body: { companyId: operator } })).status).toBe(200);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  today = application.get(PermissionService).today();
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("KICHBAN_KIEMTHU_705: hợp đồng, tỷ lệ, phân quyền", () => {
  it("tạo hợp đồng nháp, giới hạn lưu đúng; đối tác nội bộ, trùng đối tác, trả sau thiếu hạn mức bị từ chối", async () => {
    const partnerId = await partner("Ngân hàng Phương Nam", "0300000001");
    const created = await call(admin, "post", "/loyalty/partners", { partnerId, ...terms() });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "draft", paymentMode: "prepaid", creditLimit: null, directions: ["outbound", "inbound"], canManage: true });
    expect(created.body.code).toMatch(/^LM\d{4}$/);
    expect(created.body.limits.outbound).toMatchObject({ minPoints: 1000, maxPoints: 500000 });

    expect((await call(admin, "post", "/loyalty/partners", { partnerId, ...terms() })).body.error.message).toBe("Đối tác này đã có hợp đồng liên minh điểm.");
    const internalPartner = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id IS NOT NULL LIMIT 1")).rows[0]!.id;
    const internal = await call(admin, "post", "/loyalty/partners", { partnerId: internalPartner, ...terms() });
    expect(internal.status).toBe(409);
    const postpaid = await call(admin, "post", "/loyalty/partners", { partnerId: await partner("Hãng bay Sao Việt", "0300000003"), ...terms({ paymentMode: "postpaid" }) });
    expect(postpaid.status).toBe(400);
    expect(postpaid.body.error.fields.creditLimit).toBe("Trả sau cần hạn mức nợ; trả trước thì để trống hạn mức.");
    const noDirection = await call(admin, "post", "/loyalty/partners", {
      partnerId: await partner("Hãng bay Cánh Én", "0300000004"),
      ...terms({ outboundEnabled: false, inboundEnabled: false }),
    });
    expect(noDirection.status).toBe(400);
  });

  it("tỷ lệ không chồng lấn trong cùng chiều; đã bắt đầu chỉ sửa ngày kết thúc; chưa bắt đầu xóa được", async () => {
    const created = await call(admin, "post", "/loyalty/partners", { partnerId: await partner("Ví An Bình", "0300000005"), ...terms() });
    const id = created.body.id as string;
    const first = await call(admin, "post", `/loyalty/partners/${id}/rates`, { direction: "outbound", startsOn: today, endsOn: null, vcommPoints: 10, partnerUnits: 1, unitPrice: "8" });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.status).toBe("active");
    const overlap = await call(admin, "post", `/loyalty/partners/${id}/rates`, { direction: "outbound", startsOn: "2099-01-01", endsOn: null, vcommPoints: 9, partnerUnits: 1, unitPrice: "8" });
    expect(overlap.body.error.message).toBe("Giai đoạn tỷ lệ chồng lấn với giai đoạn khác cùng chiều.");
    // Chiều khác không bị chặn; tặng không có tỷ lệ quy đổi.
    expect((await call(admin, "post", `/loyalty/partners/${id}/rates`, { direction: "gift", startsOn: today, endsOn: null, vcommPoints: null, partnerUnits: null, unitPrice: "1.05" })).status).toBe(
      201,
    );
    expect((await call(admin, "post", `/loyalty/partners/${id}/rates`, { direction: "gift", startsOn: "2099-01-01", endsOn: null, vcommPoints: 1, partnerUnits: 1, unitPrice: "1" })).status).toBe(400);
    const past = await call(admin, "post", `/loyalty/partners/${id}/rates`, { direction: "inbound", startsOn: "2020-01-01", endsOn: null, vcommPoints: 12, partnerUnits: 1, unitPrice: "11" });
    expect(past.status).toBe(400);

    const changed = await call(admin, "put", `/loyalty/partner-rates/${first.body.id}`, { startsOn: today, endsOn: null, vcommPoints: 11, partnerUnits: 1, unitPrice: "8", version: 1 });
    expect(changed.body.error.message).toBe("Giai đoạn tỷ lệ đã bắt đầu, chỉ sửa được ngày kết thúc.");
    const ended = await call(admin, "put", `/loyalty/partner-rates/${first.body.id}`, { startsOn: today, endsOn: "2098-12-31", vcommPoints: 10, partnerUnits: 1, unitPrice: "8", version: 1 });
    expect(ended.status, JSON.stringify(ended.body)).toBe(200);
    const next = await call(admin, "post", `/loyalty/partners/${id}/rates`, { direction: "outbound", startsOn: "2099-01-01", endsOn: null, vcommPoints: 9, partnerUnits: 1, unitPrice: "8" });
    expect(next.status).toBe(201);
    expect(next.body.status).toBe("upcoming");
    expect((await call(admin, "delete", `/loyalty/partner-rates/${first.body.id}`)).status).toBe(409);
    expect((await call(admin, "delete", `/loyalty/partner-rates/${next.body.id}`)).status).toBe(204);
  });

  it("trạng thái: kích hoạt, tạm ngưng cần lý do, chấm dứt thì không sửa được và liên kết hết hiệu lực", async () => {
    const created = await call(admin, "post", "/loyalty/partners", { partnerId: await partner("Siêu thị Bình Minh", "0300000006"), ...terms() });
    const id = created.body.id as string;
    const active = await call(admin, "post", `/loyalty/partners/${id}/activate`, { version: created.body.version });
    expect(active.body.status).toBe("active");
    expect((await call(admin, "post", `/loyalty/partners/${id}/suspend`, { version: active.body.version })).status).toBe(400);
    const suspended = await call(admin, "post", `/loyalty/partners/${id}/suspend`, { version: active.body.version, reason: "Tạm dừng đối soát" });
    expect(suspended.body).toMatchObject({ status: "suspended", statusReason: "Tạm dừng đối soát" });
    const terminated = await call(admin, "post", `/loyalty/partners/${id}/terminate`, { version: suspended.body.version, reason: "Hết hợp tác" });
    expect(terminated.body.status).toBe("terminated");
    const edit = await call(admin, "put", `/loyalty/partners/${id}`, { ...terms(), version: terminated.body.version });
    expect(edit.body.error.message).toBe("Hợp đồng đã chấm dứt, không sửa được.");
    expect((await call(admin, "post", `/loyalty/partners/${id}/activate`, { version: terminated.body.version })).status).toBe(409);
  });

  it("chỉ có quyền xem thì không sửa được; không có quyền thì không xem được; danh sách lọc, tìm", async () => {
    await createTestUser(pool, "xem.lienminh.c65@vcomm.test", "Xem Liên Minh", [{ companyId: operator }]);
    const role = await pool.query<{ id: string }>(
      "INSERT INTO core.roles (company_id, code, name_vi, name_en, status) VALUES ($1, 'test_partner_view', 'Xem liên minh', 'Partner view', 'active') RETURNING id",
      [operator],
    );
    await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'crm.access'), ($1, 'loyalty.partner.view')", [role.rows[0]!.id]);
    await pool.query(
      "INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $1, 'company', $2, '2026-01-01' FROM core.users WHERE email = 'xem.lienminh.c65@vcomm.test'",
      [role.rows[0]!.id, operator],
    );
    const viewer = await signIn(application, "xem.lienminh.c65@vcomm.test");
    const list = await call(viewer, "get", "/loyalty/partners?search=ph%C6%B0%C6%A1ng");
    expect(list.status).toBe(200);
    expect(list.body.data.map((item: { partnerName: string }) => item.partnerName)).toEqual(["Ngân hàng Phương Nam"]);
    const detail = await call(viewer, "get", `/loyalty/partners/${list.body.data[0].id}`);
    expect(detail.body.canManage).toBe(false);
    expect((await call(viewer, "post", "/loyalty/partners", { partnerId: await partner("Không được", "0300000007"), ...terms() })).status).toBe(403);
    expect((await call(viewer, "put", `/loyalty/partners/${list.body.data[0].id}/simulator`, { mode: "reject" })).status).toBe(403);

    await createTestUser(pool, "khong.quyen.c65@vcomm.test", "Không Quyền", [{ companyId: operator }]);
    const outsider = await signIn(application, "khong.quyen.c65@vcomm.test");
    expect((await call(outsider, "get", "/loyalty/partners")).status).toBe(403);
  });
});

describe("KICHBAN_KIEMTHU_706: liên kết thành viên bằng OTP đối tác", () => {
  let contractId: string;
  let thao: { id: string; call: BuyerCall };
  let binh: { id: string; call: BuyerCall };

  beforeAll(async () => {
    contractId = await activeContract("Hãng bay Phương Đông", "0300000010");
    thao = await register("0912000101", "Nguyễn Thị Thảo");
    binh = await register("0912000102", "Lê Văn Bình");
  });

  it("danh sách đối tác có tỷ lệ hôm nay; liên kết bằng OTP đúng; số thành viên che", async () => {
    const list = await thao.call("get", "/buyer/loyalty/partners");
    expect(list.status).toBe(200);
    const item = list.body.find((entry: { id: string }) => entry.id === contractId);
    expect(item).toMatchObject({ outbound: { vcommPoints: 10, partnerUnits: 1 }, inbound: { vcommPoints: 12, partnerUnits: 1 }, link: null });

    const requested = await thao.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704123456" });
    expect(requested.status, JSON.stringify(requested.body)).toBe(201);
    await setSimulatorOtp("482190");
    const wrong = await thao.call("post", `/buyer/loyalty/partner-links/${requested.body.requestId}/verify`, { otp: "000000" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.otp).toBe("Mã OTP không đúng hoặc đã hết hạn.");
    const linked = await thao.call("post", `/buyer/loyalty/partner-links/${requested.body.requestId}/verify`, { otp: "482190" });
    expect(linked.status, JSON.stringify(linked.body)).toBe(200);
    expect(linked.body.link).toMatchObject({ memberNumberMasked: "*******456", memberNameMasked: "Ng**** Th* Thảo" });
    // Liên kết lần nữa với cùng đối tác bị từ chối.
    expect((await thao.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704998877" })).body.error.message).toBe("Bạn đã liên kết thành viên với đối tác này.");
  });

  it("sai mẫu số thành viên; số đã liên kết tài khoản khác; số đối tác không có; mã hết hạn", async () => {
    const pattern = await binh.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "AB12" });
    expect(pattern.status).toBe(400);
    expect(pattern.body.error.fields.memberNumber).toBe("Số thành viên không đúng định dạng.");
    expect((await binh.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704123456" })).body.error.message).toBe("Số thành viên đã liên kết với tài khoản VComm khác.");
    expect((await binh.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704000000" })).body.error.message).toBe("Đối tác không xác nhận số thành viên này.");
    const requested = await binh.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704998877" });
    expect(requested.status).toBe(201);
    await pool.query("UPDATE loyalty.partner_link_requests SET expires_at = now() - interval '1 second' WHERE id = $1", [requested.body.requestId]);
    expect((await binh.call("post", `/buyer/loyalty/partner-links/${requested.body.requestId}/verify`, { otp: "123456" })).body.error.message).toBe("Mã OTP không đúng hoặc đã hết hạn.");
    // Yêu cầu của người khác không xem được.
    expect((await thao.call("post", `/buyer/loyalty/partner-links/${requested.body.requestId}/verify`, { otp: "123456" })).status).toBe(404);
  });

  it("lần gửi mã thứ 6 trong một giờ bị từ chối", async () => {
    const recent = await pool.query<{ total: number }>("SELECT count(*)::int AS total FROM loyalty.partner_link_requests WHERE user_id = $1 AND contract_id = $2", [binh.id, contractId]);
    for (let index = recent.rows[0]!.total; index < 5; index += 1) {
      expect((await binh.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704998877" })).status).toBe(201);
    }
    const sixth = await binh.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704998877" });
    expect(sixth.status).toBe(429);
  });

  it("bộ giả lập từ chối, không trả lời; hủy liên kết; hợp đồng tạm ngưng thì không liên kết được", async () => {
    const dung = await register("0912000103", "Phạm Văn Dũng");
    await call(admin, "post", `/loyalty/partners/${contractId}/simulator/members`, { memberNumber: "9704555666", fullName: "Phạm Văn Dũng", phone: "0912000103", balanceUnits: 0 });
    expect((await call(admin, "put", `/loyalty/partners/${contractId}/simulator`, { mode: "timeout" })).body.mode).toBe("timeout");
    expect((await dung.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704555666" })).body.error.message).toBe("Không kết nối được đối tác, vui lòng thử lại sau.");
    await call(admin, "put", `/loyalty/partners/${contractId}/simulator`, { mode: "reject" });
    expect((await dung.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704555666" })).body.error.message).toBe("Đối tác không xác nhận số thành viên này.");
    await call(admin, "put", `/loyalty/partners/${contractId}/simulator`, { mode: "normal" });

    expect((await thao.call("delete", `/buyer/loyalty/partners/${contractId}/link`)).status).toBe(204);
    expect((await thao.call("delete", `/buyer/loyalty/partners/${contractId}/link`)).body.error.message).toBe("Chưa liên kết thành viên đối tác.");
    const detail = await call(admin, "get", `/loyalty/partners/${contractId}`);
    await call(admin, "post", `/loyalty/partners/${contractId}/suspend`, { version: detail.body.version, reason: "Bảo trì" });
    expect((await thao.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704123456" })).body.error.message).toBe("Đối tác chưa hoạt động hoặc hợp đồng hết hạn.");
    expect((await thao.call("get", "/buyer/loyalty/partners")).body.some((entry: { id: string }) => entry.id === contractId)).toBe(false);
  });
});

describe("KICHBAN_KIEMTHU_716 (phần L1): bộ giả lập theo biến môi trường, không ghi dữ liệu nhạy cảm", () => {
  it("tắt biến môi trường thì kết nối báo lỗi; nhật ký thao tác không có số thành viên", async () => {
    const contractId = await activeContract("Ngân hàng Sông Hồng", "0300000020");
    const buyer = await register("0912000201", "Trần Minh Khoa");
    process.env.LOYALTY_PARTNER_SIMULATOR = "off";
    try {
      expect((await buyer.call("post", `/buyer/loyalty/partners/${contractId}/link`, { memberNumber: "9704123456" })).body.error.message).toBe("Kết nối đối tác chưa sẵn sàng trên môi trường này.");
      expect((await call(admin, "get", `/loyalty/partners/${contractId}/simulator`)).body.enabled).toBe(false);
      expect((await call(admin, "put", `/loyalty/partners/${contractId}/simulator`, { mode: "reject" })).status).toBe(409);
    } finally {
      process.env.LOYALTY_PARTNER_SIMULATOR = "on";
    }
    const audit = await pool.query<{ data: string }>("SELECT coalesce(after_data::text, '') AS data FROM core.audit_events WHERE entity_type = 'loyalty_partner_contract'");
    expect(audit.rows.length).toBeGreaterThan(0);
    expect(audit.rows.some((row) => row.data.includes("9704123456"))).toBe(false);
    // Bộ giả lập chỉ lưu băm của mã OTP.
    const otps = await pool.query<{ code_hash: string }>("SELECT code_hash FROM loyalty.partner_simulator_otps");
    expect(otps.rows.every((row) => /^[0-9a-f]{64}$/.test(row.code_hash))).toBe(true);
  });
});
