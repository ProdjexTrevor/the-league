import Link from "next/link";
import { redirect } from "next/navigation";

import { createEvent, createLeague, joinLeague, signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { scoringModeLabel, type ScoringMode } from "@/lib/wager";

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

  const [{ data: memberships }, { data: catalog }, { data: myEvents }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("role, leagues(id, name, description, invite_code, default_entry_fee_units)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false }),
      supabase
        .from("game_catalog")
        .select("id, name, scoring_mode, description")
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("events")
        .select("id, title, kind, status, entry_fee_units, wager_mode, created_at, league_id")
        .or(`created_by.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  // Also events I play in
  const { data: playing } = await supabase
    .from("event_players")
    .select("event_id, events(id, title, kind, status, entry_fee_units, wager_mode, created_at, league_id)")
    .eq("user_id", user.id)
    .order("event_id", { ascending: false })
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

  const catalogOptions = catalog ?? [];

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
          <Link href="/catalog" className="text-sm text-muted hover:text-fg">
            Game catalog
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm text-muted hover:text-fg">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Your events</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No games or tournaments yet. Create one below.
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
          <p className="mt-3 text-sm text-muted">No leagues yet.</p>
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

      <section className="mt-14 space-y-10">
        <CreateEventForm
          kind="game"
          label="Create a game"
          catalog={catalogOptions}
          leagues={leagues.filter(Boolean) as { id: string; name: string }[]}
        />
        <CreateEventForm
          kind="tournament"
          label="Create a tournament"
          catalog={catalogOptions}
          leagues={leagues.filter(Boolean) as { id: string; name: string }[]}
        />

        <div>
          <h2 className="text-lg font-semibold">Create a league</h2>
          <form action={createLeague} className="mt-4 space-y-3">
            <input
              name="name"
              required
              placeholder="League name"
              className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <textarea
              name="description"
              rows={2}
              placeholder="Optional description"
              className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <input
              name="entry_fee"
              type="number"
              min={0}
              step={1}
              defaultValue={0}
              placeholder="Season entry fee (units)"
              className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
            >
              Create league
            </button>
          </form>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Join with code</h2>
          <form action={joinLeague} className="mt-4 space-y-3">
            <input
              name="code"
              required
              placeholder="INVITE CODE"
              className="w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm uppercase tracking-widest outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-fg/40"
            >
              Join league
            </button>
          </form>
        </div>
      </section>

      {catalogOptions.length === 0 && (
        <p className="mt-10 text-sm text-danger">
          Game catalog is empty — run the competitions SQL migration in Supabase.
        </p>
      )}
    </main>
  );
}

function CreateEventForm({
  kind,
  label,
  catalog,
  leagues,
}: {
  kind: "game" | "tournament";
  label: string;
  catalog: {
    id: string;
    name: string;
    scoring_mode: string;
    description: string | null;
  }[];
  leagues: { id: string; name: string }[];
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{label}</h2>
      <form action={createEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="kind" value={kind} />
        <input
          name="title"
          required
          placeholder="Title"
          className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
        />
        <select
          name="catalog_id"
          required
          defaultValue=""
          className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
        >
          <option value="" disabled>
            Game from catalog
          </option>
          {catalog.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} — {scoringModeLabel(g.scoring_mode as ScoringMode)}
            </option>
          ))}
        </select>
        <select
          name="league_id"
          defaultValue=""
          className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
        >
          <option value="">Standalone (no league)</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              In league: {l.name}
            </option>
          ))}
        </select>
        <input
          name="entry_fee"
          type="number"
          min={0}
          step={1}
          defaultValue={0}
          placeholder="Entry fee (units)"
          className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <select
          name="wager_mode"
          defaultValue="pot"
          className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="none">No wager</option>
          <option value="pot">Equal pot</option>
          <option value="odds">Odds (e.g. 2 to 1)</option>
        </select>
        <input
          name="stake"
          type="number"
          min={0}
          step={1}
          defaultValue={10}
          placeholder="Stake / pot units"
          className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        {kind === "tournament" && (
          <>
            <select
              name="format"
              defaultValue="single_elim"
              className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            >
              <option value="single_elim">Single elimination</option>
              <option value="round_robin">Round robin</option>
              <option value="custom">Custom</option>
            </select>
            <input
              name="bracket_size"
              type="number"
              min={2}
              step={1}
              placeholder="Bracket size"
              className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </>
        )}
        <textarea
          name="notes"
          rows={2}
          placeholder="Notes (optional)"
          className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
        />
        <button
          type="submit"
          className="rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110 sm:col-span-2 sm:w-fit"
        >
          Create {kind}
        </button>
      </form>
    </div>
  );
}
