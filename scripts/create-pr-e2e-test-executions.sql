-- Per-test execution outcomes for PR E2E runs (pass + fail).
-- Ingest (prE2eIngest.groovy) should INSERT one row per test case per run.
-- Dashboard stability uses failure_rate over these rows (see refresh-pr-e2e-stability.mjs).

CREATE TABLE IF NOT EXISTS pr_e2e_test_executions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  run_id CHAR(36) NOT NULL,
  test_name VARCHAR(512) NOT NULL,
  test_name_full VARCHAR(1024) NULL,
  status ENUM('passed', 'failed', 'broken', 'skipped', 'unknown') NOT NULL DEFAULT 'unknown',
  module VARCHAR(255) NULL,
  duration_ms INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pte_run_id (run_id),
  INDEX idx_pte_run_test (run_id, test_name(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
