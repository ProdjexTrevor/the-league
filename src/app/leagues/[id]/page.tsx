import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createGame } from "@/app/actions";
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

  const [{ data: members }, { data: games }, { data: gameTypes }, { data: standings }] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("role, user_id, profiles(display_name)")
        .eq("league_id", id),
      supabase
        .from("games")
        .select("id, title, status, wager_units, created_at, game_types(name)")
        .eq("league_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("game_types").select("id, name").order("name"),
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

  async function createGameAction(formData: FormData) {
    "use server";
    return createGame(id, formData);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10">
      <Link href="/app" className="text-sm text-muted hover:text-fg">
        ← All leagues
      </Link>

      <header className="mt-6">
        <h1 className="font-display text-5xl text-fg md:text-6xl">{league.name}</h1>
        {league.description && (
          <p className="mt-2 text-muted">{league.description}</p>
        )}
        <p className="mt-4 text-sm text-muted">
          Invite code{" "}
          <span className="rounded-sm bg-bg-elevated px-2 py-1 font-mono tracking-widest text-accent">
            {league.invite_code}
          </span>
        </p>
      </header>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Standings</h2>
        {!standings?.length ? (
          <p className="mt-3 text-sm text-muted">No completed games yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="py-2 font-medium">Player</th>
                  <th className="py-2 font-medium">Played</th>
                  <th className="py-2 font-medium">Wins</th>
                  <th className="py-2 font-medium">Net units</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {standings.map((row) => (
                  <tr key={row.user_id}>
                    <td className="py-2.5">
                      {nameById.get(row.user_id ?? "") ?? "Player"}
                    </td>
                    <td className="py-2.5">{row.games_played ?? 0}</td>
                    <td className="py-2.5">{row.wins ?? 0}</td>
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
        <h2 className="text-lg font-semibold">New game</h2>
        <form action={createGameAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="title"
            required
            placeholder="Game title"
            className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
          />
          <select
            name="game_type_id"
            required
            className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            defaultValue=""
          >
            <option value="" disabled>
              Game type
            </option>
            {gameTypes?.map((gt) => (
              <option key={gt.id} value={gt.id}>
                {gt.name}
              </option>
            ))}
          </select>
          <input
            name="wager_units"
            type="number"
            min={0}
            step={1}
            defaultValue={10}
            placeholder="Wager units"
            className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
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
            Create game
          </button>
        </form>
      </section>

      <section className="mt-12 pb-16">
        <h2 className="text-lg font-semibold">Games</h2>
        {!games?.length ? (
          <p className="mt-3 text-sm text-muted">No games yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {games.map((game) => {
              const gt = Array.isArray(game.game_types)
                ? game.game_types[0]
                : game.game_types;
              return (
                <li key={game.id}>
                  <Link
                    href={`/leagues/${id}/games/${game.id}`}
                    className="flex items-center justify-between gap-4 py-4 transition hover:bg-fg/[0.03]"
                  >
                    <div>
                      <p className="font-medium">{game.title}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {gt?.name ?? "Game"} · {game.wager_units} units
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted">
                      {game.status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
