type RouteLoaderProps = {
  /** Screen-style (default) or compact card for overlays */
  variant?: "page" | "card";
  className?: string;
};

/**
 * Shared loading chrome — matches dashboard neutrals and typography.
 */
export function RouteLoader({
  variant = "page",
  className = "",
}: RouteLoaderProps) {
  const isCard = variant === "card";

  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 text-center ${className}`}
    >
      <div className="relative" aria-hidden>
        <div
          className={`rounded-full border-2 border-[#EAEFF5] bg-white/80 ${
            isCard ? "h-11 w-11" : "h-14 w-14"
          }`}
        />
        <div
          className={`motion-reduce:animate-none absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-500 border-r-violet-400/35 ${
            isCard ? "h-11 w-11" : "h-14 w-14"
          }`}
          style={{ animationDuration: "0.9s" }}
        />
      </div>
      <div className="max-w-xs space-y-1">
        <p
          className={`font-semibold tracking-[-0.02em] text-[#0B1220] ${
            isCard ? "text-sm" : "text-[0.95rem]"
          }`}
        >
          Loading dashboard
        </p>
        <p className="text-[11px] font-medium leading-relaxed text-[#64748B]">
          Fetching the latest run and failure data from MySQL…
        </p>
      </div>
      <span className="sr-only">Loading dashboard data, please wait.</span>
      {!isCard ? (
        <div
          className="mt-1 h-0.5 w-44 max-w-full rounded-full bg-gradient-to-r from-transparent via-violet-400/45 to-transparent motion-reduce:animate-none animate-pulse"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
