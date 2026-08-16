import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { mockDb } from "./mock";

const databaseUrl = process.env.DATABASE_URL;

/**
 * Cohold runs fully on mocks when no database is configured:
 * - no DATABASE_URL -> in-memory mock database (see `mock.ts`)
 * - DATABASE_URL set -> real Postgres via Drizzle
 *
 * The mock implements exactly the query surface the API routes use, so
 * swapping between mock and real is a deployment detail, not a code path.
 */
export const db: NodePgDatabase = databaseUrl
  ? drizzle(getPool(databaseUrl))
  : (mockDb as unknown as NodePgDatabase);

/** Re-exported for callers that want to know which backend is live. */
export const isMockDb = !databaseUrl;

function getPool(connectionString: string): Pool {
  const globalForDb = globalThis as typeof globalThis & {
    __arenaNextJsPostgresqlPool?: Pool;
  };

  const pool =
    globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({ connectionString });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  return pool;
}