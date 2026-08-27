"use client";

import { useMemo, useState, useTransition } from "react";

import { quickBet } from "@/app/actions";

type Opponent = { id: string; display_name: string | null };

const field =
  "mt-2 w-full rounded-2xl border border-line bg-bg px-4 py-3.5 text-fg outline-none transition placeholder:text-muted/50 focus:border-accent";

const labelCls =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";

const PRESETS = [
  {
    label: "Match Play",
    title: "Match play",
    icon: "⛳",
    tone: "text-amber-300",
  },
  {
    label: "Nassau",
    title: "Nassau",
    icon: "🏌️",
    tone: "text-amber-300",
  },
  {
    label: "Closest to Pin",
    title: "Closest to the pin",
    icon: "🎯",
    tone: "text-amber-300",
  },
  {
    label: "Bags to 21",
    title: "Bags to 21",
    icon: "🌽",
    tone: "text-cyan-300",
  },
  {
    label: "Random Dare",
    title: "Random dare",
    icon: "🎲",
    tone: "text-cyan-300",
  },
  {
    label: "Head-to-Head",
    title: "Head-to-head",
    icon: "⚔️",
    tone: "text-cyan-300",
  },
] as const;

function nameOf(roster: Opponent[], id: string) {
  return roster.find((p) => p.id === id)?.display_name ?? "Player";
}

