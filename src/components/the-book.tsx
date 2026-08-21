"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { eventKindLabel } from "@/lib/wager";

export type BookEvent = {
  id: string;
  title: string;
  kind: string;
  status: string;
  wager_mode: string;
  entry_fee_units: number | string;
  default_stake_units?: number | string | null;
  notes?: string | null;
  created_at: string;
};

type Filter = "all" | "open" | "settled";

function statusTone(status: string) {
  if (status === "completed") return "text-accent";
  if (status === "cancelled") return "text-muted";
  return "text-accent";
}

function statusLabel(status: string) {
  if (status === "completed") return "Settled";
  if (status === "in_progress") return "Live";
  if (status === "cancelled") return "Cancelled";
  return "Open";
}

export function TheBook({ events }: { events: BookEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === "open") {
        return e.status === "open" || e.status === "in_progress";
      }
      if (filter === "settled") {
        return e.status === "completed" || e.status === "cancelled";
      }
      return true;
    });
  }, [events, filter]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "all" },
    { id: "open", label: "open" },
    { id: "settled", label: "settled" },
  ];

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">The book</h2>
        <div className="flex gap-1 rounded-full border border-line bg-bg-elevated/80 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                filter === tab.id
                  ? "bg-accent text-accent-ink"
                  : "text-muted hover:text-fg"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nothing on the book yet. Lock in a bet below.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No {filter} bets.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((event) => {
            const stake = Number(
              event.default_stake_units ?? event.entry_fee_units ?? 0
            );
            return (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="block rounded-2xl border border-line bg-bg-elevated/70 p-4 transition hover:border-accent/35 hover:bg-bg-elevated"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-muted">
                        {eventKindLabel(event.kind)}
                      </p>
                      <h3 className="mt-1 text-base font-semibold leading-snug">
                        {event.title}
                      </h3>
                      {event.notes ? (
                        <p className="mt-2 text-sm text-muted line-clamp-2">
                          {event.notes}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      {stake > 0 ? (
                        <p className="font-display text-2xl text-fg">
                          ${stake.toFixed(0)}
                        </p>
                      ) : null}
                      <p
                        className={`mt-1 text-xs font-semibold uppercase tracking-wider ${statusTone(event.status)}`}
                      >
                        {statusLabel(event.status)}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
