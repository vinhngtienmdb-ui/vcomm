// Đối tác dùng chung tập đoàn, hồ sơ đối tác của công ty (CHUC_NANG_46 đến 48; QUYTAC_NGHIEPVU_56 đến 60; API_71, API_72).
import { Inject, Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import type {
  PageResponse,
  partnerListQuerySchema,
  PartnerListItem,
  PartnerLookupResponse,
  PartnerProfileOptionsResponse,
  PartnerProfileResponse,
  PartnerResponse,
  PartnerSummaryResponse,
  openCustomerSchema,
  openCustomerUpdateSchema,
  savePartnerProfileSchema,
  savePartnerSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const crmPermissions = {
  view: "crm.partner.view",
  manage: "crm.partner.manage",
  viewIdentity: "crm.partner.identity.view",
  manageProfile: "crm.profile.manage",
  manageVisits: "crm.visit.manage",
} as const;

type PartnerInput = z.output<typeof savePartnerSchema>;
type PartnerRow = {
  id: string;
  code: string;
  kind: PartnerResponse["kind"];
  name: string;
  short_name: string | null;
  tax_code: string | null;
  citizen_id: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  company_id: string | null;
  created_via_api_key_id: string | null;
  status: "active" | "inactive";
  version: number;
  is_customer: boolean | null;
  is_supplier: boolean | null;
  owner_user_name: string | null;
};

const crmAudit = (actor: Actor) => ({
  actorUserId: actor.userId,
  companyId: actor.companyId,
  appCode: "crm",
  entityType: "partner",
  ip: actor.client.ip,
  userAgent: actor.client.userAgent,
  requestId: actor.client.requestId,
});
// Khóa API gửi khách (CONG_VIEC_66): phạm vi là đối tác của khóa hoặc chính khóa nội bộ; nhóm khách của đối tác (khóa nội bộ: không nhóm).
export interface OpenApiCustomerSource {
  apiKeyId: string;
  scopeId: string;
  companyId: string;
  customerGroupId: string | null;
  keyName: string;
  keyPrefix: string;
  ip: string | null;
  requestId: string | null;
}
const openApiAudit = (source: OpenApiCustomerSource) => ({
  actorUserId: null,
  companyId: source.companyId,
  appCode: "crm",
  entityType: "partner",
  ip: source.ip,
  requestId: source.requestId,
});
type Executor = Pick<Database, "execute">;

// Không đưa số Căn cước công dân vào nhật ký thao tác (QUYTAC_NGHIEPVU_59).
const withoutIdentity = (input: PartnerInput) => ({
  ...input,
  citizenId: input.citizenId ? `***${input.citizenId.slice(-3)}` : null,
});

@Injectable()
export class PartnersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Đồng bộ đối tác nội bộ khi khởi động; lỗi chỉ ghi log, lần đọc danh mục sau đồng bộ lại.
  async onApplicationBootstrap(): Promise<void> {
    await this.syncInternalPartners().catch((error: unknown) => this.logger.warn(`Chưa đồng bộ được đối tác nội bộ khi khởi động: ${String(error)}`));
  }

  // Mỗi công ty con đang hoạt động là một đối tác nội bộ; đối tác bên ngoài trùng mã số thuế được gắn với công ty (QUYTAC_NGHIEPVU_58).
  // Công ty con ngừng hoạt động thì đối tác nội bộ ngừng giao dịch.
  async syncInternalPartners(): Promise<void> {
    const stopped = await this.database.execute<{ id: string }>(sql`
      UPDATE crm.partners p SET status = 'inactive', version = p.version + 1, updated_at = now() FROM core.companies c
      WHERE p.company_id = c.id AND c.status <> 'active' AND p.status = 'active' RETURNING p.id`);
    for (const row of stopped.rows) {
      await this.auditService.record({
        actorUserId: null,
        appCode: "crm",
        entityType: "partner",
        action: "partner.sync",
        entityId: row.id,
        beforeData: { status: "active" },
        afterData: { status: "inactive" },
      });
    }
    const companies = await this.database.execute<{
      id: string;
      legal_name: string;
      short_name: string;
      tax_code: string | null;
      address: string | null;
    }>(sql`
      SELECT id, legal_name, short_name, tax_code, address FROM core.companies WHERE status = 'active' AND parent_id IS NOT NULL`);
    for (const company of companies.rows) {
      await this.syncCompany(company).catch((error: unknown) => {
        // Mã số thuế công ty con trùng đối tác bên ngoài khác: giữ đối tác nội bộ như cũ, không chặn danh sách.
        if (!isUniqueViolation(error)) throw error;
        this.logger.warn(`Không đồng bộ được đối tác nội bộ của công ty ${company.id}: mã số thuế trùng đối tác khác.`);
      });
    }
  }

  // Mỗi thay đổi do đồng bộ ghi nhật ký thao tác kèm dữ liệu trước, sau, người làm là hệ thống (QUYTAC_NGHIEPVU_57).
  private async syncCompany(company: { id: string; legal_name: string; short_name: string; tax_code: string | null; address: string | null }): Promise<void> {
    const after = {
      kind: "organization",
      name: company.legal_name,
      shortName: company.short_name,
      taxCode: company.tax_code,
      address: company.address,
      internalCompanyId: company.id,
      status: "active",
    };
    const search = searchText(company.legal_name, company.short_name, company.tax_code);
    const existing = (
      await this.database.execute<{
        id: string;
        kind: string;
        name: string;
        short_name: string | null;
        tax_code: string | null;
        citizen_id: string | null;
        address: string | null;
        company_id: string | null;
        status: string;
      }>(sql`
      SELECT id, kind, name, short_name, tax_code, citizen_id, address, company_id, status FROM crm.partners
      WHERE company_id = ${company.id} OR (${company.tax_code}::text IS NOT NULL AND tax_code = ${company.tax_code} AND company_id IS NULL)
      ORDER BY company_id NULLS LAST LIMIT 1`)
    ).rows[0];
    if (!existing) {
      await this.database.transaction(async (transaction) => {
        const created = await transaction.execute<{ id: string }>(sql`
          INSERT INTO crm.partners (kind, name, short_name, tax_code, address, company_id, search_text)
          VALUES ('organization', ${company.legal_name}, ${company.short_name}, ${company.tax_code}, ${company.address}, ${company.id}, ${search})
          ON CONFLICT DO NOTHING RETURNING id`);
        if (created.rows[0])
          await this.auditService.record({ actorUserId: null, appCode: "crm", entityType: "partner", action: "partner.sync", entityId: created.rows[0].id, afterData: after }, transaction);
      });
      return;
    }
    const unchanged =
      existing.company_id === company.id &&
      existing.kind === "organization" &&
      existing.name === company.legal_name &&
      existing.short_name === company.short_name &&
      existing.tax_code === company.tax_code &&
      existing.address === company.address &&
      existing.status === "active";
    if (unchanged) return;
    // Đối tác bên ngoài trùng mã số thuế công ty con được gắn thành đối tác nội bộ (QUYTAC_NGHIEPVU_58).
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        UPDATE crm.partners SET company_id = ${company.id}, kind = 'organization', citizen_id = NULL, name = ${company.legal_name}, short_name = ${company.short_name},
          tax_code = ${company.tax_code}, address = ${company.address}, search_text = ${search}, status = 'active', version = version + 1, updated_at = now()
        WHERE id = ${existing.id}`);
      const before = {
        kind: existing.kind,
        name: existing.name,
        shortName: existing.short_name,
        taxCode: existing.tax_code,
        citizenId: existing.citizen_id ? `***${existing.citizen_id.slice(-3)}` : null,
        address: existing.address,
        internalCompanyId: existing.company_id,
        status: existing.status,
      };
      await this.auditService.record({ actorUserId: null, appCode: "crm", entityType: "partner", action: "partner.sync", entityId: existing.id, beforeData: before, afterData: after }, transaction);
    });
  }

  async list(actor: Actor, query: z.output<typeof partnerListQuerySchema>): Promise<PageResponse<PartnerListItem>> {
    await this.require(actor, crmPermissions.view);
    await this.syncInternalPartners();
    const conditions: SQL[] = [sql`TRUE`];
    if (query.search) {
      const pattern = `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(p.search_text LIKE ${pattern} OR p.code = ${query.search.toUpperCase()} OR p.tax_code = ${query.search} OR p.phone = ${query.search})`);
    }
    if (query.kind) conditions.push(sql`p.kind = ${query.kind}`);
    if (query.status) conditions.push(sql`p.status = ${query.status}`);
    if (query.role === "customer") conditions.push(sql`pr.is_customer`);
    if (query.role === "supplier") conditions.push(sql`pr.is_supplier`);
    if (query.role === "internal") conditions.push(sql`p.company_id IS NOT NULL`);
    if (query.source === "open_api") conditions.push(sql`p.created_via_api_key_id IS NOT NULL`);
    if (query.source === "web") conditions.push(sql`p.created_via_api_key_id IS NULL`);
    const where = sql.join(conditions, sql` AND `);
    const from = sql`FROM crm.partners p LEFT JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${actor.companyId}
      LEFT JOIN core.users owner ON owner.id = pr.owner_user_id`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${from} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<PartnerRow>(sql`
      SELECT p.*, pr.is_customer, pr.is_supplier, owner.full_name AS owner_user_name ${from} WHERE ${where} ORDER BY p.status, p.name LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => this.toItem(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async detail(actor: Actor, id: string): Promise<PartnerResponse> {
    const granted = await this.require(actor, crmPermissions.view);
    await this.syncInternalPartners();
    const row = (
      await this.database.execute<PartnerRow>(sql`
      SELECT p.*, pr.is_customer, pr.is_supplier, owner.full_name AS owner_user_name
      FROM crm.partners p LEFT JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${actor.companyId} LEFT JOIN core.users owner ON owner.id = pr.owner_user_id
      WHERE p.id = ${id}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const contacts = await this.database.execute<{
      full_name: string;
      position: string | null;
      phone: string | null;
      email: string | null;
      is_primary: boolean;
    }>(sql`
      SELECT full_name, position, phone, email, is_primary FROM crm.partner_contacts WHERE partner_id = ${id} ORDER BY sort_order`);
    const accounts = await this.database.execute<{
      bank_name: string;
      account_no: string;
      account_holder: string;
      branch: string | null;
      is_default: boolean;
    }>(sql`
      SELECT bank_name, account_no, account_holder, branch, is_default FROM crm.partner_bank_accounts WHERE partner_id = ${id} ORDER BY sort_order`);
    return {
      ...this.toItem(row),
      address: row.address,
      email: row.email,
      contacts: contacts.rows.map((item) => ({
        fullName: item.full_name,
        position: item.position,
        phone: item.phone,
        email: item.email,
        isPrimary: item.is_primary,
      })),
      bankAccounts: accounts.rows.map((item) => ({
        bankName: item.bank_name,
        accountNo: item.account_no,
        accountHolder: item.account_holder,
        branch: item.branch,
        isDefault: item.is_default,
      })),
      profile: await this.profile(actor.companyId, id, granted.has(crmPermissions.manageProfile)),
      version: row.version,
      canManage: granted.has(crmPermissions.manage) && row.company_id === null,
      canViewIdentity: granted.has(crmPermissions.viewIdentity) && row.citizen_id !== null,
      canManageProfile: granted.has(crmPermissions.manageProfile),
      openApi: await this.openApiSources(actor.companyId, id),
    };
  }

  // Kiểm trùng khi gõ mã số thuế, số Căn cước công dân (TIEUCHI_NGHIEMTHU_75).
  async lookup(actor: Actor, taxCode: string | undefined, citizenId: string | undefined): Promise<PartnerLookupResponse> {
    const granted = await this.require(actor, crmPermissions.view);
    // Tra theo số Căn cước công dân chỉ dành cho người thêm, sửa đối tác, tránh dò tìm danh tính (QUYTAC_NGHIEPVU_59).
    if (citizenId && !granted.has(crmPermissions.manage)) throw new ApiError("FORBIDDEN", "forbidden");
    if (!taxCode && !citizenId) return { partner: null };
    await this.syncInternalPartners();
    const row = (
      await this.database.execute<{
        id: string;
        code: string;
        name: string;
      }>(sql`
      SELECT id, code, name FROM crm.partners WHERE (${taxCode ?? null}::text IS NOT NULL AND tax_code = ${taxCode ?? null}) OR (${citizenId ?? null}::text IS NOT NULL AND citizen_id = ${citizenId ?? null}) LIMIT 1`)
    ).rows[0];
    return { partner: row ?? null };
  }

  // Tóm tắt khách: liên hệ, công nợ phải thu, đơn gần đây (API_113; QUYTAC_NGHIEPVU_137).
  async summary(actor: Actor, id: string): Promise<PartnerSummaryResponse> {
    await this.require(actor, crmPermissions.view);
    const row = (
      await this.database.execute<{
        id: string;
        code: string;
        name: string;
        phone: string | null;
        email: string | null;
        address: string | null;
        payment_term_days: number | null;
        currency: string;
      }>(sql`
      SELECT p.id, p.code, p.name, p.phone, p.email, p.address, pr.payment_term_days, c.base_currency AS currency
      FROM crm.partners p JOIN core.companies c ON c.id = ${actor.companyId} LEFT JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = c.id
      WHERE p.id = ${id}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const contacts = await this.database.execute<{ full_name: string; position: string | null; phone: string | null; is_primary: boolean }>(sql`
      SELECT full_name, position, phone, is_primary FROM crm.partner_contacts WHERE partner_id = ${id} ORDER BY is_primary DESC, sort_order`);
    const debt = (
      await this.database.execute<{ receivable: string; overdue: string }>(sql`
      SELECT coalesce(sum(CASE WHEN direction = 'debit' THEN open_amount ELSE -open_amount END), 0)::text AS receivable,
        coalesce(sum(CASE WHEN direction = 'debit' AND due_date < ${this.permissionService.today()}::date THEN open_amount ELSE 0 END), 0)::text AS overdue
      FROM finance.debt_items WHERE company_id = ${actor.companyId} AND side = 'receivable' AND partner_id = ${id} AND open_amount > 0`)
    ).rows[0]!;
    // Đơn gần đây: người có quyền xem đối tác xem mọi đơn bán của công ty (QUYTAC_NGHIEPVU_279).
    const orders = await this.database.execute<{ id: string; document_no: string | null; order_date: string; status: string; total_amount: string }>(sql`
      SELECT o.id, o.document_no, o.order_date::text, o.status, o.total_amount::text FROM sales.orders o
      WHERE o.company_id = ${actor.companyId} AND o.customer_id = ${id} ORDER BY o.order_date DESC, o.created_at DESC LIMIT 10`);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      contacts: contacts.rows.map((item) => ({ fullName: item.full_name, position: item.position, phone: item.phone, isPrimary: item.is_primary })),
      paymentTermDays: row.payment_term_days,
      currency: row.currency,
      receivable: trimDecimal(debt.receivable),
      overdue: trimDecimal(debt.overdue),
      recentOrders: orders.rows.map((order) => ({ id: order.id, documentNo: order.document_no, orderDate: order.order_date, status: order.status, totalAmount: trimDecimal(order.total_amount) })),
    };
  }

  async create(actor: Actor, input: PartnerInput): Promise<PartnerResponse> {
    const granted = await this.require(actor, crmPermissions.manage);
    await this.validate(input, null);
    // Nhân viên ghi ghé thăm nhưng không quản lý hồ sơ (nhân viên bán hàng trên ứng dụng): thêm đối tác thì tự có hồ sơ khách hàng mặc định tại công ty,
    // thanh toán ngay, hạn mức 0, để ghi ghé thăm được ngay; không gán người phụ trách vì không còn giao khách (QUYTAC_NGHIEPVU_135, 279; CONG_VIEC_43, lát L4).
    const createsCustomerProfile = granted.has(crmPermissions.manageVisits) && !granted.has(crmPermissions.manageProfile);
    const id = await this.database
      .transaction(async (transaction) => {
        const partnerId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO crm.partners (kind, name, short_name, tax_code, citizen_id, address, phone, email, search_text, created_by, updated_by)
          VALUES (${input.kind}, ${input.name}, ${input.shortName}, ${input.taxCode}, ${input.citizenId}, ${input.address}, ${input.phone}, ${input.email},
            ${this.search(input)}, ${actor.userId}, ${actor.userId}) RETURNING id`)
        ).rows[0]!.id;
        await this.writeChildren(transaction, partnerId, input);
        if (createsCustomerProfile) {
          await transaction.execute(sql`
            INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier, payment_term_days, credit_limit, status, updated_by)
            VALUES (${actor.companyId}, ${partnerId}, true, false, 0, 0, 'active', ${actor.userId})`);
        }
        await this.auditService.record(
          {
            ...crmAudit(actor),
            action: "partner.create",
            entityId: partnerId,
            afterData: withoutIdentity(input),
          },
          transaction,
        );
        return partnerId;
      })
      .catch((error: unknown) => this.duplicateError(error));
    return this.detail(actor, id);
  }

  // Thông tin chung sửa được từ mọi công ty có quyền; đối tác nội bộ chỉ sửa ở màn hình công ty (QUYTAC_NGHIEPVU_57, 58).
  // Cá nhân: để trống số Căn cước công dân khi sửa là giữ số đã lưu, người sửa không cần xem số đầy đủ.
  async update(actor: Actor, id: string, submitted: PartnerInput): Promise<PartnerResponse> {
    await this.require(actor, crmPermissions.manage);
    const before = await this.detail(actor, id);
    if (before.internalCompanyId) throw new ApiError("BUSINESS_RULE", "partnerInternalLocked");
    const stored = (await this.database.execute<{ citizen_id: string | null }>(sql`SELECT citizen_id FROM crm.partners WHERE id = ${id}`)).rows[0]!.citizen_id;
    const input = submitted.kind === "individual" && !submitted.citizenId ? { ...submitted, citizenId: stored } : submitted;
    await this.validate(input, id);
    await this.database
      .transaction(async (transaction) => {
        const updated = await transaction.execute(sql`
          UPDATE crm.partners SET kind = ${input.kind}, name = ${input.name}, short_name = ${input.shortName}, tax_code = ${input.taxCode}, citizen_id = ${input.citizenId},
            address = ${input.address}, phone = ${input.phone}, email = ${input.email}, search_text = ${this.search(input)}, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
          WHERE id = ${id} AND version = ${input.version ?? 0} RETURNING id`);
        if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`DELETE FROM crm.partner_contacts WHERE partner_id = ${id}`);
        await transaction.execute(sql`DELETE FROM crm.partner_bank_accounts WHERE partner_id = ${id}`);
        await this.writeChildren(transaction, id, input);
        await this.auditService.record(
          {
            ...crmAudit(actor),
            action: "partner.update",
            entityId: id,
            beforeData: { ...before, profile: undefined },
            afterData: withoutIdentity(input),
          },
          transaction,
        );
      })
      .catch((error: unknown) => this.duplicateError(error));
    return this.detail(actor, id);
  }

  async setStatus(actor: Actor, id: string, status: "active" | "inactive", version: number): Promise<PartnerResponse> {
    await this.require(actor, crmPermissions.manage);
    const before = await this.detail(actor, id);
    if (before.internalCompanyId) throw new ApiError("BUSINESS_RULE", "partnerInternalLocked");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE crm.partners SET status = ${status}, version = version + 1, updated_at = now(), updated_by = ${actor.userId} WHERE id = ${id} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        {
          ...crmAudit(actor),
          action: `partner.${status === "inactive" ? "deactivate" : "activate"}`,
          entityId: id,
          afterData: { status },
        },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Xem đầy đủ số Căn cước công dân: cần quyền riêng, mỗi lần xem ghi nhật ký (QUYTAC_NGHIEPVU_59).
  async identity(actor: Actor, id: string): Promise<{ citizenId: string | null }> {
    await this.require(actor, crmPermissions.viewIdentity);
    const row = (
      await this.database.execute<{ citizen_id: string | null }>(sql`
      SELECT citizen_id FROM crm.partners p WHERE p.id = ${id}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.citizen_id === null) return { citizenId: null };
    await this.auditService.record({
      ...crmAudit(actor),
      action: "partner.view_identity",
      entityId: id,
    });
    return { citizenId: row.citizen_id };
  }

  async profileOptions(actor: Actor): Promise<PartnerProfileOptionsResponse> {
    await this.require(actor, crmPermissions.manageProfile);
    const groups = await this.database.execute<{ id: string; name: string }>(
      sql`SELECT id, name FROM catalog.customer_groups WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY name`,
    );
    const users = await this.database.execute<{
      id: string;
      full_name: string;
    }>(sql`
      SELECT u.id, u.full_name FROM core.users u JOIN core.user_company_memberships m ON m.user_id = u.id
      WHERE m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status = 'active' ORDER BY u.full_name`);
    return {
      customerGroups: groups.rows,
      users: users.rows.map((row) => ({ id: row.id, fullName: row.full_name })),
    };
  }

  // Hồ sơ đối tác của công ty đang chọn (QUYTAC_NGHIEPVU_60).
  async saveProfile(actor: Actor, id: string, input: z.output<typeof savePartnerProfileSchema>): Promise<PartnerResponse> {
    await this.require(actor, crmPermissions.manageProfile);
    const partner = (
      await this.database.execute<{
        status: string;
        company_id: string | null;
      }>(sql`SELECT status, company_id FROM crm.partners WHERE id = ${id}`)
    ).rows[0];
    if (!partner) throw new ApiError("NOT_FOUND", "notFound");
    const fields: Record<string, keyof Messages["errors"]> = {};
    if (partner.company_id === actor.companyId) fields.partnerId = "partnerIsSelf";
    if (input.customerGroupId) {
      const group = await this.database.execute(sql`SELECT 1 FROM catalog.customer_groups WHERE id = ${input.customerGroupId} AND company_id = ${actor.companyId} AND status = 'active'`);
      if (group.rows.length === 0) fields.customerGroupId = "invalidValue";
    }
    const before = await this.profile(actor.companyId, id, true);
    const ownerUserId = input.ownerUserId ?? null;
    // Người phụ trách sửa bằng tay trên hồ sơ (QUYTAC_NGHIEPVU_279); chỉ kiểm khi chọn người mới.
    if (ownerUserId && ownerUserId !== before?.ownerUserId) {
      const member = await this.database.execute(sql`SELECT 1 FROM core.user_company_memberships WHERE user_id = ${ownerUserId} AND company_id = ${actor.companyId} AND status = 'active'`);
      if (member.rows.length === 0) fields.ownerUserId = "invalidValue";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    if ((before?.version ?? 0) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.database.transaction(async (transaction) => {
      const saved = await transaction.execute(sql`
        INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier, payment_term_days, credit_limit, customer_group_id, owner_user_id, note, status, updated_by)
        VALUES (${actor.companyId}, ${id}, ${input.isCustomer}, ${input.isSupplier}, ${input.paymentTermDays}, ${input.creditLimit}::numeric, ${input.customerGroupId ?? null},
          ${input.ownerUserId ?? null}, ${input.note}, ${input.status}, ${actor.userId})
        ON CONFLICT (company_id, partner_id) DO UPDATE SET is_customer = EXCLUDED.is_customer, is_supplier = EXCLUDED.is_supplier, payment_term_days = EXCLUDED.payment_term_days,
          credit_limit = EXCLUDED.credit_limit, customer_group_id = EXCLUDED.customer_group_id, owner_user_id = EXCLUDED.owner_user_id, note = EXCLUDED.note, status = EXCLUDED.status,
          updated_by = EXCLUDED.updated_by, updated_at = now(), version = crm.partner_profiles.version + 1
        WHERE crm.partner_profiles.version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        {
          ...crmAudit(actor),
          entityType: "partner_profile",
          action: "partner_profile.save",
          entityId: id,
          beforeData: before,
          afterData: input,
        },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Khách do đối tác tạo hoặc gắn qua Open API tại công ty (CONG_VIEC_66; QUYTAC_NGHIEPVU_494).
  private async openApiSources(companyId: string, partnerId: string): Promise<PartnerResponse["openApi"]> {
    const rows = await this.database.execute<{ partner_name: string | null; key_name: string; is_owner: boolean; created_at: Date; personal_data_consent_at: Date | null }>(sql`
      SELECT op.name AS partner_name, k.name AS key_name, l.is_owner, l.created_at, l.personal_data_consent_at
      FROM crm.open_api_customers l JOIN core.api_keys k ON k.id = l.api_key_id LEFT JOIN crm.partners op ON op.id = k.partner_id
      WHERE l.company_id = ${companyId} AND l.partner_id = ${partnerId} ORDER BY l.created_at`);
    return rows.rows.map((row) => ({
      partnerName: row.partner_name,
      keyName: row.key_name,
      isOwner: row.is_owner,
      createdAt: new Date(row.created_at).toISOString(),
      personalDataConsentAt: row.personal_data_consent_at ? new Date(row.personal_data_consent_at).toISOString() : null,
    }));
  }

  // Hạn mức công nợ là thông tin nhạy cảm: chỉ người có quyền quản lý hồ sơ đối tác thấy (tài liệu 22).
  private async profile(companyId: string, partnerId: string, showCreditLimit: boolean): Promise<PartnerProfileResponse | null> {
    const row = (
      await this.database.execute<{
        is_customer: boolean;
        is_supplier: boolean;
        payment_term_days: number;
        credit_limit: string | null;
        customer_group_id: string | null;
        customer_group_name: string | null;
        owner_user_id: string | null;
        owner_user_name: string | null;
        note: string | null;
        status: "active" | "inactive";
        version: number;
        currency: string;
      }>(sql`
      SELECT pr.is_customer, pr.is_supplier, pr.payment_term_days, pr.credit_limit::text, pr.customer_group_id, g.name AS customer_group_name, pr.owner_user_id,
        u.full_name AS owner_user_name, pr.note, pr.status, pr.version, c.base_currency AS currency
      FROM crm.partner_profiles pr JOIN core.companies c ON c.id = pr.company_id LEFT JOIN catalog.customer_groups g ON g.id = pr.customer_group_id
        LEFT JOIN core.users u ON u.id = pr.owner_user_id
      WHERE pr.company_id = ${companyId} AND pr.partner_id = ${partnerId}`)
    ).rows[0];
    if (!row) return null;
    return {
      companyId,
      isCustomer: row.is_customer,
      isSupplier: row.is_supplier,
      paymentTermDays: row.payment_term_days,
      creditLimit: !showCreditLimit || row.credit_limit === null ? null : trimDecimal(row.credit_limit),
      creditLimitHidden: !showCreditLimit,
      currency: row.currency,
      customerGroupId: row.customer_group_id,
      customerGroupName: row.customer_group_name,
      ownerUserId: row.owner_user_id,
      ownerUserName: row.owner_user_name,
      note: row.note,
      status: row.status,
      version: row.version,
    };
  }

  // Tổ chức, hộ kinh doanh bắt buộc mã số thuế; cá nhân bắt buộc số Căn cước công dân; không trùng trong tập đoàn (QUYTAC_NGHIEPVU_56).
  // Khách do đối tác tạo qua Open API (QUYTAC_NGHIEPVU_494 khoản 3, 4): mã số thuế, căn cước đã có thì gắn hồ sơ cũ vào phạm vi, không sửa hồ sơ đó.
  // Trả created: false khi gắn hồ sơ có sẵn hoặc phạm vi đã có khách này. Hai lần gửi đồng thời: lần sau gặp chỉ mục duy nhất, chạy lại nhánh gắn.
  async createFromOpenApi(source: OpenApiCustomerSource, input: z.output<typeof openCustomerSchema>): Promise<{ partnerId: string; created: boolean }> {
    const consentAt = input.kind === "individual" && input.personalDataConsent === true ? sql`now()` : sql`NULL`;
    const attempt = () =>
      this.database.transaction(async (transaction): Promise<{ partnerId: string; created: boolean }> => {
        const existing = (
          await transaction.execute<{ id: string; status: string }>(sql`
          SELECT id, status FROM crm.partners WHERE (tax_code = ${input.taxCode ?? null} OR citizen_id = ${input.citizenId ?? null}) ORDER BY tax_code IS NULL LIMIT 1 FOR UPDATE`)
        ).rows[0];
        if (existing) {
          const linked = await transaction.execute(sql`
            SELECT 1 FROM crm.open_api_customers WHERE company_id = ${source.companyId} AND scope_id = ${source.scopeId} AND partner_id = ${existing.id}`);
          if (linked.rows.length > 0) return { partnerId: existing.id, created: false };
          if (existing.status !== "active") throw new ApiError("BUSINESS_RULE", "openApiCustomerNotUsable");
          await this.ensureCustomerProfile(transaction, source, existing.id);
          await transaction.execute(sql`
            INSERT INTO crm.open_api_customers (company_id, scope_id, partner_id, api_key_id, is_owner, personal_data_consent_at)
            VALUES (${source.companyId}, ${source.scopeId}, ${existing.id}, ${source.apiKeyId}, false, ${consentAt})`);
          await this.auditService.record(
            { ...openApiAudit(source), action: "partner.open_api_link", entityId: existing.id, afterData: { openApi: { keyName: source.keyName, keyPrefix: source.keyPrefix } } },
            transaction,
          );
          return { partnerId: existing.id, created: false };
        }
        const searchValue = searchText(input.name, null, input.taxCode ?? null, input.phone ?? null);
        const partnerId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO crm.partners (kind, name, tax_code, citizen_id, address, phone, email, search_text, created_via_api_key_id)
          VALUES (${input.kind}, ${input.name}, ${input.taxCode ?? null}, ${input.citizenId ?? null}, ${input.address ?? null}, ${input.phone ?? null}, ${input.email ?? null},
            ${searchValue}, ${source.apiKeyId}) RETURNING id`)
        ).rows[0]!.id;
        await this.ensureCustomerProfile(transaction, source, partnerId);
        await transaction.execute(sql`
          INSERT INTO crm.open_api_customers (company_id, scope_id, partner_id, api_key_id, is_owner, personal_data_consent_at)
          VALUES (${source.companyId}, ${source.scopeId}, ${partnerId}, ${source.apiKeyId}, true, ${consentAt})`);
        const { personalDataConsent: _consent, citizenId, ...logged } = input;
        await this.auditService.record(
          {
            ...openApiAudit(source),
            action: "partner.create",
            entityId: partnerId,
            afterData: { ...logged, citizenId: citizenId ? `***${citizenId.slice(-3)}` : null, openApi: { keyName: source.keyName, keyPrefix: source.keyPrefix } },
          },
          transaction,
        );
        return { partnerId, created: true };
      });
    try {
      return await attempt();
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return attempt();
    }
  }

  // Đối tác chỉ sửa tên, địa chỉ, điện thoại, email của khách do mình tạo (khoản 5); kiểm phạm vi ở OpenCustomersService.
  async updateFromOpenApi(source: OpenApiCustomerSource, partnerId: string, input: z.output<typeof openCustomerUpdateSchema>): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const before = (
        await transaction.execute<{ name: string; short_name: string | null; tax_code: string | null; address: string | null; phone: string | null; email: string | null; version: number }>(sql`
        SELECT name, short_name, tax_code, address, phone, email, version FROM crm.partners WHERE id = ${partnerId} FOR UPDATE`)
      ).rows[0]!;
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const after = {
        name: input.name ?? before.name,
        address: input.address === undefined ? before.address : input.address,
        phone: input.phone === undefined ? before.phone : input.phone,
        email: input.email === undefined ? before.email : input.email,
      };
      await transaction.execute(sql`
        UPDATE crm.partners SET name = ${after.name}, address = ${after.address}, phone = ${after.phone}, email = ${after.email},
          search_text = ${searchText(after.name, before.short_name, before.tax_code, after.phone)}, version = version + 1, updated_at = now(), updated_by = NULL
        WHERE id = ${partnerId}`);
      await this.auditService.record(
        {
          ...openApiAudit(source),
          action: "partner.update",
          entityId: partnerId,
          beforeData: { name: before.name, address: before.address, phone: before.phone, email: before.email },
          afterData: { ...after, openApi: { keyName: source.keyName, keyPrefix: source.keyPrefix } },
        },
        transaction,
      );
    });
  }

  // Hồ sơ khách ở công ty của khóa: chưa có thì tạo (nhóm của đối tác, hạn 0 ngày, hạn mức trống); có mà ngừng hoặc chỉ là nhà cung cấp thì từ chối (khoản 3, 4).
  private async ensureCustomerProfile(transaction: Executor, source: OpenApiCustomerSource, partnerId: string): Promise<void> {
    const profile = (
      await transaction.execute<{ status: string; is_customer: boolean }>(sql`
      SELECT status, is_customer FROM crm.partner_profiles WHERE company_id = ${source.companyId} AND partner_id = ${partnerId}`)
    ).rows[0];
    if (profile) {
      if (profile.status !== "active" || !profile.is_customer) throw new ApiError("BUSINESS_RULE", "openApiCustomerNotUsable");
      return;
    }
    const internal = (await transaction.execute<{ company_id: string | null }>(sql`SELECT company_id FROM crm.partners WHERE id = ${partnerId}`)).rows[0]?.company_id ?? null;
    if (internal !== null) throw new ApiError("BUSINESS_RULE", "openApiCustomerNotUsable");
    await transaction.execute(sql`
      INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier, payment_term_days, customer_group_id)
      VALUES (${source.companyId}, ${partnerId}, true, false, 0, ${source.customerGroupId})`);
  }

  private async validate(input: PartnerInput, exceptId: string | null): Promise<void> {
    const fields: Record<string, keyof Messages["errors"]> = {};
    if (input.kind !== "individual" && !input.taxCode) fields.taxCode = "required";
    // Khách cá nhân do đối tác tạo qua Open API được để trống căn cước, kể cả khi nhân viên sửa (QUYTAC_NGHIEPVU_494 khoản 2).
    if (input.kind === "individual" && !input.citizenId) {
      const viaOpenApi = exceptId !== null && (await this.database.execute(sql`SELECT 1 FROM crm.partners WHERE id = ${exceptId} AND created_via_api_key_id IS NOT NULL`)).rows.length > 0;
      if (!viaOpenApi) fields.citizenId = "required";
    }
    if (input.kind !== "individual" && input.citizenId) fields.citizenId = "invalidValue";
    if (input.taxCode && (await this.database.execute(sql`SELECT 1 FROM crm.partners WHERE tax_code = ${input.taxCode} AND id IS DISTINCT FROM ${exceptId}`)).rows.length > 0) {
      fields.taxCode = "partnerTaxCodeExists";
    }
    if (input.citizenId && (await this.database.execute(sql`SELECT 1 FROM crm.partners WHERE citizen_id = ${input.citizenId} AND id IS DISTINCT FROM ${exceptId}`)).rows.length > 0) {
      fields.citizenId = "partnerCitizenIdExists";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async writeChildren(transaction: Pick<Database, "execute">, partnerId: string, input: PartnerInput): Promise<void> {
    for (const [index, contact] of input.contacts.entries()) {
      await transaction.execute(sql`
        INSERT INTO crm.partner_contacts (partner_id, full_name, position, phone, email, is_primary, sort_order)
        VALUES (${partnerId}, ${contact.fullName}, ${contact.position}, ${contact.phone}, ${contact.email}, ${contact.isPrimary}, ${index})`);
    }
    for (const [index, account] of input.bankAccounts.entries()) {
      await transaction.execute(sql`
        INSERT INTO crm.partner_bank_accounts (partner_id, bank_name, account_no, account_holder, branch, is_default, sort_order)
        VALUES (${partnerId}, ${account.bankName}, ${account.accountNo}, ${account.accountHolder}, ${account.branch}, ${account.isDefault}, ${index})`);
    }
  }

  // Hai người lưu cùng lúc vượt qua bước kiểm trùng: báo đúng trường bị trùng.
  private duplicateError(error: unknown): never {
    if (!isUniqueViolation(error)) throw error;
    const failure = error as { constraint?: string; cause?: { constraint?: string } };
    const constraint = failure.constraint ?? failure.cause?.constraint ?? "";
    throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: constraint.includes("citizen_id") ? { citizenId: "partnerCitizenIdExists" } : { taxCode: "partnerTaxCodeExists" } });
  }

  private search(input: PartnerInput): string {
    return searchText(input.name, input.shortName, input.taxCode, input.phone);
  }

  private async require(actor: Actor, permission: string): Promise<Set<string>> {
    const granted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
    if (!granted.has(permission)) throw new ApiError("FORBIDDEN", "forbidden");
    return granted;
  }

  private toItem(row: PartnerRow): PartnerListItem {
    return {
      id: row.id,
      code: row.code,
      kind: row.kind,
      name: row.name,
      shortName: row.short_name,
      taxCode: row.tax_code,
      citizenIdMasked: row.citizen_id ? `*********${row.citizen_id.slice(-3)}` : null,
      phone: row.phone,
      internalCompanyId: row.company_id,
      isCustomer: row.is_customer ?? false,
      isSupplier: row.is_supplier ?? false,
      ownerUserName: row.owner_user_name,
      status: row.status,
      createdViaOpenApi: row.created_via_api_key_id !== null,
    };
  }
}

// CONG_VIEC_09: công ty con mà đối tác nội bộ đại diện (null nếu là đối tác bên ngoài) và đối tác nội bộ đại diện một công ty (QUYTAC_NGHIEPVU_58).
export async function internalCompanyOf(executor: Pick<Database, "execute">, partnerId: string): Promise<string | null> {
  return (await executor.execute<{ company_id: string | null }>(sql`SELECT company_id FROM crm.partners WHERE id = ${partnerId}`)).rows[0]?.company_id ?? null;
}
export async function internalPartnerOf(executor: Pick<Database, "execute">, companyId: string): Promise<string | null> {
  return (await executor.execute<{ id: string }>(sql`SELECT id FROM crm.partners WHERE company_id = ${companyId} AND status = 'active'`)).rows[0]?.id ?? null;
}
