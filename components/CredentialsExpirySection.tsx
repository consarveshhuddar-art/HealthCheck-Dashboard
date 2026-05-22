"use client";

import {
  useActionState,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  createCredentialAction,
  resolveCredentialAction,
  stopTrackingCredentialAction,
  type CredentialActionState,
} from "@/app/actions/credentials";
import { useDashboardNavigate } from "@/components/DashboardNavProvider";
import { DEFAULT_CREDENTIAL_ACTOR } from "@/lib/credentialActor";
import {
  CREDENTIAL_PLATFORM_JENKINS,
  CREDENTIAL_PLATFORM_OTHERS_CHOICE,
} from "@/lib/credentialPlatform";
import { dashboardUi } from "@/lib/dashboardUi";
import {
  credentialDaysUntilExpiry,
  credentialExpiryUrgency,
} from "@/lib/credentialUtils";
import type {
  CredentialExpiryGroup,
  CredentialSortMode,
} from "@/lib/types";

const initialAction: CredentialActionState = { ok: false };

function sortTabClass(active: boolean) {
  return `rounded-md px-2.5 py-1 text-[10px] font-medium transition-[colors,box-shadow,transform] duration-150 ease-out ${
    active
      ? "bg-white text-[#0B1220] shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-[#EAEFF5]"
      : "text-[#64748B] hover:-translate-y-px hover:bg-[#F9FAFB] hover:text-[#334155] hover:shadow-[0_1px_4px_rgba(0,0,0,0.03)]"
  }`;
}

const cardBtnEase =
  "transition-[box-shadow,transform,background-color,border-color] duration-150 ease-out hover:-translate-y-px";

function renewButtonClass(
  urgency: "ok" | "soon" | "expired",
  panelOpen: boolean,
) {
  const base = `rounded-md px-2.5 py-1 text-[10px] font-medium ${cardBtnEase}`;
  if (panelOpen) {
    return `${base} border border-[#EAEFF5] bg-white text-[#334155] hover:border-[#CBD5E1] hover:bg-[#F9FAFB] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]`;
  }
  if (urgency === "soon") {
    return `${base} border border-amber-200/40 bg-amber-50/50 text-amber-900/75 ring-1 ring-amber-200/30 hover:border-amber-300/50 hover:bg-amber-50/75 hover:text-amber-950/85 hover:shadow-[0_2px_8px_rgba(180,83,9,0.1)] hover:ring-amber-300/35`;
  }
  return `${base} border border-[#EAEFF5] bg-white text-[#334155] hover:border-[#CBD5E1] hover:bg-[#F9FAFB] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]`;
}

function stopTrackingButtonClass(panelOpen: boolean) {
  const base = `rounded-md px-2.5 py-1 text-[10px] font-medium ${cardBtnEase}`;
  if (panelOpen) {
    return `${base} border border-[#EAEFF5] bg-white text-[#334155] hover:border-[#CBD5E1] hover:bg-[#F9FAFB] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]`;
  }
  return `${base} border border-amber-200/60 bg-amber-50/50 text-amber-950/80 hover:border-amber-300/45 hover:bg-amber-50/70 hover:text-amber-950 hover:shadow-[0_2px_8px_rgba(180,83,9,0.08)]`;
}

function urgencyStyles(urgency: "ok" | "soon" | "expired") {
  if (urgency === "expired") {
    return {
      dot: "bg-rose-800/40",
      text: "text-rose-900/70",
      bg: "border border-rose-200/35 bg-rose-50/65",
      label: "Expired",
    };
  }
  if (urgency === "soon") {
    return {
      dot: "bg-amber-700/40",
      text: "text-amber-900/70",
      bg: "border border-amber-200/35 bg-amber-50/65",
      label: "Expiring soon",
    };
  }
  return {
    dot: "bg-emerald-700/45",
    text: "text-emerald-900/75",
    bg: "border border-emerald-200/35 bg-emerald-50/70",
    label: "OK",
  };
}

