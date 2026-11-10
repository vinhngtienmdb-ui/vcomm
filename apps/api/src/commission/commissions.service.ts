// Hoa hồng đội kinh doanh (CONG_VIEC_17; CHUC_NANG_80 đến 82; QUYTAC_NGHIEPVU_108 đến 110; API_93, API_94):
// cài đặt, chỉ tiêu, phát sinh khi trừ nợ phiếu xuất bằng phiếu thu, khi hoàn tiền trả hàng, bán lẻ khi giao, khi nhận hàng trả lại.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  CommissionEventItem,
  CommissionSettingsResponse,
  CommissionTargetsResponse,
  PageResponse,
  commissionEventsQuerySchema,
  saveCommissionTargetsSchema,
  updateCommissionSettingsSchema,
} from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { DebtsService } from "../finance/debts.service";
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { StockDocumentsService } from "../inventory/stock-documents.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { commissionPercent, loadRateSettings } from "./commission-rules";

type Executor = Pick<Database, "execute">;
export const commissionPermissions = { view: "finance.commission.view", manage: "finance.commission.manage", setup: "finance.commission.setup" } as const;

type LineShare = { order_line_id: string; category_id: string; gross: string; net: string };

@Injectable()
export class CommissionsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly debts: DebtsService,
    private readonly documents: StockDocumentsService,
  ) {}

  onModuleInit(): void {
    this.debts.allocatedHooks.push((transaction, allocationId) => this.recordAllocation(transaction, allocationId));
    this.documents.postedHooks.push((transaction, documentId) => this.recordRetail(transaction, documentId));
  }

  // Tiền gồm thuế, chưa thuế từng dòng của phiếu xuất hoặc phiếu trả, theo lũy kế dòng đơn như công nợ (THAY_DOI_10).
  private async lineShares(transaction: Executor, documentId: string, type: "sales_issue" | "sales_return"): Promise<LineShare[]> {
    const orderLine = type === "sales_issue" ? sql`sl.id = dl.source_line_id` : sql`sl.id = (SELECT il.source_line_id FROM inventory.document_lines il WHERE il.id = dl.source_line_id)`;
    const before =
      type === "sales_issue"
        ? sql`SELECT coalesce(sum(abs(o.base_quantity)), 0) AS before FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
            WHERE o.source_line_id = sl.id AND od.type = 'sales_issue' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)`
        : sql`SELECT coalesce(sum(abs(o.base_quantity)), 0) AS before FROM inventory.document_lines o JOIN inventory.documents od ON od.id = o.document_id
            JOIN inventory.document_lines oi ON oi.id = o.source_line_id
            WHERE oi.source_line_id = sl.id AND od.type = 'sales_return' AND od.status = 'posted' AND (od.posted_at, od.id) < (d.posted_at, d.id)`;
    return (
      await transaction.execute<LineShare>(sql`
      WITH d AS (SELECT id, posted_at, finance.company_minor_units(company_id) AS units FROM inventory.documents WHERE id = ${documentId})
      SELECT sl.id AS order_line_id, p.category_id,
        finance.line_share(sl.total_amount, b.before, abs(dl.base_quantity), sl.base_quantity, d.units)::text AS gross,
        finance.line_share(sl.net_amount, b.before, abs(dl.base_quantity), sl.base_quantity, d.units)::text AS net
      FROM d JOIN inventory.document_lines dl ON dl.document_id = d.id JOIN sales.order_lines sl ON ${orderLine}
      JOIN catalog.variants v ON v.id = dl.variant_id JOIN catalog.products p ON p.id = v.product_id
      CROSS JOIN LATERAL (${before}) b
      ORDER BY dl.line_no`)
    ).rows;
  }

  // Ghi phát sinh của một phần tiền (gồm thuế) trên phiếu kho, chia cho các dòng theo tiền gồm thuế, quy về tiền chưa thuế.
  private async record(
    transaction: Executor,
    input: {
      companyId: string;
      orderId: string;
      documentId: string;
      type: "sales_issue" | "sales_return";
      sourceType: string;
      sourceId: string;
      eventDate: string;
      amount: number | null;
      sign: 1 | -1;
    },
  ): Promise<void> {
    const order = (await transaction.execute<{ commission_user_id: string | null; channel_id: string }>(sql`SELECT commission_user_id, channel_id FROM sales.orders WHERE id = ${input.orderId}`))
      .rows[0];
    if (!order?.commission_user_id) return;
    const settings = (
      await transaction.execute<{ enabled: boolean; start_date: string | null }>(sql`SELECT enabled, start_date::text FROM finance.commission_settings WHERE company_id = ${input.companyId}`)
    ).rows[0];
    if (!settings?.enabled || !settings.start_date || input.eventDate < settings.start_date) return;
    const rates = (await loadRateSettings(transaction, input.companyId))!;
    const units = Number((await transaction.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${input.companyId}) AS units`)).rows[0]!.units);
    const round = (value: number) => Math.round(value * 10 ** units) / 10 ** units;
    const lines = await this.lineShares(transaction, input.documentId, input.type);
    const grossTotal = lines.reduce((sum, line) => sum + Number(line.gross), 0);
    if (grossTotal <= 0) return;
    // Cả phiếu (bán lẻ): tiền chưa thuế của dòng; một phần (trừ nợ): phần tiền × tiền chưa thuế dòng / tổng gồm thuế.
    const fraction = input.amount === null ? 1 : Math.min(input.amount / grossTotal, 1);
    for (const line of lines) {
      const base = round(Number(line.net) * fraction) * input.sign;
      const percent = commissionPercent(rates, line.category_id, order.channel_id);
      await transaction.execute(sql`
        INSERT INTO finance.commission_events (company_id, user_id, order_id, source_type, source_id, document_id, order_line_id, event_date, base_amount, percent, amount)
        VALUES (${input.companyId}, ${order.commission_user_id}, ${input.orderId}, ${input.sourceType}, ${input.sourceId}, ${input.documentId}, ${line.order_line_id},
          ${input.eventDate}::date, ${base}, ${percent}, ${round((base * percent) / 100)})
        ON CONFLICT (source_type, source_id, order_line_id) DO NOTHING`);
    }
  }

  // Trừ nợ: phiếu thu trừ phiếu xuất giao hàng (dương), phiếu chi hoàn tiền trừ phiếu nhận hàng trả lại (âm) (QUYTAC_NGHIEPVU_110).
  async recordAllocation(transaction: Executor, allocationId: string): Promise<void> {
    const row = (
      await transaction.execute<{
        company_id: string;
        amount: string;
        debit_source: string;
        debit_source_id: string | null;
        credit_source: string;
        credit_source_id: string | null;
        debit_date: string;
        credit_date: string;
      }>(sql`
      SELECT a.company_id, a.amount::text, d.source_type AS debit_source, d.source_id AS debit_source_id, c.source_type AS credit_source, c.source_id AS credit_source_id,
        d.document_date::text AS debit_date, c.document_date::text AS credit_date
      FROM finance.debt_allocations a JOIN finance.debt_items d ON d.id = a.debit_item_id JOIN finance.debt_items c ON c.id = a.credit_item_id
      WHERE a.id = ${allocationId} AND d.side = 'receivable'`)
    ).rows[0];
    if (!row) return;
    // Thu trước rồi mới giao: ngày phát sinh là ngày muộn hơn.
    const eventDate = row.debit_date > row.credit_date ? row.debit_date : row.credit_date;
    if (row.debit_source === "sales_issue" && row.credit_source === "payment") {
      const kind = (await transaction.execute<{ kind: string }>(sql`SELECT kind FROM finance.payments WHERE id = ${row.credit_source_id}`)).rows[0]?.kind;
      if (kind !== "customer_receipt") return;
      const issue = (await transaction.execute<{ source_id: string }>(sql`SELECT source_id FROM inventory.documents WHERE id = ${row.debit_source_id} AND source_type = 'sales.order'`)).rows[0];
      if (!issue) return;
      await this.record(transaction, {
        companyId: row.company_id,
        orderId: issue.source_id,
        documentId: row.debit_source_id!,
        type: "sales_issue",
        sourceType: "receipt",
        sourceId: allocationId,
        eventDate,
        amount: Number(row.amount),
        sign: 1,
      });
    } else if (row.credit_source === "sales_return" && row.debit_source === "payment") {
      const order = (
        await transaction.execute<{ order_id: string }>(sql`
        SELECT i.source_id AS order_id FROM inventory.documents r JOIN inventory.documents i ON i.id = r.source_id AND r.source_type = 'inventory.document'
        WHERE r.id = ${row.credit_source_id} AND i.source_type = 'sales.order'`)
      ).rows[0];
      if (!order) return;
      await this.record(transaction, {
        companyId: row.company_id,
        orderId: order.order_id,
        documentId: row.credit_source_id!,
        type: "sales_return",
        sourceType: "refund",
        sourceId: allocationId,
        eventDate,
        amount: Number(row.amount),
        sign: -1,
      });
    }
  }

  // Đơn không có khách: phiếu xuất giao hàng ghi sổ là đã thu toàn bộ, phiếu nhận hàng trả lại ghi âm.
  async recordRetail(transaction: Executor, documentId: string): Promise<void> {
    const document = (
      await transaction.execute<{ type: string; company_id: string; document_date: string; order_id: string | null; customer_id: string | null }>(sql`
      SELECT d.type, d.company_id, d.document_date::text,
        CASE WHEN d.type = 'sales_issue' THEN d.source_id ELSE (SELECT i.source_id FROM inventory.documents i WHERE i.id = d.source_id) END AS order_id,
        o.customer_id
      FROM inventory.documents d LEFT JOIN sales.orders o ON o.id = CASE WHEN d.type = 'sales_issue' THEN d.source_id ELSE (SELECT i.source_id FROM inventory.documents i WHERE i.id = d.source_id) END
      WHERE d.id = ${documentId} AND d.type IN ('sales_issue', 'sales_return')`)
    ).rows[0];
    if (!document?.order_id || document.customer_id) return;
    await this.record(transaction, {
      companyId: document.company_id,
      orderId: document.order_id,
      documentId,
      type: document.type as "sales_issue" | "sales_return",
      sourceType: document.type === "sales_issue" ? "retail_delivery" : "retail_return",
      sourceId: documentId,
      eventDate: document.document_date,
      amount: null,
      sign: document.type === "sales_issue" ? 1 : -1,
    });
  }

  async settings(actor: Actor): Promise<CommissionSettingsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, commissionPermissions.view, commissionPermissions.setup);
    const row = (
      await this.database.execute<{
        enabled: boolean;
        start_date: string | null;
        assignment: "customer_owner" | "order_creator";
        combination: "matrix" | "channel_factor";
        default_percent: string;
        tiers: { fromPercent: string; multiplier: string }[];
        version: number;
      }>(sql`SELECT enabled, start_date::text, assignment, combination, default_percent::text, tiers, version FROM finance.commission_settings WHERE company_id = ${actor.companyId}`)
    ).rows[0];
    const rates = await this.database.execute<{ category_id: string; channel_id: string | null; percent: string }>(sql`
      SELECT category_id, channel_id, percent::text FROM finance.commission_rates WHERE company_id = ${actor.companyId}`);
    const factors = await this.database.execute<{ channel_id: string; factor: string }>(sql`
      SELECT channel_id, factor::text FROM finance.commission_channel_factors WHERE company_id = ${actor.companyId}`);
    const categories = await this.database.execute<{ id: string; parent_id: string | null; code: string; name_vi: string }>(sql`
      SELECT id, parent_id, code, name_vi FROM catalog.categories WHERE status = 'active' ORDER BY code`);
    const channels = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name FROM catalog.sales_channels WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`);
    return {
      enabled: row?.enabled ?? false,
      startDate: row?.start_date ?? null,
      assignment: row?.assignment ?? "customer_owner",
      combination: row?.combination ?? "matrix",
      defaultPercent: trimDecimal(row?.default_percent ?? "0"),
      tiers: row?.tiers ?? [{ fromPercent: "0", multiplier: "1" }],
      rates: rates.rows.map((item) => ({ categoryId: item.category_id, channelId: item.channel_id, percent: trimDecimal(item.percent) })),
      channelFactors: factors.rows.map((item) => ({ channelId: item.channel_id, factor: trimDecimal(item.factor) })),
      categories: categories.rows.map((item) => ({ id: item.id, parentId: item.parent_id, code: item.code, name: item.name_vi })),
      channels: channels.rows,
      canSetup: granted.has(commissionPermissions.setup),
      version: row?.version ?? 0,
    };
  }

  async updateSettings(actor: Actor, input: z.output<typeof updateCommissionSettingsSchema>): Promise<CommissionSettingsResponse> {
    await requireFinancePermission(this.permissionService, actor, commissionPermissions.setup);
    const fields: NonNullable<NonNullable<ConstructorParameters<typeof ApiError>[2]>["fields"]> = {};
    if (input.enabled && !input.startDate) fields.startDate = "required";
    const tiers = [...input.tiers].sort((left, right) => Number(left.fromPercent) - Number(right.fromPercent));
    if (Number(tiers[0]!.fromPercent) !== 0) fields.tiers = "commissionTierStart";
    if (new Set(tiers.map((tier) => Number(tier.fromPercent))).size !== tiers.length) fields.tiers = "commissionTierDuplicate";
    const rateKeys = new Set<string>();
    input.rates.forEach((rate, index) => {
      const key = `${rate.categoryId}:${rate.channelId ?? ""}`;
      if (rateKeys.has(key)) fields[`rates.${index}.categoryId`] = "commissionRateDuplicate";
      rateKeys.add(key);
    });
    // Ngành hàng dùng chung tập đoàn; kênh, hệ số kênh của công ty.
    const channelIds = [...new Set([...input.rates.map((rate) => rate.channelId).filter((id): id is string => Boolean(id)), ...input.channelFactors.map((factor) => factor.channelId)])];
    if (channelIds.length > 0) {
      const known = await this.database.execute<{ id: string }>(sql`
        SELECT id FROM catalog.sales_channels WHERE company_id = ${actor.companyId} AND id IN (${sql.join(
          channelIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`);
      const valid = new Set(known.rows.map((row) => row.id));
      input.rates.forEach((rate, index) => {
        if (rate.channelId && !valid.has(rate.channelId)) fields[`rates.${index}.channelId`] = "invalidValue";
      });
      input.channelFactors.forEach((factor, index) => {
        if (!valid.has(factor.channelId)) fields[`channelFactors.${index}.channelId`] = "invalidValue";
      });
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<{ version: number }>(sql`SELECT version FROM finance.commission_settings WHERE company_id = ${actor.companyId} FOR UPDATE`)).rows[0];
      if ((before?.version ?? 0) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`
        INSERT INTO finance.commission_settings (company_id, enabled, start_date, assignment, combination, default_percent, tiers, updated_by, version)
        VALUES (${actor.companyId}, ${input.enabled}, ${input.startDate}, ${input.assignment}, ${input.combination}, ${input.defaultPercent}, ${JSON.stringify(tiers)}::jsonb, ${actor.userId}, 1)
        ON CONFLICT (company_id) DO UPDATE SET enabled = EXCLUDED.enabled, start_date = EXCLUDED.start_date, assignment = EXCLUDED.assignment, combination = EXCLUDED.combination,
          default_percent = EXCLUDED.default_percent, tiers = EXCLUDED.tiers, updated_at = now(), updated_by = EXCLUDED.updated_by, version = finance.commission_settings.version + 1`);
      await transaction.execute(sql`DELETE FROM finance.commission_rates WHERE company_id = ${actor.companyId}`);
      for (const rate of input.rates)
        await transaction.execute(sql`
          INSERT INTO finance.commission_rates (company_id, category_id, channel_id, percent) VALUES (${actor.companyId}, ${rate.categoryId}, ${rate.channelId}, ${rate.percent})`);
      await transaction.execute(sql`DELETE FROM finance.commission_channel_factors WHERE company_id = ${actor.companyId}`);
      for (const factor of input.channelFactors)
        await transaction.execute(sql`INSERT INTO finance.commission_channel_factors (company_id, channel_id, factor) VALUES (${actor.companyId}, ${factor.channelId}, ${factor.factor})`);
      await this.auditService.record({ ...financeAudit(actor, "commission_settings"), action: "commission_settings.update", entityId: actor.companyId, afterData: input }, transaction);
    });
    return this.settings(actor);
  }

  // Nhân viên của công ty và chỉ tiêu tháng.
  async targets(actor: Actor, month: string): Promise<CommissionTargetsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, commissionPermissions.view, commissionPermissions.setup);
    const staff = await this.database.execute<{ user_id: string; full_name: string; amount: string | null }>(sql`
      SELECT u.id AS user_id, u.full_name, t.amount::text
      FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id AND u.status = 'active'
      LEFT JOIN finance.commission_targets t ON t.company_id = m.company_id AND t.user_id = u.id AND t.month = ${month}
      WHERE m.company_id = ${actor.companyId} AND m.status = 'active' ORDER BY u.full_name`);
    return {
      month,
      staff: staff.rows.map((row) => ({ userId: row.user_id, fullName: row.full_name, amount: row.amount === null ? null : trimDecimal(row.amount) })),
      canSetup: granted.has(commissionPermissions.setup),
    };
  }

  async saveTargets(actor: Actor, input: z.output<typeof saveCommissionTargetsSchema>): Promise<CommissionTargetsResponse> {
    await requireFinancePermission(this.permissionService, actor, commissionPermissions.setup);
    const members = new Set(
      (await this.database.execute<{ user_id: string }>(sql`SELECT user_id FROM core.user_company_memberships WHERE company_id = ${actor.companyId} AND status = 'active'`)).rows.map(
        (row) => row.user_id,
      ),
    );
    const fields: Record<string, "invalidValue"> = {};
    input.targets.forEach((target, index) => {
      if (!members.has(target.userId)) fields[`targets.${index}.userId`] = "invalidValue";
      if (target.amount !== null && Number(target.amount) <= 0) fields[`targets.${index}.amount`] = "invalidValue";
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await this.database.transaction(async (transaction) => {
      for (const target of input.targets) {
        if (target.amount === null)
          await transaction.execute(sql`DELETE FROM finance.commission_targets WHERE company_id = ${actor.companyId} AND user_id = ${target.userId} AND month = ${input.month}`);
        else
          await transaction.execute(sql`
            INSERT INTO finance.commission_targets (company_id, user_id, month, amount) VALUES (${actor.companyId}, ${target.userId}, ${input.month}, ${target.amount})
            ON CONFLICT (company_id, user_id, month) DO UPDATE SET amount = EXCLUDED.amount`);
      }
      await this.auditService.record({ ...financeAudit(actor, "commission_targets"), action: "commission_targets.update", entityId: actor.companyId, afterData: input }, transaction);
    });
    return this.targets(actor, input.month);
  }

  async events(actor: Actor, query: z.output<typeof commissionEventsQuerySchema>): Promise<PageResponse<CommissionEventItem>> {
    await requireFinancePermission(this.permissionService, actor, commissionPermissions.view);
    const conditions: SQL[] = [sql`e.company_id = ${actor.companyId}`];
    if (query.userId) conditions.push(sql`e.user_id = ${query.userId}`);
    if (query.from) conditions.push(sql`e.event_date >= ${query.from}::date`);
    if (query.to) conditions.push(sql`e.event_date <= ${query.to}::date`);
    const where = sql.join(conditions, sql` AND `);
    const total = Number((await this.database.execute<{ total: string }>(sql`SELECT count(*)::text AS total FROM finance.commission_events e WHERE ${where}`)).rows[0]!.total);
    const rows = await this.database.execute<{
      id: string;
      event_date: string;
      user_id: string;
      full_name: string;
      source_type: CommissionEventItem["sourceType"];
      source_no: string | null;
      order_id: string;
      order_no: string | null;
      item_name: string;
      base_amount: string;
      percent: string;
      amount: string;
      statement_no: string | null;
    }>(sql`
      SELECT e.id, e.event_date::text, e.user_id, u.full_name, e.source_type, o.document_no AS order_no, e.order_id, p.name AS item_name, e.base_amount::text, e.percent::text, e.amount::text,
        s.document_no AS statement_no,
        CASE WHEN e.source_type IN ('receipt', 'refund')
          THEN (SELECT pay.document_no FROM finance.debt_allocations a JOIN finance.debt_items i ON i.id IN (a.credit_item_id, a.debit_item_id) AND i.source_type = 'payment'
                JOIN finance.payments pay ON pay.id = i.source_id WHERE a.id = e.source_id LIMIT 1)
          ELSE (SELECT d.document_no FROM inventory.documents d WHERE d.id = e.source_id) END AS source_no
      FROM finance.commission_events e JOIN core.users u ON u.id = e.user_id JOIN sales.orders o ON o.id = e.order_id
      JOIN sales.order_lines l ON l.id = e.order_line_id JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      LEFT JOIN finance.commission_statements s ON s.id = e.statement_id
      WHERE ${where} ORDER BY e.event_date DESC, e.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        id: row.id,
        eventDate: day(row.event_date),
        userId: row.user_id,
        userName: row.full_name,
        sourceType: row.source_type,
        sourceNo: row.source_no,
        orderId: row.order_id,
        orderNo: row.order_no,
        itemName: row.item_name,
        baseAmount: trimDecimal(row.base_amount),
        percent: trimDecimal(row.percent),
        amount: trimDecimal(row.amount),
        statementNo: row.statement_no,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
