// Phạm vi tập đoàn và người tham gia của Văn phòng số (QUYTAC_NGHIEPVU_357).
import { sql } from "drizzle-orm";
import type { OfficePerson } from "contracts";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;

// Công ty gốc (tập đoàn) của một công ty: đi ngược parent_id đến công ty không có công ty mẹ.
export async function groupRootOf(executor: Executor, companyId: string): Promise<string> {
  const result = await executor.execute<{ id: string }>(sql`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id FROM core.companies WHERE id = ${companyId}
      UNION ALL
      SELECT c.id, c.parent_id FROM core.companies c JOIN chain ON c.id = chain.parent_id
    )
    SELECT id FROM chain WHERE parent_id IS NULL LIMIT 1`);
  return result.rows[0]?.id ?? companyId;
}

// Mọi công ty đang hoạt động thuộc cùng tập đoàn với công ty đã cho.
export async function groupCompanyIds(executor: Executor, companyId: string): Promise<string[]> {
  const root = await groupRootOf(executor, companyId);
  const result = await executor.execute<{ id: string }>(sql`
    WITH RECURSIVE tree AS (
      SELECT id FROM core.companies WHERE id = ${root}
      UNION ALL
      SELECT c.id FROM core.companies c JOIN tree ON c.parent_id = tree.id
    )
    SELECT t.id FROM tree t JOIN core.companies c ON c.id = t.id WHERE c.status = 'active'`);
  return result.rows.map((row) => row.id);
}

// Người dùng đang hoạt động, là thành viên đang hoạt động của ít nhất một công ty trong tập đoàn.
export async function activeGroupUsers(executor: Executor, companyId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const companies = await groupCompanyIds(executor, companyId);
  const result = await executor.execute<{ id: string }>(sql`
    SELECT DISTINCT u.id FROM core.users u
    JOIN core.user_company_memberships m ON m.user_id = u.id AND m.status = 'active'
    WHERE u.status = 'active'
      AND u.id IN (${sql.join(
        userIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
      AND m.company_id IN (${sql.join(
        companies.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`);
  return new Set(result.rows.map((row) => row.id));
}

// Họ tên, công ty, phòng ban để hiển thị; ưu tiên thành viên của công ty đang xét, rồi công ty mặc định.
// Chỉ trả thông tin hiển thị, không trả dữ liệu khác của người dùng.
export async function peopleById(executor: Executor, userIds: string[], preferredCompanyId: string | null): Promise<Map<string, OfficePerson>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const result = await executor.execute<{ id: string; full_name: string; company_id: string | null; company_name: string | null; department_name: string | null }>(sql`
    SELECT u.id, u.full_name, m.company_id, m.company_name, m.department_name
    FROM core.users u
    LEFT JOIN LATERAL (
      SELECT m.company_id, c.short_name AS company_name, d.name AS department_name
      FROM core.user_company_memberships m
      JOIN core.companies c ON c.id = m.company_id
      LEFT JOIN core.departments d ON d.id = m.department_id
      WHERE m.user_id = u.id AND m.status = 'active'
      ORDER BY (m.company_id = ${preferredCompanyId}::uuid) DESC NULLS LAST, m.is_default DESC
      LIMIT 1
    ) m ON TRUE
    WHERE u.id IN (${sql.join(
      unique.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`);
  return new Map(result.rows.map((row) => [row.id, { id: row.id, fullName: row.full_name, companyId: row.company_id, companyName: row.company_name, departmentName: row.department_name }]));
}

// Tìm người trong tập đoàn để giao việc: theo họ tên hoặc email, tối đa 20 người.
export async function searchGroupPeople(executor: Executor, companyId: string, search: string): Promise<OfficePerson[]> {
  const companies = await groupCompanyIds(executor, companyId);
  const pattern = `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const result = await executor.execute<{ id: string }>(sql`
    SELECT DISTINCT u.id, u.full_name FROM core.users u
    JOIN core.user_company_memberships m ON m.user_id = u.id AND m.status = 'active'
    WHERE u.status = 'active'
      AND m.company_id IN (${sql.join(
        companies.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
      AND (u.full_name ILIKE ${pattern} OR u.email::text ILIKE ${pattern})
    ORDER BY u.full_name LIMIT 20`);
  const people = await peopleById(
    executor,
    result.rows.map((row) => row.id),
    companyId,
  );
  return result.rows.map((row) => people.get(row.id)!).filter(Boolean);
}
