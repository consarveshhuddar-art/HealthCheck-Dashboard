import type { RunWithFailures } from "@/lib/types";

function statusStyles(result: string, failureCount: number) {
  if (failureCount === 0 && (result === "SUCCESS" || result === "success"))
    return {
      dot: "bg-emerald-500",
      text: "text-emerald-900",
      bg: "bg-emerald-50",
      label: "All green",
    };
  if (failureCount === 0)
    return {
      dot: "bg-emerald-500",
      text: "text-emerald-900",
      bg: "bg-emerald-50",
      label: "Pass",
    };
  return {
    dot: "bg-red-500",
    text: "text-red-900",
    bg: "bg-red-50",
    label: failureCount === 1 ? "1 issue" : `${failureCount} issues`,
  };
}

export function RunsTable({ runs }: { runs: RunWithFailures[] }) {
  if (!runs.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center text-sm text-slate-500 backdrop-blur-sm">
        No runs found yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden bg-white/80 backdrop-blur-sm">
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/95 text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">When (UTC)</th>
              <th className="px-4 py-3">IST check</th>
              <th className="px-4 py-3">Build</th>
              <th className="px-4 py-3">Jenkins</th>
              <th className="px-4 py-3">Envs</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((run) => {
              const fc = run.health_check_failures?.length ?? 0;
              const s = statusStyles(run.jenkins_result, fc);
              return (
                <tr
                  key={run.id}
                  className="transition-colors duration-200 hover:bg-sky-50/60"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                    {new Date(run.created_at).toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{run.checked_at_ist}</td>
                  <td className="px-4 py-3">
                    <a
                      href={run.build_url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-sky-700 underline decoration-sky-200 underline-offset-2 transition-colors hover:text-sky-900"
                    >
                      #{run.build_number}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{run.jenkins_result}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-600" title={run.envs?.join(", ")}>
                    {run.envs?.join(", ") ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
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
