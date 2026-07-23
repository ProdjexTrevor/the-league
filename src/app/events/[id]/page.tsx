import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  addPlayerToEvent,
  deleteWagerLine,
  setWagerLine,
  settleEvent,
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import {
  formatOdds,
  liability,
  payout,
  scoringModeLabel,
  type ScoringMode,
} from "@/lib/wager";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const [
    { data: catalog },
    { data: players },
    { data: lines },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("game_catalog")
      .select("id, name, scoring_mode, description")
      .eq("id", event.catalog_id)
      .single(),
    supabase
      .from("event_players")
      .select("user_id, score, placement, outcome, units_delta, side_label, profiles(display_name)")
      .eq("event_id", id),
    supabase.from("wager_lines").select("*").eq("event_id", id),
    event.league_id
      ? supabase
          .from("league_members")
          .select("user_id, profiles(display_name)")
          .eq("league_id", event.league_id)
      : Promise.resolve({ data: null }),
  ]);

  const scoringMode = (catalog?.scoring_mode ?? "placement") as ScoringMode;
  const playerIds = new Set(players?.map((p) => p.user_id));
  const available =
    members?.filter((m) => !playerIds.has(m.user_id)) ?? [];

  const nameById = new Map(
    players?.map((p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      return [p.user_id, profile?.display_name ?? "Player"] as const;
    })
  );

  async function addPlayerAction(formData: FormData) {
    "use server";
    return addPlayerToEvent(id, formData);
  }
  async function setLineAction(formData: FormData) {
    "use server";
    return setWagerLine(id, formData);
  }
  async function deleteLineAction(formData: FormData) {
    "use server";
    return deleteWagerLine(id, formData);
  }
  async function settleAction(formData: FormData) {
    "use server";
    return settleEvent(id, formData);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-10 pb-20">
      <Link
        href={event.league_id ? `/leagues/${event.league_id}` : "/app"}
        className="text-sm text-muted hover:text-fg"
      >
        ← Back
      </Link>

      <header className="mt-6">
        <p className="text-sm uppercase tracking-wider text-muted">
          {event.kind} · {catalog?.name ?? "Game"} · {event.status}
        </p>
        <h1 className="mt-2 font-display text-5xl text-fg">{event.title}</h1>
        <p className="mt-3 text-sm text-muted">
          {scoringModeLabel(scoringMode)} · entry {event.entry_fee_units} · wager{" "}
          {event.wager_mode}
          {event.wager_mode !== "none" && ` · stake ${event.default_stake_units}`}
        </p>
        {event.notes && <p className="mt-2 text-sm text-muted">{event.notes}</p>}
        {event.kind === "tournament" && (
          <p className="mt-2 text-sm text-muted">
            Format: {event.format ?? "custom"}
            {event.bracket_size ? ` · bracket ${event.bracket_size}` : ""}
          </p>
        )}
      </header>

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Players</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {players?.map((p) => (
            <li
              key={p.user_id}
              className="flex items-center justify-between py-3 text-sm"
            >
              <span>
                {nameById.get(p.user_id)}
                {p.side_label ? ` (${p.side_label})` : ""}
              </span>
              <span className="text-muted">
                {event.status === "completed"
                  ? [
                      p.placement ? `#${p.placement}` : null,
                      p.score != null ? `score ${p.score}` : null,
                      p.outcome,
                      `${Number(p.units_delta) >= 0 ? "+" : ""}${p.units_delta}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "In"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {event.status !== "completed" && available.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Add player</h2>
          <form action={addPlayerAction} className="mt-3 flex flex-wrap gap-3">
            <select
              name="user_id"
              required
              defaultValue=""
              className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
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
            <input
              name="side_label"
              placeholder="Side label (optional)"
              className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-fg/40"
            >
              Add
            </button>
          </form>
        </section>
      )}

      {event.wager_mode === "odds" && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Odds board</h2>
          <p className="mt-1 text-sm text-muted">
            Fractional odds set by the creator. Example: {formatOdds(2, 1)} on
            stake {event.default_stake_units} means the other side puts up{" "}
            {liability(
              Number(event.default_stake_units) || 0,
              2,
              1
            ).toFixed(0)}{" "}
            if that line wins (full return{" "}
            {payout(Number(event.default_stake_units) || 0, 2, 1).toFixed(0)}).
          </p>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {lines?.map((line) => (
              <li
                key={line.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span>
                  {line.player_id
                    ? nameById.get(line.player_id) ?? line.player_id
                    : line.side_label}{" "}
                  <span className="text-accent">
                    {formatOdds(line.odds_num, line.odds_den)}
                  </span>{" "}
                  · stake {line.stake_units}
                  {Number(line.stake_units) > 0 && (
                    <span className="text-muted">
                      {" "}
                      · opposite puts up{" "}
                      {liability(
                        Number(line.stake_units),
                        line.odds_num,
                        line.odds_den
                      ).toFixed(0)}
                    </span>
                  )}
                </span>
                {event.status !== "completed" && (
                  <form action={deleteLineAction}>
                    <input type="hidden" name="line_id" value={line.id} />
                    <button type="submit" className="text-xs text-muted hover:text-danger">
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
            {(lines?.length ?? 0) === 0 && (
              <li className="py-3 text-sm text-muted">No lines yet.</li>
            )}
          </ul>
          {event.status !== "completed" && (players?.length ?? 0) > 0 && (
            <form action={setLineAction} className="mt-4 grid gap-3 sm:grid-cols-4">
              <select
                name="player_id"
                defaultValue=""
                className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
              >
                <option value="">Player (or use side below)</option>
                {players?.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {nameById.get(p.user_id)}
                  </option>
                ))}
              </select>
              <input
                name="side_label"
                placeholder="Team / side label"
                className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
              />
              <input
                name="odds_num"
                type="number"
                min={1}
                required
                defaultValue={2}
                placeholder="2"
                className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <input
                name="odds_den"
                type="number"
                min={1}
                required
                defaultValue={1}
                placeholder="1"
                className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
              <input
                name="stake_units"
                type="number"
                min={0}
                defaultValue={event.default_stake_units}
                className="rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent sm:col-span-2"
              />
              <button
                type="submit"
                className="rounded-sm border border-line px-4 py-2.5 text-sm hover:border-fg/40 sm:col-span-2"
              >
                Add line
              </button>
            </form>
          )}
        </section>
      )}

      {event.status !== "completed" && (players?.length ?? 0) >= 1 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Settle results</h2>
          <p className="mt-1 text-sm text-muted">
            Enter results for {scoringModeLabel(scoringMode)}.
          </p>
          <form action={settleAction} className="mt-4 space-y-3">
            {players?.map((p) => (
              <div
                key={p.user_id}
                className="flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <span>{nameById.get(p.user_id)}</span>
                <div className="flex flex-wrap gap-2">
                  {(scoringMode === "higher_wins" ||
                    scoringMode === "lower_wins") && (
                    <input
                      name={`score_${p.user_id}`}
                      type="number"
                      step="any"
                      required
                      placeholder="Score"
                      className="w-24 rounded-sm border border-line bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                    />
                  )}
                  {(scoringMode === "placement" || scoringMode === "custom") && (
                    <input
                      name={`placement_${p.user_id}`}
                      type="number"
                      min={1}
                      required
                      placeholder="#"
                      className="w-20 rounded-sm border border-line bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                    />
                  )}
                  {scoringMode === "head_to_head" && (
                    <select
                      name={`outcome_${p.user_id}`}
                      required
                      defaultValue=""
                      className="rounded-sm border border-line bg-bg-elevated px-3 py-2 outline-none focus:border-accent"
                    >
                      <option value="" disabled>
                        Result
                      </option>
                      <option value="win">Win</option>
                      <option value="loss">Loss</option>
                      <option value="draw">Draw</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
            <button
              type="submit"
              className="mt-2 rounded-sm bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink hover:brightness-110"
            >
              Complete & settle
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
