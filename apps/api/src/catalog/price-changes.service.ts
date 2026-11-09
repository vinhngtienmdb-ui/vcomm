// Phiếu điều chỉnh giá qua luồng duyệt (CHUC_NANG_37; QUYTAC_NGHIEPVU_44; API_62; TIEUCHI_NGHIEMTHU_62).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  priceChangeImportColumns,
  productImportMaximumBytes,
  productImportMaximumRows,
  type PageResponse,
  type PriceChangeImportResponse,
  type PriceChangeLine,
  type priceChangeListQuerySchema,
  type PriceChangeListItem,
  type PriceChangeResponse,
  type PriceChangeStatus,
  type savePriceChangeSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import { messages, type Locale } from "i18n";
import { readSheet } from "read-excel-file/node";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { catalogAudit, catalogPermissions, requireCompanyPermission } from "./catalog-context";
import { day, trimDecimal } from "./price-lists.service";

const documentTypeCode = "catalog.price_change";
type Executor = Pick<Database, "execute">;
type Input = z.output<typeof savePriceChangeSchema>;
type ChangeRow = {
  id: string;
  change_no: string | null;
  price_list_id: string;
  price_list_name: string;
  currency: string;
  effective_from: Date;
  note: string | null;
  status: PriceChangeStatus;
  approval_request_id: string | null;
  requested_by: string;
  requested_by_name: string;
  line_count: number;
  created_at: Date;
  version: number;
};

