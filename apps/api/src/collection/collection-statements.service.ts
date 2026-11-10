// Đối soát thu hộ COD, cổng thanh toán (CONG_VIEC_19; CHUC_NANG_88 đến 91; QUYTAC_NGHIEPVU_118 đến 122; API_102 đến API_105).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  collectionImportColumns,
  collectionImportMaximumBytes,
  collectionImportMaximumRows,
  type CollectionLineError,
  type CollectionStatementLine,
  type collectionStatementListQuerySchema,
  type CollectionStatementListItem,
  type CollectionStatementResponse,
  type CollectionStatementsResponse,
  type CollectorItem,
  type CollectorsResponse,
  type importCollectionStatementSchema,
  type saveCollectorSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { readSheet } from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import type { z } from "zod";
import { LedgerService } from "../accounting/ledger.service";
import { ledgerSettings } from "../accounting/period-guard";
import { collectionDraft } from "../accounting/postings";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { trimDecimal } from "../catalog/catalog-context";
import { OutboxService } from "../common/outbox.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { DebtsService } from "../finance/debts.service";
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";

export const collectionPermissions = { view: "finance.collection.view", manage: "finance.collection.manage", setup: "finance.collection.setup" } as const;
export type Executor = Pick<Database, "execute">;
type Cell = string | number | boolean | Date | null;
// Trạng thái còn sửa được (nhập lại, bỏ dòng, gửi).
export const editableStatuses = ["draft", "rejected", "withdrawn"] as const;
const documentTypeCode = "finance.collection_statement";

type StatementRow = {
  id: string;
  collector_id: string;
  partner_id: string;
  collector_name: string;
  collector_kind: "cod" | "gateway";
  statement_no: string;
  document_no: string | null;
  statement_date: string;
  status: CollectionStatementListItem["status"];
  total_collected: string;
  total_fee: string;
  post_error: string | null;
  line_count: number;
  error_count: number;
  approval_request_id: string | null;
  created_by: string;
  version: number;
};

// Lỗi chặn gửi của từng dòng (QUYTAC_NGHIEPVU_119).
export const lineErrorSql = sql`
  CASE
    WHEN l.order_id IS NULL THEN 'order_not_found'
    WHEN o.status = 'cancelled' THEN 'order_cancelled'
    WHEN (SELECT count(*) FROM finance.collection_statement_lines same WHERE same.statement_id = l.statement_id AND same.reference = l.reference) > 1 THEN 'duplicate_reference'
    WHEN EXISTS (SELECT 1 FROM finance.collection_statement_lines other JOIN finance.collection_statements os ON os.id = other.statement_id
      WHERE other.reference = l.reference AND os.collector_id = s.collector_id AND os.id <> s.id AND os.status NOT IN ('rejected', 'withdrawn')) THEN 'reference_used'
  END`;
// Số khách còn nợ trên các phiếu xuất giao hàng của đơn.
export const orderOpenSql = (orderId: SQL) => sql`
  (SELECT coalesce(sum(d.open_amount), 0) FROM finance.debt_items d JOIN inventory.documents doc ON doc.id = d.source_id
   WHERE d.source_type = 'sales_issue' AND d.direction = 'debit' AND doc.source_type = 'sales.order' AND doc.source_id = ${orderId})`;

