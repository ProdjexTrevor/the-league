"use client";

import { useMemo, useState } from "react";

import { scoringModeLabel, type ScoringMode } from "@/lib/wager";

export type CatalogGameRow = {
  id: string;
  name: string;
  description: string | null;
  scoring_mode: string;
};

type Props = {
  games: CatalogGameRow[];
  emptyMessage?: string;
};

export function CatalogGameList({ games, emptyMessage }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description?.toLowerCase().includes(q) ?? false) ||
        scoringModeLabel(g.scoring_mode as ScoringMode)
          .toLowerCase()
          .includes(q)
    );
  }, [games, query]);

  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm text-muted">Search games</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games…"
          className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
      </label>
      {!filtered.length ? (
        <p className="mt-3 text-sm text-muted">
          {query.trim()
            ? `No games match “${query.trim()}”.`
            : (emptyMessage ?? "No games yet.")}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {filtered.map((g) => (
            <li key={g.id} className="py-4">
              <p className="font-medium">{g.name}</p>
              <p className="mt-1 text-sm text-muted">
                {scoringModeLabel(g.scoring_mode as ScoringMode)}
                {g.description ? ` · ${g.description}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
