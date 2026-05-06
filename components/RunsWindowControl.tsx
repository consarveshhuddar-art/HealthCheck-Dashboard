"use client";

import { useSearchParams } from "next/navigation";
import { useDashboardNavigate } from "@/components/DashboardNavProvider";
import type { RunDataWindow } from "@/lib/limits";
import { runDataWindowLabel } from "@/lib/limits";

function tabClass(active: boolean) {
  return `rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-150 ease-out sm:px-3 ${
    active
      ? "bg-white text-[#0B1220] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[#EAEFF5]"
      : "text-[#64748B] hover:bg-[#F9FAFB] hover:text-[#334155]"
  }`;
}

export function RunsWindowControl({
  currentWindow,
}: {
  currentWindow: RunDataWindow;
}) {
  const navigate = useDashboardNavigate();
  const searchParams = useSearchParams();

  const setWindow = (w: RunDataWindow) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("window", w);
    navigate(`/?${p.toString()}`, { scroll: false });
  };

  return (
    <div
      className="inline-flex items-center gap-2 rounded-[10px] border border-[#EAEFF5] bg-[#F9FAFB] p-1"
      role="group"
      aria-label="Runs loaded for charts and table"
    >
      <span className="hidden pl-1.5 text-[10px] font-medium uppercase tracking-wide text-[#94A3B8] sm:inline">
        Runs
      </span>
      {(["day", "week", "month"] as const).map((w) => (
        <button
          key={w}
          type="button"
          aria-pressed={currentWindow === w}
          className={tabClass(currentWindow === w)}
          onClick={() => setWindow(w)}
        >
          {runDataWindowLabel(w)}
        </button>
      ))}
    </div>
  );
}
