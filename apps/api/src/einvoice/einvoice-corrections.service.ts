// Hóa đơn khi trả hàng và hóa đơn thay thế (CONG_VIEC_16 lát L1; CHUC_NANG_78, 79; QUYTAC_NGHIEPVU_106, 107; API_91).
import { Inject, Injectable } from "@nestjs/common";
import type { EinvoiceResponse, EinvoiceReturnStatus, EinvoiceReturnTask, EinvoiceStatus, recordBuyerInvoiceSchema, replaceEinvoiceSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { vietnamDate } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { einvoicePermissions, settingsRow } from "./einvoice-settings.service";
import { documentItems, EinvoicesService, insertInvoice } from "./einvoices.service";

type Executor = Pick<Database, "execute">;
type Party = { partnerId: string | null; name: string | null; taxCode: string | null; address: string | null; anonymous: boolean };

// Hóa đơn hiện hành của một hóa đơn gốc: theo chuỗi hóa đơn thay thế đến hóa đơn cuối.
async function currentInvoice(executor: Executor, invoiceId: string): Promise<string> {
  let current = invoiceId;
  for (let depth = 0; depth < 50; depth++) {
    const next = (await executor.execute<{ replaced_by_id: string | null }>(sql`SELECT replaced_by_id FROM finance.einvoices WHERE id = ${current}`)).rows[0]?.replaced_by_id;
    if (!next) return current;
    current = next;
  }
  return current;
}

@Injectable()
export class EinvoiceCorrectionsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly einvoices: EinvoicesService,
  ) {}

  async returnTasks(actor: Actor, status: EinvoiceReturnStatus | undefined): Promise<EinvoiceReturnTask[]> {
    const granted = await requireFinancePermission(this.permissionService, actor, einvoicePermissions.view);
    const rows = await this.database.execute<{
      id: string;
      status: EinvoiceReturnStatus;
      return_document_id: string;
      return_document_no: string | null;
      return_date: string;
      original_invoice_id: string;
      adjustment_invoice_id: string | null;
      buyer_invoice_series: string | null;
      buyer_invoice_no: string | null;
      buyer_invoice_date: string | null;
      version: number;
      currency: string;
      buyer: Party;
      return_amount: string;
    }>(sql`
      SELECT t.id, t.status, t.return_document_id, r.document_no AS return_document_no, r.document_date::text AS return_date, t.original_invoice_id, t.adjustment_invoice_id,
        t.buyer_invoice_series, t.buyer_invoice_no, t.buyer_invoice_date::text, t.version, e.currency, e.buyer, (SELECT gross FROM finance.inventory_amounts(r.id))::text AS return_amount
      FROM finance.einvoice_return_tasks t JOIN inventory.documents r ON r.id = t.return_document_id JOIN finance.einvoices e ON e.id = t.original_invoice_id
      WHERE t.company_id = ${actor.companyId} ${status ? sql`AND t.status = ${status}` : sql``}
      ORDER BY t.created_at DESC LIMIT 500`);
    const result: EinvoiceReturnTask[] = [];
    for (const row of rows.rows) {
      const currentId = await currentInvoice(this.database, row.original_invoice_id);
      const current = (
        await this.database.execute<{ series: string | null; invoice_no: string | null; invoice_date: string; status: EinvoiceStatus }>(sql`
        SELECT series, invoice_no, invoice_date::text, status FROM finance.einvoices WHERE id = ${currentId}`)
      ).rows[0]!;
      result.push({
        id: row.id,
        status: row.status,
        returnDocumentId: row.return_document_id,
        returnDocumentNo: row.return_document_no,
        returnDate: day(row.return_date),
        buyerName: row.buyer.name ?? "",
        buyerTaxCode: row.buyer.taxCode,
        returnAmount: trimDecimal(row.return_amount),
        currency: row.currency,
        original: { id: currentId, series: current.series, invoiceNo: current.invoice_no, invoiceDate: day(current.invoice_date), status: current.status },
        adjustmentInvoiceId: row.adjustment_invoice_id,
        buyerInvoice: row.buyer_invoice_no ? { series: row.buyer_invoice_series, invoiceNo: row.buyer_invoice_no, invoiceDate: day(row.buyer_invoice_date!) } : null,
        canResolve: row.status === "open" && current.status === "issued" && granted.has(einvoicePermissions.manage),
        version: row.version,
      });
    }
    return result;
  }

  // Khóa việc chờ, kiểm hóa đơn gốc hiện hành đã phát hành.
  private async openTask(transaction: Executor, actor: Actor, taskId: string, version: number) {
    const task = (
      await transaction.execute<{ status: EinvoiceReturnStatus; version: number; return_document_id: string; original_invoice_id: string }>(sql`
      SELECT status, version, return_document_id, original_invoice_id FROM finance.einvoice_return_tasks WHERE id = ${taskId} AND company_id = ${actor.companyId} FOR UPDATE`)
    ).rows[0];
    if (!task) throw new ApiError("NOT_FOUND", "notFound");
    if (task.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (task.status !== "open") throw new ApiError("BUSINESS_RULE", "einvoiceReturnResolved");
    const originalId = await currentInvoice(transaction, task.original_invoice_id);
    const original = (
      await transaction.execute<{ status: EinvoiceStatus; buyer: Party; currency: string }>(sql`SELECT status, buyer, currency FROM finance.einvoices WHERE id = ${originalId} FOR UPDATE`)
    ).rows[0]!;
    if (original.status !== "issued") throw new ApiError("BUSINESS_RULE", "einvoiceOriginalNotIssued");
    return { task, originalId, original };
  }

  // (a) Hóa đơn điều chỉnh giảm tham chiếu hóa đơn gốc hiện hành, dòng hàng trả ghi âm theo lũy kế như công nợ.
  async adjustReturn(actor: Actor, taskId: string, version: number): Promise<EinvoiceResponse> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.manage);
    const invoiceId = await this.database.transaction(async (transaction) => {
      const { task, originalId, original } = await this.openTask(transaction, actor, taskId, version);
      const settings = await settingsRow(transaction, actor.companyId);
      if (!settings) throw new ApiError("BUSINESS_RULE", "einvoiceNotConfigured");
      const company = (
        await transaction.execute<{ legal_name: string; tax_code: string | null; address: string | null }>(sql`SELECT legal_name, tax_code, address FROM core.companies WHERE id = ${actor.companyId}`)
      ).rows[0]!;
      const id = await insertInvoice(transaction, {
        companyId: actor.companyId,
        sourceDocumentId: task.return_document_id,
        kind: "adjustment",
        relatedInvoiceId: originalId,
        invoiceDate: vietnamDate(new Date()),
        settings,
        seller: { name: company.legal_name, taxCode: company.tax_code, address: company.address },
        buyer: original.buyer,
        currency: original.currency,
        items: await documentItems(transaction, task.return_document_id, "sales_return"),
        note: "Điều chỉnh giảm do trả lại hàng",
      });
      await transaction.execute(sql`
        UPDATE finance.einvoice_return_tasks SET status = 'adjusted', adjustment_invoice_id = ${id}, resolved_by = ${actor.userId}, resolved_at = now(), version = version + 1
        WHERE id = ${taskId}`);
      await this.auditService.record({ ...financeAudit(actor, "einvoice"), action: "einvoice.adjust_return", entityId: id, afterData: { taskId, originalId } }, transaction);
      return id;
    });
    await this.einvoices.process(invoiceId);
    return this.einvoices.detail(actor, invoiceId);
  }

  // (b) Ghi hóa đơn trả hàng do người mua là tổ chức có mã số thuế lập.
  async recordBuyerInvoice(actor: Actor, taskId: string, input: z.output<typeof recordBuyerInvoiceSchema>): Promise<EinvoiceReturnTask[]> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.manage);
    await this.database.transaction(async (transaction) => {
      const { original } = await this.openTask(transaction, actor, taskId, input.version);
      if (original.buyer.anonymous || !original.buyer.taxCode) throw new ApiError("BUSINESS_RULE", "einvoiceBuyerInvoiceNeedsTaxCode");
      await transaction.execute(sql`
        UPDATE finance.einvoice_return_tasks SET status = 'buyer_invoice', buyer_invoice_series = ${input.series}, buyer_invoice_no = ${input.invoiceNo}, buyer_invoice_date = ${input.invoiceDate}::date,
          resolved_by = ${actor.userId}, resolved_at = now(), version = version + 1
        WHERE id = ${taskId}`);
      await this.auditService.record({ ...financeAudit(actor, "einvoice"), action: "einvoice.buyer_return_invoice", entityId: taskId, afterData: input }, transaction);
    });
    return this.returnTasks(actor, undefined);
  }

  // Hóa đơn thay thế khi sai thông tin người mua (QUYTAC_NGHIEPVU_107).
  async replace(actor: Actor, invoiceId: string, input: z.output<typeof replaceEinvoiceSchema>): Promise<EinvoiceResponse> {
    await requireFinancePermission(this.permissionService, actor, einvoicePermissions.manage);
    const replacementId = await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{
          kind: string;
          status: EinvoiceStatus;
          version: number;
          replaced_by_id: string | null;
          source_document_id: string;
          currency: string;
          buyer: Party;
          adjusted: boolean;
        }>(sql`
        SELECT e.kind, e.status, e.version, e.replaced_by_id, e.source_document_id, e.currency, e.buyer,
          EXISTS (SELECT 1 FROM finance.einvoices a WHERE a.related_invoice_id = e.id AND a.kind = 'adjustment') AS adjusted
        FROM finance.einvoices e WHERE e.id = ${invoiceId} AND e.company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.kind === "adjustment") throw new ApiError("BUSINESS_RULE", "einvoiceAdjustmentNotReplaceable");
      if (row.status !== "issued") throw new ApiError("BUSINESS_RULE", "einvoiceNotIssued");
      if (row.replaced_by_id) throw new ApiError("BUSINESS_RULE", "einvoiceAlreadyReplaced");
      if (row.adjusted) throw new ApiError("BUSINESS_RULE", "einvoiceAlreadyAdjusted");
      const settings = await settingsRow(transaction, actor.companyId);
      if (!settings) throw new ApiError("BUSINESS_RULE", "einvoiceNotConfigured");
      const company = (
        await transaction.execute<{ legal_name: string; tax_code: string | null; address: string | null }>(sql`SELECT legal_name, tax_code, address FROM core.companies WHERE id = ${actor.companyId}`)
      ).rows[0]!;
      const lines = await transaction.execute<{
        item_code: string | null;
        item_name: string;
        unit_name: string | null;
        quantity: string;
        unit_price: string;
        vat_rate: "0" | "5" | "8" | "10" | "exempt" | "not_declared";
        net_amount: string;
        tax_amount: string;
        total_amount: string;
        is_promotion: boolean;
      }>(sql`
        SELECT item_code, item_name, unit_name, quantity::text, unit_price::text, vat_rate, net_amount::text, tax_amount::text, total_amount::text, is_promotion
        FROM finance.einvoice_lines WHERE invoice_id = ${invoiceId} ORDER BY line_no`);
      const buyer: Party = {
        partnerId: row.buyer.partnerId,
        name: input.buyerName,
        taxCode: input.buyerTaxCode ?? null,
        address: input.buyerAddress,
        anonymous: false,
      };
      const id = await insertInvoice(transaction, {
        companyId: actor.companyId,
        sourceDocumentId: row.source_document_id,
        kind: "replacement",
        relatedInvoiceId: invoiceId,
        invoiceDate: vietnamDate(new Date()),
        settings,
        seller: { name: company.legal_name, taxCode: company.tax_code, address: company.address },
        buyer,
        currency: row.currency,
        items: lines.rows.map((line, index) => ({
          lineNo: index + 1,
          itemCode: line.item_code,
          itemName: line.item_name,
          unitName: line.unit_name,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unit_price),
          vatRate: line.vat_rate,
          netAmount: Number(line.net_amount),
          taxAmount: Number(line.tax_amount),
          totalAmount: Number(line.total_amount),
          isPromotion: line.is_promotion,
        })),
        note: input.reason,
      });
      await transaction.execute(sql`UPDATE finance.einvoices SET replaced_by_id = ${id}, version = version + 1 WHERE id = ${invoiceId}`);
      await this.auditService.record(
        { ...financeAudit(actor, "einvoice"), action: "einvoice.replace", entityId: id, beforeData: { invoiceId, buyer: row.buyer }, afterData: { buyer, reason: input.reason } },
        transaction,
      );
      return id;
    });
    await this.einvoices.process(replacementId);
    return this.einvoices.detail(actor, replacementId);
  }
}
