// Đội kinh doanh nhiều cấp: cây đơn vị kinh doanh, chức danh suy ra từ vị trí, chuỗi cấp trên, nhánh của người quản lý
// (CONG_VIEC_27; CHUC_NANG_109, 110; QUYTAC_NGHIEPVU_148 đến 152; API_120).
import { Injectable, Inject } from "@nestjs/common";
import type { SalesChainItem, SalesTeamResponse, SalesTitle, SalesUnitType } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { localPhone } from "./buyer-accounts.service";
import type { BuyerAdminActor } from "./buyer-admin.service";

type Executor = Pick<Database, "execute">;

export interface Unit {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  type: SalesUnitType | null;
  managerUserId: string | null;
}

export interface Member {
  userId: string;
  fullName: string;
  phone: string;
  departmentId: string;
  version: number;
}

// Thứ bậc Khối > Vùng > Phòng (QUYTAC_NGHIEPVU_148).
const rank: Record<SalesUnitType, number> = { division: 3, region: 2, team: 1 };
const managerTitle: Record<SalesUnitType, SalesTitle> = { division: "director", region: "regional_director", team: "team_head" };

// Ảnh chụp đội kinh doanh của công ty vận hành sàn; mọi phép tính chức danh, chuỗi, nhánh làm trên ảnh này.
export class SalesTeam {
  private readonly unitById: Map<string, Unit>;
  private readonly memberById: Map<string, Member>;

  constructor(
    readonly units: Unit[],
    readonly members: Member[],
  ) {
    this.unitById = new Map(units.map((unit) => [unit.id, unit]));
    this.memberById = new Map(members.map((member) => [member.userId, member]));
  }

  unit(id: string): Unit | undefined {
    return this.unitById.get(id);
  }

  member(userId: string): Member | undefined {
    return this.memberById.get(userId);
  }

  // Đơn vị kinh doanh cha gần nhất (bỏ qua phòng ban không phải đơn vị kinh doanh ở giữa).
  salesParent(unit: Unit): Unit | undefined {
    let current = unit.parentId ? this.unitById.get(unit.parentId) : undefined;
    while (current && !current.type) current = current.parentId ? this.unitById.get(current.parentId) : undefined;
    return current;
  }

  // Đơn vị kinh doanh con gần nhất.
  salesChildren(unit: Unit): Unit[] {
    return this.units.filter((candidate) => candidate.type && this.salesParent(candidate)?.id === unit.id);
  }

  // Đơn vị và mọi đơn vị kinh doanh bên dưới.
  subtree(unitId: string): Set<string> {
    const result = new Set<string>([unitId]);
    const unit = this.unitById.get(unitId);
    if (!unit) return result;
    for (const child of this.salesChildren(unit)) for (const id of this.subtree(child.id)) result.add(id);
    return result;
  }

  // QUYTAC_NGHIEPVU_149: quản lý đơn vị của chính mình thì theo loại đơn vị, còn lại là Nhân viên kinh doanh.
  titleOf(userId: string): SalesTitle | null {
    const member = this.memberById.get(userId);
    if (!member) return null;
    const unit = this.unitById.get(member.departmentId);
    return unit?.type && unit.managerUserId === userId ? managerTitle[unit.type] : "staff";
  }

  // Đơn vị người này đang quản lý (trong đội).
  managedUnit(userId: string): Unit | undefined {
    const member = this.memberById.get(userId);
    const unit = member ? this.unitById.get(member.departmentId) : undefined;
    return unit?.managerUserId === userId ? unit : undefined;
  }

  // QUYTAC_NGHIEPVU_150: người quản lý các đơn vị từ đơn vị của mình đi lên, bỏ chính mình và người không còn trong đội.
  chain(userId: string): SalesChainItem[] {
    const member = this.memberById.get(userId);
    const result: SalesChainItem[] = [];
    let unit = member ? this.unitById.get(member.departmentId) : undefined;
    while (unit) {
      const manager = unit.managerUserId ? this.memberById.get(unit.managerUserId) : undefined;
      if (manager && manager.userId !== userId && !result.some((item) => item.userId === manager.userId)) {
        result.push({ userId: manager.userId, fullName: manager.fullName, title: this.titleOf(manager.userId)! });
      }
      unit = this.salesParent(unit);
    }
    return result;
  }

  // Nhánh của người quản lý: thành viên thuộc đơn vị mình quản lý và các đơn vị con, trừ chính mình.
  branch(managerId: string): Member[] {
    const unit = this.managedUnit(managerId);
    if (!unit) return [];
    const units = this.subtree(unit.id);
    return this.members.filter((member) => member.userId !== managerId && units.has(member.departmentId));
  }
}

