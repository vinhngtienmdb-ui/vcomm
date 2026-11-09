// Chạy database migration trong database/migrations theo thứ tự tên tệp, mỗi tệp một lần, trong một giao dịch.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { createPool } from "./database.module";

export const migrationsDirectory = resolve(__dirname, "../../../../database/migrations");

export async function runMigrations(pool: Pool, directory = migrationsDirectory): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS public.schema_migrations (file_name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    // Khóa để hai tiến trình không chạy migration cùng lúc.
    await client.query("SELECT pg_advisory_lock(727001)");
    const done = new Set(
      (await client.query<{ file_name: string }>("SELECT file_name FROM public.schema_migrations")).rows.map((row) => row.file_name),
    );
    const files = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
    for (const fileName of files) {
      if (done.has(fileName)) continue;
      const sql = readFileSync(join(directory, fileName), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO public.schema_migrations (file_name) VALUES ($1)", [fileName]);
        await client.query("COMMIT");
        applied.push(fileName);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Database migration ${fileName} lỗi: ${(error as Error).message}`);
      }
    }
    await client.query("SELECT pg_advisory_unlock(727001)");
  } finally {
    client.release();
  }
  return applied;
}

if (require.main === module) {
  const pool = createPool();
  runMigrations(pool)
    .then((applied) => console.log(applied.length ? `Đã chạy: ${applied.join(", ")}` : "Không có database migration mới."))
    .catch((error: Error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
