import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { addPlayerToGame, completeGame } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; gameId: string }>;
};

export default async function GamePage({ params }: Props) {
  const { id: leagueId, gameId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: game } = await supabase
    .from("games")
    .select("*, game_types(name)")
    .eq("id", gameId)
    .eq("league_id", leagueId)
    .single();

  if (!game) notFound();

  const [{ data: players }, { data: members }] = await Promise.all([
    supabase
      .from("game_players")
      .select("user_id, placement, units_delta, profiles(display_name)")
      .eq("game_id", gameId),
    supabase
      .from("league_members")
      .select("user_id, profiles(display_name)")
      .eq("league_id", leagueId),
  ]);

  const playerIds = new Set(players?.map((p) => p.user_id));
  const available =
    members?.filter((m) => !playerIds.has(m.user_id)) ?? [];

  const gameType = Array.isArray(game.game_types)
    ? game.game_types[0]
    : game.game_types;

  async function addPlayerAction(formData: FormData) {
    "use server";
    return addPlayerToGame(leagueId, gameId, formData);
  }

  async function completeAction(formData: FormData) {
    "use server";
    return completeGame(leagueId, gameId, formData);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/leagues/${leagueId}`}
        className="text-sm text-muted hover:text-fg"
      >
        ← Back to league
      </Link>

      <header className="mt-6">
        <p className="text-sm uppercase tracking-wider text-muted">
          {gameType?.name ?? "Game"} · {game.status}
        </p>
        <h1 className="mt-2 font-display break-words text-4xl text-fg sm:text-5xl">
          {game.title}
        </h1>
        <p className="mt-3 text-sm text-muted">
          Wager: <span className="text-accent">{game.wager_units}</span> money
          each
        </p>
        {game.notes && <p className="mt-2 text-sm text-muted">{game.notes}</p>}
      </header>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Players</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {players?.map((p) => {
            const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
            return (
              <li
                key={p.user_id}
                className="flex items-center justify-between py-3 text-sm"
              >
                <span>{profile?.display_name ?? "Player"}</span>
                <span className="text-muted">
                  {game.status === "completed"
                    ? `#${p.placement} · ${Number(p.units_delta) >= 0 ? "+" : ""}${p.units_delta}`
                    : "In"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {game.status !== "completed" && (
        <>
          {available.length > 0 && (
            <section className="mt-10">
              <h2 className="text-lg font-semibold">Add player</h2>
              <form action={addPlayerAction} className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <select
                  name="user_id"
                  required
                  className="w-full min-w-0 rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:w-auto sm:min-w-[12rem]"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select member
                  </option>
                  {available.map((m) => {
                    const profile = Array.isArray(m.profiles)
                      ? m.profiles[0]
                      : m.profiles;
                    return (
                      <option key={m.user_id} value={m.user_id}>
                        {profile?.display_name ?? "Player"}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="submit"
                  className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-fg/40 sm:w-auto"
                >
                  Add
                </button>
              </form>
            </section>
          )}

          {(players?.length ?? 0) >= 2 && (
            <section className="mt-10 pb-16">
              <h2 className="text-lg font-semibold">Settle results</h2>
              <p className="mt-1 text-sm text-muted">
                Place every player (1 = winner). Winner takes the pot.
              </p>
              <form action={completeAction} className="mt-4 space-y-3">
                {players?.map((p) => {
                  const profile = Array.isArray(p.profiles)
                    ? p.profiles[0]
                    : p.profiles;
                  return (
                    <label
                      key={p.user_id}
                      className="flex items-center justify-between gap-3 text-sm sm:gap-4"
                    >
                      <span className="min-w-0 break-words">
                        {profile?.display_name ?? "Player"}
                      </span>
                      <input
                        name={`placement_${p.user_id}`}
                        type="number"
                        min={1}
                        required
                        placeholder="#"
                        className="w-20 shrink-0 rounded-sm border border-line bg-bg-elevated px-3 py-2 text-base outline-none focus:border-accent sm:text-sm"
                      />
                    </label>
                  );
                })}
                <button
                  type="submit"
                  className="mt-2 rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
                >
                  Complete game
                </button>
              </form>
            </section>
          )}
        </>
      )}
    </main>
  );
}
