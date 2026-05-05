"use client";

import { DailyRunOutcomePies } from "@/components/charts/DailyRunOutcomePies";
import { DailyFailuresChart } from "@/components/charts/DailyFailuresChart";
import { WeeklyFailuresChart } from "@/components/charts/WeeklyFailuresChart";
import { ServicesFailureChart } from "@/components/charts/ServicesFailureChart";
import type {
  DailyPoint,
  DailyRunOutcome,
  ServiceCount,
  WeeklyPoint,
} from "@/lib/data";
import { dashboardUi } from "@/lib/dashboardUi";
import { RECENT_RUNS_LIMIT } from "@/lib/limits";

export function ChartsSection({
  daily,
  weekly,
  dailyOutcomes,
  services,
}: {
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  dailyOutcomes: DailyRunOutcome[];
  services: ServiceCount[];
}) {
  const dailyRows = daily.map((d) => ({ label: d.label, count: d.count }));

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <div className="grid min-w-0 gap-6 md:gap-7 lg:grid-cols-2 lg:items-stretch">
        <section className={`flex min-h-0 flex-col ${dashboardUi.panel}`}>
          <div className="shrink-0 border-b border-slate-100/90 pb-3">
            <h2 className={dashboardUi.panelTitle}>Failures per day</h2>
            <p className={dashboardUi.panelDesc}>
              Area trend — failure rows per IST calendar day (last 14 days).
            </p>
          </div>
          <div className={dashboardUi.chartWell}>
            <DailyFailuresChart data={dailyRows} />
          </div>
        </section>

        <section className={`flex min-h-0 flex-col ${dashboardUi.panel}`}>
          <div className="shrink-0 border-b border-slate-100/90 pb-3">
            <h2 className={dashboardUi.panelTitle}>Failures per rolling week</h2>
            <p className={dashboardUi.panelDesc}>
              Area trend — IST calendar weeks (Mon–Sun), consecutive blocks of seven days.
            </p>
          </div>
          <div className={dashboardUi.chartWell}>
            <WeeklyFailuresChart data={weekly} />
          </div>
        </section>
      </div>

      <section className={dashboardUi.panel}>
        <div className="border-b border-slate-100/90 pb-3">
          <h2 className={dashboardUi.panelTitle}>Run outcomes per day (IST)</h2>
          <p className={dashboardUi.panelDesc}>
            One donut per calendar day: total runs in the loaded window, split into
            successful (no failure rows) vs failed (at least one). Seven days at a time;
            same 14-day range as the daily trend — use arrows to browse earlier or later
            days.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100/80 pt-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden />
              Successful runs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" aria-hidden />
              Failed runs
            </span>
          </div>
        </div>
        <div className={dashboardUi.chartWell}>
          <DailyRunOutcomePies data={dailyOutcomes} />
        </div>
      </section>

      <section className={dashboardUi.panel}>
        <div className="border-b border-slate-100/90 pb-3">
          <h2 className={dashboardUi.panelTitle}>Top services by failure count</h2>
          <p className={dashboardUi.panelDesc}>
            {`Ranked by failure rows per service — loaded runs (newest ~${RECENT_RUNS_LIMIT}). Each bar is relative to the highest count in this list.`}
          </p>
        </div>
        <div className={dashboardUi.chartWell}>
          <ServicesFailureChart data={services} />
        </div>
      </section>
    </div>
  );
}