function expiryHint(expiryDate: string, todayIst: string): string {
  const days = credentialDaysUntilExpiry(expiryDate, todayIst);
  if (days < 0) {
    return days === -1 ? "Expired yesterday" : `Expired ${-days} days ago`;
  }
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
      {children}
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`mt-1 w-full rounded-md border border-[#EAEFF5] bg-white px-2.5 py-1.5 text-[13px] text-[#0B1220] outline-none ring-0 placeholder:text-[#94A3B8] focus:border-[#CBD5E1] focus:ring-2 focus:ring-[#E2E8F0]/80 ${props.className ?? ""}`}
    />
  );
}

const fieldControlClass =
  "mt-1 w-full rounded-md border border-[#EAEFF5] bg-white px-2.5 py-1.5 text-[13px] text-[#0B1220] outline-none focus:border-[#CBD5E1] focus:ring-2 focus:ring-[#E2E8F0]/80";

function PlatformFields() {
  const [choice, setChoice] = useState(CREDENTIAL_PLATFORM_JENKINS);
  const [other, setOther] = useState("");

  return (
    <div className="space-y-2 sm:col-span-2">
      <div>
        <FieldLabel>Platform *</FieldLabel>
        <select
          name="platform_choice"
          required
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={fieldControlClass}
        >
          <option value={CREDENTIAL_PLATFORM_JENKINS}>Jenkins</option>
          <option value={CREDENTIAL_PLATFORM_OTHERS_CHOICE}>Others</option>
        </select>
      </div>
      {choice === CREDENTIAL_PLATFORM_OTHERS_CHOICE ? (
        <div>
          <FieldLabel>Platform name *</FieldLabel>
          <TextInput
            name="platform_other"
            required
            maxLength={100}
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="e.g. GitHub, AWS"
          />
        </div>
      ) : (
        <input type="hidden" name="platform_other" value="" />
      )}
    </div>
  );
}

