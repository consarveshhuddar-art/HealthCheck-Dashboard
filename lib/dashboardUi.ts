/**
 * Shared dashboard chrome — glass panels over animated gradient; light only.
 */
export const dashboardUi = {
  pageShell: "min-h-full",
  content:
    "mx-auto w-full max-w-[1920px] px-5 sm:px-8 lg:px-12 xl:px-14",
  headerBand:
    "rounded-xl border border-white/55 bg-white/65 px-4 py-4 shadow-sm backdrop-blur-md ring-1 ring-slate-950/[0.06] transition-all duration-300 ease-out hover:bg-white/80 hover:shadow-md md:px-5",
  statGrid: "grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4",
  panel:
    "rounded-xl border border-white/55 bg-white/65 p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-950/[0.05] backdrop-blur-md transition-all duration-300 ease-out hover:bg-white/80 hover:shadow-md",
  panelTitle:
    "text-sm font-semibold tracking-tight text-slate-800",
  panelDesc:
    "mt-1 text-xs leading-relaxed text-slate-500",
  chartWell:
    "mt-4 rounded-lg border border-white/45 bg-white/45 p-3 shadow-inner ring-1 ring-slate-950/[0.04] backdrop-blur-sm transition-colors duration-300",
  sectionLabel:
    "text-sm font-semibold tracking-tight text-slate-800",
  sectionDesc: "mt-1 text-xs text-slate-500",
} as const;
