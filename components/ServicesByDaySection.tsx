"use client";

import { useRouter } from "next/navigation";
import type { ServiceEnvDayRow } from "@/lib/data";
import { dashboardUi } from "@/lib/dashboardUi";
import { ServicesByDayEnvChart } from "@/components/charts/ServicesByDayEnvChart";

export function ServicesByDaySection({
  selectedDay,
  rows,
}: {
  selectedDay: string;
  rows: ServiceEnvDayRow[];
}) {
  const router = useRouter();

  return (
    <section className={dashboardUi.panel}>
      <div className="flex flex-col gap-4 border-b border-slate-100/90 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={dashboardUi.panelTitle}>
            Failures per service for one day (by env)
          </h2>
          <p className={dashboardUi.panelDesc}>
            Counts from{" "}
            <code className="rounded border border-slate-200 bg-white/80 px-1.5 py-px font-mono text-[11px] text-slate-700">
              health_check_failures
            </code>{" "}
            for runs created on that calendar day (IST). Bars:{" "}
            <span className="font-medium text-violet-700">sdet-02</span> vs{" "}
            <span className="font-medium text-orange-700">sdet-05</span> (
            <code className="font-mono text-[11px] text-slate-600">k8s-sdet-02</code>{" "}
            /{" "}
            <code className="font-mono text-[11px] text-slate-600">k8s-sdet-05</code>
            ).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <label
            htmlFor="health-day"
            className="text-xs font-medium text-slate-600"
          >
            Day (IST)
          </label>
          <input
            id="health-day"
            type="date"
            value={selectedDay}
            className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm text-slate-800 shadow-sm outline-none ring-1 ring-slate-950/[0.04] transition-shadow duration-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            onChange={(e) => {
              const v = e.target.value;
              if (v) router.push(`/?day=${v}`);
            }}
          />
        </div>
      </div>
      <div className={dashboardUi.chartWell}>
        <ServicesByDayEnvChart data={rows} />
      </div>
    </section>
  );
}
