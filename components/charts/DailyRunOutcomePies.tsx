"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { DailyRunOutcome } from "@/lib/data";
import { useChartColors } from "@/hooks/use-chart-colors";

const PALETTE = { ok: "#22c55e", bad: "#ef4444" };

const PAGE_SIZE = 7;

function DayDonut({ o }: { o: DailyRunOutcome }) {
  const colors = useChartColors();

  if (o.total === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-xs font-medium tabular-nums text-[#111827]">
          {o.label}
        </span>
        <div
          className="flex h-[112px] w-[112px] shrink-0 items-center justify-center rounded-full border border-dashed border-[#EAEFF5] bg-[#FAFBFC] text-[10px] text-[#9CA3AF]"
          aria-hidden
        >
          No runs
        </div>
        <div className="h-8 text-center text-[10px] text-[#9CA3AF]">
          Total 0
        </div>
      </div>
    );
  }

  const pieces = [
    { name: "Successful", value: o.success, fill: PALETTE.ok },
    { name: "Failed", value: o.failed, fill: PALETTE.bad },
  ].filter((x) => x.value > 0);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-medium tabular-nums text-[#111827]">
        {o.label}
      </span>
      <div className="h-[112px] w-full min-w-[112px] max-w-[140px]">
        <ResponsiveContainer width="100%" height={112} minWidth={0}>
          <PieChart>
            <Pie
              data={pieces}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={48}
              paddingAngle={2}
              strokeWidth={0}
            >
              {pieces.map((_, i) => (
                <Cell key={i} fill={pieces[i].fill} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: `1px solid ${colors.tooltipBorder}`,
                fontSize: "12px",
                backgroundColor: colors.tooltipBg,
                color: colors.tooltipBody,
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                padding: "10px 12px",
              }}
              labelStyle={{ color: colors.tooltipLabel, fontWeight: 500 }}
              itemStyle={{ color: colors.tooltipBody }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full max-w-[140px] text-center text-[10px] leading-snug text-[#6B7280]">
        <div className="font-medium text-[#111827]">
          Total {o.total}
        </div>
        <div className="mt-0.5">
          <span className="font-medium text-emerald-700">{o.success} ok</span>
          <span className="text-[#D1D5DB]"> · </span>
          <span className="font-medium text-[#991B1B]">{o.failed} failed</span>
        </div>
      </div>
    </div>
  );
}

export function DailyRunOutcomePies({ data }: { data: DailyRunOutcome[] }) {
  const rangeKey = useMemo(() => data.map((d) => d.date).join("|"), [data]);
  const maxStart = Math.max(0, data.length - PAGE_SIZE);

  const [start, setStart] = useState(() =>
    Math.max(0, data.length - PAGE_SIZE),
  );

  useEffect(() => {
    setStart(maxStart);
  }, [rangeKey, maxStart]);

  if (!data.length) {
    return (
      <p className="text-sm text-[#6B7280]">No days in range.</p>
    );
  }

  const page = data.slice(start, start + PAGE_SIZE);
  const canPrev = start > 0;
  const canNext = start < maxStart;
  const labelFrom = page[0]?.label;
  const labelTo = page[page.length - 1]?.label;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-[#6B7280]">
          {data.length > PAGE_SIZE ? (
            <>
              Days <span className="font-medium text-[#111827]">{labelFrom}</span>
              {" — "}
              <span className="font-medium text-[#111827]">{labelTo}</span>
              <span className="text-[#9CA3AF]">
                {" "}
                ({start + 1}–{start + page.length} of {data.length})
              </span>
            </>
          ) : (
            <span className="text-[#6B7280]">All {page.length} days in range</span>
          )}
        </p>
        {data.length > PAGE_SIZE ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canPrev}
              aria-label="Show earlier 7 days"
              onClick={() => setStart((s) => Math.max(0, s - PAGE_SIZE))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#EAEFF5] bg-white text-lg font-medium text-[#475569] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[background-color,box-shadow,border-color] duration-150 ease-out hover:border-[#E2E8F0] hover:bg-[#F9FAFB] hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] disabled:pointer-events-none disabled:opacity-35"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={!canNext}
              aria-label="Show later 7 days"
              onClick={() =>
                setStart((s) => Math.min(maxStart, s + PAGE_SIZE))
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[#EAEFF5] bg-white text-lg font-medium text-[#475569] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[background-color,box-shadow,border-color] duration-150 ease-out hover:border-[#E2E8F0] hover:bg-[#F9FAFB] hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] disabled:pointer-events-none disabled:opacity-35"
            >
              ›
            </button>
          </div>
        ) : null}
      </div>

      <div
        key={start}
        className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7"
      >
        {page.map((o) => (
          <DayDonut key={o.date} o={o} />
        ))}
      </div>
    </div>
  );
}
