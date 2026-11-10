// Đề xuất thay đổi đội kinh doanh: người quản lý lập trên ứng dụng, quản trị duyệt trên web
// (CONG_VIEC_27; CHUC_NANG_112; QUYTAC_NGHIEPVU_153; API_121).
import { Inject, Injectable } from "@nestjs/common";
import { normalizePhone, type SalesProposalItem, type SalesProposalKind, type SalesProposalOptionsResponse, type SalesProposalStatus } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { isUniqueViolation } from "../common/database-errors";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { localPhone, maskPhone } from "./buyer-accounts.service";
import { BuyerAdminService, type BuyerAdminActor } from "./buyer-admin.service";
import { type SalesTeam, SalesTeamService } from "./sales-team.service";

type Executor = Pick<Database, "execute">;
const maximumProposalsPerDay = 20;
interface ProposalInput {
  kind: SalesProposalKind;
  targetPhone?: string | undefined;
  targetUserId?: string | undefined;
  departmentId?: string | undefined;
  reason: string;
}

// Che họ tên: giữ chữ cái đầu của từng từ.
const maskName = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => (word ? `${word[0]}.` : word))
    .join(" ");
const masked = (item: SalesProposalItem): SalesProposalItem =>
  item.kind === "add" && item.status !== "approved" ? { ...item, targetName: maskName(item.targetName), targetPhone: maskPhone(item.targetPhone) } : item;
const field = (name: string) => new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [name]: "invalidValue" } });

