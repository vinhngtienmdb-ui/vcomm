// Đề xuất (CHUC_NANG_28; QUYTAC_NGHIEPVU_33 đến 36; API_51, API_52).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  attachmentExtensions,
  attachmentMaximumBytes,
  attachmentMaximumCount,
  type AttachmentResponse,
  type PageResponse,
  type ProposalField,
  type ProposalListItem,
  type ProposalResponse,
  type ProposalStatus,
  type proposalListQuerySchema,
  type saveProposalSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { auditBase } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { ProposalTemplatesService } from "./proposal-templates.service";

type FieldError = "required" | "invalidValue";
type ProposalRow = {
  id: string;
  company_id: string;
  template_id: string;
  template_snapshot: { name: string; fields: ProposalField[]; amountField: string | null; currency: string; minorUnits: number; documentTypeCode: string };
  proposal_no: string | null;
  title: string;
  field_values: Record<string, unknown>;
  amount: string;
  currency: string;
  status: ProposalStatus;
  approval_request_id: string | null;
  requested_by: string;
  requested_by_name: string;
  template_name: string;
  created_at: Date;
  submitted_at: Date | null;
  version: number;
};

const decimal = /^\d{1,16}(\.\d{1,4})?$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

// Số tiền, số lượng nhận chuỗi số thập phân; giữ dạng chuỗi để không sai số. Tiền không có nhiều chữ số lẻ hơn tiền tệ cho phép (VND: 0).
const toDecimal = (value: unknown, maximumFraction = 4): string | null => {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return decimal.test(text) && (text.split(".")[1]?.length ?? 0) <= maximumFraction ? text : null;
};

// Cộng số thập phân dạng chuỗi bằng BigInt với 4 chữ số lẻ.
const sumDecimals = (values: string[]) => {
  const total = values.reduce((sum, value) => {
    const [whole = "0", fraction = ""] = value.split(".");
    return sum + BigInt(whole + fraction.padEnd(4, "0"));
  }, 0n);
  const text = total.toString().padStart(5, "0");
  return `${text.slice(0, -4)}.${text.slice(-4)}`;
};

