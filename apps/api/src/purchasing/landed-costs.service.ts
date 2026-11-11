// Chứng từ chi phí nhập khẩu (CONG_VIEC_45; CHUC_NANG_161; QUYTAC_NGHIEPVU_289 đến 291; API_142, API_143).
// Vận chuyển, bảo hiểm, phí của một tờ khai đã ghi sổ: phân bổ theo giá trị hoặc số lượng cho các dòng tờ khai, vào giá vốn qua phiếu điều chỉnh giá trị,
// công nợ phải trả nhà cung cấp dịch vụ, bút toán.
import { Inject, Injectable } from "@nestjs/common";
import type {
  LandedCostAllocation,
  LandedCostBasis,
  LandedCostKind,
  LandedCostLineResponse,
  LandedCostListItem,
  landedCostListQuerySchema,
  LandedCostResponse,
  PageResponse,
  saveLandedCostSchema,
  VatRate,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { LedgerService } from "../accounting/ledger.service";
import { credit, debit, rounder } from "../accounting/postings";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { DebtsService } from "../finance/debts.service";
import { CostAdjustmentsService, type CostShare } from "../inventory/cost-adjustments.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { minorUnits } from "./import-declarations.service";
import { accountingRate } from "./orders.service";
import { isActiveSupplier, purchasingAudit, purchasingPermissions, requirePermission, type Executor, type FieldErrors } from "./purchasing-context";
import { companyCurrency, ensureSequence } from "./requisitions.service";

type Input = z.output<typeof saveLandedCostSchema>;
const documentTypeCode = "purchasing.landed_cost";
type HeaderRow = {
  id: string;
  company_id: string;
  document_no: string | null;
  invoice_no: string;
  document_date: Date | string;
  declaration_id: string;
  declaration_no: string;
  declaration_status: string;
  warehouse_id: string;
  supplier_id: string;
  supplier_name: string;
  currency: string;
  exchange_rate: string;
  note: string | null;
  status: "draft" | "posted" | "cancelled";
  net_amount: string;
  vat_amount: string;
  version: number;
};
type CostLineRow = { id: string; amount_converted: string; basis: LandedCostBasis };
type TargetRow = { id: string; order_line_id: string; variant_id: string; sku: string; product_name: string; base_quantity: string; customs_value_converted: string };

const roundTo = (value: number, units: number) => Math.round(value * 10 ** units) / 10 ** units;
const vatPercent = (rate: VatRate) => (["0", "5", "8", "10"].includes(rate) ? Number(rate) : 0);

// QUYTAC_NGHIEPVU_290: chia một khoản theo tỷ lệ trọng số, làm tròn theo đơn vị nhỏ nhất, phần chênh lệch cộng vào dòng có phần lớn nhất.
export function splitAmount(amount: number, weights: number[], units: number): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return weights.map(() => 0);
  const shares = weights.map((weight) => roundTo((amount * weight) / total, units));
  const difference = roundTo(amount - shares.reduce((sum, share) => sum + share, 0), units);
  if (difference !== 0) {
    const largest = shares.reduce((best, share, index) => (share > shares[best]! ? index : best), 0);
    shares[largest] = roundTo(shares[largest]! + difference, units);
  }
  return shares;
}

