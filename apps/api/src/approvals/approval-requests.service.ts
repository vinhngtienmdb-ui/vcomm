// Gửi duyệt, hộp duyệt, quyết định, rút lại, nhắc và chuyển quá hạn (CHUC_NANG_16, 17, 18; QUYTAC_NGHIEPVU_17 đến 25; luồng 5 tài liệu 09).
import { Inject, Injectable } from "@nestjs/common";
import type { ApprovalInboxItem, ApprovalRequestResponse, ApprovalStepResponse, CreateApprovalRequestInput } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { notify, type NotificationInput } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { recordEvent } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import { trimAmount } from "./approval-policies.service";

type Executor = Pick<Database, "execute" | "insert">;

type LevelRow = {
  level_no: number;
  approver_type: "role" | "user" | "department_manager";
  approver_role_id: string | null;
  approver_user_id: string | null;
  substitute_type: "role" | "user";
  substitute_role_id: string | null;
  substitute_user_id: string | null;
  due_hours: number;
};

type Assignee = { roleId: string | null; userId: string | null; isSubstitute: boolean };

type RequestRow = {
  id: string;
  company_id: string;
  company_short_name: string;
  document_type_code: string;
  name_vi: string;
  name_en: string;
  app_code: string;
  document_id: string;
  document_no: string;
  amount: string;
  currency: string;
  document_date: string;
  exchange_rate: string | null;
  amount_in_policy_currency: string;
  policy_currency: string;
  policy_id: string;
  status: ApprovalRequestResponse["status"];
  current_level_no: number | null;
  requested_by: string;
  requested_by_name: string;
  requested_at: Date;
  completed_at: Date | null;
};

type StepRow = {
  level_no: number;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  assigned_role_id: string | null;
  assigned_role_name: string | null;
  is_substitute: boolean;
  started_at: Date | null;
  due_hours: number;
  decision: "approved" | "rejected" | null;
  decided_by_name: string | null;
  decided_at: Date | null;
  comment: string | null;
};

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
const dueAt = (startedAt: Date | null, hours: number) => (startedAt ? new Date(new Date(startedAt).getTime() + hours * 3600_000) : null);
const link = (requestId: string) => `/hop-duyet/${requestId}`;

