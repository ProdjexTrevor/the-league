"use client";

import { useMemo, useState, useTransition } from "react";

import { quickBet } from "@/app/actions";

type Opponent = { id: string; display_name: string | null };

const field =
  "mt-1.5 w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-fg outline-none transition focus:border-accent";

const chip = (on: boolean) =>
  `rounded-full border px-3 py-2 text-xs font-medium transition ${
    on
      ? "border-accent bg-accent/15 text-accent"
      : "border-line text-muted hover:border-fg/30 hover:text-fg"
  }`;

const PRESETS = [
  { label: "Match play", title: "Match play" },
  { label: "Bags to 21", title: "Bags to 21" },
  { label: "Closest to pin", title: "Closest to the pin" },
  { label: "Head-to-head", title: "Head-to-head" },
  { label: "Random dare", title: "Random dare" },
];

function nameOf(roster: Opponent[], id: string) {
  return roster.find((p) => p.id === id)?.display_name ?? "Player";
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
    if (side === "a") {
      setTeamAPlayers((prev) => prev.filter((x) => x !== id));
    } else {
      setTeamBPlayers((prev) => prev.filter((x) => x !== id));
    }
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
    <section className={showHeading ? "mt-2" : ""}>
      {showHeading ? (
        <>
          <h2 className="text-xl font-semibold tracking-tight">Make the bet</h2>
          <p className="mt-1 text-sm text-muted">
            They accept, then you both confirm who won before money hits the
            wallet.
          </p>
        </>
      ) : null}

      <div className={`${showHeading ? "mt-4" : ""} flex flex-wrap gap-2`}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setTitle(p.title)}
            className={chip(title === p.title)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <form action={onSubmit} className="mt-5 space-y-4">
        <input type="hidden" name="catalog_id" value={catalogId} />
        <input type="hidden" name="my_stake" value={myStake} />
        <input type="hidden" name="their_stake" value={theirStake} />
        <input type="hidden" name="stake_a" value={stakeA} />
        <input type="hidden" name="stake_b" value={stakeB} />

        <label className="block text-sm">
          <span className="text-muted">What’s the bet?</span>
          <input
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Front nine, low score"
            className={field}
          />
        </label>

        <div>
          <p className="text-sm text-muted">Bet type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={chip(wagerType === "straight")}
              onClick={() => setWagerType("straight")}
            >
              Straight up
            </button>
            <button
              type="button"
              className={chip(wagerType === "odds")}
              onClick={() => setWagerType("odds")}
            >
              Odds
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            {wagerType === "straight"
              ? "Same stake on both sides."
              : "Each side puts up its own amount."}
          </p>
        </div>

        <div>
          <p className="text-sm text-muted">Matchup</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={chip(matchup === "person")}
              onClick={() => setMatchup("person")}
            >
              Person vs person
            </button>
            <button
              type="button"
              className={chip(matchup === "team")}
              onClick={() => setMatchup("team")}
            >
              Team vs team
            </button>
          </div>
        </div>

        {matchup === "person" ? (
          <>
            <label className="block text-sm">
              <span className="text-muted">Against</span>
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

            <label className="block text-sm">
              <span className="text-muted">Your stake ($)</span>
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
                className={field}
              />
            </label>

            {wagerType === "odds" ? (
              <label className="block text-sm">
                <span className="text-muted">Their stake ($)</span>
                <input
                  type="number"
                  required
                  min={1}
                  step="1"
                  value={theirStake}
                  onChange={(e) => setTheirStake(e.target.value)}
                  className={field}
                />
              </label>
            ) : null}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-muted">Team A name</span>
                <input
                  name="team_a_name"
                  defaultValue="Team A"
                  className={field}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Team B name</span>
                <input
                  name="team_b_name"
                  defaultValue="Team B"
                  className={field}
                />
              </label>
            </div>

            <p className="text-xs text-muted">
              Add as many players as you want to each team. Someone can only be
              on one team.
            </p>

            {/* Team A */}
            <div className="rounded-xl border border-line p-3">
              <p className="text-sm font-medium">Team A players</p>
              <ul className="mt-2 space-y-1.5">
                {teamAPlayers.length === 0 ? (
                  <li className="text-sm text-muted">No one yet — add below.</li>
                ) : (
                  teamAPlayers.map((id) => (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>{nameOf(roster, id)}</span>
                      <button
                        type="button"
                        onClick={() => removeFromTeam("a", id)}
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
                  value={addA}
                  onChange={(e) => setAddA(e.target.value)}
                  className={`${field} mt-0 flex-1`}
                  disabled={availableForA.length === 0}
                >
                  <option value="">
                    {availableForA.length === 0
                      ? "Everyone is assigned"
                      : "Add player…"}
                  </option>
                  {availableForA.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name ?? "Player"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addA}
                  onClick={() => addToTeam("a", addA)}
                  className="shrink-0 rounded-xl border border-line px-3 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Team B */}
            <div className="rounded-xl border border-line p-3">
              <p className="text-sm font-medium">Team B players</p>
              <ul className="mt-2 space-y-1.5">
                {teamBPlayers.length === 0 ? (
                  <li className="text-sm text-muted">No one yet — add below.</li>
                ) : (
                  teamBPlayers.map((id) => (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>{nameOf(roster, id)}</span>
                      <button
                        type="button"
                        onClick={() => removeFromTeam("b", id)}
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
                  value={addB}
                  onChange={(e) => setAddB(e.target.value)}
                  className={`${field} mt-0 flex-1`}
                  disabled={availableForB.length === 0}
                >
                  <option value="">
                    {availableForB.length === 0
                      ? "Everyone is assigned"
                      : "Add player…"}
                  </option>
                  {availableForB.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name ?? "Player"}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addB}
                  onClick={() => addToTeam("b", addB)}
                  className="shrink-0 rounded-xl border border-line px-3 text-sm font-medium hover:border-accent hover:text-accent disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            <label className="block text-sm">
              <span className="text-muted">Team A stake ($)</span>
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
                className={field}
              />
            </label>

            {wagerType === "odds" ? (
              <label className="block text-sm">
                <span className="text-muted">Team B stake ($)</span>
                <input
                  type="number"
                  required
                  min={1}
                  step="1"
                  value={stakeB}
                  onChange={(e) => setStakeB(e.target.value)}
                  className={field}
                />
              </label>
            ) : null}
          </>
        )}

        <label className="block text-sm">
          <span className="text-muted">Line / handicap (optional)</span>
          <input
            name="line"
            placeholder="They get 3 strokes"
            className={field}
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Terms (optional)</span>
          <input
            name="terms"
            placeholder="Cash at the turn, no excuses."
            className={field}
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
          className="w-full rounded-xl bg-accent py-3.5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Sending invite…" : "Lock it in"}
        </button>
        <p className="text-center text-xs text-muted">
          They’ll get an invite. After they accept, both of you confirm the
          winner before anything hits the wallet.
        </p>
      </form>
    </section>
  );
}
