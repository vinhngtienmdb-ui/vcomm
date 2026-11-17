// Thuê bao iPOS theo điểm bán và cách thu phí theo cửa hàng (CONG_VIEC_74; CHUC_NANG_252, 253; QUYTAC_NGHIEPVU_593, 595 đến 598; API_355).
// Phiếu phí (QUYTAC_NGHIEPVU_599 đến 603) làm ở lát L7; lát L0 chỉ lưu cách thu và xét hạn theo ngày.
import { Inject, Injectable } from "@nestjs/common";
import type {
  IposBilling,
  IposBillingMethod,
  IposMerchantOverview,
  IposSubscription,
  IposSubscriptionStatus,
  PageResponse,
  iposBillingSchema,
  iposSubscriptionCreateSchema,
  iposSubscriptionListQuerySchema,
  iposSubscriptionUpdateSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";

type Executor = Pick<Database, "execute">;
// Số ngày ân hạn sau ngày hết hạn trước khi tạm khóa (QUYTAC_NGHIEPVU_596).
export const iposGraceDays = 7;

type SubscriptionRow = {
  id: string;
  merchant_id: string;
  merchant_code: string;
  merchant_name: string;
  outlet_id: string;
  outlet_name: string;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  period_months: number;
  starts_on: string;
  trial_ends_on: string | null;
  ends_on: string;
  custom_monthly_price: string | null;
  custom_max_registers: number | null;
  monthly_price: string;
  max_registers: number;
  max_items: number | null;
  status: IposSubscriptionStatus;
  locked_manually: boolean;
  status_reason: string | null;
  billing_method: IposBillingMethod | null;
  version: number;
};

const subscriptionOf = (row: SubscriptionRow): IposSubscription => ({
  id: row.id,
  merchantId: row.merchant_id,
  merchantCode: row.merchant_code,
  merchantName: row.merchant_name,
  outletId: row.outlet_id,
  outletName: row.outlet_name,
  planId: row.plan_id,
  planCode: row.plan_code,
  planName: row.plan_name,
  periodMonths: row.period_months,
  startsOn: row.starts_on,
  trialEndsOn: row.trial_ends_on,
  endsOn: row.ends_on,
  customMonthlyPrice: row.custom_monthly_price === null ? null : trimDecimal(row.custom_monthly_price),
  customMaxRegisters: row.custom_max_registers,
  monthlyPrice: trimDecimal(row.monthly_price),
  maxRegisters: row.max_registers,
  maxItems: row.max_items,
  status: row.status,
  lockedManually: row.locked_manually,
  statusReason: row.status_reason,
  billingMethod: row.billing_method,
  version: row.version,
});

// Mọi truy vấn thuê bao phía ERP lọc theo công ty vận hành sàn của người thao tác (QUYTAC_NGHIEPVU_593).
const subscriptionSelect = (where: SQL) => sql`
  SELECT s.id, s.merchant_id, m.code AS merchant_code, p.name AS merchant_name, s.outlet_id, o.name AS outlet_name, s.plan_id, pl.code AS plan_code, pl.name AS plan_name,
    s.period_months, s.starts_on::text, s.trial_ends_on::text, s.ends_on::text, s.custom_monthly_price::text, s.custom_max_registers,
    COALESCE(s.custom_monthly_price, pl.monthly_price)::text AS monthly_price, COALESCE(s.custom_max_registers, pl.max_registers) AS max_registers, pl.max_items,
    s.status, s.locked_manually, s.status_reason, b.method AS billing_method, s.version
  FROM ipos.subscriptions s
  JOIN affiliate.merchants m ON m.id = s.merchant_id
  JOIN crm.partners p ON p.id = m.partner_id
  JOIN affiliate.outlets o ON o.id = s.outlet_id
  JOIN ipos.plans pl ON pl.id = s.plan_id
  LEFT JOIN ipos.merchant_billing b ON b.merchant_id = s.merchant_id
  WHERE ${where}`;

// Ngày hết hạn kỳ đầu: tính từ ngày hết dùng thử (nếu có) hoặc ngày bắt đầu (QUYTAC_NGHIEPVU_595).
const addMonths = (day: SQL, months: number) => sql`(${day} + make_interval(months => ${months}))::date`;

@Injectable()
export class IposSubscriptionsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  private today(): string {
    return vietnamDate(this.clock.now());
  }

  private record(actor: BuyerAdminActor, action: string, entityType: string, entityId: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "crm",
        action,
        entityType,
        entityId,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }

  private async merchantStatus(executor: Executor, actor: BuyerAdminActor, merchantId: string, lock = false): Promise<string> {
    const row = (
      await executor.execute<{ status: string }>(sql`
        SELECT status FROM affiliate.merchants WHERE id = ${merchantId} AND company_id = ${actor.operatorCompanyId} ${lock ? sql`FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row.status;
  }

  private async row(executor: Executor, actor: BuyerAdminActor, subscriptionId: string): Promise<SubscriptionRow> {
    const row = (await executor.execute<SubscriptionRow>(subscriptionSelect(sql`s.id = ${subscriptionId} AND m.company_id = ${actor.operatorCompanyId}`))).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async list(actor: BuyerAdminActor, query: z.infer<typeof iposSubscriptionListQuerySchema>): Promise<PageResponse<IposSubscription>> {
    const where = sql`m.company_id = ${actor.operatorCompanyId}
      ${query.merchantId ? sql`AND s.merchant_id = ${query.merchantId}` : sql``}
      ${query.status ? sql`AND s.status = ${query.status}` : sql``}
      ${query.endsWithinDays !== undefined ? sql`AND s.status <> 'cancelled' AND s.ends_on <= (${this.today()}::date + ${query.endsWithinDays}::int)` : sql``}`;
    const total = (
      await this.database.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM ipos.subscriptions s JOIN affiliate.merchants m ON m.id = s.merchant_id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<SubscriptionRow>(
      sql`${subscriptionSelect(where)} ORDER BY s.status = 'cancelled', s.ends_on, m.code, o.name LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    return { data: rows.rows.map(subscriptionOf), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: BuyerAdminActor, subscriptionId: string): Promise<IposSubscription> {
    return subscriptionOf(await this.row(this.database, actor, subscriptionId));
  }

  // Khối iPOS trong chi tiết cửa hàng liên kết (MAN_HINH_304).
  async merchantOverview(actor: BuyerAdminActor, merchantId: string, canManage: boolean): Promise<IposMerchantOverview> {
    await this.merchantStatus(this.database, actor, merchantId);
    const billing = (
      await this.database.execute<{ method: IposBillingMethod; free_until: string | null; free_reason: string | null; version: number }>(sql`
        SELECT method, free_until::text, free_reason, version FROM ipos.merchant_billing WHERE merchant_id = ${merchantId}`)
    ).rows[0];
    const subscriptions = await this.database.execute<SubscriptionRow>(
      sql`${subscriptionSelect(sql`s.merchant_id = ${merchantId} AND m.company_id = ${actor.operatorCompanyId}`)} ORDER BY s.status = 'cancelled', o.name, s.created_at DESC`,
    );
    const outlets = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT o.id, o.name FROM affiliate.outlets o
      WHERE o.merchant_id = ${merchantId} AND o.status = 'active'
        AND NOT EXISTS (SELECT 1 FROM ipos.subscriptions s WHERE s.outlet_id = o.id AND s.status <> 'cancelled')
      ORDER BY o.name`);
    return {
      billing: billing ? { method: billing.method, freeUntil: billing.free_until, freeReason: billing.free_reason, version: billing.version } : null,
      subscriptions: subscriptions.rows.map(subscriptionOf),
      availableOutlets: outlets.rows,
      canManage,
    };
  }

  // Cách thu phí theo cửa hàng (QUYTAC_NGHIEPVU_598). Trừ vào bảng chuyển tiền thu hộ cần cửa hàng bật thu hộ (CONG_VIEC_73); chưa có thu hộ thì từ chối.
  async saveBilling(actor: BuyerAdminActor, merchantId: string, input: z.infer<typeof iposBillingSchema>): Promise<IposBilling> {
    if (input.method === "collection_deduction" && !(await this.collectionEnabled(merchantId))) throw new ApiError("BUSINESS_RULE", "iposCollectionNotEnabled");
    await this.database.transaction(async (transaction) => {
      const status = await this.merchantStatus(transaction, actor, merchantId, true);
      if (status === "terminated") throw new ApiError("BUSINESS_RULE", "iposMerchantInactive");
      const current = (await transaction.execute<{ version: number }>(sql`SELECT version FROM ipos.merchant_billing WHERE merchant_id = ${merchantId} FOR UPDATE`)).rows[0];
      if ((current?.version ?? null) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (current) {
        await transaction.execute(sql`
          UPDATE ipos.merchant_billing SET method = ${input.method}, free_until = ${input.freeUntil}, free_reason = ${input.freeReason}, updated_by = ${actor.userId},
            updated_at = now(), version = version + 1
          WHERE merchant_id = ${merchantId}`);
      } else {
        await transaction.execute(sql`
          INSERT INTO ipos.merchant_billing (merchant_id, method, free_until, free_reason, updated_by)
          VALUES (${merchantId}, ${input.method}, ${input.freeUntil}, ${input.freeReason}, ${actor.userId})`);
      }
      await this.record(actor, "ipos_billing.update", "affiliate_merchant", merchantId, input, transaction);
    });
    const saved = (
      await this.database.execute<{ method: IposBillingMethod; free_until: string | null; free_reason: string | null; version: number }>(sql`
        SELECT method, free_until::text, free_reason, version FROM ipos.merchant_billing WHERE merchant_id = ${merchantId}`)
    ).rows[0]!;
    return { method: saved.method, freeUntil: saved.free_until, freeReason: saved.free_reason, version: saved.version };
  }

  // Thu hộ qua ứng dụng thuộc CONG_VIEC_73; khi cột công tắc chưa có trong cơ sở dữ liệu thì coi như chưa bật.
  private async collectionEnabled(merchantId: string): Promise<boolean> {
    const column = await this.database.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'affiliate' AND table_name = 'merchants' AND column_name = 'collection_enabled') AS exists`);
    if (!column.rows[0]!.exists) return false;
    const row = await this.database.execute<{ enabled: boolean }>(sql`SELECT collection_enabled AS enabled FROM affiliate.merchants WHERE id = ${merchantId}`);
    return row.rows[0]?.enabled === true;
  }

  // Cấp thuê bao cho điểm bán đang hoạt động của cửa hàng đang hoạt động (QUYTAC_NGHIEPVU_595).
  async create(actor: BuyerAdminActor, merchantId: string, input: z.infer<typeof iposSubscriptionCreateSchema>): Promise<IposSubscription> {
    const id = await this.database
      .transaction(async (transaction) => {
        const status = await this.merchantStatus(transaction, actor, merchantId, true);
        if (status !== "active") throw new ApiError("BUSINESS_RULE", "iposMerchantInactive");
        const outlet = (await transaction.execute<{ status: string }>(sql`SELECT status FROM affiliate.outlets WHERE id = ${input.outletId} AND merchant_id = ${merchantId}`)).rows[0];
        if (!outlet || outlet.status !== "active") throw new ApiError("BUSINESS_RULE", "iposOutletInactive");
        const plan = (
          await transaction.execute<{ status: string; trial_days: number }>(sql`
            SELECT status, trial_days FROM ipos.plans WHERE id = ${input.planId} AND company_id = ${actor.operatorCompanyId}`)
        ).rows[0];
        if (!plan) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { planId: "invalidValue" } });
        if (plan.status !== "selling") throw new ApiError("BUSINESS_RULE", "iposPlanRetired");
        const trialDays = input.trialDays ?? plan.trial_days;
        const trialEnds = trialDays > 0 ? sql`(${input.startsOn}::date + ${trialDays}::int)` : sql`NULL::date`;
        const inserted = await transaction.execute<{ id: string }>(sql`
          INSERT INTO ipos.subscriptions (merchant_id, outlet_id, plan_id, period_months, starts_on, trial_ends_on, ends_on, custom_monthly_price, custom_max_registers,
            status, created_by, updated_by)
          VALUES (${merchantId}, ${input.outletId}, ${input.planId}, ${input.periodMonths}, ${input.startsOn}, ${trialEnds},
            ${addMonths(sql`COALESCE(${trialEnds}, ${input.startsOn}::date)`, input.periodMonths)}, ${input.customMonthlyPrice}, ${input.customMaxRegisters},
            ${trialDays > 0 ? "trial" : "active"}, ${actor.userId}, ${actor.userId})
          RETURNING id`);
        const subscriptionId = inserted.rows[0]!.id;
        await this.record(actor, "ipos_subscription.create", "ipos_subscription", subscriptionId, { merchantId, ...input, trialDays }, transaction);
        return subscriptionId;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "iposOutletSubscribed");
        throw error;
      });
    return this.detail(actor, id);
  }

  // Đổi gói, kỳ, giá riêng, số quầy riêng: có hiệu lực từ ngày đổi, không tính lại ngày hết hạn (QUYTAC_NGHIEPVU_597).
  async update(actor: BuyerAdminActor, subscriptionId: string, input: z.infer<typeof iposSubscriptionUpdateSchema>): Promise<IposSubscription> {
    await this.database.transaction(async (transaction) => {
      const current = await this.lockedRow(transaction, actor, subscriptionId, input.version);
      if (current.status === "cancelled") throw new ApiError("BUSINESS_RULE", "iposSubscriptionStatusInvalid");
      if (current.plan_id !== input.planId) {
        const plan = (await transaction.execute<{ status: string }>(sql`SELECT status FROM ipos.plans WHERE id = ${input.planId} AND company_id = ${actor.operatorCompanyId}`)).rows[0];
        if (!plan) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { planId: "invalidValue" } });
        if (plan.status !== "selling") throw new ApiError("BUSINESS_RULE", "iposPlanRetired");
      }
      await transaction.execute(sql`
        UPDATE ipos.subscriptions SET plan_id = ${input.planId}, period_months = ${input.periodMonths}, custom_monthly_price = ${input.customMonthlyPrice},
          custom_max_registers = ${input.customMaxRegisters}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${subscriptionId}`);
      await this.record(actor, "ipos_subscription.update", "ipos_subscription", subscriptionId, input, transaction);
    });
    return this.detail(actor, subscriptionId);
  }

  private async lockedRow(executor: Executor, actor: BuyerAdminActor, subscriptionId: string, version: number) {
    const row = (
      await executor.execute<{ status: IposSubscriptionStatus; locked_manually: boolean; plan_id: string; ends_on: string; period_months: number; version: number }>(sql`
        SELECT s.status, s.locked_manually, s.plan_id, s.ends_on::text, s.period_months, s.version
        FROM ipos.subscriptions s JOIN affiliate.merchants m ON m.id = s.merchant_id
        WHERE s.id = ${subscriptionId} AND m.company_id = ${actor.operatorCompanyId}
        FOR UPDATE OF s`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return row;
  }

  // Trạng thái theo ngày khi không bị khóa tay (QUYTAC_NGHIEPVU_596): còn hạn đang hoạt động, trong ân hạn quá hạn, sau ân hạn tạm khóa.
  private statusByDate(endsOn: SQL): SQL {
    const today = this.today();
    return sql`CASE WHEN ${today}::date <= ${endsOn} THEN 'active' WHEN ${today}::date <= ${endsOn} + ${iposGraceDays}::int THEN 'overdue' ELSE 'locked' END`;
  }

  // Gia hạn một kỳ từ ngày hết hạn hiện tại; về đang hoạt động ngay trừ khi đang khóa tay (QUYTAC_NGHIEPVU_595, 596).
  async renew(actor: BuyerAdminActor, subscriptionId: string, version: number): Promise<IposSubscription> {
    await this.database.transaction(async (transaction) => {
      const current = await this.lockedRow(transaction, actor, subscriptionId, version);
      if (current.status === "cancelled") throw new ApiError("BUSINESS_RULE", "iposSubscriptionStatusInvalid");
      const newEnds = addMonths(sql`ends_on`, current.period_months);
      await transaction.execute(sql`
        UPDATE ipos.subscriptions SET ends_on = ${newEnds},
          status = CASE WHEN locked_manually THEN 'locked' WHEN status = 'trial' THEN 'trial' ELSE ${this.statusByDate(newEnds)} END,
          updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${subscriptionId}`);
      await this.record(actor, "ipos_subscription.renew", "ipos_subscription", subscriptionId, { previousEndsOn: current.ends_on }, transaction);
    });
    return this.detail(actor, subscriptionId);
  }

  async lock(actor: BuyerAdminActor, subscriptionId: string, version: number, reason: string | null): Promise<IposSubscription> {
    if (!reason) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { reason: "required" } });
    await this.database.transaction(async (transaction) => {
      const current = await this.lockedRow(transaction, actor, subscriptionId, version);
      if (current.status === "cancelled" || current.locked_manually) throw new ApiError("BUSINESS_RULE", "iposSubscriptionStatusInvalid");
      await transaction.execute(sql`
        UPDATE ipos.subscriptions SET status = 'locked', locked_manually = true, status_reason = ${reason}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${subscriptionId}`);
      await this.record(actor, "ipos_subscription.lock", "ipos_subscription", subscriptionId, { reason }, transaction);
    });
    return this.detail(actor, subscriptionId);
  }

  // Mở khóa tay: trạng thái tính lại theo ngày (dùng thử còn hạn thì về dùng thử).
  async unlock(actor: BuyerAdminActor, subscriptionId: string, version: number): Promise<IposSubscription> {
    await this.database.transaction(async (transaction) => {
      const current = await this.lockedRow(transaction, actor, subscriptionId, version);
      if (!current.locked_manually) throw new ApiError("BUSINESS_RULE", "iposSubscriptionStatusInvalid");
      await transaction.execute(sql`
        UPDATE ipos.subscriptions SET locked_manually = false, status_reason = NULL,
          status = CASE WHEN trial_ends_on IS NOT NULL AND ${this.today()}::date < trial_ends_on THEN 'trial' ELSE ${this.statusByDate(sql`ends_on`)} END,
          updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${subscriptionId}`);
      await this.record(actor, "ipos_subscription.unlock", "ipos_subscription", subscriptionId, {}, transaction);
    });
    return this.detail(actor, subscriptionId);
  }

  // Hủy: không xóa dữ liệu; chủ cửa hàng còn xem được 12 tháng (QUYTAC_NGHIEPVU_596).
  async cancel(actor: BuyerAdminActor, subscriptionId: string, version: number, reason: string | null): Promise<IposSubscription> {
    if (!reason) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { reason: "required" } });
    await this.database.transaction(async (transaction) => {
      const current = await this.lockedRow(transaction, actor, subscriptionId, version);
      if (current.status === "cancelled") throw new ApiError("BUSINESS_RULE", "iposSubscriptionStatusInvalid");
      await transaction.execute(sql`
        UPDATE ipos.subscriptions SET status = 'cancelled', locked_manually = false, status_reason = ${reason}, cancelled_at = now(), updated_by = ${actor.userId},
          updated_at = now(), version = version + 1
        WHERE id = ${subscriptionId}`);
      await this.record(actor, "ipos_subscription.cancel", "ipos_subscription", subscriptionId, { reason }, transaction);
    });
    return this.detail(actor, subscriptionId);
  }

  // Việc nền `ipos-subscriptions-daily` (QUYTAC_NGHIEPVU_596, 603): hết dùng thử thì đang hoạt động; miễn phí còn hiệu lực thì tự gia hạn;
  // quá ngày hết hạn thì quá hạn; hết ân hạn thì tạm khóa. Lập phiếu phí, nhắc gia hạn thêm ở lát L7.
  async runDaily(): Promise<{ trialEnded: number; renewedFree: number; overdue: number; locked: number }> {
    const today = this.today();
    return this.database.transaction(async (transaction) => {
      const trialEnded = await transaction.execute(sql`
        UPDATE ipos.subscriptions SET status = 'active', updated_at = now(), version = version + 1
        WHERE status = 'trial' AND trial_ends_on <= ${today}::date`);
      // Miễn phí còn hiệu lực: gia hạn từng kỳ cho đến khi ngày hết hạn qua hôm nay.
      let renewedFree = 0;
      for (;;) {
        const renewed = await transaction.execute(sql`
          UPDATE ipos.subscriptions s SET ends_on = (s.ends_on + make_interval(months => s.period_months))::date,
            status = CASE WHEN s.locked_manually THEN 'locked' ELSE 'active' END, updated_at = now(), version = s.version + 1
          FROM ipos.merchant_billing b
          WHERE b.merchant_id = s.merchant_id AND b.method = 'free' AND (b.free_until IS NULL OR b.free_until >= ${today}::date)
            AND s.status IN ('active', 'overdue', 'locked') AND s.ends_on < ${today}::date`);
        renewedFree += renewed.rowCount ?? 0;
        if (!renewed.rowCount) break;
      }
      const overdue = await transaction.execute(sql`
        UPDATE ipos.subscriptions SET status = 'overdue', updated_at = now(), version = version + 1
        WHERE status = 'active' AND ends_on < ${today}::date AND ${today}::date <= ends_on + ${iposGraceDays}::int`);
      const locked = await transaction.execute(sql`
        UPDATE ipos.subscriptions SET status = 'locked', updated_at = now(), version = version + 1
        WHERE status IN ('active', 'overdue') AND ${today}::date > ends_on + ${iposGraceDays}::int`);
      return { trialEnded: trialEnded.rowCount ?? 0, renewedFree, overdue: overdue.rowCount ?? 0, locked: locked.rowCount ?? 0 };
    });
  }
}
