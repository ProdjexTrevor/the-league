"use client";

import { useState, useTransition } from "react";

import { quickBet } from "@/app/actions";

type Opponent = { id: string; display_name: string | null };

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-fg outline-none transition focus:border-accent";

const PRESETS = [
  { label: "Match play", title: "Match play" },
  { label: "Bags to 21", title: "Bags to 21" },
  { label: "Closest to pin", title: "Closest to the pin" },
  { label: "Head-to-head", title: "Head-to-head" },
  { label: "Random dare", title: "Random dare" },
];

export function QuickBetForm({
  catalogId,
  opponents,
}: {
  catalogId: string;
  opponents: Opponent[];
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await quickBet(formData);
      } catch (e) {
        // Server actions redirect by throwing — don't surface that as a form error.
        if (
          typeof e === "object" &&
          e !== null &&
          "digest" in e &&
          String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw e;
        }
        setError(e instanceof Error ? e.message : "Could not lock it in.");
      }
    });
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">Make the bet</h2>
      <p className="mt-1 text-sm text-muted">
        Set the stake, set the line, shake on it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setTitle(p.title)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              title === p.title
                ? "border-accent bg-accent/15 text-accent"
                : "border-line text-muted hover:border-fg/30 hover:text-fg"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <form action={onSubmit} className="mt-5 space-y-4">
        <input type="hidden" name="catalog_id" value={catalogId} />

        <label className="block text-sm">
          <span className="text-muted">What’s the bet?</span>
          <input
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Front nine, low score"
            className={field}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Against</span>
          <select name="against_id" required defaultValue="" className={field}>
            <option value="" disabled>
              Pick a friend
            </option>
            {opponents.map((o) => (
              <option key={o.id} value={o.id}>
                {o.display_name ?? "Player"}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-muted">Stake ($)</span>
          <input
            name="stake"
            type="number"
            required
            min={1}
            step="1"
            placeholder="20"
            className={field}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Line / handicap (optional)</span>
          <input
            name="line"
            placeholder="They get 3 strokes"
            className={field}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Terms (optional)</span>
          <input
            name="terms"
            placeholder="Cash at the turn, no excuses."
            className={field}
          />
        </label>

        {opponents.length === 0 ? (
          <p className="text-sm text-muted">
            Invite friends into a league first so you can bet against them — or
            use the full{" "}
            <a href="/create" className="text-accent hover:underline">
              create flow
            </a>
            .
          </p>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={pending || opponents.length === 0}
          className="w-full rounded-xl bg-accent py-3.5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Locking in…" : "Lock it in"}
        </button>
      </form>
    </section>
  );
}
