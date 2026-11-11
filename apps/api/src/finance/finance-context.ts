// Quyền, nhật ký dùng chung của module Tài chính – Kế toán (CONG_VIEC_13).
import { ApiError } from "../common/api-error";
import type { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const financePermissions = {
  view: "finance.debt.view",
  manageFunds: "finance.fund.manage",
  manageDebts: "finance.debt.manage",
  managePayments: "finance.payment.manage",
} as const;

export const financeAudit = (actor: Actor, entityType: string) => ({
  actorUserId: actor.userId,
  companyId: actor.companyId,
  appCode: "finance",
  entityType,
  ip: actor.client.ip,
  userAgent: actor.client.userAgent,
  requestId: actor.client.requestId,
});

// Quyền tài chính cần phạm vi bao trùm công ty.
export async function requireFinancePermission(permissionService: PermissionService, actor: Actor, ...anyOf: string[]): Promise<Set<string>> {
  const granted = await permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
  if (!anyOf.some((permission) => granted.has(permission))) throw new ApiError("FORBIDDEN", "forbidden");
  return granted;
}
