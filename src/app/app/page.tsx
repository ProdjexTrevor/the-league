import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/actions";
import { EventsList } from "@/components/events-list";
import { createClient } from "@/lib/supabase/server";
import { eventKindLabel } from "@/lib/wager";

export const dynamic = "force-dynamic";

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const [{ data: memberships }, { data: myEvents }] = await Promise.all([
    supabase
      .from("league_members")
      .select(
        "role, leagues(id, name, description, invite_code, default_entry_fee_units)"
      )
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false }),
    supabase
      .from("events")
      .select(
        "id, title, kind, status, entry_fee_units, wager_mode, created_at, league_id"
      )
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const { data: playing } = await supabase
    .from("event_players")
    .select(
      "event_id, invite_status, events(id, title, kind, status, entry_fee_units, wager_mode, created_at, league_id)"
    )
    .eq("user_id", user.id)
    .limit(50);

  const eventMap = new Map<string, NonNullable<(typeof myEvents)>[number]>();
  myEvents?.forEach((e) => eventMap.set(e.id, e));
  playing?.forEach((row) => {
    const e = Array.isArray(row.events) ? row.events[0] : row.events;
    if (e) eventMap.set(e.id, e);
  });
  const events = Array.from(eventMap.values()).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
  );

  const pendingInvites =
    playing
      ?.filter((row) => row.invite_status === "pending")
      .map((row) => {
        const e = Array.isArray(row.events) ? row.events[0] : row.events;
        return e;
      })
      .filter(Boolean) ?? [];

  const leagues =
    memberships
      ?.map((m) => {
        const league = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
        if (!league) return null;
        return { ...league, role: m.role };
      })
      .filter(Boolean) ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/" className="font-display text-2xl text-fg">
            THE LEAGUE
          </Link>
          <p className="mt-2 break-words text-sm text-muted">
            Hey {profile?.display_name ?? "player"}
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/wallet" className="text-sm text-muted hover:text-fg">
            Wallet
          </Link>
          <Link href="/catalog" className="text-sm text-muted hover:text-fg">
            Catalog
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm text-muted hover:text-fg">
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/create"
          className="inline-flex rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-110"
        >
          Start something
        </Link>
        <Link
          href="/create?kind=bet"
          className="inline-flex rounded-sm border border-line px-5 py-3 text-sm font-semibold text-fg transition hover:border-fg/40"
        >
          Make a bet
        </Link>
      </div>

      {pendingInvites.length > 0 && (
        <section className="mt-14">
          <h2 className="text-lg font-semibold">Invites waiting</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {pendingInvites.map((event) =>
              event ? (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex items-start justify-between gap-3 py-4 transition hover:bg-fg/[0.03] sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium">{event.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {eventKindLabel(event.kind)} · accept to join
                      </p>
                    </div>
                    <span className="shrink-0 pt-0.5 text-xs uppercase tracking-wider text-accent sm:pt-0">
                      Pending
                    </span>
                  </Link>
                </li>
              ) : null
            )}
          </ul>
        </section>
      )}

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Your events</h2>
        <EventsList
          events={events}
          emptyMessage="No games, bets, or tournaments yet."
          emptyHref="/create"
        />
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Your leagues</h2>
        {leagues.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No leagues yet.{" "}
            <Link href="/create" className="text-accent hover:underline">
              Create or join
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {leagues.map((league) =>
              league ? (
                <li key={league.id}>
                  <Link
                    href={`/leagues/${league.id}`}
                    className="flex items-start justify-between gap-3 py-4 transition hover:bg-fg/[0.03] sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium">{league.name}</p>
                      {league.description && (
                        <p className="mt-0.5 break-words text-sm text-muted">
                          {league.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 pt-0.5 text-xs uppercase tracking-wider text-muted sm:pt-0">
                      {league.role}
                    </span>
                  </Link>
                </li>
              ) : null
            )}
          </ul>
        )}
      </section>
    </main>
  );
}
