// Ngữ cảnh chung mini app Kho (MODULE_03): nhật ký thao tác gắn mini app inventory, kiểm quyền theo chi nhánh sở hữu kho (QUYTAC_NGHIEPVU_46).
import { ApiError } from "../common/api-error";
import type { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const inventoryPermissions = {
  access: "inventory.access",
  manageWarehouses: "inventory.warehouse.manage",
  viewStock: "inventory.stock.view",
  viewCost: "inventory.cost.view",
  manageDocuments: "inventory.document.manage",
  receivePurchases: "inventory.purchase.receive",
  manageStocktakes: "inventory.stocktake.manage",
  manageReservations: "inventory.reservation.manage",
} as const;

export function inventoryAudit(actor: Actor, entityType: string) {
  return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "inventory", entityType, ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
}

export async function requireCompanyPermission(permissionService: PermissionService, actor: Actor, permission: string): Promise<void> {
  if (!(await permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(permission)) throw new ApiError("FORBIDDEN", "forbidden");
}

// Quyền tại kho: lần gán ở tập đoàn, ở công ty sở hữu kho, hoặc ở chi nhánh của kho.
export async function warehousePermissions(permissionService: PermissionService, userId: string, warehouse: { companyId: string; branchId: string }): Promise<Set<string>> {
  return permissionService.permissionsCovering(userId, { scopeType: "branch", companyId: warehouse.companyId, branchId: warehouse.branchId });
}
