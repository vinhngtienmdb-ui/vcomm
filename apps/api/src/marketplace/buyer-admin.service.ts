// Quản trị tài khoản người mua: danh sách, chi tiết, đổi người giới thiệu, đánh dấu nhân viên kinh doanh
// (CONG_VIEC_23; CHUC_NANG_107, 108; QUYTAC_NGHIEPVU_143 đến 145, 147; API_119).
import { Inject, Injectable } from "@nestjs/common";
import type { BuyerAccountDetailResponse, BuyerAccountListItem, MarketplaceSettingsResponse, PageResponse, SalesUnitType } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { isUniqueViolation } from "../common/database-errors";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { ClientInfo } from "../auth/auth.service";
import { PermissionService } from "../permissions/permission.service";
import { BuyerAccountsService, localPhone } from "./buyer-accounts.service";
import { SalesTeamService } from "./sales-team.service";

type Executor = Pick<Database, "execute">;
export type MarketplacePermission =
  | "marketplace.buyer.view"
  | "marketplace.buyer.manage"
  | "marketplace.order.view"
  | "marketplace.order.manage"
  | "marketplace.payment.manage"
  | "loyalty.view"
  | "loyalty.manage"
  // CONG_VIEC_49: kiểm duyệt bảng tin (QUYTAC_NGHIEPVU_335).
  | "marketplace.community.manage"
  // CONG_VIEC_55: cửa hàng liên kết.
  | "affiliate.view"
  | "affiliate.manage"
  // CONG_VIEC_60: chống gian lận nâng cao.
  | "loyalty.fraud.manage";

export interface BuyerAdminActor {
  userId: string;
  operatorCompanyId: string;
  client: ClientInfo;
}

type ListRow = {
  id: string;
  full_name: string;
  phone: string | null;
  status: string;
  registered_at: Date;
  referrer_name: string | null;
  referrer_phone: string | null;
  is_sales_staff: boolean;
  referral_count: number;
};

const listItem = (row: ListRow): BuyerAccountListItem => ({
  id: row.id,
  fullName: row.full_name,
  phone: localPhone(row.phone ?? ""),
  status: row.status,
  registeredAt: new Date(row.registered_at).toISOString(),
  referrerName: row.referrer_name,
  referrerPhone: row.referrer_phone ? localPhone(row.referrer_phone) : null,
  isSalesStaff: row.is_sales_staff,
  referralCount: row.referral_count,
});

const listColumns = sql`
  u.id, u.full_name, u.phone, u.status, b.registered_at, r.full_name AS referrer_name, r.phone AS referrer_phone, b.is_sales_staff,
  (SELECT count(*)::int FROM marketplace.buyer_accounts c WHERE c.referrer_user_id = b.user_id) AS referral_count`;

