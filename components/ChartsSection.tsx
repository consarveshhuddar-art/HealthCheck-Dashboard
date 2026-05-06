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

export function ChartsSection({
  daily,
  weekly,
  dailyOutcomes,
  services,
  runsCap,
  trendDailyDays,
  trendWeeklyBuckets,
}: {
  daily: DailyPoint[];
  weekly: WeeklyPoint[];
  dailyOutcomes: DailyRunOutcome[];
  services: ServiceCount[];
  runsCap: number;
  trendDailyDays: number;
  trendWeeklyBuckets: number;
}) {
  const dailyRows = daily.map((d) => ({ label: d.label, count: d.count }));

  return (
    <div className="flex flex-col gap-4 md:gap-4">
      <div className="grid min-w-0 gap-4 md:gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className={`flex min-h-0 flex-col ${dashboardUi.panel}`}>
          <div className={`shrink-0 ${dashboardUi.panelHeaderDivider}`}>
            <h2 className={dashboardUi.panelTitle}>Failures per day</h2>
            <p className={dashboardUi.panelDesc}>
              Area trend — failure rows per IST calendar day (last {trendDailyDays}{" "}
              days, ~1 month). Independent of the Runs day/week/month control.
            </p>
          </div>
          <div className={dashboardUi.chartWell}>
            <DailyFailuresChart data={dailyRows} />
          </div>
        </section>

        <section className={`flex min-h-0 flex-col ${dashboardUi.panel}`}>
          <div className={`shrink-0 ${dashboardUi.panelHeaderDivider}`}>
            <h2 className={dashboardUi.panelTitle}>Failures per rolling week</h2>
            <p className={dashboardUi.panelDesc}>
              Area trend — IST calendar weeks (Mon–Sun), last {trendWeeklyBuckets}{" "}
              weeks (~1 month). Independent of the Runs day/week/month control.
            </p>
          </div>
          <div className={dashboardUi.chartWell}>
            <WeeklyFailuresChart data={weekly} />
          </div>
        </section>
      </div>

      <section className={dashboardUi.panel}>
        <div className={dashboardUi.panelHeaderDivider}>
          <h2 className={dashboardUi.panelTitle}>Run outcomes per day (IST)</h2>
          <p className={dashboardUi.panelDesc}>
            One donut per IST calendar day: all runs that day (last {trendDailyDays}{" "}
            days, ~1 month), split into successful (no failure rows) vs failed (at least
            one). Seven days at a time — use arrows to browse earlier or later days.
            Independent of the Runs day/week/month control.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-[#EAEFF5] pt-2 text-[10px] text-[#94A3B8]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-600/55" aria-hidden />
              Successful runs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-red-600/45" aria-hidden />
              Failed runs
            </span>
          </div>
        </div>
        <div className={dashboardUi.chartWell}>
          <DailyRunOutcomePies data={dailyOutcomes} />
        </div>
      </section>

      <section className={dashboardUi.panel}>
        <div className={dashboardUi.panelHeaderDivider}>
          <h2 className={dashboardUi.panelTitle}>Top services by failure count</h2>
          <p className={dashboardUi.panelDesc}>
            {`Ranked by failure rows per service — loaded runs (newest ~${runsCap}). Each bar is relative to the highest count in this list.`}
          </p>
        </div>
        <div className={dashboardUi.chartWell}>
          <ServicesFailureChart data={services} />
        </div>
      </section>
    </div>
  );
}
