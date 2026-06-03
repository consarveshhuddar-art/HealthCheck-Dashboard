"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatCard } from "@/components/StatCard";
import {
  EmptyChart,
  PrE2eChartPanel,
} from "@/components/prE2e/PrE2eDashboardCharts";
import { dashboardUi } from "@/lib/dashboardUi";
import { prE2eChartColors } from "@/lib/prE2e/chartColors";
import type { PrE2ePrRaisedPoint, PrE2ePrRaisedSummary } from "@/lib/prE2e/types";

const H = 200;
const C = prE2eChartColors;

export function PrE2ePrRaisedPanel({
  summary,
  trend,
}: {
  summary: PrE2ePrRaisedSummary;
  trend: PrE2ePrRaisedPoint[];
}) {
  const hasTrend = trend.some((d) => d.runs > 0);

  return (
    <PrE2eChartPanel
      title="Ingested E2E runs"
      description="Every ingested build counts once (same PR re-run = separate rows). Any Jenkins outcome — pass, fail, or unstable."
    >
      <div className="flex flex-col gap-6">
        <div className={`${dashboardUi.statGrid} lg:grid-cols-3`}>
          <StatCard
            title="Runs (7d)"
            value={summary.runs7d}
            hint="Last 7 days"
            accent="sky"
          />
          <StatCard
            title="Runs (30d)"
            value={summary.runs30d}
            hint="Last 30 days"
            accent="slate"
          />
          <StatCard
            title="Runs (90d)"
            value={summary.runs90d}
            hint="Last 90 days"
            accent="slate"
          />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#94A3B8]">
            Runs per day (IST, last 90 days)
          </p>
          {hasTrend ? (
            <ResponsiveContainer width="100%" height={H}>
              <AreaChart
                data={trend}
                margin={{ top: 8, right: 8, left: 0, bottom: 32 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="runs"
                  stroke={C.volume}
                  fill={C.volume}
                  fillOpacity={0.2}
                  name="Runs"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>
    </PrE2eChartPanel>
  );
}
