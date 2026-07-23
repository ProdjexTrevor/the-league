import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  buildPlayerDashboard,
  formatWinRate,
  moneyLabel,
  type PlayerEventMeta,
  type PlayerEventRow,
} from "@/lib/player-stats";
import { formatMoney } from "@/lib/wager";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/players/${id}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, venmo_username, created_at")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  const { data: myPlayerRows } = await supabase
    .from("event_players")
    .select("event_id, user_id, outcome, placement, units_delta, invite_status")
    .eq("user_id", id);

  const myRows: PlayerEventRow[] = (myPlayerRows ?? []).map((row) => ({
    event_id: row.event_id,
    user_id: row.user_id,
    outcome: row.outcome,
    placement: row.placement,
    units_delta: row.units_delta,
    invite_status: row.invite_status,
  }));

  const eventIds = [...new Set(myRows.map((r) => r.event_id))];

  const [{ data: eventRows }, { data: peerRows }, { data: catalog }] =
    await Promise.all([
      eventIds.length > 0
        ? supabase
            .from("events")
            .select(
              "id, title, kind, status, catalog_id, played_at, created_at, updated_at"
            )
            .in("id", eventIds)
        : Promise.resolve({ data: [] as PlayerEventMeta[] }),
      eventIds.length > 0
        ? supabase
            .from("event_players")
            .select(
              "event_id, user_id, outcome, placement, units_delta, invite_status"
            )
            .in("event_id", eventIds)
        : Promise.resolve({ data: [] as PlayerEventRow[] }),
      supabase
        .from("game_catalog")
        .select("id, name, slug")
        .eq("is_active", true),
    ]);

  const events: PlayerEventMeta[] = (eventRows ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    kind: event.kind,
    status: event.status,
    catalog_id: event.catalog_id,
    played_at: event.played_at,
    created_at: event.created_at,
    updated_at: event.updated_at,
  }));

  const peerIds = [
    ...new Set((peerRows ?? []).map((r) => r.user_id).filter((uid) => uid !== id)),
  ];

  const { data: peerProfiles } =
    peerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", peerIds)
      : { data: [] };

  const names = new Map(
    (peerProfiles ?? []).map((p) => [p.id, p.display_name] as const)
  );

  const stats = buildPlayerDashboard({
    playerId: id,
    myRows,
    allRows: (peerRows ?? []) as PlayerEventRow[],
    events,
    catalog: catalog ?? [],
    names,
  });

  const isSelf = user.id === id;
  const streak =
    stats.currentStreak.type && stats.currentStreak.count > 0
      ? `${stats.currentStreak.count}${stats.currentStreak.type}`
      : "—";

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 pb-20 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <Link href="/app" className="font-display text-2xl text-fg">
          THE LEAGUE
        </Link>
        <Link href="/app" className="shrink-0 text-sm text-muted hover:text-fg">
          Dashboard
        </Link>
      </div>

      <header className="mt-10 animate-rise">
        <p className="text-xs uppercase tracking-wider text-muted">
          {isSelf ? "Your player card" : "Player"}
        </p>
        <h1 className="mt-2 font-display break-words text-5xl text-fg sm:text-6xl">
          {profile.display_name}
        </h1>
        <p className="mt-3 text-sm text-muted">
          Games, bets, and money story
          {profile.venmo_username ? ` · @${profile.venmo_username}` : ""}
        </p>
      </header>

      <section className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Record" value={`${stats.wins}–${stats.losses}`} />
        <StatTile
          label="Win rate"
          value={formatWinRate(stats.winRate)}
        />
        <StatTile
          label="Net money"
          value={moneyLabel(stats.netMoney)}
          tone={stats.netMoney >= 0 ? "good" : "bad"}
        />
        <StatTile label="Streak" value={streak} />
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <HighlightCard
          eyebrow="Took the most from"
          title={
            stats.takenMostFrom
              ? stats.takenMostFrom.displayName
              : "Nobody yet"
          }
          detail={
            stats.takenMostFrom
              ? `${moneyLabel(stats.takenMostFrom.amount)} lifetime`
              : "Win some money first."
          }
          href={
            stats.takenMostFrom
              ? `/players/${stats.takenMostFrom.userId}`
              : undefined
          }
          tone="good"
        />
        <HighlightCard
          eyebrow="Lost the most to"
          title={
            stats.lostMostTo ? stats.lostMostTo.displayName : "Nobody yet"
          }
          detail={
            stats.lostMostTo
              ? `${moneyLabel(stats.lostMostTo.amount)} lifetime`
              : "Stay lucky."
          }
          href={
            stats.lostMostTo
              ? `/players/${stats.lostMostTo.userId}`
              : undefined
          }
          tone="bad"
        />
      </section>

      <section className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Money won" value={moneyLabel(stats.moneyWon)} tone="good" />
        <StatTile label="Money lost" value={moneyLabel(stats.moneyLost)} tone="bad" />
        <StatTile
          label="Biggest win"
          value={stats.biggestWin > 0 ? moneyLabel(stats.biggestWin) : "—"}
        />
        <StatTile
          label="Biggest loss"
          value={stats.biggestLoss > 0 ? moneyLabel(stats.biggestLoss) : "—"}
        />
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Best games</h2>
        {stats.bestGames.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No completed games or bets yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {stats.bestGames.map((g) => (
              <li
                key={g.catalogId}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <p className="text-muted">
                    {g.wins}W · {g.losses}L · {g.played} played
                  </p>
                </div>
                <span className="shrink-0 font-display text-2xl text-accent">
                  {g.wins}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(stats.topRivalsTaken.length > 1 || stats.topRivalsLost.length > 1) && (
        <section className="mt-14 grid gap-10 sm:grid-cols-2">
          <RivalList title="Money taken from" rivals={stats.topRivalsTaken} />
          <RivalList title="Money lost to" rivals={stats.topRivalsLost} />
        </section>
      )}

      <section className="mt-14">
        <h2 className="text-lg font-semibold">History</h2>
        <p className="mt-1 text-sm text-muted">
          Games, bets, and tournaments
          {isSelf ? " you’ve been in" : " you’ve shared with this player"}.
        </p>
        {stats.history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No events yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {stats.history.map((item) => (
              <li key={item.eventId}>
                <Link
                  href={`/events/${item.eventId}`}
                  className="flex items-start justify-between gap-3 py-4 transition hover:bg-fg/[0.03] sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {item.kindLabel} · {item.catalogName} ·{" "}
                      {item.outcomeLabel}
                      {item.status === "completed" && item.unitsDelta !== 0
                        ? ` · ${item.unitsDelta >= 0 ? "+" : ""}${formatMoney(item.unitsDelta)}`
                        : ""}
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs uppercase tracking-wider text-muted sm:pt-0">
                    {item.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  const valueClass =
    tone === "good"
      ? "text-accent"
      : tone === "bad"
        ? "text-danger"
        : "text-fg";
  return (
    <div className="rounded-sm border border-line px-3 py-3 sm:px-4 sm:py-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-2 font-display text-3xl sm:text-4xl ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function HighlightCard({
  eyebrow,
  title,
  detail,
  href,
  tone,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  href?: string;
  tone: "good" | "bad";
}) {
  const body = (
    <>
      <p className="text-xs uppercase tracking-wider text-muted">{eyebrow}</p>
      <p
        className={`mt-2 font-display text-3xl sm:text-4xl ${
          tone === "good" ? "text-accent" : "text-danger"
        }`}
      >
        {title}
      </p>
      <p className="mt-2 text-sm text-muted">{detail}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-sm border border-line px-4 py-4 transition hover:border-fg/30"
      >
        {body}
      </Link>
    );
  }

  return (
    <div className="rounded-sm border border-line px-4 py-4">{body}</div>
  );
}

function RivalList({
  title,
  rivals,
}: {
  title: string;
  rivals: { userId: string; displayName: string; amount: number }[];
}) {
  if (rivals.length === 0) return null;
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {rivals.map((r) => (
          <li key={r.userId}>
            <Link
              href={`/players/${r.userId}`}
              className="flex items-center justify-between gap-3 py-3 text-sm transition hover:bg-fg/[0.03]"
            >
              <span className="truncate font-medium">{r.displayName}</span>
              <span className="shrink-0 text-muted">{moneyLabel(r.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
