import { differenceInCalendarDays, parseISO } from "date-fns";

export function credentialDaysUntilExpiry(
  expiryDate: string,
  todayIst: string,
): number {
  return differenceInCalendarDays(parseISO(expiryDate), parseISO(todayIst));
}

export function credentialExpiryUrgency(
  expiryDate: string,
  todayIst: string,
): "ok" | "soon" | "expired" {
  const days = credentialDaysUntilExpiry(expiryDate, todayIst);
  if (days < 0) return "expired";
  if (days <= 6) return "soon";
  return "ok";
}
