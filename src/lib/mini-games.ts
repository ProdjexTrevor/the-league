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

export type GolfClubDraftState = {
  type: "golf_club_draft";
  picksEach: number;
  remaining: string[];
  current: string | null;
  picks: Record<string, string[]>;
  status: "drafting" | "complete";
};

export const MINI_GAMES = [
  {
    id: "golf_club_draft",
    label: "Golf Club Draft (3 clubs)",
    description:
      "App flips a random club; you bid in person; assign the winner. Repeat until each player has 3.",
  },
] as const;

export type MiniGameId = (typeof MINI_GAMES)[number]["id"];

export function initGolfClubDraft(playerIds: string[]): GolfClubDraftState {
  const remaining = [...GOLF_CLUBS];
  // Fisher–Yates shuffle so reveal order feels random from the start bag
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  const picks: Record<string, string[]> = {};
  for (const id of playerIds) picks[id] = [];
  return {
    type: "golf_club_draft",
    picksEach: 3,
    remaining,
    current: null,
    picks,
    status: "drafting",
  };
}

export function isGolfClubDraft(state: unknown): state is GolfClubDraftState {
  return (
    !!state &&
    typeof state === "object" &&
    (state as GolfClubDraftState).type === "golf_club_draft"
  );
}

export function draftNeedsMorePicks(state: GolfClubDraftState): boolean {
  return Object.values(state.picks).some(
    (clubs) => clubs.length < state.picksEach
  );
}
