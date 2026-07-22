"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createEvent, createLeague, joinLeague } from "@/app/actions";
import { scoringModeLabel, type ScoringMode } from "@/lib/wager";

export type CatalogOption = {
  id: string;
  name: string;
  scoring_mode: string;
  description: string | null;
};

export type LeagueOption = {
  id: string;
  name: string;
};

export type UserOption = {
  id: string;
  display_name: string;
};

type Intent = "league" | "game" | "tournament" | "join" | null;

type Props = {
  catalog: CatalogOption[];
  leagues: LeagueOption[];
  users: UserOption[];
  /** leagueId -> member user ids */
  leagueMemberIds: Record<string, string[]>;
  currentUserId: string;
  lockedLeagueId?: string;
  initialIntent?: Exclude<Intent, "join" | null>;
  onCancelHref?: string;
};

const inputClass =
  "w-full rounded-sm border border-line bg-bg-elevated px-3 py-2.5 text-sm text-fg outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm text-muted";
const choiceClass =
  "w-full rounded-sm border border-line px-4 py-4 text-left transition hover:border-accent/50 hover:bg-fg/[0.03]";
const choiceActive =
  "w-full rounded-sm border border-accent bg-accent/10 px-4 py-4 text-left";

export function CreateWizard({
  catalog,
  leagues,
  users,
  leagueMemberIds,
  currentUserId,
  lockedLeagueId,
  initialIntent,
  onCancelHref = "/app",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [intent, setIntent] = useState<Intent>(initialIntent ?? null);
  const [step, setStep] = useState(initialIntent ? 1 : 0);

  const [leagueName, setLeagueName] = useState("");
  const [leagueDescription, setLeagueDescription] = useState("");
  const [leagueEntryFee, setLeagueEntryFee] = useState("0");

  const [catalogId, setCatalogId] = useState("");
  const [title, setTitle] = useState("");
  const [leagueId, setLeagueId] = useState(lockedLeagueId ?? "");
  const [entryFee, setEntryFee] = useState("0");
  const [wagerMode, setWagerMode] = useState<"none" | "pot" | "odds">("pot");
  const [stake, setStake] = useState("10");
  const [format, setFormat] = useState("single_elim");
  const [bracketSize, setBracketSize] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([
    currentUserId,
  ]);
  const [playerSearch, setPlayerSearch] = useState("");

  const [inviteCode, setInviteCode] = useState("");

  const selectedGame = useMemo(
    () => catalog.find((g) => g.id === catalogId) ?? null,
    [catalog, catalogId]
  );

  const availablePlayers = useMemo(() => {
    const effectiveLeague = lockedLeagueId || leagueId;
    if (effectiveLeague && leagueMemberIds[effectiveLeague]?.length) {
      const allowed = new Set(leagueMemberIds[effectiveLeague]);
      return users.filter((u) => allowed.has(u.id));
    }
    return users;
  }, [users, leagueId, lockedLeagueId, leagueMemberIds]);

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return availablePlayers;
    return availablePlayers.filter((u) =>
      u.display_name.toLowerCase().includes(q)
    );
  }, [availablePlayers, playerSearch]);

  const steps = useMemo(() => {
    if (!intent) return ["What are you creating?"];
    if (intent === "join") return ["What are you creating?", "Invite code"];
    if (intent === "league") {
      return ["What are you creating?", "League details", "Entry fee", "Review"];
    }
    return [
      "What are you creating?",
      "Pick a game",
      "Details",
      "Who's playing",
      "Wager & fees",
      "Review",
    ];
  }, [intent]);

  const maxStep = steps.length - 1;

  function togglePlayer(id: string) {
    if (id === currentUserId) return; // creator always in
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function goNext() {
    setError(null);
    if (step === 0 && !intent) {
      setError("Pick what you want to create.");
      return;
    }
    if (intent === "league" && step === 1 && !leagueName.trim()) {
      setError("Give your league a name.");
      return;
    }
    if (intent === "game" || intent === "tournament") {
      if (step === 1 && !catalogId) {
        setError("Pick a game from the catalog.");
        return;
      }
      if (step === 2 && !title.trim()) {
        setError("Add a title.");
        return;
      }
      if (step === 3 && selectedPlayerIds.length < 2) {
        setError("Select at least two players from the list.");
        return;
      }
    }
    if (intent === "join" && step === 1 && !inviteCode.trim()) {
      setError("Enter an invite code.");
      return;
    }
    setStep((s) => Math.min(s + 1, maxStep));
  }

  function goBack() {
    setError(null);
    if (step === 0 || (step === 1 && initialIntent)) {
      router.push(onCancelHref);
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        if (intent === "league") {
          fd.set("name", leagueName.trim());
          fd.set("description", leagueDescription.trim());
          fd.set("entry_fee", leagueEntryFee || "0");
          await createLeague(fd);
          return;
        }
        if (intent === "join") {
          fd.set("code", inviteCode.trim());
          await joinLeague(fd);
          return;
        }
        if (intent === "game" || intent === "tournament") {
          if (selectedPlayerIds.length < 2) {
            setError("Select at least two players.");
            return;
          }
          fd.set("kind", intent);
          fd.set("title", title.trim());
          fd.set("catalog_id", catalogId);
          if (leagueId) fd.set("league_id", leagueId);
          fd.set("entry_fee", entryFee || "0");
          fd.set("wager_mode", wagerMode);
          fd.set("stake", stake || "0");
          fd.set("notes", notes.trim());
          if (intent === "tournament") {
            fd.set("format", format);
            if (bracketSize) fd.set("bracket_size", bracketSize);
          }
          for (const id of selectedPlayerIds) {
            fd.append("player_id", id);
          }
          await createEvent(fd);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  const isLast =
    (intent === "join" && step === 1) ||
    (intent === "league" && step === 3) ||
    ((intent === "game" || intent === "tournament") && step === 5);

  const playerNames = selectedPlayerIds
    .map((id) => users.find((u) => u.id === id)?.display_name ?? "Player")
    .join(", ");

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          Step {step + 1} of {steps.length}
        </p>
        <div className="mt-3 flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition ${
                i <= step ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>
        <h1 className="mt-6 font-display text-4xl text-fg md:text-5xl">
          {steps[step]}
        </h1>
      </div>

      <div className="min-h-[280px] space-y-4">
        {step === 0 && (
          <div className="space-y-3 animate-rise">
            {(
              [
                ["game", "Game", "One match — pick players when it starts"],
                ["tournament", "Tournament", "Bracket or round robin"],
                ["league", "League", "Friend group with invite code"],
                ["join", "Join a league", "Enter an invite code"],
              ] as const
            )
              .filter(([key]) => {
                if (lockedLeagueId && (key === "league" || key === "join")) {
                  return false;
                }
                return true;
              })
              .map(([key, label, desc]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setIntent(key);
                    setError(null);
                  }}
                  className={intent === key ? choiceActive : choiceClass}
                >
                  <p className="font-medium text-fg">{label}</p>
                  <p className="mt-1 text-sm text-muted">{desc}</p>
                </button>
              ))}
          </div>
        )}

        {intent === "join" && step === 1 && (
          <div className="animate-rise space-y-3">
            <label className="block">
              <span className={labelClass}>Invite code</span>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className={`${inputClass} uppercase tracking-widest`}
                placeholder="ABCD1234"
                autoFocus
              />
            </label>
          </div>
        )}

        {intent === "league" && step === 1 && (
          <div className="animate-rise space-y-4">
            <label className="block">
              <span className={labelClass}>League name</span>
              <input
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                className={inputClass}
                placeholder="Thursday Night Crew"
                autoFocus
              />
            </label>
            <label className="block">
              <span className={labelClass}>Description (optional)</span>
              <textarea
                value={leagueDescription}
                onChange={(e) => setLeagueDescription(e.target.value)}
                rows={3}
                className={inputClass}
              />
            </label>
          </div>
        )}

        {intent === "league" && step === 2 && (
          <div className="animate-rise space-y-4">
            <label className="block">
              <span className={labelClass}>Season entry fee (units)</span>
              <input
                type="number"
                min={0}
                value={leagueEntryFee}
                onChange={(e) => setLeagueEntryFee(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        )}

        {intent === "league" && step === 3 && (
          <Review
            rows={[
              ["Type", "League"],
              ["Name", leagueName],
              ["Description", leagueDescription || "—"],
              ["Entry fee", `${leagueEntryFee || 0} units`],
            ]}
          />
        )}

        {(intent === "game" || intent === "tournament") && step === 1 && (
          <div className="animate-rise max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {catalog.length === 0 ? (
              <p className="text-sm text-danger">
                Catalog is empty. Run the competitions SQL migration first.
              </p>
            ) : (
              catalog.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setCatalogId(g.id);
                    if (!title) setTitle(g.name);
                  }}
                  className={catalogId === g.id ? choiceActive : choiceClass}
                >
                  <p className="font-medium">{g.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    {scoringModeLabel(g.scoring_mode as ScoringMode)}
                    {g.description ? ` · ${g.description}` : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        )}

        {(intent === "game" || intent === "tournament") && step === 2 && (
          <div className="animate-rise space-y-4">
            <label className="block">
              <span className={labelClass}>Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </label>
            {!lockedLeagueId && (
              <label className="block">
                <span className={labelClass}>League (optional)</span>
                <select
                  value={leagueId}
                  onChange={(e) => {
                    setLeagueId(e.target.value);
                    // reset selection to current user when league changes
                    setSelectedPlayerIds([currentUserId]);
                  }}
                  className={inputClass}
                >
                  <option value="">Standalone</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {intent === "tournament" && (
              <>
                <label className="block">
                  <span className={labelClass}>Format</span>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className={inputClass}
                  >
                    <option value="single_elim">Single elimination</option>
                    <option value="round_robin">Round robin</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Bracket size (optional)</span>
                  <input
                    type="number"
                    min={2}
                    value={bracketSize}
                    onChange={(e) => setBracketSize(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </>
            )}
            <label className="block">
              <span className={labelClass}>Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={inputClass}
              />
            </label>
          </div>
        )}

        {(intent === "game" || intent === "tournament") && step === 3 && (
          <div className="animate-rise space-y-4">
            <p className="text-sm text-muted">
              Select everyone in this {intent} from the user list. You are
              always included.
            </p>
            <input
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              className={inputClass}
              placeholder="Search players…"
            />
            {availablePlayers.length === 0 ? (
              <p className="text-sm text-danger">
                No users available.{" "}
                {leagueId || lockedLeagueId
                  ? "Add members to this league first."
                  : "Other people need to sign up first."}
              </p>
            ) : (
              <ul className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {filteredPlayers.map((u) => {
                  const checked = selectedPlayerIds.includes(u.id);
                  const locked = u.id === currentUserId;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => togglePlayer(u.id)}
                        disabled={locked}
                        className={`flex w-full items-center justify-between rounded-sm border px-4 py-3 text-left text-sm transition ${
                          checked
                            ? "border-accent bg-accent/10"
                            : "border-line hover:border-accent/40"
                        } ${locked ? "cursor-default opacity-90" : ""}`}
                      >
                        <span className="font-medium">
                          {u.display_name}
                          {locked ? " (you)" : ""}
                        </span>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-sm border text-xs ${
                            checked
                              ? "border-accent bg-accent text-accent-ink"
                              : "border-line"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-sm text-muted">
              Selected: {selectedPlayerIds.length}
            </p>
          </div>
        )}

        {(intent === "game" || intent === "tournament") && step === 4 && (
          <div className="animate-rise space-y-4">
            <label className="block">
              <span className={labelClass}>Entry fee (units)</span>
              <input
                type="number"
                min={0}
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                className={inputClass}
              />
            </label>
            <fieldset>
              <legend className={labelClass}>Wager mode</legend>
              <div className="space-y-2">
                {(
                  [
                    ["none", "No wager", "Just track results"],
                    ["pot", "Equal pot", "Everyone posts the same stake"],
                    ["odds", "Odds", "Set lines like 2 to 1"],
                  ] as const
                ).map(([value, label, desc]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWagerMode(value)}
                    className={wagerMode === value ? choiceActive : choiceClass}
                  >
                    <p className="font-medium">{label}</p>
                    <p className="mt-1 text-sm text-muted">{desc}</p>
                  </button>
                ))}
              </div>
            </fieldset>
            {wagerMode !== "none" && (
              <label className="block">
                <span className={labelClass}>
                  {wagerMode === "odds"
                    ? "Default stake (units)"
                    : "Stake / pot units"}
                </span>
                <input
                  type="number"
                  min={0}
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className={inputClass}
                />
              </label>
            )}
          </div>
        )}

        {(intent === "game" || intent === "tournament") && step === 5 && (
          <Review
            rows={[
              ["Type", intent === "tournament" ? "Tournament" : "Game"],
              ["Game", selectedGame?.name ?? "—"],
              ["Title", title],
              [
                "League",
                lockedLeagueId
                  ? (leagues.find((l) => l.id === lockedLeagueId)?.name ??
                    "This league")
                  : leagueId
                    ? (leagues.find((l) => l.id === leagueId)?.name ?? leagueId)
                    : "Standalone",
              ],
              ["Players", playerNames],
              ["Entry fee", `${entryFee || 0} units`],
              ["Wager", wagerMode],
              ...(wagerMode !== "none"
                ? [["Stake", `${stake || 0} units`] as [string, string]]
                : []),
            ]}
          />
        )}
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-10 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={pending}
          className="rounded-sm border border-line px-4 py-2.5 text-sm text-fg transition hover:border-fg/40 disabled:opacity-50"
        >
          {step === 0 || (step === 1 && initialIntent) ? "Cancel" : "Back"}
        </button>
        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            disabled={pending}
            className="rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-sm bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:brightness-110 disabled:opacity-50"
          >
            {pending
              ? "Creating…"
              : intent === "join"
                ? "Join league"
                : intent === "league"
                  ? "Create league"
                  : `Start ${intent}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Review({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="animate-rise divide-y divide-line border-y border-line">
      {rows.map(([k, v]) => (
        <div
          key={k}
          className="flex items-start justify-between gap-4 py-3 text-sm"
        >
          <dt className="shrink-0 text-muted">{k}</dt>
          <dd className="text-right font-medium text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
