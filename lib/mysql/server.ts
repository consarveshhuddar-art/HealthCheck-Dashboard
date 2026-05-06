import "server-only";
import { clearDashboardMysqlCache } from "@/lib/dashboard-cache";
import mysql from "mysql2/promise";

function trimEnv(raw: string | undefined): string {
  let v = (raw ?? "").trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

let pool: mysql.Pool | null = null;
let poolKey = "";

/** Drop pool after fatal / network errors so the next request opens fresh connections. */
export function invalidateHealthCheckMysqlPool(): void {
  clearDashboardMysqlCache();
  const p = pool;
  pool = null;
  poolKey = "";
  if (p) void p.end().catch(() => {});
}

export function isRecoverableMysqlPoolError(err: unknown): boolean {
  const e = err as NodeJS.ErrnoException & { fatal?: boolean };
  if (e?.fatal) return true;
  const code = e?.code;
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ENOTFOUND" ||
    code === "EPIPE"
  );
}

export function isHealthCheckMysqlConfigured(): boolean {
  const host = trimEnv(process.env.HEALTH_CHECK_MYSQL_HOST);
  const user = trimEnv(process.env.HEALTH_CHECK_MYSQL_USER);
  const database = trimEnv(process.env.HEALTH_CHECK_MYSQL_DATABASE);
  const hasPassword = process.env.HEALTH_CHECK_MYSQL_PASSWORD !== undefined;
  return !!(host && user && database && hasPassword);
}

/** Server-only pool; never import from client components. */
export function getHealthCheckMysqlPool(): mysql.Pool | null {
  if (!isHealthCheckMysqlConfigured()) return null;

  const host = trimEnv(process.env.HEALTH_CHECK_MYSQL_HOST);
  const user = trimEnv(process.env.HEALTH_CHECK_MYSQL_USER);
  const password = process.env.HEALTH_CHECK_MYSQL_PASSWORD ?? "";
  const database = trimEnv(process.env.HEALTH_CHECK_MYSQL_DATABASE);
  const port = parseInt(
    trimEnv(process.env.HEALTH_CHECK_MYSQL_PORT) || "3306",
    10,
  );

  const key = `${host}|${port}|${user}|${database}`;
  if (!pool || poolKey !== key) {
    if (pool) void pool.end().catch(() => {});
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      /** Drop idle connections in the pool before VPN/NAT/firewall kills TCP silently. */
      maxIdle: 5,
      idleTimeout: 30_000,
      connectTimeout: 30_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    poolKey = key;
  }
  return pool;
}

/**
 * Runs `fn` with the shared pool. On stale-connection / network errors, drops the
 * pool once and retries once with a fresh pool (common after long idle + VPN).
 */
export async function withHealthCheckMysqlRetry<T>(
  fn: (pool: mysql.Pool) => Promise<T>,
): Promise<T> {
  const pool = getHealthCheckMysqlPool();
  if (!pool) {
    throw new Error("HEALTH_CHECK_MYSQL_NOT_CONFIGURED");
  }
  try {
    return await fn(pool);
  } catch (e) {
    if (!isRecoverableMysqlPoolError(e)) throw e;
    invalidateHealthCheckMysqlPool();
    const pool2 = getHealthCheckMysqlPool();
    if (!pool2) throw e;
    try {
      return await fn(pool2);
    } catch (e2) {
      if (isRecoverableMysqlPoolError(e2)) {
        invalidateHealthCheckMysqlPool();
      }
      throw e2;
    }
  }
}
