// Ngữ cảnh chung mini app Sản phẩm (MODULE_02): nhật ký thao tác gắn mini app catalog, kiểm quyền theo phạm vi.
import { ApiError } from "../common/api-error";
import type { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const catalogPermissions = {
  manageCategories: "catalog.category.manage",
  viewProducts: "catalog.product.view",
  manageProducts: "catalog.product.manage",
  viewPrices: "catalog.price.view",
  managePrices: "catalog.price.manage",
} as const;

export function catalogAudit(actor: Actor, entityType: string) {
  return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "catalog", entityType, ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
}

// Ngành hàng, đơn vị tính dùng chung tập đoàn: chỉ người có quyền ở phạm vi tập đoàn mới sửa (QUYTAC_NGHIEPVU_37).
export async function requireGroupPermission(permissionService: PermissionService, userId: string, permission: string): Promise<void> {
  if (!(await permissionService.permissionsCovering(userId, { scopeType: "group" })).has(permission)) throw new ApiError("FORBIDDEN", "forbidden");
}

export async function requireCompanyPermission(permissionService: PermissionService, actor: Actor, permission: string): Promise<void> {
  if (!(await permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(permission)) throw new ApiError("FORBIDDEN", "forbidden");
}

// Bỏ dấu tiếng Việt, chữ thường: cột search_text để tìm không dấu.
export function searchText(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}
