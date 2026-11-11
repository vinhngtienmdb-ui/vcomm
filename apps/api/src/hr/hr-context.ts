// Quyền, nhật ký, che số giấy tờ dùng chung của module Nhân sự (CONG_VIEC_46).
import { sql, type SQL } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const hrPermission = {
  view: "hr.employee.view",
  manage: "hr.employee.manage",
  identity: "hr.identity.view",
  contract: "hr.contract.manage",
} as const;

export const hrAudit = (actor: Actor, entityType: string) => ({
  actorUserId: actor.userId,
  companyId: actor.companyId,
  appCode: "hr",
  entityType,
  ip: actor.client.ip,
  userAgent: actor.client.userAgent,
  requestId: actor.client.requestId,
});

// Quyền nhân sự phải bao trùm công ty (gán ở chi nhánh không dùng được), như module Tài chính.
export async function hrGranted(permissionService: PermissionService, actor: Actor): Promise<Set<string>> {
  return permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
}

export async function requireHrPermission(permissionService: PermissionService, actor: Actor, ...anyOf: string[]): Promise<Set<string>> {
  const granted = await hrGranted(permissionService, actor);
  if (!anyOf.some((permission) => granted.has(permission))) throw new ApiError("FORBIDDEN", "forbidden");
  return granted;
}

// Dạng che: 8 dấu sao và 4 ký tự cuối (QUYTAC_NGHIEPVU_295).
export const masked = (last4: string | null): string | null => (last4 === null ? null : `********${last4}`);
export const lastFour = (value: string) => value.slice(-4);

// Tuổi tròn năm tại một ngày (QUYTAC_NGHIEPVU_294).
export function ageAt(birthDate: string, day: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number) as [number, number, number];
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  return year - birthYear - (month < birthMonth || (month === birthMonth && date < birthDay) ? 1 : 0);
}

// Vị trí hiện hành tại một ngày (hồ sơ chưa đến ngày vào làm: vị trí ngày vào làm): mỗi mục lấy từ quyết định gần nhất có mục đó (QUYTAC_NGHIEPVU_296).
export const positionAt = (employee: SQL, day: SQL) => sql`
  (SELECT w.department_id FROM hr.work_events w WHERE w.employee_id = ${employee} AND w.department_id IS NOT NULL AND w.effective_date <= ${day} ORDER BY w.effective_date DESC LIMIT 1) AS department_id,
  (SELECT w.branch_id FROM hr.work_events w WHERE w.employee_id = ${employee} AND w.branch_id IS NOT NULL AND w.effective_date <= ${day} ORDER BY w.effective_date DESC LIMIT 1) AS branch_id,
  (SELECT w.job_title FROM hr.work_events w WHERE w.employee_id = ${employee} AND w.job_title IS NOT NULL AND w.effective_date <= ${day} ORDER BY w.effective_date DESC LIMIT 1) AS job_title`;
