/**
 * SQL fragments for PR E2E analytics when ingest left trigger_type / module /
 * error_fingerprint empty. Keeps dashboard useful before re-ingest.
 */

/** Effective Jenkins trigger (alias `r` = pr_e2e_runs). */
export const SQL_EFFECTIVE_TRIGGER = `(
  CASE
    WHEN NULLIF(TRIM(LOWER(r.trigger_type)), '') IS NOT NULL
      AND TRIM(LOWER(r.trigger_type)) NOT IN ('unknown', '')
    THEN TRIM(LOWER(r.trigger_type))
    WHEN NULLIF(TRIM(r.upstream_job_name), '') IS NOT NULL THEN 'upstream'
    WHEN NULLIF(TRIM(r.trigger_user), '') IS NOT NULL THEN 'manual'
    WHEN LOWER(COALESCE(r.trigger_detail, '')) LIKE '%timer%'
      OR LOWER(COALESCE(r.trigger_detail, '')) LIKE '%cron%'
      OR LOWER(COALESCE(r.trigger_detail, '')) LIKE '%scheduled%' THEN 'cron'
    WHEN LOWER(COALESCE(r.trigger_detail, '')) LIKE '%upstream%'
      OR LOWER(COALESCE(r.trigger_detail, '')) LIKE '%started by project%' THEN 'upstream'
    WHEN LOWER(COALESCE(r.trigger_detail, '')) LIKE '%started by user%'
      OR LOWER(COALESCE(r.trigger_detail, '')) LIKE '%user %' THEN 'manual'
    WHEN LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.summary, '$.build_trigger_by')), '')) LIKE '%timer%'
      OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.summary, '$.build_trigger_by')), '')) LIKE '%cron%' THEN 'cron'
    WHEN LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.summary, '$.build_trigger_by')), '')) LIKE '%upstream%' THEN 'upstream'
    WHEN LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(r.summary, '$.build_trigger_by')), '')) LIKE '%user%' THEN 'manual'
    ELSE 'unknown'
  END
)`;

/** Effective module for a failure row (aliases `f`, `r`). */
export const SQL_EFFECTIVE_MODULE = `(
  COALESCE(
    NULLIF(NULLIF(TRIM(LOWER(f.module)), 'unknown'), ''),
    NULLIF(NULLIF(TRIM(LOWER(r.module_primary)), 'unknown'), ''),
    NULLIF(TRIM(r.service_repo), ''),
    'unknown'
  )
)`;

/** Fingerprint from column or hash of normalized error text (alias `f`). */
export const SQL_EFFECTIVE_FINGERPRINT = `(
  COALESCE(
    NULLIF(TRIM(f.error_fingerprint), ''),
    CAST(
      CRC32(
        SUBSTRING(
          REGEXP_REPLACE(COALESCE(f.error_message, ''), '[0-9]+', '#'),
          1,
          500
        )
      ) AS CHAR
    )
  )
)`;
