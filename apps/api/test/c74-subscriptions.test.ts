// CONG_VIEC_74 L0: gói iPOS, thuê bao điểm bán, cách thu phí, xét hạn hằng ngày, cô lập dữ liệu giữa cửa hàng
// (KICHBAN_KIEMTHU_768 đến 773; TIEUCHI_NGHIEMTHU_560 đến 564).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { IposSubscriptionsService } from "../src/ipos/ipos-subscriptions.service";
import { prepareAffiliate, operator, type AffiliateFixture } from "./c55-fixture";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: AffiliateFixture;
let otherMerchant: string;
let otherOutlet: string;
let planId: string;

const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const plan = { code: "tieu-chuan", name: "Tiêu chuẩn", monthlyPrice: "360000", taxPercent: "10", maxRegisters: 3, maxItems: 2000, trialDays: 14 };

async function grant(email: string, codes: string[]): Promise<Session> {
  await createTestUser(pool, email, "Nhân viên iPOS", [{ companyId: operator }]);
  const roleId = (
    await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en, status) VALUES ($1, $2, 'iPOS (kiểm thử)', 'iPOS (test)', 'active') RETURNING id", [
      operator,
      `test_ipos_${email.split("@")[0]!.replace(/\W/g, "_")}`,
    ])
  ).rows[0]!.id;
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) SELECT $1, unnest($2::text[])", [roleId, ["crm.access", ...codes]]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $2, 'company', $3, '2026-01-01' FROM core.users WHERE email = $1", [
    email,
    roleId,
    operator,
  ]);
  return signIn(application, email);
}

