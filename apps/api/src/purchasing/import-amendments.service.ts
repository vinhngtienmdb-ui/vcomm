// Tờ khai bổ sung (CONG_VIEC_56; CHUC_NANG_199; QUYTAC_NGHIEPVU_414; API_219): sửa số thuế từng dòng của tờ khai gốc đã ghi sổ; ghi sổ chia chênh lệch thuế
// nhập khẩu, tiêu thụ đặc biệt, bảo vệ môi trường vào giá trị tồn kho (phần tồn) và giá vốn hàng bán (phần đã xuất); chênh lệch thuế giá trị gia tăng vào thuế được khấu trừ.
import { Inject, Injectable } from "@nestjs/common";
import type { ImportAllocationPreview, ImportAmendmentBase, ImportAmendmentListItem, ImportAmendmentResponse, ImportAmendmentTaxes, saveImportAmendmentSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { LedgerService } from "../accounting/ledger.service";
import { credit, debit, rounder, type DraftLine, type PostingRole } from "../accounting/postings";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { CostAdjustmentsService, type CostShareInput } from "../inventory/cost-adjustments.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { minorUnits } from "./import-declarations.service";
import { purchasingAudit, purchasingPermissions, requirePermission, type Executor, type FieldErrors } from "./purchasing-context";
import { companyCurrency } from "./requisitions.service";

type Input = z.output<typeof saveImportAmendmentSchema>;
type Taxes = { import_duty: string; excise_tax: string; environmental_tax: string; vat_amount: string };
type LineRow = {
  id: string;
  order_line_id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  base_quantity: string;
  customs_value_converted: string;
  import_duty_rate: string;
  vat_rate: string;
} & Taxes;
const keys = ["import_duty", "excise_tax", "environmental_tax", "vat_amount"] as const;
const toTaxes = (row: Taxes): ImportAmendmentTaxes => ({
  importDuty: trimDecimal(row.import_duty),
  exciseTax: trimDecimal(row.excise_tax),
  environmentalTax: trimDecimal(row.environmental_tax),
  vatAmount: trimDecimal(row.vat_amount),
});
const roundTo = (value: number, units: number) => (Math.round(value * 10 ** units) / 10 ** units).toFixed(4);

@Injectable()
export class ImportAmendmentsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly ledger: LedgerService,
    private readonly costAdjustments: CostAdjustmentsService,
  ) {}

  // Dòng của tờ khai gốc kèm số thuế hiện hành (gốc cộng các tờ khai bổ sung đã ghi sổ, trừ tờ khai bổ sung đang xét).
  private async declarationLines(executor: Executor, declarationId: string, exceptAmendmentId: string | null): Promise<LineRow[]> {
    const rows = await executor.execute<LineRow>(sql`
      SELECT l.id, l.order_line_id, ol.variant_id, v.sku, p.name AS product_name, l.base_quantity::text, l.customs_value_converted::text,
        coalesce(last.import_duty_rate, l.import_duty_rate)::text AS import_duty_rate, coalesce(last.vat_rate, l.vat_rate)::text AS vat_rate,
        (l.import_duty + coalesce(sum.import_duty, 0))::text AS import_duty, (l.excise_tax + coalesce(sum.excise_tax, 0))::text AS excise_tax,
        (l.environmental_tax + coalesce(sum.environmental_tax, 0))::text AS environmental_tax, (l.vat_amount + coalesce(sum.vat_amount, 0))::text AS vat_amount
      FROM purchasing.import_declaration_lines l JOIN purchasing.order_lines ol ON ol.id = l.order_line_id
        JOIN catalog.variants v ON v.id = ol.variant_id JOIN catalog.products p ON p.id = v.product_id
        LEFT JOIN LATERAL (
          SELECT sum(al.import_duty_diff) AS import_duty, sum(al.excise_tax_diff) AS excise_tax, sum(al.environmental_tax_diff) AS environmental_tax, sum(al.vat_diff) AS vat_amount
          FROM purchasing.import_amendment_lines al JOIN purchasing.import_amendments a ON a.id = al.amendment_id
          WHERE al.declaration_line_id = l.id AND a.status = 'posted' AND a.id IS DISTINCT FROM ${exceptAmendmentId}::uuid) sum ON true
        LEFT JOIN LATERAL (
          SELECT al.import_duty_rate, al.vat_rate FROM purchasing.import_amendment_lines al JOIN purchasing.import_amendments a ON a.id = al.amendment_id
          WHERE al.declaration_line_id = l.id AND a.status = 'posted' AND a.id IS DISTINCT FROM ${exceptAmendmentId}::uuid ORDER BY a.posted_at DESC LIMIT 1) last ON true
      WHERE l.declaration_id = ${declarationId} ORDER BY l.line_no`);
    return rows.rows;
  }

  private async declaration(executor: Executor, companyId: string, id: string) {
    const row = (
      await executor.execute<{ id: string; declaration_no: string; status: string; warehouse_id: string; registered_on: string }>(sql`
      SELECT d.id, d.declaration_no, d.status, o.warehouse_id, d.registered_on::text FROM purchasing.import_declarations d JOIN purchasing.orders o ON o.id = d.order_id
      WHERE d.id = ${id} AND d.company_id = ${companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { declarationId: "invalidValue" } });
    return row;
  }

  async list(actor: Actor, declarationId: string): Promise<ImportAmendmentListItem[]> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const rows = await this.database.execute<{ id: string; amendment_no: string; registered_on: string; status: "draft" | "posted" | "cancelled"; total: string }>(sql`
      SELECT a.id, a.amendment_no, a.registered_on::text, a.status,
        coalesce((SELECT sum(al.import_duty_diff + al.excise_tax_diff + al.environmental_tax_diff + al.vat_diff) FROM purchasing.import_amendment_lines al WHERE al.amendment_id = a.id), 0)::text AS total
      FROM purchasing.import_amendments a WHERE a.company_id = ${actor.companyId} AND a.declaration_id = ${declarationId} ORDER BY a.created_at`);
    return rows.rows.map((row) => ({ id: row.id, amendmentNo: row.amendment_no, registeredOn: day(row.registered_on), status: row.status, totalDifference: trimDecimal(row.total) }));
  }

  async base(actor: Actor, declarationId: string): Promise<ImportAmendmentBase> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const declaration = (
      await this.database.execute<{ declaration_no: string; status: string; company_id: string }>(sql`
      SELECT declaration_no, status, company_id FROM purchasing.import_declarations WHERE id = ${declarationId} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!declaration) throw new ApiError("NOT_FOUND", "notFound");
    const zero = { importDuty: "0", exciseTax: "0", environmentalTax: "0", vatAmount: "0" };
    return {
      declarationId,
      declarationNo: declaration.declaration_no,
      status: declaration.status,
      companyCurrency: await companyCurrency(this.database, declaration.company_id),
      lines: (await this.declarationLines(this.database, declarationId, null)).map((line) => ({
        declarationLineId: line.id,
        sku: line.sku,
        productName: line.product_name,
        customsValueConverted: trimDecimal(line.customs_value_converted),
        importDutyRate: trimDecimal(line.import_duty_rate),
        vatRate: trimDecimal(line.vat_rate),
        before: toTaxes(line),
        after: toTaxes(line),
        difference: zero,
        stockValue: null,
        expensedValue: null,
      })),
    };
  }

  async detail(actor: Actor, id: string): Promise<ImportAmendmentResponse> {
    const granted = await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const header = (
      await this.database.execute<{
        id: string;
        company_id: string;
        declaration_id: string;
        declaration_no: string;
        amendment_no: string;
        registered_on: string;
        posting_date: string;
        reason: string | null;
        status: "draft" | "posted" | "cancelled";
        created_by_name: string;
        posted_at: string | null;
        version: number;
      }>(sql`
      SELECT a.id, a.company_id, a.declaration_id, d.declaration_no, a.amendment_no, a.registered_on::text, a.posting_date::text, a.reason, a.status, u.full_name AS created_by_name,
        a.posted_at::text, a.version
      FROM purchasing.import_amendments a JOIN purchasing.import_declarations d ON d.id = a.declaration_id JOIN core.users u ON u.id = a.created_by
      WHERE a.id = ${id} AND a.company_id = ${actor.companyId}`)
    ).rows[0];
    if (!header) throw new ApiError("NOT_FOUND", "notFound");
    // Đã ghi sổ: số trước là số lúc ghi sổ (không tính chính nó); nháp: số hiện hành.
    const current = await this.declarationLines(this.database, header.declaration_id, header.id);
    const saved = await this.database.execute<
      {
        declaration_line_id: string;
        import_duty_rate: string | null;
        vat_rate: string | null;
        stock_value: string | null;
        expensed_value: string | null;
        import_duty_diff: string | null;
        excise_tax_diff: string | null;
        environmental_tax_diff: string | null;
        vat_diff: string | null;
      } & Taxes
    >(sql`
      SELECT declaration_line_id, import_duty_rate::text, vat_rate::text, import_duty::text, excise_tax::text, environmental_tax::text, vat_amount::text, stock_value::text, expensed_value::text,
        import_duty_diff::text, excise_tax_diff::text, environmental_tax_diff::text, vat_diff::text
      FROM purchasing.import_amendment_lines WHERE amendment_id = ${id}`);
    const byLine = new Map(saved.rows.map((row) => [row.declaration_line_id, row]));
    const total = { import_duty: 0, excise_tax: 0, environmental_tax: 0, vat_amount: 0 };
    const lines = current
      .filter((line) => byLine.has(line.id))
      .map((line) => {
        const after = byLine.get(line.id)!;
        const posted = header.status === "posted";
        // Ghi sổ xong: số trước suy từ số sau trừ chênh lệch đã lưu.
        const before: Taxes = posted
          ? {
              import_duty: (Number(after.import_duty) - Number(after.import_duty_diff)).toFixed(4),
              excise_tax: (Number(after.excise_tax) - Number(after.excise_tax_diff)).toFixed(4),
              environmental_tax: (Number(after.environmental_tax) - Number(after.environmental_tax_diff)).toFixed(4),
              vat_amount: (Number(after.vat_amount) - Number(after.vat_diff)).toFixed(4),
            }
          : line;
        const difference: Taxes = {
          import_duty: (Number(after.import_duty) - Number(before.import_duty)).toFixed(4),
          excise_tax: (Number(after.excise_tax) - Number(before.excise_tax)).toFixed(4),
          environmental_tax: (Number(after.environmental_tax) - Number(before.environmental_tax)).toFixed(4),
          vat_amount: (Number(after.vat_amount) - Number(before.vat_amount)).toFixed(4),
        };
        for (const key of keys) total[key] += Number(difference[key]);
        return {
          declarationLineId: line.id,
          sku: line.sku,
          productName: line.product_name,
          customsValueConverted: trimDecimal(line.customs_value_converted),
          importDutyRate: trimDecimal(after.import_duty_rate ?? line.import_duty_rate),
          vatRate: trimDecimal(after.vat_rate ?? line.vat_rate),
          before: toTaxes(before),
          after: toTaxes(after),
          difference: toTaxes(difference),
          stockValue: after.stock_value === null ? null : trimDecimal(after.stock_value),
          expensedValue: after.expensed_value === null ? null : trimDecimal(after.expensed_value),
        };
      });
    return {
      id: header.id,
      declarationId: header.declaration_id,
      declarationNo: header.declaration_no,
      amendmentNo: header.amendment_no,
      registeredOn: day(header.registered_on),
      postingDate: day(header.posting_date),
      reason: header.reason,
      status: header.status,
      companyCurrency: await companyCurrency(this.database, header.company_id),
      lines,
      totalDifference: toTaxes({
        import_duty: total.import_duty.toFixed(4),
        excise_tax: total.excise_tax.toFixed(4),
        environmental_tax: total.environmental_tax.toFixed(4),
        vat_amount: total.vat_amount.toFixed(4),
      }),
      createdByName: header.created_by_name,
      postedAt: header.posted_at,
      version: header.version,
      canEdit: granted.has(purchasingPermissions.manageImports) && header.status === "draft",
    };
  }

  // Kiểm, tính số thuế sau bổ sung (gợi ý theo thuế suất mới khi để trống; QUYTAC_NGHIEPVU_287, 414). Trả về các dòng sẽ lưu.
  private async prepare(executor: Executor, companyId: string, input: Input, amendmentId: string | null) {
    const declaration = await this.declaration(executor, companyId, input.declarationId);
    if (declaration.status !== "posted") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { declarationId: "declarationNotPosted" } });
    const duplicate = await executor.execute(sql`
      SELECT 1 FROM purchasing.import_amendments WHERE company_id = ${companyId} AND amendment_no = ${input.amendmentNo} AND status <> 'cancelled' AND id IS DISTINCT FROM ${amendmentId}::uuid`);
    const fields: FieldErrors = {};
    if (duplicate.rows.length > 0) fields.amendmentNo = "declarationNoDuplicate";
    const units = await minorUnits(executor, companyId);
    const current = new Map((await this.declarationLines(executor, input.declarationId, amendmentId)).map((line) => [line.id, line]));
    const seen = new Set<string>();
    const lines = input.lines.map((line, index) => {
      const base = current.get(line.declarationLineId);
      if (!base || seen.has(line.declarationLineId)) {
        fields[`lines.${index}.declarationLineId`] = "invalidValue";
        return null;
      }
      seen.add(line.declarationLineId);
      const converted = Number(base.customs_value_converted);
      const dutyRate = line.importDutyRate ?? base.import_duty_rate;
      const vatRate = line.vatRate ?? base.vat_rate;
      const importDuty = line.importDuty ?? (line.importDutyRate !== null && line.importDutyRate !== undefined ? roundTo((converted * Number(dutyRate)) / 100, units) : base.import_duty);
      const exciseTax = line.exciseTax ?? base.excise_tax;
      const environmentalTax = line.environmentalTax ?? base.environmental_tax;
      const vatAmount =
        line.vatAmount ??
        (line.importDutyRate != null || line.importDuty != null || line.exciseTax != null || line.environmentalTax != null || line.vatRate != null
          ? roundTo(((converted + Number(importDuty) + Number(exciseTax) + Number(environmentalTax)) * Number(vatRate)) / 100, units)
          : base.vat_amount);
      return { declarationLineId: line.declarationLineId, importDutyRate: dutyRate, vatRate, importDuty, exciseTax, environmentalTax, vatAmount };
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return { declaration, lines: lines.filter((line) => line !== null) };
  }

  private async writeLines(executor: Executor, amendmentId: string, lines: Awaited<ReturnType<ImportAmendmentsService["prepare"]>>["lines"]): Promise<void> {
    await executor.execute(sql`DELETE FROM purchasing.import_amendment_lines WHERE amendment_id = ${amendmentId}`);
    for (const line of lines) {
      await executor.execute(sql`
        INSERT INTO purchasing.import_amendment_lines (amendment_id, declaration_line_id, import_duty_rate, vat_rate, import_duty, excise_tax, environmental_tax, vat_amount)
        VALUES (${amendmentId}, ${line.declarationLineId}, ${line.importDutyRate}::numeric, ${line.vatRate}::numeric, ${line.importDuty}::numeric, ${line.exciseTax}::numeric,
          ${line.environmentalTax}::numeric, ${line.vatAmount}::numeric)`);
    }
  }

  async save(actor: Actor, id: string | null, input: Input): Promise<ImportAmendmentResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    const savedId = await this.database.transaction(async (transaction) => {
      if (id) {
        const locked = await transaction.execute<{ declaration_id: string }>(sql`
          SELECT declaration_id FROM purchasing.import_amendments WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'draft' AND version = ${input.version ?? 0} FOR UPDATE`);
        if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        if (locked.rows[0]!.declaration_id !== input.declarationId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { declarationId: "invalidValue" } });
      }
      const prepared = await this.prepare(transaction, actor.companyId, input, id);
      let amendmentId = id;
      if (amendmentId) {
        await transaction.execute(sql`
          UPDATE purchasing.import_amendments SET amendment_no = ${input.amendmentNo}, registered_on = ${input.registeredOn}::date, posting_date = ${input.postingDate}::date,
            reason = ${input.reason}, updated_at = now(), version = version + 1
          WHERE id = ${amendmentId}`);
      } else {
        amendmentId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO purchasing.import_amendments (company_id, declaration_id, amendment_no, registered_on, posting_date, reason, created_by)
          VALUES (${actor.companyId}, ${input.declarationId}, ${input.amendmentNo}, ${input.registeredOn}::date, ${input.postingDate}::date, ${input.reason}, ${actor.userId}) RETURNING id`)
        ).rows[0]!.id;
      }
      await this.writeLines(transaction, amendmentId, prepared.lines);
      await this.auditService.record(
        { ...purchasingAudit(actor, "import_amendment"), action: id ? "import_amendment.update" : "import_amendment.create", entityId: amendmentId, afterData: input },
        transaction,
      );
      return amendmentId;
    });
    return this.detail(actor, savedId);
  }

  async cancel(actor: Actor, id: string, version: number): Promise<ImportAmendmentResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE purchasing.import_amendments SET status = 'cancelled', updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'draft' AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...purchasingAudit(actor, "import_amendment"), action: "import_amendment.cancel", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Chênh lệch thuế vào giá vốn từng dòng (nhập khẩu, tiêu thụ đặc biệt, bảo vệ môi trường), có thể âm.
  private async shareInputs(executor: Executor, amendmentId: string, declarationId: string): Promise<{ inputs: CostShareInput[]; diffs: Map<string, Taxes> }> {
    const current = new Map((await this.declarationLines(executor, declarationId, amendmentId)).map((line) => [line.id, line]));
    const rows = await executor.execute<{ declaration_line_id: string } & Taxes>(sql`
      SELECT declaration_line_id, import_duty::text, excise_tax::text, environmental_tax::text, vat_amount::text FROM purchasing.import_amendment_lines WHERE amendment_id = ${amendmentId}`);
    const diffs = new Map<string, Taxes>();
    const inputs: CostShareInput[] = [];
    for (const row of rows.rows) {
      const base = current.get(row.declaration_line_id)!;
      const diff: Taxes = {
        import_duty: (Number(row.import_duty) - Number(base.import_duty)).toFixed(4),
        excise_tax: (Number(row.excise_tax) - Number(base.excise_tax)).toFixed(4),
        environmental_tax: (Number(row.environmental_tax) - Number(base.environmental_tax)).toFixed(4),
        vat_amount: (Number(row.vat_amount) - Number(base.vat_amount)).toFixed(4),
      };
      diffs.set(row.declaration_line_id, diff);
      inputs.push({
        orderLineId: base.order_line_id,
        variantId: base.variant_id,
        baseQuantity: base.base_quantity,
        amount: (Number(diff.import_duty) + Number(diff.excise_tax) + Number(diff.environmental_tax)).toFixed(4),
      });
    }
    return { inputs, diffs };
  }

  async preview(actor: Actor, id: string): Promise<ImportAllocationPreview> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const header = (await this.database.execute<{ declaration_id: string }>(sql`SELECT declaration_id FROM purchasing.import_amendments WHERE id = ${id} AND company_id = ${actor.companyId}`)).rows[0];
    if (!header) throw new ApiError("NOT_FOUND", "notFound");
    const declaration = await this.declaration(this.database, actor.companyId, header.declaration_id);
    const { inputs } = await this.shareInputs(this.database, id, header.declaration_id);
    const shares = await this.costAdjustments.shares(this.database, actor.companyId, declaration.warehouse_id, inputs);
    const names = new Map((await this.declarationLines(this.database, header.declaration_id, id)).map((line) => [line.order_line_id, line]));
    return {
      lines: inputs.map((input, index) => ({
        orderLineId: input.orderLineId,
        sku: names.get(input.orderLineId)?.sku ?? "",
        productName: names.get(input.orderLineId)?.product_name ?? "",
        amount: trimDecimal(input.amount),
        onHand: trimDecimal(shares[index]!.onHand),
        baseQuantity: trimDecimal(input.baseQuantity),
        stockValue: trimDecimal(shares[index]!.stockValue),
        expensedValue: trimDecimal(shares[index]!.expensedValue),
      })),
    };
  }

  // Ghi sổ (QUYTAC_NGHIEPVU_414): kỳ chưa khóa; tính chênh lệch so với số hiện hành lúc ghi sổ; phiếu điều chỉnh giá trị kho; bút toán tăng, giảm thuế.
  async post(actor: Actor, id: string, version: number): Promise<ImportAmendmentResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    await this.database.transaction(async (transaction) => {
      const header = (
        await transaction.execute<{ declaration_id: string; amendment_no: string; posting_date: string }>(sql`
        SELECT declaration_id, amendment_no, posting_date::text FROM purchasing.import_amendments
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'draft' AND version = ${version} FOR UPDATE`)
      ).rows[0];
      if (!header) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`SELECT 1 FROM purchasing.import_declarations WHERE id = ${header.declaration_id} FOR UPDATE`);
      const declaration = await this.declaration(transaction, actor.companyId, header.declaration_id);
      await this.ledger.requireOpenPeriod(transaction, actor.companyId, header.posting_date);
      const { inputs, diffs } = await this.shareInputs(transaction, id, header.declaration_id);
      const shares = inputs.some((input) => Number(input.amount) !== 0)
        ? await this.costAdjustments.post(transaction, {
            companyId: actor.companyId,
            warehouseId: declaration.warehouse_id,
            documentNo: `DCGT-${header.amendment_no}`,
            documentDate: header.posting_date,
            sourceType: "purchasing.import_amendment",
            sourceId: id,
            reason: `Thuế nhập khẩu theo tờ khai bổ sung ${header.amendment_no}`,
            createdBy: actor.userId,
            lines: inputs,
          })
        : inputs.map((input) => ({ orderLineId: input.orderLineId, onHand: "0", stockValue: "0", expensedValue: "0", serialIds: [] }));
      const lineIds = [...diffs.keys()];
      for (const [index, lineId] of lineIds.entries()) {
        const diff = diffs.get(lineId)!;
        await transaction.execute(sql`
          UPDATE purchasing.import_amendment_lines SET import_duty_diff = ${diff.import_duty}::numeric, excise_tax_diff = ${diff.excise_tax}::numeric,
            environmental_tax_diff = ${diff.environmental_tax}::numeric, vat_diff = ${diff.vat_amount}::numeric,
            stock_value = ${shares[index]!.stockValue}::numeric, expensed_value = ${shares[index]!.expensedValue}::numeric
          WHERE amendment_id = ${id} AND declaration_line_id = ${lineId}`);
      }
      await transaction.execute(sql`
        UPDATE purchasing.import_amendments SET status = 'posted', posted_at = now(), posted_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      const money = await rounder(transaction, actor.companyId);
      const sum = (key: (typeof keys)[number]) => money([...diffs.values()].reduce((total, diff) => total + Number(diff[key]), 0));
      const stock = money(shares.reduce((total, share) => total + Number(share.stockValue), 0));
      const expensed = money(shares.reduce((total, share) => total + Number(share.expensedValue), 0));
      // Số dương ghi bên thường của vai trò, số âm ghi bên ngược lại.
      const signed = (role: PostingRole, value: number, debitSide: boolean): DraftLine[] =>
        value === 0 ? [] : value > 0 === debitSide ? [debit(role, Math.abs(value))] : [credit(role, Math.abs(value))];
      const vat = sum("vat_amount");
      await this.ledger.record(transaction, {
        companyId: actor.companyId,
        sourceType: "import_amendment",
        sourceId: id,
        journalNo: header.amendment_no,
        date: header.posting_date,
        description: `Thuế theo tờ khai bổ sung ${header.amendment_no} (tờ khai ${declaration.declaration_no})`,
        lines: [
          ...signed("goods", stock, true),
          ...signed("cogs", expensed, true),
          ...signed("import_duty", sum("import_duty"), false),
          ...signed("excise_tax", sum("excise_tax"), false),
          ...signed("environmental_tax", sum("environmental_tax"), false),
          ...signed("vat_input", vat, true),
          ...signed("import_vat", vat, false),
        ],
      });
      await this.auditService.record({ ...purchasingAudit(actor, "import_amendment"), action: "import_amendment.post", entityId: id, afterData: { shares } }, transaction);
    });
    return this.detail(actor, id);
  }
}
