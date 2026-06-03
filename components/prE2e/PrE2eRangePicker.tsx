"use client";

import { LoaderSpinner } from "@/components/LoaderSpinner";
import {
  PR_E2E_TREND_DAYS_DEFAULT,
  PR_E2E_TREND_RANGE_BUTTONS,
  type PrE2eTrendDays,
} from "@/lib/prE2e/trendFill";

export function PrE2eRangePicker({
  value,
  onChange,
  loading = false,
  className = "",
}: {
  value: PrE2eTrendDays;
  onChange: (days: PrE2eTrendDays) => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${className}`}
      role="group"
      aria-label="Time range"
    >
      {loading ? (
        <LoaderSpinner size="xs" className="mr-0.5" />
      ) : null}
      {PR_E2E_TREND_RANGE_BUTTONS.map((r) => {
        const active = value === Number(r.key);
        return (
          <button
            key={r.key}
            type="button"
            disabled={loading}
            aria-pressed={active}
            onClick={() => onChange(Number(r.key) as PrE2eTrendDays)}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-60 ${
              active
                ? "bg-[#0B1220] text-white"
                : "bg-[#F9FAFB] text-[#64748B] ring-1 ring-[#EAEFF5] hover:text-[#334155]"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

export { PR_E2E_TREND_DAYS_DEFAULT };
