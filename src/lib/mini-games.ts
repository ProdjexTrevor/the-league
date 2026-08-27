/** Golf club draft — random reveal, bid in person, assign until each has N clubs. */

export const GOLF_CLUBS = [
  "Driver",
  "3-Wood",
  "5-Wood",
  "4-Iron",
  "5-Iron",
  "6-Iron",
  "7-Iron",
  "8-Iron",
  "9-Iron",
  "Pitching Wedge",
  "Gap Wedge",
  "Sand Wedge",
  "Lob Wedge",
  "Putter",
] as const;

export type GolfClub = (typeof GOLF_CLUBS)[number];

export type DraftPick = {
  club: string;
  price: number;
};

export type GolfClubDraftState = {
  type: "golf_club_draft";
  picksEach: number;
  /** Starting auction budget per player (dollars). */
  budgetStart: number;
  remaining: string[];
  current: string | null;
  picks: Record<string, DraftPick[]>;
  /** Dollars left for each player. */
  budgets: Record<string, number>;
  status: "drafting" | "complete";
};

export const DEFAULT_DRAFT_BUDGET = 20;

export const MINI_GAMES = [
  {
    id: "golf_club_draft",
    label: "Golf Club Draft (3 clubs)",
    description:
      "App flips a random club; you bid in person ($20 budget); assign the winner. Repeat until each player has 3.",
  },
] as const;

export type MiniGameId = (typeof MINI_GAMES)[number]["id"];

export function initGolfClubDraft(playerIds: string[]): GolfClubDraftState {
  const remaining = [...GOLF_CLUBS];
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  const picks: Record<string, DraftPick[]> = {};
  const budgets: Record<string, number> = {};
  for (const id of playerIds) {
    picks[id] = [];
    budgets[id] = DEFAULT_DRAFT_BUDGET;
  }
  return {
    type: "golf_club_draft",
    picksEach: 3,
    budgetStart: DEFAULT_DRAFT_BUDGET,
    remaining,
    current: null,
    picks,
    budgets,
    status: "drafting",
  };
}

/** Normalize older drafts that stored picks as string[] without budgets. */
export function normalizeGolfClubDraft(raw: unknown): GolfClubDraftState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.type !== "golf_club_draft") return null;

  const picksEach = Number(s.picksEach) || 3;
  const budgetStart = Number(s.budgetStart) || DEFAULT_DRAFT_BUDGET;
  const remaining = Array.isArray(s.remaining)
    ? s.remaining.map(String)
    : [...GOLF_CLUBS];
  const current = s.current == null ? null : String(s.current);
  const status = s.status === "complete" ? "complete" : "drafting";

  const rawPicks = (s.picks ?? {}) as Record<string, unknown>;
  const picks: Record<string, DraftPick[]> = {};
  for (const [uid, list] of Object.entries(rawPicks)) {
    if (!Array.isArray(list)) {
      picks[uid] = [];
      continue;
    }
    picks[uid] = list.map((item) => {
      if (typeof item === "string") return { club: item, price: 0 };
      const obj = item as { club?: string; price?: number };
      return {
        club: String(obj.club ?? ""),
        price: Number(obj.price) || 0,
      };
    });
  }

  const budgets: Record<string, number> = {};
  const rawBudgets = (s.budgets ?? {}) as Record<string, unknown>;
  for (const uid of Object.keys(picks)) {
    if (typeof rawBudgets[uid] === "number") {
      budgets[uid] = Number(rawBudgets[uid]);
    } else {
      const spent = picks[uid].reduce((sum, p) => sum + p.price, 0);
      budgets[uid] = Math.max(0, budgetStart - spent);
    }
  }

  return {
    type: "golf_club_draft",
    picksEach,
    budgetStart,
    remaining,
    current,
    picks,
    budgets,
    status,
  };
}

export function isGolfClubDraft(state: unknown): state is GolfClubDraftState {
  return normalizeGolfClubDraft(state) != null;
}

export function draftNeedsMorePicks(state: GolfClubDraftState): boolean {
  return Object.values(state.picks).some(
    (clubs) => clubs.length < state.picksEach
  );
}
