// Quyền, nhật ký, kiểm tra dùng chung của module Mua hàng (CONG_VIEC_07).
import { sql } from "drizzle-orm";
import type { Messages } from "i18n";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";
import type { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const purchasingPermissions = {
  managePrices: "purchasing.price.manage",
  createRequisition: "purchasing.requisition.create",
  viewOrders: "purchasing.order.view",
  manageOrders: "purchasing.order.manage",
  manageSettings: "purchasing.settings.manage",
  viewImports: "purchasing.import.view",
  manageImports: "purchasing.import.manage",
  // CONG_VIEC_58 (QUYTAC_NGHIEPVU_453).
  viewBudgets: "purchasing.budget.view",
  manageBudgets: "purchasing.budget.manage",
} as const;

export type FieldErrors = Record<string, keyof Messages["errors"]>;
export type Executor = Pick<Database, "execute" | "insert">;

export const purchasingAudit = (actor: Actor, entityType: string) => ({
  actorUserId: actor.userId,
  companyId: actor.companyId,
  appCode: "purchasing",
  entityType,
  ip: actor.client.ip,
  userAgent: actor.client.userAgent,
  requestId: actor.client.requestId,
});

// Lập đề nghị mua, xem đơn mua: được gán ở chi nhánh nào của công ty cũng dùng được (thủ kho thường được gán theo chi nhánh).
// Quyền khác cần phạm vi bao trùm công ty.
const branchUsable: string[] = [purchasingPermissions.createRequisition, purchasingPermissions.viewOrders];
export async function grantedPermissions(permissionService: PermissionService, actor: Actor): Promise<Set<string>> {
  const granted = await permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
  for (const code of await permissionService.permissionsInCompany(actor.userId, actor.companyId)) if (branchUsable.includes(code)) granted.add(code);
  return granted;
}

export async function requirePermission(permissionService: PermissionService, actor: Actor, ...anyOf: string[]): Promise<Set<string>> {
  const granted = await grantedPermissions(permissionService, actor);
  if (!anyOf.some((permission) => granted.has(permission))) throw new ApiError("FORBIDDEN", "forbidden");
  return granted;
}

// Nhà cung cấp hợp lệ: đối tác đang giao dịch, có hồ sơ nhà cung cấp đang dùng ở công ty (QUYTAC_NGHIEPVU_61).
export async function isActiveSupplier(executor: Executor, companyId: string, supplierId: string): Promise<boolean> {
  const rows = await executor.execute(sql`
    SELECT 1 FROM crm.partners p JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${companyId}
    WHERE p.id = ${supplierId} AND p.status = 'active' AND pr.status = 'active' AND pr.is_supplier`);
  return rows.rows.length > 0;
}

// Kho nhận hàng: kho đang dùng nhận hàng của công ty.
export async function isReceivingWarehouse(executor: Executor, companyId: string, warehouseId: string): Promise<boolean> {
  const rows = await executor.execute(sql`
    SELECT 1 FROM inventory.warehouses w JOIN inventory.warehouse_owners o ON o.warehouse_id = w.id
    WHERE w.id = ${warehouseId} AND w.status = 'active' AND o.company_id = ${companyId}`);
  return rows.rows.length > 0;
}

// Hệ số quy đổi của đơn vị với mặt hàng đang bán của công ty; null khi mặt hàng, đơn vị không hợp lệ.
export async function variantUnitFactor(executor: Executor, companyId: string, variantId: string, unitId: string): Promise<{ factor: number; vatRate: string; categoryId: string } | null> {
  const row = (
    await executor.execute<{ factor: string; vat_rate: string; category_id: string }>(sql`
    SELECT CASE WHEN p.base_unit_id = ${unitId} THEN 1 ELSE pu.factor END::text AS factor, p.vat_rate, p.category_id
    FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
    LEFT JOIN catalog.product_units pu ON pu.product_id = p.id AND pu.unit_id = ${unitId}
    WHERE v.id = ${variantId} AND v.company_id = ${companyId} AND v.status = 'active' AND p.status = 'active'
      AND (p.base_unit_id = ${unitId} OR pu.unit_id IS NOT NULL)`)
  ).rows[0];
  return row ? { factor: Number(row.factor), vatRate: row.vat_rate, categoryId: row.category_id } : null;
}
