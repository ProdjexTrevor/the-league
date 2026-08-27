"use client";

import { useState, useTransition } from "react";

import { assignDraftClub, revealDraftClub } from "@/app/actions";
import type { GolfClubDraftState } from "@/lib/mini-games";

type Player = { user_id: string; name: string };

export function GolfClubDraftPanel({
  eventId,
  state,
  players,
}: {
  eventId: string;
  state: GolfClubDraftState;
  players: Player[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const draftPlayerIds = Object.keys(state.picks);
  const draftPlayers = players.filter((p) => draftPlayerIds.includes(p.user_id));

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <section className="mt-10 rounded-3xl border border-accent/35 bg-accent/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
        Game within the game
      </p>
      <h2 className="mt-1 font-display text-2xl tracking-[0.06em]">
        GOLF CLUB DRAFT
      </h2>
      <p className="mt-2 text-sm text-muted">
        Flip a club, bid in person, then tap who won it. First to{" "}
        {state.picksEach} clubs each — leftover clubs stay in the bag.
      </p>

      {state.status === "complete" ? (
        <p className="mt-4 text-sm font-semibold text-accent">Draft complete.</p>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {draftPlayers.map((p) => (
          <div
            key={p.user_id}
            className="rounded-2xl border border-line bg-bg/70 p-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {p.name}{" "}
              <span className="text-fg">
                ({state.picks[p.user_id]?.length ?? 0}/{state.picksEach})
              </span>
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {(state.picks[p.user_id] ?? []).length === 0 ? (
                <li className="text-muted">No clubs yet</li>
              ) : (
                (state.picks[p.user_id] ?? []).map((club) => (
                  <li key={club} className="font-medium">
                    {club}
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>

      {state.status === "drafting" ? (
        <div className="mt-5">
          {state.current ? (
            <div className="rounded-2xl border border-accent bg-bg px-4 py-6 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Up for auction
              </p>
              <p className="mt-2 font-display text-4xl tracking-[0.04em] text-accent">
                {state.current}
              </p>
              <p className="mt-3 text-sm text-muted">
                Bid it out in person, then assign the winner.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {draftPlayers.map((p) => {
                  const full =
                    (state.picks[p.user_id]?.length ?? 0) >= state.picksEach;
                  return (
                    <button
                      key={p.user_id}
                      type="button"
                      disabled={pending || full}
                      onClick={() =>
                        run(async () => {
                          const fd = new FormData();
                          fd.set("player_id", p.user_id);
                          await assignDraftClub(eventId, fd);
                        })
                      }
                      className="flex-1 rounded-2xl bg-accent py-3 text-sm font-bold uppercase tracking-wide text-accent-ink disabled:opacity-40"
                    >
                      {p.name} gets it
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending || state.remaining.length === 0}
              onClick={() => run(() => revealDraftClub(eventId))}
              className="w-full rounded-2xl border border-accent bg-accent/15 py-4 text-sm font-bold uppercase tracking-[0.12em] text-accent disabled:opacity-40"
            >
              {pending ? "Flipping…" : "Flip next club"}
            </button>
          )}
          <p className="mt-3 text-center text-xs text-muted">
            {state.remaining.length} club
            {state.remaining.length === 1 ? "" : "s"} still in the bag
            {state.current ? " · one on the block" : ""}
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </section>
  );
}
