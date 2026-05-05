"use client";

import { useRouter } from "next/navigation";
import type { ServiceEnvDayRow } from "@/lib/data";
import { dashboardUi } from "@/lib/dashboardUi";
import { ServicesByDayEnvChart } from "@/components/charts/ServicesByDayEnvChart";

function hrefForNav(opts: {
  envRange: "day" | "week" | "all";
  day: string;
}): string {
  const p = new URLSearchParams();
  if (opts.envRange === "week") {
    p.set("envRange", "week");
    p.set("day", opts.day);
  } else if (opts.envRange === "all") {
    p.set("envRange", "all");
    p.set("day", opts.day);
  } else {
    p.set("day", opts.day);
  }
  return `/?${p.toString()}`;
}

export function ServicesByDaySection({
  envRange,
  selectedDay,
  caption,
  rows,
}: {
  envRange: "day" | "week" | "all";
  selectedDay: string;
  caption: { title: string; detail: string };
  rows: ServiceEnvDayRow[];
}) {
  const router = useRouter();

  const tabBtn = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
      active
        ? "bg-white/90 text-slate-900 shadow-sm ring-1 ring-slate-950/[0.08]"
        : "text-slate-600 hover:bg-white/50 hover:text-slate-800"
    }`;

  return (
    <section className={dashboardUi.panel}>
      <div className="flex flex-col gap-4 border-b border-slate-100/90 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={dashboardUi.panelTitle}>
            Failures per service (by env)
          </h2>
          <p className="text-[11px] font-medium text-violet-800/90">
            {caption.title}
          </p>
          <p className={dashboardUi.panelDesc}>
            {caption.detail} Source:{" "}
            <code className="rounded border border-slate-200 bg-white/80 px-1.5 py-px font-mono text-[11px] text-slate-700">
              health_check_failures
            </code>
            . Bars:{" "}
            <span className="font-medium text-violet-700">sdet-02</span> vs{" "}
            <span className="font-medium text-orange-700">sdet-05</span> (
            <code className="font-mono text-[11px] text-slate-600">
              k8s-sdet-02
            </code>{" "}
            /{" "}
            <code className="font-mono text-[11px] text-slate-600">
              k8s-sdet-05
            </code>
            ).
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:shrink-0 sm:items-end">
          <div
            className="inline-flex rounded-xl border border-slate-200/90 bg-slate-100/50 p-1 ring-1 ring-slate-950/[0.04]"
            role="tablist"
            aria-label="Time range"
          >
            <button
              type="button"
              role="tab"
              aria-selected={envRange === "day"}
              className={tabBtn(envRange === "day")}
              onClick={() =>
                router.push(hrefForNav({ envRange: "day", day: selectedDay }))
              }
            >
              Day
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={envRange === "week"}
              className={tabBtn(envRange === "week")}
              onClick={() =>
                router.push(hrefForNav({ envRange: "week", day: selectedDay }))
              }
            >
              Last 7 days
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={envRange === "all"}
              className={tabBtn(envRange === "all")}
              onClick={() =>
                router.push(hrefForNav({ envRange: "all", day: selectedDay }))
              }
            >
              All time
            </button>
          </div>
          <div
            className={`flex flex-wrap items-center gap-2 sm:justify-end ${
              envRange === "day" ? "" : "opacity-60"
            }`}
          >
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
              disabled={envRange !== "day"}
              title={
                envRange !== "day"
                  ? "Switch to “Day” to pick a calendar date"
                  : undefined
              }
              className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-sm text-slate-800 shadow-sm outline-none ring-1 ring-slate-950/[0.04] transition-shadow duration-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-slate-100/80"
              onChange={(e) => {
                const v = e.target.value;
                if (v) router.push(hrefForNav({ envRange: "day", day: v }));
              }}
            />
          </div>
        </div>
      </div>
      <div className={dashboardUi.chartWell}>
        <ServicesByDayEnvChart data={rows} />
      </div>
    </section>
  );
}