@Injectable()
export class CollectionStatementsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly debts: DebtsService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly ledger: LedgerService,
  ) {}

  // Duyệt xong thì ghi sổ; không ghi sổ được (kỳ đã khóa, lỗi dòng mới phát sinh) thì bảng về "Bị từ chối" kèm lý do.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== documentTypeCode) return;
      const status = String(event.payload.status);
      const statement = (
        await this.database.execute<{ id: string }>(sql`SELECT id FROM finance.collection_statements WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`)
      ).rows[0];
      if (!statement) return;
      if (status === "approved") {
        try {
          await this.database.transaction((transaction) => this.post(transaction, statement.id));
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          await this.close(this.database, statement.id, "rejected", error.messageKey);
        }
      } else if (status === "rejected" || status === "withdrawn") {
        await this.close(this.database, statement.id, status, null);
      }
    });
  }

  private async close(executor: Executor, id: string, status: "rejected" | "withdrawn", postError: string | null): Promise<void> {
    await executor.execute(sql`UPDATE finance.collection_statements SET status = ${status}, post_error = ${postError}, version = version + 1 WHERE id = ${id} AND status = 'pending'`);
  }

  // ---------- Đơn vị thu hộ (CHUC_NANG_88; API_102) ----------

  private async collectorRows(executor: Executor, companyId: string, where: SQL = sql`TRUE`): Promise<CollectorItem[]> {
    const rows = (
      await executor.execute<{ id: string; partner_id: string; code: string; name: string; kind: CollectorItem["kind"]; status: CollectorItem["status"]; version: number }>(sql`
      SELECT c.id, c.partner_id, p.code, p.name, c.kind, c.status, c.version FROM finance.collectors c JOIN crm.partners p ON p.id = c.partner_id
      WHERE c.company_id = ${companyId} AND ${where} ORDER BY c.status, p.name`)
    ).rows;
    return rows.map((row) => ({ id: row.id, partnerId: row.partner_id, partnerCode: row.code, partnerName: row.name, kind: row.kind, status: row.status, version: row.version }));
  }

  async collectors(actor: Actor): Promise<CollectorsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, collectionPermissions.view, collectionPermissions.setup);
    return {
      collectors: await this.collectorRows(this.database, actor.companyId),
      canSetup: granted.has(collectionPermissions.setup),
      canManage: granted.has(collectionPermissions.manage),
    };
  }

  async saveCollector(actor: Actor, id: string | null, input: z.output<typeof saveCollectorSchema>): Promise<CollectorItem> {
    await requireFinancePermission(this.permissionService, actor, collectionPermissions.setup);
    return this.database.transaction(async (transaction) => {
      let collectorId = id;
      if (id === null) {
        await this.debts.requirePartnerOnSide(transaction, actor.companyId, "receivable", input.partnerId, "partnerId");
        const inserted = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO finance.collectors (company_id, partner_id, kind, status, created_by) VALUES (${actor.companyId}, ${input.partnerId}, ${input.kind}, ${input.status}, ${actor.userId})
          ON CONFLICT (company_id, partner_id) DO NOTHING RETURNING id`)
        ).rows[0];
        if (!inserted) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { partnerId: "collectorDuplicate" } });
        collectorId = inserted.id;
      } else {
        const updated = await transaction.execute(sql`
          UPDATE finance.collectors SET kind = ${input.kind}, status = ${input.status}, version = version + 1
          WHERE id = ${id} AND company_id = ${actor.companyId} AND partner_id = ${input.partnerId} AND version = ${input.version ?? -1}`);
        if ((updated.rowCount ?? 0) === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      }
      await this.auditService.record(
        {
          ...financeAudit(actor, "collector"),
          action: id ? "collector.update" : "collector.create",
          entityId: collectorId!,
          beforeData: null,
          afterData: { partnerId: input.partnerId, kind: input.kind, status: input.status },
        },
        transaction,
      );
      return (await this.collectorRows(transaction, actor.companyId, sql`c.id = ${collectorId}`))[0]!;
    });
  }

  // ---------- Tệp mẫu, nhập tệp (CHUC_NANG_89; API_103, API_105) ----------

  async template(): Promise<Buffer> {
    const header = collectionImportColumns.map((title) => ({ value: title, fontWeight: "bold" as const }));
    const example = (reference: string, order: string, collected: number, fee: number) => [
      { value: reference },
      { value: order },
      { value: collected, type: Number },
      { value: fee, type: Number },
      { value: "2026-11-10" },
    ];
    return writeXlsxFile([header, example("GHN123456789", "DBH-VCR-2026-000001", 550000, 16500), example("GHN123456790", "DBH-VCR-2026-000002", 0, 22000)], {
      sheet: "Đối soát",
    }).toBuffer();
  }

  private parseRows(sheet: Cell[][], minorUnits: number) {
    const text = (value: Cell | undefined): string => (value === null || value === undefined ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim());
    const header = (sheet[0] ?? []).map(text);
    if (collectionImportColumns.some((title, index) => header[index] !== title)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    // Số dạng 550000, 550.000 hoặc 550,000 (dấu tách hàng nghìn); phần lẻ không quá đơn vị nhỏ nhất của tiền tệ.
    const amount = (value: Cell | undefined): string | null => {
      if (value === null || value === undefined || value === "") return "0";
      const raw =
        typeof value === "number"
          ? String(value)
          : String(value)
              .trim()
              .replace(/[.,\s](?=\d{3}(\D|$))/g, "");
      if (!/^\d{1,16}(\.\d{1,4})?$/.test(raw)) return null;
      return (raw.split(".")[1] ?? "").replace(/0+$/, "").length > minorUnits ? null : raw;
    };
    const date = (value: Cell | undefined): string | null | false => {
      const raw = text(value);
      if (!raw) return null;
      const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw) ?? (/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw) ? ["", raw.slice(6), raw.slice(3, 5), raw.slice(0, 2)] : null);
      if (!iso) return false;
      const result = `${iso[1]}-${iso[2]}-${iso[3]}`;
      // Ngày không có thật (31/02) thì từ chối.
      const parsed = new Date(`${result}T00:00:00Z`);
      return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result ? false : result;
    };
    const fields: Record<string, "invalidValue" | "required"> = {};
    const lines: { lineNo: number; reference: string; orderNo: string; collected: string; fee: string; collectedDate: string | null }[] = [];
    sheet.slice(1).forEach((row, index) => {
      if (!row.some((cell) => text(cell))) return;
      const lineNo = index + 2;
      const reference = text(row[0]);
      const orderNo = text(row[1]).toUpperCase();
      const collected = amount(row[2]);
      const fee = amount(row[3]);
      const collectedDate = date(row[4]);
      if (!reference || reference.length > 100) fields[`rows.${lineNo}.reference`] = reference ? "invalidValue" : "required";
      if (!orderNo || orderNo.length > 100) fields[`rows.${lineNo}.orderNo`] = orderNo ? "invalidValue" : "required";
      if (collected === null) fields[`rows.${lineNo}.collected`] = "invalidValue";
      if (fee === null) fields[`rows.${lineNo}.fee`] = "invalidValue";
      if (collectedDate === false) fields[`rows.${lineNo}.collectedDate`] = "invalidValue";
      lines.push({ lineNo, reference, orderNo, collected: collected ?? "0", fee: fee ?? "0", collectedDate: collectedDate || null });
    });
    if (lines.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileEmpty" } });
    if (lines.length > collectionImportMaximumRows) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooManyRows" } });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return lines;
  }

  async import(actor: Actor, input: z.output<typeof importCollectionStatementSchema>, file: { buffer: Buffer; size: number } | undefined): Promise<CollectionStatementResponse> {
    await requireFinancePermission(this.permissionService, actor, collectionPermissions.manage);
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > collectionImportMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooLarge" } });
    let sheet: Cell[][];
    try {
      sheet = (await readSheet(file.buffer)) as Cell[][];
    } catch {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    }
    const minorUnits = Number((await this.database.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${actor.companyId}) AS units`)).rows[0]!.units);
    const lines = this.parseRows(sheet, minorUnits);
    const id = await this.database.transaction(async (transaction) => {
      const collector = (await transaction.execute<{ status: string }>(sql`SELECT status FROM finance.collectors WHERE id = ${input.collectorId} AND company_id = ${actor.companyId}`)).rows[0];
      if (!collector || collector.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { collectorId: "invalidValue" } });
      const duplicate = (
        await transaction.execute(sql`
        SELECT 1 FROM finance.collection_statements WHERE collector_id = ${input.collectorId} AND statement_no = ${input.statementNo} AND status NOT IN ('rejected', 'withdrawn')
          ${input.statementId ? sql`AND id <> ${input.statementId}` : sql``}`)
      ).rows[0];
      if (duplicate) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { statementNo: "collectionStatementDuplicate" } });
      let statementId = input.statementId;
      if (statementId) {
        const updated = await transaction.execute(sql`
          UPDATE finance.collection_statements SET collector_id = ${input.collectorId}, statement_no = ${input.statementNo}, statement_date = ${input.statementDate}::date, version = version + 1
          WHERE id = ${statementId} AND company_id = ${actor.companyId} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${input.version ?? -1}`);
        if ((updated.rowCount ?? 0) === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`DELETE FROM finance.collection_statement_lines WHERE statement_id = ${statementId}`);
      } else {
        statementId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO finance.collection_statements (company_id, collector_id, statement_no, statement_date, created_by)
          VALUES (${actor.companyId}, ${input.collectorId}, ${input.statementNo}, ${input.statementDate}::date, ${actor.userId}) RETURNING id`)
        ).rows[0]!.id;
      }
      // Ghép theo số đơn bán của công ty (không phân biệt hoa thường).
      for (let start = 0; start < lines.length; start += 500) {
        const chunk = lines.slice(start, start + 500);
        await transaction.execute(sql`
          INSERT INTO finance.collection_statement_lines (statement_id, line_no, reference, order_no, order_id, customer_id, collected_amount, fee_amount, collected_date)
          SELECT ${statementId}, v.line_no, v.reference, v.order_no, o.id, o.customer_id, v.collected, v.fee, v.collected_date
          FROM (VALUES ${sql.join(
            chunk.map((line) => sql`(${line.lineNo}::int, ${line.reference}, ${line.orderNo}, ${line.collected}::numeric, ${line.fee}::numeric, ${line.collectedDate}::date)`),
            sql`, `,
          )}) AS v(line_no, reference, order_no, collected, fee, collected_date)
          LEFT JOIN sales.orders o ON o.company_id = ${actor.companyId} AND upper(o.document_no) = v.order_no AND NOT o.is_counterpart`);
      }
      await this.refreshTotals(transaction, statementId);
      await this.auditService.record(
        {
          ...financeAudit(actor, "collection_statement"),
          action: input.statementId ? "collection_statement.reimport" : "collection_statement.import",
          entityId: statementId,
          beforeData: null,
          afterData: { collectorId: input.collectorId, statementNo: input.statementNo, lines: lines.length },
        },
        transaction,
      );
      return statementId;
    });
    return this.detail(actor, id);
  }

  async refreshTotals(executor: Executor, statementId: string): Promise<void> {
    await executor.execute(sql`
      UPDATE finance.collection_statements s SET
        total_collected = coalesce((SELECT sum(collected_amount) FROM finance.collection_statement_lines WHERE statement_id = s.id), 0),
        total_fee = coalesce((SELECT sum(fee_amount) FROM finance.collection_statement_lines WHERE statement_id = s.id), 0)
      WHERE s.id = ${statementId}`);
  }

  // ---------- Danh sách, chi tiết (CHUC_NANG_91; API_103, API_104) ----------

  private statementSelect(): SQL {
    return sql`
      SELECT s.id, s.collector_id, c.partner_id, p.name AS collector_name, c.kind AS collector_kind, s.statement_no, s.document_no, s.statement_date::text, s.status,
        s.total_collected::text, s.total_fee::text, s.post_error, s.approval_request_id, s.created_by, s.version,
        (SELECT count(*)::int FROM finance.collection_statement_lines l WHERE l.statement_id = s.id) AS line_count,
        (SELECT count(*)::int FROM finance.collection_statement_lines l LEFT JOIN sales.orders o ON o.id = l.order_id WHERE l.statement_id = s.id AND (${lineErrorSql}) IS NOT NULL) AS error_count
      FROM finance.collection_statements s JOIN finance.collectors c ON c.id = s.collector_id JOIN crm.partners p ON p.id = c.partner_id`;
  }

  private toListItem(row: StatementRow): CollectionStatementListItem {
    return {
      id: row.id,
      collectorName: row.collector_name,
      collectorKind: row.collector_kind,
      statementNo: row.statement_no,
      documentNo: row.document_no,
      statementDate: row.statement_date,
      status: row.status,
      totalCollected: trimDecimal(row.total_collected),
      totalFee: trimDecimal(row.total_fee),
      netAmount: trimDecimal((Number(row.total_collected) - Number(row.total_fee)).toFixed(4)),
      lineCount: row.line_count,
      errorCount: row.status === "posted" ? 0 : row.error_count,
      postError: row.post_error,
    };
  }

  async list(actor: Actor, query: z.output<typeof collectionStatementListQuerySchema>): Promise<CollectionStatementsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, collectionPermissions.view);
    const conditions: SQL[] = [sql`s.company_id = ${actor.companyId}`];
    if (query.collectorId) conditions.push(sql`s.collector_id = ${query.collectorId}`);
    if (query.status) conditions.push(sql`s.status = ${query.status}`);
    if (query.from) conditions.push(sql`s.statement_date >= ${query.from}::date`);
    if (query.to) conditions.push(sql`s.statement_date <= ${query.to}::date`);
    const where = sql.join(conditions, sql` AND `);
    const total = Number((await this.database.execute<{ total: string }>(sql`SELECT count(*)::text AS total FROM finance.collection_statements s WHERE ${where}`)).rows[0]!.total);
    const rows = (
      await this.database.execute<StatementRow>(
        sql`${this.statementSelect()} WHERE ${where} ORDER BY s.statement_date DESC, s.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      )
    ).rows;
    return {
      data: rows.map((row) => this.toListItem(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      canManage: granted.has(collectionPermissions.manage),
      currency: await companyCurrency(this.database, actor.companyId),
    };
  }

  async statement(executor: Executor, companyId: string, id: string): Promise<StatementRow> {
    const row = (await executor.execute<StatementRow>(sql`${this.statementSelect()} WHERE s.id = ${id} AND s.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async lines(executor: Executor, statementId: string, posted: boolean): Promise<CollectionStatementLine[]> {
    const rows = (
      await executor.execute<{
        id: string;
        line_no: number;
        reference: string;
        order_no: string;
        order_id: string | null;
        customer_name: string | null;
        collected_amount: string;
        fee_amount: string;
        collected_date: string | null;
        open_amount: string | null;
        error: CollectionLineError | null;
      }>(sql`
      SELECT l.id, l.line_no, l.reference, l.order_no, l.order_id, cp.name AS customer_name, l.collected_amount::text, l.fee_amount::text, l.collected_date::text,
        CASE WHEN l.customer_id IS NULL THEN NULL ELSE ${orderOpenSql(sql`l.order_id`)}::text END AS open_amount, ${lineErrorSql} AS error
      FROM finance.collection_statement_lines l JOIN finance.collection_statements s ON s.id = l.statement_id
      LEFT JOIN sales.orders o ON o.id = l.order_id LEFT JOIN crm.partners cp ON cp.id = l.customer_id
      WHERE l.statement_id = ${statementId} ORDER BY l.line_no`)
    ).rows;
    return rows.map((row) => ({
      id: row.id,
      lineNo: row.line_no,
      reference: row.reference,
      orderNo: row.order_no,
      orderId: row.order_id,
      customerName: row.customer_name,
      collectedAmount: trimDecimal(row.collected_amount),
      feeAmount: trimDecimal(row.fee_amount),
      collectedDate: row.collected_date,
      orderOpenAmount: posted ? null : trimDecimal(row.open_amount),
      error: posted ? null : row.error,
      amountDiffers: !posted && row.open_amount !== null && row.error === null && Number(row.open_amount) !== Number(row.collected_amount),
    }));
  }

  async detail(actor: Actor, id: string): Promise<CollectionStatementResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, collectionPermissions.view);
    const row = await this.statement(this.database, actor.companyId, id);
    const lines = await this.lines(this.database, id, row.status === "posted");
    const canManage = granted.has(collectionPermissions.manage);
    return {
      ...this.toListItem(row),
      collectorId: row.collector_id,
      partnerId: row.partner_id,
      lines,
      warningCount: lines.filter((line) => line.amountDiffers).length,
      canManage,
      canWithdraw: canManage && row.status === "pending" && row.created_by === actor.userId,
      currency: await companyCurrency(this.database, actor.companyId),
      version: row.version,
    };
  }

  // ---------- Bỏ dòng, bỏ bảng nháp (API_104) ----------

  async removeLine(actor: Actor, id: string, lineId: string, version: number): Promise<CollectionStatementResponse> {
    await requireFinancePermission(this.permissionService, actor, collectionPermissions.manage);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE finance.collection_statements SET version = version + 1 WHERE id = ${id} AND company_id = ${actor.companyId} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${version}`);
      if ((updated.rowCount ?? 0) === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const removed = await transaction.execute(sql`DELETE FROM finance.collection_statement_lines WHERE id = ${lineId} AND statement_id = ${id}`);
      if ((removed.rowCount ?? 0) === 0) throw new ApiError("NOT_FOUND", "notFound");
      if (Number((await transaction.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM finance.collection_statement_lines WHERE statement_id = ${id}`)).rows[0]!.count) === 0)
        throw new ApiError("BUSINESS_RULE", "collectionLastLine");
      await this.refreshTotals(transaction, id);
      await this.auditService.record(
        { ...financeAudit(actor, "collection_statement"), action: "collection_statement.remove_line", entityId: id, beforeData: null, afterData: { lineId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async discard(actor: Actor, id: string, version: number): Promise<void> {
    await requireFinancePermission(this.permissionService, actor, collectionPermissions.manage);
    await this.database.transaction(async (transaction) => {
      const removed = await transaction.execute(sql`
        DELETE FROM finance.collection_statements WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'draft' AND document_no IS NULL AND version = ${version}`);
      if ((removed.rowCount ?? 0) === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...financeAudit(actor, "collection_statement"), action: "collection_statement.discard", entityId: id, beforeData: null, afterData: null }, transaction);
    });
  }

  // ---------- Gửi, rút, ghi sổ (CHUC_NANG_90; QUYTAC_NGHIEPVU_120 đến 122; API_104) ----------

  private async errorCount(executor: Executor, id: string): Promise<number> {
    return Number(
      (
        await executor.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM finance.collection_statement_lines l JOIN finance.collection_statements s ON s.id = l.statement_id
        LEFT JOIN sales.orders o ON o.id = l.order_id WHERE l.statement_id = ${id} AND (${lineErrorSql}) IS NOT NULL`)
      ).rows[0]!.count,
    );
  }

  // Gửi: còn dòng lỗi thì chặn; cấp số, đi luồng duyệt; chưa có chính sách thì ghi sổ ngay.
  async submit(actor: Actor, id: string, version: number): Promise<CollectionStatementResponse> {
    await requireFinancePermission(this.permissionService, actor, collectionPermissions.manage);
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "DST");
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ status: string; document_no: string | null; statement_date: string; total_collected: string; version: number }>(sql`
        SELECT status, document_no, statement_date::text, total_collected::text, version FROM finance.collection_statements WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!(editableStatuses as readonly string[]).includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      if ((await this.errorCount(transaction, id)) > 0) throw new ApiError("BUSINESS_RULE", "collectionStatementHasErrors");
      const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, documentTypeCode, transaction));
      let requestId: string | null = null;
      try {
        requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
          documentTypeCode,
          documentId: id,
          documentNo,
          amount: Number(row.total_collected).toFixed(4),
          currency: await companyCurrency(transaction, actor.companyId),
          documentDate: row.statement_date,
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
      await transaction.execute(sql`
        UPDATE finance.collection_statements SET status = 'pending', document_no = ${documentNo}, approval_request_id = ${requestId}, post_error = NULL, submitted_at = now(), version = version + 1
        WHERE id = ${id}`);
      if (!requestId) await this.post(transaction, id);
      await this.auditService.record(
        { ...financeAudit(actor, "collection_statement"), action: "collection_statement.submit", entityId: id, beforeData: null, afterData: { documentNo, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<CollectionStatementResponse> {
    await requireFinancePermission(this.permissionService, actor, collectionPermissions.manage);
    const row = (
      await this.database.execute<{ status: string; created_by: string; approval_request_id: string | null }>(sql`
      SELECT status, created_by, approval_request_id FROM finance.collection_statements WHERE id = ${id} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await this.close(transaction, id, "withdrawn", null);
      await this.auditService.record({ ...financeAudit(actor, "collection_statement"), action: "collection_statement.withdraw", entityId: id, beforeData: null, afterData: null }, transaction);
    });
    return this.detail(actor, id);
  }

  // Ghi sổ (QUYTAC_NGHIEPVU_120, 121): trừ nợ khách theo đơn, nợ đơn vị thu hộ bằng thực nhận, bút toán ngày bảng.
  private async post(executor: Executor, id: string): Promise<void> {
    const row = (
      await executor.execute<{ company_id: string; partner_id: string; document_no: string; statement_date: string; total_collected: string; total_fee: string }>(sql`
      SELECT s.company_id, c.partner_id, s.document_no, s.statement_date::text, s.total_collected::text, s.total_fee::text
      FROM finance.collection_statements s JOIN finance.collectors c ON c.id = s.collector_id WHERE s.id = ${id} AND s.status = 'pending' FOR UPDATE OF s`)
    ).rows[0];
    if (!row) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    // Bảng khác cùng đơn vị có thể đã ghi sổ mã trùng sau khi gửi.
    if ((await this.errorCount(executor, id)) > 0) throw new ApiError("BUSINESS_RULE", "collectionStatementHasErrors");
    if (await ledgerSettings(executor, row.company_id)) {
      const rules = await executor.execute(sql`
        SELECT 1 FROM accounting.posting_rules WHERE company_id = ${row.company_id} AND role IN ('collector_receivable', 'collection_fee', 'receivable')`);
      if (rules.rows.length < 3) throw new ApiError("BUSINESS_RULE", "postingRuleMissing");
    }
    const lines = (
      await executor.execute<{ id: string; reference: string; order_id: string; customer_id: string; collected_amount: string }>(sql`
      SELECT id, reference, order_id, customer_id, collected_amount::text FROM finance.collection_statement_lines
      WHERE statement_id = ${id} AND customer_id IS NOT NULL AND collected_amount > 0 ORDER BY line_no`)
    ).rows;
    // Nguồn công nợ: khoản giảm nợ khách theo từng dòng, khoản nợ đơn vị thu hộ theo bảng.
    for (const line of lines) {
      const creditId = (
        await executor.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, amount, open_amount, note)
        VALUES (${row.company_id}, ${line.customer_id}, 'receivable', 'credit', 'collection_statement', ${line.id}, ${row.document_no}, ${row.statement_date}::date,
          ${line.collected_amount}::numeric, ${line.collected_amount}::numeric, ${line.reference})
        RETURNING id`)
      ).rows[0]!.id;
      // Trừ trước vào các phiếu xuất giao hàng của đơn; phần thừa là tiền trả trước của khách.
      const issues = (
        await executor.execute<{ id: string }>(sql`
        SELECT d.id FROM finance.debt_items d JOIN inventory.documents doc ON doc.id = d.source_id
        WHERE d.source_type = 'sales_issue' AND d.direction = 'debit' AND d.open_amount > 0 AND doc.source_type = 'sales.order' AND doc.source_id = ${line.order_id}
        ORDER BY d.document_date, d.created_at, d.id`)
      ).rows;
      await this.debts.matchCredit(
        executor,
        creditId,
        issues.map((issue) => ({ debitItemId: issue.id, amount: null })),
        false,
      );
    }
    const net = Number(row.total_collected) - Number(row.total_fee);
    if (Math.abs(net) > 0.00005) {
      const amount = Math.abs(net).toFixed(4);
      const itemId = (
        await executor.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, due_date, amount, open_amount)
        VALUES (${row.company_id}, ${row.partner_id}, 'receivable', ${net > 0 ? "debit" : "credit"}, 'collection_statement', ${id}, ${row.document_no}, ${row.statement_date}::date,
          ${net > 0 ? row.statement_date : null}::date, ${amount}::numeric, ${amount}::numeric)
        RETURNING id`)
      ).rows[0]!.id;
      if (net > 0) await this.debts.matchDebit(executor, itemId);
      else await this.debts.matchCredit(executor, itemId, [], true);
    }
    await this.ledger.record(executor, await collectionDraft(executor, id));
    await executor.execute(sql`UPDATE finance.collection_statements SET status = 'posted', posted_at = now(), post_error = NULL, version = version + 1 WHERE id = ${id}`);
  }
}
