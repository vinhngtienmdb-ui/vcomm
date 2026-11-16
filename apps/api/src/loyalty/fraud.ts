// Chống gian lận nâng cao (CONG_VIEC_60; CHUC_NANG_215; QUYTAC_NGHIEPVU_474 đến 477).
// Quy tắc xét khi phát sinh giao dịch điểm, không quét lại quá khứ. Mức xử lý: cảnh báo, chặn giao dịch, chặn và khóa ví.
// Chặn dùng điểm làm hủy giao dịch của bên gọi, nên vụ việc và khóa ví lúc đó ghi bằng kết nối riêng (đã cam kết trước khi báo lỗi).
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { notify } from "../common/notifications";
import { purposeKey } from "../common/secret-box";
import type { Database } from "../database/database.module";
import { usersWithPermission } from "../hr/attendance-access";

type Executor = Pick<Database, "execute">;
export type FraudRuleCode = "shared_device" | "redeem_burst" | "earn_return" | "staff_anomaly";
export type FraudAction = "alert" | "block" | "block_and_lock";
export const fraudPermission = "loyalty.fraud.manage";
export const ruleNames: Record<FraudRuleCode, string> = {
  shared_device: "Nhiều tài khoản trên một thiết bị",
  redeem_burst: "Đổi điểm dồn dập",
  earn_return: "Tích rồi trả hàng lặp lại",
  staff_anomaly: "Bất thường theo nhân viên",
};

// Kết nối dùng để ghi vụ việc khi chặn (LoyaltyFraudService đăng ký khi khởi động; kiểm thử đơn vị không cần).
let independent: Database | null = null;
export const setFraudDatabase = (database: Database | null) => {
  independent = database;
};

// QUYTAC_NGHIEPVU_474: mã cài đặt 16 đến 128 ký tự chữ, số, gạch; sai định dạng thì bỏ qua.
export function deviceHashOf(deviceId: string | null | undefined): string | null {
  if (!deviceId || !/^[A-Za-z0-9_-]{16,128}$/.test(deviceId)) return null;
  return createHmac("sha256", purposeKey("loyalty-device")).update(deviceId, "utf8").digest("hex");
}

export async function linkDevice(executor: Executor, userId: string, deviceHash: string | null): Promise<void> {
  if (!deviceHash) return;
  await executor.execute(sql`
    INSERT INTO loyalty.device_links (device_hash, user_id) VALUES (${deviceHash}, ${userId})
    ON CONFLICT (device_hash, user_id) DO UPDATE SET last_seen_at = now(), seen_count = loyalty.device_links.seen_count + 1`);
}

type Rule = { code: FraudRuleCode; enabled: boolean; params: Record<string, number | null>; action: FraudAction };
async function rulesOf(executor: Executor): Promise<Map<FraudRuleCode, Rule>> {
  const rows = await executor.execute<Rule>(sql`SELECT code, enabled, params, action FROM loyalty.fraud_rules`);
  return new Map(rows.rows.filter((rule) => rule.enabled).map((rule) => [rule.code, rule]));
}

interface Hit {
  rule: Rule;
  subjectKind: "user" | "device" | "staff";
  subjectKey: string;
  userId: string;
  deviceHash: string | null;
  staffUserId: string | null;
  companyId: string;
  metrics: Record<string, unknown>;
}
type Document = { sourceType: string; sourceId: string };

// Quy tắc 1 (QUYTAC_NGHIEPVU_476): số tài khoản khác nhau dùng một mã cài đặt có tích hoặc dùng điểm trong N ngày (gồm người đang giao dịch).
async function sharedDevice(executor: Executor, rule: Rule, userId: string, companyId: string, deviceHash: string | null): Promise<Hit | null> {
  if (!deviceHash) return null;
  const days = Number(rule.params.days ?? 30);
  const accounts = (
    await executor.execute<{ total: number }>(sql`
    SELECT count(DISTINCT dl.user_id)::int AS total FROM loyalty.device_links dl
    WHERE dl.device_hash = ${deviceHash} AND (dl.user_id = ${userId} OR EXISTS (
      SELECT 1 FROM loyalty.entries e WHERE e.user_id = dl.user_id AND e.kind IN ('earn', 'redeem') AND e.created_at >= now() - make_interval(days => ${days})))`)
  ).rows[0]!.total;
  const maximum = Number(rule.params.maxAccounts ?? 3);
  if (accounts <= maximum) return null;
  return { rule, subjectKind: "device", subjectKey: deviceHash, userId, deviceHash, staffUserId: null, companyId, metrics: { accounts, days, maxAccounts: maximum } };
}

