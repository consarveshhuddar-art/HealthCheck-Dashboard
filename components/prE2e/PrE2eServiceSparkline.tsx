"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { PrE2ePassRatePoint } from "@/lib/prE2e/types";
import { prE2eChartColors } from "@/lib/prE2e/chartColors";

export function PrE2eServiceSparkline({ data }: { data: PrE2ePassRatePoint[] }) {
  if (!data.length) {
    return <div className="h-10 w-24 rounded bg-[#F1F5F9]" />;
  }
  return (
    <div className="h-10 w-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="passRate"
            stroke={prE2eChartColors.pass}
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
