import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

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
      .limit(20),
  ]);

  const { data: playing } = await supabase
    .from("event_players")
    .select(
      "event_id, events(id, title, kind, status, entry_fee_units, wager_mode, created_at, league_id)"
    )
    .eq("user_id", user.id)
    .limit(30);

  const eventMap = new Map<string, NonNullable<(typeof myEvents)>[number]>();
  myEvents?.forEach((e) => eventMap.set(e.id, e));
  playing?.forEach((row) => {
    const e = Array.isArray(row.events) ? row.events[0] : row.events;
    if (e) eventMap.set(e.id, e);
  });
  const events = Array.from(eventMap.values()).sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
  );

  const leagues =
    memberships
      ?.map((m) => {
        const league = Array.isArray(m.leagues) ? m.leagues[0] : m.leagues;
        if (!league) return null;
        return { ...league, role: m.role };
      })
      .filter(Boolean) ?? [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="font-display text-2xl text-fg">
            THE LEAGUE
          </Link>
          <p className="mt-2 text-sm text-muted">
            Hey {profile?.display_name ?? "player"}
          </p>
        </div>
        <div className="flex items-center gap-4">
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
        </div>
      </header>

      <div className="mt-10">
        <Link
          href="/create"
          className="inline-flex rounded-sm bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition hover:brightness-110"
        >
          Start something
        </Link>
      </div>

      <section className="mt-14">
        <h2 className="text-lg font-semibold">Your events</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No games or tournaments yet.{" "}
            <Link href="/create" className="text-accent hover:underline">
              Start one
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between gap-4 py-4 transition hover:bg-fg/[0.03]"
                >
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {event.kind} · {event.wager_mode} · entry{" "}
                      {event.entry_fee_units}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-wider text-muted">
                    {event.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
                    className="flex items-center justify-between gap-4 py-4 transition hover:bg-fg/[0.03]"
                  >
                    <div>
                      <p className="font-medium">{league.name}</p>
                      {league.description && (
                        <p className="mt-0.5 text-sm text-muted">
                          {league.description}
                        </p>
                      )}
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted">
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
