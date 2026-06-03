import { NextResponse } from "next/server";
import { getOrSetPrE2eMysqlCache } from "@/lib/dashboard-cache";
import { loadPrE2eRunsPage } from "@/lib/prE2e/data";
import { PR_E2E_RUNS_PAGE_SIZE } from "@/lib/prE2e/limits";
import { PR_E2E_PIPELINE_FILTER } from "@/lib/prE2e/types";
import {
  invalidateHealthCheckMysqlPool,
  isHealthCheckMysqlConfigured,
  isHealthCheckMysqlReachable,
  isRecoverableMysqlPoolError,
} from "@/lib/mysql/server";

export const dynamic = "force-dynamic";

function parseOffset(raw: string | null): number {
  const n = parseInt(raw ?? "0", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseLimit(raw: string | null): number {
  const n = parseInt(raw ?? String(PR_E2E_RUNS_PAGE_SIZE), 10);
  if (!Number.isFinite(n) || n < 1) return PR_E2E_RUNS_PAGE_SIZE;
  return Math.min(n, PR_E2E_RUNS_PAGE_SIZE);
}

export async function GET(req: Request) {
  if (!isHealthCheckMysqlConfigured()) {
    return NextResponse.json(
      { ok: false, error: "MySQL not configured" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const offset = parseOffset(searchParams.get("offset"));
  const limit = parseLimit(searchParams.get("limit"));

  if (!(await isHealthCheckMysqlReachable())) {
    return NextResponse.json(
      { ok: false, error: "Database unreachable" },
      { status: 502 },
    );
  }

  try {
    const payload = await getOrSetPrE2eMysqlCache(
      `pr-e2e:runs-page:v1:${limit}:${offset}`,
      () => loadPrE2eRunsPage(limit, offset, PR_E2E_PIPELINE_FILTER),
    );
    return NextResponse.json({
      ok: true,
      offset,
      limit,
      total: payload.total,
      runs: payload.runs,
      hasMore: offset + payload.runs.length < payload.total,
    });
  } catch (e) {
    if (isRecoverableMysqlPoolError(e)) {
      invalidateHealthCheckMysqlPool();
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
