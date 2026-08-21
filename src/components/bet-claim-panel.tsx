"use client";

import { useState, useTransition } from "react";

import { claimBetResult } from "@/app/actions";

type Option = { key: string; label: string };

export function BetClaimPanel({
  eventId,
  options,
  myClaim,
  claims,
  acceptedCount,
}: {
  eventId: string;
  options: Option[];
  myClaim: string | null;
  claims: { user_id: string; winner_key: string; name: string }[];
  acceptedCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await claimBetResult(eventId, formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save claim.");
      }
    });
  }

  const agreed =
    claims.length >= acceptedCount &&
    acceptedCount > 0 &&
    claims.every((c) => c.winner_key === claims[0]?.winner_key);

  return (
    <section className="mt-10 rounded-2xl border border-line bg-bg-elevated/70 p-4">
      <h2 className="text-lg font-semibold">Who won?</h2>
      <p className="mt-1 text-sm text-muted">
        Every accepted player must pick the same winner. When you all agree, the
        wallet IOUs are created automatically.
      </p>

      <form action={onSubmit} className="mt-4 space-y-3">
        {options.map((opt) => (
          <label
            key={opt.key}
            className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-3 has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <input
              type="radio"
              name="winner_key"
              value={opt.key}
              required
              defaultChecked={myClaim === opt.key}
              className="accent-[var(--accent)]"
            />
            <span className="font-medium">{opt.label}</span>
          </label>
        ))}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-accent-ink disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : myClaim
              ? "Update my call"
              : "Confirm winner"}
        </button>
      </form>

      <ul className="mt-4 space-y-1 text-sm text-muted">
        {claims.map((c) => (
          <li key={c.user_id}>
            {c.name}:{" "}
            <span className="text-fg">
              {options.find((o) => o.key === c.winner_key)?.label ?? c.winner_key}
            </span>
          </li>
        ))}
        <li>
          {claims.length}/{acceptedCount} confirmed
          {agreed ? " · matching — settling…" : ""}
        </li>
      </ul>
    </section>
  );
}