// Loại tệp theo phần mở rộng và chữ ký đầu tệp (QUYTAC_NGHIEPVU_35).
const contentTypes: Record<(typeof attachmentExtensions)[number], { type: string; signature: number[] }> = {
  pdf: { type: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  jpg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  jpeg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  png: { type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
  xlsx: { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", signature: [0x50, 0x4b, 0x03, 0x04] },
  docx: { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: [0x50, 0x4b, 0x03, 0x04] },
};

@Injectable()
export class ProposalsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly templates: ProposalTemplatesService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  // Duyệt xong, từ chối hoặc rút ở luồng duyệt thì cập nhật đề xuất tương ứng.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.execute(sql`
        UPDATE core.proposals SET status = ${status}, completed_at = now(), updated_at = now()
        WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`);
    });
  }

  async list(actor: Actor, query: z.output<typeof proposalListQuerySchema>): Promise<PageResponse<ProposalListItem>> {
    if (query.scope === "company") await this.templates.requireManager(actor);
    const conditions = [sql`p.company_id = ${actor.companyId}`];
    if (query.scope === "mine") conditions.push(sql`p.requested_by = ${actor.userId}`);
    if (query.status) conditions.push(sql`${this.statusColumn()} = ${query.status}`);
    const where = sql.join(conditions, sql` AND `);
    const total = await this.database.execute<{ total: number }>(
      sql`SELECT count(*)::int AS total FROM core.proposals p LEFT JOIN core.approval_requests q ON q.id = p.approval_request_id WHERE ${where}`,
    );
    const rows = await this.database.execute<ProposalRow>(sql`${this.select()} WHERE ${where} ORDER BY p.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.toItem(row)), page: query.page, pageSize: query.pageSize, total: total.rows[0]?.total ?? 0 };
  }

  async detail(actor: Actor, id: string): Promise<ProposalResponse> {
    const row = await this.requireVisible(actor, id);
    const attachments = await this.database.execute<{ id: string; file_name: string; content_type: string; size_bytes: number; created_at: Date }>(sql`
      SELECT id, file_name, content_type, size_bytes, created_at FROM core.attachments WHERE owner_type = 'proposal' AND owner_id = ${id} ORDER BY created_at`);
    const own = row.requested_by === actor.userId;
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    return {
      ...this.toItem(row),
      templateId: row.template_id,
      template: { name: row.template_snapshot.name, fields: row.template_snapshot.fields, amountField: row.template_snapshot.amountField },
      values: row.field_values,
      approvalRequestId: row.approval_request_id,
      attachments: attachments.rows.map((item) => ({
        id: item.id,
        fileName: item.file_name,
        contentType: item.content_type,
        sizeBytes: item.size_bytes,
        createdAt: new Date(item.created_at).toISOString(),
      })),
      version: row.version,
      canEdit: own && row.status === "draft",
      canWithdraw: own && this.toItem(row).status === "pending" && !firstStepDecided,
    };
  }

  // Lập nháp: kiểm tra kiểu giá trị; trường bắt buộc kiểm khi gửi.
  async create(actor: Actor, input: z.output<typeof saveProposalSchema>): Promise<ProposalResponse> {
    const template = await this.templates.get(actor.companyId, input.templateId);
    if (template.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { templateId: "invalidValue" } });
    const minorUnits = (await this.database.execute<{ minor_units: number }>(sql`SELECT minor_units FROM core.currencies WHERE code = ${template.currency}`)).rows[0]?.minor_units ?? 2;
    const snapshot = { name: template.name, fields: template.fields, amountField: template.amountField, currency: template.currency, minorUnits, documentTypeCode: template.documentTypeCode };
    const values = this.validate(snapshot, input.values, false);
    const id = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO core.proposals (company_id, template_id, template_snapshot, document_type_code, title, field_values, amount, currency, requested_by)
        VALUES (${actor.companyId}, ${template.id}, ${JSON.stringify(snapshot)}::jsonb, ${template.documentTypeCode}, ${input.title}, ${JSON.stringify(values)}::jsonb,
          ${this.amountOf(snapshot, values)}::numeric, ${template.currency}, ${actor.userId}) RETURNING id`);
      const proposalId = inserted.rows[0]!.id;
      await this.auditService.record({ ...auditBase(actor, "proposal"), action: "proposal.create", entityId: proposalId, afterData: { title: input.title, values } }, transaction);
      return proposalId;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: z.output<typeof saveProposalSchema>): Promise<ProposalResponse> {
    const row = await this.requireOwnDraft(actor, id);
    const values = this.validate(row.template_snapshot, input.values, false);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.proposals SET title = ${input.title}, field_values = ${JSON.stringify(values)}::jsonb, amount = ${this.amountOf(row.template_snapshot, values)}::numeric,
          version = version + 1, updated_at = now()
        WHERE id = ${id} AND status = 'draft' AND version = ${input.version ?? row.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        { ...auditBase(actor, "proposal"), action: "proposal.update", entityId: id, beforeData: { title: row.title, values: row.field_values }, afterData: { title: input.title, values } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const row = await this.requireOwnDraft(actor, id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM core.attachments WHERE owner_type = 'proposal' AND owner_id = ${id}`);
      await transaction.execute(sql`DELETE FROM core.proposals WHERE id = ${id} AND status = 'draft'`);
      await this.auditService.record({ ...auditBase(actor, "proposal"), action: "proposal.delete", entityId: id, beforeData: { title: row.title, values: row.field_values } }, transaction);
    });
  }

  // Gửi: kiểm đủ trường bắt buộc, cấp số và gửi duyệt trong cùng giao dịch; lỗi thì số không bị dùng (QUYTAC_NGHIEPVU_28, 34).
  async submit(actor: Actor, id: string): Promise<ProposalResponse> {
    const row = await this.requireOwnDraft(actor, id);
    const values = this.validate(row.template_snapshot, row.field_values, true);
    const amount = this.amountOf(row.template_snapshot, values);
    await this.database.transaction(async (transaction) => {
      const proposalNo = await this.sequences.next(actor.companyId, row.template_snapshot.documentTypeCode, transaction);
      const requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
        documentTypeCode: row.template_snapshot.documentTypeCode,
        documentId: id,
        documentNo: proposalNo,
        amount,
        currency: row.currency,
        documentDate: this.permissionService.today(),
      });
      const updated = await transaction.execute(sql`
        UPDATE core.proposals SET status = 'pending', proposal_no = ${proposalNo}, amount = ${amount}::numeric, approval_request_id = ${requestId},
          submitted_at = now(), updated_at = now(), version = version + 1
        WHERE id = ${id} AND status = 'draft' AND version = ${row.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...auditBase(actor, "proposal"), action: "proposal.submit", entityId: id, afterData: { proposalNo, amount } }, transaction);
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<ProposalResponse> {
    const row = await this.requireVisible(actor, id);
    if (row.requested_by !== actor.userId || !row.approval_request_id) throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.execute(sql`UPDATE core.proposals SET status = 'withdrawn', completed_at = now(), updated_at = now() WHERE id = ${id} AND status = 'pending'`);
    return this.detail(actor, id);
  }

  async addAttachment(actor: Actor, id: string, file: { buffer: Buffer; size: number; originalname: string } | undefined): Promise<AttachmentResponse> {
    await this.requireOwnDraft(actor, id);
    if (!file || file.size === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > attachmentMaximumBytes) throw new ApiError("VALIDATION_FAILED", "fileTooLarge", { fields: { file: "attachmentTooLarge" } });
    const extension = file.originalname.split(".").pop()?.toLowerCase() as (typeof attachmentExtensions)[number] | undefined;
    const kind = extension && (attachmentExtensions as readonly string[]).includes(extension) ? contentTypes[extension] : null;
    if (!kind || !kind.signature.every((byte, index) => file.buffer[index] === byte)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "attachmentTypeInvalid" } });
    const count = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM core.attachments WHERE owner_type = 'proposal' AND owner_id = ${id}`)).rows[0]!.total;
    if (count >= attachmentMaximumCount) throw new ApiError("BUSINESS_RULE", "attachmentTooMany");
    // multer đọc tên tệp theo latin1; đổi lại UTF-8 để giữ tên tiếng Việt.
    const fileName = Buffer.from(file.originalname, "latin1")
      .toString("utf8")
      .replace(/[\\/\r\n"]/g, "_")
      .slice(-200);
    const storageKey = `proposals/${actor.companyId}/${id}/${randomUUID()}`;
    await this.storage.put(storageKey, file.buffer, kind.type);
    const inserted = await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ id: string; created_at: Date }>(sql`
        INSERT INTO core.attachments (company_id, owner_type, owner_id, file_name, content_type, size_bytes, storage_key, uploaded_by)
        VALUES (${actor.companyId}, 'proposal', ${id}, ${fileName}, ${kind.type}, ${file.size}, ${storageKey}, ${actor.userId}) RETURNING id, created_at`)
      ).rows[0]!;
      await this.auditService.record({ ...auditBase(actor, "proposal"), action: "proposal.attachment.add", entityId: id, afterData: { fileName, sizeBytes: file.size } }, transaction);
      return row;
    });
    return { id: inserted.id, fileName, contentType: kind.type, sizeBytes: file.size, createdAt: new Date(inserted.created_at).toISOString() };
  }

  async removeAttachment(actor: Actor, attachmentId: string): Promise<void> {
    const attachment = await this.attachment(attachmentId, actor.companyId);
    await this.requireOwnDraft(actor, attachment.owner_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM core.attachments WHERE id = ${attachmentId}`);
      await this.auditService.record(
        { ...auditBase(actor, "proposal"), action: "proposal.attachment.delete", entityId: attachment.owner_id, beforeData: { fileName: attachment.file_name } },
        transaction,
      );
    });
  }

  // Chỉ người xem được đề xuất mới tải được tệp (QUYTAC_NGHIEPVU_35, 36).
  async downloadAttachment(actor: Actor, attachmentId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const attachment = await this.attachment(attachmentId, actor.companyId);
    await this.requireVisible(actor, attachment.owner_id);
    return { fileName: attachment.file_name, contentType: attachment.content_type, content: await this.storage.get(attachment.storage_key) };
  }

  // QUYTAC_NGHIEPVU_36: người lập; người được giao duyệt hoặc đã duyệt; người quản lý mẫu đề xuất của công ty. Ngoài ra trả 404.
  async requireVisible(actor: Actor, id: string): Promise<ProposalRow> {
    const row = (await this.database.execute<ProposalRow>(sql`${this.select()} WHERE p.id = ${id} AND p.company_id = ${actor.companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.requested_by === actor.userId || (await this.templates.canManage(actor))) return row;
    if (row.approval_request_id) {
      try {
        await this.approvals.detail(actor.userId, row.approval_request_id);
        return row;
      } catch {
        // Không xem được yêu cầu duyệt thì không xem được đề xuất.
      }
    }
    throw new ApiError("NOT_FOUND", "notFound");
  }

  private async requireOwnDraft(actor: Actor, id: string): Promise<ProposalRow> {
    const row = await this.requireVisible(actor, id);
    if (row.requested_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "proposalNotDraft");
    return row;
  }

  private async attachment(id: string, companyId: string) {
    const row = (
      await this.database.execute<{ owner_id: string; file_name: string; content_type: string; storage_key: string }>(sql`
      SELECT owner_id, file_name, content_type, storage_key FROM core.attachments WHERE id = ${id} AND company_id = ${companyId} AND owner_type = 'proposal'`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Kiểm giá trị theo mẫu; trả bản đã chuẩn hóa (chỉ giữ trường có trong mẫu). Lỗi chỉ ra đúng trường (TIEUCHI_NGHIEMTHU_52).
  private validate(template: { fields: ProposalField[]; minorUnits: number }, raw: Record<string, unknown>, requireAll: boolean): Record<string, unknown> {
    const { fields, minorUnits } = template;
    const errors: Record<string, FieldError> = {};
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      const value = raw[field.key];
      const empty = value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);
      if (empty) {
        if (requireAll && field.required) errors[`values.${field.key}`] = "required";
        continue;
      }
      if (field.type === "lines") {
        if (!Array.isArray(value) || value.length > 100) {
          errors[`values.${field.key}`] = "invalidValue";
          continue;
        }
        values[field.key] = value.map((line: unknown, index) => {
          const source = (line ?? {}) as Record<string, unknown>;
          const cleaned: Record<string, string> = {};
          for (const column of field.columns ?? []) {
            const cell = source[column.key];
            if (cell === undefined || cell === null || cell === "") continue;
            const text = column.type === "text" ? (typeof cell === "string" ? cell.trim().slice(0, 500) : null) : toDecimal(cell, column.type === "money" ? minorUnits : 4);
            if (text === null) errors[`values.${field.key}.${index}.${column.key}`] = "invalidValue";
            else cleaned[column.key] = text;
          }
          if (requireAll && !cleaned.amount) errors[`values.${field.key}.${index}.amount`] = "required";
          return cleaned;
        });
        continue;
      }
      if (field.type === "number" || field.type === "money") {
        const number = toDecimal(value, field.type === "money" ? minorUnits : 4);
        if (number === null) errors[`values.${field.key}`] = "invalidValue";
        else values[field.key] = number;
      } else if (field.type === "date") {
        if (typeof value !== "string" || !isoDate.test(value) || Number.isNaN(Date.parse(value))) errors[`values.${field.key}`] = "invalidValue";
        else values[field.key] = value;
      } else if (field.type === "select") {
        if (typeof value !== "string" || !field.options?.includes(value)) errors[`values.${field.key}`] = "invalidValue";
        else values[field.key] = value;
      } else if (typeof value !== "string" || value.length > (field.type === "textarea" ? 5000 : 500)) {
        errors[`values.${field.key}`] = "invalidValue";
      } else {
        values[field.key] = value.trim();
      }
    }
    if (Object.keys(errors).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: errors });
    return values;
  }

  // Giá trị duyệt: trường tiền chỉ định, hoặc tổng thành tiền của các bảng chi tiết (QUYTAC_NGHIEPVU_33).
  private amountOf(template: { fields: ProposalField[]; amountField: string | null }, values: Record<string, unknown>): string {
    if (template.amountField) return toDecimal(values[template.amountField]) ?? "0";
    const amounts = template.fields.filter((field) => field.type === "lines").flatMap((field) => ((values[field.key] as Record<string, string>[] | undefined) ?? []).map((line) => line.amount ?? "0"));
    return sumDecimals(amounts);
  }

  // Trạng thái đọc theo yêu cầu duyệt khi bộ đẩy outbox chưa kịp cập nhật.
  private statusColumn() {
    return sql`CASE WHEN p.status = 'pending' AND q.status IN ('approved', 'rejected', 'withdrawn') THEN q.status ELSE p.status END`;
  }

  private select() {
    return sql`
      SELECT p.id, p.company_id, p.template_id, p.template_snapshot, p.proposal_no, p.title, p.field_values, p.amount::text AS amount, p.currency,
        ${this.statusColumn()} AS status, p.approval_request_id, p.requested_by, u.full_name AS requested_by_name, p.template_snapshot ->> 'name' AS template_name,
        p.created_at, p.submitted_at, p.version
      FROM core.proposals p JOIN core.users u ON u.id = p.requested_by LEFT JOIN core.approval_requests q ON q.id = p.approval_request_id`;
  }

  private toItem(row: ProposalRow): ProposalListItem {
    return {
      id: row.id,
      proposalNo: row.proposal_no,
      title: row.title,
      templateName: row.template_name,
      amount: row.amount.includes(".") ? row.amount.replace(/\.?0+$/, "") : row.amount,
      currency: row.currency,
      status: row.status,
      requestedByName: row.requested_by_name,
      createdAt: new Date(row.created_at).toISOString(),
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    };
  }
}