const daysFrom = (day: string, days: number) => {
  const moment = new Date(`${day}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
};
// Đặt đồng hồ giả vào 10 giờ sáng giờ Việt Nam của ngày cho trước.
const setDay = (day: string) => {
  testClock.fixed = new Date(`${day}T03:00:00Z`);
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareAffiliate(application, pool);
  otherMerchant = await store.createMerchant("Tạp hóa Minh Anh", "0322222228", "HDLK-02");
  otherOutlet = (await store.call("post", `/affiliate/merchants/${otherMerchant}/outlets`, { name: "Bình Dương 01", address: "12 Đại lộ Bình Dương" })).body.id as string;
  const detail = await store.call("get", `/affiliate/merchants/${otherMerchant}`);
  expect((await store.call("post", `/affiliate/merchants/${otherMerchant}/activate`, { version: detail.body.version })).status).toBe(201);
});

afterEach(() => {
  testClock.fixed = null;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_74 L0 – gói và thuê bao iPOS", () => {
  it("KICHBAN_KIEMTHU_770: tạo, sửa, ngừng bán gói; người không quyền bị từ chối", async () => {
    const created = await store.call("post", "/ipos/plans", plan);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ code: "TIEU-CHUAN", monthlyPrice: "360000", taxPercent: "10", maxRegisters: 3, status: "selling", activeSubscriptions: 0 });
    planId = created.body.id as string;
    expect((await store.call("post", "/ipos/plans", plan)).body.error.message).toBe(message("iposPlanCodeTaken"));
    const invalid = await store.call("post", "/ipos/plans", { ...plan, code: "CO-BAN", taxPercent: "7" });
    expect(invalid.status).toBe(400);

    const viewer = await grant("xem.ipos.c74@vcomm.test", ["affiliate.view"]);
    expect((await viewer.call("get", "/ipos/plans", { companyId: operator })).status).toBe(200);
    expect((await viewer.call("post", "/ipos/plans", { companyId: operator, body: { ...plan, code: "CO-BAN" } })).status).toBe(403);
    await createTestUser(pool, "khong.quyen.c74@vcomm.test", "Không Quyền", [{ companyId: operator }]);
    const outsider = await signIn(application, "khong.quyen.c74@vcomm.test");
    expect((await outsider.call("get", "/ipos/plans", { companyId: operator })).status).toBe(403);

    const retired = await store.call("post", "/ipos/plans", { ...plan, code: "CU-2025", trialDays: 0 });
    const { code: _code, ...planFields } = plan;
    const updated = await store.call("put", `/ipos/plans/${retired.body.id}`, { ...planFields, name: "Gói cũ 2025", trialDays: 0, status: "retired", version: retired.body.version });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body).toMatchObject({ status: "retired", name: "Gói cũ 2025", version: 2 });
    const subscribe = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, {
      outletId: store.outletB,
      planId: retired.body.id,
      periodMonths: 1,
      startsOn: store.today,
      trialDays: null,
      customMonthlyPrice: null,
      customMaxRegisters: null,
    });
    expect(subscribe.body.error.message).toBe(message("iposPlanRetired"));
  });

  it("KICHBAN_KIEMTHU_771: cấp thuê bao dùng thử và không dùng thử; trùng điểm bán; cửa hàng chưa hoạt động", async () => {
    const base = { planId, periodMonths: 6, startsOn: "2026-11-01", customMonthlyPrice: null, customMaxRegisters: null };
    const trial = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, { ...base, outletId: store.outletA, trialDays: null });
    expect(trial.status, JSON.stringify(trial.body)).toBe(201);
    expect(trial.body).toMatchObject({ status: "trial", trialEndsOn: "2026-11-15", endsOn: "2027-05-15", monthlyPrice: "360000", maxRegisters: 3, maxItems: 2000 });
    const direct = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, {
      ...base,
      outletId: store.outletB,
      periodMonths: 12,
      trialDays: 0,
      customMonthlyPrice: "300000",
      customMaxRegisters: 5,
    });
    expect(direct.body).toMatchObject({ status: "active", trialEndsOn: null, endsOn: "2027-11-01", monthlyPrice: "300000", maxRegisters: 5 });
    const duplicate = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, { ...base, outletId: store.outletA, trialDays: null });
    expect(duplicate.body.error.message).toBe(message("iposOutletSubscribed"));

    const draft = await store.createMerchant("Nhà thuốc An Khang", "0333333337", "HDLK-03");
    const draftOutlet = (await store.call("post", `/affiliate/merchants/${draft}/outlets`, { name: "Dĩ An", address: "1 Dĩ An" })).body.id as string;
    const blocked = await store.call("post", `/affiliate/merchants/${draft}/ipos-subscriptions`, { ...base, outletId: draftOutlet, trialDays: null });
    expect(blocked.body.error.message).toBe(message("iposMerchantInactive"));

    const overview = await store.call("get", `/affiliate/merchants/${store.merchantId}/ipos`);
    expect(overview.body).toMatchObject({ billing: null, canManage: true, availableOutlets: [] });
    expect(overview.body.subscriptions).toHaveLength(2);
    const plans = await store.call("get", "/ipos/plans");
    expect(plans.body.find((item: { id: string }) => item.id === planId).activeSubscriptions).toBe(2);
  });

  it("KICHBAN_KIEMTHU_768: cô lập: điểm bán của cửa hàng khác bị từ chối; thành viên cửa hàng không gọi được API ERP", async () => {
    const crossed = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, {
      outletId: otherOutlet,
      planId,
      periodMonths: 1,
      startsOn: store.today,
      trialDays: 0,
      customMonthlyPrice: null,
      customMaxRegisters: null,
    });
    expect(crossed.body.error.message).toBe(message("iposOutletInactive"));
    // Trigger cơ sở dữ liệu chặn cả khi ghi thẳng lệch cửa hàng.
    await expect(
      pool.query(
        `INSERT INTO ipos.subscriptions (merchant_id, outlet_id, plan_id, period_months, starts_on, ends_on, status, created_by, updated_by)
         SELECT $1, $2, $3, 1, '2026-11-01', '2026-12-01', 'active', id, id FROM core.users LIMIT 1`,
        [store.merchantId, otherOutlet, planId],
      ),
    ).rejects.toThrow(/không thuộc cửa hàng/);
    const subscriptions = await store.call("get", `/ipos/subscriptions?merchantId=${otherMerchant}`);
    expect(subscriptions.body.total).toBe(0);
    for (const member of [store.owner, store.cashier]) {
      expect((await member.call("get", "/ipos/subscriptions", { companyId: operator })).status).toBe(403);
      expect((await member.call("get", `/affiliate/merchants/${store.merchantId}/ipos`, { companyId: operator })).status).toBe(403);
    }
  });

  it("KICHBAN_KIEMTHU_772: việc nền: hết dùng thử, quá hạn, ân hạn, tạm khóa; gia hạn mở lại; miễn phí tự gia hạn", async () => {
    const service = application.get(IposSubscriptionsService);
    const list = async () => (await store.call("get", `/ipos/subscriptions?merchantId=${store.merchantId}`)).body.data as { outletId: string; status: string; endsOn: string; id: string; version: number }[];
    const of = async (outletId: string) => (await list()).find((item) => item.outletId === outletId && item.status !== "cancelled")!;

    setDay("2026-11-15");
    await service.runDaily();
    expect((await of(store.outletA)).status).toBe("active");

    setDay(daysFrom("2027-05-15", 1));
    await service.runDaily();
    expect((await of(store.outletA)).status).toBe("overdue");
    setDay(daysFrom("2027-05-15", 7));
    await service.runDaily();
    expect((await of(store.outletA)).status).toBe("overdue");
    setDay(daysFrom("2027-05-15", 8));
    await service.runDaily();
    const locked = await of(store.outletA);
    expect(locked.status).toBe("locked");

    // Gia hạn khi đã quá ân hạn của kỳ cũ: ngày hết hạn mới còn hiệu lực thì về đang hoạt động ngay.
    const renewed = await store.call("post", `/ipos/subscriptions/${locked.id}/renew`, { version: locked.version });
    expect(renewed.status, JSON.stringify(renewed.body)).toBe(201);
    expect(renewed.body).toMatchObject({ status: "active", endsOn: "2027-11-15" });

    // Miễn phí không thời hạn: quá ngày hết hạn thì tự gia hạn từng kỳ, không quá hạn.
    const billing = await store.call("put", `/affiliate/merchants/${store.merchantId}/ipos-billing`, { method: "free", freeUntil: null, freeReason: "Khuyến mãi khai trương", version: null });
    expect(billing.status, JSON.stringify(billing.body)).toBe(200);
    setDay("2028-01-05");
    const result = await service.runDaily();
    expect(result.renewedFree).toBeGreaterThan(0);
    expect(await of(store.outletA)).toMatchObject({ status: "active", endsOn: "2028-05-15" });
    expect(await of(store.outletB)).toMatchObject({ status: "active", endsOn: "2028-11-01" });
  });

  it("KICHBAN_KIEMTHU_773: cách thu, khóa tay, mở khóa, hủy không xóa dữ liệu, cấp lại; cửa hàng tạm ngưng", async () => {
    const billing = (await store.call("get", `/affiliate/merchants/${store.merchantId}/ipos`)).body.billing as { version: number };
    expect((await store.call("put", `/affiliate/merchants/${store.merchantId}/ipos-billing`, { method: "collection_deduction", freeUntil: null, freeReason: null, version: billing.version })).body.error.message).toBe(message("iposCollectionNotEnabled"));
    expect((await store.call("put", `/affiliate/merchants/${store.merchantId}/ipos-billing`, { method: "vietqr", freeUntil: null, freeReason: "x", version: billing.version })).status).toBe(400);
    const vietqr = await store.call("put", `/affiliate/merchants/${store.merchantId}/ipos-billing`, { method: "vietqr", freeUntil: null, freeReason: null, version: billing.version });
    expect(vietqr.body).toMatchObject({ method: "vietqr", version: billing.version + 1 });

    const current = (await store.call("get", `/ipos/subscriptions?merchantId=${store.merchantId}`)).body.data.find((item: { outletId: string }) => item.outletId === store.outletB);
    const locked = await store.call("post", `/ipos/subscriptions/${current.id}/lock`, { reason: "Cửa hàng yêu cầu tạm dừng", version: current.version });
    expect(locked.body).toMatchObject({ status: "locked", lockedManually: true, statusReason: "Cửa hàng yêu cầu tạm dừng" });
    // Việc nền không mở khóa tay; miễn phí đã tắt nên không tự gia hạn.
    await application.get(IposSubscriptionsService).runDaily();
    expect((await store.call("get", `/ipos/subscriptions/${current.id}`)).body.status).toBe("locked");
    const unlocked = await store.call("post", `/ipos/subscriptions/${current.id}/unlock`, { version: locked.body.version });
    expect(unlocked.body).toMatchObject({ status: "active", lockedManually: false });

    const cancelled = await store.call("post", `/ipos/subscriptions/${current.id}/cancel`, { reason: "Ngừng dùng iPOS", version: unlocked.body.version });
    expect(cancelled.body.status).toBe("cancelled");
    expect((await store.call("post", `/ipos/subscriptions/${current.id}/renew`, { version: cancelled.body.version })).body.error.message).toBe(message("iposSubscriptionStatusInvalid"));
    const again = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, {
      outletId: store.outletB,
      planId,
      periodMonths: 1,
      startsOn: store.today,
      trialDays: 0,
      customMonthlyPrice: null,
      customMaxRegisters: null,
    });
    expect(again.status, JSON.stringify(again.body)).toBe(201);
    const all = (await store.call("get", `/ipos/subscriptions?merchantId=${store.merchantId}`)).body.data as { outletId: string; status: string }[];
    expect(all.filter((item) => item.outletId === store.outletB).map((item) => item.status).sort()).toEqual(["active", "cancelled"]);

    const audit = await pool.query<{ action: string }>("SELECT action FROM core.audit_events WHERE entity_id = $1 ORDER BY occurred_at", [current.id]);
    expect(audit.rows.map((row) => row.action)).toEqual(["ipos_subscription.create", "ipos_subscription.lock", "ipos_subscription.unlock", "ipos_subscription.cancel"]);
  });
});
