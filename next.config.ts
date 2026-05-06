import type { NextConfig } from "next";

/**
 * Dev-only: allow HMR / `/_next/*` when opening the app via a LAN IP (not localhost).
 * Set `NEXT_DEV_ALLOWED_ORIGINS` in `.env.local` to a comma-separated list of hostnames
 * (no scheme/port), e.g. `192.168.4.42,10.0.0.5`. Empty string = localhost-only.
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
 */
const rawAllowed = process.env.NEXT_DEV_ALLOWED_ORIGINS;
const allowedDevOrigins =
  rawAllowed === ""
    ? []
    : (rawAllowed ?? "192.168.4.42")
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
};

export default nextConfig;
