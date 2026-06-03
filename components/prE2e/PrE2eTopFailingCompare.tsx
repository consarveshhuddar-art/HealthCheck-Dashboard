"use client";

import { PrE2eScrollRegion } from "@/components/prE2e/PrE2eScrollRegion";
import { DashboardNavLink } from "@/components/DashboardNavLink";
import type { TopFailingCompareRow } from "@/lib/prE2e/format";
import { PR_E2E_ANALYTICS_MAX_ROWS } from "@/lib/prE2e/limits";
import { testHistoryHref } from "@/lib/prE2e/types";

const trendIcon = {
  worse: "▲",
  better: "▼",
  same: "—",
  new: "●",
} as const;

export function PrE2eTopFailingCompare({ rows }: { rows: TopFailingCompareRow[] }) {
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-[#94A3B8]">No failures in range.</p>
    );
  }
  const visible = rows.slice(0, PR_E2E_ANALYTICS_MAX_ROWS);

  return (
    <PrE2eScrollRegion>
      <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-[#EAEFF5] bg-[#F9FAFB] text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
            <th className="px-3 py-2">Test</th>
            <th className="px-3 py-2 text-right">7d</th>
            <th className="px-3 py-2 text-right">30d</th>
            <th className="px-3 py-2 text-center">Trend</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, i) => (
            <tr
              key={row.name}
              className={`border-b border-[#EAEFF5] ${i % 2 ? "bg-[#F9FAFB]/80" : "bg-white"}`}
            >
              <td className="max-w-[240px] truncate px-3 py-2" title={row.name}>
                <DashboardNavLink
                  href={testHistoryHref(row.name)}
                  className="text-violet-800 underline"
                >
                  {row.name}
                </DashboardNavLink>
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {row.count7d}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#64748B]">
                {row.count30d}
              </td>
              <td
                className={`px-3 py-2 text-center text-[11px] font-medium ${
                  row.trend === "worse"
                    ? "text-rose-700"
                    : row.trend === "better"
                      ? "text-emerald-700"
                      : "text-[#94A3B8]"
                }`}
                title={
                  row.trend === "worse"
                    ? "More failures in 7d than expected from 30d rate"
                    : row.trend === "better"
                      ? "Fewer recent failures than 30d baseline"
                      : undefined
                }
              >
                {trendIcon[row.trend]}
                {row.delta !== 0 && row.trend !== "new" ? ` ${row.delta > 0 ? "+" : ""}${row.delta}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrE2eScrollRegion>
  );
}
