"use client";

import { useId, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "@/hooks/use-chart-colors";

export type ServiceRow = { service_name: string; count: number };

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

/** Row height budget per service (bars + gaps scale with chart height). */
const BAND_PX = 34;
const CHART_PAD = 52;
const SCROLL_CAP_PX = 420;

export function ServicesFailureChart({ data }: { data: ServiceRow[] }) {
  const colors = useChartColors();
  const gid = useId().replace(/:/g, "");
  const gradId = `svcFailGrad-${gid}`;

  const chartData = useMemo(
    () =>
      data.map((row, i) => ({
        count: row.count,
        fullName: row.service_name,
        label: `${i + 1}. ${truncate(row.service_name, 30)}`,
      })),
    [data],
  );

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const chartHeight = Math.min(
    960,
    Math.max(120, data.length * BAND_PX + CHART_PAD),
  );

  const needsScroll = chartHeight > SCROLL_CAP_PX;

  if (!data.length) {
    return (
      <p className="text-sm text-slate-500">
        No per-service failures in loaded runs.
      </p>
    );
  }

  const chart = (
    <div style={{ height: chartHeight }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height={chartHeight} minWidth={0}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
          barCategoryGap="12%"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="55%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.grid}
            horizontal={false}
          />
          <XAxis
            type="number"
            domain={[0, maxCount]}
            allowDecimals={false}
            tick={{ fill: colors.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: colors.axis }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={196}
            tickLine={false}
            axisLine={false}
            tick={{ fill: colors.tick, fontSize: 11 }}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(248, 250, 252, 0.92)" }}
            contentStyle={{
              borderRadius: "8px",
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: "12px",
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipBody,
            }}
            formatter={(value) => {
              const n =
                typeof value === "number"
                  ? value
                  : Number(value ?? 0);
              return [`${n} failure rows`, "Count"];
            }}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as
                | { fullName?: string }
                | undefined;
              return row?.fullName ?? "";
            }}
          />
          <Bar
            dataKey="count"
            name="Failures"
            fill={`url(#${gradId})`}
            radius={[0, 5, 5, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (needsScroll) {
    return (
      <div className="relative">
        <p className="mb-2 text-[11px] text-slate-500">
          Showing all {data.length} services — scroll vertically inside the chart.
        </p>
        <div className="max-h-[min(420px,65vh)] overflow-auto overflow-x-hidden rounded-lg border border-slate-100/90 bg-white/50 pr-1 [-webkit-overflow-scrolling:touch]">
          {chart}
        </div>
      </div>
    );
  }

  return chart;
}
