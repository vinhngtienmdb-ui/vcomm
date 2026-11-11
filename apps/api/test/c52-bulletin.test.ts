// CONG_VIEC_52 lát L3: bảng tin nội bộ (TIEUCHI_NGHIEMTHU_347; KICHBAN_KIEMTHU_506, phần bảng tin của 507).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { OfficePostsService } from "../src/office/office-posts.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let poster: Session;
let sales: Session;
let accountant: Session;
let warehouse: Session;
let groupPoster: Session;
let tradingStaff: Session;
const ids: Record<string, string> = {};
const retail = testIds.retailCompany;
const trading = testIds.tradingCompany;
const pdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\n");

async function user(
  email: string,
  name: string,
  companyId: string,
  roleCodes: string[],
  unit: { departmentId?: string; branchId?: string } = {},
  scope: "company" | "group" = "company",
): Promise<string> {
  const id = await createTestUser(pool, email, name, [{ companyId, branchId: unit.branchId }]);
  for (const code of roleCodes) {
    const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND (company_id IS NULL OR company_id = $2) ORDER BY company_id NULLS LAST LIMIT 1", [code, companyId]))
      .rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, $3, $4, '2026-01-01')", [
      id,
      role,
      scope,
      scope === "group" ? null : companyId,
    ]);
  }
  if (unit.departmentId) await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = $2", [unit.departmentId, id]);
  return id;
}