function CreateCredentialForm({ todayIst }: { todayIst: string }) {
  const [state, action, pending] = useActionState(
    createCredentialAction,
    initialAction,
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <PlatformFields />
        <div>
          <FieldLabel>Credential name *</FieldLabel>
          <TextInput name="credential_name" required maxLength={255} />
        </div>
        <div>
          <FieldLabel>Ticket name *</FieldLabel>
          <TextInput name="ticket_name" required maxLength={255} />
        </div>
        <div>
          <FieldLabel>Ticket link *</FieldLabel>
          <TextInput
            name="ticket_link"
            type="url"
            required
            placeholder="https://…"
          />
        </div>
        <div>
          <FieldLabel>Expiry date *</FieldLabel>
          <TextInput
            name="expiry_date"
            type="date"
            required
            min={todayIst}
          />
        </div>
        <div>
          <FieldLabel>Created by *</FieldLabel>
          <TextInput
            name="created_by"
            required
            maxLength={255}
            defaultValue={DEFAULT_CREDENTIAL_ACTOR}
          />
        </div>
      </div>
      <p className="text-[10px] text-[#94A3B8]">
        Created date is set to today ({todayIst} IST) automatically and cannot
        be changed.
      </p>
      {state.error ? (
        <p className="text-[11px] text-rose-700/90" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.error ? (
        <p className="text-[11px] text-emerald-800/80" role="status">
          Credential added.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[#0B1220] px-3 py-1.5 text-[11px] font-medium text-white transition-[opacity,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:opacity-95 hover:shadow-[0_2px_10px_rgba(11,18,32,0.18)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      >
        {pending ? "Adding…" : "Add credential"}
      </button>
    </form>
  );
}

function StopTrackingCredentialForm({
  credentialName,
  platform,
  onCancel,
}: {
  credentialName: string;
  platform: string;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    stopTrackingCredentialAction,
    initialAction,
  );
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <form
      action={action}
      className="mt-3 space-y-3 rounded-[8px] border border-amber-200/50 bg-amber-50/40 p-3"
    >
      <input type="hidden" name="credential_name" value={credentialName} />
      <input type="hidden" name="platform" value={platform} />
      <input type="hidden" name="confirm" value={acknowledged ? "yes" : ""} />
      <p className="text-[11px] font-semibold text-amber-950/90">Stop tracking</p>
      <p className="text-[11px] leading-relaxed text-amber-900/80">
        <span className="font-medium text-[#0B1220]">{credentialName}</span> (
        {platform}) will
        no longer appear in active tracking or expiry alerts. Past entries remain
        in history below. You can add this credential again later if needed.
      </p>
      <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[#475569]">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>I understand this credential will not be tracked anymore.</span>
      </label>
      {state.error ? (
        <p className="text-[11px] text-rose-700/90" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.error ? (
        <p className="text-[11px] text-emerald-800/80" role="status">
          Credential removed from tracking.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !acknowledged}
          className="rounded-md bg-rose-800 px-3 py-1.5 text-[11px] font-medium text-white transition-[opacity,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:opacity-95 hover:shadow-[0_2px_10px_rgba(159,18,57,0.22)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {pending ? "Removing…" : "Confirm stop tracking"}
        </button>
        <button
          type="button"
          className="rounded-md border border-[#EAEFF5] bg-white px-3 py-1.5 text-[11px] font-medium text-[#64748B] transition-[box-shadow,transform,background-color,border-color] duration-150 ease-out hover:-translate-y-px hover:border-[#CBD5E1] hover:bg-[#F9FAFB] hover:shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function ResolveCredentialForm({
  credentialName,
  platform,
  todayIst,
  onCancel,
}: {
  credentialName: string;
  platform: string;
  todayIst: string;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    resolveCredentialAction,
    initialAction,
  );

  return (
    <form action={action} className="mt-3 space-y-3 rounded-[8px] border border-[#EAEFF5] bg-[#F9FAFB] p-3">
      <input type="hidden" name="credential_name" value={credentialName} />
      <input type="hidden" name="platform" value={platform} />
      <p className="text-[11px] font-medium text-[#475569]">
        Renew <span className="text-[#0B1220]">{credentialName}</span>
        <span className="text-[#94A3B8]"> · {platform}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Ticket name *</FieldLabel>
          <TextInput name="ticket_name" required maxLength={255} />
        </div>
        <div>
          <FieldLabel>Ticket link *</FieldLabel>
          <TextInput
            name="ticket_link"
            type="url"
            required
            placeholder="https://…"
          />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>New expiry date *</FieldLabel>
          <TextInput
            name="expiry_date"
            type="date"
            required
            min={todayIst}
          />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Renewed by *</FieldLabel>
          <TextInput
            name="renewed_by"
            required
            maxLength={255}
            defaultValue={DEFAULT_CREDENTIAL_ACTOR}
          />
        </div>
      </div>
      <p className="text-[10px] text-[#94A3B8]">
        Creates a new active record; previous row moves to history. New created
        date: {todayIst} IST.
      </p>
      {state.error ? (
        <p className="text-[11px] text-rose-700/90" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.error ? (
        <p className="text-[11px] text-emerald-800/80" role="status">
          Credential renewed.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#0B1220] px-3 py-1.5 text-[11px] font-medium text-white transition-[opacity,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:opacity-95 hover:shadow-[0_2px_10px_rgba(11,18,32,0.18)] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
        >
          {pending ? "Saving…" : "Confirm renewal"}
        </button>
        <button
          type="button"
          className="rounded-md border border-[#EAEFF5] bg-white px-3 py-1.5 text-[11px] font-medium text-[#64748B] transition-[box-shadow,transform,background-color,border-color] duration-150 ease-out hover:-translate-y-px hover:border-[#CBD5E1] hover:bg-[#F9FAFB] hover:shadow-[0_1px_6px_rgba(0,0,0,0.04)]"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CredentialGroupCard({
  group,
  todayIst,
  defaultHistoryOpen,
}: {
  group: CredentialExpiryGroup;
  todayIst: string;
  defaultHistoryOpen: boolean;
}) {
  const [historyOpen, setHistoryOpen] = useState(defaultHistoryOpen);
  const [panel, setPanel] = useState<"none" | "resolve" | "stop">("none");
  const active = group.active;

  if (!active) return null;

  const urgency = credentialExpiryUrgency(active.expiry_date, todayIst);
  const styles = urgencyStyles(urgency);
  const hint = expiryHint(active.expiry_date, todayIst);

  return (
    <article className="border-b border-[#EAEFF5] transition-colors duration-150 ease-out last:border-b-0 hover:bg-[#F9FAFB]/40">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[#0B1220]">
                {group.credential_name}
              </h3>
              <span className="rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                {group.platform}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#64748B]">
              Ticket:{" "}
              <span className="font-medium text-[#334155]">
                {active.ticket_name}
              </span>
              {active.ticket_link ? (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={active.ticket_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-800/80 underline-offset-2 hover:underline"
                  >
                    Link
                  </a>
                </>
              ) : null}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              Created by{" "}
              <span className="font-medium text-[#334155]">
                {active.created_by}
              </span>
              {active.renewed_by ? (
                <>
                  {" "}
                  · Renewed by{" "}
                  <span className="font-medium text-[#334155]">
                    {active.renewed_by}
                  </span>
                </>
              ) : null}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-[#64748B]">
              Created {active.created_date} · Expires {active.expiry_date} ·{" "}
              {hint}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-medium ${styles.bg} ${styles.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
              {styles.label}
            </span>
            <button
              type="button"
              className={renewButtonClass(urgency, panel === "resolve")}
              onClick={() =>
                setPanel((p) => (p === "resolve" ? "none" : "resolve"))
              }
            >
              {panel === "resolve" ? "Close" : "Renew"}
            </button>
            <button
              type="button"
              className={stopTrackingButtonClass(panel === "stop")}
              onClick={() => setPanel((p) => (p === "stop" ? "none" : "stop"))}
            >
              {panel === "stop" ? "Close" : "Stop tracking"}
            </button>
          </div>
        </div>
        {panel === "resolve" ? (
          <ResolveCredentialForm
            credentialName={group.credential_name}
            platform={group.platform}
            todayIst={todayIst}
            onCancel={() => setPanel("none")}
          />
        ) : null}
        {panel === "stop" ? (
          <StopTrackingCredentialForm
            credentialName={group.credential_name}
            platform={group.platform}
            onCancel={() => setPanel("none")}
          />
        ) : null}
      </div>

      {group.resolved.length > 0 ? (
        <div className="border-t border-[#EAEFF5] bg-[#F9FAFB]/60">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-[#94A3B8] transition-colors duration-150 ease-out hover:bg-[#F9FAFB]/80 hover:text-[#64748B]"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((v) => !v)}
          >
            <span>Renewal history ({group.resolved.length})</span>
            <span aria-hidden>{historyOpen ? "▾" : "▸"}</span>
          </button>
          {historyOpen ? (
            <ul className="space-y-0 border-t border-[#EAEFF5] px-4 py-2">
              {group.resolved.map((rec) => (
                <li
                  key={rec.id}
                  className="border-b border-[#EAEFF5]/80 py-2 text-[11px] text-[#64748B] last:border-b-0"
                >
                  <span className="font-medium text-[#475569]">
                    {rec.ticket_name}
                  </span>
                  {rec.ticket_link ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={rec.ticket_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-800/80 underline-offset-2 hover:underline"
                      >
                        Link
                      </a>
                    </>
                  ) : null}
                  <span className="mt-0.5 block text-[#94A3B8]">
                    Created by {rec.created_by}
                    {rec.renewed_by ? ` · Renewed by ${rec.renewed_by}` : null}
                  </span>
                  <span className="mt-0.5 block font-mono tabular-nums">
                    {rec.platform} · Created {rec.created_date} · Expired{" "}
                    {rec.expiry_date}
                    {rec.resolved_at
                      ? ` · Resolved ${rec.resolved_at.slice(0, 10)}`
                      : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

const SORT_OPTIONS: { id: CredentialSortMode; label: string }[] = [
  { id: "created_desc", label: "Created ↓" },
  { id: "created_asc", label: "Created ↑" },
  { id: "expiry_asc", label: "Expiry ↑" },
  { id: "expiry_desc", label: "Expiry ↓" },
];

export function CredentialsExpirySection({
  groups,
  sort,
  todayIst,
  stats,
}: {
  groups: CredentialExpiryGroup[];
  sort: CredentialSortMode;
  todayIst: string;
  stats: { totalActive: number; expiringSoon: number; expired: number };
}) {
  const navigate = useDashboardNavigate();
  const searchParams = useSearchParams();
  const [panelOpen, setPanelOpen] = useState(true);

  const activeGroups = useMemo(
    () => groups.filter((g) => g.active),
    [groups],
  );

  const setSort = (mode: CredentialSortMode) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("sort", mode);
    navigate(`/credentials?${p.toString()}`, { scroll: false });
  };

  return (
    <>
      <div className={`${dashboardUi.statGrid} mb-5`}>
        <div className="relative overflow-hidden rounded-[10px] border border-[#EAEFF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFE_100%)] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-4">
          <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#6B7280]">
            Active credentials
          </p>
          <p className="mt-1 text-[2.375rem] font-semibold leading-[1.05] tracking-[-0.035em] text-[#0B1220] tabular-nums">
            {stats.totalActive}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-[10px] border border-[#EAEFF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFE_100%)] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-4">
          <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#6B7280]">
            Expiring ≤7d (IST)
          </p>
          <p className="mt-1 text-[2.375rem] font-semibold leading-[1.05] tracking-[-0.035em] text-amber-900/85 tabular-nums">
            {stats.expiringSoon}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-[10px] border border-[#EAEFF5] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFE_100%)] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:p-4">
          <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#6B7280]">
            Expired
          </p>
          <p className="mt-1 text-[2.375rem] font-semibold leading-[1.05] tracking-[-0.035em] text-rose-900/85 tabular-nums">
            {stats.expired}
          </p>
        </div>
      </div>

      <section className={dashboardUi.panel}>
        <div className={dashboardUi.panelHeaderDivider}>
          <h2 className={dashboardUi.sectionLabel}>Add credential</h2>
          <p className={dashboardUi.sectionDesc}>
            Insert-only: renew an existing name with Resolve below.
          </p>
        </div>
        <div className="mt-3">
          <CreateCredentialForm todayIst={todayIst} />
        </div>
      </section>

      <section className={`${dashboardUi.panel} mt-5`}>
        <div className="flex flex-col gap-3 border-b border-[#EAEFF5] pb-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left sm:w-auto"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
            >
              <span className="text-[#94A3B8]" aria-hidden>
                {panelOpen ? "▾" : "▸"}
              </span>
              <div>
                <h2 className={dashboardUi.panelTitle}>Credentials</h2>
                <p className={dashboardUi.panelDesc}>
                  Active credentials with renewal history per name.
                </p>
              </div>
            </button>
          </div>
          {panelOpen ? (
            <div
              className="inline-flex flex-wrap items-center gap-1 rounded-[10px] border border-[#EAEFF5] bg-[#F9FAFB] p-1"
              role="group"
              aria-label="Sort credentials"
            >
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={sort === opt.id}
                  className={sortTabClass(sort === opt.id)}
                  onClick={() => setSort(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {panelOpen ? (
          <div className="mt-2 overflow-hidden rounded-[8px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            {activeGroups.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#94A3B8]">
                No active credentials yet.
              </p>
            ) : (
              activeGroups.map((group) => {
                const urgency = group.active
                  ? credentialExpiryUrgency(group.active.expiry_date, todayIst)
                  : "ok";
                return (
                  <CredentialGroupCard
                    key={`${group.credential_name}|${group.platform}`}
                    group={group}
                    todayIst={todayIst}
                    defaultHistoryOpen={
                      urgency === "soon" || urgency === "expired"
                    }
                  />
                );
              })
            )}
          </div>
        ) : null}
      </section>
    </>
  );
}