// Quy tắc 2: trong 24 giờ dùng điểm quá N lần hoặc quá X điểm; hoặc dùng ≥ Y % số dư trong Z giờ kể từ lần đầu thiết bị gắn với tài khoản.
async function redeemBurst(executor: Executor, rule: Rule, userId: string, companyId: string, deviceHash: string | null, points: number): Promise<Hit | null> {
  const recent = (
    await executor.execute<{ count: number; points: number }>(sql`
    SELECT count(*)::int AS count, coalesce(-sum(points), 0)::int AS points FROM loyalty.entries
    WHERE user_id = ${userId} AND kind = 'redeem' AND created_at >= now() - interval '24 hours'`)
  ).rows[0]!;
  const count = recent.count + 1;
  const total = recent.points + points;
  const maxCount = Number(rule.params.maxCount ?? 5);
  const maxPoints = rule.params.maxPoints === null || rule.params.maxPoints === undefined ? null : Number(rule.params.maxPoints);
  const metrics: Record<string, unknown> = { count24h: count, points24h: total, maxCount, maxPoints };
  let hit = count > maxCount || (maxPoints !== null && total > maxPoints);
  if (!hit && deviceHash && rule.params.balancePercent !== null) {
    const hours = Number(rule.params.newDeviceHours ?? 24);
    const fresh = (
      await executor.execute<{ balance: number }>(sql`
      SELECT a.balance FROM loyalty.device_links dl JOIN loyalty.accounts a ON a.user_id = dl.user_id
      WHERE dl.device_hash = ${deviceHash} AND dl.user_id = ${userId} AND dl.first_seen_at >= now() - make_interval(hours => ${hours})`)
    ).rows[0];
    const percent = Number(rule.params.balancePercent ?? 80);
    if (fresh && fresh.balance > 0 && points * 100 >= percent * fresh.balance) {
      hit = true;
      Object.assign(metrics, { newDevice: true, balance: fresh.balance, points, balancePercent: percent, newDeviceHours: hours });
    }
  }
  return hit ? { rule, subjectKind: "user", subjectKey: userId, userId, deviceHash, staffUserId: null, companyId, metrics } : null;
}

// Quy tắc 3: trong 90 ngày điểm bị trừ lại ÷ điểm đã tích ≥ ngưỡng, điểm đã tích ≥ mức tối thiểu.
async function earnReturn(executor: Executor, rule: Rule, userId: string, companyId: string): Promise<Hit | null> {
  const row = (
    await executor.execute<{ earned: number; reversed: number }>(sql`
    SELECT coalesce(sum(points) FILTER (WHERE kind = 'earn'), 0)::int AS earned, coalesce(-sum(points) FILTER (WHERE kind = 'earn_reversal'), 0)::int AS reversed
    FROM loyalty.entries WHERE user_id = ${userId} AND kind IN ('earn', 'earn_reversal') AND created_at >= now() - interval '90 days'`)
  ).rows[0]!;
  const ratio = Number(rule.params.ratioPercent ?? 50);
  const minimum = Number(rule.params.minEarnedPoints ?? 10000);
  if (row.earned < minimum || row.reversed * 100 < ratio * row.earned) return null;
  return {
    rule,
    subjectKind: "user",
    subjectKey: userId,
    userId,
    deviceHash: null,
    staffUserId: null,
    companyId,
    metrics: { earned90d: row.earned, reversed90d: row.reversed, ratioPercent: ratio, minEarnedPoints: minimum },
  };
}

