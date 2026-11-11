// Tăng ca (CONG_VIEC_47; CHUC_NANG_167; QUYTAC_NGHIEPVU_310; API_154): phiếu đăng ký trước, đồng ý của người lao động, luồng duyệt chung,
// giới hạn theo Bộ luật Lao động Điều 107 và Nghị định 145 Điều 60; giờ được tính theo thời gian có mặt (tính trong công ngày).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { OvertimeItem, OvertimePreviewResponse, OvertimeTotalItem, OvertimeViolation, overtimeBodySchema, overtimeListQuerySchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { notify } from "../common/notifications";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { addDays, nightMinutesOfShift, shiftInterval, standardMinutes, vietnamTime } from "./attendance-calculator";
import { attendanceAccess, attendancePermission, employeeScope, requireAttendanceView, usersWithPermission, type AttendanceAccess } from "./attendance-access";
import { AttendanceDaysService, assertMonthsOpen } from "./attendance-days.service";
import { AttendanceSetupService } from "./attendance-setup.service";
import { ageAt, hrAudit } from "./hr-context";
import { attachmentType, type UploadedAttachment } from "./my-attendance.service";

type Executor = Pick<Database, "execute">;
type Transaction = Pick<Database, "execute" | "insert">;
type Body = z.output<typeof overtimeBodySchema>;
export const overtimeDocumentType = "hr.overtime_request";
// Giới hạn tháng (Điều 107 khoản 2 điểm b); ngày nghỉ, ngày lễ tối đa 12 giờ (Nghị định 145 Điều 60 khoản 4).
const monthLimitHours = 40;
const restDayLimitHours = 12;
const counting = ["awaiting_consent", "pending", "approved"];
const hours2 = (minutes: number) => (Math.round((minutes / 60) * 100) / 100).toFixed(2);

type EmployeeRow = { id: string; code: string; full_name: string; birth_date: string; hire_date: string; termination_date: string | null; user_id: string | null };
type Planned = { interval: [number, number]; dayKind: OvertimePreviewResponse["dayKind"]; standard: number };

