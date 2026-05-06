/**
 * Layered light theme — page vs card vs inset chart (soft contrast).
 */
const borderSoft = "border border-[#EAEFF5]";
const cardBg =
  "bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFE_100%)]";
const lift =
  "shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.045)] hover:-translate-y-px";
const ease = "transition-[box-shadow,transform] duration-150 ease-out";

export const dashboardUi = {
  pageShell: "min-h-full",
  /** 8px rhythm: 16–24px horizontal, 16px vertical default */
  content:
    "mx-auto w-full max-w-[1920px] px-4 py-4 sm:px-5 sm:py-4 lg:px-6",
  /** Flush with page — no card chrome so content below pops */
  pageHeader: "mb-4 sm:mb-5",
  statGrid: "grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4",
  panel: `rounded-[10px] ${borderSoft} ${cardBg} p-3.5 ${lift} ${ease} md:p-4`,
  panelHeaderDivider: "border-b border-[#EAEFF5] pb-2.5",
  panelTitle:
    "text-sm font-semibold tracking-[-0.015em] text-[#1F2937]",
  panelDesc:
    "mt-1 text-[11px] leading-snug text-[#94A3B8]",
  /** Pure white inset — minimal frame, tight padding */
  chartWell: `mt-2 rounded-[8px] bg-[#FFFFFF] p-2 ${ease} md:p-2.5`,
  sectionLabel:
    "text-sm font-semibold tracking-[-0.015em] text-[#1F2937]",
  sectionDesc: "mt-1 text-[11px] leading-snug text-[#94A3B8]",
} as const;
