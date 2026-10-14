"use client";

import { useState } from "react";

import {
  resolveCancellation,
  type CancellationProposal,
  type ProposalResolution,
} from "@/lib/api";

type Props = {
  proposal: CancellationProposal;
  /** Called with the server's result once the patient has confirmed or kept the appointment. */
  onResolved: (resolution: ProposalResolution) => void;
};

/**
 * Chat-bubble styled card for a cancellation the assistant proposed. The appointment is
 * only cancelled when the patient presses Confirm; the model cannot do it for them.
 */
export default function CancelConfirmCard({ proposal, onResolved }: Props) {
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "decline") {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      onResolved(await resolveCancellation(proposal.id, action));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  }

  const rows: [string, string][] = [
    ["When", proposal.display_time],
    ["With", proposal.provider_name],
    ["For", proposal.patient_first_name],
  ];

  return (
    <div className="flex justify-start">
      <section
        aria-label="Confirm cancellation"
        className="w-full max-w-[80%] rounded-2xl bg-zinc-100 px-4 py-3 text-sm dark:bg-zinc-800"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Please confirm this cancellation
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

        {proposal.policy_note && (
          <p className="mt-2 rounded-lg bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {proposal.policy_note}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-2 text-red-600">
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => act("confirm")}
            disabled={busy !== null}
            className="flex-1 rounded-lg bg-red-600 px-3 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy === "confirm" ? "Cancelling…" : "Cancel appointment"}
          </button>
          <button
            onClick={() => act("decline")}
            disabled={busy !== null}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-medium hover:bg-zinc-200 disabled:opacity-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
          >
            {busy === "decline" ? "Keeping…" : "Keep it"}
          </button>
        </div>
      </section>
    </div>
  );
}
