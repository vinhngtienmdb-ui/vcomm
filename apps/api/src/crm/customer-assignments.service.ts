// Phiếu giao khách (CHUC_NANG_97, 98; QUYTAC_NGHIEPVU_131 đến 133; API_110, API_111).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  customerAssignmentListQuerySchema,
  CustomerAssignmentListItem,
  CustomerAssignmentOptionsResponse,
  CustomerAssignmentResponse,
  CustomerAssignmentStatus,
  PageResponse,
  PartnerOwnerHistoryItem,
  saveCustomerAssignmentSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { assignCustomers, customerScope, managedUsers, ownedCustomer, recordOwner, userList } from "./customer-scope";

type Executor = Pick<Database, "execute">;
type Input = z.output<typeof saveCustomerAssignmentSchema>;
type Row = {
  id: string;
  company_id: string;
  document_no: string | null;
  status: CustomerAssignmentStatus;
  target_user_id: string;
  target_user_name: string;
  reason: string;
  customer_count: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
  submitted_by: string | null;
  submitted_at: string | null;
  applied_at: string | null;
  apply_error: string | null;
  apply_error_detail: string | null;
  approval_request_id: string | null;
  version: number;
};
type Authority = { all: boolean; users: string[]; manager: boolean };
// Lý do không áp dụng được: khóa thông báo và danh sách khách (QUYTAC_NGHIEPVU_133).
type ApplyFailure = { key: "assignmentOwnersChanged" | "assignmentTargetInactive"; detail: string | null };

export const customerAssignmentType = "crm.customer_assignment";
const editable: CustomerAssignmentStatus[] = ["draft", "rejected", "withdrawn"];

const audit = (actor: Actor) => ({
  actorUserId: actor.userId,
  companyId: actor.companyId,
  appCode: "crm",
  entityType: "customer_assignment",
  ip: actor.client.ip,
  userAgent: actor.client.userAgent,
  requestId: actor.client.requestId,
});