@Injectable()
export class PriceChangesService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
  ) {}

  // Luồng duyệt kết thúc: duyệt thì ghi giá vào lịch sử; từ chối, rút thì chỉ đổi trạng thái phiếu.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== documentTypeCode) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.transaction(async (transaction) => {
        const updated = await transaction.execute<{ id: string }>(sql`
          UPDATE catalog.price_changes SET status = ${status}, completed_at = now(), updated_at = now()
          WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending' RETURNING id`);
        const changeId = updated.rows[0]?.id;
        if (changeId && status === "approved") await this.applyPrices(transaction, changeId);
      });
    });
  }

  async list(actor: Actor, query: z.output<typeof priceChangeListQuerySchema>): Promise<PageResponse<PriceChangeListItem>> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewPrices);
    const where = query.status ? sql`c.company_id = ${actor.companyId} AND c.status = ${query.status}` : sql`c.company_id = ${actor.companyId}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM catalog.price_changes c WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<ChangeRow>(sql`${this.select()} WHERE ${where} ORDER BY c.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.toItem(row)), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<PriceChangeResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewPrices);
    const row = await this.single(actor.companyId, id);
    const lines = await this.database.execute<{
      variant_id: string;
      sku: string;
      product_name: string;
      option_values: string[];
      unit_id: string;
      unit_name: string;
      price: string;
      current_price: string | null;
    }>(sql`
      SELECT l.variant_id, v.sku, p.name AS product_name, v.option_values, l.unit_id, u.name_vi AS unit_name, l.price::text AS price, l.current_price::text AS current_price
      FROM catalog.price_change_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      WHERE l.price_change_id = ${id} ORDER BY v.sku, u.name_vi`);
    const own = row.requested_by === actor.userId;
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    return {
      ...this.toItem(row),
      note: row.note,
      currency: row.currency,
      approvalRequestId: row.approval_request_id,
      lines: lines.rows.map((line) => ({
        variantId: line.variant_id,
        sku: line.sku,
        productName: line.product_name,
        optionValues: line.option_values,
        unitId: line.unit_id,
        unitName: line.unit_name,
        price: trimDecimal(line.price),
        currentPrice: line.current_price === null ? null : trimDecimal(line.current_price),
      })),
      version: row.version,
      canEdit: own && row.status === "draft",
      canWithdraw: own && row.status === "pending" && !firstStepDecided,
    };
  }

  async create(actor: Actor, input: Input): Promise<PriceChangeResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    await this.validate(actor.companyId, input);
    const id = await this.database.transaction(async (transaction) => {
      const changeId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO catalog.price_changes (company_id, price_list_id, effective_from, note, requested_by)
        VALUES (${actor.companyId}, ${input.priceListId}, ${input.effectiveFrom}::date, ${input.note ?? null}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, changeId, input);
      await this.auditService.record({ ...catalogAudit(actor, "price_change"), action: "price_change.create", entityId: changeId, afterData: input }, transaction);
      return changeId;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<PriceChangeResponse> {
    const row = await this.requireOwnDraft(actor, id);
    await this.validate(actor.companyId, input);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE catalog.price_changes SET price_list_id = ${input.priceListId}, effective_from = ${input.effectiveFrom}::date, note = ${input.note ?? null},
          version = version + 1, updated_at = now()
        WHERE id = ${id} AND status = 'draft' AND version = ${input.version ?? row.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM catalog.price_change_lines WHERE price_change_id = ${id}`);
      await this.writeLines(transaction, id, input);
      await this.auditService.record({ ...catalogAudit(actor, "price_change"), action: "price_change.update", entityId: id, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    await this.requireOwnDraft(actor, id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM catalog.price_changes WHERE id = ${id} AND status = 'draft'`);
      await this.auditService.record({ ...catalogAudit(actor, "price_change"), action: "price_change.delete", entityId: id }, transaction);
    });
  }

  // Gửi: ngày hiệu lực không trước hôm nay; cấp số và gửi duyệt cùng giao dịch. Công ty chưa có chính sách duyệt thì ghi giá ngay (QUYTAC_NGHIEPVU_44).
  async submit(actor: Actor, id: string): Promise<PriceChangeResponse> {
    const row = await this.requireOwnDraft(actor, id);
    const today = this.permissionService.today();
    if (day(row.effective_from) < today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { effectiveFrom: "effectiveDatePast" } });
    await this.requireActiveList(actor.companyId, row.price_list_id);
    // Công ty chưa cấu hình dãy số thì tạo dãy mặc định tiền tố DCG, đánh lại theo năm.
    const configured = await this.database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${actor.companyId} AND document_type_code = ${documentTypeCode} LIMIT 1`);
    if (configured.rows.length === 0) await this.sequences.update(actor, documentTypeCode, { prefix: "DCG", resetPeriod: "year", padding: 6 });
    await this.database.transaction(async (transaction) => {
      const changeNo = await this.sequences.next(actor.companyId, documentTypeCode, transaction);
      let requestId: string | null = null;
      try {
        requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
          documentTypeCode,
          documentId: id,
          documentNo: changeNo,
          amount: "0",
          currency: row.currency,
          documentDate: today,
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
      const status = requestId ? "pending" : "approved";
      const updated = await transaction.execute(sql`
        UPDATE catalog.price_changes SET status = ${status}, change_no = ${changeNo}, approval_request_id = ${requestId}, submitted_at = now(),
          completed_at = ${requestId ? null : sql`now()`}, updated_at = now(), version = version + 1
        WHERE id = ${id} AND status = 'draft' AND version = ${row.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!requestId) await this.applyPrices(transaction, id);
      await this.auditService.record({ ...catalogAudit(actor, "price_change"), action: "price_change.submit", entityId: id, afterData: { changeNo, status } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Rút ở luồng duyệt; trạng thái phiếu đổi ngay, sự kiện hoàn tất của luồng duyệt không đổi lại lần nữa.
  async withdraw(actor: Actor, id: string): Promise<PriceChangeResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    const row = await this.single(actor.companyId, id);
    if (row.requested_by !== actor.userId || !row.approval_request_id) throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.execute(sql`UPDATE catalog.price_changes SET status = 'withdrawn', completed_at = now(), updated_at = now() WHERE id = ${id} AND status = 'pending'`);
    return this.detail(actor, id);
  }

  // Đọc tệp Excel ba cột Mã hàng, Mã đơn vị, Giá; dòng lỗi trả kèm lý do, không lưu gì.
  async importLines(actor: Actor, priceListId: string | undefined, file: { buffer: Buffer; size: number } | undefined, locale: Locale): Promise<PriceChangeImportResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > productImportMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooLarge" } });
    let sheet: unknown[][];
    try {
      sheet = (await readSheet(file.buffer)) as unknown[][];
    } catch {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    }
    const text = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());
    if (priceChangeImportColumns.some((title, index) => text(sheet[0]?.[index]) !== title)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    const rows = sheet
      .slice(1)
      .map((row, index) => ({ number: index + 2, sku: text(row[0]).toUpperCase(), unitCode: text(row[1]).toUpperCase(), price: text(row[2]).replace(",", ".") }))
      .filter((row) => row.sku || row.unitCode || row.price);
    if (rows.length > productImportMaximumRows) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooManyRows" } });
    const errorText = messages[locale].errors as Record<string, string>;
    const lines: PriceChangeLine[] = [];
    const errors: { row: number; message: string }[] = [];
    for (const row of rows) {
      const found = (
        await this.database.execute<{ variant_id: string; sku: string; product_name: string; option_values: string[]; unit_id: string | null; unit_name: string | null }>(sql`
        SELECT v.id AS variant_id, v.sku, p.name AS product_name, v.option_values, u.id AS unit_id, u.name_vi AS unit_name
        FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
        LEFT JOIN catalog.units u ON u.code = ${row.unitCode} AND (u.id = p.base_unit_id OR EXISTS (SELECT 1 FROM catalog.product_units pu WHERE pu.product_id = p.id AND pu.unit_id = u.id))
        WHERE v.company_id = ${actor.companyId} AND v.sku = ${row.sku} AND v.status = 'active'`)
      ).rows[0];
      if (!found) errors.push({ row: row.number, message: `${errorText.catalogCodeNotFound} (${priceChangeImportColumns[0]})` });
      else if (!found.unit_id) errors.push({ row: row.number, message: `${errorText.catalogCodeNotFound} (${priceChangeImportColumns[1]})` });
      else if (!/^\d{1,16}(\.\d{1,4})?$/.test(row.price)) errors.push({ row: row.number, message: `${errorText.invalidValue} (${priceChangeImportColumns[2]})` });
      else if (lines.some((line) => line.variantId === found.variant_id && line.unitId === found.unit_id)) errors.push({ row: row.number, message: errorText.priceLineDuplicate ?? "" });
      else {
        const current = priceListId ? await this.currentPrice(this.database, priceListId, found.variant_id, found.unit_id!, this.permissionService.today()) : null;
        lines.push({
          variantId: found.variant_id,
          sku: found.sku,
          productName: found.product_name,
          optionValues: found.option_values,
          unitId: found.unit_id,
          unitName: found.unit_name!,
          price: trimDecimal(row.price),
          currentPrice: current === null ? null : trimDecimal(current),
        });
      }
    }
    return { lines, errors };
  }

  private async validate(companyId: string, input: Input): Promise<void> {
    await this.requireActiveList(companyId, input.priceListId);
    const keys = input.lines.map((line) => `${line.variantId}:${line.unitId}`);
    const fields: Record<string, "priceLineDuplicate" | "invalidValue"> = {};
    keys.forEach((key, index) => {
      if (keys.indexOf(key) !== index) fields[`lines.${index}.unitId`] = "priceLineDuplicate";
    });
    // Biến thể thuộc công ty, đơn vị là đơn vị cơ sở hoặc đơn vị quy đổi của sản phẩm.
    const valid = await this.database.execute<{ key: string }>(sql`
      SELECT v.id || ':' || u.id AS key FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
      JOIN catalog.units u ON u.id = p.base_unit_id OR EXISTS (SELECT 1 FROM catalog.product_units pu WHERE pu.product_id = p.id AND pu.unit_id = u.id)
      WHERE v.company_id = ${companyId} AND v.id = ANY(${`{${input.lines.map((line) => line.variantId).join(",")}}`}::uuid[])`);
    const allowed = new Set(valid.rows.map((row) => row.key));
    keys.forEach((key, index) => {
      if (!allowed.has(key)) fields[`lines.${index}.variantId`] = "invalidValue";
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async requireActiveList(companyId: string, priceListId: string): Promise<void> {
    const list = await this.database.execute(sql`SELECT 1 FROM catalog.price_lists WHERE id = ${priceListId} AND company_id = ${companyId} AND status = 'active'`);
    if (list.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { priceListId: "invalidValue" } });
  }

  // Lưu kèm giá hiện hành tại ngày hiệu lực để người duyệt so sánh.
  private async writeLines(transaction: Executor, changeId: string, input: Input): Promise<void> {
    for (const line of input.lines) {
      const current = await this.currentPrice(transaction, input.priceListId, line.variantId, line.unitId, input.effectiveFrom);
      await transaction.execute(sql`
        INSERT INTO catalog.price_change_lines (price_change_id, variant_id, unit_id, price, current_price)
        VALUES (${changeId}, ${line.variantId}, ${line.unitId}, ${line.price}::numeric, ${current}::numeric)`);
    }
  }

  private async currentPrice(executor: Executor, priceListId: string, variantId: string, unitId: string, date: string): Promise<string | null> {
    const row = (
      await executor.execute<{ price: string }>(sql`
      SELECT price::text AS price FROM catalog.prices WHERE price_list_id = ${priceListId} AND variant_id = ${variantId} AND unit_id = ${unitId} AND effective_from <= ${date}::date
      ORDER BY effective_from DESC, created_at DESC LIMIT 1`)
    ).rows[0];
    return row?.price ?? null;
  }

  // Ghi giá vào lịch sử. Duyệt muộn hơn ngày hiệu lực thì hiệu lực từ ngày duyệt, để không đổi giá của những ngày đã qua.
  private async applyPrices(transaction: Executor, changeId: string): Promise<void> {
    await transaction.execute(sql`
      INSERT INTO catalog.prices (price_list_id, variant_id, unit_id, price, effective_from, price_change_id)
      SELECT c.price_list_id, l.variant_id, l.unit_id, l.price, greatest(c.effective_from, ${this.permissionService.today()}::date), c.id
      FROM catalog.price_change_lines l JOIN catalog.price_changes c ON c.id = l.price_change_id WHERE c.id = ${changeId}`);
  }

  private async requireOwnDraft(actor: Actor, id: string): Promise<ChangeRow> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    const row = await this.single(actor.companyId, id);
    if (row.requested_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    return row;
  }

  private async single(companyId: string, id: string): Promise<ChangeRow> {
    const row = (await this.database.execute<ChangeRow>(sql`${this.select()} WHERE c.id = ${id} AND c.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private toItem(row: ChangeRow): PriceChangeListItem {
    return {
      id: row.id,
      changeNo: row.change_no,
      priceListId: row.price_list_id,
      priceListName: row.price_list_name,
      effectiveFrom: day(row.effective_from),
      lineCount: row.line_count,
      status: row.status,
      requestedByName: row.requested_by_name,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private select() {
    return sql`
      SELECT c.id, c.change_no, c.price_list_id, l.name AS price_list_name, l.currency, c.effective_from, c.note, c.status, c.approval_request_id, c.requested_by,
        u.full_name AS requested_by_name, (SELECT count(*)::int FROM catalog.price_change_lines x WHERE x.price_change_id = c.id) AS line_count, c.created_at, c.version
      FROM catalog.price_changes c JOIN catalog.price_lists l ON l.id = c.price_list_id JOIN core.users u ON u.id = c.requested_by`;
  }
}
