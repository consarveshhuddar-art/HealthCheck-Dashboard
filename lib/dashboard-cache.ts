import "server-only";

/** Health dashboard MySQL snapshot TTL. */
const HEALTH_DASHBOARD_CACHE_TTL_MS = 2 * 60 * 1000;

/** PR E2E section pages + range API TTL. */
export const PR_E2E_CACHE_TTL_MS = 5 * 60 * 1000;

type Entry<T> = { fetchedAt: number; payload: T };

const store = new Map<string, Entry<unknown>>();

const MAX_KEYS = 64;

function pruneIfNeeded(): void {
  if (store.size <= MAX_KEYS) return;
  const oldest = [...store.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
  const drop = oldest.slice(0, Math.max(0, store.size - MAX_KEYS + 12));
  for (const [k] of drop) store.delete(k);
}

export function clearDashboardMysqlCache(): void {
  store.clear();
}

/**
 * Returns cached payload if the same key was resolved within `ttlMs` (default 2 minutes);
 * otherwise runs `factory`, stores the result, and returns it.
 */
export async function getOrSetDashboardMysqlCache<T>(
  key: string,
  factory: () => Promise<T>,
  options?: { ttlMs?: number },
): Promise<T> {
  const ttlMs = options?.ttlMs ?? HEALTH_DASHBOARD_CACHE_TTL_MS;
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && now - hit.fetchedAt < ttlMs) {
    return hit.payload;
  }
  const payload = await factory();
  store.set(key, { fetchedAt: now, payload });
  pruneIfNeeded();
  return payload;
}

/** PR checks (Overview, Failures, Flakiness, Services, Runs, Ingest) + `/api/pr-e2e/query`. */
export async function getOrSetPrE2eMysqlCache<T>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  return getOrSetDashboardMysqlCache(key, factory, {
    ttlMs: PR_E2E_CACHE_TTL_MS,
  });
}
