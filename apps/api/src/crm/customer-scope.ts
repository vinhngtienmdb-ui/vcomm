// Phạm vi xem khách hàng, đơn bán theo nhân viên phụ trách (CONG_VIEC_21; QUYTAC_NGHIEPVU_129, 130).
import { sql, type SQL } from "drizzle-orm";
import type { Database } from "../database/database.module";
import type { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const viewAllCustomers = "crm.customer.view_all";
export const assignCustomers = "crm.customer.assign";

type Executor = Pick<Database, "execute">;
export type CustomerScope = { kind: "all" } | { kind: "owned"; userIds: string[] };

// Nhân viên trong các phòng mình làm trưởng phòng (kể cả phòng con các cấp) và chính mình.
export async function managedUsers(executor: Executor, companyId: string, userId: string): Promise<string[]> {
  const rows = await executor.execute<{ user_id: string }>(sql`
    WITH RECURSIVE managed AS (
      SELECT id FROM core.departments WHERE company_id = ${companyId} AND manager_user_id = ${userId} AND status = 'active'
      UNION
      SELECT d.id FROM core.departments d JOIN managed m ON d.parent_id = m.id WHERE d.status = 'active'
    )
    SELECT DISTINCT user_id FROM core.user_company_memberships WHERE company_id = ${companyId} AND status = 'active' AND department_id IN (SELECT id FROM managed)`);
  return [...new Set([userId, ...rows.rows.map((row) => row.user_id)])];
}

// Quyền xem mọi khách gán ở phạm vi nào trong công ty cũng được (giống quyền xem đơn bán).
export async function customerScope(executor: Executor, permissionService: PermissionService, actor: Actor): Promise<CustomerScope> {
  if ((await permissionService.permissionsInCompany(actor.userId, actor.companyId)).includes(viewAllCustomers)) return { kind: "all" };
  return { kind: "owned", userIds: await managedUsers(executor, actor.companyId, actor.userId) };
}

export const userList = (userIds: string[]): SQL =>
  sql.join(
    userIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

// Điều kiện khách thuộc phạm vi: hồ sơ của công ty có nhân viên phụ trách trong danh sách.
export function ownedCustomer(scope: CustomerScope, companyId: SQL, partnerId: SQL): SQL {
  if (scope.kind === "all") return sql`TRUE`;
  return sql`EXISTS (SELECT 1 FROM crm.partner_profiles scope_profile WHERE scope_profile.company_id = ${companyId} AND scope_profile.partner_id = ${partnerId}
    AND scope_profile.is_customer AND scope_profile.owner_user_id IN (${userList(scope.userIds)}))`;
}

// Đơn bán thuộc phạm vi: khách thuộc phạm vi, hoặc người lập, người hưởng hoa hồng thuộc phạm vi.
export function visibleOrder(scope: CustomerScope, order: string): SQL {
  if (scope.kind === "all") return sql`TRUE`;
  const column = (name: string) => sql.raw(`${order}.${name}`);
  return sql`(${ownedCustomer(scope, column("company_id"), column("customer_id"))} OR ${column("created_by")} IN (${userList(scope.userIds)})
    OR ${column("commission_user_id")} IN (${userList(scope.userIds)}))`;
}

// Mở, đóng dòng lịch sử phụ trách khi nhân viên phụ trách đổi (QUYTAC_NGHIEPVU_133, 134).
export async function recordOwner(executor: Executor, input: { companyId: string; partnerId: string; userId: string | null; assignmentId: string | null; actorUserId: string }): Promise<void> {
  await executor.execute(sql`
    UPDATE crm.partner_owner_history SET valid_to = now() WHERE company_id = ${input.companyId} AND partner_id = ${input.partnerId} AND valid_to IS NULL`);
  if (input.userId)
    await executor.execute(sql`
      INSERT INTO crm.partner_owner_history (company_id, partner_id, user_id, assignment_id, created_by)
      VALUES (${input.companyId}, ${input.partnerId}, ${input.userId}, ${input.assignmentId}, ${input.actorUserId})`);
}
