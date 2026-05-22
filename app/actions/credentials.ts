"use server";

import { revalidatePath } from "next/cache";
import { parseActorName } from "@/lib/credentialActor";
import {
  parsePlatformFromForm,
  parsePlatformValue,
} from "@/lib/credentialPlatform";
import {
  createCredentialRecord,
  resolveCredentialRecord,
  resumeTrackingCredentialRecord,
  stopTrackingCredentialRecord,
} from "@/lib/credentials";

export type CredentialActionState = {
  ok: boolean;
  error?: string;
};

function platformFromFormData(
  formData: FormData,
): { ok: true; platform: string } | { ok: false; error: string } {
  const hidden = formData.get("platform");
  if (hidden != null && String(hidden).trim() !== "") {
    return parsePlatformValue(String(hidden));
  }
  return parsePlatformFromForm(
    String(formData.get("platform_choice") ?? ""),
    String(formData.get("platform_other") ?? ""),
  );
}

export async function createCredentialAction(
  _prev: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const platformResult = platformFromFormData(formData);
  if (!platformResult.ok) {
    return { ok: false, error: platformResult.error };
  }

  const actorResult = parseActorName(String(formData.get("created_by") ?? ""));
  if (!actorResult.ok) {
    return { ok: false, error: actorResult.error };
  }

  const result = await createCredentialRecord({
    credential_name: String(formData.get("credential_name") ?? ""),
    platform: platformResult.platform,
    ticket_name: String(formData.get("ticket_name") ?? ""),
    ticket_link: String(formData.get("ticket_link") ?? ""),
    expiry_date: String(formData.get("expiry_date") ?? ""),
    created_by: actorResult.name,
  });

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/credentials");
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

export async function resolveCredentialAction(
  _prev: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const platformResult = parsePlatformValue(String(formData.get("platform") ?? ""));
  if (!platformResult.ok) {
    return { ok: false, error: platformResult.error };
  }

  const actorResult = parseActorName(String(formData.get("renewed_by") ?? ""));
  if (!actorResult.ok) {
    return { ok: false, error: actorResult.error };
  }

  const result = await resolveCredentialRecord({
    credential_name: String(formData.get("credential_name") ?? ""),
    platform: platformResult.platform,
    ticket_name: String(formData.get("ticket_name") ?? ""),
    ticket_link: String(formData.get("ticket_link") ?? ""),
    expiry_date: String(formData.get("expiry_date") ?? ""),
    renewed_by: actorResult.name,
  });

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/credentials");
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

export async function stopTrackingCredentialAction(
  _prev: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  if (formData.get("confirm") !== "yes") {
    return { ok: false, error: "Confirmation is required." };
  }

  const platformResult = parsePlatformValue(String(formData.get("platform") ?? ""));
  if (!platformResult.ok) {
    return { ok: false, error: platformResult.error };
  }

  const result = await stopTrackingCredentialRecord(
    String(formData.get("credential_name") ?? ""),
    platformResult.platform,
  );

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/credentials");
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

export async function resumeTrackingCredentialAction(
  _prev: CredentialActionState,
  formData: FormData,
): Promise<CredentialActionState> {
  const actorResult = parseActorName(String(formData.get("created_by") ?? ""));
  if (!actorResult.ok) {
    return { ok: false, error: actorResult.error };
  }

  const result = await resumeTrackingCredentialRecord({
    stopped_record_id: String(formData.get("stopped_record_id") ?? ""),
    ticket_name: String(formData.get("ticket_name") ?? ""),
    ticket_link: String(formData.get("ticket_link") ?? ""),
    expiry_date: String(formData.get("expiry_date") ?? ""),
    created_by: actorResult.name,
  });

  if (result.ok) {
    revalidatePath("/");
    revalidatePath("/credentials");
    return { ok: true };
  }
  return { ok: false, error: result.error };
}
