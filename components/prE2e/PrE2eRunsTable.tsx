"use client";

import { Fragment, useState } from "react";
import { DashboardNavLink } from "@/components/DashboardNavLink";
import type { PrE2eRunWithFailures } from "@/lib/prE2e/types";
import {
  effectiveFailureCount,
  effectiveFailedBrokenOnRun,
  effectivePassRatePct,
  jenkinsResultIsSuccess,
  runHasIngestedTestData,
  prHistoryHref,
  serviceHref,
  testHistoryHref,
} from "@/lib/prE2e/types";
import { PrE2eTestTags } from "@/components/prE2e/PrE2eTestTags";
import { prE2eBadgeStyles } from "@/lib/prE2e/chartColors";

function statusBadge(run: PrE2eRunWithFailures) {
  const detailIssues = Math.max(
    run.failure_count,
    effectiveFailedBrokenOnRun(run),
  );
  if (detailIssues === 0 && jenkinsResultIsSuccess(run.e2e_jenkins_result)) {
    return {
      label: "Pass",
      className: prE2eBadgeStyles.pass,
      title: "Jenkins SUCCESS with no failed/broken tests",
    };
  }
  if (detailIssues === 0 && !jenkinsResultIsSuccess(run.e2e_jenkins_result)) {
    const noAllure = !runHasIngestedTestData(run);
    return {
      label: noAllure
        ? `Jenkins ${run.e2e_jenkins_result} — no test data`
        : run.e2e_jenkins_result || "Failed",
      className: prE2eBadgeStyles.fail,
      title: noAllure
        ? "Jenkins failed but Allure/scenario counts and pr_e2e_failures were not ingested"
        : undefined,
    };
  }
  const issues = effectiveFailureCount(run);
  return {
    label: issues === 1 ? "1 test failure" : `${issues} test failures`,
    className: prE2eBadgeStyles.fail,
    title: "From pr_e2e_failures or Allure counts",
  };
}

export function PrE2eRunsTable({
  runs,
  expandable = false,
  embedScroll = true,
}: {
  runs: PrE2eRunWithFailures[];
  expandable?: boolean;
  /** When false, parent supplies the scroll container (e.g. overview Recent runs). */
  embedScroll?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!runs.length) {
    return (
      <p className="rounded-[10px] border border-dashed border-[#EAEFF5] bg-[#F9FAFB] px-4 py-8 text-center text-sm text-[#94A3B8]">
        No E2E runs match your filters.
      </p>
    );
  }

  const table = (
        <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#EAEFF5] bg-[#F9FAFB] text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
              {expandable ? <th className="w-8 px-2 py-2" /> : null}
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">PR</th>
              <th className="px-4 py-2">Build</th>
              <th className="px-4 py-2">Pass %</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => {
              const s = statusBadge(run);
              const zebra = i % 2 === 1 ? "bg-[#F9FAFB]/80" : "bg-white";
              const expanded = openId === run.id;
              return (
                <Fragment key={run.id}>
                  <tr
                    className={`border-b border-[#EAEFF5] transition-colors hover:bg-[#F6F8FB] ${zebra} ${expandable ? "cursor-pointer" : ""}`}
                    onClick={
                      expandable
                        ? () => setOpenId(expanded ? null : run.id)
                        : undefined
                    }
                  >
                    {expandable ? (
                      <td className="px-2 py-2 text-center text-[#94A3B8]">
                        {run.failures.length
                          ? expanded
                            ? "▼"
                            : "▶"
                          : effectiveFailureCount(run) > 0
                            ? "·"
                            : ""}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-[#64748B]">
                      {run.finished_at_ist ??
                        new Date(run.created_at)
                          .toISOString()
                          .replace("T", " ")
                          .slice(0, 19)}
                    </td>
                    <td className="px-4 py-2">
                      <DashboardNavLink
                        href={serviceHref(run.service_repo)}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-violet-800 underline"
                      >
                        {run.service_repo}
                      </DashboardNavLink>
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      {run.pr_number != null ? (
                        <DashboardNavLink
                          href={prHistoryHref(run.pr_number, run.service_repo)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-violet-800 underline"
                        >
                          #{run.pr_number}
                        </DashboardNavLink>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <a
                        href={run.e2e_build_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-violet-800 underline"
                      >
                        #{run.e2e_build_number}
                      </a>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-[#64748B]">
                      {(() => {
                        const pct = effectivePassRatePct(run);
                        return pct != null ? `${pct}%` : "—";
                      })()}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        title={s.title}
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] ${s.className}`}
                      >
                        {s.label}
                      </span>
                    </td>
                  </tr>
                  {expandable && expanded && run.failures.length ? (
                    <tr key={`${run.id}-detail`} className="bg-[#F9FAFB]">
                      <td colSpan={expandable ? 7 : 6} className="px-6 py-3">
                        <ul className="space-y-1 text-[12px]">
                          {run.failures.slice(0, 12).map((f) => (
                            <li key={f.id} className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <DashboardNavLink
                                  href={testHistoryHref(f.test_name)}
                                  className="text-violet-800 underline"
                                >
                                  {f.test_name}
                                </DashboardNavLink>
                                <span className="text-[#94A3B8]">{f.status}</span>
                              </div>
                              <PrE2eTestTags tags={f.tags} />
                            </li>
                          ))}
                          {run.failures.length > 12 ? (
                            <li className="text-[#94A3B8]">
                              +{run.failures.length - 12} more —{" "}
                              <DashboardNavLink
                                href={`/pr-checks/runs/${run.id}`}
                                className="underline"
                              >
                                run detail
                              </DashboardNavLink>
                            </li>
                          ) : null}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
  );

  if (!embedScroll) {
    return <div className="bg-white">{table}</div>;
  }

  return (
    <div className="overflow-hidden bg-white">
      <div className="max-h-[560px] overflow-auto">{table}</div>
    </div>
  );
}
