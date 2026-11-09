import { Global, Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const DATABASE = Symbol("DATABASE");
export const DATABASE_POOL = Symbol("DATABASE_POOL");
export type Database = NodePgDatabase<typeof schema>;

export function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Thiếu biến môi trường DATABASE_URL.");
  }
  return new Pool({ connectionString, max: 10 });
}

@Global()
@Module({
  providers: [
    { provide: DATABASE_POOL, useFactory: createPool },
    { provide: DATABASE, inject: [DATABASE_POOL], useFactory: (pool: Pool) => drizzle(pool, { schema }) },
  ],
  exports: [DATABASE, DATABASE_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
