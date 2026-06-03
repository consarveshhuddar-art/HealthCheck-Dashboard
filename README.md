# Health Dashboard

Next.js app that reads from shared MySQL (`automation_testdata`) and surfaces three areas:

1. **Health checks** — infra/deployment health across ~25 services
2. **PR E2E checks** — Cucumber/Allure runs from PR pipelines
3. **Credential expiry** — ops tracking for credential renewals

Data is written by Jenkins jobs at build time. The dashboard is read-only except credential CRUD via server actions.

## Quick start

```bash
cd Dashboard
cp .env.example .env.local   # fill HEALTH_CHECK_MYSQL_*
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **VPN is required** for the internal MySQL host.

## Configuration

Copy `.env.example` to `.env.local` (server-only — never use `NEXT_PUBLIC_*` for passwords):

```env
HEALTH_CHECK_MYSQL_HOST=fc-events-chokidar-mysql-events-chokidar.fancode-stag.local
HEALTH_CHECK_MYSQL_PORT=3306
HEALTH_CHECK_MYSQL_USER=fc-events-chokidar
HEALTH_CHECK_MYSQL_PASSWORD=
HEALTH_CHECK_MYSQL_DATABASE=automation_testdata
```

Jenkins ingest uses the same database via credential `HC_MYSQL_PASS_RAW` in `FC-Brahmastra/prE2eIngest.groovy`.

---

## Architecture
<img width="1224" height="1600" alt="image" src="https://github.com/user-attachments/assets/7ee0a6ad-44ae-4882-bbe9-784dc16141f3" />

```
Service PR pipelines (fc-core, fc-video-vertx, fc-gql, …)
        │
        ▼ build *_E2E_Automation_PR_TEST
PR.Jenkinsfile / PR_Docker.Jenkinsfile  (FC-Brahmastra)
        │
        ├──► GCS (Allure + scenario txt)
        │         fc-sdet-automation-reports
        │         fc-sdet-release_pipeline_report
        │
        └──► prE2eIngest.groovy ──► MySQL pr_e2e_*

ServiceHealthCheck.Jenkinsfile ──► MySQL health_check_*

