"use client";

import { DashboardNavLink } from "@/components/DashboardNavLink";
import { PR_E2E_ENV_GROUPS } from "@/lib/prE2e/envGroups";
import { failRateCellClass } from "@/lib/prE2e/chartColors";
import type { PrE2eServiceEnvFailurePct, PrE2eServiceEnvStats } from "@/lib/prE2e/types";
import { serviceHref } from "@/lib/prE2e/types";

function formatEnvCell(stats: PrE2eServiceEnvStats): {
  count: string;
  pct: string;
  className: string;
} {
  if (stats.runs <= 0) {
    return { count: "—", pct: "", className: "text-[#64748B]" };
  }
  const pct = stats.failPct ?? 0;
  return {
    count: `${stats.failedRuns}/${stats.runs}`,
    pct: `${pct}%`,
    className: failRateCellClass(pct),
  };
}

export function PrE2eServiceEnvFailureTable({
  rows,
  days,
  singleService = false,
}: {
  rows: PrE2eServiceEnvFailurePct[];
  days: number;
  singleService?: boolean;
}) {
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-[#94A3B8]">
        No runs with env data in the last {days} days.
      </p>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#EAEFF5] bg-[#F9FAFB] text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
            {singleService ? null : (
              <th className="px-3 py-2">Service</th>
            )}
            {PR_E2E_ENV_GROUPS.map((env) => (
              <th key={env} className="px-3 py-2 text-right">
                {env === "ephemeral" ? "Ephemeral" : env}
                <span className="mt-0.5 block font-normal normal-case text-[#94A3B8]">
                  Failed / total · %
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.service}
              className={`border-b border-[#EAEFF5] hover:bg-[#F6F8FB] ${i % 2 ? "bg-[#F9FAFB]/80" : "bg-white"}`}
            >
              {singleService ? null : (
                <td className="px-3 py-2">
                  <DashboardNavLink
                    href={serviceHref(row.service)}
                    className="font-medium text-violet-800 underline"
                  >
                    {row.service}
                  </DashboardNavLink>
                </td>
              )}
              {PR_E2E_ENV_GROUPS.map((env) => {
                const cell = formatEnvCell(row.envs[env]);
                return (
                  <td key={env} className="px-3 py-2 text-right tabular-nums">
                    {cell.pct ? (
                      <div className={cell.className}>
                        <span className="block text-[12px]">{cell.count}</span>
                        <span className="block text-[11px] opacity-90">
                          {cell.pct}
                        </span>
                      </div>
                    ) : (
                      <span className={cell.className}>{cell.count}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
