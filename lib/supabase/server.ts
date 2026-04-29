import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _clientKey = "";

/** Strip wrapping quotes some editors add to .env values */
function trimEnvValue(raw: string): string {
  let v = raw.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/**
 * Supabase JS always requests `{url}/rest/v1/...`.
 * PGRST125 ("Invalid path specified in request URL") often happens when `url`
 * already ends with `/rest/v1` or another path — keep scheme + host only.
 */
function normalizeSupabaseUrl(raw: string): string {
  const t = trimEnvValue(raw);
  let href = t.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(href)) {
    href = `https://${href}`;
  }
  try {
    const u = new URL(href);
    return `${u.protocol}//${u.host}`;
  } catch {
    return href
      .replace(/\/rest\/v1\/?$/i, "")
      .replace(/\/+$/, "");
  }
}

export function getSupabaseServer(): SupabaseClient | null {
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!urlRaw?.trim() || !keyRaw?.trim()) {
    return null;
  }
  const url = normalizeSupabaseUrl(urlRaw);
  const key = trimEnvValue(keyRaw);

  if (!_client || _clientKey !== `${url}|${key}`) {
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    _clientKey = `${url}|${key}`;
  }
  return _client;
}
