"use client";

import { useCallback, useMemo, useState } from "react";
import { LoaderSpinner } from "@/components/LoaderSpinner";
import { PrE2eRunsTable } from "@/components/prE2e/PrE2eRunsTable";
import {
  classifyPrE2eEnvGroup,
  PR_E2E_EPHEMERAL_ENV_LABEL,
  PR_E2E_FIXED_ENVS,
} from "@/lib/prE2e/envGroups";
import type { PrE2eRunWithFailures } from "@/lib/prE2e/types";
import { runPasses } from "@/lib/prE2e/types";

export function PrE2eRunsExplorer({
  runs: initialRuns,
  totalRuns,
  pageSize,
  initialService = "",
  initialResult = "",
  initialPr = "",
  initialEnv = "",
}: {
  runs: PrE2eRunWithFailures[];
  totalRuns: number;
  pageSize: number;
  initialService?: string;
  initialResult?: "" | "pass" | "fail";
  initialPr?: string;
  initialEnv?: string;
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [service, setService] = useState(initialService);
  const [result, setResult] = useState<"" | "pass" | "fail">(initialResult);
  const [pr, setPr] = useState(initialPr);
  const [env, setEnv] = useState(initialEnv);

  const hasMore = runs.length < totalRuns;

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/pr-e2e/runs?limit=${pageSize}&offset=${runs.length}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        ok?: boolean;
        runs?: PrE2eRunWithFailures[];
        error?: string;
      };
      if (!res.ok || !body.ok || !body.runs) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setRuns((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const next = body.runs!.filter((r) => !seen.has(r.id));
        return [...prev, ...next];
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, pageSize, runs.length]);

  const services = useMemo(
    () => [...new Set(runs.map((r) => r.service_repo))].sort(),
    [runs],
  );

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (service && r.service_repo !== service) return false;
      if (env && classifyPrE2eEnvGroup(r.env_suffix) !== env) return false;
      if (result === "pass" && !runPasses(r)) return false;
      if (result === "fail" && runPasses(r)) return false;
      if (pr && String(r.pr_number ?? "") !== pr.trim()) return false;
      return true;
    });
  }, [runs, service, env, result, pr]);

  const countLabel =
    filtered.length === runs.length
      ? `${runs.length} of ${totalRuns} runs`
      : `${filtered.length} shown · ${runs.length} loaded · ${totalRuns} total`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-[10px] border border-[#EAEFF5] bg-[#F9FAFB] p-3">
        <label className="text-[10px] font-medium uppercase text-[#94A3B8]">
          Service
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="mt-1 block rounded-md border border-[#EAEFF5] bg-white px-2 py-1.5 text-[12px]"
          >
            <option value="">All</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-medium uppercase text-[#94A3B8]">
          Environment
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            className="mt-1 block min-w-[10rem] rounded-md border border-[#EAEFF5] bg-white px-2 py-1.5 text-[12px]"
          >
            <option value="">All</option>
            {PR_E2E_FIXED_ENVS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
            <option value={PR_E2E_EPHEMERAL_ENV_LABEL}>
              {PR_E2E_EPHEMERAL_ENV_LABEL}
            </option>
          </select>
        </label>
        <label className="text-[10px] font-medium uppercase text-[#94A3B8]">
          Result
          <select
            value={result}
            onChange={(e) => setResult(e.target.value as "" | "pass" | "fail")}
            className="mt-1 block rounded-md border border-[#EAEFF5] bg-white px-2 py-1.5 text-[12px]"
          >
            <option value="">All</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </label>
        <label className="text-[10px] font-medium uppercase text-[#94A3B8]">
          PR #
          <input
            value={pr}
            onChange={(e) => setPr(e.target.value)}
            placeholder="e.g. 42"
            className="mt-1 block w-24 rounded-md border border-[#EAEFF5] bg-white px-2 py-1.5 text-[12px]"
          />
        </label>
        <p className="ml-auto text-[11px] text-[#94A3B8]">{countLabel}</p>
      </div>
      <PrE2eRunsTable runs={filtered} expandable />
      {hasMore ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-md border border-[#EAEFF5] bg-white px-4 py-2 text-sm font-medium text-[#334155] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <LoaderSpinner size="sm" />
                Loading…
              </span>
            ) : (
              `Load more runs (${Math.min(pageSize, totalRuns - runs.length)} more)`
            )}
          </button>
          {loadError ? (
            <p className="text-center text-sm text-rose-700">{loadError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