@Injectable()
export class SalesTeamService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async load(executor: Executor, companyId: string): Promise<SalesTeam> {
    const units = await executor.execute<{ id: string; parent_id: string | null; code: string; name: string; sales_unit_type: SalesUnitType | null; manager_user_id: string | null }>(sql`
      SELECT id, parent_id, code, name, sales_unit_type, manager_user_id FROM core.departments WHERE company_id = ${companyId} AND status = 'active' ORDER BY code`);
    const members = await executor.execute<{ user_id: string; full_name: string; phone: string | null; sales_department_id: string; version: number }>(sql`
      SELECT b.user_id, u.full_name, u.phone, b.sales_department_id, b.version FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id
      WHERE b.is_sales_staff AND b.sales_company_id = ${companyId} ORDER BY u.full_name`);
    return new SalesTeam(
      units.rows.map((row) => ({ id: row.id, parentId: row.parent_id, code: row.code, name: row.name, type: row.sales_unit_type, managerUserId: row.manager_user_id })),
      members.rows.map((row) => ({ userId: row.user_id, fullName: row.full_name, phone: localPhone(row.phone ?? ""), departmentId: row.sales_department_id, version: row.version })),
    );
  }

  // API_120: cây phòng ban của công ty vận hành sàn, thành viên đội, chức danh, số khách.
  async overview(actor: BuyerAdminActor): Promise<SalesTeamResponse> {
    const team = await this.load(this.database, actor.operatorCompanyId);
    const counts = await this.customerCounts(team.members.map((member) => member.userId));
    const nameOf = (userId: string | null) => (userId ? (team.member(userId)?.fullName ?? null) : null);
    const managers = await this.userNames(team.units.map((unit) => unit.managerUserId).filter((id): id is string => Boolean(id)));
    return {
      units: team.units.map((unit) => ({ ...unit, managerName: nameOf(unit.managerUserId) ?? (unit.managerUserId ? (managers.get(unit.managerUserId) ?? null) : null) })),
      members: team.members.map((member) => ({ ...member, title: team.titleOf(member.userId)!, customerCount: counts.get(member.userId) ?? 0 })),
    };
  }

  // QUYTAC_NGHIEPVU_148: gắn, đổi, bỏ loại đơn vị kinh doanh; đúng thứ bậc; không đổi khi đơn vị còn thành viên.
  async setUnitType(actor: BuyerAdminActor, departmentId: string, type: SalesUnitType | null): Promise<SalesTeamResponse> {
    await this.database.transaction(async (transaction) => {
      await this.lockTeam(transaction, actor.operatorCompanyId);
      const team = await this.load(transaction, actor.operatorCompanyId);
      const unit = team.unit(departmentId);
      if (!unit) throw new ApiError("NOT_FOUND", "notFound");
      if (unit.type === type) return;
      if (team.members.some((member) => member.departmentId === departmentId)) throw new ApiError("BUSINESS_RULE", "salesUnitHasMembers");
      if (type) {
        const parent = team.salesParent(unit);
        if (parent?.type && rank[parent.type] <= rank[type]) throw new ApiError("BUSINESS_RULE", "salesUnitOrderInvalid");
        // Đơn vị kinh doanh con gần nhất khi đơn vị này đã là đơn vị kinh doanh.
        const changed = new SalesTeam(
          team.units.map((candidate) => (candidate.id === unit.id ? { ...candidate, type } : candidate)),
          team.members,
        );
        if (changed.salesChildren({ ...unit, type }).some((child) => rank[child.type!] >= rank[type])) throw new ApiError("BUSINESS_RULE", "salesUnitOrderInvalid");
      }
      await transaction.execute(sql`UPDATE core.departments SET sales_unit_type = ${type}, updated_at = now(), updated_by = ${actor.userId} WHERE id = ${departmentId}`);
      await this.record(transaction, actor, "sales_unit.type", departmentId, { type });
    });
    return this.overview(actor);
  }

  // QUYTAC_NGHIEPVU_149, 152: bổ nhiệm (thành viên thuộc chính đơn vị, chưa quản lý đơn vị khác) hoặc bỏ quản lý.
  async setManager(actor: BuyerAdminActor, departmentId: string, userId: string | null, proposalId: string | null = null, executor?: Database): Promise<void> {
    const run = async (transaction: Database) => {
      await this.lockTeam(transaction, actor.operatorCompanyId);
      const team = await this.load(transaction, actor.operatorCompanyId);
      const unit = team.unit(departmentId);
      if (!unit?.type) throw new ApiError("NOT_FOUND", "notFound");
      if (unit.managerUserId === userId) return;
      if (userId) {
        const member = team.member(userId);
        if (!member || member.departmentId !== departmentId) throw new ApiError("BUSINESS_RULE", "salesManagerNotInUnit");
        if (team.units.some((other) => other.id !== departmentId && other.managerUserId === userId)) throw new ApiError("BUSINESS_RULE", "salesManagerOfOtherUnit");
      }
      await transaction.execute(sql`UPDATE core.departments SET manager_user_id = ${userId}, updated_at = now(), updated_by = ${actor.userId} WHERE id = ${departmentId}`);
      if (unit.managerUserId && team.member(unit.managerUserId)) await this.history(transaction, actor, unit.managerUserId, "unappoint", departmentId, proposalId);
      if (userId) await this.history(transaction, actor, userId, "appoint", departmentId, proposalId);
      await this.record(transaction, actor, "sales_unit.manager", departmentId, { previousManagerId: unit.managerUserId, managerId: userId });
    };
    if (executor) await run(executor);
    else await this.database.transaction(run);
  }

  // QUYTAC_NGHIEPVU_152: chuyển đơn vị; đang quản lý đơn vị cũ thì bỏ quản lý.
  async move(actor: BuyerAdminActor, userId: string, departmentId: string, version: number | null, proposalId: string | null = null, executor?: Database): Promise<void> {
    const run = async (transaction: Database) => {
      await this.lockTeam(transaction, actor.operatorCompanyId);
      const team = await this.load(transaction, actor.operatorCompanyId);
      const member = team.member(userId);
      if (!member) throw new ApiError("BUSINESS_RULE", "buyerNotSalesStaff");
      if (version !== null && member.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!team.unit(departmentId)?.type) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { departmentId: "invalidValue" } });
      if (member.departmentId === departmentId) return;
      const managed = team.managedUnit(userId);
      if (managed) {
        await transaction.execute(sql`UPDATE core.departments SET manager_user_id = NULL, updated_at = now(), updated_by = ${actor.userId} WHERE id = ${managed.id}`);
        await this.history(transaction, actor, userId, "unappoint", managed.id, proposalId);
      }
      await transaction.execute(sql`
        UPDATE core.user_company_memberships SET department_id = ${departmentId}, updated_at = now(), updated_by = ${actor.userId}
        WHERE user_id = ${userId} AND company_id = ${actor.operatorCompanyId}`);
      await transaction.execute(sql`UPDATE marketplace.buyer_accounts SET sales_department_id = ${departmentId}, updated_at = now(), version = version + 1 WHERE user_id = ${userId}`);
      await this.history(transaction, actor, userId, "move", departmentId, proposalId);
      await this.record(transaction, actor, "buyer.sales.move", userId, { from: member.departmentId, to: departmentId });
    };
    if (executor) await run(executor);
    else await this.database.transaction(run);
  }

  // Bỏ quản lý khi bỏ đánh dấu (gọi trong giao dịch bỏ đánh dấu).
  async releaseManagement(transaction: Database, actor: BuyerAdminActor, userId: string, proposalId: string | null = null): Promise<void> {
    const managed = await transaction.execute<{ id: string }>(sql`
      UPDATE core.departments SET manager_user_id = NULL, updated_at = now(), updated_by = ${actor.userId}
      WHERE company_id = ${actor.operatorCompanyId} AND manager_user_id = ${userId} AND sales_unit_type IS NOT NULL RETURNING id`);
    for (const row of managed.rows) await this.history(transaction, actor, userId, "unappoint", row.id, proposalId);
  }

  // Khóa đội kinh doanh của công ty: các thay đổi cây, quản lý, thành viên chạy lần lượt.
  async lockTeam(executor: Executor, companyId: string): Promise<void> {
    await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext('sales_team'), hashtext(${companyId}))`);
  }

  async customerCounts(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.database.execute<{ referrer_user_id: string; total: number }>(sql`
      SELECT referrer_user_id, count(*)::int AS total FROM marketplace.buyer_accounts
      WHERE referrer_user_id IN (${sql.join(
        userIds.map((id) => sql`${id}`),
        sql`, `,
      )}) GROUP BY referrer_user_id`);
    return new Map(rows.rows.map((row) => [row.referrer_user_id, row.total]));
  }

  private async userNames(userIds: string[]): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();
    const rows = await this.database.execute<{ id: string; full_name: string }>(
      sql`SELECT id, full_name FROM core.users WHERE id IN (${sql.join(
        userIds.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    );
    return new Map(rows.rows.map((row) => [row.id, row.full_name]));
  }

  async history(executor: Executor, actor: BuyerAdminActor, userId: string, action: "move" | "appoint" | "unappoint", departmentId: string, proposalId: string | null): Promise<void> {
    await executor.execute(sql`
      INSERT INTO marketplace.sales_flag_history (buyer_user_id, action, company_id, department_id, changed_by, proposal_id)
      VALUES (${userId}, ${action}, ${actor.operatorCompanyId}, ${departmentId}, ${actor.userId}, ${proposalId})`);
  }

  private async record(executor: Pick<Database, "insert">, actor: BuyerAdminActor, action: string, entityId: string, afterData: Record<string, unknown>) {
    await this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "marketplace",
        action,
        entityType: action.startsWith("sales_unit") ? "core.departments" : "core.users",
        entityId,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }
}
