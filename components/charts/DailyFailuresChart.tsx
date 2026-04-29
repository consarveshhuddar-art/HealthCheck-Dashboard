"use client";

import { useId, useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type DailyRow = { label: string; count: number };

import { TREND_CHART_HEIGHT } from "@/components/charts/trendConstants";
import { useChartColors } from "@/hooks/use-chart-colors";

const MARGIN = { top: 12, right: 12, left: 4, bottom: 44 };

export function DailyFailuresChart({ data }: { data: DailyRow[] }) {
  const colors = useChartColors();
  const gid = useId().replace(/:/g, "");
  const gradientId = `dailyFailuresFill-${gid}`;

  const series = useMemo(
    () => ({
      gradient: [
        { off: "5%", color: "#ef4444", op: 0.35 },
        { off: "95%", color: "#ef4444", op: 0 },
      ],
      stroke: "#dc2626",
      dot: "#dc2626",
    }),
    [],
  );

  if (!data.length) {
    return (
      <div
        className="flex w-full min-w-0 items-center justify-center text-sm text-slate-500"
        style={{ height: TREND_CHART_HEIGHT }}
      >
        No failure data in this range.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full min-w-0">
      <ResponsiveContainer width="100%" height={TREND_CHART_HEIGHT} minWidth={0}>
        <AreaChart data={data} margin={MARGIN}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {series.gradient.map((s, i) => (
                <stop
                  key={i}
                  offset={s.off}
                  stopColor={s.color}
                  stopOpacity={s.op}
                />
              ))}
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={colors.grid}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.tick, fontSize: 10 }}
            tickLine={false}
            interval={0}
            angle={-32}
            textAnchor="end"
            height={48}
            axisLine={{ stroke: colors.axis }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: colors.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: colors.axis, strokeWidth: 1 }}
            contentStyle={{
              borderRadius: "8px",
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: "12px",
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipBody,
            }}
            labelStyle={{ color: colors.tooltipLabel, fontWeight: 600 }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Failures"
            stroke={series.stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{ r: 2, fill: series.dot, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
