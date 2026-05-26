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
/** Bumped on each invalidation so concurrent callers can skip redundant pool.end(). */
let poolGeneration = 0;
/** Active withHealthCheckMysqlRetry callers still using a pool instance. */
let poolLeases = 0;
/** Pool waiting to end() until the last lease is released. */
let poolPendingEnd: mysql.Pool | null = null;

const PING_CONNECT_TIMEOUT_MS = 8_000;
/** After a failed probe/connect, skip new queries briefly (avoids 4× parallel 30s timeouts). */
const DB_UNREACHABLE_COOLDOWN_MS = 45_000;

let dbUnreachableUntil = 0;
let reachabilityProbe: Promise<boolean> | null = null;

function mysqlConnectionParams(): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
} | null {
  if (!isHealthCheckMysqlConfigured()) return null;
  return {
    host: trimEnv(process.env.HEALTH_CHECK_MYSQL_HOST),
    port: parseInt(
      trimEnv(process.env.HEALTH_CHECK_MYSQL_PORT) || "3306",
      10,
    ),
    user: trimEnv(process.env.HEALTH_CHECK_MYSQL_USER),
    password: process.env.HEALTH_CHECK_MYSQL_PASSWORD ?? "",
    database: trimEnv(process.env.HEALTH_CHECK_MYSQL_DATABASE),
  };
}

function noteMysqlUnreachable(): void {
  dbUnreachableUntil = Date.now() + DB_UNREACHABLE_COOLDOWN_MS;
}

export function isHealthCheckMysqlCircuitOpen(): boolean {
  return Date.now() < dbUnreachableUntil;
}

/** One short-lived connection attempt; concurrent callers share the same probe. */
export async function isHealthCheckMysqlReachable(): Promise<boolean> {
  if (!isHealthCheckMysqlConfigured()) return false;
  if (isHealthCheckMysqlCircuitOpen()) return false;

  if (!reachabilityProbe) {
    reachabilityProbe = (async () => {
      const cfg = mysqlConnectionParams();
      if (!cfg) return false;
      try {
        const conn = await mysql.createConnection({
          ...cfg,
          connectTimeout: PING_CONNECT_TIMEOUT_MS,
        });
        try {
          await conn.query("SELECT 1");
          dbUnreachableUntil = 0;
          return true;
        } finally {
          await conn.end().catch(() => {});
        }
      } catch (e) {
        noteMysqlUnreachable();
        invalidateHealthCheckMysqlPool();
        const err = e as NodeJS.ErrnoException;
        console.warn(
          `MySQL unreachable at ${cfg.host}:${cfg.port} (${err.code ?? "error"}) — VPN or internal network may be required. Skipping queries for ${DB_UNREACHABLE_COOLDOWN_MS / 1000}s.`,
        );
        return false;
      } finally {
        reachabilityProbe = null;
      }
    })();
  }
  return reachabilityProbe;
}

function isPoolClosedError(err: unknown): boolean {
  return err instanceof Error && /pool is closed/i.test(err.message);
}

function schedulePoolEnd(p: mysql.Pool): void {
  if (poolLeases === 0) {
    void p.end().catch(() => {});
    return;
  }
  poolPendingEnd = p;
}

function acquirePoolLease(): mysql.Pool | null {
  const p = getHealthCheckMysqlPool();
  if (p) poolLeases++;
  return p;
}

function releasePoolLease(): void {
  if (poolLeases <= 0) return;
  poolLeases--;
  if (poolLeases === 0 && poolPendingEnd) {
    const p = poolPendingEnd;
    poolPendingEnd = null;
    void p.end().catch(() => {});
  }
}

/** Drop pool after fatal / network errors so the next request opens fresh connections. */
export function invalidateHealthCheckMysqlPool(): void {
  clearDashboardMysqlCache();
  const p = pool;
  pool = null;
  poolKey = "";
  if (p) {
    poolGeneration++;
    schedulePoolEnd(p);
  }
}

export function isRecoverableMysqlPoolError(err: unknown): boolean {
  if (isPoolClosedError(err)) return true;
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
  const cfg = mysqlConnectionParams();
  if (!cfg) return null;

  const { host, port, user, password, database } = cfg;
  const key = `${host}|${port}|${user}|${database}`;
  if (!pool || poolKey !== key) {
    if (pool) schedulePoolEnd(pool);
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

const MAX_NETWORK_ATTEMPTS = 2;
const MAX_SIBLING_POOL_RETRIES = 6;

/**
 * Runs `fn` with the shared pool. On stale-connection / network errors, drops the
 * pool once and retries once with a fresh pool (common after long idle + VPN).
 *
 * Parallel dashboard loads share one pool; invalidation defers pool.end() until
 * in-flight queries finish so siblings are not left with a closed pool.
 */
export async function withHealthCheckMysqlRetry<T>(
  fn: (pool: mysql.Pool) => Promise<T>,
): Promise<T> {
  if (isHealthCheckMysqlCircuitOpen()) {
    throw new Error("HEALTH_CHECK_MYSQL_UNREACHABLE");
  }

  let lastError: unknown;
  let networkAttempts = 0;
  let siblingRetries = 0;

  while (networkAttempts < MAX_NETWORK_ATTEMPTS) {
    const genAtStart = poolGeneration;
    const activePool = acquirePoolLease();
    if (!activePool) {
      throw new Error("HEALTH_CHECK_MYSQL_NOT_CONFIGURED");
    }

    try {
      return await fn(activePool);
    } catch (e) {
      lastError = e;

      if (
        isPoolClosedError(e) &&
        genAtStart !== poolGeneration &&
        siblingRetries < MAX_SIBLING_POOL_RETRIES
      ) {
        siblingRetries++;
        continue;
      }

      if (!isRecoverableMysqlPoolError(e)) throw e;

      networkAttempts++;
      if (networkAttempts >= MAX_NETWORK_ATTEMPTS) {
        if (genAtStart === poolGeneration) {
          invalidateHealthCheckMysqlPool();
        }
        noteMysqlUnreachable();
        throw e;
      }

      if (genAtStart === poolGeneration) {
        invalidateHealthCheckMysqlPool();
      }
    } finally {
      releasePoolLease();
    }
  }

  throw lastError;
}
