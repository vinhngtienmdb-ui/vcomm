// Cửa hàng liên kết phía công ty vận hành sàn: hợp đồng, điểm bán, mời chủ cửa hàng, khóa thành viên
// (CONG_VIEC_55; CHUC_NANG_193; QUYTAC_NGHIEPVU_392, 393; API_206).
import { Inject, Injectable } from "@nestjs/common";
import type {
  AffiliateMember,
  AffiliateMerchantDetail,
  AffiliateMerchantListItem,
  AffiliateMerchantStatus,
  AffiliateOutlet,
  PageResponse,
  affiliateMerchantCreateSchema,
  affiliateMerchantListQuerySchema,
  affiliateMerchantUpdateSchema,
  affiliateOutletSchema,
  affiliateOutletUpdateSchema,
  affiliateOwnerInviteSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { pgArray } from "../inventory/stock-ledger.service";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";

type Executor = Pick<Database, "execute">;
type MerchantInput = z.infer<typeof affiliateMerchantCreateSchema>;
type MerchantUpdate = z.infer<typeof affiliateMerchantUpdateSchema>;
const invitationHours = 72;

type MerchantRow = {
  id: string;
  code: string;
  partner_id: string;
  partner_code: string;
  name: string;
  tax_code: string | null;
  contract_no: string;
  starts_on: string;
  ends_on: string | null;
  earn_percent: string;
  fee_percent: string;
  credit_limit: string;
  transaction_cap: string;
  payment_term_days: number;
  auto_confirm_days: number;
  status: AffiliateMerchantStatus;
  status_reason: string | null;
  version: number;
};
type MemberRow = {
  id: string;
  full_name: string;
  phone: string;
  role: "owner" | "cashier";
  status: "invited" | "active" | "locked";
  outlet_ids: string[] | null;
  invitation_expires_at: Date | null;
  version: number;
};

export const outletOf = (row: { id: string; name: string; address: string; status: "active" | "inactive" }): AffiliateOutlet => ({
  id: row.id,
  name: row.name,
  address: row.address,
  status: row.status,
});
export const memberOf = (row: MemberRow): AffiliateMember => ({
  id: row.id,
  fullName: row.full_name,
  phone: row.phone,
  role: row.role,
  status: row.status,
  outletIds: row.outlet_ids ?? [],
  invitationExpiresAt: row.status === "invited" && row.invitation_expires_at ? new Date(row.invitation_expires_at).toISOString() : null,
  version: row.version,
});
export const termsOf = (row: MerchantRow) => ({
  contractNo: row.contract_no,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  earnPercent: trimDecimal(row.earn_percent),
  feePercent: trimDecimal(row.fee_percent),
  creditLimit: trimDecimal(row.credit_limit),
  transactionCap: trimDecimal(row.transaction_cap),
  paymentTermDays: row.payment_term_days,
  autoConfirmDays: row.auto_confirm_days,
});

export async function merchantRow(executor: Executor, merchantId: string, companyId: string, lock = false): Promise<MerchantRow> {
  const row = (
    await executor.execute<MerchantRow>(sql`
      SELECT m.id, m.code, m.partner_id, p.code AS partner_code, p.name, p.tax_code, m.contract_no, m.starts_on::text, m.ends_on::text, m.earn_percent::text,
        m.fee_percent::text, m.credit_limit::text, m.transaction_cap::text, m.payment_term_days, m.auto_confirm_days, m.status, m.status_reason, m.version
      FROM affiliate.merchants m JOIN crm.partners p ON p.id = m.partner_id
      WHERE m.id = ${merchantId} AND m.company_id = ${companyId} ${lock ? sql`FOR UPDATE OF m` : sql``}`)
  ).rows[0];
  if (!row) throw new ApiError("NOT_FOUND", "notFound");
  return row;
}

export async function outletsOf(executor: Executor, merchantId: string): Promise<AffiliateOutlet[]> {
  const rows = await executor.execute<{ id: string; name: string; address: string; status: "active" | "inactive" }>(sql`
    SELECT id, name, address, status FROM affiliate.outlets WHERE merchant_id = ${merchantId} ORDER BY created_at, name`);
  return rows.rows.map(outletOf);
}

export async function membersOf(executor: Executor, merchantId: string): Promise<AffiliateMember[]> {
  const rows = await executor.execute<MemberRow>(sql`
    SELECT m.id, m.full_name, m.phone, m.role, m.status, m.invitation_expires_at, m.version,
      (SELECT array_agg(mo.outlet_id ORDER BY mo.outlet_id) FROM affiliate.member_outlets mo WHERE mo.member_id = m.id) AS outlet_ids
    FROM affiliate.members m WHERE m.merchant_id = ${merchantId} ORDER BY m.role DESC, m.invited_at`);
  return rows.rows.map(memberOf);
}

// Mời thành viên (chủ hoặc thu ngân): số đã mời ở cửa hàng này thì gia hạn lời mời nếu chưa kích hoạt.
export async function inviteMember(
  executor: Executor,
  input: { merchantId: string; fullName: string; phone: string; role: "owner" | "cashier"; outletIds: string[]; invitedBy: string },
): Promise<string> {
  const existing = (
    await executor.execute<{ id: string; status: string; role: string }>(sql`
      SELECT id, status, role FROM affiliate.members WHERE merchant_id = ${input.merchantId} AND phone = ${input.phone} FOR UPDATE`)
  ).rows[0];
  if (existing && (existing.status !== "invited" || existing.role !== input.role)) throw new ApiError("BUSINESS_RULE", "affiliateMemberExists");
  const expiresAt = sql`now() + make_interval(hours => ${invitationHours})`;
  const id = existing
    ? (
        await executor.execute<{ id: string }>(sql`
          UPDATE affiliate.members SET full_name = ${input.fullName}, invitation_expires_at = ${expiresAt}, invited_by = ${input.invitedBy}, invited_at = now(),
            updated_at = now(), version = version + 1
          WHERE id = ${existing.id} RETURNING id`)
      ).rows[0]!.id
    : (
        await executor.execute<{ id: string }>(sql`
          INSERT INTO affiliate.members (merchant_id, phone, full_name, role, invited_by, invitation_expires_at)
          VALUES (${input.merchantId}, ${input.phone}, ${input.fullName}, ${input.role}, ${input.invitedBy}, ${expiresAt}) RETURNING id`)
      ).rows[0]!.id;
  if (input.role === "cashier") await replaceMemberOutlets(executor, id, input.merchantId, input.outletIds);
  return id;
}

export async function replaceMemberOutlets(executor: Executor, memberId: string, merchantId: string, outletIds: string[]): Promise<void> {
  const unique = [...new Set(outletIds)];
  const found = await executor.execute<{ total: number }>(sql`
    SELECT count(*)::int AS total FROM affiliate.outlets WHERE merchant_id = ${merchantId} AND id = ANY(${pgArray(unique)}::uuid[])`);
  if (found.rows[0]!.total !== unique.length) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { outletIds: "invalidValue" } });
  await executor.execute(sql`DELETE FROM affiliate.member_outlets WHERE member_id = ${memberId}`);
  await executor.execute(sql`
    INSERT INTO affiliate.member_outlets (member_id, outlet_id) SELECT ${memberId}::uuid, unnest(${pgArray(unique)}::uuid[])`);
}

