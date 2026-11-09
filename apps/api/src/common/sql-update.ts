// Dựng câu SET cho thao tác sửa: chỉ các trường được gửi lên; tên cột lấy từ bảng ánh xạ cố định.
import { sql, type SQL } from "drizzle-orm";

export function setClause(input: Record<string, unknown>, columns: Record<string, string>): SQL[] {
  return Object.entries(columns)
    .filter(([field]) => input[field] !== undefined)
    .map(([field, column]) => sql`${sql.raw(column)} = ${input[field] as unknown}`);
}