@Injectable()
export class CustomerAssignmentsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
  ) {}

  // Duyệt xong thì áp dụng; khách đổi nhân viên trong lúc chờ thì phiếu bị từ chối kèm danh sách (QUYTAC_NGHIEPVU_133).
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== customerAssignmentType) return;
      const status = String(event.payload.status);
      const row = (
        await this.database.execute<{ id: string; submitted_by: string }>(sql`
        SELECT id, submitted_by FROM crm.customer_assignments WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`)
      ).rows[0];
      if (!row) return;
      if (status === "approved") {
        const failure = await this.database.transaction((transaction) => this.apply(transaction, row.id, row.submitted_by));
        if (failure) await this.close(this.database, row.id, "rejected", failure);
      } else if (status === "rejected" || status === "withdrawn") await this.close(this.database, row.id, status, null);
    });
  }

  private async close(executor: Executor, id: string, status: "rejected" | "withdrawn", failure: ApplyFailure | null): Promise<void> {
    await executor.execute(sql`
      UPDATE crm.customer_assignments SET status = ${status}, apply_error = ${failure?.key ?? null}, apply_error_detail = ${failure?.detail ?? null}, updated_at = now(), version = version + 1
      WHERE id = ${id} AND status = 'pending'`);
  }

  // Người có quyền giao khách: mọi khách, mọi nhân viên; trưởng phòng: nhân viên phòng mình quản lý (QUYTAC_NGHIEPVU_131).
  private async authority(actor: Actor): Promise<Authority> {
    const granted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
    if (granted.has(assignCustomers)) return { all: true, users: [], manager: true };
    const managed = await this.database.execute(sql`
      SELECT 1 FROM core.departments WHERE company_id = ${actor.companyId} AND manager_user_id = ${actor.userId} AND status = 'active' LIMIT 1`);
    return { all: false, users: await managedUsers(this.database, actor.companyId, actor.userId), manager: managed.rows.length > 0 };
  }

  private async requireAuthority(actor: Actor): Promise<Authority> {
    const authority = await this.authority(actor);
    if (!authority.manager) throw new ApiError("FORBIDDEN", "forbidden");
    return authority;
  }

  async options(actor: Actor): Promise<CustomerAssignmentOptionsResponse> {
    const authority = await this.requireAuthority(actor);
    const users = await this.database.execute<{ id: string; full_name: string }>(sql`
      SELECT u.id, u.full_name FROM core.users u JOIN core.user_company_memberships m ON m.user_id = u.id
      WHERE m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status = 'active' AND ${authority.all ? sql`TRUE` : sql`u.id IN (${userList(authority.users)})`}
      ORDER BY u.full_name`);
    return { users: users.rows.map((row) => ({ id: row.id, fullName: row.full_name })), canAssignAll: authority.all };
  }

  // Xem phiếu: người có quyền giao khách xem mọi phiếu; người khác xem phiếu mình lập, mình gửi hoặc giao cho mình.
  private visible(actor: Actor, authority: Authority): SQL {
    if (authority.all) return sql`TRUE`;
    return sql`(a.created_by = ${actor.userId} OR a.submitted_by = ${actor.userId} OR a.target_user_id = ${actor.userId})`;
  }

  async list(actor: Actor, query: z.output<typeof customerAssignmentListQuerySchema>): Promise<PageResponse<CustomerAssignmentListItem>> {
    const authority = await this.authority(actor);
    const conditions: SQL[] = [sql`a.company_id = ${actor.companyId}`, this.visible(actor, authority)];
    if (query.status) conditions.push(sql`a.status = ${query.status}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM crm.customer_assignments a WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<Row>(sql`${this.select()} WHERE ${where} ORDER BY a.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.toItem(row)), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<CustomerAssignmentResponse> {
    const authority = await this.authority(actor);
    const row = (await this.database.execute<Row>(sql`${this.select()} WHERE a.id = ${id} AND a.company_id = ${actor.companyId} AND ${this.visible(actor, authority)}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const lines = await this.database.execute<{ partner_id: string; code: string; name: string; current_owner: string | null; previous_owner: string | null }>(sql`
      SELECT l.partner_id, p.code, p.name, cu.full_name AS current_owner, pu.full_name AS previous_owner
      FROM crm.customer_assignment_lines l JOIN crm.partners p ON p.id = l.partner_id
        LEFT JOIN crm.partner_profiles pr ON pr.partner_id = l.partner_id AND pr.company_id = ${actor.companyId}
        LEFT JOIN core.users cu ON cu.id = pr.owner_user_id LEFT JOIN core.users pu ON pu.id = l.previous_user_id
      WHERE l.assignment_id = ${id} ORDER BY p.name`);
    const author = row.created_by === actor.userId || authority.all;
    const canChange = authority.manager && author && editable.includes(row.status);
    return {
      ...this.toItem(row),
      targetUserId: row.target_user_id,
      lines: lines.rows.map((line) => ({
        partnerId: line.partner_id,
        code: line.code,
        name: line.name,
        currentOwnerName: line.current_owner,
        previousOwnerName: line.previous_owner,
      })),
      applyError: row.apply_error,
      applyErrorDetail: row.apply_error_detail,
      submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
      appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : null,
      version: row.version,
      canEdit: canChange,
      canSubmit: canChange,
      canWithdraw: row.status === "pending" && row.submitted_by === actor.userId && row.approval_request_id !== null,
      canDiscard: canChange && row.status === "draft" && row.document_no === null,
    };
  }

  // Kiểm nhân viên nhận và từng khách theo quyền của người lập (QUYTAC_NGHIEPVU_131).
  private async validate(executor: Executor, actor: Actor, authority: Authority, input: Input): Promise<void> {
    const fields: Record<string, keyof Messages["errors"]> = {};
    const target = await executor.execute(sql`
      SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
      WHERE m.user_id = ${input.targetUserId} AND m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status = 'active'`);
    if (target.rows.length === 0 || (!authority.all && !authority.users.includes(input.targetUserId))) fields.targetUserId = "invalidValue";
    const found = await executor.execute<{ partner_id: string; owner_user_id: string | null }>(sql`
      SELECT pr.partner_id, pr.owner_user_id FROM crm.partner_profiles pr JOIN crm.partners p ON p.id = pr.partner_id
      WHERE pr.company_id = ${actor.companyId} AND pr.is_customer AND pr.status = 'active' AND p.status = 'active'
        AND pr.partner_id IN (${sql.join(
          input.partnerIds.map((partnerId) => sql`${partnerId}::uuid`),
          sql`, `,
        )})`);
    const owners = new Map(found.rows.map((row) => [row.partner_id, row.owner_user_id]));
    input.partnerIds.forEach((partnerId, index) => {
      if (!owners.has(partnerId)) fields[`partnerIds.${index}`] = "assignmentCustomerInvalid";
      else if (owners.get(partnerId) === input.targetUserId) fields[`partnerIds.${index}`] = "assignmentSameOwner";
      else if (!authority.all && !authority.users.includes(owners.get(partnerId) ?? "")) fields[`partnerIds.${index}`] = "assignmentCustomerInvalid";
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async writeLines(executor: Executor, id: string, partnerIds: string[]): Promise<void> {
    await executor.execute(sql`DELETE FROM crm.customer_assignment_lines WHERE assignment_id = ${id}`);
    for (const partnerId of partnerIds) await executor.execute(sql`INSERT INTO crm.customer_assignment_lines (assignment_id, partner_id) VALUES (${id}, ${partnerId})`);
  }

  async create(actor: Actor, input: Input): Promise<CustomerAssignmentResponse> {
    const authority = await this.requireAuthority(actor);
    await this.validate(this.database, actor, authority, input);
    const id = await this.database.transaction(async (transaction) => {
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO crm.customer_assignments (company_id, target_user_id, reason, created_by) VALUES (${actor.companyId}, ${input.targetUserId}, ${input.reason}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, created, input.partnerIds);
      await this.auditService.record({ ...audit(actor), action: "customer_assignment.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<CustomerAssignmentResponse> {
    const authority = await this.requireAuthority(actor);
    const before = await this.detail(actor, id);
    if (!before.canEdit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.validate(this.database, actor, authority, input);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE crm.customer_assignments SET target_user_id = ${input.targetUserId}, reason = ${input.reason}, status = 'draft', apply_error = NULL, apply_error_detail = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id} AND version = ${input.version ?? 0} AND status IN ('draft', 'rejected', 'withdrawn') RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.writeLines(transaction, id, input.partnerIds);
      await this.auditService.record({ ...audit(actor), action: "customer_assignment.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Bỏ phiếu nháp chưa gửi lần nào.
  async discard(actor: Actor, id: string, version: number): Promise<void> {
    await this.requireAuthority(actor);
    const before = await this.detail(actor, id);
    if (!before.canDiscard) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.database.transaction(async (transaction) => {
      const deleted = await transaction.execute(sql`
        DELETE FROM crm.customer_assignments WHERE id = ${id} AND version = ${version} AND status = 'draft' AND document_no IS NULL RETURNING id`);
      if (deleted.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...audit(actor), action: "customer_assignment.discard", entityId: id, beforeData: before }, transaction);
    });
  }

  // Gửi theo chính sách duyệt của công ty; chưa có chính sách thì áp dụng ngay (QUYTAC_NGHIEPVU_132).
  async submit(actor: Actor, id: string, version: number): Promise<CustomerAssignmentResponse> {
    const authority = await this.requireAuthority(actor);
    const before = await this.detail(actor, id);
    if (!before.canSubmit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await ensureSequence(this.database, this.sequences, actor, customerAssignmentType, "GK");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute<{ document_no: string | null }>(sql`
        SELECT document_no FROM crm.customer_assignments WHERE id = ${id} AND version = ${version} AND status IN ('draft', 'rejected', 'withdrawn') FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Khóa hồ sơ khách (theo thứ tự) rồi mới kiểm phạm vi và ghi nhân viên phụ trách lúc gửi: phiếu khác áp dụng giữa chừng không lọt qua.
      await this.lockProfiles(transaction, actor.companyId, id);
      await this.validate(transaction, actor, authority, { targetUserId: before.targetUserId, reason: before.reason, partnerIds: before.lines.map((line) => line.partnerId) });
      // Ghi nhân viên phụ trách lúc gửi để kiểm khi áp dụng.
      await transaction.execute(sql`
        UPDATE crm.customer_assignment_lines l SET previous_user_id = pr.owner_user_id FROM crm.partner_profiles pr
        WHERE l.assignment_id = ${id} AND pr.partner_id = l.partner_id AND pr.company_id = ${actor.companyId}`);
      const documentNo = locked.rows[0]!.document_no ?? (await this.sequences.next(actor.companyId, customerAssignmentType, transaction));
      let requestId: string | null = null;
      try {
        requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
          documentTypeCode: customerAssignmentType,
          documentId: id,
          documentNo,
          amount: "0",
          currency: await companyCurrency(transaction, actor.companyId),
          documentDate: this.permissionService.today(),
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
      await transaction.execute(sql`
        UPDATE crm.customer_assignments SET status = 'pending', document_no = ${documentNo}, approval_request_id = ${requestId}, apply_error = NULL, apply_error_detail = NULL, submitted_at = now(),
          submitted_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      if (!requestId) {
        const failure = await this.apply(transaction, id, actor.userId);
        if (failure) throw new ApiError("BUSINESS_RULE", failure.key);
      }
      await this.auditService.record({ ...audit(actor), action: "customer_assignment.submit", entityId: id, afterData: { documentNo, approvalRequestId: requestId } }, transaction);
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<CustomerAssignmentResponse> {
    const before = await this.detail(actor, id);
    const row = (await this.database.execute<{ approval_request_id: string | null }>(sql`SELECT approval_request_id FROM crm.customer_assignments WHERE id = ${id}`)).rows[0]!;
    if (!before.canWithdraw || !row.approval_request_id) throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await this.close(transaction, id, "withdrawn", null);
      await this.auditService.record({ ...audit(actor), action: "customer_assignment.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Áp dụng: khách nào đổi nhân viên phụ trách so với lúc gửi thì không áp dụng phiếu, trả danh sách khách đó (QUYTAC_NGHIEPVU_133).
  private async lockProfiles(executor: Executor, companyId: string, id: string): Promise<void> {
    await executor.execute(sql`
      SELECT 1 FROM crm.partner_profiles WHERE company_id = ${companyId} AND partner_id IN (SELECT partner_id FROM crm.customer_assignment_lines WHERE assignment_id = ${id})
      ORDER BY partner_id FOR UPDATE`);
  }

  private async apply(executor: Executor, id: string, actorUserId: string): Promise<ApplyFailure | null> {
    const head = (
      await executor.execute<{ company_id: string; target_user_id: string; document_no: string; status: string }>(sql`
      SELECT company_id, target_user_id, document_no, status FROM crm.customer_assignments WHERE id = ${id} FOR UPDATE`)
    ).rows[0]!;
    if (head.status !== "pending") return null;
    await this.lockProfiles(executor, head.company_id, id);
    // Nhân viên nhận đã nghỉ, bị ngừng ở công ty trong lúc chờ duyệt thì không áp dụng.
    const target = await executor.execute(sql`
      SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
      WHERE m.user_id = ${head.target_user_id} AND m.company_id = ${head.company_id} AND m.status = 'active' AND u.status = 'active'`);
    if (target.rows.length === 0) return { key: "assignmentTargetInactive", detail: null };
    const lines = await executor.execute<{ partner_id: string; name: string; previous_user_id: string | null; owner_user_id: string | null; usable: boolean }>(sql`
      SELECT l.partner_id, p.name, l.previous_user_id, pr.owner_user_id, (pr.partner_id IS NOT NULL AND pr.is_customer AND pr.status = 'active' AND p.status = 'active') AS usable
      FROM crm.customer_assignment_lines l JOIN crm.partners p ON p.id = l.partner_id
        LEFT JOIN crm.partner_profiles pr ON pr.partner_id = l.partner_id AND pr.company_id = ${head.company_id}
      WHERE l.assignment_id = ${id} ORDER BY p.name FOR UPDATE OF l`);
    const changed = lines.rows.filter((line) => !line.usable || line.owner_user_id !== line.previous_user_id);
    if (changed.length > 0) return { key: "assignmentOwnersChanged", detail: changed.map((line) => line.name).join(", ") };
    for (const line of lines.rows) {
      await executor.execute(sql`
        UPDATE crm.partner_profiles SET owner_user_id = ${head.target_user_id}, updated_at = now(), updated_by = ${actorUserId}, version = version + 1
        WHERE company_id = ${head.company_id} AND partner_id = ${line.partner_id}`);
      await recordOwner(executor, { companyId: head.company_id, partnerId: line.partner_id, userId: head.target_user_id, assignmentId: id, actorUserId });
    }
    await executor.execute(sql`UPDATE crm.customer_assignments SET status = 'applied', applied_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
    const count = (owner: string | null) => lines.rows.filter((line) => line.previous_user_id === owner).length;
    const previousOwners = [...new Set(lines.rows.map((line) => line.previous_user_id).filter((owner): owner is string => owner !== null && owner !== head.target_user_id))];
    await notify(executor, [
      {
        userId: head.target_user_id,
        companyId: head.company_id,
        kind: "crm.customer_assignment.received",
        title: `Bạn được giao ${lines.rows.length} khách hàng theo phiếu ${head.document_no}`,
        link: `/crm/customer-assignments/${id}`,
        payload: { assignmentId: id },
      },
      ...previousOwners.map((owner) => ({
        userId: owner,
        companyId: head.company_id,
        kind: "crm.customer_assignment.removed",
        title: `${count(owner)} khách hàng của bạn đã chuyển cho nhân viên khác theo phiếu ${head.document_no}`,
        link: `/crm/customer-assignments/${id}`,
        payload: { assignmentId: id },
      })),
    ]);
    return null;
  }

  // Lịch sử phụ trách của một khách tại công ty đang chọn (API_111).
  async history(actor: Actor, partnerId: string): Promise<PartnerOwnerHistoryItem[]> {
    const scope = await customerScope(this.database, this.permissionService, actor);
    const visible = await this.database.execute(sql`SELECT 1 FROM crm.partners p WHERE p.id = ${partnerId} AND ${ownedCustomer(scope, sql`${actor.companyId}::uuid`, sql`p.id`)}`);
    if (visible.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    const rows = await this.database.execute<{ user_name: string; valid_from: string; valid_to: string | null; assignment_id: string | null; document_no: string | null }>(sql`
      SELECT u.full_name AS user_name, h.valid_from, h.valid_to, h.assignment_id, a.document_no
      FROM crm.partner_owner_history h JOIN core.users u ON u.id = h.user_id LEFT JOIN crm.customer_assignments a ON a.id = h.assignment_id
      WHERE h.company_id = ${actor.companyId} AND h.partner_id = ${partnerId} ORDER BY h.valid_from DESC`);
    return rows.rows.map((row) => ({
      userName: row.user_name,
      validFrom: new Date(row.valid_from).toISOString(),
      validTo: row.valid_to ? new Date(row.valid_to).toISOString() : null,
      assignmentId: row.assignment_id,
      documentNo: row.document_no,
    }));
  }

  private select(): SQL {
    return sql`SELECT a.*, tu.full_name AS target_user_name, cu.full_name AS created_by_name,
      (SELECT count(*)::int FROM crm.customer_assignment_lines l WHERE l.assignment_id = a.id) AS customer_count
      FROM crm.customer_assignments a JOIN core.users tu ON tu.id = a.target_user_id JOIN core.users cu ON cu.id = a.created_by`;
  }

  private toItem(row: Row): CustomerAssignmentListItem {
    return {
      id: row.id,
      documentNo: row.document_no,
      status: row.status,
      targetUserName: row.target_user_name,
      reason: row.reason,
      customerCount: row.customer_count,
      createdByName: row.created_by_name,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}
