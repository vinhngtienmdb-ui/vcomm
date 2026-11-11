// CONG_VIEC_51 L0: chương trình điểm theo giai đoạn, bảng hạng, phân quyền (KICHBAN_KIEMTHU_486; TIEUCHI_NGHIEMTHU_329).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signIn, type Session } from "./helpers";
import { prepareMarketplace, retail, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;

const addDays = (day: string, days: number) => {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const phase = (startsOn: string, endsOn: string | null, overrides: object = {}) => ({
  startsOn,
  endsOn,
  earnPercent: "1",
  pointValue: "1",
  redeemMaxPercent: "50",
  redeemMinPoints: 1000,
  validityMonths: 12,
  orderCapPoints: null,
  monthlyCapPoints: null,
  ...overrides,
});

async function grant(email: string, codes: string[]): Promise<Session> {
  const roleId = (
    await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en, status) VALUES ($1, $2, 'Điểm thưởng (kiểm thử)', 'Loyalty (test)', 'active') RETURNING id", [
      retail,
      `test_loyalty_${codes.length}`,
    ])
  ).rows[0]!.id;
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) SELECT $1, unnest($2::text[])", [roleId, ["crm.access", ...codes]]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $2, 'company', $3, '2026-01-01' FROM core.users WHERE email = $1", [
    email,
    roleId,
    retail,
  ]);
  return signIn(application, email);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_51 chương trình điểm", () => {
  it("KICHBAN_KIEMTHU_486: giai đoạn không chồng lấn, đã bắt đầu chỉ sửa ngày kết thúc; bảng hạng hợp lệ; phân quyền", async () => {
    const today = store.today;
    // Mặc định có bốn hạng, chưa có giai đoạn.
    const empty = await store.call("get", "/loyalty/program");
    expect(empty.status).toBe(200);
    expect(empty.body.phases).toEqual([]);
    expect(empty.body.canManage).toBe(true);
    expect(empty.body.tiers.map((tier: { nameVi: string; minAnnualSpend: string; multiplier: string }) => [tier.nameVi, tier.minAnnualSpend, tier.multiplier])).toEqual([
      ["Thành viên", "0", "1"],
      ["Bạc", "5000000", "1.2"],
      ["Vàng", "20000000", "1.5"],
      ["Kim cương", "50000000", "2"],
    ]);

    // Không bắt đầu trong quá khứ; phần trăm quá 100 bị từ chối.
    const past = await store.call("post", "/loyalty/phases", phase(addDays(today, -1), null));
    expect(past.status).toBe(400);
    expect(past.body.error.fields).toEqual({ startsOn: "Ngày bắt đầu không được trước hôm nay." });
    expect((await store.call("post", "/loyalty/phases", phase(today, null, { earnPercent: "100.5" }))).status).toBe(400);

    // Giai đoạn hôm nay đến hôm nay + 9; giai đoạn sau từ hôm nay + 10, không thời hạn.
    const current = await store.call("post", "/loyalty/phases", phase(today, addDays(today, 9), { earnPercent: "2", redeemMaxPercent: "30", orderCapPoints: 200000 }));
    expect(current.status, JSON.stringify(current.body)).toBe(201);
    expect(current.body).toMatchObject({ status: "active", earnPercent: "2", orderCapPoints: 200000, version: 0 });
    const next = await store.call("post", "/loyalty/phases", phase(addDays(today, 10), null));
    expect(next.body.status).toBe("upcoming");

    // Chồng lấn: bị từ chối.
    const overlap = await store.call("post", "/loyalty/phases", phase(addDays(today, 5), addDays(today, 12)));
    expect(overlap.status).toBe(409);
    expect(JSON.stringify(overlap.body)).toContain("Giai đoạn chồng lấn với giai đoạn khác.");

    // Giai đoạn đang hiệu lực: đổi tham số bị từ chối, đổi ngày kết thúc được (không trước hôm nay).
    const started = await store.call("put", `/loyalty/phases/${current.body.id}`, {
      ...phase(today, addDays(today, 9), { earnPercent: "3", redeemMaxPercent: "30", orderCapPoints: 200000 }),
      version: 0,
    });
    expect(JSON.stringify(started.body)).toContain("Giai đoạn đã bắt đầu, chỉ sửa được ngày kết thúc.");
    const endPast = await store.call("put", `/loyalty/phases/${current.body.id}`, {
      ...phase(today, addDays(today, -1), { earnPercent: "2", redeemMaxPercent: "30", orderCapPoints: 200000 }),
      version: 0,
    });
    expect(endPast.status).toBe(400);
    const shortened = await store.call("put", `/loyalty/phases/${current.body.id}`, {
      ...phase(today, addDays(today, 5), { earnPercent: "2", redeemMaxPercent: "30", orderCapPoints: 200000 }),
      version: 0,
    });
    expect(shortened.status, JSON.stringify(shortened.body)).toBe(200);
    expect(shortened.body).toMatchObject({ endsOn: addDays(today, 5), version: 1 });
    // Phiên bản cũ: xung đột.
    expect(
      (await store.call("put", `/loyalty/phases/${current.body.id}`, { ...phase(today, addDays(today, 6), { earnPercent: "2", redeemMaxPercent: "30", orderCapPoints: 200000 }), version: 0 })).status,
    ).toBe(409);

    // Giai đoạn sắp tới sửa được mọi tham số, xóa được; giai đoạn đã bắt đầu không xóa được.
    const edited = await store.call("put", `/loyalty/phases/${next.body.id}`, { ...phase(addDays(today, 6), null, { pointValue: "10" }), version: 0 });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    expect(edited.body).toMatchObject({ startsOn: addDays(today, 6), pointValue: "10" });
    expect(JSON.stringify((await store.call("delete", `/loyalty/phases/${current.body.id}`)).body)).toContain("Giai đoạn đã bắt đầu, chỉ sửa được ngày kết thúc.");
    expect((await store.call("delete", `/loyalty/phases/${next.body.id}`)).status).toBe(204);
    expect((await store.call("get", "/loyalty/program")).body.phases.map((item: { id: string }) => item.id)).toEqual([current.body.id]);

    // Sổ cái không cho sửa, xóa bút toán (QUYTAC_NGHIEPVU_344) được kiểm ở c51-ledger; ở đây kiểm bảng hạng.
    const tiers = (minimums: string[]) => ({
      tiers: minimums.map((minAnnualSpend, index) => ({ nameVi: `Hạng ${index + 1}`, nameEn: `Tier ${index + 1}`, minAnnualSpend, multiplier: String(1 + index / 2) })),
    });
    const notZero = await store.call("put", "/loyalty/tiers", tiers(["100", "200"]));
    expect(notZero.body.error.fields).toEqual({ "tiers.0.minAnnualSpend": "Hạng đầu tiên phải có mức chi tiêu 0." });
    const notAscending = await store.call("put", "/loyalty/tiers", tiers(["0", "300", "300"]));
    expect(notAscending.body.error.fields).toEqual({ "tiers.2.minAnnualSpend": "Mức chi tiêu phải lớn hơn hạng trước." });
    expect((await store.call("put", "/loyalty/tiers", { tiers: [{ nameVi: "A", nameEn: "A", minAnnualSpend: "0", multiplier: "6" }] })).status).toBe(400);
    const three = await store.call("put", "/loyalty/tiers", tiers(["0", "1000000", "9000000"]));
    expect(three.status, JSON.stringify(three.body)).toBe(200);
    expect(three.body.map((tier: { nameVi: string; multiplier: string }) => [tier.nameVi, tier.multiplier])).toEqual([
      ["Hạng 1", "1"],
      ["Hạng 2", "1.5"],
      ["Hạng 3", "2"],
    ]);

    // Phân quyền: nhân viên không có quyền bị chặn; chỉ quyền xem thì xem được, không sửa được.
    const employee = await signIn(application, "phuc.le@vcomm.test");
    expect((await employee.call("get", "/loyalty/program", { companyId: retail })).status).toBe(403);
    const viewer = await grant("phuc.le@vcomm.test", ["loyalty.view"]);
    const viewed = await viewer.call("get", "/loyalty/program", { companyId: retail });
    expect(viewed.status).toBe(200);
    expect(viewed.body.canManage).toBe(false);
    expect((await viewer.call("post", "/loyalty/phases", { companyId: retail, body: phase(addDays(today, 30), null) })).status).toBe(403);
    expect((await viewer.call("put", "/loyalty/tiers", { companyId: retail, body: tiers(["0"]) })).status).toBe(403);
    // Thao tác ghi nhật ký.
    const audit = await pool.query("SELECT action FROM core.audit_events WHERE action LIKE 'loyalty_%' ORDER BY occurred_at");
    expect(audit.rows.map((row) => row.action)).toEqual(expect.arrayContaining(["loyalty_phase.create", "loyalty_phase.update", "loyalty_phase.delete", "loyalty_tiers.replace"]));
  });
});
