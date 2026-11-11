// Quyền, nhật ký dùng chung của mini app Bán lẻ (CONG_VIEC_53). Quyền bán, trả hàng, quản lý ca gán được ở chi nhánh của cửa hàng.
import { retailPermissions } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { DataScope, PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export { retailPermissions };

export const retailAudit = (actor: Actor, entityType: string) => ({
  actorUserId: actor.userId,
  companyId: actor.companyId,
  appCode: "retail",
  entityType,
  ip: actor.client.ip,
  userAgent: actor.client.userAgent,
  requestId: actor.client.requestId,
});

// Cài đặt cửa hàng cần quyền bao trùm công ty.
export async function requireRetailSetup(permissionService: PermissionService, actor: Actor): Promise<void> {
  const granted = await permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
  if (!granted.has(retailPermissions.setup)) throw new ApiError("FORBIDDEN", "forbidden");
}

// Quyền tại chi nhánh của một cửa hàng.
export async function retailPermissionsAt(permissionService: PermissionService, actor: Actor, branchId: string): Promise<Set<string>> {
  return permissionService.permissionsCovering(actor.userId, { scopeType: "branch", companyId: actor.companyId, branchId });
}

// Phạm vi chi nhánh của một quyền; null khi không có quyền ở đâu trong công ty.
export async function retailScope(permissionService: PermissionService, actor: Actor, permission: string): Promise<DataScope | null> {
  return permissionService.dataScope(actor.userId, actor.companyId, permission);
}

// Điều kiện chi nhánh theo phạm vi; không có quyền thì không khớp dòng nào.
export function scopeCondition(scope: DataScope | null, branchColumn: SQL): SQL {
  if (!scope) return sql`FALSE`;
  if (scope.kind === "company") return sql`TRUE`;
  return sql`${branchColumn} IN (${sql.join(
    scope.branchIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}

// Làm tròn tiền theo đơn vị tiền tệ của công ty (dùng trong câu truy vấn).
export const companyRound = (value: SQL, companyId: string) => sql`round(${value}, finance.company_minor_units(${companyId}::uuid))`;
