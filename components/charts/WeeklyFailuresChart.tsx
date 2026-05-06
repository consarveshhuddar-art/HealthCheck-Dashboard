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

export type WeeklyRow = { label: string; count: number };

import { TREND_CHART_HEIGHT } from "@/components/charts/trendConstants";
import { useChartColors } from "@/hooks/use-chart-colors";

const MARGIN = { top: 6, right: 8, left: 0, bottom: 40 };

export function WeeklyFailuresChart({ data }: { data: WeeklyRow[] }) {
  const colors = useChartColors();
  const gid = useId().replace(/:/g, "");
  const gradientId = `weeklyFailuresFill-${gid}`;

  const series = useMemo(
    () => ({
      gradient: [
        { off: "5%", color: "#6366f1", op: 0.07 },
        { off: "95%", color: "#6366f1", op: 0 },
      ],
      stroke: "#4f46e5",
      dot: "#4f46e5",
    }),
    [],
  );

  if (!data.length) {
    return (
      <div
        className="flex w-full min-w-0 items-center justify-center text-sm text-[#6B7280]"
        style={{ height: TREND_CHART_HEIGHT }}
      >
        No failure data in this range.
      </div>
    );
  }

  return (
    <div
      className="w-full min-w-0"
      style={{ minHeight: TREND_CHART_HEIGHT }}
    >
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
            stroke={colors.grid}
            vertical={false}
            horizontal
          />
          <XAxis
            dataKey="label"
            tick={{ fill: colors.tick, fontSize: 9 }}
            tickLine={false}
            interval={0}
            angle={-32}
            textAnchor="end"
            height={48}
            axisLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: colors.tick, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={38}
          />
          <Tooltip
            cursor={{ stroke: "#EEF2F7", strokeWidth: 1, strokeOpacity: 0.9 }}
            contentStyle={{
              borderRadius: "8px",
              border: `1px solid ${colors.tooltipBorder}`,
              fontSize: "12px",
              maxWidth: 320,
              backgroundColor: colors.tooltipBg,
              color: colors.tooltipBody,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              padding: "10px 12px",
            }}
            labelStyle={{
              color: colors.tooltipLabel,
              fontWeight: 500,
              marginBottom: 4,
            }}
            itemStyle={{ color: colors.tooltipBody }}
          />
          <Area
            type="natural"
            dataKey="count"
            name="Failures"
            stroke={series.stroke}
            strokeWidth={1}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: series.dot, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
