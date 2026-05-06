"use client";

import { useSearchParams } from "next/navigation";
import { useDashboardNavigate } from "@/components/DashboardNavProvider";
import type { ServiceEnvDayRow } from "@/lib/data";
import { dashboardUi } from "@/lib/dashboardUi";
import { ServicesByDayEnvChart } from "@/components/charts/ServicesByDayEnvChart";

function hrefForNav(
  sp: Pick<URLSearchParams, "toString">,
  opts: {
    envRange: "day" | "week" | "all";
    day: string;
  },
): string {
  const p = new URLSearchParams(sp.toString());
  if (opts.envRange === "week") {
    p.set("envRange", "week");
    p.set("day", opts.day);
  } else if (opts.envRange === "all") {
    p.set("envRange", "all");
    p.set("day", opts.day);
  } else {
    p.delete("envRange");
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
  const navigate = useDashboardNavigate();
  const searchParams = useSearchParams();

  const tabBtn = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ease-out ${
      active
        ? "bg-white text-[#0B1220] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[#EAEFF5]"
        : "text-[#64748B] hover:bg-[#F9FAFB] hover:text-[#334155]"
    }`;

  return (
    <section className={dashboardUi.panel}>
      <div className="flex flex-col gap-3 border-b border-[#EAEFF5] pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className={dashboardUi.panelTitle}>
            Failures per service (by env)
          </h2>
          <p className="text-[11px] font-medium text-[#475569]">
            {caption.title}
          </p>
          <p className={dashboardUi.panelDesc}>
            {caption.detail} Source:{" "}
            <code className="rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-1.5 py-px font-mono text-[11px] text-[#475569]">
              health_check_failures
            </code>
            . Bars:{" "}
            <span className="font-medium text-violet-800/75">sdet-02</span> vs{" "}
            <span className="font-medium text-orange-800/70">sdet-05</span> (
            <code className="font-mono text-[11px] text-[#6B7280]">
              k8s-sdet-02
            </code>{" "}
            /{" "}
            <code className="font-mono text-[11px] text-[#6B7280]">
              k8s-sdet-05
            </code>
            ).
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:shrink-0 sm:items-end">
          <div
            className="inline-flex rounded-[10px] border border-[#EAEFF5] bg-[#F9FAFB] p-1"
            role="tablist"
            aria-label="Time range"
          >
            <button
              type="button"
              role="tab"
              aria-selected={envRange === "day"}
              className={tabBtn(envRange === "day")}
              onClick={() =>
                navigate(
                  hrefForNav(searchParams, {
                    envRange: "day",
                    day: selectedDay,
                  }),
                  { scroll: false },
                )
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
                navigate(
                  hrefForNav(searchParams, {
                    envRange: "week",
                    day: selectedDay,
                  }),
                  { scroll: false },
                )
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
                navigate(
                  hrefForNav(searchParams, {
                    envRange: "all",
                    day: selectedDay,
                  }),
                  { scroll: false },
                )
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
              className="text-xs font-medium text-[#6B7280]"
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
              className="rounded-lg border border-[#EAEFF5] bg-white px-3 py-2 text-sm text-[#0B1220] shadow-[0_1px_2px_rgba(0,0,0,0.03)] outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-violet-300 focus:ring-2 focus:ring-violet-100/80 disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:text-[#94A3B8]"
              onChange={(e) => {
                const v = e.target.value;
                if (v)
                  navigate(
                    hrefForNav(searchParams, { envRange: "day", day: v }),
                    { scroll: false },
                  );
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