@Injectable()
export class LandedCostsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly ledger: LedgerService,
    private readonly debts: DebtsService,
    private readonly costAdjustments: CostAdjustmentsService,
  ) {}

  async list(actor: Actor, query: z.output<typeof landedCostListQuerySchema>): Promise<PageResponse<LandedCostListItem>> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const conditions: SQL[] = [sql`c.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`c.status = ${query.status}`);
    if (query.declarationId) conditions.push(sql`c.declaration_id = ${query.declarationId}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(c.document_no ILIKE ${pattern} OR c.invoice_no ILIKE ${pattern} OR d.declaration_no ILIKE ${pattern} OR s.name ILIKE ${pattern})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<HeaderRow>(sql`${select()} ${from()} WHERE ${where} ORDER BY c.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(toItem), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<LandedCostResponse> {
    const granted = await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const row = await this.header(this.database, actor.companyId, id);
    const lines = await this.database.execute<{
      id: string;
      line_no: number;
      kind: LandedCostKind;
      description: string | null;
      amount: string;
      amount_converted: string;
      vat_rate: VatRate;
      vat_amount: string;
      basis: LandedCostBasis;
    }>(sql`
      SELECT id, line_no, kind, description, amount::text, amount_converted::text, vat_rate, vat_amount::text, basis
      FROM purchasing.landed_cost_lines WHERE landed_cost_id = ${id} ORDER BY line_no`);
    const manage = granted.has(purchasingPermissions.manageImports);
    return {
      ...toItem(row),
      exchangeRate: trimDecimal(row.exchange_rate),
      companyCurrency: await companyCurrency(this.database, row.company_id),
      note: row.note,
      lines: lines.rows.map(
        (line): LandedCostLineResponse => ({
          id: line.id,
          lineNo: line.line_no,
          kind: line.kind,
          description: line.description,
          amount: trimDecimal(line.amount),
          amountConverted: trimDecimal(line.amount_converted),
          vatRate: line.vat_rate,
          vatAmount: trimDecimal(line.vat_amount),
          basis: line.basis,
        }),
      ),
      version: row.version,
      canEdit: manage && row.status === "draft",
      canPost: manage && row.status === "draft",
    };
  }

  async create(actor: Actor, input: Input): Promise<LandedCostResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    const id = await this.database.transaction(async (transaction) => {
      const prepared = await this.prepare(transaction, actor.companyId, input);
      const costId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO purchasing.landed_costs (company_id, declaration_id, supplier_id, invoice_no, document_date, currency, exchange_rate, note, created_by)
        VALUES (${actor.companyId}, ${input.declarationId}, ${input.supplierId}, ${input.invoiceNo}, ${input.documentDate}::date, ${prepared.currency}, ${prepared.rate}::numeric,
          ${input.note}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await writeLines(transaction, costId, input, prepared.lines);
      await this.auditService.record({ ...purchasingAudit(actor, "landed_cost"), action: "landed_cost.create", entityId: costId, afterData: input }, transaction);
      return costId;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<LandedCostResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    await this.database.transaction(async (transaction) => {
      const current = await this.header(transaction, actor.companyId, id);
      const locked = await transaction.execute(sql`SELECT 1 FROM purchasing.landed_costs WHERE id = ${id} AND status = 'draft' AND version = ${input.version ?? current.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError(current.status === "draft" ? "CONFLICT_VERSION" : "BUSINESS_RULE", current.status === "draft" ? "conflictVersion" : "documentNotDraft");
      const prepared = await this.prepare(transaction, actor.companyId, input);
      await transaction.execute(sql`
        UPDATE purchasing.landed_costs SET declaration_id = ${input.declarationId}, supplier_id = ${input.supplierId}, invoice_no = ${input.invoiceNo}, document_date = ${input.documentDate}::date,
          currency = ${prepared.currency}, exchange_rate = ${prepared.rate}::numeric, note = ${input.note}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await transaction.execute(sql`DELETE FROM purchasing.landed_cost_lines WHERE landed_cost_id = ${id}`);
      await writeLines(transaction, id, input, prepared.lines);
      await this.auditService.record({ ...purchasingAudit(actor, "landed_cost"), action: "landed_cost.update", entityId: id, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  async cancel(actor: Actor, id: string, version: number): Promise<LandedCostResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE purchasing.landed_costs SET status = 'cancelled', updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'draft' AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...purchasingAudit(actor, "landed_cost"), action: "landed_cost.cancel", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Phân bổ: chứng từ nháp tính theo tồn hiện tại; chứng từ đã ghi sổ đọc kết quả đã lưu.
  async allocation(actor: Actor, id: string): Promise<LandedCostAllocation> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const row = await this.header(this.database, actor.companyId, id);
    const targets = await this.targets(this.database, row.declaration_id);
    const costLines = await this.costLines(this.database, id);
    if (row.status === "posted") {
      const allocations = await this.database.execute<{ landed_cost_line_id: string; declaration_line_id: string; amount: string }>(sql`
        SELECT a.landed_cost_line_id, a.declaration_line_id, a.amount::text FROM purchasing.landed_cost_allocations a
        JOIN purchasing.landed_cost_lines l ON l.id = a.landed_cost_line_id WHERE l.landed_cost_id = ${id}`);
      const results = new Map(
        (
          await this.database.execute<{ declaration_line_id: string; amount: string; stock_value: string; expensed_value: string }>(sql`
          SELECT declaration_line_id, amount::text, stock_value::text, expensed_value::text FROM purchasing.landed_cost_targets WHERE landed_cost_id = ${id}`)
        ).rows.map((result) => [result.declaration_line_id, result]),
      );
      return {
        lines: targets.map((target) => ({
          ...targetInfo(target),
          byCostLine: costLines.map((line) => trimDecimal(allocations.rows.find((item) => item.landed_cost_line_id === line.id && item.declaration_line_id === target.id)?.amount ?? "0")),
          amount: trimDecimal(results.get(target.id)?.amount ?? "0"),
          onHand: null,
          stockValue: trimDecimal(results.get(target.id)?.stock_value ?? "0"),
          expensedValue: trimDecimal(results.get(target.id)?.expensed_value ?? "0"),
        })),
      };
    }
    const units = await minorUnits(this.database, row.company_id);
    const split = splitCosts(costLines, targets, units);
    const shares = await this.costAdjustments.shares(this.database, row.company_id, row.warehouse_id, shareInputs(targets, split.totals));
    return { lines: allocationLines(targets, split, shares) };
  }

  // Ghi sổ (QUYTAC_NGHIEPVU_289): kỳ chưa khóa; tờ khai vẫn đã ghi sổ; cấp số; phân bổ vào giá vốn; công nợ nhà cung cấp dịch vụ; bút toán.
  async post(actor: Actor, id: string, version: number): Promise<LandedCostResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    const current = await this.header(this.database, actor.companyId, id);
    await ensureSequence(this.database, this.sequences, { ...actor, companyId: current.company_id }, documentTypeCode, "CPNK");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM purchasing.landed_costs WHERE id = ${id} AND status = 'draft' AND version = ${version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError(current.status === "draft" ? "CONFLICT_VERSION" : "BUSINESS_RULE", current.status === "draft" ? "conflictVersion" : "documentNotDraft");
      const row = await this.header(transaction, actor.companyId, id);
      if (row.declaration_status !== "posted") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { declarationId: "declarationNotPosted" } });
      const documentDate = day(row.document_date);
      await this.ledger.requireOpenPeriod(transaction, row.company_id, documentDate);
      const documentNo = await this.sequences.next(row.company_id, documentTypeCode, transaction);
      const units = await minorUnits(transaction, row.company_id);
      const targets = await this.targets(transaction, row.declaration_id);
      const costLines = await this.costLines(transaction, id);
      const split = splitCosts(costLines, targets, units);
      for (const [lineIndex, line] of costLines.entries()) {
        for (const [targetIndex, target] of targets.entries()) {
          await transaction.execute(sql`
            INSERT INTO purchasing.landed_cost_allocations (landed_cost_line_id, declaration_line_id, amount) VALUES (${line.id}, ${target.id}, ${split.byLine[lineIndex]![targetIndex]!}::numeric)`);
        }
      }
      const shares = await this.costAdjustments.post(transaction, {
        companyId: row.company_id,
        warehouseId: row.warehouse_id,
        documentNo: `DCGT-${documentNo}`,
        documentDate,
        sourceType: "purchasing.landed_cost",
        sourceId: id,
        reason: `Chi phí nhập khẩu ${documentNo} theo tờ khai ${row.declaration_no}`,
        createdBy: actor.userId,
        lines: shareInputs(targets, split.totals),
      });
      for (const [index, target] of targets.entries()) {
        await transaction.execute(sql`
          INSERT INTO purchasing.landed_cost_targets (landed_cost_id, declaration_line_id, amount, stock_value, expensed_value)
          VALUES (${id}, ${target.id}, ${split.totals[index]!}::numeric, ${shares[index]!.stockValue}::numeric, ${shares[index]!.expensedValue}::numeric)`);
      }
      await transaction.execute(sql`
        UPDATE purchasing.landed_costs SET status = 'posted', document_no = ${documentNo}, posted_at = now(), posted_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);

      const money = await rounder(transaction, row.company_id);
      const stock = money(shares.reduce((sum, share) => sum + Number(share.stockValue), 0));
      const expensed = money(shares.reduce((sum, share) => sum + Number(share.expensedValue), 0));
      const vat = money(Number(row.vat_amount));
      const gross = money(Number(row.net_amount) + vat);
      await this.debts.recordLandedCost(transaction, {
        companyId: row.company_id,
        partnerId: row.supplier_id,
        sourceId: id,
        documentNo,
        documentDate,
        amount: String(gross),
        foreign:
          row.currency === (await companyCurrency(transaction, row.company_id))
            ? null
            : { currency: row.currency, amount: (await foreignGross(transaction, id, row.currency)) ?? "0", rate: row.exchange_rate },
      });
      await this.ledger.record(transaction, {
        companyId: row.company_id,
        sourceType: "landed_cost",
        sourceId: id,
        journalNo: documentNo,
        date: documentDate,
        description: `Chi phí nhập khẩu theo tờ khai ${row.declaration_no}, hóa đơn ${row.invoice_no}`,
        lines: [debit("goods", stock), debit("cogs", expensed), debit("vat_input", vat), credit("payable", gross, row.supplier_id)],
      });
      await this.auditService.record({ ...purchasingAudit(actor, "landed_cost"), action: "landed_cost.post", entityId: id, afterData: { documentNo, totals: split.totals } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Kiểm tờ khai đã ghi sổ, nhà cung cấp dịch vụ, tiền tệ; quy đổi tiền khoản theo tỷ giá hạch toán ngày chứng từ; thuế theo tiền tệ công ty.
  private async prepare(transaction: Executor, companyId: string, input: Input): Promise<{ currency: string; rate: string; lines: { converted: number; vat: number }[] }> {
    const fields: FieldErrors = {};
    const declaration = (await transaction.execute<{ status: string }>(sql`SELECT status FROM purchasing.import_declarations WHERE id = ${input.declarationId} AND company_id = ${companyId}`)).rows[0];
    if (!declaration || declaration.status !== "posted") fields.declarationId = "declarationNotPosted";
    if (!(await isActiveSupplier(transaction, companyId, input.supplierId))) fields.supplierId = "supplierNotActive";
    const base = await companyCurrency(transaction, companyId);
    const currency = input.currency ?? base;
    let rate: string | null = "1";
    if (currency !== base) {
      const active = await transaction.execute(sql`SELECT 1 FROM core.currencies WHERE code = ${currency} AND is_active`);
      if (active.rows.length === 0) fields.currency = "invalidValue";
      else rate = await accountingRate(transaction, companyId, currency, input.documentDate);
      if (rate === null) fields.currency = "exchangeRateMissing";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const units = await minorUnits(transaction, companyId);
    return {
      currency,
      rate: rate!,
      lines: input.lines.map((line) => {
        const converted = roundTo(Number(line.amount) * Number(rate), units);
        return { converted, vat: roundTo((converted * vatPercent(line.vatRate)) / 100, units) };
      }),
    };
  }

  private async targets(executor: Executor, declarationId: string): Promise<TargetRow[]> {
    return (
      await executor.execute<TargetRow>(sql`
      SELECT l.id, l.order_line_id, ol.variant_id, v.sku, p.name AS product_name, l.base_quantity::text, l.customs_value_converted::text
      FROM purchasing.import_declaration_lines l JOIN purchasing.order_lines ol ON ol.id = l.order_line_id JOIN catalog.variants v ON v.id = ol.variant_id
      JOIN catalog.products p ON p.id = v.product_id
      WHERE l.declaration_id = ${declarationId} ORDER BY l.line_no`)
    ).rows;
  }

  private async costLines(executor: Executor, id: string): Promise<CostLineRow[]> {
    return (await executor.execute<CostLineRow>(sql`SELECT id, amount_converted::text, basis FROM purchasing.landed_cost_lines WHERE landed_cost_id = ${id} ORDER BY line_no`)).rows;
  }

  private async header(executor: Executor, companyId: string, id: string): Promise<HeaderRow> {
    const row = (await executor.execute<HeaderRow>(sql`${select()} ${from()} WHERE c.id = ${id} AND c.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }
}

// Mỗi khoản chia theo tiêu thức của khoản; cộng theo dòng tờ khai.
function splitCosts(costLines: CostLineRow[], targets: TargetRow[], units: number): { byLine: number[][]; totals: number[] } {
  // Tổng tiêu thức bằng 0 (trị giá các dòng đều 0) thì không chia được, báo đúng khoản.
  const fields: FieldErrors = {};
  costLines.forEach((line, index) => {
    if (targets.every((target) => Number(line.basis === "value" ? target.customs_value_converted : target.base_quantity) <= 0)) fields[`lines.${index}.basis`] = "allocationBasisEmpty";
  });
  if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  const byLine = costLines.map((line) =>
    splitAmount(
      Number(line.amount_converted),
      targets.map((target) => Number(line.basis === "value" ? target.customs_value_converted : target.base_quantity)),
      units,
    ),
  );
  const totals = targets.map((_, index) =>
    roundTo(
      byLine.reduce((sum, shares) => sum + shares[index]!, 0),
      units,
    ),
  );
  return { byLine, totals };
}

function shareInputs(targets: TargetRow[], totals: number[]) {
  return targets.map((target, index) => ({ orderLineId: target.order_line_id, variantId: target.variant_id, baseQuantity: target.base_quantity, amount: String(totals[index]!) }));
}

function targetInfo(target: TargetRow) {
  return {
    declarationLineId: target.id,
    sku: target.sku,
    productName: target.product_name,
    customsValueConverted: trimDecimal(target.customs_value_converted),
    baseQuantity: trimDecimal(target.base_quantity),
  };
}

function allocationLines(targets: TargetRow[], split: { byLine: number[][]; totals: number[] }, shares: CostShare[]): LandedCostAllocation["lines"] {
  return targets.map((target, index) => ({
    ...targetInfo(target),
    byCostLine: split.byLine.map((shares) => String(shares[index]!)),
    amount: String(split.totals[index]!),
    onHand: trimDecimal(shares[index]!.onHand),
    stockValue: trimDecimal(shares[index]!.stockValue),
    expensedValue: trimDecimal(shares[index]!.expensedValue),
  }));
}

// Số ngoại tệ gồm thuế của chứng từ (thuế quy ngược theo tỷ lệ của từng khoản), làm tròn theo đơn vị nhỏ nhất của ngoại tệ.
async function foreignGross(executor: Executor, id: string, currency: string): Promise<string | null> {
  return (
    await executor.execute<{ value: string | null }>(sql`
    SELECT round(sum(amount * (1 + CASE WHEN vat_rate IN ('0', '5', '8', '10') THEN vat_rate::numeric / 100 ELSE 0 END)),
      (SELECT minor_units FROM core.currencies WHERE code = ${currency}))::text AS value
    FROM purchasing.landed_cost_lines WHERE landed_cost_id = ${id}`)
  ).rows[0]!.value;
}

async function writeLines(transaction: Executor, costId: string, input: Input, prepared: { converted: number; vat: number }[]): Promise<void> {
  for (const [index, line] of input.lines.entries()) {
    await transaction.execute(sql`
      INSERT INTO purchasing.landed_cost_lines (landed_cost_id, line_no, kind, description, amount, amount_converted, vat_rate, vat_amount, basis)
      VALUES (${costId}, ${index + 1}, ${line.kind}, ${line.description}, ${line.amount}::numeric, ${prepared[index]!.converted}::numeric, ${line.vatRate},
        ${prepared[index]!.vat}::numeric, ${line.basis})`);
  }
}

function select(): SQL {
  return sql`SELECT c.id, c.company_id, c.document_no, c.invoice_no, c.document_date, c.declaration_id, d.declaration_no, d.status AS declaration_status, o.warehouse_id,
    c.supplier_id, s.name AS supplier_name, c.currency, c.exchange_rate::text, c.note, c.status, c.version,
    coalesce((SELECT sum(l.amount_converted) FROM purchasing.landed_cost_lines l WHERE l.landed_cost_id = c.id), 0)::text AS net_amount,
    coalesce((SELECT sum(l.vat_amount) FROM purchasing.landed_cost_lines l WHERE l.landed_cost_id = c.id), 0)::text AS vat_amount`;
}

function from(): SQL {
  return sql`FROM purchasing.landed_costs c JOIN purchasing.import_declarations d ON d.id = c.declaration_id JOIN purchasing.orders o ON o.id = d.order_id
    JOIN crm.partners s ON s.id = c.supplier_id`;
}

function toItem(row: HeaderRow): LandedCostListItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    invoiceNo: row.invoice_no,
    documentDate: day(row.document_date),
    declarationId: row.declaration_id,
    declarationNo: row.declaration_no,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    currency: row.currency,
    netAmount: trimDecimal(row.net_amount),
    vatAmount: trimDecimal(row.vat_amount),
    status: row.status,
  };
}
