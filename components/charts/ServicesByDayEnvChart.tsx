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
      <p className="text-sm text-[#6B7280]">
        No expected services configured.
      </p>
    );
  }

  const hasAny = data.some((r) => r.sdet02 > 0 || r.sdet05 > 0);

  return (
    <div className="w-full min-w-0 overflow-x-auto pb-2">
      <div className="min-w-[880px]">
        <p className="mb-2 text-[11px] text-[#6B7280]">
          {hasAny
            ? "Hover bars for counts. Services with zero failures still shown."
            : "No failures in this range (all zeros)."}
        </p>
        <div className="h-[440px] w-full min-w-0">
          <ResponsiveContainer width="100%" height={440} minWidth={0}>
            <BarChart
              data={data}
              margin={{ top: 8, right: 16, left: 8, bottom: 72 }}
            >
              <CartesianGrid
                stroke={colors.grid}
                vertical={false}
                horizontal
              />
              <XAxis
                dataKey="service"
                tick={{ fill: colors.tick, fontSize: 10 }}
                tickLine={false}
                interval={0}
                angle={-38}
                textAnchor="end"
                height={72}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: colors.tick, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{
                  fill: "rgba(238, 242, 247, 0.55)",
                }}
                contentStyle={{
                  borderRadius: "8px",
                  border: `1px solid ${colors.tooltipBorder}`,
                  fontSize: "12px",
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