@Injectable()
export class BuyerAdminService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissions: PermissionService,
    private readonly buyers: BuyerAccountsService,
    private readonly audit: AuditService,
    private readonly salesTeam: SalesTeamService,
  ) {}

  async operatorCompanyId(): Promise<string | null> {
    const row = (await this.database.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator AND status = 'active'`)).rows[0];
    return row?.id ?? null;
  }

  // Quyền xét tại công ty vận hành sàn (QUYTAC_NGHIEPVU_147); chưa đặt công ty thì chưa quản trị được.
  // Quyền xem được thay bằng quyền quản lý cùng nhóm (người mua; đơn VComm của CONG_VIEC_24).
  async actor(userId: string, client: ClientInfo, permission: MarketplacePermission): Promise<BuyerAdminActor> {
    const operatorCompanyId = await this.operatorCompanyId();
    if (!operatorCompanyId) throw new ApiError("BUSINESS_RULE", "marketplaceOperatorNotSet");
    const allowedBy = (codes: { has: (code: string) => boolean }) =>
      permission.endsWith(".view") ? codes.has(permission) || codes.has(permission.replace(/\.view$/, ".manage")) : codes.has(permission);
    // Quyền ở phạm vi tập đoàn dùng được không cần là thành viên; quyền ở công ty cần còn là thành viên đang hoạt động (rà soát CONG_VIEC_23).
    if (!allowedBy(await this.permissions.permissionsCovering(userId, { scopeType: "group" }))) {
      await this.permissions.resolveCompany(userId, operatorCompanyId);
      if (!allowedBy(new Set(await this.permissions.permissionsInCompany(userId, operatorCompanyId)))) throw new ApiError("FORBIDDEN", "forbidden");
    }
    return { userId, operatorCompanyId, client };
  }

  async allows(userId: string, client: ClientInfo, permission: MarketplacePermission): Promise<boolean> {
    return this.actor(userId, client, permission).then(
      () => true,
      (error: unknown) => {
        if (error instanceof ApiError && error.code === "FORBIDDEN") return false;
        throw error;
      },
    );
  }

  private async canSetOperator(userId: string): Promise<boolean> {
    return (await this.permissions.permissionsCovering(userId, { scopeType: "group" })).has("marketplace.buyer.manage");
  }

  async settings(userId: string): Promise<MarketplaceSettingsResponse> {
    const operatorCompanyId = await this.operatorCompanyId();
    const canSetOperator = await this.canSetOperator(userId);
    const granted = operatorCompanyId ? await this.permissions.permissionsInCompany(userId, operatorCompanyId) : [];
    if (!canSetOperator && !granted.includes("marketplace.buyer.view") && !granted.includes("marketplace.buyer.manage")) throw new ApiError("FORBIDDEN", "forbidden");
    const companies = await this.database.execute<{ id: string; short_name: string }>(sql`SELECT id, short_name FROM core.companies WHERE status = 'active' ORDER BY code`);
    const operator = companies.rows.find((company) => company.id === operatorCompanyId);
    const canManage = granted.includes("marketplace.buyer.manage");
    const departments =
      operatorCompanyId && canManage
        ? (
            await this.database.execute<{ id: string; name: string; type: SalesUnitType }>(
              sql`SELECT id, name, sales_unit_type AS type FROM core.departments WHERE company_id = ${operatorCompanyId} AND status = 'active' AND sales_unit_type IS NOT NULL ORDER BY name`,
            )
          ).rows
        : [];
    return {
      operatorCompany: operator ? { id: operator.id, shortName: operator.short_name } : null,
      canSetOperator,
      companies: canSetOperator ? companies.rows.map((company) => ({ id: company.id, shortName: company.short_name })) : [],
      canManage,
      departments,
    };
  }

  // Đổi công ty vận hành sàn khi chưa có nhân viên kinh doanh nào được đánh dấu ở công ty cũ.
  async setOperator(userId: string, companyId: string, client: ClientInfo): Promise<MarketplaceSettingsResponse> {
    if (!(await this.canSetOperator(userId))) throw new ApiError("FORBIDDEN", "forbidden");
    await this.database.transaction(async (transaction) => {
      const company = await transaction.execute(sql`SELECT 1 FROM core.companies WHERE id = ${companyId} AND status = 'active'`);
      if (company.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      const flagged = await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE is_sales_staff AND sales_company_id <> ${companyId} LIMIT 1`);
      if (flagged.rows.length > 0) throw new ApiError("BUSINESS_RULE", "marketplaceOperatorHasSalesStaff");
      await transaction.execute(sql`UPDATE core.companies SET is_marketplace_operator = false WHERE is_marketplace_operator AND id <> ${companyId}`);
      await transaction.execute(sql`UPDATE core.companies SET is_marketplace_operator = true, updated_at = now() WHERE id = ${companyId}`).catch((error: unknown) => {
        // Hai người chọn hai công ty cùng lúc: người sau gặp chỉ mục duy nhất.
        throw isUniqueViolation(error) ? new ApiError("CONFLICT_VERSION", "conflictVersion") : error;
      });
      await this.audit.record(
        {
          actorUserId: userId,
          appCode: "marketplace",
          action: "marketplace.operator.set",
          entityType: "core.companies",
          entityId: companyId,
          ip: client.ip,
          userAgent: client.userAgent,
          requestId: client.requestId,
        },
        transaction,
      );
    });
    return this.settings(userId);
  }

  async list(actor: BuyerAdminActor, query: { search?: string | undefined; salesStaff?: "true" | "false" | undefined; page: number; pageSize: number }): Promise<PageResponse<BuyerAccountListItem>> {
    const digits = query.search?.replace(/[^0-9]/g, "") ?? "";
    const search = query.search
      ? sql`AND (u.full_name ILIKE ${`%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`} ${digits.length >= 3 ? sql`OR u.phone LIKE ${`%${digits.replace(/^0/, "")}%`}` : sql``})`
      : sql``;
    const staff = query.salesStaff ? sql`AND b.is_sales_staff = ${query.salesStaff === "true"}` : sql``;
    const where = sql`WHERE TRUE ${search} ${staff}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<ListRow>(sql`
      SELECT ${listColumns}
      FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id LEFT JOIN core.users r ON r.id = b.referrer_user_id
      ${where} ORDER BY b.registered_at DESC, u.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(listItem), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: BuyerAdminActor, buyerId: string): Promise<BuyerAccountDetailResponse> {
    const row = (
      await this.database.execute<ListRow & { version: number; referrer_user_id: string | null; sales_department_id: string | null; department_name: string | null; is_test_buyer: boolean }>(sql`
      SELECT ${listColumns}, b.version, b.referrer_user_id, b.sales_department_id, d.name AS department_name, b.is_test_buyer
      FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id LEFT JOIN core.users r ON r.id = b.referrer_user_id
      LEFT JOIN core.departments d ON d.id = b.sales_department_id
      WHERE b.user_id = ${buyerId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const history = await this.database.execute<{
      previous_name: string | null;
      new_name: string | null;
      source: "registration" | "self" | "admin";
      reason: string | null;
      changed_by_name: string;
      changed_at: Date;
    }>(sql`
      SELECT p.full_name AS previous_name, n.full_name AS new_name, h.source, h.reason, c.full_name AS changed_by_name, h.changed_at
      FROM marketplace.referrer_history h LEFT JOIN core.users p ON p.id = h.previous_referrer_id LEFT JOIN core.users n ON n.id = h.new_referrer_id
      JOIN core.users c ON c.id = h.changed_by WHERE h.buyer_user_id = ${buyerId} ORDER BY h.changed_at DESC`);
    const flags = await this.database.execute<{
      action: "flag" | "unflag" | "move" | "appoint" | "unappoint";
      department_name: string | null;
      changed_by_name: string;
      changed_at: Date;
      proposal_id: string | null;
    }>(sql`
      SELECT h.action, d.name AS department_name, c.full_name AS changed_by_name, h.changed_at, h.proposal_id
      FROM marketplace.sales_flag_history h LEFT JOIN core.departments d ON d.id = h.department_id JOIN core.users c ON c.id = h.changed_by
      WHERE h.buyer_user_id = ${buyerId} ORDER BY h.changed_at DESC`);
    const referrals = await this.database.execute<{ id: string; full_name: string; phone: string | null; registered_at: Date }>(sql`
      SELECT u.id, u.full_name, u.phone, b.registered_at FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id
      WHERE b.referrer_user_id = ${buyerId} ORDER BY b.registered_at DESC LIMIT 500`);
    const team = await this.salesTeam.load(this.database, actor.operatorCompanyId);
    return {
      ...listItem(row),
      version: row.version,
      isTestBuyer: row.is_test_buyer,
      salesTitle: team.titleOf(buyerId),
      salesChain: team.chain(buyerId),
      referrerId: row.referrer_user_id,
      salesDepartmentId: row.sales_department_id,
      salesDepartmentName: row.department_name,
      referrerHistory: history.rows.map((item) => ({
        previousReferrerName: item.previous_name,
        newReferrerName: item.new_name,
        source: item.source,
        reason: item.reason,
        changedByName: item.changed_by_name,
        changedAt: new Date(item.changed_at).toISOString(),
      })),
      salesFlagHistory: flags.rows.map((item) => ({
        action: item.action,
        departmentName: item.department_name,
        changedByName: item.changed_by_name,
        changedAt: new Date(item.changed_at).toISOString(),
        proposalId: item.proposal_id,
      })),
      referrals: referrals.rows.map((item) => ({ id: item.id, fullName: item.full_name, phone: localPhone(item.phone ?? ""), registeredAt: new Date(item.registered_at).toISOString() })),
    };
  }

  // QUYTAC_NGHIEPVU_143: đặt người khác hoặc để trống, bắt buộc lý do, ghi lịch sử.
  async changeReferrer(actor: BuyerAdminActor, buyerId: string, input: { referralCode: string | null; reason: string; version: number }): Promise<BuyerAccountDetailResponse> {
    await this.database.transaction(async (transaction) => {
      if (input.referralCode) await this.buyers.lockPair(transaction, buyerId, await this.buyers.resolveReferrer(transaction, input.referralCode, buyerId));
      const current = await this.lockBuyer(transaction, buyerId, input.version);
      const referrerId = input.referralCode ? await this.buyers.resolveReferrer(transaction, input.referralCode, buyerId) : null;
      if (referrerId === current.referrer_user_id) throw new ApiError("BUSINESS_RULE", "referrerUnchanged");
      await transaction.execute(sql`UPDATE marketplace.buyer_accounts SET referrer_user_id = ${referrerId}, updated_at = now(), version = version + 1 WHERE user_id = ${buyerId}`);
      await transaction.execute(sql`
        INSERT INTO marketplace.referrer_history (buyer_user_id, previous_referrer_id, new_referrer_id, source, reason, changed_by)
        VALUES (${buyerId}, ${current.referrer_user_id}, ${referrerId}, 'admin', ${input.reason}, ${actor.userId})`);
      await this.record(transaction, actor, "buyer.referrer.change", buyerId, { previousReferrerId: current.referrer_user_id, referrerId, reason: input.reason });
    });
    return this.detail(actor, buyerId);
  }

  // QUYTAC_NGHIEPVU_144 (THAY_DOI_15): thêm vào công ty vận hành sàn với phòng ban đã chọn, không gán vai trò.
  async flagSalesStaff(
    actor: BuyerAdminActor,
    buyerId: string,
    input: { departmentId: string; version: number | null },
    executor?: Database,
    proposalId: string | null = null,
  ): Promise<BuyerAccountDetailResponse | null> {
    const run = async (transaction: Database) => {
      await this.salesTeam.lockTeam(transaction, actor.operatorCompanyId);
      const current = await this.lockBuyer(transaction, buyerId, input.version);
      // Đã là thành viên đội: dùng Chuyển đơn vị (rà soát CONG_VIEC_27).
      if (current.is_sales_staff) throw new ApiError("BUSINESS_RULE", "buyerAlreadySalesStaff");
      if (current.user_status !== "active") throw new ApiError("BUSINESS_RULE", "buyerInactive");
      // Đánh dấu vào đơn vị kinh doanh (QUYTAC_NGHIEPVU_149); khóa đội để thay đổi đội chạy lần lượt.
      const department = await transaction.execute(sql`
        SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.operatorCompanyId} AND status = 'active' AND sales_unit_type IS NOT NULL`);
      if (department.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { departmentId: "invalidValue" } });
      const company = actor.operatorCompanyId;
      // Thành viên có sẵn đang hoạt động: giữ nguyên, nhớ phòng ban cũ để trả lại khi bỏ đánh dấu.
      // Chưa là thành viên hoặc thành viên đã ngừng: thao tác đánh dấu tạo (kích hoạt lại không mang chi nhánh, chức danh cũ).
      const membership = (
        await transaction.execute<{ status: string; department_id: string | null }>(sql`
        SELECT status, department_id FROM core.user_company_memberships WHERE user_id = ${buyerId} AND company_id = ${company} FOR UPDATE`)
      ).rows[0];
      let membershipCreated = false;
      let previousDepartmentId: string | null = null;
      if (!membership) {
        await transaction.execute(sql`
          INSERT INTO core.user_company_memberships (user_id, company_id, department_id, is_default, created_by)
          VALUES (${buyerId}, ${company}, ${input.departmentId},
            NOT EXISTS (SELECT 1 FROM core.user_company_memberships WHERE user_id = ${buyerId} AND is_default), ${actor.userId})`);
        membershipCreated = true;
      } else if (membership.status !== "active") {
        await transaction.execute(sql`
          UPDATE core.user_company_memberships SET status = 'active', department_id = ${input.departmentId}, default_branch_id = NULL, job_title = NULL, updated_at = now(), updated_by = ${actor.userId}
          WHERE user_id = ${buyerId} AND company_id = ${company}`);
        membershipCreated = true;
      } else {
        previousDepartmentId = membership.department_id;
        await transaction.execute(sql`
          UPDATE core.user_company_memberships SET department_id = ${input.departmentId}, updated_at = now(), updated_by = ${actor.userId}
          WHERE user_id = ${buyerId} AND company_id = ${company}`);
      }
      // Không gán vai trò Nhân viên bán hàng: nhân viên kinh doanh không bán B2B, không lập đơn hộ (THAY_DOI_15).
      await transaction.execute(sql`
        UPDATE marketplace.buyer_accounts SET sales_membership_created = ${membershipCreated}, previous_department_id = ${previousDepartmentId}
        WHERE user_id = ${buyerId}`);
      await transaction.execute(sql`
        UPDATE marketplace.buyer_accounts SET is_sales_staff = true, sales_company_id = ${company}, sales_department_id = ${input.departmentId}, updated_at = now(), version = version + 1
        WHERE user_id = ${buyerId}`);
      await transaction.execute(sql`
        INSERT INTO marketplace.sales_flag_history (buyer_user_id, action, company_id, department_id, changed_by, proposal_id) VALUES (${buyerId}, 'flag', ${company}, ${input.departmentId}, ${actor.userId}, ${proposalId})`);
      await this.record(transaction, actor, "buyer.sales.flag", buyerId, { departmentId: input.departmentId });
    };
    if (executor) {
      await run(executor);
      return null;
    }
    await this.database.transaction(run);
    return this.detail(actor, buyerId);
  }

  // Bỏ đánh dấu: bỏ phòng ban; thành viên do đánh dấu tạo mà không còn vai trò nào ở công ty thì ngừng; thành viên có sẵn trả lại phòng ban cũ; giữ tài khoản người mua.
  async unflagSalesStaff(actor: BuyerAdminActor, buyerId: string, version: number | null, executor?: Database, proposalId: string | null = null): Promise<BuyerAccountDetailResponse | null> {
    const run = async (transaction: Database) => {
      // Khóa đội trước rồi mới khóa dòng tài khoản, cùng thứ tự với chuyển đơn vị, duyệt đề xuất (tránh khóa chết).
      await this.salesTeam.lockTeam(transaction, actor.operatorCompanyId);
      const current = await this.lockBuyer(transaction, buyerId, version);
      if (!current.is_sales_staff) throw new ApiError("BUSINESS_RULE", "buyerNotSalesStaff");
      const company = current.sales_company_id!;
      const today = this.permissions.today();
      // Người đang quản lý đơn vị kinh doanh thì bỏ quản lý (QUYTAC_NGHIEPVU_152).
      await this.salesTeam.releaseManagement(transaction, actor, buyerId, proposalId);
      if (current.sales_membership_created) {
        // Thành viên do đánh dấu tạo: bỏ phòng ban; không còn vai trò nào ở công ty thì ngừng.
        const remaining = await transaction.execute(sql`
          SELECT 1 FROM core.user_role_assignments WHERE user_id = ${buyerId} AND company_id = ${company} AND (valid_to IS NULL OR valid_to >= ${today}::date) LIMIT 1`);
        await transaction.execute(sql`
          UPDATE core.user_company_memberships SET department_id = NULL, ${remaining.rows.length === 0 ? sql`status = 'inactive',` : sql``} updated_at = now(), updated_by = ${actor.userId}
          WHERE user_id = ${buyerId} AND company_id = ${company}`);
      } else {
        // Thành viên có sẵn: trả lại phòng ban trước khi đánh dấu.
        await transaction.execute(sql`
          UPDATE core.user_company_memberships SET department_id = ${current.previous_department_id}, updated_at = now(), updated_by = ${actor.userId}
          WHERE user_id = ${buyerId} AND company_id = ${company}`);
      }
      await transaction.execute(sql`
        UPDATE marketplace.buyer_accounts SET is_sales_staff = false, sales_company_id = NULL, sales_department_id = NULL, sales_membership_created = false, previous_department_id = NULL, updated_at = now(), version = version + 1 WHERE user_id = ${buyerId}`);
      await transaction.execute(sql`
        INSERT INTO marketplace.sales_flag_history (buyer_user_id, action, company_id, department_id, changed_by, proposal_id) VALUES (${buyerId}, 'unflag', ${company}, ${current.sales_department_id}, ${actor.userId}, ${proposalId})`);
      await this.record(transaction, actor, "buyer.sales.unflag", buyerId, {});
    };
    if (executor) {
      await run(executor);
      return null;
    }
    await this.database.transaction(run);
    return this.detail(actor, buyerId);
  }

  private async lockBuyer(executor: Executor, buyerId: string, version: number | null) {
    const row = (
      await executor.execute<{
        version: number;
        referrer_user_id: string | null;
        is_sales_staff: boolean;
        sales_company_id: string | null;
        sales_department_id: string | null;
        user_status: string;
        sales_membership_created: boolean;
        previous_department_id: string | null;
      }>(sql`
      SELECT b.version, b.referrer_user_id, b.is_sales_staff, b.sales_company_id, b.sales_department_id, u.status AS user_status,
             b.sales_membership_created, b.previous_department_id
      FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id WHERE b.user_id = ${buyerId} FOR UPDATE OF b`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (version !== null && row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return row;
  }

  private async record(executor: Pick<Database, "insert">, actor: BuyerAdminActor, action: string, buyerId: string, afterData: Record<string, unknown>) {
    await this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "marketplace",
        action,
        entityType: "core.users",
        entityId: buyerId,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }
}
