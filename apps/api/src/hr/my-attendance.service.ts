// Chấm công của tôi và đơn giải trình công (CONG_VIEC_47; QUYTAC_NGHIEPVU_304, 306; API_152, API_155):
// người có tài khoản liên kết hồ sơ chấm trên ứng dụng (GPS, mạng công ty, mã QR động), xem lịch ca, công tháng, lập đơn giải trình qua luồng duyệt.
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { CorrectionItem, MyAttendanceMonthResponse, MyAttendanceResponse, MyWeekResponse, appPunchSchema, correctionListQuerySchema, createCorrectionSchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { addDays, punchInstants, shiftInterval, vietnamDateOf, vietnamTime } from "./attendance-calculator";
import { attendanceAccess, employeeScope, requireAttendanceView } from "./attendance-access";
import { distanceMeters, normalizeIp, qrTokenValid } from "./attendance-locations.service";
import { AttendanceDaysService, assertMonthsOpen } from "./attendance-days.service";
import { AttendanceSetupService } from "./attendance-setup.service";
import { hrAudit } from "./hr-context";

type Transaction = Pick<Database, "execute" | "insert">;
export const correctionDocumentType = "hr.attendance_correction";
export const attachmentMaximumBytes = 5 * 1024 * 1024;
export type UploadedAttachment = { buffer: Buffer; size: number; originalname: string };
const attachmentTypes: Record<string, { type: string; signature: number[] }> = {
  pdf: { type: "application/pdf", signature: [0x25, 0x50, 0x44, 0x46] },
  jpg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  jpeg: { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  png: { type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
};
// Độ chính xác GPS báo về tối đa được nhận (QUYTAC_NGHIEPVU_304).
const maximumAccuracyMeters = 100;

type MyEmployee = { id: string; code: string; full_name: string; hire_date: string; termination_date: string | null; branch_id: string | null };

const lastDayOfMonth = (month: string) => addDays(`${addDays(`${month}-28`, 4).slice(0, 7)}-01`, -1);
// Giờ:phút theo giờ Việt Nam.
const hhmm = (instant: Date) => new Date(instant.getTime() + 7 * 3_600_000).toISOString().slice(11, 16);

export function attachmentType(file: UploadedAttachment): string {
  if (file.size > attachmentMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooLarge" } });
  const extension = file.originalname.toLowerCase().split(".").pop() ?? "";
  const type = attachmentTypes[extension];
  if (!type || !type.signature.every((byte, index) => file.buffer[index] === byte)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "attachmentTypeInvalid" } });
  return type.type;
}

@Injectable()
export class MyAttendanceService implements OnModuleInit {
  private readonly logger = new Logger("HrCorrections");

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

  // Đơn được duyệt thì tạo lượt chấm nguồn "giải trình", tính lại công; từ chối, rút thì đóng đơn.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (String(event.payload.documentTypeCode) !== correctionDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.transaction(async (transaction) => {
        const row = (
          await transaction.execute<{ id: string }>(sql`
          UPDATE hr.attendance_corrections SET status = ${status}, completed_at = now() WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending' RETURNING id`)
        ).rows[0];
        if (row && status === "approved") await this.apply(transaction, row.id);
      });
    });
  }

  private async apply(transaction: Transaction, correctionId: string): Promise<void> {
    const row = (
      await transaction.execute<{ company_id: string; employee_id: string; work_date: string; check_in: string | null; check_out: string | null; requested_by: string }>(sql`
      SELECT company_id, employee_id, work_date::text, check_in::text, check_out::text, requested_by FROM hr.attendance_corrections WHERE id = ${correctionId}`)
    ).rows[0]!;
    const closed = await transaction.execute(sql`
      SELECT 1 FROM hr.timesheet_periods WHERE company_id = ${row.company_id} AND status = 'closed' AND year = ${Number(row.work_date.slice(0, 4))} AND month = ${Number(row.work_date.slice(5, 7))}`);
    if (closed.rows.length > 0) {
      this.logger.warn(`Đơn giải trình ${correctionId} duyệt sau khi chốt bảng công; không ghi lượt chấm.`);
      return;
    }
    const planned = (await this.days.calendars(transaction, row.company_id, [row.employee_id], row.work_date, row.work_date)).get(row.employee_id)!.days[0]!;
    for (const instant of punchInstants(planned, row.check_in?.slice(0, 5), row.check_out?.slice(0, 5))) {
      await transaction.execute(sql`
        INSERT INTO hr.attendance_punches (company_id, employee_id, punched_at, source, correction_id, created_by)
        VALUES (${row.company_id}, ${row.employee_id}, ${instant.toISOString()}::timestamptz, 'correction', ${correctionId}, ${row.requested_by}) ON CONFLICT DO NOTHING`);
    }
    await this.days.recalculate(transaction, row.company_id, [row.employee_id], addDays(row.work_date, -1), addDays(row.work_date, 1));
  }

  // Hồ sơ đang làm liên kết với tài khoản ở công ty đang chọn; null nếu chưa liên kết.
  private async myEmployee(executor: Pick<Database, "execute">, actor: Actor, lock = false): Promise<MyEmployee | null> {
    const today = this.days.today();
    return (
      (
        await executor.execute<MyEmployee>(sql`
        SELECT e.id, e.code, e.full_name, e.hire_date::text, e.termination_date::text,
          (SELECT w.branch_id FROM hr.work_events w WHERE w.employee_id = e.id AND w.branch_id IS NOT NULL AND w.effective_date <= GREATEST(${today}::date, e.hire_date) ORDER BY w.effective_date DESC LIMIT 1) AS branch_id
        FROM hr.employees e WHERE e.company_id = ${actor.companyId} AND e.user_id = ${actor.userId} AND e.status = 'active'${lock ? sql` FOR UPDATE` : sql``}`)
      ).rows[0] ?? null
    );
  }

  private async requireMyEmployee(executor: Pick<Database, "execute">, actor: Actor, lock = false): Promise<MyEmployee> {
    const employee = await this.myEmployee(executor, actor, lock);
    if (!employee) throw new ApiError("FORBIDDEN", "noLinkedEmployee");
    return employee;
  }

  private async allowedLocations(actor: Actor, employee: MyEmployee) {
    const settings = await this.setup.settingsOf(this.database, actor.companyId);
    const rows = await this.database.execute<{
      id: string;
      name: string;
      latitude: string | null;
      longitude: string | null;
      radius_meters: number | null;
      has_ip: boolean;
      ip_match: boolean;
      qr_enabled: boolean;
    }>(sql`
      SELECT id, name, latitude::text, longitude::text, radius_meters, cardinality(ip_ranges) > 0 AS has_ip,
        COALESCE(${normalizeIp(actor.client.ip)}::inet <<= ANY(ip_ranges), false) AS ip_match, qr_enabled
      FROM hr.attendance_locations
      WHERE company_id = ${actor.companyId} AND status = 'active'${settings.appLocationScope === "branch" ? sql` AND branch_id = ${employee.branch_id}` : sql``}
      ORDER BY name`);
    return rows.rows;
  }

  async today(actor: Actor): Promise<MyAttendanceResponse> {
    const access = await attendanceAccess(this.permissionService, this.database, actor);
    const today = this.days.today();
    const employee = await this.myEmployee(this.database, actor);
    const base = { today, canViewTeam: access.managedDepartmentIds.length > 0 || access.viewAll, canViewCompany: access.viewAll };
    if (!employee) return { ...base, employee: null, shift: null, holiday: false, punches: [], nextAction: "in", locations: [], networkMatched: false };
    const planned = (await this.days.calendars(this.database, actor.companyId, [employee.id], today, today)).get(employee.id)!.days[0]!;
    const interval = planned.shift ? shiftInterval(today, planned.shift) : null;
    const from = interval ? new Date(interval[0] - 4 * 3_600_000) : vietnamTime(today, "00:00");
    const to = interval ? new Date(interval[1] + 8 * 3_600_000) : vietnamTime(addDays(today, 1), "00:00");
    const punches = await this.database.execute<{ punched_at: Date; source: MyAttendanceResponse["punches"][number]["source"]; method: "gps" | "ip" | "qr" | null; location_name: string | null }>(sql`
      SELECT p.punched_at, p.source, p.method, l.name AS location_name FROM hr.attendance_punches p LEFT JOIN hr.attendance_locations l ON l.id = p.location_id
      WHERE p.employee_id = ${employee.id} AND p.deleted_at IS NULL AND p.punched_at >= ${from.toISOString()}::timestamptz AND p.punched_at < ${to.toISOString()}::timestamptz ORDER BY p.punched_at`);
    const locations = await this.allowedLocations(actor, employee);
    return {
      ...base,
      employee: { id: employee.id, code: employee.code, fullName: employee.full_name },
      shift: planned.shift && interval ? { code: planned.shift.code, start: hhmm(new Date(interval[0])), end: hhmm(new Date(interval[1])) } : null,
      holiday: planned.holiday,
      punches: punches.rows.map((row) => ({ punchedAt: new Date(row.punched_at).toISOString(), source: row.source, method: row.method, locationName: row.location_name })),
      nextAction: punches.rows.length === 0 ? "in" : "out",
      locations: locations.map((row) => ({
        id: row.id,
        name: row.name,
        gps: row.latitude !== null,
        ip: row.has_ip,
        qr: row.qr_enabled,
        latitude: row.latitude === null ? null : Number(row.latitude),
        longitude: row.longitude === null ? null : Number(row.longitude),
        radiusMeters: row.radius_meters,
      })),
      networkMatched: locations.some((row) => row.ip_match),
    };
  }

  // Chấm công trên ứng dụng: nhận khi đạt một cách đang bật của địa điểm được phép; ưu tiên mã QR, rồi mạng công ty, rồi GPS.
  async punch(actor: Actor, input: z.output<typeof appPunchSchema>): Promise<MyAttendanceResponse> {
    const employee = await this.requireMyEmployee(this.database, actor);
    const now = this.clock.now();
    const today = this.days.today();
    if (today < employee.hire_date) throw new ApiError("BUSINESS_RULE", "punchOutsideEmployment");
    const locations = await this.allowedLocations(actor, employee);
    let accepted: { method: "gps" | "ip" | "qr"; locationId: string } | null = null;
    if (input.qrToken && input.locationId) {
      const location = locations.find((row) => row.id === input.locationId && row.qr_enabled);
      if (location && qrTokenValid(location.id, input.qrToken, now)) accepted = { method: "qr", locationId: location.id };
      else throw new ApiError("BUSINESS_RULE", "qrInvalid");
    }
    if (!accepted) {
      const network = locations.find((row) => row.ip_match);
      if (network) accepted = { method: "ip", locationId: network.id };
    }
    if (!accepted && input.latitude != null && input.longitude != null && input.accuracyMeters != null && input.accuracyMeters <= maximumAccuracyMeters) {
      const nearby = locations.find((row) => row.latitude !== null && distanceMeters(Number(row.latitude), Number(row.longitude), input.latitude!, input.longitude!) <= row.radius_meters!);
      if (nearby) accepted = { method: "gps", locationId: nearby.id };
    }
    if (!accepted) throw new ApiError("BUSINESS_RULE", locations.length === 0 ? "noAttendanceLocation" : "checkInLocationRejected");
    const minute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
    await this.database.transaction(async (transaction) => {
      await this.requireMyEmployee(transaction, actor, true);
      await assertMonthsOpen(transaction, actor.companyId, [vietnamDateOf(minute)]);
      const recent = await transaction.execute(sql`
        SELECT 1 FROM hr.attendance_punches WHERE employee_id = ${employee.id} AND source = 'app' AND deleted_at IS NULL AND punched_at > ${new Date(minute.getTime() - 60_000).toISOString()}::timestamptz`);
      if (recent.rows.length > 0) throw new ApiError("BUSINESS_RULE", "punchTooSoon");
      const gps = accepted!.method === "gps";
      const inserted = await transaction.execute(sql`
        INSERT INTO hr.attendance_punches (company_id, employee_id, punched_at, source, method, location_id, latitude, longitude, accuracy_meters, ip_address, created_by)
        VALUES (${actor.companyId}, ${employee.id}, ${minute.toISOString()}::timestamptz, 'app', ${accepted!.method}, ${accepted!.locationId},
          ${gps ? input.latitude! : null}, ${gps ? input.longitude! : null}, ${gps ? input.accuracyMeters! : null}, ${normalizeIp(actor.client.ip)}::inet, ${actor.userId})
        ON CONFLICT DO NOTHING RETURNING id`);
      if (inserted.rows.length === 0) throw new ApiError("BUSINESS_RULE", "punchTooSoon");
      const date = vietnamDateOf(minute);
      await this.days.recalculate(transaction, actor.companyId, [employee.id], addDays(date, -1), date);
    });
    return this.today(actor);
  }

  async month(actor: Actor, month: string): Promise<MyAttendanceMonthResponse> {
    const employee = await this.requireMyEmployee(this.database, actor);
    const rows = await this.database.execute<{
      work_date: string;
      status: MyAttendanceMonthResponse["days"][number]["status"];
      day_kind: MyAttendanceMonthResponse["days"][number]["dayKind"];
      shift_code: string | null;
      planned_units: string;
      worked_units: string;
      late_minutes: number;
      early_minutes: number;
      leave_units: string;
      leave_pay_group: MyAttendanceMonthResponse["days"][number]["leavePayGroup"];
      first_in: Date | null;
      last_out: Date | null;
    }>(sql`
      SELECT work_date::text, status, day_kind, shift_code, planned_units::text, worked_units::text, late_minutes, early_minutes, leave_units::text, leave_pay_group, first_in, last_out
      FROM hr.attendance_days WHERE employee_id = ${employee.id} AND work_date BETWEEN ${`${month}-01`}::date AND ${lastDayOfMonth(month)}::date ORDER BY work_date`);
    const days = rows.rows.map((row) => ({
      date: row.work_date,
      status: row.status,
      dayKind: row.day_kind,
      shiftCode: row.shift_code,
      plannedUnits: Number(row.planned_units).toFixed(2),
      workedUnits: Number(row.worked_units).toFixed(2),
      lateMinutes: row.late_minutes,
      earlyMinutes: row.early_minutes,
      leaveUnits: Number(row.leave_units).toFixed(2),
      leavePayGroup: row.leave_pay_group,
      firstIn: row.first_in ? new Date(row.first_in).toISOString() : null,
      lastOut: row.last_out ? new Date(row.last_out).toISOString() : null,
    }));
    return {
      month,
      days,
      workedUnits: days.reduce((total, day) => total + Number(day.workedUnits), 0).toFixed(2),
      lateCount: days.filter((day) => day.lateMinutes > 0).length,
      lateMinutes: days.reduce((total, day) => total + day.lateMinutes, 0),
    };
  }

  async week(actor: Actor, weekStart: string): Promise<MyWeekResponse> {
    const employee = await this.requireMyEmployee(this.database, actor);
    const calendar = (await this.days.calendars(this.database, actor.companyId, [employee.id], weekStart, addDays(weekStart, 6))).get(employee.id)!;
    return {
      weekStart,
      days: calendar.days.map((day) => {
        const interval = day.shift ? shiftInterval(day.date, day.shift) : null;
        return {
          date: day.date,
          shiftCode: day.holiday ? null : (day.shift?.code ?? null),
          start: interval && !day.holiday ? hhmm(new Date(interval[0])) : null,
          end: interval && !day.holiday ? hhmm(new Date(interval[1])) : null,
          holiday: day.holiday,
        };
      }),
    };
  }

  // ---- Đơn giải trình ----

  private select(condition: SQL): SQL {
    return sql`
      SELECT c.id, c.correction_no, c.employee_id, e.code AS employee_code, e.full_name AS employee_name, c.work_date::text, c.kind, c.check_in::text, c.check_out::text,
        c.reason, c.attachment_key IS NOT NULL AS has_attachment, c.status, c.approval_request_id, c.requested_at, c.requested_by
      FROM hr.attendance_corrections c JOIN hr.employees e ON e.id = c.employee_id WHERE ${condition} ORDER BY c.requested_at DESC LIMIT 200`;
  }

  private async items(condition: SQL, actorUserId: string): Promise<CorrectionItem[]> {
    const rows = await this.database.execute<{
      id: string;
      correction_no: string | null;
      employee_id: string;
      employee_code: string;
      employee_name: string;
      work_date: string;
      kind: CorrectionItem["kind"];
      check_in: string | null;
      check_out: string | null;
      reason: string;
      has_attachment: boolean;
      status: CorrectionItem["status"];
      approval_request_id: string | null;
      requested_at: Date;
      requested_by: string;
    }>(this.select(condition));
    return rows.rows.map((row) => ({
      id: row.id,
      correctionNo: row.correction_no,
      employeeId: row.employee_id,
      employeeCode: row.employee_code,
      employeeName: row.employee_name,
      workDate: row.work_date,
      kind: row.kind,
      checkIn: row.check_in?.slice(0, 5) ?? null,
      checkOut: row.check_out?.slice(0, 5) ?? null,
      reason: row.reason,
      hasAttachment: row.has_attachment,
      status: row.status,
      approvalRequestId: row.approval_request_id,
      requestedAt: new Date(row.requested_at).toISOString(),
      canWithdraw: row.status === "pending" && row.requested_by === actorUserId && row.approval_request_id !== null,
    }));
  }

  async myCorrections(actor: Actor): Promise<CorrectionItem[]> {
    const employee = await this.requireMyEmployee(this.database, actor);
    return this.items(sql`c.employee_id = ${employee.id}`, actor.userId);
  }

  async corrections(actor: Actor, query: z.output<typeof correctionListQuerySchema>): Promise<CorrectionItem[]> {
    const access = await attendanceAccess(this.permissionService, this.database, actor);
    requireAttendanceView(access);
    const conditions = [sql`c.company_id = ${actor.companyId}`, employeeScope(access, this.days.today())];
    if (query.status) conditions.push(sql`c.status = ${query.status}`);
    if (query.month) conditions.push(sql`c.work_date BETWEEN ${`${query.month}-01`}::date AND ${lastDayOfMonth(query.month)}::date`);
    return this.items(sql.join(conditions, sql` AND `), actor.userId);
  }

  async createCorrection(actor: Actor, input: z.output<typeof createCorrectionSchema>, file: UploadedAttachment | undefined): Promise<CorrectionItem> {
    const employee = await this.requireMyEmployee(this.database, actor);
    const today = this.days.today();
    if (input.workDate > today || input.workDate < employee.hire_date) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { workDate: "punchOutsideEmployment" } });
    const contentType = file ? attachmentType(file) : null;
    const settings = await this.setup.settingsOf(this.database, actor.companyId);
    await ensureSequence(this.database, this.sequences, actor, correctionDocumentType, "GT");
    const storageKey = file ? `hr/attendance-corrections/${actor.companyId}/${randomUUID()}` : null;
    if (file && storageKey) await this.storage.put(storageKey, file.buffer, contentType!);
    let id: string;
    try {
      id = await this.database.transaction(async (transaction) => {
        await this.requireMyEmployee(transaction, actor, true);
        await assertMonthsOpen(transaction, actor.companyId, [input.workDate]);
        if (settings.correctionMonthlyLimit > 0) {
          const used = await transaction.execute<{ total: number }>(sql`
            SELECT count(*)::integer AS total FROM hr.attendance_corrections WHERE employee_id = ${employee.id} AND status IN ('pending', 'approved')
              AND date_trunc('month', work_date) = date_trunc('month', ${input.workDate}::date)`);
          if (used.rows[0]!.total >= settings.correctionMonthlyLimit) throw new ApiError("BUSINESS_RULE", "correctionLimitReached");
        }
        const correctionNo = await this.sequences.next(actor.companyId, correctionDocumentType, transaction);
        const inserted = await transaction.execute<{ id: string }>(sql`
          INSERT INTO hr.attendance_corrections (company_id, employee_id, correction_no, work_date, kind, check_in, check_out, reason, attachment_key, attachment_name, attachment_type, requested_by)
          VALUES (${actor.companyId}, ${employee.id}, ${correctionNo}, ${input.workDate}::date, ${input.kind}, ${input.checkIn ?? null}::time, ${input.checkOut ?? null}::time,
            ${input.reason}, ${storageKey}, ${file?.originalname.slice(0, 200) ?? null}, ${contentType}, ${actor.userId}) RETURNING id`);
        const correctionId = inserted.rows[0]!.id;
        let requestId: string | null = null;
        try {
          requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
            documentTypeCode: correctionDocumentType,
            documentId: correctionId,
            documentNo: correctionNo,
            amount: "1",
            currency: await companyCurrency(transaction, actor.companyId),
            documentDate: today,
          });
        } catch (error) {
          if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
        }
        await transaction.execute(sql`
          UPDATE hr.attendance_corrections SET approval_request_id = ${requestId}, status = ${requestId ? "pending" : "approved"}, completed_at = ${requestId ? null : this.clock.now().toISOString()}::timestamptz
          WHERE id = ${correctionId}`);
        // Công ty chưa có chính sách duyệt: gửi xong là duyệt (QUYTAC_NGHIEPVU_306).
        if (!requestId) await this.apply(transaction, correctionId);
        await this.auditService.record(
          {
            ...hrAudit(actor, "attendance_correction"),
            action: "attendance_correction.submit",
            entityId: correctionId,
            beforeData: null,
            afterData: { ...input, correctionNo, approvalRequestId: requestId },
          },
          transaction,
        );
        return correctionId;
      });
    } catch (error) {
      if (storageKey) await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
    return (await this.items(sql`c.id = ${id}`, actor.userId))[0]!;
  }

  async withdrawCorrection(actor: Actor, id: string): Promise<CorrectionItem> {
    const employee = await this.requireMyEmployee(this.database, actor);
    const row = (
      await this.database.execute<{ approval_request_id: string | null; status: string; requested_by: string }>(sql`
      SELECT approval_request_id, status, requested_by FROM hr.attendance_corrections WHERE id = ${id} AND employee_id = ${employee.id}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.status !== "pending" || !row.approval_request_id || row.requested_by !== actor.userId) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE hr.attendance_corrections SET status = 'withdrawn', completed_at = now() WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...hrAudit(actor, "attendance_correction"), action: "attendance_correction.withdraw", entityId: id }, transaction);
    });
    return (await this.items(sql`c.id = ${id}`, actor.userId))[0]!;
  }

  // Tệp đính kèm: chính người lao động, trưởng phòng hoặc người xem chấm công công ty.
  async attachment(actor: Actor, id: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const access = await attendanceAccess(this.permissionService, this.database, actor);
    const mine = await this.myEmployee(this.database, actor);
    const row = (
      await this.database.execute<{ attachment_key: string | null; attachment_name: string | null; attachment_type: string | null }>(sql`
      SELECT c.attachment_key, c.attachment_name, c.attachment_type FROM hr.attendance_corrections c JOIN hr.employees e ON e.id = c.employee_id
      WHERE c.id = ${id} AND c.company_id = ${actor.companyId} AND (${mine ? sql`c.employee_id = ${mine.id} OR ` : sql``}${employeeScope(access, this.days.today())})`)
    ).rows[0];
    if (!row?.attachment_key) throw new ApiError("NOT_FOUND", "notFound");
    await this.auditService.record({ ...hrAudit(actor, "attendance_correction"), action: "attendance_correction.download", entityId: id });
    return { fileName: row.attachment_name!, contentType: row.attachment_type!, content: await this.storage.get(row.attachment_key) };
  }
}
