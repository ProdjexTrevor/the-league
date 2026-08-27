"use client";

import { useEffect, useState } from "react";

import { PRO_SPORTS, type ProGame, type ProMarket, type ProSport } from "@/lib/pro-games";

const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";

type Props = {
  onPick: (pick: { title: string; line: string; marketLabel: string }) => void;
};

export function ProGamePicker({ onPick }: Props) {
  const [sport, setSport] = useState<ProSport>("mlb");
  const [games, setGames] = useState<ProGame[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    fetch(`/api/pro-games?sport=${sport}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load games.");
        if (cancelled) return;
        setGames(data.games ?? []);
        setNote(data.linesNote ?? null);
      })
      .catch((e) => {
        if (!cancelled) {
          setGames([]);
          setError(e instanceof Error ? e.message : "Could not load games.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sport]);

  const selected = games.find((g) => g.id === selectedId) ?? null;

  function chooseMarket(game: ProGame, market: ProMarket) {
    onPick({
      title: market.title,
      line: market.line,
      marketLabel: market.label,
    });
  }

  function chooseGameOnly(game: ProGame) {
    onPick({
      title: `${game.away} @ ${game.home}`,
      line: `${game.sportLabel} · ${game.start ?? game.status}`,
      marketLabel: "Game only",
    });
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-3">
      <p className={labelCls}>Today&apos;s pro games</p>
      <p className="mt-1 text-xs text-muted">
        Pick a game, then a line to fill your bet. Reference lines when ESPN has
        them — you still settle with your friend.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRO_SPORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSport(s.id)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
              sport === s.id
                ? "border-accent bg-accent text-accent-ink"
                : "border-line text-muted hover:border-fg/30 hover:text-fg"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading slate…</p>
      ) : error ? (
        <p className="mt-4 text-sm text-danger">{error}</p>
      ) : games.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No games on the slate right now.</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {games.map((game) => {
            const open = selectedId === game.id;
            return (
              <li
                key={game.id}
                className="rounded-2xl border border-line bg-bg/70"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSelectedId((id) => (id === game.id ? null : game.id))
                  }
                  className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                >
                  <span>
                    <span className="block text-sm font-semibold">
                      {game.awayAbbr} @ {game.homeAbbr}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {game.start ?? game.status}
                      {game.hasLines ? " · lines in" : " · no lines yet"}
                    </span>
                  </span>
                  <span className="text-xs text-accent">
                    {open ? "Hide" : "Pick"}
                  </span>
                </button>

                {open ? (
                  <div className="border-t border-line px-3 py-3">
                    {selected?.markets.length ? (
                      <div className="flex flex-wrap gap-2">
                        {selected.markets.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => chooseMarket(game, m)}
                            className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-fg transition hover:border-accent hover:text-accent"
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted">
                        No published spread / total for this game yet. Use the
                        game and type your own line below.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => chooseGameOnly(game)}
                      className="mt-3 text-xs font-semibold text-accent hover:underline"
                    >
                      Use game without a published line
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {note ? <p className="mt-3 text-[11px] leading-relaxed text-muted">{note}</p> : null}
    </div>
  );
}
