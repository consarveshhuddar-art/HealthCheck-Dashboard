export const DEFAULT_CREDENTIAL_ACTOR = "Manoj Bagal";

const ACTOR_MAX_LEN = 255;

export type ActorParseResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

export function parseActorName(raw: string | undefined): ActorParseResult {
  const name = (raw ?? "").trim() || DEFAULT_CREDENTIAL_ACTOR;
  if (name.length > ACTOR_MAX_LEN) {
    return {
      ok: false,
      error: `Name must be at most ${ACTOR_MAX_LEN} characters.`,
    };
  }
  return { ok: true, name };
}
