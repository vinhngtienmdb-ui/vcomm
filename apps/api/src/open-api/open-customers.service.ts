// API khách hàng do đối tác tạo (CHUC_NANG_221; QUYTAC_NGHIEPVU_494; API_289 đến API_292).
// Phạm vi khách giống phạm vi mã đơn đối tác: mọi khóa cùng đối tác, khóa nội bộ chỉ khách của chính khóa.
import { Inject, Injectable } from "@nestjs/common";
import type { OpenCustomer, PageResponse, openCustomerListQuerySchema, openCustomerSchema, openCustomerUpdateSchema } from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { PartnersService, type OpenApiCustomerSource } from "../crm/partners.service";
import { DATABASE, type Database } from "../database/database.module";
import { orderScopeOf, type CallerContext, type OpenApiCaller } from "./api-key.guard";

type CustomerRow = {
  partner_id: string;
  code: string;
  kind: OpenCustomer["kind"];
  name: string;
  tax_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
  is_owner: boolean;
  personal_data_consent_at: Date | null;
};

const customerColumns = sql`p.id AS partner_id, p.code, p.kind, p.name, p.tax_code, p.address, p.phone, p.email, p.version, p.created_at, p.updated_at, l.is_owner, l.personal_data_consent_at`;

@Injectable()
export class OpenCustomersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly partners: PartnersService,
  ) {}

  async create(caller: OpenApiCaller, input: z.output<typeof openCustomerSchema>, context: CallerContext): Promise<{ created: boolean; customer: OpenCustomer }> {
    // Trường bắt buộc theo loại khách (khoản 2).
    const fields: Record<string, ErrorMessageKey> = {};
    if (input.kind === "individual") {
      if (!input.phone) fields.phone = "required";
      if (input.personalDataConsent !== true) fields.personalDataConsent = "required";
      if (input.taxCode) fields.taxCode = "invalidValue";
    } else {
      if (!input.taxCode) fields.taxCode = "required";
      if (!input.address) fields.address = "required";
      if (input.citizenId) fields.citizenId = "invalidValue";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const result = await this.partners.createFromOpenApi(this.sourceOf(caller, context), input);
    const row = (await this.database.execute<CustomerRow>(sql`SELECT ${customerColumns} ${this.from(caller)} AND p.id = ${result.partnerId}`)).rows[0]!;
    return { created: result.created, customer: this.toCustomer(row) };
  }

  async list(caller: OpenApiCaller, query: z.output<typeof openCustomerListQuerySchema>): Promise<PageResponse<OpenCustomer>> {
    const conditions: SQL[] = [sql`TRUE`];
    if (query.updatedSince) conditions.push(sql`p.updated_at >= ${query.updatedSince}::timestamptz`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${this.from(caller)} AND ${where}`)).rows[0]?.total ?? 0;
    const rows = await this.database.execute<CustomerRow>(sql`
      SELECT ${customerColumns} ${this.from(caller)} AND ${where} ORDER BY p.updated_at DESC, p.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.toCustomer(row)), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(caller: OpenApiCaller, code: string): Promise<OpenCustomer> {
    return this.toCustomer(await this.find(caller, code));
  }

  async update(caller: OpenApiCaller, code: string, input: z.output<typeof openCustomerUpdateSchema>, context: CallerContext): Promise<OpenCustomer> {
    const row = await this.find(caller, code);
    if (!row.is_owner) throw new ApiError("BUSINESS_RULE", "openApiCustomerNotManaged");
    // Không xóa trường bắt buộc theo loại khách (khoản 2).
    if (row.kind !== "individual" && input.address === null) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { address: "required" } });
    if (row.kind === "individual" && input.phone === null) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { phone: "required" } });
    await this.partners.updateFromOpenApi(this.sourceOf(caller, context), row.partner_id, input);
    return this.detail(caller, code);
  }

  // Khách dùng được cho đơn của khóa đối tác: trong phạm vi, hồ sơ và hồ sơ khách ở công ty đang hoạt động (khoản 6).
  async usableCustomerId(caller: OpenApiCaller, code: string): Promise<string | null> {
    const row = (
      await this.database.execute<{ id: string }>(sql`
      SELECT p.id ${this.from(caller)} AND p.code = ${code.toUpperCase()} AND p.status = 'active'
        AND EXISTS (SELECT 1 FROM crm.partner_profiles pp WHERE pp.company_id = l.company_id AND pp.partner_id = p.id AND pp.status = 'active' AND pp.is_customer)`)
    ).rows[0];
    return row?.id ?? null;
  }

  private from(caller: OpenApiCaller): SQL {
    return sql`FROM crm.open_api_customers l JOIN crm.partners p ON p.id = l.partner_id WHERE l.company_id = ${caller.companyId} AND l.scope_id = ${orderScopeOf(caller)}`;
  }

  private async find(caller: OpenApiCaller, code: string): Promise<CustomerRow> {
    const row = (await this.database.execute<CustomerRow>(sql`SELECT ${customerColumns} ${this.from(caller)} AND p.code = ${code.toUpperCase()}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private sourceOf(caller: OpenApiCaller, context: CallerContext): OpenApiCustomerSource {
    return {
      apiKeyId: caller.keyId,
      scopeId: orderScopeOf(caller),
      companyId: caller.companyId,
      customerGroupId: caller.kind === "partner" ? caller.customerGroupId : null,
      keyName: caller.keyName,
      keyPrefix: caller.keyPrefix,
      ...context,
    };
  }

  // Hồ sơ gắn do trùng: chỉ trả mã, loại; không trả số căn cước trong mọi trường hợp (khoản 4, 5).
  private toCustomer(row: CustomerRow): OpenCustomer {
    if (!row.is_owner) return { code: row.code, kind: row.kind, managedByPartner: false };
    return {
      code: row.code,
      kind: row.kind,
      managedByPartner: true,
      name: row.name,
      taxCode: row.tax_code,
      address: row.address,
      phone: row.phone,
      email: row.email,
      personalDataConsentAt: row.personal_data_consent_at ? new Date(row.personal_data_consent_at).toISOString() : null,
      version: row.version,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
