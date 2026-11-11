// Ngữ cảnh chung mini app Kho (MODULE_03): nhật ký thao tác gắn mini app inventory, kiểm quyền theo chi nhánh sở hữu kho (QUYTAC_NGHIEPVU_46).
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { PermissionService } from "../permissions/permission.service";
import type { Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";

export const inventoryPermissions = {
  access: "inventory.access",
  manageWarehouses: "inventory.warehouse.manage",
  viewStock: "inventory.stock.view",
  viewCost: "inventory.cost.view",
  manageDocuments: "inventory.document.manage",
  receivePurchases: "inventory.purchase.receive",
  issueSales: "inventory.sales.issue",
  manageStocktakes: "inventory.stocktake.manage",
  countStocktakes: "inventory.stocktake.count",
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

// Dịch vụ không theo dõi tồn kho: không phiếu kho, giữ hàng, kiểm kê (CONG_VIEC_43; QUYTAC_NGHIEPVU_275).
export async function requireStockedVariant(executor: Pick<Database, "execute">, variantId: string): Promise<void> {
  const service = await executor.execute(sql`SELECT 1 FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE v.id = ${variantId} AND p.kind = 'service'`);
  if (service.rows.length > 0) throw new ApiError("BUSINESS_RULE", "serviceNotStocked");
}
