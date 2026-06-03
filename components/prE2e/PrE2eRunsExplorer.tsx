"use client";

import { useMemo, useState } from "react";
import { PrE2eRunsTable } from "@/components/prE2e/PrE2eRunsTable";
import {
  classifyPrE2eEnvGroup,
  PR_E2E_EPHEMERAL_ENV_LABEL,
  PR_E2E_FIXED_ENVS,
} from "@/lib/prE2e/envGroups";
import type { PrE2eRunWithFailures } from "@/lib/prE2e/types";
import { runGitAuthor, runPasses } from "@/lib/prE2e/types";

export function PrE2eRunsExplorer({
  runs,
  initialService = "",
  initialResult = "",
  initialPr = "",
  initialAuthor = "",
  initialEnv = "",
}: {
  runs: PrE2eRunWithFailures[];
  initialService?: string;
  initialResult?: "" | "pass" | "fail";
  initialPr?: string;
  initialAuthor?: string;
  initialEnv?: string;
}) {
  const [service, setService] = useState(initialService);
  const [result, setResult] = useState<"" | "pass" | "fail">(initialResult);
  const [pr, setPr] = useState(initialPr);
  const [author, setAuthor] = useState(initialAuthor);
  const [env, setEnv] = useState(initialEnv);

  const services = useMemo(
    () => [...new Set(runs.map((r) => r.service_repo))].sort(),
    [runs],
  );

  const authors = useMemo(
    () =>
      [...new Set(runs.map((r) => runGitAuthor(r)).filter((a) => a !== "unknown"))].sort(),
    [runs],
  );

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (service && r.service_repo !== service) return false;
      if (author && runGitAuthor(r) !== author) return false;
      if (env && classifyPrE2eEnvGroup(r.env_suffix) !== env) return false;
      if (result === "pass" && !runPasses(r)) return false;
      if (result === "fail" && runPasses(r)) return false;
      if (pr && String(r.pr_number ?? "") !== pr.trim()) return false;
      return true;
    });
  }, [runs, service, author, env, result, pr]);

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
        <label className="text-[10px] font-medium uppercase text-[#94A3B8]">
          Git author
          <select
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="mt-1 block min-w-[9rem] max-w-[12rem] rounded-md border border-[#EAEFF5] bg-white px-2 py-1.5 text-[12px]"
          >
            <option value="">All</option>
            {authors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-[11px] text-[#94A3B8]">
          {filtered.length} of {runs.length} runs
        </p>
      </div>
      <PrE2eRunsTable runs={filtered} expandable />
    </div>
  );
}
