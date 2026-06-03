import type { PrE2eRunWithFailures } from "@/lib/prE2e/types";
import {
  effectiveFailedBrokenOnRun,
  jenkinsResultIsSuccess,
  runHasIngestedTestData,
} from "@/lib/prE2e/types";

export type PrE2eFailureDetailState =
  | { kind: "has_rows"; count: number }
  | { kind: "allure_counts_not_ingested"; failedBroken: number }
  | { kind: "gcs_report_not_parsed"; gcsPath: string }
  | { kind: "jenkins_only" }
  | { kind: "none" };

/** Why pr_e2e_failures may be empty for a run that Jenkins marked failed. */
export function prE2eFailureDetailState(
  run: PrE2eRunWithFailures,
): PrE2eFailureDetailState {
  if (run.failures.length > 0) {
    return { kind: "has_rows", count: run.failures.length };
  }

  const failedBroken = effectiveFailedBrokenOnRun(run);
  if (failedBroken > 0) {
    return { kind: "allure_counts_not_ingested", failedBroken };
  }

  if (
    !jenkinsResultIsSuccess(run.e2e_jenkins_result) &&
    run.gcs_report_path &&
    !runHasIngestedTestData(run)
  ) {
    return { kind: "gcs_report_not_parsed", gcsPath: run.gcs_report_path };
  }

  if (!jenkinsResultIsSuccess(run.e2e_jenkins_result)) {
    return { kind: "jenkins_only" };
  }

  return { kind: "none" };
}

export function prE2eFailureDetailMessage(state: PrE2eFailureDetailState): string {
  switch (state.kind) {
    case "has_rows":
      return "";
    case "allure_counts_not_ingested":
      return `Allure totals on this run show ${state.failedBroken} failed/broken test(s), but no rows exist in pr_e2e_failures. Update prE2eIngest.groovy to INSERT per-test cases, then re-run the E2E job (or backfill this run).`;
    case "gcs_report_not_parsed":
      return `Ingest logged status ok and stored this run, but Allure was not parsed (pass rate 0/0, pr_e2e_failures empty). The report is at ${state.gcsPath} — prE2eIngest.groovy should read Allure summary/results from GCS and populate pr_e2e_runs counts plus pr_e2e_failures. Re-run E2E after fixing ingest.`;
    case "jenkins_only":
      return `Jenkins result is not SUCCESS, but Allure totals and pr_e2e_failures are empty. Ingest only recorded the Jenkins outcome — check prE2eIngest.groovy and that the Allure report path is available when ingest runs.`;
    case "none":
      return "No failed or broken tests recorded for this run.";
  }
}
