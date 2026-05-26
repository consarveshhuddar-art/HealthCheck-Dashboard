/** Parse tags JSON from pr_e2e_failures.tags (Allure labels or cucumber tag strings). */
export function parsePrE2eFailureTags(raw: unknown): string[] {
  if (raw == null || raw === "") return [];

  let value: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        value = JSON.parse(trimmed);
      } catch {
        return [trimmed];
      }
    } else {
      return [trimmed];
    }
  }

  if (!Array.isArray(value)) return [];

  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const s = item.trim();
      if (s) out.push(s);
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as { name?: string; value?: string };
      const name = o.name?.trim();
      const val = o.value?.trim();
      if (name && val) out.push(`${name}:${val}`);
      else if (val) out.push(val);
      else if (name) out.push(name);
    }
  }

  return [...new Set(out)];
}

/** Space-separated tag query (all tokens required — AND). */
export function parseTagSearchQuery(raw: string): string[] {
  return [...new Set(raw.trim().split(/\s+/).filter(Boolean))];
}

function normalizeTagToken(tag: string): string {
  return tag.trim().toLowerCase();
}

/** True when failure tags contain every required token (substring match, case-insensitive). */
export function failureHasAllTags(
  failureTags: string[],
  required: string[],
): boolean {
  if (!required.length) return false;
  const hay = failureTags.map(normalizeTagToken);
  return required.every((req) => {
    const needle = normalizeTagToken(req);
    return hay.some(
      (t) => t === needle || t.includes(needle) || t.endsWith(`:${needle}`),
    );
  });
}

export function escapeMysqlLike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}
