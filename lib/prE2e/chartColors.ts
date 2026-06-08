/** Consistent PR E2E chart + badge palette */
export const prE2eChartColors = {
  pass: "#22C55E",
  passFill: "rgba(34, 197, 94, 0.1)",
  failure: "#EF4444",
  flaky: "#F59E0B",
  broken: "#F97316",
  aborted: "#94A3B8",
  skipped: "#94A3B8",
  unknown: "#6366F1",
  /** Light orange — service failure bars */
  serviceFailure: "#FDBA74",
  volume: "#6366F1",
  duration: "#94A3B8",
  grid: "#EAEFF5",
} as const;

export const prE2eBadgeStyles = {
  flaky: "border-amber-200/60 bg-[#FEF3C7] text-[#D97706]",
  failing: "border-rose-200/60 bg-[#FEE2E2] text-[#DC2626]",
  stable: "border-emerald-200/60 bg-[#DCFCE7] text-[#16A34A]",
  pass: "border-emerald-200/60 bg-emerald-50/70 text-emerald-900",
  fail: "border-rose-200/60 bg-rose-50/65 text-rose-900",
} as const;

export function passRateCellClass(rate: number | null | undefined): string {
  if (rate == null) return "text-[#64748B]";
  if (rate < 95) return "font-medium text-[#DC2626]";
  if (rate < 99) return "font-medium text-[#D97706]";
  return "font-medium text-[#16A34A]";
}

export function failRateCellClass(rate: number | null | undefined): string {
  if (rate == null) return "text-[#64748B]";
  if (rate >= 20) return "font-medium text-[#DC2626]";
  if (rate >= 5) return "font-medium text-[#D97706]";
  return "font-medium text-[#16A34A]";
}
