"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ServiceEnvDayRow } from "@/lib/data";
import { useChartColors } from "@/hooks/use-chart-colors";

/** Contrasting fills for the two env series */
const BAR = { a: "#8b5cf6", b: "#f97316" };

export function ServicesByDayEnvChart({ data }: { data: ServiceEnvDayRow[] }) {
  const colors = useChartColors();

  if (!data.length) {
    return (
      <p className="text-sm text-slate-500">
        No expected services configured.
      </p>
    );
  }

  const hasAny = data.some((r) => r.sdet02 > 0 || r.sdet05 > 0);

  return (
    <div className="w-full min-w-0 overflow-x-auto pb-2">
      <div className="min-w-[880px]">
        <p className="mb-2 text-xs text-slate-500">
          {hasAny
            ? "Hover bars for counts. Services with zero failures still shown."
            : "No failures recorded for this day (all zeros)."}
        </p>
        <div className="h-[420px] w-full min-w-0">
          <ResponsiveContainer width="100%" height={420} minWidth={0}>
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, left: 8, bottom: 72 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={colors.grid}
                vertical={false}
              />
              <XAxis
                dataKey="service"
                tick={{ fill: colors.tick, fontSize: 10 }}
                tickLine={false}
                interval={0}
                angle={-38}
                textAnchor="end"
                height={72}
                axisLine={{ stroke: colors.axis }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: colors.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{
                  fill: "rgba(248, 250, 252, 0.92)",
                }}
                contentStyle={{
                  borderRadius: "8px",
                  border: `1px solid ${colors.tooltipBorder}`,
                  fontSize: "12px",
                  backgroundColor: colors.tooltipBg,
                  color: colors.tooltipBody,
                }}
                labelStyle={{ color: colors.tooltipLabel, fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: "12px",
                  paddingTop: "8px",
                  color: colors.legend,
                }}
                formatter={(value: string) =>
                  value === "sdet02"
                    ? "sdet-02 (k8s-sdet-02)"
                    : "sdet-05 (k8s-sdet-05)"
                }
              />
              <Bar
                dataKey="sdet02"
                name="sdet02"
                fill={BAR.a}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                dataKey="sdet05"
                name="sdet05"
                fill={BAR.b}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