Dashboard (Next.js) ◄── reads MySQL ──► UI
```

| Layer | Technology |
|-------|------------|
| UI | Next.js 16, React 19, Tailwind, Recharts |
| Data | `mysql2` server-side pool |
| Cache | In-memory: 2 min (health), 5 min (PR E2E) |
| Ingest | Groovy + Python/pymysql from Jenkins `always` post |

---

## End-to-end PR E2E flow

### Trigger chain

1. Developer opens PR → service repo PR Jenkins runs (e.g. `fc-core/PR.Jenkinsfile`).
2. PR pipeline deploys and triggers downstream E2E job, e.g. `CORE_E2E_Automation_PR_TEST/{branch}`.
3. Parameters passed: `ENV_SUFFIX`, `TAGS`, `GIT_PR_LINK`, `GIT_USERNAME`, `GIT_EMAIL`, `SlackChannel`, etc.
4. E2E runs via **PR.Jenkinsfile** (Maven on agent) or **PR_Docker.Jenkinsfile** (K8s pod + GCS copy-back).
5. Post-build: Allure + scenario txt uploaded to GCS; **prE2eIngest.groovy** writes MySQL.
6. Dashboard reads MySQL and renders analytics.

### Which Jenkins jobs ingest?

Ingest runs only when the job base name:

- ends with `_E2E_Automation_PR_TEST`, or
- equals `E2E_Automation_PR_Check`

Examples: `VIDEO_VERTX_E2E_Automation_PR_TEST`, `CORE_E2E_Automation_PR_TEST`, `GQL_E2E_Automation_PR_TEST`.

### PR.Jenkinsfile vs PR_Docker.Jenkinsfile

| | PR.Jenkinsfile | PR_Docker.Jenkinsfile |
|---|----------------|----------------------|
| Agent | `fc-code-integration_brahmastra` | `fc-code-integration` |
| Execution | `mvn clean install` on Jenkins | K8s pod via `helm/values.yaml` |
| Results | In workspace | Copied from GCS after pod |
| Pass/fail | Fails if failed scenarios > 0 or passed == 0 | Also fails on skipped |
| GCS upload | Yes | Yes |
| Ingest hook | `prE2eIngest.ingestE2eRunIfApplicable(this)` | Same |

Both call ingest in the `always` post block in `FC-Brahmastra/`.

### What ingest writes (`prE2eIngest.groovy`)

**Per run → `pr_e2e_runs`:** job name, service repo, build #/URL, PR link, env, tags, trigger type, Allure stats, pass rate, GCS path, summary JSON.

**Per failed/broken test → `pr_e2e_failures`:** test name, error, fingerprint, module, tags, classification.

**Audit → `pr_e2e_ingest_log`:** status `ok` / `error` / `skipped_duplicate`.

**Failure extraction order:** Allure `*-result.json` (latest per `historyId`) → categories tree → `failedTestScenarios.txt`.

**Service repo resolution:** GitHub PR URL → job name heuristics (VIDEO_VERTX → fc-video-vertx, etc.) → `@service_*` tag → `unknown`.

---

## What the dashboard shows

### Top navigation

| Tab | Route | Data tables |
|-----|-------|-------------|
| Health checks | `/` | `health_check_runs`, `health_check_failures` |
| PR E2E checks | `/pr-checks/*` | `pr_e2e_*` |
| Credential expiry | `/credentials` | `credential_expiry_records` |

### Health checks (`/`)

- Stat cards: runs loaded, fully green, runs with issues, green rate
- Daily / weekly failure trends, daily outcome pies
- Top failing services, services-by-day/env heatmap
- Recent runs table
- Window control: day (150) / week (500) / month (1500 runs)
- Ingest source: `ServiceHealthCheck.Jenkinsfile` (FC-Brahmastra)

### PR E2E checks (`/pr-checks/*`)

**Filter:** PR pipeline only (`is_release_pipeline = 0`). Release runs are ingested but hidden.

| Sub-page | Route | Content |
|----------|-------|---------|
| Overview | `/pr-checks` | Runs today/24h/7d, health summary, trends, breakdowns, flaky preview |
| Failures | `/pr-checks/analytics` | Top failing tests, heatmap, pass rate by env |
| Flakiness | `/pr-checks/flaky` | 30d stability: stable / flaky / failing |
| Services | `/pr-checks/services` | Per-service cards + 7d sparklines |
| Runs | `/pr-checks/runs` | Filterable run explorer |
| Ingest | `/pr-checks/ingest` | Ingest log health, volume, errors |
| Run detail | `/pr-checks/runs/[id]` | Full run metadata + failures |
| PR history | `/pr-checks/pr/[number]` | All runs for a PR |
| Test drill-down | `/pr-checks/tests` | Failure history by test name or tag |

Dynamic charts: `GET /api/pr-e2e/query?metric=...&days=...`

Runs pagination: `/api/pr-e2e/runs`

### Credential expiry (`/credentials`)

Active / resolved / stopped credentials, expiry alerts in top-nav bell. Managed via dashboard UI (not Jenkins ingest).

---

## Database tables

| Table | Written by | Read by |
|-------|------------|---------|
| `health_check_runs` | ServiceHealthCheck Jenkins | Health tab |
| `health_check_failures` | ServiceHealthCheck Jenkins | Health tab |
| `pr_e2e_runs` | prE2eIngest.groovy | PR E2E tab |
| `pr_e2e_failures` | prE2eIngest.groovy | PR E2E tab |
| `pr_e2e_test_stability` | Jenkins + refresh script | Flakiness |
| `pr_e2e_ingest_log` | prE2eIngest.groovy | Ingest page |
| `pr_e2e_test_executions` | Backfill / future ingest | Flakiness (execution-based) |
| `credential_expiry_records` | Dashboard UI | Credentials tab |

**Not shown in dashboard:** `events`, `event_names`, `pat_token` (Chokidar/event system).

### Storage estimates

Baseline (~142 runs): **~8.1 MB** total for dashboard tables (excluding events/pat_token).

At **40 runs/day** (1,200/month), linear projection ≈ **68.5 MB/month**.

**Retention:** Every **Friday (IST)**, Jenkins deletes `pr_e2e_runs`, `pr_e2e_ingest_log`, and old stability rows **older than 90 days**. PR E2E storage caps around ~90 days of data. Health check tables have no 90-day cleanup in this repo.

---

## Stability: two algorithms

| Source | Method | Labels |
|--------|--------|--------|
| **Jenkins ingest** (`computeStability30d`) | Run-level: test failed in ≥2 runs with ≥1 pass | flaky / failing / stable |
| **Dashboard script** (`refresh-pr-e2e-stability`) | Execution-based from `pr_e2e_test_executions` | stable <5%, flaky 5–80%, failing ≥80% (min 5 executions) |

The Flakiness page describes the **execution-based** model. Run backfill + refresh script until ingest writes `pr_e2e_test_executions` on every run.

---

## Jenkins maintenance (not npm)

| When | Action |
|------|--------|
| Every qualifying E2E build | Ingest run + failures + ingest log; recompute stability if failures > 0 |
| Fridays (IST) | Delete pr_e2e rows > 90 days; recompute stability |
| ServiceHealthCheck schedule | Writes `health_check_*` |

---

## Operations runbook

Run all commands from `Dashboard/` unless noted.

### Prerequisites

- `.env.local` with `HEALTH_CHECK_MYSQL_*`
- VPN for internal MySQL host
- For GCS backfills: `gsutil` authenticated

### App commands

```bash
npm run dev          # local UI → http://localhost:3000
npm run build        # production build
npm run start        # serve production build
npm run lint         # ESLint
```

### Verify data (read-only)

```bash
npm run verify-db              # health_check_* counts
npm run verify-pr-e2e-db       # pr_e2e_* health + warnings
```

With app running:

```bash
curl -s http://localhost:3000/api/health-db-stats | jq
```

`verify-pr-e2e-db` warns when failures are empty, executions/stability missing, or runs have GCS path but 0 tests.

### One-time SQL setup

```bash
# Credentials tab
mysql -h HOST -u USER -p automation_testdata < scripts/create-credential-expiry-records.sql
mysql -h HOST -u USER -p automation_testdata < scripts/alter-credential-expiry-add-platform.sql
mysql -h HOST -u USER -p automation_testdata < scripts/alter-credential-expiry-add-actor.sql
mysql -h HOST -u USER -p automation_testdata < scripts/alter-credential-expiry-add-stopped-status.sql

# Flakiness (execution-based)
mysql -h HOST -u USER -p automation_testdata < scripts/create-pr-e2e-test-executions.sql
```

### Backfill and refresh

| Command | What it fixes | Scope |
|---------|---------------|-------|
| `npm run backfill-pr-e2e-from-gcs` | Run counts, failures, executions from GCS | All runs with `gcs_report_path` |
| `npm run backfill-pr-e2e-executions` | Executions table only | Last 30 days |
| `npm run refresh-pr-e2e-stability` | Recompute stability labels | Requires executions populated |
| `npm run backfill-pr-e2e-metadata` | trigger_type, module, error_fingerprint | All non-release PR runs |

**Flakiness setup:**

```bash
mysql ... < scripts/create-pr-e2e-test-executions.sql
npm run backfill-pr-e2e-executions
npm run refresh-pr-e2e-stability
npm run verify-pr-e2e-db
```

**Repair bad/missing Allure ingest (0/0 tests, missing failures):**

```bash
npm run backfill-pr-e2e-from-gcs
npm run backfill-pr-e2e-metadata    # optional
npm run verify-pr-e2e-db
```

**Key difference:**

- `backfill-pr-e2e-from-gcs` — full repair (runs + failures + executions + stability refresh)
- `backfill-pr-e2e-executions` — executions only (lighter, 30-day window)

### Backfill decision tree

```
Ingest looks wrong?
├─ Runs exist but 0 tests / no failures, GCS path set?
│  └─ npm run backfill-pr-e2e-from-gcs
├─ Runs OK, flakiness page empty?
│  ├─ Table missing? → apply create-pr-e2e-test-executions.sql
│  └─ npm run backfill-pr-e2e-executions → refresh-pr-e2e-stability
├─ Trigger/module/fingerprint gaps in analytics?
│  └─ npm run backfill-pr-e2e-metadata
└─ Just sanity-check?
   └─ npm run verify-pr-e2e-db
```

### What has no backfill in this repo

| Data | How it gets populated |
|------|------------------------|
| `health_check_*` | ServiceHealthCheck Jenkins job only |
| `credential_expiry_records` | Dashboard UI |
| Live PR E2E runs | Jenkins ingest on every E2E build |

### Internal scripts (not run directly)

| File | Purpose |
|------|---------|
| `scripts/INGEST-TEST-EXECUTIONS.md` | Ingest contract for `pr_e2e_test_executions` |
| `scripts/pr-e2e-allure.mjs` | Shared Allure/scenario parsing |
| `scripts/pr-e2e-stability-sql.mjs` | Execution-based stability SQL |

---

## Related repos

| Path | Role |
|------|------|
| `FC-Brahmastra/PR.Jenkinsfile` | Maven E2E + ingest hook |
| `FC-Brahmastra/PR_Docker.Jenkinsfile` | Docker/K8s E2E + ingest hook |
| `FC-Brahmastra/prE2eIngest.groovy` | MySQL ingest for PR E2E |
| `FC-Brahmastra/ServiceHealthCheck.Jenkinsfile` | Health check ingest |
