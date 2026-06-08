import type { PrE2eNamedCount } from "@/lib/prE2e/types";

/** Long-lived SDET envs shown as their own rows in pass-rate-by-env. */
export const PR_E2E_FIXED_ENVS = ["k8s-sdet-02", "k8s-sdet-05"] as const;

export const PR_E2E_EPHEMERAL_ENV_LABEL = "ephemeral";

/** Env groups shown in per-service failure breakdowns. */
export const PR_E2E_ENV_GROUPS = [
  ...PR_E2E_FIXED_ENVS,
  PR_E2E_EPHEMERAL_ENV_LABEL,
] as const;

export type PrE2eEnvGroup = (typeof PR_E2E_ENV_GROUPS)[number];

/** SQL CASE for grouping runs into the three env buckets (else NULL). */
export const SQL_PR_E2E_ENV_GROUP = `CASE
  WHEN TRIM(COALESCE(r.env_suffix, '')) = 'k8s-sdet-02' THEN 'k8s-sdet-02'
  WHEN TRIM(COALESCE(r.env_suffix, '')) = 'k8s-sdet-05' THEN 'k8s-sdet-05'
  WHEN TRIM(COALESCE(r.env_suffix, '')) <> '' THEN 'ephemeral'
  ELSE NULL
END`;

/** Map run env_suffix to k8s-sdet-02, k8s-sdet-05, or ephemeral rollup. */
export function classifyPrE2eEnvGroup(envSuffix: string | null | undefined): string {
  const env = (envSuffix ?? "").trim();
  if ((PR_E2E_FIXED_ENVS as readonly string[]).includes(env)) return env;
  if (!env) return "unknown";
  return PR_E2E_EPHEMERAL_ENV_LABEL;
}

function weightedPassRate(rows: PrE2eNamedCount[]): number | undefined {
  let sum = 0;
  let weight = 0;
  for (const row of rows) {
    if (row.extra == null || row.count <= 0) continue;
    sum += row.extra * row.count;
    weight += row.count;
  }
  if (weight <= 0) return undefined;
  return Math.round((sum / weight) * 10) / 10;
}

/**
 * Collapse per-PR ephemeral env_suffix values into three rows:
 * k8s-sdet-02, k8s-sdet-05, and ephemeral (everything else in the selected range).
 */
export function groupPassRateByEnvRows(rows: PrE2eNamedCount[]): PrE2eNamedCount[] {
  const fixedSet = new Set<string>(PR_E2E_FIXED_ENVS);
  const byName = new Map(rows.map((r) => [r.name, r]));

  const result: PrE2eNamedCount[] = PR_E2E_FIXED_ENVS.map((env) => {
    const row = byName.get(env);
    return row ?? { name: env, count: 0, extra: undefined };
  });

  const ephemeralRows = rows.filter((r) => !fixedSet.has(r.name));
  const ephemeralCount = ephemeralRows.reduce((a, r) => a + r.count, 0);

  result.push({
    name: PR_E2E_EPHEMERAL_ENV_LABEL,
    count: ephemeralCount,
    extra: weightedPassRate(ephemeralRows),
  });

  return result;
}
