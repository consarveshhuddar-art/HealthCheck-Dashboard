import "server-only";

/** Reuse MySQL snapshot for identical dashboard params if fetched within this window. */
const DASHBOARD_CACHE_TTL_MS = 2 * 60 * 1000;

type Entry<T> = { fetchedAt: number; payload: T };

const store = new Map<string, Entry<unknown>>();

const MAX_KEYS = 32;

function pruneIfNeeded(): void {
  if (store.size <= MAX_KEYS) return;
  const oldest = [...store.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
  const drop = oldest.slice(0, Math.max(0, store.size - MAX_KEYS + 8));
  for (const [k] of drop) store.delete(k);
}

export function clearDashboardMysqlCache(): void {
  store.clear();
}

/**
 * Returns cached payload if the same key was resolved within the last 2 minutes;
 * otherwise runs `factory`, stores the result, and returns it.
 */
export async function getOrSetDashboardMysqlCache<T>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && now - hit.fetchedAt < DASHBOARD_CACHE_TTL_MS) {
    return hit.payload;
  }
  const payload = await factory();
  store.set(key, { fetchedAt: now, payload });
  pruneIfNeeded();
  return payload;
}
