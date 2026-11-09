// Mẫu đề xuất (CHUC_NANG_27; QUYTAC_NGHIEPVU_33; API_50). Mỗi mẫu là một loại chứng từ cần duyệt của công ty,
// có dãy số riêng (tiền tố là mã mẫu) và chính sách duyệt cấu hình ở MAN_HINH_15.
import { Inject, Injectable } from "@nestjs/common";
import type { ProposalField, ProposalTemplateResponse, createProposalTemplateSchema, updateProposalTemplateSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { auditBase } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const manageTemplates = "platform.proposal_template.manage";

type TemplateRow = {
  id: string;
  code: string;
  name: string;
  name_en: string;
  description: string | null;
  document_type_code: string;
  currency: string;
  fields: ProposalField[];
  amount_field: string | null;
  status: "active" | "inactive";
  version: number;
  has_policy: boolean;
};

const toResponse = (row: TemplateRow): ProposalTemplateResponse => ({
  id: row.id,
  code: row.code,
  name: row.name,
  nameEn: row.name_en,
  description: row.description,
  documentTypeCode: row.document_type_code,
  currency: row.currency,
  fields: row.fields,
  amountField: row.amount_field,
  status: row.status,
  version: row.version,
  hasPolicy: row.has_policy,
});

// Ba mẫu có sẵn theo yêu cầu người dùng (2026-11-09).
const defaultTemplates: z.input<typeof createProposalTemplateSchema>[] = [
  {
    code: "PC",
    name: "Phiếu đề nghị chi",
    nameEn: "Payment request",
    amountField: "amount",
    fields: [
      { key: "recipient", label: "Người nhận tiền", type: "text", required: true },
      { key: "reason", label: "Nội dung chi", type: "textarea", required: true },
      { key: "amount", label: "Số tiền", type: "money", required: true },
      { key: "payment_method", label: "Hình thức chi", type: "select", required: true, options: ["Tiền mặt", "Chuyển khoản"] },
      { key: "bank_account", label: "Số tài khoản, ngân hàng nhận", type: "text" },
      { key: "due_date", label: "Ngày cần chi", type: "date" },
    ],
  },
  {
    code: "TU",
    name: "Đề nghị tạm ứng",
    nameEn: "Advance request",
    amountField: "amount",
    fields: [
      { key: "reason", label: "Lý do tạm ứng", type: "textarea", required: true },
      { key: "amount", label: "Số tiền tạm ứng", type: "money", required: true },
      { key: "repayment_date", label: "Ngày hoàn ứng", type: "date", required: true },
    ],
  },
  {
    code: "MS",
    name: "Đề nghị mua sắm",
    nameEn: "Purchase request",
    amountField: null,
    fields: [
      { key: "purpose", label: "Mục đích mua", type: "textarea", required: true },
      {
        key: "items",
        label: "Hàng hóa, dịch vụ cần mua",
        type: "lines",
        required: true,
        columns: [
          { key: "name", label: "Tên hàng", type: "text" },
          { key: "quantity", label: "Số lượng", type: "number" },
          { key: "unit", label: "Đơn vị", type: "text" },
          { key: "amount", label: "Thành tiền", type: "money" },
        ],
      },
      { key: "supplier", label: "Nhà cung cấp đề xuất", type: "text" },
      { key: "needed_date", label: "Ngày cần hàng", type: "date" },
    ],
  },
];

@Injectable()
export class ProposalTemplatesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async canManage(actor: Actor): Promise<boolean> {
    return (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(manageTemplates);
  }

  async requireManager(actor: Actor): Promise<void> {
    if (!(await this.canManage(actor))) throw new ApiError("FORBIDDEN", "forbidden");
  }

  // Người lập đề xuất chỉ thấy mẫu đang dùng; quản lý mẫu thấy cả mẫu ngừng dùng.
  async list(actor: Actor, includeInactive: boolean): Promise<ProposalTemplateResponse[]> {
    const rows = await this.database.execute<TemplateRow>(sql`
      ${this.select(actor.companyId)} WHERE p.company_id = ${actor.companyId} ${includeInactive ? sql`` : sql`AND p.status = 'active'`} ORDER BY p.code`);
    return rows.rows.map(toResponse);
  }

  async get(companyId: string, id: string): Promise<ProposalTemplateResponse> {
    const row = (await this.database.execute<TemplateRow>(sql`${this.select(companyId)} WHERE p.id = ${id} AND p.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }

  async create(actor: Actor, input: z.output<typeof createProposalTemplateSchema>): Promise<ProposalTemplateResponse> {
    await this.requireManager(actor);
    this.validateFields(input.fields, input.amountField ?? null);
    if ((await this.database.execute(sql`SELECT 1 FROM core.proposal_templates WHERE company_id = ${actor.companyId} AND code = ${input.code}`)).rows.length > 0) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "templateCodeExists" } });
    }
    await this.requireActiveCurrency(input.currency);
    const companyCode = (await this.database.execute<{ code: string }>(sql`SELECT code FROM core.companies WHERE id = ${actor.companyId}`)).rows[0]!.code;
    const documentTypeCode = `platform.proposal_${companyCode.toLowerCase()}_${input.code.toLowerCase()}`;
    const id = await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        INSERT INTO core.document_types (code, app_code, name_vi, name_en, requires_approval) VALUES (${documentTypeCode}, 'platform', ${input.name}, ${input.nameEn || input.name}, true)`);
      // Dãy số mặc định: tiền tố là mã mẫu, đặt lại theo năm, 6 chữ số; đổi được ở MAN_HINH_16.
      await transaction.execute(sql`
        INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
        VALUES (${actor.companyId}, ${documentTypeCode}, ${this.permissionService.today().slice(0, 4)}, ${input.code}, 'year', 6, 1) ON CONFLICT DO NOTHING`);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO core.proposal_templates (company_id, code, name, description, document_type_code, fields, amount_field, currency, created_by, updated_by)
        VALUES (${actor.companyId}, ${input.code}, ${input.name}, ${input.description ?? null}, ${documentTypeCode}, ${JSON.stringify(input.fields)}::jsonb, ${input.amountField ?? null}, ${input.currency}, ${actor.userId}, ${actor.userId})
        RETURNING id`);
      const templateId = inserted.rows[0]!.id;
      await this.auditService.record({ ...auditBase(actor, "proposal_template"), action: "proposal_template.create", entityId: templateId, afterData: input }, transaction);
      return templateId;
    });
    return this.get(actor.companyId, id);
  }

  // Sửa mẫu không đổi đề xuất đã lập vì đề xuất giữ bản chụp mẫu (QUYTAC_NGHIEPVU_33).
  async update(actor: Actor, id: string, input: z.output<typeof updateProposalTemplateSchema>): Promise<ProposalTemplateResponse> {
    await this.requireManager(actor);
    const before = await this.get(actor.companyId, id);
    this.validateFields(input.fields, input.amountField ?? null);
    await this.requireActiveCurrency(input.currency);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.proposal_templates SET name = ${input.name}, description = ${input.description ?? null}, fields = ${JSON.stringify(input.fields)}::jsonb,
          amount_field = ${input.amountField ?? null}, currency = ${input.currency}, status = ${input.status}, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`UPDATE core.document_types SET name_vi = ${input.name}, name_en = ${input.nameEn || input.name} WHERE code = ${before.documentTypeCode}`);
      await this.auditService.record({ ...auditBase(actor, "proposal_template"), action: "proposal_template.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.get(actor.companyId, id);
  }

  // Tạo ba mẫu có sẵn (phiếu chi, tạm ứng, mua sắm) nếu công ty chưa có mẫu cùng mã.
  async createDefaults(actor: Actor): Promise<ProposalTemplateResponse[]> {
    await this.requireManager(actor);
    for (const template of defaultTemplates) {
      const exists = await this.database.execute(sql`SELECT 1 FROM core.proposal_templates WHERE company_id = ${actor.companyId} AND code = ${template.code}`);
      if (exists.rows.length === 0)
        await this.create(actor, { ...template, currency: "VND", description: null, fields: template.fields.map((field) => ({ ...field, required: field.required ?? false })) } as z.output<
          typeof createProposalTemplateSchema
        >);
    }
    return this.list(actor, true);
  }

  private async requireActiveCurrency(currency: string): Promise<void> {
    if ((await this.database.execute(sql`SELECT 1 FROM core.currencies WHERE code = ${currency} AND is_active`)).rows.length === 0) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { currency: "invalidValue" } });
    }
  }

  private validateFields(fields: ProposalField[], amountField: string | null): void {
    const errors: Record<string, "templateFieldDuplicate" | "templateOptionsRequired" | "templateColumnsRequired" | "templateAmountFieldInvalid"> = {};
    const keys = new Set<string>();
    fields.forEach((field, index) => {
      if (keys.has(field.key)) errors[`fields.${index}.key`] = "templateFieldDuplicate";
      keys.add(field.key);
      if (field.type === "select" && !field.options?.length) errors[`fields.${index}.options`] = "templateOptionsRequired";
      if (field.type === "lines" && !field.columns?.some((column) => column.key === "amount" && column.type === "money")) errors[`fields.${index}.columns`] = "templateColumnsRequired";
    });
    // Giá trị duyệt: một trường tiền, hoặc tổng thành tiền của bảng chi tiết.
    if (amountField ? fields.find((field) => field.key === amountField)?.type !== "money" : !fields.some((field) => field.type === "lines")) errors.amountField = "templateAmountFieldInvalid";
    if (Object.keys(errors).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: errors });
  }

  private select(companyId: string) {
    return sql`
      SELECT p.id, p.code, p.name, t.name_en, p.description, p.document_type_code, p.currency, p.fields, p.amount_field, p.status, p.version,
        EXISTS (SELECT 1 FROM core.approval_policies a WHERE a.company_id = ${companyId} AND a.document_type_code = p.document_type_code
          AND a.effective_from <= current_date AND (a.effective_to IS NULL OR a.effective_to >= current_date)) AS has_policy
      FROM core.proposal_templates p JOIN core.document_types t ON t.code = p.document_type_code`;
  }
}