@Injectable()
export class AffiliateMerchantsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  private record(actor: BuyerAdminActor, action: string, entityId: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "crm",
        action,
        entityType: "affiliate_merchant",
        entityId,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }

  async list(actor: BuyerAdminActor, query: z.infer<typeof affiliateMerchantListQuerySchema>): Promise<PageResponse<AffiliateMerchantListItem>> {
    const search = query.search ? `%${query.search.toLowerCase()}%` : null;
    const where = sql`m.company_id = ${actor.operatorCompanyId}
      ${query.status ? sql`AND m.status = ${query.status}` : sql``}
      ${search ? sql`AND (lower(m.code) LIKE ${search} OR p.search_text LIKE ${search} OR p.tax_code LIKE ${search})` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM affiliate.merchants m JOIN crm.partners p ON p.id = m.partner_id WHERE ${where}`)).rows[0]!
      .total;
    const rows = await this.database.execute<{
      id: string;
      code: string;
      partner_id: string;
      partner_code: string;
      name: string;
      tax_code: string | null;
      earn_percent: string;
      credit_limit: string;
      outlet_count: number;
      status: AffiliateMerchantStatus;
    }>(sql`
      SELECT m.id, m.code, m.partner_id, p.code AS partner_code, p.name, p.tax_code, m.earn_percent::text, m.credit_limit::text, m.status,
        (SELECT count(*)::int FROM affiliate.outlets o WHERE o.merchant_id = m.id AND o.status = 'active') AS outlet_count
      FROM affiliate.merchants m JOIN crm.partners p ON p.id = m.partner_id
      WHERE ${where} ORDER BY m.code DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        id: row.id,
        code: row.code,
        partnerId: row.partner_id,
        partnerCode: row.partner_code,
        name: row.name,
        taxCode: row.tax_code,
        earnPercent: trimDecimal(row.earn_percent),
        creditLimit: trimDecimal(row.credit_limit),
        outletCount: row.outlet_count,
        status: row.status,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async detail(actor: BuyerAdminActor, merchantId: string, canManage: boolean): Promise<AffiliateMerchantDetail> {
    const row = await merchantRow(this.database, merchantId, actor.operatorCompanyId);
    return {
      id: row.id,
      code: row.code,
      partnerId: row.partner_id,
      partnerCode: row.partner_code,
      name: row.name,
      taxCode: row.tax_code,
      ...termsOf(row),
      status: row.status,
      statusReason: row.status_reason,
      outlets: await outletsOf(this.database, merchantId),
      members: await membersOf(this.database, merchantId),
      canManage,
      version: row.version,
    };
  }

  // QUYTAC_NGHIEPVU_392: chỉ đối tác ngoài tập đoàn đang hoạt động; tạo ở trạng thái nháp.
  async create(actor: BuyerAdminActor, input: MerchantInput): Promise<AffiliateMerchantDetail> {
    const partner = (await this.database.execute<{ company_id: string | null; status: string }>(sql`SELECT company_id, status FROM crm.partners WHERE id = ${input.partnerId}`)).rows[0];
    if (!partner || partner.status !== "active") throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { partnerId: "invalidValue" } });
    if (partner.company_id) throw new ApiError("BUSINESS_RULE", "affiliateInternalPartner");
    const id = await this.database
      .transaction(async (transaction) => {
        const inserted = await transaction.execute<{ id: string }>(sql`
          INSERT INTO affiliate.merchants (company_id, partner_id, contract_no, starts_on, ends_on, earn_percent, fee_percent, credit_limit, transaction_cap,
            payment_term_days, auto_confirm_days, created_by, updated_by)
          VALUES (${actor.operatorCompanyId}, ${input.partnerId}, ${input.contractNo}, ${input.startsOn}, ${input.endsOn}, ${input.earnPercent}, ${input.feePercent},
            ${input.creditLimit}, ${input.transactionCap}, ${input.paymentTermDays}, ${input.autoConfirmDays}, ${actor.userId}, ${actor.userId})
          RETURNING id`);
        const merchantId = inserted.rows[0]!.id;
        await this.record(actor, "affiliate_merchant.create", merchantId, input, transaction);
        return merchantId;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "affiliatePartnerTaken");
        throw error;
      });
    return this.detail(actor, id, true);
  }

  // Sửa điều khoản áp dụng cho giao dịch lập sau khi lưu (QUYTAC_NGHIEPVU_392); đã chấm dứt thì không sửa.
  async update(actor: BuyerAdminActor, merchantId: string, input: MerchantUpdate): Promise<AffiliateMerchantDetail> {
    await this.database.transaction(async (transaction) => {
      const row = await merchantRow(transaction, merchantId, actor.operatorCompanyId, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status === "terminated") throw new ApiError("BUSINESS_RULE", "affiliateMerchantTerminated");
      await transaction.execute(sql`
        UPDATE affiliate.merchants SET contract_no = ${input.contractNo}, starts_on = ${input.startsOn}, ends_on = ${input.endsOn}, earn_percent = ${input.earnPercent},
          fee_percent = ${input.feePercent}, credit_limit = ${input.creditLimit}, transaction_cap = ${input.transactionCap}, payment_term_days = ${input.paymentTermDays},
          auto_confirm_days = ${input.autoConfirmDays}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${merchantId}`);
      await this.record(actor, "affiliate_merchant.update", merchantId, input, transaction);
    });
    return this.detail(actor, merchantId, true);
  }

  // Kích hoạt (cần ít nhất một điểm bán đang hoạt động), tạm ngưng (kèm lý do), chấm dứt (kèm lý do, không quay lại).
  async changeStatus(actor: BuyerAdminActor, merchantId: string, target: "active" | "suspended" | "terminated", version: number, reason: string | null): Promise<AffiliateMerchantDetail> {
    if (target !== "active" && !reason) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { reason: "required" } });
    await this.database.transaction(async (transaction) => {
      const row = await merchantRow(transaction, merchantId, actor.operatorCompanyId, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const allowed: Record<typeof target, AffiliateMerchantStatus[]> = { active: ["draft", "suspended"], suspended: ["active"], terminated: ["draft", "active", "suspended"] };
      if (!allowed[target].includes(row.status)) throw new ApiError("BUSINESS_RULE", "affiliateMerchantStatusInvalid");
      if (target === "active") {
        const outlets = await transaction.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM affiliate.outlets WHERE merchant_id = ${merchantId} AND status = 'active'`);
        if (outlets.rows[0]!.total === 0) throw new ApiError("BUSINESS_RULE", "affiliateNoOutlet");
      }
      await transaction.execute(sql`
        UPDATE affiliate.merchants SET status = ${target}, status_reason = ${target === "active" ? null : reason}, updated_by = ${actor.userId}, updated_at = now(),
          version = version + 1
        WHERE id = ${merchantId}`);
      await this.record(actor, `affiliate_merchant.${target}`, merchantId, { reason }, transaction);
    });
    return this.detail(actor, merchantId, true);
  }

  async addOutlet(actor: BuyerAdminActor, merchantId: string, input: z.infer<typeof affiliateOutletSchema>): Promise<AffiliateOutlet> {
    return this.database
      .transaction(async (transaction) => {
        const row = await merchantRow(transaction, merchantId, actor.operatorCompanyId, true);
        if (row.status === "terminated") throw new ApiError("BUSINESS_RULE", "affiliateMerchantTerminated");
        const inserted = await transaction.execute<{ id: string; name: string; address: string; status: "active" | "inactive" }>(sql`
          INSERT INTO affiliate.outlets (merchant_id, name, address) VALUES (${merchantId}, ${input.name}, ${input.address}) RETURNING id, name, address, status`);
        await this.record(actor, "affiliate_outlet.create", merchantId, input, transaction);
        return outletOf(inserted.rows[0]!);
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { name: "affiliateOutletNameTaken" } });
        throw error;
      });
  }

  async updateOutlet(actor: BuyerAdminActor, outletId: string, input: z.infer<typeof affiliateOutletUpdateSchema>): Promise<AffiliateOutlet> {
    return this.database
      .transaction(async (transaction) => {
        const updated = await transaction.execute<{ id: string; name: string; address: string; status: "active" | "inactive"; merchant_id: string }>(sql`
          UPDATE affiliate.outlets o SET name = ${input.name}, address = ${input.address}, status = ${input.status}, updated_at = now()
          FROM affiliate.merchants m
          WHERE o.id = ${outletId} AND m.id = o.merchant_id AND m.company_id = ${actor.operatorCompanyId}
          RETURNING o.id, o.name, o.address, o.status, o.merchant_id`);
        const row = updated.rows[0];
        if (!row) throw new ApiError("NOT_FOUND", "notFound");
        await this.record(actor, "affiliate_outlet.update", row.merchant_id, { outletId, ...input }, transaction);
        return outletOf(row);
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { name: "affiliateOutletNameTaken" } });
        throw error;
      });
  }

  // Mời chủ cửa hàng (QUYTAC_NGHIEPVU_393). Một cửa hàng có thể có nhiều chủ.
  async inviteOwner(actor: BuyerAdminActor, merchantId: string, input: z.infer<typeof affiliateOwnerInviteSchema>): Promise<AffiliateMember[]> {
    await this.database.transaction(async (transaction) => {
      const row = await merchantRow(transaction, merchantId, actor.operatorCompanyId, true);
      if (row.status === "terminated") throw new ApiError("BUSINESS_RULE", "affiliateMerchantTerminated");
      await inviteMember(transaction, { merchantId, fullName: input.fullName, phone: input.phone, role: "owner", outletIds: [], invitedBy: actor.userId });
      await this.record(actor, "affiliate_member.invite_owner", merchantId, { fullName: input.fullName }, transaction);
    });
    return membersOf(this.database, merchantId);
  }

  // Công ty khóa, mở thành viên (chủ hoặc thu ngân) của mọi cửa hàng.
  async setMemberLocked(actor: BuyerAdminActor, memberId: string, locked: boolean, version: number): Promise<AffiliateMember[]> {
    const merchantId = await this.database.transaction(async (transaction) => {
      const member = (
        await transaction.execute<{ merchant_id: string; status: string; user_id: string | null; version: number }>(sql`
          SELECT mb.merchant_id, mb.status, mb.user_id, mb.version FROM affiliate.members mb JOIN affiliate.merchants m ON m.id = mb.merchant_id
          WHERE mb.id = ${memberId} AND m.company_id = ${actor.operatorCompanyId} FOR UPDATE OF mb`)
      ).rows[0];
      if (!member) throw new ApiError("NOT_FOUND", "notFound");
      await setLocked(transaction, memberId, member, locked, version);
      await this.record(actor, locked ? "affiliate_member.lock" : "affiliate_member.unlock", member.merchant_id, { memberId }, transaction);
      return member.merchant_id;
    });
    return membersOf(this.database, merchantId);
  }
}

// Khóa: thành viên đã kích hoạt hoặc đang chờ; mở: về đã kích hoạt nếu có tài khoản, không thì về chờ kích hoạt.
export async function setLocked(executor: Executor, memberId: string, member: { status: string; user_id: string | null; version: number }, locked: boolean, version: number): Promise<void> {
  if (member.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
  if (locked === (member.status === "locked")) throw new ApiError("BUSINESS_RULE", "affiliateMemberStatusInvalid");
  const next = locked ? "locked" : member.user_id ? "active" : "invited";
  await executor.execute(sql`
    UPDATE affiliate.members SET status = ${next},
      invitation_expires_at = CASE WHEN ${next} = 'invited' THEN now() + make_interval(hours => ${invitationHours}) ELSE invitation_expires_at END,
      updated_at = now(), version = version + 1
    WHERE id = ${memberId}`);
}
