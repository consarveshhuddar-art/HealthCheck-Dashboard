type Props = {
  hasRuns: boolean;
  hasPerTestFailures: boolean;
  hasStability: boolean;
  className?: string;
};

export function PrE2eIngestNotice({
  hasRuns,
  hasPerTestFailures,
  hasStability,
  className = "",
}: Props) {
  if (!hasRuns || (hasPerTestFailures && hasStability)) return null;

  const parts: string[] = [];
  if (!hasPerTestFailures) {
    parts.push(
      "pr_e2e_failures is empty — ingest logged ok but did not parse Allure into per-test rows (check prE2eIngest.groovy reads GCS report and INSERTs failed/broken cases).",
    );
  }
  if (!hasStability) {
    parts.push(
      "pr_e2e_test_stability is empty — flaky/failing labels are filled by the weekly stability batch (needs several runs with failure detail).",
    );
  }

  return (
    <p
      className={`rounded-[10px] border border-sky-200/60 bg-sky-50/80 px-4 py-3 text-sm leading-relaxed text-sky-950 ${className}`.trim()}
    >
      <span className="font-medium">Limited E2E detail in MySQL.</span>{" "}
      {parts.join(" ")}
    </p>
  );
}
