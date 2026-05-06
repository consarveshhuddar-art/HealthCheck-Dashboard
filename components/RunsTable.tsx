import type { RunWithFailures } from "@/lib/types";

function statusStyles(result: string, failureCount: number) {
  if (failureCount === 0 && (result === "SUCCESS" || result === "success"))
    return {
      dot: "bg-emerald-700/45",
      text: "text-emerald-900/75",
      bg: "border border-emerald-200/35 bg-emerald-50/70",
      label: "All green",
    };
  if (failureCount === 0)
    return {
      dot: "bg-emerald-700/45",
      text: "text-emerald-900/75",
      bg: "border border-emerald-200/35 bg-emerald-50/70",
      label: "Pass",
    };
  return {
    dot: "bg-rose-800/40",
    text: "text-rose-900/70",
    bg: "border border-rose-200/35 bg-rose-50/65",
    label: failureCount === 1 ? "1 issue" : `${failureCount} issues`,
  };
}

export function RunsTable({ runs }: { runs: RunWithFailures[] }) {
  if (!runs.length) {
    return (
      <p className="rounded-[10px] border border-dashed border-[#EAEFF5] bg-[#F9FAFB] px-4 py-8 text-center text-sm text-[#94A3B8]">
        No runs found yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden bg-white">
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#EAEFF5] bg-[#F9FAFB] text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
              <th className="px-4 py-2 text-left font-medium">When (UTC)</th>
              <th className="px-4 py-2 text-left font-medium">IST check</th>
              <th className="px-4 py-2 text-left font-medium">Build</th>
              <th className="px-4 py-2 text-left font-medium">Jenkins</th>
              <th className="px-4 py-2 text-left font-medium">Envs</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, index) => {
              const fc = run.health_check_failures?.length ?? 0;
              const s = statusStyles(run.jenkins_result, fc);
              const zebra = index % 2 === 1 ? "bg-[#F9FAFB]/80" : "bg-white";
              return (
                <tr
                  key={run.id}
                  className={`border-b border-[#EAEFF5] transition-colors duration-150 ease-out hover:bg-[#F6F8FB] ${zebra}`}
                >
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] tabular-nums text-[#64748B]">
                    {new Date(run.created_at).toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-2 text-[#1F2937]">{run.checked_at_ist}</td>
                  <td className="px-4 py-2">
                    <a
                      href={run.build_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-violet-800/85 underline decoration-violet-200/60 underline-offset-2 transition-colors duration-150 ease-out hover:text-violet-950"
                    >
                      #{run.build_number}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-[#64748B]">{run.jenkins_result}</td>
                  <td className="max-w-[200px] truncate px-4 py-2 text-[#64748B]" title={run.envs?.join(", ")}>
                    {run.envs?.join(", ") ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-normal leading-tight ${s.bg} ${s.text}`}
                    >
                      <span className={`h-1 w-1 shrink-0 rounded-full ${s.dot}`} aria-hidden />
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