@Injectable()
export class OvertimeService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly days: AttendanceDaysService,
    private readonly setup: AttendanceSetupService,
  ) {}

  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (String(event.payload.documentTypeCode) !== overtimeDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.transaction(async (transaction) => {
        const row = (
          await transaction.execute<{ id: string }>(sql`
          UPDATE hr.overtime_requests SET status = ${status}, completed_at = now() WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending' RETURNING id`)
        ).rows[0];
        if (row && status === "approved") await this.takeEffect(transaction, row.id);
      });
    });
  }

  private access(actor: Actor): Promise<AttendanceAccess> {
    return attendanceAccess(this.permissionService, this.database, actor);
  }

  private employeeSelect(condition: SQL): SQL {
    return sql`SELECT e.id, e.code, e.full_name, e.birth_date::text, e.hire_date::text, e.termination_date::text, e.user_id FROM hr.employees e WHERE ${condition}`;
  }

  private async myEmployee(executor: Executor, actor: Actor, lock = false): Promise<EmployeeRow> {
    const row = (
      await executor.execute<EmployeeRow>(sql`${this.employeeSelect(sql`e.company_id = ${actor.companyId} AND e.user_id = ${actor.userId} AND e.status = 'active'`)}${lock ? sql` FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("FORBIDDEN", "noLinkedEmployee");
    return row;
  }

  // Trưởng phòng lập cho người trong phòng mình; nhân sự (quản lý chấm công) cho mọi người.
  private async employeeForManager(executor: Executor, actor: Actor, access: AttendanceAccess, employeeId: string | undefined, lock = false): Promise<EmployeeRow> {
    if (!employeeId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { employeeId: "required" } });
    const scope = access.manage ? sql`TRUE` : employeeScope({ ...access, viewAll: false }, this.days.today());
    const row = (
      await executor.execute<EmployeeRow>(
        sql`${this.employeeSelect(sql`e.id = ${employeeId} AND e.company_id = ${actor.companyId} AND e.status = 'active' AND ${scope}`)}${lock ? sql` FOR UPDATE` : sql``}`,
      )
    ).rows[0];
    if (!row) throw new ApiError("FORBIDDEN", "forbidden");
    return row;
  }

  private async planned(executor: Executor, companyId: string, employeeId: string, workDate: string): Promise<Planned & { shiftStart: number | null; shiftEnd: number | null }> {
    const day = (await this.days.calendars(executor, companyId, [employeeId], workDate, workDate)).get(employeeId)!.days[0]!;
    const dayKind = day.holiday ? "holiday" : day.shift ? "weekday" : "rest_day";
    const interval = day.shift && !day.holiday ? shiftInterval(workDate, day.shift) : null;
    return {
      interval: interval ?? [0, 0],
      dayKind,
      standard: day.shift && !day.holiday ? standardMinutes(day.shift) : 0,
      shiftStart: interval?.[0] ?? null,
      shiftEnd: interval?.[1] ?? null,
    };
  }

  // Khoảng tăng ca: giờ kết thúc không sau giờ bắt đầu là sang ngày hôm sau.
  private window(body: Body): [Date, Date] {
    const start = vietnamTime(body.workDate, body.startTime);
    let end = vietnamTime(body.workDate, body.endTime);
    if (end <= start) end = vietnamTime(addDays(body.workDate, 1), body.endTime);
    return [start, end];
  }

  // Kiểm giới hạn (QUYTAC_NGHIEPVU_310): tính cả phiếu chờ đồng ý, chờ duyệt, đã duyệt.
  private async check(executor: Executor, companyId: string, employee: EmployeeRow, body: Body, excludeId: string | null): Promise<OvertimePreviewResponse> {
    const [start, end] = this.window(body);
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    if (minutes > 12 * 60) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { endTime: "overtimeTooLong" } });
    const planned = await this.planned(executor, companyId, employee.id, body.workDate);
    const settings = await this.setup.settingsOf(executor, companyId);
    const violations: OvertimeViolation[] = [];
    let dayLimit = restDayLimitHours * 60;
    if (planned.dayKind === "weekday") {
      // Ngày thường: không quá 50% giờ chuẩn; quy định theo tuần: giờ chuẩn và tăng ca không quá 12 giờ (Điều 107 khoản 2 điểm b).
      dayLimit = settings.workingTimeMode === "weekly" ? 12 * 60 - planned.standard : Math.floor(planned.standard / 2);
      if (planned.shiftStart !== null && start.getTime() < planned.shiftEnd! && end.getTime() > planned.shiftStart) violations.push("overlapsShift");
    }
    const others = await executor.execute<{ work_date: string; start_at: Date; end_at: Date; hours: string }>(sql`
      SELECT work_date::text, start_at, end_at, hours::text FROM hr.overtime_requests
      WHERE employee_id = ${employee.id} AND status IN (${sql.join(
        counting.map((status) => sql`${status}`),
        sql`, `,
      )}) AND extract(year FROM work_date) = ${Number(body.workDate.slice(0, 4))}${excludeId ? sql` AND id <> ${excludeId}` : sql``}`);
    const sameDay = others.rows.filter((row) => row.work_date === body.workDate);
    if (sameDay.some((row) => start < new Date(row.end_at) && end > new Date(row.start_at))) violations.push("overlapsRequest");
    const dayUsed = sameDay.reduce((total, row) => total + Number(row.hours) * 60, 0);
    if (dayUsed + minutes > dayLimit) violations.push("dayLimit");
    const monthUsed = others.rows.filter((row) => row.work_date.slice(0, 7) === body.workDate.slice(0, 7)).reduce((total, row) => total + Number(row.hours) * 60, 0);
    if (monthUsed + minutes > monthLimitHours * 60) violations.push("monthLimit");
    const yearUsed = others.rows.reduce((total, row) => total + Number(row.hours) * 60, 0);
    if (yearUsed + minutes > settings.overtimeAnnualLimit * 60) violations.push("yearLimit");
    // Người chưa thành niên: chỉ làm thêm trong danh mục của Bộ trưởng (Điều 146 khoản 2); hệ thống chặn.
    if (ageAt(employee.birth_date, body.workDate) < 18) violations.push("minor");
    const night = nightMinutesOfShift(body.workDate, { id: "", code: "", startTime: body.startTime, endTime: body.endTime, breakStart: null, breakMinutes: 0, breakPaid: true, workUnits: 1 });
    return {
      dayKind: planned.dayKind,
      hours: hours2(minutes),
      nightHours: hours2(night),
      dayLimitHours: hours2(dayLimit),
      monthUsedHours: hours2(monthUsed),
      monthLimitHours,
      yearUsedHours: hours2(yearUsed),
      yearLimitHours: settings.overtimeAnnualLimit,
      violations,
    };
  }

  private validateDates(employee: EmployeeRow, body: Body): void {
    if (body.workDate < employee.hire_date || (employee.termination_date && body.workDate > employee.termination_date)) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { workDate: "punchOutsideEmployment" } });
    }
  }

  async preview(actor: Actor, body: Body, self: boolean): Promise<OvertimePreviewResponse> {
    const employee = self ? await this.myEmployee(this.database, actor) : await this.employeeForManager(this.database, actor, await this.access(actor), body.employeeId);
    return this.check(this.database, actor.companyId, employee, body, null);
  }

  private async submitApproval(transaction: Transaction, companyId: string, requesterId: string, id: string, requestNo: string, hours: string): Promise<string | null> {
    try {
      return await this.approvals.submitWithin(transaction, companyId, requesterId, {
        documentTypeCode: overtimeDocumentType,
        documentId: id,
        documentNo: requestNo,
        amount: hours,
        currency: await companyCurrency(transaction, companyId),
        documentDate: this.days.today(),
      });
    } catch (error) {
      if (error instanceof ApiError && error.messageKey === "policyNotFound") return null;
      throw error;
    }
  }

  // Phiếu có hiệu lực: tính lại công ngày; vượt 200 giờ lần đầu trong năm thì nhắc nhân sự thông báo Sở (Nghị định 145 Điều 62).
  private async takeEffect(transaction: Transaction, id: string): Promise<void> {
    const row = (
      await transaction.execute<{ company_id: string; employee_id: string; work_date: string; hours: string; employee_name: string }>(sql`
      SELECT o.company_id, o.employee_id, o.work_date::text, o.hours::text, e.full_name AS employee_name FROM hr.overtime_requests o JOIN hr.employees e ON e.id = o.employee_id WHERE o.id = ${id}`)
    ).rows[0]!;
    await this.days.recalculate(transaction, row.company_id, [row.employee_id], row.work_date, addDays(row.work_date, 1));
    const year = await transaction.execute<{ total: string }>(sql`
      SELECT COALESCE(sum(hours), 0)::text AS total FROM hr.overtime_requests WHERE employee_id = ${row.employee_id} AND status = 'approved' AND extract(year FROM work_date) = ${Number(row.work_date.slice(0, 4))}`);
    const total = Number(year.rows[0]!.total);
    if (total > 200 && total - Number(row.hours) <= 200) {
      const recipients = await usersWithPermission(transaction, row.company_id, attendancePermission.manage, this.days.today());
      await notify(
        transaction,
        recipients.map((userId) => ({
          userId,
          companyId: row.company_id,
          kind: "hr.overtime.over_200",
          title: `${row.employee_name} đã làm thêm trên 200 giờ năm ${row.work_date.slice(0, 4)}: thông báo Sở Lao động – Thương binh và Xã hội trong 15 ngày`,
          link: "/hr/overtime",
          payload: { employeeId: row.employee_id, hours: total },
        })),
      );
    }
  }

  // self: người lao động tự lập (đồng ý ngay, gửi duyệt). Trưởng phòng, nhân sự lập: chờ người lao động đồng ý;
  // người không có tài khoản: nhân sự ghi nhận kèm văn bản đồng ý, có hiệu lực ngay.
  async create(actor: Actor, body: Body, file: UploadedAttachment | undefined, self: boolean): Promise<OvertimeItem> {
    const access = await this.access(actor);
    if (file && !access.manage) throw new ApiError("FORBIDDEN", "forbidden");
    const contentType = file ? attachmentType(file) : null;
    await ensureSequence(this.database, this.sequences, actor, overtimeDocumentType, "TC");
    const storageKey = file ? `hr/overtime/${actor.companyId}/${randomUUID()}` : null;
    if (file && storageKey) await this.storage.put(storageKey, file.buffer, contentType!);
    let id: string;
    try {
      id = await this.database.transaction(async (transaction) => {
        const employee = self ? await this.myEmployee(transaction, actor, true) : await this.employeeForManager(transaction, actor, access, body.employeeId, true);
        this.validateDates(employee, body);
        await assertMonthsOpen(transaction, actor.companyId, [body.workDate]);
        const result = await this.check(transaction, actor.companyId, employee, body, null);
        if (result.violations.length > 0) throw new ApiError("BUSINESS_RULE", `overtime_${result.violations[0]!}` as "overtime_dayLimit");
        if (!self && !file && !employee.user_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "overtimeConsentRequired" } });
        const [start, end] = this.window(body);
        const requestNo = await this.sequences.next(actor.companyId, overtimeDocumentType, transaction);
        const consent = self ? "agreed" : file ? "document" : "pending";
        const inserted = await transaction.execute<{ id: string }>(sql`
          INSERT INTO hr.overtime_requests (company_id, employee_id, request_no, work_date, start_at, end_at, hours, day_kind, work_content, work_location,
            consent_status, consent_at, consent_file_key, consent_file_name, consent_file_type, status, created_by)
          VALUES (${actor.companyId}, ${employee.id}, ${requestNo}, ${body.workDate}::date, ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, ${result.hours}::numeric,
            ${result.dayKind}, ${body.workContent}, ${body.workLocation}, ${consent}, ${consent === "pending" ? null : this.clock.now().toISOString()}::timestamptz,
            ${storageKey}, ${file?.originalname.slice(0, 200) ?? null}, ${contentType}, ${consent === "pending" ? "awaiting_consent" : "pending"}, ${actor.userId}) RETURNING id`);
        const requestId = inserted.rows[0]!.id;
        if (consent === "agreed") await this.afterConsent(transaction, actor.companyId, actor.userId, requestId, requestNo, result.hours);
        if (consent === "document") {
          await transaction.execute(sql`UPDATE hr.overtime_requests SET status = 'approved', completed_at = now() WHERE id = ${requestId}`);
          await this.takeEffect(transaction, requestId);
        }
        if (consent === "pending") {
          await notify(transaction, [
            {
              userId: employee.user_id!,
              companyId: actor.companyId,
              kind: "hr.overtime.consent",
              title: `Đề nghị tăng ca ${requestNo} ngày ${body.workDate.split("-").reverse().join("/")}, ${body.startTime} – ${body.endTime}: cần bạn đồng ý`,
              link: "/hr/my-attendance",
              payload: { requestId },
            },
          ]);
        }
        await this.auditService.record(
          { ...hrAudit(actor, "overtime_request"), action: "overtime_request.create", entityId: requestId, beforeData: null, afterData: { ...body, requestNo, consent } },
          transaction,
        );
        return requestId;
      });
    } catch (error) {
      if (storageKey) await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
    return (await this.items(sql`o.id = ${id}`, actor))[0]!;
  }

  // Sau khi người lao động đồng ý: gửi luồng duyệt với người gửi là người lao động; chưa có chính sách thì duyệt ngay.
  private async afterConsent(transaction: Transaction, companyId: string, employeeUserId: string, id: string, requestNo: string, hours: string): Promise<void> {
    const approvalRequestId = await this.submitApproval(transaction, companyId, employeeUserId, id, requestNo, hours);
    await transaction.execute(sql`
      UPDATE hr.overtime_requests SET approval_request_id = ${approvalRequestId}, status = ${approvalRequestId ? "pending" : "approved"},
        completed_at = ${approvalRequestId ? null : this.clock.now().toISOString()}::timestamptz WHERE id = ${id}`);
    if (!approvalRequestId) await this.takeEffect(transaction, id);
  }

  async consent(actor: Actor, id: string, agree: boolean): Promise<OvertimeItem> {
    const employee = await this.myEmployee(this.database, actor);
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ status: string; request_no: string; work_date: string; start_at: Date; end_at: Date; work_content: string; work_location: string }>(sql`
        SELECT status, request_no, work_date::text, start_at, end_at, work_content, work_location FROM hr.overtime_requests WHERE id = ${id} AND employee_id = ${employee.id} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "awaiting_consent") throw new ApiError("BUSINESS_RULE", "overtimeNotAwaitingConsent");
      if (!agree) {
        await transaction.execute(sql`UPDATE hr.overtime_requests SET consent_status = 'declined', consent_at = now(), status = 'declined', completed_at = now() WHERE id = ${id}`);
      } else {
        // Kiểm lại giới hạn tại thời điểm đồng ý.
        const clock = (instant: Date) => new Date(new Date(instant).getTime() + 7 * 3_600_000).toISOString().slice(11, 16);
        const body = { workDate: row.work_date, startTime: clock(row.start_at), endTime: clock(row.end_at), workContent: row.work_content, workLocation: row.work_location };
        await assertMonthsOpen(transaction, actor.companyId, [row.work_date]);
        const result = await this.check(transaction, actor.companyId, employee, body, id);
        if (result.violations.length > 0) throw new ApiError("BUSINESS_RULE", `overtime_${result.violations[0]!}` as "overtime_dayLimit");
        await transaction.execute(sql`UPDATE hr.overtime_requests SET consent_status = 'agreed', consent_at = now() WHERE id = ${id}`);
        await this.afterConsent(transaction, actor.companyId, actor.userId, id, row.request_no, result.hours);
      }
      await this.auditService.record({ ...hrAudit(actor, "overtime_request"), action: agree ? "overtime_request.agree" : "overtime_request.decline", entityId: id }, transaction);
    });
    return (await this.items(sql`o.id = ${id}`, actor))[0]!;
  }

  async withdraw(actor: Actor, id: string): Promise<OvertimeItem> {
    const employee = await this.myEmployee(this.database, actor);
    const row = (
      await this.database.execute<{ approval_request_id: string | null; status: string }>(sql`
      SELECT approval_request_id, status FROM hr.overtime_requests WHERE id = ${id} AND employee_id = ${employee.id}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.status !== "pending" || !row.approval_request_id) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE hr.overtime_requests SET status = 'withdrawn', completed_at = now() WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...hrAudit(actor, "overtime_request"), action: "overtime_request.withdraw", entityId: id }, transaction);
    });
    return (await this.items(sql`o.id = ${id}`, actor))[0]!;
  }

  // Hủy: người lao động, người lập trước giờ bắt đầu; nhân sự khi kỳ chưa chốt.
  async cancel(actor: Actor, id: string, reason: string): Promise<OvertimeItem> {
    const access = await this.access(actor);
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ employee_id: string; status: string; work_date: string; start_at: Date; created_by: string; user_id: string | null }>(sql`
        SELECT o.employee_id, o.status, o.work_date::text, o.start_at, o.created_by, e.user_id FROM hr.overtime_requests o JOIN hr.employees e ON e.id = o.employee_id
        WHERE o.id = ${id} AND o.company_id = ${actor.companyId} FOR UPDATE OF o`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (!["approved", "awaiting_consent"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "leaveNotCancellable");
      const before = this.clock.now() < new Date(row.start_at);
      const allowed = access.manage || (before && (row.created_by === actor.userId || row.user_id === actor.userId));
      if (!allowed) throw new ApiError("FORBIDDEN", "forbidden");
      await assertMonthsOpen(transaction, actor.companyId, [row.work_date]);
      await transaction.execute(sql`
        UPDATE hr.overtime_requests SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by = ${actor.userId}, cancelled_at = now() WHERE id = ${id}`);
      await this.auditService.record(
        { ...hrAudit(actor, "overtime_request"), action: "overtime_request.cancel", entityId: id, beforeData: { status: row.status }, afterData: { reason } },
        transaction,
      );
      await this.days.recalculate(transaction, actor.companyId, [row.employee_id], row.work_date, addDays(row.work_date, 1));
    });
    return (await this.items(sql`o.id = ${id}`, actor))[0]!;
  }

  private async items(condition: SQL, actor: Actor): Promise<OvertimeItem[]> {
    const access = await this.access(actor);
    const now = this.clock.now();
    const rows = await this.database.execute<{
      id: string;
      request_no: string;
      employee_id: string;
      employee_code: string;
      employee_name: string;
      user_id: string | null;
      work_date: string;
      start_at: Date;
      end_at: Date;
      hours: string;
      day_kind: OvertimeItem["dayKind"];
      work_content: string;
      work_location: string;
      consent_status: OvertimeItem["consentStatus"];
      status: OvertimeItem["status"];
      approval_request_id: string | null;
      created_by: string;
      counted: number | null;
    }>(sql`
      SELECT o.id, o.request_no, o.employee_id, e.code AS employee_code, e.full_name AS employee_name, e.user_id, o.work_date::text, o.start_at, o.end_at, o.hours::text,
        o.day_kind, o.work_content, o.work_location, o.consent_status, o.status, o.approval_request_id, o.created_by,
        CASE WHEN o.status = 'approved' THEN (SELECT d.overtime_day_minutes + d.overtime_night_minutes + d.overtime_night_after_day_minutes FROM hr.attendance_days d
          WHERE d.employee_id = o.employee_id AND d.work_date = o.work_date) END AS counted
      FROM hr.overtime_requests o JOIN hr.employees e ON e.id = o.employee_id WHERE ${condition} ORDER BY o.work_date DESC, o.start_at DESC LIMIT 300`);
    return rows.rows.map((row) => {
      const own = row.user_id === actor.userId;
      const before = now < new Date(row.start_at);
      return {
        id: row.id,
        requestNo: row.request_no,
        employeeId: row.employee_id,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        workDate: row.work_date,
        startAt: new Date(row.start_at).toISOString(),
        endAt: new Date(row.end_at).toISOString(),
        hours: row.hours,
        dayKind: row.day_kind,
        workContent: row.work_content,
        workLocation: row.work_location,
        consentStatus: row.consent_status,
        status: row.status,
        approvalRequestId: row.approval_request_id,
        countedHours: row.counted === null ? null : hours2(row.counted),
        canConsent: own && row.status === "awaiting_consent",
        canWithdraw: own && row.status === "pending" && row.approval_request_id !== null,
        canCancel: ["approved", "awaiting_consent"].includes(row.status) && (access.manage || (before && (own || row.created_by === actor.userId))),
      };
    });
  }

  async list(actor: Actor, query: z.output<typeof overtimeListQuerySchema>): Promise<OvertimeItem[]> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const conditions = [sql`o.company_id = ${actor.companyId}`, employeeScope(access, this.days.today()), sql`to_char(o.work_date, 'YYYY-MM') = ${query.month}`];
    if (query.status) conditions.push(sql`o.status = ${query.status}`);
    return this.items(sql.join(conditions, sql` AND `), actor);
  }

  async mine(actor: Actor): Promise<OvertimeItem[]> {
    const employee = await this.myEmployee(this.database, actor).catch(() => null);
    if (!employee) return [];
    return this.items(sql`o.employee_id = ${employee.id} AND o.work_date >= ${addDays(this.days.today(), -62)}::date`, actor);
  }

  async totals(actor: Actor, month: string): Promise<OvertimeTotalItem[]> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const settings = await this.setup.settingsOf(this.database, actor.companyId);
    const rows = await this.database.execute<{ id: string; code: string; full_name: string; month_hours: string; year_hours: string }>(sql`
      SELECT e.id, e.code, e.full_name,
        COALESCE(sum(o.hours) FILTER (WHERE to_char(o.work_date, 'YYYY-MM') = ${month}), 0)::text AS month_hours,
        COALESCE(sum(o.hours), 0)::text AS year_hours
      FROM hr.employees e JOIN hr.overtime_requests o ON o.employee_id = e.id AND o.status IN ('awaiting_consent', 'pending', 'approved') AND extract(year FROM o.work_date) = ${Number(month.slice(0, 4))}
      WHERE e.company_id = ${actor.companyId} AND ${employeeScope(access, this.days.today())}
      GROUP BY e.id, e.code, e.full_name ORDER BY sum(o.hours) DESC LIMIT 500`);
    return rows.rows.map((row) => ({
      employeeId: row.id,
      code: row.code,
      fullName: row.full_name,
      monthHours: row.month_hours,
      yearHours: row.year_hours,
      monthRemaining: (monthLimitHours - Number(row.month_hours)).toFixed(2),
      yearRemaining: (settings.overtimeAnnualLimit - Number(row.year_hours)).toFixed(2),
    }));
  }
}
