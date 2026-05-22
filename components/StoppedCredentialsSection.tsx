"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  resumeTrackingCredentialAction,
  type CredentialActionState,
} from "@/app/actions/credentials";
import { DEFAULT_CREDENTIAL_ACTOR } from "@/lib/credentialActor";
import { dashboardUi } from "@/lib/dashboardUi";
import type { CredentialExpiryRecord } from "@/lib/types";

const initialAction: CredentialActionState = { ok: false };

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">
      {children}
    </label>
  );
}

function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return (
    <input
      {...props}
      className={`mt-1 w-full rounded-md border border-[#EAEFF5] bg-white px-2.5 py-1.5 text-[13px] text-[#0B1220] outline-none ring-0 placeholder:text-[#94A3B8] focus:border-[#CBD5E1] focus:ring-2 focus:ring-[#E2E8F0]/80 ${props.className ?? ""}`}
    />
  );
}

function ResumeTrackingForm({
  record,
  todayIst,
  onCancel,
}: {
  record: CredentialExpiryRecord;
  todayIst: string;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    resumeTrackingCredentialAction,
    initialAction,
  );

  return (
    <form
      action={action}
      className="mt-3 space-y-3 rounded-[8px] border border-[#EAEFF5] bg-[#F9FAFB] p-3"
    >
      <input type="hidden" name="stopped_record_id" value={record.id} />
      <p className="text-[11px] font-medium text-[#475569]">
        Start tracking{" "}
        <span className="text-[#0B1220]">{record.credential_name}</span>
        <span className="text-[#94A3B8]"> · {record.platform}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel>Ticket name *</FieldLabel>
          <TextInput
            name="ticket_name"
            required
            maxLength={255}
            defaultValue={record.ticket_name}
          />
        </div>
        <div>
          <FieldLabel>Ticket link *</FieldLabel>
          <TextInput
            name="ticket_link"
            type="url"
            required
            placeholder="https://…"
            defaultValue={record.ticket_link ?? ""}
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
        Creates a new active record. Created date: {todayIst} IST. The stopped
        row stays in this list for history.
      </p>
      {state.error ? (
        <p className="text-[11px] text-rose-700/90" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && !state.error ? (
        <p className="text-[11px] text-emerald-800/80" role="status">
          Tracking resumed.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-[#0B1220] px-3 py-1.5 text-[11px] font-medium text-white transition-[opacity,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:opacity-95 hover:shadow-[0_2px_10px_rgba(11,18,32,0.18)] disabled:opacity-50"
        >
          {pending ? "Starting…" : "Confirm start tracking"}
        </button>
        <button
          type="button"
          className="rounded-md border border-[#EAEFF5] bg-white px-3 py-1.5 text-[11px] font-medium text-[#64748B] hover:bg-[#F9FAFB]"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function StoppedCredentialCard({
  record,
  todayIst,
}: {
  record: CredentialExpiryRecord;
  todayIst: string;
}) {
  const [resuming, setResuming] = useState(false);
  const stoppedOn = record.resolved_at?.slice(0, 10) ?? "—";

  return (
    <article className="border-b border-[#EAEFF5] last:border-b-0">
      <div className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-semibold text-[#0B1220]">
                {record.credential_name}
              </h3>
              <span className="rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                {record.platform}
              </span>
              <span className="rounded-md border border-slate-200/50 bg-slate-50/80 px-2 py-0.5 text-[10px] font-medium text-slate-700/80">
                Stopped
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[#64748B]">
              Last ticket:{" "}
              <span className="font-medium text-[#334155]">
                {record.ticket_name}
              </span>
              {record.ticket_link ? (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={record.ticket_link}
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
              Stopped {stoppedOn} · Created by {record.created_by}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-[#EAEFF5] bg-white px-2.5 py-1 text-[10px] font-medium text-[#334155] transition-[box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:bg-[#F9FAFB] hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            onClick={() => setResuming((v) => !v)}
          >
            {resuming ? "Close" : "Start tracking again"}
          </button>
        </div>
        {resuming ? (
          <ResumeTrackingForm
            record={record}
            todayIst={todayIst}
            onCancel={() => setResuming(false)}
          />
        ) : null}
      </div>
    </article>
  );
}

export function StoppedCredentialsSection({
  stopped,
  todayIst,
}: {
  stopped: CredentialExpiryRecord[];
  todayIst: string;
}) {
  const [panelOpen, setPanelOpen] = useState(stopped.length > 0);

  return (
    <section className={`${dashboardUi.panel} mt-5`}>
      <div className="flex flex-col gap-3 border-b border-[#EAEFF5] pb-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((v) => !v)}
        >
          <span className="text-[#94A3B8]" aria-hidden>
            {panelOpen ? "▾" : "▸"}
          </span>
          <div>
            <h2 className={dashboardUi.panelTitle}>Stopped tracking</h2>
            <p className={dashboardUi.panelDesc}>
              Credentials removed from alerts. Resume to add a new active row.
            </p>
          </div>
          <span className="ml-auto rounded-md border border-[#EAEFF5] bg-[#F9FAFB] px-2 py-0.5 text-[10px] font-medium tabular-nums text-[#64748B]">
            {stopped.length}
          </span>
        </button>
      </div>

      {panelOpen ? (
        <div className="mt-2 overflow-hidden rounded-[8px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {stopped.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-[#94A3B8]">
              No stopped credentials.
            </p>
          ) : (
            stopped.map((record) => (
              <StoppedCredentialCard
                key={record.id}
                record={record}
                todayIst={todayIst}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
