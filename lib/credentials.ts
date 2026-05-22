import "server-only";
import { addDays, parseISO } from "date-fns";
import type { RowDataPacket } from "mysql2";
import { defaultIstDayString } from "@/lib/data";
import {
  getHealthCheckMysqlPool,
  isHealthCheckMysqlConfigured,
  withHealthCheckMysqlRetry,
} from "@/lib/mysql/server";
import { DEFAULT_CREDENTIAL_ACTOR, parseActorName } from "@/lib/credentialActor";
import { CREDENTIAL_PLATFORM_JENKINS } from "@/lib/credentialPlatform";
import type {
  CredentialAlertCounts,
  CredentialExpiryGroup,
  CredentialExpiryRecord,
  CredentialExpiryStatus,
  CredentialSortMode,
} from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function credentialGroupKey(
  credential_name: string,
  platform: string,
): string {
  return `${credential_name.trim().toLowerCase()}|${platform.trim().toLowerCase()}`;
}

function parseDateOnly(raw: string): string | null {
  const v = raw.trim();
  if (!DATE_RE.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return v;
}

function toDateString(raw: unknown): string {
  if (raw instanceof Date) {
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, "0");
    const d = String(raw.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === "string" && DATE_RE.test(raw.slice(0, 10))) {
    return raw.slice(0, 10);
  }
  return String(raw).slice(0, 10);
}

function toIso(raw: unknown): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "string") return raw;
  return new Date(String(raw)).toISOString();
}

