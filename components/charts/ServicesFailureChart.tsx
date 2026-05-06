"use client";

import { useMemo } from "react";

export type ServiceRow = { service_name: string; count: number };

export function ServicesFailureChart({ data }: { data: ServiceRow[] }) {
  const rows = useMemo(
    () => data.filter((d) => d.count > 0),
    [data],
  );

  const max = Math.max(...rows.map((r) => r.count), 1);

  const total = useMemo(
    () => rows.reduce((s, r) => s + r.count, 0),
    [rows],
  );

  if (!rows.length) {
    return (
      <p className="text-sm text-[#94A3B8]">
        No per-service failures in loaded runs.
      </p>
    );
  }

  const needsScroll = rows.length > 10;

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-[#94A3B8]">
        <span className="font-medium text-[#334155]">{rows.length} services</span>
        <span className="text-[#D1D5DB]"> · </span>
        <span>{total} failure rows</span>
        <span className="text-[#D1D5DB]"> · </span>
        Bar length vs the #1 service in this list.
      </p>

      <div
        className={
          needsScroll
            ? "leaderboard-scroll max-h-[min(22rem,52vh)] overflow-y-auto overscroll-contain rounded-[10px] border border-[#EAEFF5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            : "rounded-[10px] border border-[#EAEFF5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        }
      >
        <ul className="divide-y divide-[#EAEFF5]">
          {rows.map((row, i) => {
            const pct = Math.round((row.count / max) * 1000) / 10;
            return (
              <li key={row.service_name}>
                <div className="px-4 py-3 transition-colors duration-150 ease-out hover:bg-[#F9FAFB]">
                  <div className="flex gap-4">
                    <span
                      className="w-6 shrink-0 text-right text-[11px] font-medium leading-7 tabular-nums text-[#9CA3AF]"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex items-baseline justify-between gap-4">
                        <p
                          className="min-w-0 truncate text-sm font-medium leading-7 tracking-tight text-[#0B1220]"
                          title={row.service_name}
                        >
                          {row.service_name}
                        </p>
                        <span className="shrink-0 text-sm font-semibold tabular-nums leading-7 text-[#0B1220] sm:text-base">
                          {row.count}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F9FAFB] ring-1 ring-[#EAEFF5]/80">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400 transition-[width] duration-500 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
