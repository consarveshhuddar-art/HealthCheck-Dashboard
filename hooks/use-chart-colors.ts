"use client";

import { useMemo } from "react";

/** Recharts — ultra-light grid, minimal axis emphasis. */
const chartColors = {
  grid: "#EEF2F7",
  axis: "transparent",
  tick: "#64748B",
  tooltipBg: "#1F2937",
  tooltipBorder: "rgba(255,255,255,0.08)",
  tooltipLabel: "#F9FAFB",
  tooltipBody: "#D1D5DB",
  legend: "#64748B",
} as const;

export function useChartColors() {
  return useMemo(() => chartColors, []);
}
