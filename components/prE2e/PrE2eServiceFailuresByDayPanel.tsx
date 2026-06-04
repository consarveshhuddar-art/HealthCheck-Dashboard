"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderSpinner } from "@/components/LoaderSpinner";
import { PrE2eFailuresByServiceChart } from "@/components/prE2e/PrE2eFailuresByServiceChart";
import { PrE2ePageLink } from "@/components/prE2e/PrE2ePageLink";
import { PrE2eRangePicker } from "@/components/prE2e/PrE2eRangePicker";
import { dashboardUi } from "@/lib/dashboardUi";
import {
  formatIstDateLabel,
  todayIstDateString,
} from "@/lib/prE2e/istDate";
import type { PrE2eTrendDays } from "@/lib/prE2e/trendFill";
import type { PrE2eServiceDayFailure } from "@/lib/prE2e/types";
import { serviceHref } from "@/lib/prE2e/types";

function rangeSummaryLabel(days: PrE2eTrendDays, date: string): string {
  if (days === 1) return formatIstDateLabel(date);
  return `Last ${days} days`;
}

export function PrE2eServiceFailuresByDayPanel({
  className = "mt-4",
}: {
  className?: string;
}) {
  const today = todayIstDateString();
  const [rangeDays, setRangeDays] = useState<PrE2eTrendDays>(1);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<PrE2eServiceDayFailure[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (days: PrE2eTrendDays, istDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs =
        days === 1
          ? `days=1&date=${encodeURIComponent(istDate)}`
          : `days=${days}`;
      const res = await fetch(`/api/pr-e2e/service-failures-day?${qs}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as {
        ok?: boolean;
        data?: PrE2eServiceDayFailure[];
        error?: string;
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      setRows(body.data ?? []);
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(rangeDays, date);
  }, [rangeDays, date, load]);

  const chartData =
    rows?.map((r) => ({
      service: r.service,
      failures: r.failedRuns,
      runs: r.totalRuns,
    })) ?? [];

  const totalFailed = rows?.reduce((a, r) => a + r.failedRuns, 0) ?? 0;
  const emptyMessage =
    rangeDays === 1
      ? "No failed PR E2E runs for any service on this day."
      : `No failed PR E2E runs for any service in the last ${rangeDays} days.`;

  return (
    <section className={`${dashboardUi.panel} ${className}`}>
      <div className={dashboardUi.panelHeaderDivider}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={dashboardUi.panelTitle}>
              Service failures by day
            </h2>
            <p className={dashboardUi.panelDesc}>
              Services with at least one failed PR E2E run — pick a calendar
              day (1d) or a rolling 7d / 30d / 90d window.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-end gap-3">
            <PrE2eRangePicker
              value={rangeDays}
              onChange={setRangeDays}
              loading={loading}
            />
            {rangeDays === 1 ? (
              <label className="flex flex-col text-[10px] font-medium uppercase text-[#94A3B8]">
                Date (IST)
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 rounded-md border border-[#EAEFF5] bg-white px-2 py-1.5 text-[12px] font-normal normal-case text-[#334155]"
                />
              </label>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[#64748B]">
          {rangeSummaryLabel(rangeDays, date)}
          {!loading && !error ? (
            <>
              {" "}
              ·{" "}
              <span className="font-medium text-[#334155]">
                {rows?.length ?? 0} service
                {(rows?.length ?? 0) === 1 ? "" : "s"}
              </span>
              {totalFailed > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-orange-800/90">
                    {totalFailed} failed run{totalFailed === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-3">
        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-[#94A3B8]">
            <LoaderSpinner size="md" />
            Loading…
          </p>
        ) : error ? (
          <p className="py-12 text-center text-sm text-rose-700">{error}</p>
        ) : !rows?.length ? (
          <p className="py-12 text-center text-sm text-[#94A3B8]">
            {emptyMessage}
          </p>
        ) : (
          <>
            <PrE2eFailuresByServiceChart data={chartData} />
            <table className="mt-4 w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-[#EAEFF5] text-[10px] uppercase text-[#94A3B8]">
                  <th className="px-3 py-2 font-medium">Service</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Failed runs
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    Total runs
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.service}
                    className="border-b border-[#EAEFF5]/80 last:border-0"
                  >
                    <td className="px-3 py-2">
                      <PrE2ePageLink
                        href={serviceHref(row.service)}
                        className="font-medium text-violet-800 underline"
                      >
                        {row.service}
                      </PrE2ePageLink>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-orange-800/90">
                      {row.failedRuns}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#64748B]">
                      {row.totalRuns}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}
