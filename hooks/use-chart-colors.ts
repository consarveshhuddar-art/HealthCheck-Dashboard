"use client";

import { useMemo } from "react";

/** Recharts chrome — single light theme with readable slate accents. */
const chartColors = {
  grid: "#e2e8f0",
  axis: "#cbd5e1",
  tick: "#64748b",
  tooltipBg: "#ffffff",
  tooltipBorder: "#e2e8f0",
  tooltipLabel: "#334155",
  tooltipBody: "#475569",
  legend: "#64748b",
} as const;

export function useChartColors() {
  return useMemo(() => chartColors, []);
}