const post = (extra: Record<string, unknown> = {}) => ({
  title: "Lịch họp giao ban tháng 12",
  body: "Kính gửi các anh chị,\n\n**Họp giao ban** lúc 8 giờ thứ Hai.\n- Phòng họp tầng 3\n- Xem [lịch chi tiết](https://vcomm.vn/lich)",
  audienceType: "company",
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  ids.salesDepartment = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KD', 'Phòng Kinh doanh') RETURNING id", [retail])).rows[0]!.id;
  ids.accountingDepartment = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KT', 'Phòng Kế toán') RETURNING id", [retail])).rows[0]!.id;
  ids.posterRole = (await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en) VALUES ($1, 'dang_tin', 'Đăng tin', 'Poster') RETURNING id", [retail])).rows[0]!.id;
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'office.access'), ($1, 'office.bulletin.post')", [ids.posterRole]);
  ids.groupRole = (
    await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en) VALUES (NULL, 'dang_tin_tap_doan', 'Đăng tin tập đoàn', 'Group poster') RETURNING id")
  ).rows[0]!.id;
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'office.access'), ($1, 'office.bulletin.post')", [ids.groupRole]);
  ids.poster = await user("hanh.chinh@vcomm.test", "Hồ Thị Hành", retail, ["employee", "dang_tin"]);
  ids.sales = await user("kinh.doanh@vcomm.test", "Phan Văn Bán", retail, ["employee"], { departmentId: ids.salesDepartment });
  ids.accountant = await user("ke.toan.tin@vcomm.test", "Đinh Thị Toán", retail, ["employee"], { departmentId: ids.accountingDepartment });
  ids.warehouse = await user("kho.tin@vcomm.test", "Lý Văn Kho", retail, ["employee"], { branchId: testIds.binhDuongWarehouse });
  ids.groupPoster = await user("truyen.thong@vcomm.test", "Tạ Văn Thông", retail, ["employee", "dang_tin_tap_doan"], {}, "group");
  ids.tradingStaff = await user("nhan.vien.vct@vcomm.test", "Cao Thị Thương", trading, ["employee"]);
  poster = await signIn(application, "hanh.chinh@vcomm.test");
  sales = await signIn(application, "kinh.doanh@vcomm.test");
  accountant = await signIn(application, "ke.toan.tin@vcomm.test");
  warehouse = await signIn(application, "kho.tin@vcomm.test");
  groupPoster = await signIn(application, "truyen.thong@vcomm.test");
  tradingStaff = await signIn(application, "nhan.vien.vct@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

const feedIds = async (session: Session, companyId: string = retail) => ((await session.call("get", "/office/posts", { companyId })).body.data as { id: string }[]).map((item) => item.id);

describe("KICHBAN_KIEMTHU_506: bảng tin nội bộ", () => {
  it("đúng đối tượng: toàn công ty, phòng ban, chi nhánh; toàn tập đoàn cần quyền phạm vi tập đoàn", async () => {
    const all = await poster.call("post", "/office/posts", { companyId: retail, body: post() });
    expect(all.status).toBe(201);
    expect(all.body).toMatchObject({ state: "published", audienceType: "company", allowedActions: expect.arrayContaining(["edit", "revoke", "view_readers"]) });
    const salesOnly = await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Chỉ tiêu Kinh doanh", audienceType: "units", departmentIds: [ids.salesDepartment] }) });
    const warehouseOnly = await poster.call("post", "/office/posts", {
      companyId: retail,
      body: post({ title: "Kiểm kê kho Bình Dương", audienceType: "units", branchIds: [testIds.binhDuongWarehouse] }),
    });
    expect(salesOnly.body.audienceText).toBe("Phòng Kinh doanh");
    // Người đăng không tính là người nhận, không ghi đã đọc cho chính mình.
    const companyReaders = (await poster.call("get", `/office/posts/${all.body.id}/readers`, { companyId: retail })).body as { person: { id: string } }[];
    expect(companyReaders.map((reader) => reader.person.id)).toEqual(expect.arrayContaining([ids.sales, ids.accountant, ids.warehouse]));
    expect(companyReaders.map((reader) => reader.person.id)).not.toContain(ids.poster);
    expect(await feedIds(sales)).toEqual(expect.arrayContaining([all.body.id, salesOnly.body.id]));
    expect(await feedIds(sales)).not.toContain(warehouseOnly.body.id);
    expect(await feedIds(accountant)).not.toContain(salesOnly.body.id);
    expect(await feedIds(warehouse)).toEqual(expect.arrayContaining([all.body.id, warehouseOnly.body.id]));
    // Không thuộc đối tượng: không mở được tin.
    expect((await accountant.call("get", `/office/posts/${salesOnly.body.id}`, { companyId: retail })).status).toBe(404);
    // Công ty khác không thấy tin của công ty.
    expect(await feedIds(tradingStaff, trading)).not.toContain(all.body.id);
    // Người không có quyền đăng: 403; người có quyền công ty không đăng toàn tập đoàn.
    expect((await sales.call("post", "/office/posts", { companyId: retail, body: post() })).status).toBe(403);
    const groupDenied = await poster.call("post", "/office/posts", { companyId: retail, body: post({ audienceType: "group" }) });
    expect(groupDenied.status).toBe(400);
    expect(groupDenied.body.error.fields.audienceType).toBeTruthy();
    const group = await groupPoster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Thông báo toàn tập đoàn", audienceType: "group" }) });
    expect(group.status).toBe(201);
    expect(await feedIds(tradingStaff, trading)).toContain(group.body.id);
    expect(await feedIds(sales)).toContain(group.body.id);
    // Đối tượng chi nhánh, phòng ban phải thuộc công ty; đường dẫn chỉ http, https.
    expect((await poster.call("post", "/office/posts", { companyId: retail, body: post({ audienceType: "units" }) })).status).toBe(400);
    expect((await poster.call("post", "/office/posts", { companyId: retail, body: post({ body: "Bấm [đây](javascript:alert(1))" }) })).status).toBe(400);
  });

  it("hẹn giờ: chưa đến giờ không hiện; đến giờ thông báo người nhận khi cần xác nhận đọc, mỗi tin một lần", async () => {
    const publishAt = new Date(Date.now() + 3_600_000).toISOString();
    const created = await poster.call("post", "/office/posts", {
      companyId: retail,
      body: post({ title: "Quy định chấm công mới", audienceType: "units", departmentIds: [ids.salesDepartment], publishAt, requiresAcknowledgement: true }),
    });
    expect(created.body.state).toBe("scheduled");
    expect(await feedIds(sales)).not.toContain(created.body.id);
    const notificationsOf = async (userId: string | undefined) =>
      (await pool.query("SELECT count(*)::int AS count FROM core.notifications WHERE user_id = $1 AND kind = 'office_post' AND payload->>'postId' = $2", [userId, created.body.id])).rows[0].count;
    expect(await notificationsOf(ids.sales)).toBe(0);
    // Đến giờ đăng: việc nền gửi thông báo cho người nhận, không gửi người ngoài đối tượng.
    await pool.query("UPDATE office.posts SET publish_at = now() - interval '1 minute' WHERE id = $1", [created.body.id]);
    await application.get(OfficePostsService).publishDue();
    await application.get(OfficePostsService).publishDue();
    expect(await notificationsOf(ids.sales)).toBe(1);
    expect(await notificationsOf(ids.accountant)).toBe(0);
    expect(await feedIds(sales)).toContain(created.body.id);
    // Tin thường không gửi thông báo.
    const normal = await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Tin thường" }) });
    expect((await pool.query("SELECT count(*)::int AS count FROM core.notifications WHERE payload->>'postId' = $1", [normal.body.id])).rows[0].count).toBe(0);
  });

  it("đã đọc, xác nhận đã đọc; người đăng xem danh sách chưa đọc; người nhận không xem được danh sách", async () => {
    const created = await poster.call("post", "/office/posts", {
      companyId: retail,
      body: post({ title: "Nội quy phòng cháy", audienceType: "units", departmentIds: [ids.salesDepartment, ids.accountingDepartment], requiresAcknowledgement: true }),
    });
    const id = created.body.id;
    const list = (await sales.call("get", "/office/posts?unread=true", { companyId: retail })).body.data as { id: string; isRead: boolean }[];
    expect(list.find((item) => item.id === id)?.isRead).toBe(false);
    const opened = await sales.call("get", `/office/posts/${id}`, { companyId: retail });
    expect(opened.body.isRead).toBe(true);
    expect(opened.body.allowedActions).toContain("acknowledge");
    expect(opened.body.readStats).toBeNull();
    const acknowledged = await sales.call("post", `/office/posts/${id}/acknowledge`, { companyId: retail });
    expect(acknowledged.status).toBe(200);
    expect(acknowledged.body.acknowledgedAt).not.toBeNull();
    expect(acknowledged.body.allowedActions).not.toContain("acknowledge");
    expect((await sales.call("get", `/office/posts/${id}/readers`, { companyId: retail })).status).toBe(403);
    const readers = (await poster.call("get", `/office/posts/${id}/readers`, { companyId: retail })).body as { person: { id: string }; readAt: string | null; acknowledgedAt: string | null }[];
    expect(readers).toHaveLength(2);
    // Chưa đọc lên trước.
    expect(readers[0]).toMatchObject({ person: { id: ids.accountant }, readAt: null, acknowledgedAt: null });
    expect(readers[1]).toMatchObject({ person: { id: ids.sales } });
    expect(readers[1]!.acknowledgedAt).not.toBeNull();
    expect((await poster.call("get", `/office/posts/${id}`, { companyId: retail })).body.readStats).toEqual({ recipients: 2, read: 1, acknowledged: 1 });
    // Tin không cần xác nhận: không xác nhận được.
    const plain = await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Tin không cần xác nhận" }) });
    expect((await sales.call("post", `/office/posts/${plain.body.id}/acknowledge`, { companyId: retail })).status).toBe(409);
  });

  it("ghim tối đa 5 tin của công ty; tin ghim lên đầu; hết hạn thì ẩn và không tính ghim", async () => {
    await pool.query("UPDATE office.posts SET pinned = false");
    const pinned: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const created = await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: `Tin ghim ${index + 1}`, pinned: true }) });
      expect(created.status).toBe(201);
      pinned.push(created.body.id);
    }
    const sixth = await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Tin ghim thứ sáu", pinned: true }) });
    expect(sixth.status).toBe(409);
    expect((await poster.call("get", "/office/post-options", { companyId: retail })).body.pinnedCount).toBe(5);
    const later = await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Tin mới không ghim" }) });
    const feed = await feedIds(sales);
    expect(feed.slice(0, 5).sort()).toEqual([...pinned].sort());
    expect(feed.indexOf(later.body.id)).toBeGreaterThan(4);
    // Một tin ghim hết hạn: ẩn khỏi bảng tin, không còn tính vào giới hạn ghim.
    await pool.query("UPDATE office.posts SET publish_at = now() - interval '2 days', expires_at = now() - interval '1 minute' WHERE id = $1", [pinned[0]]);
    expect(await feedIds(sales)).not.toContain(pinned[0]);
    expect((await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Tin ghim thay thế", pinned: true }) })).status).toBe(201);
    const managed = (await poster.call("get", "/office/posts?view=manage", { companyId: retail })).body.data as { id: string; state: string }[];
    expect(managed.find((item) => item.id === pinned[0])?.state).toBe("expired");
    // Hết hạn phải sau giờ đăng.
    expect((await poster.call("post", "/office/posts", { companyId: retail, body: post({ expiresAt: new Date(Date.now() - 60_000).toISOString() }) })).status).toBe(400);
  });

  it("sửa hiện đã sửa, thu hồi thì ẩn với người nhận; chỉ người đăng sửa, thu hồi; bình luận, tệp", async () => {
    const created = await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Tiệc cuối năm" }) });
    const id = created.body.id;
    expect((await sales.call("patch", `/office/posts/${id}`, { companyId: retail, body: post({ title: "Sửa trộm", version: 1 }) })).status).toBe(403);
    const edited = await poster.call("patch", `/office/posts/${id}`, { companyId: retail, body: post({ title: "Tiệc cuối năm 2026", version: created.body.version }) });
    expect(edited.status).toBe(200);
    expect(edited.body.editedAt).not.toBeNull();
    expect((await poster.call("patch", `/office/posts/${id}`, { companyId: retail, body: post({ version: created.body.version }) })).status).toBe(409);
    // Thiếu phiên bản khi sửa: báo cần nhập, không ghi đè.
    expect((await poster.call("patch", `/office/posts/${id}`, { companyId: retail, body: post() })).status).toBe(400);
    // Tệp: người đăng tải lên, người nhận tải xuống.
    const withFile = await poster.call("post", `/office/posts/${id}/files`, { companyId: retail }).attach("file", pdf, "chuong-trinh.pdf");
    expect(withFile.status).toBe(201);
    const fileId = withFile.body.files[0].id;
    expect((await sales.call("get", `/office/posts/${id}/files/${fileId}`, { companyId: retail })).status).toBe(200);
    expect((await sales.call("post", `/office/posts/${id}/files`, { companyId: retail }).attach("file", pdf, "x.pdf")).status).toBe(403);
    // Bình luận: người nhận bình luận, người đăng được thông báo và xóa được bình luận bất kỳ.
    const commented = await sales.call("post", `/office/posts/${id}/comments`, { companyId: retail, body: { body: "Em đăng ký văn nghệ." } });
    expect(commented.status).toBe(201);
    const commentId = commented.body.comments[0].id;
    expect((await pool.query("SELECT count(*)::int AS count FROM core.notifications WHERE user_id = $1 AND kind = 'office_post_comment'", [ids.poster])).rows[0].count).toBe(1);
    expect((await accountant.call("delete", `/office/posts/${id}/comments/${commentId}`, { companyId: retail })).status).toBe(403);
    const removed = await poster.call("delete", `/office/posts/${id}/comments/${commentId}`, { companyId: retail });
    expect(removed.body.comments[0]).toMatchObject({ deleted: true, body: null });
    // Tin không cho bình luận.
    const closed = await poster.call("post", "/office/posts", { companyId: retail, body: post({ title: "Không bình luận", allowComments: false }) });
    expect((await sales.call("post", `/office/posts/${closed.body.id}/comments`, { companyId: retail, body: { body: "Thử" } })).status).toBe(409);
    // Thu hồi: người nhận không thấy, không mở được; người đăng vẫn xem trong quản lý.
    expect((await sales.call("post", `/office/posts/${id}/revoke`, { companyId: retail, body: { version: edited.body.version } })).status).toBe(403);
    const revoked = await poster.call("post", `/office/posts/${id}/revoke`, { companyId: retail, body: { version: edited.body.version } });
    expect(revoked.body.state).toBe("revoked");
    expect(await feedIds(sales)).not.toContain(id);
    expect((await sales.call("get", `/office/posts/${id}`, { companyId: retail })).status).toBe(404);
    expect((await sales.call("get", `/office/posts/${id}/files/${fileId}`, { companyId: retail })).status).toBe(404);
    const audit = await pool.query("SELECT action FROM core.audit_events WHERE entity_type = 'office_post' AND entity_id = $1 ORDER BY occurred_at", [id]);
    expect(audit.rows.map((row) => row.action)).toEqual(["office.post.create", "office.post.update", "office.post.revoke"]);
  });
});