function Segment({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-bg p-1">
      {options.map((opt) => {
        const on = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition ${
              on
                ? "bg-accent text-accent-ink"
                : "text-muted hover:text-fg"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function QuickBetForm({
  catalogId,
  opponents,
  showHeading = true,
  defaultAgainstId = "",
  currentUserId,
}: {
  catalogId: string;
  opponents: Opponent[];
  showHeading?: boolean;
  defaultAgainstId?: string;
  currentUserId: string;
}) {
  const [title, setTitle] = useState("");
  const [wagerType, setWagerType] = useState<"straight" | "odds">("straight");
  const [matchup, setMatchup] = useState<"person" | "team">("person");
  const [myStake, setMyStake] = useState("20");
  const [theirStake, setTheirStake] = useState("20");
  const [stakeA, setStakeA] = useState("20");
  const [stakeB, setStakeB] = useState("20");
  const [teamAPlayers, setTeamAPlayers] = useState<string[]>([currentUserId]);
  const [teamBPlayers, setTeamBPlayers] = useState<string[]>(
    defaultAgainstId ? [defaultAgainstId] : []
  );
  const [addA, setAddA] = useState("");
  const [addB, setAddB] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  void showHeading;

  const roster = useMemo(() => {
    const map = new Map<string, Opponent>();
    map.set(currentUserId, { id: currentUserId, display_name: "You" });
    for (const o of opponents) map.set(o.id, o);
    return Array.from(map.values()).sort((a, b) =>
      (a.display_name ?? "").localeCompare(b.display_name ?? "")
    );
  }, [opponents, currentUserId]);

  const assigned = useMemo(
    () => new Set([...teamAPlayers, ...teamBPlayers]),
    [teamAPlayers, teamBPlayers]
  );

  const availableForA = roster.filter((p) => !assigned.has(p.id));
  const availableForB = roster.filter((p) => !assigned.has(p.id));

  function addToTeam(side: "a" | "b", id: string) {
    if (!id) return;
    if (side === "a") {
      setTeamAPlayers((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setTeamBPlayers((prev) => prev.filter((x) => x !== id));
      setAddA("");
    } else {
      setTeamBPlayers((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setTeamAPlayers((prev) => prev.filter((x) => x !== id));
      setAddB("");
    }
  }

  function removeFromTeam(side: "a" | "b", id: string) {
    if (side === "a") setTeamAPlayers((prev) => prev.filter((x) => x !== id));
    else setTeamBPlayers((prev) => prev.filter((x) => x !== id));
  }

  function onSubmit(formData: FormData) {
    setError(null);
    formData.set("wager_type", wagerType);
    formData.set("matchup", matchup);
    if (wagerType === "straight") {
      formData.set("their_stake", myStake);
      formData.set("stake_b", stakeA);
    }
    for (const id of teamAPlayers) formData.append("team_a_player", id);
    for (const id of teamBPlayers) formData.append("team_b_player", id);

    startTransition(async () => {
      try {
        await quickBet(formData);
      } catch (e) {
        if (
          typeof e === "object" &&
          e !== null &&
          "digest" in e &&
          String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw e;
        }
        setError(e instanceof Error ? e.message : "Could not lock it in.");
      }
    });
  }

  return (
    <section className="animate-rise rounded-3xl border border-line bg-bg-elevated/80 p-4 sm:p-5">
      <h2 className="font-display text-2xl tracking-[0.06em] text-fg">
        MAKE THE BET
      </h2>

      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {PRESETS.map((p) => {
          const selected = title === p.title;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setTitle(p.title)}
              className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition ${
                selected
                  ? "border-accent bg-accent/10 shadow-[0_0_24px_rgba(200,245,74,0.12)]"
                  : "border-line bg-bg/60 hover:border-fg/25"
              }`}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {p.icon}
              </span>
              <span
                className={`text-[10px] font-bold uppercase leading-tight tracking-wide ${p.tone}`}
              >
                {p.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted">
        Tap a box to fill the bet title — edit it below anytime.
      </p>

      <form action={onSubmit} className="mt-5 space-y-4">
        <input type="hidden" name="catalog_id" value={catalogId} />
        <input type="hidden" name="my_stake" value={myStake} />
        <input type="hidden" name="their_stake" value={theirStake} />
        <input type="hidden" name="stake_a" value={stakeA} />
        <input type="hidden" name="stake_b" value={stakeB} />

        <label className="block">
          <span className={labelCls}>What&apos;s the bet?</span>
          <input
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Back nine, match play"
            className={field}
          />
        </label>

        <div className="space-y-2">
          <p className={labelCls}>Stake style</p>
          <Segment
            value={wagerType}
            onChange={(id) => setWagerType(id as "straight" | "odds")}
            options={[
              { id: "straight", label: "Straight up" },
              { id: "odds", label: "Odds" },
            ]}
          />
        </div>

        <div className="space-y-2">
          <p className={labelCls}>Who&apos;s playing</p>
          <Segment
            value={matchup}
            onChange={(id) => setMatchup(id as "person" | "team")}
            options={[
              { id: "person", label: "1 vs 1" },
              { id: "team", label: "Teams" },
            ]}
          />
        </div>

        {matchup === "person" ? (
          <>
            <label className="block">
              <span className={labelCls}>Against</span>
              <select
                name="against_id"
                required
                defaultValue={
                  defaultAgainstId &&
                  opponents.some((o) => o.id === defaultAgainstId)
                    ? defaultAgainstId
                    : ""
                }
                className={field}
              >
                <option value="" disabled>
                  Pick a friend
                </option>
                {opponents.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.display_name ?? "Player"}
                  </option>
                ))}
              </select>
            </label>

            <div
              className={
                wagerType === "odds" ? "grid grid-cols-2 gap-3" : "block"
              }
            >
              <label className="block">
                <span className={labelCls}>
                  {wagerType === "odds" ? "You put up ($)" : "Stake ($)"}
                </span>
                <input
                  type="number"
                  required
                  min={1}
                  step="1"
                  value={myStake}
                  onChange={(e) => {
                    setMyStake(e.target.value);
                    if (wagerType === "straight") setTheirStake(e.target.value);
                  }}
                  placeholder="20"
                  className={field}
                />
              </label>
              {wagerType === "odds" ? (
                <label className="block">
                  <span className={labelCls}>They put up ($)</span>
                  <input
                    type="number"
                    required
                    min={1}
                    step="1"
                    value={theirStake}
                    onChange={(e) => setTheirStake(e.target.value)}
                    placeholder="30"
                    className={field}
                  />
                </label>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Team A</span>
                <input
                  name="team_a_name"
                  defaultValue="Team A"
                  className={field}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Team B</span>
                <input
                  name="team_b_name"
                  defaultValue="Team B"
                  className={field}
                />
              </label>
            </div>

            <TeamPicker
              title="Team A players"
              players={teamAPlayers}
              roster={roster}
              available={availableForA}
              addValue={addA}
              onAddValue={setAddA}
              onAdd={() => addToTeam("a", addA)}
              onRemove={(id) => removeFromTeam("a", id)}
            />
            <TeamPicker
              title="Team B players"
              players={teamBPlayers}
              roster={roster}
              available={availableForB}
              addValue={addB}
              onAddValue={setAddB}
              onAdd={() => addToTeam("b", addB)}
              onRemove={(id) => removeFromTeam("b", id)}
            />

            <div
              className={
                wagerType === "odds" ? "grid grid-cols-2 gap-3" : "block"
              }
            >
              <label className="block">
                <span className={labelCls}>
                  {wagerType === "odds" ? "Team A ($)" : "Stake ($)"}
                </span>
                <input
                  type="number"
                  required
                  min={1}
                  step="1"
                  value={stakeA}
                  onChange={(e) => {
                    setStakeA(e.target.value);
                    if (wagerType === "straight") setStakeB(e.target.value);
                  }}
                  placeholder="20"
                  className={field}
                />
              </label>
              {wagerType === "odds" ? (
                <label className="block">
                  <span className={labelCls}>Team B ($)</span>
                  <input
                    type="number"
                    required
                    min={1}
                    step="1"
                    value={stakeB}
                    onChange={(e) => setStakeB(e.target.value)}
                    placeholder="30"
                    className={field}
                  />
                </label>
              ) : null}
            </div>
          </>
        )}

        <label className="block">
          <span className={labelCls}>Line / handicap (optional)</span>
          <input
            name="line"
            placeholder="I give 2 strokes"
            className={field}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Terms (optional)</span>
          <textarea
            name="terms"
            rows={3}
            placeholder="Loser buys the round at the turn."
            className={`${field} resize-none`}
          />
        </label>

        {opponents.length === 0 ? (
          <p className="text-sm text-muted">
            Invite friends into a league first so you can bet against them — or
            use the full{" "}
            <a href="/create" className="text-accent hover:underline">
              create flow
            </a>
            .
          </p>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={
            pending ||
            opponents.length === 0 ||
            (matchup === "team" &&
              (teamAPlayers.length < 1 || teamBPlayers.length < 1))
          }
          className="w-full rounded-2xl bg-gradient-to-r from-accent to-[#a8e635] py-4 text-sm font-bold uppercase tracking-[0.12em] text-accent-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Locking in…" : "Lock it in"}
        </button>
      </form>
    </section>
  );
}

function TeamPicker({
  title,
  players,
  roster,
  available,
  addValue,
  onAddValue,
  onAdd,
  onRemove,
}: {
  title: string;
  players: string[];
  roster: Opponent[];
  available: Opponent[];
  addValue: string;
  onAddValue: (v: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-bg/50 p-3">
      <p className={labelCls}>{title}</p>
      <ul className="mt-2 space-y-1.5">
        {players.length === 0 ? (
          <li className="text-sm text-muted">No one yet</li>
        ) : (
          players.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span>{nameOf(roster, id)}</span>
              <button
                type="button"
                onClick={() => onRemove(id)}
                className="text-xs text-muted hover:text-danger"
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="mt-3 flex gap-2">
        <select
          value={addValue}
          onChange={(e) => onAddValue(e.target.value)}
          className={`${field} mt-0 flex-1 py-2.5`}
          disabled={available.length === 0}
        >
          <option value="">
            {available.length === 0 ? "Everyone assigned" : "Add player…"}
          </option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name ?? "Player"}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!addValue}
          onClick={onAdd}
          className="shrink-0 rounded-2xl border border-line px-4 text-sm font-semibold hover:border-accent hover:text-accent disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
