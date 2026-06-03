# PR E2E test executions (ingest contract)

The dashboard classifies flaky tests from **`pr_e2e_test_executions`**, not only `pr_e2e_failures`.

## Table

Apply once:

```bash
mysql ... < scripts/create-pr-e2e-test-executions.sql
```

## Ingest (`prE2eIngest.groovy`)

After parsing Allure for each E2E run, insert **one row per test case**:

| Column | Value |
|--------|--------|
| `id` | UUID |
| `run_id` | pr_e2e_runs.id |
| `test_name` | normalized scenario name |
| `test_name_full` | full Allure name (optional) |
| `status` | `passed`, `failed`, `broken`, or `skipped` |
| `module` | optional |
| `duration_ms` | optional |

Keep inserting **`pr_e2e_failures`** for failed/broken cases (error message, fingerprint).

Replace rows on re-ingest: `DELETE FROM pr_e2e_test_executions WHERE run_id = ?` then bulk insert.

## Stability labels (30d)

Run after ingest or on a schedule:

```bash
npm run refresh-pr-e2e-stability
```

| Label | Rule |
|-------|------|
| **stable** | failure rate &lt; 5%, or fewer than 5 executions |
| **flaky** | 5% ≤ failure rate &lt; 80% (and ≥ 5 executions) |
| **failing** | failure rate ≥ 80% |

Failure rate = `(failed + broken) / (passed + failed + broken)` per `(service_repo, test_name)`.

## Backfill existing runs

```bash
npm run backfill-pr-e2e-executions
```

Parses GCS Allure + scenario txt for runs in the last 30 days, then refreshes stability.
