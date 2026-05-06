"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RouteLoader } from "@/components/RouteLoader";
import { dashboardUi } from "@/lib/dashboardUi";

export type DashboardNavigateFn = (
  href: string,
  options?: { scroll?: boolean },
) => void;

const DashboardNavContext = createContext<DashboardNavigateFn | null>(null);

/** Stable string for pathname + query (sorted) so we can tell when a client nav finished. */
function normalizeLocation(pathname: string, search: string): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const p = new URLSearchParams(raw);
  const keys = [...new Set([...p.keys()])].sort();
  const sorted = new URLSearchParams();
  for (const k of keys) {
    for (const v of [...p.getAll(k)].sort()) {
      sorted.append(k, v);
    }
  }
  const q = sorted.toString();
  const path = pathname || "/";
  return q ? `${path}?${q}` : path;
}

function normalizeHrefAgainstOrigin(href: string): string {
  const u = new URL(href, window.location.origin);
  return normalizeLocation(u.pathname, u.search);
}

const OVERLAY_FALLBACK_MS = 5_000;

export function DashboardNavProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentSerialized = useMemo(
    () => normalizeLocation(pathname, `?${searchParams.toString()}`),
    [pathname, searchParams],
  );

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const navigate = useCallback<DashboardNavigateFn>(
    (href, options) => {
      const target = normalizeHrefAgainstOrigin(href);
      const now = normalizeLocation(
        window.location.pathname,
        window.location.search,
      );
      if (target === now) return;

      clearFallbackTimer();
      setPendingTarget(target);

      fallbackTimerRef.current = setTimeout(() => {
        setPendingTarget(null);
        fallbackTimerRef.current = null;
      }, OVERLAY_FALLBACK_MS);

      router.push(href, { scroll: options?.scroll ?? false });
    },
    [router, clearFallbackTimer],
  );

  useEffect(() => {
    if (pendingTarget === null) return;
    if (currentSerialized === pendingTarget) {
      clearFallbackTimer();
      setPendingTarget(null);
    }
  }, [currentSerialized, pendingTarget, clearFallbackTimer]);

  useEffect(() => () => clearFallbackTimer(), [clearFallbackTimer]);

  const showOverlay = pendingTarget !== null;

  return (
    <DashboardNavContext.Provider value={navigate}>
      {children}
      {showOverlay ? (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#F6F8FB]/78 backdrop-blur-[3px] motion-reduce:backdrop-blur-none"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className={`${dashboardUi.panel} pointer-events-none mx-4 max-w-md shadow-[0_16px_48px_rgba(15,23,42,0.12)]`}
          >
            <RouteLoader variant="card" />
          </div>
        </div>
      ) : null}
    </DashboardNavContext.Provider>
  );
}

export function useDashboardNavigate(): DashboardNavigateFn {
  const fn = useContext(DashboardNavContext);
  if (!fn) {
    throw new Error(
      "useDashboardNavigate must be used within DashboardNavProvider",
    );
  }
  return fn;
}
