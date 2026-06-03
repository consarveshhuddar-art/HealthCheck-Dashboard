import type { PrE2eNamedCount } from "@/lib/prE2e/types";

const ORDER = ["flaky", "failing", "stable"] as const;

const dotClass: Record<string, string> = {
  flaky: "bg-amber-500",
  failing: "bg-rose-500",
  stable: "bg-emerald-500",
};

export function PrE2eStabilityLegend({
  items,
  total,
}: {
  items: PrE2eNamedCount[];
  total: number;
}) {
  const byName = new Map(items.map((i) => [i.name, i.count]));

  return (
    <ul className="mt-3 space-y-2 border-t border-[#EAEFF5] pt-3 text-[12px]">
      {ORDER.map((name) => {
        const count = byName.get(name) ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <li key={name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 capitalize text-[#64748B]">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass[name]}`} />
              {name}
            </span>
            <span className="tabular-nums text-[#1F2937]">
              {count}{" "}
              <span className="text-[#94A3B8]">({pct}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
