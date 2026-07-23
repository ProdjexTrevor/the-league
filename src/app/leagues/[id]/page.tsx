import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function LeaguePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", id)
    .single();

  if (!league) notFound();

  const [{ data: members }, { data: events }, { data: standings }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("role, user_id, profiles(display_name)")
        .eq("league_id", id),
      supabase
        .from("events")
        .select("id, title, kind, status, wager_mode, entry_fee_units, created_at")
        .eq("league_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("league_standings")
        .select("user_id, games_played, wins, net_units")
        .eq("league_id", id)
        .order("net_units", { ascending: false }),
    ]);

  const nameById = new Map(
    members?.map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return [m.user_id, profile?.display_name ?? "Player"] as const;
    })
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 pb-20 sm:px-6 sm:py-10">
      <Link href="/app" className="text-sm text-muted hover:text-fg">
        ← All leagues
      </Link>

      <header className="mt-6">
        <h1 className="font-display break-words text-4xl text-fg sm:text-5xl md:text-6xl">
          {league.name}
        </h1>
        {league.description && (
          <p className="mt-2 break-words text-muted">{league.description}</p>
        )}
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted">
          <span>Invite code</span>
          <span className="rounded-sm bg-bg-elevated px-2 py-1 font-mono tracking-widest text-accent">
            {league.invite_code}
          </span>
          {Number(league.default_entry_fee_units) > 0 && (
            <span>· season entry {league.default_entry_fee_units}</span>
          )}
        </p>
        <div className="mt-6">
          <Link
            href={`/create?league=${id}&kind=game`}
            className="inline-flex rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
          >
            Start a game
          </Link>
        </div>
      </header>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Standings</h2>
        {!standings?.length ? (
          <p className="mt-3 text-sm text-muted">No completed events yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Player</th>
                  <th className="py-2 pr-3 font-medium">Played</th>
                  <th className="py-2 pr-3 font-medium">Wins</th>
                  <th className="py-2 font-medium">Net units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {standings.map((row) => (
                  <tr key={row.user_id}>
                    <td className="max-w-[10rem] truncate py-2.5 pr-3 sm:max-w-none sm:whitespace-normal">
                      {nameById.get(row.user_id ?? "") ?? "Player"}
                    </td>
                    <td className="py-2.5 pr-3">{row.games_played ?? 0}</td>
                    <td className="py-2.5 pr-3">{row.wins ?? 0}</td>
                    <td className="py-2.5 font-medium text-accent">
                      {Number(row.net_units ?? 0).toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Members</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {members?.map((m) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return (
              <li
                key={m.user_id}
                className="rounded-sm border border-line px-3 py-1.5 text-sm"
              >
                {profile?.display_name ?? "Player"}
                {m.role === "owner" && (
                  <span className="ml-2 text-xs text-muted">owner</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Events</h2>
        {!events?.length ? (
          <p className="mt-3 text-sm text-muted">No games or tournaments yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-start justify-between gap-3 py-4 transition hover:bg-fg/[0.03] sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{event.title}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {event.kind} · {event.wager_mode} · entry{" "}
                      {event.entry_fee_units}
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
      </section>
    </main>
  );
}
