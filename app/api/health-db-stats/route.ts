import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import {
  getHealthCheckMysqlPool,
  invalidateHealthCheckMysqlPool,
  isHealthCheckMysqlConfigured,
  isRecoverableMysqlPoolError,
  withHealthCheckMysqlRetry,
} from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

/**
 * Read-only smoke test for MySQL connectivity (counts only).
 * Example: curl -s http://localhost:3000/api/health-db-stats | jq
 */
export async function GET() {
  if (!isHealthCheckMysqlConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        message:
          "Set HEALTH_CHECK_MYSQL_* in .env.local (see .env.example). VPN may be required.",
      },
      { status: 503 },
    );
  }

  const pool = getHealthCheckMysqlPool();
  if (!pool) {
    return NextResponse.json(
      { ok: false, message: "Pool unavailable" },
      { status: 503 },
    );
  }

  try {
    const { runs, fails } = await withHealthCheckMysqlRetry(async (p) => {
      const [runRows] = await p.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM health_check_runs",
      );
      const [failRows] = await p.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM health_check_failures",
      );
      return { runs: runRows, fails: failRows };
    });
    const runsRow = runs[0] as { n: number } | undefined;
    const failRow = fails[0] as { n: number } | undefined;
    return NextResponse.json({
      ok: true,
      configured: true,
      health_check_runs: Number(runsRow?.n ?? 0),
      health_check_failures: Number(failRow?.n ?? 0),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (isRecoverableMysqlPoolError(e)) {
      invalidateHealthCheckMysqlPool();
    }
    return NextResponse.json(
      { ok: false, configured: true, error: message },
      { status: 502 },
    );
  }
}