// Quy tắc 4 (bán tại quầy): một thu ngân lập quá N chứng từ có tích điểm cho cùng khách trong ngày, hoặc khách là chính người lập hoặc trùng số điện thoại người lập.
async function staffAnomaly(executor: Executor, rule: Rule, userId: string, companyId: string, saleId: string): Promise<Hit | null> {
  const sale = (
    await executor.execute<{ cashier_id: string; sale_date: string; same_phone: boolean; sales: number }>(sql`
    SELECT s.cashier_id, s.sale_date::text,
      coalesce((SELECT b.id = c.id OR (c.phone IS NOT NULL AND c.phone = b.phone) FROM core.users c, core.users b WHERE c.id = s.cashier_id AND b.id = ${userId}), false) AS same_phone,
      (SELECT count(*)::int FROM retail.sales o WHERE o.cashier_id = s.cashier_id AND o.loyalty_user_id = ${userId} AND o.sale_date = s.sale_date) AS sales
    FROM retail.sales s WHERE s.id = ${saleId}`)
  ).rows[0];
  if (!sale) return null;
  const maximum = Number(rule.params.maxSalesPerCustomerDay ?? 3);
  if (!sale.same_phone && sale.sales <= maximum) return null;
  return {
    rule,
    subjectKind: "staff",
    subjectKey: sale.cashier_id,
    userId,
    deviceHash: null,
    staffUserId: sale.cashier_id,
    companyId,
    metrics: { salesToday: sale.sales, maxSalesPerCustomerDay: maximum, samePhone: sale.same_phone },
  };
}

// Tự khóa ví (QUYTAC_NGHIEPVU_352, 475): người làm là hệ thống.
async function lockWallet(executor: Executor, userId: string, code: FraudRuleCode): Promise<void> {
  const reason = `Tự khóa theo quy tắc ${ruleNames[code]}`;
  const updated = await executor.execute(sql`UPDATE loyalty.accounts SET locked = true, lock_reason = ${reason}, updated_at = now() WHERE user_id = ${userId} AND NOT locked RETURNING user_id`);
  if (updated.rows.length > 0) await executor.execute(sql`INSERT INTO loyalty.lock_history (user_id, action, reason, actor_user_id) VALUES (${userId}, 'lock', ${reason}, NULL)`);
}

// Ghi vụ việc (gộp cùng quy tắc, đối tượng, ngày), chứng từ liên quan; khóa ví nếu mức là chặn và khóa; báo người có quyền tối đa một lần mỗi giờ.
async function recordHits(executor: Executor, hits: Hit[], document: Document, effect: "alerted" | "blocked_redeem" | "skipped_earn" | "locked"): Promise<void> {
  for (const hit of hits) {
    const caseId = (
      await executor.execute<{ id: string }>(sql`
      INSERT INTO loyalty.fraud_cases (rule_code, action, subject_kind, subject_key, user_id, device_hash, staff_user_id, company_id, metrics, case_day)
      VALUES (${hit.rule.code}, ${hit.rule.action}, ${hit.subjectKind}, ${hit.subjectKey}, ${hit.userId}, ${hit.deviceHash}, ${hit.staffUserId}, ${hit.companyId},
        ${JSON.stringify(hit.metrics)}::jsonb, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
      ON CONFLICT (rule_code, subject_kind, subject_key, case_day) WHERE status IN ('new', 'reviewing')
      DO UPDATE SET hit_count = loyalty.fraud_cases.hit_count + 1, metrics = EXCLUDED.metrics, action = EXCLUDED.action, updated_at = now()
      RETURNING id`)
    ).rows[0]!.id;
    const locks = hit.rule.action === "block_and_lock";
    await executor.execute(sql`
      INSERT INTO loyalty.fraud_case_documents (case_id, source_type, source_id, effect, user_id) VALUES (${caseId}, ${document.sourceType}, ${document.sourceId}, ${effect}, ${hit.userId})`);
    if (locks) {
      await lockWallet(executor, hit.userId, hit.rule.code);
      if (effect !== "locked") {
        await executor.execute(sql`
          INSERT INTO loyalty.fraud_case_documents (case_id, source_type, source_id, effect, user_id) VALUES (${caseId}, ${document.sourceType}, ${document.sourceId}, 'locked', ${hit.userId})`);
      }
    }
    await notifyManagers(executor, hit);
  }
}

