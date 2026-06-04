import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";

/** Today's calendar date in IST (`yyyy-MM-dd`). */
export function todayIstDateString(): string {
  return formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
}

/** Validate `yyyy-MM-dd` and reject future IST dates. */
export function parseIstDateParam(
  value: string | null | undefined,
): string | null {
  if (!value?.trim()) return null;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() + 1 !== m ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  if (s > todayIstDateString()) return null;
  return s;
}

export function formatIstDateLabel(isoDate: string): string {
  return formatInTimeZone(
    new Date(`${isoDate}T12:00:00+05:30`),
    IST,
    "EEEE, d MMM yyyy",
  );
}