function mapRow(row: Record<string, unknown>): CredentialExpiryRecord {
  const platformRaw = row.platform;
  const platform =
    platformRaw === null || platformRaw === undefined || platformRaw === ""
      ? CREDENTIAL_PLATFORM_JENKINS
      : String(platformRaw);
  return {
    id: String(row.id ?? ""),
    credential_name: String(row.credential_name ?? ""),
    platform,
    ticket_name: String(row.ticket_name ?? ""),
    ticket_link:
      row.ticket_link === null || row.ticket_link === undefined
        ? null
        : String(row.ticket_link),
    created_date: toDateString(row.created_date),
    created_by: String(row.created_by ?? DEFAULT_CREDENTIAL_ACTOR),
    renewed_by:
      row.renewed_by === null || row.renewed_by === undefined
        ? null
        : String(row.renewed_by),
    expiry_date: toDateString(row.expiry_date),
    status: String(row.status ?? "active") as CredentialExpiryStatus,
    resolved_at: toIso(row.resolved_at),
    supersedes_id:
      row.supersedes_id === null || row.supersedes_id === undefined
        ? null
        : String(row.supersedes_id),
    created_at: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function normalizeTicketLink(raw: string | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function parseCredentialSortMode(
  raw: string | undefined,
): CredentialSortMode {
  if (
    raw === "created_asc" ||
    raw === "expiry_desc" ||
    raw === "expiry_asc"
  ) {
    return raw;
  }
  return "created_desc";
}

function expiringSoonEndDate(todayIst: string): string {
  return toDateString(addDays(parseISO(todayIst), 6));
}

export async function isCredentialExpiryTableAvailable(): Promise<boolean> {
  if (!isHealthCheckMysqlConfigured() || !getHealthCheckMysqlPool()) {
    return false;
  }
  try {
    const rows = await withHealthCheckMysqlRetry(async (pool) => {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT 1 AS ok
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
           AND table_name = 'credential_expiry_records'
           AND column_name = 'created_by'
         LIMIT 1`,
      );
      return r;
    });
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function fetchAllCredentialRecords(): Promise<
  CredentialExpiryRecord[]
> {
  if (!getHealthCheckMysqlPool()) return [];
  try {
    const rows = await withHealthCheckMysqlRetry(async (pool) => {
      const [r] = await pool.query<RowDataPacket[]>(
        `SELECT id, credential_name, platform, ticket_name, ticket_link,
                created_date, created_by, renewed_by, expiry_date, status,
                resolved_at, supersedes_id, created_at
         FROM credential_expiry_records
         ORDER BY platform ASC, credential_name ASC, status ASC, created_at DESC`,
      );
      return r;
    });
    return rows.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export function buildCredentialGroups(
  records: CredentialExpiryRecord[],
): CredentialExpiryGroup[] {
  const byKey = new Map<string, CredentialExpiryGroup>();

  for (const rec of records) {
    const key = credentialGroupKey(rec.credential_name, rec.platform);
    let group = byKey.get(key);
    if (!group) {
      group = {
        credential_name: rec.credential_name,
        platform: rec.platform,
        active: null,
        resolved: [],
      };
      byKey.set(key, group);
    }
    if (rec.status === "active") {
      if (!group.active) group.active = rec;
    } else if (rec.status === "resolved") {
      group.resolved.push(rec);
    }
  }

  for (const group of byKey.values()) {
    group.resolved.sort((a, b) => {
      const ta = a.resolved_at ? Date.parse(a.resolved_at) : 0;
      const tb = b.resolved_at ? Date.parse(b.resolved_at) : 0;
      return tb - ta;
    });
  }

  return [...byKey.values()];
}

/** Latest stopped row per name + platform, only when nothing active for that pair. */
export function buildStoppedCredentialList(
  records: CredentialExpiryRecord[],
): CredentialExpiryRecord[] {
  const activeKeys = new Set<string>();
  for (const rec of records) {
    if (rec.status === "active") {
      activeKeys.add(credentialGroupKey(rec.credential_name, rec.platform));
    }
  }

  const byKey = new Map<string, CredentialExpiryRecord>();

  for (const rec of records) {
    if (rec.status !== "stopped") continue;
    const key = credentialGroupKey(rec.credential_name, rec.platform);
    if (activeKeys.has(key)) continue;

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, rec);
      continue;
    }
    const ta = rec.resolved_at ? Date.parse(rec.resolved_at) : 0;
    const tb = existing.resolved_at ? Date.parse(existing.resolved_at) : 0;
    if (ta >= tb) byKey.set(key, rec);
  }

  return [...byKey.values()].sort((a, b) => {
    const ta = a.resolved_at ? Date.parse(a.resolved_at) : 0;
    const tb = b.resolved_at ? Date.parse(b.resolved_at) : 0;
    return (
      tb - ta ||
      a.platform.localeCompare(b.platform) ||
      a.credential_name.localeCompare(b.credential_name)
    );
  });
}

export function sortCredentialGroups(
  groups: CredentialExpiryGroup[],
  sort: CredentialSortMode,
): CredentialExpiryGroup[] {
  const copy = [...groups];
  const cmpDate = (a: string, b: string) => a.localeCompare(b);

  copy.sort((ga, gb) => {
    const a = ga.active;
    const b = gb.active;
    const tieName = () =>
      ga.platform.localeCompare(gb.platform) ||
      ga.credential_name.localeCompare(gb.credential_name);
    if (!a && !b) return tieName();
    if (!a) return 1;
    if (!b) return -1;

    if (sort === "created_asc") {
      return cmpDate(a.created_date, b.created_date) || tieName();
    }
    if (sort === "created_desc") {
      return cmpDate(b.created_date, a.created_date) || tieName();
    }
    if (sort === "expiry_asc") {
      return cmpDate(a.expiry_date, b.expiry_date) || tieName();
    }
    return cmpDate(b.expiry_date, a.expiry_date) || tieName();
  });

  return copy;
}

export async function getCredentialAlertCounts(
  todayIst = defaultIstDayString(),
): Promise<CredentialAlertCounts> {
  const records = await fetchAllCredentialRecords();
  const soonEnd = expiringSoonEndDate(todayIst);
  let expiringSoon = 0;
  let expired = 0;
  let totalActive = 0;

  for (const rec of records) {
    if (rec.status !== "active") continue;
    totalActive += 1;
    if (rec.expiry_date < todayIst) expired += 1;
    else if (rec.expiry_date <= soonEnd) expiringSoon += 1;
  }

  return { expiringSoon, expired, totalActive };
}

export type CredentialMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createCredentialRecord(input: {
  credential_name: string;
  platform: string;
  ticket_name: string;
  ticket_link: string;
  expiry_date: string;
  created_by: string;
}): Promise<CredentialMutationResult> {
  if (!getHealthCheckMysqlPool()) {
    return { ok: false, error: "Database is not configured." };
  }

  const credential_name = input.credential_name.trim();
  const platform = input.platform.trim();
  const ticket_name = input.ticket_name.trim();
  const ticket_link = normalizeTicketLink(input.ticket_link);
  const expiry_date = parseDateOnly(input.expiry_date);
  const created_date = defaultIstDayString();
  const createdByResult = parseActorName(input.created_by);
  if (!createdByResult.ok) {
    return { ok: false, error: createdByResult.error };
  }
  const created_by = createdByResult.name;

  if (!credential_name) {
    return { ok: false, error: "Credential name is required." };
  }
  if (!platform) {
    return { ok: false, error: "Platform is required." };
  }
  if (!ticket_name) {
    return { ok: false, error: "Ticket name is required." };
  }
  if (!expiry_date) {
    return { ok: false, error: "Valid expiry date (YYYY-MM-DD) is required." };
  }
  if (expiry_date < created_date) {
    return {
      ok: false,
      error: "Expiry date cannot be before today (IST).",
    };
  }
  if (!input.ticket_link.trim()) {
    return { ok: false, error: "Ticket link is required." };
  }
  if (!ticket_link) {
    return { ok: false, error: "Ticket link must be a valid http(s) URL." };
  }

  const id = crypto.randomUUID();

  try {
    await withHealthCheckMysqlRetry(async (pool) => {
      await pool.query(
        `INSERT INTO credential_expiry_records
           (id, credential_name, platform, ticket_name, ticket_link, created_date,
            created_by, renewed_by, expiry_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'active')`,
        [
          id,
          credential_name,
          platform,
          ticket_name,
          ticket_link,
          created_date,
          created_by,
          expiry_date,
        ],
      );
    });
    return { ok: true };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "ER_DUP_ENTRY") {
      return {
        ok: false,
        error:
          "An active credential with this name and platform already exists. Use Renew or resume from stopped list.",
      };
    }
    return {
      ok: false,
      error: err.message ?? "Failed to create credential record.",
    };
  }
}

export async function resolveCredentialRecord(input: {
  credential_name: string;
  platform: string;
  ticket_name: string;
  ticket_link: string;
  expiry_date: string;
  renewed_by: string;
}): Promise<CredentialMutationResult> {
  if (!getHealthCheckMysqlPool()) {
    return { ok: false, error: "Database is not configured." };
  }

  const credential_name = input.credential_name.trim();
  const platform = input.platform.trim();
  const ticket_name = input.ticket_name.trim();
  const ticket_link = normalizeTicketLink(input.ticket_link);
  const expiry_date = parseDateOnly(input.expiry_date);
  const created_date = defaultIstDayString();
  const renewedByResult = parseActorName(input.renewed_by);
  if (!renewedByResult.ok) {
    return { ok: false, error: renewedByResult.error };
  }
  const renewed_by = renewedByResult.name;
  const created_by = renewed_by;

  if (!credential_name) {
    return { ok: false, error: "Credential name is required." };
  }
  if (!platform) {
    return { ok: false, error: "Platform is required." };
  }
  if (!ticket_name) {
    return { ok: false, error: "Ticket name is required." };
  }
  if (!expiry_date) {
    return { ok: false, error: "Valid expiry date (YYYY-MM-DD) is required." };
  }
  if (expiry_date < created_date) {
    return {
      ok: false,
      error: "Expiry date cannot be before today (IST).",
    };
  }
  if (!input.ticket_link.trim()) {
    return { ok: false, error: "Ticket link is required." };
  }
  if (!ticket_link) {
    return { ok: false, error: "Ticket link must be a valid http(s) URL." };
  }

  try {
    await withHealthCheckMysqlRetry(async (pool) => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [activeRows] = await conn.query<RowDataPacket[]>(
          `SELECT id, credential_name, platform
           FROM credential_expiry_records
           WHERE credential_name_key = LOWER(TRIM(?))
             AND LOWER(TRIM(platform)) = LOWER(TRIM(?))
             AND status = 'active'
           LIMIT 1
           FOR UPDATE`,
          [credential_name, platform],
        );

        const active = activeRows[0] as
          | { id: string; credential_name: string; platform: string }
          | undefined;
        if (!active) {
          throw new Error("NO_ACTIVE_RECORD");
        }

        await conn.query(
          `UPDATE credential_expiry_records
           SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [active.id],
        );

        const newId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO credential_expiry_records
             (id, credential_name, platform, ticket_name, ticket_link, created_date,
              created_by, renewed_by, expiry_date, status, supersedes_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
          [
            newId,
            active.credential_name,
            active.platform,
            ticket_name,
            ticket_link,
            created_date,
            created_by,
            renewed_by,
            expiry_date,
            active.id,
          ],
        );

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NO_ACTIVE_RECORD") {
      return {
        ok: false,
        error: "No active credential found with this name and platform.",
      };
    }
    const err = e as { code?: string; message?: string };
    return {
      ok: false,
      error: err.message ?? "Failed to resolve credential record.",
    };
  }
}

/** Marks the active row stopped without a successor — removes from tracking/alerts. */
export async function stopTrackingCredentialRecord(
  credential_name: string,
  platform: string,
): Promise<CredentialMutationResult> {
  if (!getHealthCheckMysqlPool()) {
    return { ok: false, error: "Database is not configured." };
  }

  const name = credential_name.trim();
  const plat = platform.trim();
  if (!name) {
    return { ok: false, error: "Credential name is required." };
  }
  if (!plat) {
    return { ok: false, error: "Platform is required." };
  }

  try {
    const updated = await withHealthCheckMysqlRetry(async (pool) => {
      const [result] = await pool.query(
        `UPDATE credential_expiry_records
         SET status = 'stopped', resolved_at = CURRENT_TIMESTAMP
         WHERE credential_name_key = LOWER(TRIM(?))
           AND LOWER(TRIM(platform)) = LOWER(TRIM(?))
           AND status = 'active'`,
        [name, plat],
      );
      return (result as { affectedRows?: number }).affectedRows ?? 0;
    });

    if (updated === 0) {
      return {
        ok: false,
        error: "No active credential found with this name and platform.",
      };
    }
    return { ok: true };
  } catch (e) {
    const err = e as { message?: string };
    return {
      ok: false,
      error: err.message ?? "Failed to stop tracking credential.",
    };
  }
}

/** Inserts a new active row from a stopped credential (start tracking again). */
export async function resumeTrackingCredentialRecord(input: {
  stopped_record_id: string;
  ticket_name: string;
  ticket_link: string;
  expiry_date: string;
  created_by: string;
}): Promise<CredentialMutationResult> {
  if (!getHealthCheckMysqlPool()) {
    return { ok: false, error: "Database is not configured." };
  }

  const stoppedId = input.stopped_record_id.trim();
  const ticket_name = input.ticket_name.trim();
  const ticket_link = normalizeTicketLink(input.ticket_link);
  const expiry_date = parseDateOnly(input.expiry_date);
  const created_date = defaultIstDayString();
  const createdByResult = parseActorName(input.created_by);
  if (!createdByResult.ok) {
    return { ok: false, error: createdByResult.error };
  }
  const created_by = createdByResult.name;

  if (!stoppedId) {
    return { ok: false, error: "Stopped record id is required." };
  }
  if (!ticket_name) {
    return { ok: false, error: "Ticket name is required." };
  }
  if (!expiry_date) {
    return { ok: false, error: "Valid expiry date (YYYY-MM-DD) is required." };
  }
  if (expiry_date < created_date) {
    return {
      ok: false,
      error: "Expiry date cannot be before today (IST).",
    };
  }
  if (!input.ticket_link.trim()) {
    return { ok: false, error: "Ticket link is required." };
  }
  if (!ticket_link) {
    return { ok: false, error: "Ticket link must be a valid http(s) URL." };
  }

  try {
    await withHealthCheckMysqlRetry(async (pool) => {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        const [stoppedRows] = await conn.query<RowDataPacket[]>(
          `SELECT id, credential_name, platform, status
           FROM credential_expiry_records
           WHERE id = ?
           LIMIT 1
           FOR UPDATE`,
          [stoppedId],
        );
        const stopped = stoppedRows[0] as
          | { id: string; credential_name: string; platform: string; status: string }
          | undefined;
        if (!stopped || stopped.status !== "stopped") {
          throw new Error("NOT_STOPPED");
        }

        const [activeRows] = await conn.query<RowDataPacket[]>(
          `SELECT id FROM credential_expiry_records
           WHERE credential_name_key = LOWER(TRIM(?))
             AND LOWER(TRIM(platform)) = LOWER(TRIM(?))
             AND status = 'active'
           LIMIT 1`,
          [stopped.credential_name, stopped.platform],
        );
        if (activeRows.length > 0) {
          throw new Error("ALREADY_ACTIVE");
        }

        const newId = crypto.randomUUID();
        await conn.query(
          `INSERT INTO credential_expiry_records
             (id, credential_name, platform, ticket_name, ticket_link, created_date,
              created_by, renewed_by, expiry_date, status, supersedes_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'active', ?)`,
          [
            newId,
            stopped.credential_name,
            stopped.platform,
            ticket_name,
            ticket_link,
            created_date,
            created_by,
            expiry_date,
            stopped.id,
          ],
        );

        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_STOPPED") {
      return { ok: false, error: "Stopped credential not found." };
    }
    if (e instanceof Error && e.message === "ALREADY_ACTIVE") {
      return {
        ok: false,
        error:
          "This credential is already being tracked. Check the active list.",
      };
    }
    const err = e as { code?: string; message?: string };
    if (err.code === "ER_DUP_ENTRY") {
      return {
        ok: false,
        error: "An active credential with this name and platform already exists.",
      };
    }
    return {
      ok: false,
      error: err.message ?? "Failed to resume tracking.",
    };
  }
}
