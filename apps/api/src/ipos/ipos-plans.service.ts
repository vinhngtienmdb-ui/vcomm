// Gói iPOS do công ty vận hành sàn khai báo (CONG_VIEC_74; CHUC_NANG_252; QUYTAC_NGHIEPVU_594; API_354).
import { Inject, Injectable } from "@nestjs/common";
import type { IposPlan, IposPlanStatus, iposPlanCreateSchema, iposPlanUpdateSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  monthly_price: string;
  tax_percent: string;
  max_registers: number;
  max_items: number | null;
  trial_days: number;
  status: IposPlanStatus;
  active_subscriptions: number;
  version: number;
};

const planOf = (row: PlanRow): IposPlan => ({
  id: row.id,
  code: row.code,
  name: row.name,
  monthlyPrice: trimDecimal(row.monthly_price),
  taxPercent: trimDecimal(row.tax_percent),
  maxRegisters: row.max_registers,
  maxItems: row.max_items,
  trialDays: row.trial_days,
  status: row.status,
  activeSubscriptions: row.active_subscriptions,
  version: row.version,
});

const planColumns = sql`p.id, p.code, p.name, p.monthly_price::text, p.tax_percent::text, p.max_registers, p.max_items, p.trial_days, p.status, p.version,
  (SELECT count(*)::int FROM ipos.subscriptions s WHERE s.plan_id = p.id AND s.status <> 'cancelled') AS active_subscriptions`;

@Injectable()
export class IposPlansService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  private record(actor: BuyerAdminActor, action: string, entityId: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "crm",
        action,
        entityType: "ipos_plan",
        entityId,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }

  async list(actor: BuyerAdminActor): Promise<IposPlan[]> {
    const rows = await this.database.execute<PlanRow>(sql`
      SELECT ${planColumns} FROM ipos.plans p WHERE p.company_id = ${actor.operatorCompanyId} ORDER BY p.status DESC, p.monthly_price, p.code`);
    return rows.rows.map(planOf);
  }

  async detail(actor: BuyerAdminActor, planId: string): Promise<IposPlan> {
    const row = (await this.database.execute<PlanRow>(sql`SELECT ${planColumns} FROM ipos.plans p WHERE p.id = ${planId} AND p.company_id = ${actor.operatorCompanyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return planOf(row);
  }

  async create(actor: BuyerAdminActor, input: z.infer<typeof iposPlanCreateSchema>): Promise<IposPlan> {
    const id = await this.database
      .transaction(async (transaction) => {
        const inserted = await transaction.execute<{ id: string }>(sql`
          INSERT INTO ipos.plans (company_id, code, name, monthly_price, tax_percent, max_registers, max_items, trial_days, created_by, updated_by)
          VALUES (${actor.operatorCompanyId}, ${input.code}, ${input.name}, ${input.monthlyPrice}, ${input.taxPercent}, ${input.maxRegisters}, ${input.maxItems},
            ${input.trialDays}, ${actor.userId}, ${actor.userId})
          RETURNING id`);
        const planId = inserted.rows[0]!.id;
        await this.record(actor, "ipos_plan.create", planId, input, transaction);
        return planId;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "iposPlanCodeTaken");
        throw error;
      });
    return this.detail(actor, id);
  }

  // Sửa giá áp cho phiếu phí lập sau khi sửa; gói ngừng bán không cấp mới, thuê bao đang dùng giữ nguyên (QUYTAC_NGHIEPVU_594).
  async update(actor: BuyerAdminActor, planId: string, input: z.infer<typeof iposPlanUpdateSchema>): Promise<IposPlan> {
    await this.database.transaction(async (transaction) => {
      const row = (await transaction.execute<{ version: number }>(sql`SELECT version FROM ipos.plans WHERE id = ${planId} AND company_id = ${actor.operatorCompanyId} FOR UPDATE`)).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`
        UPDATE ipos.plans SET name = ${input.name}, monthly_price = ${input.monthlyPrice}, tax_percent = ${input.taxPercent}, max_registers = ${input.maxRegisters},
          max_items = ${input.maxItems}, trial_days = ${input.trialDays}, status = ${input.status}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${planId}`);
      await this.record(actor, "ipos_plan.update", planId, input, transaction);
    });
    return this.detail(actor, planId);
  }
}
