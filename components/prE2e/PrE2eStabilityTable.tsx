import Link from "next/link";
import type { PrE2eStabilityRow } from "@/lib/prE2e/types";
import { serviceHref, testHistoryHref } from "@/lib/prE2e/types";
import { prE2eBadgeStyles } from "@/lib/prE2e/chartColors";

const labelStyles: Record<string, string> = {
  flaky: prE2eBadgeStyles.flaky,
  failing: prE2eBadgeStyles.failing,
  stable: prE2eBadgeStyles.stable,
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export function PrE2eStabilityTable({
  rows,
  firstSeen = {},
}: {
  rows: PrE2eStabilityRow[];
  firstSeen?: Record<string, string>;
}) {
  if (!rows.length) {
    return (
      <p className="rounded-[10px] border border-dashed border-[#EAEFF5] bg-[#F9FAFB] px-4 py-8 text-center text-sm text-[#94A3B8]">
        No stability batch yet. Computed weekly on Sunday after enough 30-day history.
      </p>
    );
  }

  return (
    <div className="overflow-hidden bg-white">
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#EAEFF5] bg-[#F9FAFB] text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Test</th>
              <th
                className="px-4 py-2"
                title="E2E builds where this test failed"
              >
                Fail builds
              </th>
              <th
                className="px-4 py-2"
                title="E2E builds where this test did not fail"
              >
                Clean builds
              </th>
              <th
                className="px-4 py-2"
                title="Fail builds ÷ (fail + clean). Stable with 1 build can show 100% — low sample."
              >
                Fail %
              </th>
              <th className="px-4 py-2">First seen</th>
              <th className="px-4 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const zebra = i % 2 === 1 ? "bg-[#F9FAFB]/80" : "bg-white";
              const fsKey = `${row.service_repo}|${row.test_name}`;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-[#EAEFF5] hover:bg-[#F6F8FB] ${zebra}`}
                >
                  <td className="px-4 py-2">
                    <span
                      className={`rounded border px-2 py-0.5 text-[11px] capitalize ${labelStyles[row.stability_label] ?? labelStyles.stable}`}
                    >
                      {row.stability_label}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={serviceHref(row.service_repo)}
                      className="text-violet-800 underline"
                    >
                      {row.service_repo}
                    </Link>
                  </td>
                  <td
                    className="max-w-[280px] truncate px-4 py-2 text-[#64748B]"
                    title={row.test_name}
                  >
                    <Link
                      href={testHistoryHref(row.test_name)}
                      className="text-violet-800 underline"
                    >
                      {row.test_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 tabular-nums">{row.runs_with_failure}</td>
                  <td className="px-4 py-2 tabular-nums">
                    {row.runs_without_failure}
                  </td>
                  <td
                    className="px-4 py-2 tabular-nums"
                    title={
                      row.stability_label === "stable" && row.total_runs < 2
                        ? "Stable = not flaky/failing; % misleading with <2 builds"
                        : undefined
                    }
                  >
                    {row.flaky_rate_pct}%
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[10px] text-[#94A3B8]">
                    {fmt(firstSeen[fsKey])}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[10px] text-[#94A3B8]">
                    {fmt(row.last_seen_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