@Injectable()
export class ApprovalRequestsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Nhân viên giữ vai trò còn hiệu lực trong công ty của yêu cầu (phạm vi tập đoàn, công ty hoặc chi nhánh của công ty).
  private holdsRole(userId: string, roleColumn: SQL, companyColumn: SQL): SQL {
    const day = this.permissionService.today();
    return sql`EXISTS (
      SELECT 1 FROM core.user_role_assignments a JOIN core.roles rr ON rr.id = a.role_id AND rr.status = 'active'
      WHERE a.user_id = ${userId} AND a.role_id = ${roleColumn}
        AND a.valid_from <= ${day}::date AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)
        AND (a.scope_type = 'group' OR a.company_id = ${companyColumn}))`;
  }

  // Bước đang chờ nhân viên: đúng cấp hiện tại, giao cho chính nhân viên hoặc vai trò nhân viên giữ; người lập không tự duyệt (QUYTAC_NGHIEPVU_20).
  private waitingFor(userId: string): SQL {
    return sql`q.status = 'pending' AND s.level_no = q.current_level_no AND s.decision IS NULL AND q.requested_by <> ${userId}
      AND (s.assigned_user_id = ${userId} OR (s.assigned_role_id IS NOT NULL AND ${this.holdsRole(userId, sql`s.assigned_role_id`, sql`q.company_id`)}))`;
  }

  // API_38: mini app sở hữu chứng từ gọi qua service; người lập là người đang đăng nhập.
  async submit(companyId: string, requesterId: string, input: CreateApprovalRequestInput): Promise<ApprovalRequestResponse> {
    const type = (await this.database.execute<{ app_code: string }>(sql`SELECT app_code FROM core.document_types WHERE code = ${input.documentTypeCode} AND requires_approval`)).rows[0];
    if (!type) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { documentTypeCode: "documentTypeNotFound" } });
    // QUYTAC_NGHIEPVU_17: một chính sách hiệu lực tại ngày lập chứng từ.
    const policy = (await this.database.execute<{ id: string; currency: string }>(sql`
      SELECT id, currency FROM core.approval_policies
      WHERE company_id = ${companyId} AND document_type_code = ${input.documentTypeCode}
        AND effective_from <= ${input.documentDate}::date AND (effective_to IS NULL OR effective_to >= ${input.documentDate}::date)
      ORDER BY effective_from DESC LIMIT 1`)).rows[0];
    if (!policy) throw new ApiError("BUSINESS_RULE", "policyNotFound");
    // QUYTAC_NGHIEPVU_19: quy đổi theo tỷ giá hạch toán ngày lập; tính trong cơ sở dữ liệu để không sai số.
    let exchangeRate: string | null = null;
    let converted = input.amount;
    if (input.currency !== policy.currency) {
      const rate = (await this.database.execute<{ rate: string; converted: string }>(sql`
        SELECT rate::text AS rate, round(${input.amount}::numeric * rate, 4)::text AS converted FROM core.exchange_rates
        WHERE rate_date = ${input.documentDate}::date AND from_currency = ${input.currency} AND to_currency = ${policy.currency} AND rate_type = 'accounting'
        ORDER BY created_at DESC LIMIT 1`)).rows[0];
      if (!rate) throw new ApiError("BUSINESS_RULE", "exchangeRateMissing");
      exchangeRate = rate.rate;
      converted = rate.converted;
    }
    const pending = await this.database.execute(sql`SELECT 1 FROM core.approval_requests WHERE document_type_code = ${input.documentTypeCode} AND document_id = ${input.documentId} AND status = 'pending'`);
    if (pending.rows.length > 0) throw new ApiError("BUSINESS_RULE", "documentPending");
    // QUYTAC_NGHIEPVU_18: mọi cấp có ngưỡng nhỏ hơn hoặc bằng giá trị.
    const levels = (await this.database.execute<LevelRow>(sql`
      SELECT level_no, approver_type, approver_role_id, approver_user_id, substitute_type, substitute_role_id, substitute_user_id, due_hours
      FROM core.approval_policy_levels WHERE policy_id = ${policy.id} AND min_amount <= ${converted}::numeric ORDER BY level_no`)).rows;

    const now = this.clock.now();
    const requestId = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO core.approval_requests (company_id, document_type_code, document_id, document_no, amount, currency, document_date, exchange_rate,
          amount_in_policy_currency, policy_id, status, current_level_no, requested_by, requested_at)
        VALUES (${companyId}, ${input.documentTypeCode}, ${input.documentId}, ${input.documentNo}, ${input.amount}::numeric, ${input.currency}, ${input.documentDate}::date,
          ${exchangeRate}::numeric, ${converted}::numeric, ${policy.id}, 'pending', 1, ${requesterId}, ${now.toISOString()}::timestamptz)
        RETURNING id`);
      const id = inserted.rows[0]!.id;
      const admins: string[] = [];
      for (const level of levels) {
        const assignee = await this.resolveAssignee(transaction, companyId, requesterId, level, admins);
        await transaction.execute(sql`
          INSERT INTO core.approval_steps (request_id, level_no, assigned_role_id, assigned_user_id, is_substitute, started_at)
          VALUES (${id}, ${level.level_no}, ${assignee.roleId}, ${assignee.userId}, ${assignee.isSubstitute}, ${level.level_no === 1 ? now.toISOString() : null}::timestamptz)`);
      }
      await this.notifyStep(transaction, id, 1, "approval.assigned", `Chứng từ ${input.documentNo} chờ bạn duyệt`);
      if (admins.length > 0) await this.notifyAdmins(transaction, companyId, id, `Chứng từ ${input.documentNo}: người duyệt thay thế cũng là người lập`);
      await this.auditService.record(
        { actorUserId: requesterId, companyId, appCode: type.app_code, action: "approval_request.submit", entityType: "approval_request", entityId: id, afterData: input },
        transaction,
      );
      await recordEvent(transaction, "core.approval.submitted", "approval_request", id, companyId, { requestId: id, documentTypeCode: input.documentTypeCode, documentId: input.documentId });
      return id;
    });
    return this.detail(requesterId, requestId);
  }

  // Xác định người duyệt của một cấp; là người lập (hoặc không có trưởng phòng) thì dùng người thay thế (QUYTAC_NGHIEPVU_20).
  private async resolveAssignee(executor: Executor, companyId: string, requesterId: string, level: LevelRow, substituteIsRequester: string[]): Promise<Assignee> {
    const substitute: Assignee = { roleId: level.substitute_role_id, userId: level.substitute_user_id, isSubstitute: true };
    let primary: Assignee | null = null;
    if (level.approver_type === "user") primary = level.approver_user_id === requesterId ? null : { roleId: null, userId: level.approver_user_id, isSubstitute: false };
    if (level.approver_type === "department_manager") {
      const manager = (await executor.execute<{ manager_user_id: string | null }>(sql`
        SELECT d.manager_user_id FROM core.user_company_memberships m JOIN core.departments d ON d.id = m.department_id AND d.status = 'active'
        WHERE m.user_id = ${requesterId} AND m.company_id = ${companyId}`)).rows[0]?.manager_user_id;
      primary = manager && manager !== requesterId ? { roleId: null, userId: manager, isSubstitute: false } : null;
    }
    if (level.approver_type === "role") {
      primary = (await this.onlyHolderIsRequester(executor, companyId, requesterId, level.approver_role_id!)) ? null : { roleId: level.approver_role_id, userId: null, isSubstitute: false };
    }
    if (primary) return primary;
    if (substitute.userId === requesterId || (substitute.roleId && (await this.onlyHolderIsRequester(executor, companyId, requesterId, substitute.roleId)))) {
      substituteIsRequester.push(String(level.level_no));
    }
    return substitute;
  }

  private async onlyHolderIsRequester(executor: Pick<Database, "execute">, companyId: string, requesterId: string, roleId: string): Promise<boolean> {
    const day = this.permissionService.today();
    const holders = await executor.execute<{ user_id: string }>(sql`
      SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.users u ON u.id = a.user_id AND u.status = 'active'
      WHERE a.role_id = ${roleId} AND a.valid_from <= ${day}::date AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)
        AND (a.scope_type = 'group' OR a.company_id = ${companyId})`);
    return holders.rows.length > 0 && holders.rows.every((row) => row.user_id === requesterId);
  }

  // API_39: yêu cầu chờ nhân viên ở mọi công ty nhân viên thuộc về, sắp theo thời điểm gửi.
  async inbox(userId: string, filters: { companyId?: string | undefined; appCode?: string | undefined; documentTypeCode?: string | undefined; overdue?: "true" | "false" | undefined }): Promise<ApprovalInboxItem[]> {
    const rows = await this.database.execute<{ id: string; company_id: string; short_name: string; app_code: string; document_type_code: string; name_vi: string; name_en: string; document_no: string; amount: string; currency: string; requested_by_name: string; requested_at: Date; current_level_no: number; started_at: Date | null; due_hours: number }>(sql`
      SELECT q.id, q.company_id, c.short_name, t.app_code, q.document_type_code, t.name_vi, t.name_en, q.document_no, q.amount::text AS amount, q.currency,
        u.full_name AS requested_by_name, q.requested_at, q.current_level_no, s.started_at, l.due_hours
      FROM core.approval_requests q
      JOIN core.approval_steps s ON s.request_id = q.id
      JOIN core.approval_policy_levels l ON l.policy_id = q.policy_id AND l.level_no = s.level_no
      JOIN core.document_types t ON t.code = q.document_type_code
      JOIN core.companies c ON c.id = q.company_id
      JOIN core.users u ON u.id = q.requested_by
      JOIN core.user_company_memberships m ON m.user_id = ${userId} AND m.company_id = q.company_id AND m.status = 'active'
      WHERE ${this.waitingFor(userId)}
        ${filters.companyId ? sql`AND q.company_id = ${filters.companyId}` : sql``}
        ${filters.appCode ? sql`AND t.app_code = ${filters.appCode}` : sql``}
        ${filters.documentTypeCode ? sql`AND q.document_type_code = ${filters.documentTypeCode}` : sql``}
      ORDER BY q.requested_at, q.id`);
    const now = this.clock.now().getTime();
    const items = rows.rows.map((row) => {
      const due = dueAt(row.started_at, row.due_hours);
      return {
        id: row.id,
        companyId: row.company_id,
        companyShortName: row.short_name,
        appCode: row.app_code,
        documentTypeCode: row.document_type_code,
        documentTypeNameVi: row.name_vi,
        documentTypeNameEn: row.name_en,
        documentNo: row.document_no,
        amount: trimAmount(row.amount),
        currency: row.currency,
        requestedByName: row.requested_by_name,
        requestedAt: new Date(row.requested_at).toISOString(),
        currentLevelNo: row.current_level_no,
        dueAt: iso(due),
        overdue: due !== null && due.getTime() < now,
      };
    });
    return filters.overdue ? items.filter((item) => item.overdue === (filters.overdue === "true")) : items;
  }

  // API_40: chỉ người lập hoặc người duyệt (hiện tại, trước đây, thuộc vai trò) của yêu cầu; người khác nhận 404.
  async detail(userId: string, requestId: string): Promise<ApprovalRequestResponse> {
    const request = (await this.database.execute<RequestRow>(sql`
      SELECT q.id, q.company_id, c.short_name AS company_short_name, q.document_type_code, t.name_vi, t.name_en, t.app_code, q.document_id, q.document_no,
        q.amount::text AS amount, q.currency, to_char(q.document_date, 'YYYY-MM-DD') AS document_date, q.exchange_rate::text AS exchange_rate,
        q.amount_in_policy_currency::text AS amount_in_policy_currency, p.currency AS policy_currency, q.policy_id, q.status, q.current_level_no,
        q.requested_by, u.full_name AS requested_by_name, q.requested_at, q.completed_at
      FROM core.approval_requests q JOIN core.companies c ON c.id = q.company_id JOIN core.document_types t ON t.code = q.document_type_code
      JOIN core.approval_policies p ON p.id = q.policy_id JOIN core.users u ON u.id = q.requested_by
      WHERE q.id = ${requestId}
        AND (q.requested_by = ${userId}
          OR EXISTS (SELECT 1 FROM core.notifications n WHERE n.user_id = ${userId} AND n.link = ${link(requestId)})
          OR EXISTS (
          SELECT 1 FROM core.approval_steps s WHERE s.request_id = q.id
            AND (s.assigned_user_id = ${userId} OR s.decided_by = ${userId} OR (s.assigned_role_id IS NOT NULL AND ${this.holdsRole(userId, sql`s.assigned_role_id`, sql`q.company_id`)}))))`)).rows[0];
    if (!request) throw new ApiError("NOT_FOUND", "notFound");
    const steps = (await this.database.execute<StepRow>(sql`
      SELECT s.level_no, s.assigned_user_id, au.full_name AS assigned_user_name, s.assigned_role_id, r.name_vi AS assigned_role_name, s.is_substitute,
        s.started_at, l.due_hours, s.decision, du.full_name AS decided_by_name, s.decided_at, s.comment
      FROM core.approval_steps s
      JOIN core.approval_policy_levels l ON l.policy_id = ${request.policy_id} AND l.level_no = s.level_no
      LEFT JOIN core.users au ON au.id = s.assigned_user_id LEFT JOIN core.roles r ON r.id = s.assigned_role_id LEFT JOIN core.users du ON du.id = s.decided_by
      WHERE s.request_id = ${requestId} ORDER BY s.level_no`)).rows;
    const now = this.clock.now().getTime();
    const canDecide = (await this.database.execute(sql`
      SELECT 1 FROM core.approval_requests q JOIN core.approval_steps s ON s.request_id = q.id WHERE q.id = ${requestId} AND ${this.waitingFor(userId)}`)).rows.length > 0;
    return {
      id: request.id,
      companyId: request.company_id,
      companyShortName: request.company_short_name,
      documentTypeCode: request.document_type_code,
      documentTypeNameVi: request.name_vi,
      documentTypeNameEn: request.name_en,
      appCode: request.app_code,
      documentId: request.document_id,
      documentNo: request.document_no,
      amount: trimAmount(request.amount),
      currency: request.currency,
      documentDate: request.document_date,
      exchangeRate: request.exchange_rate,
      amountInPolicyCurrency: request.amount_in_policy_currency,
      policyCurrency: request.policy_currency,
      status: request.status,
      currentLevelNo: request.current_level_no,
      requestedById: request.requested_by,
      requestedByName: request.requested_by_name,
      requestedAt: new Date(request.requested_at).toISOString(),
      completedAt: iso(request.completed_at),
      steps: steps.map((step): ApprovalStepResponse => {
        const due = step.decision === null ? dueAt(step.started_at, step.due_hours) : null;
        return {
          levelNo: step.level_no,
          assignedUserId: step.assigned_user_id,
          assignedUserName: step.assigned_user_name,
          assignedRoleId: step.assigned_role_id,
          assignedRoleName: step.assigned_role_name,
          isSubstitute: step.is_substitute,
          startedAt: iso(step.started_at),
          dueAt: iso(due),
          overdue: due !== null && request.status === "pending" && due.getTime() < now,
          decision: step.decision,
          decidedByName: step.decided_by_name,
          decidedAt: iso(step.decided_at),
          comment: step.comment,
        };
      }),
      canDecide,
      canWithdraw: request.status === "pending" && request.requested_by === userId && steps[0]?.decision === null,
    };
  }

  // API_41: chỉ người duyệt cấp hiện tại; từ chối phải có lý do; cấp cuối đồng ý hoặc một cấp từ chối thì kết thúc (QUYTAC_NGHIEPVU_22).
  async decide(userId: string, requestId: string, decision: "approved" | "rejected", comment: string | null | undefined): Promise<ApprovalRequestResponse> {
    const request = (await this.database.execute<{ status: string; company_id: string; current_level_no: number; requested_by: string; document_no: string; document_type_code: string; document_id: string; app_code: string }>(sql`
      SELECT q.status, q.company_id, q.current_level_no, q.requested_by, q.document_no, q.document_type_code, q.document_id, t.app_code
      FROM core.approval_requests q JOIN core.document_types t ON t.code = q.document_type_code WHERE q.id = ${requestId}`)).rows[0];
    await this.detail(userId, requestId);
    if (!request) throw new ApiError("NOT_FOUND", "notFound");
    if (request.status !== "pending") throw new ApiError("BUSINESS_RULE", "requestNotPending");
    const allowed = await this.database.execute(sql`SELECT 1 FROM core.approval_requests q JOIN core.approval_steps s ON s.request_id = q.id WHERE q.id = ${requestId} AND ${this.waitingFor(userId)}`);
    if (allowed.rows.length === 0) throw new ApiError("FORBIDDEN", "forbidden");
    if (decision === "rejected" && !comment?.trim()) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { comment: "rejectReasonRequired" } });

    const now = this.clock.now().toISOString();
    await this.database.transaction(async (transaction) => {
      // Ghi có điều kiện để hai người cùng vai trò bấm cùng lúc chỉ một quyết định được nhận.
      const updated = await transaction.execute(sql`
        UPDATE core.approval_steps SET decision = ${decision}, decided_by = ${userId}, decided_at = ${now}::timestamptz, comment = ${comment?.trim() || null}
        WHERE request_id = ${requestId} AND level_no = ${request.current_level_no} AND decision IS NULL RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("BUSINESS_RULE", "requestNotPending");
      const next = (await transaction.execute<{ level_no: number }>(sql`
        SELECT level_no FROM core.approval_steps WHERE request_id = ${requestId} AND level_no > ${request.current_level_no} ORDER BY level_no LIMIT 1`)).rows[0];
      if (decision === "approved" && next) {
        await transaction.execute(sql`UPDATE core.approval_steps SET started_at = ${now}::timestamptz WHERE request_id = ${requestId} AND level_no = ${next.level_no}`);
        await transaction.execute(sql`UPDATE core.approval_requests SET current_level_no = ${next.level_no} WHERE id = ${requestId}`);
        await this.notifyStep(transaction, requestId, next.level_no, "approval.assigned", `Chứng từ ${request.document_no} chờ bạn duyệt`);
      } else {
        await transaction.execute(sql`UPDATE core.approval_requests SET status = ${decision}, current_level_no = NULL, completed_at = ${now}::timestamptz WHERE id = ${requestId}`);
        // QUYTAC_NGHIEPVU_25: báo mini app sở hữu qua sự kiện; Nền tảng không sửa chứng từ.
        await recordEvent(transaction, "core.approval.completed", "approval_request", requestId, request.company_id, {
          requestId,
          documentTypeCode: request.document_type_code,
          documentId: request.document_id,
          status: decision,
        });
        await notify(transaction, [
          {
            userId: request.requested_by,
            companyId: request.company_id,
            kind: "approval.completed",
            title: `Chứng từ ${request.document_no} ${decision === "approved" ? "đã được duyệt" : "bị từ chối"}`,
            link: link(requestId),
          },
        ]);
      }
      await this.auditService.record(
        { actorUserId: userId, companyId: request.company_id, appCode: request.app_code, action: `approval_request.${decision}`, entityType: "approval_request", entityId: requestId, afterData: { levelNo: request.current_level_no, comment } },
        transaction,
      );
    });
    return this.detail(userId, requestId);
  }

  // API_42: người lập rút lại khi cấp 1 chưa quyết định (QUYTAC_NGHIEPVU_23).
  async withdraw(userId: string, requestId: string): Promise<ApprovalRequestResponse> {
    const request = await this.detail(userId, requestId);
    if (request.requestedById !== userId) throw new ApiError("FORBIDDEN", "forbidden");
    if (request.status !== "pending") throw new ApiError("BUSINESS_RULE", "requestNotPending");
    if (request.steps[0]?.decision !== null) throw new ApiError("BUSINESS_RULE", "withdrawNotAllowed");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.approval_requests SET status = 'withdrawn', current_level_no = NULL, completed_at = ${this.clock.now().toISOString()}::timestamptz
        WHERE id = ${requestId} AND status = 'pending'
          AND NOT EXISTS (SELECT 1 FROM core.approval_steps WHERE request_id = ${requestId} AND level_no = 1 AND decision IS NOT NULL)
        RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("BUSINESS_RULE", "withdrawNotAllowed");
      await recordEvent(transaction, "core.approval.completed", "approval_request", requestId, request.companyId, {
        requestId,
        documentTypeCode: request.documentTypeCode,
        documentId: request.documentId,
        status: "withdrawn",
      });
      await this.auditService.record({ actorUserId: userId, companyId: request.companyId, appCode: request.appCode, action: "approval_request.withdraw", entityType: "approval_request", entityId: requestId }, transaction);
    });
    return this.detail(userId, requestId);
  }

  // Số yêu cầu đang chờ nhân viên theo mini app, và 5 yêu cầu mới nhất (trang chủ, API_19).
  async summary(userId: string, companyId: string): Promise<{ countsByApp: Map<string, number>; latest: ApprovalInboxItem[] }> {
    const items = await this.inbox(userId, {});
    const countsByApp = new Map<string, number>();
    for (const item of items.filter((entry) => entry.companyId === companyId)) countsByApp.set(item.appCode, (countsByApp.get(item.appCode) ?? 0) + 1);
    return { countsByApp, latest: [...items].reverse().slice(0, 5) };
  }

  // Tác vụ nền mỗi 15 phút (CHUC_NANG_18; QUYTAC_NGHIEPVU_21): quá thời hạn thì nhắc một lần; quá gấp đôi thì chuyển người thay thế.
  async processOverdue(): Promise<{ reminded: number; escalated: number; blocked: number }> {
    const now = this.clock.now();
    const rows = (await this.database.execute<{ request_id: string; company_id: string; document_no: string; requested_by: string; level_no: number; started_at: Date; reminded_at: Date | null; escalated_at: Date | null; due_hours: number; assigned_user_id: string | null; substitute_role_id: string | null; substitute_user_id: string | null; is_substitute: boolean }>(sql`
      SELECT q.id AS request_id, q.company_id, q.document_no, q.requested_by, s.level_no, s.started_at, s.reminded_at, s.escalated_at, l.due_hours,
        s.assigned_user_id, l.substitute_role_id, l.substitute_user_id, s.is_substitute
      FROM core.approval_requests q
      JOIN core.approval_steps s ON s.request_id = q.id AND s.level_no = q.current_level_no AND s.decision IS NULL
      JOIN core.approval_policy_levels l ON l.policy_id = q.policy_id AND l.level_no = s.level_no
      WHERE q.status = 'pending' AND s.started_at IS NOT NULL
        AND s.started_at + make_interval(hours => l.due_hours) < ${now.toISOString()}::timestamptz`)).rows;
    const result = { reminded: 0, escalated: 0, blocked: 0 };
    for (const row of rows) {
      const elapsedHours = (now.getTime() - new Date(row.started_at).getTime()) / 3600_000;
      await this.database.transaction(async (transaction) => {
        if (row.reminded_at === null) {
          const claimed = await transaction.execute(sql`UPDATE core.approval_steps SET reminded_at = ${now.toISOString()}::timestamptz WHERE request_id = ${row.request_id} AND level_no = ${row.level_no} AND reminded_at IS NULL RETURNING id`);
          if (claimed.rows.length > 0) {
            await this.notifyStep(transaction, row.request_id, row.level_no, "approval.reminder", `Nhắc: chứng từ ${row.document_no} đã quá hạn duyệt`);
            result.reminded += 1;
          }
        }
        if (elapsedHours <= row.due_hours * 2 || row.escalated_at !== null || row.is_substitute) return;
        const claimed = await transaction.execute(sql`UPDATE core.approval_steps SET escalated_at = ${now.toISOString()}::timestamptz WHERE request_id = ${row.request_id} AND level_no = ${row.level_no} AND escalated_at IS NULL RETURNING id`);
        if (claimed.rows.length === 0) return;
        const substituteIsRequester = row.substitute_user_id === row.requested_by || (row.substitute_role_id !== null && (await this.onlyHolderIsRequester(transaction, row.company_id, row.requested_by, row.substitute_role_id)));
        if (substituteIsRequester) {
          // Người thay thế cũng là người lập: không chuyển, báo quản trị công ty (CHUC_NANG_18).
          await this.notifyAdmins(transaction, row.company_id, row.request_id, `Chứng từ ${row.document_no} quá hạn nhưng người thay thế là người lập`);
          result.blocked += 1;
          return;
        }
        const previous = await this.stepRecipients(transaction, row.request_id, row.level_no);
        await transaction.execute(sql`
          UPDATE core.approval_steps SET assigned_role_id = ${row.substitute_role_id}, assigned_user_id = ${row.substitute_user_id}, is_substitute = true
          WHERE request_id = ${row.request_id} AND level_no = ${row.level_no}`);
        await notify(transaction, previous.map((userId) => ({ userId, companyId: row.company_id, kind: "approval.escalated", title: `Chứng từ ${row.document_no} đã chuyển cho người duyệt thay thế`, link: link(row.request_id) })));
        await this.notifyStep(transaction, row.request_id, row.level_no, "approval.assigned", `Chứng từ ${row.document_no} quá hạn được chuyển cho bạn duyệt`);
        await this.auditService.record(
          { actorUserId: null, companyId: row.company_id, appCode: "platform", action: "approval_request.escalate", entityType: "approval_request", entityId: row.request_id, beforeData: { assignedUserId: row.assigned_user_id }, afterData: { substituteRoleId: row.substitute_role_id, substituteUserId: row.substitute_user_id } },
          transaction,
        );
        result.escalated += 1;
      });
    }
    return result;
  }

  // Người nhận thông báo của một bước: người được giao, hoặc mọi người giữ vai trò được giao (trừ người lập).
  private async stepRecipients(executor: Pick<Database, "execute">, requestId: string, levelNo: number): Promise<string[]> {
    const day = this.permissionService.today();
    const rows = await executor.execute<{ user_id: string }>(sql`
      SELECT s.assigned_user_id AS user_id FROM core.approval_steps s JOIN core.approval_requests q ON q.id = s.request_id
      WHERE s.request_id = ${requestId} AND s.level_no = ${levelNo} AND s.assigned_user_id IS NOT NULL AND s.assigned_user_id <> q.requested_by
      UNION
      SELECT DISTINCT a.user_id FROM core.approval_steps s JOIN core.approval_requests q ON q.id = s.request_id
      JOIN core.user_role_assignments a ON a.role_id = s.assigned_role_id AND (a.scope_type = 'group' OR a.company_id = q.company_id)
        AND a.valid_from <= ${day}::date AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)
      WHERE s.request_id = ${requestId} AND s.level_no = ${levelNo} AND a.user_id <> q.requested_by`);
    return rows.rows.map((row) => row.user_id);
  }

  private async notifyStep(executor: Pick<Database, "execute">, requestId: string, levelNo: number, kind: string, title: string): Promise<void> {
    const companyId = (await executor.execute<{ company_id: string }>(sql`SELECT company_id FROM core.approval_requests WHERE id = ${requestId}`)).rows[0]!.company_id;
    const recipients = await this.stepRecipients(executor, requestId, levelNo);
    await notify(executor, recipients.map((userId): NotificationInput => ({ userId, companyId, kind, title, link: link(requestId) })));
  }

  // Quản trị công ty: người có quyền cấu hình chính sách duyệt ở phạm vi cả công ty.
  private async notifyAdmins(executor: Pick<Database, "execute">, companyId: string, requestId: string, title: string): Promise<void> {
    const day = this.permissionService.today();
    const admins = await executor.execute<{ user_id: string }>(sql`
      SELECT DISTINCT a.user_id FROM core.user_role_assignments a
      JOIN core.role_permissions rp ON rp.role_id = a.role_id AND rp.permission_code = 'platform.approval_policy.manage'
      WHERE (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${companyId}))
        AND a.valid_from <= ${day}::date AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)`);
    await notify(executor, admins.rows.map((row) => ({ userId: row.user_id, companyId, kind: "approval.escalation_blocked", title, link: link(requestId) })));
  }
}
