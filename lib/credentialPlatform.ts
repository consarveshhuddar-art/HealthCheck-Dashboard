export const CREDENTIAL_PLATFORM_JENKINS = "Jenkins";
export const CREDENTIAL_PLATFORM_OTHERS_CHOICE = "Others";

const PLATFORM_MAX_LEN = 100;

export type PlatformParseResult =
  | { ok: true; platform: string }
  | { ok: false; error: string };

/** Resolve platform from form: Jenkins choice or custom text when Others. */
export function parsePlatformFromForm(
  platformChoice: string,
  platformOther: string | undefined,
): PlatformParseResult {
  const choice = platformChoice.trim();
  if (choice === CREDENTIAL_PLATFORM_JENKINS) {
    return { ok: true, platform: CREDENTIAL_PLATFORM_JENKINS };
  }
  if (choice === CREDENTIAL_PLATFORM_OTHERS_CHOICE) {
    const other = (platformOther ?? "").trim();
    if (!other) {
      return {
        ok: false,
        error: "Enter a platform name when Others is selected.",
      };
    }
    if (other.length > PLATFORM_MAX_LEN) {
      return {
        ok: false,
        error: `Platform name must be at most ${PLATFORM_MAX_LEN} characters.`,
      };
    }
    return { ok: true, platform: other };
  }
  return { ok: false, error: "Platform is required." };
}

/** Validate stored/hidden platform value (renew, stop). */
export function parsePlatformValue(raw: string): PlatformParseResult {
  const platform = raw.trim();
  if (!platform) {
    return { ok: false, error: "Platform is required." };
  }
  if (platform.length > PLATFORM_MAX_LEN) {
    return {
      ok: false,
      error: `Platform must be at most ${PLATFORM_MAX_LEN} characters.`,
    };
  }
  return { ok: true, platform };
}

/** Map DB platform to dropdown + optional custom text for forms. */
export function platformToFormValues(platform: string): {
  choice: string;
  other: string;
} {
  if (
    platform.trim().toLowerCase() ===
    CREDENTIAL_PLATFORM_JENKINS.toLowerCase()
  ) {
    return { choice: CREDENTIAL_PLATFORM_JENKINS, other: "" };
  }
  return { choice: CREDENTIAL_PLATFORM_OTHERS_CHOICE, other: platform };
}
