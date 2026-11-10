// Quyền, nhật ký dùng chung của module Bán hàng (CONG_VIEC_08).
import { ApiError } from "../common/api-error";
import type { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const salesPermissions = {
  viewOrders: "sales.order.view",
  manageOrders: "sales.order.manage",
  manageSettings: "sales.settings.manage",
  viewPromotions: "sales.promotion.view",
  managePromotions: "sales.promotion.manage",
} as const;

export const salesAudit = (actor: Actor, entityType: string) => ({
  actorUserId: actor.userId,
  companyId: actor.companyId,
  appCode: "sales",
  entityType,
  ip: actor.client.ip,
  userAgent: actor.client.userAgent,
  requestId: actor.client.requestId,
});

// Xem đơn bán: được gán ở chi nhánh nào của công ty cũng dùng được (thủ kho thường gán theo chi nhánh); quyền khác cần phạm vi bao trùm công ty.
export async function requireSalesPermission(permissionService: PermissionService, actor: Actor, ...anyOf: string[]): Promise<Set<string>> {
  const granted = await permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
  for (const code of await permissionService.permissionsInCompany(actor.userId, actor.companyId)) if (code === salesPermissions.viewOrders) granted.add(code);
  if (!anyOf.some((permission) => granted.has(permission))) throw new ApiError("FORBIDDEN", "forbidden");
  return granted;
}
