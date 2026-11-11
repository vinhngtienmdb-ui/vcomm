// Cập nhật phòng ban, chi nhánh mặc định, chức danh của thành viên công ty trong giao dịch của module gọi (CONG_VIEC_46, QUYTAC_NGHIEPVU_296).
// Không kiểm quyền người gọi; module Nhân sự gọi khi quyết định công tác có hiệu lực. Vai trò không đổi.
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";

export interface MembershipPlacement {
  departmentId: string | null;
  branchId: string | null;
  jobTitle: string | null;
}

export async function updateMembershipPlacement(executor: Pick<Database, "execute">, userId: string, companyId: string, placement: MembershipPlacement, actorUserId: string | null): Promise<boolean> {
  const updated = await executor.execute(sql`
    UPDATE core.user_company_memberships
    SET department_id = ${placement.departmentId}, default_branch_id = ${placement.branchId}, job_title = ${placement.jobTitle}, updated_at = now(), updated_by = ${actorUserId}
    WHERE user_id = ${userId} AND company_id = ${companyId} AND status = 'active'
      AND (department_id, default_branch_id, job_title) IS DISTINCT FROM (${placement.departmentId}::uuid, ${placement.branchId}::uuid, ${placement.jobTitle}::text)
    RETURNING id`);
  return updated.rows.length > 0;
}
