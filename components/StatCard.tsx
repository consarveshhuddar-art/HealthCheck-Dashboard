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
  const accents = {
    emerald:
      "from-emerald-50/95 to-white border-emerald-200/80 ring-emerald-950/[0.06]",
    rose:
      "from-rose-50/95 to-white border-rose-200/80 ring-rose-950/[0.06]",
    sky:
      "from-sky-50/95 to-white border-sky-200/80 ring-sky-950/[0.06]",
    slate:
      "from-slate-50/95 to-white border-slate-200 ring-slate-950/[0.06]",
  };
  const valueColors = {
    emerald: "text-emerald-700",
    rose: "text-rose-700",
    sky: "text-sky-800",
    slate: "text-slate-800",
  };

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg ${accents[accent]}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${valueColors[accent]}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-2 border-t border-slate-200/70 pt-2 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
