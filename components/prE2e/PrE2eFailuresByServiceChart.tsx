"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PrE2eScrollRegion } from "@/components/prE2e/PrE2eScrollRegion";
import { prE2eChartColors } from "@/lib/prE2e/chartColors";
import type { PrE2eServicePoint } from "@/lib/prE2e/types";

const C = prE2eChartColors;

export function PrE2eFailuresByServiceChart({
  data,
}: {
  data: PrE2eServicePoint[];
}) {
  if (!data.length) return null;

  const chartHeight = Math.min(Math.max(data.length * 28, 160), 420);
  const withFailures = data.filter((row) => row.failures > 0).length;

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-snug text-[#94A3B8]">
        <span className="font-medium text-[#334155]">{data.length} services</span>
        {withFailures < data.length ? (
          <>
            <span className="text-[#D1D5DB]"> · </span>
            <span>{withFailures} with failures</span>
          </>
        ) : null}
      </p>
      <PrE2eScrollRegion>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#EAEFF5" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="service"
              width={112}
              tick={{ fontSize: 9 }}
            />
            <Tooltip />
            <Bar dataKey="failures" fill={C.unknown} name="Failures" />
          </BarChart>
        </ResponsiveContainer>
      </PrE2eScrollRegion>
    </div>
  );
}
