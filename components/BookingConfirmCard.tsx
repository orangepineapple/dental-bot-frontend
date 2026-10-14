"use client";

import { useState } from "react";

import { resolveProposal, type Proposal, type ProposalResolution } from "@/lib/api";

type Props = {
  proposal: Proposal;
  /** Called with the server's result once the patient has confirmed or declined. */
  onResolved: (resolution: ProposalResolution) => void;
};

/**
 * Chat-bubble styled card for a booking the assistant proposed. The appointment is only
 * created when the patient presses Confirm; the model cannot do it for them.
 */
export default function BookingConfirmCard({ proposal, onResolved }: Props) {
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "decline") {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      onResolved(await resolveProposal(proposal.id, action));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  }

  const rows: [string, string][] = [
    ["When", proposal.display_time],
    ["Length", `${proposal.duration_minutes} minutes`],
    ["With", proposal.provider_name],
    ["For", proposal.patient_first_name],
  ];

  return (
    <div className="flex justify-start">
      <section
        aria-label="Confirm appointment"
        className="w-full max-w-[80%] rounded-2xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Please confirm this appointment
        </p>
        <p className="mt-1 text-base font-semibold">{proposal.appointment_type}</p>
        <dl className="mt-2 space-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-500">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {error && (
          <p role="alert" className="mt-2 text-red-600">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => act("confirm")}
            disabled={busy !== null}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy === "confirm" ? "Booking…" : "Confirm"}
          </button>
          <button
            onClick={() => act("decline")}
            disabled={busy !== null}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-medium hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
          >
            {busy === "decline" ? "Declining…" : "Decline"}
          </button>
        </div>
      </section>
    </div>
  );
}