@Injectable()
export class SalesProposalsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly salesTeam: SalesTeamService,
    private readonly admin: BuyerAdminService,
  ) {}

  // Đội và đơn vị người đề xuất đang quản lý; không quản lý đơn vị nào thì không lập được đề xuất.
  private async managerScope(executor: Executor, userId: string): Promise<{ team: SalesTeam; companyId: string; units: Set<string> }> {
    const row = (await executor.execute<{ sales_company_id: string | null }>(sql`SELECT sales_company_id FROM marketplace.buyer_accounts WHERE user_id = ${userId} AND is_sales_staff`)).rows[0];
    if (!row?.sales_company_id) throw new ApiError("FORBIDDEN", "forbidden");
    const team = await this.salesTeam.load(executor, row.sales_company_id);
    const managed = team.managedUnit(userId);
    if (!managed?.type) throw new ApiError("FORBIDDEN", "forbidden");
    return { team, companyId: row.sales_company_id, units: team.subtree(managed.id) };
  }

  async options(userId: string): Promise<SalesProposalOptionsResponse> {
    const { team, units } = await this.managerScope(this.database, userId);
    return {
      managedUnitId: team.managedUnit(userId)!.id,
      units: team.units.filter((unit) => unit.type && units.has(unit.id)).map((unit) => ({ id: unit.id, name: unit.name, type: unit.type! })),
      members: team.branch(userId).map((member) => ({ userId: member.userId, fullName: member.fullName, departmentId: member.departmentId, title: team.titleOf(member.userId)! })),
    };
  }

  // QUYTAC_NGHIEPVU_153: kiểm phạm vi nhánh; trả người được đề xuất.
  private async validate(executor: Executor, proposerId: string, input: ProposalInput): Promise<{ companyId: string; targetUserId: string; departmentId: string | null }> {
    const { team, companyId, units } = await this.managerScope(executor, proposerId);
    const inBranch = (userId: string) => team.branch(proposerId).find((member) => member.userId === userId);
    const managedUnitId = team.managedUnit(proposerId)!.id;
    if (input.kind === "add") {
      const phone = input.targetPhone ? normalizePhone(input.targetPhone) : "";
      const target = (
        await executor.execute<{ id: string; is_sales_staff: boolean | null }>(sql`
        SELECT u.id, b.is_sales_staff FROM core.users u LEFT JOIN marketplace.buyer_accounts b ON b.user_id = u.id WHERE u.phone = ${phone} AND u.status = 'active'`)
      ).rows[0];
      // Một thông báo chung cho không có tài khoản và đã trong đội: không dò được số nào có tài khoản (rà soát CONG_VIEC_27).
      if (!target || target.is_sales_staff) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { targetPhone: "salesProposalTargetUnavailable" } });
      if (!input.departmentId || !units.has(input.departmentId)) throw field("departmentId");
      return { companyId, targetUserId: target.id, departmentId: input.departmentId };
    }
    const member = input.targetUserId ? inBranch(input.targetUserId) : undefined;
    if (!member) throw field("targetUserId");
    if (input.kind === "remove") return { companyId, targetUserId: member.userId, departmentId: null };
    if (!input.departmentId || !units.has(input.departmentId)) throw field("departmentId");
    if (input.kind === "move" && input.departmentId === member.departmentId) throw field("departmentId");
    // Bổ nhiệm làm quản lý đơn vị của chính người đó, là đơn vị con trong nhánh (không phải đơn vị mình đang quản lý).
    if (input.kind === "appoint" && (input.departmentId !== member.departmentId || input.departmentId === managedUnitId)) throw field("departmentId");
    return { companyId, targetUserId: member.userId, departmentId: input.departmentId };
  }

  async create(proposerId: string, input: ProposalInput): Promise<SalesProposalItem> {
    // Tối đa 20 đề xuất mỗi ngày cho mỗi người (chống dò tên qua đề xuất thêm người).
    const today = await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM marketplace.sales_team_proposals WHERE proposer_user_id = ${proposerId} AND created_at > now() - interval '1 day'`);
    if ((today.rows[0]?.total ?? 0) >= maximumProposalsPerDay) throw new ApiError("RATE_LIMITED", "salesProposalTooMany");
    const checked = await this.validate(this.database, proposerId, input);
    try {
      const created = await this.database.execute<{ id: string }>(sql`
        INSERT INTO marketplace.sales_team_proposals (company_id, proposer_user_id, kind, target_user_id, department_id, reason)
        VALUES (${checked.companyId}, ${proposerId}, ${input.kind}, ${checked.targetUserId}, ${checked.departmentId}, ${input.reason}) RETURNING id`);
      return masked((await this.list(sql`p.id = ${created.rows[0]!.id}`))[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "salesProposalPendingExists");
      throw error;
    }
  }

  // Đề xuất thêm người chưa duyệt: người đề xuất chỉ thấy tên, số điện thoại đã che.
  async mine(proposerId: string): Promise<SalesProposalItem[]> {
    return (await this.list(sql`p.proposer_user_id = ${proposerId}`)).map(masked);
  }

  async withdraw(proposerId: string, proposalId: string): Promise<SalesProposalItem> {
    const updated = await this.database.execute(sql`
      UPDATE marketplace.sales_team_proposals SET status = 'withdrawn', decided_at = now() WHERE id = ${proposalId} AND proposer_user_id = ${proposerId} AND status = 'pending' RETURNING id`);
    if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    return masked((await this.list(sql`p.id = ${proposalId}`))[0]!);
  }

  async pendingForAdmin(actor: BuyerAdminActor, status: SalesProposalStatus | undefined): Promise<SalesProposalItem[]> {
    return this.list(sql`p.company_id = ${actor.operatorCompanyId} ${status ? sql`AND p.status = ${status}` : sql``}`);
  }

  // Duyệt: kiểm lại như lúc lập rồi áp dụng trong cùng giao dịch; không còn đúng thì báo lỗi, đề xuất vẫn chờ.
  async approve(actor: BuyerAdminActor, proposalId: string): Promise<SalesProposalItem> {
    await this.database.transaction(async (transaction) => {
      const proposal = await this.lockPending(transaction, actor, proposalId);
      await this.salesTeam.lockTeam(transaction, actor.operatorCompanyId);
      const input: ProposalInput = { kind: proposal.kind, targetUserId: proposal.target_user_id, departmentId: proposal.department_id ?? undefined, reason: proposal.reason };
      if (proposal.kind === "add") input.targetPhone = proposal.target_phone ?? "";
      // Điều kiện không còn đúng (người đề xuất không còn quản lý, người được đề xuất đã đổi): báo rõ để quản trị từ chối.
      const checked = await this.validate(transaction, proposal.proposer_user_id, input).catch((error: unknown) => {
        throw error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "VALIDATION_FAILED") ? new ApiError("BUSINESS_RULE", "salesProposalStale") : error;
      });
      if (proposal.kind === "add") {
        await transaction.execute(sql`INSERT INTO marketplace.buyer_accounts (user_id) VALUES (${checked.targetUserId}) ON CONFLICT (user_id) DO NOTHING`);
        await this.admin.flagSalesStaff(actor, checked.targetUserId, { departmentId: checked.departmentId!, version: null }, transaction, proposalId);
      } else if (proposal.kind === "move") await this.salesTeam.move(actor, checked.targetUserId, checked.departmentId!, null, proposalId, transaction);
      else if (proposal.kind === "appoint") await this.salesTeam.setManager(actor, checked.departmentId!, checked.targetUserId, proposalId, transaction);
      else await this.admin.unflagSalesStaff(actor, checked.targetUserId, null, transaction, proposalId);
      await this.decide(transaction, actor, proposal, "approved", null);
    });
    return (await this.list(sql`p.id = ${proposalId}`))[0]!;
  }

  async reject(actor: BuyerAdminActor, proposalId: string, note: string): Promise<SalesProposalItem> {
    await this.database.transaction(async (transaction) => {
      const proposal = await this.lockPending(transaction, actor, proposalId);
      await this.decide(transaction, actor, proposal, "rejected", note);
    });
    return (await this.list(sql`p.id = ${proposalId}`))[0]!;
  }

  private async lockPending(executor: Executor, actor: BuyerAdminActor, proposalId: string) {
    const row = (
      await executor.execute<{
        id: string;
        kind: SalesProposalKind;
        status: SalesProposalStatus;
        proposer_user_id: string;
        target_user_id: string;
        target_phone: string | null;
        department_id: string | null;
        reason: string;
      }>(sql`
      SELECT p.id, p.kind, p.status, p.proposer_user_id, p.target_user_id, u.phone AS target_phone, p.department_id, p.reason
      FROM marketplace.sales_team_proposals p JOIN core.users u ON u.id = p.target_user_id
      WHERE p.id = ${proposalId} AND p.company_id = ${actor.operatorCompanyId} FOR UPDATE OF p`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.status !== "pending") throw new ApiError("BUSINESS_RULE", "salesProposalNotPending");
    return row;
  }

  private async decide(executor: Executor, actor: BuyerAdminActor, proposal: { id: string; proposer_user_id: string; kind: SalesProposalKind }, status: "approved" | "rejected", note: string | null) {
    await executor.execute(sql`
      UPDATE marketplace.sales_team_proposals SET status = ${status}, decided_by = ${actor.userId}, decided_at = now(), decision_note = ${note} WHERE id = ${proposal.id}`);
    await notify(executor, [
      {
        userId: proposal.proposer_user_id,
        companyId: actor.operatorCompanyId,
        kind: `sales_proposal.${status}`,
        title: status === "approved" ? "Đề xuất đội kinh doanh đã được duyệt" : "Đề xuất đội kinh doanh bị từ chối",
        payload: { proposalId: proposal.id, kind: proposal.kind },
      },
    ]);
  }

  private async list(condition: ReturnType<typeof sql>): Promise<SalesProposalItem[]> {
    const rows = await this.database.execute<{
      id: string;
      kind: SalesProposalKind;
      status: SalesProposalStatus;
      proposer_name: string;
      target_user_id: string;
      target_name: string;
      target_phone: string | null;
      department_id: string | null;
      department_name: string | null;
      reason: string;
      decided_by_name: string | null;
      decided_at: Date | null;
      decision_note: string | null;
      created_at: Date;
    }>(sql`
      SELECT p.id, p.kind, p.status, a.full_name AS proposer_name, p.target_user_id, t.full_name AS target_name, t.phone AS target_phone, p.department_id, d.name AS department_name,
             p.reason, x.full_name AS decided_by_name, p.decided_at, p.decision_note, p.created_at
      FROM marketplace.sales_team_proposals p
      JOIN core.users a ON a.id = p.proposer_user_id
      JOIN core.users t ON t.id = p.target_user_id
      LEFT JOIN core.departments d ON d.id = p.department_id
      LEFT JOIN core.users x ON x.id = p.decided_by
      WHERE ${condition} ORDER BY p.created_at DESC LIMIT 500`);
    return rows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      proposerName: row.proposer_name,
      targetUserId: row.target_user_id,
      targetName: row.target_name,
      targetPhone: localPhone(row.target_phone ?? ""),
      departmentId: row.department_id,
      departmentName: row.department_name,
      reason: row.reason,
      decidedByName: row.decided_by_name,
      decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : null,
      decisionNote: row.decision_note,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }
}
