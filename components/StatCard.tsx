export function StatCard({
  title,
  value,
  hint,
  accent,
}: {
  title: string;
  value: string | number;
  hint?: string;
  accent: "emerald" | "rose" | "sky" | "slate";
}) {
  const topAccent = {
    emerald: "bg-emerald-700/30",
    rose: "bg-rose-700/28",
    sky: "bg-sky-700/30",
    slate: "bg-slate-500/35",
  };
  const wash = {
    emerald: "from-emerald-600/[0.025] to-transparent",
    rose: "from-rose-600/[0.022] to-transparent",
    sky: "from-sky-600/[0.025] to-transparent",
    slate: "from-slate-500/[0.02] to-transparent",
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[10px] border border-[#EAEFF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFE_100%)] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_2px_10px_rgba(0,0,0,0.05)] sm:p-4`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] ${topAccent[accent]}`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${wash[accent]}`}
        aria-hidden
      />
      <div className="relative">
        <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#6B7280]">
          {title}
        </p>
        <p className="mt-1 text-[2.375rem] font-semibold leading-[1.05] tracking-[-0.035em] text-[#0B1220] tabular-nums sm:text-[2.5rem]">
          {value}
        </p>
        <div
          className="mt-2 border-b border-[#64748B]/[0.14] pb-2"
          aria-hidden
        />
        {hint ? (
          <p className="mt-2 text-[11px] leading-snug text-[#94A3B8]">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
