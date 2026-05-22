"use client";

import { useEffect, useRef, useState } from "react";
import { useDashboardNavigate } from "@/components/DashboardNavProvider";
import type { CredentialAlertCounts } from "@/lib/types";

export function CredentialsBell({
  alerts,
}: {
  alerts: CredentialAlertCounts | null;
}) {
  const navigate = useDashboardNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const count =
    alerts === null ? 0 : alerts.expiringSoon + alerts.expired;
  const hasAlerts = count > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (alerts === null) return null;

  return (
    <div ref={rootRef} className="relative ml-auto">
      <button
        type="button"
        aria-label={
          hasAlerts
            ? `${count} credential alerts`
            : "No credential alerts"
        }
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#EAEFF5] bg-white text-[#475569] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {hasAlerts ? (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,20rem)] rounded-[10px] border border-[#EAEFF5] bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.12)]"
          role="dialog"
          aria-label="Credential alerts"
        >
          <p className="text-xs font-semibold text-[#1F2937]">Credential alerts</p>
          {hasAlerts ? (
            <ul className="mt-2 space-y-1.5 text-[11px] text-[#64748B]">
              {alerts.expired > 0 ? (
                <li>
                  <span className="font-medium text-rose-800/80">
                    {alerts.expired}
                  </span>{" "}
                  expired
                </li>
              ) : null}
              {alerts.expiringSoon > 0 ? (
                <li>
                  <span className="font-medium text-amber-800/80">
                    {alerts.expiringSoon}
                  </span>{" "}
                  expiring within 7 days (IST)
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-2 text-[11px] text-[#94A3B8]">
              No credentials expiring soon or expired.
            </p>
          )}
          <button
            type="button"
            className="mt-3 w-full rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-3 py-1.5 text-[11px] font-medium text-[#334155] transition-colors hover:bg-white"
            onClick={() => {
              setOpen(false);
              navigate("/credentials");
            }}
          >
            Open credential expiry
          </button>
        </div>
      ) : null}
    </div>
  );
}
