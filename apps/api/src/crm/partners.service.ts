// Đối tác dùng chung tập đoàn, hồ sơ đối tác của công ty (CHUC_NANG_46 đến 48; QUYTAC_NGHIEPVU_56 đến 60; API_71, API_72).
import { Inject, Injectable } from "@nestjs/common";
import type {
  PageResponse,
  partnerListQuerySchema,
  PartnerListItem,
  PartnerLookupResponse,
  PartnerProfileOptionsResponse,
  PartnerProfileResponse,
  PartnerResponse,
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
  status: "active" | "inactive";
  version: number;
  is_customer: boolean | null;
  is_supplier: boolean | null;
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
// Không đưa số Căn cước công dân vào nhật ký thao tác (QUYTAC_NGHIEPVU_59).
const withoutIdentity = (input: PartnerInput) => ({
  ...input,
  citizenId: input.citizenId ? `***${input.citizenId.slice(-3)}` : null,
});

@Injectable()
export class PartnersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Mỗi công ty con đang hoạt động là một đối tác nội bộ; đối tác bên ngoài trùng mã số thuế được gắn với công ty (QUYTAC_NGHIEPVU_58).
  // Công ty con ngừng hoạt động thì đối tác nội bộ ngừng giao dịch.
  async syncInternalPartners(): Promise<void> {
    await this.database.execute(sql`
      UPDATE crm.partners p SET status = 'inactive', updated_at = now() FROM core.companies c
      WHERE p.company_id = c.id AND c.status <> 'active' AND p.status = 'active'`);
    const companies = await this.database.execute<{
      id: string;
      legal_name: string;
      short_name: string;
      tax_code: string | null;
      address: string | null;
    }>(sql`
      SELECT id, legal_name, short_name, tax_code, address FROM core.companies WHERE status = 'active' AND parent_id IS NOT NULL`);
    for (const company of companies.rows) {
      const search = searchText(
        company.legal_name,
        company.short_name,
        company.tax_code,
      );
      const linked = await this.database.execute(sql`
        UPDATE crm.partners SET name = ${company.legal_name}, short_name = ${company.short_name}, tax_code = ${company.tax_code}, address = ${company.address},
          search_text = ${search}, status = 'active', updated_at = now()
        WHERE company_id = ${company.id}
          AND (name, short_name, tax_code, address, status) IS DISTINCT FROM (${company.legal_name}, ${company.short_name}, ${company.tax_code}, ${company.address}, 'active')
        RETURNING id`);
      if (linked.rows.length > 0) continue;
      if (
        (
          await this.database.execute(
            sql`SELECT 1 FROM crm.partners WHERE company_id = ${company.id}`,
          )
        ).rows.length > 0
      )
        continue;
      if (company.tax_code) {
        const byTaxCode = await this.database.execute(sql`
          UPDATE crm.partners SET company_id = ${company.id}, kind = 'organization', citizen_id = NULL, name = ${company.legal_name}, short_name = ${company.short_name},
            address = ${company.address}, search_text = ${search}, status = 'active', updated_at = now()
          WHERE tax_code = ${company.tax_code} AND company_id IS NULL RETURNING id`);
        if (byTaxCode.rows.length > 0) continue;
      }
      await this.database.execute(sql`
        INSERT INTO crm.partners (kind, name, short_name, tax_code, address, company_id, search_text)
        VALUES ('organization', ${company.legal_name}, ${company.short_name}, ${company.tax_code}, ${company.address}, ${company.id}, ${search})
        ON CONFLICT DO NOTHING`);
    }
  }

  async list(
    actor: Actor,
    query: z.output<typeof partnerListQuerySchema>,
  ): Promise<PageResponse<PartnerListItem>> {
    await this.require(actor, crmPermissions.view);
    await this.syncInternalPartners();
    const conditions: SQL[] = [sql`TRUE`];
    if (query.search) {
      const pattern = `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(
        sql`(p.search_text LIKE ${pattern} OR p.code = ${query.search.toUpperCase()} OR p.tax_code = ${query.search} OR p.phone = ${query.search})`,
      );
    }
    if (query.kind) conditions.push(sql`p.kind = ${query.kind}`);
    if (query.status) conditions.push(sql`p.status = ${query.status}`);
    if (query.role === "customer") conditions.push(sql`pr.is_customer`);
    if (query.role === "supplier") conditions.push(sql`pr.is_supplier`);
    if (query.role === "internal")
      conditions.push(sql`p.company_id IS NOT NULL`);
    const where = sql.join(conditions, sql` AND `);
    const from = sql`FROM crm.partners p LEFT JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${actor.companyId}`;
    const total = (
      await this.database.execute<{ total: number }>(
        sql`SELECT count(*)::int AS total ${from} WHERE ${where}`,
      )
    ).rows[0]!.total;
    const rows = await this.database.execute<PartnerRow>(sql`
      SELECT p.*, pr.is_customer, pr.is_supplier ${from} WHERE ${where} ORDER BY p.status, p.name LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => this.toItem(row)),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async detail(actor: Actor, id: string): Promise<PartnerResponse> {
    const granted = await this.require(actor, crmPermissions.view);
    const row = (
      await this.database.execute<PartnerRow>(sql`
      SELECT p.*, pr.is_customer, pr.is_supplier FROM crm.partners p LEFT JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${actor.companyId}
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
      profile: await this.profile(actor.companyId, id),
      version: row.version,
      canManage: granted.has(crmPermissions.manage) && row.company_id === null,
      canViewIdentity:
        granted.has(crmPermissions.viewIdentity) && row.citizen_id !== null,
      canManageProfile: granted.has(crmPermissions.manageProfile),
    };
  }

  // Kiểm trùng khi gõ mã số thuế, số Căn cước công dân (TIEUCHI_NGHIEMTHU_75).
  async lookup(
    actor: Actor,
    taxCode: string | undefined,
    citizenId: string | undefined,
  ): Promise<PartnerLookupResponse> {
    await this.require(actor, crmPermissions.view);
    if (!taxCode && !citizenId) return { partner: null };
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

  async create(actor: Actor, input: PartnerInput): Promise<PartnerResponse> {
    await this.require(actor, crmPermissions.manage);
    await this.validate(input, null);
    const id = await this.database
      .transaction(async (transaction) => {
        const partnerId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO crm.partners (kind, name, short_name, tax_code, citizen_id, address, phone, email, search_text, created_by, updated_by)
          VALUES (${input.kind}, ${input.name}, ${input.shortName}, ${input.taxCode}, ${input.citizenId}, ${input.address}, ${input.phone}, ${input.email},
            ${this.search(input)}, ${actor.userId}, ${actor.userId}) RETURNING id`)
        ).rows[0]!.id;
        await this.writeChildren(transaction, partnerId, input);
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
  async update(
    actor: Actor,
    id: string,
    submitted: PartnerInput,
  ): Promise<PartnerResponse> {
    await this.require(actor, crmPermissions.manage);
    const before = await this.detail(actor, id);
    if (before.internalCompanyId)
      throw new ApiError("BUSINESS_RULE", "partnerInternalLocked");
    const stored = (
      await this.database.execute<{ citizen_id: string | null }>(
        sql`SELECT citizen_id FROM crm.partners WHERE id = ${id}`,
      )
    ).rows[0]!.citizen_id;
    const input =
      submitted.kind === "individual" && !submitted.citizenId
        ? { ...submitted, citizenId: stored }
        : submitted;
    await this.validate(input, id);
    await this.database
      .transaction(async (transaction) => {
        const updated = await transaction.execute(sql`
          UPDATE crm.partners SET kind = ${input.kind}, name = ${input.name}, short_name = ${input.shortName}, tax_code = ${input.taxCode}, citizen_id = ${input.citizenId},
            address = ${input.address}, phone = ${input.phone}, email = ${input.email}, search_text = ${this.search(input)}, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
          WHERE id = ${id} AND version = ${input.version ?? 0} RETURNING id`);
        if (updated.rows.length === 0)
          throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(
          sql`DELETE FROM crm.partner_contacts WHERE partner_id = ${id}`,
        );
        await transaction.execute(
          sql`DELETE FROM crm.partner_bank_accounts WHERE partner_id = ${id}`,
        );
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

  async setStatus(
    actor: Actor,
    id: string,
    status: "active" | "inactive",
    version: number,
  ): Promise<PartnerResponse> {
    await this.require(actor, crmPermissions.manage);
    const before = await this.detail(actor, id);
    if (before.internalCompanyId)
      throw new ApiError("BUSINESS_RULE", "partnerInternalLocked");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE crm.partners SET status = ${status}, version = version + 1, updated_at = now(), updated_by = ${actor.userId} WHERE id = ${id} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0)
        throw new ApiError("CONFLICT_VERSION", "conflictVersion");
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
  async identity(
    actor: Actor,
    id: string,
  ): Promise<{ citizenId: string | null }> {
    await this.require(actor, crmPermissions.viewIdentity);
    const row = (
      await this.database.execute<{ citizen_id: string | null }>(
        sql`SELECT citizen_id FROM crm.partners WHERE id = ${id}`,
      )
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
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
  async saveProfile(
    actor: Actor,
    id: string,
    input: z.output<typeof savePartnerProfileSchema>,
  ): Promise<PartnerResponse> {
    await this.require(actor, crmPermissions.manageProfile);
    const partner = (
      await this.database.execute<{
        status: string;
        company_id: string | null;
      }>(sql`SELECT status, company_id FROM crm.partners WHERE id = ${id}`)
    ).rows[0];
    if (!partner) throw new ApiError("NOT_FOUND", "notFound");
    const fields: Record<string, keyof Messages["errors"]> = {};
    if (partner.company_id === actor.companyId)
      fields.partnerId = "partnerIsSelf";
    if (input.customerGroupId) {
      const group = await this.database.execute(
        sql`SELECT 1 FROM catalog.customer_groups WHERE id = ${input.customerGroupId} AND company_id = ${actor.companyId} AND status = 'active'`,
      );
      if (group.rows.length === 0) fields.customerGroupId = "invalidValue";
    }
    if (input.ownerUserId) {
      const member = await this.database.execute(
        sql`SELECT 1 FROM core.user_company_memberships WHERE user_id = ${input.ownerUserId} AND company_id = ${actor.companyId} AND status = 'active'`,
      );
      if (member.rows.length === 0) fields.ownerUserId = "invalidValue";
    }
    if (Object.keys(fields).length > 0)
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const before = await this.profile(actor.companyId, id);
    if ((before?.version ?? 0) !== input.version)
      throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.database.transaction(async (transaction) => {
      const saved = await transaction.execute(sql`
        INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier, payment_term_days, credit_limit, customer_group_id, owner_user_id, note, status, updated_by)
        VALUES (${actor.companyId}, ${id}, ${input.isCustomer}, ${input.isSupplier}, ${input.paymentTermDays}, ${input.creditLimit}::numeric, ${input.customerGroupId ?? null},
          ${input.ownerUserId ?? null}, ${input.note}, ${input.status}, ${actor.userId})
        ON CONFLICT (company_id, partner_id) DO UPDATE SET is_customer = EXCLUDED.is_customer, is_supplier = EXCLUDED.is_supplier, payment_term_days = EXCLUDED.payment_term_days,
          credit_limit = EXCLUDED.credit_limit, customer_group_id = EXCLUDED.customer_group_id, owner_user_id = EXCLUDED.owner_user_id, note = EXCLUDED.note, status = EXCLUDED.status,
          updated_by = EXCLUDED.updated_by, updated_at = now(), version = crm.partner_profiles.version + 1
        WHERE crm.partner_profiles.version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0)
        throw new ApiError("CONFLICT_VERSION", "conflictVersion");
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

  private async profile(
    companyId: string,
    partnerId: string,
  ): Promise<PartnerProfileResponse | null> {
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
      }>(sql`
      SELECT pr.is_customer, pr.is_supplier, pr.payment_term_days, pr.credit_limit::text, pr.customer_group_id, g.name AS customer_group_name, pr.owner_user_id,
        u.full_name AS owner_user_name, pr.note, pr.status, pr.version
      FROM crm.partner_profiles pr LEFT JOIN catalog.customer_groups g ON g.id = pr.customer_group_id LEFT JOIN core.users u ON u.id = pr.owner_user_id
      WHERE pr.company_id = ${companyId} AND pr.partner_id = ${partnerId}`)
    ).rows[0];
    if (!row) return null;
    return {
      companyId,
      isCustomer: row.is_customer,
      isSupplier: row.is_supplier,
      paymentTermDays: row.payment_term_days,
      creditLimit:
        row.credit_limit === null ? null : trimDecimal(row.credit_limit),
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
  private async validate(
    input: PartnerInput,
    exceptId: string | null,
  ): Promise<void> {
    const fields: Record<string, keyof Messages["errors"]> = {};
    if (input.kind !== "individual" && !input.taxCode)
      fields.taxCode = "required";
    if (input.kind === "individual" && !input.citizenId)
      fields.citizenId = "required";
    if (input.kind !== "individual" && input.citizenId)
      fields.citizenId = "invalidValue";
    if (
      input.taxCode &&
      (
        await this.database.execute(
          sql`SELECT 1 FROM crm.partners WHERE tax_code = ${input.taxCode} AND id IS DISTINCT FROM ${exceptId}`,
        )
      ).rows.length > 0
    ) {
      fields.taxCode = "partnerTaxCodeExists";
    }
    if (
      input.citizenId &&
      (
        await this.database.execute(
          sql`SELECT 1 FROM crm.partners WHERE citizen_id = ${input.citizenId} AND id IS DISTINCT FROM ${exceptId}`,
        )
      ).rows.length > 0
    ) {
      fields.citizenId = "partnerCitizenIdExists";
    }
    if (Object.keys(fields).length > 0)
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async writeChildren(
    transaction: Pick<Database, "execute">,
    partnerId: string,
    input: PartnerInput,
  ): Promise<void> {
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

  private duplicateError(error: unknown): never {
    if (isUniqueViolation(error))
      throw new ApiError("VALIDATION_FAILED", "validationFailed", {
        fields: { taxCode: "partnerTaxCodeExists" },
      });
    throw error;
  }

  private search(input: PartnerInput): string {
    return searchText(input.name, input.shortName, input.taxCode, input.phone);
  }

  private async require(
    actor: Actor,
    permission: string,
  ): Promise<Set<string>> {
    const granted = await this.permissionService.permissionsCovering(
      actor.userId,
      { scopeType: "company", companyId: actor.companyId },
    );
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
      citizenIdMasked: row.citizen_id
        ? `*********${row.citizen_id.slice(-3)}`
        : null,
      phone: row.phone,
      internalCompanyId: row.company_id,
      isCustomer: row.is_customer ?? false,
      isSupplier: row.is_supplier ?? false,
      status: row.status,
    };
  }
}
