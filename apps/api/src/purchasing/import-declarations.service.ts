// Tờ khai hải quan nhập khẩu (CONG_VIEC_45; CHUC_NANG_160; QUYTAC_NGHIEPVU_287, 288, 291; API_140, API_141).
// Thuế nhập khẩu, tiêu thụ đặc biệt, bảo vệ môi trường gắn thẳng dòng tờ khai, vào giá vốn qua phiếu điều chỉnh giá trị của module Kho;
// thuế giá trị gia tăng hàng nhập khẩu ghi thuế được khấu trừ.
import { Inject, Injectable } from "@nestjs/common";
import type {
  ImportAllocationPreview,
  ImportDeclarationLineResponse,
  ImportDeclarationListItem,
  importDeclarationListQuerySchema,
  ImportDeclarationResponse,
  ImportDeclarationStatus,
  ImportOrderOption,
  PageResponse,
  saveImportDeclarationSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { credit, debit, rounder } from "../accounting/postings";
import { LedgerService } from "../accounting/ledger.service";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { CostAdjustmentsService, type CostShareInput } from "../inventory/cost-adjustments.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { receivedOnOrderLine, returnedOnOrderLine } from "./orders.service";
import { purchasingAudit, purchasingPermissions, requirePermission, type Executor, type FieldErrors } from "./purchasing-context";
import { companyCurrency } from "./requisitions.service";

type Input = z.output<typeof saveImportDeclarationSchema>;
type HeaderRow = {
  id: string;
  company_id: string;
  declaration_no: string;
  registered_on: Date | string;
  posting_date: Date | string;
  order_id: string;
  order_no: string | null;
  supplier_name: string;
  currency: string;
  warehouse_id: string;
  warehouse_name: string;
  customs_rate: string;
  note: string | null;
  status: ImportDeclarationStatus;
  customs_value: string;
  customs_value_converted: string;
  total_tax: string;
  created_by: string;
  version: number;
};
type OrderLineRow = { id: string; variant_id: string; quantity: string; base_quantity: string; is_service: boolean };
type PreparedLine = {
  orderLineId: string;
  variantId: string;
  quantity: string;
  baseQuantity: string;
  customsValue: string;
  customsValueConverted: number;
  importDutyRate: string;
  importDuty: number;
  importDutyEdited: boolean;
  exciseTax: number;
  environmentalTax: number;
  vatRate: string;
  vatAmount: number;
  vatEdited: boolean;
};

const roundTo = (value: number, units: number) => Math.round(value * 10 ** units) / 10 ** units;

// Số gợi ý theo QUYTAC_NGHIEPVU_287: thuế nhập khẩu theo trị giá quy đổi; thuế giá trị gia tăng tính trên trị giá cộng các thuế
// (Luật Thuế giá trị gia tăng 48/2024/QH15 Điều 7 khoản 1 điểm b).
export function suggestTaxes(input: { converted: number; importDutyRate: string; importDuty: number | null; exciseTax: number; environmentalTax: number; vatRate: string }, units: number) {
  const suggestedImportDuty = roundTo((input.converted * Number(input.importDutyRate)) / 100, units);
  const importDuty = input.importDuty ?? suggestedImportDuty;
  const suggestedVatAmount = roundTo(((input.converted + importDuty + input.exciseTax + input.environmentalTax) * Number(input.vatRate)) / 100, units);
  return { suggestedImportDuty, importDuty, suggestedVatAmount };
}

@Injectable()
export class ImportDeclarationsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly ledger: LedgerService,
    private readonly costAdjustments: CostAdjustmentsService,
  ) {}

  // Đơn mua nhập khẩu đã duyệt hoặc đã nhận đủ của công ty, kèm dòng còn khai được.
  async orderOptions(actor: Actor, orderId?: string): Promise<ImportOrderOption[]> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    const orders = await this.database.execute<{ id: string; document_no: string; supplier_name: string; currency: string }>(sql`
      SELECT o.id, o.document_no, s.name AS supplier_name, o.currency FROM purchasing.orders o JOIN crm.partners s ON s.id = o.supplier_id
      WHERE o.company_id = ${actor.companyId} AND o.is_import AND o.status IN ('approved', 'received') AND (${orderId ?? null}::uuid IS NULL OR o.id = ${orderId ?? null}::uuid)
      ORDER BY o.document_no DESC LIMIT 100`);
    const result: ImportOrderOption[] = [];
    for (const order of orders.rows) {
      const lines = await this.database.execute<{
        id: string;
        sku: string;
        product_name: string;
        unit_name: string;
        factor: string;
        quantity: string;
        unit_price: string;
        base_quantity: string;
        declared: string;
        received: string;
      }>(sql`
        SELECT ol.id, v.sku, p.name AS product_name, u.name_vi AS unit_name, (ol.base_quantity / ol.quantity)::text AS factor, ol.quantity::text, ol.unit_price::text,
          ol.base_quantity::text, ${declaredOnOrderLine(sql`ol.id`, null, false)}::text AS declared,
          (${receivedOnOrderLine(sql`ol.id`)} - ${returnedOnOrderLine(sql`ol.id`)})::text AS received
        FROM purchasing.order_lines ol JOIN catalog.variants v ON v.id = ol.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = ol.unit_id
        WHERE ol.order_id = ${order.id} AND p.kind <> 'service' ORDER BY ol.line_no`);
      result.push({
        id: order.id,
        documentNo: order.document_no,
        supplierName: order.supplier_name,
        currency: order.currency,
        lines: lines.rows.map((line) => ({
          orderLineId: line.id,
          sku: line.sku,
          productName: line.product_name,
          unitName: line.unit_name,
          factor: trimDecimal(Number(line.factor).toFixed(4)),
          quantity: trimDecimal(line.quantity),
          unitPrice: trimDecimal(line.unit_price),
          orderedBaseQuantity: trimDecimal(line.base_quantity),
          declaredBaseQuantity: trimDecimal(line.declared),
          receivedBaseQuantity: trimDecimal(line.received),
        })),
      });
    }
    return result;
  }

  async list(actor: Actor, query: z.output<typeof importDeclarationListQuerySchema>): Promise<PageResponse<ImportDeclarationListItem>> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const conditions: SQL[] = [sql`d.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`d.status = ${query.status}`);
    if (query.orderId) conditions.push(sql`d.order_id = ${query.orderId}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(d.declaration_no ILIKE ${pattern} OR o.document_no ILIKE ${pattern} OR s.name ILIKE ${pattern})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<HeaderRow>(sql`${select()} ${from()} WHERE ${where} ORDER BY d.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(toItem), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<ImportDeclarationResponse> {
    const granted = await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const row = await this.header(this.database, actor.companyId, id);
    const units = await minorUnits(this.database, row.company_id);
    const lines = await this.database.execute<{
      id: string;
      line_no: number;
      order_line_id: string;
      sku: string;
      product_name: string;
      unit_name: string;
      quantity: string;
      base_quantity: string;
      customs_value: string;
      customs_value_converted: string;
      import_duty_rate: string;
      import_duty: string;
      import_duty_edited: boolean;
      excise_tax: string;
      environmental_tax: string;
      vat_rate: string;
      vat_amount: string;
      vat_edited: boolean;
      stock_value: string | null;
      expensed_value: string | null;
    }>(sql`
      SELECT l.id, l.line_no, l.order_line_id, v.sku, p.name AS product_name, u.name_vi AS unit_name, l.quantity::text, l.base_quantity::text, l.customs_value::text,
        l.customs_value_converted::text, l.import_duty_rate::text, l.import_duty::text, l.import_duty_edited, l.excise_tax::text, l.environmental_tax::text, l.vat_rate::text,
        l.vat_amount::text, l.vat_edited, l.stock_value::text, l.expensed_value::text
      FROM purchasing.import_declaration_lines l JOIN purchasing.order_lines ol ON ol.id = l.order_line_id JOIN catalog.variants v ON v.id = ol.variant_id
      JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = ol.unit_id
      WHERE l.declaration_id = ${id} ORDER BY l.line_no`);
    const manage = granted.has(purchasingPermissions.manageImports);
    return {
      ...toItem(row),
      warehouseName: row.warehouse_name,
      customsRate: trimDecimal(row.customs_rate),
      note: row.note,
      companyCurrency: await companyCurrency(this.database, row.company_id),
      lines: lines.rows.map((line): ImportDeclarationLineResponse => {
        const suggestion = suggestTaxes(
          {
            converted: Number(line.customs_value_converted),
            importDutyRate: line.import_duty_rate,
            importDuty: Number(line.import_duty),
            exciseTax: Number(line.excise_tax),
            environmentalTax: Number(line.environmental_tax),
            vatRate: line.vat_rate,
          },
          units,
        );
        return {
          id: line.id,
          lineNo: line.line_no,
          orderLineId: line.order_line_id,
          sku: line.sku,
          productName: line.product_name,
          unitName: line.unit_name,
          quantity: trimDecimal(line.quantity),
          baseQuantity: trimDecimal(line.base_quantity),
          customsValue: trimDecimal(line.customs_value),
          customsValueConverted: trimDecimal(line.customs_value_converted),
          importDutyRate: trimDecimal(line.import_duty_rate),
          importDuty: trimDecimal(line.import_duty),
          suggestedImportDuty: String(suggestion.suggestedImportDuty),
          importDutyEdited: line.import_duty_edited,
          exciseTax: trimDecimal(line.excise_tax),
          environmentalTax: trimDecimal(line.environmental_tax),
          vatRate: trimDecimal(line.vat_rate),
          vatAmount: trimDecimal(line.vat_amount),
          suggestedVatAmount: String(suggestion.suggestedVatAmount),
          vatEdited: line.vat_edited,
          stockValue: line.stock_value === null ? null : trimDecimal(line.stock_value),
          expensedValue: line.expensed_value === null ? null : trimDecimal(line.expensed_value),
        };
      }),
      version: row.version,
      canEdit: manage && row.status === "draft",
      canPost: manage && row.status === "draft",
    };
  }

  async create(actor: Actor, input: Input): Promise<ImportDeclarationResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    const id = await this.database.transaction(async (transaction) => {
      const lines = await this.prepare(transaction, actor.companyId, input, null);
      const declarationId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO purchasing.import_declarations (company_id, order_id, declaration_no, registered_on, posting_date, customs_rate, note, created_by)
        VALUES (${actor.companyId}, ${input.orderId}, ${input.declarationNo}, ${input.registeredOn}::date, ${input.postingDate}::date, ${input.customsRate}::numeric, ${input.note}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await writeLines(transaction, declarationId, lines);
      await this.auditService.record({ ...purchasingAudit(actor, "import_declaration"), action: "import_declaration.create", entityId: declarationId, afterData: input }, transaction);
      return declarationId;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<ImportDeclarationResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    await this.database.transaction(async (transaction) => {
      const current = await this.header(transaction, actor.companyId, id);
      if (current.order_id !== input.orderId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { orderId: "documentHeaderLocked" } });
      const locked = await transaction.execute(sql`
        SELECT 1 FROM purchasing.import_declarations WHERE id = ${id} AND status = 'draft' AND version = ${input.version ?? current.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError(current.status === "draft" ? "CONFLICT_VERSION" : "BUSINESS_RULE", current.status === "draft" ? "conflictVersion" : "documentNotDraft");
      const lines = await this.prepare(transaction, actor.companyId, input, id);
      await transaction.execute(sql`
        UPDATE purchasing.import_declarations SET declaration_no = ${input.declarationNo}, registered_on = ${input.registeredOn}::date, posting_date = ${input.postingDate}::date,
          customs_rate = ${input.customsRate}::numeric, note = ${input.note}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await transaction.execute(sql`DELETE FROM purchasing.import_declaration_lines WHERE declaration_id = ${id}`);
      await writeLines(transaction, id, lines);
      await this.auditService.record({ ...purchasingAudit(actor, "import_declaration"), action: "import_declaration.update", entityId: id, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  async cancel(actor: Actor, id: string, version: number): Promise<ImportDeclarationResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE purchasing.import_declarations SET status = 'cancelled', updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'draft' AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...purchasingAudit(actor, "import_declaration"), action: "import_declaration.cancel", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Xem trước phân bổ thuế vào tồn, giá vốn hàng bán tại lúc xem (số khi ghi sổ có thể khác nếu kho xuất thêm).
  async preview(actor: Actor, id: string): Promise<ImportAllocationPreview> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewImports, purchasingPermissions.manageImports);
    const row = await this.header(this.database, actor.companyId, id);
    const inputs = await this.shareInputs(this.database, id);
    const shares = await this.costAdjustments.shares(this.database, row.company_id, row.warehouse_id, inputs);
    return this.previewOf(this.database, inputs, shares);
  }

  // Ghi sổ (QUYTAC_NGHIEPVU_288): kỳ chưa khóa; mỗi dòng đơn mua đã nhập đủ số khai lũy kế; phân bổ thuế vào giá vốn; bút toán thuế.
  async post(actor: Actor, id: string, version: number): Promise<ImportDeclarationResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageImports);
    await this.database.transaction(async (transaction) => {
      const row = await this.header(transaction, actor.companyId, id);
      const locked = await transaction.execute(sql`SELECT 1 FROM purchasing.import_declarations WHERE id = ${id} AND status = 'draft' AND version = ${version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError(row.status === "draft" ? "CONFLICT_VERSION" : "BUSINESS_RULE", row.status === "draft" ? "conflictVersion" : "documentNotDraft");
      // Khóa đơn mua: không chạy song song với phiếu nhập, trả hàng của cùng đơn.
      await transaction.execute(sql`SELECT 1 FROM purchasing.orders WHERE id = ${row.order_id} FOR UPDATE`);
      const postingDate = day(row.posting_date);
      await this.ledger.requireOpenPeriod(transaction, row.company_id, postingDate);
      const fields: FieldErrors = {};
      const lines = await transaction.execute<{ id: string; order_line_id: string; base_quantity: string; received: string; posted: string }>(sql`
        SELECT l.id, l.order_line_id, l.base_quantity::text, (${receivedOnOrderLine(sql`l.order_line_id`)} - ${returnedOnOrderLine(sql`l.order_line_id`)})::text AS received,
          ${declaredOnOrderLine(sql`l.order_line_id`, id, true)}::text AS posted
        FROM purchasing.import_declaration_lines l WHERE l.declaration_id = ${id} ORDER BY l.line_no`);
      const declaredHere = new Map<string, number>();
      lines.rows.forEach((line, index) => {
        const total = (declaredHere.get(line.order_line_id) ?? 0) + Number(line.base_quantity);
        declaredHere.set(line.order_line_id, total);
        if (Number(line.posted) + total > Number(line.received) + 0.00005) fields[`lines.${index}.quantity`] = "importNotReceived";
      });
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });

      const inputs = await this.shareInputs(transaction, id);
      const shares = inputs.some((input) => Number(input.amount) > 0)
        ? await this.costAdjustments.post(transaction, {
            companyId: row.company_id,
            warehouseId: row.warehouse_id,
            documentNo: `DCGT-${row.declaration_no}`,
            documentDate: postingDate,
            sourceType: "purchasing.import_declaration",
            sourceId: id,
            reason: `Thuế nhập khẩu theo tờ khai ${row.declaration_no}`,
            createdBy: actor.userId,
            lines: inputs,
          })
        : inputs.map((input) => ({ orderLineId: input.orderLineId, onHand: "0", stockValue: "0", expensedValue: "0", serialIds: [] }));
      for (const [index, line] of lines.rows.entries()) {
        await transaction.execute(sql`
          UPDATE purchasing.import_declaration_lines SET stock_value = ${shares[index]!.stockValue}::numeric, expensed_value = ${shares[index]!.expensedValue}::numeric WHERE id = ${line.id}`);
      }
      await transaction.execute(sql`
        UPDATE purchasing.import_declarations SET status = 'posted', posted_at = now(), posted_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);

      const totals = (
        await transaction.execute<{ import_duty: string; excise_tax: string; environmental_tax: string; vat_amount: string }>(sql`
        SELECT sum(import_duty)::text AS import_duty, sum(excise_tax)::text AS excise_tax, sum(environmental_tax)::text AS environmental_tax, sum(vat_amount)::text AS vat_amount
        FROM purchasing.import_declaration_lines WHERE declaration_id = ${id}`)
      ).rows[0]!;
      const money = await rounder(transaction, row.company_id);
      const stock = money(shares.reduce((sum, share) => sum + Number(share.stockValue), 0));
      const expensed = money(shares.reduce((sum, share) => sum + Number(share.expensedValue), 0));
      const vat = money(Number(totals.vat_amount));
      await this.ledger.record(transaction, {
        companyId: row.company_id,
        sourceType: "import_declaration",
        sourceId: id,
        journalNo: row.declaration_no,
        date: postingDate,
        description: `Thuế nhập khẩu theo tờ khai ${row.declaration_no}`,
        lines: [
          debit("goods", stock),
          debit("cogs", expensed),
          credit("import_duty", money(Number(totals.import_duty))),
          credit("excise_tax", money(Number(totals.excise_tax))),
          credit("environmental_tax", money(Number(totals.environmental_tax))),
          debit("vat_input", vat),
          credit("import_vat", vat),
        ],
      });
      await this.auditService.record({ ...purchasingAudit(actor, "import_declaration"), action: "import_declaration.post", entityId: id, afterData: { shares } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Số tiền vào giá vốn của mỗi dòng: thuế nhập khẩu, tiêu thụ đặc biệt, bảo vệ môi trường (QUYTAC_NGHIEPVU_288, 290).
  private async shareInputs(executor: Executor, id: string): Promise<CostShareInput[]> {
    const rows = await executor.execute<{ order_line_id: string; variant_id: string; base_quantity: string; amount: string }>(sql`
      SELECT l.order_line_id, ol.variant_id, l.base_quantity::text, (l.import_duty + l.excise_tax + l.environmental_tax)::text AS amount
      FROM purchasing.import_declaration_lines l JOIN purchasing.order_lines ol ON ol.id = l.order_line_id WHERE l.declaration_id = ${id} ORDER BY l.line_no`);
    return rows.rows.map((row) => ({ orderLineId: row.order_line_id, variantId: row.variant_id, baseQuantity: row.base_quantity, amount: row.amount }));
  }

  private async previewOf(executor: Executor, inputs: CostShareInput[], shares: Awaited<ReturnType<CostAdjustmentsService["shares"]>>): Promise<ImportAllocationPreview> {
    const names = new Map(
      (
        await executor.execute<{ id: string; sku: string; product_name: string }>(sql`
        SELECT v.id, v.sku, p.name AS product_name FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
        WHERE v.id IN (SELECT unnest(${`{${inputs.map((input) => input.variantId).join(",")}}`}::uuid[]))`)
      ).rows.map((row) => [row.id, row]),
    );
    return {
      lines: inputs.map((input, index) => ({
        orderLineId: input.orderLineId,
        sku: names.get(input.variantId)?.sku ?? "",
        productName: names.get(input.variantId)?.product_name ?? "",
        amount: trimDecimal(input.amount),
        onHand: trimDecimal(shares[index]!.onHand),
        baseQuantity: trimDecimal(input.baseQuantity),
        stockValue: trimDecimal(shares[index]!.stockValue),
        expensedValue: trimDecimal(shares[index]!.expensedValue),
      })),
    };
  }

  // Kiểm đơn mua nhập khẩu, số tờ khai, dòng hàng; tính trị giá quy đổi, thuế gợi ý (QUYTAC_NGHIEPVU_287).
  private async prepare(transaction: Executor, companyId: string, input: Input, declarationId: string | null): Promise<PreparedLine[]> {
    const fields: FieldErrors = {};
    const order = (await transaction.execute<{ status: string; is_import: boolean }>(sql`SELECT status, is_import FROM purchasing.orders WHERE id = ${input.orderId} AND company_id = ${companyId}`))
      .rows[0];
    if (!order || !order.is_import || !["approved", "received"].includes(order.status)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { orderId: "importOrderInvalid" } });
    const duplicate = await transaction.execute(sql`
      SELECT 1 FROM purchasing.import_declarations
      WHERE company_id = ${companyId} AND declaration_no = ${input.declarationNo} AND status <> 'cancelled' AND id IS DISTINCT FROM ${declarationId}::uuid`);
    if (duplicate.rows.length > 0) fields.declarationNo = "declarationNoDuplicate";
    const units = await minorUnits(transaction, companyId);
    const orderLines = new Map(
      (
        await transaction.execute<OrderLineRow>(sql`
        SELECT ol.id, ol.variant_id, ol.quantity::text, ol.base_quantity::text, p.kind = 'service' AS is_service
        FROM purchasing.order_lines ol JOIN catalog.variants v ON v.id = ol.variant_id JOIN catalog.products p ON p.id = v.product_id
        WHERE ol.order_id = ${input.orderId} FOR UPDATE OF ol`)
      ).rows.map((row) => [row.id, row]),
    );
    const declaredThis = new Map<string, number>();
    const lines: PreparedLine[] = [];
    for (const [index, line] of input.lines.entries()) {
      const source = orderLines.get(line.orderLineId);
      if (!source || source.is_service) {
        fields[`lines.${index}.orderLineId`] = "invalidValue";
        continue;
      }
      const baseQuantity = (Number(line.quantity) * Number(source.base_quantity)) / Number(source.quantity);
      const total = (declaredThis.get(line.orderLineId) ?? 0) + baseQuantity;
      declaredThis.set(line.orderLineId, total);
      const declaredElsewhere = Number(
        (await transaction.execute<{ value: string }>(sql`SELECT ${declaredOnOrderLine(sql`${line.orderLineId}::uuid`, declarationId, false)}::text AS value`)).rows[0]!.value,
      );
      if (declaredElsewhere + total > Number(source.base_quantity) + 0.00005) fields[`lines.${index}.quantity`] = "importDeclaredExceeded";
      const converted = roundTo(Number(line.customsValue) * Number(input.customsRate), units);
      const exciseTax = roundTo(Number(line.exciseTax), units);
      const environmentalTax = roundTo(Number(line.environmentalTax), units);
      const entered = line.importDuty === null || line.importDuty === undefined ? null : roundTo(Number(line.importDuty), units);
      const taxes = suggestTaxes({ converted, importDutyRate: line.importDutyRate, importDuty: entered, exciseTax, environmentalTax, vatRate: line.vatRate }, units);
      const vatEntered = line.vatAmount === null || line.vatAmount === undefined ? null : roundTo(Number(line.vatAmount), units);
      lines.push({
        orderLineId: line.orderLineId,
        variantId: source.variant_id,
        quantity: line.quantity,
        baseQuantity: baseQuantity.toFixed(4),
        customsValue: line.customsValue,
        customsValueConverted: converted,
        importDutyRate: line.importDutyRate,
        importDuty: taxes.importDuty,
        importDutyEdited: entered !== null && entered !== taxes.suggestedImportDuty,
        exciseTax,
        environmentalTax,
        vatRate: line.vatRate,
        vatAmount: vatEntered ?? taxes.suggestedVatAmount,
        vatEdited: vatEntered !== null && vatEntered !== taxes.suggestedVatAmount,
      });
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return lines;
  }

  private async header(executor: Executor, companyId: string, id: string): Promise<HeaderRow> {
    const row = (await executor.execute<HeaderRow>(sql`${select()} ${from()} WHERE d.id = ${id} AND d.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }
}

// Bí danh riêng để không trùng bảng của truy vấn ngoài. Số lượng (đơn vị cơ sở) đã khai của dòng đơn mua trên các tờ khai chưa hủy (hoặc chỉ đã ghi sổ), trừ một tờ khai.
function declaredOnOrderLine(orderLineId: SQL, exceptDeclarationId: string | null, postedOnly: boolean): SQL {
  return sql`coalesce((
    SELECT sum(declared_line.base_quantity) FROM purchasing.import_declaration_lines declared_line
    JOIN purchasing.import_declarations declared ON declared.id = declared_line.declaration_id
    WHERE declared_line.order_line_id = ${orderLineId} AND declared.id IS DISTINCT FROM ${exceptDeclarationId}::uuid
      AND ${postedOnly ? sql`declared.status = 'posted'` : sql`declared.status <> 'cancelled'`}), 0)`;
}

async function writeLines(transaction: Executor, declarationId: string, lines: PreparedLine[]): Promise<void> {
  for (const [index, line] of lines.entries()) {
    await transaction.execute(sql`
      INSERT INTO purchasing.import_declaration_lines (declaration_id, line_no, order_line_id, quantity, base_quantity, customs_value, customs_value_converted, import_duty_rate,
        import_duty, import_duty_edited, excise_tax, environmental_tax, vat_rate, vat_amount, vat_edited)
      VALUES (${declarationId}, ${index + 1}, ${line.orderLineId}, ${line.quantity}::numeric, ${line.baseQuantity}::numeric, ${line.customsValue}::numeric,
        ${line.customsValueConverted}::numeric, ${line.importDutyRate}::numeric, ${line.importDuty}::numeric, ${line.importDutyEdited}, ${line.exciseTax}::numeric,
        ${line.environmentalTax}::numeric, ${line.vatRate}::numeric, ${line.vatAmount}::numeric, ${line.vatEdited})`);
  }
}

async function minorUnits(executor: Executor, companyId: string): Promise<number> {
  return Number((await executor.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${companyId}) AS units`)).rows[0]!.units);
}

function select(): SQL {
  return sql`SELECT d.id, d.company_id, d.declaration_no, d.registered_on, d.posting_date, d.order_id, o.document_no AS order_no, s.name AS supplier_name, o.currency,
    o.warehouse_id, coalesce(w.name, '') AS warehouse_name, d.customs_rate::text, d.note, d.status, d.created_by, d.version,
    coalesce((SELECT sum(l.customs_value) FROM purchasing.import_declaration_lines l WHERE l.declaration_id = d.id), 0)::text AS customs_value,
    coalesce((SELECT sum(l.customs_value_converted) FROM purchasing.import_declaration_lines l WHERE l.declaration_id = d.id), 0)::text AS customs_value_converted,
    coalesce((SELECT sum(l.import_duty + l.excise_tax + l.environmental_tax + l.vat_amount) FROM purchasing.import_declaration_lines l WHERE l.declaration_id = d.id), 0)::text AS total_tax`;
}

function from(): SQL {
  return sql`FROM purchasing.import_declarations d JOIN purchasing.orders o ON o.id = d.order_id JOIN crm.partners s ON s.id = o.supplier_id
    LEFT JOIN inventory.warehouses w ON w.id = o.warehouse_id`;
}

function toItem(row: HeaderRow): ImportDeclarationListItem {
  return {
    id: row.id,
    declarationNo: row.declaration_no,
    registeredOn: day(row.registered_on),
    postingDate: day(row.posting_date),
    orderId: row.order_id,
    orderNo: row.order_no,
    supplierName: row.supplier_name,
    currency: row.currency,
    customsValue: trimDecimal(row.customs_value),
    customsValueConverted: trimDecimal(row.customs_value_converted),
    totalTax: trimDecimal(row.total_tax),
    status: row.status,
  };
}
