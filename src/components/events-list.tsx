"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { eventKindLabel } from "@/lib/wager";

export type EventListItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  wager_mode: string;
  entry_fee_units: number | string;
  created_at: string;
  league_id?: string | null;
};

type SortKey = "newest" | "oldest" | "title_asc" | "title_desc" | "status";

const selectClass =
  "rounded-sm border border-line bg-bg-elevated px-3 py-2 text-sm text-fg outline-none focus:border-accent";

type Props = {
  events: EventListItem[];
  emptyMessage?: string;
  emptyHref?: string;
  emptyLinkLabel?: string;
};

export function EventsList({
  events,
  emptyMessage = "No games, bets, or tournaments yet.",
  emptyHref,
  emptyLinkLabel = "Start one",
}: Props) {
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = events.filter((e) => {
      if (kindFilter !== "all" && e.kind !== kindFilter) return false;
      if (statusFilter === "open_active") {
        if (e.status !== "open" && e.status !== "in_progress") return false;
      } else if (statusFilter !== "all" && e.status !== statusFilter) {
        return false;
      }
      if (q && !e.title.toLowerCase().includes(q)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "oldest":
          return +new Date(a.created_at) - +new Date(b.created_at);
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        case "status":
          return (
            a.status.localeCompare(b.status) ||
            +new Date(b.created_at) - +new Date(a.created_at)
          );
        case "newest":
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });

    return list;
  }, [events, kindFilter, statusFilter, sortKey, query]);

  if (events.length === 0) {
    return (
      <p className="mt-3 text-sm text-muted">
        {emptyMessage}{" "}
        {emptyHref ? (
          <Link href={emptyHref} className="text-accent hover:underline">
            {emptyLinkLabel}
          </Link>
        ) : null}
        {emptyHref ? "." : null}
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title…"
          className={`${selectClass} w-full sm:min-w-[12rem] sm:flex-1`}
          aria-label="Filter by title"
        />
        <select
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value)}
          className={selectClass}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          <option value="game">Games</option>
          <option value="bet">Bets</option>
          <option value="tournament">Tournaments</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="open_active">Open & in progress</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All statuses</option>
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className={selectClass}
          aria-label="Sort events"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title_asc">Title A–Z</option>
          <option value="title_desc">Title Z–A</option>
          <option value="status">By status</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No matches for these filters.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {filtered.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="flex items-start justify-between gap-3 py-4 transition hover:bg-fg/[0.03] sm:items-center sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="break-words font-medium">{event.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {eventKindLabel(event.kind)} · {event.wager_mode}
                    {Number(event.entry_fee_units) > 0
                      ? ` · entry ${event.entry_fee_units}`
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 pt-0.5 text-xs uppercase tracking-wider text-muted sm:pt-0">
                  {event.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
