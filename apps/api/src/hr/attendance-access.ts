// Quyền chấm công (CONG_VIEC_47 mục 6): quyền nhân sự bao trùm công ty, hoặc trưởng phòng với phòng mình và phòng con.
import { sql, type SQL } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";
import type { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { hrGranted, positionAt } from "./hr-context";

export const attendancePermission = {
  view: "hr.attendance.view",
  manage: "hr.attendance.manage",
  leave: "hr.leave.manage",
  timesheet: "hr.timesheet.manage",
} as const;

export type AttendanceAccess = {
  granted: Set<string>;
  // Xem mọi hồ sơ của công ty.
  viewAll: boolean;
  manage: boolean;
  // Phòng ban do người dùng quản lý (gồm phòng con); trống nếu không là trưởng phòng.
  managedDepartmentIds: string[];
};

export async function attendanceAccess(permissionService: PermissionService, database: Pick<Database, "execute">, actor: Actor): Promise<AttendanceAccess> {
  const granted = await hrGranted(permissionService, actor);
  const managed = await database.execute<{ id: string }>(sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM core.departments WHERE company_id = ${actor.companyId} AND manager_user_id = ${actor.userId} AND status = 'active'
      UNION SELECT d.id FROM core.departments d JOIN tree t ON d.parent_id = t.id WHERE d.status = 'active')
    SELECT id FROM tree`);
  const manage = granted.has(attendancePermission.manage);
  return {
    granted,
    viewAll: manage || granted.has(attendancePermission.view) || granted.has(attendancePermission.timesheet) || granted.has(attendancePermission.leave),
    manage,
    managedDepartmentIds: managed.rows.map((row) => row.id),
  };
}

export function requireAttendanceView(access: AttendanceAccess): void {
  if (!access.viewAll && access.managedDepartmentIds.length === 0) throw new ApiError("FORBIDDEN", "forbidden");
}

export function requireAttendanceManage(access: AttendanceAccess): void {
  if (!access.manage) throw new ApiError("FORBIDDEN", "forbidden");
}

// Điều kiện hồ sơ (bí danh e) nằm trong phạm vi xem: mọi hồ sơ, hoặc phòng ban hiện hành thuộc phòng do trưởng phòng quản lý.
export function employeeScope(access: AttendanceAccess, day: string): SQL {
  if (access.viewAll) return sql`TRUE`;
  if (access.managedDepartmentIds.length === 0) return sql`FALSE`;
  return sql`(SELECT position.department_id FROM (SELECT ${positionAt(sql`e.id`, sql`GREATEST(${day}::date, e.hire_date)`)}) position) IN (${sql.join(
    access.managedDepartmentIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}