async function notifyManagers(executor: Executor, hit: Hit): Promise<void> {
  const operator = (
    await executor.execute<{ id: string; today: string }>(sql`
    SELECT id, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today FROM core.companies WHERE is_marketplace_operator`)
  ).rows[0];
  if (!operator) return;
  const users = await usersWithPermission(executor, operator.id, fraudPermission, operator.today);
  const recent = await executor.execute<{ user_id: string }>(sql`
    SELECT DISTINCT user_id FROM core.notifications WHERE kind = 'loyalty.fraud_case' AND created_at >= now() - interval '1 hour' AND user_id = ANY(${`{${users.join(",")}}`}::uuid[])`);
  const skip = new Set(recent.rows.map((row) => row.user_id));
  await notify(
    executor,
    users
      .filter((userId) => !skip.has(userId))
      .map((userId) => ({
        userId,
        companyId: operator.id,
        kind: "loyalty.fraud_case",
        title: `Có vụ việc gian lận điểm mới: ${ruleNames[hit.rule.code]}`,
        link: "/crm/loyalty/fraud-cases",
        payload: { ruleCode: hit.rule.code },
      })),
  );
}

const blocking = (hits: Hit[]) => hits.some((hit) => hit.rule.action !== "alert");

// Dùng điểm (đơn VComm, bán tại quầy): quy tắc 1, 2. Chặn thì ghi vụ việc bằng kết nối riêng rồi báo lỗi; chỉ cảnh báo thì ghi trong giao dịch của bên gọi.
export async function evaluateRedeem(executor: Executor, input: { userId: string; companyId: string; sourceType: string; sourceId: string; points: number; deviceHash: string | null }): Promise<void> {
  const rules = await rulesOf(executor);
  const hits: Hit[] = [];
  const shared = rules.get("shared_device");
  if (shared) {
    const hit = await sharedDevice(executor, shared, input.userId, input.companyId, input.deviceHash);
    if (hit) hits.push(hit);
  }
  const burst = rules.get("redeem_burst");
  if (burst) {
    const hit = await redeemBurst(executor, burst, input.userId, input.companyId, input.deviceHash, input.points);
    if (hit) hits.push(hit);
  }
  if (hits.length === 0) return;
  if (!blocking(hits)) {
    await recordHits(executor, hits, input, "alerted");
    return;
  }
  const writer = independent ?? (executor as Database);
  await writer.transaction(async (transaction) => {
    for (const hit of hits) await recordHits(transaction, [hit], input, hit.rule.action === "alert" ? "alerted" : "blocked_redeem");
  });
  throw new ApiError("BUSINESS_RULE", "loyaltyFraudBlocked");
}

// Tích điểm (hoàn tất đơn VComm theo thiết bị lúc đặt, bán tại quầy): quy tắc 1, 4. Trả về true khi bị chặn (không tích, lý do fraud_rule).
export async function evaluateEarn(executor: Executor, input: { userId: string; companyId: string; sourceType: string; sourceId: string; deviceHash: string | null }): Promise<boolean> {
  const rules = await rulesOf(executor);
  const hits: Hit[] = [];
  const shared = rules.get("shared_device");
  if (shared) {
    const hit = await sharedDevice(executor, shared, input.userId, input.companyId, input.deviceHash);
    if (hit) hits.push(hit);
  }
  const staff = rules.get("staff_anomaly");
  if (staff && input.sourceType === "retail_sale") {
    const hit = await staffAnomaly(executor, staff, input.userId, input.companyId, input.sourceId);
    if (hit) hits.push(hit);
  }
  for (const hit of hits) await recordHits(executor, [hit], input, hit.rule.action === "alert" ? "alerted" : "skipped_earn");
  return blocking(hits);
}

// Trừ lại điểm đã tích (trả hàng, hủy chứng từ bán): quy tắc 3; giao dịch trả hàng không chặn, mức chặn coi như cảnh báo.
export async function evaluateReversal(executor: Executor, input: { userId: string; companyId: string; sourceType: string; sourceId: string }): Promise<void> {
  const rule = (await rulesOf(executor)).get("earn_return");
  if (!rule) return;
  const hit = await earnReturn(executor, rule, input.userId, input.companyId);
  if (hit) await recordHits(executor, [hit], input, rule.action === "block_and_lock" ? "locked" : "alerted");
}
