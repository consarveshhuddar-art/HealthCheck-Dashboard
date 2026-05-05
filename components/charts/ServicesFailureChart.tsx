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
      <p className="text-sm text-slate-500">
        No per-service failures in loaded runs.
      </p>
    );
  }

  const needsScroll = rows.length > 10;

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-600">
        <span className="font-medium text-slate-800">{rows.length} services</span>
        <span className="text-slate-400"> · </span>
        <span>{total} failure rows</span>
        <span className="text-slate-400"> · </span>
        Bar length vs the #1 service in this list.
      </p>

      <div
        className={
          needsScroll
            ? "leaderboard-scroll max-h-[min(22rem,52vh)] overflow-y-auto overscroll-contain rounded-2xl border border-white/65 bg-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-950/[0.05] backdrop-blur-md"
            : "rounded-2xl border border-white/65 bg-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-950/[0.05] backdrop-blur-md"
        }
      >
        <ul className="divide-y divide-slate-100/90">
          {rows.map((row, i) => {
            const pct = Math.round((row.count / max) * 1000) / 10;
            return (
              <li key={row.service_name}>
                <div className="px-4 py-3 transition-colors hover:bg-white/70">
                  <div className="flex gap-3">
                    <span
                      className="w-6 shrink-0 text-right text-[11px] font-semibold leading-6 tabular-nums text-slate-400"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <p
                          className="min-w-0 truncate text-sm font-medium leading-6 tracking-tight text-slate-800"
                          title={row.service_name}
                        >
                          {row.service_name}
                        </p>
                        <span className="shrink-0 text-sm font-semibold tabular-nums leading-6 text-slate-900 sm:text-base">
                          {row.count}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/90 ring-1 ring-slate-950/[0.04]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose-500 via-rose-400 to-amber-400 shadow-sm transition-[width] duration-500 ease-out"
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
