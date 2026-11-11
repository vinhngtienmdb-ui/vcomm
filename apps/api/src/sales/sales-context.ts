// Quyền, nhật ký dùng chung của module Bán hàng (CONG_VIEC_08).
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";
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

type Reader = Pick<Database, "execute">;

// Mặt hàng loại Hàng hóa trong danh sách (CONG_VIEC_43; QUYTAC_NGHIEPVU_275).
export async function goodsVariants(executor: Reader, variantIds: string[]): Promise<Set<string>> {
  if (variantIds.length === 0) return new Set();
  const rows = await executor.execute<{ id: string }>(sql`
    SELECT v.id FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
    WHERE v.id IN (${sql.join(
      [...new Set(variantIds)].map((id) => sql`${id}::uuid`),
      sql`, `,
    )}) AND p.kind = 'goods'`);
  return new Set(rows.rows.map((row) => row.id));
}

// Cài đặt công ty "Cho phép lập đơn bán tay có hàng hóa", mặc định tắt (QUYTAC_NGHIEPVU_276).
export async function allowsManualGoodsOrders(executor: Reader, companyId: string): Promise<boolean> {
  return (await executor.execute<{ allowed: boolean }>(sql`SELECT allow_manual_goods_orders AS allowed FROM sales.settings WHERE company_id = ${companyId}`)).rows[0]?.allowed ?? false;
}

// Đơn bán lập tay (không sinh từ đơn VComm) chỉ gồm dịch vụ, trừ khi công ty bật cài đặt (QUYTAC_NGHIEPVU_276).
export async function requireManualOrderLines(executor: Reader, companyId: string, variantIds: string[]): Promise<void> {
  if ((await goodsVariants(executor, variantIds)).size === 0) return;
  if (!(await allowsManualGoodsOrders(executor, companyId))) throw new ApiError("BUSINESS_RULE", "manualOrderServicesOnly");
}
